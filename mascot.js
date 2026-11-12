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
        down: [...open(7), ...open(16)].map(([x, y, w]) => [x, y + 1, w]),
        sleepy: [[6, 11], [7, 11], [8, 11], [9, 11], [7, 12], [8, 12], [15, 11], [16, 11], [17, 11], [18, 11], [16, 12], [17, 12]],
        dizzy: [7, 16].flatMap(x => [[x, 9], [x + 1, 9], [x - 1, 10], [x + 2, 10], [x - 1, 11], [x + 2, 11], [x, 12], [x + 1, 12], [x + 1, 11]]),
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
        eat: { eyes: "happy", mouth: "o", say: ["Yum! It's in the plan", "Ням! Задача в плане"] },
        listen: { eyes: "down", mouth: "small", say: ["Writing it down…", "Записываю…"] },
        focus: { eyes: "down", mouth: "flat", say: ["Shh… I'm focusing too", "Тсс… я тоже сосредоточилась"] },
        rest: { eyes: "happy", mouth: "smile", say: ["Break! Stretch and drink some water", "Перерыв! Потянись и попей воды"] },
        sleepy: { eyes: "sleepy", mouth: "small", say: ["It's late. Sleep is part of the plan too", "Уже поздно. Сон тоже часть плана"] },
        dizzy: { eyes: "dizzy", mouth: "wave", say: ["Whoa, my head is spinning…", "Ой, голова кружится…"] },
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
        const blink = m.eyes === "open" || m.eyes === "down";
        const face = `<g class="l-look"><g class="l-eyes${blink ? " blinkable" : ""}">${dots(EYES[m.eyes], "lk")}</g>`
            + (blink ? `<g class="l-blink">${dots(EYES.closed.map(([x, y]) => [x, y + (m.eyes === "down" ? 1 : 0)]), "lk")}</g>` : "") + `</g>` + dots(MOUTH[m.mouth], "lk");
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
        if (opts.poke) { el.tabIndex = 0; el.setAttribute("role", "button"); el.setAttribute("aria-label", "Loady"); }
        return el;
    }
    function set(el, mood, text) {
        if (!el) return;
        const lang = String(isRuNow()), line = text || MOODS[mood].say[isRuNow() ? 1 : 0];
        if (el.dataset.mood !== mood || el.dataset.lang !== lang) {
            el.dataset.mood = mood; el.dataset.lang = lang;
            el.querySelector("svg").outerHTML = svg(mood);
            look(el);
        }
        const say = el.querySelector(".loady-say");
        if (say && say.textContent !== line) say.textContent = line;
    }
    const T = (en, ru) => (isRuNow() ? ru : en);

    // ---------- where it lives ----------
    const logo = document.querySelector(".logo");
    if (logo && !logo.querySelector(".loady")) logo.prepend(make("calm", { cls: "loady-logo" }));

    let main = null;                                           // next to the overload index on Today
    const buddy = make("calm", { cls: "loady-buddy", bubble: true, poke: true }); // peeks from the corner everywhere else
    buddy.hidden = true;
    document.body.append(buddy);

    // a mood held for a moment (a reaction) wins over the normal one
    const held = new WeakMap();
    function hold(el, mood, text, ms = 1600) {
        if (!el) return;
        held.set(el, Date.now() + ms);
        set(el, mood, text);
        clearTimeout(el._t); el._t = setTimeout(() => { held.delete(el); paint(); }, ms);
    }
    const isHeld = el => (held.get(el) || 0) > Date.now();
    function bump(el, cls) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); setTimeout(() => el.classList.remove(cls), 900); }

    // ---------- the normal mood ----------
    let lastAct = Date.now(), napping = false;
    const night = () => { const h = new Date().getHours(); return h >= 23 || h < 5; };
    const timer = () => (typeof pomo !== "undefined" && pomo) || {};
    function levelMood() {
        if (napping) return "sleep";
        const w = document.getElementById("warning");
        const lvl = w ? +w.dataset.level || 0 : 0;
        if (document.querySelector("#schedule .empty")) return "sleep";
        const m = LEVEL_MOOD[Math.max(0, Math.min(3, lvl))];
        return night() && (m === "calm" || m === "ok") ? "sleepy" : m;
    }
    function buddyState() {
        const v = typeof view !== "undefined" ? view : "dashboard", t = timer();
        if (napping) return ["sleep", T("I'll nap until you're back", "Вздремну, пока тебя нет")];
        if (v === "focus") {
            if (t.running && t.phase === "work") return ["focus"];
            if (t.running) return ["rest"];
            return ["calm", T("Pick a task and press «Start»", "Выбери задачу и жми «Старт»")];
        }
        if (v === "tasks") {
            const late = typeof state !== "undefined" && state.tasks.some(x => !x.done && x.due && new Date(x.due) < new Date());
            return late ? ["busy", T("Some deadlines have passed. Take a look", "Есть просроченные дедлайны, глянь")] : ["calm", T("What else shall we add?", "Что ещё добавим?")];
        }
        if (v === "week") return ["ok", T("See which day of the week is the heaviest", "Смотри, какой день недели самый тяжёлый")];
        if (v === "settings") return ["calm", T("You can repaint me here: Accent colour", "Тут можно меня перекрасить: «Цвет акцента»")];
        return ["calm"];
    }
    let shownView = null;
    function paint() {
        const head = document.querySelector(".overload-header");
        if (head && !main) {
            main = make(levelMood(), { cls: "loady-main", bubble: true, poke: true });
            head.insertBefore(main, head.querySelector(".score"));
            wire(main);
        }
        if (main && !isHeld(main)) set(main, levelMood(), napping ? T("I'll nap until you're back", "Вздремну, пока тебя нет") : null);
        const v = typeof view !== "undefined" ? view : "dashboard";
        buddy.hidden = v === "dashboard";
        if (!buddy.hidden && !isHeld(buddy)) { const [m, text] = buddyState(); set(buddy, m, text); }
        if (v !== shownView) { shownView = v; if (!buddy.hidden) talk(buddy); }
        const empty = document.querySelector("#schedule .empty");
        if (empty && !empty.querySelector(".loady")) empty.prepend(make("sleep", { cls: "loady-empty" }));
    }
    // the corner one shows its line for a few seconds, then just sits there
    function talk(el, ms = 4200) { el.classList.add("talk"); clearTimeout(el._s); el._s = setTimeout(() => el.classList.remove("talk"), ms); }

    // ---------- it looks at you ----------
    let px = innerWidth / 2, py = innerHeight / 3;
    function look(el) {
        const g = el.querySelector(".l-look"), svgEl = el.querySelector("svg");
        if (!g || !svgEl || !el.offsetParent && el !== buddy) return;
        const r = svgEl.getBoundingClientRect();
        if (!r.width) return;
        const cx = r.left + r.width * .5, cy = r.top + r.height * .42;
        const dx = Math.abs(px - cx) < r.width * .35 ? 0 : px > cx ? 1 : -1, dy = Math.abs(py - cy) < r.height * .35 ? 0 : py > cy ? 1 : -1;
        g.setAttribute("transform", `translate(${dx} ${dy})`);
    }
    let lookQueued = false;
    addEventListener("pointermove", e => {
        px = e.clientX; py = e.clientY; activity();
        if (!lookQueued) { lookQueued = true; requestAnimationFrame(() => { lookQueued = false; [main, buddy].forEach(el => el && look(el)); }); }
    }, { passive: true });

    // ---------- poke it, pet it, don't spin it ----------
    const POKES = [
        ["Hee-hee, that tickles!", "Хи-хи, щекотно!"], ["I'm here!", "Я тут!"], ["Don't forget to rest", "Не забывай отдыхать"],
        ["You plan really well", "Ты классно планируешь"], ["I'm a blueberry, not a button :)", "Я черника, а не кнопка :)"],
        ["One task at a time", "По одной задаче за раз"], ["Drink some water?", "Может, попьёшь воды?"], ["Boop!", "Буп!"],
    ];
    let lastPoke = -1;
    function hearts(el, n = 3) {
        for (let i = 0; i < n; i++) {
            const h = document.createElement("i");
            h.className = "l-heart";
            const w = (el.querySelector("svg") || el).getBoundingClientRect().width || 80;
            h.style.left = (.15 + Math.random() * .6) * w + "px";   // over the berry, not over its speech bubble
            h.style.animationDelay = i * 120 + "ms";
            el.append(h);
            setTimeout(() => h.remove(), 1400 + i * 120);
        }
    }
    function wire(el) {
        let taps = [], down = null, petted = 0;
        const poke = () => {
            if (isHeld(el) && el.dataset.mood === "dizzy") return;   // let it recover first
            const now = Date.now();
            taps = taps.filter(t => now - t < 2500).concat(now);
            if (taps.length >= 5) { taps = []; hold(el, "dizzy", null, 2400); bump(el, "spin"); talk(el, 2400); return; }
            let i; do { i = Math.random() * POKES.length | 0; } while (i === lastPoke && POKES.length > 1);
            lastPoke = i;
            hold(el, "happy", POKES[i][isRuNow() ? 1 : 0], 1700);
            bump(el, "poke"); hearts(el, 2); talk(el, 2200);
        };
        el.addEventListener("pointerdown", e => { down = { x: e.clientX, y: e.clientY, moved: 0 }; petted = 0; });
        el.addEventListener("pointermove", e => {
            if (!down) return;
            down.moved += Math.hypot(e.clientX - down.x, e.clientY - down.y); down.x = e.clientX; down.y = e.clientY;
            if (down.moved - petted > 60) { petted = down.moved; hold(el, "happy", T("Mmm, nice!", "Мм, приятно!"), 1400); hearts(el, 1); talk(el, 1600); }
        });
        addEventListener("pointerup", () => { if (down && down.moved < 12) poke(); down = null; });
        el.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); poke(); } });
    }
    wire(buddy);
    buddy.addEventListener("mouseenter", () => talk(buddy, 2600));

    // ---------- it follows what you do ----------
    document.addEventListener("input", e => {
        if (e.target.id === "quickText" && main && e.target.value.trim()) hold(main, "listen", null, 1400);
        if (e.target.id === "accentPicker") hold(buddy, "happy", T("Suits me!", "Мне идёт!"), 1800);
    });
    document.addEventListener("submit", e => {
        if (e.target.id !== "quickForm" || !main) return;
        setTimeout(() => { hold(main, "eat", null, 1700); bump(main, "chew"); }, 30);
    }, true);
    document.addEventListener("click", e => {
        const c = e.target;
        if (c.closest && c.closest(".swatch")) { hold(buddy, "happy", T("Suits me!", "Мне идёт!"), 1800); talk(buddy, 1800); }
        // a task ticked off: a little jump (on click: the app re-draws the list before "change" would arrive)
        if (!c.matches || !c.matches("input[type=checkbox][data-id]") || !c.checked) return;
        const el = main && main.offsetParent ? main : buddy;
        hold(el, "happy", null, 1800); bump(el, "jump"); hearts(el, 3); talk(el, 1800);
    }, true);

    // no clicks, keys or scrolling for 90 seconds (and no focus timer): it takes a nap; any move wakes it up
    function activity() {
        lastAct = Date.now();
        if (!napping) return;
        napping = false;
        const el = main && main.offsetParent ? main : buddy;
        hold(el, "happy", T("Oh! I'm awake", "Ой! Я не сплю"), 1500);
        paint();
    }
    ["pointerdown", "keydown", "wheel", "touchstart"].forEach(t => addEventListener(t, activity, { passive: true }));
    setInterval(() => {
        if (!napping && Date.now() - lastAct > 9e4 && !timer().running) { napping = true; paint(); }
        else if (!buddy.hidden && view === "focus") paint();   // the timer started or ended
    }, 5000);

    let queued = false;
    new MutationObserver(() => { if (!queued) { queued = true; requestAnimationFrame(() => { queued = false; paint(); }); } })
        .observe(document.querySelector("main") || document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-level", "hidden"] });
    document.querySelector(".lang") && document.querySelector(".lang").addEventListener("click", () => setTimeout(() => { [main, buddy].forEach(el => el && (el.dataset.lang = "")); paint(); }));
    paint();

    window.LoadMindLoady = { make, set };
})();
