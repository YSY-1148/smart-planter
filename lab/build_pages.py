"""Build a self-contained GitHub Pages site using the original C core as Wasm."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import subprocess

from build import instrument, ROOT, HERE
from engine import FIELDS, ACKS, ALARMS, source_files
from lessons import LESSONS
from study_runner import TOPIC_STEPS

EXPORTS=['lab_buffer','lab_reset','lab_sample','lab_step','lab_command','lab_state',
         'lab_trace_clear','lab_trace_size','lab_trace_at','lab_frame','lab_layout']


def build_pages(output, clang='clang'):
    output=Path(output).resolve()
    # Never recursively clean a caller-supplied directory; overwrite only generated files.
    output.mkdir(parents=True,exist_ok=True)
    build_dir=HERE/'.build/wasm'
    build_dir.mkdir(parents=True,exist_ok=True)
    observed=build_dir/'planter_observed.c'
    observed.write_text(instrument((ROOT/'common/planter.c').read_text(encoding='utf-8')),encoding='utf-8')
    compiler=shutil.which(clang)
    if not compiler: raise RuntimeError('Building Pages requires clang and wasm-ld; GitHub Actions installs these.')
    command=[compiler,'--target=wasm32-unknown-unknown','-std=c11','-O1','-ffreestanding','-fno-builtin','-nostdlib',
             '-I'+str(HERE/'wasm'),'-I'+str(ROOT/'common'),str(observed),str(ROOT/'common/protocol.c'),
             str(HERE/'bridge.c'),str(HERE/'wasm/runtime.c'),'-Wl,--no-entry','-Wl,--export-memory',
             '-Wl,--initial-memory=524288','-Wl,--max-memory=524288',
             *['-Wl,--export='+name for name in EXPORTS],'-o',str(output/'planter.wasm')]
    subprocess.run(command,check=True)
    sources=source_files()
    payload=dict(fields=FIELDS,acks=ACKS,alarms=ALARMS,lessons=LESSONS,sources=sources,topic_steps=TOPIC_STEPS,
                 commit_line=next(i+1 for i,l in enumerate(sources['stm32/src/app.c'].splitlines()) if 'board_outputs(&p.out)' in l),
                 core_sha256=hashlib.sha256((ROOT/'common/planter.c').read_bytes()).hexdigest())
    (output/'browser-data.json').write_text(json.dumps(payload,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    # Whitelist website assets. No .env, secrets.h, logs, Python caches or user records.
    for source in (HERE/'web').rglob('*'):
        if not source.is_file() or source.suffix not in {'.html','.css','.js','.json','.svg','.png','.jpg','.webp'}: continue
        relative=source.relative_to(HERE/'web')
        destination=output/('workbench.html' if relative.as_posix()=='index.html' else relative)
        destination.parent.mkdir(parents=True,exist_ok=True)
        if source.suffix in {'.html','.js','.css','.json','.svg'}:
            content=source.read_text(encoding='utf-8')
            if source.suffix in {'.html','.js'}:
                content=content.replace('href="/?','href="workbench.html?').replace('href="/"','href="workbench.html"')
                content=content.replace('href="index.html','href="workbench.html')
            if source.name in {'index.html','study.html'}:
                content=content.replace('<head>','<head>\n<script>window.QINGHE_STATIC=true;</script>',1)
                content=content.replace('本地 C 控制核心','浏览器 C 控制核心')
            destination.write_text(content,encoding='utf-8')
        else: shutil.copyfile(source,destination)
    (output/'index.html').write_text('<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>青禾实验室</title><meta http-equiv="refresh" content="0;url=study.html"><p><a href="study.html">进入青禾实验室：从零开始</a></p></html>',encoding='utf-8')
    (output/'.nojekyll').write_text('',encoding='utf-8')
    print(json.dumps(dict(output=str(output),wasm_bytes=(output/'planter.wasm').stat().st_size,core_sha256=payload['core_sha256'])))


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--output',default=str(ROOT/'_site'));parser.add_argument('--clang',default='clang')
    args=parser.parse_args();build_pages(args.output,args.clang)
