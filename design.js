/* Texts in LoadMind are built as parts joined with " · " (and ui.js translates them in that form).
   After every change this turns task details into small tags and the other joins into commas,
   so the page shows no mid-dots. It only touches what is on screen, never the saved data. */
(function () {
    const SEP = " · ";
    const TAGGED = ".task-info small, .task-row small";

    // plain text inside means the app has just written it (or rewritten it)
    const fresh = el => [...el.childNodes].some(c => c.nodeType === 3 && c.nodeValue.trim());

    function tags(el) {
        const parts = el.textContent.split(SEP).map(s => s.trim()).filter(Boolean);
        el.classList.add("lm-meta");
        el.replaceChildren(...parts.map(p => { const s = document.createElement("span"); s.className = "meta-tag"; s.textContent = p; return s; }));
    }

    function text(n) {
        const v = n.nodeValue;
        if (!v.includes("·")) return;
        const p = n.parentNode;
        if (!p || /^(SCRIPT|STYLE|TEXTAREA|TITLE)$/.test(p.nodeName)) return;
        let out = v;
        if (p.closest && p.closest(".lm-src")) out = v.replace(/^\s*·\s*/, "");      // " · Google" after a task name
        else if (/^H[1-3]$/.test(p.nodeName)) out = v.replace(/ · /g, "  ");          // "Achievements · 3/12"
        else if (p.closest && p.closest(".tag, .lm-tip-cat")) out = v.replace(/ · /g, ": "); // "Study · 3 h", "Lifehack · Rest"
        else out = v.replace(/\s*·\s*$/, "").replace(/ · /g, ", ");                    // "Lifehack · ", "5 open · 2 h planned"
        if (out !== v) n.nodeValue = out;
    }

    let busy = false;
    function pass() {
        if (busy) return;
        busy = true;
        try {
            document.querySelectorAll(TAGGED).forEach(el => { if (fresh(el)) tags(el); });
            const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
                acceptNode: n => n.nodeValue.includes("·") && !(n.parentNode.closest && n.parentNode.closest(TAGGED)) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
            });
            const list = [];
            for (let n; (n = w.nextNode());) list.push(n);
            list.forEach(text);
        } catch (e) { console.error(e); }
        busy = false;
    }

    let queued = false;
    new MutationObserver(() => {
        if (busy || queued) return;
        queued = true;
        queueMicrotask(() => { queued = false; pass(); numbers(); });
    }).observe(document.body, { subtree: true, childList: true, characterData: true });
    pass();

    /* ---------- motion ---------- */
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;

    // big numbers count up to their new value
    const NUMS = "#score, .stat-value strong, .lm-card strong, .lm-ring span";
    const shown = new WeakMap(), running = new WeakMap();
    function numbers() {
        document.querySelectorAll(NUMS).forEach(el => {
            const t = el.textContent.trim();
            if (running.get(el) === t) return;                // our own frame
            const m = t.match(/^(\D*?)(\d+)(\D*)$/);
            if (!m) { shown.delete(el); return; }
            const to = +m[2], from = shown.has(el) ? shown.get(el) : (el.closest(".overload-header") ? 0 : to);
            shown.set(el, to);
            if (still || from === to) return;
            const t0 = performance.now(), len = Math.min(900, 300 + Math.abs(to - from) * 12);
            (function step(now) {
                if (shown.get(el) !== to) return;              // a newer value took over
                const k = Math.min(1, (now - t0) / len), e = 1 - Math.pow(1 - k, 3);
                const v = m[1] + Math.round(from + (to - from) * e) + m[3];
                running.set(el, v);
                if (el.textContent !== v) el.textContent = v;
                if (k < 1) requestAnimationFrame(step); else running.delete(el);
            })(t0);
        });
    }
    numbers();

    // the menu highlight slides to the open section
    const nav = document.querySelector(".navigation");
    const pill = document.createElement("span");
    pill.className = "lm-nav-pill";
    pill.setAttribute("aria-hidden", "true");
    nav.prepend(pill);
    function movePill(instant) {
        const a = nav.querySelector(".nav-item.active");
        if (!a) return;
        if (instant) pill.style.transition = "none";
        pill.style.width = a.offsetWidth + "px";
        pill.style.height = a.offsetHeight + "px";
        pill.style.transform = `translate(${a.offsetLeft}px, ${a.offsetTop}px)`;
        if (instant) { void pill.offsetWidth; pill.style.transition = ""; }
    }
    new MutationObserver(() => movePill()).observe(nav, { subtree: true, attributes: true, attributeFilter: ["class"] });
    addEventListener("resize", () => movePill(true));
    document.fonts && document.fonts.ready.then(() => movePill(true));
    movePill(true);

    // switching sections: a quick pixel dissolve, like an old game screen
    const cv = document.createElement("canvas");
    cv.className = "lm-pix";
    cv.setAttribute("aria-hidden", "true");
    document.body.append(cv);
    const cx = cv.getContext("2d");
    let anim = 0;
    function dissolve() {
        if (still) return;
        const W = innerWidth, H = innerHeight, S = W < 640 ? 14 : 18;
        cv.width = W; cv.height = H;
        const cols = Math.ceil(W / S), rows = Math.ceil(H / S), n = cols * rows;
        const order = Array.from({ length: n }, (_, i) => i);
        for (let i = n - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [order[i], order[j]] = [order[j], order[i]]; }
        const color = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#2f4bff";
        const IN = 150, OUT = 330, t0 = performance.now(), id = ++anim;
        cv.style.display = "block";
        (function frame(now) {
            if (id !== anim) return;
            const t = now - t0;
            cx.clearRect(0, 0, W, H);
            // first the squares pop in (up to about half of the screen), then they go away in the same random order
            const on = Math.min(1, t / IN) * .55, off = Math.max(0, Math.min(1, (t - IN) / OUT));
            const first = Math.floor(off * n * .55), last = Math.floor(on * n);
            cx.fillStyle = color;
            for (let i = first; i < last; i++) { const c = order[i]; cx.fillRect((c % cols) * S, (c / cols | 0) * S, S, S); }
            if (t < IN + OUT) requestAnimationFrame(frame); else { cx.clearRect(0, 0, W, H); cv.style.display = "none"; }
        })(t0);
    }
    if (typeof showView === "function") {
        const sv = showView;
        showView = function (v) { const was = typeof view !== "undefined" ? view : null; sv.apply(this, arguments); if (was !== v) dissolve(); };
    }
})();
