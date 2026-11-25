# Phone apps (Android and iPhone/iPad)

This folder wraps the site with [Capacitor](https://capacitorjs.com) so it can be installed like a normal app.
The GitHub release workflow (`.github/workflows/release.yml`) does all of this for you when you push a version tag.

## What you get
| Device | File | How it is built |
|---|---|---|
| Android | `EmulatorJS-<version>-android.apk` | Gradle `assembleDebug` on a GitHub runner (signed with the standard debug key so it installs directly) |
| iPhone / iPad | `EmulatorJS-<version>-ios-xcode-project.zip` | The Xcode project. Apple only allows installs signed by an Apple developer account, so open it in Xcode, choose your team, and press Run |
| iPhone / iPad (no account) | The web app | Safari, Share, Add to Home Screen. Works offline and is the easiest route |

## Build by hand
```bash
cd android
npm install
npm run prepare-site          # copies the site into www/
npx cap add android           # once
npx cap sync android
cd android && ./gradlew assembleDebug   # APK is in app/build/outputs/apk/debug/
```
For the Play Store build a release bundle (`./gradlew bundleRelease`) and sign it with your own upload key.
For iPhone use `npx cap add ios`, `npx cap sync ios`, then `npx cap open ios` on a Mac.

## Notes
* Threaded cores (PSP, DOS, 3DS) depend on the phone's WebView supporting shared memory; most phones play 8-bit to 32-bit systems fine.
* Games and saves live inside the app's own storage and are removed if you uninstall the app.
