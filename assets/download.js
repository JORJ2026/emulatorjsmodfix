// "Get the app" page and the shared download helpers (also used by the F1 settings panel).
// Release files come from the GitHub release of this site's own repository.
export async function loadConfig() {
    try { return await (await fetch("release-config.json", { cache: "no-cache" })).json(); } catch (e) { return null; }
}

// owner/repo: from release-config.json, or (on GitHub Pages) from the page address.
export function repoOf(cfg) {
    if (cfg && cfg.repo) return cfg.repo;
    const m = location.hostname.match(/^([^.]+)\.github\.io$/);
    if (m) {
        const first = location.pathname.split("/").filter(Boolean)[0];
        return m[1] + "/" + (first && !/\.html?$/.test(first) ? first : m[1] + ".github.io");
    }
    return "";
}

export function detectPlatform() {
    const ua = navigator.userAgent || "";
    const p = navigator.userAgentData && navigator.userAgentData.platform || navigator.platform || "";
    if (/iPhone|iPad|iPod/.test(ua) || (/Mac/.test(p) && navigator.maxTouchPoints > 1)) return "ios";
    if (/Android/.test(ua)) return "android";
    if (/Win/.test(p) || /Windows/.test(ua)) return "windows";
    if (/Mac/.test(p) || /Mac OS X/.test(ua)) return "mac";
    if (/Linux|X11|CrOS/.test(p + ua)) return "linux";
    return "web";
}

export const PLATFORM_NAMES = { windows: "Windows", mac: "macOS", linux: "Linux", android: "Android", ios: "iPhone and iPad", web: "this browser" };

export async function latestRelease(repo) {
    if (!repo) return null;
    try {
        const res = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, { headers: { Accept: "application/vnd.github+json" } });
        if (!res.ok) return null;
        return await res.json();
    } catch (e) { return null; }
}

export function prettySize(n) {
    if (!n) return "";
    return n > 1e9 ? (n / 1e9).toFixed(1) + " GB" : n > 1e6 ? (n / 1e6).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1e3)) + " KB";
}

// Pair every file kind in the config with the matching release asset (or null).
export function matchFiles(cfg, release) {
    const out = {};
    for (const [group, kinds] of Object.entries(cfg.files || {})) {
        out[group] = kinds.map((k) => {
            const a = release && (release.assets || []).find((x) => new RegExp(k.match, "i").test(x.name));
            return { label: k.label, url: a ? a.browser_download_url : "", size: a ? a.size : 0, name: a ? a.name : "" };
        });
    }
    return out;
}

// Add-to-home-screen / install prompt (Chrome, Edge, Android). Safari has no prompt: see the iPhone steps.
let deferredPrompt = null;
window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferredPrompt = e; window.dispatchEvent(new CustomEvent("ejs-installable")); });
window.addEventListener("appinstalled", () => { deferredPrompt = null; window.dispatchEvent(new CustomEvent("ejs-installed")); });
export const canPromptInstall = () => !!deferredPrompt;
export const isInstalled = () => window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
export async function promptInstall() {
    if (!deferredPrompt) return "unavailable";
    deferredPrompt.prompt();
    const r = await deferredPrompt.userChoice;
    deferredPrompt = null;
    return r.outcome;
}

const STEPS = {
    ios: ["Open this page in <b>Safari</b>.", "Tap the <b>Share</b> button.", "Choose <b>Add to Home Screen</b>, then <b>Add</b>.", "Open EmulatorJS from your home screen. It works offline after the first load."],
    android: ["Tap <b>Install app</b> above (or the browser menu, then <b>Install app</b>).", "Or download the <b>.apk</b> and open it. Android asks you to allow installs from this source once.", "Open EmulatorJS from your app list."],
    windows: ["Download the installer (or the portable .exe, which needs no install).", "Windows SmartScreen may say the app is unrecognised until it has been signed: choose <b>More info</b>, then <b>Run anyway</b>.", "Or install the web app from the browser: Edge or Chrome menu, then <b>Install</b>."],
    mac: ["Open the .dmg and drag EmulatorJS to Applications.", "The first time, right-click the app and choose <b>Open</b> (the app is not notarised unless the publisher added Apple signing).", "Or use Safari: <b>File</b>, then <b>Add to Dock</b>."],
    linux: ["AppImage: <code>chmod +x EmulatorJS*.AppImage</code> then run it.", "Debian or Ubuntu: <code>sudo apt install ./EmulatorJS*.deb</code>.", "Fedora: <code>sudo dnf install ./EmulatorJS*.rpm</code>."],
    web: ["Open the start page and use the browser's Install option if it shows one."]
};

function card(id, title, files, you, steps) {
    const items = (files || []).map((f) => f.url
        ? `<li><a href="${f.url}" rel="noopener"><span>${f.label}</span><em>${prettySize(f.size)}</em></a></li>`
        : `<li><span class="na"><span>${f.label}</span><em>not released yet</em></span></li>`).join("");
    return `<section class="card dl-card${you ? " you" : ""}" id="dl-${id}"><h2>${title}${you ? ' <span class="dl-badge">Your device</span>' : ""}</h2><ul class="dl-list">${items}</ul><ol class="dl-steps">${(steps || []).map((s) => `<li>${s}</li>`).join("")}</ol></section>`;
}

async function init() {
    const cfg = await loadConfig();
    if (!cfg) return;
    const repo = repoOf(cfg);
    const here = detectPlatform();
    const rel = await latestRelease(repo);
    const files = matchFiles(cfg, rel);
    const status = document.getElementById("dlStatus");
    const relUrl = repo ? `https://github.com/${repo}/releases` : "";
    document.getElementById("dlVersion").textContent = rel ? `Latest release: ${rel.tag_name}` : `Version ${cfg.version}`;
    status.innerHTML = rel ? `Released ${new Date(rel.published_at).toLocaleDateString()}. <a href="${relUrl}/latest" rel="noopener">Release notes and all files</a>`
        : repo ? `No release files found yet. When the publisher creates a release, the downloads appear here. <a href="${relUrl}" rel="noopener">Open the releases page</a>`
            : "Downloads are not set up for this copy of the site yet (see RELEASING.md).";
    const main = document.getElementById("dlPrimary");
    const first = (files[here] || []).find((f) => f.url);
    if (first) { main.href = first.url; main.textContent = "Download for " + PLATFORM_NAMES[here]; main.hidden = false; }
    const install = document.getElementById("dlInstall");
    const refreshInstall = () => { install.hidden = isInstalled() || !canPromptInstall(); };
    install.addEventListener("click", async () => { await promptInstall(); refreshInstall(); });
    window.addEventListener("ejs-installable", refreshInstall); window.addEventListener("ejs-installed", refreshInstall);
    refreshInstall();
    const order = ["windows", "mac", "linux", "android", "ios"];
    const titles = { windows: "Windows", mac: "macOS", linux: "Linux", android: "Android", ios: "iPhone and iPad" };
    const iosNote = ["For iPhone and iPad, the quickest way is the web app. Safari steps:"].concat(STEPS.ios);
    document.getElementById("dlGrid").innerHTML = order.map((k) => card(k, titles[k], files[k], k === here, k === "ios" ? STEPS.ios : STEPS[k])).join("");
    document.getElementById("dlOther").innerHTML = card("other", "Everything else", files.other, false, ["The offline zip is the whole site: unzip it and double-click <code>start-windows.bat</code> or run <code>python3 serve.py</code>."]);
    if (here === "ios") document.getElementById("dl-ios")?.scrollIntoView();
}
if (document.getElementById("dlGrid")) init();
