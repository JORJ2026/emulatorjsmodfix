// Game page extras (round 34): previous / next / random game, a game info box with checksums and a core
// switcher, dropping a ROM on the page, picture-in-picture, Alt+Enter, links that carry a save state
// ("share this moment") and a searchable, sortable library view.
import * as library from "./library.js";
import { checksums } from "./hashes.js";
import { SYSTEMS, labelFor, detectSystem } from "./detect.js";
import { gameTitle, playUrl } from "./folders.js";
import { $, banner, params, isAvailable, installedCores, setPreferredCore, preferredCore } from "./common.js";

const RECENT = "__recent";
const STATE_LIMIT = 48 * 1024; // the longest save state a link may carry, before encoding

// ---------- favourites and notes (round 35) ----------
const FAV_KEY = "ejs-favorites";
const NOTES_KEY = "ejs-game-notes";
const readJson = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key) || "null") || fallback; } catch (e) { return fallback; } };
const writeJson = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* storage blocked */ } };
export const favorites = () => readJson(FAV_KEY, []);
export const isFavorite = (name) => favorites().includes(name);
export function toggleFavorite(name) {
    const list = favorites();
    const at = list.indexOf(name);
    if (at >= 0) list.splice(at, 1); else list.push(name);
    writeJson(FAV_KEY, list.slice(-500));
    return at < 0;
}
export function setupFavorite(game) {
    const buttons = [$("favBtn"), $("sheetFav")].filter(Boolean);
    const draw = () => {
        const on = isFavorite(game.name);
        for (const b of buttons) {
            b.textContent = (on ? "★" : "☆") + (b.id === "sheetFav" ? " Favourite" : "");
            b.setAttribute("aria-pressed", on ? "true" : "false");
            b.title = on ? "In your favourites: click to remove" : "Add this game to your favourites (listed first in the library)";
        }
    };
    for (const b of buttons) {
        b.hidden = false;
        b.addEventListener("click", () => { const on = toggleFavorite(game.name); draw(); banner(on ? "Added to your favourites." : "Removed from your favourites.", "ok"); });
    }
    draw();
}
/** Save, load and screenshot buttons for the engine that has them (EmulatorJSMod). */
export function setupQuickButtons() {
    const act = (name) => () => {
        const E = window.EJS_emulator;
        const N = E && E.enhancements;
        if (!N || !E.started) return;
        if (name === "save") N.quickSave();
        else if (name === "load") N.quickLoad();
        else N.screenshot();
    };
    for (const [ids, name] of [[["saveBtn", "sheetSave"], "save"], [[ "loadBtn", "sheetLoad"], "load"], [["shotBtn", "sheetShot"], "shot"]]) {
        for (const id of ids) {
            const b = $(id);
            if (!b) continue;
            b.hidden = false;
            b.addEventListener("click", act(name));
        }
    }
}

const played = (name) => library.playtimeFor(name.replace(/\.[^.]*$/, "")) || library.playtimeFor(name);
function hoursText(seconds) {
    if (!seconds) return "not played yet";
    return library.formatPlaytime(seconds) || "under a minute";
}

