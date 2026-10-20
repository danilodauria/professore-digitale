#!/bin/bash
# Esegue tutti i test automatici del Professore Digitale.
# Richiede: python3, node, playwright (python) con Chromium.   Uso: tests/esegui_test.sh
set -uo pipefail
cd "$(dirname "$0")/.."
T=$(mktemp -d); PIDS=()
fine() { for p in "${PIDS[@]}"; do kill "$p" 2>/dev/null; done; rm -rf "$T"; }
trap fine EXIT
ESITO=0

echo "== 1. Formato dei pacchetti di contenuti"
python3 tests/test_packs.py || ESITO=1
echo "== 1a1. Nonni Teach (interviste, trasferimento dal Consulente, sito e feed del podcast)"
python3 tests/test_nonni.py || ESITO=1
echo "== 1a. Licenze (codice MIT, contenuti CC BY-NC-SA 4.0)"
python3 tests/test_licenza.py || ESITO=1
echo "== 1a2. Pacchetto .deb (se già compilato in dist/)"
D="dist/professore-digitale_$(cat VERSION)_all.deb"; if [ -f "$D" ]; then python3 tests/test_deb.py "$D" || ESITO=1; else echo "  (nessun .deb della versione $(cat VERSION) in dist/: lo prova build.sh a ogni compilazione)"; fi
echo "== 1a3. Versione per macOS (voci del Mac, aggiornamenti, app nello zip se compilata)"
timeout 300 python3 tests/test_mac.py || ESITO=1
echo "== 1b. Voci naturali incluse (Piper)"
python3 tests/test_voci.py || ESITO=1

echo "== 2. Sito di aggiornamenti simulato"
mkdir -p "$T/sito/contenuti" "$T/home/Scaricati"
python3 - "$T/sito" <<'PY'
import hashlib, json, os, sys
d = sys.argv[1]
deb = b"finto pacchetto per i test" * 100
open(os.path.join(d, "professore-digitale_9.9.9_all.deb"), "wb").write(deb)
exe = b"finto installatore per Windows" * 100
open(os.path.join(d, "ProfessoreDigitale-Setup-9.9.9.exe"), "wb").write(exe)
p = json.load(open("tests/dati/pacchetto-prova.json", encoding="utf-8"))
p["id"] = "prova-remota"; p["titolo"] = "Contenuti remoti di prova"; p["versione"] = "2.0.0"
p["domande"][0]["domanda"] = "Domanda remota di prova"; p["domande"][0]["parole_chiave"] = ["remota di prova"]
p["lezioni"][0]["id"] = "prova-remota-lezione"
raw = json.dumps(p, ensure_ascii=False).encode()
open(os.path.join(d, "contenuti", "prova-remota.json"), "wb").write(raw)
info = {"versione": "9.9.9", "data": "2030-01-01", "note": ["Nota di prova 1", "Nota di prova 2"],
        "pacchetto": "professore-digitale_9.9.9_all.deb", "sha256": hashlib.sha256(deb).hexdigest(),
        "windows": {"pacchetto": "ProfessoreDigitale-Setup-9.9.9.exe", "sha256": hashlib.sha256(exe).hexdigest()},
        "contenuti": [{"id": "prova-remota", "titolo": p["titolo"], "versione": "2.0.0", "url": "contenuti/prova-remota.json",
                       "sha256": hashlib.sha256(raw).hexdigest()}]}
json.dump(info, open(os.path.join(d, "aggiornamenti.json"), "w"), ensure_ascii=False)
PY
python3 -m http.server 18991 --bind 127.0.0.1 --directory "$T/sito" >/dev/null 2>&1 & PIDS+=($!)
python3 tests/mock_ollama.py 18992 >/dev/null 2>&1 & PIDS+=($!)
HOME="$T/home" PD_DATA_DIR="$T/dati" OLLAMA_HOST=http://127.0.0.1:18992 PD_AULA_PORT=18966 PD_AULA_UDP=18967 PD_TABLET_PORT=18968 PD_TABLET_LOOPBACK=1 \
  python3 -B src/server/pd_server.py --port 18990 --idle-timeout 0 >"$T/server.log" 2>&1 & PIDS+=($!)
sleep 2

echo "== 3. Interfaccia completa (applicazione installabile)"
PD_TEST_SITO=http://127.0.0.1:18991 PD_TEST_HOME="$T/home" \
  timeout 900 python3 tests/test_ui.py http://127.0.0.1:18990 "$T/shots" http://127.0.0.1:18992 || ESITO=1

echo "== 4. Versione portatile"
python3 tools/make_standalone.py src/web "$T/portatile.html" >/dev/null
timeout 900 python3 tests/test_ui.py "file://$T/portatile.html" "$T/shots2" || ESITO=1

echo "== 4b. App per telefono e tablet (PWA, offline)"
timeout 900 python3 tests/test_pwa.py "$T/shots-pwa" || ESITO=1

echo "== 4c. Pubblicazione su GitHub (Release + sito)"
timeout 300 python3 tests/test_github.py || ESITO=1

echo "== 5. Versione per Windows (server nativo in Wine)"
if command -v wine >/dev/null && command -v i686-w64-mingw32-gcc >/dev/null; then
  tests/test_windows.sh "$T" || ESITO=1
else
  echo "  (saltato: servono wine e mingw-w64, vedi tools/prepara-ambiente.sh)"
fi

[ "$ESITO" = 0 ] && echo "✔ TUTTI I TEST SUPERATI" || { echo "✘ ALCUNI TEST NON SONO PASSATI"; tail -20 "$T/server.log"; }
exit $ESITO
