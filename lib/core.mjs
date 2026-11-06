import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { BASE,sha,json,safe,read,readJSON,create,inventory,engineHash,redact,withLock } from './fs.mjs';
import { profiles,checkDocs } from './docs.mjs';
export const git=(root,args)=>spawnSync('git',args,{cwd:root,encoding:'utf8',timeout:10000,maxBuffer:2*1024*1024,env:{...process.env,GIT_TERMINAL_PROMPT:'0'}});
export function gitState(root) {
  const top=git(root,['rev-parse','--show-toplevel']);
  if(top.status!==0) return {ok:false,reason:'GIT_MISSING'};
  if(path.resolve(top.stdout.trim())!==root) return {ok:false,reason:'PARENT_REPOSITORY_REFUSED'};
  const b=git(root,['symbolic-ref','--short','HEAD']); const h=git(root,['rev-parse','HEAD']);
  const status=git(root,['status','--porcelain=v1','-z','--untracked-files=all']);
  const staged=git(root,['diff','--cached','--name-only','-z']);
  if(status.status!==0 || staged.status!==0) return {ok:false,reason:'GIT_STATUS_FAILED'};
  return {ok:true,branch:b.status===0?b.stdout.trim():null,head:h.status===0?h.stdout.trim():null,dirty:Boolean(status.stdout),staged:Boolean(staged.stdout)};
}
export function binding(root) {
  const g=gitState(root);
  return {source:sha(json(inventory(root))),engine:engineHash(),head:g.head??null,branch:g.branch??null};
}
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function config(root) {
  const c=readJSON(root,'.dct/config.json');
  if(c.schemaVersion!==1 || !profiles[c.type] || !c.task || typeof c.task.id!=='string' || typeof c.task.outcome!=='string' || typeof c.task.coder!=='string' || [c.task.id,c.task.outcome,c.task.coder].some(v=>!v.trim() || /TODO|TBD/.test(v))) throw Error('TASK_NOT_CONFIGURED');
  if(!/^[0-9a-f]{40}$/.test(c.task.baseHead??'') || git(root,['merge-base','--is-ancestor',c.task.baseHead,'HEAD']).status!==0) throw Error('TASK_BASELINE_REQUIRED');
  for(const field of ['allowedPaths','protectedPaths']) {
    if(!Array.isArray(c.task[field]) || (field==='allowedPaths' && !c.task[field].length)) throw Error('SCOPE_NOT_CONFIGURED');
    for(const p of c.task[field]) safe(root,p);
  }
  if(!Array.isArray(c.checks) || !c.checks.length || !Array.isArray(c.requiredCheckIds) || !c.requiredCheckIds.length || new Set(c.requiredCheckIds).size!==c.requiredCheckIds.length) throw Error('CHECKS_NOT_CONFIGURED');
  const ids=new Set();
  for(const ch of c.checks) {
    if(!ch || typeof ch.id!=='string' || ids.has(ch.id) || !Array.isArray(ch.argv) || !ch.argv.length || ch.argv.some(v=>typeof v!=='string'||v.includes('\0')) || !['node-tap','python-unittest','json-io'].includes(ch.kind) || !Number.isInteger(ch.timeoutMs) || ch.timeoutMs<100 || ch.timeoutMs>300000) throw Error('INVALID_CHECK');
    ids.add(ch.id);
    if(ch.kind!=='json-io' && (!Number.isInteger(ch.minTests)||ch.minTests<1 || !Array.isArray(ch.requiredTests) || !ch.requiredTests.length || ch.requiredTests.some(t=>typeof t!=='string'||!t.trim()))) throw Error('INVALID_MIN_TESTS');
    if(ch.kind==='node-tap' && (!['node',process.execPath].includes(ch.argv[0]) || !ch.argv.includes('--test') || !ch.argv.includes('--test-reporter=tap'))) throw Error('NODE_TEST_RUNNER_REQUIRED');
    if(ch.kind==='python-unittest' && (!/^python(?:3(?:\.\d+)?)?$/.test(path.basename(ch.argv[0])) || ch.argv[1]!=='-m' || ch.argv[2]!=='unittest')) throw Error('UNITTEST_RUNNER_REQUIRED');
    if(ch.kind==='json-io' && (!Object.hasOwn(ch,'input') || !Object.hasOwn(ch,'expected'))) throw Error('IO_CONTRACT_REQUIRED');
  }
  if(c.requiredCheckIds.some(id=>!ids.has(id))) throw Error('REQUIRED_CHECK_MISSING');
  if(!Array.isArray(c.capabilities) || profiles[c.type].capabilities.some(x=>!c.capabilities.includes(x)) || c.capabilities.some(x=>!['env','admin-seed','health'].includes(x))) throw Error('CAPABILITIES_INVALID');
  if(!Array.isArray(c.mockPaths)) throw Error('MOCK_PATHS_INVALID');
  for(const p of c.mockPaths) {safe(root,p); if(!/^(tests|fixtures|demo)(\/|$)/.test(p)) throw Error('MOCK_SCOPE_REFUSED');}
  if(c.requireReview!==true) throw Error('REVIEW_POLICY_REQUIRED');
  return c;
}
function changedPaths(root,baseHead) {
  const h=git(root,['rev-parse','--verify','HEAD']);
  const a=h.status===0?git(root,['diff',baseHead,'--name-only','-z']):git(root,['ls-files','-z']);
  const u=git(root,['ls-files','--others','--exclude-standard','-z']);
  if(a.status!==0 || u.status!==0) throw Error('DIFF_UNAVAILABLE');
  return [...new Set((a.stdout+u.stdout).split('\0').filter(Boolean))].filter(p=>!/^\.dct\/(runs|reviews|handoffs)\//.test(p) && p!=='.dct/operation.lock');
}
const inScope=(p,scope)=>scope.some(s=>p===s || p.startsWith(s.replace(/\/$/,'')+'/'));
function findings(root,c,rows) {
  const out=[];
  for(const item of rows) {
    const p=item.path;
    if(/^\.env(?:\.|$)/.test(path.basename(p)) && !p.endsWith('.example')) {out.push({code:'ENV_FILE_PRESENT',path:p});continue;}
    const buf=fs.readFileSync(safe(root,p)); if(buf.includes(0)) continue;
    const s=buf.toString('utf8');
    if(/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\b(?:sk-|ghp_|github_pat_)[a-zA-Z0-9_-]{20,}/.test(s) || /\b(?:password|api[_-]?key|secret|token)\s*[:=]\s*["'][^"'\n]{8,}["']/i.test(s) || /[a-z][a-z0-9+.-]*:\/\/[^\s/@:]+:[^\s/@]+@/i.test(s)) out.push({code:'POSSIBLE_SECRET',path:p});
    if(/\.(?:[cm]?[jt]sx?|py|html|vue|svelte)$/.test(p) && /\b(?:mockData|fakeData|dummyData)\b|test_only|SIMULATED/.test(s) && !inScope(p,c.mockPaths)) out.push({code:'MOCK_IN_RUNTIME',path:p});
  }
  for(const p of changedPaths(root,c.task.baseHead)) {
    if(!inScope(p,c.task.allowedPaths)) out.push({code:'OUT_OF_SCOPE',path:p});
    if(inScope(p,c.task.protectedPaths)) out.push({code:'PROTECTED_CHANGE',path:p});
  }
  for(const cap of c.capabilities) {
    const p=c.artifacts?.[cap];
    if(typeof p!=='string') {out.push({code:'ARTIFACT_MISSING',capability:cap});continue;}
    try {if(!read(root,p).trim()) throw Error();}catch{out.push({code:'ARTIFACT_INVALID',capability:cap});}
  }
  return out;
}
export function doctor(root) {
  const issues=[]; let c;
  const g=gitState(root);
  if(!g.ok) issues.push(g.reason);
  else {if(!g.branch || ['main','master'].includes(g.branch)) issues.push('FEATURE_BRANCH_REQUIRED');if(!g.head) issues.push('INITIAL_COMMIT_REQUIRED');}
  try {c=config(root);}catch(e){issues.push(e.message);}
  let rows=[]; try{rows=inventory(root);}catch(e){issues.push(e.message);}
  if(c) {
    try{issues.push(...checkDocs(root,c.type));}catch{issues.push('DOC_CONTRACT_INVALID');}
    if(g.ok) try {issues.push(...findings(root,c,rows));}catch(e){issues.push(e.message);}
  }
  return {schemaVersion:1,status:issues.length?'NOT_READY':'PASS',issues,git:g,scan:'HEURISTIC_NOT_SECURITY_AUDIT',semanticAcceptance:'NOT_EVALUATED'};
}
export function evaluate(ch,r) {
  if(r.error || r.signal || r.status!==0) return {status:'FAIL',reason:r.error?.code??r.signal??'EXIT_NONZERO'};
  const text=(r.stdout??'')+'\n'+(r.stderr??'');
  if(ch.kind==='node-tap') {
    const count=key=>Number(text.match(new RegExp('^# '+key+' (\\d+)\\s*$','m'))?.[1]??NaN);
    const tests=count('tests'),fail=count('fail'),skip=count('skipped'),todo=count('todo'),pass=count('pass');
    if(ch.requiredTests?.some(t=>!text.split(/\r?\n/).some(line=>line.trim()==='# Subtest: '+t)) || !ch.requiredTests?.length || !/^TAP version 13\s*$/m.test(text)||!/^1\.\.[1-9]\d*\s*$/m.test(text)||!Number.isInteger(tests)||tests<ch.minTests||fail!==0||skip!==0||todo!==0||pass!==tests||/^not ok /m.test(text)) return {status:'FAIL',reason:'TAP_INCOMPLETE_OR_FAILED',tests};
    return {status:'PASS',tests};
  }
  if(ch.kind==='python-unittest') {
    const n=Number(text.match(/Ran (\d+) tests? in /)?.[1]??NaN);
    if(ch.requiredTests?.some(t=>!text.includes(t+' ... ok')) || !ch.requiredTests?.length || !Number.isInteger(n)||n<ch.minTests||!/^OK\s*$/m.test(text)||/skipped=|expected failures=|unexpected successes=/.test(text)) return {status:'FAIL',reason:'UNITTEST_INCOMPLETE_OR_FAILED',tests:n};
    return {status:'PASS',tests:n};
  }
  try {return equal(JSON.parse(r.stdout),ch.expected)?{status:'PASS',tests:1}:{status:'FAIL',reason:'OUTPUT_MISMATCH'};}catch{return {status:'FAIL',reason:'OUTPUT_NOT_JSON'};}
}
function runOne(root,ch) {
  // Commands are trusted project code, run only by explicit CLI --run; this is not an OS sandbox.
  const env={...process.env,DCT_RUN:'1',GIT_TERMINAL_PROMPT:'0'};
  delete env.NODE_TEST_CONTEXT;
  if(ch.kind==='python-unittest') {env.PYTHONDONTWRITEBYTECODE='1';env.PYTHONPYCACHEPREFIX=path.join(root,'.dct/runs','unused-pycache-'+crypto.randomBytes(8).toString('hex'));}
  const r=spawnSync(ch.argv[0],ch.argv.slice(1),{cwd:root,shell:false,encoding:'utf8',input:ch.kind==='json-io'?json(ch.input):undefined,timeout:ch.timeoutMs,killSignal:'SIGKILL',maxBuffer:1024*1024,env});
  return {...evaluate(ch,r),id:ch.id,exitCode:r.status,signal:r.signal??null,output:redact((r.stdout??'')+'\n'+(r.stderr??''))};
}
const id=()=>new Date().toISOString().replace(/[:.]/g,'-')+'-'+crypto.randomBytes(4).toString('hex');
function latest(root,dir) {
  const p=safe(root,dir); if(!fs.existsSync(p)) return null;
  const files=fs.readdirSync(p).filter(x=>/^\d.*\.json$/.test(x)).sort();
  return files.length?readJSON(root,dir+'/'+files.at(-1)):null;
}
export function runChecks(root) {
  return withLock(root,()=>{
    const d=doctor(root); if(d.status!=='PASS') return d;
    const c=config(root),before=binding(root),results=[];
    for(const ch of c.checks) results.push(runOne(root,ch));
    const after=binding(root),drift=!equal(before,after);
    const report={schemaVersion:1,id:id(),status:!drift && results.every(x=>x.status==='PASS')?'PASS':'NOT_READY',binding:before,task:c.task.id,results,drift,processIsolation:'NOT_VERIFIED',commands:'OWNER_TRUSTED_CODE',at:new Date().toISOString()};
    create(root,'.dct/runs/'+report.id+'.json',json(report)); return report;
  });
}
export function reviewRequest(root) {
  const c=config(root); return {schemaVersion:1,binding:binding(root),task:c.task.id,coder:c.task.coder,reviewer:'TODO_SEPARATE_CONTEXT',context:'TODO_EXTERNAL_CONTEXT_REFERENCE',verdict:'NOT_READY',blockers:[],notes:'Review diff, test changes/skip, historical behavior, security, docs and launch paths. Do not trust coder claims.',identityVerified:false};
}
function validReview(r,c,b) {
  return r?.schemaVersion===1 && r.task===c.task.id && r.coder===c.task.coder && typeof r.reviewer==='string' && r.reviewer.trim() && !/TODO|TBD/.test(r.reviewer) && r.reviewer!==c.task.coder && typeof r.context==='string' && r.context.trim() && !/TODO|TBD/.test(r.context) && r.verdict==='PASS' && Array.isArray(r.blockers) && r.blockers.length===0 && typeof r.notes==='string' && r.notes.trim() && equal(r.binding,b);
}
export function importReview(root,file) {
  return withLock(root,()=>{
    const c=config(root),r=readJSON(root,file); if(!validReview(r,c,binding(root))) throw Error('REVIEW_INVALID_OR_STALE');
    const result={...r,identityVerified:false,provenance:'EXTERNAL_ATTESTATION_NOT_AUTHENTICATED',importedAt:new Date().toISOString()};
    create(root,'.dct/reviews/'+id()+'.json',json(result)); return {status:'IMPORTED',identityVerified:false};
  });
}
export function gate(root,{run=false,release=false,precommit=false}={}) {
  if(run) {const r=runChecks(root); if(r.status!=='PASS')return r;}
  const d=doctor(root); if(d.status!=='PASS')return d;
  const c=config(root),b=binding(root),issues=[];
  const receipt=latest(root,'.dct/runs');
  if(!receipt || receipt.status!=='PASS' || receipt.task!==c.task.id || !equal(receipt.binding,b) || !equal(receipt.results?.map(x=>x.id),c.checks.map(x=>x.id)) || receipt.results.some(x=>x.status!=='PASS')) issues.push('CHECK_EVIDENCE_MISSING_OR_STALE');
  const rev=latest(root,'.dct/reviews'); if(!validReview(rev,c,b))issues.push('INDEPENDENT_REVIEW_MISSING_OR_STALE');
  if(precommit) {
    const unstaged=git(root,['diff','--name-only','-z']);
    const untracked=git(root,['ls-files','--others','--exclude-standard','-z']);
    if(unstaged.status!==0 || untracked.status!==0 || unstaged.stdout || untracked.stdout.split('\0').some(p=>p && !/^\.dct\/(runs|reviews|handoffs)\//.test(p)))issues.push('INDEX_WORKTREE_MISMATCH');
  }
  // Local attestations cannot authenticate GitHub reviews, remote protection, CI or human acceptance.
  if(release) issues.push('REMOTE_PR_CI_PROTECTION_AND_HUMAN_ACCEPTANCE_NOT_VERIFIED');
  return {schemaVersion:1,status:issues.length?'NOT_READY':'PASS',issues,binding:b,scope:'LOCAL_CHECKS_AND_REVIEW_ATTESTATION',independentIdentity:'NOT_AUTHENTICATED',remoteCI:'NOT_VERIFIED',humanAcceptance:'PENDING',deployment:'NOT_VERIFIED'};
}
export function sentinel(root) {
  const b=binding(root); const result={schemaVersion:1,status:'RECORDED',binding:b,git:gitState(root),gate:gate(root),action:'PRESERVE_AND_DIAGNOSE',destructiveAction:false,at:new Date().toISOString()};
  create(root,'.dct/handoffs/sentinel-'+id()+'.json',json(result)); return result;
}
export function handoff(root,notes={}) {
  const result={schemaVersion:1,status:'RECORDED',binding:binding(root),git:gitState(root),doctor:doctor(root),latestRun:latest(root,'.dct/runs'),goal:redact(notes.goal??'NOT_PROVIDED'),traps:redact(notes.traps??'NOT_PROVIDED'),next:redact(notes.next??'NOT_PROVIDED'),at:new Date().toISOString()};
  const rel='.dct/handoffs/'+id()+'.json';create(root,rel,json(result));return {status:'RECORDED',path:rel,...result};
}
export function resume(root,file) {
  const r=readJSON(root,file);return {status:equal(r.binding,binding(root))?'MATCH':'NOT_READY',reason:'RECHECK_CURRENT_SOURCE_BEFORE_WRITING',handoff:r};
}
export function installHooks(root,apply=false) {
  const g=gitState(root);if(!g.ok) throw Error(g.reason);
  const existing=git(root,['config','--get','core.hooksPath']);if(existing.status===0) throw Error('EXISTING_HOOKS_PATH_PRESERVED');
  const hookPath=git(root,['rev-parse','--git-path','hooks/pre-commit']);
  if(hookPath.status!==0) throw Error('GIT_HOOK_PATH_UNAVAILABLE');
  const hp=path.resolve(root,hookPath.stdout.trim()); if(fs.existsSync(hp))throw Error('EXISTING_HOOK_PRESERVED');
  const files={'.dct/hooks/pre-commit':'#!/bin/sh\nset -eu\nROOT=$(git rev-parse --show-toplevel)\ncd "$ROOT"\nexec node '+shellQuote(path.join(BASE,'bin/dct.mjs'))+' gate --project "$ROOT" --precommit\n'};
  const conflicts=Object.keys(files).filter(p=>fs.existsSync(safe(root,p))); if(conflicts.length) throw Error('EXISTING_HOOK_PRESERVED');
  if(!apply)return {status:'PLAN',files:Object.keys(files),config:'core.hooksPath=.dct/hooks'};
  create(root,'.dct/hooks/pre-commit',files['.dct/hooks/pre-commit'],0o755);
  const cp=git(root,['rev-parse','--git-path','config']);
  if(cp.status!==0) throw Error('GIT_CONFIG_PATH_UNAVAILABLE');
  const configPath=path.resolve(root,cp.stdout.trim());
  const st=fs.lstatSync(configPath);if(st.isSymbolicLink()||st.nlink>1)throw Error('GIT_CONFIG_LINK_REFUSED');
  const backup=configPath+'.dct-backup-'+id();
  fs.writeFileSync(backup,fs.readFileSync(configPath),{flag:'wx',mode:0o600});
  const r=git(root,['config','--local','core.hooksPath','.dct/hooks']);
  return {status:r.status===0?'INSTALLED':'NOT_READY',portable:false,configBackup:backup,note:'Reinstall at new toolkit location; hooks bypassable, use required remote CI.'};
}
function shellQuote(s) {return "'"+s.replaceAll("'","'\\''")+"'";}
export function ciPlan(root,apply=false) {
  const rel='.github/workflows/dct.yml';if(fs.existsSync(safe(root,rel)))throw Error('EXISTING_CI_PRESERVED');
  const text=`name: DCT
on: [pull_request, workflow_dispatch]
permissions:
  contents: read
jobs:
  local-checks:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          ref: \${{ github.event.pull_request.head.sha || github.sha }}
          path: project
          fetch-depth: 0
      - name: Require pinned toolkit source
        env:
          DCT_REPOSITORY: \${{ vars.DCT_REPOSITORY }}
          DCT_REF: \${{ vars.DCT_REF }}
        run: |
          test -n "$DCT_REPOSITORY"
          echo "$DCT_REF" | grep -Eq '^[0-9a-f]{40}$'
      - uses: actions/checkout@v4
        with:
          repository: \${{ vars.DCT_REPOSITORY }}
          ref: \${{ vars.DCT_REF }}
          path: dct
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - name: Feature ref for local policy
        working-directory: project
        run: git checkout -b ci/dct
      - name: Validate local checks
        working-directory: project
        run: node "$GITHUB_WORKSPACE/dct/bin/dct.mjs" check --project "$GITHUB_WORKSPACE/project" --run
`;
  if(apply)create(root,rel,text);return {status:apply?'CREATED':'PLAN',path:rel,prerequisite:'Configure DCT_REPOSITORY and full commit SHA DCT_REF for sibling checkout; independent review is not auto-approved. Remote CI not verified.'};
}
