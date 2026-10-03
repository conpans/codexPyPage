export const traceCode = `values = [3, 1, 4]\nposition = 0\ntotal = 0\nresult = []\nwhile position < len(values):\n    total = total + values[position]\n    result.append(total)\n    position = position + 1`;
export const traceStates = [
  {position:0,before:0,after:0,result:[],note:'Start with total = 0 and position = 0. The first value is values[0], which is 3.'},
  {position:0,before:0,after:3,result:[3],note:'Read values[0] → 3. Store 0 + 3 in total, then append that current total.'},
  {position:1,before:3,after:4,result:[3,4],note:'Advance position to 1. Read values[1] → 1. Store 3 + 1 in total, then append 4.'},
  {position:2,before:4,after:8,result:[3,4,8],note:'Advance position to 2. Read values[2] → 4. Store 4 + 4 in total, then append 8.'},
  {position:3,before:8,after:8,result:[3,4,8],note:'Advance position to 3. The check 3 < 3 is False, so stop before reading a list item. Length is 3; the last nonnegative index is 2.'}
];
export function visualMarkup(step = 0) {
  const s = traceStates[step];
  return `<div class="trace"><div class="section-label">PREPARED EXAMPLE · RUNNING TOTALS</div><h3>A position points. A value adds.</h3><p>This steps through the example below, not your code.</p><div class="list-visual">${[3,1,4].map((v,i) => `<div class="list-cell ${step < 4 && i === s.position ? 'current' : ''}"><span>index ${i}</span><strong>${v}</strong><small>stored value</small></div>`).join('')}</div><div class="trace-numbers"><span>position <b>${s.position}</b></span><span>total <b>${s.before} → ${s.after}</b></span><span>length <b>3</b></span></div><p class="trace-note" aria-live="polite">${s.note}</p><p><code>result = [${s.result.join(', ')}]</code></p><div class="actions"><button data-action="trace-prev" ${step === 0 ? 'disabled' : ''}>← Back</button><span>${step + 1} / ${traceStates.length}</span><button data-action="trace-next" ${step === 4 ? 'disabled' : ''}>Next step →</button><button class="text-button" data-action="trace-reset">Reset</button></div><details><summary>See the prepared Python</summary><pre>${traceCode.replaceAll('<','&lt;')}</pre></details><p class="small">Names such as position and total are chosen by the programmer. Brackets, len(), and append() have Python-defined behavior. Python also supports negative indexing; this forward loop uses nonnegative positions.</p></div>`;
}
