# LoadMind

Personal workload assistant. No build step: open `index.html` in a browser.

- **Dashboard** - stats, note analysis (EN + RU), plan, overload index
- **My Tasks** - add / complete / delete tasks (workload and plan are computed from them)
- **Schedule / Workload** - focused views of the plan and the overload index
- **Settings** - name, day start, daily capacity, reset

Data lives in `localStorage`.

## v2 additions
- **Deadlines** on tasks (date + time), overdue / due-soon highlighting, urgency raises the workload index
- **Smart input (NLP)** - "SAT Math 1h tomorrow 18:00" or "сдать отчёт в пятницу в 18:00, 2 часа" becomes a task (duration, day, time, type), EN + RU
- **Peak focus time** (Settings) - hard tasks start at the chosen window, light tasks fill the time before it
- **Google Calendar** - "+ Cal" link per task and `.ics` export of the plan + deadlines (no OAuth needed for the prototype)
- Next: real Google Calendar API sync, Telegram bot reminders, peak time learned from completion history

## AI (v2.1)
Settings -> pick Gemini or Claude, paste your own API key. Then: smart input is parsed by the model (rules are the fallback) and "Ask AI coach" gives advice from your tasks, deadlines, peak time and notes.
The key is kept in localStorage and sent only to the provider. Prototype only: for a real release move the call behind a backend so the key is never in the browser.

## AI without user keys
Deploy `worker.js` on Cloudflare Workers, add the secret GEMINI_KEY, then set `AI_PROXY` at the top of the AI section in `script.js` to the Worker URL.
