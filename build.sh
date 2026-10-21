#!/bin/bash
# ==============================================================================
#  Professore Digitale - script di compilazione
#  Produce in dist/: pacchetto .deb (Architecture: all), app per macOS (.zip), versione HTML portatile,
#  pacchetti di contenuti, archivio sorgenti e SHA256SUMS; in dist/windows/ l'installatore
#  per Windows (se ci sono mingw-w64 e NSIS, vedi windows/build-windows.sh).    Uso:  ./build.sh
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
bash -n tools/voci.sh packaging/mac/avvia.sh
for f in packaging/professore-digitale-setup-ia packaging/professore-digitale-setup-voce packaging/professore-digitale-pulizia packaging/prerm packaging/postrm; do bash -n "$f"; done
command -v node >/dev/null && for f in src/web/js/*.js; do node --check "$f"; done
find src -name '__pycache__' -prune -exec rm -rf {} +
if ls src/contenuti/*.json >/dev/null 2>&1; then
  PD_SHARE_DIR=src python3 packaging/professore-digitale-contenuti valida src/contenuti/*.json
fi
PD_SHARE_DIR=src python3 packaging/professore-digitale-contenuti valida windows/contenuti/*.json
python3 -c "import json,sys; c=json.load(open(sys.argv[1])); assert c['formato']=='professore-digitale-catalogo-ia'" windows/catalogo-ia.json

echo "» Albero del pacchetto ($VERSION)"
S=$BUILD/usr/share
install -d "$BUILD/usr/bin" "$S/$PKG/server" "$S/$PKG/contenuti" "$S/applications" "$S/icons/hicolor/scalable/apps" \
           "$S/doc/$PKG" "$S/man/man1" "$S/metainfo"
install -m 0755 packaging/professore-digitale packaging/professore-digitale-setup-ia packaging/professore-digitale-setup-voce \
                packaging/professore-digitale-pulizia packaging/professore-digitale-contenuti "$BUILD/usr/bin/"
# TUTTI i moduli del server (dalla 3.5.3: prima mancava pd_tablet.py e il server non partiva)
install -m 0644 src/server/pd_*.py "$S/$PKG/server/"
for m in $(sed -n 's/^import \(pd_[a-z_]*\).*/\1/p' src/server/pd_server.py); do
  [ -f "$S/$PKG/server/$m.py" ] || { echo "ERRORE: il pacchetto non contiene server/$m.py"; exit 1; }
done
install -m 0644 VERSION "$S/$PKG/VERSION"
python3 -c 'import json,sys; json.dump({"aggiornamenti_url": sys.argv[1], "pagina": sys.argv[2]}, open(sys.argv[3],"w"), indent=1)' \
        "$AGGIORNAMENTI_URL" "$PAGINA_PROGETTO" "$S/$PKG/distribuzione.json"
chmod 0644 "$S/$PKG/distribuzione.json"
cp -r src/web "$S/$PKG/web"
echo "» Voci naturali incluse (Kokoro: Nicola e Sara, PC x86 a 64 bit; Piper: Giorgio, Serena e Paola, PC a 64 bit x86 e ARM)"
source tools/voci.sh; prepara_voci
install -d "$BUILD/usr/lib/$PKG/piper" "$S/$PKG/voci"
for a in x86_64 aarch64; do
  tar -xzf "$VOCI_CACHE/piper_linux_$a.tar.gz" -C "$BUILD/usr/lib/$PKG/piper" --no-same-owner
  mv "$BUILD/usr/lib/$PKG/piper/piper" "$BUILD/usr/lib/$PKG/piper/$a"
done
rm -rf "$BUILD/usr/lib/$PKG/piper/"*/pkgconfig
# Kokoro (dalla 3.8): libreria sherpa-onnx per x86_64 e modello con le voci Nicola e Sara
install -d "$BUILD/usr/lib/$PKG/kokoro/x86_64"
install -m 0644 "$SHERPA_DIR/linux-x86_64/"*.so "$BUILD/usr/lib/$PKG/kokoro/x86_64/"
find "$BUILD/usr/lib/$PKG" -type d -exec chmod 0755 {} +
copia_voci "$S/$PKG/voci"; chmod 0644 "$S/$PKG/voci/"*
copia_kokoro "$S/$PKG/voci/kokoro"; find "$S/$PKG/voci/kokoro" -type d -exec chmod 0755 {} +; find "$S/$PKG/voci/kokoro" -type f -exec chmod 0644 {} +
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
install -m 0644 LICENSE "$S/doc/$PKG/LICENSE"
install -m 0644 LICENZA-CONTENUTI.md "$S/doc/$PKG/LICENZA-CONTENUTI.md"
# il vademecum sta con l'interfaccia (apribile dall'app, anche su sistemi che non installano /usr/share/doc)
if [ -f docs/Vademecum_Professore_Digitale.pdf ]; then
  install -d -m 0755 "$S/$PKG/web/docs"; install -m 0644 docs/Vademecum_Professore_Digitale.pdf "$S/$PKG/web/docs/"
fi
gzip -9nc packaging/changelog > "$S/doc/$PKG/changelog.gz"; chmod 0644 "$S/doc/$PKG/changelog.gz"
sed "s/@VERSION@/$VERSION/" packaging/professore-digitale.1 | gzip -9nc > "$S/man/man1/$PKG.1.gz"; chmod 0644 "$S/man/man1/$PKG.1.gz"
for c in professore-digitale-setup-ia professore-digitale-setup-voce professore-digitale-pulizia professore-digitale-contenuti; do
  ln -s "$PKG.1.gz" "$S/man/man1/$c.1.gz"
