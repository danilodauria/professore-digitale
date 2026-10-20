#!/usr/bin/env python3
"""Prove della versione per macOS (senza un Mac):
- voci del Mac (comando «say», qui finto) nell'elenco e nella sintesi;
- aggiornamenti: sul Mac si scarica lo zip indicato in «mac» di aggiornamenti.json, nella cartella Downloads;
- se c'è dist/ProfessoreDigitale-X.Y.Z-macOS.zip: struttura dell'app e avvio vero del suo server.
Uso: python3 tests/test_mac.py        Autore: Danilo D'Auria - Licenza MIT"""
import hashlib, http.server, json, os, plistlib, socketserver, stat, subprocess, sys, tempfile, threading, time, urllib.request, zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
T = tempfile.mkdtemp()
os.environ["PD_DATA_DIR"] = os.path.join(T, "dati")
os.environ["XDG_RUNTIME_DIR"] = os.path.join(T, "run"); os.makedirs(os.environ["XDG_RUNTIME_DIR"])
sys.path.insert(0, os.path.join(ROOT, "src", "server"))
import pd_server as S   # noqa: E402

risultati = []


def check(nome, ok, dettaglio=""):
    risultati.append(bool(ok))
    print(("  OK  " if ok else "  FAIL") + " " + nome + ("  -> " + str(dettaglio) if dettaglio and not ok else ""))


# ---- 1. voci del Mac con un «say» finto ----
bindir = os.path.join(T, "bin"); os.makedirs(bindir)
say = os.path.join(bindir, "say")
open(say, "w").write("""#!/bin/sh
if [ "$2" = "?" ]; then
  printf 'Alice               it_IT    # Ciao! Mi chiamo Alice.\\nLuca                it_IT    # Ciao! Mi chiamo Luca.\\n'
  printf 'Samantha            en_US    # Hello, my name is Samantha.\\nFederica (Migliorata) it_IT  # Ciao! Mi chiamo Federica.\\n'
  exit 0
fi
out=""; voce=""; while [ $# -gt 0 ]; do [ "$1" = "-o" ] && out="$2"; [ "$1" = "-v" ] && voce="$2"; shift; done
echo "$voce" > "$(dirname "$out")/../voce-usata.txt" 2>/dev/null
cat > /dev/null
python3 -c "import wave,sys; w=wave.open(sys.argv[1],'wb'); w.setnchannels(1); w.setsampwidth(2); w.setframerate(22050); w.writeframes(bytes(4410)); w.close()" "$out"
""")
os.chmod(say, 0o755)
os.environ["PATH"] = bindir + os.pathsep + os.environ["PATH"]
S.MAC = True
S.STATE.pop("say_t", None)
S.STATE["piper_t"], S.STATE["piper_bin"] = time.time(), None      # niente Piper: sul Mac non c'e'
voci = {v["id"]: v for v in S.tts_voices()}
check("voci italiane del Mac nell'elenco", "say:Alice" in voci and "say:Luca" in voci and "say:Samantha" not in voci, list(voci))
check("Luca voce maschile, Alice femminile", voci.get("say:Luca", {}).get("genere") == "m" and voci.get("say:Alice", {}).get("genere") == "f")
check("voce migliorata segnata come naturale", voci.get("say:Federica (Migliorata)", {}).get("naturale") is True)
check("motore «say» tra i motori", "say" in S.tts_engines())
dati, motore = S.synthesize("Buongiorno, sono il Professore.", 1.0)
check("sintesi con say: file WAV", motore == "say" and dati[:4] == b"RIFF" and len(dati) > 44, (motore, dati[:4]))
check("il Professore parla con la voce maschile", S._ordine_voci(None, None)[0] == "say:Luca", S._ordine_voci(None, None)[:3])
check("Neura usa una voce femminile", (S.voce_neura() or "").startswith("say:") and voci[S.voce_neura()]["genere"] == "f", S.voce_neura())

# ---- 2. aggiornamenti per Mac ----
srv_dir = os.path.join(T, "srv"); os.makedirs(srv_dir)
zipdati = os.urandom(200000)
open(os.path.join(srv_dir, "ProfessoreDigitale-9.9.9-macOS.zip"), "wb").write(zipdati)
open(os.path.join(srv_dir, "professore-digitale_9.9.9_all.deb"), "wb").write(b"deb")
info = {"versione": "9.9.9", "data": "2030-01-01", "note": ["n"], "pacchetto": "professore-digitale_9.9.9_all.deb",
        "sha256": hashlib.sha256(b"deb").hexdigest(),
        "mac": {"pacchetto": "ProfessoreDigitale-9.9.9-macOS.zip", "sha256": hashlib.sha256(zipdati).hexdigest()}}
json.dump(info, open(os.path.join(srv_dir, "aggiornamenti.json"), "w"))


class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=srv_dir, **k)

    def log_message(self, *a):
        pass


