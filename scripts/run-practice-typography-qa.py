#!/usr/bin/env python3
"""Practice typography matrix, explicit NEW devices/namespaces and separate Metro.
No uninstall, clearState, deletion, fixture re-seeding or canonical storage writes.
Captures/logs stay outside the workspace while Metro is active. Inspect pixels
before publishing any visual pass; this runner makes no visual correctness claim.
"""
import argparse, json, os, re, signal, subprocess, time
from http.server import BaseHTTPRequestHandler, HTTPServer
from threading import Thread
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
APP='com.umutcyilmaz.bloom.e2e'
p=argparse.ArgumentParser();p.add_argument('--device',required=True);p.add_argument('--run',required=True);p.add_argument('--output',required=True);p.add_argument('--size',choices=['default','moderate','maximum'],required=True);p.add_argument('--fixture',choices=['fresh-v8','reset-active','corrupt-v9'],default='fresh-v8');args=p.parse_args()
assert re.fullmatch(r'[a-zA-Z0-9_-]{8,80}',args.run)
out=Path(args.output);out.mkdir(parents=True,exist_ok=True)
assert not out.resolve().is_relative_to(ROOT),'Native output must be outside watched project'
PORT=8083
prefix=f'bloom.e2e.practice.{args.run}.{args.fixture}.'
def sim(*argv,check=True):return subprocess.run(['xcrun','simctl',*argv],capture_output=True,text=True,check=check)
def snapshot(destination):
 container=Path(sim('get_app_container',args.device,APP,'data').stdout.strip());folder=container/'Library/Application Support'/APP/'RCTAsyncLocalStorage_V1';manifest=json.loads((folder/'manifest.json').read_text()) if (folder/'manifest.json').exists() else {}
 # Only this NEW fixture's synthetic values may enter QA logs.
 import hashlib
 values={k:v if v is not None else (folder/hashlib.md5(k.encode()).hexdigest()).read_text() for k,v in manifest.items() if k.startswith(prefix)}
 destination.write_text(json.dumps(values,indent=2)+'\n');return values
devices=json.loads(sim('list','devices','available','-j').stdout)['devices']
device=next((d for group in devices.values() for d in group if d['udid']==args.device),None)
assert device and device['name'].startswith('Bloom Practice Typography QA '),'Only newly named typography QA devices are allowed'
if device['state']!='Booted':sim('boot',args.device);sim('bootstatus',args.device,'-b')
assert not snapshot(out/'before.json'),'Refuse to re-use a namespace; choose a fresh run ID'
lines=[f'appId: {APP}','name: Practice typography '+args.size+' '+args.fixture,'---','- tapOn: {text: "Open", optional: true}','- tapOn: {text: "Continue", optional: true}','- tapOn: {id: "xmark", optional: true}']
def visible(id,direction='DOWN',percentage=100):lines.extend(['- scrollUntilVisible:',f'    element: {{id: "{id}"}}',f'    direction: {direction}',f'    visibilityPercentage: {percentage}',f'    centerElement: {"false" if args.size == "maximum" else "true"}','    timeout: 90000','    speed: 65'])
capture_names=set()
def cap(name):
 assert name not in capture_names, 'Capture names must never overwrite earlier frames'
 capture_names.add(name)
 lines.extend(['- waitForAnimationToEnd: {timeout: 1200}',f'- evalScript: ${{output.captureName = "{name}"}}','- runScript: capture-native.js'])
def tap(id):
 visible(id);lines.append(f'- tapOn: {{id: "{id}"}}')
 expected={'practice.start.confirm':'practice.running','practice.level.7':'practice.running','practice.pause':'practice.paused','practice.resume':'practice.running','practice.finish':'practice.question.1','practice.exit.keep':'practice.running','practice.save.retry':'practice.done'}
 if id in expected:lines.append(f'- assertVisible: {{id: "{expected[id]}"}}')
def open(route):lines.append(f'- openLink: "tms-e2e:///{route}"');lines.append('- waitForAnimationToEnd: {timeout: 1800}')
def snap(id,name,direction='DOWN',percentage=100):
 if args.size!='maximum' and name not in {'history-empty-heading','history-empty-body','intro-actions','start-dialog-actions','running-guide-lower','running-levels','running-actions','paused-actions','exit-dialog-actions','question-1-endpoints','question-2-warning','question-3-feelings','summary-reports','summary-actions','saved','saved-actions','history-answers','history-actions','save-error','save-retry','retry-saved','home-practice','home-practice-actions','reset-blocked-actions','reset-history-answers','reset-home-practice','reset-home-actions'}:return
 visible(id,direction,percentage)
 if name.endswith('actions') or name in {'save-retry','home-practice-detail','reset-home-detail'}:lines.append('- swipe: {start: "50%, 75%", end: "50%, 40%", duration: 400}')
 cap(name)
