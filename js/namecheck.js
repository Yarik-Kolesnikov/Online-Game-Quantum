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

  // пари літер, що трапляються в справжніх словах та іменах (укр./рос./англ.), — щонайменше
  // 5 разів у словнику з банку питань гри, ~2000 українських слів та імен і англійських текстів.
  // Пари, якої тут немає, у справжньому слові майже не буває.
  const PAIRS = new Set(
    [
      "aa ab ac ad ae af ag ah ai aj ak al am an ao ap aq ar as at au av aw ax ay ba bb be bi bj bl",
      "bm bo br bs bt bu bv by ca cc ce ch ci ck cl co cq cr cs ct cu cy cz da dd de df dg di dj dl",
      "dm dn do dr ds dt du dv dw dy ea eb ec ed ee ef eg eh ei ek el em en eo ep eq er es et eu ev",
      "ew ex ey ez fa fe ff fi fl fm fo fr fs ft fu fy ga ge gg gh gi gl gm gn go gp gr gs gu ha hd",
      "he hi hl hm hn ho hr hs ht hu hw hy hz ia ib ic id ie if ig ii ij ik il im in io ip iq ir is",
      "it iu iv ix iy iz ja jc je jo ju ka ke kh ki kl kn ko ks ku ky la lb lc ld le lf lh li lk ll",
      "lm lo lp lr ls lt lu lv ly lz ma mb mc me mi ml mm mn mo mp ms mu mv my na nc nd ne nf ng ni",
      "nj nk nl nm nn no np nr ns nt nu nv ny nz oa ob oc od oe of og oh oi oj ok ol om on oo op or",
      "os ot ou ov ow ox oy oz pa pb pd pe ph pi pl pm po pp pr ps pt pu py qu ra rb rc rd re rf rg",
      "rh ri rk rl rm rn ro rp rr rs rt ru rv rw ry rz sa sc sd se sf sg sh si sk sl sm sn so sp sq",
      "ss st su sy sz ta tb tc td te tf th ti tl tm tn to tp tr ts tt tu tw ty ua ub uc ud ue uf ug",
      "ui uk ul um un uo up ur us ut ux uy uz va vc ve vi vo vr wa we wh wi wl wn wo wr ws wu ww xa",
      "xc xe xh xi xm xp xt xu xy ya yc ye yi yk yl ym yn yo yp yr ys yt yu yz za ze zh zi zo zu zy",
      "zz аа аб ав аг ад ае аж аз аи ай ак ал ам ан ап ар ас ат ау аф ах ац ач аш ащ аю ає аї ба бб",
      "бв бд бе бз би бк бл бм бн бо бр бс бт бу бц бч бщ бы бь бю бё бє бі бґ ва вб вв вг вд ве вж",
      "вз ви вк вл вм вн во вп вр вс вт ву вц вч вш вы вь вю вя ві га гб гв гд ге гз ги гк гл гн го",
      "гр гу гі да дб дв дг дд де дж дз ди дк дл дм дн до дп др дс дт ду дх дч дш дь дя ді еа еб ев",
      "ег ед ее еж ез ей ек ел ем ен ео еп ер ес ет еф ех ец еч еш ещ ея еє жа жв жг жд же жж жи жк",
      "жл жм жн жо жу жч жя жі за зб зв зг зд зе зи зк зл зм зн зо зп зр зс зу зь зю зя зі зґ иб ив",
      "иг ид ие иж из ий ик ил им ин ио ип ир ис ит иф их иц ич иш ищ ия иє иї иґ йб йг йд йз йк йл",
      "йм йн йо йп йс йт йф йц йч ка кв кг ке кз ки кл км кн ко кр кс кт ку кц кш кщ кь кя кє кі ла",
      "лв ле лж ли лк лл лн ло лп лт лу лы ль лю ля лё лі лґ ма мб мв мг ме мж ми мк мл мм мн мо мп",
      "мр мс мт му мф мх мч мы мь мя мё мі на нв нг нд не нж нз ни нк нн но нс нт ну нф нц нч нш нщ",
      "ны нь ню ня нє ні об ов ог од ож оз ои ой ок ол ом он оо оп ор ос от оу оф ох оц оч ош ощ ою",
      "оя оє ої па пе пи пк пл пн по пп пр пт пу пц пч пш пю пя пі ра рб рв рг рд ре рж рз ри рк рл",
      "рм рн ро рп рс рт ру рф рх рц рч рш рщ ры рь рю ря рё рі рґ са сб св се си ск сл см сн со сп",
      "ср сс ст су сф сх сш сь сю ся сё сі та тб тв те ти тк тл тн то тр тс тт ту тх тч ты ть тю тя",
      "тє ті уа уб ув уг уд уе уж уз уй ук ул ум ун уп ур ус ут уф ух уц уч уш ущ ую ує уї фа фе фи",
      "фл фо фр фс фт фу фь фё фі ха хв хг хе хи хл хм хн хо хр хт ху хі ца цв це ци цо цт цу ць цю",
      "ця ці ча чв че чи чк чм чн чо чу чч чь чя чё чі ша шв ше ши шк шл шм шн шо шп шр шт шу шё ші",
      "ща ще щи що щу щь щі ыб ыд ык ыл ын ыс ыш ьб ьв ьг ьд ье ьж ьи ьк ьм ьн ьо ьп ьс ьт ьц ьч ьш",
      "ья ьё юб юв юг юд юж юз юк юл юн юр юс ют юх юц юч юш ющ яб яв яг яд яе яж яз яй як ял ям ян",
      "яп яр яс ят ях яц яч яш ящ яє ёв ёд ём ён єв єг єд єк єл єм єн єп єр єт єх єц єч іа іб ів іг",
      "ід іж із ій ік іл ім ін іо іп ір іс іт іу іх іч іш іщ ію ія іє ії їв їд їж їз їк їл їн їс їт",
      "їх її ґа ґв ґе ґи ґл ґн ґо ґр ґу",
    ]
      .join(" ")
      .split(" "),
  );

  // кирилиця: рідкісна пара двох приголосних чи двох голосних — уже підозріло, будь-яких — дві;
  // латиниця (менший словник): дві будь-які рідкісні пари
  // кирилиця: якими двома приголосними може починатися й закінчуватися слово (з того ж словника)
  const START_CC = new Set(
    "бл бр вв вж вз вк вл вм вн вп вр вс вт вх вч гд гл гн гр дв дж дз дл дм дн др дь жв жд жм жн зб зв зг зд зл зм зн зр зс зґ йм кв кг кл км кн кр кс кш лж ль мж мк мл мн мр мс мш пл пр пт пш св ск сл см сн сп ср ст сф сх сь тв тк тр тт тх тщ фл фр хв хл хм хр хт цв ць чв чм шв шк шл шм шн шп шт ґв ґл ґн ґр".split(
      " ",
    ),
  );
  const END_CC = new Set(
    "бр вк вр вь гб гд др дь зд зм зь йд йк йл йн йп йс йт кс кт лп лт ль нг нк нс нт нч нш нь рб рг рд рк рн рс рт рф рх рщ рь ск сл сс ст сь тм тр ть ць чь щь ьк ьт ьш".split(
      " ",
    ),
  );
  const CYR_CONS = /^[бвгґджзйклмнпрстфхцчшщь]{2}$/;

  // кирилиця: які збіги трьох приголосних бувають у словах («стр», «нськ»…)
  const CCC = new Set(
    [
      "бсл бст бґр вдр вжд вжн взд вкл впл впр вст всь втр грн джм дзв дзь дкр днь дпр дст дсь дтв",
      "дтр дшт дьг збл збр здр зкл знь зсм зьк зьм зґв йзм йкр йсб йст йсь кгб кль крт ксн ксп кст",
      "ктр кшт льб льв льг льд льж льк льн льп льс льт льц льч льш мкн мкр мпл мст нгв нгл нгр ндз",
      "ндн ндр ндш нзл нкр нкс нсп нст нсф нсь нтн нтр нфл ньг ньк рдж рдл рзл ркв рмл рпл рпн рсп",
      "рст рсь ртк ртн ртс ртч рть ршк ршр скв скл скр сль спл спр ств стк стр сть сшт ськ сьм ткн",
      "трь тсм тхн тьм тьс фсп цтв цьк шкр шнь шпр ьпт ьст ьсь",
    ]
      .join(" ")
      .split(" "),
  );

  function badCluster(part) {
    for (let i = 0; i + 3 <= part.length; i++) {
      const t = part.slice(i, i + 3);
      if (/^[бвгґджзйклмнпрстфхцчшщь]{3}$/.test(t) && !CCC.has(t)) return true;
    }
    return false;
  }

  function badEdges(part) {
    if (part.length < 3 || !new RegExp(`[${CYR}]`).test(part)) return false;
    const a = part.slice(0, 2);
    const z = part.slice(-2);
    return (CYR_CONS.test(a) && !START_CC.has(a)) || (CYR_CONS.test(z) && !END_CC.has(z));
  }

  function rarePairsBad(part) {
    let rare = 0;
    let hard = 0;
    for (let i = 0; i + 2 <= part.length; i++) {
      const p = part.slice(i, i + 2);
      if (PAIRS.has(p)) continue;
      rare++;
      if (VOWELS.test(p[0]) === VOWELS.test(p[1])) hard++;
    }
    const cyr = new RegExp(`[${CYR}]`).test(part);
    return rare >= 2 || (cyr && hard >= 1);
  }

  // однакові шматки по 3 літери двічі в довгому слові: «yyerryerywetwet»
  function repeatedTrigram(part) {
    if (part.length < 8) return false;
    const seen = new Set();
    for (let i = 0; i + 3 <= part.length; i++) {
      const t = part.slice(i, i + 3);
      if (seen.has(t)) return true;
      seen.add(t);
    }
    return false;
  }

  function gibberish(part) {
    if (!VOWELS.test(part)) return true;
    if (/(.)\1\1/.test(part)) return true; // ааа
    if (/(.{2,4})\1\1/.test(part)) return true; // ababab, rertertert
    if (/^(.{2,})\1+$/.test(part)) return true; // фивфив, уйуй
    if (new RegExp(`[${CYR}]`).test(part) && /[аеєиіїоуюяыэё]{3}/.test(part)) return true; // лялеае
    if (part.length > 20 || repeatedTrigram(part)) return true;
    if (/^(.)\1/.test(part) && !/^ll/.test(part)) return true; // «yyer…» (крім Lloyd)
    if (rarePairsBad(part) || badEdges(part) || badCluster(part)) return true;
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
