import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { arrayExercises } from '../src/content-arrays.js';

const checkerPath = fileURLToPath(new URL('../public/checker.py', import.meta.url));
const alternatives = {
  'final-operations': 'result = sum(1 if "+" in operation else -1 for operation in operations)\n',
  'operation-history': 'from itertools import accumulate\nresult = list(accumulate(1 if "+" in operation else -1 for operation in operations))\n',
  'candy-flags': 'result = [amount + extra >= max(candies) for amount in candies]\n',
  'candy-shortfall': 'result = [max(candies) - amount for amount in candies]\n',
  'shuffle-halves': 'result = []\nfor first, second in zip(values[:n], values[n:]):\n    result.extend([first, second])\n',
  'unshuffle-halves': 'result = values[::2] + values[1::2]\n',
  'follow-permutation': 'result = [values[value] for value in values]\n',
  'permutation-three-hops': 'result = [values[values[value]] for value in values]\n',
};

// Incorrect authored programs are checked in native Python. Learner code stays
// in browser workers; this file never creates a native execution endpoint.
const incorrect = [
  { id: 'final-operations', reason: 'Bare nonempty string makes or always true', code: 'value = 0\nfor operation in operations:\n    if operation == "++X" or "X++":\n        value = value + 1\n    else:\n        value = value - 1\nresult = value\n' },
  { id: 'final-operations', reason: 'Replacement loses the accumulated value', code: 'result = 0\nfor operation in operations:\n    result = 1 if "+" in operation else -1\n', caseIndex: 5 },
  { id: 'operation-history', reason: 'Records before applying the operation', code: 'result = []\nvalue = 0\nfor operation in operations:\n    result.append(value)\n    value = value + (1 if "+" in operation else -1)\n' },
  { id: 'candy-flags', reason: 'Strict comparison excludes ties', code: 'result = [amount + extra > max(candies) for amount in candies]\n' },
  { id: 'candy-flags', reason: 'Filtering loses False answers', code: 'result = [True for amount in candies if amount + extra >= max(candies)]\n' },
  { id: 'candy-flags', reason: 'Saving the return of append destroys the receiving list', code: 'result = []\nfor amount in candies:\n    result = result.append(amount + extra >= max(candies))\n', errorType: 'AttributeError' },
  { id: 'candy-shortfall', reason: 'Boolean answers do not describe a shortfall', code: 'result = [amount == max(candies) for amount in candies]\n' },
  { id: 'offset-position', reason: 'Adding to the value differs from adding to the position', code: 'result = values[position] + n\n' },
  { id: 'shuffle-halves', reason: 'Full-length loop overruns the second half', code: 'result = []\nposition = 0\nwhile position < len(values):\n    result.append(values[position])\n    result.append(values[position + n])\n    position = position + 1\n', errorType: 'IndexError' },
  { id: 'shuffle-halves', reason: 'Inclusive half-length boundary overruns', code: 'result = []\nposition = 0\nwhile position <= n:\n    result.append(values[position])\n    result.append(values[position + n])\n    position = position + 1\n', errorType: 'IndexError' },
  { id: 'unshuffle-halves', reason: 'Odd and even values are not odd and even positions', code: 'result = [value for value in values if value % 2 == 0] + [value for value in values if value % 2 != 0]\n' },
  { id: 'follow-stored-index', reason: 'One read omits the second destination', code: 'result = values[start]\n' },
  { id: 'follow-permutation', reason: 'A copy performs only one read', code: 'result = values[:]\n' },
  { id: 'follow-permutation', reason: 'Mutating input changes later reads and violates the contract', code: 'for position in range(len(values)):\n    values[position] = values[values[position]]\nresult = values\n', errorType: 'Contract' },
  { id: 'follow-permutation', reason: 'Correct identity output still must be a separate list', code: 'result = values\n', caseIndex: 2, errorType: 'Contract' },
  { id: 'permutation-three-hops', reason: 'Two reads do not provide the third destination', code: 'result = [values[value] for value in values]\n' },
  { id: 'compare-and-append', reason: 'Integer 1/0 output differs from requested Booleans', code: 'result = [int(value + extra >= target) for value in values]\n' },
];

