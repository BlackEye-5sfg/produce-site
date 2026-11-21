# PLU Hub

A small produce reference website and Android companion sharing one Express API and SQLite catalog. This is an unofficial reference, not affiliated with Walmart. Codes and barcode acceptance can vary by store, variety and size.

## What is included

- Search-first responsive reader, accent/alias-aware search, categories, device-local favorites and large barcode view.
- Native Android package containing the same offline-capable reader assets. The latest public catalog is cached locally and refreshed when connected.
- Desktop website administration using the existing configured username/password. Mobile browsers are blocked from web-admin pages and cookie-authenticated web writes.
- A separate Android editor authenticating with the same existing credentials through app-specific API endpoints. No device enrollment, certificates or extra admin authentication ceremony.
- Add, real edit, revision conflict handling, deletion, an activity log and restoration of deleted entries.
- Website change notifications via SSE, with foreground polling/focus refresh as fallback.

**The mobile-browser gate is deliberately best-effort.** User-Agent checks can be spoofed. Password/session or app-token authorization remains mandatory on all writes; an app install or a forged app header grants no privilege.

## Barcode scanning and longer codes (2.3)

The name stays **PLU Hub**. Android's Add item form has Scan barcode, plus a Scan to add shortcut. Camera permission is requested only on that action. The bundled ZXing decoder works on-device without downloading a model, saving barcode images, uploading frames or using an account/API key. Cancel/denial/no camera retains manual entry. The scan fills only the code and its format; name/category/tags require review and explicit Save. Exact duplicates are refused by the shared API. Desktop administration accepts manual/pasted/keyboard-scanner input; native camera scanning is Android-only.

Formats: existing4/5-digit PLU, UPC-A12, UPC-E8, EAN-13 (13 digits), EAN-8 (8 digits), GTIN-14, even-length ITF and plain printable Code128/uppercase Code39 (up to80 characters). Choose an explicit type for ambiguous eight-digit codes; Auto selects PLUs for4/5 digits and common retail lengths, otherwise Code128. UPC/EAN/GTIN checksums are validated, never repaired. Unknown/QR/2D/GS1-FNC1 structured payloads are not accepted by the camera scanner. No product identity lookup or PLU inference from a zero-prefixed retail scan.

The existing API/storage property `plu` remains for backwards compatibility, always text. New `code_type` controls validation/rendering and is included in CSV/JSON bulk previews, audit/undo and public reads. Existing records gain `code_type=plu` via an additive migration without recategorizing/changing values. Legacy metadata edits retain a stored type. Longer numeric codes must be JSON strings, not numbers, to protect leading zeros. Mixed-case internal values are preserved and searched literally without fuzzy code matching.

Retail/internal barcodes render the full validated value in their own symbology, never as a padded UPC. Existing PLU reference graphics keep their previous encoding; that legacy representation is not a claim of checkout compatibility. Dense long barcodes may need a larger display. Physical camera/permission/orientation and POS-scanner compatibility still require device testing. Scanner library attribution/Apache2 licenses are bundled at `public/licenses/zxing.txt`.

## Android app updates (2.2)

One manual installation of the signed2.2.0 APK is needed to add the updater to older versions. After that the app checks the first-party HTTPS release feed on launch, when returning to the foreground/online (four-hour successful-check cooldown), and periodically while visible. Updates has a manual Check now button.

Automatic downloading defaults to unmetered connections and can be disabled. Manual Download permits your chosen connection. Background/closed-app monitoring is not promised. The app never silently installs or grants itself installation privileges: Android's normal installer asks for approval. Android8+ may first require allowing PLU Hub as an installation source in system settings. An installer opening is not reported as a completed installation; canceling leaves the current app working.

The native updater accepts only fixed-origin immutable APK URLs. Downloads reject redirects, oversize/timeout responses and mismatched size/SHA256, package ID, exact release code/name, installed signer or non-forward versions. The Android package installer independently validates the APK/signature. Files stay in a restricted update-cache directory exposed read-only through an unexported scoped FileProvider. No root, device-owner setup, external-storage write or new account/key is required.

Release publishing: CI builds/tests the signed APK then generates `latest.json` beside it with `node scripts/release-manifest.js SIGNED.apk OUTPUT.json`. Before publishing, independently verify APK signature/certificate and that metadata matches bytes/version. Upload the immutable APK to its `/downloads/plu-hub-VERSION.apk` URL, verify the hosted hash, THEN atomically replace `public/updates/latest.json`. Never advertise an APK that is unavailable/unverified, reuse a versioned URL for different bytes, or embed signing/admin secrets. Version codes must increase. The app bypasses stale feed caches with a unique check query; webpage asset URLs are versioned separately. Runtime published metadata is excluded from Git. Future catalogue changes do not require an app update; they still use the shared API.

## Lookup and editing tools (2.1)

Categories: Vegetables, Fruit, Herbs and Pantry. Existing `dry` entries remain Pantry; existing categories, IDs and codes are not automatically reclassified. Optional tags: Organic/Normal (conventional), Cooler/Ambient, Table/Wet wall/Bunker/Counter (multiple display locations), By weight/Each. Unset means unknown, never inferred.

Recent lookups (12), pinned favorites and checkout display preferences are device-local. Search supports item aliases, synonyms and bounded spelling tolerance for words, never fuzzy numeric PLUs. Similar-item suggestions are warnings to compare exact labels, not recommendations to substitute a code.

