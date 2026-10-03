import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { test } from 'node:test';
import { exercises, skills, exerciseById, skillById, foundationExercises } from '../src/content.js';

test('expanded catalog has seven populated units, 14 challenges and a transfer per challenge', () => {
  assert.equal(skills.length, 7);
  assert.equal(exercises.filter((entry) => entry.kind === 'skill').length, 25);
  assert.equal(exercises.filter((entry) => entry.kind === 'challenge').length, 14);
  assert.equal(exercises.filter((entry) => entry.kind === 'variation').length, 14);
  assert.equal(new Set(exercises.map((entry) => entry.id)).size, exercises.length);
  assert.equal(new Set(skills.map((entry) => entry.id)).size, skills.length);
  for (const skill of skills) {
    assert.ok(skill.title && skill.summary && skill.explanation, skill.id);
    assert.ok(skill.exerciseIds.length >= 3, skill.id);
    assert.ok(skill.challengeIds.length >= 1, skill.id);
    for (const id of skill.exerciseIds) {
      assert.equal(exerciseById[id]?.kind, 'skill', `${skill.id} -> ${id}`);
      assert.ok(exerciseById[id].skillIds.includes(skill.id));
    }
    for (const id of skill.challengeIds) {
      assert.equal(exerciseById[id]?.kind, 'challenge', `${skill.id} -> ${id}`);
      assert.ok(exerciseById[id].skillIds.includes(skill.id));
    }
  }
  for (const entry of exercises) {
    for (const key of ['id', 'title', 'goal', 'inputs', 'boundaries', 'instructions', 'starter', 'explanation', 'solution']) {
      assert.equal(typeof entry[key], 'string', `${entry.id}.${key}`);
      assert.ok(entry[key].trim().length, `${entry.id}.${key}`);
    }
    assert.equal(entry.resultVariable, 'result');
    assert.ok(['Predict', 'Complete', 'Repair', 'Write'].includes(entry.format));
    assert.ok(['Foundation', 'Connecting ideas', 'Stretch'].includes(entry.difficulty));
    assert.ok(Number.isInteger(entry.minutes) && entry.minutes > 0);
    assert.ok(entry.hints.length >= 3);
    assert.ok(entry.examples.length >= 1);
    assert.ok(entry.tests.length >= 1);
    assert.ok(entry.source.label);
    for (const id of entry.skillIds) assert.ok(skillById[id], `${entry.id} -> skill ${id}`);
    for (const id of [...entry.prerequisites, ...entry.related]) {
      assert.ok(exerciseById[id], `${entry.id} -> exercise ${id}`);
      assert.notEqual(id, entry.id, 'A link should lead to a different exercise');
    }
    if (entry.kind === 'challenge') {
      assert.equal(exerciseById[entry.followup]?.kind, 'variation');
      assert.ok(exerciseById[entry.followup].prerequisites.includes(entry.id));
    }
    for (const caseEntry of entry.tests) {
      assert.ok(caseEntry.name);
      assert.equal(typeof caseEntry.input, 'object');
      assert.ok(Object.hasOwn(caseEntry, 'expected'));
    }
    if (entry.format !== 'Predict') assert.ok(entry.tests.length >= 3, entry.id);
  }
});

test('all ten LeetCode adaptations have specific official sources and explain the script interface', () => {
  const expected = {
    'repeat-list':'concatenation-of-array', 'running-totals':'running-sum-of-1d-array',
    'final-operations':'final-value-of-variable-after-performing-operations',
    'candy-flags':'kids-with-the-greatest-number-of-candies', 'shuffle-halves':'shuffle-the-array',
    'follow-permutation':'build-array-from-permutation', 'consecutive-ones':'max-consecutive-ones',
    'divisible-difference':'divisible-and-non-divisible-sums-difference',
    'good-pairs':'number-of-good-pairs', 'richest-customer':'richest-customer-wealth',
  };
  const linked = exercises.filter(entry => entry.source.url);
  assert.equal(linked.length, 10);
  assert.deepEqual(new Set(linked.map(e => e.id)), new Set(Object.keys(expected)));
  for (const entry of linked) {
    assert.equal(entry.kind, 'challenge');
    assert.equal(entry.source.url, `https://leetcode.com/problems/${expected[entry.id]}/`);
    assert.match(entry.source.label, /adaptation/i);
    assert.match(entry.instructions + entry.source.note, /function/);
    assert.match(entry.instructions, /result/);
  }
});

