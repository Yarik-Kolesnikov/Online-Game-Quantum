/* namecheck.js — перевірка імені гравця перед грою та в рейтингу.

   Пропускає справжні імена й слова: «Ярослав Колесников», «Анна-Марія», «Дар'я», «John Smith».
   Не пропускає:
     - символи, цифри, емодзі (лише літери, пробіл, дефіс, апостроф);
     - нецензурні слова українською, російською, англійською й транслітом;
     - «каляки-маляки»: набори клавіш (фівапр, qwerty), повтори (аааа, ababab, фивфив),
       слова без голосних, задовгі збіги приголосних, змішування алфавітів у слові.

   Та сама логіка повторена в api/share.py (картинка результату) і частково у firestore.rules.
   Підключається ДО app.js. Експортує BL.cleanName(name) і BL.checkName(name). */
(function () {
  const BL = (window.BL = window.BL || {});

  const CYR = "а-яґєіїё";
  const LAT = "a-z";
  const VOWELS = /[аеєиіїоуюяыэёaeiouy]/;
  const VOWEL_RUN = /[аеєиіїоуюяыэёaeiouy]{4,}/;
  const CONS_RUN = /[бвгґджзйклмнпрстфхцчшщbcdfghjklmnpqrstvwxz]{6,}/;

  // клавіатурні ряди й абетки: 4 літери поспіль (у будь-який бік) = набір навмання
  const ROWS = [
    "йцукенгшщзхї",
    "йцукенгшщзхъ",
    "фівапролджє",
    "фывапролджэ",
    "ячсмитьбю",
    "qwertyuiop",
    "asdfghjkl",
    "zxcvbnm",
    "абвгґдеєжзиіїйклмнопрстуфхцчшщьюя",
    "abcdefghijklmnopqrstuvwxyz",
  ];
  const KEY_RUNS = new Set();
  ROWS.forEach((row) => {
    const rev = row.split("").reverse().join("");
    [row, rev].forEach((r) => {
      for (let i = 0; i + 4 <= r.length; i++) KEY_RUNS.add(r.slice(i, i + 4));
    });
  });

  // нецензурне — для одного слова (зведеного до малих літер, ё/є→е, ї→і, без ' і -, без повторів літер)
  const BAD_WORD = [
    /ху[йяию]/,
    /хуе(?!рт)/,
    /п[иі]зд/,
    /бляд|блят|^бля$/,
    /залуп/,
    /г[ао]нд[оа]н/,
    /п[иі]д[оа]р|педик|педераст/,
    /шлюх|шалав/,
    /дроч/,
    /мудак|мудил|мудо[хз]/,
    /мандавош|^манд[аиуо]$/,
    /^сук[аиіуо]$|^сучк|^сучар/,
    /^лох[иі]?$/,
    /^чмо/,
    /жоп/,
    /говн|гівн/,
    /^сра[кнтц]/,
    /^д[еи]б[иі]л/,
    /^[иі]д[иі]от/,
    /^даун$/,
    /курв/,
    /уеб|йоб/,
    /^(за|на|по|от|вы|ви|до|у|при|пере|раз|роз|з|с|від|недо|об|под)?(е|і)б(а[тлншв]|л[аои]|у[тчн]|о[шк]|ну|ан|ен|ись|ырь|ар)/,
    // латиниця й транслит
    /fuck|fuk|shit|bitch|cunt|asshole|whore|nigg|fagg|slut|porn|dildo|pussy/,
    /pizd|blyad|blyat|zalup|mudak|pidor|pidar|gandon|gondon|shluh/,
    /^suk[aiu]$|^eba[tln]|^zaeb|^nahu[iy]|^xu[iyj]|^xyu|^huy$|^huj/,
  ];
  // для всіх слів разом (щоб не обійти пробілом: «ху йло»)
  const BAD_JOINED = [
    /ху[йяию]/,
    /п[иі]зд/,
    /бляд|блят/,
    /залуп/,
    /г[ао]нд[оа]н/,
    /fuck|shit|pizd|blyad/,
  ];

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

  function gibberish(part) {
    if (!VOWELS.test(part)) return true;
    if (/(.)\1\1/.test(part)) return true; // ааа
    if (/(.{2})\1\1/.test(part)) return true; // ababab
    if (/^(.{3,})\1+$/.test(part)) return true; // фивфив
    if (VOWEL_RUN.test(part) || CONS_RUN.test(part)) return true;
    if (part.length >= 4) {
      const v = part.split("").filter((c) => VOWELS.test(c)).length;
      if (v / part.length > 0.8) return true;
    }
    for (let i = 0; i + 4 <= part.length; i++) if (KEY_RUNS.has(part.slice(i, i + 4))) return true;
    // неможливі для імені поєднання
    if (/^[ьъы]/.test(part)) return true;
    if (/^[бвгґджзклмнпрстфхцчшщ]{4}/.test(part) && !/^мкрт/.test(part)) return true; // фдлв…
    if (/[аеєиіїоуюяыэё][ьъ]|[ьъ][ьъ]|йй|ыы/.test(part)) return true;
    if (/[бвгґджзклмнпрстфхцчшщ]й/.test(part)) return true;
    if (/[ыэъё]/.test(part) && /[іїєґ]/.test(part)) return true; // рос. + укр. літери разом
    return false;
  }

  const WORD = new RegExp(`^[${CYR}${LAT}]+(?:['-][${CYR}${LAT}]+)*$`);

  /* { ok: true } або { ok: false, reason: "текст для гравця" } */
  function checkName(raw) {
    const name = cleanName(raw);
    if (name.length < 3) return { ok: false, reason: "Введіть ім'я (щонайменше 3 літери)." };
    if (name.length > 48) return { ok: false, reason: "Ім'я задовге — до 48 символів." };
    const words = name.toLowerCase().split(" ");
    if (words.length > 4)
      return { ok: false, reason: "Забагато слів — достатньо імені та прізвища." };
    if (!words.every((w) => WORD.test(w)))
      return { ok: false, reason: "Використовуйте лише літери, пробіл, дефіс або апостроф." };

    if (
      words.some((w) => BAD_WORD.some((re) => re.test(forBad(w)))) ||
      BAD_JOINED.some((re) => re.test(forBad(words.join(""))))
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
    return { ok: true, name };
  }

  BL.cleanName = cleanName;
  BL.checkName = checkName;
})();
