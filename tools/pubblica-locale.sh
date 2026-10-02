#!/bin/bash
# ==============================================================================
#  Professore Digitale - PUBBLICAZIONE IN LOCALE (senza GitHub, senza Internet)
#
#  Uso:
#    tools/pubblica-locale.sh ZIP --cartella DEST [--indirizzo http://IP:PORTA] [--senza-apt]
#
#  ZIP        lo zip "da-pubblicare" ricevuto (oppure omettetelo per usare dist/pubblica/)
#  DEST       dove preparare gli aggiornamenti, per esempio:
#               /media/$USER/CHIAVETTA/professore-digitale   → chiavetta per le aule senza rete
#               ~/aggiornamenti-professore                   → cartella da servire in rete locale
#  --indirizzo  indirizzo con cui i PC dell'aula raggiungeranno la cartella in rete locale
#               (serve solo per il repository APT; vedi tools/server-aggiornamenti.sh)
#
#  Nella cartella DEST vengono creati:
#    - tutti i file dell'aggiornamento, verificati con SHA-256
#    - installa-da-chiavetta.sh  → installa/aggiorna programma e contenuti su un PC, anche offline
#    - apt/ firmato (se sul computer c'è la chiave di firma)
#    - LEGGIMI.txt con le istruzioni
#  Autore: Danilo D'Auria - Licenza MIT
# ==============================================================================
set -euo pipefail
cd "$(dirname "$0")/.."
source ./rilascio.conf
ZIP=""; DEST=""; IND=""; APT=1
while [ $# -gt 0 ]; do
  case "$1" in
    --cartella) DEST="${2:?}"; shift 2 ;;
    --indirizzo) IND="${2:?}"; shift 2 ;;
    --senza-apt) APT=0; shift ;;
    -h|--help) sed -n '2,24p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) ZIP="$1"; shift ;;
  esac
done
V=$'\e[32m'; G=$'\e[33m'; R=$'\e[31m'; N=$'\e[0m'; [ -t 1 ] || { V=""; G=""; R=""; N=""; }
ok() { echo "${V}✔ $*${N}"; }; att() { echo "${G}! $*${N}"; }; err() { echo "${R}✘ $*${N}"; exit 1; }
[ -n "$DEST" ] || err "Indicate la cartella di destinazione con --cartella (vedi --help)"
IND="${IND%/}"

T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
if [ -n "$ZIP" ]; then
  [ -f "$ZIP" ] || err "File non trovato: $ZIP"
  python3 -c "import sys,zipfile; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])" "$ZIP" "$T/x" || err "Lo zip non si apre"
  SRC=$(dirname "$(find "$T/x" -name aggiornamenti.json | head -n1)")
else
  SRC=dist/pubblica
fi
[ -f "$SRC/aggiornamenti.json" ] || err "Niente da pubblicare: indicate lo zip ricevuto"
VER=$(python3 tools/verifica_pubblicazione.py "$SRC") || err "Verifica non riuscita: file danneggiati"
ok "Versione $VER verificata"

# la cartella di destinazione: si svuota solo se è una nostra cartella (file di riconoscimento)
MARCA=".professore-digitale-aggiornamenti"
if [ -d "$DEST" ] && [ -n "$(ls -A "$DEST" 2>/dev/null)" ] && [ ! -f "$DEST/$MARCA" ]; then
  err "La cartella $DEST non è vuota e non è una cartella di aggiornamenti: sceglietene una nuova o vuota"
fi
mkdir -p "$DEST"
find "$DEST" -mindepth 1 -maxdepth 1 ! -name "$MARCA" -exec rm -rf {} +
cp -r "$SRC"/. "$DEST/"
touch "$DEST/$MARCA"
rm -rf "$DEST/apt"

if [ "$APT" = 1 ]; then
  EMAIL=$(echo "$MANUTENTORE" | sed 's/.*<\(.*\)>.*/\1/')
  if gpg --list-secret-keys "$EMAIL" >/dev/null 2>&1; then
    mkdir -p "$ARCHIVIO"; cp "$DEST"/professore-digitale_*_all.deb "$ARCHIVIO/" 2>/dev/null || true
    tools/repo-apt.sh "$DEST/apt" "${IND:-$BASE_URL}" >/dev/null && ok "Repository APT firmato in $DEST/apt"
    [ -n "$IND" ] || att "Senza --indirizzo lo script apt/installa-repository.sh punta a $BASE_URL"
  else
    att "Nessuna chiave di firma: repository APT non creato (non serve per chiavetta e aggiornamento dall'app)"
  fi
