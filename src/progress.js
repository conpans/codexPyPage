export const STORAGE_KEY = 'python-fieldnotes.v1';
export const SCHEMA_VERSION = 1;
const own = (obj, key) => Object.hasOwn(obj, key);
const isObject = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const string = (v, max = 50000) => typeof v === 'string' && v.length <= max;
const date = v => string(v, 40) && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v)
  && Number.isFinite(Date.parse(v)) && Date.parse(v) >= 0 && Date.parse(v) < 4102444800000;
const strings = (v, allowed) => Array.isArray(v) && v.length <= 100 && v.every(x => string(x, 100) && (!allowed || allowed.has(x)));
export function emptyProgress() { return {version: 1, records: {}, confusingSkills: [], lastExercise: null}; }
export function newRecord(code = '') {
  const now = new Date().toISOString();
  return {draft: code, updatedAt: now, attemptId: now, hints: [], explanation: false, solution: false, externalHelp: false, prerequisites: [], confusion: '', attempts: [], archivedDrafts: [], latestRun: null};
}
export function assistance(record) {
  return {hints: [...record.hints], explanation: record.explanation, solution: record.solution, external: record.externalHelp, prerequisites: [...record.prerequisites]};
}
export function hasHelp(a) { return a.hints.length > 0 || a.explanation || a.solution || a.external || a.prerequisites.length > 0; }
export function recordRun(record, result, code, independent = false) {
  const help = assistance(record);
  const entry = {at: new Date().toISOString(), attemptId: record.attemptId, code, assistance: help, independent: independent && !hasHelp(help), result};
  record.attempts.push(entry);
  record.attempts = record.attempts.slice(-100);
  record.latestRun = entry;
  record.updatedAt = entry.at;
  return entry;
}
export function updateAssistance(record) {
  for (const entry of [...record.attempts, ...(record.latestRun ? [record.latestRun] : [])]) {
    if (entry.attemptId === record.attemptId) {
      entry.assistance = assistance(record);
      if (hasHelp(entry.assistance)) entry.independent = false;
    }
  }
}
export function beginRevisit(record, starter) {
  const next = newRecord(starter);
  // Clock resolution cannot identify an attempt: repeated starts can share a millisecond.
  const latestId = Math.max(Date.parse(record.attemptId), ...record.attempts.map(a => Date.parse(a.attemptId)));
  if (Date.parse(next.attemptId) <= latestId) next.attemptId = new Date(latestId + 1).toISOString();
  next.attempts = record.attempts;
  next.archivedDrafts = [...record.archivedDrafts, {code: record.draft, at: record.updatedAt}].slice(-10);
  return next;
}
export function status(record) {
  if (!record) return 'Not started';
  const pass = [...record.attempts].reverse().find(a => a.result.status === 'passed');
  if (!pass) return record.attempts.length ? 'Attempted' : 'Draft saved';
  if (hasHelp(pass.assistance)) return 'Passed with help';
  if (!pass.independent) return 'Passed · assistance unreported';
  const previous = record.attempts.slice(0, record.attempts.indexOf(pass)).some(a => a.attemptId !== pass.attemptId && a.result.status === 'passed');
  return previous ? 'Revisited successfully' : 'Reported independent';
}
function validAssistance(a, ids) {
  return isObject(a) && Array.isArray(a.hints) && a.hints.length <= 3 && a.hints.every((n, i) => n === i)
    && ['explanation','solution','external'].every(k => typeof a[k] === 'boolean') && strings(a.prerequisites, ids);
}
function jsonValue(v, depth = 0) {
  if (depth > 15) return false;
  if (v === null || typeof v === 'boolean' || string(v, 20000) || (typeof v === 'number' && Number.isFinite(v))) return true;
  if (Array.isArray(v)) return v.length <= 5000 && v.every(x => jsonValue(x, depth + 1));
  return isObject(v) && Object.keys(v).length <= 100 && Object.entries(v).every(([k, x]) => !['__proto__', 'prototype', 'constructor'].includes(k) && jsonValue(x, depth + 1));
}
function validResult(r) {
  return isObject(r) && ['passed','failed','error','timeout','cancelled'].includes(r.status)
    && (r.message === undefined || string(r.message, 20000)) && Array.isArray(r.results) && r.results.length <= 100
    && (r.status !== 'passed' || (r.results.length > 0 && r.results.every(t => t.passed === true && !t.error && !t.errorType)))
    && r.results.every(t => isObject(t) && string(t.name, 500) && isObject(t.input) && jsonValue(t.input)
      && jsonValue(t.expected) && (t.actual === undefined || jsonValue(t.actual)) && typeof t.passed === 'boolean'
      && ['error', 'errorType','stdout'].every(k => t[k] == null || string(t[k], 20000)));
}
function validEntry(a, ids) {
  return isObject(a) && date(a.at) && date(a.attemptId) && string(a.code) && validAssistance(a.assistance, ids)
    && typeof a.independent === 'boolean' && !(a.independent && hasHelp(a.assistance)) && validResult(a.result);
}
export function validateProgress(value, exercises, skills) {
  const ids = new Set(exercises.map(e => e.id)), skillIds = new Set(skills.map(s => s.id));
  if (!isObject(value) || value.version !== SCHEMA_VERSION || !isObject(value.records)
    || !strings(value.confusingSkills, skillIds) || !(value.lastExercise === null || ids.has(value.lastExercise))) throw new Error('This is not a supported Python Fieldnotes version 1 backup.');
  for (const [id, r] of Object.entries(value.records)) {
    if (!ids.has(id) || !isObject(r) || !string(r.draft) || !date(r.updatedAt) || !date(r.attemptId) || !string(r.confusion, 2000)
      || !validAssistance({...r, external: r.externalHelp}, ids) || !Array.isArray(r.attempts) || r.attempts.length > 100
      || !r.attempts.every(a => validEntry(a, ids)) || !(r.latestRun === null || validEntry(r.latestRun, ids))
      || !Array.isArray(r.archivedDrafts) || r.archivedDrafts.length > 10 || !r.archivedDrafts.every(a => isObject(a) && string(a.code) && date(a.at))) throw new Error(`Invalid saved data for ${id}. Your current progress has not changed.`);
  }
  // Reconstruct the top level instead of trusting arbitrary imported object keys.
  return {version: 1, records: JSON.parse(JSON.stringify(value.records)), confusingSkills: [...value.confusingSkills], lastExercise: value.lastExercise};
}
export function importProgress(text, exercises, skills) {
  if (new TextEncoder().encode(text).byteLength > 5_000_000) throw new Error('Backup is too large (maximum 5 MB).');
  let parsed;
  try { parsed = JSON.parse(text); } catch { throw new Error('This file is not valid JSON. Your current progress has not changed.'); }
  return validateProgress(parsed, exercises, skills);
}
export function exportProgress(progress, exercises, skills, draftsOnly = false) {
  let value = progress;
  if (draftsOnly) {
    value = structuredClone(progress);
    for (const record of Object.values(value.records)) {
      record.attempts = [];
      record.latestRun = null;
      record.archivedDrafts = [];
    }
  }
  // The same validation runs on both sides; never label an unrestorable file a backup.
  const text = JSON.stringify(value);
  importProgress(text, exercises, skills);
  return text;
}
export function loadProgress(storage, exercises, skills) {
  const raw = storage.getItem(STORAGE_KEY);
  return raw ? importProgress(raw, exercises, skills) : emptyProgress();
}
export function saveProgress(storage, progress) { storage.setItem(STORAGE_KEY, JSON.stringify(progress)); }
export function suggestions(progress, exercises, skills) {
  const items = [];
  const add = (id, reason) => { if (id && !items.some(i => i.id === id) && exercises.some(e => e.id === id)) items.push({id, reason}); };
  const last = progress.lastExercise, r = progress.records[last];
  if (r && (!r.latestRun || r.latestRun.result.status !== 'passed' || r.draft !== r.latestRun.code)) add(last, 'Your unfinished code is saved. Pick up at the same place.');
  for (const s of skills.filter(s => progress.confusingSkills.includes(s.id))) add(s.exerciseIds[0], `You marked ${s.title.toLowerCase()} as something to revisit.`);
  for (const [id, rec] of Object.entries(progress.records)) {
    const e = exercises.find(e => e.id === id);
    if (rec.solution) add(e.followup || e.related[0] || id, `You opened a worked solution for ${e.title}. Try applying it to a different task.`);
  }
  if (r?.latestRun?.result.status === 'passed') {
    const e = exercises.find(e => e.id === last);
    add(e.followup || e.related[0], `You passed the checks for ${e.title}. This is a related next challenge, not a mastery claim.`);
  }
  if (!items.length) {
    add(skills.find(s => s.id === 'conditions')?.exerciseIds[0], 'A short start alongside combining conditions in your course.');
    add('copy-list', 'Connect list positions, a loop, and append() in one small program.');
  }
  return items.slice(0, 3);
}
export function getRecord(progress, exercise) {
  if (!own(progress.records, exercise.id)) progress.records[exercise.id] = newRecord(exercise.starter);
  return progress.records[exercise.id];
}
