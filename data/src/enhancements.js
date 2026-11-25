/**
 * Play-session enhancements layered on top of the core emulator:
 * hotkeys, gamepad combos, persistent quick-save slots, autosave/resume,
 * auto-pause, wake lock, media session, overlays and recovery helpers.
 * Every feature is optional and degrades silently when an API is missing.
 *
 * Round 33: a resume point every 5 minutes with a picture, Undo for saving over a slot, loading and resetting, slot
 * download and upload, the resume point in the slot picker, a storage-full warning and save protection status;
 * controller connect notices and resuming when it comes back, Select+Down screenshots, fast-forward and slow-motion
 * speed cycling, frame advance, volume keys, a "your keys" card, pausing when the window loses focus, Esc for this
 * panel; touch haptics, opacity and size, landscape lock; screenshot copy, lock-screen artwork, the tab title,
 * scanline strength; break reminders, a sleep timer, session time and resetting the options.
 *
 * Round 34: a pause menu, slot names, a save reminder, a screenshot gallery, dropping a .state file on the game,
 * asking before leaving, failed loads reported; held inputs released when a menu opens, hold Tab to fast-forward,
 * Select+Left/Right slots, an input display, the controller list, Shift+F1 game settings, Ctrl+S; picture
 * brightness, contrast, saturation, night tint, smooth scaling, surround colour and shape; per-game volume, a
 * "sound blocked" notice, messages read out by screen readers; crash and error notices; double-click full screen,
 * "Ready" in the tab title, colour-coded FPS; and a panel in collapsible sections.
 */
const PREFS_KEY = "ejs-enhancements";
const PLAYTIME_KEY = "ejs-playtime";
const DEFAULT_PREFS = {
    autoPause: true,
    autoSave: true,
    resumePrompt: true,
    padCombos: true,
    rumble: true,
    wakeLock: true,
    cursorHide: true,
    scanlines: false,
    fps: false,
    periodicSave: true,
    focusPause: false,
    haptics: true,
    landscapeLock: true,
    padOpacity: "1",
    padSize: "normal",
    breakMinutes: "0",
    scanlineStrength: "normal",
    pauseMenu: true,
    saveReminder: true,
    confirmLeave: false,
    holdTabFast: true,
    inputDisplay: false,
    gameVolume: true,
    smoothScaling: false,
    brightness: "100",
    contrast: "100",
    saturation: "100",
    nightTint: false,
    surround: "black",
    toastTime: "8",
    cursorDelay: "2500",
    uiScale: "1",
    highContrast: false,
    shotFormat: "default",
    shotScale: "default",
    statusBadges: true,
    milestones: true,
    connectionNotices: true,
    panelOpen: { keys: true, hotkeys: false, options: true, picture: false, notices: false, install: false }
};
const PREF_LABELS = {
    autoPause: "Pause when the tab is hidden or a controller disconnects",
    autoSave: "Save a resume point when leaving the game",
    resumePrompt: "Offer to resume where you left off",
    padCombos: "Controller hotkeys (hold Select)",
    rumble: "Controller rumble on save / load",
    wakeLock: "Keep the screen awake while playing",
    cursorHide: "Hide the mouse cursor while idle",
    scanlines: "CRT scanline overlay",
    fps: "Show FPS counter",
    periodicSave: "Also save a resume point every 5 minutes",
    focusPause: "Pause when the window loses focus",
    haptics: "Vibrate on on-screen button presses (phones)",
    landscapeLock: "Turn to landscape in full screen (phones)",
    pauseMenu: "Show a menu when the game is paused (F5, Select+Start)",
    saveReminder: "Remind me to save after 30 minutes without saving",
    holdTabFast: "Hold Tab to fast-forward",
    inputDisplay: "Show the buttons being pressed on screen",
    gameVolume: "Remember the volume for each game",
    confirmLeave: "Ask before leaving the page while playing",
    statusBadges: "Show badges for fast-forward, slow motion, mute and recording",
    milestones: "Tell me when I pass 1, 5, 10 and 25 hours in a game",
    connectionNotices: "Tell me when the connection drops or returns",
    highContrast: "High-contrast panels and notices"
};
// Round 34: picture settings (shown in their own section)
const PICTURE_LABELS = { nightTint: "Night tint (warmer, less blue light)", smoothScaling: "Smooth scaling (softer, no jagged edges)" };
const SHOT_DB = "EJS-screenshots";
// Round 33: settings with a choice of values, shown as menus in the panel
const PREF_CHOICES = {
    scanlineStrength: ["Scanline strength", [["light", "Light"], ["normal", "Normal"], ["strong", "Strong"]]],
    padOpacity: ["On-screen controls", [["1", "Solid"], ["0.7", "See-through"], ["0.45", "Faint"]]],
    padSize: ["On-screen control size", [["small", "Small"], ["normal", "Normal"], ["large", "Large"]]],
    breakMinutes: ["Break reminder", [["0", "Off"], ["30", "Every 30 min"], ["60", "Every hour"], ["90", "Every 90 min"]]],
    toastTime: ["Notices stay", [["5", "Short"], ["8", "Normal"], ["15", "Long"], ["0", "Until closed"]]],
    cursorDelay: ["Hide the cursor after", [["1000", "1 second"], ["2500", "2.5 seconds"], ["5000", "5 seconds"]]],
    uiScale: ["Panel and notice text", [["1", "Normal"], ["1.25", "Large"], ["1.5", "Larger"]]],
    shotFormat: ["Screenshot format", [["default", "Engine default"], ["png", "PNG (sharp)"], ["jpeg", "JPEG (small)"], ["webp", "WebP (small)"]]],
    shotScale: ["Screenshot size", [["default", "Engine default"], ["1", "1×"], ["2", "2×"], ["3", "3×"]]]
};
const PICTURE_KEYS = ["brightness", "contrast", "saturation", "nightTint", "smoothScaling", "surround"];
const PICTURE_GAMES_KEY = "ejs-picture-games";
const PLAYDAYS_KEY = "ejs-playdays";
const MILESTONES = [3600, 18000, 36000, 90000];
const SHAPES = [["auto", "ORIGINAL"], ["4:3", "4:3 TV"], ["square", "SQUARE PIXELS"], ["16:9", "16:9 WIDE"], ["fill", "FILL THE AREA"]];
const FF_SPEEDS = ["1.5", "2.0", "3.0", "4.0", "unlimited"];
const SM_SPEEDS = ["1.5", "2.0", "3.0", "4.0"];
// Button names per control scheme, by RetroPad index, for the "your keys" card
const BUTTON_NAMES = {
    nes: [[8, "A"], [0, "B"], [2, "Select"], [3, "Start"], [4, "Up"], [5, "Down"], [6, "Left"], [7, "Right"]],
    gb: [[8, "A"], [0, "B"], [2, "Select"], [3, "Start"], [4, "Up"], [5, "Down"], [6, "Left"], [7, "Right"]],
    gba: [[8, "A"], [0, "B"], [10, "L"], [11, "R"], [2, "Select"], [3, "Start"], [4, "Up"], [5, "Down"], [6, "Left"], [7, "Right"]],
    snes: [[8, "A"], [0, "B"], [9, "X"], [1, "Y"], [10, "L"], [11, "R"], [2, "Select"], [3, "Start"], [4, "Up"], [5, "Down"], [6, "Left"], [7, "Right"]],
    segaMD: [[1, "A"], [0, "B"], [8, "C"], [10, "X"], [9, "Y"], [11, "Z"], [3, "Start"], [2, "Mode"], [4, "Up"], [5, "Down"], [6, "Left"], [7, "Right"]],
    segaMS: [[0, "1"], [8, "2"], [3, "Pause"], [4, "Up"], [5, "Down"], [6, "Left"], [7, "Right"]],
    segaGG: [[0, "1"], [8, "2"], [3, "Start"], [4, "Up"], [5, "Down"], [6, "Left"], [7, "Right"]],
    default: [[8, "A"], [0, "B"], [9, "X"], [1, "Y"], [10, "L"], [11, "R"], [12, "L2"], [13, "R2"], [2, "Select"], [3, "Start"], [4, "Up"], [5, "Down"], [6, "Left"], [7, "Right"]]
};
const HOTKEYS = [
    ["F1", "This panel"],
    ["F2", "Quick save"],
    ["F3 / Shift+F3", "Next / previous save slot"],
    ["Shift+F2", "Save slots with pictures (save, load, delete)"],
    ["F4", "Quick load"],
    ["Shift+F4", "Undo last load"],
    ["F5", "Pause / resume"],
    ["Shift+F5", "Reset game"],
    ["F6", "Fast forward on / off"],
    ["F7", "Slow motion on / off"],
    ["F8", "Screenshot"],
    ["Shift+F8", "2.5D mode on / off (NES and SNES, when started in 2.5D)"],
    ["F9", "Mute / unmute"],
    ["Shift+F9", "Performance mode: Quality → Balanced → Performance → Maximum"],
    ["F10", "FPS counter"],
    ["Shift+F10", "Performance stats"],
    ["F11", "Fullscreen"],
    ["Shift+F6 / Shift+F7", "Fast-forward / slow-motion speed"],
    [". (while paused)", "Advance one frame"],
    ["- / =", "Volume down / up"],
    ["Shift+F11", "Picture shape: original → 4:3 → square pixels → 16:9 → fill"],
    ["?", "Show this list of hotkeys"],
    ["Esc", "Close this panel"],
    ["Alt+] / Alt+[", "Next / previous game (game page)"],
    ["Select + L3 / R3", "FPS counter / mute (controller)"],
    ["Select + R1 / L1", "Quick save / load (controller)"],
    ["Select + R2 / L2", "Fast forward / next slot (controller)"],
    ["Select + Start", "Pause / resume (controller)"],
    ["Select + Up", "Save slots (controller)"],
    ["Select + Down", "Screenshot (controller)"],
    ["Select + Left / Right", "Previous / next save slot (controller)"],
    ["Shift+F1", "Game settings (EmulatorJS menu)"],
    ["Ctrl+S", "Quick save"],
    ["Hold Tab", "Fast forward while held"]
];
const STYLE = `
.ejs-enh-cursor-hidden, .ejs-enh-cursor-hidden * { cursor: none !important; }
.ejs-enh-scanlines { position: absolute; inset: 0; pointer-events: none; z-index: 1;
  background: repeating-linear-gradient(to bottom, rgba(0,0,0,.28) 0, rgba(0,0,0,.28) 1px, transparent 1px, transparent 3px); }
.ejs-enh-scanlines.light { background: repeating-linear-gradient(to bottom, rgba(0,0,0,.14) 0, rgba(0,0,0,.14) 1px, transparent 1px, transparent 3px); }
.ejs-enh-scanlines.strong { background: repeating-linear-gradient(to bottom, rgba(0,0,0,.45) 0, rgba(0,0,0,.45) 2px, transparent 2px, transparent 4px); }
.ejs_virtualGamepad_parent { opacity: var(--ejs-pad-opacity, 1); }
.ejs-enh-panel-open .ejs_virtualGamepad_parent { visibility: hidden; }
.ejs_virtualGamepad_parent, .ejs_virtualGamepad_parent * { -webkit-touch-callout: none; -webkit-user-select: none; user-select: none; -webkit-tap-highlight-color: transparent; }
.ejs-pad-small .ejs_virtualGamepad_left { transform: scale(.82); transform-origin: bottom left; }
.ejs-pad-small .ejs_virtualGamepad_right { transform: scale(.82); transform-origin: bottom right; }
.ejs-pad-large .ejs_virtualGamepad_left { transform: scale(1.18); transform-origin: bottom left; }
.ejs-pad-large .ejs_virtualGamepad_right { transform: scale(1.18); transform-origin: bottom right; }
.ejs-enh-toast img { width: 72px; height: auto; border-radius: 4px; image-rendering: pixelated; flex: 0 0 auto; }
.ejs-enh-panel select { font: inherit; background: #222831; color: #e6e9ed; border: 1px solid #3a4350; border-radius: 5px; padding: 2px 4px; }
.ejs-enh-keys { border-collapse: collapse; margin: 4px 0 10px; }
.ejs-enh-keys td { padding: 2px 10px 2px 0; }
.ejs-enh-keys kbd { font: 600 12px ui-monospace, monospace; background: #222831; border: 1px solid #3a4350; border-radius: 4px; padding: 1px 5px; }
.ejs-enh-row { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin: 6px 0; }
.ejs-perf-stats { pointer-events: auto !important; cursor: pointer; }
.ejs-perf-stats[data-corner="br"] { top: auto !important; bottom: 6px; }
.ejs-perf-stats[data-corner="bl"] { top: auto !important; bottom: 6px; right: auto !important; left: 8px; }
.ejs-perf-stats[data-corner="tl"] { right: auto !important; left: 8px; }
.ejs-enh-fps.ok { color: #7CFC7C; } .ejs-enh-fps.warn { color: #f0c36b; } .ejs-enh-fps.bad { color: #ff7a6a; }
.ejs-enh-panel details { border-top: 1px solid #333c47; padding: 6px 0; }
.ejs-enh-panel details > summary { cursor: pointer; font-weight: 700; padding: 4px 0; list-style-position: inside; }
.ejs-enh-panel :focus-visible, .ejs-enh-pause :focus-visible, .ejs-slots :focus-visible { outline: 3px solid #5ab8ff; outline-offset: 2px; }
.ejs-enh-panel input[type=range] { width: 160px; vertical-align: middle; }
.ejs-enh-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.ejs-enh-pause { position: absolute; inset: 0; z-index: 10; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,.55); font: 15px system-ui, sans-serif; }
.ejs-enh-pause > div { display: grid; gap: 8px; min-width: min(280px, 86%); padding: 16px; border-radius: 12px; background: rgba(20,24,30,.96); border: 1px solid #3a4350; color: #e6e9ed; text-align: center; }
.ejs-enh-pause h3 { margin: 0 0 4px; font-size: 20px; letter-spacing: .08em; }
.ejs-enh-pause button { font: inherit; font-size: 16px; padding: 10px 14px; border-radius: 8px; border: 1px solid #3a4350; background: #222831; color: #fff; cursor: pointer; }
.ejs-enh-pause button.on, .ejs-enh-pause button:focus-visible { background: #1a7fd0; border-color: #1a7fd0; }
.ejs-enh-pause p { margin: 4px 0 0; color: #8b95a1; font-size: 12px; }
.ejs-pause-open .ejs_virtualGamepad_parent { visibility: hidden; }
.ejs-enh-input { position: absolute; left: 8px; bottom: 8px; z-index: 6; pointer-events: none; display: grid; grid-template-columns: repeat(3, 14px); grid-template-rows: repeat(3, 14px); gap: 2px; padding: 6px; border-radius: 8px; background: rgba(0,0,0,.5); }
.ejs-enh-input i { display: block; border-radius: 3px; background: rgba(255,255,255,.18); font: 700 9px/14px ui-monospace, monospace; color: #fff; text-align: center; font-style: normal; }
.ejs-enh-input i.on { background: #1a7fd0; }
.ejs-enh-input .btns { position: absolute; left: 58px; bottom: 6px; display: flex; gap: 3px; }
.ejs-enh-input .btns i { min-width: 18px; height: 18px; line-height: 18px; padding: 0 3px; border-radius: 9px; }
.ejs-enh-gallery { display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 8px; margin: 8px 0; }
.ejs-enh-gallery figure { margin: 0; display: grid; gap: 3px; }
.ejs-enh-gallery img { width: 100%; border-radius: 4px; image-rendering: pixelated; background: #000; }
.ejs-enh-gallery figcaption { display: flex; gap: 3px; flex-wrap: wrap; font-size: 11px; color: #8b95a1; }
.ejs-enh-gallery button { font: inherit; font-size: 11px; padding: 2px 6px; }
.ejs-slot-label input { width: 100%; font: inherit; background: #222831; color: #fff; border: 1px solid #5ab8ff; border-radius: 4px; }
.ejs-enh-badges { position: absolute; top: 6px; right: 8px; z-index: 7; display: flex; gap: 4px; pointer-events: none; font: 700 12px/1 system-ui, sans-serif; }
.ejs-enh-badges span { padding: 3px 7px; border-radius: 10px; background: rgba(0,0,0,.65); color: #fff; border: 1px solid rgba(255,255,255,.35); }
.ejs-enh-badges .ff { color: #7cd3ff; } .ejs-enh-badges .slow { color: #ffd37c; } .ejs-enh-badges .muted { color: #ff9b8f; } .ejs-enh-badges .rec { color: #ff6b6b; }
.ejs-enh-panel > div, .ejs-enh-pause > div, .ejs-enh-toast { zoom: var(--ejs-enh-scale, 1); }
.ejs-enh-contrast .ejs-enh-panel > div, .ejs-enh-contrast .ejs-enh-pause > div, .ejs-enh-contrast .ejs-enh-toast { background: #000 !important; color: #fff !important; border: 2px solid #fff !important; }
.ejs-enh-contrast .ejs-enh-toast button, .ejs-enh-contrast .ejs-enh-panel button { background: #fff !important; color: #000 !important; font-weight: 700; }
.ejs-enh-notices { margin: 4px 0; padding: 0; list-style: none; font-size: 12px; color: #c4ccd5; }
.ejs-enh-notices time { color: #8b95a1; margin-right: 6px; }
.ejs-enh-lightbox { position: absolute; inset: 0; z-index: 12; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,.86); cursor: zoom-out; }
.ejs-enh-lightbox img { max-width: 94%; max-height: 94%; image-rendering: pixelated; border-radius: 6px; }
@media (prefers-reduced-motion: reduce) { .ejs-enh-toast, .ejs-enh-panel, .ejs-enh-pause, .ejs-enh-badges span, .ejs-slots { animation: none !important; transition: none !important; } }
.ejs-enh-fps { position: absolute; top: 6px; left: 8px; z-index: 7; pointer-events: none; font: 600 13px/1 ui-monospace, monospace;
  color: #7CFC7C; background: rgba(0,0,0,.55); padding: 4px 6px; border-radius: 4px; }
.ejs-enh-toasts { position: absolute; left: 50%; bottom: 64px; transform: translateX(-50%); z-index: 9; display: flex; flex-direction: column; gap: 8px;
  width: max-content; max-width: min(92%, 640px); pointer-events: none; }
.ejs-enh-toasts:empty { display: none; }
.ejs-enh-toast { pointer-events: auto; display: flex; flex-wrap: wrap; gap: 8px; align-items: center;
  background: rgba(20,24,30,.94); color: #eee; border: 1px solid #3a4350; border-radius: 10px; padding: 10px 12px; font: 14px system-ui, sans-serif; box-shadow: 0 6px 24px rgba(0,0,0,.5); }
.ejs-enh-toast button, .ejs-enh-panel button { font: inherit; color: #fff; background: #1a7fd0; border: 0; border-radius: 6px; padding: 6px 10px; cursor: pointer; }
.ejs-enh-toast button.secondary, .ejs-enh-panel button.secondary { background: #3a4350; }
.ejs-enh-toast > span { flex: 1 1 16em; min-width: 0; }
/* Phones and narrow players: notices at the top of the game area, clear of the touch controls; text above the buttons */
@media (max-width: 600px) {
  .ejs-enh-toasts { top: 8px; bottom: auto; max-width: calc(100% - 16px); width: calc(100% - 16px); }
  .ejs-enh-toast { font-size: 13px; padding: 8px 10px; }
  .ejs-enh-toast > span { flex-basis: 100%; }
  .ejs-enh-toast button { flex: 1 1 auto; }
}
.ejs-enh-panel { position: absolute; inset: 0; z-index: 10; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,.6); font: 14px system-ui, sans-serif; color: #e6e9ed; }
.ejs-enh-panel > div { background: #171b21; border: 1px solid #333c47; border-radius: 12px; padding: 16px 18px; max-width: min(640px, 94%); max-height: 90%; overflow: auto; }
.ejs-enh-panel h3 { margin: 0 0 10px; font-size: 16px; }
.ejs-enh-panel table { border-collapse: collapse; width: 100%; margin-bottom: 12px; }
.ejs-enh-panel td { padding: 3px 8px 3px 0; vertical-align: top; }
.ejs-enh-panel td:first-child { white-space: nowrap; color: #8fd0ff; font-family: ui-monospace, monospace; }
.ejs-enh-panel label { display: block; margin: 6px 0; }
.ejs-slots > div { max-width: min(860px, 96%); width: 100%; box-sizing: border-box; }
.ejs-slots-grid { display: grid; grid-template-columns: repeat(var(--slot-cols, 3), minmax(0, 1fr)); gap: 10px; margin: 6px 0 12px; }
.ejs-slot { box-sizing: border-box; cursor: pointer; outline: none; -webkit-tap-highlight-color: transparent; display: flex; flex-direction: column; gap: 5px; padding: 6px; border-radius: 10px; background: #1f252d; border: 2px solid transparent; }
.ejs-slot:focus-visible, .ejs-slot.selected { border-color: #1aafff; background: #22303d; }
.ejs-slot-pic { width: 100%; aspect-ratio: 4 / 3; max-height: var(--slot-pic-h, 140px); border-radius: 6px; background: #0d1014 center / cover no-repeat; image-rendering: pixelated; display: flex; align-items: center; justify-content: center; color: #6b7682; font-size: 12px; }
.ejs-slot:not(.used) .ejs-slot-pic { border: 1px dashed #3a4350; }
.ejs-slot-label { display: flex; justify-content: space-between; gap: 6px; font-size: 12px; color: #8b95a1; white-space: nowrap; overflow: hidden; }
.ejs-slot-label strong { color: #e6e9ed; font-weight: 600; overflow: hidden; text-overflow: ellipsis; }
.ejs-slot.current .ejs-slot-label strong { color: #8fd0ff; }
.ejs-slots-actions { display: flex; flex-wrap: wrap; gap: 8px; }
.ejs-slots-actions button:disabled { opacity: .4; cursor: default; }
.ejs-slots-open .ejs_virtualGamepad_parent, .ejs-slots-open .ejs_menu_bar { visibility: hidden; }
@media (pointer: coarse) { .ejs-slots-help { display: none; } .ejs-slots-actions button { min-height: 44px; flex: 1 1 auto; } }
@media (max-width: 520px) { .ejs-slots-grid { gap: 6px; } .ejs-slot-label span { display: none; } }
.ejs-depth25-on > canvas.ejs_canvas { opacity: 0 !important; }
.ejs-depth25-row { display: flex !important; align-items: center; gap: 8px; }
.ejs-depth25-row input[type=range] { flex: 1; max-width: 220px; }
.ejs-perf-stats { position: absolute; top: 6px; right: 8px; z-index: 7; pointer-events: none; white-space: pre; font: 12px/1.45 ui-monospace, monospace;
  color: #cfe8ff; background: rgba(0,0,0,.7); padding: 6px 8px; border-radius: 6px; max-width: 70%; overflow: hidden; }
.ejs-perf-panel { border-top: 1px solid #333c47; margin-top: 10px; padding-top: 8px; }
.ejs-perf-panel select { font: inherit; background: #222831; color: #e6e9ed; border: 1px solid #3a4350; border-radius: 5px; padding: 2px 4px; }
.ejs-perf-note { color: #8b95a1; font-size: 12px; }
.ejs-perf-health { margin: 6px 0 8px; padding: 6px 8px; border: 1px solid #333c47; border-radius: 6px; background: #161b22; }
.ejs-perf-health-line { font-weight: 600; margin-bottom: 5px; }
.ejs-perf-health-line[data-state="good"] { color: #7ee2a8; }
.ejs-perf-health-line[data-state="slow"], .ejs-perf-health-line[data-state="frozen"] { color: #ff8a7a; }
.ejs-perf-health-line[data-state="stutter"], .ejs-perf-health-line[data-state="uneven"] { color: #f0c36b; }
.ejs-perf-health button { font: inherit; font-size: 12px; margin: 3px 4px 0 0; padding: 3px 8px; border-radius: 5px; border: 1px solid #3a4350; background: #222831; color: #e6e9ed; cursor: pointer; }
.ejs-perf-report p { margin: 6px 0 2px; }
.ejs-perf-graph { display: block; margin-top: 6px; width: 240px; height: 40px; background: rgba(255,255,255,.05); border-radius: 3px; }
.ejs-perf-diary { margin: 6px 0; }
.ejs-perf-diary summary { cursor: pointer; color: #cfd6de; }
.ejs-perf-diary ol { margin: 4px 0 0; padding-left: 20px; color: #aeb7c2; font-size: 12px; }
.ejs-perf-diag { font: inherit; font-size: 12px; margin: 4px 0 2px; padding: 3px 8px; border-radius: 5px; border: 1px solid #3a4350; background: #222831; color: #e6e9ed; cursor: pointer; }
.ejs-enh-panel .meta { color: #8b95a1; margin: 8px 0 12px; }
.ejs-enh-back { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); z-index: 11; width: max-content; max-width: 92%; text-align: center; font: 14px system-ui, sans-serif; color: #e6e9ed; }
.ejs-enh-back-note { margin: 0 0 8px; color: #f0c36b; }
.ejs-enh-back-row { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }
.ejs-enh-back-row button { font: 15px system-ui, sans-serif; padding: 8px 14px; border-radius: 8px; border: 0; background: #1a7fd0; color: #fff; cursor: pointer; }
.ejs-enh-back-row button.secondary { background: #3a4350; }
`;

