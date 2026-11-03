# Data safety: backup and restore verification (Plan J)

The backup machinery already existed (checksum-stamped JSON backups,
encrypted backups, automatic local backups, safety snapshots). What
Plan J adds is operator confidence before anything destructive
happens — verification, a what-changes report, and one written
contract for destructive actions.

## Verify a backup without restoring it

In the backup controls, pick a saved local backup and press
**Verify saved backup**. The app reads the stored backup text and
runs `verifyBackup` (backup-verification.js) against the current
ledger. It shows, without changing any data and without opening
the restore dialog:

- customers, bills and payments in the backup, and the bill months
  it covers;
- how many receipts it would add compared with this device;
- how many local-only customers and receipts this device already
  has (those stay — a restore merge never deletes them);
- the integrity verdict: checksum verified, legacy backup without
  a checksum (restorable with a warning), or checksum mismatch
  (never restorable).

Verification is a pre-check, not a second restore engine. The
restore preview's deep validation (duplicate IDs, invalid
snapshots, bad expenses, branch-guard verdict) still runs before
any apply, and can still refuse a backup this check called
verified, for a specific reason.

## What a restore will change, before it applies

The restore preview summary now ends with a what-changes line
computed by `describeRestoreChanges` from the preview's own merged
state: how many new profiles, bills and receipts applying would
add, and — explicitly — whether anything already on this device
would be removed. Under the merge rules that count is zero, and
the line says so; if a future merge ever removed a record, the
line would report the removal instead of hiding it.

## Destructive actions: one contract

`destructiveActionContract` (backup-verification.js) states the
confirm-and-undo pattern for each covered flow, as app.js
implements it:

| Flow | Confirm | Safety snapshot | Undo |
| --- | --- | --- | --- |
| Customer delete | Danger confirm | Yes, before deleting | Undo toast (5 s) restores the exact record at its position; after that, the pre-delete safety snapshot |
| Payment void | Reason dialog | Yes, before voiding | No toast undo; a failed void-log or reopen write rolls the whole void back, so a void never half-applies |
| Customer archive | Reason dialog | No — archiving keeps all history | Undo toast, or unarchive later |
| Backup restore (file or saved local) | The restore preview itself | Yes, before applying | Restoring the pre-restore safety snapshot from the backup controls; there is no one-tap undo toast after a restore |

## What Plan J does NOT change

- The backup format and the encryption are untouched. Backups
  made before Plan J verify and restore exactly as before.
- The restore merge rules are untouched: verification and the
  what-changes report only read and describe; they never apply.
- No sync protocol, storage, or budget change. No test was
  waived, skipped or marked expected-fail.
