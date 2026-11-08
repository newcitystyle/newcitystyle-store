#!/usr/bin/env python3
"""Release *source* gate (not a substitute for device, offline, or sync testing)."""
from pathlib import Path
import re
import sys

root = Path(__file__).resolve().parents[1]
src = root / "app/src/main/java/store/newcitystyle/universalpro"
build = (root / "app/build.gradle.kts").read_text(encoding="utf-8")
manifest = (root / "app/src/main/AndroidManifest.xml").read_text(encoding="utf-8")
main = (src / "MainActivity.kt").read_text(encoding="utf-8")
cloud = (src / "NcsCloud.kt").read_text(encoding="utf-8")
pos = (src / "NativePosV21.kt").read_text(encoding="utf-8")
checks = {
    "single stable release application ID": 'applicationId = "store.newcitystyle.universalpro"' in build,
    "permanent release signing wired": "NCS_ANDROID_RELEASE_KEYSTORE" in build,
    "no app-wide Android auto-backup of sensitive data": 'android:allowBackup="false"' in manifest,
    "native billing": '"Advanced POS" -> NativePosV21(' in main,
    "native product studio": '"Product Studio" -> NativeProductsScreen(' in main,
    "native website online orders": '"Online Orders" -> NativeOnlineOrdersScreen(' in main,
    "native itemized sales detail": '"Sales History" -> NativeSalesHistoryScreen(' in main,
    "native customer dues": '"Customers", "Customer Dues" -> NativeCustomerDuesScreen(' in main,
    "offline local POS outbox": "CREATE TABLE sync_queue" in pos and "UPLOAD_ATTEMPTED" in pos,
    "conflict-safe post-attempt void guard": "canVoidLocal" in pos and "markUploadAttempt" in pos,
    "inbox not mislabeled canonical posting": "ncs_desktop_sync_inbox_v1" in cloud and
        "postNativeOfflineBillToInbox" in cloud,
    "no client hardcoded service role": "service_role" not in cloud.lower().replace(
        "// publishable client key only: never embed service_role or secret keys in android.", ""),
    "native offline data not silently wiped": "DROP TABLE" not in pos.upper(),
    "native product photographs": "AsyncImage(" in (src/"NativeProductsScreen.kt").read_text(encoding="utf-8"),
    "owner-initiated local POS backup route": '"Local Backup" -> NativeLocalBackupScreen(' in main,
    "consistent SQLite backup snapshot and integrity check": all(
        x in (src/"NcsLocalPosBackup.kt").read_text(encoding="utf-8")
        for x in ("VACUUM INTO", "PRAGMA integrity_check", "SHA-256", "sync_queue", "bill_items")
    ),
    "system storage picker rather than dangerous full storage permission": all(
        x in (src/"NativeLocalBackupScreen.kt").read_text(encoding="utf-8")
        for x in ("ActivityResultContracts.CreateDocument", "application/zip")
    ),
    "restore rehearsal is isolated and read-only": all(
        marker in (src/"NcsLocalPosBackup.kt").read_text(encoding="utf-8")
        for marker in ("ncs-restore-dry-run-", "SQLiteDatabase.OPEN_READONLY", "Orphan bill items in backup", "Orphan sync queue records")
    ),
    "backup explicitly export-only": '"restorable",false' in (src/"NcsLocalPosBackup.kt").read_text(encoding="utf-8"),
    "backup independently reread after export": all(
        marker in (src/"NcsLocalPosBackup.kt").read_text(encoding="utf-8")
        for marker in ("verifyArchive(app,destination)", "ZipInputStream", "Backup checksum mismatch", "Row count changed for ")
    ),
    "native existing archive verification flow": all(
        marker in (src/"NativeLocalBackupScreen.kt").read_text(encoding="utf-8")
        for marker in ("ActivityResultContracts.OpenDocument", "TEST BACKUP RESTORE SAFELY")
    ),

}
for name, passed in checks.items():
    print(("PASS " if passed else "FAIL ") + name)
if not all(checks.values()):
    print("SOURCE_INVARIANTS_FAILED — no release")
    sys.exit(1)
print(f"SOURCE_INVARIANTS_PASSED ({sum(checks.values())} checks)")
print("NOTE: This does NOT certify actual restore, backup export on device, finance sync, UI or device tests.")
