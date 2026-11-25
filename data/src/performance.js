/**
 * Performance features for EmulatorJSMod: measurement (stats overlay, startup timing, slow-game detection,
 * software-graphics detection), tuning (performance mode, render scale, auto frameskip, shader bypass,
 * low-latency canvas, run-ahead, refresh-rate adaptation, audio latency profiles), per-game profiles and a
 * low-battery power saver. Settings that RetroArch only reads at boot (run-ahead, swap interval, audio
 * latency, canvas mode) apply from the next start; the rest apply immediately.
 *
 * Lag check (round 32): every second the engine measures emulation speed (core frames against the game's own rate),
 * picture hitches (display frames that took far too long), how even the speed is, long tasks on the page and
 * whether the game has frozen. It names the problem (too slow, stuttering, uneven, frozen) and offers the fixes for
 * it, cheapest first: fixes that work at once (a lighter performance mode) before ones that need a reload (run-ahead,
 * rewind, audio latency, low-latency canvas), which keep the player's place. After a fix it checks again and says
 * whether it helped, offering the next fix if not. "Fix lag automatically" (and kiosk screens) apply the immediate
 * fixes without asking.
 *
 * Performance modes: Quality, Balanced (auto frameskip), Performance (also 75 % render resolution, shader off,
 * no run-ahead) and Maximum (also 50 % render resolution, 128 ms audio). NES and SNES keep their 2xScaleHQ shader in
 * every mode.
 */
const STORE_KEY = "ejs-perf";
const DEFAULTS = {
    renderScale: 1,
    performanceMode: false,
    runAhead: false,
    lowLatency: true,
    audioLatency: 64,
    powerSaver: true,
    pictureBuffer: true,
    leanSurface: true,
    audioSuspend: true,
    mode: null,          // quality | balanced | performance | max (null: from the older performanceMode switch)
    autoFix: false,      // apply the immediate fixes without asking
    lagChecks: true,     // watch for lag at all
    integerScale: false, // round 33: pixel-perfect size (needs the picture-sized render buffer)
    aspect: "auto",      // round 34: auto | 4:3 | square | 16:9 | fill (needs the picture-sized render buffer)
    statsCorner: "tr"    // round 34: where Shift+F10 stats sit (tl, tr, br, bl)
};
const MODES = {
    quality: { rank: 0, label: "Quality", scale: 1, frameskip: false, shaderOff: false, note: "everything on" },
    balanced: { rank: 1, label: "Balanced", scale: 1, frameskip: true, shaderOff: false, note: "auto frameskip: the game keeps full speed by skipping a drawn frame when it must" },
    performance: { rank: 2, label: "Performance", scale: 0.75, frameskip: true, shaderOff: true, note: "also 75% render resolution, shader off (not on NES/SNES), no run-ahead" },
    max: { rank: 3, label: "Maximum performance", scale: 0.5, frameskip: true, shaderOff: true, audio: 128, note: "also 50% render resolution and 128 ms audio (next start)" }
};
const MODE_ORDER = ["quality", "balanced", "performance", "max"];
// Lag check thresholds
const CHECK = {
    slowSpeed: 0.9,       // below this a second counts as slow
    slowOf: [5, 6],       // slow in 5 of the last 6 seconds
    hitchFrames: 3,       // a display frame longer than 3 refreshes is a hitch
    stutterHitches: 5,    // hitches in the last 10 seconds
    unevenSpread: 0.08,   // standard deviation of speed over 10 seconds
    frozenSeconds: 4,     // no new game frame while it should be running
    again: 120000,        // the same problem is offered again after 2 minutes
    notNow: 300000,       // "Not now" waits 5 minutes
    afterFix: 10000       // a fix is judged 10 seconds later
};
// A worse problem replaces the notice for a lesser one
const SEVERITY = { frozen: 4, slow: 3, stutter: 2, uneven: 1 };
// Cores that may draw 3D straight to the screen surface and need its depth and stencil buffers
const THREE_D_CORES = ["mupen64plus_next", "parallel_n64", "ppsspp", "azahar", "citra", "flycast", "beetle_psx_hw", "mednafen_psx_hw",
    "melonds", "desmume", "desmume2015", "dolphin", "yabasanshiro", "kronos", "dosbox_pure"];
const SOFTWARE_RENDERER = /swiftshader|llvmpipe|softpipe|basic render|software|mesa offscreen/i;
const WARMUP_MS = 8000;
const DIARY_KEY = "ejs-perf-diary";

function readStore() {
    try {
        const data = JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
        return { last: data.last || {}, games: data.games || {}, device: data.device || {} };
    } catch (e) {
        return { last: {}, games: {}, device: {} };
    }
}
function writeStore(store) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch (e) { /* storage full */ }
}
/**
 * Round 33: the mode this device needs, learned from lag fixes. When three or more games needed a lighter mode,
 * a game played for the first time starts in the one most of them needed.
 */
function learnedMode(store) {
    const modes = Object.values(store.device || {}).filter((m) => MODES[m] && MODES[m].rank >= 1);
    if (modes.length < 3) return null;
    const count = {};
    for (const m of modes) count[m] = (count[m] || 0) + 1;
    return Object.keys(count).sort((a, b) => count[b] - count[a] || MODES[a].rank - MODES[b].rank)[0];
}

