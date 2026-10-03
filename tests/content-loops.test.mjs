import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { loopExercises, loopSkills } from '../src/content-loops.js';

test('row, pair, remainder, and streak content has complete preparation and transfer', () => {
  const entries = Object.fromEntries(loopExercises.map(entry => [entry.id, entry]));
  assert.equal(loopExercises.length, 12);
  assert.equal(new Set(loopExercises.map(entry => entry.id)).size, 12);
  assert.equal(loopExercises.filter(entry => entry.kind === 'skill').length, 4);
  assert.equal(loopExercises.filter(entry => entry.kind === 'challenge').length, 4);
  assert.equal(loopExercises.filter(entry => entry.kind === 'variation').length, 4);
  assert.equal(loopSkills.length, 1);
  assert.equal(loopSkills[0].id, 'nested-loops');
  for (const id of loopSkills[0].exerciseIds) {
    assert.equal(entries[id].kind, 'skill');
    assert.ok(entries[id].skillIds.includes('nested-loops'));
  }
  for (const id of loopSkills[0].challengeIds) assert.equal(entries[id].kind, 'challenge');
  for (const entry of loopExercises) {
    for (const field of ['id', 'title', 'goal', 'inputs', 'boundaries', 'instructions', 'starter', 'explanation', 'solution']) {
      assert.ok(typeof entry[field] === 'string' && entry[field].length > 0, `${entry.id}: ${field}`);
    }
    assert.ok(entry.tests.length >= 4, entry.id);
    assert.ok(entry.examples.length >= 1, entry.id);
    assert.ok(entry.hints.length >= 3, entry.id);
    assert.equal(entry.resultVariable, 'result');
    if (entry.kind === 'challenge') {
      assert.ok(entry.newIdea);
      assert.ok(['Combine skills', 'Next stretch'].includes(entry.stage));
      assert.match(entry.source.label, /LeetCode Easy adaptation/);
      assert.ok(entry.source.url.startsWith('https://leetcode.com/problems/'));
      assert.match(entry.instructions, /plain script/);
      assert.match(entry.instructions, /function/);
      assert.equal(entries[entry.followup].kind, 'variation');
      assert.ok(entries[entry.followup].prerequisites.includes(entry.id));
    } else {
      assert.equal(entry.source.label, 'Original practice');
      assert.equal(entry.source.url, undefined);
    }
  }
  assert.ok(entries['divisible-difference'].prerequisites.includes('remainder-check'));
  assert.ok(entries['good-pairs'].prerequisites.includes('visit-index-pairs'));
  assert.ok(entries['richest-customer'].prerequisites.includes('row-totals'));
  assert.match(entries['consecutive-ones'].source.note, /100,000/);
  assert.match(entries['consecutive-ones'].source.note, /1,000/);
});

