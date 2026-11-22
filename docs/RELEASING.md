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

Android retains its existing first-party update checks and explicit installer confirmation. A GitHub release is another download location, not a new app identity or signer. Updating/restarting ends the RAM-only floor-list session; finish your current list first. Physical camera/keyboard/POS testing is distinct from CI/signature/hash verification and must not be claimed without device evidence.