def short_run():
 tap('practice.start');snap('practice.dialog.heading','retry-start-dialog');snap('practice.start.confirm','retry-start-dialog-actions');tap('practice.start.confirm');cap('retry-running');tap('practice.finish');tap('practice.skip');tap('practice.skip');tap('practice.skip')
if args.fixture=='fresh-v8':
 open('bloom/practice/history');cap('history-empty');snap('practice.history.empty.heading','history-empty-heading');snap('practice.history.empty.body','history-empty-body',percentage=25);open('bloom/practice');cap('intro')
 for i in range(4):
  snap(f'practice.rule.{i}.title',f'intro-rule-{i}-title');snap(f'practice.rule.{i}.detail',f'intro-rule-{i}-detail',percentage=25)
 snap('practice.start','intro-actions');tap('practice.start');cap('start-dialog');snap('practice.dialog.body','start-dialog-body',percentage=25);snap('practice.start.confirm','start-dialog-actions');tap('practice.start.confirm');cap('running')
 snap('practice.guide','running-guide',percentage=25);snap('practice.level.open','running-guide-lower');tap('practice.level.open');snap('practice.level.grid','running-levels');tap('practice.level.7');snap('practice.target','running-target',percentage=25);snap('practice.pause','running-actions');tap('practice.pause');cap('paused');snap('practice.pause.guidance','paused-guidance',percentage=25);snap('practice.resume','paused-actions');tap('practice.resume')
 tap('practice.exit');cap('exit-dialog');snap('practice.exit.keep','exit-dialog-actions');tap('practice.exit.keep');tap('practice.finish');cap('question-1');snap('practice.quality.grid','question-1-choices');tap('practice.quality.8');snap('practice.quality.high','question-1-endpoints');snap('practice.hint','question-1-hint',percentage=25);snap('practice.next','question-1-actions');tap('practice.next');cap('question-2');tap('practice.content.yes');cap('question-2-selected');snap('practice.hint','question-2-hint',percentage=25);snap('practice.content.warning','question-2-warning',percentage=25);snap('practice.next','question-2-actions');tap('practice.next');cap('question-3');tap('practice.ending.stopped');snap('practice.feeling.1','question-3-feelings');tap('practice.feeling.1');snap('practice.next','question-3-actions');tap('practice.next');cap('summary')
 for label,name in [('Toplam süre','summary-total'),('Duraklama','summary-pause'),('Bitiş','summary-ending'),('Seviye girişleri','summary-reports')]:
  if label=='Duraklama':snap('practice.summary.row.1.*',name,percentage=25)
  else:snap('practice.summary.row.'+label,name,percentage=25)
 snap('practice.save','summary-actions');tap('practice.save');snap('practice.saved','saved','UP');snap('practice.done','saved-actions');tap('practice.done');cap('history');snap('practice.history.answers','history-answers',percentage=25);snap('practice.history.reports','history-reports',percentage=25);snap('practice.entry.history.start','history-actions')
 # Exact retry and error copy, without changing the production save machinery.
 open('debug/practice-persistence');tap('practice.qa.fail');tap('practice.qa.start');cap('ready');short_run();tap('practice.save');snap('practice.save.status','save-error',percentage=25);snap('practice.save.retry','save-retry');tap('practice.save.retry');snap('practice.saved','retry-saved','UP');tap('practice.done')
 open('today');snap('practice.rule.1.title','home-practice',percentage=25);snap('practice.entry.home.history','home-practice-actions');snap('practice.entry.home.detail','home-practice-detail',percentage=25)
elif args.fixture=='reset-active':
 open('bloom/practice');cap('reset-blocked');snap('practice.blocked.history','reset-blocked-actions');tap('practice.blocked.history');cap('reset-history');snap('practice.history.answers','reset-history-answers',percentage=25);open('today');snap('practice.rule.1.title','reset-home-practice',percentage=25);snap('practice.entry.home.history','reset-home-actions');snap('practice.entry.home.detail','reset-home-detail',percentage=25)
else:
 open('bloom/practice');cap('storage-error')
