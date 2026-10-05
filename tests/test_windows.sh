#!/bin/bash
# Test della versione per Windows: compila il programma nativo e lo esegue con Wine,
# poi ripete TUTTI i test dell'interfaccia (test_ui.py) e i test specifici di Windows (test_windows_api.py).
# Uso: tests/test_windows.sh CARTELLA_TEMPORANEA   (lo chiama tests/esegui_test.sh; usa il sito
#      di prova sulla porta 18991 e la finta IA sulla 18992 avviati da quello script)
# Autore: Danilo D'Auria - Licenza MIT
set -uo pipefail
cd "$(dirname "$0")/.."
T="$1"; W="$T/win"; mkdir -p "$W/dl" "$W/shots"
export WINEDEBUG=-all WINEPREFIX="${WINEPREFIX:-$HOME/.wine-professore}"
[ -d "$WINEPREFIX" ] || wineboot -i >/dev/null 2>&1
ESITO=0

echo "  » compilazione del programma per Windows"
windows/build-windows.sh --solo-app > "$W/build.log" 2>&1 || { echo "  FAIL compilazione"; tail -20 "$W/build.log"; exit 1; }
grep "Compatibilità Windows XP" "$W/build.log" | sed 's/^/  /'
APP="$(pwd)/build/windows/app"

winpath() { echo "Z:$1" | sed 's#/#\\#g'; }
PIDW=""
avvia() {
  PD_DATA_DIR="$(winpath "$W/dati")" PD_DOWNLOAD_DIR="$(winpath "$W/dl")" OLLAMA_HOST=http://127.0.0.1:18992 \
  PD_NO_TRAY=1 PD_NO_ENGINE_START=1 wine "$APP/ProfessoreDigitale.exe" --no-browser --port 18993 --idle-timeout 0 >"$W/server.log" 2>&1 &
  PIDW=$!
  for _ in $(seq 1 120); do curl -fs http://127.0.0.1:18993/api/status >/dev/null 2>&1 && return 0; sleep 0.5; done
  echo "  FAIL il server Windows non si avvia"; cat "$W/server.log"; return 1
}
ferma() { curl -fs -X POST -H "Content-Type: application/json" -d '{}' http://127.0.0.1:18993/api/shutdown >/dev/null 2>&1; sleep 1; kill "$PIDW" 2>/dev/null; wineserver -k 2>/dev/null; true; }
trap ferma EXIT

avvia || exit 1
echo "  » interfaccia completa con il server Windows"
PD_TEST_WINDOWS=1 PD_TEST_DOWNLOADS="$W/dl" PD_TEST_SITO=http://127.0.0.1:18991 PD_TEST_HOME="$T/home" \
  timeout 900 python3 tests/test_ui.py http://127.0.0.1:18993 "$W/shots" http://127.0.0.1:18992 || ESITO=1
echo "  » funzioni specifiche di Windows"
timeout 600 python3 tests/test_windows_api.py http://127.0.0.1:18993 "$W" "$APP" || ESITO=1
exit $ESITO