const audit = String.raw`
import copy
import itertools
import json
import runpy
import sys

checker = runpy.run_path(sys.argv[1])
check_attempt = checker['check_attempt']
same_value = checker['same_value']
request = json.load(sys.stdin)
catalog = {entry['id']: entry for entry in request['catalog']}
report = {'references': 0, 'examples': 0, 'alternatives': 0, 'incorrect': 0, 'failures': []}

def inverse_route(values, reads):
    # Derive each starting position backwards from a destination. This is
    # independent of the forward reads used by the worked solutions.
    previous = {value: position for position, value in enumerate(values)}
    output = [None] * len(values)
    for destination in range(len(values)):
        start = destination
        for _ in range(reads):
            start = previous[start]
        output[start] = destination
    return output

def oracle(identifier, data):
    values = data.get('values', [])
    if identifier == 'compare-and-append':
        return [data['target'] - value <= data['extra'] for value in values]
    if identifier == 'offset-position':
        return values[data['n']:][data['position']]
    if identifier == 'follow-stored-index':
        target = next(value for position, value in enumerate(values) if position == data['start'])
        return next(value for position, value in enumerate(values) if position == target)
    if identifier in ('final-operations', 'operation-history'):
        steps = [{'++X': 1, 'X++': 1, '--X': -1, 'X--': -1}[operation] for operation in data['operations']]
        if identifier == 'final-operations':
            return sum(steps)
        return [sum(steps[:end]) for end in range(1, len(steps) + 1)]
    if identifier == 'candy-flags':
        # Each hypothetical recipient must reach every original child's amount.
        return [all(amount + data['extra'] >= other for other in data['candies']) for amount in data['candies']]
    if identifier == 'candy-shortfall':
        return [sorted(data['candies'])[-1] - amount for amount in data['candies']]
    if identifier == 'shuffle-halves':
        return list(itertools.chain.from_iterable(zip(values[:data['n']], values[data['n']:])))
    if identifier == 'unshuffle-halves':
        return [value for _, value in sorted(enumerate(values), key=lambda pair: (pair[0] % 2, pair[0]))]
    if identifier == 'follow-permutation':
        return inverse_route(values, 2)
    if identifier == 'permutation-three-hops':
        return inverse_route(values, 3)
    raise AssertionError(f'Missing oracle: {identifier}')

def validate_domain(identifier, data):
    if identifier in ('final-operations', 'operation-history'):
        operations = data['operations']
        assert (1 if identifier == 'final-operations' else 0) <= len(operations) <= 100
        assert set(operations) <= {'++X', 'X++', '--X', 'X--'}
    elif identifier in ('candy-flags', 'candy-shortfall'):
        assert (2 if identifier == 'candy-flags' else 1) <= len(data['candies']) <= 100
        assert all(1 <= amount <= 100 for amount in data['candies'])
        if identifier == 'candy-flags':
            assert 1 <= data['extra'] <= 50
    elif identifier in ('shuffle-halves', 'unshuffle-halves'):
        assert 1 <= data['n'] <= 500 and len(data['values']) == 2 * data['n']
        assert all(1 <= value <= 1000 for value in data['values'])
    elif identifier in ('follow-permutation', 'permutation-three-hops'):
        assert 1 <= len(data['values']) <= 1000
        assert sorted(data['values']) == list(range(len(data['values'])))
    elif identifier == 'compare-and-append':
        assert 0 <= len(data['values']) <= 5
        assert all(0 <= value <= 20 for value in data['values'])
        assert 0 <= data['extra'] <= 10 and 0 <= data['target'] <= 30
    elif identifier == 'offset-position':
        assert 1 <= data['n'] <= 5 and len(data['values']) == 2 * data['n']
        assert all(-20 <= value <= 20 for value in data['values'])
        assert 0 <= data['position'] < data['n']
    elif identifier == 'follow-stored-index':
        assert 1 <= len(data['values']) <= 10
        assert all(0 <= value < len(data['values']) for value in data['values'])
        assert 0 <= data['start'] < len(data['values'])
    else:
        raise AssertionError(f'Missing domain validation: {identifier}')

def check(entry, case, code):
    return json.loads(check_attempt(code, json.dumps(case['input']), json.dumps(case['expected']), entry['resultVariable'], json.dumps(entry.get('checks', {}))))

for identifier, entry in catalog.items():
    for category in ('tests', 'examples'):
        for index, case in enumerate(entry[category]):
            label = f'{identifier} {category}[{index}]'
            try:
                validate_domain(identifier, case['input'])
                independent = oracle(identifier, copy.deepcopy(case['input']))
                assert same_value(independent, case['expected']), f'oracle {independent!r} differs from authored expected {case["expected"]!r}'
                response = check(entry, case, entry['solution'])
                assert response['passed'] is True and response['error'] is None, response
                report['references' if category == 'tests' else 'examples'] += 1
                alternative = request['alternatives'].get(identifier)
                if alternative and category == 'tests':
                    response = check(entry, case, alternative)
                    assert response['passed'] is True and response['error'] is None, response
                    report['alternatives'] += 1
            except Exception as error:
                report['failures'].append(f'{label}: {type(error).__name__}: {error}')

for fixture in request['incorrect']:
    try:
        entry = catalog[fixture['id']]
        case = entry['tests'][fixture.get('caseIndex', 0)]
        response = check(entry, case, fixture['code'])
        assert response['passed'] is False, response
        if 'errorType' in fixture:
            assert response['errorType'] == fixture['errorType'], response
        report['incorrect'] += 1
    except Exception as error:
        report['failures'].append(f'{fixture["id"]}: {fixture["reason"]}: {type(error).__name__}: {error}')

# Validate the specific routes and grouping claims used in explanations.
assert inverse_route([2, 0, 3, 1], 2) == [3, 2, 1, 0]
assert inverse_route([2, 0, 3, 1], 3) == [1, 3, 0, 2]
assert inverse_route([1, 2, 0], 3) == [0, 1, 2]
assert [(position, position + 3) for position in range(3)] == [(0, 3), (1, 4), (2, 5)]
assert [4 >= 4, 7 >= 4, 3 >= 4] == [True, True, False]
assert sum([1, -1]) == 0
print(json.dumps(report))
`;

