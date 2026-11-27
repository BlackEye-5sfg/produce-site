# PLU Hub changelog

## 2.5.0

- Private signed-in account floor lists with strict ownership, bounded data and revision conflicts, separate from the public catalogue/audit stream.
- Guest drafts remain RAM-only; signing in asks before uploading existing guest work or switching to the saved account list.
- Android opaque30-day sessions remembered using Android Keystore AES-GCM encryption, revocable and excluded from backup/device transfer. No saved password or plaintext token fallback; legacy unbound sessions require re-login.
- Explicit pending/saved/offline/conflict status, stale-response guards and sign-out access from the floor-list panel. Login expiry does not delete the account list.
- Play Protect issue11 remains unresolved. This is a feature release, not malware clearance or a recommendation to bypass protection. Physical Keystore/reopen acceptance remains distinct from automated test evidence.


## 2.4.2

- Version-only release to test in-app update download, Android/Play Protect scan and user-confirmed installation.
- Same package/signing identity, catalogue, credentials and permissions; no runtime feature changes.
- After installation, Updates → Check now should report installed version2.4.2. Updating/restarting clears the RAM-only floor list.

## 2.4.1

- Add a session-only **Hide checked items** toggle to the sales-floor checklist. Completed rows can be restored without losing their text/check state; totals still include them.
- Keep add/newline/delete/focus, wrapped text and Android Back/reopen working with the filter.
- Keep all floor-list contents and the filter solely in the current page/app memory. No sharing, storage or catalogue writes.

This is the first GitHub-hosted release mirror. The already-published 2.4.1 APK also includes earlier deployed features: web/Android shared catalogue, dark-purple theme, tags/aliases/favorites/recent lookups, controlled bulk editing/audit undo/photos, on-device barcode capture and typed longer codes, Android Back handling and user-confirmed first-party updates.

GitHub assets are mirrors of the existing signed first-party APK, not rebuilt same-version replacements. Public provenance/checksums identify the original source and CI run. The app's normal updater host and signing identity remain unchanged. Physical Android/POS testing is not implied by automated checks.
