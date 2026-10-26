/* Банк питань збирається з файлів js/questions/*.js (див. js/config.js) */
const QUESTIONS = window.BL.questions;

const DEPTS = {
  mkt:  { code: "МЦТ", name: "Маркетинг та цифрові технології", color: "var(--d-mkt)",
          desc: "Ідеї, бренди, комунікації, цифрові інструменти та інновації.",
          icon: '<path d="M3 10v4h3l5 4V6L6 10H3z"/><path d="M15 9a4 4 0 0 1 0 6"/><path d="M18 6.5a8 8 0 0 1 0 11"/>' },
  mgt:  { code: "МА",  name: "Менеджмент та адміністрування", color: "var(--d-mgt)",
          desc: "Люди, процеси, ефективні рішення, лідерство.",
          icon: '<circle cx="9" cy="8" r="3.2"/><path d="M3 19c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5"/><circle cx="17" cy="9" r="2.4"/><path d="M15.5 13.8c.5-.2 1-.3 1.5-.3 2.5 0 4.5 1.8 4.5 4.5"/>' },
  acc:  { code: "ОФ",  name: "Облік та фінанси", color: "var(--d-acc)",
          desc: "Фінанси, облік, аудит, економічна аналітика, стабільне майбутнє.",
          icon: '<rect x="5" y="2.5" width="14" height="19" rx="2.5"/><rect x="8" y="5.5" width="8" height="4" rx="1"/><path d="M8.5 13h.01M12 13h.01M15.5 13h.01M8.5 16.5h.01M12 16.5h.01M15.5 16.5h.01"/>' },
  bus:  { code: "БУ",  name: "Бізнес та управління", color: "var(--d-bus)",
          desc: "Стратегія, розвиток, підприємництво, успішні проєкти.",
          icon: '<rect x="3" y="7" width="18" height="13" rx="2.5"/><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7"/><path d="M7 16l3-3 2.5 2L17 11"/><path d="M14.5 11H17v2.5"/>' },
  econ: { code: "ЕМС", name: "Економіка та митна справа", color: "var(--d-econ)", on: "#1a1203", text: "var(--econ-text)",
          desc: "Економічні процеси, міжнародна торгівля, митна діяльність.",
          icon: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c2.6 2.5 3.8 5.5 3.8 9s-1.2 6.5-3.8 9c-2.6-2.5-3.8-5.5-3.8-9S9.4 5.5 12 3z"/>' }
};
const ORDER = ["mkt", "mgt", "acc", "bus", "econ"];
const CARDS = 10;
function paint(n, k) { const d = DEPTS[k]; n.style.setProperty("--c", d.color); if (d.on) n.style.setProperty("--on", d.on); if (d.text) n.style.setProperty("--c-text", d.text); }
const LETTERS = ["A", "B", "C"];
const LS_KEY = "businessLab.results.v1";

const $ = (id) => document.getElementById(id);
const pad = (n) => String(n).padStart(2, "0");
const fmt = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)); return pad(Math.floor(s / 60)) + ":" + pad(s % 60); };
const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const plural = (n, one, few, many) => { const a = n % 10, b = n % 100; return a === 1 && b !== 11 ? one : a >= 2 && a <= 4 && (b < 10 || b >= 20) ? few : many; };
function el(tag, cls, text) { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
function toast(msg) { const t = $("toast"); t.textContent = msg; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => (t.hidden = true), Math.max(3500, msg.length * 55)); }
function sparkPath() {
  let y = 20 + Math.random() * 10, d = "M0 " + y.toFixed(1);
  for (let x = 10; x <= 100; x += 10) { y = Math.min(28, Math.max(2, y + (Math.random() - 0.55) * 12)); d += " L" + x + " " + y.toFixed(1); }
  return d;
}

/* ---------- стан ---------- */
let state = { screen: "start", player: "", cards: [], startedAt: 0, finishedAt: 0, resultId: null };
let openIdx = -1, selected = null, timerId = null;

