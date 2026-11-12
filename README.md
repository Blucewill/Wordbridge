# WordBridge

> Your words, finished. Fragments in, full spoken sentences out, for people living with aphasia.

**SERV Hackathon 02 · Open Track** · Built on [SERV Reasoning](https://docs.openserv.ai/serv-reasoning/introduction)

## Who it's for

Adults with **expressive aphasia** after a stroke or brain injury (about 2M+ people in the US alone, per the National Aphasia Association). It also serves people with ALS/MND, laryngectomy patients, non-speaking autistic adults, and the speech-language therapists and carers who support them.

## The problem

People with aphasia usually understand everything but can't produce the words. Existing AAC (augmentative and alternative communication) apps make them build every sentence word by word from symbol grids, which is slow, tiring and often abandoned. Dedicated speech devices can cost thousands of dollars. The result is that people nod along, get left out of conversations, and can't say what they need, even in hospital.

## What WordBridge does

WordBridge works from **fragments**, the way aphasia actually works. Tap a few picture tiles or type broken words ("water cold"), and SERV Reasoning works out what you most likely mean from the place, the person you're talking to, the time of day and your past choices. It offers 4 complete first-person sentences. Tap one and it's spoken aloud. **Partner mode** listens to the other person and offers 5 one-tap replies. An offline **SOS** button speaks an emergency phrase instantly.

### Features

- Picture tile board (Core, Needs, Feelings, Body, People, Actions, Time) plus free typing; misspellings are fine
- Context chips (Home, Hospital, Shop, Phone; Family, Nurse, Carer, Stranger) that change how fragments are read
- 4 ranked sentence candidates with tone tags; urgent and pain-related meanings are always ranked first
- Yes/no clarifying question when fragments are truly ambiguous
- Partner mode: speech-to-text of the partner's question, then 5 one-tap replies
- Personal feedback loop: the sentences you actually choose are fed back in to rank future suggestions
- Phrasebook, emergency button (works with no network), large-text and large-tile mode
- A short 'how I read this' note on every answer, so carers can check it
- **About me** profile (name, people, interests): names become People tiles, and SERV uses them ("Can you call Ada?")
- Voice picker and speaking speed; the emergency phrase includes your name
- **Installable app (PWA)** that works offline: tiles, phrasebook, recent phrases and SOS run with no internet
- Editable phrasebook (add or remove), "Recently said" one-tap repeat, keyboard shortcuts (1–4 to speak, Esc to stop)

## How it uses SERV Reasoning

Every AI call in WordBridge goes through SERV Reasoning's OpenAI-compatible endpoint, `POST https://inference-api.openserv.ai/v1/chat/completions`. See [`lib/serv.js`](lib/serv.js) and [`agents.js`](agents.js).

- `POST /api/compose`: fragments + context + recent choices go to SERV Reasoning (`reasoning_effort: low` for speed), which returns ranked sentences, a tone for each, an optional clarifying question and short reasoning notes.
- `POST /api/reply`: what the partner said goes to SERV Reasoning, which returns a simple summary of the question plus 5 reply options.
- Why reasoning: the same fragments mean different things in different contexts ("water cold" at home vs. in hospital). SERV's structured reasoning step lets a small, fast, cheap model (`gpt-5.4-mini`) rank interpretations accurately enough for real-time conversation.

**Auditable by design:** every answer in the UI shows a trace line with the SERV model, token usage, latency and completion ID, so users and carers can see what produced each result. The prompts ask for structured JSON, and the app renders it as UI rather than raw chat text.

## Run it locally

Requires **Node 18+**. There are **no dependencies to install**.

```bash
cp .env.example .env      # add your SERV_API_KEY from https://console.openserv.ai
npm start                 # → http://localhost:3000
```

No key yet? It still runs. Without `SERV_API_KEY` the server returns clearly-labelled **demo-mode** sample answers so the whole UI can be explored. Try `http://localhost:3000/app?sample=1`.

| Env var | Purpose |
|---|---|
| `SERV_API_KEY` | Your SERV key (required for live mode) |
| `SERV_MODEL` | Any model from the [SERV catalog](https://docs.openserv.ai/serv-reasoning/models). Default `gpt-5.4-mini` |
| `PORT` | Default 3000 |

## Deploy

- **Render:** New → Blueprint → point at this repo (uses [`render.yaml`](render.yaml)), then set `SERV_API_KEY`.
- **Railway / Fly / any Node host:** start command `node server.js`, set `SERV_API_KEY`.

## Architecture

```
public/            static site: landing page (index.html) + app (app.html, app.js)
  sw.js            service worker: offline app shell (AI calls are never cached)
  manifest.webmanifest + icon-*.png   installable PWA
  common.js        shared browser helpers: API calls, speech in/out, SERV trace badge
server.js          zero-dependency Node HTTP server: static files + POST /api/<agent>
agents.js          the WordBridge agents: system prompts, input → SERV → JSON, demo fallbacks
lib/serv.js        minimal SERV Reasoning client (fetch, reasoning_effort, JSON extraction)
```

Browser-native speech (Web Speech API) handles voice input and output. User data (history, settings, records) stays in the browser's localStorage. Nothing is stored on the server.

## Business model

Free personal tier. **Family plan $6/mo** (learning profile, partner mode, sync). **Clinic plan $29/seat/mo** for speech-language pathology clinics and stroke units (client profiles, progress and reasoning logs). Buyers include insurers and health systems looking for alternatives to expensive dedicated speech devices.

## Roadmap

- Personal voice banking (speak in your own pre-recorded voice)
- Caregiver dashboard with communication-success metrics
- Offline on-device model for core phrases
- Multilingual boards

## Accessibility

Semantic HTML, visible focus rings, skip links, ARIA live regions for every AI result, large touch targets (≥48px), `prefers-reduced-motion` support, and the Atkinson Hyperlegible font (designed for low-vision readers) for body text.

## License

MIT