function runAudit() {
  return new Promise((resolve, reject) => {
    const child = spawn('python3', ['-I', '-c', audit, checkerPath], { timeout: 15000 });
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
        assert.equal(status, 0, stderr || stdout);
        resolve(JSON.parse(stdout));
      } catch (error) { reject(error); }
    });
    child.stdin.end(JSON.stringify({ catalog: arrayExercises, alternatives, incorrect }));
  });
}

test('array expansion includes four attributed challenges, four transfers, and three focused prerequisites', () => {
  assert.equal(arrayExercises.length, 11);
  assert.equal(arrayExercises.filter((entry) => entry.kind === 'skill').length, 3);
  assert.equal(arrayExercises.filter((entry) => entry.kind === 'variation').length, 4);
  const challenges = arrayExercises.filter((entry) => entry.kind === 'challenge');
  assert.equal(challenges.length, 4);
  for (const entry of challenges) {
    assert.ok(entry.newIdea);
    assert.ok(['Start here', 'Combine skills', 'Next stretch'].includes(entry.stage));
    assert.match(entry.source.url, /^https:\/\/leetcode\.com\/problems\/[a-z-]+\/$/);
    assert.match(entry.source.label, /adaptation/);
    assert.match(entry.source.note, /Easy/);
    assert.match(entry.instructions, /function/);
    const followup = arrayExercises.find((candidate) => candidate.id === entry.followup);
    assert.equal(followup.kind, 'variation');
    assert.ok(followup.prerequisites.includes(entry.id));
    assert.equal(followup.source.url, undefined);
  }
});

test('array examples, domains, and references agree with independent Python oracles through the production checker', async () => {
  const report = await runAudit();
  assert.deepEqual(report.failures, []);
  assert.equal(report.references, arrayExercises.reduce((total, entry) => total + entry.tests.length, 0));
  assert.equal(report.examples, arrayExercises.reduce((total, entry) => total + entry.examples.length, 0));
  assert.equal(report.alternatives, arrayExercises.filter((entry) => alternatives[entry.id]).reduce((total, entry) => total + entry.tests.length, 0));
  assert.equal(report.incorrect, incorrect.length);
});