/* ---------- старт: біжучий рядок кафедр ---------- */
function renderTicker() {
  // кафедри йдуть двічі в кожній групі, щоб рядок був безперервним навіть на широкому екрані
  const group = () => {
    const g = el("span", "ticker-group");
    [...ORDER, ...ORDER].forEach((k) => {
      const d = DEPTS[k];
      const it = el("span", "ticker-item");
      paint(it, k);
      it.append(el("span", "code", d.code), d.name);
      g.append(it);
    });
    return g;
  };
  const tr = $("tickerTrack");
  tr.textContent = "";
  const second = group(); second.setAttribute("aria-hidden", "true");
  tr.append(group(), second);
}

/* ---------- тема: світла / темна ---------- */
const THEME_KEY = "businessLab.theme";
const ICONS = {
  moon: "M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z",
  sun: "M12 7a5 5 0 1 0 0 10a5 5 0 1 0 0-10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"
};
function applyTheme(t) {
  document.documentElement.setAttribute("data-bl-theme", t);
  const dark = t === "dark";
  $("themeIcon").setAttribute("d", dark ? ICONS.sun : ICONS.moon);
  $("themeLabel").textContent = dark ? "Світла" : "Темна";
  $("themeBtn").setAttribute("aria-label", dark ? "Увімкнути світлу тему" : "Увімкнути темну тему");
}
function initTheme() {
  let t = "light";
  try { t = localStorage.getItem(THEME_KEY) || "light"; } catch (e) {}
  applyTheme(t);
  $("themeBtn").addEventListener("click", () => {
    const next = document.documentElement.getAttribute("data-bl-theme") === "dark" ? "light" : "dark";
    const root = document.documentElement;
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduce) { root.classList.add("theme-anim"); clearTimeout(initTheme.t); initTheme.t = setTimeout(() => root.classList.remove("theme-anim"), 500); }
    applyTheme(next);
    try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
  });
}
function renderDepts() {
  $("statQ").textContent = QUESTIONS.length;
  // 6 плиток кафедр на головній: іконка, код, назва, опис і кількість питань
  const box = $("deptTiles");
  if (!box) return; // у варіанті з картинкою плиток немає
  box.textContent = "";
  ORDER.forEach((k, i) => {
    const d = DEPTS[k];
    const count = QUESTIONS.filter((q) => q.dept === k).length;
    const t = el("article", "dept-tile");
    paint(t, k);
    t.style.animationDelay = i * 70 + "ms";
    t.innerHTML =
      '<svg class="tile-bg" viewBox="0 0 24 24" aria-hidden="true">' + d.icon + '</svg>' +
      '<div class="tile-top"><span class="tile-icon"><svg viewBox="0 0 24 24" aria-hidden="true">' + d.icon + '</svg></span>' +
      '<span class="tile-code">' + d.code + '</span></div>';
    t.append(el("h3", "tile-name", d.name), el("p", "tile-desc", d.desc),
             el("span", "tile-count", count + " " + plural(count, "питання", "питання", "питань")));
    box.append(t);
  });
}

/* ---------- екрани ---------- */
function show(screen) {
  state.screen = screen;
  if (screen !== "result") document.querySelector("main").classList.remove("rating-only");
  ["start", "board", "result"].forEach((s) => $("screen" + s[0].toUpperCase() + s.slice(1)).classList.toggle("active", s === screen));
  $("homeBtn").hidden = screen === "start";
  window.scrollTo(0, 0);
}

/* ---------- гра ---------- */
function pickCards() {
  // по одному питанню з кожної кафедри, решта — випадково з банку
  const picked = ORDER.map((k) => shuffle(QUESTIONS.filter((q) => q.dept === k))[0]);
  shuffle(QUESTIONS.filter((q) => !picked.includes(q))).slice(0, CARDS - picked.length).forEach((q) => picked.push(q));
  return shuffle(picked).map((q) => ({ qi: QUESTIONS.indexOf(q), order: shuffle([0, 1, 2]), chosen: null, answered: false, ok: false, spark: sparkPath() }));
}
const score = () => state.cards.filter((c) => c.ok).length;
const answeredCount = () => state.cards.filter((c) => c.answered).length;

function startGame(name) {
  state = { screen: "board", player: name, cards: pickCards(), startedAt: Date.now(), finishedAt: 0, resultId: null };
  $("boardPlayer").textContent = name;
  renderBoard(true);
  show("board");
  startTimer();
}

/* ---------- незавершена гра: живе лише в пам'яті сторінки ----------
   Через «На головну» гру можна продовжити; перезавантаження чи закриття вкладки її знищує. */
