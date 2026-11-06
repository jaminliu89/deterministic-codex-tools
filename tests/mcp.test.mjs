import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fixture,base,put } from './support.mjs';
const msg=(id,method,params)=>({jsonrpc:'2.0',...(id===undefined?{}:{id}),method,...(params?{params}:{})});
const init=msg(1,'initialize',{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'dct-test',version:'1'}});
const ready=msg(undefined,'notifications/initialized');
function call(root,messages){const r=spawnSync(process.execPath,[path.join(base,'mcp/server.mjs'),'--project',root],{cwd:root,input:messages.map(x=>typeof x==='string'?x:JSON.stringify(x)).join('\n')+'\n',encoding:'utf8',timeout:10000});assert.equal(r.status,0,r.stderr);return r.stdout.trim().split('\n').filter(Boolean).map(x=>JSON.parse(x));}
test('stdio initialize/list/call actual handoff + review + sentinel',()=>{const {root}=fixture();const r=call(root,[init,ready,msg(2,'tools/list'),msg(3,'tools/call',{name:'generate_handover',arguments:{goal:'Exact JSON',traps:'No auto reset',next:'Inspect app.mjs'}}),msg(4,'tools/call',{name:'request_independent_review',arguments:{}}),msg(5,'tools/call',{name:'git_sentinel',arguments:{}})]);assert.equal(r.length,5);assert.equal(r[0].result.protocolVersion,'2025-11-25');assert.equal(r[1].result.tools.length,3);assert.equal(JSON.parse(r[2].result.content[0].text).goal,'Exact JSON');assert.equal(JSON.parse(r[3].result.content[0].text).verdict,'NOT_READY');assert.equal(JSON.parse(r[4].result.content[0].text).destructiveAction,false);});
test('MCP tools require initialized',()=>{const {root}=fixture();const r=call(root,[msg(1,'tools/list')]);assert.equal(r[0].error.code,-32002);});
test('MCP parse error recovers to valid lifecycle',()=>{const {root}=fixture();const r=call(root,['{',init,ready,msg(2,'tools/list')]);assert.equal(r[0].error.code,-32700);assert.equal(r[2].result.tools.length,3);});
test('MCP rejects arbitrary project and command arguments',()=>{const {root}=fixture();for(const arguments_ of [{project:'/tmp'},{command:'git reset --hard'},{next:4}]){const r=call(root,[init,ready,msg(2,'tools/call',{name:'generate_handover',arguments:arguments_})]);assert.equal(r[1].error.code,-32602);}});
test('MCP unconfigured project returns tool error, never approval',()=>{const {root}=fixture();put(root,'.dct/config.json','{}');const r=call(root,[init,ready,msg(2,'tools/call',{name:'request_independent_review'})]);assert.equal(r[1].result.isError,true);});
test('MCP unknown method/tool and invalid JSON-RPC fail',()=>{const {root}=fixture();const r=call(root,[init,ready,msg(2,'nope'),msg(3,'tools/call',{name:'exec'}),{jsonrpc:'1.0',id:4,method:'tools/list'}]);assert.equal(r[1].error.code,-32601);assert.equal(r[2].error.code,-32602);assert.equal(r[3].error.code,-32600);});
test('MCP advertises supported old profile when new version requested',()=>{const {root}=fixture();const r=call(root,[{...init,params:{...init.params,protocolVersion:'2026-07-28'}}]);assert.equal(r[0].result.protocolVersion,'2025-11-25');});
test('MCP initialized request with id is invalid instead of malformed response',()=>{const {root}=fixture();const r=call(root,[init,msg(2,'notifications/initialized')]);assert.equal(r[1].error.code,-32600);assert.ok(!Object.hasOwn(r[1],'result'));});
