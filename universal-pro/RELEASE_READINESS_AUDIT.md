# NEW CITY STYLE UNIVERSAL PRO — Native Release Readiness Audit

**Audit type:** Phase 1 / evidence-backed source and database assessment (2026-11-08)  
**Branch:** `feature/ncs-universal-single-app-native-foundation`  
**Release identity:** `store.newcitystyle.universalpro`, permanent release signing configured.  
**Status:** NOT PRODUCTION READY — DO NOT use unverified Android POS to post real store transactions.

## Non-negotiable release contract

1. One native Android application, same application ID and same release certificate across in-place updates.
2. Compact, coherent UI across *every* work area, not merely the home screen.
3. Full offline-first local repository for every supported business write; restart/reinstall/restore behavior verified.
4. Desktop ↔ canonical cloud ledger ↔ Android synchronization with idempotency, identity, conflict handling, observable status, and replay tests.
5. No financial, stock, or customer data mutation without validated authorization, transaction-boundary tests, backups and rollback.
6. Feature is called complete only after end-to-end tests: Create → Read → Edit → Reverse/Delete (as permitted) → Sync → Restart → Recovery.
7. Don't install new versions solely to display dashboard cosmetics. No mock, no placeholder or WebView advertised as native.

## Source-level inventory (verified)

| Area | What is currently present | Gap / release gate |
| --- | --- | --- |
| App identity | `universal-pro/app/build.gradle.kts` package `store.newcitystyle.universalpro`; release signing via environment secrets. | Install-over verification on actual device with persisted local data still required. |
| Navigation | `MainActivity.kt` has Home/Billing/Products/Insights/More and module routing. | Mixed native, cloud table browser and `LiveWebWorkspace`; inconsistent Page UX. |
| Billing | `NativePosV21.kt`: SQLite catalogue, bills, bill items, queue, local save, barcode lookup, bill history, guarded local void. | Local financial schema incomplete vs Desktop (returns, tax, discount/cash drawer/customer settlement); concurrent writes and true final accounting untested. |
| Cloud sync | `NcsCloud.postNativeOfflineBillToInbox` and `CloudBridgeV17Screen`; upload is to `ncs_desktop_sync_inbox_v1`. | Inbox confirmation is NOT canonical `pos_sales`, customer credit, stock, or journal commit. End-to-end reconciliation, conflict resolution and two-way replay unproven. |
| Product Studio | `NativeProductsScreen`: owner sign-in, cached catalogue, photos, variants view, name/brand edit. | Native photo upload, AI naming/SEO, product create/edit, supplier variant pricing and publish not implemented end-to-end. `LiveProductStudioScreen` delegates original complete editor to a WebView and is NOT native parity. |
| Purchases | `MainActivity` routes to `LiveBusinessCloudScreen` for `purchases`. | Full native purchase save, multi-variant stock inward, supplier due update, edit/reversal not implemented. |
| Sales history | `NativeSalesHistoryScreen`: cloud list, itemized invoice detail via RPC, payment overview. | Invoice correction, returns, local/canonical sync and replay tests not implemented. |
| Customer dues | `NativeCustomerDuesScreen`: cloud account display, real reminder call. | Native receive-payment transaction and full ledger offline sync not established. |
| Supplier ledger | Routes to `LiveBusinessCloudScreen` `suppliers`. | Native payment write/undo and sync unimplemented. |
| Cash/UPI & expenses | Generic cloud record browser, no complete native posting workflow. | Must align with Desktop cash/bank ledger, proper financial reconciliation. |
| Orders | `NativeOnlineOrdersScreen`: owner-only RPC list and detail status. | Order workflow status edits, fulfillment, cancellation, audit/permissions unimplemented. |
| Inventory | `NativeInventoryScreen` present. | Stock movement ledger source of truth and cross-device mutation not proven. |
| Recovery | Manual native POS backup export code added: `NativeLocalBackupScreen`, SQLite `VACUUM INTO`, `PRAGMA integrity_check`, SHA-256 and ZIP. System folder picker avoids broad storage permissions. | Not device-tested, unencrypted private ZIP, *export only*: no restore or independent import validation; full phone migration remains blocked. |
| Testing | GitHub Actions can compile + sign release APK. | Build success alone doesn't prove functional, offline, backup, integration, security, UI, or device tests. |

## Cloud access-control release gate

Read-only database review identified an access-control issue in a production commerce-data surface. Details are intentionally not published in this public source repository. Treat permission hardening as a release-blocking task requiring isolated checkout regression tests and careful coordination with the website team.

**Change policy:** Audit routes and dependencies first. Do not blindly turn on restrictions on production tables before testing checkout and tracking. No production database changes were made during this audit.

## Release gates — must all pass

- [ ] Baseline snapshot: all production and local data backed up and restore tested
- [ ] Complete Desktop 64-page mapping and API/data model inventory signed off
- [ ] Stable navigation + reusable design tokens/components and accessibility checks
- [ ] Product lifecycle fully native: photo, AI, variants, barcode, price, save, publish, verification on store
- [ ] Native POS/returns/purchase/payment workflows match Desktop behavior
- [ ] Atomic canonical cloud journal with idempotency keys and offline outbox conflict handling
- [ ] Desktop ↔ Cloud ↔ Android two-way tests (create/edit/void/partial payment/stock)
- [ ] Recoverable backups and device migration tests with identical signing identity
- [ ] Cloud RLS/role grants audit and checkout regression tests
- [ ] Build, instrumentation tests, offline/reconnect tests and UAT screenshots from actual phone
- [ ] Release signed APK, upgrade test, smoke test, rollback plan

## Working order

1. Protect cloud and audit Desktop/source/database field-by-field; capture immutable recovery baseline.
2. Implement true canonical atomic sync protocol + replay tests before enabling financial mobile writes.
3. Finish POS, product, purchase and payment repositories under one offline-first data model.
4. Finish native UI pages and shared premium design system; remove generic/cloud/WebView shortcuts only as native replacements reach parity.
5. Test via emulator and real phone; then signed stable release.

**No demo/placeholder should be labeled complete; no real business mutation allowed as part of a source audit.**
