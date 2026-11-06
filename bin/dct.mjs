#!/usr/bin/env node
import { rootOf,json,readJSON,redact,withLock } from '../lib/fs.mjs';
import { init,docsPlan,profiles } from '../lib/docs.mjs';
import { doctor,gate,sentinel,handoff,resume,reviewRequest,importReview,installHooks,ciPlan,binding,runChecks } from '../lib/core.mjs';
const help=`dct 1.0.0 — Node >=22; local only, no automatic reset/commit/push/deploy
Usage: node /absolute/toolkit/bin/dct.mjs COMMAND --project /absolute/project [options]
init --type TYPE [--apply]       Generate project docs and config without overwrites
 docs --type TYPE [--apply]      Generate documentation only
 check --run                    Run configured checks without independent-review claim
 doctor                        Read-only structure/security/scope diagnostics
 gate [--run] [--precommit] [--release]  Explicit --run executes trusted configured argv
 review-request                 Print exact source-bound external review request
 review-import --file REL       Import separate-context attestation; not identity proof
 sentinel                       Record Git/failure state, never destructive rollback
 handoff [--notes REL]           Save actual state plus goal/traps/next JSON notes
 resume --file REL              Compare handoff binding with current source
 hooks [--apply]                Plan/install non-overwriting local pre-commit hook
 ci [--apply]                   Plan/install optional GitHub workflow
 binding                        Print source/engine/HEAD/branch binding
 types                          List project types
--apply writes new files; default init/docs/hooks/ci is preview.
`;
const specs={init:['type','apply'],docs:['type','apply'],doctor:[],check:['run'],gate:['run','release','precommit'],'review-request':[],'review-import':['file'],sentinel:[],handoff:['notes'],resume:['file'],hooks:['apply'],ci:['apply'],binding:[],types:[]};
try {
  const args=process.argv.slice(2),cmd=args.shift();
  if(!cmd||cmd==='--help'||cmd==='help'){process.stdout.write(help);}
  else {
    if(!Object.hasOwn(specs,cmd))throw Error('UNKNOWN_COMMAND');
    const opts={};const booleans=['apply','run','release','precommit'];
    while(args.length){const k=args.shift();if(!k.startsWith('--')||!['project',...specs[cmd]].includes(k.slice(2))||Object.hasOwn(opts,k.slice(2)))throw Error('UNKNOWN_OR_DUPLICATE_OPTION');
      const n=k.slice(2);if(booleans.includes(n))opts[n]=true;else {const v=args.shift();if(!v||v.startsWith('--'))throw Error('OPTION_VALUE_REQUIRED');opts[n]=v;}}
    let r;
    if(cmd==='types')r=profiles;
    else {
      const root=rootOf(opts.project??'');
      const handlers={init:()=>opts.apply?withLock(root,()=>init(root,opts.type,true)):init(root,opts.type,false),docs:()=>opts.apply?withLock(root,()=>docsPlan(root,opts.type,true)):docsPlan(root,opts.type,false),doctor:()=>doctor(root),check:()=>{if(!opts.run)throw Error('EXPLICIT_RUN_REQUIRED');return runChecks(root);},gate:()=>gate(root,opts),'review-request':()=>reviewRequest(root),'review-import':()=>importReview(root,opts.file),sentinel:()=>withLock(root,()=>sentinel(root)),handoff:()=>withLock(root,()=>handoff(root,opts.notes?readJSON(root,opts.notes):{})),resume:()=>resume(root,opts.file),hooks:()=>opts.apply?withLock(root,()=>installHooks(root,true)):installHooks(root,false),ci:()=>opts.apply?withLock(root,()=>ciPlan(root,true)):ciPlan(root,false),binding:()=>binding(root)};
      r=handlers[cmd]();
    }
    process.stdout.write(json(r));if(['NOT_READY','FAIL'].includes(r.status))process.exitCode=1;
  }
}catch(e){process.stderr.write(json({status:'NOT_READY',error:redact(e.code??e.message)}));process.exitCode=2;}
