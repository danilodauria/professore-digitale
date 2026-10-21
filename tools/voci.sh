#!/bin/bash
# Professore Digitale - voci naturali incluse nei pacchetti
#  - dalla 3.8 Kokoro (Apache 2.0) con il motore sherpa-onnx (Apache 2.0): Nicola (uomo, voce del Professore) e Sara (donna),
#    per Linux x86_64 e Windows a 64 bit (libreria condivisa: il modello resta caricato in un processo separato)
#  - Piper (licenza MIT) con le voci italiane Giorgio, Serena e Paola, anche per Linux ARM e per i PC più lenti
# Dalla 3.3 Riccardo (qualità x_low, suono meccanico) è sostituito da Giorgio (uomo) e Serena (donna), voci della comunità
# con licenza CC BY 4.0. I loro file .onnx.json, ripuliti per il motore Piper incluso, stanno in packaging/voci/.
# Si usa con:  source tools/voci.sh; prepara_voci
# Scarica una sola volta nella cache ($PD_CACHE, predefinita ~/.cache/professore-digitale/voci) e verifica ogni file con SHA-256.
# Autore: Danilo D'Auria - Licenza MIT
VOCI_CACHE="${PD_CACHE:-$HOME/.cache/professore-digitale}/voci"
PIPER_TAG=2023.11.14-2
SHERPA_VER=v1.13.8
VOCI_HF=https://huggingface.co/rhasspy/piper-voices/resolve/main/it/it_IT
VOCI_FILE=(
  "piper_linux_x86_64.tar.gz|https://github.com/rhasspy/piper/releases/download/$PIPER_TAG/piper_linux_x86_64.tar.gz|a50cb45f355b7af1f6d758c1b360717877ba0a398cc8cbe6d2a7a3a26e225992"
  "piper_linux_aarch64.tar.gz|https://github.com/rhasspy/piper/releases/download/$PIPER_TAG/piper_linux_aarch64.tar.gz|fea0fd2d87c54dbc7078d0f878289f404bd4d6eea6e7444a77835d1537ab88eb"
  "piper_windows_amd64.zip|https://github.com/rhasspy/piper/releases/download/$PIPER_TAG/piper_windows_amd64.zip|f3c58906402b24f3a96d92145f58acba6d86c9b5db896d207f78dc80811efcea"
  "it_IT-paola-medium.onnx|$VOCI_HF/paola/medium/it_IT-paola-medium.onnx|6fc918b5a0ea6137382833dddfa567bffbe6a5060c02043c87192ee59c04210c"
  "it_IT-paola-medium.onnx.json|$VOCI_HF/paola/medium/it_IT-paola-medium.onnx.json|aea19c0a7fce29fbc359b93f10e7902854401e4c95ae2ea328ae516b15d296cf"
  "it_IT-serena-medium.onnx|https://huggingface.co/committa/it_IT-serena-medium/resolve/main/it_IT-serena-medium.onnx|fe4e26b2c1236e2a44d2e295cad564d94a0d8b0a9fca1ccdfd70dd4af3116eb5"
  "kokoro-int8-multi-lang-v1_0.tar.bz2|https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/kokoro-int8-multi-lang-v1_0.tar.bz2|4c3052abaa60943a341f193888cf6abd68787dae6ab8ae5c925a706caa247e4e"
  "sherpa-onnx-$SHERPA_VER-linux-x64-shared.tar.bz2|https://github.com/k2-fsa/sherpa-onnx/releases/download/$SHERPA_VER/sherpa-onnx-$SHERPA_VER-linux-x64-shared.tar.bz2|c0bdb7907d3a74bba1d55d22bf4d9fa75586cf1530614ebe88a27b9118e015c4"
  "sherpa-onnx-$SHERPA_VER-win-x64-shared-MT-Release.tar.bz2|https://github.com/k2-fsa/sherpa-onnx/releases/download/$SHERPA_VER/sherpa-onnx-$SHERPA_VER-win-x64-shared-MT-Release.tar.bz2|6dffdc715a4465b989446a6105265d2cb345e7101591a17d35534b6758f6e8df"
  "it_IT-giorgio-medium.onnx|https://huggingface.co/kirys79/piper_italiano/resolve/main/Giorgio/giorgio-epoch%3D5028-step%3D1098436.onnx|6bfc837a53dd420a7d10e6d237eee2d7d276ee5cb3bf521bfa2b2446d0ff1dc9"
)
prepara_voci() {
  mkdir -p "$VOCI_CACHE"
  rm -f "$VOCI_CACHE/it_IT-leonardo-medium.onnx"   # provata e scartata prima della 3.8
  local riga nome url sha
  for riga in "${VOCI_FILE[@]}"; do
    IFS='|' read -r nome url sha <<< "$riga"
    if [ -f "$VOCI_CACHE/$nome" ] && echo "$sha  $VOCI_CACHE/$nome" | sha256sum -c --quiet 2>/dev/null; then continue; fi
    echo "» Scarico $nome"
    curl -fsSL -o "$VOCI_CACHE/$nome.part" "$url" && mv "$VOCI_CACHE/$nome.part" "$VOCI_CACHE/$nome" || { echo "Download di $nome non riuscito"; return 1; }
    echo "$sha  $VOCI_CACHE/$nome" | sha256sum -c --quiet || { echo "Impronta di $nome non valida"; rm -f "$VOCI_CACHE/$nome"; return 1; }
    rm -rf "$VOCI_CACHE/kokoro" "$VOCI_CACHE/sherpa"     # archivio nuovo: si estrae di nuovo
  done
  prepara_kokoro
}
# Kokoro estratto nella cache:  $VOCI_CACHE/kokoro/ = modello, voci, simboli, LICENSE e i dati di espeak-ng solo per
# italiano e inglese (le altre lingue non servono: 2 MB invece di 19);  $VOCI_CACHE/sherpa/{linux-x86_64,windows-x64}/ = librerie;
# $VOCI_CACHE/sherpa/include/ = c-api.h per compilare pd-kokoro.exe
KOKORO_DIR="$VOCI_CACHE/kokoro"; SHERPA_DIR="$VOCI_CACHE/sherpa"
prepara_kokoro() {
  if [ -f "$KOKORO_DIR/model.int8.onnx" ] && [ -f "$SHERPA_DIR/windows-x64/sherpa-onnx-c-api.dll" ]; then return 0; fi
  local t; t=$(mktemp -d) || return 1
  tar -xjf "$VOCI_CACHE/kokoro-int8-multi-lang-v1_0.tar.bz2" -C "$t" --no-same-owner || { rm -rf "$t"; return 1; }
  local k="$t/kokoro-int8-multi-lang-v1_0" f b
  rm -rf "$KOKORO_DIR"; mkdir -p "$KOKORO_DIR/espeak-ng-data"
  cp "$k/model.int8.onnx" "$k/voices.bin" "$k/tokens.txt" "$k/LICENSE" "$KOKORO_DIR/"
  for f in "$k/espeak-ng-data/"*; do
    b=$(basename "$f")
    case "$b" in *_dict) [ "$b" = it_dict ] || [ "$b" = en_dict ] || continue ;; esac
    cp -r "$f" "$KOKORO_DIR/espeak-ng-data/"
  done
  rm -rf "$SHERPA_DIR"; mkdir -p "$SHERPA_DIR/linux-x86_64" "$SHERPA_DIR/windows-x64" "$SHERPA_DIR/include"
  tar -xjf "$VOCI_CACHE/sherpa-onnx-$SHERPA_VER-linux-x64-shared.tar.bz2" -C "$t" --no-same-owner || { rm -rf "$t"; return 1; }
  tar -xjf "$VOCI_CACHE/sherpa-onnx-$SHERPA_VER-win-x64-shared-MT-Release.tar.bz2" -C "$t" --no-same-owner || { rm -rf "$t"; return 1; }
  cp "$t/sherpa-onnx-$SHERPA_VER-linux-x64-shared/lib/libsherpa-onnx-c-api.so" "$t/sherpa-onnx-$SHERPA_VER-linux-x64-shared/lib/libonnxruntime.so" "$SHERPA_DIR/linux-x86_64/"
  cp "$t/sherpa-onnx-$SHERPA_VER-win-x64-shared-MT-Release/lib/sherpa-onnx-c-api.dll" "$t/sherpa-onnx-$SHERPA_VER-win-x64-shared-MT-Release/lib/onnxruntime.dll" \
     "$t/sherpa-onnx-$SHERPA_VER-win-x64-shared-MT-Release/lib/onnxruntime_providers_shared.dll" "$SHERPA_DIR/windows-x64/"
  cp "$t/sherpa-onnx-$SHERPA_VER-linux-x64-shared/include/sherpa-onnx/c-api/c-api.h" "$SHERPA_DIR/include/"
  chmod 0644 "$SHERPA_DIR"/*/* "$KOKORO_DIR"/*.* "$KOKORO_DIR/LICENSE"
  rm -rf "$t"
}
copia_kokoro() {   # copia_kokoro CARTELLA → modello Kokoro (Nicola e Sara) pronto per il motore
  mkdir -p "$1" && cp -r "$KOKORO_DIR/." "$1/"
}
# file .onnx.json delle voci della comunità (già ripuliti) presi dai sorgenti
VOCI_JSON_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/packaging/voci"
VOCI_INCLUSE="it_IT-giorgio-medium it_IT-serena-medium it_IT-paola-medium"
copia_voci() {   # copia_voci CARTELLA_DESTINAZIONE  → .onnx e .onnx.json delle voci incluse
  local d="$1" v; mkdir -p "$d"
  for v in $VOCI_INCLUSE; do
    cp "$VOCI_CACHE/$v.onnx" "$d/"
    if [ -f "$VOCI_JSON_DIR/$v.onnx.json" ]; then cp "$VOCI_JSON_DIR/$v.onnx.json" "$d/"; else cp "$VOCI_CACHE/$v.onnx.json" "$d/"; fi
  done
}
