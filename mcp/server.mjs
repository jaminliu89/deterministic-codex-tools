#!/usr/bin/env node
// Explicit compatibility profile: MCP 2025-11-25 stdio, not newer stateless MCP.
import { rootOf,json,redact,withLock } from '../lib/fs.mjs';
import { handoff,sentinel,reviewRequest } from '../lib/core.mjs';
const args=process.argv.slice(2);
if(args.length!==2 || args[0]!=='--project'){process.stderr.write('Usage: dct-mcp --project /absolute/project\n');process.exit(2);}
let root;try{root=rootOf(args[1]);}catch{process.stderr.write('Invalid project root\n');process.exit(2);}
const tools=[
  {name:'generate_handover',description:'Record actual source/Git/check state and caller notes; no source edits.',inputSchema:{type:'object',properties:{goal:{type:'string'},traps:{type:'string'},next:{type:'string'}},additionalProperties:false},annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:false,openWorldHint:false}},
  {name:'git_sentinel',description:'Record state, report failures. Never reset, commit, push, delete or run project commands.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:false,openWorldHint:false}},
  {name:'request_independent_review',description:'Prepare a source-bound request for a separately configured reviewer. Does not call a model or grant approval.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false}}
];
let initialized=false,ready=false,buffer='';
function error(code,message){const e=Error(message);e.rpcCode=code;throw e;}
function handle(m) {
  if(!m||Array.isArray(m)||m.jsonrpc!=='2.0'||typeof m.method!=='string'||(Object.hasOwn(m,'id') && !['string','number'].includes(typeof m.id)))error(-32600,'Invalid Request');
  if(m.method==='notifications/initialized'){if(Object.hasOwn(m,'id'))error(-32600,'Initialized must be a notification');if(initialized)ready=true;return;}
  if(!Object.hasOwn(m,'id'))return;
  if(m.method==='initialize'){
    if(initialized)error(-32600,'Already initialized');
    if(!m.params || typeof m.params.protocolVersion!=='string'||!m.params.capabilities || !m.params.clientInfo?.name || !m.params.clientInfo?.version)error(-32602,'Invalid initialize params');
    initialized=true;return {protocolVersion:'2025-11-25',capabilities:{tools:{listChanged:false}},serverInfo:{name:'deterministic-codex-tools',version:'1.0.0'},instructions:'Project root is fixed at launch. Local operations are not OS security controls. No model calls or destructive rollback. Compatibility: MCP 2025-11-25 only.'};
  }
  if(m.method==='ping')return {};
  if(!ready)error(-32002,'Initialization required');
  if(m.method==='tools/list')return {tools};
  if(m.method!=='tools/call')error(-32601,'Method not found');
  const p=m.params;if(!p||!tools.some(t=>t.name===p.name))error(-32602,'Unknown tool');
  const a=p.arguments??{};
  const keys=p.name==='generate_handover'?['goal','traps','next']:[];
  if(typeof a!=='object'||!a||Array.isArray(a)||Object.keys(a).some(k=>!keys.includes(k)||typeof a[k]!=='string'||a[k].length>10000))error(-32602,'Invalid tool arguments');
  try{
    const value=p.name==='request_independent_review'?reviewRequest(root):withLock(root,()=>p.name==='git_sentinel'?sentinel(root):handoff(root,a));
    return {content:[{type:'text',text:json(value)}],isError:false};
  }catch(e){return {content:[{type:'text',text:json({status:'NOT_READY',error:redact(e.code??e.message)})}],isError:true};}
}
function line(text){let m;try{m=JSON.parse(text);}catch{send({jsonrpc:'2.0',id:null,error:{code:-32700,message:'Parse error'}});return;}
  try{const result=handle(m);if(Object.hasOwn(m,'id'))send({jsonrpc:'2.0',id:m.id,result});}
  catch(e){if(Object.hasOwn(m??{},'id')||e.rpcCode===-32600)send({jsonrpc:'2.0',id:m?.id??null,error:{code:e.rpcCode??-32603,message:redact(e.message)}});}}
function send(m){process.stdout.write(JSON.stringify(m)+'\n');}
process.stdin.setEncoding('utf8');process.stdin.on('data',s=>{
  buffer+=s;
  if(Buffer.byteLength(buffer)>1024*1024){process.stderr.write('MCP frame limit exceeded\n');process.exit(2);}
  let n;while((n=buffer.indexOf('\n'))>=0){const t=buffer.slice(0,n);buffer=buffer.slice(n+1);if(t.trim())line(t);}
});
process.stdin.on('end',()=>{if(buffer.trim())line(buffer);});
