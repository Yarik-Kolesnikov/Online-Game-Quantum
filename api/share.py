"""
BUSINESS LAB — сторінка й картинка результату для соцмереж (функція Vercel).

Маршрути (налаштовані у vercel.json):
    /r?…     HTML з og:image для прев'ю в Telegram, Facebook тощо.
             Людину (не робота) одразу переадресовує на гру.
    /card?…  PNG 1200×630 з результатом — саме його показує прев'ю.
    /fb?…    переадресація на вікно допису Facebook із посиланням /r?… і хештегами.

Параметри:
    n — ПІБ (або u — ПІБ у base64url), s — бали (0–10), t — час у секундах,
    p — «місце-усього» або out (поза ТОП-100),
    d — по дві цифри «правильно/усього» для кафедр МЦТ, МА, ОФ, БУ, ЕМС,
    v — версія прев'ю (змушує соцмережі взяти свіжу картинку).
"""

import base64
import io
import os
from html import escape
from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs, quote, urlencode, urlparse
from urllib.request import urlopen

GAME_URL = "https://business-lab-zp.vercel.app/"
FONT_URL = GAME_URL + "fonts/"
HERE = os.path.dirname(os.path.abspath(__file__))
FONT_DIRS = [
    os.path.join(HERE, "..", "fonts"),
    os.path.join(os.getcwd(), "fonts"),
    "/tmp/bl-fonts",
]

# код, назва, колір, колір тексту на плашці
DEPTS = [
    ("МЦТ", "Маркетинг та цифрові технології", "#0253ce", "#ffffff"),
    ("МА", "Менеджмент та адміністрування", "#f21e6e", "#ffffff"),
    ("ОФ", "Облік та фінанси", "#129f43", "#ffffff"),
    ("БУ", "Бізнес та управління", "#fd7614", "#ffffff"),
    ("ЕМС", "Економіка та митна справа", "#fccb15", "#1a1203"),
]
FB_HASHTAGS = "#BusinessLab #Квантум #ЗапорізькаПолітехніка #ОсвітняГра #МислиАналізуйПеремагай"

# кольори картинки
BLUE = "#0253ce"
YELLOW = "#f5b83d"
GOLD = "#b27806"
TEXT = "#12151b"
MUTED = "#6b7280"

# файли шрифтів (папка fonts/)
UNB_B = "Unbounded-Black.ttf"
UNB = "Unbounded-Bold.ttf"
MAN_XB = "Manrope-ExtraBold.ttf"
MAN_SB = "Manrope-SemiBold.ttf"
MONO = "JetBrainsMono-Bold.ttf"


# ---------- дані результату ----------
def grade(s):
    """Звання за кількістю балів (ті самі пороги, що й у js/app.js)."""
    p = s / 10
    if p >= 0.9:
        return "Бізнес-акула"
    if p >= 0.7:
        return "Перспективний стартапер"
    if p >= 0.5:
        return "Молодий підприємець"
    if p >= 0.3:
        return "Стажер"
    return "Початок кар'єри"


def parse(qs):
    """Розбирає параметри посилання в словник результату (з перевіркою меж)."""
    q = {k: v[0] for k, v in parse_qs(qs).items()}

    def num(key, lo, hi, default=0):
        try:
            return max(lo, min(hi, int(q.get(key, default))))
        except ValueError:
            return default

    # ПІБ: u — у base64url (UTF-8), так посилання коротше й без %D0%…; n — звичайним текстом
    raw = q.get("n", "")
    if q.get("u"):
        padding = "=" * (-len(q["u"]) % 4)
        try:
            raw = base64.urlsafe_b64decode(q["u"] + padding).decode("utf-8")
        except (ValueError, UnicodeDecodeError):
            raw = ""
    name = " ".join(raw.split())[:48] or "Гравець"

    s = num("s", 0, 10)
    t = num("t", 0, 86400)

    place = ""
    pp = q.get("p", "").split("-")
    if len(pp) == 2 and all(x.isdigit() for x in pp) and 0 < int(pp[0]) <= int(pp[1]) < 100000:
        place = f"{pp[0]} із {pp[1]}"
    elif q.get("p") == "out":
        place = "поза ТОП-100"

    d = "".join(ch for ch in q.get("d", "") if ch.isdigit())[:10]
    depts = []
    for i, dep in enumerate(DEPTS):
        if len(d) >= i * 2 + 2:
            ok = int(d[i * 2])
            n = int(d[i * 2 + 1])
            if n > 0:
                depts.append((dep, min(ok, n), n))

    return {
        "name": name,
        "s": s,
        "t": t,
        "time": f"{t // 60:02d}:{t % 60:02d}",
        "place": place,
        "title": grade(s),
        "depts": depts,
        "d": d,
        "v": "".join(ch for ch in q.get("v", "") if ch.isalnum())[:8],
    }


