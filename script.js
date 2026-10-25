const $ = id => document.getElementById(id);
const KEY = "loadmind.v1";
const WEIGHT = { exam: 1.3, study: 1.0, physical: 1.2, light: 0.4 };
const TYPE_LABEL = { exam: "High concentration", study: "Medium load", physical: "Physical load", light: "Light load" };
const TYPE_NAME = { exam: "Exam prep", study: "Study", physical: "Physical", light: "Light" };
const LEVELS = ["Low", "Normal", "High", "Critical"];

const PEAK = { morning: 8 * 60, day: 13 * 60, evening: 18 * 60 };
function soon(days, hour) { const d = new Date(); d.setDate(d.getDate() + days); d.setHours(hour, 0, 0, 0); return toLocalInput(d); }
function toLocalInput(d) { const p = n => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; }

function fillDays() {
    const ru = localStorage.getItem("loadmind.lang") === "ru", sel = $("taskDay");
    sel.innerHTML = "";
    const add = (v, t) => sel.appendChild(new Option(t, v));
    add("", ru ? "Без дедлайна" : "No deadline");
    for (let i = 0; i < 14; i++) {
        const d = new Date(); d.setDate(d.getDate() + i);
        const t = d.toLocaleDateString(ru ? "ru-RU" : "en-GB", { weekday: "short", day: "numeric", month: "short" });
        add(toLocalInput(d).slice(0, 10), i === 0 ? (ru ? "Сегодня, " : "Today, ") + t : i === 1 ? (ru ? "Завтра, " : "Tomorrow, ") + t : t);
    }
}

const fresh = () => ({
    settings: { name: "", start: "09:00", capacity: 8, peak: "morning", provider: "gemini", model: "", key: "", remind: false, pomoWork: 25, pomoShort: 5, pomoLong: 15, pomoEvery: 4 },
    focus: {},
    tasks: [
        { id: 1, title: "SAT Math", minutes: 50, type: "exam", done: false, due: soon(1, 18), prio: 2 },
        { id: 2, title: "IELTS Reading", minutes: 45, type: "exam", done: false },
        { id: 3, title: "Volleyball", minutes: 120, type: "physical", done: false },
        { id: 4, title: "Light review", minutes: 25, type: "light", done: false }
    ],
    nextId: 5, notes: "", notesScore: 0, categories: []
});

function load() {
    try {
        const raw = JSON.parse(localStorage.getItem(KEY));
        if (raw && Array.isArray(raw.tasks)) {
            return { ...fresh(), ...raw, settings: { ...fresh().settings, ...raw.settings } };
        }
    } catch (e) {}
    return fresh();
}
function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
    if (window.LoadMindAuth) LoadMindAuth.queue(); // signed in: upload to the account (auth.js)
}

