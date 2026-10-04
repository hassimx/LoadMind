# LoadMind

A workload assistant for students. It turns tasks into a realistic daily plan and tells you when a day is too much.

**Live demo:** https://loadmind.alena-anilove1970.workers.dev

![LoadMind dashboard](screenshots/dashboard.png)

## What it does
- One-line task input in English and Russian: "SAT 4 hours 13:00-17:00" becomes a task with a start time, "by Friday 18:00" becomes a deadline.
- A daily plan: hard tasks at your peak focus time, breaks after long sessions.
- Overload Index (0-100) from open tasks, daily capacity and a short note about your day.
- Coach: short advice from Gemini. The AI only advises, the schedule is built by plain rules.
- Export to Google Calendar (.ics file or a link per task).

| Smart input | Schedule | Russian UI |
|---|---|---|
| ![](screenshots/smart-input.png) | ![](screenshots/schedule.png) | ![](screenshots/russian.png) |

## How it works
Task parsing is rule-based first and calls Gemini only when a phrase has no time or duration. Gemini is called through a Cloudflare Worker (`worker.js`), so the API key stays on the server.

Files: `index.html` (markup), `script.js` (parser, plan, overload index, calendar export), `ui.js` (language, quote of the day, cursor, background), `style.css`, `worker.js` (AI proxy).

## Run locally
Open `index.html`. To enable AI: deploy `worker.js` on Cloudflare Workers, add the secret `GEMINI_KEY` (optionally `GEMINI_MODEL`, `ALLOWED_ORIGIN`), and put the Worker URL into `AI_PROXY` in `script.js`.

## Research behind it
- Peak focus time: [May, Hasher & Healey (2023)](https://journals.sagepub.com/doi/10.1177/17456916231178553)
- Chronotype and grades are only loosely linked, so the user picks the peak: [Preckel et al. (2011)](https://eric.ed.gov/?id=EJ938525)
- 15-minute breaks: [Albulescu et al. (2022)](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9432722/)

## Limits
Data is stored in the browser only. The free AI quota is small. Note analysis falls back to keyword matching when AI is unavailable.

## Next
Accounts and a database, a custom NLP model trained on real notes, two-way calendar sync, Telegram reminders, Kazakh.

<!-- Add one honest line here about the AI tools you used, if the hackathon rules ask for it. -->
Built solo by hassimx.
