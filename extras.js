/* LoadMind extras: Google Calendar -> LoadMind import (and two-way sync), study tips on the dashboard,
   and the things that make you come back: daily streak, levels, achievements, daily goal, weekly recap. */

// Google Cloud Console -> APIs & Services -> Credentials -> OAuth client ID (Web application).
// Authorized JavaScript origins: https://loadmind.dev  (and http://localhost:8000 for testing).
// Without it the .ics import still works.
const GOOGLE_CLIENT_ID = "419464428310-6sjn06369vm13960h1k15ksdn8j0o8m5.apps.googleusercontent.com";

(function () {
    const T = (en, ru) => (isRu() ? ru : en);
    const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
    const DAILY_GOAL = 3;

    // ---------- progress log (tasks done per day) ----------
    function ensure() {
        state.log = state.log && typeof state.log === "object" ? state.log : {};
        state.badges = state.badges && typeof state.badges === "object" ? state.badges : {};
    }
    const origSetDone = setDone;
    setDone = function (t, done) {
        ensure();
        const today = todayStr();
        if (done && !t.doneAt) { t.doneAt = today; state.log[today] = (state.log[today] || 0) + 1; }
        if (!done && t.doneAt) { const d = t.doneAt; state.log[d] = Math.max(0, (state.log[d] || 0) - 1); if (!state.log[d]) delete state.log[d]; delete t.doneAt; }
        origSetDone(t, done);
        if (done) setTimeout(() => { checkBadges(true); if ((state.log[today] || 0) === DAILY_GOAL) { toast("◎ " + T("Daily goal reached!", "Цель дня выполнена!")); confetti(); } }, 50);
    };

    const active = d => (state.log && state.log[d] > 0) || (state.focus && state.focus[d] && state.focus[d].m > 0);
    function streak() {
        let n = 0, d = todayStr();
        if (!active(d)) d = addDays(d, -1); // today still counts until midnight
        while (active(d)) { n++; d = addDays(d, -1); }
        return n;
    }
    function totals() {
        ensure();
        const tasks = Object.values(state.log).reduce((s, n) => s + n, 0);
        const focusMin = Object.values(state.focus || {}).reduce((s, r) => s + (r.m || 0), 0);
        const xp = tasks * 10 + Math.floor(focusMin / 5) * 2 + Object.keys(state.badges).length * 25;
        const level = Math.floor(Math.sqrt(xp / 40)) + 1;
        const from = 40 * (level - 1) ** 2, to = 40 * level ** 2;
        return { tasks, focusMin, xp, level, pct: Math.round((xp - from) / (to - from) * 100), toNext: to - xp };
    }
    function weekTasks(offset) {
        let n = 0;
        for (let i = 0; i < 7; i++) n += (state.log || {})[addDays(todayStr(), -(i + offset * 7))] || 0;
        return n;
    }

    // ---------- achievements ----------
    const BADGES = [
        ["first", "✓", "First step", "Первый шаг", "Finish your first task", "Закрой первую задачу", s => s.tasks >= 1],
        ["ten", "10", "Ten done", "Десятка", "Finish 10 tasks", "Закрой 10 задач", s => s.tasks >= 10],
        ["fifty", "50", "Mountain mover", "Двигаешь горы", "Finish 50 tasks", "Закрой 50 задач", s => s.tasks >= 50],
        ["goal", "◎", "On target", "В яблочко", `Finish ${DAILY_GOAL} tasks in one day`, `Закрой ${DAILY_GOAL} задачи за день`, () => (state.log[todayStr()] || 0) >= DAILY_GOAL],
        ["streak3", "△", "Warming up", "Разогрев", "3 days in a row", "3 дня подряд", s => s.streak >= 3],
        ["streak7", "▲", "Unstoppable week", "Неделя без пауз", "7 days in a row", "7 дней подряд", s => s.streak >= 7],
        ["streak30", "◆", "Habit made", "Привычка готова", "30 days in a row", "30 дней подряд", s => s.streak >= 30],
        ["focus1", "1h", "Deep work", "Глубокая работа", "1 hour in the focus timer", "1 час в таймере фокуса", s => s.focusMin >= 60],
        ["focus10", "10h", "Focus master", "Мастер фокуса", "10 hours in the focus timer", "10 часов в таймере фокуса", s => s.focusMin >= 600],
        ["early", "↑", "Early bird", "Ранняя пташка", "Finish a task before 9:00", "Закрой задачу до 9:00", () => new Date().getHours() < 9 && (state.log[todayStr()] || 0) > 0],
        ["calendar", "⇄", "Connected", "На связи", "Import your Google Calendar", "Импортируй Google Календарь", () => !!state.gcalImported],
        ["calm", "≈", "Calm day", "Спокойный день", "Keep the overload index under 50 with 3+ tasks done", "Индекс перегрузки ниже 50 и 3+ задачи", () => metrics().index < 50 && (state.log[todayStr()] || 0) >= 3]
    ];
    function checkBadges(loud) {
        ensure();
        const s = { ...totals(), streak: streak() };
        let changed = false;
        BADGES.forEach(b => {
            if (state.badges[b[0]] || !b[6](s)) return;
            state.badges[b[0]] = todayStr(); changed = true;
            if (loud) { toast(`${b[1]} ${T("Achievement", "Достижение")}: ${T(b[2], b[3])}`); confetti(); }
        });
        if (changed) { save(); render(); }
    }

    // ---------- study tips (research-backed, short) ----------
    const TIPS = [
        ["Memory", "Память", "Test yourself instead of re-reading. Closing the book and recalling beats a second read by a wide margin.", "Проверяй себя вместо перечитывания. Закрыть учебник и вспомнить — намного эффективнее второго прочтения."],
        ["Memory", "Память", "Spread practice out: 3 × 20 minutes on different days sticks better than one hour today.", "Распределяй повторение: 3 раза по 20 минут в разные дни запоминается лучше, чем час сегодня."],
        ["Memory", "Память", "Explain a topic out loud as if to a friend. The places where you stumble are what to study next.", "Объясни тему вслух, как другу. Места, где запнулся, — это то, что надо повторить."],
        ["Memory", "Память", "Mix problem types in one session (algebra, geometry, statistics) instead of 20 of the same kind.", "Смешивай типы задач в одной сессии (алгебра, геометрия, статистика), а не 20 одинаковых подряд."],
        ["Focus", "Фокус", "Phone in another room, not just face down. Even a silent phone on the desk pulls attention.", "Телефон — в другую комнату, а не экраном вниз. Даже беззвучный телефон на столе забирает внимание."],
        ["Focus", "Фокус", "Can't start? Commit to only 5 minutes. Starting is the hardest part, and you usually keep going.", "Не можешь начать? Договорись с собой только на 5 минут. Начать — самое трудное, дальше обычно идёт само."],
        ["Focus", "Фокус", "Write the very first action, not the task: not «essay» but «open doc and write 3 bullet points».", "Записывай первое действие, а не задачу: не «эссе», а «открыть документ и набросать 3 пункта»."],
        ["Focus", "Фокус", "One tab, one task. Switching between tasks costs minutes of refocus every time.", "Одна вкладка — одна задача. Каждое переключение стоит минут на то, чтобы снова сосредоточиться."],
        ["Rest", "Отдых", "Breaks away from screens restore focus better than scrolling. Walk, stretch, look out the window.", "Перерыв без экрана восстанавливает лучше, чем лента. Пройдись, потянись, посмотри в окно."],
        ["Rest", "Отдых", "A 10–20 minute nap boosts alertness without the grogginess. Longer naps can leave you foggy.", "Сон 10–20 минут бодрит без вялости. Дольше — можно проснуться разбитым."],
        ["Sleep", "Сон", "Sleep after studying is when memories get saved. An all-nighter before an exam erases part of what you learned.", "Во сне знания закрепляются. Бессонная ночь перед экзаменом стирает часть выученного."],
        ["Sleep", "Сон", "Same wake-up time every day, weekends too. It makes mornings sharper within a week.", "Вставай в одно время каждый день, даже в выходные. Через неделю утро станет бодрее."],
        ["Sleep", "Сон", "No bright screens 30–60 minutes before bed. Read on paper or plan tomorrow instead.", "За 30–60 минут до сна — без ярких экранов. Лучше почитай на бумаге или распланируй завтра."],
        ["Exams", "Экзамены", "Do full practice tests under real timing. Speed is a skill you train, not a talent.", "Решай полные пробники на реальное время. Скорость — навык, который тренируется."],
        ["Exams", "Экзамены", "Keep a mistakes log: every wrong answer, why, and the rule. Review it before each test.", "Веди журнал ошибок: каждый неверный ответ, почему и какое правило. Перечитывай перед каждым тестом."],
        ["Exams", "Экзамены", "Nervous before a test? Write your worries down for 10 minutes. It frees working memory.", "Волнуешься перед тестом? Выпиши тревоги на бумагу за 10 минут. Это освобождает рабочую память."],
        ["Exams", "Экзамены", "Stuck on a question? Mark it and move on. Come back with fresh eyes at the end.", "Застрял на вопросе? Отметь и иди дальше. Вернись к нему в конце свежим взглядом."],
        ["Planning", "Планирование", "Plan tomorrow tonight: 3 tasks max. A short list gets done, a long one gets avoided.", "Планируй завтра с вечера: максимум 3 задачи. Короткий список выполняется, длинный — откладывается."],
        ["Planning", "Планирование", "Hardest task first, while your energy is high. Easy tasks fit into the tired hours.", "Самую трудную задачу — первой, пока есть силы. Лёгкие подойдут для уставших часов."],
        ["Planning", "Планирование", "Everything takes longer than you think. Add 30% to your estimates.", "Всё занимает больше времени, чем кажется. Прибавляй 30% к своим оценкам."],
        ["Planning", "Планирование", "Under 2 minutes? Do it now instead of putting it on the list.", "Меньше 2 минут? Сделай сразу, а не записывай в список."],
        ["Energy", "Энергия", "Drink water. Even mild dehydration lowers focus and mood.", "Пей воду. Даже лёгкое обезвоживание снижает концентрацию и настроение."],
        ["Energy", "Энергия", "10 minutes of movement before studying wakes up the brain better than coffee.", "10 минут движения перед учёбой будят мозг лучше кофе."],
        ["Energy", "Энергия", "Daylight in the morning sets your body clock: go outside for 10 minutes after waking.", "Утренний дневной свет настраивает биочасы: выйди на улицу на 10 минут после пробуждения."]
    ];
    let tipShift = 0;
    function contextTip() {
        const m = metrics(), urgent = state.tasks.find(t => { const d = dueInfo(t); return d && d.hrs > 0 && d.hrs < 24; });
        if (m.index >= 75) return T("Today is in the red zone. Press «Unload today» and keep only what matters.", "Сегодня красная зона. Нажми «Разгрузить сегодня» и оставь только главное.");
        if (urgent) return T(`«${urgent.title}» is due within 24 hours. Start with it.`, `«${urgent.title}» — дедлайн меньше чем через сутки. Начни с неё.`);
        const h = new Date().getHours();
        if (h >= 23 || h < 5) return T("It's late. Sleep now protects what you learned today.", "Уже поздно. Сон сейчас сохранит то, что ты выучил(а) сегодня.");
        return "";
    }

    // ---------- Google Calendar import ----------
    const ICS_WINDOW_DAYS = 14;
    // wall-clock time in a named time zone (TZID=Europe/Moscow) -> the real moment, so events land at the right hour here
    function zoned(y, mo, d, h, mi, tz) {
        const guess = Date.UTC(y, mo - 1, d, h, mi);
        try {
            const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric" })
                .formatToParts(new Date(guess)).map(x => [x.type, x.value]));
            return new Date(guess - (Date.UTC(+p.year, p.month - 1, +p.day, +p.hour % 24, +p.minute) - guess));
        } catch (e) { return new Date(y, mo - 1, d, h, mi); } // unknown zone: read it as local time
    }
    function parseIcsDate(v, params) {
        if (/VALUE=DATE(?!-)/.test(params) || /^\d{8}$/.test(v)) return null; // all-day: skipped
        const m = v.match(/^(\d{4})(\d\d)(\d\d)T(\d\d)(\d\d)(\d\d)?(Z)?$/);
        if (!m) return null;
        const tz = (params.match(/TZID=([^;:]+)/) || [])[1];
        if (m[7]) return new Date(Date.UTC(+m[1], m[2] - 1, +m[3], +m[4], +m[5]));
        if (tz) return zoned(+m[1], +m[2], +m[3], +m[4], +m[5], tz.replace(/^"|"$/g, ""));
        return new Date(+m[1], m[2] - 1, +m[3], +m[4], +m[5]);
    }
    function parseICS(text) {
        const lines = text.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "").split(/\r?\n/);
        const out = []; let ev = null;
        for (const line of lines) {
            if (line === "BEGIN:VEVENT") { ev = { EXDATES: [] }; continue; }
            if (line === "END:VEVENT") { if (ev) out.push(ev); ev = null; continue; }
            if (!ev) continue;
            const i = line.indexOf(":"); if (i < 0) continue;
            const head = line.slice(0, i), value = line.slice(i + 1), [name, ...params] = head.split(";");
            // a repeating event can have several EXDATE lines (deleted days), each with one or more dates
            if (name === "EXDATE") { value.split(",").forEach(v => ev.EXDATES.push(parseIcsDate(v, params.join(";")) || v.slice(0, 8))); continue; }
            ev[name] = value; ev[name + "_p"] = params.join(";");
        }
        return out;
    }
    const dayKey = d => toLocalInput(d).slice(0, 10).replace(/-/g, "");
    // moved = "UID|time" of single days of a repeating event that were changed in Google (they come as their own events)
    function expand(ev, from, to, moved) {
        const start = parseIcsDate(ev.DTSTART || "", ev.DTSTART_p || "");
        if (!start || (ev.STATUS || "").toUpperCase() === "CANCELLED") return [];
        const end = parseIcsDate(ev.DTEND || "", ev.DTEND_p || "");
        const minutes = end ? Math.round((end - start) / 6e4) : 60;
        const items = [], rr = ev.RRULE || "";
        const freq = (rr.match(/FREQ=(\w+)/) || [])[1], until = (rr.match(/UNTIL=([0-9TZ]+)/) || [])[1], count = +(rr.match(/COUNT=(\d+)/) || [])[1] || 0;
        const every = Math.max(1, +(rr.match(/INTERVAL=(\d+)/) || [])[1] || 1);
        const days = ((rr.match(/BYDAY=([A-Z0-9,+-]+)/) || [])[1] || "").split(",").filter(Boolean).map(d => ["SU", "MO", "TU", "WE", "TH", "FR", "SA"].indexOf(d.slice(-2)));
        const stop = until ? parseIcsDate(until.length === 8 ? until + "T235900" : until, "") || to : to;
        const skip = d => ev.EXDATES.some(x => (x instanceof Date ? Math.abs(x - d) < 6e4 : x === dayKey(d))) || (moved && moved.has(ev.UID + "|" + d.getTime()));
        if (!freq || !["DAILY", "WEEKLY"].includes(freq)) { if (start >= from && start <= to) items.push(start); }
        else {
            const first = toLocalInput(start).slice(0, 10), monday0 = (start.getDay() + 6) % 7; // weeks start on Monday
            let n = 0, d = new Date(start);
            // old repeating events (lessons since September): jump close to today, unless COUNT needs every past day counted
            if (!count && start < from) d.setDate(d.getDate() + Math.max(0, daysBetween(first, toLocalInput(from).slice(0, 10)) - 1));
            for (; d <= to && d <= stop; d.setDate(d.getDate() + 1)) {
                const i = daysBetween(first, toLocalInput(d).slice(0, 10));
                const ok = freq === "DAILY" ? i % every === 0
                    : Math.floor((i + monday0) / 7) % every === 0 && (days.length ? days.includes(d.getDay()) : d.getDay() === start.getDay());
                if (!ok) continue;
                n++; if (count && n > count) break;
                if (d >= from && !skip(d)) items.push(new Date(d));
            }
        }
        return items.map(s => ({ ext: (ev.UID || ev.SUMMARY) + "|" + s.toISOString(), title: (ev.SUMMARY || "Event").replace(/\\([,;\\])/g, "$1").replace(/\\n/gi, " "), start: s, minutes: Math.max(5, Math.min(720, minutes)) }));
    }
    // all events of one or more calendars, with repeating events unrolled for the next ICS_WINDOW_DAYS days
    function eventsFromIcs(texts) {
        const from = new Date(); from.setHours(0, 0, 0, 0);
        const to = new Date(from); to.setDate(to.getDate() + ICS_WINDOW_DAYS);
        const all = texts.flatMap(parseICS), moved = new Set();
        all.forEach(ev => { if (ev["RECURRENCE-ID"]) { const t = parseIcsDate(ev["RECURRENCE-ID"], ev["RECURRENCE-ID_p"] || ""); if (t) moved.add(ev.UID + "|" + t.getTime()); } });
        return all.flatMap(ev => expand(ev, from, to, ev["RECURRENCE-ID"] ? null : moved));
    }
    // put events into LoadMind as fixed-time tasks (busy blocks the planner works around)
    function mergeEvents(events, source, removeMissing) {
        const now = new Date(), byExt = new Map(state.tasks.filter(t => t.ext).map(t => [t.ext, t]));
        let added = 0, updated = 0, removed = 0;
        const seen = new Set();
        events.forEach(e => {
            seen.add(e.ext);
            const at = toLocalInput(e.start), t = byExt.get(e.ext);
            if (t) { if (t.title !== e.title || t.at !== at || t.minutes !== e.minutes) { Object.assign(t, { title: e.title, at, minutes: e.minutes }); updated++; } return; }
            state.tasks.push({ id: state.nextId++, title: e.title, minutes: e.minutes, type: parseQuick(e.title).type, done: false, due: "", at, day: "", prio: 0, repeat: "", src: source, ext: e.ext, gid: e.gid || "" });
            added++;
        });
        if (removeMissing) {
            const before = state.tasks.length;
            state.tasks = state.tasks.filter(t => !(t.src === source && !t.done && t.at && new Date(t.at) > now && !seen.has(t.ext)));
            removed = before - state.tasks.length;
        }
        state.gcalImported = new Date().toISOString();
        save(); render(); checkBadges(true);
        return { added, updated, removed };
    }
    // Google Calendar exports a .zip with one .ics per calendar. It is opened right here, so nobody has to unzip it first.
    async function unzipIcs(buf) {
        const v = new DataView(buf), out = [];
        let e = buf.byteLength - 22;
        while (e >= 0 && v.getUint32(e, true) !== 0x06054b50) e--;
        if (e < 0) throw new Error("zip");
        let p = v.getUint32(e + 16, true);
        for (let i = 0, n = v.getUint16(e + 10, true); i < n && v.getUint32(p, true) === 0x02014b50; i++) {
            const method = v.getUint16(p + 10, true), size = v.getUint32(p + 20, true), nameLen = v.getUint16(p + 28, true), local = v.getUint32(p + 42, true);
            const name = new TextDecoder().decode(new Uint8Array(buf, p + 46, nameLen));
            p += 46 + nameLen + v.getUint16(p + 30, true) + v.getUint16(p + 32, true);
            if (!/\.ics$/i.test(name)) continue;
            const data = new Uint8Array(buf, local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true), size);
            if (method === 0) out.push(new TextDecoder().decode(data));
            else if (method === 8) out.push(await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).text());
        }
        return out;
    }
    async function importIcsFiles(files) {
        calMsg(T("Reading the file…", "Читаю файл…"));
        try {
            const texts = [];
            for (const f of files) {
                const buf = await f.arrayBuffer(), head = new Uint8Array(buf, 0, Math.min(4, buf.byteLength));
                if (head[0] === 0x50 && head[1] === 0x4b && head[2] === 3 && head[3] === 4) texts.push(...await unzipIcs(buf)); // "PK": a zip
                else texts.push(new TextDecoder().decode(buf));
            }
            if (!texts.some(t => t.includes("BEGIN:VCALENDAR"))) { calMsg(T("This is not a calendar file. Pick the .zip or .ics that Google Calendar exported.", "Это не файл календаря. Выбери .zip или .ics, который выгрузил Google Календарь.")); return; }
            const events = eventsFromIcs(texts);
            if (!events.length) { calMsg(T(`The file has no events with a time in the next ${ICS_WINDOW_DAYS} days (all-day events are skipped).`, `В файле нет событий со временем на ближайшие ${ICS_WINDOW_DAYS} дней (события на весь день пропускаются).`)); return; }
            const res = mergeEvents(events, "ics", false);
            calMsg(res.added || res.updated
                ? T(`Imported from the file: ${res.added} new, ${res.updated} updated (next ${ICS_WINDOW_DAYS} days).`, `Импорт из файла: новых ${res.added}, обновлено ${res.updated} (на ${ICS_WINDOW_DAYS} дней вперёд).`)
                : T(`All ${events.length} events from the file are already in LoadMind.`, `Все события из файла (${events.length}) уже есть в LoadMind.`));
        } catch (e) {
            calMsg(typeof DecompressionStream === "undefined"
                ? T("This browser can't open .zip files. Unzip it and pick the .ics file inside.", "Этот браузер не открывает .zip. Распакуй архив и выбери .ics-файл из него.")
                : T("Couldn't read the file. Unzip it and pick the .ics file inside.", "Не получилось прочитать файл. Распакуй архив и выбери .ics-файл из него."));
        }
    }

    // direct connection through Google (needs GOOGLE_CLIENT_ID): reads events into LoadMind and sends LoadMind tasks back
    let token = null, tokenExp = 0, tokenClient = null, gisLoading = null;
    try { const s = JSON.parse(sessionStorage.getItem("loadmind.gtoken")); if (s && s.exp > Date.now()) { token = s.t; tokenExp = s.exp; } } catch (e) {}
    function loadGis() {
        if (window.google && google.accounts && google.accounts.oauth2) return Promise.resolve();
        return gisLoading || (gisLoading = new Promise((ok, bad) => { const s = document.createElement("script"); s.src = "https://accounts.google.com/gsi/client"; s.onload = ok; s.onerror = bad; document.head.appendChild(s); }));
    }
    function getToken(interactive) {
        if (token && tokenExp > Date.now() + 6e4) return Promise.resolve(token);
        return loadGis().then(() => new Promise((ok, bad) => {
            tokenClient = google.accounts.oauth2.initTokenClient({
                client_id: GOOGLE_CLIENT_ID, scope: "https://www.googleapis.com/auth/calendar.events",
                callback: r => {
                    if (r.error) return bad(new Error(r.error));
                    token = r.access_token; tokenExp = Date.now() + (r.expires_in || 3600) * 1000;
                    try { sessionStorage.setItem("loadmind.gtoken", JSON.stringify({ t: token, exp: tokenExp })); } catch (e) {}
                    ok(token);
                },
                error_callback: e => bad(new Error(e.type || "popup"))
            });
            tokenClient.requestAccessToken({ prompt: interactive ? "" : "none" });
        }));
    }
    async function gapi(path, opts = {}) {
        const t = await getToken(opts.interactive);
        const r = await fetch("https://www.googleapis.com/calendar/v3/" + path, { method: opts.method || "GET", headers: { authorization: "Bearer " + t, "content-type": "application/json" }, body: opts.body ? JSON.stringify(opts.body) : undefined });
        if (r.status === 401) { token = null; sessionStorage.removeItem("loadmind.gtoken"); throw new Error("auth"); }
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.status === 204 ? {} : r.json();
    }
    let syncing = false;
    async function syncGoogle(interactive) {
        if (syncing || !GOOGLE_CLIENT_ID) return;
        syncing = true; calMsg(T("Syncing with Google Calendar…", "Синхронизация с Google Календарём…"));
        try {
            const from = new Date(); from.setHours(0, 0, 0, 0);
            const to = new Date(from); to.setDate(to.getDate() + ICS_WINDOW_DAYS);
            // 1. Google -> LoadMind
            const data = await gapi(`calendars/primary/events?singleEvents=true&orderBy=startTime&maxResults=250&timeMin=${from.toISOString()}&timeMax=${to.toISOString()}`, { interactive });
            const mine = new Set(state.tasks.filter(t => t.gid).map(t => t.gid));
            const events = (data.items || []).filter(e => e.start && e.start.dateTime && e.status !== "cancelled" && !mine.has(e.id) && !(e.extendedProperties && e.extendedProperties.private && e.extendedProperties.private.loadmind))
                .map(e => ({ ext: "g|" + e.id, gid: "", title: e.summary || "Event", start: new Date(e.start.dateTime), minutes: Math.max(5, Math.min(720, Math.round((new Date(e.end.dateTime) - new Date(e.start.dateTime)) / 6e4))) }));
            const res = mergeEvents(events, "gcal", true);
            // 2. LoadMind -> Google: tasks with a time or a deadline that were made in LoadMind
            let sent = 0;
            for (const t of state.tasks.filter(t => !t.done && !t.src && (t.at || t.due))) {
                const end = t.at ? new Date(new Date(t.at).getTime() + t.minutes * 6e4) : new Date(t.due);
                const start = t.at ? new Date(t.at) : new Date(end.getTime() - Math.min(t.minutes, 60) * 6e4);
                if (end < from) continue;
                const body = { summary: (t.at ? "" : "⚑ ") + t.title, description: "LoadMind", start: { dateTime: start.toISOString() }, end: { dateTime: end.toISOString() }, extendedProperties: { private: { loadmind: String(t.id) } } };
                const sig = body.summary + body.start.dateTime + body.end.dateTime;
                if (t.gid && t.gsig === sig) continue;
                try {
                    const ev = t.gid ? await gapi(`calendars/primary/events/${t.gid}`, { method: "PATCH", body }) : await gapi("calendars/primary/events", { method: "POST", body });
                    t.gid = ev.id; t.gsig = sig; sent++;
                } catch (e) { if (t.gid && /404|410/.test(e.message)) { t.gid = ""; t.gsig = ""; } }
            }
            state.gcalSync = new Date().toISOString();
            save(); render();
            calMsg(T(`Synced: from Google ${res.added} new, ${res.updated} updated, ${res.removed} removed · to Google ${sent}.`, `Готово: из Google новых ${res.added}, обновлено ${res.updated}, удалено ${res.removed} · в Google отправлено ${sent}.`));
        } catch (e) {
            calMsg(/auth|popup|access_denied|interaction|consent/i.test(e.message)
                ? T("Press «Connect Google Calendar» and allow access.", "Нажми «Подключить Google Календарь» и разреши доступ.")
                : T("Google Calendar error: ", "Ошибка Google Календаря: ") + e.message);
        }
        syncing = false;
        renderCal();
    }
    // coming back to the tab re-syncs if already connected (no popup)
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && token && state.gcalSync) syncGoogle(false); });
    setInterval(() => { if (token && state.gcalSync && document.visibilityState === "visible") syncGoogle(false); }, 10 * 6e4);

    let lastMsg = "";
    function calMsg(m) { lastMsg = m; renderCal(); }

    // ---------- toast + confetti ----------
    function toast(text) {
        let box = $("lmToasts");
        if (!box) { box = el("div", "lm-toasts"); box.id = "lmToasts"; box.setAttribute("aria-live", "polite"); box.dataset.notr = ""; document.body.appendChild(box); }
        const t = el("div", "lm-toast", text); box.appendChild(t);
        setTimeout(() => t.classList.add("out"), 3200); setTimeout(() => t.remove(), 3800);
    }
    function confetti() {
        if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
        const box = el("div", "lm-confetti"); document.body.appendChild(box);
        for (let i = 0; i < 40; i++) {
            const p = el("i"); p.style.left = Math.random() * 100 + "vw"; p.style.animationDelay = Math.random() * .4 + "s";
            p.style.background = i % 3 ? "var(--accent)" : "var(--ink)"; p.style.transform = `rotate(${Math.random() * 360}deg)`;
            box.appendChild(p);
        }
        setTimeout(() => box.remove(), 2600);
    }

    // ---------- render ----------
    function renderToday() {
        const box = $("lmToday"); if (!box) return;
        const s = totals(), st = streak(), doneToday = (state.log || {})[todayStr()] || 0;
        const next = buildPlan().find(p => p.id && p.start >= new Date().getHours() * 60 + new Date().getMinutes() - 30) || buildPlan().find(p => p.id);
        box.replaceChildren();
        // streak
        const a = el("div", "lm-card");
        a.append(el("small", "", T("Streak", "Серия")), el("strong", "", `▲ ${st}`), el("p", "", active(todayStr())
            ? T("Today counts. Come back tomorrow to keep it.", "Сегодня засчитано. Вернись завтра, чтобы не прервать.")
            : st ? T("Finish one task today or the streak resets.", "Закрой одну задачу сегодня, иначе серия сгорит.") : T("Finish one task to start a streak.", "Закрой одну задачу, чтобы начать серию.")));
        if (!active(todayStr()) && st) a.classList.add("risk");
        // daily goal
        const b = el("div", "lm-card");
        const ring = el("div", "lm-ring"); ring.style.setProperty("--p", Math.min(100, doneToday / DAILY_GOAL * 100));
        ring.append(el("span", "", `${Math.min(doneToday, 99)}/${DAILY_GOAL}`));
        b.append(el("small", "", T("Goal for today", "Цель дня")), ring, el("p", "", doneToday >= DAILY_GOAL ? T("Done! Anything more is a bonus.", "Готово! Всё, что дальше, — бонус.") : T(`${DAILY_GOAL - doneToday} more task(s) to go`, `Осталось задач: ${DAILY_GOAL - doneToday}`)));
        // level
        const c = el("div", "lm-card");
        const bar = el("div", "lm-bar"); const fill = el("i"); fill.style.width = s.pct + "%"; bar.append(fill);
        c.append(el("small", "", T("Level", "Уровень")), el("strong", "", `${s.level}`), bar, el("p", "", T(`${s.xp} XP · ${s.toNext} to level ${s.level + 1}`, `${s.xp} XP · до уровня ${s.level + 1}: ${s.toNext}`)));
        // next up
        const d = el("div", "lm-card lm-next");
        d.append(el("small", "", T("Next up", "Дальше по плану")));
        if (next) {
            const n = el("strong", "lm-next-title", next.title); d.append(n, el("p", "", `${next.time} · ${isRu() ? dur(next.minutes).replace(/ h/g, " ч").replace(/ min/g, " мин") : dur(next.minutes)}`));
            const go = el("button", "secondary-button", T("Start focus", "Начать фокус")); go.type = "button"; go.dataset.focus = next.id; d.append(go);
        } else d.append(el("strong", "lm-next-title", T("All clear", "Всё сделано")), el("p", "", T("Add a task in the field at the top.", "Добавь задачу в поле наверху.")));
        box.append(a, b, c, d);

        // welcome back / weekly recap line
        const line = $("lmRecap");
        if (line) {
            const w = weekTasks(0), pw = weekTasks(1);
            let text = T(`This week: ${w} task(s) done`, `За неделю закрыто задач: ${w}`) + (pw ? (w >= pw ? T(` · ↑ ${w - pw} vs last week`, ` · ↑ на ${w - pw} больше, чем на прошлой`) : T(` · ${pw - w} behind last week`, ` · на ${pw - w} меньше, чем на прошлой`)) : "");
            if (welcomeGap > 1) text = T(`Welcome back! You were away ${welcomeGap} days. `, `С возвращением! Тебя не было ${welcomeGap} дн. `) + text;
            line.textContent = text;
        }
    }
    function renderBadges() {
        const box = $("lmBadges"); if (!box) return;
        ensure();
        box.replaceChildren(...BADGES.map(b => {
            const got = state.badges[b[0]], c = el("div", "lm-badge" + (got ? " got" : ""));
            c.title = T(b[4], b[5]);
            c.append(el("span", "lm-badge-ico", b[1]), el("b", "", T(b[2], b[3])), el("small", "", got ? T("Unlocked ", "Получено ") + shortDate(got) : T(b[4], b[5])));
            return c;
        }));
        $("lmBadgesHead").textContent = T(`Achievements · ${Object.keys(state.badges).length}/${BADGES.length}`, `Достижения · ${Object.keys(state.badges).length}/${BADGES.length}`);
    }
    function renderTips() {
        const box = $("lmTips"); if (!box) return;
        const dayN = Math.floor((Date.now() - new Date().getTimezoneOffset() * 6e4) / 864e5);
        const tip = TIPS[((dayN + tipShift) % TIPS.length + TIPS.length) % TIPS.length], ctx = contextTip();
        box.querySelector(".lm-tip-cat").textContent = T("Lifehack · ", "Лайфхак · ") + T(tip[0], tip[1]);
        box.querySelector(".lm-tip-text").textContent = T(tip[2], tip[3]);
        box.querySelector(".lm-tip-next").textContent = T("Another tip →", "Ещё лайфхак →");
        const c = box.querySelector(".lm-tip-ctx"); c.textContent = ctx; c.hidden = !ctx;
    }
    function renderCal() {
        if (!$("lmCal")) return;
        const n = state.tasks.filter(t => (t.src === "gcal" || t.src === "ics") && !t.done).length;
        const connected = !!state.gcalSync, live = connected && !!token;
        const when = iso => new Date(iso).toLocaleString(isRu() ? "ru-RU" : "en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

        // where it can be opened from: the top bar, the plan on Today, Settings
        const short = syncing ? T("Syncing…", "Синхронизация…")
            : live ? T("Calendar synced", "Календарь синхронизирован")
            : connected ? T("Update calendar", "Обновить календарь")
            : state.gcalImported ? T("Calendar from file", "Календарь из файла")
            : T("Connect Google Calendar", "Подключить Google Календарь");
        $("calPillText").textContent = short;
        $("calPill").classList.toggle("on", connected || !!state.gcalImported);
        $("calPill").title = T("Google Calendar", "Google Календарь");
        $("calBtnText").textContent = T("Calendar", "Календарь");
        $("calBtn").title = T("Google Calendar", "Google Календарь");
        $("calBtn").setAttribute("aria-label", T("Google Calendar", "Google Календарь"));
        $("calBtn").querySelector(".cal-dot").hidden = !connected;

        const status = live ? T(`Connected. Last sync: ${when(state.gcalSync)}. It syncs again by itself every 10 minutes while LoadMind is open.`, `Подключён. Последняя синхронизация: ${when(state.gcalSync)}. Пока LoadMind открыт, он сам обновляется каждые 10 минут.`)
            : connected ? T(`Was connected before (last sync: ${when(state.gcalSync)}). Press «Sync» to update.`, `Уже подключали (последняя синхронизация: ${when(state.gcalSync)}). Нажми «Синхронизировать», чтобы обновить.`)
            : state.gcalImported ? T(`Loaded from a file: ${when(state.gcalImported)}. Events for the next 14 days are in your plan.`, `Загружен из файла: ${when(state.gcalImported)}. События на 14 дней вперёд уже в плане.`)
            : T("Not connected yet.", "Пока не подключён.");
        $("calStatus").textContent = status;
        $("calStatus").classList.toggle("on", connected || !!state.gcalImported);
        $("calSetText").textContent = status;
        $("calSetHead").textContent = T("Google Calendar", "Google Календарь");
        $("calOpenSettings").textContent = T("Open calendar settings", "Открыть календарь");

        $("calHead").textContent = T("Google Calendar", "Google Календарь");
        $("calClose").setAttribute("aria-label", T("Close", "Закрыть"));
        $("calStepSync").hidden = !GOOGLE_CLIENT_ID;
        $("calSyncH").textContent = connected ? T("Sync both ways", "Синхронизация в обе стороны") : T("Connect once, then it works by itself", "Подключи один раз, дальше всё само");
        $("calSyncP").textContent = T("LoadMind takes your events for the next 14 days (classes, training, meetings) and puts them into the plan at their time, so everything else is planned around them. Your LoadMind tasks with a time or a deadline go to Google Calendar.",
            "LoadMind берёт события на 14 дней вперёд (уроки, секции, встречи) и ставит их в план на их время, а остальное планирует вокруг. Твои задачи со временем или дедлайном уходят в Google Календарь.");
        $("calGoogle").textContent = syncing ? T("Syncing…", "Синхронизация…") : connected ? T("Sync now", "Синхронизировать") : T("Connect Google Calendar", "Подключить Google Календарь");
        $("calGoogle").disabled = syncing;

        $("calOutH").textContent = T("Send the plan to a calendar without connecting", "Отправить план в календарь без подключения");
        $("calOutP").textContent = T("Download an .ics file with today's plan and your deadlines. On a phone the calendar app opens it; in Google Calendar on a computer use Settings → Import & export → Import. One task at a time: «+ Calendar» next to it in Tasks.",
            "Скачай файл .ics с планом на сегодня и дедлайнами. На телефоне его откроет приложение календаря, в Google Календаре на компьютере: Настройки → Импорт и экспорт → Импорт. Одну задачу можно отправить кнопкой «+ Календарь» рядом с ней в разделе «Задачи».");
        $("icsButton").textContent = T("Download plan and deadlines (.ics)", "Скачать план и дедлайны (.ics)");

        $("calFileH").textContent = T("Can't connect to Google? Load the calendar as a file", "Не получается подключить Google? Загрузи календарь файлом");
        const steps = isRu()
            ? ["На компьютере открой calendar.google.com → Настройки (шестерёнка) → Импорт и экспорт.", "Нажми «Экспорт», скачается .zip-файл.", "Выбери этот файл здесь. Распаковывать не нужно: события на 14 дней вперёд сразу встанут в план."]
            : ["On a computer open calendar.google.com → Settings (the gear) → Import & export.", "Press «Export»: a .zip file downloads.", "Pick that file here, no need to unzip it. Events for the next 14 days go straight into the plan."];
        $("calFileSteps").replaceChildren(...steps.map(t => el("li", "", t)));
        $("calFileBtn").textContent = T("Choose calendar file", "Выбрать файл календаря");

        $("calRemove").hidden = !n;
        $("calRemove").textContent = T(`Remove imported events (${n})`, `Убрать импортированные события (${n})`);
        $("calMsg").textContent = lastMsg;
    }

    // the calendar window
    const calVeil = $("calVeil");
    let calBack = null;
    function openCal() {
        calBack = document.activeElement;
        renderCal();
        calVeil.hidden = false;
        document.body.classList.add("auth-open");
        setTimeout(() => { const b = $("calStepSync").hidden ? $("icsButton") : $("calGoogle"); b && b.focus(); }, 30);
    }
    function closeCal() {
        calVeil.hidden = true;
        document.body.classList.remove("auth-open");
        if (calBack && calBack.focus) calBack.focus();
    }
    document.addEventListener("click", e => {
        if (e.target.closest("#calBtn, #calPill, #calOpenSettings")) openCal();
        else if (e.target.closest("#calClose")) closeCal();
    });
    calVeil.addEventListener("mousedown", e => { if (e.target === calVeil) closeCal(); });
    document.addEventListener("keydown", e => { if (!calVeil.hidden && e.key === "Escape") { e.preventDefault(); closeCal(); } });

    const origRender = render;
    render = function () {
        origRender.apply(this, arguments);
        try { renderToday(); renderBadges(); renderTips(); renderCal(); } catch (e) { console.error(e); }
        document.querySelectorAll(".lm-plan .task").forEach(row => {
            const c = row.querySelector(".check input"), t = c && state.tasks.find(x => x.id === Number(c.dataset.id)), sm = row.querySelector("small");
            if (t && (t.src === "gcal" || t.src === "ics") && sm && !sm.dataset.cal) { sm.dataset.cal = "1"; sm.textContent += " · Google"; }
        });
        document.querySelectorAll(".task-row").forEach(row => {
            const id = Number((row.querySelector("input[data-id]") || {}).dataset?.id), t = state.tasks.find(x => x.id === id);
            if (t && (t.src === "gcal" || t.src === "ics") && !row.querySelector(".lm-src")) row.querySelector(".task-name span").append(el("em", "lm-src", " · Google"));
        });
    };

    // ---------- events ----------
    document.addEventListener("click", e => {
        if (e.target.closest(".lm-tip-next")) { tipShift++; renderTips(); }
        if (e.target.closest("#calFileBtn")) $("calFile").click();
        if (e.target.closest("#calGoogle")) syncGoogle(true);
        if (e.target.closest("#calRemove")) {
            if (!confirm(T("Remove all imported calendar events from LoadMind? Google Calendar stays as it is.", "Убрать все импортированные события из LoadMind? В Google Календаре ничего не изменится."))) return;
            state.tasks = state.tasks.filter(t => !((t.src === "gcal" || t.src === "ics") && !t.done));
            save(); render();
        }
    });
    document.addEventListener("change", e => { if (e.target.id === "calFile" && e.target.files.length) { importIcsFiles([...e.target.files]); e.target.value = ""; } });
    // last visit, for the "welcome back" line
    let welcomeGap = 0;
    try {
        const lv = localStorage.getItem("loadmind.lastVisit");
        if (lv) welcomeGap = daysBetween(lv, todayStr());
        localStorage.setItem("loadmind.lastVisit", todayStr());
    } catch (e) {}

    ensure();
    // tasks finished before this version: count them once so levels don't start from zero
    if (!state.logInit) {
        state.tasks.filter(t => t.done && !t.doneAt).forEach(t => { t.doneAt = todayStr(); state.log[t.doneAt] = (state.log[t.doneAt] || 0) + 1; });
        state.logInit = 1; save();
    }
    render();
    setTimeout(() => checkBadges(false), 500);
})();
