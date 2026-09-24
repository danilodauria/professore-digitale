#!/bin/bash
# ==============================================================================
#  Professore Digitale - carica dist/pubblica/ su GitHub Pages (ramo gh-pages)
#  Uso:  tools/pubblica-sito.sh            (serve l'accesso a GitHub: token o chiave SSH)
#  Una sola volta, su GitHub: Settings → Pages → Deploy from a branch → gh-pages / (root)
#  Autore: Danilo D'Auria - Licenza MIT
# ==============================================================================
set -euo pipefail
cd "$(dirname "$0")/.."
source ./rilascio.conf
PUB=dist/pubblica
[ -f "$PUB/aggiornamenti.json" ] || { echo "Niente da pubblicare: eseguite prima tools/rilascio.sh"; exit 1; }
VER=$(python3 -c "import json;print(json.load(open('$PUB/aggiornamenti.json'))['versione'])")
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
cp -r "$PUB"/. "$T/"
touch "$T/.nojekyll"      # GitHub Pages: pubblica i file così come sono
cd "$T"
git init -q -b gh-pages
git add -A
git -c user.name="${MANUTENTORE% <*}" -c user.email="$(echo "$MANUTENTORE" | sed 's/.*<\(.*\)>.*/\1/')" commit -qm "Pubblicazione versione $VER"
git push -f "$REPO_GIT" gh-pages
echo "✔ Pubblicato: $BASE_URL/aggiornamenti.json (versione $VER). GitHub impiega 1-2 minuti ad aggiornare il sito."