let state = load();
let view = "dashboard";
const clamp = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));
const levelOf = v => (v < 25 ? 0 : v < 50 ? 1 : v < 75 ? 2 : 3);
const dur = m => (m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ""}` : `${m} min`);
const fmt = t => `${String(Math.floor(t / 60) % 24).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
const isRu = () => localStorage.getItem("loadmind.lang") === "ru";

// days: a task can be planned for a later day ("day", or the date of "at")
const todayStr = () => toLocalInput(new Date()).slice(0, 10);
const addDays = (s, n) => { const d = new Date(s.slice(0, 10) + "T00:00"); d.setDate(d.getDate() + n); return toLocalInput(d).slice(0, 10) + s.slice(10); };
const daysBetween = (a, b) => Math.round((new Date(b + "T00:00") - new Date(a + "T00:00")) / 864e5);
const planDay = t => (t.at ? t.at.slice(0, 10) : t.day || "");
const isToday = t => !t.done && (!planDay(t) || planDay(t) <= todayStr());
const todayTasks = () => state.tasks.filter(isToday);
// time still needed: focus sessions on a task count as progress
const left = t => Math.max(5, t.minutes - (t.focus || 0));
const PRIO_MARK = ["", "!", "!!", "!!!"];
const REPEAT_NAME = { daily: "every day", weekdays: "weekdays", weekly: "every week" };
const shortDate = s => new Date(s.slice(0, 10) + "T00:00").toLocaleDateString(isRu() ? "ru-RU" : "en-GB", { weekday: "short", day: "numeric", month: "short" });


// NLP: keyword analysis (EN + RU)
// "word*" = prefix match (stems), plain "word" = whole word only

const categories = {
    academic: { name: "academic", points: 20, keywords: [
        "study*", "school", "homework", "math*", "physics", "chemistry", "english", "reading", "writing", "lesson*", "assignment*",
        "школ*", "домашк*", "домашн*", "математик*", "физик*", "хими*", "англий*", "чтени*", "урок*", "занимал*", "занятия*"
    ] },
    exam: { name: "exam", points: 20, keywords: [
        "sat", "ielts", "exam*", "test*", "deadline*", "score", "practice test",
        "экзамен*", "тест*", "дедлайн*", "сдать"
    ] },
    sport: { name: "physical", points: 15, keywords: [
        "volleyball", "training*", "workout*", "gym", "running", "sport*", "match",
        "волейбол*", "трениров*", "спортзал*", "бегал*", "пробеж*", "матч*"
    ] },
    fatigue: { name: "fatigue", points: 25, keywords: [
        "tired", "exhausted", "fatigue", "stress*", "overwhelmed", "burnout", "no energy", "can't focus", "cannot focus",
        "sleepy", "sleep deprived", "хочу спать", "сонн*", "засыпа*", "не выспал*", "устал*", "устав*", "вымот*", "стресс*", "выгор*", "нет сил", "не могу сосредоточ*"
    ] },
    rest: { name: "recovery", points: -5, keywords: [
        "rest", "sleep*", "break*", "recovery", "relax*",
        "отдых*", "отдохн*", "спал*", "поспал*", "сон", "перерыв*", "расслаб*"
    ] }
};

const TASK_WORDS = ["need to", "have to", "must", "finish", "complete", "tomorrow", "deadline*",
    "надо", "нужно", "должн*", "закончить", "доделать", "сдать", "завтра"];

const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function matches(text, kw) {
    const stem = kw.endsWith("*");
    const body = escapeRe(stem ? kw.slice(0, -1) : kw);
    return new RegExp(`(?<![\\p{L}\\p{N}])${body}${stem ? "" : "(?![\\p{L}\\p{N}])"}`, "u").test(text);
}

function analyzeText(text) {
    const t = text.toLowerCase();
    let score = 10;
    const detectedCategories = [];

    for (const key in categories) {
        const c = categories[key];
        if (c.keywords.some(kw => matches(t, kw))) {
            detectedCategories.push(c.name);
            score += c.points;
        }
    }

    const taskCount = TASK_WORDS.filter(w => matches(t, w)).length;
    score += Math.min(taskCount * 3, 15);

    return { score: clamp(score), detectedCategories };
}

function generateAdvice(score) {
    if (score >= 75) return "Too much for one day. Keep the one or two things that matter most and move the rest.";
    if (score >= 50) return "Heavy day. Don't put two hard tasks back to back, leave a break between them.";
    if (score >= 25) return "Fine as it is. Just keep breaks between the hard blocks.";
    return "Light day. Nothing to change.";
}


// NLP: smart task input (EN + RU)

const DAYS = [["sun","воскр"],["mon","понед"],["tue","вторн"],["wed","сред"],["thu","четвер"],["fri","пятниц"],["sat","суббот"]];

function parseQuick(text) {
    let t = " " + text.trim() + " ";
    const NUMW = { "один": 1, "одну": 1, "два": 2, "две": 2, "три": 3, "четыре": 4, "пять": 5, "шесть": 6, "one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6 };
    t = t.replace(/(?<![\p{L}\p{N}])полтора(?=\s+час)/giu, "1.5")
         .replace(/(?<![\p{L}\p{N}])(один|одну|два|две|три|четыре|пять|шесть|one|two|three|four|five|six)(?=\s+(?:h|hr|hrs|hours?|ч|час|min|мин)[\p{L}]*)/giu, w => NUMW[w.toLowerCase()]);
    const cut = re => { const m = t.match(re); if (m) t = t.replace(re, " "); return m; };
    const B = "(?<![\\p{L}\\p{N}])", E = "(?![\\p{L}\\p{N}])";
    let minutes = 0, start = null, end = null, hh = null, mm = 0, prep = "", m;

    // priority, Todoist style: "!" / "!!" / "!!!", p1-p3, "срочно", "важно"
    let prio = 0;
    if ((m = cut(/(!{1,3})(?=\s)/))) prio = m[1].length;
    else if ((m = cut(new RegExp(`${B}(p[1-3]|срочно|urgent|asap|важно|important)${E}`, "iu")))) {
        const w = m[1].toLowerCase();
        prio = w[0] === "p" ? 4 - +w[1] : /срочно|urgent|asap/.test(w) ? 3 : 2;
    }

    // repeat: "every day", "по будням", "каждую неделю", "every friday"
    let repeat = "";
    if (cut(new RegExp(`${B}(every\\s*day|daily|каждый\\s+день|ежедневно)${E}`, "iu"))) repeat = "daily";
    else if (cut(new RegExp(`${B}(every\\s+weekday|weekdays|по\\s+будням)${E}`, "iu"))) repeat = "weekdays";
    else if (cut(new RegExp(`${B}(every\\s+week|weekly|каждую\\s+неделю|еженедельно)${E}`, "iu"))) repeat = "weekly";
    else if (cut(new RegExp(`${B}(every|каждый|каждую|каждое)(?=\\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|понедельник|вторник|среду|четверг|пятницу|субботу|воскресенье))`, "iu"))) repeat = "weekly";

    // time range: "13:00-17:00", "с 13:00 до 17:00", "from 13:00 to 17:00"
    if ((m = cut(new RegExp(`(?:${B}(?:с|from)\\s+)?${B}(\\d{1,2})[:.](\\d{2})\\s*(?:[-–—]|до|to|until)\\s*(\\d{1,2})[:.](\\d{2})${E}`, "iu")))) { start = +m[1] * 60 + +m[2]; end = +m[3] * 60 + +m[4]; }

    // duration: hours and minutes are added together ("1ч 40мин")
    if ((m = cut(/(\d+(?:[.,]\d+)?)\s*(h|hr|hrs|hours?|ч|час\p{L}*)(?![\p{L}])/iu))) minutes += Math.round(parseFloat(m[1].replace(",", ".")) * 60);
    if ((m = cut(/(\d+)\s*(min|mins|minutes?|м|мин\p{L}*)(?![\p{L}])/iu))) minutes += parseInt(m[1], 10);

    if (start === null) {
        if ((m = cut(new RegExp(`(?:${B}(at|в|к|до|by|before|due)\\s+)?${B}(\\d{1,2})[:.](\\d{2})${E}`, "iu")))) { prep = (m[1] || "").toLowerCase(); hh = +m[2]; mm = +m[3]; }
        else if ((m = cut(new RegExp(`${B}(at|в|к|by)\\s+(\\d{1,2})\\s*(am|pm|час\\p{L}*)?`, "iu")))) {
            prep = m[1].toLowerCase(); hh = +m[2]; if (m[3] && m[3].toLowerCase() === "pm" && hh < 12) hh += 12;
        }
    }

    // day: today / tomorrow / full weekday names only (so "SAT" stays a task name)
    const base = new Date(); base.setSeconds(0, 0);
    let dayWord = false;
    if (cut(new RegExp(`${B}(tomorrow|завтра)${E}`, "iu"))) { base.setDate(base.getDate() + 1); dayWord = true; }
    else if (cut(new RegExp(`${B}(today|сегодня)${E}`, "iu"))) dayWord = true;
    else {
        const WD = [/sunday|воскресень\p{L}*/, /monday|понедельник\p{L}*/, /tuesday|вторник\p{L}*/, /wednesday|сред[ауыеой]/, /thursday|четверг\p{L}*/, /friday|пятниц\p{L}*/, /saturday|суббот\p{L}*/];
        WD.forEach((re, i) => {
            if (dayWord) return;
            const full = new RegExp(`(?:${B}(?:on|в|во|к)\\s+)?${B}(${re.source})${E}`, "iu");
            if (full.test(t)) { t = t.replace(full, " "); base.setDate(base.getDate() + (((i - base.getDay() + 7) % 7) || (repeat ? 0 : 7))); dayWord = true; }
        });
    }

    const low = text.toLowerCase();
    const isDue = ["до", "к", "by", "before", "due"].includes(prep) || /(сдать|сдача|submit|deadline|дедлайн)|(^|\s)(by|before|due)\s|(^|\s)(до|к)\s+(завтра|сегодня|понедельник|вторник|сред|четверг|пятниц|суббот|воскресень)/.test(low);
    let due = "", at = "", day = "";
    const put = (min, d) => { const x = new Date(base); x.setHours(Math.floor(min / 60), min % 60, 0, 0); return toLocalInput(x); };
    if (start !== null) { at = put(start); if (!minutes) minutes = (end - start + 1440) % 1440; }
    else if (hh !== null) { if (isDue) due = put(hh * 60 + mm); else at = put(hh * 60 + mm); }
    else if (dayWord) { if (repeat) day = toLocalInput(base).slice(0, 10); else due = put(18 * 60); }
    if (day === todayStr()) day = "";

    let type = "study";
    if (categories.exam.keywords.some(k => matches(low, k))) type = "exam";
    else if (categories.sport.keywords.some(k => matches(low, k))) type = "physical";
    else if (/(review|read|check|email|повтор|прочит|почт|разобр)/i.test(low) && !categories.academic.keywords.some(k => matches(low, k))) type = "light";

    const title = t.replace(new RegExp(`${B}(due|by|on|at|в|к|до|с|from|to|на|надо|нужно|need to|have to)${E}`, "giu"), " ").replace(/[,;]+/g, " ").replace(/\s[-–—]\s|^\s*[-–—]|[-–—]\s*$/g, " ").replace(/\s+/g, " ").trim();
    return { title: title || text.trim(), minutes: clamp(minutes || 45, 5, 720), type, due, at, day, prio, repeat, sure: !!(minutes || due || at) };
}

function dueInfo(t) {
    if (!t.due || t.done) return null;
    const hrs = (new Date(t.due) - new Date()) / 36e5;
    const label = new Date(t.due).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
    return { label, hrs, cls: hrs < 0 ? "overdue" : hrs < 24 ? "soon" : "" };
}

// metrics & plan

// deadline cushion (like Shovel): free hours before the deadline minus the work due by then
function freeMinutesUntil(due) {
    const cap = state.settings.capacity * 60, [h, m] = state.settings.start.split(":").map(Number), s = (h || 0) * 60 + (m || 0);
    const now = new Date(), end = new Date(due);
    let total = 0;
    for (const d = new Date(now.getFullYear(), now.getMonth(), now.getDate()); d <= end; d.setDate(d.getDate() + 1)) {
        const from = d.toDateString() === now.toDateString() ? Math.max(s, now.getHours() * 60 + now.getMinutes()) : s;
        const to = d.toDateString() === end.toDateString() ? Math.min(s + cap, end.getHours() * 60 + end.getMinutes()) : s + cap;
        total += Math.max(0, to - from);
    }
    return total;
}

function cushion(t) {
    if (!t.due || t.done) return null;
    const needed = state.tasks.filter(x => !x.done && x.due && x.due <= t.due).reduce((s, x) => s + left(x), 0);
    return freeMinutesUntil(t.due) - needed;
}

// next 7 days: what the planner puts on each day, against the daily capacity
function weekDays() {
    const today = todayStr();
    return Array.from({ length: 7 }, (_, i) => {
        const date = addDays(today, i);
        const tasks = state.tasks.filter(t => !t.done && (i === 0 ? isToday(t) : planDay(t) === date));
        const deadlines = state.tasks.filter(t => !t.done && t.due && t.due.slice(0, 10) === date);
        return { date, i, tasks, deadlines, min: tasks.reduce((s, t) => s + left(t), 0) };
    });
}

// "unload today": move flexible, least important tasks to the next day with room, never past their deadline,
// until today's workload drops out of the critical zone
function unloadToday() {
    const cap = state.settings.capacity * 60, today = todayStr(), moved = [];
    const load = date => state.tasks.filter(t => !t.done && planDay(t) === date).reduce((s, t) => s + left(t), 0);
    const flexible = todayTasks().filter(t => !t.at && (t.prio || 0) < 3 && !(t.due && t.due.slice(0, 10) <= today))
        .sort((a, b) => (a.prio || 0) - (b.prio || 0) || (b.due || "9").localeCompare(a.due || "9"));
    for (const t of flexible) {
        if (metrics().workload < 75) break;
        for (let i = 1; i <= 14; i++) {
            const date = addDays(today, i);
            if (t.due && t.due.slice(0, 10) < date) break;
            if (load(date) + left(t) <= cap) { t.day = date; moved.push(t); break; }
        }
    }
    return moved;
}

function pushOneDay(t) {
    const tomorrow = addDays(todayStr(), 1);
    if (t.at) t.at = (t.at.slice(0, 10) < tomorrow ? tomorrow : addDays(t.at.slice(0, 10), 1)) + t.at.slice(10);
    else t.day = t.day && t.day >= tomorrow ? addDays(t.day, 1) : tomorrow;
}

// recurring tasks: ticking one off creates the next one
function nextOccurrence(t) {
    const today = todayStr(), origin = planDay(t) || (t.due ? t.due.slice(0, 10) : today), from = origin < today ? today : origin;
    let target = addDays(from, t.repeat === "weekly" ? 7 : 1);
    if (t.repeat === "weekdays") while ([0, 6].includes(new Date(target + "T00:00").getDay())) target = addDays(target, 1);
    const k = daysBetween(origin, target), shift = s => (s ? addDays(s, k) : "");
    const n = { ...t, id: state.nextId++, done: false, spawned: false, focus: 0, at: shift(t.at), due: shift(t.due), day: shift(t.day) };
    if (!n.at) n.day = n.day || target;
    return n;
}

function setDone(t, done) {
    t.done = done;
    if (done && t.repeat && !t.spawned) { t.spawned = true; state.tasks.push(nextOccurrence(t)); }
}

// browser notifications (only while the page is open)
function notify(title, body) {
    try { if ("Notification" in window && Notification.permission === "granted") new Notification(title, { body, tag: "loadmind-" + title }); } catch (e) {}
}

const SEEN_KEY = "loadmind.notified";
function checkReminders() {
    if (!state.settings.remind) return;
    let seen = {}; try { seen = JSON.parse(localStorage.getItem(SEEN_KEY)) || {}; } catch (e) {}
    const now = Date.now(), ru = isRu(), keep = {};
    state.tasks.filter(t => !t.done).forEach(t => {
        const check = (when, kind, lead, title) => {
            if (!when) return;
            const k = `${t.id}|${kind}|${when}`, ms = new Date(when) - now;
            if (seen[k]) keep[k] = 1;
            else if (ms > -6e4 && ms <= lead) { keep[k] = 1; notify(title, t.title); }
        };
        check(t.due, "due", 36e5, (ru ? "Дедлайн в " : "Deadline at ") + (t.due || "").slice(11));
        check(t.at, "at", 5 * 6e4, (ru ? "Начало в " : "Starts at ") + (t.at || "").slice(11));
    });
    try { localStorage.setItem(SEEN_KEY, JSON.stringify(keep)); } catch (e) {}
}
setInterval(checkReminders, 30e3);

function metrics() {
    const open = todayTasks();
    const weighted = open.reduce((s, t) => { const d = dueInfo(t); return s + left(t) * WEIGHT[t.type] * (d && d.hrs < 24 ? 1.2 : 1); }, 0);
    const workload = clamp(Math.round(weighted / (state.settings.capacity * 60) * 100));
    const studyMin = state.tasks.filter(t => t.type === "exam" || t.type === "study").reduce((s, t) => s + t.minutes, 0);
    const index = state.notes ? clamp(Math.round(workload * 0.6 + state.notesScore * 0.4)) : workload;
    const balance = clamp(10 - index / 12.5, 0, 10);
    return { workload, studyMin, index, balance };
}

function buildPlan() {
    const byDue = (a, b) => (b.prio || 0) - (a.prio || 0) || (a.due || "9").localeCompare(b.due || "9");
    const open = todayTasks().map(x => ({ ...x, minutes: left(x) })).sort(byDue);
    const today = toLocalInput(new Date()).slice(0, 10), isFixed = x => x.at && x.at.slice(0, 10) === today;
    const fixed = open.filter(isFixed).map(x => ({ x, s: +x.at.slice(11, 13) * 60 + +x.at.slice(14, 16) })).sort((a, b) => a.s - b.s);
    const flow = open.filter(x => !isFixed(x));
    const hard = flow.filter(t => t.type === "exam" || t.type === "study");
    const phys = flow.filter(t => t.type === "physical");
    let light = flow.filter(t => t.type === "light");
    const [h, m] = state.settings.start.split(":").map(Number);
    let t = (h || 0) * 60 + (m || 0);
    const noPeak = state.settings.peak === "none";
    const peak = PEAK[state.settings.peak] || PEAK.morning;
    const out = [];
    const put = (task, extra) => {
        fixed.forEach(f => { if (t < f.s + f.x.minutes && t + task.minutes > f.s) t = f.s + f.x.minutes; });
        out.push({ id: task.id, prio: task.prio, time: fmt(t), start: t, minutes: task.minutes, title: task.title, due: task.due, peak: extra, meta: `${dur(task.minutes)} · ${TYPE_LABEL[task.type]}` });
        t += task.minutes;
    };
    if (hard.length && !noPeak) { // light tasks fill the time before the peak window
        while (light.length && t + light[0].minutes <= peak) put(light.shift());
        t = Math.max(t, peak);
    }
    hard.forEach((task, i) => {
        put(task, i === 0 && !noPeak);
        if ((hard[i + 1] || phys.length) && task.minutes >= 40) {
            out.push({ time: fmt(t), title: "Break", meta: "15 min", rest: true });
            t += 15;
        }
    });
    phys.forEach(task => put(task));
    light.forEach(task => put(task));
    fixed.forEach(f => out.push({ id: f.x.id, prio: f.x.prio, time: fmt(f.s), start: f.s, minutes: f.x.minutes, title: f.x.title, due: f.x.due, meta: `${dur(f.x.minutes)} · ${TYPE_LABEL[f.x.type]} · fixed time` }));
    return out.sort((a, b) => a.time.localeCompare(b.time));
}

// calendar export

const icsDate = d => d.getFullYear() + String(d.getMonth() + 1).padStart(2, "0") + String(d.getDate()).padStart(2, "0") + "T" + String(d.getHours()).padStart(2, "0") + String(d.getMinutes()).padStart(2, "0") + "00";
const icsText = s => String(s).replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n");

function exportICS() {
    const day = new Date(); day.setHours(0, 0, 0, 0);
    const ev = [];
    const add = (uid, title, from, to, note) => ev.push(["BEGIN:VEVENT", `UID:${uid}@loadmind`, `DTSTAMP:${icsDate(new Date())}`, `DTSTART:${icsDate(from)}`, `DTEND:${icsDate(to)}`, `SUMMARY:${icsText(title)}`, `DESCRIPTION:${icsText(note)}`, "END:VEVENT"].join("\r\n"));
    buildPlan().filter(p => !p.rest).forEach((p, i) => {
        const a = new Date(day.getTime() + p.start * 6e4);
        add("plan" + i + Date.now(), p.title, a, new Date(a.getTime() + p.minutes * 6e4), "LoadMind plan");
    });
    state.tasks.filter(t => t.due && !t.done).forEach(t => {
        const d = new Date(t.due);
        add("due" + t.id, "DEADLINE: " + t.title, new Date(d.getTime() - 15 * 6e4), d, "LoadMind deadline");
    });
    const body = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//LoadMind//EN", ...ev, "END:VCALENDAR"].join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([body], { type: "text/calendar" }));
    a.download = "loadmind.ics";
    a.click();
    URL.revokeObjectURL(a.href);
}

function gcalLink(t) {
    const d = t.at ? new Date(new Date(t.at).getTime() + t.minutes * 6e4) : new Date(t.due), p = new Date(d.getTime() - t.minutes * 6e4);
    const z = x => icsDate(x);
    return "https://calendar.google.com/calendar/render?action=TEMPLATE&text=" + encodeURIComponent(t.title) + "&dates=" + z(p) + "/" + z(d) + "&details=" + encodeURIComponent("Added from LoadMind");
}


// AI (through the Worker proxy; with accounts on, only for signed-in users; own key as a fallback)

// paste your deployed Worker URL here (see worker.js); with it, users need no API key
const AI_PROXY = "https://loadmind-ai.hassimx.workers.dev";
const authOn = () => !!(window.LoadMindAuth && LoadMindAuth.configured);
const signedIn = () => !!(window.LoadMindAuth && LoadMindAuth.user);
const useProxy = () => !!AI_PROXY && (!authOn() || signedIn() || !state.settings.key);
const hasAI = () => (useProxy() ? !authOn() || signedIn() : !!state.settings.key);

const DEFAULT_MODEL = { gemini: "gemini-3.8-flash" };

async function callAI(system, user) {
    if (useProxy()) {
        const headers = { "content-type": "application/json" };
        if (authOn()) {
            const token = await LoadMindAuth.token();
            if (!token) throw new Error("Sign in to use the AI");
            headers.authorization = "Bearer " + token;
        }
        const r = await fetch(AI_PROXY, { method: "POST", headers, body: JSON.stringify({ system, user }) });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) { const err = new Error(d.error || "HTTP " + r.status); err.status = r.status; throw err; }
        return d.text;
    }
    const { key } = state.settings;
    const model = state.settings.model || DEFAULT_MODEL.gemini;
    if (!key) throw new Error("No API key");
    let res, data;
    res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: [{ role: "user", parts: [{ text: user }] }] })
    });
    data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || res.status);
    return data.candidates[0].content.parts.map(p => p.text || "").join("");
}

