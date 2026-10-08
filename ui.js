/* LoadMind UI layer: language, quote of the day, cursor, living dots, transitions */
(function () {
    const $ = s => document.querySelector(s);
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const root = document.documentElement;

    /* language (EN / RU) */
    const RU = {
        "Dashboard": "Обзор", "My Tasks": "Задачи", "Schedule": "План", "Workload": "Нагрузка", "Settings": "Настройки",
        "LoadMind Coach": "Коуч LoadMind", "Get insight": "Получить совет", "Developer settings": "Для разработчиков", "Network": "Сеть", "Study time": "Время на учёбу", "Daily balance": "Баланс дня",
        "Notes": "Заметки", "Read my notes": "Прочитать заметки", "Found in your notes": "Найдено в заметках", "Plan for today": "План на сегодня",
        "Export plan + deadlines (.ics for Google Calendar)": "Экспорт плана и дедлайнов (.ics для Google Календаря)",
        "Overload index": "Индекс перегрузки", "Low": "Низкий", "Normal": "Нормальный", "High": "Высокий", "Critical": "Критический",
        "My tasks": "Мои задачи", "Parse": "Разобрать", "Exam prep": "Подготовка к экзамену", "Study": "Учёба", "Physical": "Спорт", "Light": "Лёгкое",
        "Add task": "Добавить", "Your name": "Имя", "Day starts at": "День начинается в", "Peak focus time": "Пик концентрации",
        "Morning (08:00)": "Утро (08:00)", "Afternoon (13:00)": "День (13:00)", "Evening (18:00)": "Вечер (18:00)",
        "Daily capacity (hours)": "Дневная ёмкость (часы)", "Accent color": "Цвет акцента", "Reset tasks and notes": "Сбросить задачи и заметки",
        "Everything is stored in this browser only.": "Всё хранится только в этом браузере.",
        "Next step: Telegram bot for deadline reminders (not in this prototype).": "Дальше: Telegram-бот с напоминаниями о дедлайнах (в прототипе его нет).",
        "Too much for one day. Keep the one or two things that matter most and move the rest.": "Слишком много для одного дня. Оставь одно-два самых важных дела, остальное перенеси.",
        "Heavy day. Don't put two hard tasks back to back, leave a break between them.": "Тяжёлый день. Не ставь две сложные задачи подряд, оставь между ними перерыв.",
        "Fine as it is. Just keep breaks between the hard blocks.": "Нормально. Просто оставляй перерывы между сложными блоками.",
        "Light day. Nothing to change.": "Лёгкий день. Менять нечего.",
        "Light day": "Лёгкий день", "Balanced": "Сбалансировано", "High, but manageable": "Много, но терпимо", "Too much for one day": "Слишком много для одного дня",
        "Good": "Хорошо", "OK": "Нормально", "Recovery time available": "Есть время на отдых", "Add recovery time": "Добавь время на отдых",
        "academic": "учёба", "exam": "экзамен", "physical": "спорт", "fatigue": "усталость", "recovery": "отдых",
        "Background": "Фон", "Sparkles": "Звёздочки", "Plus signs": "Плюсики", "Lines": "Линии", "Off": "Выкл.", "Cursor": "Курсор", "Custom": "Свой", "Standard": "Обычный",
        "Language": "Язык", "AI provider": "ИИ-провайдер", "Everything is stored in this browser only": "Всё хранится только в этом браузере",
        "Add": "Добавить", "Add manually": "Добавить вручную", "Duration": "Длительность", "Deadline": "Дедлайн", "Start at (optional)": "Начало (необязательно)", "Task": "Задача", "Type": "Тип", "h": "ч", "min": "мин", "Not set": "Не задано", "e.g. SAT Reading": "например, SAT Reading",
        "Type a task: «SAT Math 1h tomorrow 18:00»": "Напиши задачу: «SAT Math 1ч завтра 18:00»", "Duration, day and time are picked up automatically.": "Длительность, день и время подхватываются сами.",
        "Break": "Перерыв", "High concentration": "Высокая концентрация", "Medium load": "Средняя нагрузка", "Physical load": "Физическая нагрузка", "Light load": "Лёгкая нагрузка",
        "Reads your tasks, deadlines, peak time and notes and gives short, concrete advice. It only advises: the schedule itself is built by rules.": "Читает задачи, дедлайны, пиковое время и заметки и даёт короткий совет. Он только советует, расписание строится по правилам.",
        "Write how the day went. The text is scanned for keywords (English and Russian) and feeds into the overload index. The AI reads the note (keyword matching is the fallback).": "Напиши, как прошёл день. ИИ читает заметку (запасной вариант — поиск по ключевым словам) и учитывает её в индексе перегрузки.",
        "Hard tasks start at your peak focus time (set in Settings), light ones fill the gap before it. Breaks after long sessions.": "Сложные задачи начинаются в пик концентрации (выбери в настройках), лёгкие заполняют время до него. После долгих сессий идут перерывы.",
        "Open tasks against your daily capacity, plus what your notes say. 0 to 100, higher is worse.": "Открытые задачи против дневной ёмкости плюс то, что в заметках. От 0 до 100, чем выше, тем хуже.",
        "Add what you plan to do today. The plan and the index recalculate on their own.": "Добавь, что планируешь сегодня. План и индекс пересчитаются сами.",
        "Understands duration, day (today / tomorrow / weekday) and time, in English and Russian.": "Понимает длительность, день (сегодня / завтра / день недели) и время на русском и английском.",
        "Smart input: «SAT Math 1h tomorrow 18:00» or «сдать отчёт в пятницу в 18:00, 2 часа»": "Умный ввод: «SAT Math 1ч завтра 18:00» или «сдать отчёт в пятницу в 18:00, 2 часа»",
        "Task, e.g. SAT Reading": "Задача, например SAT Reading", "Task name": "Название", "Minutes": "Минуты", "Deadline": "Дедлайн", "Task type": "Тип",
        "Optional": "Необязательно", "Switch theme": "Сменить тему", "Notes about your day": "Заметки о дне"
    };
    const LBL = { "High concentration": "Высокая концентрация", "Medium load": "Средняя нагрузка", "Physical load": "Физическая нагрузка", "Light load": "Лёгкая нагрузка", "Exam prep": "Экзамен" };
    const MO = { Jan: "янв", Feb: "фев", Mar: "мар", Apr: "апр", May: "мая", Jun: "июн", Jul: "июл", Aug: "авг", Sep: "сен", Oct: "окт", Nov: "ноя", Dec: "дек" }, WD = { Mon: "пн", Tue: "вт", Wed: "ср", Thu: "чт", Fri: "пт", Sat: "сб", Sun: "вс" }, LV = { Low: "Низкая", Normal: "Нормальная", High: "Высокая", Critical: "Критическая" };
    const num = t => t.replace(/^(Exam prep|Study|Physical|Light) · /, (m, a) => ({ "Exam prep": "Экзамен", Study: "Учёба", Physical: "Спорт", Light: "Лёгкое" })[a] + " · ").replace(/(Low|Normal|High|Critical) load/, (m, a) => LV[a] + " нагрузка").replace(/peak focus/, "пик концентрации").replace(/ at (?=[A-Z])/, " в ").replace(/fixed time/, "фиксированное время").replace(/(Mon|Tue|Wed|Thu|Fri|Sat|Sun),? (\d+) (\w{3})/g, (m, w, d, mo) => `${WD[w]}, ${d} ${MO[mo] || mo}`).replace(/High concentration|Medium load|Physical load|Light load|Exam prep/g, m => LBL[m]).replace(/(\d+) open/, "$1 открыто").replace(/(\d+) h/g, "$1 ч").replace(/(\d+) min/g, "$1 мин").replace(" planned", " запланировано").replace(/ due /, " до ");
    const orig = new WeakMap(), origAttr = new WeakMap();
    let lang = localStorage.getItem("loadmind.lang") || "en";
    const norm = t => t.replace(/\s+/g, " ").trim();

    function tr() {
        const ru = lang === "ru";
        const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, { acceptNode: n => /^(SCRIPT|STYLE|TEXTAREA)$/.test(n.parentNode.nodeName) || n.parentNode.closest(".quote") || !n.nodeValue.trim() ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
        for (let n; (n = w.nextNode());) {
            if (!orig.has(n) || (ru && n.nodeValue !== orig.get(n).out)) orig.set(n, { en: n.nodeValue });
            const o = orig.get(n);
            if (!ru) { if (o.out !== undefined && n.nodeValue === o.out) n.nodeValue = o.en; continue; }
            const k = norm(o.en), out = RU[k] || num(o.en);
            o.out = o.en.match(/^\s*/)[0] + out + o.en.match(/\s*$/)[0]; n.nodeValue = o.out;
        }
        document.querySelectorAll("[placeholder],[aria-label],[title]").forEach(el => {
            ["placeholder", "aria-label", "title"].forEach(a => {
                if (!el.hasAttribute(a)) return;
                const m = origAttr.get(el) || {}; if (!(a in m)) m[a] = el.getAttribute(a); origAttr.set(el, m);
                el.setAttribute(a, ru ? (RU[m[a]] || m[a]) : m[a]);
            });
        });
        const g = $("#greeting");
        if (g && ru && /^[A-Za-z]+day \d/.test(g.textContent)) g.textContent = new Date().toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" });
        document.documentElement.lang = lang;
        document.querySelectorAll(".lang button").forEach(b => b.classList.toggle("on", b.dataset.lang === lang));
        quote();
    }
    document.querySelector(".lang").addEventListener("click", e => {
        const b = e.target.closest("button[data-lang]"); if (!b) return;
        lang = b.dataset.lang; localStorage.setItem("loadmind.lang", lang);
        if (typeof render === "function") render(); else tr();
    });
    if (typeof render === "function") { const r = render; render = function () { r.apply(this, arguments); if (typeof fillDays === "function") fillDays(); tr(); }; }

    /* quote of the day: changes once a day (local midnight) */
    const Q = [
        ["Do less, but finish it.", "Делай меньше, но доводи до конца."],
        ["A tired mind lies about how much is left.", "Уставший ум врёт, сколько ещё осталось."],
        ["Rest is part of the work, not a reward for it.", "Отдых — часть работы, а не награда за неё."],
        ["Start small. Small is still moving.", "Начни с малого. Малое — тоже движение."],
        ["Your best hour deserves your hardest task.", "Лучший час дня заслуживает самой трудной задачи."],
        ["Not every day needs to be a record.", "Не каждый день должен быть рекордом."],
        ["Plan for the day you have, not the one you imagine.", "Планируй день, который есть, а не придуманный."],
        ["Quiet progress still counts.", "Тихий прогресс тоже считается."],
        ["One clear task beats ten vague ones.", "Одна ясная задача лучше десяти расплывчатых."],
        ["Slow is a speed.", "Медленно — это тоже скорость."],
        ["Knowing when to stop is a skill.", "Уметь остановиться — тоже навык."],
        ["Tomorrow's focus is built tonight.", "Завтрашний фокус собирается сегодня вечером."]
    ];
    const SLOT = 24 * 3600e3, TZ = new Date().getTimezoneOffset() * 6e4;
    function quote() {
        const t = Date.now() - TZ, i = Math.floor(t / SLOT) % Q.length, left = SLOT - (t % SLOT);
        const h = Math.floor(left / 3600e3), m = Math.floor(left % 3600e3 / 60e3), ru = lang === "ru";
        const p = $("#quoteText"), text = Q[i][ru ? 1 : 0];
        if (p.textContent !== text) p.textContent = text;
        $("#quoteMeta").textContent = ru ? `Мысль дня · следующая через ${h} ч ${m} мин` : `Quote of the day · next in ${h}h ${m}m`;
    }
    setInterval(quote, 6e4);

    /* custom cursor + magnetic buttons */
    const cur = $(".cursor"), dot = cur.children[0], ring = cur.children[1];
    let px = innerWidth / 2, py = innerHeight / 2, bx = px, by = py, mx = -999, my = -999, sx = -999, sy = -999;
    addEventListener("pointermove", e => {
        px = mx = e.clientX; py = my = e.clientY;
        dot.style.transform = `translate(${px}px,${py}px)`;
        const b = e.target.closest && e.target.closest(".primary-button,.secondary-button,.theme-toggle");
        if (b) { const r = b.getBoundingClientRect(); b.style.transform = `translate(${(px - r.left - r.width / 2) * .18}px,${(py - r.top - r.height / 2) * .28}px)`; }
    });
    document.addEventListener("pointerout", e => { const b = e.target.closest && e.target.closest(".primary-button,.secondary-button,.theme-toggle"); if (b) b.style.transform = ""; });
    document.addEventListener("pointerover", e => cur.classList.toggle("hot", !!(e.target.closest && e.target.closest("a,button,input,select,textarea,label"))));
    document.addEventListener("pointerdown", () => ring.style.scale = ".7");
    document.addEventListener("pointerup", () => ring.style.scale = "1");

    /* background styles (Settings -> Background) */
    let look = {}; try { look = JSON.parse(localStorage.getItem("loadmind.look")) || {}; } catch (e) {}
    look.bg = ["network", "lines", "off"].includes(look.bg) ? look.bg : "network"; look.cur = look.cur || "custom";
    const saveLook = () => localStorage.setItem("loadmind.look", JSON.stringify(look));
    const applyCur = () => root.classList.toggle("std", look.cur === "standard");
    applyCur();
    const sb = $("#setBg"), sc = $("#setCur");
    sb.value = look.bg; sc.value = look.cur;
    sb.onchange = () => { look.bg = sb.value; saveLook(); };
    sc.onchange = () => { look.cur = sc.value; saveLook(); applyCur(); };

    const cv = $("#dots"), cx = cv.getContext("2d");
    let W, H, rgb = "185,167,245", fr = 0; const stars = [];
    function size() { const d = devicePixelRatio || 1; W = innerWidth; H = innerHeight; cv.width = W * d; cv.height = H * d; cx.setTransform(d, 0, 0, d, 0, 0); }
    addEventListener("resize", size); size();
    function accent() { const h = getComputedStyle(root).getPropertyValue("--accent").trim().replace("#", ""); if (h.length === 6) rgb = [0, 2, 4].map(i => parseInt(h.substr(i, 2), 16)).join(","); }
    function frame(t) {
        if (fr++ % 30 === 0) accent();
        sx += (mx - sx) * .1; sy += (my - sy) * .1;
        cx.clearRect(0, 0, W, H);
        const dark = root.dataset.theme === "dark", ink = dark ? "233,230,223" : "28,27,24";
        if (look.bg === "network") {
            if (!stars.length) for (let i = 0; i < 58; i++) stars.push({ x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - .5) * .22, vy: (Math.random() - .5) * .22 });
            stars.forEach(o => { o.x = (o.x + o.vx + W) % W; o.y = (o.y + o.vy + H) % H; });
            const pts = stars.concat([{ x: sx, y: sy, c: 1 }]);
            cx.lineWidth = 1;
            for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
                const d = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y), lim = pts[j].c ? 210 : 150;
                if (d > lim) continue;
                cx.strokeStyle = `rgba(${pts[j].c ? rgb : ink},${((1 - d / lim) * (pts[j].c ? .5 : .16)).toFixed(3)})`;
                cx.beginPath(); cx.moveTo(pts[i].x, pts[i].y); cx.lineTo(pts[j].x, pts[j].y); cx.stroke();
            }
            cx.fillStyle = `rgba(${ink},.38)`;
            stars.forEach(o => { cx.beginPath(); cx.arc(o.x, o.y, 1.7, 0, 6.2832); cx.fill(); });
        } else if (look.bg === "lines") {
            cx.lineWidth = 1;
            for (let y = 20; y < H + 40; y += 36) {
                cx.beginPath();
                for (let x = 0; x <= W; x += 14) {
                    const k = Math.max(0, 1 - Math.hypot(x - sx, y - sy) / 260);
                    const yy = y + Math.sin(x * .008 + t * .0006 + y * .02) * 9 - k * k * 34;
                    x ? cx.lineTo(x, yy) : cx.moveTo(x, yy);
                }
                cx.strokeStyle = `rgba(${ink},.11)`; cx.stroke();
            }
        }
        if (!reduce) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);

    /* page transitions */
    const wipe = document.createElement("div"); wipe.className = "wipe"; document.body.appendChild(wipe);
    function enter() {
        if (reduce) return;
        wipe.animate([{ transform: "scaleX(0)", transformOrigin: "left" }, { transform: "scaleX(1)", transformOrigin: "left", offset: .5 }, { transform: "scaleX(1)", transformOrigin: "right", offset: .5 }, { transform: "scaleX(0)", transformOrigin: "right" }], { duration: 900, easing: "cubic-bezier(.7,0,.2,1)" });
        let i = 0;
        document.querySelectorAll(".header,[data-views]").forEach(el => {
            if (!el.offsetParent) return;
            el.style.animation = "none"; void el.offsetWidth;
            el.style.animation = `rise .85s cubic-bezier(.2,.8,.2,1) ${i++ * 70}ms both`;
        });
    }
    if (typeof showView === "function") { const sv = showView; showView = function () { sv.apply(this, arguments); enter(); }; }
    tr(); enter();
})();