const inProgress = () => state.cards.length === CARDS && !state.finishedAt;
function renderResume() {
  const on = inProgress();
  $("resumeBox").hidden = !on;
  $("startForm").classList.toggle("has-resume", on);
  $("startLabel").textContent = on ? "Почати нову гру" : "Почати гру";
  if (on) {
    $("resumeName").textContent = state.player;
    $("resumeMeta").textContent = "відповіді: " + answeredCount() + " / " + CARDS + " · час: " + fmt(Date.now() - state.startedAt);
  }
}
function resumeGame() {
  if (!inProgress()) return;
  $("boardPlayer").textContent = state.player;
  renderBoard(true);
  show("board");
  startTimer();
}
function startTimer() {
  clearInterval(timerId);
  const tick = () => { $("kpiTime").textContent = fmt((state.finishedAt || Date.now()) - state.startedAt); };
  tick();
  if (!state.finishedAt) timerId = setInterval(tick, 500);
}

function renderBoard(deal) {
  const grid = $("cards");
  grid.textContent = "";
  grid.classList.toggle("deal", !!deal);
  state.cards.forEach((c, i) => {
    const q = QUESTIONS[c.qi], d = DEPTS[q.dept];
    const b = el("button", "card" + (c.answered ? " done " + (c.ok ? "correct" : "wrong") : ""));
    b.type = "button";
    paint(b, q.dept);
    b.style.animationDelay = i * 45 + "ms";
    b.setAttribute("aria-label", "Картка " + (i + 1) + ", " + d.name + (c.answered ? (c.ok ? ", правильно" : ", неправильно") : ""));
    const top = el("div", "card-top");
    top.append(el("span", "card-ticker", d.code));
    b.append(top, el("div", "card-dept", d.name), el("div", "card-num", String(i + 1)));
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "card-spark"); svg.setAttribute("viewBox", "0 0 100 30"); svg.setAttribute("preserveAspectRatio", "none");
    const p = document.createElementNS("http://www.w3.org/2000/svg", "path"); p.setAttribute("d", c.spark); svg.append(p);
    b.append(svg);
    if (c.answered) b.append(el("div", "card-stamp", c.ok ? "✓ +1 бал" : "✗ 0 балів"));
    b.addEventListener("click", () => openCard(i));
    grid.append(b);
  });
  const track = $("track");
  track.textContent = "";
  state.cards.forEach((c) => track.append(el("i", c.answered ? (c.ok ? "ok" : "bad") : "")));
  $("kpiLeft").textContent = CARDS - answeredCount();
  $("kpiScore").textContent = score() + " / " + CARDS;
  $("finishBtn").hidden = answeredCount() < CARDS;
}

/* ---------- вікно завдання ---------- */
function openCard(i) {
  openIdx = i;
  const c = state.cards[i], q = QUESTIONS[c.qi], d = DEPTS[q.dept];
  paint($("modalCard"), q.dept);
  $("mDept").textContent = d.code + " · " + d.name;
  $("mNum").textContent = "Картка " + (i + 1) + " / " + CARDS;
  $("mQuestion").textContent = q.question;
  selected = null;
  renderOptions();
  $("modal").hidden = false;
  document.body.style.overflow = "hidden";
  setTimeout(() => (c.answered ? $("backBtn") : $("mOptions").querySelector("button"))?.focus({ preventScroll: true }), 30);
}
function renderOptions() {
  const c = state.cards[openIdx], q = QUESTIONS[c.qi];
  const box = $("mOptions");
  box.textContent = "";
  c.order.forEach((oi, pos) => {
    const b = el("button", "option");
    b.type = "button";
    b.append(el("span", "letter", LETTERS[pos]), el("span", "opt-text", q.options[oi]));
    if (c.answered) {
      b.disabled = true;
      if (oi === q.correct) { b.classList.add("is-correct"); b.append(el("span", "mark", "✓")); }
      else if (oi === c.chosen) { b.classList.add("is-wrong"); b.append(el("span", "mark", "✗")); }
      else b.classList.add("faded");
    } else {
      if (oi === selected) b.classList.add("selected");
      b.addEventListener("click", () => { selected = oi; renderOptions(); box.children[pos].focus(); });
    }
    box.append(b);
  });
  $("confirmBtn").hidden = c.answered;
  $("confirmBtn").disabled = selected === null;
  $("backBtn").hidden = !c.answered;
  $("backBtn").textContent = answeredCount() === CARDS ? "Подивитися результат →" : "До карток →";
  const fb = $("mFeedback");
  fb.hidden = !c.answered;
  if (c.answered) {
    fb.className = "feedback " + (c.ok ? "good" : "bad");
    $("mVerdict").textContent = c.ok ? "Правильно! +1 бал" : "Неправильно. 0 балів";
    $("mExpl").textContent = c.ok ? q.explanation : "Правильна відповідь: «" + q.options[q.correct] + "». " + q.explanation;
  }
}
function confirmAnswer() {
  const c = state.cards[openIdx];
  if (!c || c.answered || selected === null) return;
  c.answered = true; c.chosen = selected; c.ok = selected === QUESTIONS[c.qi].correct;
  if (answeredCount() === CARDS) { state.finishedAt = Date.now(); startTimer(); }
  renderOptions();
  renderBoard();
  $("backBtn").focus({ preventScroll: true });
  if (state.finishedAt && !state.resultId) saveResult();
}
function closeModal() {
  if ($("modal").hidden) return;
  $("modal").hidden = true;
  document.body.style.overflow = "";
  const last = openIdx;
  openIdx = -1;
  if (state.screen === "board" && answeredCount() === CARDS) finish();
  else $("cards").children[last]?.focus({ preventScroll: true });
}

