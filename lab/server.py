"""Loopback-only teaching application. Run with: python lab/server.py --open"""
import argparse
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
import json
import subprocess
import sys
from pathlib import Path
import threading
from urllib.parse import urlparse
import webbrowser

from engine import Simulation, source_files
from lessons import LESSONS

HERE=Path(__file__).resolve().parent


def serve(port=8765, open_browser=False, open_path='/'):
    simulation=Simulation(); lock=threading.Lock()
    class Handler(SimpleHTTPRequestHandler):
        def __init__(self,*args,**kwargs): super().__init__(*args,directory=str(HERE/'web'),**kwargs)
        def log_message(self,*args): pass
        def json_response(self,value,status=200):
            body=json.dumps(value,ensure_ascii=False,allow_nan=False).encode('utf-8')
            self.send_response(status); self.send_header('Content-Type','application/json; charset=utf-8')
            self.send_header('Cache-Control','no-store'); self.send_header('Content-Length',str(len(body)))
            self.end_headers(); self.wfile.write(body)
        def do_GET(self):
            if urlparse(self.path).path=='/api/info':
                self.json_response(dict(app='qinghe-planter-lab',directory=str(HERE),study_api=1))
            elif urlparse(self.path).path=='/api/init':
                with lock: self.json_response(dict(lessons=LESSONS,sources=source_files(),**simulation.snapshot()))
            elif urlparse(self.path).path=='/api/state':
                with lock: self.json_response(simulation.snapshot())
            else: super().do_GET()
        def do_POST(self):
            # No cross-origin writes to the local controller.
            origin=self.headers.get('Origin')
            if origin and origin not in (f'http://127.0.0.1:{port}',f'http://localhost:{port}'):
                self.json_response({'error':'只接受本地实验台的操作'},403); return
            if self.path not in ('/api/action','/api/study-run'): self.json_response({'error':'not found'},404); return
            try:
                size=int(self.headers.get('Content-Length','0'))
                if not 0<size<=16384: raise ValueError('请求大小不正确')
                if 'application/json' not in self.headers.get('Content-Type',''): raise ValueError('需要 JSON')
                data=json.loads(self.rfile.read(size))
                if not isinstance(data,dict): raise ValueError('需要对象')
                if self.path=='/api/study-run':
                    lesson_id=data.get('id')
                    if lesson_id not in {item['id'] for item in LESSONS}: raise ValueError('未知实验')
                    topic=data.get('topic',0)
                    if not isinstance(topic,int) or not 0<=topic<=150: raise ValueError('专题编号无效')
                    # Each native DLL owns a global Planter. A second Simulation in this
                    # process would reset the main workbench; isolate the entire run.
                    result=subprocess.run([sys.executable,str(HERE/'study_runner.py'),lesson_id,str(topic)],
                        capture_output=True,text=True,encoding='utf-8',timeout=30,
                        creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
                    if result.returncode: raise ValueError('实验执行失败，请检查服务日志或重新启动实验台')
                    self.json_response(json.loads(result.stdout)); return
                with lock: response=simulation.action(data)
                self.json_response(response)
            except (ValueError,TypeError,OverflowError) as error:
                self.json_response({'error':str(error)},400)
            except subprocess.TimeoutExpired:
                self.json_response({'error':'实验执行超时，请稍后重试'},504)
    server=ThreadingHTTPServer(('127.0.0.1',port),Handler)
    print(f'PLANTER_LAB_READY http://127.0.0.1:{port}',flush=True)
    if open_browser: webbrowser.open(f'http://127.0.0.1:{port}{open_path}')
    try: server.serve_forever()
    except KeyboardInterrupt: pass
    finally: server.server_close()


if __name__=='__main__':
    parser=argparse.ArgumentParser(); parser.add_argument('--port',type=int,default=8765); parser.add_argument('--open',action='store_true')
    args=parser.parse_args(); serve(args.port,args.open)
