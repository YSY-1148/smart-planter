"""Open the existing local lab, or start it if it is not running."""
import json
import argparse
from pathlib import Path
from urllib.request import urlopen
import webbrowser

URL='http://127.0.0.1:8765'

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--study',action='store_true')
    args=parser.parse_args()
    page='/study.html' if args.study else '/'
    port=8765
    try:
        with urlopen(URL+'/api/info',timeout=2) as response:
            info=json.load(response)
        if info.get('app')=='qinghe-planter-lab' and Path(info['directory']).resolve()==Path(__file__).resolve().parent:
            if not args.study or info.get('study_api')==1:
                webbrowser.open(URL+page)
                return
            # Keep an older running workbench intact. Use another local port
            # for the new study API instead of resetting an active experiment.
            port=8766
    except (OSError,ValueError,KeyError):
        pass
    if port!=8765:
        try:
            with urlopen(f'http://127.0.0.1:{port}/api/info',timeout=2) as response:
                info=json.load(response)
            if info.get('app')=='qinghe-planter-lab' and info.get('study_api')==1 and Path(info['directory']).resolve()==Path(__file__).resolve().parent:
                webbrowser.open(f'http://127.0.0.1:{port}'+page)
                return
        except (OSError,ValueError,KeyError):
            pass
    from server import serve
    try:
        serve(port=port,open_browser=True,open_path=page)
    except OSError as error:
        print(f'无法启动实验台：{error}')
        print('若端口被其他程序占用，可运行 python server.py --port 8766 --open')
        raise SystemExit(1)

if __name__=='__main__':
    main()
