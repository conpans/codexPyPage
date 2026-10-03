# Plan: expand the practice collection

Spec: user request to expand the running app to 10+ approachable challenges with the learning needed to solve them.
Verify: npm test; npm run check; browser acceptance if available.

## Scope and decisions

This is a bounded content and discovery change. Keep the runtime and version 1 progress IDs/contracts stable. The user's earlier authorization to implement routine reversible decisions continues to apply.

- Deliver 14 integrated challenges, including 10 attributed LeetCode Easy adaptations, 14 transfer variations, and 25 prerequisite exercises across seven skill units.
- Add eight challenges: Final Value After Operations, Kids With Candies, Shuffle Array, Build Array from Permutation, Max Consecutive Ones, Divisibility Sum Difference, Number of Good Pairs, and Richest Customer Wealth.
- Add seven smaller prerequisite exercises, including a three-exercise nested-loops unit. Order challenges by suggested learning steps, with all open to attempt.
- Label the home cards as suggestions and provide a prominent full-catalog link/count. Browse shows its total and active-filter context; search includes official source names and IDs.
- Max Consecutive Ones uses an explicitly stated local limit of 1,000 items versus the official 100,000, keeping feedback/backups manageable. Other source constraints stay explicit. No mathematical shortcut or in-place memory follow-up is required.

## Parallel implementation

- Array content agent: src/content-arrays.js and tests/content-arrays.test.mjs; four challenges, four variations, three prerequisite exercises with independent native oracles and production-checker checks.
- Loop content agent: src/content-loops.js and tests/content-loops.test.mjs; four challenges, four variations, four prerequisite exercises, one skill unit, independent oracles and production-checker checks.
- Root: src/content.js integration, src/discovery.js, UI/catalog routes and styles, existing collection assertions/browser suite, README and verification notes.
- Review agent: tests/discovery.test.mjs, environment/browser capability checks, independent discovery/content review.

Done means all 53 items have explicit contracts, prepared guidance, working references and tests; every link resolves; old progress imports still work; all 14 challenges are discoverable. Browser execution claims require an actual browser run, never native tests alone.

## Initial evidence

The existing Continue page renders two initial suggestions and no nearby full-catalog link. The six original integrated challenges exist in the catalog; only two have LeetCode attribution. This explains a plausible source of the reported small collection; the exact user's viewport/filter state is unknown.

Current local runtime assets pass npm run check. The available environment has no Playwright Chromium binary and denies loopback fetch with EPERM. Browser execution remains unavailable here, although the user reports the app runs on their machine.
