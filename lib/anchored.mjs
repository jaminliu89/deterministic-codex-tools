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
    if (!next) {
      const totalCount = !Array.isArray(payload) ? payload?.total_count : undefined;
      if (Number.isSafeInteger(totalCount) && rows.length !== totalCount) {
        throw new Error('REMOTE_PAGINATION_INCOMPLETE');
      }
      return rows;
    }
    const parsed = new URL(next);
    if (parsed.origin !== API || !parsed.pathname.startsWith('/repos/')) throw new Error('REMOTE_PAGINATION_LINK_INVALID');
    url = next;
  }
  throw new Error('REMOTE_PAGINATION_INCOMPLETE');
}

function latestReviews(reviews, author, headSha, requiredApprovals) {
  if (!Array.isArray(reviews) || !Number.isSafeInteger(requiredApprovals) || requiredApprovals < 1) return false;
  const latest = new Map();
  for (const review of reviews) {
    const login = review?.user?.login;
    if (typeof login !== 'string' || !login || login === author) continue;
    if (!review.submitted_at) continue;
    const submittedAt = Date.parse(review.submitted_at);
    if (!Number.isFinite(submittedAt) || !Number.isSafeInteger(review.id)) return false;
    const old = latest.get(login);
    if (!old || submittedAt > old.submittedAt
      || (submittedAt === old.submittedAt && review.id > old.review.id)) {
      latest.set(login, { review, submittedAt });
    } else if (submittedAt === old.submittedAt && review.id === old.review.id
      && review.state !== old.review.state) {
      return false;
    }
  }
  const approvals = [...latest.values()].filter(({ review }) =>
    review.state === 'APPROVED' && review.commit_id === headSha).length;
  return approvals >= requiredApprovals;
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
  const requiredCheckApps = new Map();
  for (const name of requiredChecks) {
    const matches = checks.checks.filter((item) => item?.context === name);
    if (matches.length !== 1) return 'REQUIRED_CHECK_POLICY_AMBIGUOUS';
    const appId = matches[0]?.app_id;
    if (!Number.isSafeInteger(appId) || !trustedAppIds.includes(appId)) {
      return 'REQUIRED_CHECK_NOT_BOUND_TO_TRUSTED_APP';
    }
    requiredCheckApps.set(name, appId);
  }
  if (protection.allow_force_pushes?.enabled !== false) return 'FORCE_PUSH_POLICY_NOT_DISABLED';
  if (protection.allow_deletions?.enabled !== false) return 'BRANCH_DELETION_POLICY_NOT_DISABLED';
  return { requiredCheckApps, requiredApprovals: approvals.required_approving_review_count };
}

function checkRunsMatch(checkRuns, headSha, requiredCheckApps) {
  if (!Array.isArray(checkRuns)) return 'CHECK_RUNS_INVALID';
  const latestByName = new Map();
  for (const run of checkRuns) {
    if (run?.head_sha !== headSha) return 'CHECK_RUN_SHA_MISMATCH';
    if (typeof run.name !== 'string' || !run.name) continue;
    const expectedAppId = requiredCheckApps.get(run.name);
    if (expectedAppId === undefined || run.app?.id !== expectedAppId) continue;
    const createdAt = Date.parse(run.created_at ?? '');
    if (!Number.isSafeInteger(run.id) || !Number.isFinite(createdAt)) {
      return 'CHECK_RUN_FRESHNESS_UNVERIFIABLE';
    }
    const previous = latestByName.get(run.name);
    if (!previous) {
      latestByName.set(run.name, { run, createdAt });
      continue;
    }
    if (createdAt === previous.createdAt && run.id === previous.run.id) {
      if (run.status !== previous.run.status || run.conclusion !== previous.run.conclusion) {
        return 'CHECK_RUN_FRESHNESS_AMBIGUOUS';
      }
      continue;
    }
    if (createdAt > previous.createdAt
      || (createdAt === previous.createdAt && run.id > previous.run.id)) {
      latestByName.set(run.name, { run, createdAt });
    }
  }
  for (const name of requiredCheckApps.keys()) {
    const latest = latestByName.get(name)?.run;
    if (!latest) return 'TRUSTED_CHECK_RUN_MISSING';
    if (latest.status !== 'completed' || latest.conclusion !== 'success') {
      return 'TRUSTED_CHECK_RUN_NOT_SUCCESSFUL';
    }
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

    const protectionResult = checkProtection(branch, protection, requiredChecks, trustedAppIds);
    if (typeof protectionResult === 'string') return blocked(protectionResult, { headSha, baseBranch });
    const checkIssue = checkRunsMatch(checks, headSha, protectionResult.requiredCheckApps);
    if (checkIssue) return blocked(checkIssue, { headSha, baseBranch });
    if (!latestReviews(reviews, author, headSha, protectionResult.requiredApprovals)) {
      return blocked('CURRENT_HEAD_INDEPENDENT_APPROVALS_MISSING', { headSha, baseBranch });
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
