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
        queueMicrotask(() => { queued = false; pass(); });
    }).observe(document.body, { subtree: true, childList: true, characterData: true });
    pass();
})();
