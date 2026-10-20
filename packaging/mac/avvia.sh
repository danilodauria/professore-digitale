#!/bin/bash
# Professore Digitale - avvio su macOS (dentro l'app). Ideato e sviluppato da Danilo D'Auria - Codice MIT
# Cerca Python 3 (incluso negli «Strumenti da riga di comando» di Apple, oppure da python.org o Homebrew)
# e apre il programma nel browser. I dati restano in ~/Library/Application Support/ProfessoreDigitale.
QUI="$(cd "$(dirname "$0")/../Resources" && pwd)"
export PD_SHARE_DIR="$QUI/app"
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"
for p in /opt/homebrew/bin/python3 /usr/local/bin/python3 /Library/Frameworks/Python.framework/Versions/Current/bin/python3 /usr/bin/python3; do
  # /usr/bin/python3 senza gli Strumenti di Apple apre solo la finestra di installazione: si prova con -c prima
  if [ -x "$p" ] && "$p" -c 'import sys; sys.exit(0 if sys.version_info >= (3,7) else 1)' 2>/dev/null; then
    exec "$p" -B "$PD_SHARE_DIR/professore-digitale" "$@"
  fi
done
osascript -e 'display dialog "Il Professore Digitale ha bisogno di Python 3 (gratuito).\n\nmacOS ora vi proporrà di installare gli «Strumenti da riga di comando»: premete Installa, poi riaprite il Professore." buttons {"OK"} with title "Professore Digitale"'
xcode-select --install 2>/dev/null
exit 1
