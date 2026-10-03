# Python Fieldnotes

A local Python practice notebook to accompany the Helsinki Python MOOC. It contains seven connected skill units, 25 skill exercises, 14 integrated challenges (10 LeetCode Easy adaptations), and 14 transfer variations. All 53 items have prepared guidance, a reference solution, and real Python checks. Completing them records practice; it does not certify mastery or interview readiness.

## Setup in Windows 11 / WSL2

Use a WSL terminal in VS Code. Node.js 22 or newer and npm are needed to serve the app. Python 3 is needed for developer checks, but the learner's Python programs run in the browser.

From this project directory:

```bash
npm install
npm run check
npm start
```

Open **http://localhost:4173** in your Windows browser. Keep the WSL terminal open. Press **Ctrl+C** in that terminal to stop the server. For later sessions, the launch command is simply:

```bash
npm start
```

The initial install needs internet access. It downloads the pinned Pyodide runtime and the optional browser-test dependency. Runtime files are served from `node_modules/pyodide`; retain that directory for offline use. There are no CDN scripts, remote fonts, AI calls, accounts, analytics, or API keys. Official problem links and the external tutor you choose require their own internet access.

The server binds to `127.0.0.1`. If port 4173 is already used, `PORT=4174 npm start` selects another loopback port. Browser storage belongs to the exact origin: another port, `127.0.0.1` instead of `localhost`, another browser, or a private window has a separate notebook. Export before switching.

**Verification status:** runtime assets are now installed, and the user reports the app runs locally. Native tests and a separate Pyodide/WebAssembly audit run here. This managed environment still denies loopback access and lacks a Chromium binary, so browser layout, keyboard interaction, and offline browser behavior remain unverified here. See [the verification record](docs/VERIFICATION.md) for exact results and limits.

## Upload to your GitHub from VS Code

Publishing stores the project files in your GitHub account so another computer can clone them. The practice app has no GitHub login or automatic upload. A Git commit records a local version; publishing uploads it. The account used in your browser or VS Code is separate from the name and email recorded in a commit.

These are steps for you to perform in VS Code on your Windows/WSL computer:

1. Open this project's folder in your WSL-connected VS Code window. In its terminal, `git --version` should print a version. Open **Source Control** and select **Initialize Repository** if the folder has no repository yet.
2. Review the files in Source Control, then stage the app files with the **+** button beside Changes. Include `package.json`, `package-lock.json`, `.gitignore`, `index.html`, `src/`, `public/`, `scripts/`, `tests/`, and the documentation. The existing `.gitignore` excludes installed dependencies, local tool folders, and app-generated personal exports.
3. Enter a commit message such as `Add Python Fieldnotes practice app` and select **Commit**. If Git requests an author identity, set it for this repository using the commands below, replacing the placeholders, then retry the commit. A GitHub-provided noreply email is also suitable.
4. Open the Command Palette with **Ctrl+Shift+P**, run **Publish to GitHub**, and complete any browser sign-in prompt. Choose your personal account, a repository name such as `python-fieldnotes`, and **Private repository** for personal use.
5. Open the resulting GitHub repository and confirm that the README, source folders, and `package-lock.json` are present. The project is now ready to clone. Future edits need a new commit and **Push** to appear on GitHub.

If Git requests an author identity, run these inside the initialized project folder:

```bash
git config user.name "Your Name"
git config user.email "YOUR_EMAIL_OR_GITHUB_NOREPLY_EMAIL"
```

VS Code's built-in Git support handles sign-in when needed; installing the separate GitHub CLI is optional. See the official [first-commit and publishing guide](https://code.visualstudio.com/docs/sourcecontrol/quickstart) and [GitHub authentication guide](https://code.visualstudio.com/docs/sourcecontrol/github).

## Clone and run on a Mac

The app uses a local Node server and browser-based Python, so the same source is intended to work on macOS without WSL, Docker, or a Python virtual environment. It has not yet been tested on a Mac.

