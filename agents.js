// WordBridge agents — every call runs through SERV Reasoning.
export const APP_NAME = "WordBridge";

// Models occasionally rename JSON keys; normalise so the UI never shows an empty result.
const asList = (v) => (Array.isArray(v) ? v : v ? [v] : []);
function guessTone(t) {
  const s = String(t).toLowerCase();
  if (/\b(help|pain|hurt|emergency|ambulance|can't breathe)\b/.test(s)) return "urgent";
  if (/\?\s*$/.test(s)) return /^(can|could|would|will) (you|i)\b/.test(s) ? "request" : "question";
  if (/\b(please|can i|could i|i want|i need)\b/.test(s)) return "request";
  if (/\b(i feel|i'm (sad|happy|tired|scared)|i miss|i love)\b/.test(s)) return "feeling";
  return "statement";
}

const SAFETY =`If the fragments suggest pain, danger, a medical emergency or abuse, the FIRST sentence must clearly communicate that (e.g. "I need help now. My chest hurts.").`;

export const agents = {
  // Turn tapped/typed fragments into complete first-person sentences the user can speak.
  compose: {
    effort: "low",
    maxTokens: 900,
    validate: (i) => (!i.fragments || !String(i.fragments).trim() ? "Tap or type at least one word." : null),
    system: `You are the sentence engine inside WordBridge, an AAC (augmentative and alternative communication) app used by people with aphasia after stroke or brain injury, and by other people who cannot easily speak.
The user gives you broken fragments: single words, tapped symbols, misspellings, or words in the wrong order. Your job is to guess what they MEAN and offer complete sentences they can speak aloud, in their own first-person voice.

Rules:
- Never correct, lecture, or talk about the user. You are their voice, not their therapist.
- Offer exactly 4 candidate sentences, most likely first. Each 3–16 words, natural spoken English, first person.
- Vary the candidates meaningfully (different interpretations), not just rephrasings.
- Use the context (place, conversation partner, time of day) and the user's profile/past choices to rank interpretations.
- If the profile lists people (e.g. "Ada (wife)"), use their names naturally ("Can you call Ada?" rather than "Can you call my wife?") when the fragments refer to them. Use likes and "about me" only when relevant. Never invent facts about the user.
- Recently chosen sentences show how this person likes to phrase things. Match that style.
- ${SAFETY}
- If the fragments are truly ambiguous, also return one short yes/no clarifying question the app can show.
- "reasoning" is 1–3 very short notes on how you read the fragments (shown to caregivers for transparency).

Reply ONLY with JSON using EXACTLY these keys (the app reads them by name; do not rename them):
{"sentences":[{"text":"...","tone":"request|statement|question|feeling|urgent"}],"clarify":"... or null","reasoning":["..."]}`,
    post: (r) => ({
      sentences: asList(r.sentences ?? r.candidates ?? r.options ?? r.suggestions)
        .map((s) => (typeof s === "string" ? { text: s } : { text: s.text ?? s.sentence ?? s.candidate ?? "", tone: s.tone }))
        .filter((s) => s.text)
        .map((s) => ({ text: String(s.text).trim(), tone: s.tone || guessTone(s.text) }))
        .slice(0, 4),
      clarify: r.clarify ?? r.clarification_question ?? r.clarifying_question ?? r.question ?? null,
      reasoning: asList(r.reasoning ?? r.notes ?? r.why).map(String).slice(0, 3),
    }),
    user: (i) =>
      JSON.stringify({
        fragments: i.fragments,
        context: i.context || {},
        profile: i.profile || {},
        recently_chosen_sentences: (i.history || []).slice(-8),
      }),
    demo: (i) => {
      const f = String(i.fragments).toLowerCase();
      const people = String(i.profile?.people_in_my_life || "");
      const named = people.split(",").map((p) => p.replace(/\(.*?\)/g, "").trim()).filter(Boolean);
      const who = named.find((n) => f.includes(n.toLowerCase()));
      if (who || /call|phone|wife|husband|son|daughter/.test(f)) {
        const n = who || named[0] || "my family";
        return {
          sentences: [
            { text: `Can you call ${n} for me, please?`, tone: "request" },
            { text: `I want to see ${n}.`, tone: "statement" },
            { text: `When is ${n} coming?`, tone: "question" },
            { text: `I miss ${n}.`, tone: "feeling" },
          ],
          clarify: null,
          reasoning: [`'${who || "call"}' → most likely wants contact with ${n}`, "Used the name from your profile"],
        };
      }
      if (/pain|hurt|chest|head/.test(f))
        return {
          sentences: [
            { text: "I need help now. I have pain in my chest.", tone: "urgent" },
            { text: "My head hurts. Can I have some medicine?", tone: "request" },
            { text: "Something hurts. Please call the nurse.", tone: "urgent" },
            { text: "I'm in pain, but it's not an emergency.", tone: "feeling" },
          ],
          clarify: "Is it an emergency?",
          reasoning: ["'pain' + body word → prioritised urgent help first", "Offered a non-emergency option too"],
        };
      return {
        sentences: [
          { text: "Could I have a glass of cold water, please?", tone: "request" },
          { text: "I'm thirsty. Is there water in the kitchen?", tone: "question" },
          { text: "Please put the water in the fridge.", tone: "request" },
          { text: "The water is too cold for me.", tone: "statement" },
        ],
        clarify: null,
        reasoning: ["'water' + 'cold' at home → most likely asking for a drink", "Kitchen context suggests location of item"],
      };
    },
  },

  // A conversation partner speaks; offer the user one-tap replies.
  reply: {
    effort: "low",
    maxTokens: 600,
    validate: (i) => (!i.heard || !String(i.heard).trim() ? "Nothing was heard yet." : null),
    system: `You help a person who cannot easily speak reply to someone talking to them. You get what the conversation partner just said.
Offer 5 short reply options (1–10 words each), written in the user's first-person voice, covering the realistic range of answers (yes / no / a specific choice / "I don't know" / "Please say it again slowly" when useful).
If the partner asked an either/or question, include each option. Keep them warm and natural.
Reply ONLY with JSON using EXACTLY these keys: {"replies":["..."],"summary":"<the partner's question in 8 words or fewer, in simple words>"}`,
    post: (r) => ({
      replies: asList(r.replies ?? r.options ?? r.candidates ?? r.responses)
        .map((x) => (typeof x === "string" ? x : x.text ?? x.reply ?? ""))
        .filter(Boolean)
        .slice(0, 5),
      summary: r.summary ?? r.question ?? r.partner_question ?? "",
    }),
    user: (i) => JSON.stringify({ partner_said: i.heard, context: i.context || {}, profile: i.profile || {} }),
    demo: () => ({
      summary: "Tea or coffee?",
      replies: ["Tea, please.", "Coffee, please.", "Neither. Just water.", "Not right now, thank you.", "Please say that again slowly."],
    }),
  },
};
