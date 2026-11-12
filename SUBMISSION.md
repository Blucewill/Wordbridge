# WordBridge: submission kit

## Submission form answers

**Project name:** WordBridge

**Track:** Open Track (SERV Reasoning)

**One-liner:** Your words, finished. Fragments in, full spoken sentences out, for people living with aphasia.

**What it does:**
WordBridge works from **fragments**, the way aphasia actually works. Tap a few picture tiles or type broken words ("water cold"), and SERV Reasoning works out what you most likely mean from the place, the person you're talking to, the time of day and your past choices. It offers 4 complete first-person sentences. Tap one and it's spoken aloud. **Partner mode** listens to the other person and offers 5 one-tap replies. An offline **SOS** button speaks an emergency phrase instantly.

**Target audience:**
Adults with **expressive aphasia** after a stroke or brain injury (about 2M+ people in the US alone, per the National Aphasia Association). It also serves people with ALS/MND, laryngectomy patients, non-speaking autistic adults, and the speech-language therapists and carers who support them.

**How it uses SERV Reasoning:**
- `POST /api/compose`: fragments + context + recent choices go to SERV Reasoning (`reasoning_effort: low` for speed), which returns ranked sentences, a tone for each, an optional clarifying question and short reasoning notes.
- `POST /api/reply`: what the partner said goes to SERV Reasoning, which returns a simple summary of the question plus 5 reply options.
- Why reasoning: the same fragments mean different things in different contexts ("water cold" at home vs. in hospital). SERV's structured reasoning step lets a small, fast, cheap model (`gpt-5.4-mini`) rank interpretations accurately enough for real-time conversation.

**What was built during the hackathon:** Everything. The landing page, the app, the SERV agents and the zero-dependency server were all built for SERV Hackathon 02 (Nov 2026).

**Public repo:** https://github.com/<your-username>/wordbridge
**Live demo:** https://wordbridge.onrender.com (after deploying with render.yaml), demo route `/app?sample=1`
**Demo video:** <paste YouTube/Loom link>
**X post:** <paste link>

## X post (copy, then add links)

```
Meet WordBridge 🧠🗣️

People with aphasia know exactly what they mean, but the words won't come out.

Tap a few words ("water… cold") and WordBridge offers full sentences, then speaks the one you pick.

Built on @openservai SERV Reasoning for #SERVHackathon

[demo link] [repo link]
```

## 90-second demo video script

- 0:00 Problem: "After a stroke, my uncle understands everything but can't find his words." Show the landing hero.
- 0:15 Open the app. Tap the 💧 water and 🥶 cold tiles. Press **Make sentences**.
- 0:30 Four sentences appear. Tap "Could I have a glass of cold water, please?" and it's spoken aloud. Point out the reasoning note and the SERV trace line.
- 0:50 Type "head pain" with context Hospital/Nurse. The urgent sentence is ranked first.
- 1:10 Partner mode: type "Do you want tea or coffee?" and get one-tap replies.
- 1:20 Open ⚙ Me, add "Ada (wife)", type "ada call": "Can you call Ada for me, please?"
- 1:35 Show SOS, the phrasebook, offline mode and Install. Close on how SERV Reasoning makes a small model accurate enough for real-time AAC.

**Recording tips:** record with `SERV_API_KEY` set so the trace line shows "SERV Reasoning · model · tokens". Use Chrome (best Web Speech support). Turn system audio on so judges hear the read-aloud.
