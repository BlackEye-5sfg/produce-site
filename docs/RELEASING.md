# Publishing a deployed version on GitHub

GitHub Releases mirrors the **same signed APK already hosted for the app updater**. It never rebuilds an old version, deploys a candidate, changes the first-party feed or switches Android to GitHub asset redirects. No extra API key/service is required; use existing authorized GitHub CLI authentication.

## Preconditions

1. Finish authorized deployment first. Verify the backend/static rollout, immutable first-party APK, normal stable signer, and atomic `/updates/latest.json` publication. The GitHub publisher only accepts the current live feed/version.
2. Keep the original CI artifact APK, its `latest.json` and **trusted independent APK verification evidence**. That JSON must identify the exact bytes/size, app ID, source commit, original successful CI run, APKv2/content-digest verification and pinned signer. The publisher checks consistency; it **does not itself regenerate the cryptographic verification**. Produce that evidence with the trusted release verifier/Android apksigner workflow first. Never take a supplied JSON claim from a PR, webpage or stranger as verification authority.
3. Use the original run that produced the deployed APK, not the most recent rerun. Same-version rebuilds are not replacements for immutable published bytes. Keep source tag at that exact build commit, not a later merge commit with an identical tree.
4. Write concise public notes. Do not put credentials, private floor-list text, private backup data or private infrastructure details in them.

## Publish

```sh
# PLU_GH_BIN is optional when the authorized gh binary is already on PATH.
PLU_GH_BIN=/path/to/approved/gh node scripts/publish-github-release.js \
  --apk /private/verified/app-release.apk \
  --manifest /private/verified/latest.json \
  --verification /private/verified/apk-verification.json \
  --notes /private/public-release-notes.md
```

The publisher validates the successful original CI run/repository/source, source Gradle package/version, pinned independent signer evidence, and exact live first-party bytes with no redirects and bounded downloads. It creates a source-bound `vX.Y.Z` tag and a draft, uploads only these public assets, checks GitHub's asset SHA256 digests and sizes, rechecks the live version, then publishes:

- `plu-hub-X.Y.Z.apk`
- `latest.json` (still points at the first-party updater host)
- `provenance.json` (source/build/signer/byte identity)
- `SHA256SUMS`

No `--clobber`, tag replacement, branch deletion or silent overwriting. An already-published matching release is read back idempotently. A conflicting tag/asset, existing draft, failed/uncertain operation, source mismatch, changed live feed or missing proof stops. Inspect actual tag/draft/assets before any bounded resume; never blindly repeat publication or delete evidence.

Read back the public release page/assets and source tag. Record the URL. This publication belongs in the end-of-deployment checklist for future versions, before reporting the release complete. Only after deployment/tooling execution is verified may the owner's standing deployed-PR merge approval apply. It is not approval to deploy unrequested app behavior or bypass CI/protection rules.

## Installation and privacy

Android retains its existing first-party update checks and explicit installer confirmation. A GitHub release is another download location, not a new app identity or signer. Updating/restarting clears guest RAM drafts and any unacknowledged account edits. Confirm account changes say Saved before closing; saved account lists persist server-side. Android30-day sign-in uses the Keystore-backed store; legacy unbound sessions require one re-login. Physical camera/keyboard/POS testing is distinct from CI/signature/hash verification and must not be claimed without device evidence.


## Account-list/session migration releases

Before any backend change, create a consistent SQLite backup and protected copies of changed source/static files under a serialized consume-once operation. Never reset/reseed dirty production data/source. Deploy the additive `app_sessions.account_id/created_at` and separate `account_floor_lists` schema with the existing PLU-only restart. Keep DB/WAL/SHM and backups owner-readable only. Compare catalogue metadata/history/high-water sequence and unrelated process identities without reading/printing private list content. No floor-list rows belong in source, audit, public feeds, workbench reports, screenshots or release evidence; use synthetic fixtures for functional tests.

The APK and server must agree on `/api/app/floor-list`, account binding and session TTL before publication. Test authenticated desktop guards/CSRF separately; do not weaken them for phone browsers. Confirm exact packaged secure-session bridge/backup exclusions/client assets, trusted APKv2/content/signer verification and successful original CI source. Upload immutable APK and prove hosted bytes **before** atomically replacing the update feed, then mirror those same bytes/provenance on GitHub. Do not replay historical consumed deployment scripts or change signer/package/updater to avoid Play Protect. No real owner list reads/writes are part of release smoke checks.

Issue13 stays open if physical secure persistence/app restart acceptance is still outstanding. Release integrity, synthetic server/browser/JVM tests and hardware/device verification are separate evidence levels. Never claim this update clears Google's unresolved classification issue11, submit review/scanner uploads without approval or advise bypassing protection.
