import {status} from './progress.js';

export const challengeStages = ['Start here', 'Combine skills', 'Next stretch'];
export function catalogSummary(exercises) {
  return {
    challenges: exercises.filter(e => e.kind === 'challenge').length,
    leetcode: exercises.filter(e => e.kind === 'challenge' && e.source?.url?.startsWith('https://leetcode.com/problems/')).length,
    practice: exercises.filter(e => e.kind === 'skill').length,
    variations: exercises.filter(e => e.kind === 'variation').length,
    total: exercises.length,
  };
}
export function challengePath(exercises) {
  return exercises.filter(e => e.kind === 'challenge').toSorted((a, b) => {
    const stage = e => challengeStages.indexOf(e.stage || 'Combine skills');
    return stage(a) - stage(b) || (a.pathOrder ?? 100) - (b.pathOrder ?? 100);
  });
}
export function filterExercises(exercises, progress, filters = {}) {
  const query = (filters.search || '').trim().toLowerCase();
  return exercises.filter(e => {
    const isLeetCode = e.source?.url?.startsWith('https://leetcode.com/problems/');
    const searchable = [e.title, e.goal, e.id, e.source?.label, e.source?.note, e.source?.url, e.newIdea, ...e.skillIds].join(' ').toLowerCase();
    return (!filters.kind || e.kind === filters.kind)
      && (!filters.skill || e.skillIds.includes(filters.skill))
      && (!filters.status || status(progress.records[e.id]) === filters.status)
      && (!filters.difficulty || e.difficulty === filters.difficulty)
      && (!filters.source || (filters.source === 'leetcode' ? isLeetCode : !isLeetCode))
      && searchable.includes(query);
  });
}
