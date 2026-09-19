const $ = id => document.getElementById(id);
const KEY = "loadmind.v1";
const WEIGHT = { exam: 1.3, study: 1.0, physical: 1.2, light: 0.4 };
const TYPE_LABEL = { exam: "High concentration", study: "Medium load", physical: "Physical load", light: "Light load" };
const TYPE_NAME = { exam: "Exam prep", study: "Study", physical: "Physical", light: "Light" };
const LEVELS = ["Low", "Normal", "High", "Critical"];

const fresh = () => ({
    settings: { name: "", start: "09:00", capacity: 8 },
    tasks: [
        { id: 1, title: "SAT Math", minutes: 50, type: "exam", done: false },
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
        "устал*", "устав*", "вымот*", "стресс*", "выгор*", "нет сил", "не могу сосредоточ*"
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


// ---------- metrics & plan ----------

function metrics() {
    const open = state.tasks.filter(t => !t.done);
    const weighted = open.reduce((s, t) => s + t.minutes * WEIGHT[t.type], 0);
    const workload = clamp(Math.round(weighted / (state.settings.capacity * 60) * 100));
    const studyMin = state.tasks.filter(t => t.type === "exam" || t.type === "study").reduce((s, t) => s + t.minutes, 0);
    const index = state.notes ? clamp(Math.round(workload * 0.6 + state.notesScore * 0.4)) : workload;
    const balance = clamp(10 - index / 12.5, 0, 10);
    return { workload, studyMin, index, balance };
}

function buildPlan() {
    const order = { exam: 0, study: 0, physical: 1, light: 2 }; // focus first, sport after, light review last
    const open = state.tasks.filter(t => !t.done).sort((a, b) => order[a.type] - order[b.type]);
    const [h, m] = state.settings.start.split(":").map(Number);
    let t = (h || 0) * 60 + (m || 0);
    const out = [];
    open.forEach((task, i) => {
        out.push({ time: fmt(t), title: task.title, meta: `${dur(task.minutes)} · ${TYPE_LABEL[task.type]}` });
        t += task.minutes;
        if (open[i + 1] && (task.type === "exam" || task.type === "study") && task.minutes >= 40) {
            out.push({ time: fmt(t), title: "Break", meta: "15 min", rest: true });
            t += 15;
        }
    });
    return out;
}


// ---------- render ----------

function tag(text) {
    const s = document.createElement("span");
    s.className = "tag";
    s.textContent = text;
    return s;
}

function render() {
    const { workload, studyMin, index,
