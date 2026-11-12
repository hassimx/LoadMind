/* Anonymous usage count: how many people open LoadMind and use it, guests included.
   Once in a while it sends a few numbers for today with a random id made in this browser:
   minutes in the app, focus minutes, how many tasks were added, the overload index,
   grade and social media (only if answered), and whether the sign in window was opened.
   No email, name or task text. Stored in supabase/usage.sql (usage_daily), which the site can only write to. */
(function () {
    const ID = "loadmind.anon", SRC = "loadmind.src", FLAGS = "loadmind.statsDay";
    const EVERY = 5 * 6e4; // send at most every 5 minutes while the page is open
    const get = k => { try { return localStorage.getItem(k) || ""; } catch (e) { return ""; } };
    const set = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };

    if (typeof SUPABASE_URL === "undefined" || !SUPABASE_URL || !SUPABASE_KEY) return;
    if (navigator.webdriver) return; // headless browsers and bots

    let id = get(ID);
    if (!/^[0-9a-f-]{36}$/.test(id)) {
        id = crypto.randomUUID ? crypto.randomUUID()
            : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, c => (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16));
        set(ID, id);
    }

    // where the first visit came from: loadmind.dev/?from=telegram or ?utm_source=...
    if (!get(SRC)) {
        const q = new URLSearchParams(location.search), s = (q.get("from") || q.get("utm_source") || "").slice(0, 40);
        set(SRC, /^[A-Za-z0-9_.-]+$/.test(s) ? s : "-");
    }

    // flags of the day: opened the sign in window, pressed "Create account"
    function flags() {
        let f = {};
        try { f = JSON.parse(get(FLAGS) || "{}"); } catch (e) {}
        if (f.day !== todayStr()) f = { day: todayStr() };
        return f;
    }
    function flag(name) { const f = flags(); if (!f[name]) { f[name] = true; set(FLAGS, JSON.stringify(f)); send(true); } }

    document.addEventListener("click", e => {
        if (e.target.closest("#accountBtn, .bc-login")) flag("authOpened");
    }, true);
    document.addEventListener("submit", e => {
        if (e.target.id === "authForm" && $("tabUp") && $("tabUp").getAttribute("aria-pressed") === "true") flag("signupTried");
    }, true);

    function payload() {
        const day = todayStr(), f = flags(), p = (state && state.profile) || {};
        const load = (state && state.load && state.load[day]) || null;
        const src = get(SRC);
        return {
            id, day,
            app: (state.appTime && state.appTime[day]) || 0,
            focus: (state.focus && state.focus[day] && state.focus[day].m) || 0,
            tasks: Math.max(0, (state.nextId || 5) - 5),
            loadMax: load ? Math.round(load.x) : undefined,
            loadAvg: load && load.n ? Math.round(load.s / load.n) : undefined,
            grade: p.grade || undefined,
            social: p.social || undefined,
            lang: isRu() ? "ru" : "en",
            mobile: matchMedia("(pointer: coarse)").matches,
            signedIn: !!(window.LoadMindAuth && LoadMindAuth.user),
            authOpened: !!f.authOpened,
            signupTried: !!f.signupTried,
            src: src && src !== "-" ? src : undefined
        };
    }

    let last = 0, lastBody = "";
    function send(force) {
        if (!force && Date.now() - last < EVERY) return;
        let body;
        try { body = JSON.stringify({ p: payload() }); } catch (e) { return; }
        if (body === lastBody) return;
        last = Date.now(); lastBody = body;
        try {
            fetch(SUPABASE_URL + "/rest/v1/rpc/track_day", {
                method: "POST", keepalive: true,
                headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY },
                body
            }).catch(() => {});
        } catch (e) {}
    }

    setTimeout(() => send(true), 3000);              // the visit itself
    setInterval(() => { if (document.visibilityState === "visible") send(false); }, 6e4);
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") send(true); });
})();
