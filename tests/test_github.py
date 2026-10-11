#!/usr/bin/env python3
"""Pubblicazione su GitHub (3.5.1): tools/prepara-github.py e download del .deb a pezzi con redirect
(come fanno le Release di GitHub). Uso: tests/test_github.py   Autore: Danilo D'Auria - Licenza MIT"""
import hashlib, http.server, json, os, shutil, sys, tempfile, threading, zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "tools"))
sys.path.insert(0, os.path.join(ROOT, "src", "server"))
ESITO = [0]


def check(nome, cond):
    print(("  OK   " if cond else "  FAIL ") + nome)
    if not cond:
        ESITO[0] = 1


def sha(b):
    return hashlib.sha256(b).hexdigest()


T = tempfile.mkdtemp()
try:
    # ---- 1. prepara-github.py ----
    import importlib.util
    spec = importlib.util.spec_from_file_location("prepara_github", os.path.join(ROOT, "tools", "prepara-github.py"))
    pg = importlib.util.module_from_spec(spec); spec.loader.exec_module(pg)
    pub = os.path.join(T, "pubblica"); os.makedirs(os.path.join(pub, "contenuti")); os.makedirs(os.path.join(pub, "app"))
    ver = "9.9.9"
    grandi = {"professore-digitale_%s_all.deb" % ver: b"d" * 5000, "ProfessoreDigitale-Setup-%s.exe" % ver: b"e" * 4000,
              "professore-digitale-windows-%s.zip" % ver: b"z" * 3000}
    for n, b in grandi.items():
        open(os.path.join(pub, n), "wb").write(b)
    open(os.path.join(pub, "contenuti", "x.json"), "w").write("{}")
    open(os.path.join(pub, "app", "index.html"), "w").write("<p>app</p>")
    open(os.path.join(pub, "professore-digitale-portatile.html"), "w").write("<p>portatile</p>")
    open(os.path.join(pub, "NOTE-%s.md" % ver), "w").write("# note")
    info = {"versione": ver, "data": "2030-01-01", "note": ["n"], "pacchetto": "professore-digitale_%s_all.deb" % ver,
            "sha256": sha(grandi["professore-digitale_%s_all.deb" % ver]), "portatile": "professore-digitale-portatile.html",
            "pagina": "https://github.com/danilodauria/professore-digitale", "contenuti": [{"id": "x", "url": "contenuti/x.json"}],
            "windows": {"pacchetto": "ProfessoreDigitale-Setup-%s.exe" % ver, "sha256": "a" * 64,
                        "zip": "professore-digitale-windows-%s.zip" % ver, "zip_sha256": "b" * 64}}
    json.dump(info, open(os.path.join(pub, "aggiornamenti.json"), "w"))
    prog = "https://github.com/danilodauria/professore-digitale"
    rel, files = pg.prepara(pub, prog, "https://danilodauria.github.io/professore-digitale", os.path.join(T, "github"))
    check("cartella rilascio-%s" % ver, os.path.basename(rel) == "rilascio-%s" % ver)
    check("file grandi spostati nella Release", all(n in files for n in grandi))
    check("sito-%s.zip e note nella Release" % ver, "sito-%s.zip" % ver in files and "NOTE-%s.md" % ver in files)
    z = zipfile.ZipFile(os.path.join(rel, "sito-%s.zip" % ver))
    nomi = z.namelist()
    check("il sito NON contiene i file grandi", not any(n in nomi for n in grandi))
    check("il sito contiene pagina, app, contenuti, portatile, .nojekyll",
          all(n in nomi for n in ("index.html", "app/index.html", "contenuti/x.json", "professore-digitale-portatile.html", ".nojekyll")))
    ai = json.loads(z.read("aggiornamenti.json"))
    base = prog + "/releases/download/v%s/" % ver
    check("aggiornamenti.json: .deb dalla Release", ai["pacchetto"] == base + "professore-digitale_%s_all.deb" % ver)
    check("aggiornamenti.json: Windows dalla Release",
          ai["windows"]["pacchetto"] == base + "ProfessoreDigitale-Setup-%s.exe" % ver and ai["windows"]["zip"].startswith(base))
    check("impronte invariate", ai["sha256"] == info["sha256"] and ai["windows"]["sha256"] == "a" * 64)
    check("contenuti restano relativi", ai["contenuti"][0]["url"] == "contenuti/x.json")
    pagina = z.read("index.html").decode("utf-8")
    check("la pagina scarica dalla Release", (base + "ProfessoreDigitale-Setup-%s.exe" % ver) in pagina
          and (base + "professore-digitale_%s_all.deb" % ver) in pagina)
    check("la pagina mostra le dimensioni", "MB)" in pagina)
    check("dist/pubblica non modificata", json.load(open(os.path.join(pub, "aggiornamenti.json")))["pacchetto"] == info["pacchetto"]
          and all(os.path.isfile(os.path.join(pub, n)) for n in grandi))

    # ---- 2. download del .deb a pezzi, con redirect (come le Release di GitHub) ----
    srv_dir = os.path.join(T, "srv"); os.makedirs(srv_dir)
    deb = os.urandom(3 * 1024 * 1024 + 123)
    open(os.path.join(srv_dir, "professore-digitale_9.9.9_all.deb"), "wb").write(deb)

    class H(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *a, **k):
            super().__init__(*a, directory=srv_dir, **k)

        def log_message(self, *a):
            pass

        def do_GET(self):
            if self.path.startswith("/releases/"):
                self.send_response(302); self.send_header("Location", "/" + self.path.rsplit("/", 1)[-1]); self.end_headers()
                return
            super().do_GET()

    httpd = http.server.ThreadingHTTPServer(("127.0.0.1", 0), H)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    port = httpd.server_address[1]
    import pd_server
    scar = os.path.join(T, "Scaricati"); os.makedirs(scar)
    pd_server.cartella_download = lambda: scar
    url = "http://127.0.0.1:%d/releases/download/v9.9.9/professore-digitale_9.9.9_all.deb" % port
    dest = pd_server.scarica_pacchetto_deb(url, sha(deb))
    check("download con redirect riuscito", os.path.isfile(dest) and open(dest, "rb").read() == deb)
    os.remove(dest)
    try:
        pd_server.scarica_pacchetto_deb(url, "0" * 64); ok = False
    except RuntimeError as e:
        ok = "impronta" in str(e)
    check("impronta sbagliata: file scartato e nessun avanzo", ok and os.listdir(scar) == [])
    httpd.shutdown()
finally:
    shutil.rmtree(T, ignore_errors=True)
print("✔ PUBBLICAZIONE SU GITHUB: tutto a posto" if ESITO[0] == 0 else "✘ PUBBLICAZIONE SU GITHUB: errori")
sys.exit(ESITO[0])