def query_of(r):
    """Зворотне до parse(): параметри посилання для результату r."""
    q = {"s": r["s"], "t": r["t"]}
    if r["place"]:
        q["p"] = "out" if r["place"].startswith("поза") else r["place"].replace(" із ", "-")
    if r["d"]:
        q["d"] = r["d"]
    q["u"] = base64.urlsafe_b64encode(r["name"].encode("utf-8")).decode().rstrip("=")
    if r.get("v"):
        q["v"] = r["v"]
    return urlencode(q, quote_via=quote)


# ---------- шрифти ----------
_fonts = {}


def font(name, size):
    """Шрифт потрібного розміру (з кешем). Файл — з папки fonts/ або, як запасний варіант, з сайту гри."""
    from PIL import ImageFont

    key = (name, size)
    if key in _fonts:
        return _fonts[key]
    path = None
    for d in FONT_DIRS:
        p = os.path.join(d, name)
        if os.path.exists(p):
            path = p
            break
    if not path:
        os.makedirs("/tmp/bl-fonts", exist_ok=True)
        path = os.path.join("/tmp/bl-fonts", name)
        with urlopen(FONT_URL + name, timeout=8) as r, open(path, "wb") as f:
            f.write(r.read())
    _fonts[key] = ImageFont.truetype(path, size)
    return _fonts[key]


def fit(draw, text, fname, size, max_w, min_size=18):
    """Зменшує шрифт, доки текст не влізе в max_w; якщо й так не влазить — обрізає з «…»."""
    while size > min_size and draw.textlength(text, font=font(fname, size)) > max_w:
        size -= 2
    f = font(fname, size)
    if draw.textlength(text, font=f) > max_w:
        while len(text) > 1 and draw.textlength(text + "…", font=f) > max_w:
            text = text[:-1]
        text += "…"
    return text, f


