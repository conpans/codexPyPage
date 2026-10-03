import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { exercises } from '../src/content.js';

const checkerPath = fileURLToPath(new URL('../public/checker.py', import.meta.url));

// These differ from the prepared while-loop solutions and retain the same
// contracts. Only authored test fixtures execute in this native-Python test.
// Learner code uses the browser worker. This does not verify Pyodide itself.
const alternatives = {
  'copy-list': 'result = values[:]\nprint(f"copied {len(values)} values")\n',
  'repeat-list': 'result = values + values\n',
  'running-totals': 'from itertools import accumulate\nresult = list(accumulate(values))\n',
  'count-matches': 'result = sum(1 for value in values if value < limit)\n',
  'range-filter': 'result = [value for value in values if lower <= value <= upper]\n',
  'greatest-value': 'result = max(values)\n',
};

const driver = String.raw`
import json
import runpy
import sys

# Load the deployed checker file itself; no copy of its implementation lives in
# this fixture. The independent semantic oracles live in content.test.mjs.
check_attempt = runpy.run_path(sys.argv[1])['check_attempt']
request = json.load(sys.stdin)
failures = []
reference_tests = 0
reference_examples = 0
alternative_tests = 0
stdout_cases = 0

def run_case(entry, case, code, label, expected_stdout=''):
    response = json.loads(check_attempt(
        code,
        json.dumps(case['input']),
        json.dumps(case['expected']),
        entry['resultVariable'],
        json.dumps(entry.get('checks', {})),
    ))
    assert response['passed'] is True, f"{label}: {response!r}"
    assert response['error'] is None and response['errorType'] is None, f"{label}: {response!r}"
    assert response['stdout'] == expected_stdout, f"{label}: stdout {response['stdout']!r}"
    return response

for entry in request['exercises']:
    for category in ['tests', 'examples']:
        for index, case in enumerate(entry[category]):
            label = f"{entry['id']} reference {category}[{index}]"
            try:
                run_case(entry, case, entry['solution'], label)
            except Exception as error:
                failures.append(f'{label}: {type(error).__name__}: {error}')
            if category == 'tests':
                reference_tests += 1
            else:
                reference_examples += 1
    alternative = request['alternatives'].get(entry['id'])
    if alternative:
        for index, case in enumerate(entry['tests']):
            label = f"{entry['id']} alternative tests[{index}]"
            expected_stdout = ''
            if entry['id'] == 'copy-list':
                expected_stdout = f"copied {len(case['input']['values'])} values\n"
                stdout_cases += 1
            try:
                run_case(entry, case, alternative, label, expected_stdout)
            except Exception as error:
                failures.append(f'{label}: {type(error).__name__}: {error}')
            alternative_tests += 1

# Reuse this exact function in the same interpreter to expose leaked globals.
# Native tests that start a separate process per check cannot prove this case.
first = json.loads(check_attempt('saved = 41\nresult = saved', '{}', '41'))
second = json.loads(check_attempt('result = saved', '{}', '41'))
if first['passed'] is not True or second['errorType'] != 'NameError':
    failures.append(f'Fresh namespace across calls: {first!r}; {second!r}')

print(json.dumps({
    'referenceTests': reference_tests,
    'referenceExamples': reference_examples,
    'alternativeTests': alternative_tests,
    'alternativeChallenges': len(request['alternatives']),
    'stdoutCases': stdout_cases,
    'freshnessCalls': 2,
    'failures': failures,
}))
`;

function auditWithProductionChecker() {
  return new Promise((resolve, reject) => {
    const child = spawn('python3', ['-I', '-c', driver, checkerPath], { timeout: 15000 });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.stdin.on('error', reject);
    child.on('close', (status) => {
      try {
        assert.equal(status, 0, stderr || `Native Python exited with status ${status}`);
        resolve(JSON.parse(stdout));
      } catch (error) {
        reject(error);
      }
    });
    child.stdin.end(JSON.stringify({ exercises, alternatives }));
  });
}

test('native production checker accepts the expanded catalog and the six established alternate algorithms', async () => {
  const report = await auditWithProductionChecker();
  assert.deepEqual(report.failures, []);
  assert.equal(report.referenceTests, exercises.reduce((n,e)=>n+e.tests.length,0));
  assert.equal(report.referenceExamples, exercises.reduce((n,e)=>n+e.examples.length,0));
  assert.equal(report.alternativeTests, 34);
  assert.equal(report.alternativeChallenges, 6);
  assert.equal(report.stdoutCases, 4);
  assert.equal(report.freshnessCalls, 2);
});