// ---------- previous / next / random ----------
/** The games around this one: its library folder, else the recent games. */
export function neighbours(folders, current) {
    if (current.platform && current.platform !== RECENT) {
        const folder = folders.find((f) => f.folder === current.platform);
        if (!folder || folder.files.length < 2 || !current.game) return null;
        const list = folder.files.map((f) => ({ key: "file:" + f.name, url: playUrl({ folder: folder.folder, file: f.name }), title: gameTitle(f.name) }));
        return { list, at: list.findIndex((g) => g.key === current.game) };
    }
    const recent = library.listRecent().filter((e) => e.stored || e.url);
    if (recent.length < 2) return null;
    const list = recent.map((e) => ({ key: "id:" + e.id, url: playUrl({ id: e.id }), title: gameTitle(e.name) }));
    const id = params.get("id");
    return { list, at: id ? list.findIndex((g) => g.key === "id:" + id) : -1 };
}
export function setupNavigation(folders, current) {
    const n = neighbours(folders, current);
    if (!n) return;
    const go = (step) => {
        let at = n.at < 0 ? 0 : (n.at + step + n.list.length) % n.list.length;
        if (step === 0) {
            const others = n.list.filter((_, i) => i !== n.at);
            location.href = others[Math.floor(Math.random() * others.length)].url;
            return;
        }
        location.href = n.list[at].url;
    };
    const prev = n.list[(Math.max(n.at, 0) - 1 + n.list.length) % n.list.length];
    const next = n.list[(Math.max(n.at, 0) + 1) % n.list.length];
    const wire = (id, step, title) => {
        const b = $(id);
        if (!b) return;
        b.hidden = false;
        if (title) b.title = title;
        b.addEventListener("click", () => go(step));
    };
    wire("prevBtn", -1, "Previous game: " + prev.title);
    wire("nextBtn", 1, "Next game: " + next.title);
    wire("randomBtn", 0, "A random game from this list");
    // Alt+] and Alt+[ move through the list from the keyboard
    document.addEventListener("keydown", (e) => {
        if (!e.altKey || e.ctrlKey || e.metaKey) return;
        if (e.code === "BracketRight") { e.preventDefault(); go(1); }
        else if (e.code === "BracketLeft") { e.preventDefault(); go(-1); }
    });
    wire("sheetPrev", -1);
    wire("sheetNext", 1);
    wire("sheetRandom", 0);
}

