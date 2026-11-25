# Install and run

Pick the way that suits you. Everything works offline once it has loaded, and games and saves stay on your device.

## 1. In your browser (nothing to install)
Open the published site: **https://OWNER.github.io/REPO/**. Chrome, Edge, Firefox and Safari all work.

## 2. As an app (installable web app)
* **Windows / Linux / Chromebook (Chrome or Edge):** use the install icon in the address bar, or the page menu, *Install EmulatorJS*.
* **Android (Chrome):** menu, *Install app*.
* **iPhone / iPad (Safari):** Share, *Add to Home Screen*.
* **Mac (Safari 17+):** File, *Add to Dock*.

## 3. Download an app from the Releases page
Go to **https://github.com/OWNER/REPO/releases/latest** (or the site's *Get the app* page, which picks the right file for your device).

| Device | File | Notes |
|---|---|---|
| Windows | `EmulatorJS-<version>-win-x64-setup.exe` or `-portable.exe` | Windows may warn about an unknown publisher: *More info*, *Run anyway* |
| macOS | `EmulatorJS-<version>-mac-universal.dmg` | First launch: right-click, *Open* |
| Linux | `.AppImage` (`chmod +x`, run), `.deb` (`sudo apt install ./file.deb`), `.rpm` (`sudo dnf install ./file.rpm`) | |
| Android | `EmulatorJS-<version>-android.apk` | Allow "install unknown apps" for your browser once |
| iPhone / iPad | Web app (above), or the Xcode project zip if you have an Apple developer account | |

Verify any download against `SHA256SUMS.txt`:
```
Windows:      certutil -hashfile FILE SHA256
macOS/Linux:  shasum -a 256 FILE
```

## 4. Run it from a folder (offline zip)
Download `EmulatorJS-<version>-site-offline.zip`, unzip it, then
* Windows: double-click `start-windows.bat`
* Mac / Linux: `python3 serve.py` and open <http://localhost:8000>

Opening `index.html` directly from the file system will not work; browsers block the features the player needs. Use one of the ways above.

## Adding games
Drop a game file onto the Basic page, or put files in `data/<SYSTEM>/` and run `node tools/generate-rom-index.mjs`. Only use games you have the right to play.
