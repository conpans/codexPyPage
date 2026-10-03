# Content audit

The public catalog in `src/content.js` joins the initial content with `src/content-arrays.js` and `src/content-loops.js`: seven skill units, 25 skill exercises, 14 integrated challenges, and 14 follow-up variations. Every entry specifies inputs, its output contract, boundaries, examples, three prepared hints, an explanation, a reference script, and named test cases. A check reads `result`; printing is optional and does not satisfy the contract by itself. There are no construct restrictions. Skill prerequisites are suggestions, not gates.

## Original foundation coverage

| Unit | Practice | Reused by challenges |
| --- | --- | --- |
| Assignments | Saved length; updating balance; replacement versus accumulation | Repetition, running totals, greatest value |
| Positions | Reading an item; final valid index; position versus saved value | All six challenges |
| Loops | Strict boundary; advancing; countdown transfer | All six challenges |
| Conditions | Branch chain versus separate checks; `not`; inclusive range | Counting, filtering, greatest value |
| Accumulators | Sum; product; count | Running totals, counting, greatest value |
| Append | Receiving list; wrong receiver repair; calculated output item | Copying, repetition, running totals, filtering |

The six variations change the task: reverse output order, repeat each item rather than the sequence, subtract costs from a budget, reset a consecutive count, return positions instead of values, and collect every tied greatest position. `count-streak` and `greatest-positions` are marked Stretch relative to this small collection.

Prediction exercises use fixed traces. Their examples contain the answer, so the learner interface must withhold those examples until intentional solution disclosure. Their result contract remains visible, and checking a prediction supplies feedback. Other exercises show input/output examples normally.

## Verification of the original foundation

Run `node tests/content.test.mjs` for the detailed native-Python audit. It verifies 129 test cases and 40 examples across all thirty items. Before running a reference script, an independent Python oracle calculates each expected answer. The oracles use built-ins, comprehensions, sorting, reverse slices, and prefix properties instead of reproducing reference while loops. Type-aware comparison distinguishes a Boolean from an integer. All 169 cases agreed with their independent oracle and their reference script on October 2, 2026.

The structural audit verifies every skill/problem link, follow-up relationship, content field, and source attribution across the expanded 53-item catalog. The copy and reverse-copy contracts additionally check a separate result list and unchanged original input.

Reviewed teaching claims include:

- A saved integer length does not change when its source list grows; assigning a list name is not a copy.
- Forward nonnegative positions stop before the length. Negative indexing is a separate Python convention.
- `not` evaluates a Boolean without assigning to its operand.
- The first matching branch wins in an `if`/`elif` chain; separate `if` statements each run a check.
- Empty sum and empty product use 0 and 1 respectively; `append()` returns `None`.
- Greatest-value initialization must handle all-negative input. Ties affect the positions variation but not the scalar greatest value.

Boundary cases include empty lists wherever allowed, one-item lists, equal range endpoints, exact thresholds, repeated values, mixed signs, zeros, all/no matches, all-negative greatest values, and ties. Both LeetCode adaptations include their maximum input length of 1,000. Running totals also exercise the maximum item magnitude and a total of one billion. Those checks are within Python's integer domain.

This native audit verifies content independently. It does not replace browser checks of the actual Pyodide checker, cancellation, error feedback, storage, or UI. The project's end-to-end suite covers those separately, but could not run in this managed environment; see VERIFICATION.md for the remaining checks.

## Expansion: eight more challenges with preparation

The eight new integrated challenges each have their own original transfer variation. Seven additional smaller exercises cover Boolean comparison results, second-half offsets, using a stored index for another lookup, remainder conditions, reading nested lists, resetting row totals, and visiting distinct pairs. The last three form the seventh unit, Work through rows and pairs.

The optional ordering begins with existing assignments/conditions/forward loops, then combines pieces, then introduces lookup chains, runs, rows, and pairs. Every challenge remains open. All original IDs and the version 1 progress schema are unchanged; compatibility tests restore drafts and historical evidence for all 30 original items.

`tests/content-arrays.test.mjs` and `tests/content-loops.test.mjs` independently compute each new example/check, run the actual production checker, verify alternatives, and probe likely mistakes. `tests/checker-catalog.test.mjs` runs every expanded reference through the production checker. `tests/pyodide-catalog.mjs` additionally runs all 53 authored solutions in the installed WebAssembly Python runtime with network fetching disabled. These checks distinguish Python/runtime correctness from unverified browser UI behavior.

## Verified official sources and local domains

All ten are labeled Easy on LeetCode. The descriptions here are original practice adaptations, and the local script interface injects inputs and checks `result` instead of requiring LeetCode's submission function/class. Source statements and constraints were verified October 2, 2026.

