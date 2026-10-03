import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createRunner } from '../src/runner.js';
import { emptyProgress, newRecord, recordRun, validateProgress } from '../src/progress.js';

const checker = readFileSync(new URL('../public/checker.py', import.meta.url), 'utf8');

function check(code, input, expected, checks = {}) {
  // Trusted test fixtures only. Learner code runs exclusively in browser workers.
  const driver = `${checker}\nimport sys\nrequest = json.loads(sys.argv[1])\nprint(check_attempt(request['code'], json.dumps(request['input']), json.dumps(request['expected']), 'result', json.dumps(request['checks'])))\n`;
  const process = spawnSync('python3', ['-I', '-c', driver, JSON.stringify({ code, input, expected, checks })], {
    encoding: 'utf8', timeout: 5000,
  });
  assert.equal(process.status, 0, process.stderr || process.error?.message);
  return JSON.parse(process.stdout);
}

test('the checker accepts different correct approaches and checks values rather than stdout', () => {
  assert.equal(check('result = list(values)', { values: [2, -1, 2] }, [2, -1, 2]).passed, true);
  assert.equal(check('result = [item for item in values]', { values: [2] }, [2]).passed, true);
  const printed = check('print(values)', { values: [2] }, [2]);
  assert.equal(printed.errorType, 'MissingResult');
  assert.equal(printed.stdout, '[2]\n');
});

test('type distinctions reject bool-for-int and tuple-for-list', () => {
  assert.equal(check('result = True', {}, 1).passed, false);
  assert.equal(check('result = [True]', {}, [1]).passed, false);
  assert.equal(check('result = (1, 2)', {}, [1, 2]).errorType, 'ResultType');
});

test('new-list and unchanged-input requirements are actually checked', () => {
  const inputs = { values: [3, 2] };
  const checks = { distinctFrom: 'values', preserveInputs: ['values'] };
  assert.equal(check('result = values', inputs, [3, 2], checks).errorType, 'Contract');
  assert.equal(check('result = values[:]\nvalues.append(9)', inputs, [3, 2], checks).errorType, 'Contract');
  assert.equal(check('result = values[:]\nvalues = []', inputs, [3, 2], checks).passed, true);
});

