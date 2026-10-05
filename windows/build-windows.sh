#!/bin/bash
# ==============================================================================
#  Professore Digitale per Windows - compilazione (da Linux, con mingw-w64 e NSIS)
#  Produce in dist/windows/:
#    ProfessoreDigitale-Setup-X.Y.Z.exe   installatore unico (Windows XP SP3 -> Windows 11, 32 e 64 bit)
#    professore-digitale-windows-X.Y.Z.zip versione "da chiavetta" (senza installazione)
#  Uso:  windows/build-windows.sh            (lo chiama anche ./build.sh, se gli strumenti ci sono)
#  Strumenti:  sudo apt install mingw-w64 nsis libz-mingw-w64-dev   (tools/prepara-ambiente.sh li installa)
#  Autore: Danilo D'Auria - Licenza MIT
# ==============================================================================
set -euo pipefail
cd "$(dirname "$0")/.."
SOLO_APP=0; [ "${1:-}" = "--solo-app" ] && SOLO_APP=1      # solo la cartella dell'applicazione (per i test)
ROOT=$(pwd)
VERSION=$(tr -d ' \n' < VERSION)
IFS=. read -r V1 V2 V3 <<< "$VERSION"
source ./rilascio.conf
W=build/windows; OUT=dist/windows
rm -rf "$W"; mkdir -p "$W/obj32" "$W/obj64" "$W/app" "$OUT"
for t in i686-w64-mingw32-gcc x86_64-w64-mingw32-gcc makensis; do
  command -v $t >/dev/null || { echo "Manca $t: eseguite tools/prepara-ambiente.sh"; exit 1; }
done

# ---- componenti di terze parti (scaricati una volta e verificati con SHA-256) ----
CACHE="${PD_CACHE:-$HOME/.cache/professore-digitale}"; mkdir -p "$CACHE"
VOSK_WHL=vosk-0.3.45-py3-none-win_amd64.whl
VOSK_SHA=6994ddc68556c7e5730c3b6f6bad13320e3519b13ce3ed2aa25a86724e7c10ac
VOSK_URL=https://files.pythonhosted.org/packages/c0/4c/deb0861f7da9696f8a255f1731bb73e9412cca29c4b3888a3fcb2a930a59/$VOSK_WHL
if [ ! -f "$CACHE/$VOSK_WHL" ] || ! echo "$VOSK_SHA  $CACHE/$VOSK_WHL" | sha256sum -c --quiet 2>/dev/null; then
  echo "» Scarico il motore Vosk per Windows (PyPI)"
  curl -fsSL -o "$CACHE/$VOSK_WHL.part" "$VOSK_URL" && mv "$CACHE/$VOSK_WHL.part" "$CACHE/$VOSK_WHL"
fi
echo "$VOSK_SHA  $CACHE/$VOSK_WHL" | sha256sum -c --quiet || { echo "Impronta di Vosk non valida"; exit 1; }

# ---- risorse (icona, manifest, informazioni di versione) ----
mkres() {  # mkres NOME DESCRIZIONE ARCH-windres FILE.o [senza-icona]
  sed "s/@VERSION@/$VERSION/g; s/@V1@/$V1/g; s/@V2@/$V2/g; s/@V3@/$V3/g; s/@NAME@/$1/g; s/@DESC@/$2/g" windows/res/app.rc.in > "$W/$1.rc"
  [ "${5:-}" = senza-icona ] && sed -i '/ICON\|MANIFEST/d' "$W/$1.rc"
  (cd windows/res && "$3" "$ROOT/$W/$1.rc" -O coff -o "$ROOT/$4")
}
echo "» Compilo il programma (32 bit: gira da Windows XP a Windows 11)"
CF="-O2 -Wall -Wextra -Wno-unused-parameter -Wno-cast-function-type -Wno-missing-field-initializers -D_WIN32_WINNT=0x0501 -DWINVER=0x0501 -D_WIN32_IE=0x0600 -DUNICODE -D_UNICODE -D__USE_MINGW_ANSI_STDIO=1 -municode -fno-stack-protector"
OBJS=()
for f in windows/src/pd_*.c; do
  n=$(basename "$f" .c); [ "$n" = pd_stt_main ] && continue
  i686-w64-mingw32-gcc $CF -c "$f" -o "$W/obj32/$n.o"; OBJS+=("$W/obj32/$n.o")
done
mkres ProfessoreDigitale "Professore Digitale - Cattedra Digitale Portatile" i686-w64-mingw32-windres "$W/obj32/res.o"
i686-w64-mingw32-gcc -municode -mwindows -static -static-libgcc -s -o "$W/app/ProfessoreDigitale.exe" "${OBJS[@]}" "$W/obj32/res.o" \
  -lws2_32 -lwinhttp -lole32 -loleaut32 -luuid -lshell32 -lcomdlg32 -ladvapi32 -luser32 -lgdi32 -lz \
  -Wl,--major-subsystem-version,5,--minor-subsystem-version,1,--major-os-version,5,--minor-os-version,1
