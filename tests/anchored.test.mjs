import test from 'node:test';
import assert from 'node:assert/strict';
import { collectAnchoredEvidence } from '../lib/anchored.mjs';

const SHA = 'a'.repeat(40);
const APP = 15368;
const policy = { owner:'acme', repo:'tool', pullNumber:7, token:'test-token',
  requiredChecks:['Trusted CI'], trustedAppIds:[APP] };

function response(payload, {status=200, link=null}={}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name) => name.toLowerCase() === 'link' ? link : null },
    json: async () => payload
  };
}

function fixture(overrides={}) {
  const pr = { state:'open', merged_at:null, draft:false, head:{sha:SHA},
    base:{ref:'main'}, user:{login:'author'} };
  const branch = { protected:true };
  const protection = {
    enforce_admins:{enabled:true},
    required_pull_request_reviews:{required_approving_review_count:1,dismiss_stale_reviews:true},
    required_status_checks:{strict:true,checks:[{context:'Trusted CI',app_id:APP}]},
    allow_force_pushes:{enabled:false}, allow_deletions:{enabled:false}
  };
  const checks = { total_count:1, check_runs:[{name:'Trusted CI',head_sha:SHA,
    status:'completed',conclusion:'success',app:{id:APP}}] };
  const reviews = [{user:{login:'reviewer'},state:'APPROVED',commit_id:SHA,submitted_at:'2026-11-23T10:00:00Z'}];
  const payloads = new Map([
    ['/pulls/7',pr], ['/branches/main',branch], ['/branches/main/protection',protection],
    ['/commits/'+SHA+'/check-runs',checks], ['/pulls/7/reviews',{items:reviews}]
  ]);
  const state = {pr,branch,protection,checks,reviews};
  const fetchImpl = async (url) => {
    const path = new URL(url).pathname.replace('/repos/acme/tool','');
    if (overrides.httpStatus && path === overrides.httpStatus.path) return response({}, {status:overrides.httpStatus.status});
    let payload = payloads.get(path);
    if (path === '/pulls/7') payload = state.pr;
    if (path === '/branches/main') payload = state.branch;
    if (path === '/branches/main/protection') payload = state.protection;
    if (path === '/commits/'+SHA+'/check-runs') payload = {items:state.checks.check_runs};
    if (path === '/pulls/7/reviews') payload = {items:state.reviews};
    return response(payload);
  };
  return { fetchImpl, state };
}

test('collects exact-head remote policy evidence but never authorizes release', async () => {
  const f=fixture();
  const result=await collectAnchoredEvidence({...policy,fetchImpl:f.fetchImpl});
  assert.equal(result.status,'REMOTE_POLICY_MATCHED_NOT_RELEASE_AUTHORIZED');
  assert.equal(result.headSha,SHA);
  assert.equal(result.evidence.currentHeadIndependentApproval,true);
  assert.equal(result.releaseAuthorized,false);
});

test('rejects author self-approval and stale-head approvals', async () => {
  for (const review of [
    {user:{login:'author'},state:'APPROVED',commit_id:SHA,submitted_at:'2026-11-23T10:00:00Z'},
    {user:{login:'reviewer'},state:'APPROVED',commit_id:'b'.repeat(40),submitted_at:'2026-11-23T10:00:00Z'}
  ]) {
    const f=fixture(); f.state.reviews=[review];
    const result=await collectAnchoredEvidence({...policy,fetchImpl:f.fetchImpl});
    assert.equal(result.reason,'CURRENT_HEAD_INDEPENDENT_APPROVAL_MISSING');
  }
});

test('latest reviewer state wins; dismissed or changes-requested review cannot pass', async () => {
  const f=fixture();
  f.state.reviews.push({user:{login:'reviewer'},state:'CHANGES_REQUESTED',commit_id:SHA,submitted_at:'2026-11-23T11:00:00Z'});
  const result=await collectAnchoredEvidence({...policy,fetchImpl:f.fetchImpl});
  assert.equal(result.reason,'CURRENT_HEAD_INDEPENDENT_APPROVAL_MISSING');
});

test('rejects unprotected base and insufficient server-side review/check policy', async () => {
  for (const mutate of [
    (f)=>{f.state.branch.protected=false;},
    (f)=>{f.state.protection.enforce_admins.enabled=false;},
    (f)=>{f.state.protection.required_pull_request_reviews.dismiss_stale_reviews=false;},
    (f)=>{f.state.protection.required_status_checks.strict=false;},
    (f)=>{f.state.protection.required_status_checks.checks=[];}
  ]) {
    const f=fixture(); mutate(f);
    const result=await collectAnchoredEvidence({...policy,fetchImpl:f.fetchImpl});
    assert.equal(result.status,'BLOCKED');
  }
});

test('requires required checks to be bound to the trusted GitHub App', async () => {
  const f=fixture(); f.state.protection.required_status_checks.checks[0].app_id=999;
  const result=await collectAnchoredEvidence({...policy,fetchImpl:f.fetchImpl});
  assert.equal(result.reason,'REQUIRED_CHECK_NOT_BOUND_TO_TRUSTED_APP');
});

test('rejects missing, stale, pending, failed, or untrusted check-runs', async () => {
  const mutations = [
    (f)=>{f.state.checks.check_runs=[];},
    (f)=>{f.state.checks.check_runs[0].head_sha='b'.repeat(40);},
    (f)=>{f.state.checks.check_runs[0].status='in_progress';},
    (f)=>{f.state.checks.check_runs[0].conclusion='failure';},
    (f)=>{f.state.checks.check_runs[0].app.id=999;}
  ];
  for (const mutate of mutations) {
    const f=fixture(); mutate(f);
    const result=await collectAnchoredEvidence({...policy,fetchImpl:f.fetchImpl});
    assert.equal(result.status,'BLOCKED');
  }
});

test('403 protection read is a hard block, never downgraded to local PASS', async () => {
  const f=fixture();
  f.state.protection=null;
  const wrapped=async (url,opts)=>{
    if(new URL(url).pathname.endsWith('/branches/main/protection')) return response({}, {status:403});
    return f.fetchImpl(url,opts);
  };
  const result=await collectAnchoredEvidence({...policy,fetchImpl:wrapped});
  assert.equal(result.status,'BLOCKED');
  assert.equal(result.reason,'REMOTE_API_403');
  assert.equal(result.releaseAuthorized,false);
});

test('rejects draft PRs and invalid external policy', async () => {
  const f=fixture(); f.state.pr.draft=true;
  const draft=await collectAnchoredEvidence({...policy,fetchImpl:f.fetchImpl});
  assert.equal(draft.reason,'PULL_REQUEST_IS_DRAFT');
  const missing=await collectAnchoredEvidence({...policy,requiredChecks:[],fetchImpl:f.fetchImpl});
  assert.equal(missing.reason,'EXTERNAL_POLICY_OR_INPUT_INVALID');
});

test('pagination that cannot be proven complete is blocked', async () => {
  const f=fixture();
  const wrapped=async (url,opts)=>{
    const r=await f.fetchImpl(url,opts);
    if(new URL(url).pathname.endsWith('/reviews')) {
      return {...r,headers:{get:(name)=>name.toLowerCase()==='link' ? '<https://api.github.com/repos/acme/tool/pulls/7/reviews?per_page=100&page=2>; rel="next"' : null}};
    }
    return r;
  };
  const result=await collectAnchoredEvidence({...policy,fetchImpl:wrapped});
  assert.equal(result.status,'BLOCKED');
  assert.equal(result.reason,'REMOTE_PAGINATION_INCOMPLETE');
});
