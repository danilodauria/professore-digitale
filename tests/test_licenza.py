#!/usr/bin/env python3
"""Licenze (dalla 3.5.2): codice MIT, contenuti CC BY-NC-SA 4.0 dappertutto (Linux, Windows, sito, vademecum, immagini, pacchetti).
Uso: python3 tests/test_licenza.py   (lo chiama tests/esegui_test.sh). Autore: Danilo D'Auria - Codice MIT, contenuti CC BY-NC-SA 4.0"""
import glob, json, os, re, subprocess, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ok = True
def check(nome, cond, det=""):
    global ok
    print(("  OK  " if cond else "  FAIL") + " " + nome + ("" if cond else "  -> %s" % det))
    ok = ok and cond
def leggi(p):
    with open(os.path.join(ROOT, p), encoding="utf-8") as f:
        return f.read()
CC = "CC BY-NC-SA 4.0"

lic = leggi("LICENSE")
check("LICENSE: MIT per il codice, rimanda ai contenuti", "MIT License" in lic and "LICENZA-CONTENUTI.md" in lic)
lc = leggi("LICENZA-CONTENUTI.md")
check("LICENZA-CONTENUTI.md: CC BY-NC-SA 4.0, autore e citazione",
      CC in lc and "Danilo D'Auria" in lc and "legalcode.it" in lc and "danilodauria.github.io/professore-digitale" in lc)
cp = leggi("packaging/copyright")
check("Debian copyright: blocco CC-BY-NC-SA-4.0 per contenuti e testo della licenza",
      "License: CC-BY-NC-SA-4.0\n" in cp and "usr/share/professore-digitale/contenuti/*" in cp and cp.count("CC-BY-NC-SA-4.0") >= 2)
b = leggi("build.sh")
check("Debian: LICENSE e LICENZA-CONTENUTI.md installati in /usr/share/doc", "LICENZA-CONTENUTI.md" in b and '"$S/doc/$PKG/LICENSE"' in b)
check("AppStream: licenza del progetto doppia", "<project_license>MIT AND CC-BY-NC-SA-4.0</project_license>" in leggi("packaging/io.github.danilodauria.ProfessoreDigitale.metainfo.xml"))
check("manuale (man): doppia licenza", "BY-NC-SA 4.0" in leggi("packaging/professore-digitale.1"))
w = leggi("windows/LICENZE.txt")
check("Windows: LICENZE.txt con CC BY-NC-SA 4.0 e MIT", "CC BY-NC-SA 4.0" in w and "LICENZA MIT" in w and "Danilo D'Auria" in w)
nsi = leggi("windows/installer/professore-digitale.nsi")
check("Windows: l'installatore mostra la doppia licenza", "CC BY-NC-SA 4.0" in nsi and "Licenza MIT\"" not in nsi)
check("Windows: proprietà dell'eseguibile con la doppia licenza", "CC BY-NC-SA 4.0" in leggi("windows/res/app.rc.in"))
check("Windows: LEGGIMI con la doppia licenza", "BY-NC-SA 4.0" in leggi("windows/LEGGIMI.txt"))
sito = leggi("tools/sito/pagina.html")
check("sito: sezione licenza, rel=license e citazione", 'id="licenza"' in sito and 'rel="license"' in sito and "«Professore Digitale" in sito)
check("README: doppia licenza", CC in leggi("README.md") and "LICENZA-CONTENUTI.md" in leggi("README.md"))

# vademecum e libretti: sorgenti e PDF
for s in ("vademecum-linux.html", "vademecum-windows.html"):
    h = leggi("docs/sorgenti/" + s)
    check("vademecum %s: capitolo sulla licenza e copertina" % s, "Licenza e diritti d'autore" in h and "Contenuti CC BY-NC-SA 4.0" in h and "Software libero · MIT<" not in h)
for pdf in ("Vademecum_Professore_Digitale.pdf", "Vademecum_Professore_Digitale_Windows.pdf"):
    p = os.path.join(ROOT, "docs", pdf)
    info = subprocess.run(["pdfinfo", p], capture_output=True, text=True).stdout
    testo = subprocess.run(["pdftotext", "-l", "6", p, "-"], capture_output=True, text=True).stdout
    check("PDF %s: autore e licenza nelle proprietà e nel piè di pagina" % pdf,
          "Danilo D'Auria" in info and "BY-NC-SA" in info and "BY-NC-SA 4.0" in testo, info[:200])

# immagini del progetto: autore e licenza nei metadati
r = subprocess.run([sys.executable, os.path.join(ROOT, "tools", "licenza-immagini.py"), "--controlla"], capture_output=True, text=True)
check("immagini: autore e licenza scritti dentro ogni immagine", r.returncode == 0, (r.stdout + r.stderr)[-400:])

# pacchetti del progetto
for f in sorted(glob.glob(os.path.join(ROOT, "src", "contenuti", "*.json")) + glob.glob(os.path.join(ROOT, "windows", "contenuti", "*.json"))):
    p = json.load(open(f, encoding="utf-8"))
    check("pacchetto %s: licenza %s" % (p["id"], CC), p.get("licenza") == CC and p.get("autore") == "Danilo D'Auria", p.get("licenza"))

# interfaccia: niente più «Licenza MIT» da solo nei testi visibili (i commenti in testa ai file restano)
vecchi = []
for f in glob.glob(os.path.join(ROOT, "src", "web", "js", "*.js")) + [os.path.join(ROOT, "src", "web", "index.html")]:
    for n, riga in enumerate(open(f, encoding="utf-8"), 1):
        s = riga.strip()
        if s.startswith(("*", "/*", "//", "#", "Codice:")):
            continue
        if re.search(r"[Ll]icenza MIT(?! ·| e| per)|\(licenza MIT\)|MIT \(software libero\)</dd>", s) and "BY-NC-SA" not in s:
            vecchi.append("%s:%d" % (os.path.relpath(f, ROOT), n))
check("interfaccia: ogni menzione della licenza cita anche i contenuti CC BY-NC-SA 4.0", not vecchi, vecchi[:10])
stampe = []
for f in glob.glob(os.path.join(ROOT, "src", "web", "js", "*.js")):
    if f.endswith("licenza.js"):
        continue   # qui si definisce PD.piedeStampa
    t = open(f, encoding="utf-8").read()
    for m in re.finditer(r'<footer class="p-piede">', t):
        riga = t[m.start():t.find("\n", m.start())]
        if "licenza" not in riga.lower() and "PD.licenzaBreve" not in riga:
            stampe.append(os.path.relpath(f, ROOT))
check("stampe: ogni piè di pagina riporta la licenza (PD.piedeStampa o PD.licenzaBreve)", not stampe, stampe)

print("✔ licenze a posto" if ok else "✘ licenze da sistemare")
sys.exit(0 if ok else 1)