async function smartParse(text) {
    const quick = parseQuick(text);
    if (!hasAI() || quick.sure) return quick;
    try {
        const sys = `Extract one task from the user's text (English or Russian). Now is ${toLocalInput(new Date())}. Reply with JSON only: {"title": string, "minutes": number, "type": "exam"|"study"|"physical"|"light", "due": "YYYY-MM-DDTHH:mm" or "", "at": "YYYY-MM-DDTHH:mm" or ""}. "due" is a deadline (words like by, до, к, сдать). "at" is when the user wants to DO it (a start time like "at 14:00", "в 14:00" or a range like 14:00-17:00; then minutes = the range length). exam = SAT/IELTS/exam prep, study = homework/lessons/projects, physical = sport, light = easy review. Default minutes 45. Keep the title in the user's language, without priority marks (!) and without repeat words (every day, каждый день).`;
        const out = await callAI(sys, text);
        const j = JSON.parse(out.match(/\{[\s\S]*\}/)[0]);
        if (!j.title || !TYPE_NAME[j.type]) throw new Error("bad json");
        return { prio: quick.prio, repeat: quick.repeat, day: quick.day, title: String(j.title).replace(/!+/g, "").trim() || quick.title, minutes: clamp(Math.round(+j.minutes) || 45, 5, 600), type: j.type, due: /^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(j.due || "") ? j.due : "", at: /^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(j.at || "") ? j.at : "", ai: true };
    } catch (e) {
        return parseQuick(text);
    }
}

