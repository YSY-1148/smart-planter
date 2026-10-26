Import("env")
from pathlib import Path
import hashlib
import io
import urllib.request
import zipfile

root = Path(env.subst("$PROJECT_DIR")) / ".deps" / "FreeRTOS-Kernel"
if not (root / "tasks.c").exists():
    url = "https://github.com/FreeRTOS/FreeRTOS-Kernel/releases/download/V11.1.0/FreeRTOS-KernelV11.1.0.zip"
    data = urllib.request.urlopen(url, timeout=60).read()
    expected = "eebd58aa71a623c9381f25f77b708c0ed14ef995a8913e2460fe9f286bb271eb"
    if hashlib.sha256(data).hexdigest() != expected:
        raise RuntimeError("FreeRTOS archive checksum mismatch")
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        names = z.namelist()
        task_path = next(n for n in names if n.endswith("tasks.c"))
        prefix = task_path[:-len("tasks.c")]
        for name in names:
            if not name.startswith(prefix) or name.endswith("/"):
                continue
            relative = Path(name[len(prefix):])
            if relative.is_absolute() or ".." in relative.parts:
                raise RuntimeError("Unsafe archive path")
            target = root / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(z.read(name))
env.Append(CPPPATH=[str(root / "include"), str(root / "portable/GCC/ARM_CM4F")])
env.BuildSources("$BUILD_DIR/freertos", str(root), src_filter=[
    "+<tasks.c>", "+<queue.c>", "+<list.c>", "+<portable/GCC/ARM_CM4F/port.c>"
])
