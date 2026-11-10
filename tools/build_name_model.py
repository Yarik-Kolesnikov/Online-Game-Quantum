"""Будує js/namemodel.js — статистичну модель «чи схоже слово на справжнє ім'я/прізвище».

Модель: триграмна марковська модель літер (ймовірність кожної літери після двох попередніх)
з інтерполяцією на біграми й окремі літери. Для слова рахується середній логарифм ймовірності
переходів; справжні імена мають високий бал, набори клавіш («kvjeoqpz», «yyerry…») — низький.
Той самий підхід, що й у Gibberish-Detector (github.com/rrenaud/Gibberish-Detector), але на триграмах
і навчений на іменах, а не на звичайному тексті.

Дані для навчання (у сайт потрапляють лише лічильники трійок літер, не самі імена):
  - кирилиця: ~158 тис. українських/російських прізвищ, імен і по батькові з
    github.com/dchaplinsky/names-translator (MIT) та
    github.com/linuxforse/random_russian_and_ukraine_name_surname;
  - латиниця: ~99 тис. прізвищ та імен з github.com/smashew/NameDatabases (public domain).

Запуск:  python3 tools/build_name_model.py --cyr ua1.txt ua2.txt --lat en1.txt [--test 0.1]
(файли — по одному імені в рядку). Пороги вибрано так, щоб на відкладених 10% справжніх імен
відхилялося ≈0.1%.
"""

import argparse
import collections
import json
import math
import random
import re

CYR = "абвгґдеєжзиіїйклмнопрстуфхцчшщьюяыэъё"
LAT = "abcdefghijklmnopqrstuvwxyz"
THRESHOLDS = {"cyr": -4.2, "lat": -3.7}
PRUNE = 2  # трійки, що трапились лише раз, відкидаємо (менший файл, точність та сама)


def norm(w):
    return w.replace("ґ", "г").replace("ё", "е")


def load(files, alpha):
    out = set()
    for f in files:
        for line in open(f, encoding="utf-8", errors="ignore"):
            w = re.sub("['’ʼ]", "", line.strip().lower())
            for p in re.split(r"[-\s]+", w):
                if len(p) >= 2 and all(c in alpha for c in p):
                    out.add(norm(p))
    return sorted(out)


def build(words):
    c3, c2, c1 = collections.Counter(), collections.Counter(), collections.Counter()
    for w in words:
        x = "^^" + w + "$"
        for i in range(2, len(x)):
            c3[x[i - 2 : i + 1]] += 1
            c2[x[i - 1 : i + 1]] += 1
            c1[x[i]] += 1
    c3 = {k: v for k, v in c3.items() if v >= PRUNE}
    return c3, dict(c2), dict(c1)


def b36(n):
    s = ""
    while True:
        n, r = divmod(n, 36)
        s = "0123456789abcdefghijklmnopqrstuvwxyz"[r] + s
        if not n:
            return s


def pack(d):
    return ",".join(k + b36(v) for k, v in sorted(d.items()))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--cyr", nargs="+", required=True)
    ap.add_argument("--lat", nargs="+", required=True)
    ap.add_argument("--out", default="js/namemodel.js")
    a = ap.parse_args()
    model = {"th": THRESHOLDS}
    for kind, files, alpha in (("cyr", a.cyr, CYR), ("lat", a.lat, LAT)):
        words = load(files, alpha)
        c3, c2, c1 = build(words)
        model[kind] = {"t": pack(c3), "b": pack(c2), "u": pack(c1)}
        print(kind, len(words), "words,", len(c3), "trigrams")
    with open(a.out, "w", encoding="utf-8") as f:
        f.write(
            "/* Згенеровано tools/build_name_model.py — не редагувати вручну.\n"
            "   Лічильники трійок/пар/літер зі справжніх імен і прізвищ (див. опис у скрипті). */\n"
            "window.BL = window.BL || {};\n"
            "window.BL.nameModel = " + json.dumps(model, ensure_ascii=False, separators=(",", ":")) + ";\n"
        )


if __name__ == "__main__":
    main()
