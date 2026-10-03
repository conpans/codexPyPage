import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  STORAGE_KEY, emptyProgress, newRecord, recordRun, updateAssistance,
  beginRevisit, status, validateProgress, importProgress, exportProgress, loadProgress,
  saveProgress, suggestions, getRecord,
} from '../src/progress.js';
import { helpContext } from '../src/help.js';
import { traceCode, traceStates, visualMarkup } from '../src/visual.js';

const exercises = [
  {
    id: 'copy-list', title: 'Copy a list', starter: 'result = []',
    followup: 'copy-reversed', related: ['positions-small'], resultVariable: 'result',
    goal: 'Build a separate list.', inputs: 'values: a nonempty list of integers.',
    boundaries: 'Keep values unchanged.', instructions: 'Write a script storing a new list in result.',
    hints: ['Use one position.', 'Read values[position].', 'Append to the receiving list.'],
    solution: 'SECRET REFERENCE SOLUTION', source: {label: 'Original exercise'},
  },
  {id: 'copy-reversed', title: 'Reverse a copy', starter: '', related: ['copy-list']},
  {id: 'positions-small', title: 'Read a position', starter: '', related: ['copy-list']},
  {id: 'conditions-small', title: 'Combine conditions', starter: '', related: ['copy-list']},
];
const skills = [
  {id: 'positions', title: 'Positions and values', exerciseIds: ['positions-small']},
  {id: 'conditions', title: 'Conditions', exerciseIds: ['conditions-small']},
];
const passing = () => ({status: 'passed', results: [
  {name: 'one item', input: {values: [7]}, expected: [7], actual: [7], passed: true, stdout: '', error: null, errorType: null},
]});
function memoryStorage() {
  const values = new Map();
  return {getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value))};
}
function savedAttempt() {
  const progress = emptyProgress();
  const record = getRecord(progress, exercises[0]);
  record.draft = 'result = list(values)';
  record.confusion = 'Does position contain a value?';
  record.hints = [0];
  record.prerequisites = ['positions-small'];
  recordRun(record, passing(), record.draft);
  progress.lastExercise = 'copy-list';
  progress.confusingSkills = ['positions'];
  return progress;
}

test('drafts, run snapshots, assistance and archived drafts survive storage and JSON backup', () => {
  const storage = memoryStorage();
  const original = savedAttempt();
  original.records['copy-list'].archivedDrafts.push({code: '# earlier code', at: new Date().toISOString()});
  saveProgress(storage, original);
  const reloaded = loadProgress(storage, exercises, skills);
  assert.deepEqual(reloaded, original);
  const restored = importProgress(JSON.stringify(reloaded), exercises, skills);
  assert.deepEqual(restored, original);
  restored.records['copy-list'].draft = '# changed after import';
  assert.equal(original.records['copy-list'].draft, 'result = list(values)');
  assert.equal(loadProgress(storage, exercises, skills).records['copy-list'].draft, 'result = list(values)');
});

test('a normal exported backup restores all drafts, assistance and recorded checks', () => {
  const original = savedAttempt();
  original.records['copy-list'].archivedDrafts.push({code: '# earlier draft', at: new Date().toISOString()});
  const exported = exportProgress(original, exercises, skills);
  assert.deepEqual(importProgress(exported, exercises, skills), original);
});

test('oversized full backups refuse export while drafts-only preserves current work without mutating history', () => {
  const original = savedAttempt();
  const record = original.records['copy-list'];
  const longCode = '#' + 'x'.repeat(49_999);
  for (let i = 0; i < 100; i += 1) recordRun(record, passing(), longCode);
  record.archivedDrafts.push({code: '# previous draft', at: new Date().toISOString()});
  const before = JSON.stringify(original);
  assert.ok(before.length > 5_000_000);
  assert.throws(() => exportProgress(original, exercises, skills), /too large/);
  const restored = importProgress(exportProgress(original, exercises, skills, true), exercises, skills);
  const current = restored.records['copy-list'];
  for (const key of ['draft', 'confusion', 'hints', 'explanation', 'solution', 'externalHelp', 'prerequisites', 'attemptId', 'updatedAt']) {
    assert.deepEqual(current[key], record[key], `drafts-only backup lost ${key}`);
  }
  assert.deepEqual(current.attempts, []);
  assert.deepEqual(current.archivedDrafts, []);
  assert.equal(current.latestRun, null);
  assert.deepEqual(restored.confusingSkills, original.confusingSkills);
  assert.equal(restored.lastExercise, original.lastExercise);
  assert.equal(JSON.stringify(original), before, 'export must not discard in-memory history');
});

test('extreme imported timestamps are rejected before a revisit can overflow Date', () => {
  for (const field of ['attemptId', 'updatedAt']) {
    const invalid = savedAttempt();
    invalid.records['copy-list'][field] = '+275760-09-13T00:00:00.000Z';
    assert.throws(() => importProgress(JSON.stringify(invalid), exercises, skills), /Invalid saved data/);
  }
});

