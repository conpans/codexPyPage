import { loadPyodide } from '/runtime/pyodide.mjs';

// A worker executes exactly one test and is then destroyed by runner.js.
// No host directory is mounted; Python sees only its in-memory filesystem.
self.onmessage = async ({ data }) => {
  try {
    const [pyodide, source] = await Promise.all([
      loadPyodide({ indexURL: '/runtime/', stdout: () => {}, stderr: () => {} }),
      fetch('/public/checker.py').then(response => {
        if (!response.ok) throw new Error('The local Python checker could not be loaded.');
        return response.text();
      }),
    ]);
    pyodide.runPython(source);
    const check = pyodide.globals.get('check_attempt');
    self.postMessage({ type: 'ready' });
    const result = JSON.parse(check(
      data.code,
      JSON.stringify(data.input),
      JSON.stringify(data.expected),
      data.resultVariable,
      JSON.stringify(data.checks || {}),
    ));
    check.destroy();
    self.postMessage({ type: 'result', result });
  } catch (error) {
    self.postMessage({ type: 'error', message: String(error.message || error).slice(0, 3000) });
  }
};