function loadPrefs() {
    try {
        return Object.assign({}, DEFAULT_PREFS, JSON.parse(localStorage.getItem(PREFS_KEY) || "{}"));
    } catch (e) {
        return Object.assign({}, DEFAULT_PREFS);
    }
}

function timeAgo(time) {
    const minutes = Math.round((Date.now() - time) / 60000);
    if (minutes < 1) return "just now";
    if (minutes < 60) return minutes + " min ago";
    if (minutes < 1440) return Math.round(minutes / 60) + " h ago";
    const days = Math.round(minutes / 1440);
    return days < 14 ? days + (days === 1 ? " day ago" : " days ago") : new Date(time).toLocaleDateString();
}
function formatDuration(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return h ? `${h} h ${m} min` : `${m} min`;
}

class EJS_Enhancements {
    constructor(ejs) {
        this.ejs = ejs;
        this.prefs = loadPrefs();
        this.undoState = null;
        this.autoPaused = false;
        this.lastAutoSave = 0;
        this.timers = [];
        this.sessionSeconds = 0;
        this.injectStyle();
        this.wrapStartError();
        ejs.on("start", () => this.onStart());
        ejs.on("exit", () => this.onExit());
    }

    // ---------- helpers ----------
    get gm() {
        return this.ejs.gameManager;
    }
    injectStyle() {
        if (document.getElementById("ejs-enh-style")) return;
        const style = document.createElement("style");
        style.id = "ejs-enh-style";
        style.textContent = STYLE;
        document.head.appendChild(style);
    }
    savePrefs() {
        try { localStorage.setItem(PREFS_KEY, JSON.stringify(this.prefs)); } catch (e) { /* storage unavailable */ }
    }
    key(name) {
        return "enh:" + this.base + ":" + name;
    }
    message(text, severity, time) {
        this.logNotice(text);
        this.ejs.frontend.displayMessage(text, time, undefined, severity);
    }
    /** Round 35: the last notices, for the F1 panel (a notice that went by too fast can be read again). */
    logNotice(text) {
        if (!this.noticeLog) this.noticeLog = [];
        const last = this.noticeLog[0];
        if (last && last.text === text && Date.now() - last.at < 1500) return;
        this.noticeLog.unshift({ at: Date.now(), text: String(text) });
        this.noticeLog.length = Math.min(this.noticeLog.length, 30);
    }
    slot() {
        return parseInt(this.ejs.getSettingValue("save-state-slot") || "1", 10) || 1;
    }
    rumble() {
        if (!this.prefs.rumble || !navigator.getGamepads) return;
        for (const pad of navigator.getGamepads()) {
            if (pad && pad.vibrationActuator && pad.vibrationActuator.playEffect) {
                pad.vibrationActuator.playEffect("dual-rumble", { duration: 90, strongMagnitude: 0.6, weakMagnitude: 0.4 }).catch(() => {});
            }
        }
    }
    every(ms, fn) {
        const id = setInterval(fn, ms);
        this.timers.push(id);
        return id;
    }
    canControl() {
        return this.ejs.started && !this.ejs.isNetplay;
    }

    // ---------- lifecycle ----------
    onStart() {
        const E = this.ejs;
        this.base = E.getBaseFileName() || "game";
        this.playKey = (typeof E.config.gameName === "string" && E.config.gameName) || this.base;
        this.originalTitle = document.title;
        document.title = this.base + " - EmulatorJS";

        this.wrapQuickSave();
        this.restoreSlots();
        this.bindHotkeys();
        this.bindGamepad();
        this.bindVisibility();
        this.setupSramFlush();
        this.setupMediaSession();
        this.requestWakeLock();
        this.setupCursorHide();
        this.applyScanlines();
        this.applyFps();
        this.trackPlaytime();
        this.watchBattery();
        this.rotateHint();
        this.watchContextLoss();
        if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
        this.offerResume();
        // Round 33
        this.setupPeriodicSave();
        this.setupFocusPause();
        this.applyTouchPrefs();
        this.setupHaptics();
        this.setupLandscapeLock();
        this.setupTitle();
        this.setupBreaks();
        this.setupArtwork();
        // Round 34
        this.applyPicture();
        this.applyInputDisplay();
        this.setupSaveReminder();
        this.setupLeaveConfirm();
        this.setupStateDrop();
        this.wrapLoadState();
        this.setupGameVolume();
        this.watchSoundBlocked();
        this.setupAnnouncer();
        this.setupErrorWatch();
        this.setupDoubleClick();
        this.readyTitle();
        this.lastSaveSession = 0;
        // Round 35
        this.loadGamePicture();
        this.applyPicture();
        this.applyUiPrefs();
        this.applyBadges();
        this.setupConnectionNotices();
    }
    onExit() {
        if (this.onOffline) window.removeEventListener("offline", this.onOffline);
        if (this.onOnline) window.removeEventListener("online", this.onOnline);
        if (this.onRejection) window.removeEventListener("unhandledrejection", this.onRejection);
        this.autoSave(true);
        for (const id of this.timers) clearInterval(id);
        this.timers = [];
        if (this.wakeLock) this.wakeLock.release().catch(() => {});
        if (this.originalTitle !== undefined) document.title = this.originalTitle;
        if (this.onBlur) window.removeEventListener("blur", this.onBlur);
        if (this.onFocus) window.removeEventListener("focus", this.onFocus);
        if (this.onFullscreen) document.removeEventListener("fullscreenchange", this.onFullscreen);
        if (this.onBeforeUnload) window.removeEventListener("beforeunload", this.onBeforeUnload);
        if (this.onWindowError) window.removeEventListener("error", this.onWindowError);
        clearTimeout(this.sleepTimer);
        window.removeEventListener("keydown", this.onKey, true);
        window.removeEventListener("keyup", this.onKey, true);
    }

