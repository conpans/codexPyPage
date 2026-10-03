import {skills, exercises} from './content.js';
import {createRunner} from './runner.js';
import {catalogSummary, filterExercises, challengePath, challengeStages} from './discovery.js';
import {emptyProgress, loadProgress, saveProgress, getRecord, status, suggestions, recordRun, updateAssistance, beginRevisit, importProgress, exportProgress, hasHelp, assistance} from './progress.js';
import {helpContext} from './help.js';
import {visualMarkup, traceStates} from './visual.js';

const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const py = value => value === null ? 'None' : typeof value === 'boolean' ? (value ? 'True' : 'False') : Array.isArray(value) ? '[' + value.map(py).join(', ') + ']' : value && typeof value === 'object' ? '{' + Object.entries(value).map(([k,v]) => JSON.stringify(k) + ': ' + py(v)).join(', ') + '}' : JSON.stringify(value);
const ex = id => exercises.find(e => e.id === id);
const sk = id => skills.find(s => s.id === id);
const catalog = catalogSummary(exercises);
const runner = createRunner();
let progress, storageHealthy = true, running = false, runExercise = null, runNote = '', traceStep = 0, activeTab = 'task', pendingImport = null, toastTimer;
const filters = {search:'',kind:'challenge',skill:'',status:'',difficulty:'',source:''};
try { progress = loadProgress(localStorage, exercises, skills); }
catch (error) { progress = emptyProgress(); storageHealthy = false; storageWarning(`Browser progress could not be loaded: ${error.message} Existing data is left untouched. Export a recovery copy from Progress & backups, or restore a valid backup.`); }
function storageWarning(message) { const el=$('#storage-warning'); el.hidden=false; el.textContent=message; }
function persist() {
  if (!storageHealthy) return;
  try { saveProgress(localStorage, progress); }
  catch { storageHealthy=false; storageWarning('Browser storage is unavailable or full. Your work is held in this open tab; export a backup before closing it.'); }
}
function notify(message) { $('#toast').textContent=message; $('#toast').classList.add('visible'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),4500); }
function route() {
  const raw=location.hash.slice(1) || 'home';
  const [path,query='']=raw.split('?');
  const [page,id]=path.split('/');
  const from=new URLSearchParams(query).get('from');
  return {page,id,query,from:ex(from) ? from : null};
}
function exerciseLink(id, label, cls='') {return `<a class="${cls}" href="#exercise/${esc(id)}">${esc(label || ex(id)?.title || id)} <span aria-hidden="true">↗</span></a>`;}
function badge(record) { const s=status(record); return `<span class="status ${s.includes('independent') || s.includes('successfully') ? 'success' : s.includes('help') ? 'helped' : ''}">${esc(s)}</span>`; }
function skillTags(e) { return `<div class="skill-tags">${e.skillIds.map(id=>`<a href="#skill/${id}">${esc(sk(id)?.title || id)}</a>`).join('')}</div>`; }
function card(e, reason, featured=false) { return `<article class="problem-card ${featured?'featured':''}"><div class="card-top"><span class="eyebrow">${esc(e.kind === 'skill'?'SKILL PRACTICE':e.kind==='variation'?'TRANSFER PRACTICE':'CHALLENGE')}</span><span class="time">~${e.minutes} min</span></div><h3>${exerciseLink(e.id,e.title)}</h3><p>${esc(reason || e.goal)}</p><p class="card-source">${esc(e.source.label)} · ${esc(e.format)}</p>${e.newIdea?`<p class="new-idea"><strong>Practice focus</strong> ${esc(e.newIdea)}</p>`:''}${skillTags(e)}<div class="card-bottom">${badge(progress.records[e.id])}<span>${esc(e.difficulty)}</span></div></article>`; }
function home() {
  const picks=suggestions(progress,exercises,skills);
  const attempted=Object.values(progress.records).filter(r=>r.attempts.length).length;
  const checked=Object.values(progress.records).filter(r=>r.attempts.some(a=>a.result.status==='passed')).length;
  return `<section class="home-hero"><div><div class="eyebrow">A SMALL STEP IS STILL A STEP</div><h1>A little practice.<br><em>A clearer next step.</em></h1><p>Start where you are. Work through one idea.<br>Your unfinished code will be here when you return.</p><a class="button primary" href="#exercise/${picks[0]?.id || 'copy-list'}">${progress.lastExercise?'Continue practicing':'Find your starting point'} <span aria-hidden="true">→</span></a><p class="hero-caption">15 minutes is enough to make a little progress.</p></div><div class="hero-note" aria-label="Example of a list index and value"><div class="note-heading"><span>FIELDNOTE 01</span><span aria-hidden="true">↳</span></div><code>values = [3, 1, 4]</code><div class="hero-list">${[3,1,4].map((v,i)=>`<div class="${i===1?'chosen':''}"><small>index ${i}</small><b>${v}</b></div>`).join('')}</div><p><code>values[1]</code> gives you <strong>1</strong>.</p><span class="note-foot">The position and the value do different jobs.</span><a href="#skill/positions">Explore list positions →</a></div></section>${collectionOverview()}<section><div class="section-heading"><div><span class="eyebrow">YOUR NEXT SMALL STEP</span><h2>${progress.lastExercise?'Pick up the thread':'A good place to begin'}</h2></div><span class="quiet">${picks.length} suggestions from ${catalog.total} exercises</span></div><p class="section-description">These are a few starting points. The full challenge collection is open whenever you want it.</p><div class="card-grid recommendations">${picks.map((p,i)=>card(ex(p.id),p.reason,i===0)).join('')}</div></section><section><div class="section-heading"><div><span class="eyebrow">CONNECTED IDEAS</span><h2>Build the pieces. Then put them together.</h2></div><a href="#skills">All ${skills.length} skills →</a></div><div class="skill-mini-grid">${skills.map((s,i)=>`<a class="skill-mini" href="#skill/${s.id}"><span class="skill-number">0${i+1}</span><strong>${esc(s.title)}</strong><span aria-hidden="true">↗</span></a>`).join('')}</div></section><div class="progress-note"><span class="little-dot"></span><span>${attempted ? `${attempted} exercises attempted · ${checked} with passing checks. These are records of practice, not a measure of mastery.` : 'This is your practice notebook. Attempts, hints, and reported help tell a more useful story than a score.'}</span></div>`;
}
function collectionOverview() {
  return `<section class="collection-overview" aria-labelledby="collection-title"><div><span class="eyebrow">THE FULL COLLECTION</span><h2 id="collection-title">${catalog.challenges} challenges to grow into.</h2><p>${catalog.leetcode} LeetCode Easy adaptations, ${catalog.practice} smaller skill exercises, and ${catalog.variations} follow-up variations. Start with familiar ideas, then add one new piece.</p></div><div class="collection-actions"><a class="button primary" data-catalog-link href="#problems?kind=challenge">Browse all ${catalog.challenges} challenges →</a><a data-catalog-link href="#problems?kind=challenge&source=leetcode">See the ${catalog.leetcode} LeetCode adaptations</a></div></section>`;
}
function skillList() { return `<div class="page-heading"><span class="eyebrow">PRACTICE A SKILL</span><h1>One idea, a few ways to use it.</h1><p>Start with a concrete explanation, then try a small task. Each skill connects to several problems.</p></div><div class="card-grid skills-grid">${skills.map((s,i)=>`<article class="skill-card"><span class="skill-number">0${i+1}</span><h2><a href="#skill/${s.id}">${esc(s.title)} ↗</a></h2><p>${esc(s.summary)}</p><span class="quiet">${s.exerciseIds.length} exercises · ${s.challengeIds.length} connected challenges</span><div class="skill-path">${s.challengeIds.slice(0,2).map(id=>exerciseLink(id)).join('')}</div></article>`).join('')}</div>`; }
function skillPage(id) {
  const s=sk(id); if (!s) return notFound();
  return `<a class="back-link" href="#skills">← All skills</a><div class="page-heading"><span class="eyebrow">SKILL UNIT ${String(skills.indexOf(s)+1).padStart(2,'0')}</span><h1>${esc(s.title)}</h1><p>${esc(s.summary)}</p></div><div class="skill-detail-grid"><section class="panel"><span class="eyebrow">THE IDEA</span><div class="prose">${paragraphs(s.explanation)}</div><label class="check-label"><input type="checkbox" data-confusing="${s.id}" ${progress.confusingSkills.includes(s.id)?'checked':''}> Suggest this skill again — I want more practice.</label><h2>Try it in a small exercise</h2><div class="exercise-list">${s.exerciseIds.map((eid,i)=>`<div><span class="step-number">${i+1}</span><div>${exerciseLink(eid)}<small>${esc(ex(eid).format)} · ~${ex(eid).minutes} min</small></div>${badge(progress.records[eid])}</div>`).join('')}</div></section><aside id="visual-panel" class="panel">${visualMarkup(traceStep)}</aside></div><section><div class="section-heading"><h2>Where this skill goes next</h2><span class="quiet">Try any challenge when you want</span></div><div class="card-grid">${s.challengeIds.map(id=>card(ex(id))).join('')}</div></section>`;
}
function paragraphs(text) {return String(text).split('\n\n').map(p=>`<p>${esc(p).replaceAll('\n','<br>')}</p>`).join('');}
function problemBrowser() {
  return `<div class="page-heading"><span class="eyebrow">BROWSE PROBLEMS · THE FULL COLLECTION</span><h1>Small programs. Connected skills.</h1><p>${catalog.challenges} integrated challenges · ${catalog.leetcode} LeetCode adaptations · ${catalog.practice} skill exercises · ${catalog.variations} variations. Every item is open to try.</p></div><div class="collection-shortcuts" aria-label="Choose a collection"><a data-catalog-link href="#problems?kind=challenge">All ${catalog.challenges} challenges</a><a data-catalog-link href="#problems?kind=challenge&source=leetcode">${catalog.leetcode} LeetCode adaptations</a><a data-catalog-link href="#problems?kind=skill">${catalog.practice} smaller exercises</a><a data-catalog-link href="#problems?kind=all">Everything (${catalog.total})</a></div><p class="small">The suggested order is optional. “Easy” is LeetCode's label; the difficulty shown here is relative to this collection. New ideas come with linked prerequisite practice.</p><div class="filters"><label class="search-label">Find a problem<input id="search" type="search" placeholder="Search a title, idea, or LeetCode number…" value="${esc(filters.search)}"></label><label>Collection<select id="filter-kind"><option value="">All exercises</option><option value="challenge">Integrated challenges</option><option value="skill">Skill practice</option><option value="variation">Transfer variations</option></select></label><label>Skill<select id="filter-skill"><option value="">Any skill</option>${skills.map(s=>`<option value="${s.id}">${esc(s.title)}</option>`).join('')}</select></label><label>Progress<select id="filter-status"><option value="">Any progress</option><option>Not started</option><option>Draft saved</option><option>Attempted</option><option>Passed with help</option><option>Passed · assistance unreported</option><option>Reported independent</option><option>Revisited successfully</option></select></label><label>Difficulty<select id="filter-difficulty"><option value="">Any difficulty</option><option>Foundation</option><option>Connecting ideas</option><option>Stretch</option></select></label><label>Source<select id="filter-source"><option value="">Any source</option><option value="original">Original practice</option><option value="leetcode">LeetCode adaptation</option></select></label></div><div class="filter-summary"><p class="quiet" id="result-count" aria-live="polite"></p><button class="text-button" data-action="clear-filters">Clear all filters</button></div><div id="problem-results"></div>`;
}
function filterProblems() {
  const list=filterExercises(exercises,progress,filters);
  const collectionTotal=filters.kind?exercises.filter(e=>e.kind===filters.kind).length:catalog.total;
  const name=filters.kind==='challenge'?'challenges':filters.kind==='variation'?'variations':filters.kind==='skill'?'skill exercises':'exercises';
  $('#result-count').textContent=`Showing ${list.length} of ${collectionTotal} ${name}${filters.source?' · '+(filters.source==='leetcode'?'LeetCode adaptations':'Original practice'):''}`;
  const result=$('#problem-results');
  if(!list.length){result.innerHTML='<div class="empty-state"><h2>No matches yet.</h2><p>Try another search or clear the filters above to see the whole collection.</p></div>';return;}
  if(filters.kind==='challenge'){
    const ordered=challengePath(list);
    const stageNotes={'Start here':'Use familiar assignments, conditions, and forward loops.','Combine skills':'Join those pieces and practice a specific new step.','Next stretch':'Try lookups, runs, rows, and pairs with smaller exercises alongside.'};
    result.innerHTML=challengeStages.map(stage=>{const group=ordered.filter(e=>(e.stage || 'Combine skills')===stage);return group.length?`<section class="challenge-group"><div class="section-heading"><div><span class="eyebrow">SUGGESTED LEARNING ORDER · OPTIONAL</span><h2>${stage}</h2><p class="small">${stageNotes[stage]}</p></div><span class="quiet">${group.length} challenges</span></div><div class="card-grid">${group.map(e=>card(e)).join('')}</div></section>`:'';}).join('');
  }else result.innerHTML=`<div class="card-grid">${list.map(e=>card(e)).join('')}</div>`;
}
function applyCatalogRoute() {
  const {page,query}=route();if(page!=='problems')return;
  const params=new URLSearchParams(query);
  Object.keys(filters).forEach(key=>{filters[key]=params.get(key) || '';});
  filters.kind=params.get('kind')==='all'?'':params.get('kind') || 'challenge';
}
function taskContent(e) {
  return `<h2>Your task</h2><p class="goal">${esc(e.goal)}</p><dl class="contract"><dt>Given to your program</dt><dd>${esc(e.inputs)}</dd><dt>What to write</dt><dd>${esc(e.instructions)}</dd><dt>Boundaries</dt><dd>${esc(e.boundaries)}</dd></dl><div class="contract-callout">Store your answer in <code>${esc(e.resultVariable)}</code>. Each test supplies its own inputs. Your answer's value and Python type must match. Printing is optional; printed text is not the checked answer.</div>${e.format==='Predict'?'<p class="prediction-note">Trace the starter code, then type your prediction in result. The expected answer stays hidden until you check or ask for help.</p>':'<h3>Concrete examples</h3>'}${(e.format==='Predict'?[]:e.examples).map(t=>`<div class="example"><span>INPUT</span><pre>${esc(Object.entries(t.input).map(([k,v])=>`${k} = ${py(v)}`).join('\n') || '(no supplied input)' )}</pre><span>EXPECTED ${esc(e.resultVariable.toUpperCase())}</span><pre>${esc(py(t.expected))}</pre><p>${esc(t.note)}</p></div>`).join('')}<div class="source-note">${e.source.url?`Practice adaptation of <a href="${esc(e.source.url)}" target="_blank" rel="noreferrer">${esc(e.source.label)} ↗</a>`:esc(e.source.label)}${e.source.note?`<p>${esc(e.source.note)}</p>`:''}</div>`;
}
function supportContent(e,r) {
  return `<h2>A little help, when you need it.</h2><p>Start small, or open a direct explanation. Your draft stays in place.</p><div class="hint-stack">${r.hints.map(i=>`<article class="hint"><span class="eyebrow">HINT ${i+1}</span><p>${esc(e.hints[i])}</p></article>`).join('')}</div>${r.hints.length<e.hints.length?`<button data-action="hint">Open hint ${r.hints.length+1} of ${e.hints.length}</button>`:'<p class="quiet">All prepared hints are open.</p>'}<div class="support-block"><button data-action="explanation">${r.explanation?'Explanation opened':'Explain the idea directly'}</button>${r.explanation?`<div class="prose">${paragraphs(e.explanation)}</div>`:''}</div><div class="support-block"><h3>Worked solution</h3><p>Revealing this is recorded as assistance. A related exercise gives you another chance to apply the idea.</p>${r.solution?`<pre class="solution-code">${esc(e.solution)}</pre><p>${exerciseLink(e.followup || e.related[0], 'Try a related exercise →', 'button')}</p>`:'<button data-action="solution">Reveal worked solution</button>'}</div>`;
}
function prerequisites(e,r,from) {
  return `<div class="prereq-block"><h3>Practice a smaller piece</h3><p class="small">Visit a prerequisite, then return to this saved attempt.</p>${e.prerequisites.map(id=>`<a data-prereq="${id}" href="#exercise/${id}?from=${from || e.id}">${esc(ex(id)?.title || id)} <span aria-hidden="true">↗</span></a>`).join('') || '<p class="small">This is a starting exercise. Try the related tasks below.</p>'}<h3>Skills in this problem</h3>${skillTags(e)}<h3>Try the idea another way</h3>${[...new Set([e.followup,...e.related].filter(Boolean))].map(id=>exerciseLink(id)).join('')}</div>`;
}
function resultContent(e,r) {
  if (running && runExercise===e.id) return `<div class="running-state"><span class="little-dot"></span><h3>Checking your Python…</h3><p id="run-note" role="status">${esc(runNote)}</p><p class="small">You can keep exploring or stop the check. Your draft is saved.</p></div>`;
  const run=r.latestRun;
  if (!run) return '<div class="empty-feedback"><span aria-hidden="true">↳</span><h3>Make a guess. See what happens.</h3><p>Your results and printed output will appear here.<br>Run your code with <kbd>Ctrl</kbd> + <kbd>Enter</kbd>.</p></div>';
  const data=run.result;
  const titles={passed:'The checked cases passed.',failed:'There is something to inspect.',error:'Python could not finish this attempt.',timeout:'The program reached its time limit.',cancelled:'Check stopped. Your code is saved.'};
  return `<div class="result-heading ${data.status==='passed'?'passed':''}"><span aria-hidden="true">${data.status==='passed'?'✓':'↳'}</span><div><h3>${titles[data.status] || 'Check finished.'}</h3><p>${data.status==='passed'?'That is concrete progress. These tests check behavior; they do not measure understanding.':esc(data.message || 'Compare the first different result. You can open a hint or practice a smaller piece.')}</p></div></div>${run.code!==r.draft?'<p class="stale-note">Your code has changed since this check. Run it again to check the current draft.</p>':''}<div class="test-list">${data.results.map((t,i)=>`<details ${!t.passed && data.results.findIndex(x=>!x.passed)===i?'open':''}><summary><span class="test-icon ${t.passed?'ok':''}">${t.passed?'✓':'!'}</span>${esc(t.name)}<span>${t.passed?'Passed':esc(t.errorType || 'Different result')}</span></summary><div class="test-detail"><label>Input</label><pre>${esc(JSON.stringify(t.input))}</pre><div class="expected-actual"><div><label>Expected</label><pre>${esc(py(t.expected))}</pre></div><div><label>Actual</label><pre>${t.actual===undefined?'(not produced)':esc(py(t.actual))}</pre></div></div>${t.error?`<pre class="error-output">${esc(t.error)}</pre>`:''}<label>Printed output</label><pre>${esc(t.stdout || '(nothing printed)')}</pre></div></details>`).join('')}</div>${data.status==='passed'?`<div class="next-step"><strong>Give the idea another outing.</strong><p>${exerciseLink(e.followup || e.related[0], 'Try related practice')} or start a fresh revisit below.</p></div>`:''}`;
}
function exercisePage(id,from) {
  const e=ex(id); if(!e)return notFound();
  const r=getRecord(progress,e); progress.lastExercise=id; persist();
  return `${from?`<div class="return-banner"><span>You're practicing a smaller piece. Your original draft is saved.</span>${exerciseLink(from,'← Return to '+ex(from).title)}</div>`:`<a class="back-link" href="#problems">← Browse problems</a>`}<div class="exercise-heading"><div><span class="eyebrow">${e.kind==='challenge'?'INTEGRATED CHALLENGE':e.kind==='variation'?'TRANSFER PRACTICE':'SKILL PRACTICE'} · ${esc(e.format)} · ~${e.minutes} MIN</span><h1>${esc(e.title)}</h1></div><div>${badge(r)}<p class="small">${esc(e.difficulty)} in this collection</p></div></div><div class="workspace"><section class="lesson-panel panel"><div class="tabs" role="tablist" aria-label="Exercise guidance"><button role="tab" id="tab-task" data-tab="task" aria-selected="${activeTab==='task'}" aria-controls="lesson-body">Task</button><button role="tab" id="tab-support" data-tab="support" aria-selected="${activeTab==='support'}" aria-controls="lesson-body">Hints & help ${r.hints.length?'· '+r.hints.length:''}</button><button role="tab" id="tab-trace" data-tab="trace" aria-selected="${activeTab==='trace'}" aria-controls="lesson-body">Step through</button></div><div id="lesson-body" role="tabpanel" aria-labelledby="tab-${activeTab}">${activeTab==='task'?taskContent(e):activeTab==='support'?supportContent(e,r):visualMarkup(traceStep)}</div>${prerequisites(e,r,from)}</section><div class="work-column"><section class="editor-panel"><div class="editor-heading"><label for="code">Your Python</label><span id="save-state">${storageHealthy?'Draft saved locally':'Backup needed'}</span></div><textarea id="code" spellcheck="false" autocapitalize="off" autocomplete="off" autocorrect="off" aria-describedby="editor-help" maxlength="50000">${esc(r.draft)}</textarea><div class="editor-foot"><span id="editor-help">4 spaces to indent · Tab moves focus</span><span>Python script</span></div><div class="run-controls"><button class="primary" data-action="run" ${running?'disabled':''}>▶ &nbsp; Run / Check <kbd>Ctrl ↵</kbd></button><button data-action="cancel" ${running?'':'disabled'}>Stop</button></div></section><div class="assistance-panel"><label class="check-label"><input id="external-help" type="checkbox" ${r.externalHelp?'checked':''}> I received external help on this attempt</label><label class="check-label"><input id="independent" type="checkbox" ${hasHelp(assistance(r))?'disabled':''}> I worked this attempt without help</label><p class="small" id="independence-note">${hasHelp(assistance(r))?'Assistance is recorded for this attempt. Try a fresh revisit or related exercise when you want another independent attempt.':'Optional self-report, saved with your next run. An unchecked box does not imply independence.'}</p></div><section id="feedback" class="panel feedback" aria-label="Check feedback" aria-live="polite">${resultContent(e,r)}</section><section class="panel external-help"><h3>Bring the specific gap to your tutor</h3><label for="confusion">Where are you stuck? <span class="quiet">Optional</span></label><textarea id="confusion" rows="2" maxlength="2000" placeholder="For example: Why does position reach the list length?">${esc(r.confusion)}</textarea><button data-action="help-context">Copy context for help ↗</button><p class="small">Creates a message to review and copy. No AI is built in, and nothing is sent.</p></section><details class="attempt-history panel"><summary>Attempt history & fresh revisit (${r.attempts.length} checks)</summary><p>A fresh revisit saves this draft in your history and starts from the starter code. Previous help remains in the record.</p><button data-action="revisit" ${running?'disabled':''}>Save draft & start a fresh revisit</button>${r.archivedDrafts.map((a,i)=>`<details><summary>Saved draft ${i+1} · ${esc(new Date(a.at).toLocaleString())}</summary><pre>${esc(a.code)}</pre></details>`).join('')}${[...r.attempts].reverse().slice(0,10).map(a=>`<details><summary>${esc(a.result.status)} · ${esc(new Date(a.at).toLocaleString())} · ${hasHelp(a.assistance)?'help recorded':a.independent?'reported independent':'assistance unreported'}</summary><pre>${esc(a.code)}</pre></details>`).join('')}</details></div></div>`;
}
function backupPage() {
  const rows=Object.entries(progress.records);
  return `<div class="page-heading"><span class="eyebrow">YOUR PRACTICE NOTEBOOK</span><h1>Keep the work you've put in.</h1><p>Drafts and progress live in this browser at this local address. A backup lets you restore them in another browser or after clearing browser data.</p></div><div class="backup-grid"><section class="panel"><span class="eyebrow">TAKE A COPY</span><h2>Export your progress</h2><p>One versioned JSON file includes drafts, checks, hints, and reported help. Export regularly, especially before changing devices or browsers.</p><button class="primary" data-action="export">Download progress backup</button>${!storageHealthy?'<button data-action="recover-storage">Download original browser data</button>':''}<button data-action="export-drafts">Download current drafts only</button><p class="small">Draft-only backups keep current code, notes, and assistance; they omit previous drafts and check history. Full backups are limited to 5 MB. Up to 100 checks and 10 previous drafts are kept per exercise. Backups contain your code and notes; keep them somewhere you trust.</p></section><section class="panel"><span class="eyebrow">PICK UP ELSEWHERE</span><h2>Restore a backup</h2><p>The file is checked before anything changes. You will review a valid backup before replacing your current progress.</p><label class="file-label" for="import-file">Choose a progress backup</label><input id="import-file" type="file" accept=".json,application/json"><p id="import-error" role="alert"></p></section></div><section><div class="section-heading"><h2>Your recorded practice</h2><span class="quiet">No mastery scores. No streak to protect.</span></div>${rows.length?`<div class="progress-table">${rows.sort((a,b)=>b[1].updatedAt.localeCompare(a[1].updatedAt)).map(([id,r])=>`<div>${exerciseLink(id)}${badge(r)}<span class="quiet">${r.attempts.length} checks</span></div>`).join('')}</div>`:'<div class="empty-state"><p>Your first draft will start this notebook.</p><a href="#home">Choose a starting point →</a></div>'}</section>`;
}
function notFound(){return '<div class="empty-state"><h1>That page is not in this notebook.</h1><a href="#home">Return to Continue →</a></div>';}
function render(focus=false) {
  const {page,id,from}=route();
  document.querySelectorAll('[data-nav]').forEach(a=>{const active=a.dataset.nav===(page==='skill'?'skills':page==='exercise'?'problems':page);if(active)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
  $('#main').innerHTML=page==='home'?home():page==='skills'?skillList():page==='skill'?skillPage(id):page==='problems'?problemBrowser():page==='exercise'?exercisePage(id,from):page==='backup'?backupPage():notFound();
  document.title=`${page==='exercise' && ex(id)?ex(id).title:page==='skill' && sk(id)?sk(id).title:'Python practice'} · Fieldnotes`;
  if(page==='problems') {for(const key of ['kind','skill','status','difficulty','source']) $(`#filter-${key}`).value=filters[key];filterProblems();}
  if(focus) {$('#main').focus({preventScroll:true});window.scrollTo(0,0);}
}
function refreshFeedback() {const {page,id}=route();if(page==='exercise'&&ex(id))$('#feedback').innerHTML=resultContent(ex(id),getRecord(progress,ex(id)));}
async function run() {
  const {page,id}=route();if(page!=='exercise'||running||!ex(id))return;
  const e=ex(id),r=getRecord(progress,e),code=r.draft,independent=$('#independent').checked;
  running=true;runExercise=id;runNote='Preparing a fresh Python environment…';
  render();
  let result;
  try { result=await runner.run(e,code,note=>{runNote=note;const el=$('#run-note');if(el)el.textContent=note;}); }
  catch(error){result={status:'error',results:[],message:error.message || 'The Python runtime could not load. See setup instructions.'};}
  running=false;runExercise=null;
  recordRun(r,result,code,independent);persist();
  if(route().page==='exercise' && route().id===id){const editing=document.activeElement?.id==='code';const selection=editing?[$('#code').selectionStart,$('#code').selectionEnd,$('#code').scrollTop]:null;render();if(editing){$('#code').focus({preventScroll:true});$('#code').setSelectionRange(selection[0],selection[1]);$('#code').scrollTop=selection[2];}else{$('#feedback').setAttribute('tabindex','-1');$('#feedback').focus({preventScroll:true});$('#feedback').scrollIntoView({block:'nearest',behavior:'instant'});}}
  else {
    document.querySelectorAll('[data-action="run"], [data-action="revisit"]').forEach(button => {button.disabled=false;});
    const stop=$('[data-action="cancel"]');if(stop)stop.disabled=true;
    notify(`${e.title}: ${result.status}. Results are saved.`);
  }
}
function download(filename,text,type='application/json') {const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function exportData(draftsOnly=false) {
  try { const data=exportProgress(progress,exercises,skills,draftsOnly);download(`python-fieldnotes-${draftsOnly?'drafts-':''}${new Date().toISOString().slice(0,10)}.json`,data); }
  catch(error) {notify(`${error.message} Use a draft backup from Progress & backups to preserve current code without check history.`);}
}
function saveEditor() {const {page,id}=route();if(page!=='exercise'||!ex(id))return;const r=getRecord(progress,ex(id));if($('#code'))r.draft=$('#code').value;if($('#confusion'))r.confusion=$('#confusion').value;r.updatedAt=new Date().toISOString();persist();}
function refreshLesson() {const action=document.activeElement?.dataset.action;const {id}=route(),e=ex(id),r=getRecord(progress,e); const body=$('#lesson-body');body.innerHTML=activeTab==='task'?taskContent(e):activeTab==='support'?supportContent(e,r):visualMarkup(traceStep);body.setAttribute('aria-labelledby',`tab-${activeTab}`);document.querySelectorAll('[data-tab]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.tab===activeTab)));$('#tab-support').textContent=`Hints & help${r.hints.length?' · '+r.hints.length:''}`;if(action)restoreActionFocus(action,body);}
function restoreActionFocus(action,container){let target=container.querySelector(`[data-action="${action}"]:not(:disabled)`);if(!target&&action.startsWith('trace-'))target=container.querySelector('[data-action="trace-prev"]:not(:disabled)');if(target)target.focus({preventScroll:true});else{container.setAttribute('tabindex','-1');container.focus({preventScroll:true});}}
function syncHelp() {const {id}=route(),r=getRecord(progress,ex(id));updateAssistance(r);persist();const visibleBadge=$('.exercise-heading .status');if(visibleBadge)visibleBadge.outerHTML=badge(r);if(hasHelp(assistance(r))){$('#independent').checked=false;$('#independent').disabled=true;$('#independence-note').textContent='Assistance is recorded for this attempt. Try a fresh revisit or related exercise when you want another independent attempt.';}}

document.addEventListener('input',event=>{
  if(event.target.id==='code'){saveEditor();$('#save-state').textContent=storageHealthy?'Draft saved locally':'Backup needed';refreshFeedback();}
  if(event.target.id==='confusion')saveEditor();
  if(event.target.id==='search'){filters.search=event.target.value;filterProblems();}
});
document.addEventListener('change',async event=>{
  const el=event.target;
  if(el.id.startsWith('filter-')){filters[el.id.slice(7)]=el.value;filterProblems();}
  if(el.dataset.confusing){progress.confusingSkills=el.checked?[...new Set([...progress.confusingSkills,el.dataset.confusing])]:progress.confusingSkills.filter(id=>id!==el.dataset.confusing);persist();notify(el.checked?'This skill will appear in your suggestions.':'Suggestion preference saved.');}
  if(el.id==='external-help'){const r=getRecord(progress,ex(route().id));r.externalHelp=el.checked;syncHelp();render();$('#external-help').focus();}
  if(el.id==='import-file'&&el.files[0]){
    try {if(el.files[0].size>5_000_000)throw new Error('Backup is too large (maximum 5 MB).');pendingImport=importProgress(await el.files[0].text(),exercises,skills);$('#import-summary').textContent=`Valid version 1 backup with ${Object.keys(pendingImport.records).length} exercise records and ${Object.values(pendingImport.records).reduce((n,r)=>n+r.attempts.length,0)} recorded checks.`;$('#import-dialog').showModal();$('#import-error').textContent='';}
    catch(error){$('#import-error').textContent=error.message;pendingImport=null;}
    el.value='';
  }
});
document.addEventListener('click',async event=>{
  const el=event.target.closest('button, a');if(!el)return;
  if(el.hasAttribute('data-catalog-link') && el.getAttribute('href')===location.hash){event.preventDefault();applyCatalogRoute();render(true);return;}
  if(el.classList.contains('skip-link')){event.preventDefault();$('#main').focus();return;}
  if(el.dataset.prereq){saveEditor();const e=ex(route().id),r=getRecord(progress,e);r.prerequisites=[...new Set([...r.prerequisites,el.dataset.prereq])];updateAssistance(r);persist();}
  if(el.dataset.tab){activeTab=el.dataset.tab;refreshLesson();return;}
  const action=el.dataset.action;if(!action)return;
  const {page,id}=route(),e=ex(id),r=e?getRecord(progress,e):null;
  if(action==='run')await run();
  else if(action==='cancel')runner.cancel();
  else if(action==='hint'){r.hints.push(r.hints.length);syncHelp();refreshLesson();}
  else if(action==='explanation'){if(!r.explanation){r.explanation=true;syncHelp();refreshLesson();}else {notify('Explanation use remains recorded. Choose the Task tab to return to the instructions.');}}
  else if(action==='solution'){r.solution=true;syncHelp();refreshLesson();}
  else if(action.startsWith('trace-')){traceStep=action==='trace-reset'?0:Math.max(0,Math.min(traceStates.length-1,traceStep+(action==='trace-next'?1:-1)));if(page==='exercise')refreshLesson();else {$('#visual-panel').innerHTML=visualMarkup(traceStep);restoreActionFocus(action,$('#visual-panel'));}}
  else if(action==='help-context'){saveEditor();$('#help-message').value=helpContext(e,r,exercises);$('#copy-status').textContent='Review the message, then copy it. The worked solution is excluded.';$('#context-dialog').showModal();}
  else if(action==='copy-context'){try {await navigator.clipboard.writeText($('#help-message').value);$('#copy-status').textContent='Copied. Paste this into your external chat.';}catch{$('#help-message').focus();$('#help-message').select();$('#copy-status').textContent='Clipboard access was unavailable. The message is selected: press Ctrl+C, or download the text.';}}
  else if(action==='select-context'){$('#help-message').focus();$('#help-message').select();}
  else if(action==='download-context')download('python-help-context.txt',$('#help-message').value,'text/plain');
  else if(action==='close-dialog')$('#context-dialog').close();
  else if(action==='export')exportData();
  else if(action==='export-drafts')exportData(true);
  else if(action==='recover-storage'){try{download('python-fieldnotes-recovery.txt',localStorage.getItem('python-fieldnotes.v1') || '', 'text/plain');}catch{notify('Browser storage cannot be read. Export the current in-memory progress instead.');}}
  else if(action==='close-import'){$('#import-dialog').close();pendingImport=null;}
  else if(action==='confirm-import'&&pendingImport){if(running){notify('Stop the active Python check before restoring a backup.');return;}try {saveProgress(localStorage,pendingImport);progress=pendingImport;pendingImport=null;storageHealthy=true;$('#storage-warning').hidden=true;$('#import-dialog').close();render();notify('Backup restored. Your drafts are ready.');}catch{notify('Could not save the import. Your current progress has not changed.');}}
  else if(action==='revisit'&&!running){saveEditor();progress.records[id]=beginRevisit(r,e.starter);persist();activeTab='task';render();notify('Previous draft saved in history. A fresh revisit is ready.');$('#code').focus();}
  else if(action==='clear-filters'){Object.keys(filters).forEach(k=>filters[k]='');render();}
});
document.addEventListener('keydown',event=>{
  if(event.ctrlKey&&event.key==='Enter'&&!$('#context-dialog').open&&!$('#import-dialog').open){event.preventDefault();run();}
  if(event.target.id==='code'&&event.key==='Enter'&&!event.ctrlKey&&!event.metaKey){const ta=event.target;const start=ta.selectionStart;const line=ta.value.slice(0,start).split('\n').at(-1);const indent=(line.match(/^ */)?.[0] || '')+(line.trimEnd().endsWith(':')?'    ':'');event.preventDefault();if(ta.value.length-(ta.selectionEnd-start)+1+indent.length>50000){notify('The editor limit is 50,000 characters. Remove some text before adding a line.');return;}ta.setRangeText('\n'+indent,start,ta.selectionEnd,'end');ta.dispatchEvent(new Event('input',{bubbles:true}));}
  if(event.target.matches('[role="tab"]')&&['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();const tabs=[...document.querySelectorAll('[data-tab]')];const index=tabs.indexOf(event.target);const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(index+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;tabs[next].click();tabs[next].focus();}
});
window.addEventListener('hashchange',()=>{activeTab='task';traceStep=0;applyCatalogRoute();render(true);});
window.addEventListener('beforeunload',()=>{persist();runner.cancel();});
applyCatalogRoute();
render();
