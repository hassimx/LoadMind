/* LoadMind research data. For the study of student workload, LoadMind keeps next to the user's other data:
   - minutes spent in LoadMind each day (counted while the page is open and being used),
   - the overload index of each day (highest and average while the app was open),
   - an optional profile: grade and time on social media a day.
   Only totals across all users are looked at (supabase/research.sql), never one person's data. */
(function () {
    const T = (en, ru) => (isRu() ? ru : en);
    const TICK = 15e3;      // check every 15 seconds
    const IDLE = 5 * 6e4;   // no clicks, keys, scrolling or touches for 5 minutes = away (unless the focus timer runs)
    const SYNC_EVERY = 5;   // upload to the account every 5 counted minutes, and when the tab is hidden
    const GRADES = ["7", "8", "9", "10", "11", "12", "uni", "other"];
    const SOCIAL = ["0", "1", "2", "4"]; // under 1 h, 1-2 h, 2-4 h, more than 4 h
    const mins = m => (isRu() ? dur(m).replace(/ h/g, " ч").replace(/ min/g, " мин") : dur(m));
    const gradeName = v => v === "uni" ? T("University / college", "Вуз / колледж") : v === "other" ? T("Other", "Другое") : T(`${v}th grade`, `${v} класс`);
    const socialName = v => ({ 0: T("Under 1 hour", "Меньше часа"), 1: T("1–2 hours", "1–2 часа"), 2: T("2–4 hours", "2–4 часа"), 4: T("More than 4 hours", "Больше 4 часов") })[v];

    function ensure() {
        if (!state.appTime || typeof state.appTime !== "object") state.appTime = {};
        if (!state.load || typeof state.load !== "object") state.load = {};
        if (!state.profile || typeof state.profile !== "object") state.profile = {};
    }

    // ---------- time in the app ----------
    let lastAct = Date.now(), lastMove = 0, secs = 0, pending = 0;
    const touch = () => { lastAct = Date.now(); };
    ["pointerdown", "keydown", "wheel", "touchstart", "scroll"].forEach(e => window.addEventListener(e, touch, { passive: true, capture: true }));
    window.addEventListener("mousemove", () => { const n = Date.now(); if (n - lastMove > 15e3) { lastMove = n; lastAct = n; } }, { passive: true });
    const inUse = () => document.visibilityState === "visible" && (Date.now() - lastAct < IDLE || (typeof pomo !== "undefined" && pomo.running));

    function countMinute() {
        ensure();
        const day = todayStr();
        state.appTime[day] = (state.appTime[day] || 0) + 1;
        // the overload index only means something once the user has added tasks of their own (not just the demo ones)
        if (state.nextId > 5) {
            const i = metrics().index, r = state.load[day] || { x: 0, s: 0, n: 0 };
            r.x = Math.max(r.x, i); r.s += i; r.n += 1;
            state.load[day] = r;
        }
        if (++pending >= SYNC_EVERY) flush();
        else try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
        paintTime();
    }
    function flush() { if (pending) { pending = 0; save(); } }

    setInterval(() => {
        if (!inUse()) return;
        secs += TICK / 1000;
        while (secs >= 60) { secs -= 60; countMinute(); }
    }, TICK);
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flush(); else touch(); });
    window.addEventListener("pagehide", flush);

    function paintTime() {
        const p = $("appTimeNote"); if (!p) return;
        ensure();
        const day = todayStr(), today = state.appTime[day] || 0, focus = (state.focus[day] || {}).m || 0;
        const week = Array.from({ length: 7 }, (_, i) => addDays(day, -i)).reduce((s, d) => s + (state.appTime[d] || 0), 0);
        p.textContent = T(`Time in LoadMind today: ${mins(today)} · focus timer: ${mins(focus)} · last 7 days in LoadMind: ${mins(week)}`,
            `В LoadMind сегодня: ${mins(today)} · в таймере фокуса: ${mins(focus)} · за 7 дней в LoadMind: ${mins(week)}`);
    }

    // ---------- profile (grade, social media), asked once on the dashboard and kept in Settings ----------
    function paintProfile() {
        const g = $("setGrade"), s = $("setSocial"); if (!g || !s) return;
        ensure();
        const lang = isRu() ? "ru" : "en";
        if (g.dataset.lang !== lang) { // options are rebuilt only when the language changes, so an open list is not reset
            g.dataset.lang = lang;
            $("setGradeLabel").textContent = T("Grade", "Класс");
            $("setSocialLabel").textContent = T("Social media a day", "Соцсети в день");
            g.replaceChildren(new Option(T("Not set", "Не указан"), ""), ...GRADES.map(v => new Option(gradeName(v), v)));
            s.replaceChildren(new Option(T("Not set", "Не указано"), ""), ...SOCIAL.map(v => new Option(socialName(v), v)));
        }
        g.value = state.profile.grade || ""; s.value = state.profile.social || "";
        $("profileNote").textContent = T("Both are optional. They help compare workload and focus between grades: only totals across all users are looked at.",
            "Оба поля необязательные. Они помогают сравнить нагрузку и фокус у разных классов: смотрятся только общие цифры по всем пользователям.");
    }

    function paintAsk() {
        const box = $("lmAsk"); if (!box) return;
        ensure();
        const p = state.profile, need = !p.asked && state.nextId > 5 && (!p.grade || !p.social);
        box.hidden = !need || view !== "dashboard";
        if (box.hidden) return;
        const chip = (text, ask) => { const b = document.createElement("button"); b.type = "button"; b.className = "chip"; b.textContent = text; b.dataset.ask = ask; return b; };
        const skip = document.createElement("button"); skip.type = "button"; skip.className = "link-btn"; skip.dataset.ask = "skip"; skip.textContent = T("Don't ask", "Не спрашивать");
        if (!p.grade) {
            $("lmAskQ").textContent = T("Which grade are you in?", "В каком ты классе?");
            $("lmAskRow").replaceChildren(...["7", "8", "9", "10", "11", "uni", "other"].map(v => chip(v === "uni" || v === "other" ? gradeName(v) : v, "grade:" + v)), skip);
        } else {
            $("lmAskQ").textContent = T("About how much time a day do you spend on social media?", "Сколько примерно времени в день у тебя уходит на соцсети?");
            $("lmAskRow").replaceChildren(...SOCIAL.map(v => chip(socialName(v), "social:" + v)), skip);
        }
    }

    document.addEventListener("click", e => {
        const b = e.target.closest("[data-ask]"); if (!b) return;
        ensure();
        const [k, v] = b.dataset.ask.split(":");
        if (k === "skip") state.profile.asked = todayStr();
        else state.profile[k] = v;
        save(); paintAsk(); paintProfile();
    });
    document.addEventListener("change", e => {
        if (e.target.id !== "setGrade" && e.target.id !== "setSocial") return;
        ensure();
        const k = e.target.id === "setGrade" ? "grade" : "social";
        if (e.target.value) state.profile[k] = e.target.value; else delete state.profile[k];
        save(); paintAsk();
    });

    const origRender = render;
    render = function () {
        origRender.apply(this, arguments);
        try { paintTime(); paintProfile(); paintAsk(); } catch (e) { console.error(e); }
    };
    const origShow = showView;
    showView = function () { origShow.apply(this, arguments); paintAsk(); };

    ensure();
    render();
})();
