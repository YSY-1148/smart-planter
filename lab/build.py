"""Build the existing C controller on the host; no firmware source is modified."""
import hashlib
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent


def instrument(source):
    """Add observation callbacks at selected statement boundaries, keeping C branches intact."""
    result = ['void lab_trace(int line);']
    for number, line in enumerate(source.splitlines(), 1):
        stripped = line.strip()
        mark = f' lab_trace({number});'
        # A callback is executed after the assignment, only if that branch ran.
        match = re.match(r'^(\s*(?:else )?if\s*\(.*\)) (p->.*;)$', line)
        if match and 'return ' not in line:
            line = match[1] + ' { ' + match[2] + mark + ' }'
        elif stripped == 'p->refill_fault=true;':
            line = '        { p->refill_fault=true;' + mark + ' }'
        elif stripped.startswith(('p->', 'memset(p,', 'bool fresh=', 'bool dht=', 'bool light=',
                                  'bool germ=', 'bool can_water=', 'bool can_refill=', 'Outputs desired=')) and stripped.endswith(';'):
            line += mark
        elif stripped.startswith(('desired.', 'int led=')) and stripped.endswith(';'):
            line += mark
        elif stripped.startswith('else { p->fan_demand='):
            line = line[:-1] + mark + ' }'
        # Observe validation exits, without changing expression values.
        if 'return ACK_' in line:
            line = re.sub(r'return (ACK_\w+);', rf'return (lab_trace({number}), \1);', line)
        if stripped.startswith('void planter_sample('):
            line = line[:-1] + mark + ' }'
        result.append(line)
    return '\n'.join(result) + '\n'


def msvc_environment():
    finder = Path(os.environ.get('ProgramFiles(x86)', r'C:\Program Files (x86)')) / 'Microsoft Visual Studio/Installer/vswhere.exe'
    if not finder.exists():
        return None
    install = subprocess.check_output([str(finder), '-latest', '-products', '*', '-requires',
                                      'Microsoft.VisualStudio.Component.VC.Tools.x86.x64', '-property', 'installationPath'], text=True).strip()
    if not install:
        return None
    env = dict(os.environ)
    tool = sorted((Path(install)/'VC/Tools/MSVC').iterdir())[-1]
    sdk = Path(os.environ.get('ProgramFiles(x86)', r'C:\Program Files (x86)'))/'Windows Kits/10'
    version = sorted(p.name for p in (sdk/'Include').iterdir() if (p/'ucrt').exists())[-1]
    env['Path'] = str(tool/'bin/Hostx64/x64') + os.pathsep + env.get('Path', env.get('PATH', ''))
    env['INCLUDE'] = ';'.join(str(p) for p in [tool/'include', sdk/'Include'/version/'ucrt',
                                             sdk/'Include'/version/'shared', sdk/'Include'/version/'um'])
    env['LIB'] = ';'.join(str(p) for p in [tool/'lib/x64', sdk/'Lib'/version/'ucrt/x64', sdk/'Lib'/version/'um/x64'])
    temp = HERE/'.build/tmp'
    temp.mkdir(parents=True, exist_ok=True)
    env['TMP'] = env['TEMP'] = str(temp)
    return env


def build(traced=True):
    files = [ROOT/'common/planter.c', ROOT/'common/planter.h', ROOT/'common/protocol.c',
             ROOT/'common/protocol.h', HERE/'bridge.c', Path(__file__)]
    digest = hashlib.sha256(b''.join(p.read_bytes() for p in files) + str(traced).encode()).hexdigest()[:12]
    folder = HERE/'.build'/digest
    folder.mkdir(parents=True, exist_ok=True)
    binary = folder / ('planter.dll' if os.name == 'nt' else 'libplanter.dylib' if sys.platform=='darwin' else 'libplanter.so')
    if binary.exists():
        return binary
    core = ROOT/'common/planter.c'
    if traced:
        core = folder/'planter_observed.c'
        core.write_text(instrument((ROOT/'common/planter.c').read_text(encoding='utf-8')), encoding='utf-8')
    sources = [str(core), str(ROOT/'common/protocol.c'), str(HERE/'bridge.c')]
    compiler = shutil.which('gcc') or shutil.which('clang') or shutil.which('cc')
    if compiler:
        command = [compiler, '-std=c11', '-dynamiclib' if sys.platform=='darwin' else '-shared', '-O0', '-g', '-I'+str(ROOT/'common'), *sources, '-o', str(binary)]
        if os.name != 'nt': command.insert(3, '-fPIC')
        subprocess.run(command, check=True, cwd=folder)
    elif os.name == 'nt' and (env := msvc_environment()):
        compiler = shutil.which('cl.exe', path=env.get('Path', env.get('PATH')))
        if not compiler: raise RuntimeError('MSVC environment has no cl.exe')
        subprocess.run([compiler, '/nologo', '/std:c11', '/utf-8', '/LD', '/Od', '/W3',
                        '/I'+str(ROOT/'common'), *sources, '/Fe:'+str(binary)],
                       check=True, env=env, cwd=folder)
    else:
        raise RuntimeError('A host C compiler is required: Visual Studio C++ Build Tools, GCC or Clang.')
    return binary


if __name__ == '__main__':
    print(build('--plain' not in sys.argv))
