#!/usr/bin/env python3
"""Prova il .deb VERO (dalla 3.5.3): lo estrae in una cartella temporanea, avvia il server
installato (/usr/share/professore-digitale/server/pd_server.py) e controlla che risponda.
Nella 3.5.2 il .deb non conteneva pd_tablet.py e il server non partiva: questo test lo impedisce.
Uso: tests/test_deb.py dist/professore-digitale_X.Y.Z_all.deb [porta]"""
import json, os, re, subprocess, sys, tempfile, time, urllib.request

deb = sys.argv[1]
porta = int(sys.argv[2]) if len(sys.argv) > 2 else 18994
radice = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
with tempfile.TemporaryDirectory() as t:
    subprocess.check_call(["dpkg-deb", "-x", deb, os.path.join(t, "root")])
    share = os.path.join(t, "root", "usr", "share", "professore-digitale")
    srv = os.path.join(share, "server")
    errori = []
    # 1. ogni modulo del server dei sorgenti deve stare nel pacchetto
    for f in sorted(os.listdir(os.path.join(radice, "src", "server"))):
        if f.endswith(".py") and not os.path.exists(os.path.join(srv, f)):
            errori.append("manca server/" + f)
    for m in re.findall(r"^import (pd_\w+)", open(os.path.join(srv, "pd_server.py"), encoding="utf-8").read(), re.M):
        if not os.path.exists(os.path.join(srv, m + ".py")):
            errori.append("pd_server.py importa %s ma il pacchetto non lo contiene" % m)
    # 2. il server installato deve partire e rispondere
    env = dict(os.environ, HOME=os.path.join(t, "home"), PD_DATA_DIR=os.path.join(t, "dati"))
    os.makedirs(env["HOME"])
    log = open(os.path.join(t, "server.log"), "w")
    p = subprocess.Popen([sys.executable, "-B", os.path.join(srv, "pd_server.py"), "--port", str(porta), "--idle-timeout", "0"],
                         env=env, stdout=log, stderr=subprocess.STDOUT)
    stato = None
    try:
        for _ in range(40):
            if p.poll() is not None:
                break
            try:
                stato = json.load(urllib.request.urlopen("http://127.0.0.1:%d/api/status" % porta, timeout=2))
                break
            except Exception:
                time.sleep(0.25)
        if stato is None:
            log.flush()
            errori.append("il server del .deb non si avvia:\n" + open(log.name).read()[-2000:])
        else:
            pagina = urllib.request.urlopen("http://127.0.0.1:%d/" % porta, timeout=5).read().decode("utf-8", "replace")
            ver = open(os.path.join(share, "VERSION")).read().strip()
            if stato.get("version") != ver and stato.get("versione") != ver:
                errori.append("versione inattesa in /api/status: %r (attesa %s)" % (stato.get("version") or stato.get("versione"), ver))
            if "licenza.js" not in pagina:
                errori.append("la pagina principale servita dal .deb non è quella attesa")
    finally:
        p.terminate()
        try:
            p.wait(5)
        except Exception:
            p.kill()
    if errori:
        print("✘ .deb: " + "\n✘ ".join(errori))
        sys.exit(1)
    print("✔ .deb: tutti i moduli del server presenti, il server installato parte e risponde (versione %s)" % ver)