// ---------- game info and core switcher ----------
export function setupInfo(game, current) {
    const dialog = $("infoDialog");
    if (!dialog) return;
    const open = () => showInfo(game, dialog);
    for (const id of ["infoBtn", "sheetInfo"]) {
        const b = $(id);
        if (!b) continue;
        b.hidden = false;
        b.addEventListener("click", open);
    }
    // The title shows the play time too
    $("title").title += " · " + hoursText(played(game.name)) + " · click for details";
    $("title").addEventListener("click", open);
}
async function romBlob(game) {
    if (game.rom instanceof Blob) return game.rom;
    const response = await fetch(game.rom);
    if (!response.ok) throw new Error("HTTP " + response.status);
    return response.blob();
}
async function showInfo(game, dialog) {
    const E = window.EJS_emulator;
    const core = (E && E.getCore && E.started && E.getCore()) || game.core || "default";
    dialog.textContent = "";
    const h = document.createElement("h2");
    h.textContent = gameTitle(game.name);
    const table = document.createElement("dl");
    table.className = "info-list";
    const row = (label, value) => {
        const dt = document.createElement("dt");
        dt.textContent = label;
        const dd = document.createElement("dd");
        dd.textContent = value;
        table.append(dt, dd);
        return dd;
    };
    row("File", game.name);
    row("System", labelFor(game.system));
    row("Core", core);
    row("Played", hoursText(played(game.name)));
    const lastEntry = library.listRecent().find((e) => e.name === game.name);
    if (lastEntry && lastEntry.lastPlayed) row("Last played", library.timeAgo(lastEntry.lastPlayed));
    const sizeRow = row("Size", "…");
    const crcRow = row("CRC32", "…");
    const md5Row = row("MD5", "…");
    const shaRow = row("SHA-1", "…");
    for (const dd of [crcRow, md5Row, shaRow]) dd.className = "mono";

    // Core switcher: the cores installed for this system
    const cores = installedCores(game.system);
    const coreBox = document.createElement("p");
    if (cores.length > 1) {
        const label = document.createElement("label");
        label.textContent = "Core for " + labelFor(game.system) + " games: ";
        const select = document.createElement("select");
        for (const c of cores) {
            const o = document.createElement("option");
            o.value = c;
            o.textContent = c + (c === core ? " (running)" : "");
            select.appendChild(o);
        }
        select.value = cores.includes(core) ? core : (preferredCore(game.system) || cores[0]);
        const apply = document.createElement("button");
        apply.type = "button";
        apply.className = "button";
        apply.textContent = "Switch and restart";
        apply.addEventListener("click", () => {
            setPreferredCore(game.system, select.value);
            const E2 = window.EJS_emulator;
            if (E2 && E2.enhancements && E2.started) E2.enhancements.autoSave(true);
            const url = new URL(location.href);
            // &core= naming a core would win over the choice: name the system instead
            if (url.searchParams.has("core")) url.searchParams.set("core", game.system);
            setTimeout(() => location.replace(url.href), 300);
        });
        label.appendChild(select);
        coreBox.append(label, " ", apply);
        const note = document.createElement("small");
        note.className = "muted";
        note.textContent = " Save states belong to one core; in-game saves carry over.";
        coreBox.appendChild(note);
    } else {
        coreBox.className = "muted small";
        coreBox.textContent = "Only one core is installed for " + labelFor(game.system) + ".";
    }

    // Notes for this game, kept on this device
    const notes = readJson(NOTES_KEY, {});
    const noteBox = document.createElement("textarea");
    noteBox.className = "info-notes";
    noteBox.rows = 3;
    noteBox.maxLength = 2000;
    noteBox.placeholder = "Notes for this game (kept on this device)";
    noteBox.setAttribute("aria-label", "Notes for this game");
    noteBox.value = notes[game.name] || "";
    noteBox.addEventListener("input", () => {
        const all = readJson(NOTES_KEY, {});
        if (noteBox.value.trim()) all[game.name] = noteBox.value; else delete all[game.name];
        writeJson(NOTES_KEY, all);
    });
    // Escape inside the notes must not close the box while typing is still going on
    noteBox.addEventListener("keydown", (e) => e.stopPropagation());

    const actions = document.createElement("div");
    actions.className = "play-error-actions";
    const download = document.createElement("button");
    download.type = "button";
    download.className = "button";
    download.textContent = "Download file";
    download.addEventListener("click", async () => {
        try {
            const blob = await romBlob(game);
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = game.name;
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 2000);
        } catch (e) { banner("The file could not be read: " + e.message, "warn"); }
    });
    const reload = document.createElement("button");
    reload.type = "button";
    reload.className = "button";
    reload.textContent = "Reload player";
    reload.title = "Starts the player again; your place is saved first and offered back";
    reload.addEventListener("click", () => {
        const E2 = window.EJS_emulator;
        if (E2 && E2.enhancements && E2.started) E2.enhancements.autoSave(true);
        setTimeout(() => location.reload(), 300);
    });
    const copy = document.createElement("button");
    copy.type = "button";
    copy.className = "button";
    copy.textContent = "Copy details";
    copy.addEventListener("click", () => {
        const text = [...table.querySelectorAll("dt")].map((dt) => dt.textContent + ": " + dt.nextElementSibling.textContent).join("\n");
        navigator.clipboard.writeText(text).then(() => { copy.textContent = "Copied"; }, () => {});
    });
    const close = document.createElement("button");
    close.type = "button";
    close.className = "button";
    close.textContent = "Close";
    close.addEventListener("click", () => dialog.close());
    actions.append(download, reload, copy, close);
    // Homebrew games have a page of their own with credits and the licence
    const showcase = typeof game.rom === "string" && game.rom.match(/(?:^|\/)homebrew\/([\w-]+)\//);
    if (showcase) {
        const a = document.createElement("a");
        a.className = "button";
        a.href = "homebrew.html?game=" + showcase[1];
        a.textContent = "About this game";
        actions.insertBefore(a, close);
    }
    dialog.append(h, table, coreBox, noteBox, actions);

    // Pause while reading (and carry on afterwards)
    const E3 = window.EJS_emulator;
    const wasRunning = E3 && E3.started && !E3.paused;
    if (wasRunning) E3.pause(true);
    dialog.addEventListener("close", () => { if (wasRunning && E3.paused) E3.play(true); }, { once: true });
    dialog.showModal();
    close.focus();

    try {
        const blob = await romBlob(game);
        sizeRow.textContent = blob.size >= 1048576 ? (blob.size / 1048576).toFixed(2) + " MB" : Math.round(blob.size / 1024) + " KB";
        sizeRow.textContent += " (" + blob.size.toLocaleString() + " bytes)";
        const sums = await checksums(blob, (f) => { crcRow.textContent = Math.round(f * 100) + "%"; });
        crcRow.textContent = sums.crc32;
        md5Row.textContent = sums.md5;
        shaRow.textContent = sums.sha1 || "not available in this browser";
    } catch (e) {
        sizeRow.textContent = crcRow.textContent = md5Row.textContent = shaRow.textContent = "could not be read (" + e.message + ")";
    }
}

