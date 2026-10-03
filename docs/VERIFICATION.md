# Verification record — 2026-10-02

The expanded release contains 53 items: seven skill units with 25 smaller exercises, 14 integrated challenges (10 LeetCode adaptations), and 14 transfer variations. All 49 native-Python and JavaScript tests pass. Installed Pyodide also passes the entire catalog through the production checker with network fetching disabled. Browser acceptance remains unverified in this managed environment.

## Expansion verification

- `npm run check` passes: 22 JavaScript files, Python checker syntax, and all five required local runtime assets. The user reports the app runs locally; dependencies are now installed.
- `node --test --test-isolation=none tests/*.test.mjs` passes all 49 tests with no skips. Output is in `artifacts/expanded-native-tests.txt`.
- The native production checker accepts all 262 reference test cases and 79 examples across all 53 items, 34 cases for alternate implementations of the original six challenges, and two freshness checks. Separate expansion tests use independent Python oracles, alternative implementations, boundary inputs, exhaustive small pair/streak cases, and representative incorrect programs. Content links and source contracts are validated.
- `node tests/pyodide-catalog.mjs` loads the installed WebAssembly runtime (Python 3.14.2) in a Node worker and runs the actual `public/checker.py`. All 262 reference cases, 79 examples, and two fresh-state checks pass. `fetch` is disabled and the recorded network request list is empty. Output is in `artifacts/expanded-pyodide.json`. This verifies local runtime assets and Python checking, not browser UI, browser worker cancellation, or browser offline behavior.
- Six discovery tests cover the exact catalog counts, searches for official titles/numbers, combined filters, honest progress filtering, the optional learning order, and restoring every original exercise's draft/history from a version 1 backup unchanged.
- The Continue screen now labels its small recommendation set, links prominently to all 14 challenges and all 10 LeetCode adaptations, and distinguishes smaller exercises and variations. Browse displays filtered counts and a persistent reset. Browser assertions were extended for these paths, including clicking the current shortcut again to clear a narrower search.
- Eight new official LeetCode statements were checked alongside the existing two. Their domains, local interfaces, and any adaptation differences are recorded in `docs/content-audit.md`.

`npm run test:browser` was attempted again and could not reach the local server. Direct loopback access returns `EPERM`, and the expected Playwright Chromium binary is absent. No screenshots were generated and no browser interaction or visual-layout success is claimed. The browser suite remains available for the user's unrestricted local environment.

## Original foundation verification

These initial-release checks remain covered by the expanded passing suite:

- Six skill units, each with three substantive exercises; six integrated challenges, each with a meaningful variation. Every content link resolves. Items include their own explicit contracts, examples, hints, explanation, solution, and cases.
- Independent Python oracles verified all 129 case expectations and 40 examples before comparing reference solutions. This includes one-item lists, allowed empty lists, ties, negatives, duplicates, equality boundaries, all/no matches, and both official problems' maximum list length.
- The production `public/checker.py` accepted all 129 reference test cases and 40 examples using native Python 3.14.4. It also accepted 34 cases using six different correct algorithms. Two consecutive calls checked that stale globals cannot carry over. These 205 calls verify the checker function, not its Pyodide/browser integration.
- Representative incorrect programs produce useful feedback: off-by-one indexing, wrong append receiver, replacement instead of accumulation, syntax errors, missing result variables, wrong Python types, and copy aliasing. Output is bounded; unusual/cyclic/deep/large answers remain serializable and valid backup data.
- JavaScript worker lifecycle tests, using controlled worker doubles, verify fresh worker allocation, termination, cancellation and later recovery, and a nonresponding worker's timeout. A real runaway Python program has **not** been exercised in a browser here.
- Progress tests verify drafts and snapshots through save/reload/export/import, nested invalid-data refusal without erasing existing storage, explicit independence reports, all five assistance sources, assistance reported after reload, and a distinct successful revisit. Same-millisecond revisit IDs and malformed extreme timestamps are covered.
- Help-context tests verify current code, accurately identified stale feedback, source/contract, relevant input/expected/actual/error/output, used hints/prerequisites, and an optional confusion note; no hidden reference solution or filesystem paths are added.
- Prepared visualization states match a line-event trace of the displayed Python program under native Python. The visualization is explicitly labeled a prepared example.
- Eight direct server-handler tests verify GET/HEAD behavior, MIME types, runtime asset names, unrelated-file and machine-path refusal, traversal and symlink rejection, host/method guards, CSP headers, and missing-runtime errors. Temporary fixtures and response streams exercise the real handler without opening a socket.
- Full and draft-only exports use the import validator before downloading. Oversized full exports are refused; a separate clearly labeled draft-only option preserves current work without mutating stored history. Size checks use UTF-8 bytes, matching the file picker.