# ---------- картинка 1200×630 ----------
def render(r):
    """Малює PNG 1200×630 з результатом r і повертає його байти."""
    from PIL import Image, ImageDraw, ImageFilter

    # малюємо вдвічі більше й зменшуємо — так лінії й літери гладкі
    W, H, S = 1200, 630, 2
    img = Image.new("RGB", (W * S, H * S), "#ffffff")
    d = ImageDraw.Draw(img)

    def X(v):
        """Координата макета → піксель полотна."""
        return int(v * S)

    # сітка на фоні
    for x in range(0, W + 1, 50):
        d.line([(X(x), 0), (X(x), X(H))], fill="#eef0f3", width=S)
    for y in range(0, H + 1, 50):
        d.line([(0, X(y)), (X(W), X(y))], fill="#eef0f3", width=S)

    # графік зростання внизу
    pts = [
        (0, 600),
        (90, 585),
        (160, 594),
        (250, 560),
        (330, 572),
        (420, 530),
        (500, 545),
        (600, 505),
        (680, 520),
        (770, 480),
        (860, 498),
        (950, 455),
        (1050, 470),
        (1200, 430),
    ]
    shade = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ImageDraw.Draw(shade).polygon(
        [(X(a), X(b)) for a, b in pts] + [(X(W), X(H)), (0, X(H))], fill=(245, 184, 61, 40)
    )
    img.paste(shade, (0, 0), shade)
    d.line([(X(a), X(b)) for a, b in pts], fill="#d9b56a", width=X(3), joint="curve")

    # смуга кольорів кафедр
    seg = W / 5
    for i, dep in enumerate(DEPTS):
        d.rectangle([X(i * seg), 0, X((i + 1) * seg) + 1, X(12)], fill=dep[2])

    # ліва колонка: логотип, ім'я, бал, звання
    for x, top, a in ((64, 66, 1), (80, 50, 1), (96, 76, 0.6)):
        col = YELLOW if a == 1 else "#f9d48b"
        d.rounded_rectangle([X(x), X(top), X(x + 11), X(100)], radius=X(3), fill=col)
    f = font(UNB_B, X(44))
    d.text((X(122), X(101)), "BUSINESS", font=f, fill=BLUE, anchor="ls")
    d.text(
        (X(122) + d.textlength("BUSINESS ", font=f), X(101)),
        "LAB",
        font=f,
        fill=YELLOW,
        anchor="ls",
    )
    d.text(
        (X(64), X(136)),
        "Факультет бізнес-технологій та економіки",
        font=font(MAN_SB, X(20)),
        fill=MUTED,
        anchor="ls",
    )

    d.text(
        (X(64), X(198)),
        "М І Й   Р Е З У Л Ь Т А Т",
        font=font(MONO, X(16)),
        fill=MUTED,
        anchor="ls",
    )
    name, f = fit(d, r["name"], MAN_XB, X(40), X(560), X(26))
    d.text((X(64), X(244)), name, font=f, fill=TEXT, anchor="ls")

    f = font(UNB_B, X(170))
    sc = str(r["s"])
    d.text((X(58), X(432)), sc, font=f, fill=GOLD, anchor="ls")
    d.text(
        (X(58) + d.textlength(sc, font=f) + X(10), X(432)),
        "/ 10",
        font=font(UNB, X(56)),
        fill=MUTED,
        anchor="ls",
    )
    title, f = fit(d, r["title"], UNB, X(34), X(560), X(20))
    d.text((X(64), X(494)), title, font=f, fill=TEXT, anchor="ls")

    # права картка
    cx, cy, cw, ch = 652, 70, 500, 470
    sh = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle(
        [X(cx), X(cy + 14), X(cx + cw), X(cy + ch + 14)], radius=X(28), fill=(17, 22, 32, 40)
    )
    sh = sh.filter(ImageFilter.GaussianBlur(X(18)))
    img.paste(sh, (0, 0), sh)
    d.rounded_rectangle(
        [X(cx), X(cy), X(cx + cw), X(cy + ch)],
        radius=X(28),
        fill="#ffffff",
        outline="#e3e5e9",
        width=X(2),
    )

    px = cx + 34
    chip_x = px

    def chip(label, value):
        nonlocal chip_x
        fl = font(MAN_SB, X(19))
        fv = font(MONO, X(22))
        w = (d.textlength(label, font=fl) + d.textlength(value, font=fv)) / S + 50
        d.rounded_rectangle(
            [X(chip_x), X(cy + 32), X(chip_x + w), X(cy + 82)],
            radius=X(14),
            fill="#f5f6f8",
            outline="#e3e5e9",
            width=X(2),
        )
        d.text((X(chip_x + 16), X(cy + 64)), label, font=fl, fill=MUTED, anchor="ls")
        d.text(
            (X(chip_x + 16) + d.textlength(label, font=fl) + X(9), X(cy + 65)),
            value,
            font=fv,
            fill=TEXT,
            anchor="ls",
        )
        chip_x += w + 12

    chip("Час", r["time"])
    if r["place"]:
        chip("Місце", r["place"])

    # результат по кафедрах
    y = cy + 136
    rows = r["depts"] or []
    step = 52 if len(rows) <= 5 else 44
    for (code, dname, col, tcol), ok, n in rows:
        fc = font(MONO, X(16))
        pw = max(d.textlength(code, font=fc) / S + 22, 56)
        d.rounded_rectangle([X(px), X(y - 22), X(px + pw), X(y + 6)], radius=X(14), fill=col)
        d.text((X(px + pw / 2), X(y - 8)), code, font=fc, fill=tcol, anchor="mm")
        nm, f = fit(d, dname, MAN_SB, X(19), X(cw - 68 - pw - 14 - 78), X(14))
        d.text((X(px + pw + 14), X(y)), nm, font=f, fill=TEXT, anchor="ls")
        d.text(
            (X(cx + cw - 34), X(y)),
            f"{ok}/{n}",
            font=font(MONO, X(22)),
            fill="#16a34a" if ok == n else TEXT,
            anchor="rs",
        )
        y += step

    # підвал картки
    d.line(
        [(X(px), X(cy + ch - 78)), (X(cx + cw - 34), X(cy + ch - 78))],
        fill="#eceef1",
        width=X(2),
    )
    d.text(
        (X(cx + cw / 2), X(cy + ch - 30)),
        "А який результат буде у тебе?",
        font=font(MAN_XB, X(22)),
        fill=TEXT,
        anchor="ms",
    )

    img = img.resize((W, H), Image.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, "PNG", optimize=True)
    return buf.getvalue()


