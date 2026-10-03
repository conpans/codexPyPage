// Additional verification with the installed WebAssembly Python runtime.
// Run: node tests/pyodide-catalog.mjs
// This executes only authored reference fixtures, never saved learner code.
// It checks Pyodide and the deployed checker, not browser UI or worker isolation.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Worker, isMainThread, parentPort} from 'node:worker_threads';
import {exercises} from '../src/content.js';

if (isMainThread) {
  // A separate thread gives the harness a real deadline if an authored fixture
  // accidentally loops forever inside synchronous WebAssembly execution.
  const report = await new Promise((resolve, reject) => {
    const worker = new Worker(new URL(import.meta.url));
    const deadline = setTimeout(() => {
      worker.terminate();
      reject(new Error('Pyodide catalog verification exceeded 45 seconds.'));
    }, 45_000);
    const finish = callback => value => {
      clearTimeout(deadline);
      worker.terminate();
      callback(value);
    };
    worker.once('message', finish(resolve));
    worker.once('error', finish(reject));
    worker.once('exit', code => {
      if (code !== 0) finish(reject)(new Error(`Pyodide verification worker exited with ${code}`));
    });
  });
  assert.deepEqual(report.failures, []);
  assert.equal(report.exercises, exercises.length);
  assert.equal(report.referenceTests, exercises.reduce((n, e) => n + e.tests.length, 0));
  assert.equal(report.referenceExamples, exercises.reduce((n, e) => n + e.examples.length, 0));
  assert.deepEqual(report.networkRequests, []);
  console.log(JSON.stringify(report, null, 2));
} else {
  const networkRequests = [];
  globalThis.fetch = async url => {
    networkRequests.push(String(url));
    throw new Error('Network fetch disabled during local runtime verification.');
  };
  const {loadPyodide} = await import('pyodide');
  const runtime = await loadPyodide({
    indexURL: new URL('../node_modules/pyodide/', import.meta.url).pathname,
    stdout: () => {}, stderr: () => {},
  });
  runtime.runPython(await readFile(new URL('../public/checker.py', import.meta.url), 'utf8'));
  const checker = runtime.globals.get('check_attempt');
  const failures = [];
  let referenceTests = 0, referenceExamples = 0;
  try {
    for (const exercise of exercises) {
      for (const category of ['tests', 'examples']) {
        for (const [index, sample] of exercise[category].entries()) {
          const result = JSON.parse(checker(exercise.solution, JSON.stringify(sample.input), JSON.stringify(sample.expected), exercise.resultVariable, JSON.stringify(exercise.checks || {})));
          if (!result.passed || result.error || result.errorType) failures.push({id: exercise.id, category, index, result});
          if (category === 'tests') referenceTests += 1;
          else referenceExamples += 1;
        }
      }
    }
    const first = JSON.parse(checker('old_value = 41\nresult = old_value', '{}', '41', 'result', '{}'));
    const next = JSON.parse(checker('result = old_value', '{}', '41', 'result', '{}'));
    if (!first.passed || next.errorType !== 'NameError') failures.push({freshState: {first, next}});
    parentPort.postMessage({runtime: 'Pyodide WebAssembly in Node; browser behavior not covered', python: runtime.runPython('import sys\nsys.version.split()[0]'), exercises: exercises.length, referenceTests, referenceExamples, freshStateCalls: 2, networkRequests, failures});
  } finally {
    checker.destroy();
  }
}
