#!/usr/bin/env python3
"""Professore Digitale - disegna la copertina del podcast «Nonni Teach» (dalla 3.6).

Spotify e Apple Podcasts vogliono un'immagine quadrata da 1400 a 3000 pixel (JPEG o PNG, RGB):
qui 3000x3000, con Neura (il cervello di neuroni luminosi che conduce le interviste) e un microfono.
Uscita: src/web/img/nonni-teach/copertina.jpg (il sito del podcast la copia e il feed RSS la indica).
Serve Pillow (solo per chi sviluppa: il programma usa il file già pronto). Dopo: tools/licenza-immagini.py
Uso: python3 tools/copertina-nonni.py [USCITA]
Autore: Danilo D'Auria - Codice MIT, immagine CC BY-NC-SA 4.0"""
import math
import os
import random
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

QUI = os.path.dirname(os.path.abspath(__file__))
USCITA = sys.argv[1] if len(sys.argv) > 1 else os.path.join(QUI, "..", "src", "web", "img", "nonni-teach", "copertina.jpg")
L = 3000
FONT = ["/usr/share/fonts/truetype/google-fonts/Poppins-Bold.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"]
FONT_R = ["/usr/share/fonts/truetype/google-fonts/Poppins-Medium.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"]


def font(lista, size):
    for f in lista:
        if os.path.isfile(f):
            return ImageFont.truetype(f, size)
    return ImageFont.load_default()


def cervello(n, seme=7):
    """Stessa geometria di neura.js: punti sulla sfera con pieghe, due emisferi, cervelletto."""
    random.seed(seme)
    punti, oro = [], math.pi * (3 - math.sqrt(5))
    for i in range(n):
        y = 1 - (i / (n - 1)) * 2
        r = math.sqrt(max(0, 1 - y * y))
        th = oro * i
        sx, sy, sz = math.cos(th) * r, y, math.sin(th) * r
        if abs(sx) < 0.06:
            continue
        p = 1 + 0.05 * math.sin(11 * sy + 7 * sz) + 0.035 * math.sin(13 * sz - 5 * sx) + 0.025 * math.sin(17 * sx + 9 * sy)
        X = (sx + (0.09 if sx > 0 else -0.09)) * 0.95 * p
        Y = sy * 0.8 * p
        Z = sz * 1.2 * p
        if Y < -0.32:
            Y = -0.32 + (Y + 0.32) * 0.35
        Y -= 0.1 * max(0, Z)
        punti.append((X, Y + 0.12, Z))
    for _ in range(int(n * 0.12)):
        u, v = random.random() * 2 * math.pi, math.acos(2 * random.random() - 1)
        punti.append((math.sin(v) * math.cos(u) * 0.55, -0.4 + math.sin(v) * math.sin(u) * 0.2, -0.95 + math.cos(v) * 0.28))
    return punti


