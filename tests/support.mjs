import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { init } from '../lib/docs.mjs';
import { json,create } from '../lib/fs.mjs';
export const base=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
fs.mkdirSync(path.join(base,'work'),{recursive:true});
// Isolate test fixtures from user Git hooks and identity without changing host config.
const emptyGitConfig=path.join(base,'work','test-empty-gitconfig');
fs.writeFileSync(emptyGitConfig,'');
process.env.GIT_CONFIG_GLOBAL=emptyGitConfig;
process.env.GIT_CONFIG_NOSYSTEM='1';
export function temp(){return fs.mkdtempSync(path.join(base,'work','fixture-'));}
export function put(root,p,text){fs.mkdirSync(path.dirname(path.join(root,p)),{recursive:true});fs.writeFileSync(path.join(root,p),text);}
export function g(root,args){const r=spawnSync('git',args,{cwd:root,encoding:'utf8',env:{...process.env,GIT_CONFIG_NOSYSTEM:'1',GIT_AUTHOR_NAME:'DCT Test',GIT_AUTHOR_EMAIL:'fixture@invalid.test',GIT_COMMITTER_NAME:'DCT Test',GIT_COMMITTER_EMAIL:'fixture@invalid.test'}});if(r.status!==0)throw Error(r.stderr);return r.stdout;}
export function cli(root,args){return spawnSync(process.execPath,[path.join(base,'bin/dct.mjs'),...args,'--project',root],{cwd:root,encoding:'utf8',timeout:30000});}
export function fixture(type='cli',kind='json-io'){
  const root=temp();init(root,type,true);
  const c=JSON.parse(fs.readFileSync(path.join(root,'.dct/config.json')));
  c.task={id:'TEST-01',outcome:'Fixture: preserve exact JSON input through a real subprocess',coder:'fixture-coder',allowedPaths:['app.mjs','tests','.dct','docs','HANDOVER.md','AGENTS.md','.gitignore'],protectedPaths:['stable.txt']};
  c.requiredCheckIds=['behavior'];c.checks=[{id:'behavior',kind,argv:kind==='json-io'?[process.execPath,'app.mjs']:[process.execPath,'--test','--test-reporter=tap','tests/app.test.mjs'],timeoutMs:5000,minTests:1,requiredTests:['preserves arithmetic behavior'],input:{x:3},expected:{x:3}}];
  c.artifacts=Object.fromEntries(c.capabilities.map(cap=>[cap,'artifacts/'+cap+'.txt']));
  put(root,'.dct/config.json',json(c));
  const contract=JSON.parse(fs.readFileSync(path.join(root,'.dct/doc-contract.json')));
  for(const [p,sections] of Object.entries(contract.sections))put(root,p,'# Test fixture, not product acceptance\n\n'+sections.map(h=>'## '+h+'\n\nFixture contract: send {x:3} to app.mjs; expect exactly {x:3}. Test-only documentation completion; no business acceptance claim.\n').join('\n'));
  put(root,'app.mjs',"let s='';for await(const x of process.stdin)s+=x;process.stdout.write(JSON.stringify(JSON.parse(s)));\n");
  put(root,'tests/app.test.mjs',"import test from 'node:test';import assert from 'node:assert/strict';test('preserves arithmetic behavior',()=>assert.equal(2+3,5));\n");
  for(const cap of c.capabilities)put(root,c.artifacts[cap],'Fixture only, not deployed\n');
  put(root,'.gitignore','.dct/runs/\n.dct/reviews/\n.dct/handoffs/\n.dct/operation.lock\n');
  g(root,['init','-b','feature/test']);g(root,['add','--','.']);g(root,['commit','-m','test-only fixture baseline']);
  c.task.baseHead=g(root,['rev-parse','HEAD']).trim();put(root,'.dct/config.json',json(c));
  return {root,c};
}