Historical test output is saved in `artifacts/native-tests.txt`; use `artifacts/expanded-native-tests.txt` for the current suite. Browser screenshots are intentionally absent because no browser was launched.

## Initial environment failures — historical raw output

Dependency installation has since been completed by the user, and the current syntax/runtime checks pass. The original failures below explain the initial verification boundary; loopback and browser restrictions persist here.

Package installation:

```text
npm error code EAI_AGAIN
npm error syscall getaddrinfo
npm error request to https://registry.npmjs.org/@playwright%2ftest failed, reason: getaddrinfo EAI_AGAIN registry.npmjs.org
```

The request to run installation with elevated permissions was rejected by the environment's granular approval policy (`sandbox_approval: false`). No alternate route around the network restriction was attempted. No cached Pyodide runtime or browser binary was found in the inspected tool/cache/system locations.

`npm run check` syntax checks completed, then its local-runtime check correctly failed:

```text
Local Python runtime assets are missing. Run npm install with internet access, then run npm run check again.
```

`npm start`:

```text
listen EPERM: operation not permitted 127.0.0.1:4173
```

`npm run test:browser`:

```text
Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@playwright/test' imported from .../tests/browser.mjs
```

## Remaining acceptance checks

On the user's machine, run `npm run check`, install Chromium for Playwright, start the app with `npm start`, and run `npm run test:browser` in another terminal. The suite is present and syntax checked; it has not executed here. Its intended assertions cover:

- Actual browser Pyodide checking of all 53 reference solutions, 262 cases, with locally served runtime files.
- Continue-to-catalog discovery, all 14 challenge cards, all 10 LeetCode adaptations, official-number search, shortcut filter reset, and all three optional learning stages.
- A full learner cycle: draft, reload, prerequisite and return, hints, revealed solution, retry, explicit independent revisit, and subsequent help disclosure.
- Real syntax/result errors, missing increment, runaway timeout, cancellation, output limits, and successful next execution.
- Ctrl+Enter, skip link, visible actions, clipboard fallback, current help context, source/type/difficulty filters, and backup restoration/rejection.
- A cold browser context that blocks every external request, so offline core operation cannot be satisfied by a cached CDN resource.
- Desktop and 390-pixel layout screenshots, no horizontal page overflow, and reduced-motion preference. Visually inspect the resulting screenshots and keyboard focus after the suite completes.

The static UI review fixed an invalid skip-link route, editor indentation exceeding the code limit, stale independence badges after assistance, loss of keyboard focus after dynamic help/trace changes, missing source labels in browsing, string values misformatted as Booleans, and import-during-run state detachment. These fixes pass syntax review; their actual browser behavior still needs the above acceptance run.

## Implementation boundaries

The server serves only allowlisted local assets on loopback. It does not execute submitted code, expose a shell, mount host files into Python, publish anything, or contain AI/network integrations. Worker execution has deadlines and output limits, but no custom hard memory quota. Arbitrarily memory-intensive Python can still exhaust a browser tab before a deadline. No hostile-code hosting or public deployment is claimed.

A restrictive Content Security Policy permits same-origin resources and WebAssembly. It should be verified against the installed runtime in the browser suite. External links are optional navigation; they do not provide core runtime assets.

No commit, push, publishing, credential access, unrelated system changes, or vault writes were performed. Project-only notes preserve the implementation state; the user's project-boundary instruction takes precedence over generic learning-capture workflows.
