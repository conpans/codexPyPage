const LOAD_LIMIT_MS = 30000;
const EXECUTION_LIMIT_MS = 2000;
const CODE_LIMIT = 50000;

function terminalResult(test, errorType, error) {
  return { ...test, actual: null, passed: false, stdout: '', errorType, error };
}

export function createRunner() {
  let active = null;

  function cancel() {
    if (active) {
      active.cancelled = true;
      active.stop?.();
    }
  }

  function runTest(session, exercise, code, test, onProgress, number) {
    return new Promise(resolve => {
      let worker;
      let timer;
      let settled = false;
      function finish(result) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        worker?.terminate();
        session.stop = null;
        resolve(result);
      }
      session.stop = () => finish(terminalResult(test, 'Cancelled', 'Stopped. Your code is saved; edit it and try again.'));
      try {
        worker = new Worker('/public/python-worker.js', { type: 'module' });
        onProgress?.(`Preparing Python for test ${number} of ${exercise.tests.length}…`);
        timer = setTimeout(() => finish(terminalResult(test, 'RuntimeLoad', 'Python took too long to start. Keep the local app server running, then try again.')), LOAD_LIMIT_MS);
        worker.onmessage = ({ data }) => {
          if (settled) return;
          if (data.type === 'ready') {
            clearTimeout(timer);
            onProgress?.(`Checking test ${number} of ${exercise.tests.length}: ${test.name}`);
            timer = setTimeout(() => finish(terminalResult(test, 'Timeout', 'Stopped after 2 seconds. Check that each loop moves toward its stopping condition.')), EXECUTION_LIMIT_MS);
          } else if (data.type === 'result') {
            finish({ ...test, ...data.result });
          } else if (data.type === 'error') {
            finish(terminalResult(test, 'RuntimeError', data.message));
          }
        };
        worker.onerror = event => {
          event.preventDefault();
          finish(terminalResult(test, 'RuntimeError', `Python could not start. Complete the one-time npm install setup, keep the local server running, then reload. ${event.message || 'The locally installed runtime files are required.'}`));
        };
        worker.postMessage({ code, input: test.input, expected: test.expected, resultVariable: exercise.resultVariable || 'result', checks: exercise.checks });
      } catch (error) {
        finish(terminalResult(test, 'RuntimeError', error.message));
      }
    });
  }

  async function run(exercise, code, onProgress) {
    cancel();
    const session = { cancelled: false, stop: null };
    active = session;
    if (typeof code !== 'string' || code.length > CODE_LIMIT) {
      active = null;
      return { status: 'error', results: [], message: 'Keep this short practice program under 50,000 characters.' };
    }
    if (!exercise?.tests?.length) {
      active = null;
      return { status: 'error', results: [], message: 'This exercise has no checks.' };
    }
    const results = [];
    for (const [index, test] of exercise.tests.entries()) {
      if (session.cancelled) break;
      const result = await runTest(session, exercise, code, test, onProgress, index + 1);
      results.push(result);
      // Show all ordinary mismatches; a crash/timeout is more useful to fix first.
      if (result.errorType && !['ResultType', 'Contract'].includes(result.errorType)) break;
    }
    if (active === session) active = null;
    let status = 'failed';
    if (session.cancelled) status = 'cancelled';
    else if (results.some(result => result.errorType === 'Timeout')) status = 'timeout';
    else if (results.some(result => result.errorType && !['ResultType', 'Contract'].includes(result.errorType))) status = 'error';
    else if (results.length === exercise.tests.length && results.every(result => result.passed)) status = 'passed';
    return { status, results };
  }

  return { run, cancel };
}
