import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

root = Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory() as temp:
    compiler = shutil.which("gcc") or shutil.which("cc")
    if not compiler:
        raise SystemExit("Install a C compiler (GCC or Clang) first")
    binary = str(Path(temp) / "test_core")
    subprocess.run([compiler, "-std=c11", "-Wall", "-Wextra", "-Werror", "-pedantic", "-g",
                    "-I"+str(root / "common"), str(root / "common/protocol.c"), str(root / "common/planter.c"),
                    str(root / "tests/test_core.c"), "-o", binary], check=True)
    subprocess.run([binary], check=True)
subprocess.run([sys.executable, "-m", "unittest", "discover", "-s", str(root / "tests"), "-p", "test_*.py", "-v"], check=True)