| Official source | Official input domain | Local difference |
| --- | --- | --- |
| [1929 · Concatenation of Array](https://leetcode.com/problems/concatenation-of-array/) | Length 1–1,000; integers 1–1,000 | Script variable interface |
| [1480 · Running Sum of 1d Array](https://leetcode.com/problems/running-sum-of-1d-array/) | Length 1–1,000; integers −1,000,000–1,000,000 | Script variable interface |
| [2011 · Final Value of Variable After Performing Operations](https://leetcode.com/problems/final-value-of-variable-after-performing-operations/) | 1–100 labels, each ++X, X++, --X, or X--; start at zero | Labels are explicitly input strings, not Python syntax |
| [1431 · Kids With the Greatest Number of Candies](https://leetcode.com/problems/kids-with-the-greatest-number-of-candies/) | 2–100 children; amounts 1–100; extra 1–50 | `extra` is the local variable name; independent hypothetical cases and ties are explicit |
| [1470 · Shuffle the Array](https://leetcode.com/problems/shuffle-the-array/) | n 1–500; length 2n; values 1–1,000 | One position plus offset taught in prerequisite |
| [1920 · Build Array from Permutation](https://leetcode.com/problems/build-array-from-permutation/) | Length 1–1,000; distinct integers 0 to length−1 | No optional constant-memory follow-up required; original inputs preserved |
| [485 · Max Consecutive Ones](https://leetcode.com/problems/max-consecutive-ones/) | Length 1–100,000; binary values | Explicitly reduced local length 1–1,000; same run-counting task |
| [2894 · Divisible and Non-divisible Sums Difference](https://leetcode.com/problems/divisible-and-non-divisible-sums-difference/) | n and m 1–1,000 | Remainder operator taught; no arithmetic-series formula needed |
| [1512 · Number of Good Pairs](https://leetcode.com/problems/number-of-good-pairs/) | Length 1–100; values 1–100; equal values at i < j | Nested loops sufficient; self/reverse duplicates excluded |
| [1672 · Richest Customer Wealth](https://leetcode.com/problems/richest-customer-wealth/) | Rectangular 1–50 by 1–50 rows; values 1–100 | Row traversal and accumulator reset taught explicitly |

All transfer variations and prerequisite exercises are original practice, not additional official LeetCode problems. Boundary cases deliberately distinguish ties from strict comparisons, all operations from one spelling, grouped repetition from interleaving, one versus two lookups, global counts from consecutive runs, inclusive number sequences from list indices, and row totals from a total across all rows.

## Extending the collection

Add an exercise with the same item schema in its topic module, then include it through `src/content.js`. The public catalog derives connected challenge IDs from `skillIds` and places added skill exercises in the unit named first in `skillIds`. New units still declare their own initial `exerciseIds`. Add challenge stage/order metadata when it should appear at a particular point in the optional learning order. Put prerequisite exercise IDs in `prerequisites`, other connections in `related`, and the challenge's transfer exercise ID in `followup`.

Describe inputs and domain boundaries before writing cases. Add a simple example, useful boundary cases, and at least one case that defeats copying the example answer. Use a fresh `result` assignment contract unless the app/checker are intentionally changed together. For copying tasks, declare `checks.distinctFrom` and `checks.preserveInputs` with the injected variable names and explain those rules in the learner contract.

Add an independent oracle branch to the corresponding `tests/content*.test.mjs` audit. Keep its method different from the reference algorithm where practical. Run the content audit and the actual browser checker before advertising the new entry. The fixed release-count assertions should be updated intentionally when the catalog is expanded; they are release completeness checks, not a content limit.

## Diagnostic evidence from this run

Symptom: the first audit failed after about fifteen seconds with no individual test output. Signal: `node --test tests/content.test.mjs` reported `tests/content.test.mjs (15087.809391ms)` and `'test failed'`.

Initial hypotheses were an accidental reference loop, a native child-process I/O problem, or test-harness behavior. A direct Python smoke test and catalog import passed. A reduced child that only loaded catalog JSON through `spawnSync` still returned `spawnSync python3 ETIMEDOUT`; it never ran reference code. A separate synchronous child printed `123` but reported `spawnSync python3 EPERM`. Using asynchronous `spawn` and `stdin.end()` on the same JSON returned `30` and exit status 0. This isolates the stall to the synchronous child API in this managed environment; the underlying sandbox restriction was not further diagnosed.

The test now uses asynchronous `spawn`, preserving the timeout and all assertions. Detailed rerun: `tests 3`, `pass 3`, `fail 0`; duration about 60 ms. No test configuration or checks were weakened.
