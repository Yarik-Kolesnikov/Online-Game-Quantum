/* namecheck.js — перевірка імені гравця перед грою та в рейтингу.

   Пропускає справжні імена й прізвища, зокрема рідкісні: «Товт Роман», «Ґудзь», «Мчедлішвілі»,
   «Нгуєн», «Цой», «Загубигорілка», «Анна-Марія», «Дар'я», «John Smith». Потрібні ім'я та прізвище.
   Не пропускає:
     - символи, цифри, емодзі (лише літери, пробіл, дефіс, апостроф);
     - нецензурні слова українською, російською, англійською й транслітом;
     - «каляки-маляки» («yyerryerywetwet», «kvjeoqpz», «фівапр»).

   Як розпізнаються каляки:
     1) кілька жорстких правил, що на ~257 тис. справжніх імен майже не помиляються:
        немає голосних, три однакові літери поспіль, повтор шматка («rertertert», «ашмашмаш»),
        5 клавіш поспіль з одного ряду («йцуке», «qwert»),
        6+ приголосних поспіль, ь/ъ/ы на початку, ь після голосної, слово довше 20 літер;
     2) статистична модель (js/namemodel.js, tools/build_name_model.py): ймовірність кожної
        літери після двох попередніх, навчена на справжніх іменах і прізвищах. Середній бал нижче
        порогу = набір навмання. На відкладених 10% справжніх імен відхиляє ≈0.1%.
     3) ім'я й прізвище разом: якщо обидва слова лише ледь проходять поріг («ррсарм ашолідосч»),
        це теж набір навмання (на справжніх парах помиляється ≈0.06%).

   Та сама логіка — в api/share.py (картинка результату); формат і мат — ще й у firestore.rules.
   Підключається після namemodel.js і ДО app.js. Експортує BL.cleanName(name), BL.checkName(name). */