// ---------- drop a game on the page ----------
export function setupRomDrop(onlyWhenLibrary) {
    const available = SYSTEMS.filter(([id]) => isAvailable(id));
    document.addEventListener("dragover", (e) => {
        if (e.dataTransfer && [...e.dataTransfer.types].includes("Files")) {
            e.preventDefault();
            document.body.classList.add("drop-hover");
        }
    });
    document.addEventListener("dragleave", (e) => { if (!e.relatedTarget) document.body.classList.remove("drop-hover"); });
    document.addEventListener("drop", async (e) => {
        document.body.classList.remove("drop-hover");
        const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
        if (!file) return;
        e.preventDefault();
        // Save states are the game's business (dropped on the game itself)
        if (/\.(state|st\d?|ss\d?)$/i.test(file.name)) {
            banner("Drop a save state on the game picture to load it.", "warn");
            return;
        }
        const { system } = await detectSystem(file, available).catch(() => ({ system: null }));
        if (!system) {
            banner(`Can't tell which system "${file.name}" is for. Open it from the home page to choose.`, "warn");
            return;
        }
        const E = window.EJS_emulator;
        if (E && E.enhancements && E.started) E.enhancements.autoSave(true);
        const id = await library.remember({ rom: file, name: file.name, system });
        location.href = playUrl({ id });
    });
}

// ---------- picture-in-picture ----------
export function setupPip() {
    const button = $("pipBtn");
    const video = document.createElement("video");
    if (!button || !document.pictureInPictureEnabled || !HTMLCanvasElement.prototype.captureStream || !video.requestPictureInPicture) return;
    button.hidden = false;
    video.muted = true;
    video.playsInline = true;
    button.addEventListener("click", async () => {
        if (document.pictureInPictureElement) {
            await document.exitPictureInPicture().catch(() => {});
            return;
        }
        const E = window.EJS_emulator;
        const canvas = E && E.started && E.canvas;
        if (!canvas) return;
        video.srcObject = canvas.captureStream(60);
        try {
            await video.play();
            await video.requestPictureInPicture();
            window.EJS_pipActive = true;
            if (E.paused) E.play(true);
        } catch (e) {
            banner("Picture-in-picture is not available here: " + e.message, "warn");
        }
    });
    video.addEventListener("leavepictureinpicture", () => {
        window.EJS_pipActive = false;
        video.srcObject = null;
    });
}

// ---------- Alt+Enter ----------
export function setupAltEnter() {
    document.addEventListener("keydown", (e) => {
        if (!(e.altKey && e.key === "Enter")) return;
        const E = window.EJS_emulator;
        if (!E || !E.started) return;
        e.preventDefault();
        E.toggleFullscreen(!(document.fullscreenElement || document.webkitFullscreenElement));
    }, true);
}