// This independent oracle uses Python's standard operations, comprehensions,
// and prefix properties rather than copying the reference while-loop algorithms.
// Both literal test expectations and examples must agree with the oracle before
// the reference code is considered. The browser tests exercise the real checker.
const pythonAudit = String.raw`
import copy
import json
import math
import sys

catalog = json.load(sys.stdin)
failures = []
case_count = 0

def expected_for(identifier, data):
    values = data.get('values', [])
    if identifier == 'saved-length':
        items = [8, 5]
        saved = len(items)
        items.append(3)
        return [saved, len(items)]
    if identifier == 'update-balance':
        return sum([data['starting_balance'], data['deposit']])
    if identifier == 'repair-replacement':
        return sum([data['price'], data['delivery'], -data['discount']])
    if identifier == 'read-position':
        return next(value for position, value in enumerate(values) if position == data['position'])
    if identifier == 'repair-last-index':
        return list(reversed(values))[0]
    if identifier == 'position-versus-value':
        items = [4, 1, 6]
        position = 1
        saved_value = items[position]
        position += 1
        return [position, saved_value]
    if identifier in ['repair-loop-boundary', 'repair-loop-step', 'copy-list']:
        return values.copy()
    if identifier == 'count-down':
        return list(range(data['start'], 0, -1))
    if identifier == 'branch-choice':
        score = 7
        thresholds = [(5, 'at least five'), (7, 'at least seven')]
        matching = [label for threshold, label in thresholds if score >= threshold]
        return [matching[0], matching[-1]]
    if identifier == 'not-without-change':
        ready = False
        opposite = not ready
        return [opposite, ready]
    if identifier == 'repair-range-condition':
        return data['value'] in range(data['lower'], data['upper'] + 1)
    if identifier == 'sum-readings':
        return sum(values)
    if identifier == 'repair-product':
        return math.prod(values)
    if identifier == 'count-positive':
        return len([value for value in values if value > 0])
    if identifier == 'append-one':
        return [data['value']]
    if identifier == 'repair-append':
        return [10] + [data['value']]
    if identifier == 'double-values':
        return [value + value for value in values]
    if identifier == 'repeat-list':
        return values * 2
    if identifier == 'running-totals':
        return [sum(values[:end]) for end in range(1, len(values) + 1)]
    if identifier == 'count-matches':
        return len(values) - len([value for value in values if value >= data['limit']])
    if identifier == 'range-filter':
        allowed = range(data['lower'], data['upper'] + 1)
        return [value for value in values if value in allowed]
    if identifier == 'greatest-value':
        return sorted(values)[-1]
    if identifier == 'copy-reversed':
        return values[::-1]
    if identifier == 'repeat-three':
        return [value for value in values for _ in range(3)]
    if identifier == 'remaining-totals':
        return [data['budget'] - sum(data['costs'][:end]) for end in range(1, len(data['costs']) + 1)]
    if identifier == 'count-streak':
        def trailing_failures(prefix):
            reversed_prefix = prefix[::-1]
            return reversed_prefix.index('pass') if 'pass' in prefix else len(prefix)
        return [trailing_failures(data['checks'][:end]) for end in range(1, len(data['checks']) + 1)]
    if identifier == 'range-positions':
        allowed = range(data['lower'], data['upper'] + 1)
        return [position for position, value in enumerate(values) if value in allowed]
    if identifier == 'greatest-positions':
        return [position for position, value in enumerate(values) if value == max(values)]
    raise AssertionError(f'Missing independent oracle for {identifier}')

def same(actual, expected):
    if type(actual) is not type(expected):
        return False
    if isinstance(expected, list):
        return len(actual) == len(expected) and all(same(a, e) for a, e in zip(actual, expected))
    return actual == expected

for entry in catalog:
    for category in ['tests', 'examples']:
        for index, case in enumerate(entry[category]):
            case_count += 1
            label = f"{entry['id']} {category}[{index}]"
            try:
                independent = expected_for(entry['id'], copy.deepcopy(case['input']))
                assert same(independent, case['expected']), f"oracle {independent!r} != expected {case['expected']!r}"
                namespace = copy.deepcopy(case['input'])
                originals = dict(namespace)
                snapshots = copy.deepcopy(namespace)
                exec(compile(entry['solution'], entry['id'], 'exec'), namespace)
                assert 'result' in namespace, 'Reference solution did not assign result'
                assert same(namespace['result'], case['expected']), f"reference {namespace['result']!r} != expected {case['expected']!r}"
                checks = entry.get('checks', {})
                if checks.get('distinctFrom'):
                    assert namespace['result'] is not originals[checks['distinctFrom']], 'Result aliases input'
                for name in checks.get('preserveInputs', []):
                    assert same(originals[name], snapshots[name]), f'Input {name} was mutated'
            except Exception as error:
                failures.append(f'{label}: {type(error).__name__}: {error}')

# Independent identities explain the visual and numerical examples, including
# assignment snapshots, strict forward boundaries, and neutral starting values.
assert list(enumerate([8, 3, 5])) == [(0, 8), (1, 3), (2, 5)]
assert len([8, 3, 5]) == 3 and [8, 3, 5][-1] == 5
assert sum([]) == 0 and math.prod([]) == 1
assert max([-8, -3, -6]) == -3
assert [sum([3, -1, 4][:end]) for end in [1, 2, 3]] == [3, 2, 6]
assert [10].append(3) is None
print(json.dumps({'cases': case_count, 'exercises': len(catalog), 'failures': failures}))
`;

test('all original expectations and examples retain their independent Python oracles', async () => {
  const run = await new Promise((resolve, reject) => {
    const child = spawn('python3', ['-c', pythonAudit], { timeout: 15000 });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.stdin.on('error', reject);
    child.on('close', (status) => resolve({ status, stdout, stderr }));
    child.stdin.end(JSON.stringify(foundationExercises));
  });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  const report = JSON.parse(run.stdout);
  assert.deepEqual(report.failures, []);
  assert.equal(report.exercises, 30);
  assert.ok(report.cases >= 150, `Expected broad case coverage, found ${report.cases}`);
});
