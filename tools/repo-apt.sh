#!/bin/bash
# ==============================================================================
#  Professore Digitale - repository APT firmato (aggiornamenti con "apt upgrade")
#  Autore: Danilo D'Auria - Licenza MIT
#
#  Uso:  tools/repo-apt.sh CARTELLA_DESTINAZIONE
#        tools/repo-apt.sh --crea-chiave          (una sola volta: crea la chiave di firma)
#
#  Prende tutti i .deb della cartella archivio/ e crea un repository "piatto"
#  firmato con GPG. Gli utenti lo aggiungono una volta sola con lo script
#  installa-repository.sh generato qui, poi ricevono gli aggiornamenti
#  dal normale Gestore aggiornamenti del sistema.
#  Richiede: dpkg-dev (dpkg-scanpackages), apt-utils (apt-ftparchive), gnupg.
# ==============================================================================
set -euo pipefail
cd "$(dirname "$0")/.."
source ./rilascio.conf
NOME_CHIAVE="Professore Digitale (firma pacchetti)"
EMAIL=$(echo "$MANUTENTORE" | sed 's/.*<\(.*\)>.*/\1/')

if [ "${1:-}" = "--crea-chiave" ]; then
  gpg --batch --passphrase '' --quick-gen-key "$NOME_CHIAVE <$EMAIL>" rsa4096 sign 5y
  echo "✔ Chiave creata. CONSERVATENE UNA COPIA DI SICUREZZA:"
  echo "   gpg --export-secret-keys --armor \"$EMAIL\" > chiave-privata-professore-digitale.asc   (da tenere offline!)"
  exit 0
fi
DEST="${1:?Indicare la cartella di destinazione}"
for c in dpkg-scanpackages apt-ftparchive gpg; do
  command -v "$c" >/dev/null || { echo "Manca $c: sudo apt install dpkg-dev apt-utils gnupg"; exit 1; }
done
KEYID=$(gpg --list-secret-keys --with-colons "$EMAIL" 2>/dev/null | awk -F: '/^sec/ {print $5; exit}')
[ -n "$KEYID" ] || { echo "Nessuna chiave di firma per $EMAIL. Createla con: tools/repo-apt.sh --crea-chiave"; exit 1; }

rm -rf "$DEST"; mkdir -p "$DEST"
cp archivio/*.deb "$DEST/"
(
  cd "$DEST"
  dpkg-scanpackages --multiversion . /dev/null 2>/dev/null > Packages
  gzip -9nk Packages
  apt-ftparchive -o APT::FTPArchive::Release::Origin="Professore Digitale" \
                 -o APT::FTPArchive::Release::Label="Professore Digitale" \
                 -o APT::FTPArchive::Release::Suite="stable" \
                 -o APT::FTPArchive::Release::Codename="stable" release . > Release
  gpg --batch --yes -u "$KEYID" --clearsign -o InRelease Release
  gpg --batch --yes -u "$KEYID" -abs -o Release.gpg Release
  gpg --export "$KEYID" > professore-digitale.gpg
)
cat > "$DEST/installa-repository.sh" <<EOS
#!/bin/sh
# Aggiunge il repository del Professore Digitale: da ora gli aggiornamenti
# arrivano dal Gestore aggiornamenti del sistema (o con: sudo apt upgrade).
set -e
sudo mkdir -p /usr/share/keyrings
curl -fsSL "$BASE_URL/apt/professore-digitale.gpg" | sudo tee /usr/share/keyrings/professore-digitale.gpg >/dev/null
echo "deb [signed-by=/usr/share/keyrings/professore-digitale.gpg] $BASE_URL/apt ./" | sudo tee /etc/apt/sources.list.d/professore-digitale.list >/dev/null
sudo apt update
sudo apt install -y professore-digitale
echo "Fatto: il Professore Digitale è installato e verrà aggiornato insieme al sistema."
EOS
chmod 755 "$DEST/installa-repository.sh"
echo "✔ Repository APT firmato in $DEST ($(ls "$DEST"/*.deb | wc -l) pacchetti)"
