export function helpContext(exercise, record, exercises) {
  const run = record.latestRun;
  const relevant = run?.result.results.find(t => !t.passed) || run?.result.results[0];
  const used = record.prerequisites.map(id => exercises.find(e => e.id === id)?.title || id);
  return [
    'Please help me diagnose the specific gap in this Python attempt. Begin with a small concrete explanation or targeted hint, one unfamiliar idea at a time. I am a beginner following the Helsinki Python MOOC, around combining conditions. I have seen while loops, indexing, len(), append(), and accumulators, but may not use them independently yet. Please do not give a full solution immediately unless I ask.',
    `Problem: ${exercise.title} (${exercise.id})`,
    `Source: ${exercise.source.label}${exercise.source.url ? ` — ${exercise.source.url}` : ''}`,
    exercise.source.note || '',
    `Goal: ${exercise.goal}\nInputs: ${exercise.inputs}\nBoundaries: ${exercise.boundaries}\nWrite: ${exercise.instructions}\nLocal contract: Python script with injected inputs; store the requested value in ${exercise.resultVariable}. The value and Python type are checked. print() output is shown but is not the answer.`,
    `My CURRENT code:\n\`\`\`python\n${record.draft}\n\`\`\``,
    run ? `Latest checked attempt (${run.at}): ${run.result.status}${run.result.message ? ` — ${run.result.message}` : ''}${run.code !== record.draft ? '\nMy current code has changed since this run. The following feedback is for the previous code:\n```python\n' + run.code + '\n```' : ''}` : 'No check has run yet.',
    relevant ? `Relevant test: ${relevant.name}\nInput: ${JSON.stringify(relevant.input)}\nExpected: ${JSON.stringify(relevant.expected)}\nActual: ${JSON.stringify(relevant.actual) ?? '(not produced)'}\nError: ${relevant.error || '(none)'}\nPrinted output: ${relevant.stdout || '(none)'}` : '',
    `Hints opened: ${record.hints.length ? record.hints.map(i => `${i + 1}. ${exercise.hints[i]}`).join(' | ') : 'none'}`,
    `Explanation opened: ${record.explanation ? 'yes' : 'no'}; worked solution opened: ${record.solution ? 'yes' : 'no'}; external assistance reported: ${record.externalHelp ? 'yes' : 'no'}.`,
    `Prerequisite exercises visited from this attempt: ${used.join(', ') || 'none'}`,
    `Where I am confused: ${record.confusion.trim() || '(not specified)'}`,
    'The app uses prepared guidance and test cases. Passing checks does not prove understanding. No hidden reference solution is included in this message.'
  ].filter(Boolean).join('\n\n');
}