httpd = socketserver.TCPServer(("127.0.0.1", 0), H)
threading.Thread(target=httpd.serve_forever, daemon=True).start()
url = "http://127.0.0.1:%d/aggiornamenti.json" % httpd.server_address[1]
r = S.check_update(url)
check("aggiornamento: sul Mac si propone lo zip", (r["pacchetto"] or "").endswith("/ProfessoreDigitale-9.9.9-macOS.zip") and
      r["sha256"] == info["mac"]["sha256"], r["pacchetto"])
casa = os.path.join(T, "casa"); os.makedirs(os.path.join(casa, "Downloads"))
os.environ["HOME"] = casa
dest = S.scarica_pacchetto_deb(r["pacchetto"], r["sha256"])
check("zip scaricato in Downloads e verificato", dest == os.path.join(casa, "Downloads", "ProfessoreDigitale-9.9.9-macOS.zip")
      and open(dest, "rb").read() == zipdati, dest)
try:
    S.scarica_pacchetto_deb(r["pacchetto"].replace("9.9.9-macOS", "9.9.9-altro"), r["sha256"])
    check("nome di file sconosciuto rifiutato", False)
except RuntimeError:
    check("nome di file sconosciuto rifiutato", True)
del info["mac"]
json.dump(info, open(os.path.join(srv_dir, "aggiornamenti.json"), "w"))
r = S.check_update(url)
check("senza voce «mac» il Mac non scarica il .deb", r["pacchetto"] is None and r["newer"])
S.MAC = False
r = S.check_update(url)
check("su Linux resta il .deb", (r["pacchetto"] or "").endswith(".deb"))
httpd.shutdown()

# ---- 3. l'app nello zip ----
ver = open(os.path.join(ROOT, "VERSION")).read().strip()
z = os.path.join(ROOT, "dist", "ProfessoreDigitale-%s-macOS.zip" % ver)
if not os.path.isfile(z):
    print("  (nessuno zip per Mac della versione %s in dist/: lo crea build.sh)" % ver)
else:
    A = "Professore Digitale.app/Contents/"
    zf = zipfile.ZipFile(z)
    nomi = set(zf.namelist())
    servono = [A + "MacOS/avvia.sh", A + "Info.plist", A + "Resources/icona.icns", A + "Resources/app/professore-digitale",
               A + "Resources/app/server/pd_server.py", A + "Resources/app/web/index.html", A + "Resources/app/web/i18n/en.json",
               A + "Resources/app/VERSION", "LEGGIMI-MAC.txt", "LICENZE.txt"]
    mancano = [n for n in servono if n not in nomi]
    check("zip per Mac: file dell'app presenti", not mancano, mancano)
    check("zip per Mac: senza le voci Piper (solo Linux)", not any("/app/voci/" in n for n in nomi))
    eseg = (zf.getinfo(A + "MacOS/avvia.sh").external_attr >> 16) & stat.S_IXUSR
    check("zip per Mac: avvia.sh eseguibile", eseg)
    pl = plistlib.loads(zf.read(A + "Info.plist"))
    check("Info.plist: versione e programma da avviare", pl["CFBundleShortVersionString"] == ver and pl["CFBundleExecutable"] == "avvia.sh")
    check("icona .icns valida", zf.read(A + "Resources/icona.icns")[:4] == b"icns")
    # avvio vero del server contenuto nell'app (qui con il Python di Linux: lo script e' lo stesso)
    est = os.path.join(T, "app"); zf.extractall(est)
    for n in zf.infolist():
        modo = n.external_attr >> 16
        if modo:
            os.chmod(os.path.join(est, n.filename), modo & 0o777)
    avvia = os.path.join(est, A, "MacOS", "avvia.sh")
    env = dict(os.environ, HOME=casa, PD_DATA_DIR=os.path.join(T, "dati-app"), OLLAMA_HOST="http://127.0.0.1:9")
    p = subprocess.run([avvia, "--no-browser"], stdout=subprocess.PIPE, stderr=subprocess.STDOUT, env=env, timeout=90)
    indirizzo = p.stdout.decode().strip().splitlines()[-1] if p.stdout else ""
    try:
        st = json.loads(urllib.request.urlopen(indirizzo + "api/status", timeout=10).read())
        check("l'app avvia il suo server", st.get("ok") and st.get("version") == ver, st.get("version"))
        pag = urllib.request.urlopen(indirizzo + "i18n/fr.json", timeout=10).read()
        check("l'app serve i dizionari delle lingue", b'"t"' in pag)
    except Exception as e:
        check("l'app avvia il suo server", False, "%s %r" % (indirizzo, e))
    subprocess.run([avvia, "--stop"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, env=env, timeout=30)

ok = all(risultati)
print("✔ MAC: tutto a posto" if ok else "✘ MAC: ci sono errori")
sys.exit(0 if ok else 1)
