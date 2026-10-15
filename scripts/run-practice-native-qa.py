#!/usr/bin/env python3
"""Run only NEW, guarded Practice E2E namespaces. No app reset/clearState.
Snapshots read fixture keys, never seed or copy canonical/user storage.
"""
import argparse, hashlib, json, os, re, signal, subprocess, time
from pathlib import Path

ROOT=Path(__file__).resolve().parent.parent
FLOWS={"populated-v8":"practice-persistence-populated", "reset-active":"practice-persistence-reset", "reset-elapsed":"practice-persistence-reset", "reset-baseline":"practice-persistence-reset", "reset-completed-pending":"practice-persistence-reset", "corrupt-v9":"practice-persistence-corrupt", "unsupported-v9":"practice-persistence-corrupt", "fresh-v8":"practice-persistence-largest"}
parser=argparse.ArgumentParser();parser.add_argument('--run',required=True);parser.add_argument('--output',required=True);parser.add_argument('--fixtures',nargs='+',choices=FLOWS,required=True);args=parser.parse_args()
if not re.fullmatch(r'[a-zA-Z0-9_-]{8,80}',args.run):raise SystemExit('A new valid isolated QA run is required')
out=Path(args.output);out.mkdir(parents=True,exist_ok=True)

def sim(*arguments,check=True):return subprocess.run(['xcrun','simctl',*arguments],text=True,capture_output=True,check=check)
def snapshot(prefix,destination):
    container=Path(sim('get_app_container','booted','com.umutcyilmaz.bloom.e2e','data').stdout.strip())
    folder=container/'Library/Application Support/com.umutcyilmaz.bloom.e2e/RCTAsyncLocalStorage_V1'
    manifest=json.loads((folder/'manifest.json').read_text());values={}
    for key,value in manifest.items():
        if key.startswith(prefix):values[key]=value if value is not None else (folder/hashlib.md5(key.encode()).hexdigest()).read_text()
    destination.write_text(json.dumps(values,indent=2)+'\n')

for fixture in args.fixtures:
    folder=out/fixture;folder.mkdir(exist_ok=True);prefix=f'bloom.e2e.practice.{args.run}.{fixture}.'
    snapshot(prefix,folder/'before-start.json')
    # Reopening an existing current-phase namespace is allowed for visual QA;
    # its sentinel ensures initialization never overwrites prior fixture data.
    env=dict(os.environ,APP_VARIANT='e2e',EXPO_PUBLIC_E2E_MODE='1',EXPO_PUBLIC_PRACTICE_PERSISTENCE_QA='1',EXPO_PUBLIC_PRACTICE_QA_RUN=args.run,EXPO_PUBLIC_PRACTICE_QA_FIXTURE=fixture)
    for flag in ['EXPO_PUBLIC_PRACTICE_PREVIEW','EXPO_PUBLIC_KEGEL_PREVIEW','EXPO_PUBLIC_KEGEL_PERSISTENCE_QA','EXPO_PUBLIC_PHASE10_QA']:env.pop(flag,None)
    print(f'BEGIN {fixture}: {prefix}',flush=True)
    with (folder/'metro.log').open('w') as log:
        server=subprocess.Popen(['node','node_modules/expo/bin/cli','start','--dev-client','--localhost','--port','8082'],cwd=ROOT,env=env,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
        try:
            deadline=time.monotonic()+60
            while 'Waiting on http://localhost:8082' not in (folder/'metro.log').read_text():
                if server.poll() is not None or time.monotonic()>deadline:raise RuntimeError('Isolated Metro failed to start')
                time.sleep(.25)
            sim('ui','booted','content_size','accessibility-extra-extra-extra-large' if fixture=='fresh-v8' else 'large')
            sim('terminate','booted','com.umutcyilmaz.bloom.e2e',check=False)
            sim('openurl','booted','tms-e2e://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8082')
            time.sleep(4)
            snapshot(prefix,folder/'before-flow.json')
            with (folder/'maestro.log').open('w') as result:
                test=subprocess.run(['maestro','test',str(ROOT/'.maestro'/f'{FLOWS[fixture]}.yaml'),'--test-output-dir',str(folder/'native'),'--debug-output',str(folder/'native')],cwd=ROOT,stdout=result,stderr=subprocess.STDOUT)
            snapshot(prefix,folder/'after-flow.json')
            (folder/'result.json').write_text(json.dumps({'fixture':fixture,'exitCode':test.returncode,'prefix':prefix},indent=2)+'\n')
            print(f'END {fixture}: exit {test.returncode}',flush=True)
        finally:
            os.killpg(server.pid,signal.SIGTERM)
            try:server.wait(timeout=8)
            except subprocess.TimeoutExpired:os.killpg(server.pid,signal.SIGKILL);server.wait()
            time.sleep(.5)