const uiLang = () => localStorage.getItem("loadmind.lang") === "ru" ? "Russian" : "English";

async function analyzeNotesAI(text) {
    const m = metrics();
    const sys = `You read a student's note about their day and judge workload and state. Reply with JSON only: {"score": number 0-100 (how heavy/draining the day feels from the note: 10 light, 40 normal, 70 heavy, 90 critical), "tags": array of 1-4 short lowercase labels in ${uiLang()} (e.g. "sleepiness", "стресс", "учёба"), "advice": one or two concrete sentences in ${uiLang()}, taking the open tasks and overload index into account}. In Russian always address the student informally as "ты", never "вы". No medical advice.`;
    const ctx = { note: text, overloadIndex: m.index, openTasks: state.tasks.filter(t => !t.done).map(t => `${t.title} ${t.minutes}min${t.due ? " due " + t.due : ""}`) };
    const j = JSON.parse((await callAI(sys, JSON.stringify(ctx))).match(/\{[\s\S]*\}/)[0]);
    if (!j.advice || !Array.isArray(j.tags)) throw new Error("bad json");
    return { score: clamp(Math.round(+j.score) || 30), detectedCategories: j.tags.slice(0, 4).map(String), advice: String(j.advice) };
}

async function askCoach() {
    const out = $("coachOut"), btn = $("coachButton"), ru = isRu();
    if (!hasAI()) {
        if (authOn()) {
            out.textContent = ru ? "Войди или создай аккаунт, чтобы пользоваться ИИ-коучем. Это бесплатно." : "Sign in or create an account to use the AI coach. It's free.";
            LoadMindAuth.open();
        } else out.textContent = "Add an API key in Settings first.";
        return;
    }
    out.textContent = ru ? "Думаю…" : "Thinking…";
    btn.disabled = true;
    try {
        const m = metrics();
        const sys = "You are a calm study-workload coach for a student. Be concrete and short (max 120 words, no markdown). Say what to move or drop, what to do at the peak focus time, and where to rest. Always answer in " + uiLang() + ", even if the tasks or notes are written in another language. In Russian always address the student informally as \"ты\", never \"вы\". Do not give medical advice.";
        const data = {
            now: new Date().toString(), dayStart: state.settings.start, capacityHours: state.settings.capacity, peakFocus: state.settings.peak,
            overloadIndex: m.index, tasks: state.tasks.filter(t => !t.done).map(t => ({ title: t.title, minutesLeft: left(t), type: t.type, priority: PRIO_MARK[t.prio || 0] || null, repeat: t.repeat || null, plannedDay: planDay(t) || null, due: t.due || null })),
            plan: buildPlan().map(p => `${p.time} ${p.title}`), notes: state.notes || null
        };
        out.textContent = (await callAI(sys, JSON.stringify(data))).trim();
    } catch (e) {
        out.textContent = e.status === 401
            ? (ru ? "Сессия закончилась. Войди в аккаунт ещё раз." : "Your session has ended. Sign in again.")
            : /fetch/i.test(e.message)
            ? (ru ? "Не удалось связаться с ИИ-сервером. Открой сайт по его веб-адресу, а не файлом с компьютера, и проверь ALLOWED_ORIGIN в Worker." : "Can't reach the AI server. Open the site at its web address (not the file on your computer) and check ALLOWED_ORIGIN in the Worker.")
            : /quota|exhaust|rate|limit|429/i.test(e.message)
            ? (ru ? "Дневной лимит ИИ закончился. Он обновляется раз в сутки, попробуй завтра." : "The daily AI limit is used up. It resets once a day, try again tomorrow.")
            : (ru ? "Ошибка ИИ: " : "AI request failed: ") + e.message;
    }
    btn.disabled = false;
}

