# NEW CITY STYLE UNIVERSAL PRO — CONTINUITY & HANDOFF
Date: 2026-11-08
This file is a continuity reference, not a claim of release certification.

## Product direction
This is an ongoing real business Android app, not a disposable demo. Continue the existing Kotlin / Jetpack Compose implementation, retain existing functionality and do not replace it with static cards or a sample app.

## Source and branches
Repository: newcitystyle/newcitystyle-store
Android project: universal-pro/
Relevant branches:
- feature/ncs-universal-single-app-native-foundation
- feature/universal-v17-cloud-bridge
- ncs-universal-pro-v1

On the native foundation branch, build.gradle.kts currently reports applicationId `store.newcitystyle.universalpro`, versionCode 33, versionName `3.3.0-isolated-restore-rehearsal`. Signing uses GitHub Actions secret-supplied environment variables; never commit credentials.
An isolated build-check workflow was added at `.github/workflows/ncs-universal-pro-build-check.yml` (commit 90794c33df1ca7907509d1fd1620b02f62aa6781).

## Observed user-device screenshots (2026-11-08)
The user provided five phone screenshots showing:
- Live Business Cloud, authenticated UI, Sales list with 436 visible records
- Product Studio showing 736 live cloud products cached offline
- Offline Native POS with cart and local save UI
- Universal Workspaces with 12 modules
- Home dashboard with customer dues ₹25,210.70 and Bills in Inbox 27
These are on-screen observations, not independently audited totals, live reconciliation, or device test certification.

## Verified source observations
- `NcsCloud.kt` contains Supabase publishable-key client/auth code. Do not embed a service role key in Android.
- `NativePosV21.kt` has local SQLite POS bills, bill_items, catalog and sync_queue; inbox upload is NOT proof of canonical accounting settlement.
- `NcsLocalPosBackup.kt` exports owner-controlled SQLite backup ZIP, verifies SHA-256 and row counts, and rehearses restore in an isolated read-only file.
- Actual overwrite restore is intentionally disabled, manifest restorable=false. Do not describe as complete restore.
- `NativeLocalBackupScreen.kt` exposes backup export and test-restore rehearsal.
- Some workspaces route to cloud/admin screens; full feature-by-feature native writes and financial sync are NOT independently certified.

## Nonnegotiable safety requirements
- Preserve existing business invoices, stock, customer dues, supplier dues, payments and cloud records.
- No direct writes to production finance or inventory while auditing/building.
- Do not delete, uninstall, reset databases, change permanent package identity/signing certificate, or overwrite prior APK source.
- Keep previously working desktop WhatsApp reminder behavior intact.
- First verify signed APK compilation, then real device smoke testing, then isolated sync idempotency/reconciliation before any production posting.
- Pending cloud inbox records require explicit reconciliation with canonical sales, stock and dues. Never treat uploaded as settled.
- Loans/private security state stays local.

## Work continuation priority
1. Observe GitHub native APK workflow result and diagnose compilation errors, if any.
2. Compile a safe update against same signing identity, check actual artifact.
3. Audit offline sales -> inbox -> canonical desktop/cloud finance reconciliation and duplicate prevention.
4. Implement/test safe restore only after cross-version tests; keep current export and verification.
5. Complete genuine native business CRUD, Product Studio photos/AI publication, and premium UX without discarding existing modules.
6. Test Android, desktop, cloud round-trips with isolated test records and production data-preserving rollback plan.

## Status interpretation
Do not imply completion from code presence or a green source gate. Provide GitHub run evidence and device-tested evidence separately.
