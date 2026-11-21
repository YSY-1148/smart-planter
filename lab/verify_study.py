"""Verify the study UI/API on an ephemeral port, never the user's running lab."""
import argparse
import json
import os
from pathlib import Path
import shutil
import socket
import subprocess
import sys
import time
from urllib.error import HTTPError
from urllib.request import Request, urlopen


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--node',default=shutil.which('node'))
    parser.add_argument('--legacy',action='store_true',help='Also verify existing project UI integration')
    args=parser.parse_args()
    if not args.node: parser.error('Supply --node with the path to a Node.js executable')
    root=Path(__file__).resolve().parent
    with socket.socket() as sock:
        sock.bind(('127.0.0.1',0)); port=sock.getsockname()[1]
    base=f'http://127.0.0.1:{port}'
    server=subprocess.Popen([sys.executable,str(root/'server.py'),'--port',str(port)],
        stdout=subprocess.PIPE,stderr=subprocess.PIPE,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
    def request(route,data=None,origin=None):
        headers={'Content-Type':'application/json'}
        if origin: headers['Origin']=origin
        req=Request(base+route,data=None if data is None else json.dumps(data).encode(),headers=headers)
        with urlopen(req,timeout=35) as response: return json.load(response)
    try:
        for _ in range(100):
            if server.poll() is not None: raise RuntimeError(server.communicate()[1].decode(errors='replace'))
            try: request('/api/info'); break
            except OSError: time.sleep(.1)
        else: raise RuntimeError('Server did not become ready')
        for route in ['/study.html','/downloads/day2-study-handbook.html','/downloads/interview-handbook.html']:
            with urlopen(base+route) as response: assert response.status==200
        request('/api/action',{'action':'inputs','values':{'temp':31}})
        request('/api/action',{'action':'advance','ms':2000})
        before=request('/api/state')
        cases=[(17,'tasks','out_fan',[0,0,1]),(18,'fan','out_fan',[0,1,1,0,0]),
               (20,'light','out_led',[5,5,10,10,10,0]),(21,'water','water_stable',[0,0,1]),
               (22,'pump','out_drip',[1,0,0,1])]
        for topic,lesson,key,expected in cases:
            result=request('/api/study-run',{'id':lesson,'topic':topic})
            assert [row['state'][key] for row in result['observations']]==expected
        after=request('/api/state')
        assert before==after,'Study experiments changed the main workbench'
        for data,origin,status in [({'id':'invalid'},None,400),({'id':'fan','topic':'bad'},None,400),({'id':'fan'},'https://example.com',403)]:
            try: request('/api/study-run',data,origin)
            except HTTPError as error: assert error.code==status
            else: raise AssertionError('Invalid operation was accepted')
        print('PASS native boundaries, full main-session isolation, input checks and cross-origin rejection',flush=True)
        env={**os.environ,'LAB_TEST_URL':base}
        subprocess.run([args.node,str(root/'test_study.cjs')],env=env,check=True,timeout=90)
        subprocess.run([args.node,str(root/'test_beginner.cjs')],env=env,check=True,timeout=90)
        if args.legacy: subprocess.run([args.node,str(root/'test_project_ui.cjs')],env=env,check=True,timeout=120)
    finally:
        server.terminate();server.communicate(timeout=10)


if __name__=='__main__': main()