// render

function tag(text) {
    const s = document.createElement("span");
    s.className = "tag";
    s.textContent = text;
    return s;
}

function prioBadge(p) {
    const b = document.createElement("b");
    b.className = "prio";
    b.textContent = PRIO_MARK[p];
    b.title = ["", "Low priority", "Important", "Urgent"][p];
    return b;
}

function focusButton(id) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "icon-btn small play";
    b.dataset.focus = id;
    b.title = "Focus on this task";
    b.setAttribute("aria-label", "Focus on this task");
    b.textContent = "▶";
    return b;
}

function renderWeek() {
    const ru = isRu(), cap = state.settings.capacity * 60, days = weekDays();
    $("week").replaceChildren(...days.map(d => {
        const row = document.createElement("div");
        row.className = "day" + (d.min > cap ? " over" : "") + (d.i === 0 ? " today" : "");
        row.innerHTML = `<div class="day-name"><span></span><small></small></div><div class="day-bar"><i></i></div><div class="day-load"></div><div class="day-tasks"></div>`;
        const name = d.i === 0 ? (ru ? "Сегодня" : "Today") : d.i === 1 ? (ru ? "Завтра" : "Tomorrow") : new Date(d.date + "T00:00").toLocaleDateString(ru ? "ru-RU" : "en-GB", { weekday: "long" });
        row.querySelector(".day-name span").textContent = name.charAt(0).toUpperCase() + name.slice(1);
        row.querySelector(".day-name small").textContent = shortDate(d.date);
        row.querySelector(".day-bar i").style.width = `${Math.min(100, d.min / cap * 100)}%`;
        row.querySelector(".day-load").textContent = d.min ? dur(d.min) : "—";
        row.querySelector(".day-tasks").append(
            ...d.deadlines.map(t => { const s = tag("⚑ " + t.title + " · " + t.due.slice(11)); s.classList.add("deadline"); return s; }),
            ...d.tasks.slice().sort((a, b) => (b.prio || 0) - (a.prio || 0)).map(t => tag((t.prio ? PRIO_MARK[t.prio] + " " : "") + t.title))
        );
        return row;
    }));
    const risky = state.tasks.filter(t => { const c = cushion(t); return c !== null && c < 0 && new Date(t.due) > new Date(); }).length;
    $("weekSummary").replaceChildren(
        tag(`Capacity ${dur(cap)} a day`),
        tag(`Overloaded days: ${days.filter(d => d.min > cap).length}`),
        tag(`Deadlines at risk: ${risky}`)
    );
}

