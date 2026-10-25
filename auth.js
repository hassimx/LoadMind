/* LoadMind accounts: sign up / sign in with Supabase and keep the data in the cloud, so it syncs between devices.
   Without an account everything works as before and stays in this browser. */

// Supabase -> Project Settings -> Data API (URL) and API Keys (publishable key).
// Both are public and safe to keep here: every row is protected by row level security (supabase/schema.sql).
const SUPABASE_URL = "https://nstxupxrnwfmxdcmrbjy.supabase.co";
const SUPABASE_KEY = "sb_publishable_SwG_2MiHBgK5jp00zQPuYw_FPgMq5T_";

(function () {
    const OWNER = "loadmind.owner";   // which account the data in this browser belongs to
    const SEEN = "loadmind.synced";   // time of the cloud copy this browser last saw
    const DIRTY = "loadmind.dirty";   // there are local changes the cloud does not have yet
    const T = (en, ru) => (isRu() ? ru : en);
    const get = k => { try { return localStorage.getItem(k) || ""; } catch (e) { return ""; } };
    const set = (k, v) => { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch (e) {} };

    const api = window.LoadMindAuth = { configured: false, user: null, token: async () => null, queue() {}, open() {} };
    const btn = $("accountBtn"), veil = $("authVeil");

    function paintNote() {
        $("storageNote").textContent = api.user
            ? T("Your tasks are saved to your account and sync between devices.", "Задачи сохраняются в аккаунте и синхронизируются между устройствами.")
            : T("Everything is stored in this browser only.", "Всё хранится только в этом браузере.");
    }
    document.querySelector(".lang").addEventListener("click", () => setTimeout(api.configured ? paint : paintNote));

    if (!SUPABASE_URL || !SUPABASE_KEY || !window.supabase) {
        paintNote();
        return;
    }

    const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
    api.configured = true;
    api.token = async () => { try { const { data } = await sb.auth.getSession(); return data.session ? data.session.access_token : null; } catch (e) { return null; } };
    btn.hidden = false;

    // sync: last change wins. Local edits are uploaded a moment after they happen.
    let timer = null, busy = false, status = "", mode = "in", leaving = false;
    const DEMO = fresh().tasks.map(t => t.title).join("|");
    const newer = (a, b) => !b || new Date(a) > new Date(b);
    const cloudCopy = () => { const d = JSON.parse(JSON.stringify(state)); d.settings.key = ""; return d; };
    const guestHasData = () => state.tasks.map(t => t.title).join("|") !== DEMO || !!state.notes || Object.keys(state.focus || {}).length > 0;

    function setStatus(s) { status = s; paint(); }

    async function push() {
        if (!api.user) return;
        if (busy) { clearTimeout(timer); timer = setTimeout(push, 600); return; }
        clearTimeout(timer); timer = null; busy = true;
        set(DIRTY, "");
        setStatus("saving");
        const { data, error } = await sb.from("user_data").upsert({ user_id: api.user.id, data: cloudCopy() }).select("updated_at").single();
        busy = false;
        if (error) { set(DIRTY, "1"); setStatus("error"); clearTimeout(timer); timer = setTimeout(push, 15000); return; }
        set(SEEN, data.updated_at);
        setStatus(get(DIRTY) ? "saving" : "saved");
    }
    api.queue = () => {
        if (!api.user) return;
        set(DIRTY, "1");
        clearTimeout(timer);
        timer = setTimeout(push, 1200);
    };

    async function pull() {
        const { data, error } = await sb.from("user_data").select("data, updated_at").eq("user_id", api.user.id).maybeSingle();
        if (error) throw error;
        return data;
    }

    function apply(raw, seen) {
        const key = state.settings.key;
        raw = raw && typeof raw === "object" ? raw : {};
        state = { ...fresh(), ...raw, settings: { ...fresh().settings, ...(raw.settings || {}), key } };
        if (!Array.isArray(state.tasks)) state.tasks = [];
        try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
        if (seen) set(SEEN, seen);
        init();
    }

    async function signedIn(user) {
        api.user = user;
        paint(); render();
        let row;
        try { row = await pull(); } catch (e) { setStatus("error"); return; }
        if (!api.user || api.user.id !== user.id) return;
        const owner = get(OWNER);
        if (owner === user.id) {
            // this browser already holds this account's data
            if (get(DIRTY) || !row) push();
            else if (newer(row.updated_at, get(SEEN))) apply(row.data, row.updated_at);
            else setStatus("saved");
        } else if (!row) {
            // brand-new account: it starts with what is in this browser (unless that belongs to someone else)
            if (owner) apply({}, "");
            set(OWNER, user.id);
            push();
        } else {
            // the account already has data; offer to add the guest tasks from this browser
            let extra = [];
            if (!owner && guestHasData() && confirm(T("Add the tasks from this browser to your account?", "Добавить задачи из этого браузера в аккаунт?"))) {
                const have = new Set((row.data.tasks || []).map(t => t.title + "|" + (t.due || "") + "|" + (t.at || "")));
                extra = state.tasks.filter(t => !have.has(t.title + "|" + (t.due || "") + "|" + (t.at || "")));
            }
            set(OWNER, user.id);
            apply(row.data, row.updated_at);
            if (extra.length) {
                extra.forEach(t => state.tasks.push({ ...t, id: state.nextId++ }));
                save(); render();
            } else setStatus("saved");
        }
    }

    function signedOut() {
        api.user = null;
        clearTimeout(timer);
        if (leaving) {
            // signing out on purpose: the data is in the cloud, so this browser is cleaned (shared computers)
            leaving = false;
            [OWNER, SEEN, DIRTY].forEach(k => set(k, ""));
            apply({}, "");
        } else render();
        setStatus("");
    }

    sb.auth.onAuthStateChange((event, session) => {
        // supabase-js asks not to call it again inside this callback, so the work runs right after
        setTimeout(() => {
            if (event === "PASSWORD_RECOVERY") { mode = "new"; open(); }
            const user = session && session.user;
            if (user && (!api.user || api.user.id !== user.id)) signedIn(user);
            else if (user) { api.user = user; paint(); }
            else if (api.user || leaving) signedOut();
        }, 0);
    });

    // coming back to the tab: pick up changes made on another device; leaving it: upload what is left
    document.addEventListener("visibilitychange", async () => {
        if (!api.user) return;
        if (document.visibilityState === "hidden") { if (get(DIRTY)) push(); return; }
        if (busy || get(DIRTY)) return;
        try {
            const row = await pull();
            if (row && api.user && !get(DIRTY) && newer(row.updated_at, get(SEEN))) apply(row.data, row.updated_at);
        } catch (e) {}
    });

    // account window
    const short = e => { const n = (e || "").split("@")[0]; return n.length > 14 ? n.slice(0, 13) + "…" : n; };

    function paint() {
        paintNote();
        btn.textContent = api.user ? short(api.user.email) : T("Sign in", "Войти");
        btn.classList.toggle("in", !!api.user);
        btn.dataset.status = api.user ? status : "";
        btn.title = api.user ? api.user.email : T("Sign in or create an account", "Войти или создать аккаунт");
        btn.setAttribute("aria-label", btn.title);

        const view = api.user && mode !== "new" ? "in" : mode === "new" ? "new" : "out";
        $("authOut").hidden = view !== "out";
        $("authIn").hidden = view !== "in";
        $("authNew").hidden = view !== "new";
        $("authClose").setAttribute("aria-label", T("Close", "Закрыть"));

        $("authTitle").textContent = view === "in" ? T("Your account", "Твой аккаунт") : view === "new" ? T("New password", "Новый пароль") : mode === "up" ? T("Create an account", "Создать аккаунт") : T("Sign in", "Вход");
        $("tabIn").textContent = T("Sign in", "Вход");
        $("tabUp").textContent = T("Create account", "Регистрация");
        $("tabIn").setAttribute("aria-pressed", String(mode === "in"));
        $("tabUp").setAttribute("aria-pressed", String(mode === "up"));
        $("authEmailLabel").firstChild.nodeValue = T("Email", "Почта") + " ";
        $("authPassLabel").firstChild.nodeValue = T("Password", "Пароль") + " ";
        $("authPass").autocomplete = mode === "up" ? "new-password" : "current-password";
        $("authSubmit").textContent = mode === "up" ? T("Create account", "Создать аккаунт") : T("Sign in", "Войти");
        $("authForgot").textContent = T("Forgot password?", "Забыла пароль?");
        $("authForgot").hidden = mode === "up";
        $("authAbout").textContent = T("With an account your tasks sync between devices and the AI coach works. Without one, everything stays in this browser.", "С аккаунтом задачи синхронизируются между устройствами и работает ИИ-коуч. Без него всё остаётся в этом браузере.");

        $("authWho").textContent = api.user ? api.user.email : "";
        $("authSync").textContent = {
            saving: T("Saving…", "Сохраняю…"),
            saved: T("All changes are saved to your account.", "Все изменения сохранены в аккаунте."),
            error: T("Can't reach the server. Changes are kept here and will be uploaded later.", "Нет связи с сервером. Изменения сохранены здесь и загрузятся позже.")
        }[status] || T("Connecting…", "Подключаюсь…");
        $("authOutBtn").textContent = T("Sign out", "Выйти");
        $("authNewPassLabel").firstChild.nodeValue = T("New password", "Новый пароль") + " ";
        $("authNewSave").textContent = T("Save password", "Сохранить пароль");
    }

    const msg = (text, bad) => { const m = $("authMsg"); m.textContent = text; m.classList.toggle("bad", !!bad); };
    const newMsg = (text, bad) => { const m = $("authNewMsg"); m.textContent = text; m.classList.toggle("bad", !!bad); };
    let back = null;

    function open() {
        back = document.activeElement;
        msg(""); newMsg("");
        paint();
        veil.hidden = false;
        document.body.classList.add("auth-open");
        const first = veil.querySelector(api.user && mode !== "new" ? "#authOutBtn" : mode === "new" ? "#authNewPass" : "#authEmail");
        setTimeout(() => first && first.focus(), 30);
    }
    function close() {
        veil.hidden = true;
        document.body.classList.remove("auth-open");
        if (mode === "new") mode = "in";
        if (back && back.focus) back.focus();
    }
    api.open = open;

    btn.addEventListener("click", open);
    $("authClose").addEventListener("click", close);
    veil.addEventListener("mousedown", e => { if (e.target === veil) close(); });
    veil.addEventListener("keydown", e => {
        if (e.key === "Escape") { e.preventDefault(); close(); return; }
        if (e.key !== "Tab") return;
        const items = [...veil.querySelectorAll("button, input")].filter(el => !el.disabled && el.offsetParent);
        if (!items.length) return;
        const a = items[0], z = items[items.length - 1];
        if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
        else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    });
    $("tabIn").addEventListener("click", () => { mode = "in"; msg(""); paint(); });
    $("tabUp").addEventListener("click", () => { mode = "up"; msg(""); paint(); });

    const site = () => location.origin + location.pathname;
    const explain = e => {
        const m = (e && e.message) || "";
        if (/invalid login credentials/i.test(m)) return T("Wrong email or password.", "Неверная почта или пароль.");
        if (/email not confirmed/i.test(m)) return T("Confirm your email first: open the link in the letter from Supabase.", "Сначала подтверди почту: открой ссылку из письма.");
        if (/already registered|already exists/i.test(m)) return T("This email already has an account. Sign in instead.", "На эту почту уже есть аккаунт. Просто войди.");
        if (/rate limit|too many/i.test(m)) return T("Too many attempts. Wait a few minutes and try again.", "Слишком много попыток. Подожди пару минут и попробуй снова.");
        if (/password/i.test(m) && /(6|characters|short|weak)/i.test(m)) return T("The password is too short or too simple (at least 6 characters).", "Пароль слишком короткий или простой (минимум 6 символов).");
        if (/fetch|network/i.test(m)) return T("No connection to the server. Check the internet and try again.", "Нет связи с сервером. Проверь интернет и попробуй снова.");
        return m || T("Something went wrong, try again.", "Что-то пошло не так, попробуй ещё раз.");
    };

    $("authForm").addEventListener("submit", async e => {
        e.preventDefault();
        const email = $("authEmail").value.trim(), password = $("authPass").value, go = $("authSubmit");
        if (!email || !password) return;
        if (mode === "up" && password.length < 6) { msg(T("The password needs at least 6 characters.", "В пароле нужно минимум 6 символов."), true); return; }
        go.disabled = true;
        msg(T("One moment…", "Секунду…"));
        try {
            if (mode === "up") {
                const { data, error } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: site() } });
                if (error) throw error;
                if (data.user && Array.isArray(data.user.identities) && !data.user.identities.length) throw new Error("already registered");
                if (data.session) { msg(""); $("authPass").value = ""; close(); }
                else msg(T("Almost done: we sent a letter to " + email + ". Open the link in it to confirm your account.", "Почти готово: мы отправили письмо на " + email + ". Открой ссылку в нём, чтобы подтвердить аккаунт."));
            } else {
                const { error } = await sb.auth.signInWithPassword({ email, password });
                if (error) throw error;
                msg(""); $("authPass").value = ""; close();
            }
        } catch (err) {
            const known = /already registered|already exists/i.test((err && err.message) || "");
            if (known) { mode = "in"; paint(); }
            msg(known ? T("You already have an account with this email. Type your password and press Sign in.", "У тебя уже есть аккаунт на эту почту. Введи пароль и нажми «Войти».") : explain(err), true);
        }
        go.disabled = false;
    });

    $("authForgot").addEventListener("click", async () => {
        const email = $("authEmail").value.trim();
        if (!email) { msg(T("Type your email above first.", "Сначала напиши почту выше."), true); $("authEmail").focus(); return; }
        msg(T("One moment…", "Секунду…"));
        const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: site() });
        msg(error ? explain(error) : T("If this email has an account, a letter with a link to set a new password is on its way.", "Если на эту почту есть аккаунт, туда придёт письмо со ссылкой для нового пароля."), !!error);
    });

    $("authNewForm").addEventListener("submit", async e => {
        e.preventDefault();
        const password = $("authNewPass").value, go = $("authNewSave");
        if (password.length < 6) { newMsg(T("The password needs at least 6 characters.", "В пароле нужно минимум 6 символов."), true); return; }
        go.disabled = true;
        const { error } = await sb.auth.updateUser({ password });
        go.disabled = false;
        if (error) { newMsg(explain(error), true); return; }
        $("authNewPass").value = "";
        mode = "in";
        newMsg("");
        paint();
        msg(T("Password saved.", "Пароль сохранён."));
    });

    $("authOutBtn").addEventListener("click", async () => {
        const go = $("authOutBtn");
        go.disabled = true;
        if (get(DIRTY)) { try { await push(); } catch (e) {} }
        leaving = true;
        const { error } = await sb.auth.signOut({ scope: "local" });
        go.disabled = false;
        if (error) { leaving = false; $("authSync").textContent = explain(error); return; }
        close();
    });

    paint();
})();