test('backup size is measured in file bytes so Unicode exports cannot bypass the import limit', () => {
  const original = savedAttempt();
  const record = original.records['copy-list'];
  const unicodeCode = '# ' + '练'.repeat(20_000);
  for (let i = 0; i < 100; i += 1) recordRun(record, passing(), unicodeCode);
  const text = JSON.stringify(original);
  assert.ok(text.length < 5_000_000, 'fixture needs fewer than five million characters');
  assert.ok(new TextEncoder().encode(text).byteLength > 5_000_000, 'fixture needs more than five million UTF-8 file bytes');
  assert.throws(() => exportProgress(original, exercises, skills), /too large/);
  assert.throws(() => importProgress(text, exercises, skills), /too large/);
  assert.equal(importProgress(exportProgress(original, exercises, skills, true), exercises, skills).records['copy-list'].draft, record.draft);
});

test('invalid or malicious nested backups never replace previously saved work', () => {
  const storage = memoryStorage();
  saveProgress(storage, savedAttempt());
  const before = storage.getItem(STORAGE_KEY);
  const mutations = [
    p => { p.version = 2; },
    p => { p.lastExercise = 'missing-exercise'; },
    p => { p.confusingSkills = ['missing-skill']; },
    p => { p.records.unknown = newRecord(); },
    p => { p.records['copy-list'].draft = 4; },
    p => { p.records['copy-list'].hints = [3]; },
    p => { p.records['copy-list'].externalHelp = 'yes'; },
    p => { p.records['copy-list'].prerequisites = ['unknown']; },
    p => { p.records['copy-list'].attempts[0].independent = true; },
    p => { p.records['copy-list'].attempts[0].assistance.solution = 'yes'; },
    p => { p.records['copy-list'].attempts[0].result.results[0].passed = 'yes'; },
    p => { p.records['copy-list'].latestRun.code = null; },
    p => { p.records['copy-list'].archivedDrafts = [{code: 'safe', at: 'yesterday'}]; },
    p => { p.records['copy-list'].latestRun.result.results[0].input = JSON.parse('{"__proto__":{"polluted":true}}'); },
    p => { p.records['copy-list'].latestRun.result.results[0].actual = JSON.parse('{"constructor":{"prototype":{"polluted":true}}}'); },
  ];
  for (const mutate of mutations) {
    const invalid = savedAttempt();
    mutate(invalid);
    assert.throws(() => {
      const imported = importProgress(JSON.stringify(invalid), exercises, skills);
      saveProgress(storage, imported);
    });
    assert.equal(storage.getItem(STORAGE_KEY), before);
    assert.equal(Object.prototype.polluted, undefined);
  }
  assert.throws(() => importProgress('{broken', exercises, skills), /not valid JSON/);
  assert.throws(() => importProgress(' '.repeat(5_000_001), exercises, skills), /too large/);
  assert.equal(storage.getItem(STORAGE_KEY), before);
});

test('missing result fields and excessive nesting are rejected', () => {
  const backup = savedAttempt();
  delete backup.records['copy-list'].latestRun.result.results[0].expected;
  assert.throws(() => validateProgress(backup, exercises, skills));
  const nested = savedAttempt();
  let deep = {};
  for (let i = 0; i < 20; i += 1) deep = {child: deep};
  nested.records['copy-list'].latestRun.result.results[0].actual = deep;
  assert.throws(() => validateProgress(nested, exercises, skills));
});

test('a pass without an explicit report never claims independence', () => {
  const record = newRecord('result = list(values)');
  recordRun(record, passing(), record.draft);
  assert.equal(status(record), 'Passed · assistance unreported');
  recordRun(record, passing(), record.draft, true);
  assert.equal(status(record), 'Reported independent');
});

test('recorded hint, explanation, solution, prerequisite and external help prevent independent status', () => {
  for (const help of [
    {hints: [0]}, {explanation: true}, {solution: true},
    {prerequisites: ['positions-small']}, {externalHelp: true},
  ]) {
    const record = Object.assign(newRecord('result = list(values)'), help);
    const run = recordRun(record, passing(), record.draft, true);
    assert.equal(run.independent, false);
    assert.equal(status(record), 'Passed with help');
  }
});

test('reporting help after a run corrects that attempt, including after reload', () => {
  const progress = emptyProgress();
  const record = getRecord(progress, exercises[0]);
  recordRun(record, passing(), record.draft, true);
  const restored = importProgress(JSON.stringify(progress), exercises, skills);
  restored.records['copy-list'].externalHelp = true;
  updateAssistance(restored.records['copy-list']);
  assert.equal(status(restored.records['copy-list']), 'Passed with help');
  assert.equal(restored.records['copy-list'].attempts[0].independent, false);
  assert.equal(restored.records['copy-list'].latestRun.independent, false);
  assert.equal(restored.records['copy-list'].attempts[0].assistance.external, true);
});