// ---------- share this moment: a link carrying a save state ----------
const toB64 = (bytes) => {
    let s = "";
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const fromB64 = (text) => Uint8Array.from(atob(text.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
async function squeeze(bytes, mode) {
    const stream = new Blob([bytes]).stream().pipeThrough(mode === "c" ? new CompressionStream("deflate-raw") : new DecompressionStream("deflate-raw"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
}
export function setupMoment(shareableLink) {
    const button = $("momentBtn");
    if (!button || !window.CompressionStream || !shareableLink()) return;
    button.hidden = false;
    button.addEventListener("click", async () => {
        const E = window.EJS_emulator;
        if (!E || !E.started) return;
        try {
            const packed = await squeeze(E.gameManager.getState(), "c");
            if (packed.length > STATE_LIMIT) {
                banner(`This game's save state is too big for a link (${Math.round(packed.length / 1024)} KB). Use Save slots → Download instead.`, "warn");
                return;
            }
            const url = new URL(shareableLink());
            url.hash = "state=" + toB64(packed);
            await navigator.clipboard.writeText(url.href);
            banner(`Link copied: it opens this game at this moment (${Math.round(url.href.length / 1024)} KB link).`, "ok");
        } catch (e) {
            banner("Could not make the link: " + e.message, "warn");
        }
    });
}
/** A link with #state= loads that moment once the game has started. */
export function loadMomentFromLink() {
    const m = location.hash.match(/^#state=([\w-]+)$/);
    if (!m || !window.DecompressionStream) return;
    const tryLoad = async (tries) => {
        const E = window.EJS_emulator;
        if (!E || !E.started) {
            if (tries < 120) setTimeout(() => tryLoad(tries + 1), 500);
            return;
        }
        try {
            const state = await squeeze(fromB64(m[1]), "d");
            setTimeout(() => {
                E.gameManager.loadState(state);
                banner("Started at the moment shared in the link.", "ok");
            }, 600);
        } catch (e) {
            banner("The moment in this link could not be read.", "warn");
        }
        history.replaceState(null, "", location.pathname + location.search);
    };
    tryLoad(0);
}

// ---------- library view: search, sort, last played, play time, continue, random ----------
export function enhanceLibrary(box) {
    const sections = [...box.querySelectorAll("section")];
    const buttons = [...box.querySelectorAll(".games button")];
    if (!buttons.length) return;
    const favs = new Set(favorites());
    const recent = library.listRecent();
    const lastFor = (file) => {
        const hit = recent.find((e) => e.name === file || (e.url && decodeURIComponent(e.url).endsWith("/" + file)));
        return hit ? hit.lastPlayed || 0 : 0;
    };
    for (const b of buttons) {
        const file = b.title;
        const seconds = played(file);
        const last = lastFor(file);
        b.dataset.last = last;
        b.dataset.secs = seconds || 0;
        b.dataset.fav = favs.has(file) ? "1" : "";
        b.dataset.name = b.textContent.toLowerCase();
        // A star beside each game (or press f on it)
        const star = document.createElement("button");
        star.type = "button";
        star.className = "fav";
        star.title = "Favourite (f)";
        star.tabIndex = -1;
        const drawStar = () => { star.textContent = b.dataset.fav ? "★" : "☆"; star.setAttribute("aria-pressed", b.dataset.fav ? "true" : "false"); star.setAttribute("aria-label", "Favourite: " + file); };
        star.addEventListener("click", () => { b.dataset.fav = toggleFavorite(file) ? "1" : ""; drawStar(); apply(); });
        b.closest("li").appendChild(star);
        b._drawStar = drawStar;
        drawStar();
        if (seconds || last) {
            const meta = document.createElement("small");
            meta.className = "meta";
            meta.textContent = [last ? library.timeAgo(last) : "", seconds ? library.formatPlaytime(seconds) : ""].filter(Boolean).join(" · ");
            b.appendChild(meta);
        }
    }
    const totalSeconds = buttons.reduce((n, b) => n + (+b.dataset.secs || 0), 0);
    // Continue: the game played last, at the top
    const latest = buttons.filter((b) => +b.dataset.last).sort((a, b) => b.dataset.last - a.dataset.last)[0];
    const tools = document.createElement("div");
    tools.className = "library-tools";
    if (latest) {
        const cont = document.createElement("button");
        cont.type = "button";
        cont.className = "button primary continue";
        cont.textContent = "▶ Continue: " + latest.firstChild.textContent;
        cont.addEventListener("click", () => latest.click());
        tools.appendChild(cont);
    }
    const search = document.createElement("input");
    search.type = "search";
    search.placeholder = "Search " + buttons.length + " games";
    search.setAttribute("aria-label", "Search the games");
    const sort = document.createElement("select");
    sort.setAttribute("aria-label", "Sort the games");
    for (const [v, t] of [["az", "A–Z"], ["recent", "Played recently"]]) {
        const o = document.createElement("option");
        o.value = v;
        o.textContent = t;
        sort.appendChild(o);
    }
    try { sort.value = localStorage.getItem("ejs-library-sort") || "az"; } catch (e) { /* storage blocked */ }
    const random = document.createElement("button");
    random.type = "button";
    random.className = "button";
    random.textContent = "🎲 Random";
    random.addEventListener("click", () => {
        const shown = buttons.filter((b) => !b.disabled && !b.closest("li").hidden);
        if (shown.length) shown[Math.floor(Math.random() * shown.length)].click();
    });
    const none = document.createElement("p");
    none.className = "note";
    none.hidden = true;
    none.textContent = "No game matches.";
    const filter = document.createElement("select");
    filter.setAttribute("aria-label", "Show which games");
    for (const [v, t] of [["all", "All games"], ["fav", "★ Favourites"], ["new", "Not played yet"], ["played", "Played"]]) {
        const o = document.createElement("option");
        o.value = v;
        o.textContent = t;
        filter.appendChild(o);
    }
    tools.append(search, filter, sort, random);
    if (totalSeconds >= 60) {
        const total = document.createElement("span");
        total.className = "muted small library-total";
        total.textContent = "Played " + (library.formatPlaytime(totalSeconds) || "").replace(" played", "") + " in all";
        tools.appendChild(total);
    }
    // The games played lately, one click away
    const lately = buttons.filter((b) => +b.dataset.last && b !== latest).sort((a, b) => b.dataset.last - a.dataset.last).slice(0, 5);
    if (lately.length) {
        const row = document.createElement("div");
        row.className = "library-recent";
        const lab = document.createElement("span");
        lab.className = "muted small";
        lab.textContent = "Recent:";
        row.appendChild(lab);
        for (const b of lately) {
            const chip = document.createElement("button");
            chip.type = "button";
            chip.className = "button chip";
            chip.textContent = b.firstChild.textContent;
            chip.addEventListener("click", () => b.click());
            row.appendChild(chip);
        }
        tools.appendChild(row);
    }
    box.insertBefore(tools, box.querySelector("section"));
    box.insertBefore(none, box.querySelector("section"));

    const apply = () => {
        const q = search.value.trim().toLowerCase();
        let any = false;
        for (const section of sections) {
            const list = section.querySelector(".games");
            const items = [...list.children];
            items.sort((a, b) => {
                const x = a.querySelector("button"), y = b.querySelector("button");
                if (!!x.dataset.fav !== !!y.dataset.fav) return x.dataset.fav ? -1 : 1;
                if (sort.value === "recent" && (+y.dataset.last || +x.dataset.last)) return (+y.dataset.last) - (+x.dataset.last);
                return x.dataset.name.localeCompare(y.dataset.name);
            });
            let shown = 0;
            for (const li of items) {
                const g = li.querySelector("button");
                const f = filter.value;
                li.hidden = (!!q && !g.dataset.name.includes(q)) || (f === "fav" && !g.dataset.fav) || (f === "new" && +g.dataset.secs > 0) || (f === "played" && !(+g.dataset.secs > 0));
                if (!li.hidden) shown++;
                list.appendChild(li);
            }
            section.hidden = shown === 0;
            any = any || shown > 0;
        }
        none.hidden = any;
    };
    try { search.value = sessionStorage.getItem("ejs-library-search") || ""; } catch (e) { /* storage blocked */ }
    search.addEventListener("input", () => {
        try { sessionStorage.setItem("ejs-library-search", search.value); } catch (e) { /* storage blocked */ }
        apply();
    });
    filter.addEventListener("change", apply);
    sort.addEventListener("change", () => {
        try { localStorage.setItem("ejs-library-sort", sort.value); } catch (e) { /* storage blocked */ }
        apply();
    });
    // "/" jumps to the search box, Escape clears it
    document.addEventListener("keydown", (e) => {
        if (e.key === "/" && document.activeElement !== search) { e.preventDefault(); search.focus(); }
    });
    box.addEventListener("keydown", (e) => {
        const t = e.target;
        if ((e.key === "f" || e.key === "F") && t && t.matches && t.matches(".games button:not(.fav)") && !e.ctrlKey && !e.metaKey && !e.altKey) {
            t.dataset.fav = toggleFavorite(t.title) ? "1" : "";
            if (t._drawStar) t._drawStar();
            apply();
            t.focus();
        }
    });
    search.addEventListener("keydown", (e) => {
        if (e.key === "Escape") { search.value = ""; try { sessionStorage.removeItem("ejs-library-search"); } catch (err) { /* storage blocked */ } apply(); }
        if (e.key === "Enter") {
            const first = buttons.find((b) => !b.disabled && !b.closest("li").hidden);
            if (first) first.click();
        }
    });
    apply();
}