Bulk tools accept JSON or CSV, up to100 rows/200KB of input. CSV needs `name,plu,cat`; optional `id,revision,organic,storage,locations,sale_unit,aliases`. Lists use `|`. Existing PLUs update; new PLUs add. All changes must be previewed then explicitly confirmed. Previews expire after ten minutes, belong to the login session, are single-use and reject a changed catalogue. The whole confirmation transaction rolls back on failure. No external PLU list is imported automatically.

Recent activity offers safe undo for create/update/photo and deleted-item restore. Undo is refused if the item changed afterward; it never rolls item revisions backward. Activity shows the latest40 events, including individual bulk changes.

Photos: edit an existing item, choose an appropriate image you have permission to publish, then Upload. The client resizes/re-encodes it (stripping metadata); authenticated server endpoints accept bounded JPEG/PNG data (512KB, up to1600px per side), stored outside source under `data/photos`,100MB total. Photos are public catalogue assets. There is no arbitrary-URL fetching, SVG upload or camera permission. Removing/undoing a photo retains its immutable file for historical recovery; no automatic photo deletion. Cached descriptions work offline; photos may require a connection.

Checkout display enlarges digits. The code dialog has a barcode-size slider and an explicit screen-awake toggle. Android uses a small foreground window-flag plugin, with no background CPU wake lock/extra permission. Browsers use Screen Wake Lock where supported; unsupported requests report that clearly. Closing the code or hiding the page releases the request. Real Android screen behavior and checkout scanner compatibility still need device testing.

The migration transaction expands the category CHECK and adds metadata, preserving existing IDs, Spanish names, dates, audit/session tables and the AUTOINCREMENT high-water mark. Unknown custom columns or external item foreign keys stop migration for review instead of silently discarding them. Old API clients omitting tag fields do not erase them.

## Architecture

Website + Android app -> HTTPS Express API -> one server-side `data/plu.db` database.

Android stores only a public catalog snapshot and favorites on disk. Its admin bearer token is held in memory, not localStorage; restarting the app requires signing in again. The password is never embedded in the app, and is cleared from its input after sign-in. Server app-session records store token hashes and expiry, not raw bearer tokens.

The existing credential values stay in `.env`. Never commit that file or database/signing material. A database schema migration adds revision/timestamp, audit, catalog-version and app-session tables without reseeding or replacing existing entries.

## Development

Node22 or newer:

```sh
npm ci
npm run build
npm test
npm start
```

Set `AUTH_USER`, `AUTH_PASSWORD`, `SESSION_SECRET`, `PORT` and `NODE_ENV` in your local protected environment. Tests use isolated fixtures and never require production credentials. For a disposable test database, set `PLU_DB_PATH` to a separate path. Never point tests at the production database.

`npm run seed` is for an intentional initial catalog setup, NOT normal deployment. No researched-but-unverified Walmart PLU candidates are automatically imported.

## Android

The Capacitor8 Android project is in `android/`, package `xyz.xanderxx.pluhub`, minimum Android7/API24, target API36. The packaged app uses HTTPS origin `https://plus.xanderxx.xyz`; `PLU_APP_API_BASE` can select another HTTPS origin at build time. It must not contain credentials or a path.

```sh
npm run android:sync
# With Android SDK and Java21 configured:
cd android
./gradlew assembleDebug
```

For a signed release, supply `PLU_KEYSTORE_PATH` and `PLU_STORE_PASSWORD` securely to Gradle; the keystore is PKCS12 with alias `pluhub`. Signing material stays outside Git. Package signing is a standard Android distribution requirement, not admin-device enrollment. CI builds a signed APK with encrypted repository secrets and uploads only the APK, never the keystore/password. No Firebase/account/API key is required.

The v1 reader is usable from its cached catalog offline; editing is online-only. There is no camera scanner in this version. Barcode format matches the previous website and still needs real checkout/scanner testing before relying on it at a register.

## Main API paths

- Public: `GET /api/items`, `/api/health`, `/api/events`.
- Website login/session: `POST /api/login`, `/api/logout`; `GET /api/me`.
- Cookie-authenticated desktop writes: `POST /api/items`, `PATCH/DELETE /api/items/:id`; CSRF header required. Send the current item revision on edits/deletes.
- Android login: `POST /api/app/login`; token returned only after valid credentials. `GET /api/app/me`, `POST /api/app/logout` use bearer authorization.
- Android writes: `POST /api/app/items`, `PATCH/DELETE /api/app/items/:id` use the bearer token.
- Authenticated activity/restore: `/api/audit` and `/api/app/audit`; `POST .../:id/restore`.

## Deployment precautions

1. Back up current source, package files, protected environment and a consistent SQLite snapshot using SQLite backup, including WAL-aware handling. Preserve any existing uncommitted work.
2. Build/test on staging and confirm catalog values survive schema migration.
3. Install runtime dependencies in staging on the correct host architecture. Do not copy x86 node_modules to ARM.
4. Preserve `.env` credential values and `data/`. Do not run the seeder, reset the live Git checkout or replace the database with a fixture.
5. Restart only PLU Hub under the verified existing PM2 manager. Verify other applications/PIDs were not restarted, existing login works, mobile web admin is blocked and the public/native read paths respond.
6. A prior source backup is not an automatic database rollback plan after new edits. Never overwrite new catalog changes or restore old DB/session snapshots blindly.

## Source provenance

The first staging-branch commit preserves the previously deployed, uncommitted UI/dependency baseline. The feature commit contains the redesign/Android/shared-API work. That baseline snapshot is not a claim of original authorship and was not made by resetting or cleaning the live checkout.
