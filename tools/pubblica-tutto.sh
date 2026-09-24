#!/bin/bash
# ==============================================================================
#  Professore Digitale - PUBBLICA TUTTO con un solo comando
#  Da usare dopo aver ricevuto una nuova versione (zip "da-pubblicare" + sorgenti).
#
#  Uso:  tools/pubblica-tutto.sh ~/Scaricati/professore-digitale-X.Y.Z-da-pubblicare.zip
#        tools/pubblica-tutto.sh                  (usa dist/pubblica/ se l'avete compilata voi)
#  Opzioni:  --senza-apt   non firma/pubblica il repository APT
#            --prova       fa tutti i controlli ma non carica nulla su GitHub
#
#  Cosa fa:
#    1. controlla le impronte SHA-256 dei file ricevuti
#    2. se sul computer c'è la vostra chiave di firma, rigenera e firma il repository APT
#    3. carica il sito su GitHub Pages (ramo gh-pages)
#    4. invia i sorgenti con la cronologia e i tag (ramo main)
#  Autore: Danilo D'Auria - Licenza MIT
# ==============================================================================
set -euo pipefail
cd "$(dirname "$0")/.."
source ./rilascio.conf
ZIP=""; APT=1; PROVA=0
for a in "$@"; do
  case "$a" in
    --senza-apt) APT=0 ;; --prova) PROVA=1 ;;
    -h|--help) sed -n '2,19p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) ZIP="$a" ;;
  esac
done
V=$'\e[32m'; G=$'\e[33m'; R=$'\e[31m'; N=$'\e[0m'; [ -t 1 ] || { V=""; G=""; R=""; N=""; }
ok() { echo "${V}✔ $*${N}"; }; att() { echo "${G}! $*${N}"; }; err() { echo "${R}✘ $*${N}"; exit 1; }

T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
# ---- 0. file da pubblicare ----
if [ -n "$ZIP" ]; then
  [ -f "$ZIP" ] || err "File non trovato: $ZIP"
  python3 -c "import sys,zipfile; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])" "$ZIP" "$T/x" || err "Lo zip non si apre"
  SRC=$(dirname "$(find "$T/x" -name aggiornamenti.json | head -n1)")
  [ -f "$SRC/aggiornamenti.json" ] || err "Nello zip manca aggiornamenti.json"
else
  SRC=dist/pubblica
  [ -f "$SRC/aggiornamenti.json" ] || err "Indicate lo zip da pubblicare (oppure eseguite prima tools/rilascio.sh)"
fi
mkdir -p "$T/sito"; cp -r "$SRC"/. "$T/sito/"
VER=$(python3 -c "import json,sys;print(json.load(open(sys.argv[1]))['versione'])" "$T/sito/aggiornamenti.json")
echo "» Pubblicazione della versione $VER (sorgenti in questa cartella: $(cat VERSION))"
[ "$VER" = "$(cat VERSION)" ] || att "Attenzione: lo zip è della versione $VER ma i sorgenti di questa cartella sono $(cat VERSION). Estraete l'archivio sorgenti consegnato insieme allo zip."

# ---- 1. impronte ----
python3 tools/verifica_pubblicazione.py "$T/sito" >/dev/null || err "Verifica non riuscita: file danneggiati, riscaricateli"
ok "Impronte verificate"

# ---- 2. repository APT ----
if [ "$APT" = 1 ]; then
  EMAIL=$(echo "$MANUTENTORE" | sed 's/.*<\(.*\)>.*/\1/')
  if gpg --list-secret-keys "$EMAIL" >/dev/null 2>&1; then
    mkdir -p "$ARCHIVIO"; cp "$T/sito/"*.deb "$ARCHIVIO/" 2>/dev/null || true
    tools/repo-apt.sh "$T/sito/apt" >/dev/null && ok "Repository APT rigenerato e firmato ($(ls "$T/sito/apt/"*.deb | wc -l) pacchetti)"
  else
    att "Nessuna chiave di firma per $EMAIL: salto il repository APT (crearla con tools/repo-apt.sh --crea-chiave)"
  fi
fi
touch "$T/sito/.nojekyll"

if [ "$PROVA" = 1 ]; then ok "Prova completata: nessun file caricato."; ls "$T/sito"; exit 0; fi

# ---- 3. sito ----
echo "» Carico il sito su GitHub Pages…"
( cd "$T/sito" && git init -q -b gh-pages && git add -A &&
  git -c user.name="${MANUTENTORE% <*}" -c user.email="$(echo "$MANUTENTORE" | sed 's/.*<\(.*\)>.*/\1/')" commit -qm "Pubblicazione versione $VER" &&
  git push -f -q "$REPO_GIT" gh-pages ) || err "Caricamento del sito non riuscito (controllate internet e il token di GitHub)"
ok "Sito pubblicato: $BASE_URL/aggiornamenti.json"

# ---- 4. sorgenti ----
if [ -d .git ]; then
  echo "» Invio i sorgenti e i tag…"
  git push -q "$REPO_GIT" main --tags && ok "Sorgenti inviati (ramo main e tag)" || att "Invio dei sorgenti non riuscito: riprovate con  git push $REPO_GIT main --tags"
fi
echo
ok "Fatto! Tra 1-2 minuti, da un PC con il Professore: Impostazioni → Aggiornamenti → «Controlla aggiornamenti»."