fi

cat > "$DEST/installa-da-chiavetta.sh" <<'EOS'
#!/bin/sh
# Professore Digitale - installa o aggiorna programma e contenuti da questa cartella (anche senza Internet).
# Uso: aprire un terminale in questa cartella e scrivere:  sh installa-da-chiavetta.sh
set -e
cd "$(dirname "$0")"
echo "Controllo dei file…"
sha256sum -c --quiet SHA256SUMS 2>/dev/null || { echo "ERRORE: file danneggiati, ricopiate la cartella."; exit 1; }
DEB=$(ls professore-digitale_*_all.deb | sort -V | tail -n1)
NUOVA=$(echo "$DEB" | sed 's/professore-digitale_\(.*\)_all.deb/\1/')
ATTUALE=$(dpkg-query -W -f='${Version}' professore-digitale 2>/dev/null || echo "nessuna")
echo "Versione installata: $ATTUALE — versione in questa cartella: $NUOVA"
if [ "$ATTUALE" = "nessuna" ] || dpkg --compare-versions "$NUOVA" gt "$ATTUALE"; then
  cp "$DEB" /tmp/ && sudo apt install -y "/tmp/$DEB" && rm -f "/tmp/$DEB"
  echo "Programma installato/aggiornato alla versione $NUOVA."
else
  echo "Il programma è già aggiornato."
fi
if ls contenuti/*.json >/dev/null 2>&1; then
  for f in contenuti/*.json; do sudo professore-digitale-contenuti installa "$f" --sistema >/dev/null && echo "Contenuti: $f"; done
fi
echo "Fatto! Riaprite il Professore Digitale. Impostazioni e progressi sono stati conservati."
EOS
chmod 755 "$DEST/installa-da-chiavetta.sh"
cat > "$DEST/avvia-server-aggiornamenti.sh" <<'EOS'
#!/bin/sh
# Professore Digitale - rende disponibile QUESTA cartella agli altri PC della rete locale.
# Uso: sh avvia-server-aggiornamenti.sh [PORTA]      (chiudere con Ctrl+C)
cd "$(dirname "$0")"
PORTA="${1:-8080}"
echo "Negli altri PC, Impostazioni → Aggiornamenti → Indirizzo:"
for ip in $(hostname -I 2>/dev/null); do echo "    http://$ip:$PORTA/aggiornamenti.json"; done
echo "Server attivo (Ctrl+C per chiudere)…"
exec python3 -m http.server "$PORTA" --bind 0.0.0.0
EOS
chmod 755 "$DEST/avvia-server-aggiornamenti.sh"
( cd "$DEST" && sha256sum -- *.deb *.exe *.zip *.html *.json contenuti/*.json 2>/dev/null > SHA256SUMS )

cat > "$DEST/LEGGIMI.txt" <<EOS
PROFESSORE DIGITALE $VER - AGGIORNAMENTO IN LOCALE (senza Internet)

A) CON QUESTA CARTELLA SU CHIAVETTA
   Su ogni PC Linux: aprire un terminale in questa cartella e scrivere
       sh installa-da-chiavetta.sh
   Su ogni PC Windows: doppio clic su ProfessoreDigitale-Setup-$VER.exe
   Installa o aggiorna il programma e i contenuti. Progressi e impostazioni restano.

B) IN RETE LOCALE (un PC dell'aula fa da "server degli aggiornamenti")
   Sul PC server, in questa cartella:   sh avvia-server-aggiornamenti.sh
   (oppure, dalla cartella del progetto, per averlo sempre attivo:
    tools/server-aggiornamenti.sh "$DEST" --servizio)
   Sugli altri PC:  Professore Digitale → Impostazioni → Aggiornamenti →
                    Indirizzo:  http://IP-DEL-SERVER:8080/aggiornamenti.json
                    → Controlla aggiornamenti
$( [ -d "$DEST/apt" ] && echo "
C) GESTORE AGGIORNAMENTI (repository APT firmato, in rete locale)
   Una volta per PC:  curl -fsSL ${IND:-$BASE_URL}/apt/installa-repository.sh | sh" )
EOS
echo
ok "Aggiornamento $VER pronto in: $DEST"
echo "   • Chiavetta: su ogni PC  sh installa-da-chiavetta.sh"
echo "   • Rete locale: tools/server-aggiornamenti.sh \"$DEST\""
