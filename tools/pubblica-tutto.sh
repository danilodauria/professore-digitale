#!/bin/bash
# ==============================================================================
#  Professore Digitale - PUBBLICA TUTTO con un solo comando
#  Da usare dopo aver ricevuto una nuova versione (zip "da-pubblicare" + sorgenti).
#
#  Uso:  tools/pubblica-tutto.sh ~/Scaricati/professore-digitale-X.Y.Z-da-pubblicare.zip
#        tools/pubblica-tutto.sh                  (usa dist/pubblica/ se l'avete compilata voi)
#  Opzioni:  --apt         firma anche il repository APT (non va su GitHub Pages: i .deb superano 100 MB)
#            --prova       fa tutti i controlli ma non carica nulla su GitHub
#
#  Cosa fa:
#    1. controlla le impronte SHA-256 dei file ricevuti
#    2. se sul computer c'è la vostra chiave di firma, rigenera e firma il repository APT
#    3. invia i sorgenti con la cronologia e i tag (ramo main)
#    4. crea la Release vX.Y.Z con installatori e sito-X.Y.Z.zip (serve «gh», altrimenti spiega come farlo dal sito);
#       il workflow .github/workflows/pubblica-sito.yml mette il sito su GitHub Pages
#  GitHub non accetta file oltre i 100 MB nel repository né nel sito: i file grandi stanno nella Release.
#  Autore: Danilo D'Auria - Licenza MIT
# ==============================================================================
set -euo pipefail
cd "$(dirname "$0")/.."
source ./rilascio.conf
ZIP=""; APT=0; PROVA=0
for a in "$@"; do
  case "$a" in
    --senza-apt) APT=0 ;; --apt) APT=1 ;; --prova) PROVA=1 ;;
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

# ---- 3. sorgenti e tag (prima la Release ha bisogno del tag) ----
if [ -d .git ]; then
  echo "» Invio i sorgenti e i tag…"
  git push -q "$REPO_GIT" main --tags && ok "Sorgenti inviati (ramo main e tag)" || att "Invio dei sorgenti non riuscito: riprovate con  git push $REPO_GIT main --tags"
fi

# ---- 4. Release con i file grandi + sito-X.Y.Z.zip (il workflow «Pubblica il sito» lo mette su GitHub Pages) ----
python3 tools/prepara-github.py "$T/sito" "$PAGINA_PROGETTO" "$BASE_URL" "$T/github" >/dev/null || err "Preparazione per GitHub non riuscita"
REL="$T/github/rilascio-$VER"
if command -v gh >/dev/null && gh auth status >/dev/null 2>&1; then
  echo "» Creo la Release v$VER su GitHub e carico i file (qualche minuto)…"
  gh release create "v$VER" -R "${PAGINA_PROGETTO#https://github.com/}" --title "Professore Digitale $VER" \
     --notes-file "$REL/NOTE-$VER.md" "$REL"/*.exe "$REL"/*.deb "$REL"/*.zip || err "Release non creata"
  ok "Release pubblicata: $PAGINA_PROGETTO/releases/tag/v$VER (il sito si aggiorna da solo in 1-2 minuti)"
else
  mkdir -p "dist/github"; rm -rf "dist/github/rilascio-$VER"; cp -r "$REL" dist/github/
  att "Strumento gh non pronto: create la Release dal sito (Releases → Draft a new release → tag v$VER)"
  att "e trascinate i file di dist/github/rilascio-$VER/ (guida: docs/Pubblicare_su_GitHub.pdf)"
fi
echo
ok "Fatto! Tra 1-2 minuti, da un PC con il Professore: Impostazioni → Aggiornamenti → «Controlla aggiornamenti»."
