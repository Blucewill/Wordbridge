import { callAgent, listen, traceHTML, escapeHTML, announce, mountStatus } from "./common.js";

const BOARD = {
  Core: [["🙋", "I"], ["👉", "you"], ["🙏", "want"], ["❗", "need"], ["🚫", "not"], ["➕", "more"], ["✋", "stop"], ["👍", "yes"], ["👎", "no"], ["🆘", "help"], ["❓", "where"], ["⏰", "when"]],
  Needs: [["💧", "water"], ["🍵", "tea"], ["🍽️", "food"], ["🚻", "toilet"], ["🛏️", "bed"], ["💊", "medicine"], ["🥶", "cold"], ["🥵", "hot"], ["👓", "glasses"], ["📱", "phone"], ["📺", "TV"], ["🔇", "quiet"]],
  Feelings: [["😊", "happy"], ["😢", "sad"], ["😠", "angry"], ["😨", "scared"], ["😴", "tired"], ["😣", "frustrated"], ["🤢", "sick"], ["😌", "better"], ["😕", "confused"], ["❤️", "love"], ["🙂", "okay"], ["😖", "bored"]],
  Body: [["🤕", "pain"], ["🧠", "head"], ["🫀", "chest"], ["🦷", "teeth"], ["🫁", "breathe"], ["🦵", "leg"], ["💪", "arm"], ["🫃", "stomach"], ["👁️", "eyes"], ["👂", "ears"], ["🩸", "bleeding"], ["🌡️", "fever"]],
  People: [["👩", "wife"], ["👨", "husband"], ["👧", "daughter"], ["👦", "son"], ["👵", "mum"], ["👴", "dad"], ["🧑‍⚕️", "nurse"], ["👩‍⚕️", "doctor"], ["🧑‍🤝‍🧑", "friend"], ["🐶", "dog"], ["🐱", "cat"], ["🏠", "home"]],
  Actions: [["🚶", "go"], ["🪑", "sit"], ["🛌", "lie down"], ["🚿", "wash"], ["👕", "dress"], ["📞", "call"], ["🍳", "cook"], ["🛒", "buy"], ["🗣️", "talk"], ["👀", "see"], ["🎵", "music"], ["🚗", "drive"]],
  Time: [["🌅", "morning"], ["🌙", "night"], ["⏳", "later"], ["⚡", "now"], ["📅", "tomorrow"], ["↩️", "yesterday"], ["🔁", "again"], ["⏱️", "wait"]],
};
const DEFAULT_PHRASES = ["Yes.", "No.", "Please wait, I'm thinking.", "Thank you.", "I have aphasia. I understand you, but speaking is hard."];

const $ = (s) => document.querySelector(s);
const composer = $("#composer");

function load(k, d) {
  try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; }
}
function save(k, v) {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ }
}

const state = {
  place: "home",
  who: "family",
  tab: "Core",
  history: load("wb-history", []),
  phrases: load("wb-phrases", DEFAULT_PHRASES),
  big: load("wb-big", false),
  profile: load("wb-profile", { name: "", people: "", about: "", likes: "", voice: "", rate: 1 }),
  sentences: [],
};

// ---------- speech (uses the voice + speed chosen in "About me") ----------
function speak(text, { rate } = {}) {
  if (!("speechSynthesis" in window) || !text) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = rate ?? (Number(state.profile.rate) || 1);
  const v = speechSynthesis.getVoices().find((x) => x.voiceURI === state.profile.voice);
  if (v) u.voice = v;
  speechSynthesis.speak(u);
}
function remember(sentence) {
  // Feedback loop: sentences you actually say are sent back to SERV to rank future suggestions.
  state.history = [...state.history.filter((h) => h !== sentence), sentence].slice(-20);
  save("wb-history", state.history);
  renderRecent();
}
function sayAndRemember(text) {
  speak(text);
  remember(text);
}

// ---------- profile ----------
const peopleNames = () =>
  state.profile.people
    .split(",")
    .map((p) => p.replace(/\(.*?\)/g, "").trim())
    .filter(Boolean)
    .slice(0, 8);

function profileForAI() {
  const p = state.profile;
  const out = {};
  if (p.name) out.name = p.name;
  if (p.people) out.people_in_my_life = p.people;
  if (p.about) out.about_me = p.about;
  if (p.likes) out.likes = p.likes;
  return out;
}

