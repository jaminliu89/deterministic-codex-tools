#!/usr/bin/env node
import { collectAnchoredEvidence } from '../lib/anchored.mjs';

function parseArgs(argv) {
  const out = {};
  while (argv.length) {
    const key = argv.shift();
    if (!['--repo', '--pr'].includes(key) || Object.hasOwn(out, key)) throw new Error('INVALID_ARGUMENT');
    const value = argv.shift();
    if (!value || value.startsWith('--')) throw new Error('ARGUMENT_VALUE_REQUIRED');
    out[key] = value;
  }
  if (!out['--repo'] || !out['--pr'] || !/^\d+$/.test(out['--pr'])) throw new Error('REPO_AND_PR_REQUIRED');
  const [owner, repo] = out['--repo'].split('/');
  if (!owner || !repo || out['--repo'].split('/').length !== 2) throw new Error('REPOSITORY_INVALID');
  return { owner, repo, pullNumber: Number(out['--pr']) };
}

try {
  const args = parseArgs(process.argv.slice(2));
  let requiredChecks, trustedAppIds;
  try {
    requiredChecks = JSON.parse(process.env.DCT_REQUIRED_CHECKS ?? '');
    trustedAppIds = (process.env.DCT_TRUSTED_APP_IDS ?? '').split(',').filter(Boolean).map(Number);
  } catch {
    throw new Error('EXTERNAL_POLICY_INVALID');
  }
  const result = await collectAnchoredEvidence({
    ...args,
    token: process.env.DCT_GITHUB_TOKEN,
    requiredChecks,
    trustedAppIds
  });
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  if (result.status === 'BLOCKED') process.exitCode = 1;
} catch (error) {
  process.stderr.write(JSON.stringify({ status: 'BLOCKED', reason: error.message, releaseAuthorized: false }) + '\n');
  process.exitCode = 2;
}