echo "» Compilo il riconoscimento vocale (64 bit)"
mkres pd-stt "Professore Digitale - riconoscimento vocale offline" x86_64-w64-mingw32-windres "$W/obj64/res.o" senza-icona
mkdir -p "$W/app/stt"
x86_64-w64-mingw32-gcc -O2 -Wall -municode -mconsole -static -s -o "$W/app/stt/pd-stt.exe" windows/src/pd_stt_main.c "$W/obj64/res.o"
python3 - "$CACHE/$VOSK_WHL" "$W/app/stt" <<'PY'
import sys, zipfile, os
z = zipfile.ZipFile(sys.argv[1])
for n in z.namelist():
    if n.startswith("vosk/") and n.endswith(".dll"):
        open(os.path.join(sys.argv[2], os.path.basename(n)), "wb").write(z.read(n))
PY

# ---- controllo: solo funzioni presenti in Windows XP SP3 ----
python3 windows/tools/controlla_xp.py "$W/app/ProfessoreDigitale.exe"

echo "» Albero dell'applicazione"
A="$W/app"
cp VERSION "$A/VERSION"
cp -r src/web "$A/web"; rm -f "$A/web/vendor/mermaid.LICENSE"
mkdir -p "$A/contenuti" "$A/web/docs"
cp src/contenuti/*.json "$A/contenuti/" 2>/dev/null || true
cp windows/contenuti/*.json "$A/contenuti/" 2>/dev/null || true
cp windows/catalogo-ia.json "$A/catalogo-ia.json"
[ -f docs/Vademecum_Professore_Digitale_Windows.pdf ] && cp docs/Vademecum_Professore_Digitale_Windows.pdf "$A/web/docs/" && cp docs/Vademecum_Professore_Digitale_Windows.pdf "$A/"
python3 -c 'import json,sys; json.dump({"aggiornamenti_url": sys.argv[1], "pagina": sys.argv[2]}, open(sys.argv[3],"w"), indent=1)' \
        "$AGGIORNAMENTI_URL" "$PAGINA_PROGETTO" "$A/distribuzione.json"
sed 's/$/\r/' windows/LICENZE.txt > "$A/LICENZE.txt"
{ echo "Professore Digitale $VERSION per Windows"; echo; sed -n '1,200p' windows/LEGGIMI.txt; } | sed 's/$/\r/' > "$A/LEGGIMI.txt"
cp windows/res/professore.ico "$A/professore.ico"
echo "» Voci naturali (Piper per Windows a 64 bit: Paola e Riccardo)"
source tools/voci.sh; prepara_voci
python3 - "$VOCI_CACHE/piper_windows_amd64.zip" "$A" <<'PY'
import sys, zipfile, os
z = zipfile.ZipFile(sys.argv[1]); dest = os.path.realpath(sys.argv[2])
for n in z.namelist():
    if not os.path.realpath(os.path.join(dest, n)).startswith(dest + os.sep): sys.exit("percorso non valido: " + n)
z.extractall(dest)
PY
rm -rf "$A/piper/pkgconfig"
mkdir -p "$A/voci"
cp "$VOCI_CACHE"/it_IT-paola-medium.onnx "$VOCI_CACHE"/it_IT-paola-medium.onnx.json "$VOCI_CACHE"/it_IT-riccardo-x_low.onnx "$VOCI_CACHE"/it_IT-riccardo-x_low.onnx.json "$A/voci/"

if [ "$SOLO_APP" = 1 ]; then echo "✔ Applicazione pronta in $A"; exit 0; fi
echo "» Installatore"
makensis -V2 -DVERSIONE="$VERSION" -DV1="$V1" -DV2="$V2" -DV3="$V3" -DSORGENTE="$ROOT/$A" -DUSCITA="$ROOT/$OUT/ProfessoreDigitale-Setup-$VERSION.exe" \
  -DICONA="$ROOT/windows/res/professore.ico" -DRISORSE="$ROOT/windows/res" windows/installer/professore-digitale.nsi
echo "» Versione da chiavetta (zip)"
rm -f "$OUT/professore-digitale-windows-$VERSION.zip"
(cd "$W" && cp -r app ProfessoreDigitale && printf 'Versione da chiavetta: i progressi restano nella cartella "dati" accanto al programma.\r\nCancellate questo file per salvarli invece nel profilo di Windows.\r\n' > ProfessoreDigitale/portatile.txt \
  && zip -qr9 "$ROOT/$OUT/professore-digitale-windows-$VERSION.zip" ProfessoreDigitale && rm -rf ProfessoreDigitale)
ls -la "$OUT"
echo "✔ Windows: $OUT/"
