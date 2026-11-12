/* Feedback: the «Feedback» button in the top bar (and the link in the footer) opens a short form.
   Messages are saved to the feedback table in Supabase (supabase/schema.sql). Anyone can send one, with or without
   an account, and nobody can read them from the app: they are read in Supabase -> Table Editor -> feedback. */
(function () {
    const T = (en, ru) => (isRu() ? ru : en);
    const KINDS = [["bug", "Bug", "Ошибка"], ["idea", "Idea", "Идея"], ["like", "I like it", "Нравится"], ["other", "Other", "Другое"]];
    const veil = $("fbVeil"), form = $("fbForm"), text = $("fbText"), contact = $("fbContact"), send = $("fbSend"), kinds = $("fbKinds");
    let kind = "", back = null, busy = false, sent = false;

    const msg = (t, bad) => { const m = $("fbMsg"); m.textContent = t; m.classList.toggle("bad", !!bad); };

    function chips() {
        const lang = isRu() ? "ru" : "en";
        if (kinds.dataset.lang !== lang) { // rebuilt only when the language changes
            kinds.dataset.lang = lang;
            kinds.replaceChildren(...KINDS.map(([k, en, ru]) => {
                const b = document.createElement("button");
                b.type = "button"; b.className = "chip"; b.dataset.kind = k; b.textContent = T(en, ru);
                return b;
            }));
        }
        kinds.querySelectorAll("[data-kind]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.kind === kind)));
    }

    function paint() {
        const label = T("Feedback", "Отзыв");
        $("fbBtnText").textContent = label;
        $("fbBtn").title = label;
        $("fbBtn").setAttribute("aria-label", label);
        $("fbFoot").textContent = T("Send feedback", "Оставить отзыв");
        $("fbClose").setAttribute("aria-label", T("Close", "Закрыть"));
        $("fbHead").textContent = sent ? T("Thank you!", "Спасибо!") : label;
        $("fbAbout").textContent = sent
            ? T("Your feedback has been sent. It really helps make LoadMind better.", "Отзыв отправлен. Это правда помогает сделать LoadMind лучше.")
            : T("What is inconvenient, what is missing, what you like. Any feedback helps.", "Что неудобно, чего не хватает, что понравилось. Любой отзыв помогает.");
        kinds.setAttribute("aria-label", T("Type", "Тип"));
        chips();
        $("fbTextL").textContent = T("Message", "Сообщение");
        text.placeholder = T("For example: I'd like a reminder before a deadline", "Например: хочется напоминание перед дедлайном");
        $("fbContactL").textContent = T("How to reach you (optional)", "Как с тобой связаться (необязательно)");
        contact.placeholder = T("Telegram or email", "Telegram или почта");
        send.textContent = sent ? T("Close", "Закрыть") : busy ? T("Sending…", "Отправляю…") : T("Send", "Отправить");
        form.classList.toggle("sent", sent);
    }

    function open() {
        back = document.activeElement;
        sent = false;
        msg("");
        paint();
        veil.hidden = false;
        document.body.classList.add("auth-open");
        setTimeout(() => text.focus(), 30);
    }
    function close() {
        veil.hidden = true;
        document.body.classList.remove("auth-open");
        if (sent) { sent = false; kind = ""; text.value = ""; contact.value = ""; }
        if (back && back.focus) back.focus();
    }

    form.addEventListener("submit", async e => {
        e.preventDefault();
        if (sent) { close(); return; }
        if (busy) return;
        const message = text.value.trim();
        if (!message) { msg(T("Write a few words first.", "Сначала напиши пару слов."), true); text.focus(); return; }
        const sb = window.LoadMindAuth && window.LoadMindAuth.client;
        if (!sb) { msg(T("Couldn't send: no connection. Try again a bit later.", "Не получилось отправить: нет соединения. Попробуй чуть позже."), true); return; }
        busy = true; send.disabled = true; msg(""); paint();
        let error = null;
        try {
            ({ error } = await sb.from("feedback").insert({
                kind: kind || null,
                message: message.slice(0, 4000),
                contact: contact.value.trim().slice(0, 200) || null,
                lang: isRu() ? "ru" : "en",
                page: String(view).slice(0, 40)
            }));
        } catch (err) { error = err; }
        busy = false; send.disabled = false;
        send.focus();
        if (error) {
            console.error(error);
            paint();
            // the database takes at most a few messages an hour, so the form can't be used for spam
            msg(/feedback limit/i.test(error.message || "")
                ? T("Too many messages in the last hour. Please try again a bit later.", "За последний час пришло слишком много отзывов. Попробуй чуть позже.")
                : T("Couldn't send. Check the internet and try again.", "Не получилось отправить. Проверь интернет и попробуй ещё раз."), true);
            return;
        }
        sent = true;
        paint();
    });

    kinds.addEventListener("click", e => {
        const b = e.target.closest("[data-kind]"); if (!b) return;
        kind = kind === b.dataset.kind ? "" : b.dataset.kind;
        chips();
    });
    text.addEventListener("input", () => { if ($("fbMsg").classList.contains("bad")) msg(""); });
    text.addEventListener("keydown", e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); form.requestSubmit(); } });

    $("fbBtn").addEventListener("click", open);
    $("fbFoot").addEventListener("click", open);
    $("fbClose").addEventListener("click", close);
    veil.addEventListener("mousedown", e => { if (e.target === veil) close(); });
    document.addEventListener("keydown", e => {
        if (veil.hidden) return;
        if (e.key === "Escape") { e.preventDefault(); close(); return; }
        if (e.key !== "Tab") return;
        const items = [...veil.querySelectorAll("button, input, textarea")].filter(el => !el.disabled && el.offsetParent);
        if (!items.length) return;
        const a = items[0], z = items[items.length - 1];
        if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
        else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    });
    document.querySelector(".lang").addEventListener("click", () => setTimeout(paint));

    paint();
})();
