import test from 'node:test';
import assert from 'node:assert/strict';
import {exercises, skills} from '../src/content.js';
import {catalogSummary, challengePath, filterExercises} from '../src/discovery.js';
import {emptyProgress, newRecord, recordRun, importProgress, loadProgress, STORAGE_KEY} from '../src/progress.js';

const originalIds = [
  'saved-length', 'update-balance', 'repair-replacement', 'read-position',
  'repair-last-index', 'position-versus-value', 'repair-loop-boundary',
  'repair-loop-step', 'count-down', 'branch-choice', 'not-without-change',
  'repair-range-condition', 'sum-readings', 'repair-product', 'count-positive',
  'append-one', 'repair-append', 'double-values', 'copy-list', 'repeat-list',
  'running-totals', 'count-matches', 'range-filter', 'greatest-value',
  'copy-reversed', 'repeat-three', 'remaining-totals', 'count-streak',
  'range-positions', 'greatest-positions',
];

test('collection counts distinguish all challenges, LeetCode adaptations, practice, and variations', () => {
  assert.deepEqual(catalogSummary(exercises), {
    challenges: 14, leetcode: 10, practice: 25, variations: 14, total: 53,
  });
  assert.equal(filterExercises(exercises, emptyProgress(), {kind: 'challenge'}).length, 14);
  assert.equal(filterExercises(exercises, emptyProgress()).length, 53);
});

test('official titles and source names find the corresponding local practice adaptations', () => {
  for (const [search, id] of [
    ['  Concatenation of Array  ', 'repeat-list'],
    ['RUNNING SUM OF 1D ARRAY', 'running-totals'],
  ]) {
    assert.deepEqual(filterExercises(exercises, emptyProgress(), {search}).map(e => e.id), [id]);
  }
  const source = filterExercises(exercises, emptyProgress(), {kind: 'challenge', source: 'leetcode'});
  assert.equal(source.length, 10);
  assert.ok(source.every(e => e.source.url.startsWith('https://leetcode.com/problems/')));
  assert.equal(filterExercises(exercises, emptyProgress(), {source: 'original'}).length, 43);
});

test('combined filters retain the matching challenge and an incompatible filter produces no matches', () => {
  const filters = {kind: 'challenge', source: 'leetcode', skill: 'positions', search: 'concatenation'};
  assert.deepEqual(filterExercises(exercises, emptyProgress(), filters).map(e => e.id), ['repeat-list']);
  assert.deepEqual(filterExercises(exercises, emptyProgress(), {...filters, kind: 'skill'}), []);
  assert.deepEqual(filterExercises(exercises, emptyProgress(), {search: 'no such exercise xyz'}), []);
  assert.equal(filterExercises(exercises, emptyProgress(), {}).length, 53, 'clearing every filter restores the complete collection');
});

test('progress filters distinguish a saved draft from a passing attempt with reported help', () => {
  const progress = emptyProgress();
  progress.records['copy-list'] = newRecord('# My unfinished copy\nresult = []');
  const helped = newRecord('result = values + values');
  helped.externalHelp = true;
  recordRun(helped, {status: 'passed', results: [{name: 'One item', input: {values: [4]}, expected: [4, 4], actual: [4, 4], passed: true, stdout: '', error: null, errorType: null}]}, helped.draft, true);
  progress.records['repeat-list'] = helped;
  assert.deepEqual(filterExercises(exercises, progress, {status: 'Draft saved'}).map(e => e.id), ['copy-list']);
  assert.deepEqual(filterExercises(exercises, progress, {status: 'Passed with help'}).map(e => e.id), ['repeat-list']);
  assert.deepEqual(filterExercises(exercises, progress, {status: 'Reported independent'}), []);
  assert.equal(filterExercises(exercises, progress, {status: 'Not started'}).length, 51);
});

test('the suggested path includes every challenge once and puts smaller combinations before stretch problems', () => {
  const originalOrder = exercises.map(e => e.id);
  const path = challengePath(exercises);
  assert.deepEqual(path.map(e => e.id), [
    'copy-list', 'final-operations', 'repeat-list', 'count-matches',
    'range-filter', 'running-totals', 'greatest-value', 'candy-flags',
    'shuffle-halves', 'divisible-difference', 'follow-permutation',
    'consecutive-ones', 'richest-customer', 'good-pairs',
  ]);
  assert.deepEqual(path.map(e => e.stage), [
    ...Array(4).fill('Start here'), ...Array(6).fill('Combine skills'), ...Array(4).fill('Next stretch'),
  ]);
  assert.deepEqual(exercises.map(e => e.id), originalOrder, 'sorting the suggested path must not reorder the catalog');
});

test('the expanded catalog restores every original exercise draft and version 1 history unchanged', () => {
  const oldProgress = emptyProgress();
  for (const id of originalIds) {
    const record = newRecord(`# Preserved draft for ${id}\nresult = None\n`);
    record.confusion = `My own note about ${id}`;
    record.hints = [0];
    record.archivedDrafts = [{code: '# previous version', at: record.updatedAt}];
    oldProgress.records[id] = record;
  }
  const copy = oldProgress.records['copy-list'];
  copy.prerequisites = ['repair-loop-step'];
  recordRun(copy, {status: 'passed', results: [{name: 'One item', input: {values: [3]}, expected: [3], actual: [3], passed: true, stdout: '', error: null, errorType: null}]}, 'result = values[:]');
  oldProgress.lastExercise = 'copy-list';
  oldProgress.confusingSkills = ['positions', 'conditions'];
  const backup = JSON.stringify(oldProgress);
  assert.deepEqual(importProgress(backup, exercises, skills), oldProgress);
  const storage = {getItem: key => key === STORAGE_KEY ? backup : null};
  assert.deepEqual(loadProgress(storage, exercises, skills), oldProgress);
  assert.equal(JSON.stringify(oldProgress), backup);
  assert.equal(Object.keys(loadProgress(storage, exercises, skills).records).length, 30, 'new exercises do not silently add attempts or rewrite old evidence');
});