// ---------- tabs & tiles ----------
function tilesFor(tab) {
  if (tab !== "People") return BOARD[tab];
  return [...peopleNames().map((n) => ["⭐", n]), ...BOARD.People];
}
function renderTabs(active = state.tab) {
  state.tab = active;
  $("#tabs").innerHTML = Object.keys(BOARD)
    .map((k) => `<button class="tab" role="tab" aria-selected="${k === active}" data-tab="${k}">${k}</button>`)
    .join("");
  $("#board").innerHTML = tilesFor(active)
    .map(([e, w]) => `<button class="tile" data-word="${escapeHTML(w)}"><span class="e" aria-hidden="true">${e}</span>${escapeHTML(w)}</button>`)
    .join("");
}
$("#tabs").addEventListener("click", (e) => {
  const t = e.target.closest("[data-tab]");
  if (t) renderTabs(t.dataset.tab);
});
$("#board").addEventListener("click", (e) => {
  const t = e.target.closest("[data-word]");
  if (!t) return;
  composer.value = (composer.value.trim() + " " + t.dataset.word).trim();
  speak(t.dataset.word, { rate: 1.05 });
});
$("#backspace").addEventListener("click", () => {
  composer.value = composer.value.trim().split(/\s+/).slice(0, -1).join(" ");
  composer.focus();
});

// ---------- context chips ----------
document.querySelectorAll("[data-place],[data-who]").forEach((chip) =>
  chip.addEventListener("click", () => {
    const key = chip.dataset.place ? "place" : "who";
    document.querySelectorAll(`[data-${key}]`).forEach((c) => c.setAttribute("aria-pressed", String(c === chip)));
    state[key] = chip.dataset[key];
  })
);
const context = () => {
  const h = new Date().getHours();
  return { place: state.place, talking_to: state.who, time_of_day: h < 12 ? "morning" : h < 18 ? "afternoon" : "evening" };
};

function friendlyError(err) {
  if (!navigator.onLine || err instanceof TypeError) return "No internet right now. Your phrasebook, recent phrases and the help button still work.";
  return err.message;
}

// ---------- compose ----------
$("#compose-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  await compose(composer.value);
});

async function compose(fragments) {
  if (!fragments.trim()) { composer.focus(); return; }
  const btn = $("#go");
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner" aria-hidden="true"></span>';
  $("#results").innerHTML = '<p class="empty">Thinking about what you mean…</p>';
  try {
    const data = await callAgent("compose", { fragments, context: context(), profile: profileForAI(), history: state.history });
    renderSentences(data, fragments);
  } catch (err) {
    $("#results").innerHTML = `<p class="error">${escapeHTML(friendlyError(err))}</p>`;
  } finally {
    btn.disabled = false;
    btn.innerHTML = "Make<br />sentences";
  }
}

function renderSentences(data, fragments) {
  const r = data.result;
  state.sentences = (r.sentences || []).map((s) => s.text);
  const list = (r.sentences || [])
    .map(
      (s, i) => `<div class="sentence ${s.tone === "urgent" ? "urgent" : ""}">
        <button class="say" data-say="${escapeHTML(s.text)}"><span class="tone">${i + 1} · ${escapeHTML(s.tone || "")}</span>${escapeHTML(s.text)}</button>
        <button class="star" data-star="${escapeHTML(s.text)}" aria-label="Save to phrasebook: ${escapeHTML(s.text)}">${state.phrases.includes(s.text) ? "★" : "☆"}</button>
      </div>`
    )
    .join("");
  const clarify = r.clarify
    ? `<div class="clarify"><span>❔ ${escapeHTML(r.clarify)}</span>
         <button class="btn btn-primary" data-clarify="yes">Yes</button>
         <button class="btn btn-ghost" data-clarify="no">No</button></div>`
    : "";
  const why = r.reasoning?.length ? `<ul class="reasoning" aria-label="How this was read">${r.reasoning.map((x) => `<li>${escapeHTML(x)}</li>`).join("")}</ul>` : "";
  $("#results").innerHTML = `<div class="sentences">${list}</div>${clarify ? `<div style="margin-top:12px">${clarify}</div>` : ""}${why}${traceHTML(data)}`;
  $("#results").dataset.fragments = fragments;
  $("#results").dataset.clarify = r.clarify || "";
  announce(`${state.sentences.length} sentences ready. First: ${state.sentences[0] || ""}`);
  $("#results .say")?.focus();
}