test('a fresh independent revisit retains evidence and cannot downgrade the previous attempt', t => {
  t.mock.timers.enable({apis: ['Date'], now: new Date('2026-10-02T12:00:00Z')});
  const record = newRecord('result = values[:]');
  recordRun(record, passing(), record.draft, true);
  const revisit = beginRevisit(record, 'result = []');
  assert.notEqual(revisit.attemptId, record.attemptId, 'each new attempt needs a distinct identity, even within one millisecond');
  assert.equal(revisit.draft, 'result = []');
  assert.deepEqual(revisit.archivedDrafts.map(a => a.code), ['result = values[:]']);
  assert.deepEqual(revisit.hints, []);
  assert.equal(revisit.latestRun, null);
  recordRun(revisit, passing(), 'result = list(values)', true);
  assert.equal(status(revisit), 'Revisited successfully');
  revisit.hints = [1];
  updateAssistance(revisit);
  assert.equal(revisit.attempts[0].independent, true, 'help on the revisit must not rewrite the earlier attempt');
  assert.equal(revisit.attempts[1].independent, false);
});

test('recommendations explain saved work, explicit confusion, and transfer after a solution', () => {
  const progress = savedAttempt();
  progress.records['copy-list'].draft += '\n# still trying';
  progress.records['copy-list'].solution = true;
  const recommended = suggestions(progress, exercises, skills);
  assert.equal(recommended[0].id, 'copy-list');
  assert.match(recommended[0].reason, /unfinished code is saved/);
  assert.equal(recommended[1].id, 'positions-small');
  assert.match(recommended[1].reason, /You marked/);
  assert.equal(recommended[2].id, 'copy-reversed');
  assert.match(recommended[2].reason, /worked solution/);
  assert.ok(recommended.every(r => exercises.some(e => e.id === r.id)));
  assert.ok(suggestions(emptyProgress(), exercises, skills).length > 0);
});

test('help context includes current code and honest stale feedback without a hidden reference', () => {
  const record = newRecord('result = values[position]');
  record.hints = [0, 1];
  record.prerequisites = ['positions-small'];
  record.confusion = 'Does position contain a value?';
  const result = {status: 'error', results: [
    {name: 'single item', input: {values: [7]}, expected: [7], actual: null, passed: false,
      stdout: 'started', error: 'NameError on line 1: position is not defined', errorType: 'NameError'},
  ]};
  recordRun(record, result, record.draft);
  record.draft = 'result = list(values)';
  const exercise = {...exercises[0], source: {label: 'Practice adaptation', url: 'https://leetcode.com/problems/concatenation-of-array/', note: 'The local script interface differs from the official submission interface.'}};
  const copied = helpContext(exercise, record, exercises);
  for (const text of ['copy-list', exercise.source.url, exercise.source.note, 'Local contract:',
    'result = list(values)', 'result = values[position]', 'changed since this run', 'single item',
    'Input: {"values":[7]}', 'Expected: [7]', 'Actual: null', 'NameError', 'Printed output: started',
    'Use one position.', 'Read values[position].', 'Read a position', record.confusion,
    'one unfamiliar idea at a time']) assert.ok(copied.includes(text), `context missing: ${text}`);
  assert.equal(copied.includes(exercise.solution), false);
  assert.equal(copied.includes('/home/'), false);
});

test('prepared visual states match independently observed execution of the displayed Python', () => {
  const program = `import json, sys
source = json.loads(sys.argv[1])
observed = []
before = 0
def trace(frame, event, arg):
    global before
    if frame.f_code.co_filename != '<prepared-trace>' or event != 'line':
        return trace
    state = frame.f_locals
    if frame.f_lineno == 5 and (not observed or state['position'] == len(state['values'])):
        observed.append(dict(position=state['position'], before=state['total'], after=state['total'], result=list(state['result'])))
    if frame.f_lineno == 6:
        before = state['total']
    if frame.f_lineno == 8:
        observed.append(dict(position=state['position'], before=before, after=state['total'], result=list(state['result'])))
    return trace
sys.settrace(trace)
exec(compile(source, '<prepared-trace>', 'exec'), {})
sys.settrace(None)
print(json.dumps(observed))
`;
  const execution = spawnSync('python3', ['-I', '-c', program, JSON.stringify(traceCode)], {encoding: 'utf8', timeout: 5000});
  assert.equal(execution.status, 0, execution.stderr || execution.error?.message);
  const actual = JSON.parse(execution.stdout);
  assert.deepEqual(traceStates.map(({position, before, after, result}) => ({position, before, after, result})), actual);
  assert.match(visualMarkup(1), /index 0/);
  assert.match(visualMarkup(1), /stored value/);
  assert.match(visualMarkup(1), /not your code/);
  assert.match(visualMarkup(4), /last nonnegative index is 2/);
});