(out/'capture-native.js').write_text('const response = http.post("http://127.0.0.1:8084/capture", {headers:{"Content-Type":"application/json"}, body:JSON.stringify({name:output.captureName})}); if (!response.ok) throw new Error("Native capture failed: "+response.body);\n')
flow=out/'flow.yaml';flow.write_text('\n'.join(lines)+'\n')
env=dict(os.environ,APP_VARIANT='e2e',EXPO_PUBLIC_E2E_MODE='1',EXPO_PUBLIC_PRACTICE_PERSISTENCE_QA='1',EXPO_PUBLIC_PRACTICE_QA_RUN=args.run,EXPO_PUBLIC_PRACTICE_QA_FIXTURE=args.fixture)
for flag in ['EXPO_PUBLIC_PRACTICE_PREVIEW','EXPO_PUBLIC_KEGEL_PREVIEW','EXPO_PUBLIC_KEGEL_PERSISTENCE_QA','EXPO_PUBLIC_PHASE10_QA']:env.pop(flag,None)
# Refuse shared Metro: never terminate or reconfigure an existing server.
listener=subprocess.run(['lsof','-t',f'-iTCP:{PORT}','-sTCP:LISTEN'],capture_output=True,text=True)
assert not listener.stdout.strip(),'8083 is already in use; stop only the server owned by your task'
captures=out/'captures';captures.mkdir(exist_ok=True)
class CaptureHandler(BaseHTTPRequestHandler):
 def log_message(self,*args):pass
 def do_POST(self):
  try:
   data=json.loads(self.rfile.read(int(self.headers.get('Content-Length','0'))));name=data['name']
   assert self.path=='/capture' and name in capture_names and re.fullmatch(r'[a-zA-Z0-9_-]+',name)
   path=captures/(name+'.png')
   if not path.exists():
    # Let native layout/stack/spring settle. No app state or pixel editing.
    time.sleep(.9);sim('io',args.device,'screenshot',str(path))
   assert path.read_bytes().startswith(b'\x89PNG\r\n\x1a\n')
   body=json.dumps({'file':path.name,'captured':True,'visualInspectionRequired':True}).encode();self.send_response(200)
  except Exception as error:body=str(error).encode();self.send_response(500)
  self.send_header('Content-Type','application/json');self.end_headers();self.wfile.write(body)
# Only loopback, names generated by this flow, this new device and output dir.
# Uses Maestro's documented JS HTTP API, never transfers app/user data.
camera=HTTPServer(('127.0.0.1',8084),CaptureHandler);camera_thread=Thread(target=camera.serve_forever,daemon=True);camera_thread.start()
with (out/'metro.log').open('w') as log:
 server=subprocess.Popen(['node','node_modules/expo/bin/cli','start','--dev-client','--localhost','--port',str(PORT)],cwd=ROOT,env=env,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
 try:
  deadline=time.monotonic()+60
  while f'Waiting on http://localhost:{PORT}' not in (out/'metro.log').read_text():
   if server.poll() is not None or time.monotonic()>deadline:raise RuntimeError('Isolated Metro failed')
   time.sleep(.25)
  sim('terminate',args.device,APP,check=False)
  sim('ui',args.device,'content_size',{'default':'large','moderate':'extra-extra-extra-large','maximum':'accessibility-extra-extra-extra-large'}[args.size])
  sim('launch',args.device,APP,check=False)
  sim('openurl',args.device,f'tms-e2e://expo-development-client/?url=http%3A%2F%2Flocalhost%3A{PORT}')
  # Bootstrapped dev-client only; this wait allows the newly named root to load.
  time.sleep(4)
  with (out/'maestro.log').open('w') as log:
   result=subprocess.run(['maestro','--device',args.device,'test',str(flow),'--test-output-dir',str(out/'native'),'--debug-output',str(out/'native')],cwd=ROOT,stdout=log,stderr=subprocess.STDOUT)
  snapshot(out/'after.json')
  (out/'result.json').write_text(json.dumps({'device':args.device,'category':args.size,'fixture':args.fixture,'run':args.run,'prefix':prefix,'exitCode':result.returncode,'visualInspectionRequired':True},indent=2)+'\n')
  print(f'{args.size} {args.fixture}: exit {result.returncode}',flush=True)
 finally:
  sim('terminate',args.device,APP,check=False)
  camera.shutdown();camera.server_close()
  os.killpg(server.pid,signal.SIGTERM)
  try:server.wait(timeout=8)
  except subprocess.TimeoutExpired:os.killpg(server.pid,signal.SIGKILL);server.wait()

raise SystemExit(result.returncode)
