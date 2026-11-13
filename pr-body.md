Up from 18,696/0 — now 18,703 pass / 0 fail (18,703 tests, 1033 files). Build gate passed.

## Profile Archive Button Visibility + Record Payment Button

User report 2026-11-13 (2 screenshots): "Record payment WALLA button lamba hai tu Shahid woh archive button kahi gum ho gaya hai" — the Archive button was buried two taps deep inside More actions → Payments (both collapsed by default), so the user could not see it. The Record payment button did NOT push it out: it was full-width by design and Archive was never on the main row.

### What changed

- `index.html`: `#archiveCustomerButton` moves out of the Payments category grid into the main `.profile-action-group`, immediately after `#currentBillPaymentShortcut` and before `#unarchiveCustomerButton` — Row 1 is now Edit / Clear dues / Delete / Wada / Record payment / Archive. Id, classes, icon and i18n key byte-identical; only the seat changes. The Payments category keeps Advance + back-dated only.
- `styles.css`: desktop grid grows from five columns to six (without it Archive wraps alone onto row 2 above 800px); the `grid-column:1/-1` span is dropped from the ≤800px and ≤620px rules so Record payment shares its row with Archive; one scoped gap rule (`.current-payment-shortcut{display:inline-flex;align-items:center;justify-content:center;gap:8px}`) fixes the tight icon-text look — the tile and label sat flush because `.primary-button` has no flex/gap and the markup has no whitespace between the 36px tile and the text.
- `components.css`: the shortcut leaves the ≤480px spanning selector list (backdated link + technical tools still span); the rationale comment above it is updated.

### Deliberate reversal — disclosed

This PR reverses Profile Polish B (10) + polish #24, which moved Archive DOWN into More Actions > Payments. The user's report proves that seat made Archive unreachable two taps deep, so Archive returns to Row 1. Seven tests break by design and are rewritten with why-comments, none deleted: `profile-polish-b` (order array + Archive-seat test), `profile-redesign` (d) 13→12 and (f) six-button Row 1, `polish24` tests 1 + 3, `plan492` ACTION_IDS 13→12, `profile-clear-dues` 5→6 columns, `plan-d-mobile` tests 25 + 41 (the ≤480px spanning list and the ≤800px span pin). The More-actions count drops 13→12 in two tests + two comments, all moved together.

### Notes

- `app.js`: zero changes — wiring attaches once at startup by id and the Archive/Unarchive hidden toggle is DOM-position-independent.
- Half-width Record label at 360px (25-char label + 36px tile in ~161px): the label may wrap to two lines (`white-space:normal` at ≤620px) and the 48px floor fits the tile + two lines; the shared i18n label is NOT shortened. The e2e #302 pin measures it: Record is ~half the action-group row at 360px (ratio 0.4–0.6) with Archive on the same row, no overlap.
- Pre-existing, OUT OF SCOPE (flagged only): Record payment has NO hidden toggle for archived customers — its handler falls through to `openPaymentEntry()` on an archived profile. Not fixed here; follow-up candidate.
- No new hex (styles.css stays at exactly 614 distinct hex); no new i18n keys; no real customer names/numbers in tests. `node_modules` was copied from the previous item's worktree (identical `package.json`) for the local gates; never staged (`npm-ci.log` never staged either).

### Tests

- +7 new tests in `tests/profile-archive-button-visibility.test.js` (Archive is a direct child of the action group ahead of More actions; neither button spans at phone widths; desktop grid is six columns; the gap rule; wiring/toggles untouched; 614-hex ratchet; no PII).
- e2e `tests/e2e/profile-payments-300-303.spec.mjs` #302 updated with a why-comment (desktop ratio pin replaced by a not-spanning pin + Archive-rect checks, plus a 360px half-width pin). E2E cannot run in the VM and is not a merge criterion.

### Diff

- `components.css` +4/−3 — `a7810f229690f0d5432d100e707e9b8bc6e8e0d4`
- `index.html` +1/−1 — `64828948383cafd94d75943cfc03ca757e4a0ef7`
- `styles.css` +16/−10 — `b5cdba3cae1fb8ca613d2c40f08346347a683b0f`
- `tests/e2e/profile-payments-300-303.spec.mjs` +43/−10 — `a8ad0a0eb52570230ec383f0e18bed413919ffcc`
- `tests/plan-d-mobile.test.js` +20/−4 — `0fa58a2074df3ecd0e6c5040156c87717428eaae`
- `tests/plan492-danger-zone-more-actions.test.js` +18/−14 — `416dd34f074683b04f4c274deb3f06ed69fd58d3`
- `tests/polish24-profile-actions-top-and-delete-visible.test.js` +25/−13 — `b65f8c13d97b8ebc117467a535fabc8ead3668e7`
- `tests/profile-archive-button-visibility.test.js` +98/−0 (new) — `dfb72b9aabb6ab1ac169b33c20af463e093bd1c0`
- `tests/profile-clear-dues.test.js` +7/−5 — `f5af20c08baba9dfc2bb7e807de5f86658f86385`
- `tests/profile-polish-b.test.js` +30/−10 — `8dc6de4905aa5ef7f4e90c1e98c005744dc79e1e`
- `tests/profile-redesign.test.js` +17/−10 — `dde09b795e58a8ae587dfbb362e816863819ab37`

Total: 11 files, +279/−80.
