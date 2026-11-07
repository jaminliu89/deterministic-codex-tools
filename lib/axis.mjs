// Optional, read-only Prism Mission adapter. Prism owns goals; DCT checks that
// this task remains bound to the same authorized goal/scope/acceptance contract.
import fs from 'node:fs';
import { sha, safe, readJSON } from './fs.mjs';

const isText = (v) => typeof v === 'string' && Boolean(v.trim());
const hash64 = (v) => typeof v === 'string' && /^[0-9a-f]{64}$/.test(v);

// DCT-specific canonical hash. Do not confuse it with Prism's Python contract_hash.
function ordered(value) {
  if (Array.isArray(value)) return value.map(ordered);
  if (value && typeof value === 'object')
    return Object.fromEntries(Object.keys(value).sort().map((k) => [k, ordered(value[k])]));
  return value;
}
export const specHash = (spec) => sha(JSON.stringify(ordered(spec)));

export function missionView(root) {
  try {
    const state = readJSON(root, '.prism/mission.json');
    const spec = state?.spec;
    if (state?.schema_version !== 1 || !isText(state.id) || !spec || typeof spec !== 'object'
      || !isText(spec.goal) || !isText(spec.scope) || !isText(spec.target)
      || !Array.isArray(spec.acceptance) || spec.acceptance.length === 0
      || !spec.acceptance.every(isText)) {
      return {status:'NOT_READY',issues:['MISSION_CONTRACT_INVALID']};
    }
    if (spec.implementation_authorized !== true || !isText(spec.authorization_statement)) {
      return {status:'NOT_READY',issues:['MISSION_NOT_AUTHORIZED']};
    }
    return {status:'PASS',missionRef:{id:state.id,specHash:specHash(spec)},
      acceptanceCount:spec.acceptance.length,
      acceptanceCriteria:[...spec.acceptance],
      missionState:state.status ?? 'UNKNOWN',
      semanticAlignment:'NOT_EVALUATED',
      independence:'READ_ONLY_NO_PRISM_EXECUTION'};
  } catch (error) {
    return {status:'NOT_READY',issues:['MISSION_MISSING_OR_UNREADABLE']};
  }
}

export function missionIssues(root, task, branch) {
  let exists;
  try {exists = fs.existsSync(safe(root,'.prism/mission.json'));}
  catch {return ['MISSION_UNSAFE_PATH'];}
  const expected=task?.missionRef;
  if (!exists && !expected) return []; // Independent DCT use is unchanged.
  if (!expected) return ['MISSION_REF_REQUIRED'];
  if (!isText(expected.id) || !hash64(expected.specHash)
    || Object.keys(expected).sort().join(',')!=='id,specHash') return ['MISSION_REF_INVALID'];
  const actual=missionView(root);
  if (actual.status!=='PASS') return actual.issues;
  if (actual.missionRef.id!==expected.id) return ['MISSION_ID_DRIFT'];
  if (actual.missionRef.specHash!==expected.specHash) return ['MISSION_SPEC_DRIFT'];
  // Prevent reuse of an old task/config across unrelated feature branches.
  if (!isText(task.branch) || !isText(branch) || task.branch !== branch) return ['MISSION_TASK_BRANCH_DRIFT'];
  // Require an explicit crosswalk from this WP to original, immutable acceptance clauses.
  if (!Array.isArray(task.missionAcceptance) || task.missionAcceptance.length===0)
    return ['MISSION_ACCEPTANCE_UNMAPPED'];
  if (new Set(task.missionAcceptance).size !== task.missionAcceptance.length
    || !task.missionAcceptance.every((n) => Number.isInteger(n) && n>=0 && n<actual.acceptanceCount))
    return ['MISSION_ACCEPTANCE_INVALID'];
  return [];
}