test('off-by-one indexing and wrong append usage show the student line and error', () => {
  const boundary = check('result = []\nposition = 0\nwhile position <= len(values):\n    result.append(values[position])\n    position = position + 1', { values: [7] }, [7]);
  assert.equal(boundary.errorType, 'IndexError');
  assert.match(boundary.error, /line 4/);
  assert.doesNotMatch(boundary.error, /check_attempt|checker.py|\/home\//);
  const append = check('result = []\nvalues[0].append(result)', { values: [4] }, [4]);
  assert.equal(append.errorType, 'AttributeError');
});

test('replacement instead of accumulation fails and expected stdout stays visible', () => {
  const wrong = check('total = 0\nfor value in values:\n    total = value\nresult = total\nprint(f"total: {total}")', { values: [2, 3, 4] }, 9);
  assert.equal(wrong.passed, false);
  assert.equal(wrong.actual, 4);
  assert.equal(wrong.stdout, 'total: 4\n');
});

test('syntax errors remain distinct from incorrect results', () => {
  const syntax = check('while True\n    pass', {}, 0);
  assert.equal(syntax.errorType, 'SyntaxError');
  assert.match(syntax.error, /line 1/);
});

test('the output cap gives an understandable error and bounded captured text', () => {
  const noisy = check('print("x" * 9000)\nresult = 1', {}, 1);
  assert.equal(noisy.errorType, 'OutputLimitExceeded');
  assert.equal(noisy.stdout.length, 8000);
});

test('circular and unsupported answers cannot crash feedback serialization', () => {
  const cycle = check('result = []\nresult.append(result)', {}, [1]);
  assert.equal(cycle.passed, false);
  assert.deepEqual(cycle.actual, ['<circular reference>']);
  assert.equal(check('result = {1, 2}', {}, [1, 2]).errorType, 'ResultType');
  assert.equal(check('result = 2**53 + 1', {}, 1).actual, '9007199254740993 (integer)');
  assert.equal(check('result = 10**400', {}, 1).actual.endsWith(' (integer)'), true);
});

test('each call receives new globals and input objects', () => {
  assert.equal(check('values.append(9)\nresult = len(values)', { values: [1] }, 2).passed, true);
  assert.equal(check('result = len(values)', { values: [1] }, 1).passed, true);
  assert.equal(check('result = old_value', {}, 1).errorType, 'NameError');
});

test('unusual incorrect results remain valid backup data', () => {
  for (const code of [
    'result = 1\nfor position in range(30):\n    result = [result]',
    'result = {"__proto__": 1, "constructor": 2}',
    'result = ["x" * 8000] * 1000',
    `result = ${'1'.repeat(22000)}!`,
  ]) {
    const result = check(code, {}, 1);
    const progress = emptyProgress();
    progress.records.example = newRecord(code);
    recordRun(progress.records.example, { status: 'failed', results: [{ name: 'Example', input: {}, expected: 1, ...result }] }, code);
    assert.doesNotThrow(() => validateProgress(JSON.parse(JSON.stringify(progress)), [{ id: 'example' }], []));
  }
});

// These exercise the runner lifecycle, not Pyodide or a real browser.
test('runner allocates and terminates a separate worker for every test', async () => {
  const original = globalThis.Worker;
  const instances = [];
  globalThis.Worker = class {
    constructor() { instances.push(this); }
    postMessage() {
      queueMicrotask(() => {
        this.onmessage({ data: { type: 'ready' } });
        this.onmessage({ data: { type: 'result', result: { actual: 1, passed: true, stdout: '', error: null, errorType: null } } });
      });
    }
    terminate() { this.terminated = true; }
  };
  try {
    const result = await createRunner().run({ tests: [1, 2].map(number => ({ name: `Case ${number}`, input: {}, expected: 1 })) }, 'result = 1');
    assert.equal(result.status, 'passed');
    assert.equal(instances.length, 2);
    assert.equal(instances.every(worker => worker.terminated), true);
  } finally {
    globalThis.Worker = original;
  }
});

test('runner cancellation stops the worker and the next run can pass', async () => {
  const original = globalThis.Worker;
  let current;
  globalThis.Worker = class {
    constructor() { current = this; }
    postMessage(data) {
      queueMicrotask(() => {
        this.onmessage({ data: { type: 'ready' } });
        if (data.code === 'result = 1') this.onmessage({ data: { type: 'result', result: { actual: 1, passed: true, stdout: '', error: null, errorType: null } } });
      });
    }
    terminate() { this.terminated = true; }
  };
  try {
    const runner = createRunner();
    const exercise = { tests: [{ name: 'One case', input: {}, expected: 1 }] };
    const pending = runner.run(exercise, 'while True: pass');
    await Promise.resolve();
    runner.cancel();
    assert.equal((await pending).status, 'cancelled');
    assert.equal(current.terminated, true);
    assert.equal((await runner.run(exercise, 'result = 1')).status, 'passed');
  } finally {
    globalThis.Worker = original;
  }
});

test('runner execution deadline terminates a nonresponding worker', async () => {
  const original = globalThis.Worker;
  let current;
  globalThis.Worker = class {
    constructor() { current = this; }
    postMessage() { queueMicrotask(() => this.onmessage({ data: { type: 'ready' } })); }
    terminate() { this.terminated = true; }
  };
  try {
    const result = await createRunner().run({ tests: [{ name: 'Never finishes', input: {}, expected: 1 }] }, 'while True: pass');
    assert.equal(result.status, 'timeout');
    assert.equal(result.results[0].errorType, 'Timeout');
    assert.equal(current.terminated, true);
  } finally {
    globalThis.Worker = original;
  }
});
