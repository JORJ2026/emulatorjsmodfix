// Final polish shared by every page: accessibility fixes, small conveniences and warnings that help first-time visitors.
// It only adds things; each part is wrapped so one failure cannot stop the others.
(function () {
    "use strict";
    var d = document, isPlay = d.body && d.body.classList.contains("play");
    var page = (location.pathname.split("/").pop() || "index.html");
    var attempt = function (fn) { try { fn(); } catch (e) { /* polish must never break a page */ } };
    var el = function (tag, cls, text) { var e = d.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; };
    var note = function (text, ms) { var n = el("div", "ejs-note", text); n.setAttribute("role", "status"); d.body.appendChild(n); setTimeout(function () { n.remove(); }, ms || 4000); };

    // 1. Skip link and main landmark
    attempt(function () {
        var main = d.querySelector("main") || d.querySelector("#menu, #startPage, .dl-page");
        if (!main || d.querySelector(".ejs-skip, a[href='#main-content'], a.skip-link")) return;
        if (!main.id) main.id = "main-content";
        main.setAttribute("tabindex", "-1");
        var a = el("a", "ejs-skip", "Skip to content"); a.href = "#" + main.id; d.body.insertBefore(a, d.body.firstChild);
    });

    // 2. Links that open a new tab get rel=noopener; images get lazy loading and an alt attribute; icon-only buttons get a name
    attempt(function () {
        d.querySelectorAll("a[target=_blank]").forEach(function (a) { var r = (a.getAttribute("rel") || ""); if (!/noopener/.test(r)) a.setAttribute("rel", (r + " noopener noreferrer").trim()); });
        d.querySelectorAll("img").forEach(function (i) {
            if (!i.hasAttribute("alt")) i.setAttribute("alt", "");
            if (!isPlay && !i.hasAttribute("loading") && !i.closest("header, .start-head, .dl-hero")) i.setAttribute("loading", "lazy");
            if (!i.hasAttribute("decoding")) i.setAttribute("decoding", "async");
            if (/homebrew\/[^/]+\/screenshot/.test(i.getAttribute("src") || "")) i.classList.add("pixel");
        });
        d.querySelectorAll("button").forEach(function (b) { if (!b.getAttribute("aria-label") && b.title && !/[A-Za-z]{3}/.test(b.textContent)) b.setAttribute("aria-label", b.title); });
    });

    // 3. Current page in link lists
    attempt(function () {
        d.querySelectorAll("a[href]").forEach(function (a) {
            var h = a.getAttribute("href"); if (/^(https?:|#|mailto:)/.test(h)) return;
            if (h.split("?")[0].split("#")[0] === page && (a.closest("nav, .link-list, .start-footer") || a.classList.contains("tab"))) a.setAttribute("aria-current", "page");
        });
    });

    // 4. Warm up pages the visitor is about to open (skipped on data saver and slow links)
    attempt(function () {
        var c = navigator.connection; if (c && (c.saveData || /2g/.test(c.effectiveType || ""))) return;
        var done = {};
        d.addEventListener("pointerover", function (e) {
            var a = e.target.closest && e.target.closest("a[href]"); if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
            var u = new URL(a.href, location.href); if (u.origin !== location.origin || !/\.html$/.test(u.pathname) || done[u.pathname] || u.pathname.indexOf("play.html") >= 0) return;
            done[u.pathname] = 1; var l = el("link"); l.rel = "prefetch"; l.href = u.pathname; d.head.appendChild(l);
        }, { passive: true });
    });

    // 5. Online / offline status
    attempt(function () {
        var set = function (first) {
            d.documentElement.classList.toggle("ejs-offline", !navigator.onLine);
            if (!first) note(navigator.onLine ? "Back online." : "You are offline. Pages and games you have used still work.", 3500);
        };
        window.addEventListener("online", function () { set(false); }); window.addEventListener("offline", function () { set(false); }); set(true);
    });

    // 6. "/" jumps to the search box; back-to-top button on long pages; scroll position is remembered
    attempt(function () {
        if (isPlay) return;
        d.addEventListener("keydown", function (e) {
            if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
            var t = e.target; if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || (t && t.isContentEditable)) return;
            var s = d.querySelector("input[type=search], input[id*=earch], input[placeholder*=earch]"); if (s) { e.preventDefault(); s.focus(); s.select(); }
        });
        var btn = el("button", "ejs-top", "↑"); btn.type = "button"; btn.title = "Back to top"; btn.setAttribute("aria-label", "Back to top"); btn.hidden = true;
        btn.addEventListener("click", function () { window.scrollTo({ top: 0, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }); });
        d.body.appendChild(btn);
        window.addEventListener("scroll", function () { btn.hidden = window.scrollY < window.innerHeight * 1.2; }, { passive: true });
        var key = "ejs-scroll-" + page;
        try { var y = parseInt(sessionStorage.getItem(key) || "0", 10); if (y > 0 && !location.hash) setTimeout(function () { window.scrollTo(0, y); }, 250); } catch (e) { /* ignore */ }
        window.addEventListener("pagehide", function () { try { sessionStorage.setItem(key, String(window.scrollY | 0)); } catch (e) { /* ignore */ } });
    });

    // 7. Warnings: opened from disk, browser too old, storage nearly full
    attempt(function () {
        var bar = function (html) { var b = el("div", "ejs-warnbar"); b.setAttribute("role", "alert"); b.innerHTML = html; d.body.insertBefore(b, d.body.firstChild); };
        if (location.protocol === "file:") bar("This page was opened straight from a folder, so games cannot start. Double-click <b>start-windows.bat</b> or run <b>python3 serve.py</b>, then open <b>http://localhost:8000</b>. (See START-HERE.txt)");
        else if (typeof WebAssembly !== "object" || typeof BigInt !== "function") bar("This browser is too old to run the emulators. Please update Chrome, Edge, Firefox or Safari.");
        if (isPlay || !navigator.storage || !navigator.storage.estimate) return;
        navigator.storage.estimate().then(function (e) {
            if (!e.quota || e.usage / e.quota < 0.9) return;
            var k = "ejs-storage-warned"; try { if (sessionStorage.getItem(k)) return; sessionStorage.setItem(k, "1"); } catch (x) { /* ignore */ }
            bar("This browser is almost out of storage for the site. Export what you want to keep, then clear old saves or screenshots.");
        }).catch(function () { /* ignore */ });
    });

    // 8. Footer with version and legal links on information pages
    attempt(function () {
        if (isPlay || d.querySelector(".ejs-footer")) return;
        if (/^(play|kiosk|community)\.html$/.test(page)) return;
        var f = el("footer", "ejs-footer");
        f.innerHTML = '<span id="ejsVer">EmulatorJS</span> &middot; <a href="download.html">Get the app</a> &middot; <a href="privacy.html">Privacy</a> &middot; <a href="support.html">Help</a> &middot; <a href="about.html">About</a>';
        d.body.appendChild(f);
        fetch("release-config.json").then(function (r) { return r.json(); }).then(function (c) { var s = d.getElementById("ejsVer"); if (s) s.textContent = "EmulatorJS " + c.version; }).catch(function () { /* ignore */ });
    });
})();
