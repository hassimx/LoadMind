// Focus timer (Pomodoro). Finished focus sessions count as progress on the chosen task
// and go into a daily log, which gives the focus stats and the streak.

const POMO_KEY = "loadmind.pomo";
const PHASE_NAME = { work: "Focus", short: "Short break", long: "Long break" };
const PHASE_SETTING = { work: "pomoWork", short: "pomoShort", long: "pomoLong" };
const PHASE_DEFAULT = { work: 25, short: 5, long: 15 };
const RING = 2 * Math.PI * 54; // circle r=54 in the dial

let pomo = { phase: "work", running: false, endsAt: 0, left: 0, taskId: null, count: 0 };
try { pomo = { ...pomo, ...JSON.parse(localStorage.getItem(POMO_KEY)) }; } catch (e) {}
const pomoSave = () => { try { localStorage.setItem(POMO_KEY, JSON.stringify(pomo)); } catch (e) {} };

const phaseMin = p => clamp(+state.settings[PHASE_SETTING[p]] || PHASE_DEFAULT[p], 1, 180);
const pomoLeft = () => (pomo.running ? Math.max(0, pomo.endsAt - Date.now()) : pomo.left || phaseMin(pomo.phase) * 6e4);
const clock = ms => { const s = Math.ceil(ms / 1000); return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`; };

// a short three-note chime, made in the browser so there is no sound file to load
let audio = null;
function chime() {
    try {
        audio = audio || new (window.AudioContext || window.webkitAudioContext)();
        [0, 0.22, 0.44].forEach((d, i) => {
            const o = audio.createOscillator(), g = audio.createGain(), t = audio.currentTime + d;
            o.frequency.value = [660, 880, 990][i];
            o.connect(g); g.connect(audio.destination);
            g.gain.setValueAtTime(0.0001, t);
            g.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
            g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
            o.start(t); o.stop(t + 0.4);
        });
    } catch (e) {}
}

function logFocus(minutes, full) {
    const day = todayStr();
    const rec = state.focus[day] || { m: 0, n: 0 };
    rec.m += minutes;
    if (full) rec.n += 1;
    state.focus[day] = rec;
    const task = state.tasks.find(t => t.id === pomo.taskId);
    if (task) task.focus = (task.focus || 0) + minutes;
}

// early = the user pressed Skip; a skipped focus session still counts the minutes already done
function pomoFinish(early) {
    const ru = isRu(), was = pomo.phase;
    if (was === "work") {
        const done = early ? Math.floor((phaseMin("work") * 6e4 - pomoLeft()) / 6e4) : phaseMin("work");
        if (done > 0) logFocus(done, !early);
        if (!early) pomo.count++;
        const every = clamp(+state.settings.pomoEvery || 4, 1, 12);
        pomo.phase = !early && pomo.count % every === 0 ? "long" : "short";
    } else {
        pomo.phase = "work";
    }
    pomo.running = false; pomo.left = 0; pomo.endsAt = 0;
    pomoSave(); save();
    if (!early) {
        chime();
        const task = state.tasks.find(t => t.id === pomo.taskId);
        if (was === "work") notify(ru ? "Сессия фокуса закончена" : "Focus session done", (task ? task.title + " · " : "") + (ru ? "Время перерыва." : "Time for a break."));
        else notify(ru ? "Перерыв закончился" : "Break is over", ru ? "Можно начинать следующую сессию." : "Ready for the next session.");
    }
    render();
}

function pomoStart() {
    const ms = pomoLeft();
    pomo.running = true;
    pomo.endsAt = Date.now() + ms;
    pomoSave();
    // the first press is a user gesture, so sound and notifications can be unlocked here
    try { audio = audio || new (window.AudioContext || window.webkitAudioContext)(); audio.resume(); } catch (e) {}
    if ("Notification" in window && Notification.permission === "default") Notification.requestPermission();
}

function pomoToggle() {
    if (pomo.running) { pomo.left = Math.max(1000, pomo.endsAt - Date.now()); pomo.running = false; pomoSave(); }
    else pomoStart();
    render();
}

function pomoSetPhase(p) {
    pomo.phase = p; pomo.running = false; pomo.left = 0; pomo.endsAt = 0;
    pomoSave(); render();
}

// called from the ▶ buttons in My Tasks and in the plan
function startFocusOn(id) {
    if (pomo.taskId !== id || pomo.phase !== "work") { pomo.taskId = id; pomo.phase = "work"; pomo.running = false; pomo.left = 0; }
    if (!pomo.running) pomoStart();
    showView("focus");
    render();
}

function focusStreak() {
    let n = 0, day = todayStr();
    if (!(state.focus[day] && state.focus[day].m)) day = addDays(day, -1); // today still counts until midnight
    while (state.focus[day] && state.focus[day].m) { n++; day = addDays(day, -1); }
    return n;
}

function bestStreak() {
    const days = Object.keys(state.focus).filter(d => state.focus[d].m).sort();
    let best = 0, run = 0, prev = "";
    days.forEach(d => { run = prev && daysBetween(prev, d) === 1 ? run + 1 : 1; best = Math.max(best, run); prev = d; });
    return best;
}

function paintClock() {
    const ms = pomoLeft(), total = phaseMin(pomo.phase) * 6e4, active = pomo.running || pomo.left > 0;
    $("pomoTime").textContent = clock(ms);
    $("pomoArc").style.strokeDashoffset = String(RING * (ms / total));
    const pill = $("pomoPill");
    pill.hidden = !active || view === "focus";
    pill.textContent = (pomo.running ? "● " : "❚❚ ") + clock(ms);
    document.title = pomo.running ? `${clock(ms)} · ${isRu() ? { work: "Фокус", short: "Перерыв", long: "Перерыв" }[pomo.phase] : PHASE_NAME[pomo.phase]} · LoadMind` : "LoadMind";
}

function renderFocus() {
    const ru = isRu();
    $("pomoPhase").textContent = PHASE_NAME[pomo.phase];
    $("pomoArc").style.strokeDasharray = String(RING);
    const every = clamp(+state.settings.pomoEvery || 4, 1, 12);
    $("pomoRound").textContent = pomo.phase === "work" ? `Round ${(pomo.count % every) + 1} of ${every}` : "Break";
    $("pomoStart").textContent = pomo.running ? "Pause" : pomo.left ? "Resume" : "Start";
    $("pomoSkip").textContent = pomo.phase === "work" ? "Finish early" : "Skip break";
    document.querySelectorAll("[data-phase]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.phase === pomo.phase)));

    // task picker: open tasks, most important first
    const sel = $("pomoTask");
    const open = state.tasks.filter(t => !t.done).sort((a, b) => (b.prio || 0) - (a.prio || 0) || isToday(b) - isToday(a));
    if (pomo.taskId && !open.some(t => t.id === pomo.taskId)) { pomo.taskId = null; pomoSave(); }
    sel.replaceChildren(new Option("No task (free focus)", ""), ...open.map(t => new Option((t.prio ? PRIO_MARK[t.prio] + " " : "") + t.title, t.id)));
    sel.value = pomo.taskId || "";
    const task = state.tasks.find(t => t.id === pomo.taskId);
    $("pomoTaskNote").textContent = task ? `Focused on this task: ${dur(task.focus || 0)} of ${dur(task.minutes)}` : "Pick a task and the minutes count towards it.";

    // stats
    const today = state.focus[todayStr()] || { m: 0, n: 0 };
    const unit = m => (m >= 60 ? [Math.floor(m / 60), ` h${m % 60 ? ` ${m % 60} min` : ""}`] : [m, " min"]);
    [$("focusTodayValue").textContent, $("focusTodayUnit").textContent] = unit(today.m);
    $("focusTodayNote").textContent = `${today.n} sessions`;
    const week = Array.from({ length: 7 }, (_, i) => addDays(todayStr(), i - 6));
    const weekMin = week.reduce((s, d) => s + ((state.focus[d] || {}).m || 0), 0);
    [$("focusWeekValue").textContent, $("focusWeekUnit").textContent] = unit(weekMin);
    $("focusWeekNote").textContent = `Average ${dur(Math.round(weekMin / 7))} a day`;
    $("streakValue").textContent = focusStreak();
    $("streakNote").textContent = `Best: ${bestStreak()} days`;

    const max = Math.max(60, ...week.map(d => (state.focus[d] || {}).m || 0));
    $("focusWeek").replaceChildren(...week.map((d, i) => {
        const m = (state.focus[d] || {}).m || 0, col = document.createElement("div");
        col.className = i === 6 ? "today" : "";
        col.title = `${shortDate(d)} · ${m} ${ru ? "мин" : "min"}`;
        col.innerHTML = "<span></span><i></i><small></small>";
        col.querySelector("span").textContent = m || "";
        col.querySelector("i").style.height = `${m / max * 100}%`;
        col.querySelector("small").textContent = new Date(d + "T00:00").toLocaleDateString(ru ? "ru-RU" : "en-GB", { weekday: "short" });
        return col;
    }));
    paintClock();
}

function pomoTick() {
    if (pomo.running && pomo.endsAt <= Date.now()) pomoFinish(false);
    else paintClock();
}
setInterval(pomoTick, 250);
document.addEventListener("visibilitychange", pomoTick);

$("pomoStart").addEventListener("click", pomoToggle);
$("pomoSkip").addEventListener("click", () => pomoFinish(true));
$("pomoReset").addEventListener("click", () => pomoSetPhase(pomo.phase));
$("pomoPill").addEventListener("click", () => showView("focus"));
$("pomoTask").addEventListener("change", e => { pomo.taskId = e.target.value ? Number(e.target.value) : null; pomoSave(); render(); });
document.querySelectorAll("[data-phase]").forEach(b => b.addEventListener("click", () => pomoSetPhase(b.dataset.phase)));
document.addEventListener("click", e => {
    const b = e.target.closest("[data-focus]");
    if (b) startFocusOn(Number(b.dataset.focus));
});
document.addEventListener("keydown", e => {
    if (view !== "focus" || e.code !== "Space" || /INPUT|SELECT|TEXTAREA|BUTTON/.test(e.target.tagName)) return;
    e.preventDefault();
    pomoToggle();
});

// a session that ended while the page was closed is counted once, on load
if (pomo.running && pomo.endsAt <= Date.now()) pomoFinish(false);
else renderFocus();
