/* Loady, the LoadMind character: a small pixel blob that shows how heavy the day is.
   It breathes and blinks, gets worried and sweats when the day is overloaded, sleeps when there is nothing
   to do, and jumps when a task is done. Drawn as SVG squares, coloured with the accent colour. */
(function () {
    // 16 x 15 pixels. O outline, B body, H highlight, C cheek. Eyes, mouth and extras are drawn per mood.
    const BODY = [
        "......OOOO......",
        "....OOBBBBOO....",
        "...OBBHHBBBBO...",
        "..OBBHBBBBBBBO..",
        ".OBBBBBBBBBBBBO.",
        ".OBBBBBBBBBBBBO.",
        "OBBBBBBBBBBBBBBO",
        "OBBBBBBBBBBBBBBO",
        "OBCCBBBBBBBBCCBO",
        "OBBBBBBBBBBBBBBO",
        "OBBBBBBBBBBBBBBO",
        ".OBBBBBBBBBBBBO.",
        "..OOBBBBBBBBOO..",
        "...OOOBOOBOOO...",
        ".....OO..OO.....",
    ];
    // [x, y] pixels of each part, on the same grid
    const EYES = {
        open: { w: [[4, 5], [5, 5], [10, 5], [11, 5], [4, 6], [10, 6], [4, 7], [10, 7]], p: [[5, 6], [5, 7], [11, 6], [11, 7]] },
        closed: { p: [[4, 7], [5, 7], [10, 7], [11, 7]] },
        happy: { p: [[4, 6], [5, 5], [6, 6], [10, 6], [11, 5], [12, 6]] },
        worried: { w: [[4, 6], [5, 6], [10, 6], [11, 6], [4, 7], [10, 7]], p: [[5, 7], [11, 7], [4, 4], [5, 5], [11, 4], [10, 5]] },
        squeeze: { p: [[4, 5], [5, 6], [4, 7], [11, 5], [10, 6], [11, 7]] },
    };
    const MOUTH = {
        smile: [[6, 9], [7, 10], [8, 10], [9, 9]],
        flat: [[6, 10], [7, 10], [8, 10], [9, 10]],
        small: [[7, 10], [8, 10]],
        o: [[7, 9], [8, 9], [7, 10], [8, 10]],
        wave: [[5, 10], [6, 9], [7, 10], [8, 9], [9, 10], [10, 9]],
        big: [[5, 9], [6, 10], [7, 10], [8, 10], [9, 10], [10, 9], [6, 9], [9, 9]],
    };
    const MOODS = {
        calm: { eyes: "open", mouth: "smile", say: ["A light day. Time for a walk too", "Лёгкий день. Можно и погулять"] },
        ok: { eyes: "open", mouth: "flat", say: ["A normal day. We'll manage", "Обычный день. Справимся"] },
        busy: { eyes: "worried", mouth: "o", sweat: 1, say: ["That's a lot. Let's drop something", "Многовато. Давай что-то перенесём"] },
        over: { eyes: "squeeze", mouth: "wave", sweat: 2, steam: true, say: ["Too much! Press «Unload today»", "Это слишком! Жми «Разгрузить сегодня»"] },
        sleep: { eyes: "closed", mouth: "small", zzz: true, say: ["Nothing planned. I'm resting", "Пока ничего нет. Я отдыхаю"] },
        happy: { eyes: "happy", mouth: "big", say: ["Done! One less", "Готово! Минус одна"] },
    };
    const LEVEL_MOOD = ["calm", "ok", "busy", "over"];
    const isRuNow = () => typeof isRu === "function" && isRu();

    const rect = (x, y, cls) => `<rect x="${x}" y="${y}" width="1.02" height="1.02" class="${cls}"/>`;
    function svg(mood) {
        const m = MOODS[mood] || MOODS.calm;
        let body = "";
        BODY.forEach((row, y) => [...row].forEach((c, x) => {
            if (c === ".") return;
            body += rect(x, y, { O: "lo", B: "lb", H: "lh", C: "lc" }[c]);
        }));
        // a little sprout on top: the mind that grows
        body += [[8, -1], [8, -2]].map(([x, y]) => rect(x, y, "lt")).join("")
            + [[6, -3], [7, -3], [7, -2], [9, -4], [10, -4], [9, -3], [10, -3], [11, -4]].map(([x, y]) => rect(x, y, "lg")).join("");
        const eye = (k) => { const e = EYES[k]; return (e.w || []).map(([x, y]) => rect(x, y, "lw")).join("") + e.p.map(([x, y]) => rect(x, y, "lo")).join(""); };
        const face = `<g class="l-eyes${m.eyes === "open" ? " blinkable" : ""}">${eye(m.eyes)}</g>` + (m.eyes === "open" ? `<g class="l-blink">${eye("closed")}</g>` : "")
            + MOUTH[m.mouth].map(([x, y]) => rect(x, y, "lo")).join("");
        let extra = "";
        if (m.sweat) extra += `<g class="l-sweat">${rect(15, 3, "ld")}${rect(15, 4, "ld")}${rect(16, 4, "ld")}</g>`;
        if (m.sweat > 1) extra += `<g class="l-sweat l-sweat2">${rect(-1, 5, "ld")}${rect(-1, 6, "ld")}${rect(-2, 6, "ld")}</g>`;
        if (m.steam) extra += `<g class="l-steam">${rect(3, -2, "ls")}${rect(4, -3, "ls")}${rect(12, -2, "ls")}${rect(11, -4, "ls")}</g>`;
        if (m.zzz) extra += `<g class="l-zzz">${[[14, -4], [15, -4], [16, -4], [17, -4], [16, -3], [15, -2], [14, -1], [15, -1], [16, -1], [17, -1]].map(([x, y]) => rect(x, y, "lo")).join("")}</g>`;
        return `<svg class="loady-svg" viewBox="-3 -5 22 21" shape-rendering="crispEdges" aria-hidden="true"><g class="l-body">${body}${face}</g>${extra}</svg>`;
    }

    // one character element: <div class="loady" data-mood="...">
    function make(mood, opts = {}) {
        const el = document.createElement("div");
        el.className = "loady" + (opts.cls ? " " + opts.cls : "");
        el.innerHTML = svg(mood) + (opts.bubble ? `<p class="loady-say" aria-live="polite"></p>` : "");
        el.dataset.mood = mood;
        if (opts.bubble) el.querySelector(".loady-say").textContent = MOODS[mood].say[isRuNow() ? 1 : 0];
        return el;
    }
    function set(el, mood) {
        if (!el || el.dataset.mood === mood && el.dataset.lang === String(isRuNow())) return;
        el.dataset.mood = mood; el.dataset.lang = String(isRuNow());
        el.querySelector("svg").outerHTML = svg(mood);
        const say = el.querySelector(".loady-say");
        if (say) say.textContent = MOODS[mood].say[isRuNow() ? 1 : 0];
    }

    // the logo gets a small one
    const logo = document.querySelector(".logo");
    if (logo && !logo.querySelector(".loady")) logo.prepend(make("calm", { cls: "loady-logo" }));

    // overload index: the character next to the number, with a line about the day
    let main = null, happyUntil = 0;
    function levelMood() {
        const w = document.getElementById("warning");
        const lvl = w ? +w.dataset.level || 0 : 0;
        const hasTasks = !document.querySelector("#schedule .empty");
        return hasTasks ? LEVEL_MOOD[Math.max(0, Math.min(3, lvl))] : "sleep";
    }
    function paint() {
        const head = document.querySelector(".overload-header");
        if (head && !main) {
            main = make(levelMood(), { cls: "loady-main", bubble: true });
            head.insertBefore(main, head.querySelector(".score"));
        }
        if (main && Date.now() > happyUntil) set(main, levelMood());
        // an empty plan gets a sleeping one
        const empty = document.querySelector("#schedule .empty");
        if (empty && !empty.querySelector(".loady")) empty.prepend(make("sleep", { cls: "loady-empty" }));
    }

    // a task ticked off: a little jump (on click: the app re-draws the list before "change" would arrive)
    document.addEventListener("click", e => {
        const c = e.target;
        if (!c.matches || !c.matches("input[type=checkbox][data-id]") || !c.checked || !main) return;
        happyUntil = Date.now() + 1800;
        set(main, "happy");
        main.classList.remove("jump"); void main.offsetWidth; main.classList.add("jump");
        setTimeout(() => { main.classList.remove("jump"); paint(); }, 1850);
    }, true);

    let queued = false;
    new MutationObserver(() => { if (!queued) { queued = true; requestAnimationFrame(() => { queued = false; paint(); }); } })
        .observe(document.querySelector("main") || document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-level"] });
    document.querySelector(".lang") && document.querySelector(".lang").addEventListener("click", () => setTimeout(() => { if (main) { main.dataset.lang = ""; paint(); } }));
    paint();

    window.LoadMindLoady = { make, set };
})();