function render() {
    const { workload, studyMin, index, balance } = metrics();
    $("greeting").textContent = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
    const open = state.tasks.filter(t => !t.done);
    const openMin = todayTasks().reduce((sum, t) => sum + left(t), 0);
    const summary = open.length ? `${open.length} open · ${dur(openMin)} planned` : "Nothing open";
    $("summary").textContent = state.settings.name ? `${state.settings.name} · ${summary}` : summary;

    // stats
    const wl = levelOf(workload);
    $("workloadValue").textContent = workload;
    $("workloadBar").style.width = `${workload}%`;
    $("workloadLabel").textContent = LEVELS[wl];
    $("workloadLabel").className = "stat-label" + (wl >= 2 ? " high" : " good");
    $("workloadBar").classList.toggle("high", wl >= 2);
    $("workloadNote").textContent = ["Light day", "Balanced", "High, but manageable", "Too much for one day"][wl];

    $("studyValue").textContent = studyMin >= 60 ? Math.floor(studyMin / 60) : studyMin;
    $("studyUnit").textContent = studyMin >= 60 ? ` h${studyMin % 60 ? ` ${studyMin % 60} min` : ""}` : " min";
    const titles = state.tasks.filter(t => t.type === "exam" || t.type === "study").map(t => t.title);
    $("studyNote").textContent = titles.length ? titles.join(" · ") : "No study tasks yet";

    $("balanceValue").textContent = balance.toFixed(1);
    $("balanceLabel").textContent = balance >= 7 ? "Good" : balance >= 4 ? "OK" : "Low";
    $("balanceLabel").className = "stat-label" + (balance >= 7 ? " good" : balance < 4 ? " high" : "");
    $("balanceNote").textContent = balance >= 7 ? "Recovery time available" : "Add recovery time";

    // overload index
    $("score").textContent = index;
    $("scoreBar").style.width = `${index}%`;
    $("scoreBar").classList.toggle("high", index >= 50);
    $("score").classList.toggle("high", index >= 50);
    document.querySelectorAll(".scale span").forEach((s, i) => s.classList.toggle("active", i === levelOf(index)));
    const byType = {};
    todayTasks().forEach(t => { byType[t.type] = (byType[t.type] || 0) + left(t); });
    $("breakdown").replaceChildren(...Object.entries(byType).map(([k, v]) => tag(`${TYPE_NAME[k]} · ${dur(v)}`)));

    // plan
    const plan = buildPlan();
    $("schedule").replaceChildren(...plan.map(p => {
        const row = document.createElement("div");
        row.className = "task" + (p.rest ? " break" : "") + (p.peak ? " peak" : "");
        row.innerHTML = `<div class="time"></div><div class="task-info"><strong></strong><small></small></div>`;
        row.querySelector(".time").textContent = p.time;
        row.querySelector("strong").textContent = p.title;
        if (p.prio) row.querySelector("strong").prepend(prioBadge(p.prio));
        row.querySelector("small").textContent = p.meta + (p.peak ? " · peak focus" : "");
        if (p.id) row.append(focusButton(p.id));
        return row;
    }));
    if (!plan.length) $("schedule").innerHTML = `<p class="empty">Nothing planned. Add tasks in My Tasks.</p>`;
    $("warning").dataset.level = levelOf(index);
    $("warningTitle").textContent = `${LEVELS[levelOf(index)]} load`;
    $("warningText").textContent = generateAdvice(index);
    document.querySelectorAll("[data-action=unload]").forEach(b => { b.hidden = workload < 75 && b.dataset.always !== "1"; });

    renderWeek();

    // tasks list
    $("taskList").replaceChildren(...state.tasks.slice().sort((a, b) => (a.done - b.done) || (a.due || "9").localeCompare(b.due || "9")).map(t => {
        const row = document.createElement("div");
        row.className = "task-row" + (t.done ? " done" : "");
        row.innerHTML = `<input type="checkbox" data-id="${t.id}"><div class="task-name"><span></span><small></small></div><a class="cal-link" target="_blank" rel="noopener" title="Add to Google Calendar" aria-label="Add to Google Calendar">+ Cal</a><button class="icon-btn small" data-later="${t.id}" title="Move to the next day" aria-label="Move to the next day">→</button><button class="icon-btn" data-del="${t.id}" title="Delete" aria-label="Delete task">×</button>`;
        row.querySelector("input").checked = t.done;
        row.querySelector("span").textContent = t.title;
        if (t.prio) row.querySelector("span").prepend(prioBadge(t.prio));
        const di = dueInfo(t), cal = row.querySelector(".cal-link");
        const when = s => new Date(s).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
        row.querySelector("small").textContent = `${dur(t.minutes)} · ${TYPE_LABEL[t.type]}` + (t.at ? ` · at ${when(t.at)}` : "") + (t.due ? ` · due ${when(t.due)}` : "")
            + (!t.at && t.day ? ` · on ${new Date(t.day + "T00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}` : "")
            + (t.repeat ? ` · ↻ ${REPEAT_NAME[t.repeat]}` : "") + (t.focus ? ` · ${dur(t.focus)} done` : "");
        if (di && di.cls) row.querySelector("small").classList.add(di.cls);
        const c = cushion(t);
        if (c !== null && new Date(t.due) > new Date()) {
            const em = document.createElement("em");
            em.className = "cushion" + (c < 0 ? " bad" : c < 60 ? " tight" : "");
            em.textContent = c < 0 ? `Won't fit · short by ${dur(-c)}` : c < 60 ? `Tight · ${dur(c)} spare` : `Cushion · ${dur(c)} spare`;
            row.querySelector(".task-name").append(em);
        }
        if (t.due || t.at) cal.href = gcalLink(t); else cal.remove();
        if (t.done) row.querySelector("[data-later]").remove();
        else row.querySelector(".cal-link, [data-later]").before(focusButton(t.id));
        return row;
    }));
    if (!state.tasks.length) $("taskList").innerHTML = `<p class="empty">No tasks yet.</p>`;

    // saved analysis
    if (state.notes) {
        $("tags").replaceChildren(...(state.categories.length ? state.categories : ["general"]).map(tag));
        $("advice").textContent = state.notesAdvice || generateAdvice(index);
        $("analysisResult").style.display = "block";
    } else {
        $("analysisResult").style.display = "none";
    }

    if (typeof renderFocus === "function") renderFocus();
}

