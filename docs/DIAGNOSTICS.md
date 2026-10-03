# Diagnostic evidence

## Revisit identity collision

Symptom: a fresh attempt created in the same millisecond reused the preceding attempt identity; later hint usage could downgrade the earlier pass.
Signal: the fixed-clock revisit test in `tests/progress.test.mjs` asserted distinct identities and initially failed.
Hypotheses: timestamp identity collision; a shared history reference; ordering based on equal timestamps.
Probe: hold the clock constant while passing, beginning a revisit, passing independently, and opening a hint. The old and new IDs matched before the fix, and independence of the earlier check was affected.
Finding: millisecond timestamps alone were insufficient identities. `beginRevisit` now assigns a monotonic timestamp ID and `status` uses history order. The fixed-clock regression passes. History sharing remains intentional; help updates only checks with the current attempt ID.

## Environment versus application failures

Package DNS failure, missing browser/runtime assets, and denied loopback binding were reproduced independently of the app. No code change can establish real browser evidence in this environment. Details and raw output are in `VERIFICATION.md`.

The synchronous native child-process JSON-input stall was isolated by a child that merely read JSON, without running a reference solution. An asynchronous subprocess with the same fixture completed. Content audits retain all semantic assertions and timeouts; no test configuration was weakened. Native tests run trusted authored fixtures only.

## Export validation boundary

Review found that JavaScript string length counts UTF-16 code units, while the file picker enforces bytes. A Unicode-heavy backup could otherwise be exported but refused by the picker. Export and import now share the same UTF-8 byte check, and regression tests cover the discrepancy.
