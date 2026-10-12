#!/bin/bash
# Professore Digitale - voci naturali incluse nei pacchetti (Piper, licenza MIT; voci italiane Giorgio, Serena e Paola)
# Dalla 3.3 Riccardo (qualità x_low, suono meccanico) è sostituito da Giorgio (uomo) e Serena (donna), voci della comunità
# con licenza CC BY 4.0. I loro file .onnx.json, ripuliti per il motore Piper incluso, stanno in packaging/voci/.
# Si usa con:  source tools/voci.sh; prepara_voci
# Scarica una sola volta nella cache ($PD_CACHE, predefinita ~/.cache/professore-digitale/voci) e verifica ogni file con SHA-256.
# Autore: Danilo D'Auria - Licenza MIT
VOCI_CACHE="${PD_CACHE:-$HOME/.cache/professore-digitale}/voci"
PIPER_TAG=2023.11.14-2
VOCI_HF=https://huggingface.co/rhasspy/piper-voices/resolve/main/it/it_IT
VOCI_FILE=(
  "piper_linux_x86_64.tar.gz|https://github.com/rhasspy/piper/releases/download/$PIPER_TAG/piper_linux_x86_64.tar.gz|a50cb45f355b7af1f6d758c1b360717877ba0a398cc8cbe6d2a7a3a26e225992"
  "piper_linux_aarch64.tar.gz|https://github.com/rhasspy/piper/releases/download/$PIPER_TAG/piper_linux_aarch64.tar.gz|fea0fd2d87c54dbc7078d0f878289f404bd4d6eea6e7444a77835d1537ab88eb"
  "piper_windows_amd64.zip|https://github.com/rhasspy/piper/releases/download/$PIPER_TAG/piper_windows_amd64.zip|f3c58906402b24f3a96d92145f58acba6d86c9b5db896d207f78dc80811efcea"
  "it_IT-paola-medium.onnx|$VOCI_HF/paola/medium/it_IT-paola-medium.onnx|6fc918b5a0ea6137382833dddfa567bffbe6a5060c02043c87192ee59c04210c"
  "it_IT-paola-medium.onnx.json|$VOCI_HF/paola/medium/it_IT-paola-medium.onnx.json|aea19c0a7fce29fbc359b93f10e7902854401e4c95ae2ea328ae516b15d296cf"
  "it_IT-serena-medium.onnx|https://huggingface.co/committa/it_IT-serena-medium/resolve/main/it_IT-serena-medium.onnx|fe4e26b2c1236e2a44d2e295cad564d94a0d8b0a9fca1ccdfd70dd4af3116eb5"
  "it_IT-giorgio-medium.onnx|https://huggingface.co/kirys79/piper_italiano/resolve/main/Giorgio/giorgio-epoch%3D5028-step%3D1098436.onnx|6bfc837a53dd420a7d10e6d237eee2d7d276ee5cb3bf521bfa2b2446d0ff1dc9"
)
prepara_voci() {
  mkdir -p "$VOCI_CACHE"
  local riga nome url sha
  for riga in "${VOCI_FILE[@]}"; do
    IFS='|' read -r nome url sha <<< "$riga"
    if [ -f "$VOCI_CACHE/$nome" ] && echo "$sha  $VOCI_CACHE/$nome" | sha256sum -c --quiet 2>/dev/null; then continue; fi
    echo "» Scarico $nome"
    curl -fsSL -o "$VOCI_CACHE/$nome.part" "$url" && mv "$VOCI_CACHE/$nome.part" "$VOCI_CACHE/$nome" || { echo "Download di $nome non riuscito"; return 1; }
    echo "$sha  $VOCI_CACHE/$nome" | sha256sum -c --quiet || { echo "Impronta di $nome non valida"; rm -f "$VOCI_CACHE/$nome"; return 1; }
  done
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
