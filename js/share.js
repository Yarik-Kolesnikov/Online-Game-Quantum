/* =========================================================================
   share.js — «Поділитися результатом»
   Після гри генерує картинку-картку з результатом (1080×1350, підходить для
   Instagram і сторіс) і дає поділитися нею або текстом:
   - Telegram, Instagram, TikTok, Facebook: картинка + короткий текст із посиланням і хештегами
     (деталі — біля функції phoneShare);
   - завантажити картинку; скопіювати текст.
   Підключається ПІСЛЯ app.js і бере з нього state, DEPTS, ORDER, QUESTIONS, grade, fmt, toast, $.
   ========================================================================= */
(function () {
  "use strict";

  const SITE_URL = "https://yarik-kolesnikov.github.io/Online-Game-Quantum/";
  // Сервер картинок результату (папка api/, хостинг Vercel). Посилання <SHARE_SERVER>/r?… у Telegram
  // та Facebook показує прев'ю з картинкою результату й веде на гру. Порожньо — ділимося адресою гри.
  const SHARE_SERVER = "https://business-lab-rho.vercel.app";
  const W = 1080, H = 1350;
  const C = {
    bg: "#ffffff", text: "#12151b", muted: "#6b7280", line: "rgba(17, 22, 32, 0.12)",
    grid: "rgba(17, 22, 32, 0.045)", blue: "#0253ce", yellow: "#f5b83d", gold: "#b27806"
  };
  const FONT_D = '"Unbounded", "Arial Black", sans-serif';
  const FONT_B = '"Manrope", "Segoe UI", Arial, sans-serif';
  const FONT_M = '"JetBrains Mono", Menlo, monospace';

  let lastBlob = null, lastText = "";

  /* ---------- дані результату ---------- */
  function siteUrl() {
    return /^https?:$/.test(location.protocol) ? location.origin + location.pathname : SITE_URL;
  }
  function resultData() {
    const s = score();
    const [title] = grade(s);
    const place = $("resultPlace").textContent.trim();
    const depts = ORDER.map((k) => {
      const own = state.cards.filter((c) => QUESTIONS[c.qi].dept === k);
      return { k, d: DEPTS[k], ok: own.filter((c) => c.ok).length, n: own.length };
    }).filter((x) => x.n > 0);
    return { name: state.player, s, title, time: fmt(state.finishedAt - state.startedAt), place: place && place !== "—" ? place : "", depts };
  }
  function b64url(str) {
    let bin = "";
    new TextEncoder().encode(str).forEach((b) => (bin += String.fromCharCode(b)));
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  // посилання з результатом: прев'ю = картинка результату, клік — перехід на гру
  function resultLink(r) {
    if (!SHARE_SERVER) return siteUrl();
    const q = ["s=" + r.s, "t=" + Math.round((state.finishedAt - state.startedAt) / 1000)];
    const m = /^(\d+) із (\d+)$/.exec(r.place);
    if (m) q.push("p=" + m[1] + "-" + m[2]);
    q.push("d=" + ORDER.map((k) => { const x = r.depts.find((y) => y.k === k); return x ? Math.min(9, x.ok) + "" + Math.min(9, x.n) : "00"; }).join(""));
    q.push("u=" + b64url(r.name));
    q.push("v=3"); // версія прев'ю — нове значення змушує соцмережі взяти свіжу картинку
    return SHARE_SERVER.replace(/\/$/, "") + "/r?" + q.join("&");
  }
  // Текст під картинкою. Сам результат (бали, місце, час) уже є на картинці.
  function shareText(r, withUrl = true) {
    const lines = ["🔥 А який результат буде у тебе? Перевір свої знання та випробуй себе в BUSINESS LAB!"];
    if (withUrl) lines.push("🔗 " + resultLink(r));
    lines.push("#BusinessLab #Квантум #ЗапорізькаПолітехніка #ОсвітняГра #МислиАналізуйПеремагай");
    return lines.join("\n");
  }

  /* ---------- малювання картки ---------- */
  function cssVar(name, fallback) {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  }
  function deptColor(k) {
    // кольори кафедр світлої теми (картка завжди світла)
    const light = { mkt: "#0253ce", mgt: "#f21e6e", acc: "#129f43", bus: "#fd7614", econ: "#fccb15" };
    return light[k] || cssVar("--d-" + k, "#888");
  }
  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function fitFont(ctx, text, weight, size, family, maxW, min = 18) {
    let s = size;
    do { ctx.font = weight + " " + s + "px " + family; } while (ctx.measureText(text).width > maxW && (s -= 2) > min);
    return s;
  }
  function ellipsize(ctx, text, maxW) {
    if (ctx.measureText(text).width <= maxW) return text;
    while (text.length > 1 && ctx.measureText(text + "…").width > maxW) text = text.slice(0, -1);
    return text + "…";
  }

  async function ensureFonts() {
    if (!document.fonts || !document.fonts.load) return;
    try {
      await Promise.race([
        Promise.all([
          document.fonts.load("900 64px Unbounded"), document.fonts.load("700 44px Unbounded"),
          document.fonts.load("800 44px Manrope"), document.fonts.load("600 28px Manrope"),
          document.fonts.load("700 28px 'JetBrains Mono'")
        ]),
        new Promise((r) => setTimeout(r, 2500))
      ]);
    } catch (e) { /* шрифти не обов'язкові — буде запасний */ }
  }

  async function drawCard(r) {
    await ensureFonts();
    const cv = document.createElement("canvas");
    cv.width = W; cv.height = H;
    const ctx = cv.getContext("2d");

    // фон + сітка
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = C.grid; ctx.lineWidth = 1;
    for (let x = 0; x <= W; x += 54) { ctx.beginPath(); ctx.moveTo(x + .5, 0); ctx.lineTo(x + .5, H); ctx.stroke(); }
    for (let y = 0; y <= H; y += 54) { ctx.beginPath(); ctx.moveTo(0, y + .5); ctx.lineTo(W, y + .5); ctx.stroke(); }

    // «графік зростання» знизу, як на сайті
    const pts = [[0, 1210], [90, 1255], [160, 1272], [250, 1205], [330, 1228], [420, 1150], [500, 1180], [600, 1105], [680, 1138], [770, 1060], [860, 1095], [950, 1020], [1080, 1040]]
      .map(([x, y]) => [x, Math.round(1215 + (y - 1020) * 0.42)]);
    const g = ctx.createLinearGradient(0, 1200, 0, H);
    g.addColorStop(0, "rgba(245, 184, 61, .22)"); g.addColorStop(1, "rgba(245, 184, 61, 0)");
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); pts.forEach(([x, y]) => ctx.lineTo(x, y)); ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath();
    ctx.fillStyle = g; ctx.fill();
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); pts.forEach(([x, y]) => ctx.lineTo(x, y));
    ctx.strokeStyle = "rgba(178, 120, 6, .55)"; ctx.lineWidth = 4; ctx.stroke();

    // логотип
    ctx.fillStyle = C.yellow;
    [[80, 74, 0.55], [94, 54, 1], [108, 84, 0.4]].forEach(([x, y, a], i) => {
      ctx.globalAlpha = i === 2 ? 0.6 : 1;
      rr(ctx, x, y, 10, 126 - y, 3); ctx.fill();
    });
    ctx.globalAlpha = 1;
    ctx.textBaseline = "alphabetic";
    ctx.font = "900 58px " + FONT_D;
    ctx.fillStyle = C.blue; ctx.fillText("BUSINESS", 140, 120);
    const bw = ctx.measureText("BUSINESS").width;
    ctx.fillStyle = C.yellow; ctx.fillText("LAB", 140 + bw + 16, 120);
    ctx.font = "600 27px " + FONT_B; ctx.fillStyle = C.muted;
    ctx.fillText("Факультет бізнес-технологій та економіки", 142, 162);

    // картка результату
    const cx = 60, cy = 210, cw = 960, ch = 860;
    ctx.save();
    ctx.shadowColor = "rgba(17, 22, 32, .14)"; ctx.shadowBlur = 50; ctx.shadowOffsetY = 18;
    rr(ctx, cx, cy, cw, ch, 36); ctx.fillStyle = "#fff"; ctx.fill();
    ctx.restore();
    rr(ctx, cx, cy, cw, ch, 36); ctx.strokeStyle = C.line; ctx.lineWidth = 2; ctx.stroke();
    // кольорова смуга кафедр зверху картки
    ctx.save(); rr(ctx, cx, cy, cw, ch, 36); ctx.clip();
    const seg = cw / ORDER.length;
    ORDER.forEach((k, i) => { ctx.fillStyle = deptColor(k); ctx.fillRect(cx + i * seg, cy, seg + 1, 12); });
    ctx.restore();

    const px = cx + 60;
    ctx.font = "700 24px " + FONT_M; ctx.fillStyle = C.muted;
    if ("letterSpacing" in ctx) ctx.letterSpacing = "4px";
    ctx.fillText("МІЙ РЕЗУЛЬТАТ", px, cy + 82);
    if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";

    fitFont(ctx, r.name, "800", 46, FONT_B, cw - 120, 26);
    ctx.fillStyle = C.text; ctx.fillText(ellipsize(ctx, r.name, cw - 120), px, cy + 142);

    // великий бал
    ctx.font = "900 220px " + FONT_D; ctx.fillStyle = C.gold;
    ctx.fillText(String(r.s), px - 8, cy + 375);
    const sw = ctx.measureText(String(r.s)).width;
    ctx.font = "700 76px " + FONT_D; ctx.fillStyle = C.muted;
    ctx.fillText("/ 10", px + sw + 8, cy + 375);

    fitFont(ctx, r.title, "700", 46, FONT_D, cw - 120, 24);
    ctx.fillStyle = C.text; ctx.fillText(r.title, px, cy + 455);

    // плашки «Час» і «Місце»
    let chipX = px;
    const chip = (label, value) => {
      ctx.font = "600 24px " + FONT_B; const lw = ctx.measureText(label).width;
      ctx.font = "700 28px " + FONT_M; const vw = ctx.measureText(value).width;
      const w = lw + vw + 56, h = 62, y = cy + 492;
      rr(ctx, chipX, y, w, h, 18); ctx.fillStyle = "#f5f6f8"; ctx.fill();
      ctx.strokeStyle = C.line; ctx.lineWidth = 2; ctx.stroke();
      ctx.font = "600 24px " + FONT_B; ctx.fillStyle = C.muted; ctx.fillText(label, chipX + 22, y + 40);
      ctx.font = "700 28px " + FONT_M; ctx.fillStyle = C.text; ctx.fillText(value, chipX + 34 + lw, y + 41);
      chipX += w + 16;
    };
    chip("Час", r.time);
    if (r.place) chip("Місце", r.place);

    // результат по кафедрах
    let ry = cy + 600;
    const rowH = Math.min(48, Math.floor((ch - 640) / Math.max(r.depts.length, 1)));
    r.depts.forEach(({ k, d, ok, n }) => {
      const col = deptColor(k);
      ctx.font = "700 20px " + FONT_M;
      const codeW = Math.max(ctx.measureText(d.code).width + 28, 70);
      rr(ctx, px, ry - 26, codeW, 34, 17); ctx.fillStyle = col; ctx.fill();
      ctx.fillStyle = k === "econ" ? "#1a1203" : "#fff";
      ctx.textAlign = "center"; ctx.fillText(d.code, px + codeW / 2, ry - 2); ctx.textAlign = "left";
      ctx.font = "600 25px " + FONT_B; ctx.fillStyle = C.text;
      ctx.fillText(ellipsize(ctx, d.name, cw - 120 - codeW - 140), px + codeW + 18, ry);
      ctx.font = "700 26px " + FONT_M; ctx.textAlign = "right";
      ctx.fillStyle = ok === n ? "#16a34a" : C.text;
      ctx.fillText(ok + " / " + n, cx + cw - 60, ry); ctx.textAlign = "left";
      ry += rowH;
    });

    // підвал: заклик і адреса
    ctx.font = "600 30px " + FONT_B; ctx.fillStyle = C.muted; ctx.textAlign = "center";
    ctx.fillText("Перевір себе — пройди тест:", W / 2, 1132);
    const host = siteUrl().replace(/^https?:\/\//, "").replace(/\/$/, "");
    fitFont(ctx, host, "800", 34, FONT_B, W - 120, 20);
    ctx.fillStyle = C.blue; ctx.fillText(host, W / 2, 1180);
    ctx.textAlign = "left";

    return new Promise((res) => cv.toBlob((b) => res(b), "image/png"));
  }

  /* ---------- вікно «Поділитися» ---------- */
  const modal = () => $("shareModal");
  function openLink(url) { window.open(url, "_blank", "noopener"); }

  async function openShare() {
    if (!state.finishedAt) { toast("Спочатку завершіть гру."); return; }
    const r = resultData();
    lastText = shareText(r);
    $("shareTextPreview").textContent = lastText;

    modal().hidden = false;
    document.body.style.overflow = "hidden";
    $("sharePreview").removeAttribute("src");
    $("sharePreviewWrap").classList.add("loading");
    lastBlob = await drawCard(r);
    if (lastBlob) {
      const old = $("sharePreview").dataset.url;
      if (old) URL.revokeObjectURL(old);
      const u = URL.createObjectURL(lastBlob);
      $("sharePreview").dataset.url = u;
      $("sharePreview").src = u;
    }
    $("sharePreviewWrap").classList.remove("loading");
    $("shareSteps").hidden = true;
    $("shareTg").focus({ preventScroll: true });
  }
  function closeShare() {
    if (!modal() || modal().hidden) return;
    modal().hidden = true;
    document.body.style.overflow = "";
    $("shareBtn").focus({ preventScroll: true });
  }

  function imageFile() {
    return lastBlob ? new File([lastBlob], "business-lab-result.png", { type: "image/png" }) : null;
  }
  function saveImage() {
    if (!lastBlob) return false;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(lastBlob);
    a.download = "business-lab-result.png";
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    return true;
  }
  function download() {
    if (saveImage()) toast("Картинку збережено.");
  }
  async function writeClipboard(text) {
    try { await navigator.clipboard.writeText(text); return true; }
    catch (e) {
      const ta = document.createElement("textarea");
      ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.append(ta); ta.select();
      let ok = false;
      try { ok = document.execCommand("copy"); } catch (e2) { ok = false; }
      ta.remove();
      return ok;
    }
  }
  async function copyText() {
    toast(await writeClipboard(lastText) ? "Текст скопійовано — встав його в повідомлення чи допис." : "Не вдалося скопіювати текст.");
  }
  async function copyImage() {
    try {
      if (!lastBlob || !window.ClipboardItem || !navigator.clipboard?.write) return false;
      await navigator.clipboard.write([new ClipboardItem({ "image/png": lastBlob })]);
      return true;
    } catch (e) { return false; }
  }

  /* Як потрапляє картинка в соцмережу:
     - телефон: системне меню «Поділитися» з картинкою й текстом, обираєш Telegram / Instagram / TikTok / Facebook;
     - комп'ютер: соцмережі не дають сайту прикріпити картинку посиланням, тому
       Telegram — картинка копіюється в буфер, відкривається Telegram із текстом, у чаті Ctrl+V;
       Instagram, TikTok, Facebook — картинка завантажується, текст копіюється, відкривається сайт соцмережі. */
  const PASTE = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? "⌘V" : "Ctrl+V";
  // підказка-кроки в самому вікні (тост зникає надто швидко)
  function steps(list) {
    const box = $("shareSteps");
    box.textContent = "";
    list.forEach((t) => box.append(el("li", "", t)));
    box.hidden = false;
  }
  const isPhone = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent));
  function phoneShare() {
    const file = imageFile();
    if (!isPhone || !file || !navigator.share || !navigator.canShare || !navigator.canShare({ files: [file] })) return false;
    writeClipboard(lastText); // якщо застосунок не підхопить текст — його можна вставити
    navigator.share({ files: [file], text: lastText }).catch((e) => {
      if (e && e.name !== "AbortError") { saveImage(); toast("Картинку збережено, текст скопійовано — додай їх у допис."); }
    });
    return true;
  }
  async function shareTelegram() {
    if (phoneShare()) return;
    if (SHARE_SERVER) { // прев'ю посилання саме покаже картинку результату
      openLink("https://t.me/share/url?url=" + encodeURIComponent(lastText));
      steps(["Обери чат у Telegram і надішли.", "Картинка з результатом з'явиться сама — у прев'ю посилання."]);
      return;
    }
    const copied = await copyImage();
    if (!copied) saveImage();
    // Telegram ставить параметр url першим рядком, тому весь текст (із посиланням) передаємо в ньому
    openLink("https://t.me/share/url?url=" + encodeURIComponent(lastText));
    steps(copied
      ? ["Картинку з результатом скопійовано.", "У Telegram обери чат — текст уже буде в полі.", "Натисни " + PASTE + ", щоб додати картинку, і надішли."]
      : ["Картинку з результатом збережено.", "У Telegram обери чат — текст уже буде в полі.", "Прикріпи збережену картинку (скрепка) і надішли."]);
  }
  // Instagram і TikTok на комп'ютері не приймають готові дописи від сайтів (лише вручну),
  // тому нічого не завантажуємо самі — лише копіюємо текст і пояснюємо.
  function shareToApp(name) {
    if (phoneShare()) return;
    writeClipboard(lastText);
    steps([name + " на комп'ютері не дозволяє сайтам створювати допис — на телефоні ця кнопка відправить картинку одразу.",
      "Тут: натисни «Завантажити картинку» нижче й додай її в допис " + name + ".",
      "Текст уже скопійовано — встав його (" + PASTE + ")."]);
  }

  /* ---------- події ---------- */
  $("shareBtn").addEventListener("click", openShare);
  $("shareTg").addEventListener("click", (e) => { e.preventDefault(); shareTelegram(); });
  $("shareIg").addEventListener("click", () => shareToApp("Instagram"));
  $("shareTt").addEventListener("click", () => shareToApp("TikTok"));
  $("shareFb").addEventListener("click", (e) => {
    e.preventDefault();
    if (phoneShare()) return;
    // Facebook сам підтягує прев'ю посилання (з сервером — картинку результату), а текст вставляти не дозволяє
    writeClipboard(lastText);
    openLink("https://www.facebook.com/sharer/sharer.php?u=" + encodeURIComponent(resultLink(resultData())) +
      "&hashtag=" + encodeURIComponent("#BusinessLab") + "&quote=" + encodeURIComponent(lastText));
    steps([SHARE_SERVER ? "Картинка з результатом підтягнеться сама." : "Посилання на гру вже в дописі.",
      "Facebook не дозволяє сайтам вставляти текст — він скопійований, встав його (" + PASTE + ") і опублікуй."]);
  });
  $("shareDownload").addEventListener("click", download);
  $("shareCopy").addEventListener("click", copyText);
  document.querySelectorAll("[data-share-close]").forEach((n) => n.addEventListener("click", closeShare));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeShare(); });

  // для перевірки й повторного використання
  window.BL = window.BL || {};
  BL.share = { open: openShare, close: closeShare, drawCard: () => drawCard(resultData()), text: () => shareText(resultData()) };
})();
