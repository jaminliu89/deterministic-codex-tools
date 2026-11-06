import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
export const BASE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const sha = s => crypto.createHash('sha256').update(s).digest('hex');
export const json = s => JSON.stringify(s, null, 2) + '\n';
export function rootOf(p) {
  if (!path.isAbsolute(p)) throw Error('PROJECT_ABSOLUTE_REQUIRED');
  const r = fs.realpathSync(p);
  if (path.resolve(p) !== r || !fs.statSync(r).isDirectory()) throw Error('PROJECT_REAL_DIRECTORY_REQUIRED');
  return r;
}
export function safe(root, rel) {
  if (typeof rel !== 'string' || !rel || path.isAbsolute(rel) || rel.split(/[\\/]/).some(x=>x==='..' || x==='.git') || rel.includes('\0')) throw Error('UNSAFE_PATH');
  const dest = path.resolve(root, rel);
  if (!dest.startsWith(root + path.sep)) throw Error('UNSAFE_PATH');
  let p = root;
  for (const part of path.relative(root,dest).split(path.sep)) {
    p = path.join(p,part);
    if (fs.existsSync(p) || fs.lstatSync(p, {throwIfNoEntry:false})) {
      const st = fs.lstatSync(p);
      if (st.isSymbolicLink()) throw Error('SYMLINK_REFUSED');
      if (st.isFile() && st.nlink > 1) throw Error('HARDLINK_REFUSED');
    }
  }
  return dest;
}
export function read(root, rel) { return fs.readFileSync(safe(root,rel),'utf8'); }
export function readJSON(root,rel) { return JSON.parse(read(root,rel)); }
export function create(root,rel,data,mode=0o600) {
  const p=safe(root,rel); fs.mkdirSync(path.dirname(p),{recursive:true});
  fs.writeFileSync(p,data,{flag:'wx',mode});
}
// Preflight all paths before writing; never overwrite existing project assets.
export function createPlan(root, files, apply) {
  const conflicts = Object.keys(files).filter(p=>fs.existsSync(safe(root,p)));
  if (conflicts.length) return {status:'NOT_READY', conflicts, created:[]};
  if (!apply) return {status:'PLAN',files:Object.keys(files),created:[]};
  const created=[];
  try { for (const [p,s] of Object.entries(files)) { create(root,p,s); created.push(p); } }
  catch { return {status:'NOT_READY',reason:'PARTIAL_WRITE_PRESERVED',created}; }
  return {status:'CREATED',created};
}
export function withLock(root, fn) {
  const rel='.dct/operation.lock'; const p=safe(root,rel);
  fs.mkdirSync(path.dirname(p),{recursive:true});
  const fd=fs.openSync(p,'wx',0o600); const st=fs.fstatSync(fd);
  fs.writeFileSync(fd,json({pid:process.pid,at:new Date().toISOString()}));
  try { return fn(); } finally {
    fs.closeSync(fd); const now=fs.lstatSync(p,{throwIfNoEntry:false});
    if (now && now.ino===st.ino && now.dev===st.dev) fs.unlinkSync(p);
  }
}
export function inventory(root) {
  const rows=[]; let bytes=0;
  function walk(dir) {
    for (const e of fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))) {
      const p=path.join(dir,e.name), rel=path.relative(root,p).split(path.sep).join('/');
      if (['.git','node_modules','.venv','__pycache__'].includes(e.name)) continue;
      if (rel==='.dct/operation.lock') continue;
      if (e.isSymbolicLink()) throw Error('SYMLINK_IN_PROJECT');
      if (e.isDirectory()) walk(p);
      else if(e.isFile()) {
        const st=fs.statSync(p); bytes+=st.size;
        if(st.nlink>1) throw Error('HARDLINK_IN_PROJECT');
        if(st.size>8*1024*1024 || bytes>64*1024*1024 || rows.length>=10000) throw Error('SCAN_LIMIT_NOT_READY');
        const data=fs.readFileSync(p);
        // Exclude only recognized receipt JSON, not arbitrary runtime files placed here.
        if (/^\.dct\/(runs|reviews|handoffs)\/[^/]+\.json$/.test(rel)) {
          try {const r=JSON.parse(data); if(r.schemaVersion===1 && r.binding && typeof r.binding.source==='string' && typeof r.binding.engine==='string' && (Array.isArray(r.results)||Object.hasOwn(r,'verdict')||Object.hasOwn(r,'doctor')||Object.hasOwn(r,'gate'))) continue;} catch {}
        }
        rows.push({path:rel,hash:sha(data),mode:st.mode & 0o777});
      } else throw Error('SPECIAL_FILE_REFUSED');
    }
  }
  walk(root); return rows;
}
export function engineHash() {
  const files=['lib/fs.mjs','lib/docs.mjs','lib/core.mjs','bin/dct.mjs','mcp/server.mjs','templates/profiles.json'];
  return sha(files.map(p=>p+'\0'+fs.readFileSync(path.join(BASE,p))).join('\0'));
}
export function redact(s) {
  return String(s).replace(/-----BEGIN [\s\S]*?PRIVATE KEY-----[\s\S]*?-----END [\s\S]*?PRIVATE KEY-----/g,'[REDACTED_KEY]')
    .replace(/\b(?:sk-|ghp_|github_pat_)[A-Za-z0-9_-]{12,}/g,'[REDACTED_TOKEN]')
    .replace(/((?:password|secret|token|api[_-]?key)\s*[=:]\s*["']?)[^\s"',;]+/gi,'$1[REDACTED]')
    .replace(/([a-z][a-z0-9+.-]*:\/\/)[^\s/@:]+:[^\s/@]+@/gi,'$1[REDACTED]@');
}
