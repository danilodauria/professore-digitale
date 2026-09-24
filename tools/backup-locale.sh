#!/bin/bash
# ==============================================================================
#  Professore Digitale - copia di sicurezza del progetto SENZA GitHub
#  Salva tutta la storia del progetto (git), i pacchetti rilasciati e i documenti
#  su una chiavetta, un disco esterno o un NAS.
#
#  Uso:  tools/backup-locale.sh DESTINAZIONE        es. /media/$USER/BACKUP
#  Ripristino:  tar xzf professore-digitale-VERSIONE-sorgenti.tar.gz   (oppure: git clone FILE.bundle professore-digitale)
#  Autore: Danilo D'Auria - Licenza MIT
# ==============================================================================
set -euo pipefail
cd "$(dirname "$0")/.."
DEST="${1:?Indicate la destinazione, es. /media/$USER/BACKUP}"
[ -d "$DEST" ] || { echo "Cartella non trovata: $DEST"; exit 1; }
VER=$(cat VERSION); DATA=$(date +%Y-%m-%d)
D="$DEST/professore-digitale-backup/$DATA-v$VER"
mkdir -p "$D"
git bundle create "$D/professore-digitale.bundle" --all >/dev/null 2>&1 && git bundle verify "$D/professore-digitale.bundle" >/dev/null 2>&1 \
  && echo "✔ Storia completa (git bundle)"
tar --exclude=./build --exclude=./dist --exclude=./archivio --exclude='__pycache__' --transform 's,^\.,professore-digitale,' \
    -czf "$D/professore-digitale-$VER-sorgenti.tar.gz" . && echo "✔ Archivio sorgenti (da allegare a Claude)"
[ -d dist/pubblica ] && (cd dist && zip -qr "$D/professore-digitale-$VER-da-pubblicare.zip" pubblica) && echo "✔ Ultima cartella da pubblicare"
source ./rilascio.conf
if ls "$ARCHIVIO"/*.deb >/dev/null 2>&1; then mkdir -p "$D/archivio" && cp "$ARCHIVIO"/*.deb "$D/archivio/" && echo "✔ Pacchetti pubblicati ($ARCHIVIO)"; fi
(cd "$D" && find . -type f ! -name SHA256SUMS -print0 | xargs -0 sha256sum > SHA256SUMS)
echo "✔ Copia di sicurezza in: $D"
echo "  Ricordate di conservare separatamente anche la chiave di firma (chiave-privata.asc)."
ls -1 "$DEST/professore-digitale-backup" | tail -5 | sed 's/^/    /'
