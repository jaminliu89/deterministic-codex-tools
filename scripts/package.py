#!/usr/bin/env python3
"""Build source distribution; excludes secrets, work fixtures and .git."""
from pathlib import Path
import hashlib, json, os, stat, sys, zipfile
root=Path(__file__).resolve().parents[1]
out=Path(sys.argv[1]).resolve()
out.mkdir(parents=True,exist_ok=True)
allowed_dirs={'.github','bin','lib','templates','skills','mcp','tests','docs','examples','scripts','evidence'}
allowed_files={'package.json','.gitignore','AGENTS.md','PROGRESS.md','README.md','LICENSE'}
files=sorted(p for p in root.rglob('*') if p.is_file() and ((p.relative_to(root).parts[0] in allowed_dirs) or p.relative_to(root).as_posix() in allowed_files) and '__pycache__' not in p.parts)
for p in files:
 if p.is_symlink() or p.name=='.env': raise RuntimeError('unsafe package member')
manifest={'schemaVersion':1,'files':[{'path':p.relative_to(root).as_posix(),'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'bytes':p.stat().st_size} for p in files]}
manifest_bytes=(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n').encode()
z=out/'deterministic-codex-tools-1.0.0.zip'
with zipfile.ZipFile(z,'w',compression=zipfile.ZIP_DEFLATED) as archive:
 for p in files:archive.write(p,'deterministic-codex-tools/'+p.relative_to(root).as_posix())
 archive.writestr('deterministic-codex-tools/MANIFEST.json',manifest_bytes)
result={'zip':str(z),'sha256':hashlib.sha256(z.read_bytes()).hexdigest(),'bytes':z.stat().st_size,'members':len(files)+1}
(out/'SHA256SUMS.txt').write_text(result['sha256']+'  '+z.name+'\n')
(out/'PACKAGE.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result,indent=2))