/* ---------- рейтинг: спільна база, запасний варіант — цей браузер ---------- */
let db = null, results = [], localMode = true;
function readLocal() { try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]"); } catch (e) { return []; } }
function writeLocal(list) { try { localStorage.setItem(LS_KEY, JSON.stringify(list)); } catch (e) {} }
/* Одна людина = один рядок у рейтингу. Однаковим вважаємо ПІБ без різниці у великих/малих літерах,
   порядку слів, зайвих пробілах, крапках і виді апострофа: «Ярослав Колесников» = «колесников ЯРОСЛАВ».
   Якщо людина пройшла гру ще раз, у рейтингу лишається її НАЙКРАЩИЙ результат:
   більше балів, а за рівних балів — швидший час (за повної рівності — давніший). */
function personKey(name) {
  return String(name || "").toLocaleLowerCase("uk")
    .replace(/[’ʼ‘`´]/g, "'")
    .split(/[\s.,;]+/).filter(Boolean).sort().join(" ");
}
function latestPerPerson(list) {
  const byPerson = new Map();
  list.forEach((r) => {
    const k = personKey(r.name), prev = byPerson.get(k);
    if (!prev || better(r, prev) > 0) byPerson.set(k, r);
  });
  return [...byPerson.values()];
}
function better(a, b) {
  return (a.score | 0) - (b.score | 0) || (b.timeMs || 0) - (a.timeMs || 0) || (b.finishedAt || 0) - (a.finishedAt || 0);
}
const sorted = () => latestPerPerson(results).sort((a, b) => b.score - a.score || a.timeMs - b.timeMs || a.finishedAt - b.finishedAt);

async function saveResult() {
  const rec = { name: state.player, score: score(), total: CARDS, timeMs: state.finishedAt - state.startedAt, finishedAt: state.finishedAt };
  const id = "r" + state.finishedAt.toString(36) + Math.random().toString(36).slice(2, 8);
  state.resultId = id;
  if (db && !localMode) {
    try {
      await db.collection("results").doc(id).set(rec);
      if (!results.some((r) => r.id === id)) results.push({ id, ...rec });
      renderRating();
      return;
    } catch (e) {
      toast(e && e.code === "quota_exceeded" ? "Рейтинг переповнений, результат збережено лише на цьому пристрої." : "Немає права запису в загальний рейтинг, результат збережено на цьому пристрої.");
    }
  }
  // у сховищі цього браузера для кожної людини зберігаємо лише найкращий результат
  const key = personKey(rec.name), all = readLocal();
  const prev = all.find((r) => personKey(r.name) === key);
  const list = prev && better({ ...rec, finishedAt: 0 }, prev) <= 0 ? all : all.filter((r) => personKey(r.name) !== key).concat({ id, ...rec });
  writeLocal(list);
  if (localMode) results = list; else results.push({ id, ...rec, localOnly: true });
  renderRating();
}
// «моїм» вважається рядок цієї людини (там може бути її кращий попередній результат)
const isMine = (r) => !!state.resultId && personKey(r.name) === personKey(state.player);
function renderRating() {
  const list = sorted();
  const body = $("ratingBody");
  body.textContent = "";
  list.forEach((r, i) => {
    const place = i + 1, isMe = isMine(r);
    const tr = el("tr", isMe ? "me" : "");
    const td1 = el("td"); td1.append(el("span", "place" + (place <= 3 ? " p" + place : ""), String(place)));
    const td2 = el("td", "name", String(r.name || "Без імені").slice(0, 48));
    if (isMe) td2.append(el("span", "you-tag", "ти"));
    tr.append(td1, td2, el("td", "num score", (r.score | 0) + " / " + (r.total || CARDS)), el("td", "num", fmt(r.timeMs || 0)));
    body.append(tr);
  });
  $("ratingEmpty").hidden = list.length > 0;
  $("ratingCount").textContent = list.length + " " + plural(list.length, "учасник", "учасники", "учасників");
  const place = list.findIndex(isMine);
  $("resultPlace").textContent = place >= 0 ? place + 1 + " із " + list.length : "—";
}
/* Firebase (Firestore) для версії поза Claude: налаштування в js/firebase-config.js.
   API Firestore (collection/doc/set/onSnapshot) збігається з базою артефакту, тож решта коду спільна. */
const FIREBASE_SDK = "https://www.gstatic.com/firebasejs/10.12.2/";
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src; s.onload = resolve; s.onerror = reject;
    document.head.append(s);
  });
}
async function initFirebase() {
  const cfg = window.BL && BL.firebaseConfig;
  if (!cfg || !cfg.apiKey || !cfg.projectId) return null;
  try {
    if (!window.firebase) {
      await loadScript(FIREBASE_SDK + "firebase-app-compat.js");
      await loadScript(FIREBASE_SDK + "firebase-firestore-compat.js");
    }
    if (!firebase.apps.length) firebase.initializeApp(cfg);
    return firebase.firestore();
  } catch (e) {
    console.warn("Firebase недоступний, рейтинг зберігається в цьому браузері", e);
    return null;
  }
}
async function initStore() {
  const note = (t) => { $("storeNote").textContent = t; renderRating(); };
  results = readLocal();
  note("Рейтинг цього браузера.");
  try { db = await window.claude?.use?.("db"); } catch (e) { db = null; }
  if (!db) db = await initFirebase(); // версія на GitHub Pages: спільний рейтинг через Firestore
  if (!db) { note("Загальний рейтинг недоступний, показано результати цього браузера."); return; }
  localMode = false;
  results = [];
  note("Загальний рейтинг усіх учасників.");
  db.collection("results").onSnapshot((snap) => {
    const mine = results.filter((r) => r.localOnly);
    results = snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((r) => typeof r.score === "number").concat(mine);
    renderRating();
  }, () => { localMode = true; results = readLocal(); note("Загальний рейтинг недоступний, показано результати цього браузера."); });
}
/* ---------- результат ---------- */
function grade(s) {
  const p = s / CARDS;
  if (p >= 0.9) return ["Бізнес-акула", "Блискуче! Ти мислиш як досвідчений підприємець."];
  if (p >= 0.7) return ["Перспективний стартапер", "Дуже добре, ще трохи — і ти на вершині рейтингу."];
  if (p >= 0.5) return ["Молодий підприємець", "Непогано! Переглянь пояснення до помилок і спробуй ще раз."];
  if (p >= 0.3) return ["Стажер", "Є над чим попрацювати, пояснення допоможуть розібратися."];
  return ["Початок кар'єри", "Кожен бізнес починається з першого кроку. Спробуй ще раз!"];
}
function finish() {
  clearInterval(timerId);
  const s = score(), [title, text] = grade(s);
  $("resultScore").textContent = s;
  $("resultTime").textContent = fmt(state.finishedAt - state.startedAt);
  $("resultTitle").textContent = title;
  $("resultText").textContent = text;
  const bd = $("breakdown");
  bd.textContent = "";
  ORDER.forEach((k) => {
    const own = state.cards.filter((c) => QUESTIONS[c.qi].dept === k);
    if (!own.length) return;
    const row = el("div", "bd-row");
    paint(row, k);
    row.append(el("span", "bd-code", DEPTS[k].code), el("span", "", DEPTS[k].name), el("span", "mono", own.filter((c) => c.ok).length + " / " + own.length));
    bd.append(row);
  });
  $("resultPanel").hidden = false;
  $("resultGrid").classList.remove("rating-only");
  document.querySelector("main").classList.remove("rating-only");
  renderRating();
  show("result");
  // якщо раніше ця людина пройшла краще, у рейтингу лишається попередній результат — повідомляємо
  const cur = { score: s, timeMs: state.finishedAt - state.startedAt, finishedAt: state.finishedAt };
  const best = results.filter((r) => r.id !== state.resultId && personKey(r.name) === personKey(state.player))
    .sort((a, b) => better(b, a))[0];
  if (best && better(cur, best) <= 0) toast("У рейтингу залишився твій кращий результат: " + (best.score | 0) + " / " + (best.total || CARDS) + ", " + fmt(best.timeMs || 0) + ".");
}
function openRatingOnly() {
  $("resultPanel").hidden = true;
  $("resultGrid").classList.add("rating-only");
  document.querySelector("main").classList.add("rating-only");
  renderRating();
  show("result");
}

/* ---------- події ---------- */
$("startForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const name = $("playerName").value.replace(/\s+/g, " ").trim();
  const ok = name.length >= 3 && name.split(" ").length >= 2;
  $("nameErr").hidden = ok;
  if (!ok) { $("playerName").focus(); return; }
  startGame(name);
});
$("openRatingBtn").addEventListener("click", openRatingOnly);
function goHome() { clearInterval(timerId); show("start"); renderResume(); }
$("homeBtn").addEventListener("click", goHome);
// логотип у шапці теж веде на головну (без перезавантаження, незавершена гра зберігається)
$("brandLink").addEventListener("click", (e) => {
  if (e.ctrlKey || e.metaKey || e.shiftKey || e.button === 1) return; // відкриття в новій вкладці працює як звичайне посилання
  e.preventDefault();
  if ($("modal") && !$("modal").hidden) closeModal();
  goHome();
});
$("resumeBtn").addEventListener("click", resumeGame);
$("playAgainBtn").addEventListener("click", () => startGame(state.player));
$("finishBtn").addEventListener("click", finish);
$("confirmBtn").addEventListener("click", confirmAnswer);
$("backBtn").addEventListener("click", closeModal);
document.querySelectorAll("[data-close]").forEach((n) => n.addEventListener("click", closeModal));
document.addEventListener("keydown", (e) => {
  if ($("modal").hidden) return;
  const c = state.cards[openIdx];
  const map = { "1": 0, "2": 1, "3": 2, a: 0, b: 1, c: 2 };
  const key = e.key.toLowerCase();
  if (e.key === "Escape") closeModal();
  else if (c && !c.answered && key in map) { selected = c.order[map[key]]; renderOptions(); }
});

/* ---------- запуск (гра переживає оновлення сторінки) ---------- */
function boot(saved) {
  initTheme();
  renderTicker();
  renderDepts();
  initStore();
  const s = saved && saved.state;
  if (s && s.screen === "board" && s.cards && s.cards.length === CARDS) {
    state = s;
    $("boardPlayer").textContent = state.player;
    renderBoard(); show("board"); startTimer();
  }
  try { localStorage.removeItem("businessLab.progress.v1"); } catch (e) {} // прибрати прогрес зі старої версії
  renderResume();
}
window.claude?.hot?.snapshot?.(() => ({ state }));
window.claude?.hot?.ready ? window.claude.hot.ready(boot) : boot(window.claude?.hot?.data ?? {});

/* ---------- заставка ---------- */
// Перша сторінка сайту. На головну (реєстрацію) веде лише кнопка «Перейти до гри».
(function () {
  const splash = $("splash");
  if (!splash) return;
  $("splashGo").addEventListener("click", () => {
    if (splash.classList.contains("hide")) return;
    splash.classList.add("hide");
    document.body.classList.remove("splash-open");
    setTimeout(() => { splash.hidden = true; }, 500);
  });
})();
