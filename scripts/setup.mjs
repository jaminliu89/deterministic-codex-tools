#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BASE,rootOf,safe,create,readJSON,json,withLock } from '../lib/fs.mjs';
import { init,profiles } from '../lib/docs.mjs';

// Explicit destinations only. This script never edits a client's global configuration.
export function setup({project,type,skillsDir,apply=false}) {
  const root=rootOf(project);
  if(!profiles[type])throw Error('UNKNOWN_PROJECT_TYPE');
  if(root===BASE || root.startsWith(BASE+path.sep))throw Error('TOOLKIT_IS_NOT_PROJECT');
  let skillsRoot=null,skillsPrefix='';
  if(skillsDir){
    if(!path.isAbsolute(skillsDir))throw Error('SKILLS_ABSOLUTE_REQUIRED');
    const dest=path.resolve(skillsDir);let ancestor=dest;
    while(!fs.existsSync(ancestor)){const parent=path.dirname(ancestor);if(parent===ancestor)throw Error('SKILLS_PARENT_REQUIRED');ancestor=parent;}
    skillsRoot=rootOf(ancestor);skillsPrefix=path.relative(skillsRoot,dest);
    if(dest===BASE || dest.startsWith(BASE+path.sep)||dest===root||dest.startsWith(root+path.sep))throw Error('SKILLS_DESTINATION_MUST_BE_SEPARATE');
    if(skillsPrefix)safe(skillsRoot,skillsPrefix);
  }
  let projectPlan={status:'EXISTING',files:[]};
  if(fs.existsSync(safe(root,'.dct/config.json'))){
    const c=readJSON(root,'.dct/config.json');if(c.schemaVersion!==1||c.type!==type)throw Error('EXISTING_PROJECT_TYPE_MISMATCH');
  } else projectPlan=init(root,type,false);
  if(projectPlan.status==='NOT_READY')return projectPlan;
  const mcp={mcpServers:{'deterministic-codex-tools':{command:process.execPath,args:[path.join(BASE,'mcp/server.mjs'),'--project',root]}}};
  const files=[{root,rel:'.dct/mcp.config.json',text:json(mcp)},
    {root,rel:'.dct/AGENT-START.md',text:'# Agent 启动入口\n\n先读项目 AGENTS、README、PROGRESS、HANDOVER 与真实 Git 状态。\n\n工具根：'+BASE+'\n\n加载 '+path.join(BASE,'skills/deterministic-vibecoding/SKILL.md')+' 与 '+path.join(BASE,'skills/project-docs/SKILL.md')+'。\n\n运行 `node '+JSON.stringify(path.join(BASE,'bin/dct.mjs'))+' doctor --project '+JSON.stringify(root)+'`。\n\n文档、任务、真实检查与独立审查待按项目补全；安装完成不等于验收。MCP配置见同目录 mcp.config.json，先审阅再合并到客户端配置，不覆盖原文件。\n'}];
  if(skillsRoot)for(const name of ['deterministic-vibecoding','project-docs'])files.push({root:skillsRoot,rel:path.join(skillsPrefix,name,'SKILL.md'),text:fs.readFileSync(path.join(BASE,'skills',name,'SKILL.md'),'utf8')});
  const conflicts=[],pending=[],unchanged=[];
  for(const f of files){const p=safe(f.root,f.rel);if(fs.existsSync(p)){if(fs.readFileSync(p,'utf8')===f.text)unchanged.push(p);else conflicts.push(p);}else pending.push(f);}
  if(conflicts.length)return {status:'NOT_READY',reason:'EXISTING_FILES_PRESERVED',conflicts,created:[]};
  const plan={status:'PLAN',project:root,type,projectFiles:projectPlan.files??[],installFiles:pending.map(f=>path.join(f.root,f.rel)),unchanged,mcpClientConfiguration:'MERGE_REQUIRED',projectAcceptance:'NOT_READY'};
  if(!apply)return plan;
  return withLock(root,()=>{
    const created=[];
    if(projectPlan.status==='PLAN'){const r=init(root,type,true);if(r.status!=='CREATED')return r;created.push(...r.created.map(p=>path.join(root,p)));}
    try{for(const f of pending){create(f.root,f.rel,f.text);created.push(path.join(f.root,f.rel));}}
    catch(e){return {status:'NOT_READY',reason:'PARTIAL_WRITE_PRESERVED',error:e.code??e.message,created};}
    return {...plan,status:created.length?'INSTALLED':'UNCHANGED',created,next:['Read .dct/AGENT-START.md','Complete project docs/config and real tests','Merge MCP entry into client configuration if needed','Start a new Agent session and verify Skill discovery','Run doctor, then trusted checks and actual independent review']};
  });
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    const a=process.argv.slice(2),o={};
    if(a.length===1&&a[0]==='--help')process.stdout.write('node scripts/setup.mjs --project /absolute/project --type TYPE [--skills-dir /absolute/skills] [--apply]\nDefault: preview. Apply creates only missing files. Never overwrites client config or existing Skills. Node >=22.\n');
    else{
      while(a.length){const k=a.shift();if(!['--project','--type','--skills-dir','--apply'].includes(k)||Object.hasOwn(o,k))throw Error('UNKNOWN_OR_DUPLICATE_OPTION');if(k==='--apply')o[k]=true;else{const v=a.shift();if(!v||v.startsWith('--'))throw Error('OPTION_VALUE_REQUIRED');o[k]=v;}}
      const r=setup({project:o['--project']??'',type:o['--type'],skillsDir:o['--skills-dir'],apply:o['--apply']});process.stdout.write(json(r));if(r.status==='NOT_READY')process.exitCode=1;
    }
  }catch(e){process.stderr.write(json({status:'NOT_READY',error:e.code??e.message}));process.exitCode=2;}
}