    // ---------- start failure ----------
    wrapStartError() {
        const original = this.ejs.startGameError.bind(this.ejs);
        this.ejs.startGameError = (message, suffix) => {
            original(message, suffix);
            this.showBackButton(Array.isArray(message) ? message.join(": ") : String(message || ""));
        };
    }
    /**
     * The game could not start. Round 33: besides Back to menu, a reason when the device is offline or a download
     * failed, Try again, the other engine (when the page offers one, window.EJS_errorHelp) and Copy details.
     */
    showBackButton(message) {
        const parent = this.ejs.frontend.elements.parent;
        if (!parent || parent.querySelector(".ejs-enh-back")) return;
        const box = document.createElement("div");
        box.className = "ejs-enh-back";
        const network = !navigator.onLine || /network|fetch|download|404|failed to load/i.test(message || "");
        if (network) {
            const note = document.createElement("p");
            note.className = "ejs-enh-back-note";
            note.textContent = navigator.onLine
                ? "A file could not be downloaded: the game file may have moved, or the connection dropped."
                : "You're offline, and this game's files aren't saved on this device yet. Play it once while online and it will work offline after that.";
            box.appendChild(note);
        }
        const row = document.createElement("div");
        row.className = "ejs-enh-back-row";
        const add = (label, fn, secondary) => {
            const b = document.createElement("button");
            b.type = "button";
            b.textContent = label;
            if (secondary) b.className = "secondary";
            b.addEventListener("click", fn);
            row.appendChild(b);
            return b;
        };
        add("Back to menu", () => {
            if (typeof window.EJS_onBackToMenu === "function") window.EJS_onBackToMenu();
            else location.reload();
        });
        if (!window.EJS_kiosk) {
            add("Try again", () => location.reload(), true);
            const help = window.EJS_errorHelp;
            if (help && help.otherEngine) add(help.otherEngine.label, () => { location.href = help.otherEngine.href; }, true);
            const copy = add("Copy details", () => {
                const text = ["Could not start: " + (message || "?"), "Page: " + location.href, "Core: " + this.ejs.getCore(), "Browser: " + navigator.userAgent, "Online: " + navigator.onLine].join("\n");
                navigator.clipboard.writeText(text).then(() => { copy.textContent = "Copied"; }, () => { copy.textContent = "Could not copy"; });
            }, true);
        }
        box.appendChild(row);
        parent.appendChild(box);
    }

