/* Loady, the LoadMind character: a small pixel blueberry that shows how heavy the day is.
   It breathes and blinks, gets worried and sweats when the day is overloaded, sleeps when there is nothing
   to do, and jumps when a task is done. Drawn as SVG squares, coloured with the accent colour. */
(function () {
    // 26 x 24 pixels, worked out from an ellipse: o outline, b body, h light, d shade, c cheeks.
    // Eyes, mouth and extras are drawn per mood on the same grid.
    const W = 26, H = 24;
    const BODY = (() => {
        const g = [], cx = 12.5, cy = 12.6, rx = 11.6, ry = 10.6;
        for (let y = 0; y < H; y++) { g[y] = []; for (let x = 0; x < W; x++) g[y][x] = ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2 <= 1 ? "b" : "."; }
        const inside = (x, y) => g[y] && g[y][x] && g[y][x] !== ".";
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++)
            if (inside(x, y) && (!inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1))) g[y][x] = "o";
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (g[y][x] === "b") {
            const d = ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2;
            if ((x - 6) ** 2 / 20 + (y - 6) ** 2 / 9 < 1) g[y][x] = "h";                 // light from the top left
            else if (d > .58 && x + y > 26 && !(d < .72 && (x + y) % 2)) g[y][x] = "d";   // a soft crescent of shade, dithered at its edge
        }
        [[4, 13], [5, 13], [6, 13], [4, 14], [5, 14], [6, 14], [19, 13], [20, 13], [21, 13], [19, 14], [20, 14], [21, 14]].forEach(([x, y]) => g[y][x] = "c");
        return g;
    })();
    const SPROUT = [[12, -1], [12, 0], [12, 1]].map(p => [...p, "lt"])
        .concat([[14, -3], [15, -3], [11, -2], [12, -2], [13, -2], [14, -2], [15, -2], [10, -1], [11, -1], [13, -1]].map(p => [...p, "lg"]));
    const open = x => [[x, 9], [x + 1, 9], [x - 1, 10], [x, 10, "w"], [x + 1, 10], [x + 2, 10], [x - 1, 11], [x, 11], [x + 1, 11], [x + 2, 11], [x, 12], [x + 1, 12]];
    const EYES = {
        open: [...open(7), ...open(16)],
        closed: [[6, 11], [7, 11], [8, 11], [9, 11], [15, 11], [16, 11], [17, 11], [18, 11]],
        happy: [[6, 11], [7, 10], [8, 10], [9, 11], [15, 11], [16, 10], [17, 10], [18, 11]],
        worried: [...open(7), ...open(16), [6, 7], [7, 7], [8, 6], [17, 6], [18, 7], [19, 7]],
        squeeze: [[6, 9], [7, 10], [8, 11], [7, 12], [6, 13], [19, 9], [18, 10], [17, 11], [18, 12], [19, 13]],
    };
    const MOUTH = {
        smile: [[10, 15], [11, 16], [12, 16], [13, 16], [14, 16], [15, 15]],
        flat: [[10, 16], [11, 16], [12, 16], [13, 16], [14, 16], [15, 16]],
        small: [[12, 16], [13, 16]],
        o: [[12, 15], [13, 15], [11, 16], [14, 16], [12, 17], [13, 17]],
        wave: [[9, 16], [10, 15], [11, 16], [12, 15], [13, 16], [14, 15], [15, 16], [16, 15]],
        big: [[9, 14], [10, 14], [11, 14], [12, 14], [13, 14], [14, 14], [15, 14], [16, 14], [10, 15], [15, 15], [11, 16], [12, 16], [13, 16], [14, 16], [11, 15, "t"], [12, 15, "t"], [13, 15, "t"], [14, 15, "t"]],
    };
    const MOODS = {
        calm: { eyes: "open", mouth: "smile", say: ["A light day. Time for a walk too", "Лёгкий день. Можно и погулять"] },
        ok: { eyes: "open", mouth: "flat", say: ["A normal day. We'll manage", "Обычный день. Справимся"] },
        busy: { eyes: "worried", mouth: "o", sweat: 1, say: ["That's a lot. Let's drop something", "Многовато. Давай что-то перенесём"] },
        over: { eyes: "squeeze", mouth: "wave", sweat: 2, steam: true, say: ["Too much! Press «Unload today»", "Это слишком! Жми «Разгрузить сегодня»"] },
        sleep: { eyes: "closed", mouth: "small", zzz: true, say: ["Nothing planned. I'm resting", "Пока ничего нет. Я отдыхаю"] },
        happy: { eyes: "happy", mouth: "big", stars: true, say: ["Done! One less", "Готово! Минус одна"] },
    };
    const LEVEL_MOOD = ["calm", "ok", "busy", "over"];
    const isRuNow = () => typeof isRu === "function" && isRu();
    const CLS = { o: "lo", b: "lb", h: "lh", d: "ld2", c: "lc" };

    const rect = (x, y, cls) => `<rect x="${x}" y="${y}" width="1" height="1" class="${cls}"/>`;
    const dots = (pts, cls) => pts.map(([x, y, k]) => rect(x, y, k === "w" ? "lw" : k === "t" ? "ltg" : cls)).join("");
    function svg(mood) {
        const m = MOODS[mood] || MOODS.calm;
        let body = "";
        BODY.forEach((row, y) => row.forEach((c, x) => { if (c !== ".") body += rect(x, y, CLS[c]); }));
        body += SPROUT.map(([x, y, c]) => rect(x, y, c)).join("");
        const face = `<g class="l-eyes${m.eyes === "open" ? " blinkable" : ""}">${dots(EYES[m.eyes], "lk")}</g>`
            + (m.eyes === "open" ? `<g class="l-blink">${dots(EYES.closed, "lk")}</g>` : "") + dots(MOUTH[m.mouth], "lk");
        let extra = "";
        if (m.sweat) extra += `<g class="l-sweat">${dots([[23, 6], [23, 7], [24, 7], [23, 8], [24, 8]], "ls")}</g>`;
        if (m.sweat > 1) extra += `<g class="l-sweat l-sweat2">${dots([[1, 8], [1, 9], [0, 9], [1, 10], [0, 10]], "ls")}</g>`;
        if (m.steam) extra += `<g class="l-steam">${dots([[5, -1], [6, -2], [5, -3], [19, -1], [20, -2], [19, -3]], "lst")}</g>`;
        if (m.zzz) extra += `<g class="l-zzz">${dots([[20, -5], [21, -5], [22, -5], [23, -5], [22, -4], [21, -3], [20, -2], [21, -2], [22, -2], [23, -2]], "lk")}</g>`;
        if (m.stars) extra += `<g class="l-stars">${dots([[26, 2], [25, 3], [26, 3], [27, 3], [26, 4], [-2, 7], [-3, 8], [-2, 8], [-1, 8], [-2, 9]], "ly")}</g>`;
        return `<svg class="loady-svg" viewBox="-4 -6 34 31" shape-rendering="crispEdges" aria-hidden="true"><g class="l-body">${body}${face}</g>${extra}</svg>`;
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
