import { readdir, readFile, access } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const root = new URL('../', import.meta.url);
let count = 0;
async function checkDirectory(name) {
  for (const entry of await readdir(new URL(name, root), { withFileTypes: true })) {
    const relative = path.posix.join(name, entry.name);
    if (entry.isDirectory()) await checkDirectory(relative);
    else if (/\.(mjs|js)$/.test(entry.name)) {
      const result = spawnSync(process.execPath, ['--check', new URL(relative, root).pathname], { encoding: 'utf8' });
      if (result.status !== 0) throw new Error(result.stderr || `${relative} failed syntax checking.`);
      count += 1;
    }
  }
}
for (const directory of ['src', 'public', 'scripts', 'tests']) await checkDirectory(directory);
const source = await readFile(new URL('public/checker.py', root), 'utf8');
const python = spawnSync('python3', ['-c', 'import sys; compile(sys.argv[1], "checker.py", "exec")', source], { encoding: 'utf8' });
if (python.status !== 0) throw new Error(python.stderr || 'Python checker syntax check failed.');
console.log(`Checked ${count} JavaScript files and Python checker syntax.`);
try {
  for (const filename of ['pyodide.mjs', 'pyodide.asm.mjs', 'pyodide.asm.wasm', 'python_stdlib.zip', 'pyodide-lock.json']) await access(new URL(`node_modules/pyodide/${filename}`, root));
  console.log('All five local runtime assets are installed.');
} catch {
  console.error('Local Python runtime assets are missing. Run npm install with internet access, then run npm run check again.');
  process.exitCode = 1;
}
