#!/bin/bash
# Professore Digitale - voci naturali incluse nei pacchetti (Piper, licenza MIT; voci italiane Paola e Riccardo)
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
  "it_IT-riccardo-x_low.onnx|$VOCI_HF/riccardo/x_low/it_IT-riccardo-x_low.onnx|1368de15f123275a7ef951c9e5e30be0f58a032daa14a0da44037443c1d1d21b"
  "it_IT-riccardo-x_low.onnx.json|$VOCI_HF/riccardo/x_low/it_IT-riccardo-x_low.onnx.json|146ab9c634afe524e9fb7530f2510df7a42fb1db56b52658ca1fb3d98001a62a"
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
