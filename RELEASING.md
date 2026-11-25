# Publishing and releasing

Everything here is done with GitHub Actions: you do not need Windows, a Mac or Android tools yourself.

## One-time setup
1. Create a GitHub repository and upload the contents of this zip (the folder's contents, not the folder).
   Add your emulator core files (`*.7z`) to `data/cores/` (they are large; use the web uploader in batches or `git`).
2. Tell the project its repository: `node tools/set-repo.mjs OWNER/REPO` (or edit `release-config.json`). On GitHub Pages the *Get the app* page can also work this out from the web address.
3. **Settings, Pages, Source: GitHub Actions.** Pushing to `main` now publishes the site at `https://OWNER.github.io/REPO/`.
4. **Settings, Actions, General, Workflow permissions: Read and write.** (Needed so the release workflow can create a release.)

## Check before every release
```
node tools/preflight.mjs          # links, JSON, icons, service worker list, versions, roms/ empty
node tools/generate-homebrew-index.mjs --strict
```

## Make a release
```
node tools/bump-version.mjs 4.3.0-local.40      # updates every version number
# add a "# 4.3.0-local.40: ..." section at the top of CHANGES.md
git commit -am "Release 4.3.0-local.40"
git tag v4.3.0-local.40
git push origin main v4.3.0-local.40
```
The *Release* workflow then builds, in about 15 to 30 minutes:
* Windows installer and portable `.exe`
* macOS `.dmg` and `.zip` (universal: Apple silicon and Intel)
* Linux `.AppImage`, `.deb`, `.rpm`
* Android `.apk`
* iPhone/iPad Xcode project `.zip`
* the offline site `.zip`, the player guide PDF, `SHA256SUMS.txt`

and publishes them on the Releases page with notes taken from `CHANGES.md`. The site's *Get the app* page and the F1 panel's *Install and downloads* section pick the files up automatically.

## Signing (optional, removes the first-run warnings)
Unsigned builds work but show a warning. To sign, add these repository secrets and the workflow's electron-builder step will use them:
* Windows: a code-signing certificate (`CSC_LINK`, `CSC_KEY_PASSWORD`).
* macOS: a Developer ID certificate and notarisation (`CSC_LINK`, `CSC_KEY_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`); remove `CSC_IDENTITY_AUTO_DISCOVERY: "false"` in `release.yml`.
* Android Play Store: build a release bundle and sign it with your upload key.
* iPhone / iPad App Store: open the Xcode project, choose your team, archive and upload.

## Licensing reminder
`THIRD-PARTY-NOTICES.md` lists the cores. Some (Snes9x, Genesis Plus GX, PicoDrive, FBNeo, MAME 2003) are **non-commercial**: free to share, not to sell. Remove them before selling or monetising a build.

## What is not built here
Native builds cannot be compiled without the platform tools, so they are produced by the workflow on GitHub's own Windows, macOS and Linux machines. If a job fails, open the run in the Actions tab; the log shows the step.
