// Cloudflare Worker: hides the Gemini key from the browser.
// Settings -> Variables and Secrets: GEMINI_KEY (secret), optional ALLOWED_ORIGIN (your site URL), GEMINI_MODEL.
export default {
  async fetch(req, env) {
    const origin = env.ALLOWED_ORIGIN || "*";
    const cors = { "access-control-allow-origin": origin, "access-control-allow-methods": "POST, OPTIONS", "access-control-allow-headers": "content-type" };
    const reply = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { ...cors, "content-type": "application/json" } });
    if (req.method === "OPTIONS") return new Response(null, { headers: cors });
    if (req.method !== "POST") return reply({ error: "POST only" }, 405);

    let body;
    try { body = await req.json(); } catch { return reply({ error: "Bad JSON" }, 400); }
    const system = String(body.system || "").slice(0, 2000);
    const user = String(body.user || "").slice(0, 6000); // size limit protects your quota
    if (!user) return reply({ error: "Empty request" }, 400);

    const model = env.GEMINI_MODEL || "gemini-2.5-flash";
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": env.GEMINI_KEY },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: [{ role: "user", parts: [{ text: user }] }] })
    });
    const data = await r.json();
    if (!r.ok) return reply({ error: data.error?.message || "AI error" }, 502);
    return reply({ text: data.candidates[0].content.parts.map(p => p.text || "").join("") });
  }
};