class EJS_Performance {
    constructor(ejs) {
        this.ejs = ejs;
        this.gameKey = (typeof ejs.config.gameName === "string" && ejs.config.gameName) || "default";
        const store = readStore();
        // Feature 13: per-game profile, falling back to the settings last used for any game
        this.profile = Object.assign({}, DEFAULTS, store.last, store.games[this.gameKey] || {});
        // A game played for the first time does not inherit another game's mode; it starts in the mode this device
        // has been shown to need (round 33), or Quality
        if (!store.games[this.gameKey]) {
            this.learned = learnedMode(store);
            // Round 34: a device with little memory or few processor cores starts new games in Balanced
            const lowEnd = (navigator.deviceMemory && navigator.deviceMemory <= 2) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2);
            if (!this.learned && lowEnd) {
                this.learned = "balanced";
                this.learnedWhy = "this device has " + (navigator.deviceMemory && navigator.deviceMemory <= 2 ? "little memory" : "few processor cores");
            }
            this.profile.mode = this.learned || "quality";
            this.profile.performanceMode = !!this.learned;
            // Round 35: the shape last chosen for this system (4:3 for SNES, say) is where a new game starts
            let shape = null;
            try { shape = localStorage.getItem("ejs-aspect-" + ejs.getCore(true)); } catch (e) { /* storage blocked */ }
            this.profile.aspect = ["auto", "4:3", "square", "16:9", "fill"].includes(shape) ? shape : DEFAULTS.aspect;
        }
        // A page that embeds the player can ask for settings for this run only (community spaces: low power)
        if (window.EJS_perfOverride) {
            Object.assign(this.profile, window.EJS_perfOverride);
            if (window.EJS_perfOverride.performanceMode && !window.EJS_perfOverride.mode) this.profile.mode = "performance";
        }
        this.marks = { construct: performance.now() };
        this.timing = null;
        this.refreshHz = null;
        this.expectedFps = 60;
        this.speedHistory = [];
        this.frameTimes = [];
        this.samples = [];            // one per second: { speed, hitches, longTask, playing }
        this.hitches = 0;
        this.longTaskMs = 0;
        this.lastOffer = {};
        this.fixLog = [];
        this.health = { state: "starting", text: "Starting", issue: null };
        this.saved = { shader: null, frameskip: {} };
        this.installLowLatencyCanvas();
        this.measureRefreshRate();
        ejs.on("start", () => this.onStart());
        ejs.on("pause", () => this.updateAudioPower());
        ejs.on("play", () => this.updateAudioPower());
        ejs.on("exit", () => this.stop());
    }

    // ---------- profile ----------
    saveProfile() {
        if (window.EJS_perfOverride) return; // a run with settings chosen by the embedding page is not remembered
        const store = readStore();
        const values = Object.assign({}, this.profile);
        store.games[this.gameKey] = values;
        store.last = values;
        writeStore(store);
    }
    /** A lag fix chose a lighter mode for this game: remember it for the device-wide default. */
    learnFix(mode) {
        if (window.EJS_perfOverride || window.EJS_kiosk) return;
        const store = readStore();
        store.device[this.gameKey] = mode;
        const keys = Object.keys(store.device);
        if (keys.length > 40) delete store.device[keys[0]];
        writeStore(store);
    }
    // ---------- round 33: lag diary, the last ten problems and fixes for this game ----------
    diary() {
        try { return (JSON.parse(localStorage.getItem(DIARY_KEY) || "{}")[this.gameKey]) || []; } catch (e) { return []; }
    }
    note(kind, text) {
        if (window.EJS_kiosk) return;
        let all = {};
        try { all = JSON.parse(localStorage.getItem(DIARY_KEY) || "{}"); } catch (e) { all = {}; }
        const list = all[this.gameKey] || [];
        list.push({ at: Date.now(), kind, text });
        all[this.gameKey] = list.slice(-10);
        const keys = Object.keys(all);
        if (keys.length > 60) delete all[keys[0]];
        try { localStorage.setItem(DIARY_KEY, JSON.stringify(all)); } catch (e) { /* storage full */ }
        this.sessionCounts = this.sessionCounts || { problems: 0, fixes: 0 };
        if (kind === "problem") this.sessionCounts.problems++;
        if (kind === "fix") this.sessionCounts.fixes++;
    }
    /** Round 33: start measuring again (tab back, resize, fullscreen, a state loaded, a reset): those moments are not lag. */
    rewarm() {
        this.samples = [];
        this.measureFrom = performance.now();
        this.lastNewFrameAt = performance.now();
        this.rateSeen = [];
    }
    set(name, value) {
        this.profile[name] = value;
        this.saveProfile();
        if (name === "aspect") {
            try { localStorage.setItem("ejs-aspect-" + this.ejs.getCore(true), String(value)); } catch (e) { /* storage blocked */ }
        }
        if (name === "renderScale" || name === "pictureBuffer" || name === "integerScale" || name === "aspect") this.applyRenderScale();
        if (name === "performanceMode") {
            this.profile.mode = value ? (this.mode() === "quality" ? "performance" : this.mode()) : "quality";
            this.saveProfile();
            this.applyPerformanceMode();
        }
        if (name === "audioSuspend") this.updateAudioPower();
    }

    // ---------- Feature 2: startup timing ----------
    mark(name) {
        this.marks[name] = performance.now();
    }
    buildTiming() {
        const m = this.marks;
        const span = (a, b) => (m[a] !== undefined && m[b] !== undefined ? Math.max(0, Math.round(m[b] - m[a])) : null);
        this.timing = {
            core: span("construct", "coreReady"),
            game: span("coreReady", "gameReady"),
            boot: span("gameReady", "started"),
            total: span("construct", "started")
        };
        if (this.ejs.debug) console.log("[EJS Performance] Startup timing (ms):", this.timing);
    }

    // ---------- Feature 8: low-latency canvas ----------
    /**
     * Context options for the game canvas, applied when RetroArch creates its WebGL context:
     * - desynchronized (feature 8): frames go to the screen without waiting for the page compositor.
     * - round 8, lean opaque surface: alpha off, so the browser composites the game as an opaque layer (no blending
     *   with the page, eligible for hardware overlays), and for 2D cores no depth or stencil buffer on the screen
     *   surface, which those cores never use. 3D-capable cores keep both.
     */
    installLowLatencyCanvas() {
        HTMLCanvasElement.prototype.ejsPerformance = this;
        if (HTMLCanvasElement.prototype.ejsContextPatched) return;
        const original = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.ejsContextPatched = true;
        HTMLCanvasElement.prototype.getContext = function (type, attributes) {
            const perf = HTMLCanvasElement.prototype.ejsPerformance;
            const game = perf && perf.ejs.frontend && perf.ejs.frontend.canvas;
            if (game && this === game && /webgl/.test(String(type))) {
                attributes = perf.contextAttributes(attributes);
                perf.surface = attributes;
            }
            return original.call(this, type, attributes);
        };
    }
    usesDepth() {
        const core = String(this.ejs.getCore() || "");
        return THREE_D_CORES.includes(core) || /_hw$|gl$/.test(core) || this.ejs.config.keepDepthBuffer === true;
    }
    contextAttributes(requested) {
        const out = Object.assign({ powerPreference: "high-performance" }, requested || {});
        if (this.profile.lowLatency) out.desynchronized = true;
        // 2.5D reads every finished frame from this canvas, so the frame must still be there when it does
        // 2.5D and the classroom (which reads the picture while the game is paused) need the last frame kept
        if (this.ejs.wantsDepth25 || window.EJS_preserveFrame === true) out.preserveDrawingBuffer = true;
        if (this.profile.leanSurface !== false) {
            out.alpha = false;
            out.premultipliedAlpha = false;
            if (!this.usesDepth()) {
                out.depth = false;
                out.stencil = false;
            }
            out.antialias = false;
        }
        return out;
    }
    describeSurface() {
        const a = this.surface;
        if (!a) return "?";
        if (this.profile.leanSurface === false) return "standard (lean surface off)";
        return (a.alpha === false ? "opaque" : "transparent") + ", " + (a.depth === false ? "no depth/stencil (2D core)" : "depth/stencil kept (3D core)");
    }

    // ---------- Feature 10: refresh-rate adaptation ----------
    measureRefreshRate() {
        const times = [];
        const step = (t) => {
            times.push(t);
            if (times.length < 31) {
                requestAnimationFrame(step);
                return;
            }
            const deltas = times.slice(1).map((v, i) => v - times[i]).sort((a, b) => a - b);
            const median = deltas[Math.floor(deltas.length / 2)];
            this.refreshHz = median > 0 ? Math.round(1000 / median) : null;
        };
        requestAnimationFrame(step);
    }
    /** RetroArch swap interval: on 120/180/240 Hz screens present every 2nd/3rd/4th refresh so games keep 60 fps. */
    swapInterval() {
        const hz = this.refreshHz;
        if (!hz) return 1;
        for (const multiple of [4, 3, 2]) {
            if (Math.abs(hz - 60 * multiple) <= 4) return multiple;
        }
        return 1;
    }

    // ---------- Features 9, 10, 11: settings RetroArch reads at boot ----------
    retroarchCfg() {
        let cfg = "";
        cfg += "video_swap_interval = " + this.swapInterval() + "\n";
        if (this.profile.runAhead && MODES[this.mode()].rank < 2) {
            cfg += "run_ahead_enabled = true\nrun_ahead_frames = 1\nrun_ahead_secondary_instance = false\nrun_ahead_hide_warnings = true\n";
        } else {
            cfg += "run_ahead_enabled = false\n";
        }
        return cfg;
    }
    audioLatency() {
        const value = parseInt(this.profile.audioLatency, 10);
        const chosen = [32, 64, 96, 128].includes(value) ? value : 64;
        return Math.max(chosen, MODES[this.mode()].audio || 0);
    }

    // ---------- start ----------
    onStart() {
        this.mark("started");
        this.buildTiming();
        this.detectRenderer();
        this.applyRenderScale();
        this.watchLayout();
        if (this.mode() !== "quality") this.applyPerformanceMode();
        this.startMonitor();
        this.watchBattery();
        this.watchAudioPower();
        this.watchRewarm();
        this.watchMemory();
        if (this.learned) {
            this.notify(`Started in ${MODES[this.learned].label} mode: ${this.learnedWhy || "this device needed it for other games"}.`, [
                ["Use Quality", () => this.setMode("quality")],
                ["OK", null, true]
            ], 10000);
        }
    }
    watchRewarm() {
        this.onVisibleAgain = () => { if (!document.hidden) this.rewarm(); };
        document.addEventListener("visibilitychange", this.onVisibleAgain);
        let resizeTimer = null;
        this.onResizeRewarm = () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => this.rewarm(), 150);
        };
        window.addEventListener("resize", this.onResizeRewarm);
        document.addEventListener("fullscreenchange", this.onResizeRewarm);
        // Resuming after a pause: the second that spans the pause is not a slow second
        this.ejs.on("play", () => this.rewarm());
        // Loading or quick-saving a state and resetting make a burst of work that is not lag
        const gm = this.ejs.gameManager;
        for (const name of ["loadState", "restart", "quickLoad", "quickSave"]) {
            const original = gm[name];
            if (typeof original !== "function" || original.ejsRewarm) continue;
            const wrapped = (...args) => {
                this.rewarm();
                return original.apply(gm, args);
            };
            wrapped.ejsRewarm = true;
            gm[name] = wrapped;
        }
    }
    /** Round 33: JavaScript memory nearly full (Chromium browsers report it): offer a reload that keeps the place. */
    watchMemory() {
        if (!performance.memory || !performance.memory.jsHeapSizeLimit) return;
        this.memoryTimer = setInterval(() => {
            const m = performance.memory;
            const used = m.usedJSHeapSize / m.jsHeapSizeLimit;
            if (used < 0.85 || this.stopped || (this.memoryWarnedAt && performance.now() - this.memoryWarnedAt < 600000)) return;
            this.memoryWarnedAt = performance.now();
            this.note("problem", `Memory ${Math.round(used * 100)}% full`);
            this.notify(`The browser's memory for this page is ${Math.round(used * 100)}% full, which can make the game stutter or stop.`, [
                ["Reload (keeps your place)", () => this.reloadKeepingPlace()],
                ["Not now", null, true]
            ], 20000);
        }, 30000);
    }
    /**
     * Round 33: a screen whose refresh rate is not a whole multiple of the game's (75 Hz for a 60 fps game, 60 Hz for
     * a 50 fps PAL game) shows some frames longer than others, so movement looks uneven. Said once per session.
     */
    checkRefreshMatch() {
        const hz = this.refreshHz;
        const fps = this.expectedFps;
        if (!hz || !fps || this.refreshChecked) return;
        this.refreshChecked = true;
        const ratio = hz / fps;
        if (Math.abs(ratio - Math.round(ratio)) <= 0.06 || ratio > 3.5) return;
        let key = "";
        try { key = "ejs-refresh-note-" + hz + "-" + fps; if (sessionStorage.getItem(key)) return; sessionStorage.setItem(key, "1"); } catch (e) { /* storage blocked */ }
        this.note("problem", `Screen ${hz} Hz, game ${fps} fps`);
        this.notify(`This screen runs at ${hz} Hz and the game at ${fps} frames a second, so movement can look a little uneven. A ${fps === 50 ? "50 or 100" : "60 or 120"} Hz display setting gives the smoothest motion.`, [["OK", null, true]], 12000);
    }
    stop() {
        this.stopped = true;
        cancelAnimationFrame(this.frame);
        clearInterval(this.speedTimer);
        clearInterval(this.memoryTimer);
        if (this.longTaskObserver) this.longTaskObserver.disconnect();
        if (this.onVisibleAgain) document.removeEventListener("visibilitychange", this.onVisibleAgain);
        if (this.onResizeRewarm) {
            window.removeEventListener("resize", this.onResizeRewarm);
            document.removeEventListener("fullscreenchange", this.onResizeRewarm);
        }
        clearInterval(this.layoutTimer);
        clearInterval(this.audioTimer);
        if (this.onAudioVisibility) document.removeEventListener("visibilitychange", this.onAudioVisibility);
        if (this.resizeObserver) this.resizeObserver.disconnect();
        if (this.statsElem) this.statsElem.remove();
    }

    // ---------- Feature 12: software graphics detection ----------
    detectRenderer() {
        const canvas = this.ejs.frontend.canvas;
        let gl = null;
        try { gl = canvas.getContext("webgl2") || canvas.getContext("webgl"); } catch (e) { gl = null; }
        if (!gl) return;
        this.webglVersion = (typeof WebGL2RenderingContext !== "undefined" && gl instanceof WebGL2RenderingContext) ? 2 : 1;
        const info = gl.getExtension("WEBGL_debug_renderer_info");
        this.renderer = String(info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
        this.softwareRendering = SOFTWARE_RENDERER.test(this.renderer);
        if (this.softwareRendering && !sessionStorage.getItem("ejs-sw-warned")) {
            sessionStorage.setItem("ejs-sw-warned", "1");
            this.notify("Graphics are running in software (" + this.renderer.split("(")[0].trim() + "). Turn on hardware acceleration in your browser settings for much better speed.", [
                ["Use Performance mode", () => this.setMode("performance")],
                ["OK", null, true]
            ], 15000);
        }
    }

    // ---------- Feature 5 and round 7: render buffer layout ----------
    applyRenderScale() {
        this.layoutKey = null;
        this.layoutCanvas();
    }
    /** The game's picture: aspect ratio and native line count, with video rotation applied. */
    picture() {
        const gm = this.ejs.gameManager;
        try {
            let aspect = gm.getVideoDimensions("aspect");
            let width = gm.getVideoDimensions("width");
            let height = gm.getVideoDimensions("height");
            const rotation = parseInt(this.ejs.getSettingValue("videoRotation") || this.ejs.videoRotation || 0, 10);
            if (rotation === 1 || rotation === 3) {
                aspect = 1 / aspect;
                [width, height] = [height, width];
            }
            if (aspect > 0.2 && aspect < 5 && height >= 64 && width >= 64) return { aspect, width, height };
        } catch (e) { /* core without video dimensions */ }
        return null;
    }
    /**
     * Picture-sized render buffer. RetroArch sizes its drawing buffer from the canvas box, and EmulatorJS makes that
     * box the whole player (letterbox bars included) at full device-pixel resolution. Here the canvas box becomes the
     * game's picture only, and on high-density screens the buffer is a whole multiple of the game's own lines (x3 or
     * more) that the browser scales the last step: fewer pixels drawn, evenly sized pixels on screen.
     */
    layoutCanvas() {
        const canvas = this.ejs.frontend && this.ejs.frontend.canvas;
        const parent = canvas && canvas.parentElement;
        if (!parent || this.stopped) return;
        const pw = parent.clientWidth;
        const ph = parent.clientHeight;
        if (!pw || !ph) return;
        const dpr = window.devicePixelRatio || 1;
        // Some browsers (seen on phones) give RetroArch a buffer of CSS pixels instead of device pixels; once that
        // has been measured, the box is sized in RetroArch's own unit so the picture stays sharp
        const ratio = this.bufferRatio || dpr;
        const scale = this.effectiveScale();
        const mouse = !!(this.ejs.defaultCoreOpts && this.ejs.defaultCoreOpts.supportsMouse);
        const pic = this.profile.pictureBuffer !== false && !mouse ? this.picture() : null;
        const shader = this.ejs.getSettingValue("shader");
        const shaderOn = !!shader && shader !== "disabled";
        let mode = "full";
        let dw = pw;
        let dh = ph;
        let bw = pw * dpr;
        let bh = ph * dpr;
        let prescale = 0;
        let offsetX = 0;
        let offsetY = 0;
        if (pic) {
            mode = "picture";
            // Round 34: the shape it is shown in (original, 4:3, square pixels, 16:9 or the whole area). The render
            // buffer keeps the game's own shape, so RetroArch draws it without bars; the browser stretches the rest.
            const aspect = this.displayAspect(pic, pw, ph);
            if (pw / ph > aspect) dw = ph * aspect;
            else dh = pw / aspect;
            // Touch gamepad at the sides (landscape): if the picture would run under the d-pad or the buttons, it is
            // made a little smaller so the whole game stays visible between them
            const sides = this.gamepadSides(pw, ph);
            if (sides && (pw - dw) / 2 < Math.max(sides.left, sides.right)) {
                const room = pw - sides.left - sides.right;
                if (room > pw * 0.4) {
                    dw = Math.min(room, ph * aspect);
                    dh = dw / aspect;
                    offsetX = sides.left + (room - dw) / 2 - (pw - dw) / 2;
                    offsetY = (ph - dh) / 2;
                }
            }
            // Round 33, pixel-perfect size: the picture shown at a whole multiple of the game's own lines, so every
            // console pixel is the same size on screen (black borders take up the rest)
            if (this.profile.integerScale) {
                const k = Math.floor(dh * dpr / pic.height + 1e-6);
                if (k >= 1) {
                    const nh = k * pic.height / dpr;
                    const nw = nh * aspect;
                    // Left and right are centred from the new width; a picture centred between the touch controls
                    // stays centred, otherwise it stays at the top like the normal picture
                    if (offsetY) offsetY = (ph - nh) / 2;
                    dw = nw;
                    dh = nh;
                }
            }
            bh = dh * dpr;
            bw = bh * pic.aspect;
            // Shaders (CRT and the like) need every screen pixel, and below x3 the browser's last step would look soft
            const k = Math.floor(bh / pic.height + 1e-6);
            if (!shaderOn && k >= 3 && k * pic.height < bh - 0.5) {
                prescale = k;
                bh = k * pic.height;
                bw = bh * pic.aspect;
            }
        }
        bw *= scale;
        bh *= scale;
        const key = [pw, ph, dpr, Math.round(bw), Math.round(bh), Math.round(dw), Math.round(dh), Math.round(offsetX), Math.round(offsetY)].join(",");
        if (key === this.layoutKey) return;
        this.layoutKey = key;
        this.layout = { mode, prescale, picture: [Math.round(dw * dpr), Math.round(dh * dpr)], full: [Math.round(pw * dpr), Math.round(ph * dpr)] };
        const style = canvas.style;
        if (mode === "full" && scale >= 1 && Math.abs(ratio - dpr) < 0.05) {
            for (const name of ["width", "height", "max-width", "max-height", "transform", "transform-origin", "left", "top"]) style.removeProperty(name);
        } else {
            const cssW = bw / ratio;
            const cssH = bh / ratio;
            // The smaller box sets RetroArch's buffer size; the transform shows it at the picture's size
            // "important" so a page that embeds the player with its own canvas rules (ObsoleteMod) cannot undo
            // the box size while the scale still applies, which would shrink the picture
            const set = (name, value) => style.setProperty(name, value, "important");
            set("max-width", "none");
            set("max-height", "none");
            set("width", cssW + "px");
            set("height", cssH + "px");
            set("transform-origin", "0 0");
            set("transform", "scale(" + (dw / cssW) + "," + (dh / cssH) + ")");
            // Centred across, top-aligned like the original canvas (object-position: top)
            set("left", ((pw - dw) / 2 + offsetX) + "px");
            if (offsetY) set("top", offsetY + "px");
            else style.removeProperty("top");
        }
        window.dispatchEvent(new Event("resize"));
    }
    /** Round 34: the shape the picture is shown in. */
    displayAspect(pic, pw, ph) {
        const choice = this.profile.aspect || "auto";
        const tall = pic.aspect < 1;
        if (choice === "4:3") return tall ? 3 / 4 : 4 / 3;
        if (choice === "16:9") return tall ? 9 / 16 : 16 / 9;
        if (choice === "square") return pic.width / pic.height;
        if (choice === "fill") return pw / ph;
        return pic.aspect;
    }
    /** Buffer pixels per CSS pixel of the canvas box, as RetroArch actually sized it (normally devicePixelRatio). */
    measureBufferRatio() {
        const canvas = this.ejs.frontend.canvas;
        const box = canvas && canvas.clientWidth;
        if (!box || !canvas.width) return;
        const measured = canvas.width / box;
        const expected = this.bufferRatio || window.devicePixelRatio || 1;
        // Only trust a reading seen twice in a row (RetroArch resizes a moment after the box changes)
        if (Math.abs(measured - expected) / expected > 0.05) {
            if (this.pendingRatio && Math.abs(this.pendingRatio - measured) / measured < 0.02) {
                this.bufferRatio = measured;
                this.pendingRatio = null;
                this.layoutKey = null;
            } else {
                this.pendingRatio = measured;
            }
        } else {
            this.pendingRatio = null;
        }
    }
    /** Width taken by the on-screen d-pad and buttons on each side, when the touch gamepad is shown beside the picture. */
    gamepadSides(pw, ph) {
        if (pw <= ph) return null;
        const front = this.ejs.frontend;
        const pad = front && front.virtualGamepad;
        if (!pad || pad.style.display === "none" || !pad.offsetParent) return null;
        const host = this.ejs.frontend.canvas.parentElement.getBoundingClientRect();
        const left = pad.querySelector(".ejs_virtualGamepad_left");
        const right = pad.querySelector(".ejs_virtualGamepad_right");
        if (!left || !right) return null;
        const l = left.getBoundingClientRect();
        const r = right.getBoundingClientRect();
        if (!l.width || !r.width) return null;
        return { left: Math.max(0, l.right - host.left + 6), right: Math.max(0, host.right - r.left + 6) };
    }
    watchLayout() {
        const parent = this.ejs.frontend.canvas && this.ejs.frontend.canvas.parentElement;
        if (parent && typeof ResizeObserver === "function") {
            this.resizeObserver = new ResizeObserver(() => this.layoutCanvas());
            this.resizeObserver.observe(parent);
        }
        // Games change resolution (menus, hi-res modes, PAL/NTSC); shader and rotation settings change too
        this.layoutTimer = setInterval(() => {
            this.measureBufferRatio();
            this.layoutCanvas();
        }, 1000);
    }
    effectiveScale() {
        const chosen = Number(this.profile.renderScale) || 1;
        // Mouse and light-gun cores need the canvas at full size so pointer positions stay exact
        if (this.ejs.defaultCoreOpts && this.ejs.defaultCoreOpts.supportsMouse) return 1;
        // Performance and Maximum modes render at no more than 75 % and 50 % of the display resolution
        return Math.min(chosen, MODES[this.mode()].scale);
    }

    // ---------- Features 4, 6, 7 and round 32: performance modes ----------
    mode() {
        if (MODES[this.profile.mode]) return this.profile.mode;
        return this.profile.performanceMode ? "performance" : "quality";
    }
    setMode(mode) {
        if (!MODES[mode]) return;
        this.profile.mode = mode;
        this.profile.performanceMode = mode !== "quality";
        this.saveProfile();
        this.applyPerformanceMode();
        if (this.panelMode) this.panelMode.value = mode;
    }
    nextMode() {
        const i = MODE_ORDER.indexOf(this.mode());
        return i < MODE_ORDER.length - 1 ? MODE_ORDER[i + 1] : null;
    }
    applyPerformanceMode() {
        const m = MODES[this.mode()];
        this.applyRenderScale();
        this.applyShaderBypass(m.shaderOff);
        this.applyFrameskip(m.frameskip);
    }
    applyShaderBypass(on) {
        const front = this.ejs.frontend;
        if (!front || !front.changeSettingOption) return;
        // NES and SNES keep 2xScaleHQ in every mode
        if (this.ejs.lockedShader && this.ejs.lockedShader()) on = false;
        const current = this.ejs.getSettingValue("shader");
        if (on) {
            if (current && current !== "disabled") {
                this.saved.shader = current;
                front.changeSettingOption("shader", "disabled");
            }
        } else if (this.saved.shader) {
            front.changeSettingOption("shader", this.saved.shader);
            this.saved.shader = null;
        }
    }
    /** Core options whose key ends in "frameskip" (e.g. fceumm/gambatte/mgba/genesis_plus_gx builds that offer one). */
    frameskipOptions() {
        if (this.frameskipList) return this.frameskipList;
        const list = [];
        const gm = this.ejs.gameManager;
        try {
            const json = gm.getCoreOptionsJSON && gm.getCoreOptionsJSON();
            if (json) {
                for (const option of json.options) {
                    if (/frameskip$/i.test(option.key)) list.push({ key: option.key, values: option.values.map((v) => v.value), defaultValue: option.default });
                }
            } else {
                // Older format, one option per line: "key|default; value1|value2|..."
                for (const line of String(gm.getCoreOptions() || "").split("\n")) {
                    const [head, rest] = line.split("; ");
                    if (!head || !rest) continue;
                    const [key, defaultValue] = head.split("|");
                    const values = rest.split("|").map((v) => v.replace("(Default) ", "").trim());
                    if (/frameskip$/i.test(key)) list.push({ key, values, defaultValue: defaultValue || values[0] });
                }
            }
        } catch (e) { /* core options unavailable */ }
        this.frameskipList = list;
        return list;
    }
    applyFrameskip(on) {
        const gm = this.ejs.gameManager;
        if (!gm) return;
        for (const option of this.frameskipOptions()) {
            const target = option.values.find((v) => /^auto$/i.test(v)) || option.values.find((v) => /auto/i.test(v)) || option.values.find((v) => v === "1");
            if (!target) continue;
            if (on) {
                if (!(option.key in this.saved.frameskip)) this.saved.frameskip[option.key] = this.ejs.getSettingValue(option.key) || option.defaultValue;
                gm.setVariable(option.key, target);
            } else if (option.key in this.saved.frameskip) {
                gm.setVariable(option.key, this.saved.frameskip[option.key]);
                delete this.saved.frameskip[option.key];
            }
        }
    }
    /** Shift+F9: the next mode, round to Quality after Maximum. */
    toggleMode() {
        const next = this.nextMode() || "quality";
        this.setMode(next);
        this.message("MODE: " + MODES[next].label.toUpperCase());
    }

    /** Round 35: runs the game flat out for four seconds and reports the speed relative to normal, with advice. */
    async benchmark() {
        const E = this.ejs;
        if (!E.started || E.paused || E.isRecording || E.isNetplay || this.benchmarking) return null;
        const gm = E.gameManager;
        const front = E.frontend;
        const oldRatio = E.getSettingValue("ff-ratio");
        const wasFast = E.isFastForward;
        this.benchmarking = true;
        try {
            front.changeSettingOption("ff-ratio", "unlimited");
            if (!wasFast) front.changeSettingOption("fastForward", "enabled");
            await new Promise((r) => setTimeout(r, 600));
            const f0 = gm.getFrameNum();
            const t0 = performance.now();
            await new Promise((r) => setTimeout(r, 4000));
            const f1 = gm.getFrameNum();
            const seconds = (performance.now() - t0) / 1000;
            const ratio = (f1 - f0) / seconds / this.expectedFps;
            let advice, mode;
            if (ratio >= 4) { advice = "Plenty of room: Quality mode and shaders are fine."; mode = "quality"; }
            else if (ratio >= 2) { advice = "Good: Quality mode works; a heavy shader may be too much."; mode = "quality"; }
            else if (ratio >= 1.3) { advice = "Tight: Balanced mode is safer."; mode = "balanced"; }
            else { advice = "Slow: Performance mode is the better choice."; mode = "performance"; }
            this.restartMeasuring && this.restartMeasuring();
            this.rewarm && this.rewarm();
            return { ratio, advice, mode };
        } finally {
            if (!wasFast) front.changeSettingOption("fastForward", "disabled");
            if (oldRatio) front.changeSettingOption("ff-ratio", oldRatio);
            this.benchmarking = false;
        }
    }

    // ---------- Features 1, 3 and round 32: monitor, stats, lag check ----------
    playing() {
        // Not measured: paused, hidden, fast forward, slow motion, netplay, and screen recording (round 33), which
        // slows any game down while it encodes
        return !!this.ejs.started && !this.ejs.paused && !document.hidden && !this.ejs.isFastForward && !this.ejs.isSlowMotion && !this.ejs.isNetplay && !this.ejs.isRecording;
    }
    startMonitor() {
        const gm = this.ejs.gameManager;
        let lastFrame = gm.getFrameNum();
        let lastTime = performance.now();
        let lastRaf = 0;
        this.lastNewFrameAt = performance.now();
        let rafFrame = lastFrame;
        const loop = (t) => {
            if (this.stopped) return;
            if (lastRaf && this.playing()) {
                const delta = t - lastRaf;
                this.frameTimes.push(delta);
                if (this.frameTimes.length > 120) this.frameTimes.shift();
                // A hitch: the screen went without a new picture for several refreshes
                // Measured against the game's frames as well as the screen's, so 120 and 144 Hz screens are judged fairly
                if (delta > Math.max(CHECK.hitchFrames * (1000 / (this.refreshHz || 60)), 2.5 * (1000 / this.expectedFps))) this.hitches++;
            }
            lastRaf = t;
            let f = rafFrame;
            try { f = gm.getFrameNum(); } catch (e) { /* core gone */ }
            if (f !== rafFrame) {
                rafFrame = f;
                this.lastNewFrameAt = t;
            } else if (!this.playing()) {
                this.lastNewFrameAt = t;
            }
            this.frame = requestAnimationFrame(loop);
        };
        this.frame = requestAnimationFrame(loop);
        // Long tasks: stretches of more than 50 ms when the page could do nothing else (Chromium browsers)
        try {
            this.longTaskObserver = new PerformanceObserver((list) => {
                for (const e of list.getEntries()) this.longTaskMs += e.duration;
            });
            this.longTaskObserver.observe({ type: "longtask" });
        } catch (e) { this.longTaskObserver = null; }
        this.speedTimer = setInterval(() => {
            const now = performance.now();
            let frame = lastFrame;
            try { frame = gm.getFrameNum(); } catch (e) { /* core gone */ }
            const fps = (frame - lastFrame) * 1000 / (now - lastTime);
            lastFrame = frame;
            lastTime = now;
            const playing = this.playing();
            const sample = { at: now, playing, speed: null, hitches: this.hitches, longTask: Math.round(this.longTaskMs) };
            this.hitches = 0;
            this.longTaskMs = 0;
            if (playing) {
                this.learnRate(fps);
                sample.speed = fps / this.expectedFps;
                this.lastFps = fps;
                this.speedHistory.push(sample.speed);
                if (this.speedHistory.length > 30) this.speedHistory.shift();
            }
            this.samples.push(sample);
            if (this.samples.length > 90) this.samples.shift();
            this.updateStats(playing ? sample.speed : null);
            this.evaluate(now);
        }, 1000);
    }

    /**
     * The game's own frame rate. Cores don't report it, so it is learned from five steady seconds of play and snapped
     * to a standard rate: 50 (PAL), 60 (NTSC, Game Boy and most systems) or 75 (Lynx, WonderSwan). 50 needs a very
     * steady reading, or a European/PAL name, so a device that struggles at about 50 fps is not taken for PAL.
     */
    learnRate(fps) {
        if (this.rateLearned) return;
        const seen = this.rateSeen || (this.rateSeen = []);
        seen.push(fps);
        if (seen.length > 5) seen.shift();
        if (seen.length < 5) return;
        const sorted = seen.slice().sort((a, b) => a - b);
        const median = sorted[2];
        const spread = sorted[4] - sorted[0];
        if (spread > 2.5) return;               // not steady yet (loading, or the device is struggling)
        const name = String(this.ejs.config.gameName || this.ejs.config.gameUrl || "");
        const palName = /\((E|Europe|EU|PAL|Germany|France|Spain|Italy|UK|Australia)[),]|\bPAL\b/i.test(name);
        if (Math.abs(median - 50) <= (palName ? 3 : 1.5) && spread <= (palName ? 2.5 : 1)) this.expectedFps = 50;
        else if (Math.abs(median - 75) <= 2) this.expectedFps = 75;
        else this.expectedFps = 60;
        this.rateLearned = true;
        this.checkRefreshMatch();
        // Speeds measured before the rate was known are measured again against it
        this.samples = this.samples.filter((x) => !x.playing);
    }
    /** What the last seconds say about the game, as { state, text, issue, speed, hitches, spread, longTask }. */
    diagnose(now) {
        const recent = (n) => this.samples.slice(-n).filter((x) => x.playing && x.speed !== null && x.at >= (this.measureFrom || 0));
        const last6 = recent(6);
        const last10 = recent(10);
        const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
        const speeds10 = last10.map((x) => x.speed);
        const avg = mean(speeds10);
        const spread = speeds10.length > 3 ? Math.sqrt(mean(speeds10.map((v) => (v - avg) * (v - avg)))) : 0;
        const hitches = last10.reduce((n, x) => n + x.hitches, 0);
        const longTask = last10.reduce((n, x) => n + x.longTask, 0);
        const out = { speed: avg, hitches, spread, longTask, issue: null };
        if (!this.ejs.started) return Object.assign(out, { state: "starting", text: "Starting" });
        if (!this.playing()) return Object.assign(out, { state: "idle", text: this.ejs.paused ? "Paused" : document.hidden ? "Tab hidden" : "Not measured (fast forward, slow motion or netplay)" });
        const stalled = (now - this.lastNewFrameAt) / 1000;
        if (stalled >= CHECK.frozenSeconds) {
            return Object.assign(out, { state: "frozen", text: `Frozen: no new picture for ${Math.round(stalled)} seconds`, issue: "frozen" });
        }
        // "Check now" measures only its own seconds, with no warm-up wait
        if ((!this.checkRun && now - (this.measureFrom || this.marks.started) < WARMUP_MS) || last6.length < 4) return Object.assign(out, { state: "warming", text: "Measuring…" });
        const slowCount = last6.filter((x) => x.speed < CHECK.slowSpeed).length;
        if (slowCount >= CHECK.slowOf[0] && last6.length >= CHECK.slowOf[1]) {
            const s6 = mean(last6.map((x) => x.speed));
            // Running well earlier and slow now: often a phone or laptop slowing down as it warms up
            const before = this.samples.slice(0, -30).filter((x) => x.playing && x.speed !== null);
            const warm = before.length >= 20 && mean(before.map((x) => x.speed)) > 0.97;
            return Object.assign(out, { speed: s6, state: "slow", text: `Too slow: ${Math.round(s6 * 100)}% speed`, issue: "slow", warm });
        }
        if (hitches >= CHECK.stutterHitches) {
            return Object.assign(out, { state: "stutter", text: `Stuttering: ${hitches} hitches in 10 seconds`, issue: "stutter" });
        }
        if (spread > CHECK.unevenSpread && last10.length >= 8) {
            return Object.assign(out, { state: "uneven", text: `Uneven speed (varies by ±${Math.round(spread * 100)}%)`, issue: "uneven" });
        }
        return Object.assign(out, { state: "good", text: `Good: ${Math.round(avg * 100)}% speed, ${hitches} hitch${hitches === 1 ? "" : "es"} in 10 s` });
    }
    evaluate(now) {
        const h = this.diagnose(now);
        this.health = h;
        this.renderHealth();
        this.offerQualityAgain(h, now);
        if (this.checkRun) this.checkRun.samples.push(h);
        // A fix waiting to be judged
        const pending = this.fixLog.find((f) => !f.judged && now - f.at >= CHECK.afterFix);
        if (pending && h.state !== "warming" && h.state !== "idle") {
            pending.judged = true;
            pending.after = h.speed;
            if (!h.issue) {
                const better = pending.before && h.speed ? ` (${Math.round(pending.before * 100)}% → ${Math.round(h.speed * 100)}%)` : "";
                this.note("result", "Fixed" + better);
                // A lighter mode that fixed this game teaches the device-wide default
                if (MODES[this.mode()].rank >= 1) this.learnFix(this.mode());
                this.notify(`Fixed: the game is running smoothly now${better}.`, [["OK", null, true]], 6000);
            } else if (h.issue === pending.issue) {
                this.lastOffer[h.issue] = 0;   // offer the next fix straight away
            }
        }
        if (!h.issue || this.profile.lagChecks === false || this.checkRun) return;
        if (now - (this.lastOffer[h.issue] || -Infinity) < (this.lastOffer[h.issue + ":wait"] || CHECK.again)) return;
        if (this.fixLog.some((f) => !f.judged)) return;     // let the last fix settle first
        // One notice at a time: a worse problem replaces the open one, a lesser one waits
        const open = this.openOffer && now - this.openOffer.at < 20000 && this.openOffer.box && this.openOffer.box.isConnected ? this.openOffer : null;
        if (open) {
            if ((SEVERITY[h.issue] || 0) <= (SEVERITY[open.issue] || 0)) return;
            open.close();
        }
        this.offerFixes(h, now);
    }

    /**
     * Round 34: a game kept in a lighter mode that has now run smoothly for 10 minutes is offered Quality again,
     * at most once a week per game (devices get faster, browsers improve, the cause may have been elsewhere).
     */
    offerQualityAgain(h, now) {
        if (MODES[this.mode()].rank < 1 || window.EJS_kiosk || window.EJS_perfOverride) { this.smoothSince = null; return; }
        if (h.state === "idle" || h.state === "warming") return;
        if (h.state !== "good") { this.smoothSince = null; return; }
        if (!this.smoothSince) this.smoothSince = now;
        if (now - this.smoothSince < 600000) return;
        const last = Number(this.profile.qualityOfferedAt) || 0;
        if (Date.now() - last < 7 * 86400000) return;
        this.profile.qualityOfferedAt = Date.now();
        this.saveProfile();
        this.smoothSince = null;
        const from = this.mode();
        this.notify(`This game has run smoothly in ${MODES[from].label} mode for 10 minutes. Try Quality again? The lag check will step back if it struggles.`, [
            ["Try Quality", () => { this.setMode("quality"); this.note("fix", "Back to Quality mode"); }],
            ["Stay", null, true]
        ], 20000);
    }
    /** Fixes for a problem, the ones that work at once first. Each: { label, run, reload, immediate }. */
    fixesFor(h) {
        const fixes = [];
        const mode = this.mode();
        const next = this.nextMode();
        const forcedRewind = window.EJS_forceSettings && window.EJS_forceSettings.rewindEnabled;
        const nextFix = (why) => next && fixes.push({ label: `Switch to ${MODES[next].label} mode`, immediate: true, why: why || MODES[next].note, run: () => this.setMode(next) });
        if (h.issue === "frozen") {
            fixes.push({ label: "Restart the game", immediate: true, run: () => { this.lastNewFrameAt = performance.now(); this.ejs.gameManager.restart(); } });
            fixes.push({ label: "Reload the player", reload: true, run: () => {} });
            return fixes;
        }
        if (h.issue === "slow") {
            nextFix();
            if (this.profile.runAhead && MODES[mode].rank < 2) fixes.push({ label: "Turn off run-ahead", reload: true, why: "run-ahead runs every frame twice", run: () => { this.profile.runAhead = false; this.saveProfile(); } });
            if (this.ejs.rewindEnabled && !forcedRewind) fixes.push({ label: "Turn off rewind", reload: true, why: "rewind keeps a copy of the game every frame", run: () => this.ejs.frontend.changeSettingOption("rewindEnabled", "disabled") });
        } else if (h.issue === "stutter") {
            if (MODES[mode].rank < 1) nextFix("auto frameskip evens out short slow patches");
            if (this.audioLatency() < 96) fixes.push({ label: "Use safe audio latency (96 ms)", reload: true, why: "a bigger sound buffer rides over short pauses", run: () => { this.profile.audioLatency = 96; this.saveProfile(); } });
            if (this.profile.lowLatency) fixes.push({ label: "Turn off low-latency canvas", reload: true, why: "some graphics drivers pace frames badly with it", run: () => { this.profile.lowLatency = false; this.saveProfile(); } });
            if (this.ejs.rewindEnabled && !forcedRewind) fixes.push({ label: "Turn off rewind", reload: true, why: "rewind keeps a copy of the game every frame", run: () => this.ejs.frontend.changeSettingOption("rewindEnabled", "disabled") });
            if (MODES[mode].rank >= 1) nextFix();
        } else if (h.issue === "uneven") {
            if (this.audioLatency() < 128) fixes.push({ label: `Use ${this.audioLatency() < 96 ? "safe (96 ms)" : "stable (128 ms)"} audio latency`, reload: true, why: "steadier sound and speed", run: () => { this.profile.audioLatency = this.audioLatency() < 96 ? 96 : 128; this.saveProfile(); } });
            if (MODES[mode].rank < 1) nextFix();
        }
        return fixes;
    }
    describeIssue(h) {
        if (h.issue === "frozen") return "The game has stopped responding.";
        if (h.issue === "slow") return `This game is running at ${Math.round(h.speed * 100)}% speed on this device${h.warm ? " (it was fine earlier: the device may be warm)" : ""}${this.softwareRendering ? "; graphics are in software, so hardware acceleration in the browser would help most" : ""}.`;
        if (h.issue === "stutter") return `The picture is stuttering (${h.hitches} hitches in 10 seconds).`;
        if (h.issue === "uneven") return "The game's speed is uneven, which can make the sound crackle.";
        return h.text;
    }
    offerFixes(h, now) {
        const fixes = this.fixesFor(h);
        this.note("problem", h.text);
        this.lastOffer[h.issue] = now;
        this.lastOffer[h.issue + ":wait"] = CHECK.again;
        // Automatic: the first fix that works at once, without asking (kiosk screens always; their notices are silent)
        if ((this.profile.autoFix || window.EJS_kiosk) && h.issue !== "frozen") {
            const auto = fixes.find((f) => f.immediate);
            if (auto) {
                const before = this.mode();
                this.applyFix(h, auto);
                this.notify(`${this.describeIssue(h)} Fixed automatically: now in ${MODES[this.mode()].label} mode.`, [
                    ["Undo", () => this.setMode(before)],
                    ["OK", null, true]
                ], 10000);
                return;
            }
        }
        if (!fixes.length) {
            if (h.issue === "slow" && this.mode() === "max") this.notify(this.describeIssue(h) + " Everything that can be turned down is down already; a faster device or the other engine may help.", [["OK", null, true]], 12000);
            return;
        }
        const buttons = fixes.slice(0, 2).map((f) => [f.label + (f.reload ? " (reloads, keeps your place)" : ""), () => this.applyFix(h, f)]);
        buttons.push(["Not now", () => { this.lastOffer[h.issue + ":wait"] = CHECK.notNow; }, true]);
        const close = this.notify(this.describeIssue(h), buttons, 20000);
        const boxes = this.ejs.frontend.elements.parent.querySelectorAll(".ejs-enh-toasts > .ejs-enh-toast");
        this.openOffer = { issue: h.issue, at: now, close: typeof close === "function" ? close : () => {}, box: boxes[boxes.length - 1] || null };
    }
    applyFix(h, fix) {
        this.fixLog.push({ issue: h.issue, label: fix.label, at: performance.now(), before: h.speed, judged: false });
        this.note("fix", fix.label);
        if (this.fixLog.length > 20) this.fixLog.shift();
        fix.run();
        // Readings from before the fix no longer count; measuring starts again after the warm-up
        this.samples = [];
        this.measureFrom = performance.now();
        this.lastNewFrameAt = performance.now();
        if (fix.reload) this.reloadKeepingPlace();
        this.renderHealth();
    }
    /** Settings RetroArch reads at boot need a reload; the resume point brings the player back to the same moment. */
    reloadKeepingPlace() {
        this.saveProfile();
        try { this.ejs.saveSettings(); } catch (e) { /* settings unsaved */ }
        const go = () => location.reload();
        try {
            const enh = this.ejs.enhancements;
            const saving = enh && enh.autoSave ? enh.autoSave(true) : null;
            if (saving && saving.then) saving.then(go, go);
            else setTimeout(go, 300);
        } catch (e) {
            go();
        }
    }
    /** "Check now": measure for 10 seconds, then report with the fixes. */
    runCheck(done) {
        if (this.checkRun) return;
        this.checkRun = { samples: [], done };
        this.samples = [];
        setTimeout(() => {
            const run = this.checkRun;
            this.checkRun = null;
            const last = run.samples.filter((x) => x.state !== "idle" && x.state !== "warming");
            const worst = last.find((x) => x.issue === "frozen") || last.find((x) => x.issue === "slow") || last.find((x) => x.issue) || last[last.length - 1] || this.health;
            run.done(worst, worst && worst.issue ? this.fixesFor(worst) : []);
        }, 10500);
    }
    toggleStats() {
        if (this.statsElem) {
            this.statsElem.remove();
            this.statsElem = null;
            return;
        }
        this.statsElem = document.createElement("div");
        this.statsElem.className = "ejs-perf-stats";
        this.statsText = document.createElement("div");
        // Round 33: the last 30 seconds of speed as a small graph (green at full speed, amber and red below)
        this.statsGraph = document.createElement("canvas");
        this.statsGraph.className = "ejs-perf-graph";
        this.statsGraph.width = 240;
        this.statsGraph.height = 40;
        this.statsElem.append(this.statsText, this.statsGraph);
        // Round 34: a click moves the stats to the next corner, out of the way of the game's own score or map
        const corners = ["tr", "br", "bl", "tl"];
        this.statsElem.dataset.corner = corners.includes(this.profile.statsCorner) ? this.profile.statsCorner : "tr";
        this.statsElem.title = "Click to move to another corner";
        this.statsElem.addEventListener("click", (e) => {
            e.stopPropagation();
            const next = corners[(corners.indexOf(this.statsElem.dataset.corner) + 1) % corners.length];
            this.statsElem.dataset.corner = next;
            this.set("statsCorner", next);
        });
        this.ejs.frontend.elements.parent.appendChild(this.statsElem);
        this.updateStats(this.speedHistory[this.speedHistory.length - 1] || null);
    }
    stats() {
        const times = this.frameTimes.slice();
        const avg = times.length ? times.reduce((a, b) => a + b, 0) / times.length : 0;
        const worst = times.length ? Math.max(...times) : 0;
        const budget = 1000 / (this.refreshHz || 60);
        const dropped = times.filter((t) => t > budget * 1.5).length;
        const canvas = this.ejs.frontend.canvas;
        const memory = performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) + " MB" : "n/a";
        const variant = (this.ejs.usingThreads ? "threaded" : "single-thread") + ", " + (this.ejs.webgl2Enabled && this.ejs.supportsWebgl2 ? "WebGL2 build" : "legacy WebGL build");
        return { avg, worst, dropped, memory, variant, size: canvas ? canvas.width + "×" + canvas.height : "?", scale: this.effectiveScale() };
    }
    updateStats(speed) {
        if (!this.statsElem) return;
        const s = this.stats();
        const lines = [
            "Health     " + (this.health ? this.health.text : "—") + " · " + MODES[this.mode()].label + " mode",
            "Speed      " + (speed === null ? (this.ejs.paused ? "paused" : "—") : Math.round(speed * 100) + "% (" + (this.lastFps || 0).toFixed(1) + "/" + this.expectedFps + " fps)"),
            "Frame time " + s.avg.toFixed(1) + " ms avg, " + s.worst.toFixed(1) + " ms worst, " + s.dropped + " late of last 120",
            "Display    " + (this.refreshHz || "?") + " Hz, swap interval " + this.swapInterval(),
            "Render     " + s.size + " (" + Math.round(s.scale * 100) + "%)",
            "Buffer     " + this.describeLayout(),
            "Surface    " + this.describeSurface(),
            "Audio      " + this.describeAudio(),
            "GPU        " + (this.renderer ? this.renderer.replace(/^ANGLE \((.*)\)$/, "$1").slice(0, 44) : "?") + (this.softwareRendering ? " [software]" : "") + (this.webglVersion ? ", WebGL " + this.webglVersion : ""),
            "Core       " + this.ejs.getCore() + ", " + s.variant,
            "Memory     " + s.memory + " JS heap",
            "Startup    " + (this.timing ? this.formatTiming() : "—"),
            "Lag check  " + (() => {
                const c = this.sessionCounts || { problems: 0, fixes: 0 };
                return c.problems + (c.problems === 1 ? " problem, " : " problems, ") + c.fixes + (c.fixes === 1 ? " fix" : " fixes") + " this session";
            })()
        ];
        (this.statsText || this.statsElem).textContent = lines.join("\n");
        this.drawGraph();
    }
    drawGraph() {
        const c = this.statsGraph;
        if (!c) return;
        const ctx = c.getContext("2d");
        const w = c.width, h = c.height;
        ctx.clearRect(0, 0, w, h);
        ctx.strokeStyle = "rgba(255,255,255,.25)";
        ctx.beginPath();
        ctx.moveTo(0, h - (h - 4) * 0.9 / 1.2 - 2);
        ctx.lineTo(w, h - (h - 4) * 0.9 / 1.2 - 2);
        ctx.stroke();
        const list = this.speedHistory.slice(-30);
        const bar = w / 30;
        list.forEach((v, i) => {
            const value = Math.max(0, Math.min(1.2, v));
            const height = Math.max(1, (h - 4) * value / 1.2);
            ctx.fillStyle = v >= 0.95 ? "#5fd38d" : v >= 0.8 ? "#f0c36b" : "#ff7a6a";
            ctx.fillRect((30 - list.length + i) * bar + 1, h - 2 - height, bar - 2, height);
        });
    }
    describeLayout() {
        const l = this.layout;
        if (!l || l.mode === "full") return "whole player area" + (this.profile.pictureBuffer === false ? " (picture-sized buffer off)" : "");
        const canvas = this.ejs.frontend.canvas;
        const drawn = canvas.width * canvas.height;
        const saved = Math.max(0, Math.round(100 - drawn * 100 / (l.full[0] * l.full[1])));
        return "picture only" + (l.prescale ? ", x" + l.prescale + " lines" : "") + ", " + saved + "% fewer pixels than " + l.full[0] + "×" + l.full[1];
    }
    formatTiming() {
        const t = this.timing;
        const sec = (ms) => (ms === null ? "?" : (ms / 1000).toFixed(1) + "s");
        return "core " + sec(t.core) + ", game " + sec(t.game) + ", boot " + sec(t.boot) + " (total " + sec(t.total) + ")";
    }

    // ---------- Round 12: idle audio suspension ----------
    /** The WebAudio context RetroArch's OpenAL output plays through. */
    audioContext() {
        const al = this.ejs.Module && this.ejs.Module.AL && this.ejs.Module.AL.currentCtx;
        return (al && al.audioCtx) || null;
    }
    /** Why no sound can be produced right now, or null while the game runs and can be heard. */
    audioIdleReason() {
        if (this.ejs.paused) return "paused";
        if (document.hidden) return "tab hidden";
        return null;
    }
    /**
     * A running AudioContext keeps the browser's audio thread and the device's audio output working at full rate
     * even when the emulator has stopped producing sound. While the game is paused (F5, the F1 panel, the phone
     * menu, auto-pause) or the tab is hidden, the context is suspended; it resumes when play continues. Buffers
     * already queued are kept, so sound picks up where it stopped instead of skipping or bursting.
     */
    updateAudioPower() {
        const ctx = this.audioContext();
        if (!ctx || this.stopped) return;
        const now = performance.now();
        const reason = this.profile.audioSuspend !== false ? this.audioIdleReason() : null;
        if (reason) {
            this.audioReason = reason;
            if (!this.audioSuspended && ctx.state === "running") {
                this.audioSuspended = true;
                this.audioIdleSince = now;
                ctx.suspend().catch(() => { this.audioSuspended = false; });
            }
            return;
        }
        this.audioReason = null;
        if (this.audioSuspended) {
            this.audioSuspended = false;
            this.audioIdleMs = (this.audioIdleMs || 0) + (now - this.audioIdleSince);
            this.resumeAudio(ctx);
        } else if (ctx.state === "interrupted") {
            // iOS stops audio for calls, Siri or another app; bring it back when the game is visible again
            this.resumeAudio(ctx);
        }
    }
    resumeAudio(ctx) {
        ctx.resume().catch(() => {}).then(() => {
            if (ctx.state === "running" || this.audioGestureWait) return;
            // Some browsers only allow it from a tap or key press after an interruption
            this.audioGestureWait = true;
            const events = ["pointerdown", "keydown", "touchend"];
            const retry = () => {
                ctx.resume().catch(() => {});
                if (ctx.state === "running" || this.stopped) {
                    for (const type of events) window.removeEventListener(type, retry, true);
                    this.audioGestureWait = false;
                }
            };
            for (const type of events) window.addEventListener(type, retry, true);
        });
    }
    watchAudioPower() {
        this.onAudioVisibility = () => this.updateAudioPower();
        document.addEventListener("visibilitychange", this.onAudioVisibility);
        // Safety net for pauses that do not go through togglePlaying (netplay, menus of other code)
        this.audioTimer = setInterval(() => this.updateAudioPower(), 1000);
        this.updateAudioPower();
    }
    describeAudio() {
        const ctx = this.audioContext();
        if (!ctx) return "?";
        const idle = (this.audioIdleMs || 0) + (this.audioSuspended ? performance.now() - this.audioIdleSince : 0);
        const saved = idle >= 1000 ? ", idle audio stopped for " + (idle >= 60000 ? (idle / 60000).toFixed(1) + " min" : Math.round(idle / 1000) + " s") : "";
        const state = this.audioSuspended ? "suspended (" + (this.audioReason || "idle") + ")" : ctx.state;
        return Math.round(ctx.sampleRate) + " Hz, " + state + (this.profile.audioSuspend === false ? " (idle suspension off)" : "") + saved;
    }

    // ---------- Feature 15: power saver ----------
    watchBattery() {
        if (!this.profile.powerSaver || !navigator.getBattery) return;
        navigator.getBattery().then((battery) => {
            const check = () => {
                if (this.powerSaved || MODES[this.mode()].rank >= 2) return;
                if (!battery.charging && battery.level <= 0.2) {
                    this.powerSaved = true;
                    const before = this.mode();
                    this.profile.mode = "performance";
                    this.applyPerformanceMode();
                    this.notify("Battery at " + Math.round(battery.level * 100) + "%: Performance mode turned on to save power.", [
                        ["Turn off", () => this.setMode(before)],
                        ["OK", null, true]
                    ], 10000);
                }
            };
            battery.addEventListener("levelchange", check);
            battery.addEventListener("chargingchange", check);
            check();
        }).catch(() => {});
    }

    // ---------- F1 panel section ----------
    renderPanel(box) {
        const section = document.createElement("div");
        section.className = "ejs-perf-panel";
        const title = document.createElement("h3");
        title.textContent = "Performance";
        section.appendChild(title);
        const row = (labelText, control, note) => {
            const label = document.createElement("label");
            label.append(control, " " + labelText);
            if (note) {
                const small = document.createElement("span");
                small.className = "ejs-perf-note";
                small.textContent = " " + note;
                label.appendChild(small);
            }
            section.appendChild(label);
        };
        const check = (name, labelText, note) => {
            const input = document.createElement("input");
            input.type = "checkbox";
            input.checked = !!this.profile[name];
            input.addEventListener("change", () => this.set(name, input.checked));
            row(labelText, input, note);
        };
        const select = (name, labelText, choices, note) => {
            const input = document.createElement("select");
            for (const [value, text] of choices) {
                const option = document.createElement("option");
                option.value = value;
                option.textContent = text;
                input.appendChild(option);
            }
            input.value = String(this.profile[name]);
            input.addEventListener("change", () => this.set(name, isNaN(input.value) ? input.value : Number(input.value)));
            row(labelText, input, note);
        };
        // Mode
        const modeSel = document.createElement("select");
        for (const id of MODE_ORDER) {
            const o = document.createElement("option");
            o.value = id;
            o.textContent = MODES[id].label;
            modeSel.appendChild(o);
        }
        modeSel.value = this.mode();
        const modeNote = document.createElement("span");
        modeNote.className = "ejs-perf-note";
        const showNote = () => { modeNote.textContent = " " + MODES[modeSel.value].note + (this.ejs.lockedShader && this.ejs.lockedShader() && MODES[modeSel.value].shaderOff ? " (this game keeps its 2xScaleHQ shader)" : ""); };
        modeSel.addEventListener("change", () => { this.setMode(modeSel.value); showNote(); });
        showNote();
        this.panelMode = modeSel;
        const modeLabel = document.createElement("label");
        modeLabel.append(modeSel, " Mode (Shift+F9 cycles)", modeNote);
        section.appendChild(modeLabel);
        // Lag check
        const lag = document.createElement("div");
        lag.className = "ejs-perf-health";
        this.healthElem = document.createElement("div");
        this.healthElem.className = "ejs-perf-health-line";
        const checkBtn = document.createElement("button");
        checkBtn.type = "button";
        checkBtn.textContent = "Check now (10 s)";
        const report = document.createElement("div");
        report.className = "ejs-perf-report";
        checkBtn.addEventListener("click", () => {
            checkBtn.disabled = true;
            report.textContent = "Measuring for 10 seconds: keep the game running…";
            const wasPaused = this.ejs.paused;
            if (wasPaused && this.ejs.play) this.ejs.play();
            this.runCheck((h, fixes) => {
                checkBtn.disabled = false;
                report.textContent = "";
                const p = document.createElement("p");
                p.textContent = h && h.issue ? this.describeIssue(h) : "No problem found: " + (h ? h.text : "the game runs well") + ".";
                report.appendChild(p);
                for (const f of fixes) {
                    const b = document.createElement("button");
                    b.type = "button";
                    b.textContent = f.label + (f.reload ? " (reloads, keeps your place)" : "");
                    if (f.why) b.title = f.why;
                    b.addEventListener("click", () => { this.applyFix(h, f); report.textContent = "Applied: " + f.label + ". Checking again in 10 seconds…"; modeSel.value = this.mode(); showNote(); });
                    report.appendChild(b);
                }
            });
        });
        // Round 35: how much faster than needed this device runs the game
        const speedBtn = document.createElement("button");
        speedBtn.type = "button";
        speedBtn.className = "secondary";
        speedBtn.textContent = "Test this device's speed (4 s)";
        speedBtn.title = "Runs the game flat out for four seconds and measures how many times faster than normal it goes";
        speedBtn.addEventListener("click", async () => {
            speedBtn.disabled = true;
            report.textContent = "Testing: the game runs fast for four seconds…";
            const result = await this.benchmark();
            speedBtn.disabled = false;
            report.textContent = "";
            const p = document.createElement("p");
            if (!result) { p.textContent = "The test needs a running game (not paused, not recording)."; report.appendChild(p); return; }
            p.textContent = `This device runs the game at about ×${result.ratio.toFixed(1)} normal speed. ${result.advice}`;
            report.appendChild(p);
            if (result.mode && result.mode !== this.mode()) {
                const b = document.createElement("button");
                b.type = "button";
                b.textContent = "Use " + MODES[result.mode].label;
                b.addEventListener("click", () => { this.setMode(result.mode); report.textContent = "Mode: " + MODES[result.mode].label; modeSel.value = this.mode(); showNote(); });
                report.appendChild(b);
            }
        });
        lag.append(this.healthElem, checkBtn, speedBtn, report);
        section.appendChild(lag);
        this.renderHealth();
        check("autoFix", "Fix lag automatically", "switches to a lighter mode by itself, with Undo");
        check("lagChecks", "Watch for lag and offer fixes");
        select("renderScale", "Render resolution", [["1", "100%"], ["0.75", "75%"], ["0.5", "50%"]]);
        select("audioLatency", "Audio latency", [["32", "Low (32 ms)"], ["64", "Normal (64 ms)"], ["96", "Safe (96 ms)"], ["128", "Stable (128 ms)"]], "next start");
        check("runAhead", "Run-ahead (less input lag, more CPU)", "next start");
        check("lowLatency", "Low-latency canvas", "next start");
        check("leanSurface", "Lean opaque game surface", "next start");
        check("pictureBuffer", "Picture-sized render buffer", "draws only the game picture, whole-number scaled");
        check("integerScale", "Pixel-perfect size", "whole-number scaling on screen: every pixel the same size, with borders");
        check("powerSaver", "Power saver on low battery");
        check("audioSuspend", "Stop audio processing while paused or hidden");
        // Round 33: lag diary and diagnostics
        const diary = this.diary();
        if (diary.length) {
            const details = document.createElement("details");
            details.className = "ejs-perf-diary";
            const summary = document.createElement("summary");
            summary.textContent = `Lag diary for this game (${diary.length})`;
            const ol = document.createElement("ol");
            for (const e of diary.slice().reverse()) {
                const li = document.createElement("li");
                li.textContent = new Date(e.at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) + " · " + (e.kind === "fix" ? "Fix: " : e.kind === "result" ? "" : "") + e.text;
                ol.appendChild(li);
            }
            details.append(summary, ol);
            section.appendChild(details);
        }
        const diag = document.createElement("button");
        diag.type = "button";
        diag.className = "ejs-perf-diag";
        diag.textContent = "Copy diagnostics";
        diag.title = "A text report of this device, the game and its speed, for a bug report";
        diag.addEventListener("click", async () => {
            const text = this.diagnostics();
            try {
                await navigator.clipboard.writeText(text);
                diag.textContent = "Copied";
            } catch (e) {
                const area = document.createElement("textarea");
                area.value = text;
                area.rows = 8;
                area.style.width = "100%";
                diag.replaceWith(area);
                area.select();
            }
            setTimeout(() => { diag.textContent = "Copy diagnostics"; }, 2500);
        });
        section.appendChild(diag);
        const info = document.createElement("div");
        info.className = "meta";
        const s = this.stats();
        info.textContent = "Startup: " + (this.timing ? this.formatTiming() : "—") + ". Display " + (this.refreshHz || "?") + " Hz. Render " + s.size + " (" + this.describeLayout() + "), surface " + this.describeSurface() + ". Shift+F10 shows live stats. Saved for this game.";
        section.appendChild(info);
        box.appendChild(section);
    }

    /** Round 33: everything someone fixing a problem would ask for, as plain text. */
    diagnostics() {
        const s = this.stats();
        const h = this.health || {};
        const E = this.ejs;
        const lines = [
            "EmulatorJSMod diagnostics, " + new Date().toISOString(),
            "Page: " + location.href,
            "Browser: " + navigator.userAgent,
            "Screen: " + screen.width + "x" + screen.height + " @" + (window.devicePixelRatio || 1) + "x, " + (this.refreshHz || "?") + " Hz",
            "GPU: " + (this.renderer || "?") + (this.softwareRendering ? " [software]" : "") + ", WebGL " + (this.webglVersion || "?"),
            "Cross-origin isolated: " + !!window.crossOriginIsolated + ", threads: " + !!E.usingThreads,
            "Game: " + (E.config.gameName || E.getBaseFileName && E.getBaseFileName()) + ", system " + E.getCore(true) + ", core " + E.getCore() + " (" + s.variant + ")",
            "Shader: " + (E.getSettingValue("shader") || "disabled"),
            "Mode: " + MODES[this.mode()].label + ", render " + s.size + " (" + Math.round(s.scale * 100) + "%), " + this.describeLayout(),
            "Health: " + (h.text || "?") + "; speed " + Math.round((h.speed || 0) * 100) + "%, hitches " + (h.hitches || 0) + "/10 s, long tasks " + (h.longTask || 0) + " ms/10 s",
            "Frame rate: game " + this.expectedFps + " fps, last " + (this.lastFps || 0).toFixed(1) + " fps; frame time " + s.avg.toFixed(1) + " ms avg, " + s.worst.toFixed(1) + " ms worst",
            "Audio: " + this.describeAudio() + ", latency " + this.audioLatency() + " ms",
            "Memory: " + s.memory,
            "Startup: " + (this.timing ? this.formatTiming() : "?"),
            "Settings: " + JSON.stringify(this.profile),
            "Lag diary: " + (this.diary().map((e) => new Date(e.at).toISOString() + " " + e.kind + " " + e.text).join(" | ") || "empty")
        ];
        return lines.join("\n");
    }
    renderHealth() {
        const el = this.healthElem;
        if (!el) return;
        const h = this.health || {};
        el.textContent = "Lag check: " + (h.text || "—");
        el.dataset.state = h.state || "";
        const fixed = this.fixLog.filter((f) => f.judged);
        if (fixed.length) {
            const f = fixed[fixed.length - 1];
            el.textContent += ` · last fix: ${f.label}` + (f.before && f.after ? ` (${Math.round(f.before * 100)}% → ${Math.round(f.after * 100)}%)` : "");
        }
    }

    // ---------- UI helpers ----------
    message(text) {
        this.ejs.frontend.displayMessage(text);
    }
    notify(text, buttons, timeout) {
        if (this.ejs.enhancements && this.ejs.enhancements.toast) {
            return this.ejs.enhancements.toast(text, buttons, timeout);
        } else {
            this.ejs.frontend.displayMessage(text, timeout);
        }
    }
}

export { EJS_Performance };
