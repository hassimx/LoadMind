/* Berry: the chat with the LoadMind blueberry. It took over the AI coach: it can look at your day and say what to
   change, help with studying, or just talk when you feel sad or lonely. It uses the same AI as the coach did
   (callAI in script.js: the Worker, with the daily limit for signed-in users). The chat history stays in this browser. */
(function () {
    const T = (en, ru) => (isRu() ? ru : en);
    const KEY = "loadmind.berry";
    const MAX_KEEP = 40;
    const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
    const L = window.LoadMindLoady;

    let log = [];
    try { log = JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) {}
    const keep = () => { log = log.slice(-MAX_KEEP); try { localStorage.setItem(KEY, JSON.stringify(log)); } catch (e) {} };

    const box = $("berryChat"), list = $("bcLog"), form = $("bcForm"), input = $("bcText"), sendBtn = $("bcSend");
    const ava = L.make("calm", { cls: "loady-chat", poke: true });
    $("bcAva").append(ava);
    L.wire(ava);
    // one more on the Today card; tapping him opens the chat
    const cardAva = L.make("calm", { cls: "loady-card", poke: true });
    $("berryCardAva").append(cardAva);
    L.wire(cardAva, true);

    // ---------- what Berry is told ----------
    const SYSTEM = () => `You are Berry (Берри), a small friendly pixel blueberry who lives in LoadMind, a study planner for school students (mostly grades 9-11, Kazakhstan). You are the student's buddy and workload coach in one.
Talk like a kind, slightly playful friend: short (2-5 sentences, at most about 90 words unless asked for more), plain text, no markdown, at most one emoji. Answer in ${uiLang()}, unless the student writes in another language: then answer in that language. In Russian always say "ты", never "вы", and speak about yourself in the masculine form.
You get the student's day: overload index 0-100 (75+ is the red zone), the plan, open tasks with deadlines, notes. Use it when it helps: say concretely what to move, drop or do first and when to rest. Don't invent tasks.
If the student feels sad, lonely, anxious or tired: first listen and name the feeling, ask one gentle question, suggest one small doable step (a short break, a walk, water, sleep, texting a friend or family). Encourage real people around them: friends, family, a school psychologist. You are not a therapist or a doctor: no diagnoses, no medicine advice.
If the student mentions wanting to die, hurting themselves, abuse or being in danger: answer warmly and seriously, say they are not alone, and ask them to call the free 24/7 helpline 150 (Kazakhstan, anonymous, Kazakh and Russian) or 112 if they are in danger right now, and to tell a trusted adult today. Never describe ways of self-harm.
Don't help with cheating, and never pretend to be a human.`;

    function dayData() {
        try {
            const m = metrics();
            return {
                overloadIndex: m.index, capacityHours: state.settings.capacity, dayStarts: state.settings.start, peakFocus: state.settings.peak,
                plan: buildPlan().map(p => `${p.time} ${p.title}${p.rest ? " (break)" : ""}`).slice(0, 20),
                openTasks: state.tasks.filter(t => !t.done).slice(0, 25).map(t => `${t.title}, ${left(t)} min${t.due ? ", due " + t.due : ""}${t.prio ? ", priority " + PRIO_MARK[t.prio] : ""}`),
                notes: (state.notes || "").slice(0, 600) || null
            };
        } catch (e) { return {}; }
    }
    function request(message) {
        const past = log.filter(m => !m.help && !m.login && m.t);
        past.pop();                                   // the message being answered goes separately
        const chat = past.slice(-11).map(m => ({ from: m.r === "u" ? "student" : "Berry", text: m.t.slice(0, 700) }));
        const pack = () => JSON.stringify({ now: new Date().toString(), day: dayData(), earlierInThisChat: chat, studentSays: message.slice(0, 1500) });
        let out = pack();
        while (out.length > 5800 && chat.length) { chat.shift(); out = pack(); }
        return out;
    }

    // someone in real danger gets the numbers right away, whatever the AI says
    const DANGER = /суицид|покончить с собой|убить себя|не хочу жить|хочу умереть|самоповрежд|порезать себя|режу себя|suicid|kill myself|self[- ]?harm|want to die|end my life|hurt myself/i;
    function dangerCard() {
        const c = el("div", "bc-msg b bc-help");
        c.append(el("b", "", T("You're not alone.", "Ты не один и не одна.")),
            el("p", "", T("Please call 150: free, anonymous, 24/7, in Kazakh and Russian. If you are in danger right now, call 112. And tell an adult you trust today.",
                "Пожалуйста, позвони на телефон доверия 150: бесплатно, анонимно, круглосуточно, на казахском и русском. Если опасность прямо сейчас, звони 112. И расскажи сегодня взрослому, которому доверяешь.")));
        const a = el("a", "primary-button", T("Call 150", "Позвонить 150")); a.href = "tel:150";
        c.append(a);
        return c;
    }

    // ---------- the window ----------
    const STARTS = () => [
        ["day", T("Look at my day", "Посмотри мой день")],
        ["", T("I feel sad", "Мне грустно")],
        ["", T("I feel lonely", "Мне одиноко")],
        ["", T("How not to burn out?", "Как не выгореть?")],
        ["", T("Help me get ready for an exam", "Помоги подготовиться к экзамену")],
    ];
    const DAY_ASK = () => T("Look at my day: what should I change?", "Посмотри мой день: что поменять?");
    function hello() {
        return T("Hi! I'm Berry, I live in LoadMind. I can look at your day and say what to change, help with studying, or just talk if you feel down. What shall we talk about?",
            "Привет! Я Берри, живу в LoadMind. Могу посмотреть твой день и подсказать, что поменять, помочь с учёбой или просто поболтать, если грустно. О чём поговорим?");
    }

    function paint() {
        $("berryChatName").textContent = T("Berry", "Берри");
        $("bcSub").textContent = busy ? T("is typing…", "печатает…") : T("your buddy and coach", "твой друг и коуч");
        $("bcClose").setAttribute("aria-label", T("Close", "Закрыть"));
        $("bcClear").textContent = T("Clear", "Очистить");
        $("bcClear").hidden = !log.length;
        input.placeholder = T("Write to Berry…", "Напиши Берри…");
        sendBtn.textContent = T("Send", "Отправить");
        sendBtn.disabled = busy;
        $("bcNote").textContent = T("Each message uses 1 AI request of your daily limit. The chat is kept only in this browser.",
            "Каждое сообщение тратит 1 запрос ИИ из дневного лимита. Переписка хранится только в этом браузере.");
        $("bcStarts").replaceChildren(...STARTS().map(([kind, text]) => { const b = el("button", "chip", text); b.type = "button"; b.dataset.kind = kind; b.dataset.text = text; return b; }));
        $("bcStarts").hidden = busy || log.filter(m => m.r === "u").length > 0 && log.length > 6;
        // the Today card
        $("berryHead").textContent = T("Berry", "Берри");
        $("berryText").textContent = T("Your buddy and coach in one. Ask what to change in your day, get help with studying, or just write if you feel sad.",
            "Твой друг и коуч в одном. Спроси, что поменять в дне, попроси помочь с учёбой или просто напиши, если грустно.");
        $("berryOpen").textContent = T("Talk to Berry", "Поговорить с Берри");
        $("berryDay").textContent = T("Look at my day", "Посмотри мой день");
    }
    function drawLog() {
        list.replaceChildren();
        const items = log.length ? log : [{ r: "b", t: hello() }];
        items.forEach(m => {
            list.append(m.help ? dangerCard() : el("div", "bc-msg " + (m.r === "u" ? "u" : "b"), m.t));
            if (m.login) { const b = el("button", "secondary-button bc-login", T("Sign in", "Войти")); b.type = "button"; list.append(b); }
        });
        if (busy) { const d = el("div", "bc-msg b bc-typing"); d.append(el("i"), el("i"), el("i")); list.append(d); }
        list.scrollTop = list.scrollHeight;
    }

    let busy = false, back = null;
    function open(kind) {
        back = document.activeElement;
        box.hidden = false;
        document.body.classList.add("berry-open");
        paint(); drawLog();
        L.hold(ava, "happy", null, 900);
        if (kind === "day") send(DAY_ASK(), true);
        else if (matchMedia("(hover: hover)").matches) setTimeout(() => input.focus(), 60);
    }
    function close() {
        box.hidden = true;
        document.body.classList.remove("berry-open");
        if (back && back.focus) back.focus();
    }

    async function send(text, isDay) {
        text = String(text || "").trim();
        if (!text || busy) return;
        log.push({ r: "u", t: text }); keep();
        input.value = ""; grow();
        if (DANGER.test(text)) { log.push({ r: "b", t: "", help: true }); keep(); }
        if (!hasAI()) {
            const signIn = authOn();
            log.push({ r: "b", t: signIn ? T("To talk with me, sign in or create an account. It's free.", "Чтобы со мной поговорить, войди или создай аккаунт. Это бесплатно.") : T("Add an AI key in Settings first.", "Сначала добавь ключ ИИ в настройках."), login: signIn });
            keep(); paint(); drawLog(); L.hold(ava, "ok", null, 1500);
            return;
        }
        busy = true; paint(); drawLog();
        L.hold(ava, "think", null, 60000);
        let reply;
        try {
            reply = String(await callAI(SYSTEM() + (isDay ? "\nThe student asks you to look at their day: be a coach now, say what to move or drop, what to do at the peak focus time and where to rest." : ""), request(text))).trim();
        } catch (e) {
            reply = e.status === 401 ? T("Your session has ended. Sign in again and write to me.", "Сессия закончилась. Войди ещё раз и напиши мне.")
                : /quota|exhaust|rate|limit|429/i.test(e.message) ? T("We've used up today's AI limit. Let's talk tomorrow!", "На сегодня лимит ИИ закончился. Давай поговорим завтра!")
                : /fetch/i.test(e.message) ? T("I can't reach the AI server right now. Check the internet and try again.", "Не могу достучаться до ИИ-сервера. Проверь интернет и попробуй ещё раз.")
                : T("Something went wrong: ", "Что-то пошло не так: ") + e.message;
        }
        busy = false;
        log.push({ r: "b", t: reply || "…" }); keep();
        paint(); drawLog();
        L.hold(ava, "talk", null, Math.min(3200, 900 + (reply || "").length * 12));
    }

    // grow the field with the text, up to a few lines
    function grow() { input.style.height = "auto"; input.style.height = Math.min(120, input.scrollHeight) + "px"; }
    input.addEventListener("input", grow);
    input.addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit(); } });
    form.addEventListener("submit", e => { e.preventDefault(); send(input.value); });
    $("bcStarts").addEventListener("click", e => { const b = e.target.closest(".chip"); if (b) send(b.dataset.kind === "day" ? DAY_ASK() : b.dataset.text, b.dataset.kind === "day"); });
    $("bcClose").addEventListener("click", close);
    $("bcClear").addEventListener("click", () => { log = []; keep(); paint(); drawLog(); });
    list.addEventListener("click", e => { if (e.target.closest(".bc-login") && window.LoadMindAuth) LoadMindAuth.open(); });
    document.addEventListener("keydown", e => { if (!box.hidden && e.key === "Escape") { e.preventDefault(); close(); } });
    $("berryOpen").addEventListener("click", () => open());
    $("berryDay").addEventListener("click", () => open("day"));
    document.querySelector(".lang").addEventListener("click", () => setTimeout(() => { paint(); if (!box.hidden) drawLog(); }));

    paint();
    window.LoadMindBerry = { open, close, isOpen: () => !box.hidden };
})();
