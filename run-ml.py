"""
LECO Smart Electricity Meter - Top-level ML Service Launcher
Usage:
    python run-ml.py
"""
import sys
import os
import subprocess
from pathlib import Path

repo_root = Path(__file__).resolve().parent
ml_dir = repo_root / "ml"
is_win = os.name == "nt"
venv_py = ml_dir / ".venv" / ("Scripts" if is_win else "bin") / ("python.exe" if is_win else "python")

if venv_py.exists():
    curr_py = Path(sys.executable).resolve()
    if curr_py != venv_py.resolve():
        cmd = [str(venv_py), "-m", "ml.main", *sys.argv[1:]]
        sys.exit(subprocess.call(cmd, cwd=str(repo_root)))

if str(repo_root) not in sys.path:
    sys.path.insert(0, str(repo_root))

from ml.main import app, settings
import uvicorn

if __name__ == "__main__":
    os.chdir(str(repo_root))
    print("=" * 65)
    print(f"  {settings.APP_NAME}")
    print(f"  Service:      http://localhost:{settings.PORT}")
    print(f"  Health Check: http://localhost:{settings.PORT}/api/ml/health")
    print(f"  Swagger Docs: http://localhost:{settings.PORT}/docs")
    print("=" * 65)
    uvicorn.run("ml.main:app", host=settings.HOST, port=settings.PORT, reload=settings.DEBUG)