const checker = readFileSync(new URL('../public/checker.py', import.meta.url), 'utf8');
const audit = String.raw`
import itertools
import sys
from collections import Counter

entries = json.load(sys.stdin)
catalog = {entry['id']: entry for entry in entries}
checked = 0
failures = []

def block_lengths(values):
    return [len(list(group)) for value, group in itertools.groupby(values) if value == 1]

def oracle(identifier, data):
    values = data.get('values', [])
    if identifier == 'remainder-check':
        return data['number'] in range(data['divisor'], data['number'] + 1, data['divisor'])
    if identifier == 'read-nested-item':
        return next(value for row, items in enumerate(data['rows']) for position, value in enumerate(items)
                    if row == data['row_position'] and position == data['item_position'])
    if identifier == 'row-totals':
        return list(map(sum, data['rows']))
    if identifier == 'visit-index-pairs':
        return [list(pair) for pair in itertools.combinations(range(data['size']), 2)]
    if identifier == 'consecutive-ones':
        return max(block_lengths(values), default=0)
    if identifier == 'one-run-lengths':
        return block_lengths(values)
    if identifier == 'divisible-difference':
        numbers = range(1, data['n'] + 1)
        multiples = range(data['m'], data['n'] + 1, data['m'])
        return sum(numbers) - 2 * sum(multiples)
    if identifier == 'divisible-buckets':
        multiples = list(range(data['m'], data['n'] + 1, data['m']))
        return [[number for number in range(1, data['n'] + 1) if number not in multiples], multiples]
    if identifier == 'good-pairs':
        return sum(count * (count - 1) // 2 for count in Counter(values).values())
    if identifier == 'good-pair-positions':
        return [list(pair) for pair in itertools.combinations(range(len(values)), 2)
                if len({values[pair[0]], values[pair[1]]}) == 1]
    if identifier == 'richest-customer':
        return sorted(map(sum, data['accounts']))[-1]
    if identifier == 'wealthy-positions':
        totals = list(map(sum, data['accounts']))
        return [position for position, total in enumerate(totals) if total == max(totals)]
    raise AssertionError(f'No oracle for {identifier}')

alternatives = {
    'remainder-check': 'result = number % divisor == 0',
    'read-nested-item': 'result = rows[row_position][item_position]',
    'row-totals': 'result = [sum(row) for row in rows]',
    'visit-index-pairs': 'result = [[left, right] for left in range(size) for right in range(left + 1, size)]',
    'consecutive-ones': 'result = max([len(block) for block in "".join(str(value) for value in values).split("0")])',
    'one-run-lengths': 'result = [len(block) for block in "".join(str(value) for value in values).split("0") if block]',
    'divisible-difference': 'result = sum(number if number % m else -number for number in range(1, n + 1))',
    'divisible-buckets': 'result = [[number for number in range(1, n + 1) if number % m], [number for number in range(1, n + 1) if not number % m]]',
    'good-pairs': 'result = sum(values[left] == values[right] for left in range(len(values)) for right in range(left + 1, len(values)))',
    'good-pair-positions': 'result = [[left, right] for left in range(len(values)) for right in range(left + 1, len(values)) if values[left] == values[right]]',
    'richest-customer': 'result = max(sum(row) for row in accounts)',
    'wealthy-positions': 'totals = [sum(row) for row in accounts]\nresult = [position for position, total in enumerate(totals) if total == max(totals)]',
}

def run(code, data, expected):
    return json.loads(check_attempt(code, json.dumps(data), json.dumps(expected)))

def verify(entry, data, expected, label):
    global checked
    assert same_value(oracle(entry['id'], data), expected), f'{label}: independent oracle disagrees'
    for approach, code in [('reference', entry['solution']), ('alternative', alternatives[entry['id']])]:
        outcome = run(code, data, expected)
        checked += 1
        assert outcome['passed'], f'{label}: {approach} failed: {outcome}'

for entry in entries:
    for category in ['tests', 'examples']:
        for index, case in enumerate(entry[category]):
            label = f"{entry['id']}/{category}/{index}"
            try:
                verify(entry, case['input'], case['expected'], label)
            except Exception as error:
                failures.append(f'{label}: {error}')

# Exhaustive short binary lists expose reset/end-of-input mistakes; small
# repeated-value lists expose self-pairs, reverse-pairs, and duplicate groups.
for length in range(1, 7):
    for values in itertools.product([0, 1], repeat=length):
        for identifier in ['consecutive-ones', 'one-run-lengths']:
            data = {'values': list(values)}
            try:
                verify(catalog[identifier], data, oracle(identifier, data), f'{identifier}/{values}')
            except Exception as error:
                failures.append(str(error))
for length in range(1, 6):
    for values in itertools.product([1, 2, 3], repeat=length):
        for identifier in ['good-pairs', 'good-pair-positions']:
            data = {'values': list(values)}
            try:
                verify(catalog[identifier], data, oracle(identifier, data), f'{identifier}/{values}')
            except Exception as error:
                failures.append(str(error))
for n in range(1, 16):
    for m in range(1, 16):
        for identifier in ['divisible-difference', 'divisible-buckets']:
            data = {'n': n, 'm': m}
            try:
                verify(catalog[identifier], data, oracle(identifier, data), f'{identifier}/{n}/{m}')
            except Exception as error:
                failures.append(str(error))

# Concrete incorrect programs must fail on the public tests shown to learners.
wrong = [
    ('remainder-check', 'result = number % divisor', 'integer remainder instead of Boolean'),
    ('read-nested-item', 'result = rows[row_position]', 'whole row instead of value'),
    ('row-totals', catalog['row-totals']['starter'], 'row total never resets'),
    ('visit-index-pairs', catalog['visit-index-pairs']['solution'].replace('right = left + 1', 'right = 0'), 'self and reverse pairs'),
    ('consecutive-ones', 'result = sum(values)', 'total count instead of consecutive run'),
    ('consecutive-ones', catalog['consecutive-ones']['solution'].replace('current_run = 0\n    if', 'current_run = current_run\n    if'), 'run never resets'),
    ('one-run-lengths', catalog['one-run-lengths']['solution'].rsplit('if current_run > 0:', 1)[0], 'final block never recorded'),
    ('divisible-difference', catalog['divisible-difference']['solution'].replace('number <= n', 'number < n'), 'last number omitted'),
    ('divisible-difference', catalog['divisible-difference']['solution'].replace('non_divisible_total - divisible_total', 'divisible_total - non_divisible_total'), 'subtraction reversed'),
    ('divisible-buckets', catalog['divisible-buckets']['solution'].replace('divisible.append(number)', 'number.append(divisible)'), 'wrong receiving object for append'),
    ('good-pairs', catalog['good-pairs']['solution'].replace('right = left + 1', 'right = left'), 'self pairs counted'),
    ('good-pairs', catalog['good-pairs']['solution'].replace('count = count + 1', 'count = 1'), 'count replaced instead of accumulated'),
    ('good-pair-positions', catalog['good-pair-positions']['solution'].replace('[left, right]', '[values[left], values[right]]'), 'values instead of positions'),
    ('richest-customer', catalog['richest-customer']['solution'].replace('greatest = 0', 'greatest = 0\ntotal = 0').replace('    total = 0\n', ''), 'total carries across rows'),
    ('richest-customer', catalog['richest-customer']['solution'].replace('item_position < len(current_row)', 'item_position <= len(current_row)'), 'inner off-by-one'),
    ('wealthy-positions', 'totals = [sum(row) for row in accounts]\nresult = [totals.index(max(totals))]', 'ties discarded'),
]
for identifier, code, description in wrong:
    outcomes = [run(code, case['input'], case['expected']) for case in catalog[identifier]['tests']]
    assert any(not outcome['passed'] for outcome in outcomes), f'{identifier}: tests accepted {description}'
    if description == 'wrong receiving object for append':
        assert any(outcome['errorType'] == 'AttributeError' for outcome in outcomes)
    if description == 'inner off-by-one':
        assert any(outcome['errorType'] == 'IndexError' for outcome in outcomes)

print(json.dumps({'checked': checked, 'wrongPrograms': len(wrong), 'failures': failures}))
`;

test('all loop examples, references, alternatives, and boundary cases pass the actual checker', async () => {
  const run = await new Promise((resolve, reject) => {
    const child = spawn('python3', ['-I', '-c', `${checker}\n${audit}`], { timeout: 20000 });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', reject);
    child.stdin.on('error', reject);
    child.on('close', status => resolve({ status, stdout, stderr }));
    child.stdin.end(JSON.stringify(loopExercises));
  });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  const result = JSON.parse(run.stdout);
  assert.deepEqual(result.failures, []);
  assert.ok(result.checked > 3000, result.checked);
  assert.equal(result.wrongPrograms, 16);
});