function showView(v) {
    view = v;
    document.querySelectorAll(".nav-item").forEach(b => b.classList.toggle("active", b.dataset.view === v));
    document.querySelectorAll("[data-views]").forEach(el => { el.hidden = !el.dataset.views.split(" ").includes(v); });
    const grid = document.querySelector(".content-grid");
    const visible = [...grid.children].filter(c => !c.hidden).length;
    grid.hidden = visible === 0;
    grid.style.gridTemplateColumns = visible === 1 ? "1fr" : "";
}


// events
document.querySelectorAll(".nav-item").forEach(b => b.addEventListener("click", () => showView(b.dataset.view)));

$("analyzeButton").addEventListener("click", async () => {
    const text = $("notes").value.trim();
    if (!text) { $("notes").focus(); return; }
    const btn = $("analyzeButton");
    let r, advice = "";
    if (hasAI()) {
        btn.disabled = true; btn.textContent = "Reading…";
        try { r = await analyzeNotesAI(text); advice = r.advice; } catch (e) { r = null; }
        btn.disabled = false; btn.textContent = "Read my notes";
    }
    if (!r) r = analyzeText(text);
    state.notes = text;
    state.notesScore = r.score;
    state.categories = r.detectedCategories;
    state.notesAdvice = advice;
    save();
    render();
});

$("taskForm").addEventListener("submit", e => {
    e.preventDefault();
    const title = $("taskTitle").value.trim();
    if (!title) return;
    const minutes = clamp((parseInt($("taskH").value, 10) || 0) * 60 + (parseInt($("taskM").value, 10) || 0) || 30, 5, 720);
    const day = $("taskDay").value;
    state.tasks.push({ id: state.nextId++, title, minutes, type: $("taskType").value, done: false, due: day ? day + "T" + ($("taskTime").value || "18:00") : "", at: $("taskAt").value ? (day || toLocalInput(new Date()).slice(0, 10)) + "T" + $("taskAt").value : "", prio: +$("taskPrio").value || 0, repeat: $("taskRepeat").value });
    $("taskTitle").value = ""; $("taskH").value = 0; $("taskM").value = 45; $("taskDay").value = ""; $("taskAt").value = ""; $("taskPrio").value = "0"; $("taskRepeat").value = "";
    save();
    render();
});

$("quickForm").addEventListener("submit", async e => {
    e.preventDefault();
    const text = $("quickText").value.trim();
    if (!text) return;
    $("quickHint").textContent = "Parsing…";
    const r = await smartParse(text);
    state.tasks.push({ id: state.nextId++, title: r.title, minutes: r.minutes, type: r.type, done: false, due: r.due, at: r.at || "", day: r.day || "", prio: r.prio || 0, repeat: r.repeat || "" });
    $("quickHint").textContent = `${r.ai ? "AI" : "Rules"} · Added: «${r.title}» · ${dur(r.minutes)} · ${TYPE_NAME[r.type]}` + (r.at ? ` · at ${r.at.replace("T", " ")}` : "") + (r.due ? ` · due ${r.due.replace("T", " ")}` : "")
        + (r.day ? ` · on ${r.day}` : "") + (r.prio ? ` · ${PRIO_MARK[r.prio]}` : "") + (r.repeat ? ` · ↻ ${REPEAT_NAME[r.repeat]}` : "");
    $("quickText").value = "";
    save(); render();
});
$("icsButton").addEventListener("click", exportICS);
$("coachButton").addEventListener("click", askCoach);
$("setProvider").addEventListener("change", e => { state.settings.provider = e.target.value; $("setModel").placeholder = DEFAULT_MODEL.gemini; save(); });
$("setModel").addEventListener("change", e => { state.settings.model = e.target.value.trim(); save(); });
$("setKey").addEventListener("change", e => { state.settings.key = e.target.value.trim(); save(); });
$("setPeak").addEventListener("change", e => { state.settings.peak = e.target.value; save(); render(); });

