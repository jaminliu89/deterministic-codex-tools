const API = 'https://api.github.com';
const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const uniqueStrings = (v) => Array.isArray(v) && v.length > 0
  && v.every((x) => typeof x === 'string' && x.trim() !== '')
  && new Set(v).size === v.length;

function blocked(reason, details = {}) {
  return { schemaVersion: 1, status: 'BLOCKED', reason, releaseAuthorized: false, ...details };
}

function validateInput(input) {
  if (!isObject(input) || typeof input.owner !== 'string' || !/^[A-Za-z0-9-]+$/.test(input.owner)
    || typeof input.repo !== 'string' || !/^[A-Za-z0-9_.-]+$/.test(input.repo)
    || !Number.isSafeInteger(input.pullNumber) || input.pullNumber < 1
    || typeof input.token !== 'string' || input.token.trim() === ''
    || !uniqueStrings(input.requiredChecks)
    || !Array.isArray(input.trustedAppIds) || input.trustedAppIds.length === 0
    || input.trustedAppIds.some((id) => !Number.isSafeInteger(id) || id < 1)
    || new Set(input.trustedAppIds).size !== input.trustedAppIds.length) {
    return 'EXTERNAL_POLICY_OR_INPUT_INVALID';
  }
  if (typeof (input.fetchImpl ?? globalThis.fetch) !== 'function') return 'FETCH_UNAVAILABLE';
  return null;
}

function parseNext(link) {
  if (!link) return null;
  for (const part of link.split(',')) {
    const match = part.match(/<([^>]+)>\s*;\s*rel="next"/);
    if (match) return match[1];
  }
  return null;
}

async function githubGet(url, token, fetchImpl) {
  const response = await fetchImpl(url, {
    method: 'GET',
    redirect: 'error',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: 'Bearer ' + token,
      'X-GitHub-Api-Version': '2022-11-28'
    }
  });
  if (!response || typeof response.ok !== 'boolean') throw new Error('REMOTE_RESPONSE_INVALID');
  if (!response.ok) throw new Error('REMOTE_API_' + response.status);
  return response;
}

async function getJson(path, token, fetchImpl) {
  const response = await githubGet(API + path, token, fetchImpl);
  return response.json();
}

async function getAll(path, token, fetchImpl, collectionKey, maxPages = 10) {
  let url = API + path + (path.includes('?') ? '&' : '?') + 'per_page=100&page=1';
  const rows = [];
  for (let page = 0; page < maxPages; page += 1) {
    const response = await githubGet(url, token, fetchImpl);
    const payload = await response.json();
    const pageItems = Array.isArray(payload) ? payload : payload?.[collectionKey];
    if (!Array.isArray(pageItems)) throw new Error('REMOTE_PAGINATION_PAYLOAD_INVALID');
    rows.push(...pageItems);
    const next = parseNext(response.headers?.get?.('link') ?? null);
    if (!next) return rows;
    const parsed = new URL(next);
    if (parsed.origin !== API || !parsed.pathname.startsWith('/repos/')) throw new Error('REMOTE_PAGINATION_LINK_INVALID');
    url = next;
  }
  throw new Error('REMOTE_PAGINATION_INCOMPLETE');
}

function latestReviews(reviews, author, headSha) {
  if (!Array.isArray(reviews)) return false;
  const latest = new Map();
  for (const review of reviews) {
    const login = review?.user?.login;
    if (typeof login !== 'string' || !login || login === author
      || typeof review.submitted_at !== 'string' || !review.submitted_at) continue;
    const old = latest.get(login);
    if (!old || review.submitted_at > old.submitted_at) latest.set(login, review);
  }
  return [...latest.values()].some((review) =>
    review.state === 'APPROVED' && review.commit_id === headSha);
}

function checkProtection(branch, protection, requiredChecks, trustedAppIds) {
  if (!isObject(branch) || branch.protected !== true) return 'BASE_BRANCH_NOT_PROTECTED';
  if (!isObject(protection)) return 'BRANCH_PROTECTION_UNREADABLE';
  if (protection.enforce_admins?.enabled !== true) return 'ADMIN_BYPASS_NOT_DISABLED';
  const approvals = protection.required_pull_request_reviews;
  if (!isObject(approvals) || !Number.isSafeInteger(approvals.required_approving_review_count)
    || approvals.required_approving_review_count < 1 || approvals.dismiss_stale_reviews !== true) {
    return 'INDEPENDENT_REVIEW_POLICY_INSUFFICIENT';
  }
  const checks = protection.required_status_checks;
  if (!isObject(checks) || checks.strict !== true || !Array.isArray(checks.checks)
    || checks.checks.length === 0) return 'REQUIRED_CHECK_POLICY_INSUFFICIENT';
  const policyChecks = new Map(checks.checks.map((item) => [item?.context, item?.app_id]));
  for (const name of requiredChecks) {
    if (!policyChecks.has(name) || !trustedAppIds.includes(policyChecks.get(name))) {
      return 'REQUIRED_CHECK_NOT_BOUND_TO_TRUSTED_APP';
    }
  }
  if (protection.allow_force_pushes?.enabled !== false) return 'FORCE_PUSH_POLICY_NOT_DISABLED';
  if (protection.allow_deletions?.enabled !== false) return 'BRANCH_DELETION_POLICY_NOT_DISABLED';
  return null;
}

