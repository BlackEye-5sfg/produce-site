# PLU Hub changelog

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