$("#results").addEventListener("click", (e) => {
  const say = e.target.closest("[data-say]");
  if (say) return sayAndRemember(say.dataset.say);
  const star = e.target.closest("[data-star]");
  if (star) {
    addPhrase(star.dataset.star);
    star.textContent = "★";
    return;
  }
  const c = e.target.closest("[data-clarify]");
  if (c) {
    const frag = $("#results").dataset.fragments;
    compose(`${frag} (answer to "${$("#results").dataset.clarify}": ${c.dataset.clarify})`);
  }
});

// ---------- phrasebook & recent ----------
function addPhrase(p) {
  p = p.trim();
  if (!p) return;
  if (!state.phrases.includes(p)) state.phrases.unshift(p);
  save("wb-phrases", state.phrases);
  renderPhrases();
}
function renderPhrases() {
  $("#phrasebook").innerHTML = state.phrases.length
    ? state.phrases
        .map((p, i) => `<span class="phrase-wrap"><button class="phrase" data-say="${escapeHTML(p)}">🔊 ${escapeHTML(p)}</button><button class="phrase-del" data-del="${i}" aria-label="Remove phrase: ${escapeHTML(p)}">×</button></span>`)
        .join("")
    : '<p class="panel-note">No saved phrases. Tap ☆ on a sentence or add one below.</p>';
}
function renderRecent() {
  const recent = state.history.slice(-6).reverse();
  $("#recent").innerHTML = recent.length
    ? recent.map((p) => `<button class="phrase recent" data-say="${escapeHTML(p)}">↻ ${escapeHTML(p)}</button>`).join("")
    : '<p class="panel-note">Sentences you say will show up here.</p>';
}
$("#phrasebook").addEventListener("click", (e) => {
  const del = e.target.closest("[data-del]");
  if (del) {
    const removed = state.phrases.splice(Number(del.dataset.del), 1)[0];
    save("wb-phrases", state.phrases);
    renderPhrases();
    announce(`Removed ${removed}`);
    return;
  }
  const b = e.target.closest("[data-say]");
  if (b) speak(b.dataset.say);
});
$("#recent").addEventListener("click", (e) => {
  const b = e.target.closest("[data-say]");
  if (b) speak(b.dataset.say);
});
$("#add-phrase").addEventListener("submit", (e) => {
  e.preventDefault();
  addPhrase($("#new-phrase").value);
  $("#new-phrase").value = "";
});

// ---------- partner mode ----------
let stopListening = null;
$("#listen").addEventListener("click", () => {
  if (stopListening) { stopListening(); return; }
  let finalText = "";
  stopListening = listen({
    onText: ({ finalText: f, interim }) => {
      finalText += f;
      $("#heard").textContent = (finalText + " " + interim).trim() || "Listening…";
    },
    onEnd: () => {
      stopListening = null;
      $("#listen").textContent = "🎙️ Listen to partner";
      if (finalText.trim()) partnerReply(finalText.trim());
    },
  });
  if (!stopListening) {
    $("#heard").textContent = "Voice input isn't supported in this browser. Ask your partner to type below.";
    $("#partner-text").focus();
    return;
  }
  $("#listen").textContent = "⏹ Stop listening";
  $("#heard").textContent = "Listening…";
});
$("#partner-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const t = $("#partner-text").value.trim();
  if (!t) return;
  $("#heard").textContent = t;
  $("#partner-text").value = "";
  partnerReply(t);
});

