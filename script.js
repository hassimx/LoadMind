const $ = id => document.getElementById(id);
const KEY = "loadmind.v1";
const WEIGHT = { exam: 1.3, study: 1.0, physical: 1.2, light: 0.4 };
const TYPE_LABEL = { exam: "High concentration", study: "Medium load", physical: "Physical load", light: "Light load" };
const TYPE_NAME = { exam: "Exam prep", study: "Study", physical: "Physical", light: "Light" };
const LEVELS = ["Low", "Normal", "High", "Critical"];

const PEAK = { morning: 8 * 60, day: 13 * 60, evening: 18 * 60 };
function soon(days, hour) { const d = new Date(); d.setDate(d.getDate() + days); d.setHours(hour, 0, 0, 0); return toLocalInput(d); }
function toLocalInput(d) { const p = n => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; }

const fresh = () => ({
    settings: { name: "", start: "09:00", capacity: 8, peak: "morning", provider: "gemini", model: "", key: "" },
    tasks: [
        { id: 1, title: "SAT Math", minutes: 50, type: "exam", done: false, due: soon(1, 18) },
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
function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }

let state = load();
let view = "dashboard";

const clamp = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));
const levelOf = v => (v < 25 ? 0 : v < 50 ? 1 : v < 75 ? 2 : 3);
const dur = m => (m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ""}` : `${m} min`);
const fmt = t => `${String(Math.floor(t / 60) % 24).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;


// ---------- NLP: keyword analysis (EN + RU) ----------
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


// ---------- NLP: smart task input (EN + RU) ----------

const DAYS = [["sun","воскр"],["mon","понед"],["tue","вторн"],["wed","сред"],["thu","четвер"],["fri","пятниц"],["sat","суббот"]];

function parseQuick(text) {
    let t = " " + text.trim() + " ";
    let minutes = 0, due = null, hh = null, mm = 0;
    const NUMW = { "один": 1, "одну": 1, "два": 2, "две": 2, "три": 3, "четыре": 4, "пять": 5, "шесть": 6, "one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6 };
    t = t.replace(/(?<![\p{L}\p{N}])полтора(?=\s+час)/giu, "1.5")
         .replace(/(?<![\p{L}\p{N}])(один|одну|два|две|три|четыре|пять|шесть|one|two|three|four|five|six)(?=\s+(?:h|hr|hrs|hours?|ч|час|min|мин)[\p{L}]*)/giu, w => NUMW[w.toLowerCase()]);
    const cut = re => { const m = t.match(re); if (m) t = t.replace(re, " "); return m; };

    let m = cut(/(\d+(?:[.,]\d+)?)\s*(h|hr|hrs|hours?|ч|час\p{L}*)(?![\p{L}])/iu);
    if (m) minutes = Math.round(parseFloat(m[1].replace(",", ".")) * 60);
    else if ((m = cut(/(\d+)\s*(min|mins|minutes?|м|мин\p{L}*)(?![\p{L}])/iu))) minutes = parseInt(m[1], 10);

    if ((m = cut(/(?:(?<![\p{L}\p{N}])(?:at|в|к|до)\s+)?(?<![\p{L}\p{N}])(\d{1,2})[:.](\d{2})(?![\p{L}\p{N}])/iu))) { hh = +m[1]; mm = +m[2]; }
    else if ((m = cut(/(?<![\p{L}\p{N}])(?:at|в|к)\s+(\d{1,2})\s*(am|pm|час\p{L}*)?/iu))) {
        hh = +m[1]; if (m[2] && m[2].toLowerCase() === "pm" && hh < 12) hh += 12;
    }

    const base = new Date(); base.setSeconds(0, 0);
    if (cut(/(?<![\p{L}])(tomorrow|завтра)(?![\p{L}])/iu)) { base.setDate(base.getDate() + 1); due = base; }
    else if (cut(/(?<![\p{L}])(today|сегодня)(?![\p{L}])/iu)) due = base;
    else {
        const low = t.toLowerCase();
        for (let i = 0; i < 7 && !due; i++) {
            const [en, ru] = DAYS[i];
            if (new RegExp(`(?<![\\p{L}])(${en}[a-z]*|${ru}\\p{L}*)`, "u").test(low)) {
                t = t.replace(new RegExp(`(?:(?<![\\p{L}])(?:on|в|во|к)\\s+)?(?<![\\p{L}])(${en}[a-z]*|${ru}\\p{L}*)`, "iu"), " ");
                const add = ((i - base.getDay() + 7) % 7) || 7;
                base.setDate(base.getDate() + add); due = base;
            }
        }
    }
    if (!due && hh !== null) due = base;
    if (due) due.setHours(hh !== null ? hh : 18, hh !== null ? mm : 0, 0, 0);

    const low = text.toLowerCase();
    let type = "study";
    if (categories.exam.keywords.some(k => matches(low, k))) type = "exam";
    else if (categories.sport.keywords.some(k => matches(low, k))) type = "physical";
    else if (/(review|read|check|email|повтор|прочит|почт|разобр)/i.test(low) && !categories.academic.keywords.some(k => matches(low, k))) type = "light";

    const title = t.replace(/(?<![\p{L}\p{N}])(due|by|on|at|в|к|до|на|надо|нужно|need to|have to)(?![\p{L}\p{N}])/giu, " ").replace(/[,;]+/g, " ").replace(/\s+/g, " ").trim();
    return { title: title || text.trim(), minutes: clamp(minutes || 45, 5, 600), type, due: due ? toLocalInput(due) : "" };
}

function dueInfo(t) {
    if (!t.due || t.done) return null;
    const hrs = (new Date(t.due) - new Date()) / 36e5;
    const label = new Date(t.due).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
    return { label, hrs, cls: hrs < 0 ? "overdue" : hrs < 24 ? "soon" : "" };
}

// ---------- metrics & plan ----------

function metrics() {
    const open = state.tasks.filter(t => !t.done);
    const weighted = open.reduce((s, t) => { const d = dueInfo(t); return s + t.minutes * WEIGHT[t.type] * (d && d.hrs < 24 ? 1.2 : 1); }, 0);
    const workload = clamp(Math.round(weighted / (state.settings.capacity * 60) * 100));
    const studyMin = state.tasks.filter(t => t.type === "exam" || t.type === "study").reduce((s, t) => s + t.minutes, 0);
    const index = state.notes ? clamp(Math.round(workload * 0.6 + state.notesScore * 0.4)) : workload;
    const balance = clamp(10 - index / 12.5, 0, 10);
    return { workload, studyMin, index, balance };
}

function buildPlan() {
    const byDue = (a, b) => (a.due || "9").localeCompare(b.due || "9");
    const open = state.tasks.filter(t => !t.done).sort(byDue);
    const hard = open.filter(t => t.type === "exam" || t.type === "study");
    const phys = open.filter(t => t.type === "physical");
    let light = open.filter(t => t.type === "light");
    const [h, m] = state.settings.start.split(":").map(Number);
    let t = (h || 0) * 60 + (m || 0);
    const peak = PEAK[state.settings.peak] || PEAK.morning;
    const out = [];
    const put = (task, extra) => {
        out.push({ time: fmt(t), start: t, minutes: task.minutes, title: task.title, due: task.due, peak: extra, meta: `${dur(task.minutes)} · ${TYPE_LABEL[task.type]}` });
        t += task.minutes;
    };
    if (hard.length) { // light tasks fill the time before the peak window
        while (light.length && t + light[0].minutes <= peak) put(light.shift());
        t = Math.max(t, peak);
    }
    hard.forEach((task, i) => {
        put(task, i === 0);
        if ((hard[i + 1] || phys.length) && task.minutes >= 40) {
            out.push({ time: fmt(t), title: "Break", meta: "15 min", rest: true });
            t += 15;
        }
    });
    phys.forEach(task => put(task));
    light.forEach(task => put(task));
    return out;
}

// ---------- calendar export ----------

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
    const d = new Date(t.due), p = new Date(d.getTime() - t.minutes * 6e4);
    const z = x => icsDate(x);
    return "https://calendar.google.com/calendar/render?action=TEMPLATE&text=" + encodeURIComponent(t.title) + "&dates=" + z(p) + "/" + z(d) + "&details=" + encodeURIComponent("Added from LoadMind");
}


// ---------- AI (called straight from the browser with the user's own key) ----------

// Paste your deployed Worker URL here (see worker.js). With it, users need no API key.
const AI_PROXY = "https://loadmind-ai.alena-anilove1970.workers.dev";
const hasAI = () => !!(AI_PROXY || state.settings.key);

const DEFAULT_MODEL = { gemini: "gemini-2.5-flash", anthropic: "claude-haiku-4-5-20251001" };

async function callAI(system, user) {
    if (AI_PROXY) {
        const r = await fetch(AI_PROXY, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ system, user }) });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || r.status);
        return d.text;
    }
    const { provider, key } = state.settings;
    const model = state.settings.model || DEFAULT_MODEL[provider];
    if (!key) throw new Error("No API key");
    let res, data;
    if (provider === "anthropic") {
        res = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
            body: JSON.stringify({ model, max_tokens: 600, system, messages: [{ role: "user", content: user }] })
        });
        data = await res.json();
        if (!res.ok) throw new Error(data.error?.message || res.status);
        return data.content.map(c => c.text || "").join("");
    }
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
    if (!hasAI()) return parseQuick(text);
    try {
        const sys = `Extract one task from the user's text (English or Russian). Now is ${toLocalInput(new Date())}. Reply with JSON only: {"title": string, "minutes": number, "type": "exam"|"study"|"physical"|"light", "due": "YYYY-MM-DDTHH:mm" or ""}. exam = SAT/IELTS/exam prep, study = homework/lessons/projects, physical = sport, light = easy review. Default minutes 45. Keep the title in the user's language.`;
        const out = await callAI(sys, text);
        const j = JSON.parse(out.match(/\{[\s\S]*\}/)[0]);
        if (!j.title || !TYPE_NAME[j.type]) throw new Error("bad json");
        return { title: String(j.title), minutes: clamp(Math.round(+j.minutes) || 45, 5, 600), type: j.type, due: /^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(j.due || "") ? j.due : "", ai: true };
    } catch (e) {
        return parseQuick(text);
    }
}

