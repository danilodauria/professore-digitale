#!/bin/bash
# ==============================================================================
#  Professore Digitale - script di compilazione
#  Produce in dist/: pacchetto .deb (Architecture: all), versione HTML portatile,
#  pacchetti di contenuti, archivio sorgenti e SHA256SUMS.    Uso:  ./build.sh
#  La versione si legge dal file VERSION (unica fonte). Per un rilascio usate
#  tools/rilascio.sh, che aggiorna VERSION e changelog e poi chiama questo script.
#  Autore: Danilo D'Auria - Licenza MIT
# ==============================================================================
set -euo pipefail
cd "$(dirname "$0")"
source ./rilascio.conf
VERSION=$(tr -d ' \n' < VERSION)
[[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "VERSION non valida: $VERSION"; exit 1; }
PKG=professore-digitale
BUILD=build/${PKG}_${VERSION}_all
DIST=dist
rm -rf build "$DIST"; mkdir -p "$BUILD/DEBIAN" "$DIST"
grep -q "^$PKG ($VERSION)" packaging/changelog || { echo "Manca la voce $VERSION in packaging/changelog"; exit 1; }

echo "» Verifica sintassi e contenuti"
python3 -m py_compile src/server/*.py packaging/professore-digitale packaging/professore-digitale-contenuti
for f in packaging/professore-digitale-setup-ia packaging/professore-digitale-setup-voce packaging/professore-digitale-pulizia packaging/prerm; do bash -n "$f"; done
command -v node >/dev/null && for f in src/web/js/*.js; do node --check "$f"; done
find src -name '__pycache__' -prune -exec rm -rf {} +
if ls src/contenuti/*.json >/dev/null 2>&1; then
  PD_SHARE_DIR=src python3 packaging/professore-digitale-contenuti valida src/contenuti/*.json
fi

echo "» Albero del pacchetto ($VERSION)"
S=$BUILD/usr/share
install -d "$BUILD/usr/bin" "$S/$PKG/server" "$S/$PKG/contenuti" "$S/applications" "$S/icons/hicolor/scalable/apps" \
           "$S/doc/$PKG" "$S/man/man1" "$S/metainfo"
install -m 0755 packaging/professore-digitale packaging/professore-digitale-setup-ia packaging/professore-digitale-setup-voce \
                packaging/professore-digitale-pulizia packaging/professore-digitale-contenuti "$BUILD/usr/bin/"
install -m 0644 src/server/pd_server.py src/server/pd_stt_worker.py src/server/pd_packs.py "$S/$PKG/server/"
install -m 0644 VERSION "$S/$PKG/VERSION"
python3 -c 'import json,sys; json.dump({"aggiornamenti_url": sys.argv[1], "pagina": sys.argv[2]}, open(sys.argv[3],"w"), indent=1)' \
        "$AGGIORNAMENTI_URL" "$PAGINA_PROGETTO" "$S/$PKG/distribuzione.json"
chmod 0644 "$S/$PKG/distribuzione.json"
cp -r src/web "$S/$PKG/web"
if ls src/contenuti/*.json >/dev/null 2>&1; then install -m 0644 src/contenuti/*.json "$S/$PKG/contenuti/"; fi
find "$S/$PKG/web" -type d -exec chmod 0755 {} +; find "$S/$PKG/web" -type f -exec chmod 0644 {} +
rm -f "$S/$PKG/web/vendor/mermaid.LICENSE"
install -m 0644 packaging/professore-digitale.desktop packaging/professore-digitale-setup.desktop \
                packaging/professore-digitale-setup-voce.desktop "$S/applications/"
install -m 0644 src/web/img/icon.svg "$S/icons/hicolor/scalable/apps/$PKG.svg"
python3 tools/metainfo.py packaging/io.github.danilodauria.ProfessoreDigitale.metainfo.xml packaging/changelog \
        > "$S/metainfo/io.github.danilodauria.ProfessoreDigitale.metainfo.xml"
chmod 0644 "$S/metainfo/"*.xml
install -m 0644 packaging/copyright "$S/doc/$PKG/copyright"
install -m 0644 README.md "$S/doc/$PKG/README.md"
[ -f docs/Vademecum_Professore_Digitale.pdf ] && install -m 0644 docs/Vademecum_Professore_Digitale.pdf "$S/doc/$PKG/"
gzip -9nc packaging/changelog > "$S/doc/$PKG/changelog.gz"; chmod 0644 "$S/doc/$PKG/changelog.gz"
sed "s/@VERSION@/$VERSION/" packaging/professore-digitale.1 | gzip -9nc > "$S/man/man1/$PKG.1.gz"; chmod 0644 "$S/man/man1/$PKG.1.gz"
for c in professore-digitale-setup-ia professore-digitale-setup-voce professore-digitale-pulizia professore-digitale-contenuti; do
  ln -s "$PKG.1.gz" "$S/man/man1/$c.1.gz"
done
install -m 0755 packaging/prerm "$BUILD/DEBIAN/prerm"

SIZE=$(du -sk --exclude=DEBIAN "$BUILD" | cut -f1)
cat > "$BUILD/DEBIAN/control" <<CTRL
Package: $PKG
Version: $VERSION
Architecture: all
Maintainer: $MANUTENTORE
Installed-Size: $SIZE
Depends: python3 (>= 3.7)
Recommends: espeak-ng, chromium | firefox-esr | firefox, fonts-noto-color-emoji, python3-venv, curl
Suggests: libttspico-utils, zenity
Section: education
Priority: optional
Homepage: $PAGINA_PROGETTO
Description: cattedra digitale portatile per l'alfabetizzazione informatica
 Professore Digitale e' una piattaforma didattica offline pensata per centri
 anziani, scuole, biblioteche e associazioni. Offre lezioni guidate con
 schemi alla lavagna e quiz, un assistente che risponde a voce (guida interna
 sempre disponibile, IA locale facoltativa tramite Ollama), una lavagna per
 disegnare e una palestra di esercizi per mouse e tastiera. Domande e lezioni
 si ampliano con pacchetti di contenuti.
 .
 Funziona senza Internet anche su computer ricondizionati: nessun dato
 lascia il computer. Ideato e sviluppato da Danilo D'Auria.
CTRL
(cd "$BUILD" && find usr -type f -print0 | sort -z | xargs -0 md5sum > DEBIAN/md5sums)
chmod 0644 "$BUILD/DEBIAN/control" "$BUILD/DEBIAN/md5sums"

echo "» Pacchetto .deb"
dpkg-deb --root-owner-group -Zxz --build "$BUILD" "$DIST/${PKG}_${VERSION}_all.deb" >/dev/null
ls -la "$DIST"/*.deb

echo "» Versione HTML portatile"
python3 tools/make_standalone.py src/web "$DIST/professore-digitale-portatile.html"

echo "» Pacchetti di contenuti"
if ls src/contenuti/*.json >/dev/null 2>&1; then mkdir -p "$DIST/contenuti"; cp src/contenuti/*.json "$DIST/contenuti/"; fi

echo "» Archivio sorgenti"
git archive --format=tar.gz --prefix="${PKG}-${VERSION}/" -o "$DIST/${PKG}-${VERSION}-sorgenti.tar.gz" HEAD 2>/dev/null || \
  tar --exclude=build --exclude=dist --exclude=.git --exclude='__pycache__' -czf "$DIST/${PKG}-${VERSION}-sorgenti.tar.gz" \
      --transform "s,^\.,${PKG}-${VERSION}," .
(cd "$DIST" && sha256sum *.deb *.html *.tar.gz > SHA256SUMS)

if command -v lintian >/dev/null; then
  echo "» Lintian"
  lintian --tag-display-limit 0 "$DIST/${PKG}_${VERSION}_all.deb" 2>/dev/null || true
fi
echo "✔ Fatto: $DIST/ (versione $VERSION)"