function checkRunsMatch(checkRuns, headSha, requiredChecks, trustedAppIds) {
  if (!Array.isArray(checkRuns)) return 'CHECK_RUNS_INVALID';
  const byName = new Map();
  for (const run of checkRuns) {
    if (run?.head_sha !== headSha) return 'CHECK_RUN_SHA_MISMATCH';
    if (typeof run.name !== 'string' || !run.name || !Number.isSafeInteger(run.app?.id)) continue;
    if (!trustedAppIds.includes(run.app.id)) continue;
    byName.set(run.name, run);
  }
  for (const name of requiredChecks) {
    const run = byName.get(name);
    if (!run) return 'TRUSTED_CHECK_RUN_MISSING';
    if (run.status !== 'completed' || run.conclusion !== 'success') return 'TRUSTED_CHECK_RUN_NOT_SUCCESSFUL';
  }
  return null;
}

/**
 * Read-only collector for GitHub evidence. All policy inputs are supplied by
 * the trusted caller, never loaded from the PR checkout. This is not a signed
 * attestation and never authorizes merge/release by itself.
 */
export async function collectAnchoredEvidence(input) {
  const invalid = validateInput(input);
  if (invalid) return blocked(invalid);
  const { owner, repo, pullNumber, token, requiredChecks, trustedAppIds } = input;
  const fetchImpl = input.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== 'function') return blocked('FETCH_UNAVAILABLE');

  const root = '/repos/' + owner + '/' + repo;
  try {
    const pr = await getJson(root + '/pulls/' + pullNumber, token, fetchImpl);
    if (!isObject(pr) || pr.state !== 'open' || pr.merged_at) return blocked('PULL_REQUEST_NOT_OPEN');
    if (pr.draft === true) return blocked('PULL_REQUEST_IS_DRAFT');
    const headSha = pr.head?.sha;
    const baseBranch = pr.base?.ref;
    const author = pr.user?.login;
    if (typeof headSha !== 'string' || !/^[0-9a-f]{40}$/.test(headSha)
      || typeof baseBranch !== 'string' || !baseBranch
      || typeof author !== 'string' || !author) return blocked('PULL_REQUEST_METADATA_INVALID');

    const [branch, protection, checks, reviews] = await Promise.all([
      getJson(root + '/branches/' + encodeURIComponent(baseBranch), token, fetchImpl),
      getJson(root + '/branches/' + encodeURIComponent(baseBranch) + '/protection', token, fetchImpl),
      getAll(root + '/commits/' + headSha + '/check-runs', token, fetchImpl, 'check_runs'),
      getAll(root + '/pulls/' + pullNumber + '/reviews', token, fetchImpl, 'reviews')
    ]);

    const protectionIssue = checkProtection(branch, protection, requiredChecks, trustedAppIds);
    if (protectionIssue) return blocked(protectionIssue, { headSha, baseBranch });
    const checkIssue = checkRunsMatch(checks, headSha, requiredChecks, trustedAppIds);
    if (checkIssue) return blocked(checkIssue, { headSha, baseBranch });
    if (!latestReviews(reviews, author, headSha)) {
      return blocked('CURRENT_HEAD_INDEPENDENT_APPROVAL_MISSING', { headSha, baseBranch });
    }

    return {
      schemaVersion: 1,
      status: 'REMOTE_POLICY_MATCHED_NOT_RELEASE_AUTHORIZED',
      repository: owner + '/' + repo,
      pullNumber,
      headSha,
      baseBranch,
      evidence: {
        branchProtection: true,
        adminEnforcement: true,
        strictRequiredChecks: [...requiredChecks],
        trustedCheckApps: [...trustedAppIds],
        currentHeadIndependentApproval: true
      },
      releaseAuthorized: false,
      warning: 'Remote evidence was collected, but this client is not a trusted attestation service and cannot authorize merge or release.'
    };
  } catch (error) {
    const reason = typeof error?.message === 'string' && /^REMOTE_|^PAGINATION_|^FETCH_/.test(error.message)
      ? error.message : 'REMOTE_EVIDENCE_COLLECTION_FAILED';
    return blocked(reason);
  }
}