$("taskList").addEventListener("click", e => {
    const del = e.target.closest("[data-del]"), later = e.target.closest("[data-later]");
    if (del) {
        state.tasks = state.tasks.filter(t => t.id !== Number(del.dataset.del));
        save(); render();
    } else if (later) {
        const task = state.tasks.find(t => t.id === Number(later.dataset.later));
        if (task) { pushOneDay(task); save(); render(); }
    } else if (e.target.matches("input[type=checkbox]")) {
        const task = state.tasks.find(t => t.id === Number(e.target.dataset.id));
        if (task) { setDone(task, e.target.checked); save(); render(); }
    }
});

document.addEventListener("click", e => {
    if (!e.target.closest("[data-action=unload]")) return;
    const moved = unloadToday(), ru = isRu();
    save(); render();
    const msg = moved.length
        ? (ru ? "Перенесено: " : "Moved: ") + moved.map(t => `${t.title} → ${shortDate(t.day)}`).join(", ")
        : metrics().workload < 75
        ? (ru ? "Сегодня и так не перегружено, переносить нечего." : "Today is not overloaded, nothing to move.")
        : (ru ? "Нечего переносить: остальные задачи с дедлайном сегодня, с фиксированным временем, или в следующие дни нет места." : "Nothing to move: the rest have a deadline today or a fixed time, or the next days are full.");
    document.querySelectorAll(".unload-hint").forEach(p => { p.textContent = msg; });
});

$("setRemind").addEventListener("change", async e => {
    const box = e.target;
    if (box.checked) {
        if (!("Notification" in window)) { box.checked = false; alert(isRu() ? "Этот браузер не поддерживает уведомления." : "This browser does not support notifications."); return; }
        const p = await Notification.requestPermission();
        if (p !== "granted") { box.checked = false; alert(isRu() ? "Уведомления запрещены в настройках браузера для этого сайта." : "Notifications are blocked for this site in your browser settings."); }
    }
    state.settings.remind = box.checked;
    save();
    checkReminders();
});
[["setPomoWork", "pomoWork", 25], ["setPomoShort", "pomoShort", 5], ["setPomoLong", "pomoLong", 15], ["setPomoEvery", "pomoEvery", 4]].forEach(([id, k, def]) => {
    $(id).addEventListener("change", e => {
        state.settings[k] = clamp(parseInt(e.target.value, 10) || def, 1, k === "pomoEvery" ? 12 : 180);
        e.target.value = state.settings[k];
        save(); render();
    });
});

$("setName").addEventListener("input", e => { state.settings.name = e.target.value.trim(); save(); render(); });
$("setStart").addEventListener("change", e => { state.settings.start = e.target.value || "09:00"; save(); render(); });
$("setCapacity").addEventListener("change", e => {
    state.settings.capacity = clamp(parseFloat(e.target.value) || 8, 1, 16);
    e.target.value = state.settings.capacity;
    save(); render();
});
$("resetButton").addEventListener("click", () => {
    if (!confirm("Reset all LoadMind data?")) return;
    state = fresh();
    save();
    init();
});


// appearance: theme + accent color

const PRESETS = [
    { name: "Lavender", hex: "#b9a7f5" },
    { name: "Rose", hex: "#f2a7c3" },
    { name: "Peach", hex: "#f5b49a" },
    { name: "Butter", hex: "#ecd68a" },
    { name: "Mint", hex: "#9fddc0" },
    { name: "Sky", hex: "#9cc7f5" }
];

function syncAppearance() {
    const look = window.LoadMindTheme;
    if (!look) return;
    const { theme, accent } = look.get();
    const next = theme === "dark" ? "light" : "dark";
    $("themeToggle").setAttribute("aria-label", `Switch to ${next} theme`);
    $("themeToggle").title = `Switch to ${next} theme`;
    $("accentPicker").value = accent.toLowerCase();
    document.querySelectorAll(".swatch").forEach(b => {
        b.setAttribute("aria-pressed", String(b.dataset.hex.toLowerCase() === accent.toLowerCase()));
    });
}

function initAppearance() {
    const look = window.LoadMindTheme;
    if (!look) return;

    $("swatches").replaceChildren(...PRESETS.map(p => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "swatch";
        b.style.setProperty("--c", p.hex);
        b.dataset.hex = p.hex;
        b.title = p.name;
        b.setAttribute("aria-label", p.name);
        b.addEventListener("click", () => { look.setAccent(p.hex); syncAppearance(); });
        return b;
    }));

    $("accentPicker").addEventListener("input", e => { look.setAccent(e.target.value); syncAppearance(); });
    $("themeToggle").addEventListener("click", () => {
        look.setTheme(look.get().theme === "dark" ? "light" : "dark");
        syncAppearance();
    });
    syncAppearance();
}


// init

function init() {
    $("notes").value = state.notes;
    $("setName").value = state.settings.name;
    $("setStart").value = state.settings.start;
    $("setCapacity").value = state.settings.capacity;
    $("setPeak").value = state.settings.peak;
    $("setRemind").checked = !!state.settings.remind && "Notification" in window && Notification.permission === "granted";
    $("setPomoWork").value = state.settings.pomoWork;
    $("setPomoShort").value = state.settings.pomoShort;
    $("setPomoLong").value = state.settings.pomoLong;
    $("setPomoEvery").value = state.settings.pomoEvery;
    fillDays();
    $("setProvider").value = "gemini";
    $("setModel").value = state.settings.model;
    $("setModel").placeholder = DEFAULT_MODEL.gemini;
    $("setKey").value = state.settings.key;
    if (AI_PROXY) $("advanced").hidden = true;
    
    render();
    showView(view);
}

init();
initAppearance();
