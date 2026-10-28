"""
LECO Smart Electricity Meter - Machine Learning Service Runner
Run from ANY directory using:
    python run.py
or:
    python ml/run.py
"""
import sys
import os
import subprocess
from pathlib import Path

def main():
    ml_dir = Path(__file__).resolve().parent
    repo_root = ml_dir.parent

    # Find virtual environment python
    is_win = os.name == "nt"
    venv_py = ml_dir / ".venv" / ("Scripts" if is_win else "bin") / ("python.exe" if is_win else "python")

    # If running with external python that isn't the .venv interpreter, re-exec seamlessly
    if venv_py.exists():
        curr_py = Path(sys.executable).resolve()
        if curr_py != venv_py.resolve():
            cmd = [str(venv_py), str(Path(__file__).resolve()), *sys.argv[1:]]
            sys.exit(subprocess.call(cmd, cwd=str(repo_root)))

    # Ensure sys.path includes repo_root
    if str(repo_root) not in sys.path:
        sys.path.insert(0, str(repo_root))
    if str(ml_dir) not in sys.path:
        sys.path.insert(0, str(ml_dir))
    os.chdir(str(repo_root))

    import uvicorn
    from ml.config import settings

    print("=" * 65)
    print(f"  {settings.APP_NAME}")
    print(f"  Service:      http://localhost:{settings.PORT}")
    print(f"  Health Check: http://localhost:{settings.PORT}/api/ml/health")
    print(f"  Swagger Docs: http://localhost:{settings.PORT}/docs")
    print("=" * 65)

    uvicorn.run("ml.main:app", host=settings.HOST, port=settings.PORT, reload=settings.DEBUG)

if __name__ == "__main__":
    main()