async function analyzeNotesAI(text) {
    const m = metrics();
    const sys = `You read a student's note about their day and judge workload and state. Reply with JSON only: {"score": number 0-100 (how heavy/draining the day feels from the note: 10 light, 40 normal, 70 heavy, 90 critical), "tags": array of 1-4 short lowercase labels in the note's language (e.g. "sleepiness", "стресс", "учёба"), "advice": one or two concrete sentences in the note's language, taking the open tasks and overload index into account}. No medical advice.`;
    const ctx = { note: text, overloadIndex: m.index, openTasks: state.tasks.filter(t => !t.done).map(t => `${t.title} ${t.minutes}min${t.due ? " due " + t.due : ""}`) };
    const j = JSON.parse((await callAI(sys, JSON.stringify(ctx))).match(/\{[\s\S]*\}/)[0]);
    if (!j.advice || !Array.isArray(j.tags)) throw new Error("bad json");
    return { score: clamp(Math.round(+j.score) || 30), detectedCategories: j.tags.slice(0, 4).map(String), advice: String(j.advice) };
}

async function askCoach() {
    const out = $("coachOut"), btn = $("coachButton");
    out.textContent = hasAI() ? "Thinking…" : "Add an API key in Settings first.";
    if (!hasAI()) return;
    btn.disabled = true;
    try {
        const m = metrics();
        const sys = "You are a calm study-workload coach for a student. Be concrete and short (max 120 words, no markdown). Say what to move or drop, what to do at the peak focus time, and where to rest. Answer in the language the student's tasks/notes are written in. Do not give medical advice.";
        const data = {
            now: new Date().toString(), dayStart: state.settings.start, capacityHours: state.settings.capacity, peakFocus: state.settings.peak,
            overloadIndex: m.index, tasks: state.tasks.filter(t => !t.done).map(t => ({ title: t.title, minutes: t.minutes, type: t.type, due: t.due || null })),
            plan: buildPlan().map(p => `${p.time} ${p.title}`), notes: state.notes || null
        };
        out.textContent = (await callAI(sys, JSON.stringify(data))).trim();
    } catch (e) {
        out.textContent = "AI request failed: " + e.message;
    }
    btn.disabled = false;
}

