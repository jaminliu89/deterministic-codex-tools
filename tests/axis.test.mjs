import test from 'node:test';
import assert from 'node:assert/strict';
import { missionView, missionIssues, specHash } from '../lib/axis.mjs';
import { doctor, runChecks, reviewRequest } from '../lib/core.mjs';
import { fixture, put } from './support.mjs';
import { json } from '../lib/fs.mjs';

function authorized(root) {
  return {schema_version:1,id:'MSN-test-01',status:'DISCOVERING',
    spec:{profile:'dev',goal:'点击下载按钮得到可播放文件',target:root,
      scope:'只修改本项目，不破坏历史平台',
      acceptance:['浏览器真实下载可播文件','B站、抖音、YouTube 回归'],
      implementation_authorized:true,authorization_statement:'Approved fixture scope'},
    runs:[],reviews:[]};
}

test('Prism Mission present requires explicit DCT task reference', () => {
  const {root}=fixture();
  put(root,'.prism/mission.json',json(authorized(root)));
  assert.equal(missionView(root).status,'PASS');
  assert.ok(doctor(root).issues.includes('MISSION_REF_REQUIRED'));
});

test('exact Prism mission binding allows configured checks; scope drift blocks', () => {
  const {root,c}=fixture();
  const mission=authorized(root);
  put(root,'.prism/mission.json',json(mission));
  c.task.allowedPaths.push('.prism');
  c.task.missionRef=missionView(root).missionRef;
  put(root,'.dct/config.json',json(c));
  assert.equal(doctor(root).status,'PASS');
  assert.equal(runChecks(root).status,'PASS');
  assert.equal(reviewRequest(root).mission.missionRef.specHash,c.task.missionRef.specHash);
  mission.spec.scope='Remove historical compatibility and rewrite everything';
  put(root,'.prism/mission.json',json(mission));
  assert.ok(doctor(root).issues.includes('MISSION_SPEC_DRIFT'));
  assert.equal(runChecks(root).status,'NOT_READY');
});

test('mission identity change is independent blocker, even if spec is equal', () => {
  const {root,c}=fixture();
  const mission=authorized(root);
  put(root,'.prism/mission.json',json(mission));
  c.task.allowedPaths.push('.prism');
  c.task.missionRef=missionView(root).missionRef;
  put(root,'.dct/config.json',json(c));
  mission.id='MSN-other';
  put(root,'.prism/mission.json',json(mission));
  assert.ok(doctor(root).issues.includes('MISSION_ID_DRIFT'));
});

test('unsigned or incomplete mission refuses a valid-looking reference', () => {
  const {root,c}=fixture();
  const mission=authorized(root);
  put(root,'.prism/mission.json',json(mission));
  c.task.allowedPaths.push('.prism');
  c.task.missionRef=missionView(root).missionRef;
  put(root,'.dct/config.json',json(c));
  mission.spec.acceptance=[];
  put(root,'.prism/mission.json',json(mission));
  assert.ok(doctor(root).issues.includes('MISSION_CONTRACT_INVALID'));
  mission.spec.acceptance=['download works'];
  mission.spec.implementation_authorized=false;
  put(root,'.prism/mission.json',json(mission));
  assert.ok(doctor(root).issues.includes('MISSION_NOT_AUTHORIZED'));
});

test('independent DCT project without Prism still works; stale orphan reference blocks', () => {
  const {root,c}=fixture();
  assert.deepEqual(missionIssues(root,c.task),[]);
  c.task.missionRef={id:'MSN-test-01',specHash:'a'.repeat(64)};
  put(root,'.dct/config.json',json(c));
  assert.ok(doctor(root).issues.includes('MISSION_MISSING_OR_UNREADABLE'));
});

test('canonical Mission spec hash independent of key order, sensitive to acceptance', () => {
  const a={goal:'test',scope:{z:1,a:2},acceptance:['a']};
  const b={acceptance:['a'],scope:{a:2,z:1},goal:'test'};
  assert.equal(specHash(a),specHash(b));
  b.acceptance.push('b');
  assert.notEqual(specHash(a),specHash(b));
});