1. Install VS Code, Git, and **Node.js LTS with npm**. The app requires Node.js 22 or newer; the current LTS installer is a suitable choice from the [official Node.js download page](https://nodejs.org/en/download). If Git is missing, `xcode-select --install` installs Apple's Command Line Tools, which include Git; see [Git's macOS installation guide](https://git-scm.com/install/mac). In a new terminal, `git --version`, `node --version`, and `npm --version` should each print a version.
2. In VS Code, press **Cmd+Shift+P**, choose **Git: Clone**, select **Clone from GitHub**, and sign in to the same GitHub account if prompted. Select your `python-fieldnotes` repository, choose a local parent folder such as `~/Projects`, and open the cloned project. This downloads the files onto your Mac; see the official [cloning instructions](https://code.visualstudio.com/docs/sourcecontrol/repos-remotes).
3. Open **Terminal → New Terminal** in that project and run:

```bash
npm ci
npm start
```

`npm ci` installs the versions recorded in `package-lock.json`; it needs internet for the first installation. It installs Pyodide (the app's Python runtime) and the developer test package. No pip packages, API keys, database, or separate native Python installation are needed to practice. See [npm's clean-install documentation](https://docs.npmjs.com/cli/v11/commands/npm-ci/).

Open **http://localhost:4173** in a current browser. Keep the terminal running, and stop with **Ctrl+C**. In future sessions, open the project and run only `npm start`. Keep `node_modules/` on the Mac for local practice after setup; each computer installs its own copy.

For development checks (`npm run check` and `npm test`), install Python 3 so `python3 --version` works. Browser acceptance tests additionally need Playwright's Chromium download, as described in Development and verification below. These tools are not needed for normal practice. Use a project path without spaces, such as `~/Projects/python-fieldnotes`, if running developer checks: the current check scripts do not consistently handle spaces in file URLs, although the app server does.

## Move your learning progress between computers

GitHub carries the app's source. Your drafts, attempts, and help history live in each browser and are not automatically synchronized by cloning or pulling the repository.

1. On the old computer, open **Progress & backups → Download progress backup**.
2. Transfer that JSON file to your Mac through your usual file-transfer method.
3. In the app on the Mac, open **Progress & backups → Choose a progress backup**, select the file, and choose **Restore validated backup** after reviewing it.

Restoration replaces the notebook in the destination browser rather than merging two notebooks. Export that browser's progress first if it already contains work. Keep personal backups outside the repository; their generated filenames are also ignored by Git if accidentally saved inside it.

## Finding the full collection

The two or three cards on **Continue** are recommendations, not the whole collection. Use **Browse all 14 challenges** or the **10 LeetCode adaptations** shortcut. Browse now displays how many items match out of the full collection and keeps **Clear all filters** visible. Search accepts official problem names and numbers as well as learning topics.

Challenges have an optional suggested order: **Start here**, **Combine skills**, and **Next stretch**. Each card explains its practice focus. Later challenges introduce remainders, lookup chains, consecutive runs, or nested loops through smaller prerequisite exercises. LeetCode's Easy label does not mean every problem will feel easy at this stage.

| Suggested step | Challenge | Main practice |
| --- | --- | --- |
| 1 | Copy a list | Positions, loop progression, append |
| 2 | Final value after operations · LeetCode 2011 | Updating one number from conditions |
| 3 | Repeat a list twice · LeetCode 1929 | Complete sequence and a second pass |
| 4 | Count readings below a limit | Counting matches without missing progression |
| 5 | Keep readings within a range | Combining conditions and filtering |
| 6 | Running totals · LeetCode 1480 | Update, then record the current total |
| 7 | Find the greatest value | Best-so-far, negatives, and ties |
| 8 | Kids with greatest candies · LeetCode 1431 | A greatest value and Boolean results |
| 9 | Shuffle the array · LeetCode 1470 | Two halves, one position and an offset |
| 10 | Divisibility sums difference · LeetCode 2894 | Remainders and two accumulators |
| 11 | Build array from permutation · LeetCode 1920 | A stored value becomes a lookup position |
| 12 | Max consecutive ones · LeetCode 485 | Current run versus longest run |
| 13 | Richest customer wealth · LeetCode 1672 | Read rows and reset the inner total |
| 14 | Number of good pairs · LeetCode 1512 | Distinct pairs of positions, without double counting |

Every challenge has a separate original variation. For example, finding a scalar greatest wealth leads to collecting all tied customer positions; counting equal pairs leads to returning their positions. Existing drafts, checks, and version 1 backups remain compatible.

## Your first 15–30 minutes

1. Choose **Practice a skill → Choose with conditions → One chain or two separate checks?** (the `branch-choice` exercise). Predict the outcome, then run/check. You can also start with the suggested exercise on Continue.
2. Try **Check both ends of a range** (`repair-range-condition`). Compare both boundaries. Use one hint or the direct explanation if you need it.
3. Open **Keep readings within a range** (`range-filter`). Write as much as you can in the time you have. If a piece is missing, visit a prerequisite and use the return link. Your code stays saved.
4. Leave a note about the specific sticking point. Copy context for your external tutor if useful, and export a progress backup before closing.

The Browse problems screen shows the exact current titles. All challenges are open; prerequisites are suggestions. A short session can end with a repaired line, a clearer prediction, or a saved attempt.

## Practice and help

- Programs are plain Python scripts. Each check injects the stated inputs and checks the named `result` variable, including its Python type. `print()` output appears separately. Avoid replacing inputs with one example.
- Use **Run / Check** or **Ctrl+Enter**. Enter continues indentation; a line ending in `:` adds four spaces. Tab moves focus, so the editor is not a keyboard trap.
- Each test gets a new Pyodide interpreter in a worker. **Stop** terminates the active worker. An executing test is stopped after two seconds; runtime loading has a separate 30-second deadline. Output is capped at 8,000 characters. A fresh worker handles the next test/run.
- Hints, a direct explanation, and an explicitly revealed solution are available. Prediction exercises hide their answer examples until you check or request help.
- **Copy context for help** opens a reviewable message with current code, relevant check feedback, recorded help, and your optional note. Nothing is sent automatically. It includes a select-all and text-download fallback. If code changed since checking, both the new draft and the code associated with the old feedback are identified.
- **Step through** is a prepared running-total example, not a trace of arbitrary learner code. Its positions, values, and total transitions have been checked against Python.

## Progress and backups

Drafts autosave on each edit in this browser's localStorage. Visiting an exercise or prerequisite and refreshing preserve them. The app records checks, code snapshots, hints, explanation/solution use, prerequisite visits, and your report of external help.

A pass without an assistance report is labeled **Passed · assistance unreported**. Select **I worked this attempt without help** before a run to report independence. Help recorded for that attempt prevents an independent label. A fresh revisit archives the draft and starts from the starter with separate assistance evidence. A later independently reported pass on a fresh attempt is labeled **Revisited successfully**. These labels describe evidence, not proven understanding.

Open **Progress & backups → Download progress backup** for a version 1 JSON file. Keep it in your usual backup folder. Restore through **Choose a progress backup**, review the validated record count, and select **Restore validated backup**. Invalid imports leave good data untouched. Export before restoring because restoration replaces the current notebook.

Up to 100 checks and 10 archived drafts are retained per exercise. Full backups have a 5 MB limit and are validated before download. **Download current drafts only** provides a smaller, restorable backup preserving current code, notes, and current assistance; it explicitly omits check history and earlier drafts. The app refuses an oversized full backup instead of downloading an unrestorable file. A storage error leaves current work in the tab and shows a persistent backup warning. Private browsing and clearing site data can remove local progress.

## Development and verification

There is no bundler or build step. HTML, CSS, and native JavaScript modules are served directly. The project has one production dependency, Pyodide. The checker is a shared Python file used by both the worker and native verification fixtures.

```bash
npm test
npm run check
```

For a detailed test listing in Node environments that report only child-file summaries:

```bash
node --test --test-isolation=none tests/*.test.mjs
```

Check every reference case and example with the installed WebAssembly Python runtime, without a browser or network fetching:

```bash
node tests/pyodide-catalog.mjs
```

This additional check verifies Python execution and local runtime assets; browser interactions and offline browser behavior require the following suite.

Browser verification requires a one-time browser download:

```bash
npx playwright install chromium
```

Start `npm start` in one terminal, then run this in another:

```bash
npm run test:browser
```

That suite drives the actual learning flow, checks every reference solution in Pyodide, exercises timeout/cancellation recovery, tests backup and help flows, checks a narrow viewport, and saves screenshots under `artifacts/`. It blocks all nonlocal requests in a fresh browser context, so the runtime cannot quietly fall back to a CDN. Screenshot files still need visual inspection. Browser installation may report missing Linux system libraries; follow its installation guidance on your own machine if needed.

## Content and architecture

- `src/content.js`: the public catalog, initial content, learning order, and skill links.
- `src/content-arrays.js`, `src/content-loops.js`: the new attributed challenges and their prepared prerequisites and variations.
- `src/discovery.js`: catalog counts, optional ordering, and source-aware filtering.
- `src/app.js`, `src/style.css`: navigation, exercise workspace, accessible controls, and responsive layout.
- `src/progress.js`: versioned persistence, validation, evidence-based labels and optional recommendations.
- `src/help.js`, `src/visual.js`: external-help message and the prepared example.
- `src/runner.js`, `public/python-worker.js`, `public/checker.py`: worker lifecycle and named-result checker.
- `scripts/server.mjs`: read-only static asset server with loopback binding, an asset allowlist, and restrictive browser policies.

To add a skill, add its stable ID, title, explanation, exercise IDs, and challenge IDs in `skills`. To add an exercise, use the existing `item` shape: goal, injected inputs, boundaries, instructions, starter, examples, hints, explanation, solution, and named test fixtures. Assign valid `skillIds`, `prerequisites`, and `related` IDs. A challenge also links to a genuine transfer exercise with `followup`. State type and input-preservation requirements in the learner contract; optional `checks.distinctFrom` and `checks.preserveInputs` enforce relevant copy contracts.

Add an independent expected-value oracle in the corresponding `tests/content*.test.mjs`; updating the catalog alone is deliberately insufficient. Extend the collection count assertions when intentionally expanding this release, then run the checker and browser suites. Keep IDs stable because backups reference them. A breaking progress schema change needs a new version and a migration. [The content audit](docs/content-audit.md) records boundaries and source distinctions.

The scripts do not run submitted code natively. The only native Python executions in tests are trusted project fixtures and authored reference solutions. Browser Python sees an in-memory filesystem; no host directory is mounted. WebAssembly and the browser provide the execution boundary. Worker termination is a time limit, not a guaranteed strict memory quota for arbitrary hostile programs. This is a personal local practice app, not a public multi-user judging service.

## Source notes

Ten adaptations link directly to verified official LeetCode statements. The source table in [the content audit](docs/content-audit.md) records all URLs and domains. Local descriptions, prerequisites, and variations are original instructional writing. The named-variable script interface differs from LeetCode's submission function interface.

For Max Consecutive Ones, this app explicitly limits local inputs to 1,000 items; the official upper limit is 100,000. The algorithmic task is the same. This keeps beginner feedback and backups manageable. No in-place constant-memory follow-up is required for the permutation challenge.

The runtime design follows Pyodide's official [module worker documentation](https://pyodide.org/en/stable/usage/webworker.html) and [local deployment documentation](https://pyodide.org/en/stable/usage/downloading-and-deploying.html). The dependency is pinned to 314.0.7. The package lock generated during setup keeps the installed dependency versions reproducible.