// ---------- render ----------

function tag(text) {
    const s = document.createElement("span");
    s.className = "tag";
    s.textContent = text;
    return s;
}

function render() {
    const { workload, studyMin, index, balance } = metrics();
    $("greeting").textContent = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
    const open = state.tasks.filter(t => !t.done);
    const openMin = open.reduce((sum, t) => sum + t.minutes, 0);
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
    state.tasks.filter(t => !t.done).forEach(t => { byType[t.type] = (byType[t.type] || 0) + t.minutes; });
    $("breakdown").replaceChildren(...Object.entries(byType).map(([k, v]) => tag(`${TYPE_NAME[k]} · ${dur(v)}`)));

    // plan
    const plan = buildPlan();
    $("schedule").replaceChildren(...plan.map(p => {
        const row = document.createElement("div");
        row.className = "task" + (p.rest ? " break" : "") + (p.peak ? " peak" : "");
        row.innerHTML = `<div class="time"></div><div class="task-info"><strong></strong><small></small></div>`;
        row.querySelector(".time").textContent = p.time;
        row.querySelector("strong").textContent = p.title;
        row.querySelector("small").textContent = p.meta + (p.peak ? " · peak focus" : "");
        return row;
    }));
    if (!plan.length) $("schedule").innerHTML = `<p class="empty">Nothing planned. Add tasks in My Tasks.</p>`;
    $("warning").dataset.level = levelOf(index);
    $("warningTitle").textContent = `${LEVELS[levelOf(index)]} load`;
    $("warningText").textContent = generateAdvice(index);

    // tasks list
    $("taskList").replaceChildren(...state.tasks.slice().sort((a, b) => (a.done - b.done) || (a.due || "9").localeCompare(b.due || "9")).map(t => {
        const row = document.createElement("div");
        row.className = "task-row" + (t.done ? " done" : "");
        row.innerHTML = `<input type="checkbox" data-id="${t.id}"><div class="task-name"><span></span><small></small></div><a class="cal-link" target="_blank" rel="noopener" title="Add to Google Calendar" aria-label="Add to Google Calendar">+ Cal</a><button class="icon-btn" data-del="${t.id}" title="Delete" aria-label="Delete task">×</button>`;
        row.querySelector("input").checked = t.done;
        row.querySelector("span").textContent = t.title;
        const di = dueInfo(t), cal = row.querySelector(".cal-link");
        row.querySelector("small").textContent = `${dur(t.minutes)} · ${TYPE_LABEL[t.type]}` + (t.due ? ` · due ${new Date(t.due).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}` : "");
        if (di && di.cls) row.querySelector("small").classList.add(di.cls);
        if (t.due) cal.href = gcalLink(t); else cal.remove();
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


// ---------- events ----------

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
    const minutes = clamp(parseInt($("taskMinutes").value, 10) || 30, 5, 600);
    state.tasks.push({ id: state.nextId++, title, minutes, type: $("taskType").value, done: false, due: $("taskDue").value });
    $("taskTitle").value = ""; $("taskDue").value = "";
    save();
    render();
});

$("quickForm").addEventListener("submit", async e => {
    e.preventDefault();
    const text = $("quickText").value.trim();
    if (!text) return;
    $("quickHint").textContent = "Parsing…";
    const r = await smartParse(text);
    state.tasks.push({ id: state.nextId++, title: r.title, minutes: r.minutes, type: r.type, done: false, due: r.due });
    $("quickHint").textContent = `${r.ai ? "AI" : "Rules"} · Added: «${r.title}» · ${dur(r.minutes)} · ${TYPE_NAME[r.type]}` + (r.due ? ` · due ${r.due.replace("T", " ")}` : " · no deadline found");
    $("quickText").value = "";
    save(); render();
});
$("icsButton").addEventListener("click", exportICS);
$("coachButton").addEventListener("click", askCoach);
$("setProvider").addEventListener("change", e => { state.settings.provider = e.target.value; $("setModel").placeholder = DEFAULT_MODEL[e.target.value]; save(); });
$("setModel").addEventListener("change", e => { state.settings.model = e.target.value.trim(); save(); });
$("setKey").addEventListener("change", e => { state.settings.key = e.target.value.trim(); save(); });
$("setPeak").addEventListener("change", e => { state.settings.peak = e.target.value; save(); render(); });

$("taskList").addEventListener("click", e => {
    const del = e.target.closest("[data-del]");
    if (del) {
        state.tasks = state.tasks.filter(t => t.id !== Number(del.dataset.del));
        save(); render();
    } else if (e.target.matches("input[type=checkbox]")) {
        const task = state.tasks.find(t => t.id === Number(e.target.dataset.id));
        if (task) { task.done = e.target.checked; save(); render(); }
    }
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


// ---------- appearance: theme + accent color ----------

const PRESETS = [
    { name: "Raspberry", hex: "#b83280" },
    { name: "Blue", hex: "#2f5fd0" },
    { name: "Teal", hex: "#12796b" },
    { name: "Violet", hex: "#6d4fd0" },
    { name: "Red", hex: "#c8402a" },
    { name: "Gold", hex: "#b7791f" }
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


// ---------- init ----------

function init() {
    $("notes").value = state.notes;
    $("setName").value = state.settings.name;
    $("setStart").value = state.settings.start;
    $("setCapacity").value = state.settings.capacity;
    $("setPeak").value = state.settings.peak;
    $("setProvider").value = state.settings.provider;
    $("setModel").value = state.settings.model;
    $("setModel").placeholder = DEFAULT_MODEL[state.settings.provider];
    $("setKey").value = state.settings.key;
    if (AI_PROXY) ["setProvider", "setModel", "setKey"].forEach(id => { $(id).closest("label").hidden = true; });
    render();
    showView(view);
}

init();
initAppearance();
