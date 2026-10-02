#!/bin/bash
# ==============================================================================
#  Professore Digitale - prepara il computer (o l'ambiente) per sviluppare,
#  eseguire i test e rilasciare nuove versioni. Si può rilanciare quante volte si vuole.
#  Uso:  tools/prepara-ambiente.sh
#  Autore: Danilo D'Auria - Licenza MIT
# ==============================================================================
set -uo pipefail
cd "$(dirname "$0")/.."
SUDO=""; [ "$(id -u)" -ne 0 ] && SUDO="sudo"
PACCHETTI="git python3 python3-venv python3-pip nodejs dpkg-dev apt-utils gnupg lintian curl zip espeak-ng poppler-utils mingw-w64 nsis libz-mingw-w64-dev"
MANCANTI=""
for p in $PACCHETTI; do
  [ "$p" = nodejs ] && command -v node >/dev/null && continue
  dpkg -s "$p" >/dev/null 2>&1 || MANCANTI="$MANCANTI $p"
done
if [ -n "$MANCANTI" ]; then
  echo "» Installo:$MANCANTI"
  $SUDO apt-get update -q >/dev/null && $SUDO apt-get install -y -q $MANCANTI >/dev/null || echo "! Installazione di alcuni pacchetti non riuscita:$MANCANTI"
else
  echo "✔ Pacchetti di sistema presenti"
fi

# Playwright (test dell'interfaccia): usa quello già presente, altrimenti un ambiente dedicato
if python3 -c "import playwright" 2>/dev/null; then
  echo "✔ Playwright presente"
else
  VENV="$HOME/pd-strumenti"
  [ -x "$VENV/bin/python3" ] || python3 -m venv "$VENV"
  "$VENV/bin/pip" install -q playwright vermin && "$VENV/bin/playwright" install --with-deps chromium >/dev/null \
    && echo "✔ Playwright installato in $VENV — prima dei test:  source $VENV/bin/activate" \
    || echo "! Playwright non installato: i test dell'interfaccia non potranno girare"
fi
# Wine (facoltativo): permette di provare la versione Windows con tests/esegui_test.sh
if ! command -v wine >/dev/null; then
  echo "» Installo Wine per i test della versione Windows (facoltativo)"
  { $SUDO dpkg --add-architecture i386 && $SUDO apt-get update -q >/dev/null && $SUDO apt-get install -y -q --no-install-recommends wine wine32:i386 wine64 >/dev/null; } \
    || echo "! Wine non installato: i test della versione Windows verranno saltati"
fi
python3 -m pip show vermin >/dev/null 2>&1 || python3 -m pip install -q vermin 2>/dev/null || \
  python3 -m pip install -q --break-system-packages vermin 2>/dev/null || true

chmod +x build.sh tools/*.sh tools/*.py tests/*.sh 2>/dev/null
[ -d .git ] || { git init -q -b main && git add -A && git commit -qm "Importazione sorgenti" && echo "✔ Archivio git creato"; }
echo "✔ Versione attuale: $(cat VERSION) — ultimo commit: $(git log -1 --format='%h %s' 2>/dev/null)"
echo "Prossimo passo:  tests/esegui_test.sh"
