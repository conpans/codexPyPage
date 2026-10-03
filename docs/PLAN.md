# Plan: Python Fieldnotes

Spec: user implementation request, 2026-10-02
Base branch: none; workspace is empty and not a Git repository
Verify: `npm run check`, `npm test`, `npm run test:browser`

## Decisions

- Build a local static website with native JavaScript modules and accessible HTML controls. Keep dependencies to Pyodide and a browser test tool.
- Run Python inside terminable browser workers, with local runtime assets and no host filesystem mounts. Serve only application assets on 127.0.0.1:4173.
- Store drafts and evidence in versioned localStorage; offer validated JSON backups. Independence is self-reported for each successful attempt.
- Keep authored content in one catalog. Use six shared skill units, six integrated challenges, and six transfer variations.
- Follow the user's explicit authorization to implement and verify in this session. The general shaping and planning approval rounds do not add an extra gate to this fully specified request. Available native collaborating agents implement independent file sets; a separate review pass will audit the result. No cross-vendor reviewer is available through these tools.

## Task 1: Complete learning flow

Goal: open running totals, edit code, check real Python, save draft, visit prerequisite and return.
Files: index.html, src/app.js, src/style.css, src/progress.js, src/help.js; runtime agent owns src/runner.js, public/python-worker.js, public/checker.py, scripts/server.mjs, scripts/check.mjs.
Interfaces: content exercises provide injected input variables, a named result variable, prepared help and JSON test cases; createRunner().run(exercise, code, onProgress) returns test results; cancel terminates work.
Steps: build navigation and exercise layout; integrate worker checker; verify one reference program in browser.
Verify: browser flow checks expected result, saved code, prerequisite return.
Done means: one complete usable flow works.

## Task 2: Complete catalog (parallel with task 1)

Goal: provide all requested skills, challenges and transfer practice.
Files: src/content.js, tests/content.test.mjs, docs/content-audit.md.
Steps: author explicit exercise contracts and teaching content; add boundary cases and independent expected-value checks; audit links and reference solutions.
Verify: content tests and every reference solution through browser checker.
Done means: 30 complete exercises with resolving links and valid expected results.

## Task 3: Continuity and visual learning

Goal: support honest progress, backup, help context, and concrete variable tracing.
Files: src/progress.js, src/help.js, src/visual.js, tests/progress.test.mjs.
Steps: persist attempts and assistance; validate imports before replacing data; build prepared step-through example and compare states to Python.
Verify: saved drafts survive reload; invalid import preserves storage; help text includes current draft and prior run; visual states agree with Python.
Done means: all continuity and assistance flows function.

## Task 4: Verification and delivery

Goal: fix issues surfaced by actual learner flows.
Files: tests/browser.mjs, README.md, docs/VERIFICATION.md, artifacts/.
Steps: run incorrect solutions and timeout recovery; verify keyboard and responsive views; deny external network and run a fresh browser context; record exact evidence and launch instructions.
Verify: all project checks pass and screenshots reviewed.
Done means: working local app with documented setup, backup, content extension and limitations.
