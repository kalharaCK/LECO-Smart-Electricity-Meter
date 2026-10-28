const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const repoRoot = path.resolve(__dirname, '..');
const mlDir = path.join(repoRoot, 'ml');
const isWin = process.platform === 'win32';
const venvPy = path.join(mlDir, '.venv', isWin ? 'Scripts/python.exe' : 'bin/python');

const pythonBin = fs.existsSync(venvPy) ? venvPy : (isWin ? 'python' : 'python3');

const userArgs = process.argv.slice(2);
const runArgs = userArgs.length > 0 ? userArgs : ['-m', 'ml.main'];

console.log('============================================================');
console.log(' LECO Adaptive Smart Electricity Meter ML Service');
console.log(' Python:       ', pythonBin);
console.log(' Service URL:  http://localhost:8000');
console.log(' Health Check: http://localhost:8000/api/ml/health');
console.log(' Docs:         http://localhost:8000/docs');
console.log('============================================================');

const child = spawn(pythonBin, runArgs, {
  cwd: repoRoot,
  stdio: 'inherit',
  env: {
    ...process.env,
    PYTHONPATH: repoRoot
  }
});

child.on('exit', (code) => {
  if (code !== null) process.exit(code);
});