def page(r, base):
    """HTML для роботів соцмереж: заголовок, опис і og:image з картинкою результату."""
    q = query_of(r)
    img = f"{base}/card?{q}"
    title = f"{r['name']} — {r['s']}/10 за {r['time']} · «{r['title']}»"
    desc = f"Місце в рейтингу: {r['place']}. " if r["place"] else ""
    desc += "🔥 А який результат буде у тебе? Перевір свої знання та випробуй себе в BUSINESS LAB!"

    def e(text):
        return escape(text, quote=True)

    return """<!doctype html><html lang="uk"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{t}</title>
<meta name="description" content="{d}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="BUSINESS LAB">
<meta property="og:title" content="{t}">
<meta property="og:description" content="{d}">
<meta property="og:url" content="{u}">
<meta property="og:image" content="{i}">
<meta property="og:image:type" content="image/png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="{i}">
</head><body style="font-family:sans-serif;text-align:center;padding:40px">
<p><img src="{i}" alt="" style="max-width:100%;border-radius:12px"></p>
<p><a href="{g}">Перейти до гри BUSINESS LAB →</a></p>
<script>location.replace({gj});</script>
</body></html>""".format(
        t=e(title),
        d=e(desc),
        u=e(base + "/r?" + q),
        i=e(img),
        g=e(GAME_URL),
        gj='"' + GAME_URL + '"',
    )


# Хто читає прев'ю (Facebook, Telegram тощо) — отримує сторінку з og:image.
# Людина, що натиснула посилання, одразу йде на гру (302).
# Мета-refresh не використовуємо: Facebook іде за ним і бере прев'ю вже з сайту гри.
BOTS = (
    "facebookexternalhit",
    "facebot",
    "meta-externalagent",
    "telegrambot",
    "twitterbot",
    "whatsapp",
    "slackbot",
    "discordbot",
    "linkedinbot",
    "viber",
    "vkshare",
    "pinterest",
    "skypeuripreview",
    "redditbot",
    "applebot",
    "googlebot",
    "bingbot",
    "embedly",
    "iframely",
    "bot",
    "crawler",
    "spider",
    "preview",
)


def is_bot(ua):
    """Чи це робот, що збирає прев'ю посилання (а не людина)."""
    ua = (ua or "").lower()
    return not ua or any(b in ua for b in BOTS)


class handler(BaseHTTPRequestHandler):
    """Точка входу функції Vercel (ім'я класу має бути саме handler)."""

    def do_GET(self):
        u = urlparse(self.path)
        q = parse_qs(u.query)
        r = parse(u.query)
        host = self.headers.get("x-forwarded-host") or self.headers.get("host") or "localhost"
        base = "https://" + host
        path = u.path.rstrip("/")

        try:
            if q.get("fb", [""])[0] == "1" or path.endswith("/fb"):
                # Facebook з телефона: перехід через переадресацію з нашого домену відкриває
                # вікно допису на сайті Facebook (пряме посилання iPhone віддає застосунку).
                link = f"{base}/r?{query_of(r)}"
                share = urlencode({"u": link, "hashtag": FB_HASHTAGS}, quote_via=quote)
                self._redirect("https://www.facebook.com/sharer/sharer.php?" + share)
                return

            if q.get("img", [""])[0] == "1" or path.endswith("/card"):
                body = render(r)
                ctype = "image/png"
            elif not is_bot(self.headers.get("user-agent")):
                # людина натиснула посилання — одразу на гру
                self._redirect(GAME_URL, vary=True)
                return
            else:
                body = page(r, base).encode("utf-8")
                ctype = "text/html; charset=utf-8"
        except Exception:  # noqa: BLE001 — будь-яка помилка: віддаємо загальну картинку гри
            self._redirect(GAME_URL + "img/og.jpg", cache=False)
            return

        if ctype == "image/png":
            cache = "public, max-age=86400, s-maxage=31536000, immutable"
        else:
            cache = "no-store"
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Cache-Control", cache)
        self.send_header("Vary", "User-Agent")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_HEAD(self):
        self.do_GET()

    def _redirect(self, location, vary=False, cache=True):
        """Відповідь 302 на іншу адресу."""
        self.send_response(302)
        self.send_header("Location", location)
        if cache:
            self.send_header("Cache-Control", "no-store")
        if vary:
            self.send_header("Vary", "User-Agent")
        self.end_headers()
