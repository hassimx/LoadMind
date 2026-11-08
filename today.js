/* Today screen extras: a first line for new users, what's already done today (it stays in the plan, crossed out)
   and editing a task by tapping it in the plan or in the task list. */
(function () {
    const T = (en, ru) => (isRu() ? ru : en);
    const mins = m => (isRu() ? dur(m).replace(/ h/g, " ч").replace(/ min/g, " мин") : dur(m));
    const doneToday = () => state.tasks.filter(t => t.done && t.doneAt === todayStr());

    // ---------- first line for new users ----------
    function paintIntro() {
        const p = $("lmIntro"); if (!p) return;
        p.hidden = state.tasks.length > 0;
        p.textContent = T("LoadMind turns your tasks into a realistic plan for the day and warns you when you take on too much. Just write what you need to do: the time and how long it takes are picked up by themselves.",
            "LoadMind превращает задачи в реалистичный план дня и предупреждает, когда ты берёшь на себя слишком много. Просто напиши, что нужно сделать: время и длительность он поймёт сам.");
    }

    // ---------- done today ----------
    function paintDone() {
        const box = $("doneToday"); if (!box) return;
        const done = doneToday();
        box.hidden = !done.length;
        if (!todayTasks().length && done.length) {
            $("schedule").innerHTML = "";
            const p = document.createElement("p"); p.className = "empty"; p.dataset.notr = "";
            p.textContent = T("Everything for today is done. Nice work!", "На сегодня всё сделано. Так держать!");
            $("schedule").append(p);
        }
        if (!done.length) return;
        const head = document.createElement("p");
        head.className = "lm-done-head"; head.dataset.notr = "";
        head.textContent = T(`Done today: ${done.length} · ${mins(done.reduce((s, t) => s + t.minutes, 0))}`, `Сделано сегодня: ${done.length} · ${mins(done.reduce((s, t) => s + t.minutes, 0))}`);
        box.replaceChildren(head, ...done.map(t => {
            const row = document.createElement("div");
            row.className = "task done";
            row.innerHTML = `<span class="check"><input type="checkbox" checked></span><div class="time">✓</div><div class="task-info"><strong></strong><small></small></div>`;
            const c = row.querySelector("input"); c.dataset.undo = t.id; c.title = "Mark as not done"; c.setAttribute("aria-label", "Mark as not done");
            row.querySelector("strong").textContent = t.title;
            row.querySelector("small").textContent = `${dur(t.minutes)} · ${TYPE_LABEL[t.type]}`;
            row.dataset.id = t.id;
            return row;
        }));
    }
    document.addEventListener("click", e => {
        const c = e.target.closest("input[data-undo]"); if (!c) return;
        const t = state.tasks.find(x => x.id === Number(c.dataset.undo));
        if (t) { setDone(t, false); save(); render(); }
    });

    // ---------- edit a task ----------
    let editing = null;
    const TYPES = [["exam", "Exam prep", "Подготовка к экзамену"], ["study", "Study", "Учёба"], ["physical", "Sport / physical", "Спорт / физическое"], ["light", "Light", "Лёгкое"]];
    const PRIOS = [["0", "No priority", "Без приоритета"], ["1", "! Low", "! Низкий"], ["2", "!! Important", "!! Важно"], ["3", "!!! Urgent", "!!! Срочно"]];
    const REPEATS = [["", "Does not repeat", "Не повторяется"], ["daily", "Every day", "Каждый день"], ["weekdays", "Weekdays", "По будням"], ["weekly", "Every week", "Каждую неделю"]];
    const fill = (sel, list) => sel.replaceChildren(...list.map(([v, en, ru]) => new Option(T(en, ru), v)));

    function openEdit(id) {
        const t = state.tasks.find(x => x.id === id); if (!t) return;
        editing = t;
        $("edHead").textContent = T("Edit task", "Изменить задачу");
        [["edTitleL", "Task", "Задача"], ["edDurL", "Duration", "Длительность"], ["edTypeL", "Type", "Тип"], ["edAtL", "Starts at (fixed time)", "Начало (точное время)"],
         ["edDayL", "Or just the day", "Или просто день"], ["edDueL", "Deadline", "Дедлайн"], ["edPrioL", "Priority", "Приоритет"], ["edRepeatL", "Repeat", "Повтор"],
         ["edHU", "h", "ч"], ["edMU", "min", "мин"], ["edSave", "Save", "Сохранить"], ["edCancel", "Cancel", "Отмена"], ["edDel", "Delete task", "Удалить задачу"]]
            .forEach(([id, en, ru]) => { $(id).textContent = T(en, ru); });
        fill($("edType"), TYPES); fill($("edPrio"), PRIOS); fill($("edRepeat"), REPEATS);
        $("edTitle").value = t.title;
        $("edH").value = Math.floor(t.minutes / 60); $("edM").value = t.minutes % 60;
        $("edType").value = t.type; $("edPrio").value = String(t.prio || 0); $("edRepeat").value = t.repeat || "";
        $("edAt").value = t.at || ""; $("edDay").value = t.at ? "" : (t.day || ""); $("edDue").value = t.due || "";
        $("edNote").textContent = t.src === "gcal" || t.src === "ics"
            ? T("This came from Google Calendar: the next sync or import can bring back the original.", "Это событие из Google Календаря: следующая синхронизация или импорт могут вернуть исходное.")
            : T("No start time and no day means: today, wherever it fits.", "Без времени и дня задача встанет на сегодня туда, где есть место.");
        $("editVeil").hidden = false; document.body.classList.add("auth-open");
        setTimeout(() => $("edTitle").focus(), 50);
    }
    function closeEdit() { $("editVeil").hidden = true; document.body.classList.remove("auth-open"); editing = null; }

    $("editForm").addEventListener("submit", e => {
        e.preventDefault();
        const t = editing; if (!t) return;
        const title = $("edTitle").value.trim(); if (!title) { $("edTitle").focus(); return; }
        t.title = title;
        t.minutes = clamp((+$("edH").value || 0) * 60 + (+$("edM").value || 0), 5, 720);
        t.type = $("edType").value; t.prio = +$("edPrio").value; t.repeat = $("edRepeat").value;
        t.at = $("edAt").value || "";
        t.day = t.at ? "" : ($("edDay").value || "");
        t.due = $("edDue").value || "";
        closeEdit(); save(); render();
    });
    $("edCancel").addEventListener("click", closeEdit);
    $("edClose").addEventListener("click", closeEdit);
    $("edDel").addEventListener("click", () => {
        if (!editing) return;
        const id = editing.id;
        state.tasks = state.tasks.filter(t => t.id !== id);
        closeEdit(); save(); render();
    });
    $("editVeil").addEventListener("click", e => { if (e.target === $("editVeil")) closeEdit(); });
    document.addEventListener("keydown", e => { if (e.key === "Escape" && !$("editVeil").hidden) closeEdit(); });

    // tap a task's name in the plan or in the list to edit it
    document.addEventListener("click", e => {
        const name = e.target.closest(".lm-plan .task-info, .task-row .task-name"); if (!name) return;
        if (e.target.closest("a, button, input")) return;
        const row = name.closest(".task, .task-row");
        const id = Number(row.dataset.id || (row.querySelector("input[data-id]") || {}).dataset?.id);
        if (id) openEdit(id);
    });
    function markEditable() {
        document.querySelectorAll(".lm-plan .task:not(.break) .task-info, .task-row .task-name").forEach(el => { el.title = "Tap to edit"; el.classList.add("lm-editable"); });
    }

    const origRender = render;
    render = function () {
        origRender.apply(this, arguments);
        try { paintIntro(); paintDone(); markEditable(); } catch (e) { console.error(e); }
    };
    render();
})();