    // ---------- save slots ----------
    wrapQuickSave() {
        const gm = this.gm;
        if (gm.enhancedQuickSave) return;
        gm.enhancedQuickSave = true;
        const original = gm.quickSave.bind(gm);
        gm.quickSave = (slot) => {
            const ok = original(slot);
            if (ok) {
                this.persistSlot(slot || 1);
                this.captureThumb(slot || 1);
            }
            return ok;
        };
    }
    persistSlot(slot) {
        try {
            const data = this.gm.FS.readFile("/" + slot + "-quick.state");
            this.ejs.storage.states.put(this.key("slot" + slot), { data: data, time: Date.now() });
        } catch (e) { /* nothing to persist */ }
    }
    async restoreSlots() {
        for (let slot = 1; slot <= 9; slot++) {
            const record = await this.ejs.storage.states.get(this.key("slot" + slot));
            if (record && record.data) {
                try { this.gm.FS.writeFile("/" + slot + "-quick.state", new Uint8Array(record.data)); } catch (e) { /* ignore */ }
            }
        }
    }
    // ---------- save slot picker (round 13) ----------
    /** A small picture of the game at the moment a slot is saved, stored next to the slot. */
    captureThumb(slot) {
        const E = this.ejs;
        // RetroArch takes screenshots on its next frame, so a paused game uses the picture taken when the slot
        // picker opened (the game had not moved since)
        if (E.paused && this.pendingThumb) return this.storeThumb(slot, this.pendingThumb);
        try {
            E.screenshot((blob) => {
                if (blob) this.storeThumb(slot, blob);
            }, "retroarch", "png", 1);
        } catch (e) { /* screenshots unavailable on this core */ }
    }
    grabFrame() {
        return new Promise((resolve) => {
            const timer = setTimeout(() => resolve(null), 600);
            try {
                this.ejs.screenshot((blob) => {
                    clearTimeout(timer);
                    resolve(blob || null);
                }, "retroarch", "png", 1);
            } catch (e) {
                clearTimeout(timer);
                resolve(null);
            }
        });
    }
    storeThumb(slot, blob) {
        const E = this.ejs;
        {
            {
                createImageBitmap(blob).then((bitmap) => {
                    const width = 240;
                    const height = Math.max(1, Math.round(width * bitmap.height / bitmap.width));
                    const canvas = document.createElement("canvas");
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext("2d");
                    ctx.imageSmoothingEnabled = bitmap.width > width * 1.5;
                    ctx.drawImage(bitmap, 0, 0, width, height);
                    canvas.toBlob((jpeg) => {
                        if (!jpeg) return;
                        jpeg.arrayBuffer().then((buffer) => {
                            E.storage.states.put(this.key("thumb" + slot), { data: new Uint8Array(buffer), type: jpeg.type, time: Date.now() });
                            if (this.slotsPanel) this.renderSlots();
                        });
                    }, "image/jpeg", 0.82);
                }).catch(() => {});
            }
        }
    }
    async slotInfo(slot) {
        const states = this.ejs.storage.states;
        const [record, thumb] = await Promise.all([states.get(this.key("slot" + slot)), states.get(this.key("thumb" + slot))]);
        return { slot, used: this.slotExists(slot), time: record && record.time, thumb: thumb && thumb.data ? new Blob([thumb.data], { type: thumb.type || "image/jpeg" }) : null };
    }
    // ---------- round 34: slot names ----------
    slotNames() {
        try { return JSON.parse(localStorage.getItem("ejs-slot-names") || "{}")[this.base] || {}; } catch (e) { return {}; }
    }
    slotName(slot) {
        return this.slotNames()[slot] || "";
    }
    setSlotName(slot, name) {
        let all = {};
        try { all = JSON.parse(localStorage.getItem("ejs-slot-names") || "{}"); } catch (e) { all = {}; }
        const mine = all[this.base] || {};
        if (name) mine[slot] = name.slice(0, 40); else delete mine[slot];
        all[this.base] = mine;
        try { localStorage.setItem("ejs-slot-names", JSON.stringify(all)); } catch (e) { /* storage full */ }
    }
    renameSlot(slot) {
        const card = this.slotsPanel && this.slotsPanel.querySelector(`[data-slot="${slot}"] .ejs-slot-label`);
        if (!card) return;
        const input = document.createElement("input");
        input.type = "text";
        input.maxLength = 40;
        input.value = this.slotName(slot);
        input.placeholder = "Name, e.g. Before the boss";
        input.setAttribute("aria-label", "Name for slot " + slot);
        card.textContent = "";
        card.appendChild(input);
        input.focus();
        const done = (keep) => {
            if (keep) this.setSlotName(slot, input.value.trim());
            this.renderSlots();
        };
        input.addEventListener("keydown", (e) => {
            e.stopPropagation();
            if (e.key === "Enter") { e.preventDefault(); done(true); }
            else if (e.key === "Escape") { e.preventDefault(); done(false); }
        });
        input.addEventListener("blur", () => done(true), { once: true });
    }
    deleteSlot(slot) {
        try { this.gm.FS.unlink("/" + slot + "-quick.state"); } catch (e) { /* already gone */ }
        this.ejs.storage.states.remove(this.key("slot" + slot));
        this.ejs.storage.states.remove(this.key("thumb" + slot));
        this.setSlotName(slot, "");
        this.message("SLOT " + slot + " DELETED");
    }
    async toggleSlots() {
        if (this.slotsPanel) return this.closeSlots();
        if (window.EJS_kiosk) return;
        if (!this.canControl() || this.slotsOpening) return;
        if (this.panel) this.togglePanel();
        this.slotsOpening = true;
        this.slotsPausedGame = !this.ejs.paused;
        this.pendingThumb = this.slotsPausedGame ? await this.grabFrame() : null;
        this.slotsOpening = false;
        if (this.slotsPausedGame) this.ejs.pause();
        if (this.pauseMenu) this.closePauseMenu(true);
        if (this.ejs.releaseHeldInputs) this.ejs.releaseHeldInputs();
        const panel = document.createElement("div");
        panel.className = "ejs-enh-panel ejs-slots";
        panel.setAttribute("role", "dialog");
        panel.setAttribute("aria-label", "Save slots");
        panel.innerHTML = "<div><h3>Save slots</h3><div class=\"ejs-slots-grid\" role=\"listbox\"></div>" +
            "<div class=\"ejs-slots-actions\"><button type=\"button\" data-act=\"save\">Save here</button><button type=\"button\" data-act=\"load\">Load</button>" +
            "<button type=\"button\" class=\"secondary\" data-act=\"delete\">Delete</button>" +
            "<button type=\"button\" class=\"secondary\" data-act=\"rename\" title=\"Give this slot a name\">Name…</button>" +
            "<button type=\"button\" class=\"secondary\" data-act=\"download\" title=\"Download this slot as a file\">Download</button>" +
            "<button type=\"button\" class=\"secondary\" data-act=\"upload\" title=\"Put a save state file in this slot\">Load file…</button>" +
            "<button type=\"button\" class=\"secondary\" data-act=\"resume\" hidden title=\"The resume point saved when you last left or every 5 minutes\">Resume point</button>" +
            "<button type=\"button\" class=\"secondary\" data-act=\"close\">Close</button></div>" +
            "<p class=\"meta ejs-slots-help\"></p></div>";
        panel.querySelector(".ejs-slots-help").textContent = "Arrows or d-pad choose a slot · Enter or A loads · S or X saves · Del or Y deletes · Esc or B closes";
        panel.addEventListener("click", (e) => {
            if (e.target === panel) return this.closeSlots();
            const card = e.target.closest("[data-slot]");
            if (card) {
                const slot = Number(card.dataset.slot);
                // A second tap on the selected slot loads it (or saves into an empty one)
                if (slot === this.slotsSelected) this.slotsAct(this.slotsUsed.has(slot) ? "load" : "save");
                else this.selectSlot(slot);
                return;
            }
            const button = e.target.closest("[data-act]");
            if (button) this.slotsAct(button.dataset.act);
        });
        this.slotsKey = (e) => {
            if (e.target && e.target.tagName === "INPUT") return;
            const moves = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -3, ArrowDown: 3 };
            let handled = true;
            if (moves[e.key]) this.moveSlot(moves[e.key]);
            else if (e.key === "Enter" || e.key === " ") this.slotsAct(this.slotsUsed.has(this.slotsSelected) ? "load" : "save");
            else if (e.key === "s" || e.key === "S") this.slotsAct("save");
            else if (e.key === "l" || e.key === "L") this.slotsAct("load");
            else if (e.key === "Delete" || e.key === "Backspace") this.slotsAct("delete");
            else if (e.key === "Escape" || (e.key === "F2" && e.shiftKey)) this.closeSlots();
            else if (/^[1-9]$/.test(e.key)) this.selectSlot(Number(e.key));
            else handled = false;
            if (handled) {
                e.preventDefault();
                e.stopImmediatePropagation();
            }
        };
        window.addEventListener("keydown", this.slotsKey, true);
        // Rotating the phone or resizing the window re-fits the grid
        this.slotsResize = () => {
            clearTimeout(this.slotsResizeTimer);
            this.slotsResizeTimer = setTimeout(() => this.renderSlots(), 200);
        };
        window.addEventListener("resize", this.slotsResize);
        this.slotsPanel = panel;
        this.slotsSelected = this.slot();
        this.slotsUsed = new Set();
        this.ejs.frontend.elements.parent.appendChild(panel);
        this.ejs.frontend.elements.parent.classList.add("ejs-slots-open");
        this.renderSlots();
    }
    closeSlots() {
        if (!this.slotsPanel) return;
        window.removeEventListener("keydown", this.slotsKey, true);
        window.removeEventListener("resize", this.slotsResize);
        for (const url of this.slotsUrls || []) URL.revokeObjectURL(url);
        this.slotsUrls = [];
        this.slotsPanel.remove();
        this.slotsPanel = null;
        this.ejs.frontend.elements.parent.classList.remove("ejs-slots-open");
        this.pendingThumb = null;
        if (this.slotsPausedGame && this.ejs.started) this.ejs.play();
        this.slotsPausedGame = false;
    }
    async renderSlots() {
        const panel = this.slotsPanel;
        if (!panel) return;
        const infos = await Promise.all([1, 2, 3, 4, 5, 6, 7, 8, 9].map((slot) => this.slotInfo(slot)));
        if (panel !== this.slotsPanel) return;
        for (const url of this.slotsUrls || []) URL.revokeObjectURL(url);
        this.slotsUrls = [];
        this.slotsUsed = new Set(infos.filter((i) => i.used).map((i) => i.slot));
        const resume = await this.ejs.storage.states.get(this.key("autosave")).catch(() => null);
        const resumeButton = panel.querySelector("[data-act=resume]");
        if (resumeButton) {
            resumeButton.hidden = !(resume && resume.data);
            if (resume && resume.time) resumeButton.textContent = "Resume point (" + timeAgo(resume.time) + ")";
        }
        const grid = panel.querySelector(".ejs-slots-grid");
        grid.textContent = "";
        // Fit all nine slots without scrolling: five across on wide, short players (landscape), three otherwise
        const host = this.ejs.frontend.elements.parent;
        const wide = host.clientWidth / Math.max(1, host.clientHeight) > 1.45 && host.clientWidth > 560;
        const cols = wide ? 5 : 3;
        const rows = Math.ceil(9 / cols);
        const room = host.clientHeight * 0.9 - (matchMedia("(pointer: coarse)").matches ? 170 : 200);
        panel.style.setProperty("--slot-cols", cols);
        panel.style.setProperty("--slot-pic-h", Math.max(44, Math.floor(room / rows - 34)) + "px");
        const current = this.slot();
        for (const info of infos) {
            const card = document.createElement("div");
            card.tabIndex = 0;
            card.className = "ejs-slot" + (info.used ? " used" : "") + (info.slot === current ? " current" : "");
            card.dataset.slot = info.slot;
            card.setAttribute("role", "option");
            const pic = document.createElement("div");
            pic.className = "ejs-slot-pic";
            if (info.thumb) {
                const url = URL.createObjectURL(info.thumb);
                this.slotsUrls.push(url);
                pic.style.backgroundImage = "url(\"" + url + "\")";
            } else {
                pic.textContent = info.used ? "No picture" : "Empty";
            }
            const label = document.createElement("div");
            label.className = "ejs-slot-label";
            const when = info.used && info.time ? timeAgo(info.time) : info.used ? "saved" : "empty";
            label.innerHTML = "<strong></strong><span></span>";
            const slotName = this.slotName(info.slot);
            label.firstChild.textContent = "Slot " + info.slot + (info.slot === current ? " \u2605" : "") + (slotName ? " · " + slotName : "");
            if (info.slot === current) card.title = "Active slot: F2 saves here and F4 loads from here";
            label.lastChild.textContent = when;
            card.append(pic, label);
            grid.appendChild(card);
        }
        this.selectSlot(this.slotsSelected, true);
    }
    selectSlot(slot, keepFocus) {
        if (!this.slotsPanel) return;
        this.slotsSelected = slot;
        for (const card of this.slotsPanel.querySelectorAll("[data-slot]")) {
            const on = Number(card.dataset.slot) === slot;
            card.classList.toggle("selected", on);
            card.setAttribute("aria-selected", String(on));
            if (on && !keepFocus) card.focus({ preventScroll: true });
        }
        const used = this.slotsUsed.has(slot);
        this.slotsPanel.querySelector("[data-act=load]").disabled = !used;
        this.slotsPanel.querySelector("[data-act=delete]").disabled = !used;
        this.slotsPanel.querySelector("[data-act=download]").disabled = !used;
        this.slotsPanel.querySelector("[data-act=rename]").disabled = !used;
        this.slotsPanel.querySelector("[data-act=save]").textContent = used ? "Save over slot " + slot : "Save in slot " + slot;
    }
    moveSlot(delta) {
        let slot = this.slotsSelected + delta;
        if (slot < 1) slot += 9;
        if (slot > 9) slot -= 9;
        this.selectSlot(slot);
    }
    slotsAct(action) {
        const slot = this.slotsSelected;
        if (action === "close") return this.closeSlots();
        if (action === "delete") {
            if (!this.slotsUsed.has(slot)) return;
            this.deleteSlot(slot);
            this.renderSlots();
            return;
        }
        if (action === "download") return this.downloadSlot(slot);
        if (action === "rename") return this.renameSlot(slot);
        if (action === "upload") return this.uploadSlot(slot);
        if (action === "resume") return this.loadResumePoint();
        // The chosen slot also becomes the F2 / F4 slot
        this.ejs.frontend.changeSettingOption("save-state-slot", String(slot));
        if (action === "save") {
            this.quickSave();
            this.renderSlots();
        } else if (action === "load" && this.slotsUsed.has(slot)) {
            this.closeSlots();
            this.quickLoad();
        }
    }
    /** Controller in the slot picker: d-pad moves, A loads, X saves, Y deletes, B / Select+Up closes. */
    slotsPad(index) {
        const moves = { 12: -3, 13: 3, 14: -1, 15: 1 };
        if (moves[index]) this.moveSlot(moves[index]);
        else if (index === 0) this.slotsAct(this.slotsUsed.has(this.slotsSelected) ? "load" : "save");
        else if (index === 2) this.slotsAct("save");
        else if (index === 3) this.slotsAct("delete");
        else if (index === 1 || index === 9) this.closeSlots();
    }

    // ---------- round 33: slot files and the resume point ----------
    downloadSlot(slot) {
        let data;
        try { data = this.gm.FS.readFile("/" + slot + "-quick.state"); } catch (e) { return this.message("SLOT " + slot + " IS EMPTY", "error"); }
        const a = document.createElement("a");
        a.href = URL.createObjectURL(new Blob([data], { type: "application/octet-stream" }));
        a.download = this.base + "-slot" + slot + ".state";
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 5000);
        this.message("SLOT " + slot + " DOWNLOADED", "success");
    }
    uploadSlot(slot) {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".state,.sav,application/octet-stream";
        input.addEventListener("change", async () => {
            const file = input.files && input.files[0];
            if (!file) return;
            if (!file.size || file.size > 64 * 1048576) return this.message("THAT FILE IS NOT A SAVE STATE", "error");
            const data = new Uint8Array(await file.arrayBuffer());
            try { this.gm.FS.writeFile("/" + slot + "-quick.state", data); } catch (e) { return this.message("COULD NOT USE THAT FILE", "error"); }
            await this.ejs.storage.states.put(this.key("slot" + slot), { data, time: Date.now() });
            this.ejs.storage.states.remove(this.key("thumb" + slot));
            this.message("FILE PUT IN SLOT " + slot + ": LOAD IT TO TRY", "success");
            if (this.slotsPanel) this.renderSlots();
        });
        input.click();
    }
    async loadResumePoint() {
        const record = await this.ejs.storage.states.get(this.key("autosave")).catch(() => null);
        if (!record || !record.data) return this.message("NO RESUME POINT YET", "error");
        try { this.undoState = this.gm.getState(); } catch (e) { this.undoState = null; }
        this.closeSlots();
        this.gm.loadState(new Uint8Array(record.data));
        this.message("RESUMED", "success");
        if (this.undoState) this.toast("Went back to the resume point.", [["Undo", () => this.undoLoad(), true]], 6000);
    }

    slotExists(slot) {
        try { return this.gm.FS.analyzePath("/" + slot + "-quick.state").exists; } catch (e) { return false; }
    }
    quickSave() {
        if (!this.canControl()) return;
        const slot = this.slot();
        // Round 33: saving over a used slot can be undone for a few seconds
        let before = null;
        try { if (this.slotExists(slot)) before = this.gm.FS.readFile("/" + slot + "-quick.state").slice(); } catch (e) { before = null; }
        const beforeThumb = before ? this.ejs.storage.states.get(this.key("thumb" + slot)).catch(() => null) : null;
        const beforeRecord = before ? this.ejs.storage.states.get(this.key("slot" + slot)).catch(() => null) : null;
        if (this.gm.quickSave(slot)) {
            this.message("SAVED STATE TO SLOT " + slot, "success");
            this.rumble();
            this.checkStorage();
            this.lastSaveSession = this.sessionSeconds;
            this.lastSaveTime = Date.now();
            if (before) {
                this.toast("Slot " + slot + " was saved over.", [["Undo", async () => {
                    try { this.gm.FS.writeFile("/" + slot + "-quick.state", before); } catch (e) { return; }
                    const [thumb, record] = await Promise.all([beforeThumb, beforeRecord]);
                    this.ejs.storage.states.put(this.key("slot" + slot), { data: before, time: (record && record.time) || Date.now() });
                    if (thumb) this.ejs.storage.states.put(this.key("thumb" + slot), thumb);
                    this.message("SLOT " + slot + " PUT BACK", "success");
                    if (this.slotsPanel) this.renderSlots();
                }, true]], 7000);
            }
        } else {
            this.message("FAILED TO SAVE STATE", "error");
        }
    }
    /** Round 33: warn once a session when this site's storage is nearly full (saves could fail). */
    checkStorage() {
        if (this.storageWarned || !navigator.storage || !navigator.storage.estimate) return;
        navigator.storage.estimate().then(({ usage, quota }) => {
            if (!quota || usage / quota < 0.9 || this.storageWarned) return;
            this.storageWarned = true;
            this.toast(`Storage for this site is ${Math.round(usage * 100 / quota)}% full: new saves may fail. Delete old save slots or games you no longer play.`, [["OK", null, true]], 15000);
        }).catch(() => {});
    }
    quickLoad() {
        if (!this.canControl()) return;
        const slot = this.slot();
        if (!this.slotExists(slot)) {
            this.message("SLOT " + slot + " IS EMPTY", "error");
            return;
        }
        try { this.undoState = this.gm.getState(); } catch (e) { this.undoState = null; }
        this.gm.quickLoad(slot);
        this.message("LOADED STATE FROM SLOT " + slot, "success");
        this.rumble();
        if (this.undoState) this.toast("Loaded slot " + slot + ".", [["Undo", () => this.undoLoad(), true]], 6000);
    }
    undoLoad() {
        if (!this.canControl()) return;
        if (!this.undoState) {
            this.message("NOTHING TO UNDO", "error");
            return;
        }
        const state = this.undoState;
        this.undoState = null;
        this.gm.loadState(state);
        this.message("UNDID LAST LOAD", "success");
    }
    changeSlot(delta) {
        let slot = this.slot() + delta;
        if (slot > 9) slot = 1;
        if (slot < 1) slot = 9;
        this.ejs.frontend.changeSettingOption("save-state-slot", String(slot));
        this.message("SAVE SLOT " + slot + (this.slotExists(slot) ? " (USED)" : " (EMPTY)"));
    }

    // ---------- autosave / resume ----------
    autoSave(force) {
        const E = this.ejs;
        if (!this.prefs.autoSave || !E.started || E.failedToStart || !this.gm) return;
        const now = Date.now();
        if (!force && now - this.lastAutoSave < 5000) return;
        try {
            if (!this.gm.supportsStates()) return;
            const data = this.gm.getState();
            this.lastAutoSave = now;
            // Round 33: a small picture for the resume prompt and the slot picker (not while the page is closing)
            if (!force && !E.paused && !document.hidden) this.grabFrame().then((blob) => blob && this.storeThumb("resume", blob));
            else if (force === "periodic") this.grabFrame().then((blob) => blob && this.storeThumb("resume", blob));
            // Returned so a reload (lag fixes that need a restart) can wait until the resume point is stored
            const stored = E.storage.states.put(this.key("autosave"), { data: data, time: now });
            this.lastSaveTime = now;
            return stored && stored.catch ? stored.catch(() => this.storageFailed()) : stored;
        } catch (e) { /* core cannot save right now */ }
    }
    async offerResume() {
        if (!this.prefs.resumePrompt || this.ejs.config.loadState) return;
        const record = await this.ejs.storage.states.get(this.key("autosave"));
        if (!record || !record.data) return;
        const minutes = Math.max(1, Math.round((Date.now() - record.time) / 60000));
        const ago = minutes < 60 ? minutes + " min ago" : minutes < 1440 ? Math.round(minutes / 60) + " h ago" : Math.round(minutes / 1440) + " days ago";
        // Round 33: with the picture of that moment, when there is one
        const thumb = await this.ejs.storage.states.get(this.key("thumbresume")).catch(() => null);
        const image = thumb && thumb.data && thumb.time >= record.time - 600000 ? new Blob([thumb.data], { type: thumb.type || "image/jpeg" }) : null;
        this.toast("Resume where you left off (" + ago + ")?", [
            ["Resume", () => {
                try { this.undoState = this.gm.getState(); } catch (e) { /* ignore */ }
                this.gm.loadState(new Uint8Array(record.data));
                this.message("RESUMED", "success");
            }],
            ["Start fresh", null, true]
        ], 12000, image);
    }
    toast(text, buttons, timeout, image) {
        // Kiosk screens: tips with buttons are for the owner of the device, not for visitors
        if (window.EJS_kiosk) {
            console.info("[kiosk] " + text);
            return () => {};
        }
        this.logNotice(text);
        // Notices share one column, so a second one stacks instead of covering the first
        const host = this.ejs.frontend.elements.parent;
        let parent = host.querySelector(":scope > .ejs-enh-toasts");
        if (!parent) {
            parent = document.createElement("div");
            parent.className = "ejs-enh-toasts";
            parent.setAttribute("aria-live", "polite");
            host.appendChild(parent);
        }
        // No more than three at once: the oldest goes
        while (parent.children.length >= 3) parent.firstElementChild.remove();
        const box = document.createElement("div");
        box.className = "ejs-enh-toast";
        let imageUrl = null;
        if (image) {
            imageUrl = URL.createObjectURL(image);
            const img = document.createElement("img");
            img.src = imageUrl;
            img.alt = "";
            box.appendChild(img);
        }
        const label = document.createElement("span");
        label.textContent = text;
        box.appendChild(label);
        const close = () => {
            clearTimeout(timer);
            box.remove();
            if (imageUrl) URL.revokeObjectURL(imageUrl);
        };
        for (const [title, action, secondary] of buttons) {
            const button = document.createElement("button");
            button.textContent = title;
            if (secondary) button.className = "secondary";
            button.addEventListener("click", (e) => {
                e.stopPropagation();
                close();
                if (action) action();
            });
            box.appendChild(button);
        }
        parent.appendChild(box);
        // Round 35: how long notices stay is a setting (short, normal, long, until closed)
        const factor = { "5": 0.6, "8": 1, "15": 2, "0": 0 }[String(this.prefs.toastTime)];
        const timer = factor === 0 ? null : setTimeout(close, (timeout || 8000) * (factor || 1));
        return close;
    }

    // ---------- hotkeys ----------
    bindHotkeys() {
        const actions = {
            F1: (e) => (e.shiftKey ? this.openGameSettings() : this.togglePanel()),
            F2: (e) => (e.shiftKey ? this.toggleSlots() : this.quickSave()),
            F3: (e) => this.changeSlot(e.shiftKey ? -1 : 1),
            F4: (e) => (e.shiftKey ? this.undoLoad() : this.quickLoad()),
            F5: (e) => (e.shiftKey ? this.reset() : this.togglePause()),
            F6: (e) => (e.shiftKey ? this.cycleSpeed("ff-ratio", FF_SPEEDS, "3.0", "FAST FORWARD") : this.toggleSetting("fastForward", "isFastForward", "FAST FORWARD")),
            F7: (e) => (e.shiftKey ? this.cycleSpeed("sm-ratio", SM_SPEEDS, "3.0", "SLOW MOTION") : this.toggleSetting("slowMotion", "isSlowMotion", "SLOW MOTION")),
            F8: (e) => (e.shiftKey && this.ejs.depth25 ? this.ejs.depth25.toggle() : this.screenshot()),
            F9: (e) => (e.shiftKey && this.ejs.performance ? this.ejs.performance.toggleMode() : this.toggleMute()),
            F10: (e) => (e.shiftKey && this.ejs.performance ? this.ejs.performance.toggleStats() : this.setPref("fps", !this.prefs.fps)),
            F11: (e) => (e.shiftKey ? this.cycleShape() : this.ejs.toggleFullscreen(!(document.fullscreenElement || document.webkitFullscreenElement)))
        };
        // Round 33: keys that games could also use only act when no player has them in the control map, and not in
        // keyboard mode (computers)
        const softKeys = {
            ".": () => this.advanceFrame(),
            "-": () => this.changeVolume(-0.1),
            "=": () => this.changeVolume(0.1),
            "+": () => this.changeVolume(0.1),
            "?": () => this.showHotkeys()
        };
        const freeKey = (e) => {
            if (this.ejs.getSettingValue("keyboardInput") === "enabled") return false;
            const controls = this.ejs.controls || {};
            for (const player of Object.values(controls)) {
                for (const button of Object.values(player || {})) if (button && button.value === e.keyCode) return false;
            }
            return true;
        };
        this.onKey = (e) => {
            // Round 34: Ctrl+S saves the game instead of the web page; hold Tab to fast-forward
            if ((e.ctrlKey || e.metaKey) && (e.key === "s" || e.key === "S") && this.ejs.started && !window.EJS_kiosk) {
                e.preventDefault();
                e.stopImmediatePropagation();
                if (e.type === "keydown" && !e.repeat && !this.panel && !this.slotsPanel) this.quickSave();
                return;
            }
            if (e.key === "Tab" && this.prefs.holdTabFast && this.ejs.started && !window.EJS_kiosk && !this.panel && !this.slotsPanel && !this.pauseMenu && freeKey(e)) {
                const t = e.target;
                if (!(t && (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA" || t.tagName === "BUTTON"))) {
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    if (e.type === "keydown" && !e.repeat && !this.ejs.isFastForward && !this.ejs.paused) {
                        this.tabFast = true;
                        this.ejs.frontend.changeSettingOption("fastForward", "enabled");
                    } else if (e.type === "keyup" && this.tabFast) {
                        this.tabFast = false;
                        this.ejs.frontend.changeSettingOption("fastForward", "disabled");
                    }
                    return;
                }
            }
            // Round 35: Esc closes a screenshot shown large before it closes the panel under it
            if (e.key === "Escape" && this.lightboxClose) {
                e.preventDefault();
                e.stopImmediatePropagation();
                if (e.type === "keydown") this.lightboxClose();
                return;
            }
            if (this.pauseMenu && e.type === "keydown" && this.pauseMenuKey(e)) return;
            if (e.key === "Escape" && this.panel && e.type === "keydown") {
                e.preventDefault();
                e.stopImmediatePropagation();
                return this.togglePanel();
            }
            let action = actions[e.key];
            if (!action && softKeys[e.key] && !e.ctrlKey && !e.metaKey && !e.altKey && freeKey(e)) action = softKeys[e.key];
            if (!action || !this.ejs.started) return;
            // Kiosk (museum screens): visitors get mute only; saves, slots, panels and speed changes stay with staff
            if (window.EJS_kiosk && e.key !== "F9") {
                e.preventDefault();
                e.stopImmediatePropagation();
                return;
            }
            const target = e.target;
            if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
            const front = this.ejs.frontend;
            if (front.isRemapping()) return;
            if (this.slotsPanel && e.key !== "F1") return; // the slot picker handles its own keys
            if (e.key !== "F1" && (this.panel || front.isPopupOpen() || front.isSettingsMenuOpen())) return;
            e.preventDefault();
            e.stopImmediatePropagation();
            if (e.type === "keydown" && !e.repeat) action(e);
        };
        window.addEventListener("keydown", this.onKey, true);
        window.addEventListener("keyup", this.onKey, true);
    }
    // ---------- round 33: speeds, frame advance, volume ----------
    cycleSpeed(setting, list, fallback, label) {
        if (!this.canControl()) return;
        const current = this.ejs.getSettingValue(setting) || fallback;
        const next = list[(list.indexOf(current) + 1) % list.length] || list[0];
        this.ejs.frontend.changeSettingOption(setting, next);
        this.message(label + " SPEED " + (next === "unlimited" ? "UNLIMITED" : (label === "SLOW MOTION" ? "1/" + parseFloat(next) : "×" + parseFloat(next))));
    }
    advanceFrame() {
        if (!this.canControl()) return;
        const E = this.ejs;
        if (!E.paused) {
            E.pause();
            this.message("PAUSED: PRESS . FOR ONE FRAME");
            return;
        }
        if (this.advancing) return;
        this.advancing = true;
        const start = this.gm.getFrameNum();
        // Run until the core has drawn one more frame, then pause again (sound stays quiet)
        E.play(true);
        const until = performance.now() + 500;
        const wait = () => {
            if (this.gm.getFrameNum() > start || performance.now() > until) {
                E.pause(true);
                this.advancing = false;
                this.message("FRAME " + this.gm.getFrameNum());
                return;
            }
            requestAnimationFrame(wait);
        };
        requestAnimationFrame(wait);
    }
    changeVolume(delta) {
        const E = this.ejs;
        const base = E.muted ? 0 : (typeof E.volume === "number" ? E.volume : 0.5);
        const v = Math.round(Math.max(0, Math.min(1, base + delta)) * 10) / 10;
        E.volume = v;
        E.muted = v === 0;
        E.setVolume(v);
        try { E.saveSettings(); } catch (e) { /* settings unsaved */ }
        this.message("VOLUME " + Math.round(v * 100) + "%");
    }
    togglePause() {
        if (!this.canControl()) return;
        this.autoPaused = false;
        if (this.pauseMenu) return this.closePauseMenu();
        this.ejs.togglePlaying();
        if (this.ejs.paused && this.prefs.pauseMenu && !window.EJS_kiosk) this.openPauseMenu();
        else this.message(this.ejs.paused ? "PAUSED" : "RESUMED");
    }
    // ---------- round 34: pause menu ----------
    openPauseMenu() {
        if (this.pauseMenu) return;
        if (this.ejs.releaseHeldInputs) this.ejs.releaseHeldInputs();
        const menu = document.createElement("div");
        menu.className = "ejs-enh-pause";
        menu.setAttribute("role", "dialog");
        menu.setAttribute("aria-label", "Paused");
        const box = document.createElement("div");
        const h = document.createElement("h3");
        h.textContent = "PAUSED";
        box.appendChild(h);
        const played = (JSON.parse(localStorage.getItem(PLAYTIME_KEY) || "{}")[this.playKey]) || 0;
        const time = document.createElement("p");
        time.className = "ejs-perf-note";
        time.textContent = formatDuration(this.sessionSeconds) + " this session · " + formatDuration(played) + " in all";
        box.appendChild(time);
        const items = [
            ["Resume", () => this.closePauseMenu()],
            ["Quick save (slot " + this.slot() + ")", () => { this.closePauseMenu(true); this.quickSave(); this.ejs.play(); }],
            ["Quick load (slot " + this.slot() + ")", () => { this.closePauseMenu(true); this.ejs.play(); this.quickLoad(); }],
            ["Save slots…", () => { this.closePauseMenu(true); this.toggleSlots(); }],
            ["Screenshot", () => this.screenshot()],
            ["Reset game", () => { this.closePauseMenu(true); this.ejs.play(); this.reset(); }],
            ["Options (F1)", () => { this.closePauseMenu(true); this.togglePanel(); }]
        ];
        for (const [label, fn] of items) {
            const b = document.createElement("button");
            b.type = "button";
            b.textContent = label;
            b.addEventListener("click", (e) => { e.stopPropagation(); fn(); });
            box.appendChild(b);
        }
        const help = document.createElement("p");
        help.textContent = "Arrows or d-pad · Enter or A chooses · Esc, F5 or B resumes";
        box.appendChild(help);
        menu.appendChild(box);
        menu.addEventListener("click", (e) => { if (e.target === menu) this.closePauseMenu(); });
        this.ejs.frontend.elements.parent.appendChild(menu);
        this.ejs.frontend.elements.parent.classList.add("ejs-pause-open");
        this.pauseMenu = menu;
        this.pauseIndex = 0;
        this.focusPauseItem();
    }
    focusPauseItem() {
        const buttons = this.pauseMenu ? [...this.pauseMenu.querySelectorAll("button")] : [];
        buttons.forEach((b, i) => b.classList.toggle("on", i === this.pauseIndex));
        if (buttons[this.pauseIndex]) buttons[this.pauseIndex].focus({ preventScroll: true });
    }
    movePause(delta) {
        const n = this.pauseMenu.querySelectorAll("button").length;
        this.pauseIndex = (this.pauseIndex + delta + n) % n;
        this.focusPauseItem();
    }
    closePauseMenu(stayPaused) {
        if (!this.pauseMenu) return;
        this.pauseMenu.remove();
        this.pauseMenu = null;
        this.ejs.frontend.elements.parent.classList.remove("ejs-pause-open");
        if (!stayPaused && this.ejs.paused) {
            this.ejs.play();
            this.message("RESUMED");
        }
    }
    pauseMenuKey(e) {
        const k = e.key;
        if (k === "ArrowDown" || k === "ArrowRight") this.movePause(1);
        else if (k === "ArrowUp" || k === "ArrowLeft") this.movePause(-1);
        else if (k === "Enter" || k === " ") this.pauseMenu.querySelectorAll("button")[this.pauseIndex].click();
        else if (k === "Escape" || k === "F5") this.closePauseMenu();
        else return false;
        e.preventDefault();
        e.stopImmediatePropagation();
        return true;
    }
    pauseMenuPad(index) {
        if (index === 12 || index === 14) this.movePause(-1);
        else if (index === 13 || index === 15) this.movePause(1);
        else if (index === 0) this.pauseMenu.querySelectorAll("button")[this.pauseIndex].click();
        else if (index === 1 || index === 9) this.closePauseMenu();
    }
    reset() {
        if (!this.canControl()) return;
        try { this.undoState = this.gm.getState(); } catch (e) { /* ignore */ }
        this.gm.restart();
        this.message("GAME RESET (SHIFT+F4 TO UNDO)");
        if (this.undoState) this.toast("The game was reset.", [["Undo", () => this.undoLoad(), true]], 6000);
    }
    toggleSetting(setting, flag, label) {
        if (!this.canControl()) return;
        const on = !this.ejs[flag];
        this.ejs.frontend.changeSettingOption(setting, on ? "enabled" : "disabled");
        this.message(label + (on ? " ON" : " OFF"));
    }
    toggleMute() {
        const E = this.ejs;
        if (E.muted) {
            if (!E.volume) E.volume = 0.5;
            E.muted = false;
            E.setVolume(E.volume);
            this.message("SOUND ON");
        } else {
            E.muted = true;
            E.setVolume(0);
            this.message("MUTED");
        }
    }
    screenshot() {
        const E = this.ejs;
        const name = E.getBaseFileName() + "-" + E.getFileNameTimestamp(new Date());
        const fmt = this.prefs.shotFormat !== "default" ? this.prefs.shotFormat : undefined;
        const up = this.prefs.shotScale !== "default" ? Number(this.prefs.shotScale) : undefined;
        E.screenshot((blob, format) => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = name + "." + format;
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            this.message("SCREENSHOT SAVED", "success");
            this.keepShot(blob);
            // Round 33: copy it too, to paste straight into a chat or document
            const buttons = [["Gallery", () => this.openGallery()]];
            if (navigator.clipboard && window.ClipboardItem) buttons.unshift(["Copy", () => this.copyImage(blob)]);
            buttons.push(["OK", null, true]);
            this.toast("Screenshot saved.", buttons, 5000);
        }, undefined, fmt, up);
    }
    async copyImage(blob) {
        try {
            let png = blob;
            if (blob.type !== "image/png") {
                const bitmap = await createImageBitmap(blob);
                const canvas = document.createElement("canvas");
                canvas.width = bitmap.width;
                canvas.height = bitmap.height;
                canvas.getContext("2d").drawImage(bitmap, 0, 0);
                png = await new Promise((r) => canvas.toBlob(r, "image/png"));
            }
            await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
            this.message("SCREENSHOT COPIED", "success");
        } catch (e) {
            this.message("COULD NOT COPY THE PICTURE", "error");
        }
    }
    setPref(name, value) {
        this.prefs[name] = value;
        this.savePrefs();
        if (name === "fps") this.applyFps();
        if (name === "scanlines" || name === "scanlineStrength") this.applyScanlines();
        if (name === "uiScale" || name === "highContrast") this.applyUiPrefs();
        if (name === "statusBadges") this.applyBadges();
        if (PICTURE_KEYS.includes(name)) this.saveGamePicture();
        if (name === "padOpacity" || name === "padSize") this.applyTouchPrefs();
        if (name === "breakMinutes") this.nextBreakAt = null;
        if (["brightness", "contrast", "saturation", "nightTint", "smoothScaling", "surround"].includes(name)) this.applyPicture();
        if (name === "inputDisplay") this.applyInputDisplay();
        if (name === "wakeLock") value ? this.requestWakeLock() : this.wakeLock && this.wakeLock.release().catch(() => {});
    }

    // ---------- panel ----------
    togglePanel() {
        if (this.panel) {
            this.panel.remove();
            this.panel = null;
            this.ejs.frontend.elements.parent.classList.remove("ejs-enh-panel-open");
            if (this.pausedByPanel) this.ejs.play();
            this.pausedByPanel = false;
            return;
        }
        if (this.pauseMenu) this.closePauseMenu(true);
        this.pausedByPanel = !this.ejs.paused && this.canControl();
        if (this.pausedByPanel) this.ejs.pause();
        this.ejs.releaseHeldInputs && this.ejs.releaseHeldInputs();
        const panel = document.createElement("div");
        panel.className = "ejs-enh-panel";
        panel.setAttribute("role", "dialog");
        panel.setAttribute("aria-label", "Hotkeys and options");
        const box = document.createElement("div");
        panel.appendChild(box);
        const title = document.createElement("h3");
        title.textContent = "Hotkeys and options";
        box.appendChild(title);

        const E = this.ejs;
        const played = (JSON.parse(localStorage.getItem(PLAYTIME_KEY) || "{}")[this.playKey]) || 0;
        const used = [];
        for (let s = 1; s <= 9; s++) if (this.slotExists(s)) used.push(s);
        const meta = document.createElement("div");
        meta.className = "meta";
        meta.textContent = `${this.base}: played ${formatDuration(played)} in all, ${formatDuration(this.sessionSeconds)} this session. Save slot ${this.slot()} selected; slots in use: ${used.length ? used.join(", ") : "none"}.`;
        box.appendChild(meta);
        // Round 35: the last save, and the play time across all games
        const days = this.playDays();
        const week = Object.keys(days).filter((d) => d >= this.dayKey(-6)).reduce((n, d) => n + days[d], 0);
        const extra = document.createElement("div");
        extra.className = "meta";
        const saveAgo = this.lastSaveTime ? Math.max(1, Math.round((Date.now() - this.lastSaveTime) / 60000)) + " min ago" : "not yet this session";
        extra.textContent = `Last save: ${saveAgo}. All games: ${formatDuration(days[this.dayKey(0)] || 0)} today, ${formatDuration(week)} in the last 7 days.`;
        box.appendChild(extra);
        // Round 34: what is running
        const about = document.createElement("div");
        about.className = "meta";
        about.textContent = `${String(E.getCore(true) || "").toUpperCase()} · core ${E.getCore()} (${E.usingThreads ? "threaded" : "single-thread"}) · EmulatorJS ${E.ejs_version || "?"}, local edition`;
        box.appendChild(about);
        // Round 33: whether the browser may clear this site's saves when space runs low
        if (navigator.storage && navigator.storage.persisted) {
            const keep = document.createElement("div");
            keep.className = "meta";
            navigator.storage.persisted().then((yes) => {
                keep.textContent = yes ? "Saves are protected: the browser keeps them when space runs low." : "Saves are not protected yet: the browser may clear them when space runs low. ";
                if (!yes && navigator.storage.persist) {
                    const b = document.createElement("button");
                    b.type = "button";
                    b.className = "secondary";
                    b.textContent = "Protect saves";
                    b.addEventListener("click", () => navigator.storage.persist().then((ok) => { keep.textContent = ok ? "Saves are protected now." : "The browser said no; adding the site to the home screen or bookmarking it often helps."; }));
                    keep.appendChild(b);
                }
            }).catch(() => {});
            box.appendChild(keep);
        }
        // Buttons used most
        const top = document.createElement("div");
        top.className = "ejs-enh-row";
        const button = (text, fn, secondary, title) => {
            const b = document.createElement("button");
            b.type = "button";
            b.textContent = text;
            if (secondary) b.className = "secondary";
            if (title) b.title = title;
            b.addEventListener("click", fn);
            top.appendChild(b);
            return b;
        };
        button("Save slots… (Shift+F2)", () => this.toggleSlots());
        button("Screenshots…", () => this.openGallery(), true, "The last pictures taken of this game (F8)");
        button("Game settings (Shift+F1)", () => this.openGameSettings(), true, "EmulatorJS's own settings: controls, shaders, core options");
        button("Player guide (PDF)", () => window.open("guide/EmulatorJS-Player-Guide.pdf", "_blank", "noopener"), true, "The illustrated player guide: every mode and hotkey. Opens in a new tab; save it from the viewer");
        box.appendChild(top);

        // Round 34: sections that can be folded away (remembered)
        const open = Object.assign({}, DEFAULT_PREFS.panelOpen, this.prefs.panelOpen || {});
        const section = (id, label) => {
            const d = document.createElement("details");
            d.open = !!open[id];
            d.addEventListener("toggle", () => {
                this.prefs.panelOpen = Object.assign({}, open, this.prefs.panelOpen || {}, { [id]: d.open });
                this.savePrefs();
            });
            const sum = document.createElement("summary");
            sum.textContent = label;
            d.appendChild(sum);
            box.appendChild(d);
            return d;
        };
        const keys = section("keys", "Your keys and controllers");
        this.renderKeys(keys);
        this.renderControllers(keys);
        const hot = section("hotkeys", "Hotkeys");
        const table = document.createElement("table");
        for (const [k, text] of HOTKEYS) {
            if (k.startsWith("Shift+F8") && !this.ejs.depth25) continue;
            const row = table.insertRow();
            row.insertCell().textContent = k;
            row.insertCell().textContent = text;
        }
        hot.appendChild(table);

        const opts = section("options", "Options");
        for (const name of Object.keys(PREF_LABELS)) {
            const label = document.createElement("label");
            const input = document.createElement("input");
            input.type = "checkbox";
            input.checked = !!this.prefs[name];
            input.addEventListener("change", () => this.setPref(name, input.checked));
            label.appendChild(input);
            label.append(" " + PREF_LABELS[name]);
            opts.appendChild(label);
        }
        // Round 33: settings with a choice of values, and the sleep timer
        const choices = document.createElement("div");
        choices.className = "ejs-enh-row";
        for (const [name, [labelText, options]] of Object.entries(PREF_CHOICES)) {
            const label = document.createElement("label");
            const select = document.createElement("select");
            for (const [value, text] of options) select.add(new Option(text, value));
            select.value = String(this.prefs[name]);
            select.addEventListener("change", () => this.setPref(name, select.value));
            label.append(labelText + " ", select);
            choices.appendChild(label);
        }
        const sleepLabel = document.createElement("label");
        const sleep = document.createElement("select");
        for (const [value, text] of [["0", "Off"], ["15", "15 min"], ["30", "30 min"], ["60", "1 hour"]]) sleep.add(new Option(text, value));
        sleep.value = this.sleepMinutes ? String(this.sleepMinutes) : "0";
        sleep.addEventListener("change", () => this.setSleepTimer(Number(sleep.value)));
        sleepLabel.append("Sleep timer ", sleep);
        if (this.sleepAt) sleepLabel.title = "Pauses at " + new Date(this.sleepAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        choices.appendChild(sleepLabel);
        opts.appendChild(choices);
        const resetButton = document.createElement("button");
        resetButton.type = "button";
        resetButton.className = "secondary";
        resetButton.textContent = "Reset these options";
        resetButton.title = "Put every option in this panel back to how it started (saves are not touched)";
        resetButton.addEventListener("click", () => {
            this.prefs = Object.assign({}, DEFAULT_PREFS);
            this.savePrefs();
            this.applyFps();
            this.applyScanlines();
            this.applyTouchPrefs();
            this.applyPicture();
            this.applyInputDisplay();
            this.nextBreakAt = null;
            this.applyUiPrefs();
            this.applyBadges();
            this.clearGamePicture();
            this.togglePanel();
            this.togglePanel();
            this.message("OPTIONS RESET");
        });
        opts.appendChild(resetButton);
        // Round 35: options can be taken to another device
        const exportBtn = document.createElement("button");
        exportBtn.type = "button";
        exportBtn.className = "secondary";
        exportBtn.textContent = "Export options";
        exportBtn.addEventListener("click", () => this.exportOptions());
        const importBtn = document.createElement("button");
        importBtn.type = "button";
        importBtn.className = "secondary";
        importBtn.textContent = "Import options…";
        importBtn.addEventListener("click", () => this.importOptions());
        opts.append(" ", exportBtn, " ", importBtn);

        this.renderInstall(section("install", "Install and downloads"));
        const note = section("notices", "Recent notices");
        const list = document.createElement("ul");
        list.className = "ejs-enh-notices";
        for (const n of (this.noticeLog || []).slice(0, 12)) {
            const li = document.createElement("li");
            const t = document.createElement("time");
            t.textContent = new Date(n.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
            li.append(t, n.text);
            list.appendChild(li);
        }
        if (!list.children.length) list.textContent = "Nothing yet.";
        note.appendChild(list);
        const pic = section("picture", "Picture");
        this.renderPicture(pic);
        if (this.ejs.depth25) this.ejs.depth25.renderPanel(box);
        if (this.ejs.performance) this.ejs.performance.renderPanel(box);
        const close = document.createElement("button");
        close.textContent = "Close (F1 or Esc)";
        close.style.marginTop = "10px";
        close.addEventListener("click", () => this.togglePanel());
        box.appendChild(close);
        panel.addEventListener("click", (e) => {
            if (e.target === panel) this.togglePanel();
        });
        this.ejs.frontend.elements.parent.appendChild(panel);
        this.ejs.frontend.elements.parent.classList.add("ejs-enh-panel-open");
        this.panel = panel;
        // Keyboard users land in the panel (Esc closes it)
        const first = panel.querySelector("button, summary, input, select");
        if (first) first.focus({ preventScroll: true });
    }
    // ---------- round 34: picture ----------
    renderPicture(box) {
        const slider = (name, label) => {
            const l = document.createElement("label");
            const input = document.createElement("input");
            input.type = "range";
            input.min = "50";
            input.max = "150";
            input.step = "5";
            input.value = String(this.prefs[name]);
            const out = document.createElement("span");
            out.className = "ejs-perf-note";
            out.textContent = " " + input.value + "%";
            input.addEventListener("input", () => {
                out.textContent = " " + input.value + "%";
                this.setPref(name, input.value);
            });
            l.append(label + " ", input, out);
            box.appendChild(l);
        };
        const remember = document.createElement("p");
        remember.className = "ejs-perf-note";
        remember.textContent = "These settings are remembered for this game.";
        box.appendChild(remember);
        slider("brightness", "Brightness");
        slider("contrast", "Contrast");
        slider("saturation", "Colour");
        for (const [name, label] of Object.entries(PICTURE_LABELS)) {
            const l = document.createElement("label");
            const input = document.createElement("input");
            input.type = "checkbox";
            input.checked = !!this.prefs[name];
            input.addEventListener("change", () => this.setPref(name, input.checked));
            l.append(input, " " + label);
            box.appendChild(l);
        }
        const row = document.createElement("div");
        row.className = "ejs-enh-row";
        const sur = document.createElement("select");
        for (const [v, t] of [["black", "Black"], ["grey", "Dark grey"], ["site", "Site colour"]]) sur.add(new Option(t, v));
        sur.value = this.prefs.surround;
        sur.addEventListener("change", () => this.setPref("surround", sur.value));
        const surLabel = document.createElement("label");
        surLabel.append("Around the picture ", sur);
        row.appendChild(surLabel);
        const perf = this.ejs.performance;
        if (perf) {
            const shape = document.createElement("select");
            for (const [v, t] of [["auto", "Original"], ["4:3", "4:3 TV"], ["square", "Square pixels"], ["16:9", "16:9 wide"], ["fill", "Fill the area"]]) shape.add(new Option(t, v));
            shape.value = perf.profile.aspect || "auto";
            shape.addEventListener("change", () => perf.set("aspect", shape.value));
            const shapeLabel = document.createElement("label");
            shapeLabel.title = "Saved for this game";
            shapeLabel.append("Shape ", shape);
            row.appendChild(shapeLabel);
        }
        box.appendChild(row);
        const reset = document.createElement("button");
        reset.type = "button";
        reset.className = "secondary";
        reset.textContent = "Reset picture";
        reset.addEventListener("click", () => {
            for (const k of ["brightness", "contrast", "saturation", "nightTint", "smoothScaling", "surround"]) this.prefs[k] = DEFAULT_PREFS[k];
            this.savePrefs();
            this.applyPicture();
            this.clearGamePicture();
            if (perf) perf.set("aspect", "auto");
            this.togglePanel();
            this.togglePanel();
        });
        box.appendChild(reset);
    }
    applyPicture() {
        const canvas = this.ejs.frontend.canvas;
        const parent = this.ejs.frontend.elements.parent;
        if (!canvas) return;
        const p = this.prefs;
        const parts = [];
        if (p.brightness !== "100") parts.push(`brightness(${Number(p.brightness) / 100})`);
        if (p.contrast !== "100") parts.push(`contrast(${Number(p.contrast) / 100})`);
        if (p.saturation !== "100") parts.push(`saturate(${Number(p.saturation) / 100})`);
        if (p.nightTint) parts.push("sepia(.35) saturate(1.1) hue-rotate(-12deg) brightness(.95)");
        // Only touched when set here, so a page that filters the picture itself (comfort play) keeps its filter
        if (parts.length) { canvas.style.filter = parts.join(" "); this.pictureFiltered = true; }
        else if (this.pictureFiltered) { canvas.style.filter = ""; this.pictureFiltered = false; }
        canvas.style.setProperty("image-rendering", p.smoothScaling ? "auto" : "pixelated");
        const site = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim();
        if (parent) parent.style.background = p.surround === "grey" ? "#1c2026" : p.surround === "site" && site ? site : "";
    }
    /** Round 33: this game's buttons and the keyboard keys and controller buttons they are on. */
    renderKeys(box) {
        const E = this.ejs;
        const scheme = E.getControlScheme ? E.getControlScheme() : E.getCore(true);
        const names = BUTTON_NAMES[scheme] || BUTTON_NAMES.default;
        const controls = (E.controls && E.controls[0]) || {};
        const rows = names.filter(([id]) => controls[id] && (controls[id].value || controls[id].value2));
        if (!rows.length) return;
        const h = document.createElement("h3");
        h.textContent = "Your keys for this game (player 1)";
        h.style.fontSize = "14px";
        box.appendChild(h);
        const t = document.createElement("table");
        t.className = "ejs-enh-keys";
        const keyName = (v) => {
            const name = typeof v === "number" ? (E.keyMap && E.keyMap[v]) : v;
            return name ? String(name).toUpperCase() : "–";
        };
        for (let i = 0; i < rows.length; i += 2) {
            const r = t.insertRow();
            for (const [id, label] of rows.slice(i, i + 2)) {
                r.insertCell().textContent = label;
                const k = r.insertCell();
                const kbd = document.createElement("kbd");
                kbd.textContent = keyName(controls[id].value);
                k.appendChild(kbd);
                if (controls[id].value2) k.append(" " + String(controls[id].value2).replace(/_/g, " ").toLowerCase());
            }
        }
        box.appendChild(t);
    }

    // ---------- gamepad ----------
    bindGamepad() {
        const pad = this.ejs.gamepad;
        if (!pad || pad.enhanced) return;
        pad.enhanced = true;
        const prevDown = pad.listeners.buttondown;
        const prevUp = pad.listeners.buttonup;
        const prevDisconnect = pad.listeners.disconnected;
        const prevConnect = pad.listeners.connected;
        // Round 33: a notice when a controller connects; a game paused because one disconnected carries on
        pad.listeners.connected = (e) => {
            if (prevConnect) prevConnect(e);
            if (!this.ejs.started || window.EJS_kiosk) return;
            const raw = navigator.getGamepads ? navigator.getGamepads()[e.gamepadIndex] : null;
            const name = raw && raw.id ? raw.id.replace(/\s*\(.*$/, "").replace(/\s+/g, " ").trim().slice(0, 32) : "Controller";
            if (this.pausedForPad && this.ejs.paused) {
                this.pausedForPad = false;
                this.ejs.play();
                this.message("CONTROLLER BACK - RESUMED", "success", 3000);
            } else {
                this.message((name || "CONTROLLER").toUpperCase() + " CONNECTED (PLAYER " + (e.gamepadIndex + 1) + ")", "success", 3000);
            }
        };
        const swallowed = new Set();
        const combos = {
            5: () => this.quickSave(),
            4: () => this.quickLoad(),
            7: () => this.toggleSetting("fastForward", "isFastForward", "FAST FORWARD"),
            6: () => this.changeSlot(1),
            9: () => this.togglePause(),
            12: () => this.toggleSlots(),
            13: () => this.screenshot(),
            14: () => this.changeSlot(-1),
            15: () => this.changeSlot(1),
            10: () => this.setPref("fps", !this.prefs.fps),
            11: () => this.toggleMute()
        };
        const selectHeld = (index) => {
            const record = pad.gamepads.find((p) => p.index === index);
            return !!(record && record.buttons[8] && record.buttons[8].pressed);
        };
        pad.listeners.buttondown = (e) => {
            // While the slot picker is open the controller drives it instead of the game
            if (this.slotsPanel) {
                swallowed.add(e.gamepadIndex + ":" + e.index);
                this.slotsPad(e.index);
                return;
            }
            if (this.pauseMenu && !(e.index === 8)) {
                swallowed.add(e.gamepadIndex + ":" + e.index);
                this.pauseMenuPad(e.index);
                return;
            }
            if (!window.EJS_kiosk && this.prefs.padCombos && this.ejs.started && combos[e.index] && selectHeld(e.gamepadIndex)) {
                swallowed.add(e.gamepadIndex + ":" + e.index);
                combos[e.index]();
                return;
            }
            if (prevDown) prevDown(e);
        };
        pad.listeners.buttonup = (e) => {
            if (swallowed.delete(e.gamepadIndex + ":" + e.index)) return;
            if (prevUp) prevUp(e);
        };
        pad.listeners.disconnected = (e) => {
            if (prevDisconnect) prevDisconnect(e);
            if (this.prefs.autoPause && this.canControl() && !this.ejs.paused) {
                this.ejs.pause();
                this.pausedForPad = true;
                this.message("CONTROLLER DISCONNECTED - PAUSED", "error", 5000);
            }
        };
    }

    // ---------- page lifecycle ----------
    bindVisibility() {
        const onHide = () => {
            this.autoSave();
            // Watching in picture-in-picture (round 34) keeps the game running
            if (window.EJS_pipActive) return;
            if (this.prefs.autoPause && this.canControl() && !this.ejs.paused) {
                this.ejs.pause();
                this.autoPaused = true;
            }
        };
        const onShow = () => {
            if (this.autoPaused && this.ejs.started) this.ejs.play();
            this.autoPaused = false;
            this.requestWakeLock();
        };
        document.addEventListener("visibilitychange", () => (document.hidden ? onHide() : onShow()));
        window.addEventListener("pagehide", () => this.autoSave(true));
    }
    setupSramFlush() {
        const E = this.ejs;
        if (E.config.fixedSaveInterval || E.getSettingValue("save-save-interval") || E.saveFileExt === false) return;
        E.startSaveInterval(30000);
    }
    async requestWakeLock() {
        if (!this.prefs.wakeLock || !("wakeLock" in navigator) || document.hidden || !this.ejs.started) return;
        if (this.wakeLock && !this.wakeLock.released) return;
        try { this.wakeLock = await navigator.wakeLock.request("screen"); } catch (e) { /* not allowed */ }
    }
    setupMediaSession() {
        if (!("mediaSession" in navigator) || typeof MediaMetadata !== "function") return;
        try {
            navigator.mediaSession.metadata = new MediaMetadata({ title: this.base, artist: "EmulatorJS", album: this.ejs.getCore(true) });
            navigator.mediaSession.setActionHandler("play", () => this.canControl() && this.ejs.play());
            navigator.mediaSession.setActionHandler("pause", () => this.canControl() && this.ejs.pause());
        } catch (e) { /* unsupported action */ }
    }
    setupCursorHide() {
        const parent = this.ejs.frontend.elements.parent;
        let timer = null;
        const wake = () => {
            parent.classList.remove("ejs-enh-cursor-hidden");
            clearTimeout(timer);
            if (!this.prefs.cursorHide) return;
            timer = setTimeout(() => {
                if (!this.ejs.paused && !this.panel) parent.classList.add("ejs-enh-cursor-hidden");
            }, Number(this.prefs.cursorDelay) || 2500);
        };
        parent.addEventListener("mousemove", wake);
        parent.addEventListener("mousedown", wake);
        wake();
    }
    applyScanlines() {
        const host = this.ejs.frontend.canvas && this.ejs.frontend.canvas.parentElement;
        if (!host) return;
        let overlay = host.querySelector(".ejs-enh-scanlines");
        if (this.prefs.scanlines && !overlay) {
            overlay = document.createElement("div");
            overlay.className = "ejs-enh-scanlines";
            host.appendChild(overlay);
        } else if (!this.prefs.scanlines && overlay) {
            overlay.remove();
            overlay = null;
        }
        if (overlay) {
            overlay.classList.toggle("light", this.prefs.scanlineStrength === "light");
            overlay.classList.toggle("strong", this.prefs.scanlineStrength === "strong");
        }
    }
    applyFps() {
        if (!this.prefs.fps) {
            if (this.fpsElem) this.fpsElem.remove();
            clearInterval(this.fpsTimer);
            this.fpsElem = null;
            return;
        }
        if (this.fpsElem) return;
        this.fpsElem = document.createElement("div");
        this.fpsElem.className = "ejs-enh-fps";
        this.fpsElem.textContent = "-- fps";
        this.ejs.frontend.elements.parent.appendChild(this.fpsElem);
        let last = this.gm.getFrameNum();
        let lastTime = performance.now();
        this.fpsTimer = this.every(1000, () => {
            const frame = this.gm.getFrameNum();
            const time = performance.now();
            const fps = Math.round((frame - last) * 1000 / (time - lastTime));
            last = frame;
            lastTime = time;
            if (this.fpsElem) {
                const perf = this.ejs.performance;
                const mode = perf && perf.mode ? perf.mode() : "quality";
                this.fpsElem.textContent = (this.ejs.paused ? "paused" : fps + " fps" + (mode !== "quality" ? " · " + mode : ""));
                // Round 34: green at full speed, amber a little under, red well under
                const target = (this.ejs.performance && this.ejs.performance.expectedFps) || 60;
                const ratio = fps / target;
                this.fpsElem.classList.toggle("ok", !this.ejs.paused && ratio >= 0.95);
                this.fpsElem.classList.toggle("warn", !this.ejs.paused && ratio < 0.95 && ratio >= 0.8);
                this.fpsElem.classList.toggle("bad", !this.ejs.paused && ratio < 0.8);
            }
        });
    }
    trackPlaytime() {
        this.every(10000, () => {
            if (!this.ejs.started || this.ejs.paused || document.hidden) return;
            this.sessionSeconds += 10;
            try {
                const all = JSON.parse(localStorage.getItem(PLAYTIME_KEY) || "{}");
                const before = all[this.playKey] || 0;
                all[this.playKey] = before + 10;
                localStorage.setItem(PLAYTIME_KEY, JSON.stringify(all));
                const days = this.playDays();
                days[this.dayKey(0)] = (days[this.dayKey(0)] || 0) + 10;
                for (const d of Object.keys(days)) if (d < this.dayKey(-59)) delete days[d];
                localStorage.setItem(PLAYDAYS_KEY, JSON.stringify(days));
                const passed = MILESTONES.find((m) => before < m && before + 10 >= m);
                if (passed && this.prefs.milestones) this.toast(`You've now played ${this.base} for ${formatDuration(passed)}.`, [["OK", null, true]], 6000);
            } catch (e) { /* storage unavailable */ }
        });
    }
    watchBattery() {
        if (!navigator.getBattery) return;
        navigator.getBattery().then((battery) => {
            const check = () => {
                if (!battery.charging && battery.level <= 0.15 && !this.batteryWarned) {
                    this.batteryWarned = true;
                    this.autoSave(true);
                    this.message("BATTERY LOW - RESUME POINT SAVED", "error", 6000);
                }
            };
            battery.addEventListener("levelchange", check);
            battery.addEventListener("chargingchange", check);
            check();
        }).catch(() => {});
    }
    rotateHint() {
        const E = this.ejs;
        if (!(E.isMobile || E.hasTouchScreen) || E.getCore(true) === "nds") return;
        // The site's phone view has its own portrait layout (game on top, controls below), so no hint is needed there
        if (document.documentElement.classList.contains("m-phone")) return;
        if (window.innerHeight > window.innerWidth && !sessionStorage.getItem("ejs-rotate-hint")) {
            sessionStorage.setItem("ejs-rotate-hint", "1");
            this.message("ROTATE YOUR DEVICE FOR A BIGGER PICTURE", undefined, 5000);
        }
    }
    // ---------- round 33: session helpers ----------
    setupPeriodicSave() {
        this.every(300000, () => {
            if (this.prefs.periodicSave && this.ejs.started && !this.ejs.paused && !document.hidden) this.autoSave("periodic");
        });
    }
    setupFocusPause() {
        this.onBlur = () => {
            if (!this.prefs.focusPause || !this.canControl() || this.ejs.paused || document.hidden) return;
            // The game frame itself taking the focus is not leaving the window
            setTimeout(() => {
                if (document.hasFocus() || this.ejs.paused) return;
                this.ejs.pause();
                this.pausedForFocus = true;
                this.message("PAUSED (WINDOW NOT IN FOCUS)");
            }, 50);
        };
        this.onFocus = () => {
            if (this.pausedForFocus && this.ejs.paused) this.ejs.play();
            this.pausedForFocus = false;
        };
        window.addEventListener("blur", this.onBlur);
        window.addEventListener("focus", this.onFocus);
    }
    applyTouchPrefs() {
        const parent = this.ejs.frontend.elements.parent;
        if (!parent) return;
        parent.style.setProperty("--ejs-pad-opacity", String(this.prefs.padOpacity || 1));
        parent.classList.toggle("ejs-pad-small", this.prefs.padSize === "small");
        parent.classList.toggle("ejs-pad-large", this.prefs.padSize === "large");
    }
    setupHaptics() {
        const pad = this.ejs.frontend.virtualGamepad;
        if (!pad || !navigator.vibrate) return;
        pad.addEventListener("touchstart", () => {
            if (this.prefs.haptics) try { navigator.vibrate(8); } catch (e) { /* not allowed */ }
        }, { passive: true, capture: true });
    }
    setupLandscapeLock() {
        const E = this.ejs;
        if (!(E.isMobile || E.hasTouchScreen) || E.getCore(true) === "nds") return;
        this.onFullscreen = () => {
            const full = document.fullscreenElement || document.webkitFullscreenElement;
            const o = screen.orientation;
            if (!o || !o.lock) return;
            if (full && this.prefs.landscapeLock) o.lock("landscape").catch(() => {});
            else if (!full && o.unlock) try { o.unlock(); } catch (e) { /* not locked */ }
        };
        document.addEventListener("fullscreenchange", this.onFullscreen);
    }
    /** The tab shows the game, its system and a pause sign while paused. */
    setupTitle() {
        const site = (window.EJS_SITE && window.EJS_SITE.name) || "EmulatorJS";
        const system = String(this.ejs.getCore(true) || "").toUpperCase();
        const update = () => {
            document.title = (this.ejs.paused ? "⏸ " : "") + this.base + (system ? " · " + system : "") + " – " + site;
        };
        this.ejs.on("pause", update);
        this.ejs.on("play", update);
        update();
    }
    setupBreaks() {
        this.every(30000, () => {
            const minutes = Number(this.prefs.breakMinutes) || 0;
            if (!minutes || window.EJS_kiosk) return;
            if (!this.nextBreakAt) this.nextBreakAt = this.sessionSeconds + minutes * 60;
            if (this.sessionSeconds < this.nextBreakAt || this.ejs.paused) return;
            this.nextBreakAt = this.sessionSeconds + minutes * 60;
            this.toast(`You have been playing for ${formatDuration(this.sessionSeconds)}. Time for a short break?`, [
                ["Pause now", () => { if (!this.ejs.paused) this.togglePause(); }],
                ["Keep playing", null, true]
            ], 20000);
        });
    }
    setSleepTimer(minutes) {
        clearTimeout(this.sleepTimer);
        this.sleepMinutes = minutes || 0;
        this.sleepAt = minutes ? Date.now() + minutes * 60000 : null;
        if (!minutes) return this.message("SLEEP TIMER OFF");
        this.message("SLEEP TIMER: PAUSES IN " + minutes + " MIN");
        this.sleepTimer = setTimeout(() => {
            this.sleepMinutes = 0;
            this.sleepAt = null;
            this.autoSave(true);
            if (!this.ejs.paused && this.canControl()) this.ejs.pause();
            this.toast("Sleep timer: the game is paused and your place is saved.", [["OK", null, true]], 600000);
        }, minutes * 60000);
    }
    /** The lock screen and the system media controls show a picture of the game. */
    setupArtwork() {
        if (!("mediaSession" in navigator) || typeof MediaMetadata !== "function") return;
        setTimeout(() => {
            if (!this.ejs.started || this.ejs.paused) return;
            this.grabFrame().then((blob) => {
                if (!blob) return;
                const url = URL.createObjectURL(blob);
                createImageBitmap(blob).then((b) => {
                    try {
                        navigator.mediaSession.metadata = new MediaMetadata({ title: this.base, artist: "EmulatorJS", album: this.ejs.getCore(true), artwork: [{ src: url, sizes: b.width + "x" + b.height, type: blob.type || "image/png" }] });
                    } catch (e) { /* unsupported */ }
                }).catch(() => {});
            });
        }, 15000);
    }
    // ---------- round 34: helpers ----------
    /** Launch round: "Install and downloads" settings section (install this site as an app, get the desktop/phone apps, offline copy, guide, about). */
    renderInstall(box) {
        const note = document.createElement("p");
        note.className = "ejs-enh-muted";
        note.textContent = "Loading…";
        box.appendChild(note);
        const row = (text, fn, title) => {
            const b = document.createElement("button");
            b.type = "button";
            b.className = "secondary";
            b.textContent = text;
            if (title) b.title = title;
            b.addEventListener("click", fn);
            box.appendChild(b);
            return b;
        };
        const go = (url) => window.open(url, "_blank", "noopener");
        import(new URL("assets/download.js", document.baseURI).href).then((dl) => {
            const here = dl.detectPlatform();
            note.textContent = dl.isInstalled() ? "You are using the installed app." : "Playing in " + dl.PLATFORM_NAMES[here] + (here === "ios" ? ". Use Share, then Add to Home Screen." : ".");
            if (!dl.isInstalled() && dl.canPromptInstall()) row("Install on this device", async () => { await dl.promptInstall(); }, "Adds EmulatorJS to your apps");
            window.addEventListener("ejs-installable", () => { if (!dl.isInstalled() && !box.querySelector("[data-install]")) { const b = row("Install on this device", () => dl.promptInstall(), "Adds EmulatorJS to your apps"); b.dataset.install = "1"; } }, { once: true });
        }).catch(() => { note.textContent = "Downloads are on the Get the app page."; });
        row("Get the app (Windows, Mac, Linux, Android, iPhone)", () => go("download.html"), "Download pages for every device");
        row("Download an offline copy of the site", () => go("download.html#dl-other"), "The whole site as a zip");
        row("Player guide (PDF)", () => go("guide/EmulatorJS-Player-Guide.pdf"));
        row("What's new", () => go("whats-new.html"));
        row("About, version and licences", () => go("about.html"));
        row("Report a problem…", () => this.reportProblem(), "Opens a pre-filled issue with your browser details (no game data)");
    }

    /** Opens the project's issue page with browser details filled in; never includes game files or saves. */
    reportProblem() {
        const info = [
            "Browser: " + navigator.userAgent,
            "Page: " + location.pathname.split("/").pop(),
            "Core: " + (this.ejs && this.ejs.getCore ? this.ejs.getCore() : "?"),
            "Threads: " + (typeof SharedArrayBuffer === "function" ? "available" : "not available"),
            "Installed app: " + (window.matchMedia("(display-mode: standalone)").matches ? "yes" : "no")
        ].join("\n");
        const m = location.hostname.match(/^([^.]+)\.github\.io$/);
        const repo = m ? m[1] + "/" + (location.pathname.split("/").filter(Boolean)[0] || m[1] + ".github.io") : "";
        const url = repo ? `https://github.com/${repo}/issues/new?title=${encodeURIComponent("Problem: ")}&body=${encodeURIComponent("What happened:\n\n\nDetails (no game data):\n" + info)}` : "support.html";
        window.open(url, "_blank", "noopener");
    }

    renderControllers(box) {
        const pads = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : [];
        const p = document.createElement("p");
        p.className = "meta";
        p.textContent = pads.length
            ? "Controllers: " + pads.map((g) => `player ${g.index + 1}: ${g.id.replace(/\s*\(.*$/, "").slice(0, 32)}`).join("; ")
            : "No controller connected. Plug one in or press a button on it to wake it up.";
        box.appendChild(p);
        if (!pads.length) return;
        // Round 35: shows what the controller sends right now (to check buttons and sticks), and tests rumble
        const live = document.createElement("p");
        live.className = "meta ejs-enh-padlive";
        live.textContent = "Press a button on the controller to see it here.";
        box.appendChild(live);
        const timer = setInterval(() => {
            if (!live.isConnected) { clearInterval(timer); return; }
            const now = [...navigator.getGamepads()].filter(Boolean);
            live.textContent = now.map((g) => {
                const down = g.buttons.map((b, i) => (b.pressed ? i : null)).filter((i) => i !== null);
                const sticks = [0, 1, 2, 3].filter((i) => Math.abs(g.axes[i] || 0) > 0.25).map((i) => "axis " + i + " " + g.axes[i].toFixed(2));
                return `Player ${g.index + 1}: ` + (down.length || sticks.length ? ["buttons " + (down.join(", ") || "none")].concat(sticks).join("; ") : "nothing pressed");
            }).join(" · ");
        }, 150);
        if (pads.some((g) => g.vibrationActuator && g.vibrationActuator.playEffect)) {
            const b = document.createElement("button");
            b.type = "button";
            b.className = "secondary";
            b.textContent = "Test vibration";
            b.addEventListener("click", () => {
                for (const g of navigator.getGamepads()) {
                    if (g && g.vibrationActuator && g.vibrationActuator.playEffect) g.vibrationActuator.playEffect("dual-rumble", { duration: 400, strongMagnitude: 0.8, weakMagnitude: 0.5 }).catch(() => {});
                }
            });
            box.appendChild(b);
        }
    }
    openGameSettings() {
        if (this.panel) this.togglePanel();
        const front = this.ejs.frontend;
        if (front.openSettingsMenu) front.openSettingsMenu();
    }
    // Screenshot gallery: the last 24 pictures of each game, in IndexedDB "EJS-screenshots"
    shotDb() {
        if (!this.shotDbPromise) {
            this.shotDbPromise = new Promise((resolve, reject) => {
                const r = indexedDB.open(SHOT_DB, 1);
                r.onupgradeneeded = () => r.result.createObjectStore("shots", { keyPath: "id", autoIncrement: true }).createIndex("game", "game");
                r.onsuccess = () => resolve(r.result);
                r.onerror = () => reject(r.error);
            });
        }
        return this.shotDbPromise;
    }
    async shotTx(mode, fn) {
        const db = await this.shotDb();
        return new Promise((resolve, reject) => {
            const t = db.transaction("shots", mode);
            const req = fn(t.objectStore("shots"));
            t.oncomplete = () => resolve(req && req.result);
            t.onerror = () => reject(t.error);
        });
    }
    async listShots() {
        return ((await this.shotTx("readonly", (s) => s.index("game").getAll(this.base))) || []).sort((a, b) => b.at - a.at);
    }
    async keepShot(blob) {
        try {
            await this.shotTx("readwrite", (s) => s.add({ game: this.base, at: Date.now(), blob }));
            const all = await this.listShots();
            for (const old of all.slice(24)) await this.shotTx("readwrite", (s) => s.delete(old.id));
        } catch (e) { /* storage unavailable */ }
    }
    async openGallery() {
        if (!this.panel) this.togglePanel();
        const box = this.panel.firstChild;
        let host = box.querySelector(".ejs-enh-gallery-wrap");
        if (host) { host.remove(); return; }
        host = document.createElement("div");
        host.className = "ejs-enh-gallery-wrap";
        const h = document.createElement("h3");
        h.textContent = "Screenshots of this game";
        const lightbox = (url) => {
            const box2 = document.createElement("div");
            box2.className = "ejs-enh-lightbox";
            const big = document.createElement("img");
            big.src = url;
            big.alt = "Screenshot";
            box2.appendChild(big);
            const close2 = () => { box2.remove(); this.lightboxClose = null; };
            box2.addEventListener("click", close2);
            this.lightboxClose = close2;
            this.ejs.frontend.elements.parent.appendChild(box2);
        };
        h.style.fontSize = "14px";
        const grid = document.createElement("div");
        grid.className = "ejs-enh-gallery";
        host.append(h, grid);
        // Below the row with the Screenshots button
        const row = [...box.querySelectorAll("button")].find((b) => /^Screenshots/.test(b.textContent));
        const anchor = row && row.parentElement !== box ? row.parentElement : null;
        if (anchor) anchor.after(host);
        else box.insertBefore(host, box.children[4] || null);
        const urls = [];
        const shots = await this.listShots().catch(() => []);
        if (!shots.length) grid.textContent = "No screenshots yet: press F8 while playing.";
        else h.textContent += " (" + shots.length + ")";
        for (const shot of shots) {
            const fig = document.createElement("figure");
            const img = document.createElement("img");
            const url = URL.createObjectURL(shot.blob);
            urls.push(url);
            img.src = url;
            img.alt = "Screenshot from " + new Date(shot.at).toLocaleString();
            img.style.cursor = "zoom-in";
            img.addEventListener("click", () => lightbox(url));
            const cap = document.createElement("figcaption");
            cap.append(new Date(shot.at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }));
            const act = (label, fn) => {
                const b = document.createElement("button");
                b.type = "button";
                b.className = "secondary";
                b.textContent = label;
                b.addEventListener("click", fn);
                cap.appendChild(b);
            };
            act("Save", () => {
                const a = document.createElement("a");
                a.href = url;
                a.download = this.base + "-" + new Date(shot.at).toISOString().replace(/[:.]/g, "-") + "." + ((shot.blob.type || "image/png").split("/")[1] || "png");
                a.click();
            });
            if (navigator.clipboard && window.ClipboardItem) act("Copy", () => this.copyImage(shot.blob));
            act("Delete", async () => { await this.shotTx("readwrite", (s) => s.delete(shot.id)); fig.remove(); });
            fig.append(img, cap);
            grid.appendChild(fig);
        }
        if (shots.length > 1) {
            const all = document.createElement("button");
            all.type = "button";
            all.className = "secondary";
            all.textContent = "Delete all";
            let armed = false;
            all.addEventListener("click", async () => {
                if (!armed) {
                    armed = true;
                    all.textContent = "Really delete all " + shots.length + "?";
                    setTimeout(() => { armed = false; all.textContent = "Delete all"; }, 4000);
                    return;
                }
                for (const shot of shots) await this.shotTx("readwrite", (st) => st.delete(shot.id));
                grid.textContent = "No screenshots yet: press F8 while playing.";
                all.remove();
            });
            host.appendChild(all);
        }
        const observer = new MutationObserver(() => {
            if (!host.isConnected) { urls.forEach((u) => URL.revokeObjectURL(u)); observer.disconnect(); }
        });
        observer.observe(this.ejs.frontend.elements.parent, { childList: true, subtree: true });
        host.scrollIntoView({ block: "nearest" });
    }
    setupSaveReminder() {
        this.every(60000, () => {
            if (!this.prefs.saveReminder || window.EJS_kiosk || this.ejs.paused || !this.canControl()) return;
            if (this.sessionSeconds - (this.lastSaveSession || 0) < 1800) return;
            if (this.remindedAt && this.sessionSeconds - this.remindedAt < 1800) return;
            this.remindedAt = this.sessionSeconds;
            this.toast(`No save for ${formatDuration(this.sessionSeconds - (this.lastSaveSession || 0))}. Save your progress?`, [
                ["Quick save (F2)", () => this.quickSave()],
                ["Later", null, true]
            ], 15000);
        });
    }
    setupLeaveConfirm() {
        this.onBeforeUnload = (e) => {
            if (!this.prefs.confirmLeave || !this.ejs.started || window.EJS_kiosk) return;
            this.autoSave(true);
            e.preventDefault();
            e.returnValue = "";
        };
        window.addEventListener("beforeunload", this.onBeforeUnload);
    }
    /** A save state file dropped on the game is loaded straight away (with Undo). */
    setupStateDrop() {
        const parent = this.ejs.frontend.elements.parent;
        const isState = (file) => file && /\.(state|st\d?|ss\d?)$/i.test(file.name);
        parent.addEventListener("dragover", (e) => {
            const items = e.dataTransfer && e.dataTransfer.items;
            if (items && items.length && items[0].kind === "file") e.preventDefault();
        });
        parent.addEventListener("drop", async (e) => {
            const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
            if (!isState(file) || !this.canControl()) return;
            e.preventDefault();
            e.stopPropagation();
            const data = new Uint8Array(await file.arrayBuffer());
            try { this.undoState = this.gm.getState(); } catch (err) { this.undoState = null; }
            this.gm.loadState(data);
            this.message("LOADED " + file.name.toUpperCase(), "success");
            if (this.undoState) this.toast("Loaded the save state " + file.name + ".", [["Undo", () => this.undoLoad(), true]], 7000);
        });
    }
    /** Loading a state that cannot be read is reported instead of failing silently. */
    wrapLoadState() {
        const gm = this.gm;
        if (gm.loadStateChecked) return;
        gm.loadStateChecked = true;
        const original = gm.loadState.bind(gm);
        gm.loadState = (state) => {
            if (!state || !state.length) {
                this.message("THAT SAVE STATE IS EMPTY", "error");
                return;
            }
            try {
                return original(state);
            } catch (e) {
                this.message("THAT SAVE STATE COULD NOT BE LOADED (ANOTHER CORE OR VERSION?)", "error", 6000);
            }
        };
    }
    applyInputDisplay() {
        const parent = this.ejs.frontend.elements.parent;
        if (this.inputElem) { this.inputElem.remove(); this.inputElem = null; }
        if (!this.prefs.inputDisplay || !parent) return;
        const el = document.createElement("div");
        el.className = "ejs-enh-input";
        el.setAttribute("aria-hidden", "true");
        // D-pad on a 3 × 3 grid, then the face and shoulder buttons
        const cells = [null, [4, "▲"], null, [6, "◀"], null, [7, "▶"], null, [5, "▼"], null];
        this.inputCells = {};
        for (const c of cells) {
            const i = document.createElement("i");
            if (c) { i.textContent = c[1]; this.inputCells[c[0]] = i; } else i.style.visibility = "hidden";
            el.appendChild(i);
        }
        const btns = document.createElement("div");
        btns.className = "btns";
        const scheme = this.ejs.getControlScheme ? this.ejs.getControlScheme() : this.ejs.getCore(true);
        const names = (BUTTON_NAMES[scheme] || BUTTON_NAMES.default).filter(([id]) => id < 4 || id > 7);
        for (const [id, label] of names) {
            const i = document.createElement("i");
            i.textContent = label.length > 2 ? label.slice(0, 3) : label;
            this.inputCells[id] = i;
            btns.appendChild(i);
        }
        el.appendChild(btns);
        parent.appendChild(el);
        this.inputElem = el;
        // Watch inputs player 1 sends, whatever their source (keys, controller, touch)
        const gm = this.gm;
        if (!gm.inputDisplayWrapped) {
            gm.inputDisplayWrapped = true;
            const original = gm.simulateInput.bind(gm);
            gm.simulateInput = (player, index, value) => {
                if (player === 0 && this.inputCells && this.inputCells[index]) this.inputCells[index].classList.toggle("on", !!value);
                return original(player, index, value);
            };
        }
    }
    /** Each game keeps its own volume. */
    setupGameVolume() {
        const E = this.ejs;
        const read = () => { try { return JSON.parse(localStorage.getItem("ejs-game-volume") || "{}"); } catch (e) { return {}; } };
        const saved = read()[this.playKey];
        if (this.prefs.gameVolume && saved && typeof saved.volume === "number" && !window.EJS_kiosk) {
            E.volume = saved.volume;
            E.muted = !!saved.muted;
            E.setVolume(E.muted ? 0 : E.volume);
        }
        const original = E.setVolume.bind(E);
        E.setVolume = (v) => {
            original(v);
            v = Math.min(1, Math.max(0, Number(v) || 0));
            if (!this.prefs.gameVolume || window.EJS_kiosk) return;
            clearTimeout(this.volumeTimer);
            this.volumeTimer = setTimeout(() => {
                const all = read();
                all[this.playKey] = v > 0 ? { volume: v, muted: false } : { volume: E.volume || 0.5, muted: true };
                const keys = Object.keys(all);
                if (keys.length > 200) delete all[keys[0]];
                try { localStorage.setItem("ejs-game-volume", JSON.stringify(all)); } catch (e) { /* storage full */ }
            }, 300);
        };
    }
    /** Browsers keep sound off until the page is touched: say so, with a button that turns it on. */
    watchSoundBlocked() {
        setTimeout(() => {
            const perf = this.ejs.performance;
            const ctx = perf && perf.audioContext ? perf.audioContext() : null;
            if (!ctx || ctx.state !== "suspended" || this.ejs.paused || document.hidden || (perf && perf.audioSuspended) || this.ejs.muted || window.EJS_kiosk) return;
            const close = this.toast("Sound is off until you tap or press a key (a browser rule).", [
                ["Turn sound on", () => ctx.resume().catch(() => {})],
                ["OK", null, true]
            ], 15000);
            const done = () => { if (ctx.state === "running") close(); };
            ctx.addEventListener && ctx.addEventListener("statechange", done);
        }, 2500);
    }
    /** On-screen messages are also read out by screen readers. */
    setupAnnouncer() {
        const front = this.ejs.frontend;
        const live = document.createElement("div");
        live.className = "ejs-enh-sr";
        live.setAttribute("aria-live", "polite");
        live.setAttribute("role", "status");
        front.elements.parent.appendChild(live);
        if (front.displayMessageAnnounced) return;
        front.displayMessageAnnounced = true;
        const original = front.displayMessage.bind(front);
        front.displayMessage = (text, ...rest) => {
            live.textContent = "";
            setTimeout(() => { live.textContent = String(text || "").toLowerCase(); }, 30);
            return original(text, ...rest);
        };
    }
    /** The core stopped (round 34): the place saved last is kept, so a reload brings the player back to it. */
    onCoreCrash(what) {
        if (this.crashShown) return;
        this.crashShown = true;
        this.toast("The emulator stopped working (" + String(what).slice(0, 80) + "). Reloading brings you back to your last resume point.", [
            ["Reload", () => location.reload()],
            ["Copy details", () => navigator.clipboard.writeText(["Core stopped: " + what, "Page: " + location.href, "Core: " + this.ejs.getCore(), "Browser: " + navigator.userAgent].join("\n")).catch(() => {})],
            ["Dismiss", null, true]
        ], 600000);
    }
    /** An error in the emulator's code is reported once, so a game that misbehaves has an explanation and a way out. */
    setupErrorWatch() {
        const report = (message, file, line) => {
            if (this.errorShown || !this.ejs.started) return;
            if (!/\/data\//.test(file) || /ResizeObserver/.test(String(message))) return;
            this.errorShown = true;
            this.toast("Something went wrong in the emulator. If the game misbehaves, reload: your place is kept.", [
                ["Reload", () => { this.autoSave(true); setTimeout(() => location.reload(), 300); }],
                ["Copy details", () => navigator.clipboard.writeText([String(message), file + ":" + line, "Page: " + location.href, "Browser: " + navigator.userAgent].join("\n")).catch(() => {})],
                ["Dismiss", null, true]
            ], 30000);
        };
        this.onWindowError = (e) => report(e.message, String(e.filename || ""), e.lineno);
        // Round 35: a failed promise inside the emulator's own code is reported the same way
        this.onRejection = (e) => {
            const reason = e.reason || {};
            report(reason.message || String(reason), String(reason.stack || ""), 0);
        };
        window.addEventListener("error", this.onWindowError);
        window.addEventListener("unhandledrejection", this.onRejection);
    }
    /** Double-click the picture for full screen (not for games played with the mouse). */
    setupDoubleClick() {
        const canvas = this.ejs.frontend.canvas;
        if (!canvas) return;
        canvas.addEventListener("dblclick", (e) => {
            if (this.ejs.defaultCoreOpts && this.ejs.defaultCoreOpts.supportsMouse) return;
            e.preventDefault();
            this.ejs.toggleFullscreen(!(document.fullscreenElement || document.webkitFullscreenElement));
        });
    }
    /** A game that finished loading in a background tab says so in the tab title until the tab is opened. */
    readyTitle() {
        if (!document.hidden) return;
        const clean = document.title;
        document.title = "● Ready – " + clean;
        const back = () => {
            if (document.hidden) return;
            if (document.title.startsWith("● Ready – ")) document.title = document.title.slice("● Ready – ".length);
            document.removeEventListener("visibilitychange", back);
        };
        document.addEventListener("visibilitychange", back);
    }
    // ---------- round 35 ----------
    dayKey(offset) {
        const d = new Date(Date.now() + offset * 86400000);
        return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    }
    playDays() {
        try { return JSON.parse(localStorage.getItem(PLAYDAYS_KEY) || "{}") || {}; } catch (e) { return {}; }
    }
    /** Picture settings belong to the game: the last values used here come back next time. */
    loadGamePicture() {
        try {
            const mine = (JSON.parse(localStorage.getItem(PICTURE_GAMES_KEY) || "{}") || {})[this.playKey];
            if (mine) for (const k of PICTURE_KEYS) if (k in mine) this.prefs[k] = mine[k];
        } catch (e) { /* storage unavailable */ }
    }
    saveGamePicture() {
        try {
            const all = JSON.parse(localStorage.getItem(PICTURE_GAMES_KEY) || "{}") || {};
            all[this.playKey] = Object.fromEntries(PICTURE_KEYS.map((k) => [k, this.prefs[k]]));
            const keys = Object.keys(all);
            if (keys.length > 200) delete all[keys[0]];
            localStorage.setItem(PICTURE_GAMES_KEY, JSON.stringify(all));
        } catch (e) { /* storage unavailable */ }
    }
    clearGamePicture() {
        try {
            const all = JSON.parse(localStorage.getItem(PICTURE_GAMES_KEY) || "{}") || {};
            delete all[this.playKey];
            localStorage.setItem(PICTURE_GAMES_KEY, JSON.stringify(all));
        } catch (e) { /* storage unavailable */ }
    }
    applyUiPrefs() {
        const parent = this.ejs.frontend.elements.parent;
        if (!parent) return;
        parent.style.setProperty("--ejs-enh-scale", String(this.prefs.uiScale || 1));
        parent.classList.toggle("ejs-enh-contrast", !!this.prefs.highContrast);
    }
    /** Small badges for the things that change how the game runs: fast forward, slow motion, mute, recording. */
    applyBadges() {
        const parent = this.ejs.frontend.elements.parent;
        if (!this.prefs.statusBadges || window.EJS_kiosk) {
            if (this.badgeElem) this.badgeElem.remove();
            this.badgeElem = null;
            clearInterval(this.badgeTimer);
            return;
        }
        if (this.badgeElem) return;
        const el = document.createElement("div");
        el.className = "ejs-enh-badges";
        el.setAttribute("aria-hidden", "true");
        parent.appendChild(el);
        this.badgeElem = el;
        const E = this.ejs;
        const update = () => {
            const items = [];
            if (E.isFastForward) {
                const r = E.getSettingValue("ff-ratio");
                items.push(["ff", "▶▶ " + (r === "unlimited" ? "MAX" : "×" + parseFloat(r || 3))]);
            }
            if (E.isSlowMotion) items.push(["slow", "◀ 1/" + parseFloat(E.getSettingValue("sm-ratio") || 3)]);
            if (E.muted || E.volume === 0) items.push(["muted", "MUTED"]);
            if (E.isRecording) items.push(["rec", "● REC"]);
            const key = items.map((i) => i.join(":")).join("|");
            if (key === this.badgeKey) return;
            this.badgeKey = key;
            el.textContent = "";
            for (const [cls, text] of items) {
                const span = document.createElement("span");
                span.className = cls;
                span.textContent = text;
                el.appendChild(span);
            }
        };
        this.badgeTimer = this.every(400, update);
        update();
    }
    cycleShape() {
        const perf = this.ejs.performance;
        if (!perf || !this.canControl()) return;
        const at = SHAPES.findIndex(([v]) => v === (perf.profile.aspect || "auto"));
        const next = SHAPES[(at + 1) % SHAPES.length];
        perf.set("aspect", next[0]);
        this.message("PICTURE: " + next[1]);
    }
    showHotkeys() {
        if (this.panel) return;
        this.togglePanel();
        const d = this.panel && [...this.panel.querySelectorAll("details")].find((x) => /^Hotkeys/.test(x.querySelector("summary").textContent));
        if (d) { d.open = true; d.scrollIntoView({ block: "start" }); }
    }
    setupConnectionNotices() {
        if (window.EJS_kiosk) return;
        this.onOffline = () => {
            if (this.prefs.connectionNotices) this.toast("You're offline. The game keeps working, and saves stay on this device.", [["OK", null, true]], 6000);
        };
        this.onOnline = () => {
            if (this.prefs.connectionNotices) this.toast("Back online.", [["OK", null, true]], 3000);
        };
        window.addEventListener("offline", this.onOffline);
        window.addEventListener("online", this.onOnline);
    }
    storageFailed() {
        if (this.storageFailedShown) return;
        this.storageFailedShown = true;
        this.toast("Your place could not be saved: this browser's storage is full or blocked. Free some space, or download a save from Save slots.", [
            ["Save slots", () => this.toggleSlots()],
            ["OK", null, true]
        ], 20000);
    }
    exportOptions() {
        const data = { ejsOptions: 1, saved: new Date().toISOString(), prefs: this.prefs };
        const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
        const a = document.createElement("a");
        a.href = url;
        a.download = "ejs-options.json";
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        this.message("OPTIONS EXPORTED", "success");
    }
    importOptions() {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".json,application/json";
        input.addEventListener("change", async () => {
            try {
                const data = JSON.parse(await input.files[0].text());
                if (!data || !data.prefs || typeof data.prefs !== "object") throw new Error("not an options file");
                let n = 0;
                for (const [k, v] of Object.entries(data.prefs)) {
                    if (k in DEFAULT_PREFS && k !== "panelOpen" && typeof v === typeof DEFAULT_PREFS[k]) { this.prefs[k] = v; n++; }
                }
                this.savePrefs();
                this.applyFps(); this.applyScanlines(); this.applyTouchPrefs(); this.applyPicture(); this.applyInputDisplay(); this.applyUiPrefs(); this.applyBadges();
                this.saveGamePicture();
                this.togglePanel();
                this.togglePanel();
                this.message("IMPORTED " + n + " OPTIONS", "success");
            } catch (e) {
                this.message("THAT FILE IS NOT AN OPTIONS FILE", "error", 5000);
            }
        });
        input.click();
    }
    watchContextLoss() {
        const canvas = this.ejs.frontend.canvas;
        canvas.addEventListener("webglcontextlost", (e) => {
            e.preventDefault();
            this.toast("The browser reset the graphics. Reload to continue (your resume point is kept).", [
                ["Reload", () => location.reload()]
            ], 600000);
        });
    }
}

export { EJS_Enhancements };