def main():
    img = Image.new("RGB", (L, L), (6, 11, 26))
    # sfondo: due bagliori morbidi (azzurro e viola)
    alone = Image.new("RGB", (L, L), (0, 0, 0))
    d = ImageDraw.Draw(alone)
    d.ellipse((450, 250, 2550, 2050), fill=(30, 110, 170))
    d.ellipse((1500, 1500, 3300, 3300), fill=(90, 50, 150))
    alone = alone.filter(ImageFilter.GaussianBlur(420))
    img = Image.blend(img, alone, 0.55)

    # Neura: proiezione 3D dei neuroni, ruotata di tre quarti
    strato = Image.new("RGBA", (L, L), (0, 0, 0, 0))
    d = ImageDraw.Draw(strato)
    pts = cervello(900)
    a, b = 0.65, -0.22
    ca, sa, cb, sb = math.cos(a), math.sin(a), math.cos(b), math.sin(b)
    cx, cy, scala = L / 2, 1080, 760
    pr = []
    for x, y, z in pts:
        x1, z1 = x * ca - z * sa, x * sa + z * ca
        y2, z2 = y * cb - z1 * sb, y * sb + z1 * cb
        f = 3.2 / (3.2 + z2)
        pr.append((cx + x1 * scala * f, cy - y2 * scala * f, z2, f))
    # collegamenti con i 3 vicini
    for i, p in enumerate(pr):
        vicini = sorted(range(len(pr)), key=lambda j: (pts[i][0] - pts[j][0]) ** 2 + (pts[i][1] - pts[j][1]) ** 2 + (pts[i][2] - pts[j][2]) ** 2)[1:4]
        for j in vicini:
            dist = sum((pts[i][k] - pts[j][k]) ** 2 for k in range(3))
            if dist < 0.12:
                q = pr[j]
                prof = max(0.1, min(1, (2 - (p[2] + q[2]) / 2) / 3.2))
                d.line((p[0], p[1], q[0], q[1]), fill=(120, 210, 255, int(150 * prof)), width=4)
    for x, y, z, f in pr:
        dep = max(0.15, min(1, (1.6 - z) / 3 * 1.2))
        r = 7 * f * (0.7 + dep)
        d.ellipse((x - r, y - r, x + r, y + r), fill=(170, 230, 255, int(255 * dep)))
    bagliore = strato.filter(ImageFilter.GaussianBlur(18))
    img = img.convert("RGBA")
    img.alpha_composite(bagliore)
    img.alpha_composite(strato)
    # impulsi luminosi
    luci = Image.new("RGBA", (L, L), (0, 0, 0, 0))
    dl = ImageDraw.Draw(luci)
    random.seed(3)
    centri = [random.choice(pr) for _ in range(18)]
    for x, y, z, f in centri:
        dl.ellipse((x - 30, y - 30, x + 30, y + 30), fill=(255, 220, 140, 200))
    img.alpha_composite(luci.filter(ImageFilter.GaussianBlur(22)))
    d = ImageDraw.Draw(img)
    for x, y, z, f in centri:
        d.ellipse((x - 9, y - 9, x + 9, y + 9), fill=(255, 250, 230, 255))
    # anello olografico
    d.ellipse((cx - 1150, cy + 330, cx + 1150, cy + 640), outline=(120, 210, 255, 150), width=10)

    # microfono stilizzato davanti al cervello
    m = Image.new("RGBA", (L, L), (0, 0, 0, 0))
    dm = ImageDraw.Draw(m)
    mx, my = cx, 1470
    dm.rounded_rectangle((mx - 150, my - 330, mx + 150, my + 130), radius=150, fill=(251, 191, 36, 255))
    for k in range(-2, 3):
        dm.line((mx - 110, my - 200 + k * 60, mx + 110, my - 200 + k * 60), fill=(180, 120, 10, 255), width=14)
    dm.arc((mx - 260, my - 230, mx + 260, my + 280), 0, 180, fill=(251, 191, 36, 255), width=34)
    dm.line((mx, my + 280, mx, my + 400), fill=(251, 191, 36, 255), width=34)
    dm.rounded_rectangle((mx - 170, my + 390, mx + 170, my + 430), radius=20, fill=(251, 191, 36, 255))
    img.alpha_composite(m.filter(ImageFilter.GaussianBlur(30)))
    img.alpha_composite(m)

    # testi
    d = ImageDraw.Draw(img)
    titolo = font(FONT, 380)
    w = d.textlength("NONNI TEACH", font=titolo)
    d.text(((L - w) / 2 + 8, 2060 + 8), "NONNI TEACH", font=titolo, fill=(0, 0, 0, 160))
    d.text(((L - w) / 2, 2060), "NONNI TEACH", font=titolo, fill=(240, 248, 255, 255))
    sotto = font(FONT_R, 150)
    t = "I nonni insegnano"
    w = d.textlength(t, font=sotto)
    d.text(((L - w) / 2, 2520), t, font=sotto, fill=(125, 211, 252, 255))
    piede = font(FONT_R, 74)
    t = "Interviste di Neura · Professore Digitale · CC BY-NC-SA 4.0"
    w = d.textlength(t, font=piede)
    d.text(((L - w) / 2, 2800), t, font=piede, fill=(159, 179, 207, 255))

    os.makedirs(os.path.dirname(os.path.abspath(USCITA)), exist_ok=True)
    img.convert("RGB").save(USCITA, "JPEG", quality=86, optimize=True, progressive=False)
    print("copertina:", USCITA, os.path.getsize(USCITA), "byte")


if __name__ == "__main__":
    main()