async function partnerReply(heard) {
  $("#replies").innerHTML = '<p class="empty" style="grid-column:1/-1">Finding replies…</p>';
  try {
    const data = await callAgent("reply", { heard, context: context(), profile: profileForAI() });
    const r = data.result;
    if (r.summary) $("#heard").innerHTML = `<span style="font-size:1.2rem">${escapeHTML(r.summary)}</span><br><small style="color:var(--muted);font-weight:400">“${escapeHTML(heard)}”</small>`;
    $("#replies").innerHTML = (r.replies || []).map((x) => `<button class="reply" data-say="${escapeHTML(x)}">${escapeHTML(x)}</button>`).join("");
    $("#partner-trace").innerHTML = traceHTML(data);
    announce("Replies ready");
    $("#replies .reply")?.focus();
  } catch (err) {
    $("#replies").innerHTML = `<p class="error" style="grid-column:1/-1">${escapeHTML(friendlyError(err))}</p>`;
  }
}
$("#replies").addEventListener("click", (e) => {
  const b = e.target.closest("[data-say]");
  if (b) sayAndRemember(b.dataset.say);
});

// ---------- emergency (works offline: no network needed) ----------
$("#sos").addEventListener("click", () => {
  const name = state.profile.name ? ` My name is ${state.profile.name}.` : "";
  speak(`I need help now. Please come here.${name} I have aphasia and I can't speak easily.`, { rate: 0.95 });
});

// ---------- settings dialog ----------
const dlg = $("#settings");
const form = $("#settings-form");
function fillVoices() {
  const sel = $("#voice-select");
  const voices = ("speechSynthesis" in window ? speechSynthesis.getVoices() : []).filter((v) => v.lang?.startsWith("en"));
  sel.innerHTML = '<option value="">Device default</option>' + voices.map((v) => `<option value="${escapeHTML(v.voiceURI)}">${escapeHTML(v.name)} (${escapeHTML(v.lang)})</option>`).join("");
  sel.value = state.profile.voice || "";
}
if ("speechSynthesis" in window) speechSynthesis.onvoiceschanged = fillVoices;

$("#open-settings").addEventListener("click", () => {
  fillVoices();
  for (const k of ["name", "people", "about", "likes", "rate"]) form.elements[k].value = state.profile[k] ?? "";
  form.elements.rate.value = state.profile.rate || 1;
  dlg.showModal();
});
$("#test-voice").addEventListener("click", () => {
  const prev = { ...state.profile };
  state.profile.voice = form.elements.voice.value;
  state.profile.rate = Number(form.elements.rate.value);
  speak(form.elements.name.value ? `Hello, my name is ${form.elements.name.value}.` : "Hello, this is my voice.");
  Object.assign(state.profile, { voice: prev.voice, rate: prev.rate });
});
form.addEventListener("submit", () => {
  state.profile = {
    name: form.elements.name.value.trim(),
    people: form.elements.people.value.trim(),
    about: form.elements.about.value.trim(),
    likes: form.elements.likes.value.trim(),
    voice: form.elements.voice.value,
    rate: Number(form.elements.rate.value) || 1,
  };
  save("wb-profile", state.profile);
  renderTabs();
  announce("Saved");
});

// ---------- size ----------
function applySize() {
  document.documentElement.style.setProperty("--fs", state.big ? 1.2 : 1);
  document.documentElement.style.setProperty("--tile", state.big ? 1.35 : 1);
  $("#bigger").setAttribute("aria-pressed", String(state.big));
}
$("#bigger").addEventListener("click", () => {
  state.big = !state.big;
  save("wb-big", state.big);
  applySize();
});

// ---------- keyboard shortcuts ----------
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && "speechSynthesis" in window) speechSynthesis.cancel();
  if (e.target.matches("input, textarea, select") || e.metaKey || e.ctrlKey || e.altKey || dlg.open) return;
  const n = Number(e.key);
  if (n >= 1 && n <= 4 && state.sentences[n - 1]) sayAndRemember(state.sentences[n - 1]);
});

// ---------- offline + install (PWA) ----------
function updateOnline() { $("#offline").hidden = navigator.onLine; }
addEventListener("online", updateOnline);
addEventListener("offline", updateOnline);
if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
let installPrompt = null;
addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  installPrompt = e;
  $("#install").hidden = false;
});
$("#install").addEventListener("click", async () => {
  if (!installPrompt) return;
  installPrompt.prompt();
  await installPrompt.userChoice;
  installPrompt = null;
  $("#install").hidden = true;
});

renderTabs();
renderPhrases();
renderRecent();
applySize();
updateOnline();
mountStatus();
if (new URLSearchParams(location.search).has("sample")) { composer.value = "water cold"; compose("water cold"); }