(function () {
  const BL = (window.BL = window.BL || {});

  const CYR = "а-яґєіїё";
  const LAT = "a-z";
  const VOWELS = /[аеєиіїоуюяыэёaeiouy]/;
  const IS_CYR = new RegExp(`[${CYR}]`);

  // нецензурне — для одного слова (малі літери, ё/є→е, ї→і, без ' і -, без повторів літер).
  // Корені звужено так, щоб не чіпати справжні прізвища: Підоренко, Сучков, Шалавін, Дрочак,
  // по батькові на «-гівна», кримськотатарські Аблятіфов, китайські Xu…, в'єтнамське Huy.
  const BAD_WORD = [
    /ху[йяию]/,
    /хуе(?!рт)/,
    /п[иі]зд/,
    /^бляд|^блят|^бля$/,
    /залуп/,
    /г[ао]нд[оа]н/,
    /^п[иі]д[оа]р(ас)?$|^п[иі]д[оа]рас|^п[иі]дар$|педераст|^педик$/,
    /^шлюх[аиіоу]?$|^шалав[аиіоу]?$/,
    /^дроч(ил|ун|ер|ит|и$|у$|а$)/,
    /мудак|мудил|мудо[хз]/,
    /мандавош|^манд[аиуо]$/,
    /^сук[аиіуо]$|^сучк[аиу]$|^сучар/,
    /^чмо$|^чмошн/,
    /жоп/,
    /^говн|^гівн|говнюк|гівнюк/,
    /^сра[кнтц]/,
    /^д[еи]б[иі]л/,
    /^[иі]д[иі]от/,
    /^даун$/,
    /курв/,
    /уеб|йоб/,
    /^(за|на|по|от|вы|ви|до|у|при|пере|раз|роз|від|недо|об|под)?еб(а[тлншв]|л[аои]|у[тчн]|о[шк]|ну|ан|ен|ись|ырь|ар)/,
    /^(за|на|по|від|ви|до|у|при|пере|роз|недо|об|під)іб(а[тлншв]|ну|ан)/,
    // латиниця й транслит
    /fuck|bitch|asshole|whore|nigg|fagg|dildo|pussy/,
    /^shit|shit$|^cunt$|^sluts?$|^porno?$/,
    /pizd|blyad|blyat|zalup|mudak|^pidor|^pidar|^g[ao]nd[oa]n$|shluh/,
    /^suk[aiu]$|^eba[tln]|^zaeb|^nahu[iy]|^xyu$|^xuy$|^huj$/,
  ];
  // для всіх слів разом, якщо є коротке слово (щоб не обійти пробілом: «ху йло»)
  const BAD_JOINED = [
    /ху[йяию]/,
    /п[иі]зд/,
    /бляд|блят/,
    /залуп/,
    /г[ао]нд[оа]н/,
    /fuck|shit|pizd|blyad/,
  ];

  // ---------- статистична модель (дані — js/namemodel.js) ----------
  function unpack(str, n) {
    const m = new Map();
    if (str) str.split(",").forEach((e) => m.set(e.slice(0, n), parseInt(e.slice(n), 36)));
    return m;
  }

  const models = {};
  function model(kind) {
    if (models[kind] !== undefined) return models[kind];
    const raw = BL.nameModel && BL.nameModel[kind];
    if (!raw) return (models[kind] = null);
    const c3 = unpack(raw.t, 3);
    const c2 = unpack(raw.b, 2);
    const c1 = unpack(raw.u, 1);
    const h1 = new Map();
    c2.forEach((v, k) => h1.set(k[0], (h1.get(k[0]) || 0) + v));
    const ctx = new Map();
    c3.forEach((v, k) => ctx.set(k.slice(0, 2), (ctx.get(k.slice(0, 2)) || 0) + v));
    let N = 0;
    c1.forEach((v) => (N += v));
    return (models[kind] = { c3, c2, c1, h1, ctx, N, V: c1.size, th: BL.nameModel.th[kind] });
  }

  // середній логарифм ймовірності переходів «^^слово$»
  function modelScore(m, w) {
    const x = "^^" + w + "$";
    let sum = 0;
    for (let i = 2; i < x.length; i++) {
      const a = x[i - 2];
      const b = x[i - 1];
      const c = x[i];
      const p1 = ((m.c1.get(c) || 0) + 1) / (m.N + m.V);
      const h = m.h1.get(b) || 0;
      const p2 = h ? ((m.c2.get(b + c) || 0) + 0.1) / (h + 0.1 * m.V) : p1;
      const hc = m.ctx.get(a + b) || 0;
      const p3 = hc ? (m.c3.get(a + b + c) || 0) / hc : 0;
      sum += Math.log(0.75 * p3 + 0.2 * p2 + 0.05 * p1);
    }
    return sum / (x.length - 2);
  }

  // 5 клавіш поспіль з одного ряду («йцуке», «фівап», «qwert») — у справжніх іменах не буває
  const KEY_RUNS = new Set();
  ["йцукенгшщзхї", "йцукенгшщзхъ", "фівапролджє", "фывапролджэ", "ячсмитьбю"]
    .concat(["qwertyuiop", "asdfghjkl", "zxcvbnm"])
    .forEach((row) => {
      [row, row.split("").reverse().join("")].forEach((r) => {
        for (let i = 0; i + 5 <= r.length; i++) KEY_RUNS.add(r.slice(i, i + 5));
      });
    });

  // повтор шматка 2–4 літер: «толжтолжто», «ашмашмаш», «ohiohio»
  function periodic(p) {
    for (let per = 2; per <= 4; per++) {
      let run = 0;
      for (let i = 0; i + per < p.length; i++) {
        run = p[i] === p[i + per] ? run + 1 : 0;
        if (run + per >= 2 * per + 2) return true;
      }
    }
    return false;
  }

  function gibberish(part) {
    if (!VOWELS.test(part)) return true;
    if (/(.)\1\1/.test(part)) return true; // ааа
    if (/(.{2,4})\1\1/.test(part) || periodic(part)) return true; // rertertert
    if (part.length > 20) return true;
    for (let i = 0; i + 5 <= part.length; i++) if (KEY_RUNS.has(part.slice(i, i + 5))) return true;
    const cyr = IS_CYR.test(part);
    if (cyr && /[бвгґджзйклмнпрстфхцчшщ]{6,}/.test(part)) return true;
    if (/^[ьъы]/.test(part)) return true;
    if (cyr && /[аеєиіїоуюяыэё][ьъ]|[ьъ][ьъ]|йй|ыы/.test(part)) return true;
    if (/[ыэъё]/.test(part) && /[іїєґ]/.test(part)) return true; // рос. + укр. літери разом
    if (cyr && /^([бвгґджзйклмнпрстфхцчшщ])\1/.test(part) && !/^(вв|лл)/.test(part)) return true; // «ррсарм»
    return margin(part) < 0;
  }

  // наскільки слово «справжніше» за поріг моделі (≥ 0 — проходить; без моделі — 1)
  function margin(part) {
    const kind = IS_CYR.test(part) ? "cyr" : "lat";
    const m = model(kind);
    if (!m) return 1;
    return modelScore(m, part.replace(/ґ/g, "г").replace(/ё/g, "е")) - m.th;
  }

  // ім'я та прізвище разом: якщо обидва ледь проходять — це теж набір навмання
  function pairTooWeak(words) {
    if (!BL.nameModel || !BL.nameModel.pair) return false;
    let sum = 0;
    let need = 0;
    words.forEach((w) => {
      const parts = w.replace(/'/g, "").split("-");
      sum += parts.reduce((a, p) => a + margin(p), 0) / parts.length;
      need += BL.nameModel.pair[IS_CYR.test(w) ? "cyr" : "lat"];
    });
    return sum / words.length < need / words.length;
  }

  // однакові апострофи, один пробіл між словами
  function cleanName(raw) {
    return String(raw || "")
      .normalize("NFC")
      .replace(/[’ʼ`‘´]/g, "'")
      .replace(/\s+/g, " ")
      .trim();
  }

  function forBad(s) {
    return s
      .toLowerCase()
      .replace(/[ёє]/g, "е")
      .replace(/ї/g, "і")
      .replace(/['-]/g, "")
      .replace(/(.)\1+/g, "$1");
  }

  const WORD = new RegExp(`^[${CYR}${LAT}]+(?:['-][${CYR}${LAT}]+)*$`);

  /* { ok: true } або { ok: false, reason: "текст для гравця" } */
  function checkName(raw) {
    const name = cleanName(raw);
    if (name.length < 3) return { ok: false, reason: "Введіть ім'я (щонайменше 3 літери)." };
    if (name.length > 48) return { ok: false, reason: "Ім'я задовге — до 48 символів." };
    const words = name.toLowerCase().split(" ");
    if (words.length < 2)
      return {
        ok: false,
        reason: "Введіть ім'я та прізвище через пробіл, наприклад: Іван Петренко.",
      };
    if (words.length > 4)
      return { ok: false, reason: "Забагато слів — достатньо імені та прізвища." };
    if (!words.every((w) => WORD.test(w)))
      return { ok: false, reason: "Використовуйте лише літери, пробіл, дефіс або апостроф." };

    if (
      words.some((w) => BAD_WORD.some((re) => re.test(forBad(w)))) ||
      (words.some((w) => w.length <= 3) && BAD_JOINED.some((re) => re.test(forBad(words.join("")))))
    )
      return { ok: false, reason: "Таке ім'я використати не можна. Введіть справжнє ім'я." };

    for (const w of words) {
      const mixed = new RegExp(`[${CYR}]`).test(w) && new RegExp(`[${LAT}]`).test(w);
      const parts = w.replace(/'/g, "").split("-");
      if (mixed || parts.some((p) => p.length < 2 || gibberish(p)))
        return {
          ok: false,
          reason: "Схоже на випадковий набір літер. Введіть справжнє ім'я та прізвище.",
        };
    }
    if (pairTooWeak(words))
      return {
        ok: false,
        reason: "Схоже на випадковий набір літер. Введіть справжнє ім'я та прізвище.",
      };
    return { ok: true, name };
  }

  BL.cleanName = cleanName;
  BL.checkName = checkName;
})();
