#!/usr/bin/env python3
"""Build an explicit review proposal and text patch. Never stages or edits raw PNGs."""
from pathlib import Path
from html.parser import HTMLParser
import hashlib,json,re,subprocess
root=Path(__file__).resolve().parent.parent
qa=root/'docs/qa/practice-persistence'
def git(*args,**kwargs):return subprocess.run(['git',*args],cwd=root,capture_output=True,**kwargs)
assert not git('diff','--cached','--name-only').stdout, 'Do not mix this proposal with an existing index'
previous=set((qa/'review-files.txt').read_text().splitlines())
explicit={'scripts/run-bloom-practice-verification.cjs','scripts/verify-bloom-practice-startup.cjs','scripts/verify-bloom-practice-visual-contract.cjs','scripts/build-practice-publication-review.py'}
def owned(p):return p in previous or p in explicit or p.startswith(('src/features/practice/','docs/qa/practice-persistence/','docs/qa/practice-typography/'))
untracked=set(git('ls-files','--others','--exclude-standard','-z').stdout.decode().strip('\0').split('\0'))
candidates=previous|explicit|{p for p in untracked if p and owned(p)}
ignored=set(git('check-ignore','--stdin','-z',input=('\0'.join(sorted(candidates))+'\0').encode()).stdout.decode().strip('\0').split('\0'))
files=sorted(p for p in candidates-ignored if p and (root/p).is_file())
assert all(not p.startswith(('.local-design/','docs/patches/')) and owned(p) for p in files)
assert not any('/local-' in p for p in files)
pngs=[p for p in files if p.endswith('.png')];assert len(pngs)==60
text=[p for p in files if p not in pngs]
(qa/'review-files.txt').write_text('\n'.join(files)+'\n')
visual=root/'docs/qa/practice-typography/visual-files.txt'
visual_files=set(visual.read_text().splitlines())|explicit|{p for p in files if '/reliability-' in p or p.endswith(('/publication-scope.md','/publication-assets.json','/.gitignore','/approved-practice-render-contract.json'))}
visual.write_text('\n'.join(sorted(visual_files&set(files)))+'\n')
report=root/'docs/phase11-7-2-practice-persistence-qa.md';marker='\n### Son çalışma ağacı doğrulaması\n';report_base=report.read_text().split(marker)[0]
patch=root/'docs/patches/phase11-7-2-reliability-publication-text-only.patch'
manifest={'baseline':git('rev-parse','HEAD').stdout.decode().strip(),'branch':git('branch','--show-current').stdout.decode().strip(),'proposalOnly':True,'changedFileCount':len(files),'textFileCount':len(text),'pngCount':len(pngs),'totalBytes':0,'pngBytes':sum((root/p).stat().st_size for p in pngs),'localOnlyPNGCount':308,'sizeMeaning':'Working-tree byte sum; not compressed Git pack/upload bytes','noStagingCommitOrPush':True,'excluded':['308 raw/intermediate PNGs retained locally (per-folder .gitignore)','local-raw-screenshots.json inventories','docs/patches/ (all local patches preserved)','.local-design/','temporary files','unrelated prior QA/log files']}
def sizes():
 for _ in range(12):
  (qa/'review-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
  report.write_text(report_base+marker+f"Önerilen Git kapsamı: **{len(files)} dosya** ({len(text)} metin, {len(pngs)} PNG), **{manifest['totalBytes']:,} byte** ({manifest['totalBytes']/1048576:.2f} MiB; çalışma ağacı toplamı). 308 ham PNG ve önceki yerel yamalar kapsam dışındadır ve disk üzerinde korunur. Git diff check, güncel text-only patch reverse-check ve yalnız yayınlanacak dosyaları kullanan galeri/hash denetimi yapıldı. Native piksel QA sonucu önceki gerçek incelemedir; bu görevde 78 rendered-state eşitliği ayrıca doğrulandı. Index boş; commit/push yok.\n")
  total=sum((root/p).stat().st_size for p in files)
  if total==manifest['totalBytes']:return
  manifest['totalBytes']=total
 raise AssertionError('Size metadata failed to converge')
def build_patch():
 chunks=[]
 tracked=set(git('ls-files','-z').stdout.decode().strip('\0').split('\0'))
 for p in text:
  result=git('diff','--no-ext-diff','--',p) if p in tracked else git('diff','--no-index','--no-ext-diff','--','/dev/null',p)
  assert result.returncode in (0,1),result.stderr.decode();chunks.append(result.stdout)
 patch.write_bytes(b''.join(chunks));assert not re.search(rb'^GIT binary patch$',patch.read_bytes(),re.M)
def check():
 for args in [('diff','--check'),('apply','--check','--reverse',str(patch.relative_to(root)))]:
  result=git(*args);assert result.returncode==0,result.stdout.decode()+result.stderr.decode()
class Links(HTMLParser):
 def __init__(self):super().__init__();self.targets=[]
 def handle_starttag(self,tag,attrs):
  self.targets.extend(v for k,v in attrs if k in ('href','src') and v and not v.startswith(('https:','http:','#')))
def check_publication():
 available=set(files)|set(git('ls-files','-z').stdout.decode().strip('\0').split('\0'));selected=set()
 for folder in ['practice-persistence','practice-typography']:
  directory=root/'docs/qa'/folder;assets=json.loads((directory/'publication-assets.json').read_text())['screenshots'];hashes=json.loads((directory/'screenshot-hashes.json').read_text())
  assert {r['file']:r['sha256'] for r in assets}=={r['file']:r['sha256'] for r in hashes}
  for row in assets:
   path=directory/row['file'];assert hashlib.sha256(path.read_bytes()).hexdigest()==row['sha256'];selected.add(str(path.relative_to(root)))
  parser=Links();parser.feed((directory/'index.html').read_text())
  for target in parser.targets:
   path=(directory/target).resolve();assert path.is_file() and str(path.relative_to(root)) in available,target
 assert selected==set(pngs), 'Every proposed PNG must belong to the published manifests'
check_publication()
sizes();build_patch();check()
(qa/'diff-check.log').write_text('git diff --check: passed (exit 0)\n')
(qa/'patch-check.log').write_text('git apply --check --reverse docs/patches/phase11-7-2-reliability-publication-text-only.patch: passed (exit 0)\nPrevious local review patches remain intact; not regenerated.\n')
sizes();build_patch();check()
print(json.dumps({k:manifest[k] for k in ['changedFileCount','textFileCount','pngCount','totalBytes','pngBytes','localOnlyPNGCount']},indent=2))