done
install -m 0755 packaging/prerm "$BUILD/DEBIAN/prerm"
install -m 0755 packaging/postrm "$BUILD/DEBIAN/postrm"

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
 disegnare, una palestra di esercizi, grandi quiz con attestato da stampare,
 lezioni di cultura generale, le pagine di FeniceOS e del libro Tecnologia
 Gentile e un quadro dell'aula per il facilitatore in rete locale. Include le
 voci naturali italiane Nicola e Sara (Kokoro), Giorgio, Serena e Paola (Piper).
 .
 Funziona senza Internet anche su computer ricondizionati: nessun dato
 lascia il computer. Ideato e sviluppato da Danilo D'Auria.
 .
 Licenze: codice MIT; contenuti (lezioni, domande, quiz, vademecum, immagini)
 Creative Commons BY-NC-SA 4.0, (c) 2026 Danilo D'Auria.
CTRL
(cd "$BUILD" && find usr -type f -print0 | sort -z | xargs -0 md5sum > DEBIAN/md5sums)
chmod 0644 "$BUILD/DEBIAN/control" "$BUILD/DEBIAN/md5sums"

echo "» Pacchetto .deb"
dpkg-deb --root-owner-group -Zxz --build "$BUILD" "$DIST/${PKG}_${VERSION}_all.deb" >/dev/null
ls -la "$DIST"/*.deb
echo "» Prova del .deb (estratto, server installato avviato davvero)"
python3 tests/test_deb.py "$DIST/${PKG}_${VERSION}_all.deb" || { echo "ERRORE: il .deb non funziona, rilascio fermato"; exit 1; }

echo "» Versione HTML portatile"
python3 tools/make_standalone.py src/web "$DIST/professore-digitale-portatile.html"

echo "» Versione per macOS (app in uno zip: stesso server Python, voci del Mac)"
M=build/mac; A="$M/Professore Digitale.app"
mkdir -p "$A/Contents/MacOS" "$A/Contents/Resources"
# lo stesso albero del .deb, senza le voci Piper (il loro motore e' solo per Linux)
cp -r "$S/$PKG" "$A/Contents/Resources/app"; rm -rf "$A/Contents/Resources/app/voci"
# il vademecum giusto per il Mac (dalla 3.8) al posto di quello per Linux
rm -f "$A/Contents/Resources/app/web/docs/Vademecum_Professore_Digitale.pdf"
if [ -f docs/Vademecum_Professore_Digitale_Mac.pdf ]; then
  install -d "$A/Contents/Resources/app/web/docs"; cp docs/Vademecum_Professore_Digitale_Mac.pdf "$A/Contents/Resources/app/web/docs/"
  cp docs/Vademecum_Professore_Digitale_Mac.pdf "$M/"
fi
install -m 0755 packaging/professore-digitale "$A/Contents/Resources/app/professore-digitale"
install -m 0755 packaging/mac/avvia.sh "$A/Contents/MacOS/avvia.sh"
sed "s/@VERSIONE@/$VERSION/g" packaging/mac/Info.plist > "$A/Contents/Info.plist"
rsvg-convert -w 1024 -h 1024 src/web/img/icon.svg -o "$M/icona-1024.png"
python3 -c "import sys; from PIL import Image; Image.open(sys.argv[1]).convert('RGBA').save(sys.argv[2])" "$M/icona-1024.png" "$A/Contents/Resources/icona.icns"
cp packaging/mac/LEGGIMI-MAC.txt "$M/"
{ cat LICENSE; echo; echo "--------------------------------------------------------------------------"; echo; cat LICENZA-CONTENUTI.md; } > "$M/LICENZE.txt"
find "$A" -type d -exec chmod 0755 {} +
rm -f "$DIST/ProfessoreDigitale-$VERSION-macOS.zip"
( cd "$M" && zip -qry -X "../../$DIST/ProfessoreDigitale-$VERSION-macOS.zip" "Professore Digitale.app" LEGGIMI-MAC.txt LICENZE.txt $(ls Vademecum_*.pdf 2>/dev/null) )
ls -la "$DIST/ProfessoreDigitale-$VERSION-macOS.zip"

echo "» Pacchetti di contenuti"
if ls src/contenuti/*.json >/dev/null 2>&1; then mkdir -p "$DIST/contenuti"; cp src/contenuti/*.json "$DIST/contenuti/"; fi

echo "» Archivio sorgenti"
git archive --format=tar.gz --prefix="${PKG}-${VERSION}/" -o "$DIST/${PKG}-${VERSION}-sorgenti.tar.gz" HEAD 2>/dev/null || \
  tar --exclude=build --exclude=dist --exclude=.git --exclude='__pycache__' -czf "$DIST/${PKG}-${VERSION}-sorgenti.tar.gz" \
      --transform "s,^\.,${PKG}-${VERSION}," .
echo "» Versione per Windows"
if command -v i686-w64-mingw32-gcc >/dev/null && command -v makensis >/dev/null; then
  windows/build-windows.sh
  cp dist/windows/*.exe dist/windows/*.zip "$DIST/"
else
  echo "! mingw-w64 o NSIS mancanti: versione Windows non compilata (tools/prepara-ambiente.sh li installa)"
fi
(cd "$DIST" && sha256sum *.deb *.html *.tar.gz $(ls *.exe *.zip 2>/dev/null) > SHA256SUMS)

if command -v lintian >/dev/null; then
  echo "» Lintian"
  lintian --tag-display-limit 0 "$DIST/${PKG}_${VERSION}_all.deb" 2>/dev/null || true
fi
echo "✔ Fatto: $DIST/ (versione $VERSION)"
