// Cloudflare Worker: hides the Gemini key from the browser and lets only signed-in users use the AI.
// Settings -> Variables and Secrets:
//   GEMINI_KEY      (secret)  key from Google AI Studio
//   SUPABASE_URL    (text)    https://<project>.supabase.co
//   SUPABASE_KEY    (text)    publishable key (sb_publishable_...), the same one the site uses
//   GEMINI_MODEL    (text, optional)  default gemini-3.8-flash
//   AI_DAILY_LIMIT  (text, optional)  AI requests per user per day, default 30
//   ALLOWED_ORIGIN  (text, optional)  your site URLs, comma separated
export default {
  async fetch(req, env) {
    const list = (env.ALLOWED_ORIGIN || "*").split(",").map(x => x.trim());
    const reqOrigin = req.headers.get("origin") || "";
    const origin = list.includes("*") ? "*" : (list.includes(reqOrigin) ? reqOrigin : list[0]);
    const cors = { "access-control-allow-origin": origin, "access-control-allow-methods": "POST, OPTIONS", "access-control-allow-headers": "content-type, authorization", "vary": "origin" };
    const reply = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { ...cors, "content-type": "application/json" } });
    if (req.method === "OPTIONS") return new Response(null, { headers: cors });
    if (req.method !== "POST") return reply({ error: "POST only" }, 405);
    if (!env.GEMINI_KEY || !env.SUPABASE_URL || !env.SUPABASE_KEY) return reply({ error: "Server is not configured (GEMINI_KEY, SUPABASE_URL, SUPABASE_KEY)" }, 500);

    // 1. who is asking: the site sends the Supabase session token
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
    if (!token) return reply({ error: "Sign in to use the AI" }, 401);

    // 2. count the request against the user's daily limit (the database checks the token)
    const limit = Math.max(1, parseInt(env.AI_DAILY_LIMIT, 10) || 30);
    let left;
    try {
      const q = await fetch(`${env.SUPABASE_URL.replace(/\/+$/, "")}/rest/v1/rpc/use_ai`, {
        method: "POST",
        headers: { apikey: env.SUPABASE_KEY, authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ daily_limit: limit })
      });
      if (q.status === 401 || q.status === 403) return reply({ error: "Session expired, sign in again" }, 401);
      if (!q.ok) return reply({ error: "Account check failed" }, 502);
      left = Number(await q.json());
    } catch {
      return reply({ error: "Account check failed" }, 502);
    }
    if (!(left >= 0)) return reply({ error: `Daily AI limit reached (${limit} requests). It resets at midnight UTC.` }, 429);

    // 3. ask Gemini
    let body;
    try { body = await req.json(); } catch { return reply({ error: "Bad JSON" }, 400); }
    const system = String(body.system || "").slice(0, 2000);
    const user = String(body.user || "").slice(0, 6000); // size limit protects your budget
    if (!user) return reply({ error: "Empty request" }, 400);

    const model = env.GEMINI_MODEL || "gemini-3.8-flash";
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": env.GEMINI_KEY },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: [{ role: "user", parts: [{ text: user }] }] })
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return reply({ error: data.error?.message || "AI error" }, r.status === 429 ? 429 : 502);
    const parts = data.candidates?.[0]?.content?.parts || [];
    const text = parts.filter(p => !p.thought).map(p => p.text || "").join("").trim();
    if (!text) return reply({ error: "The AI returned an empty answer, try again" }, 502);
    return reply({ text, left });
  }
};
