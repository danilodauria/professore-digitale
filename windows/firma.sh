#!/bin/bash
# Professore Digitale - firma digitale (Authenticode) dei programmi per Windows.
# Senza firma, Windows 11 con «Controllo intelligente delle app» (Sicurezza di Windows) blocca il programma e
# SmartScreen mostra «Windows ha protetto il PC». Con un certificato di firma del codice emesso da un'autorità
# riconosciuta da Microsoft il blocco sparisce (SmartScreen si fida del nome dopo qualche download).
#
# Uso:   windows/firma.sh FILE...        (lo chiama da solo windows/build-windows.sh, se la firma è configurata)
#        windows/firma.sh --prova        dice se la firma è configurata e come
# Configurazione (una delle tre, in variabili d'ambiente o nel file ~/.config/professore-digitale/firma.conf):
#   1) file .pfx/.p12:   PD_FIRMA_PFX=/percorso/certificato.pfx   PD_FIRMA_PASSWORD=...
#   2) chiavetta o servizio PKCS#11 (es. Certum SimplySign, YubiKey):
#        PD_FIRMA_PKCS11_MODULE=/usr/lib/.../libmodulo.so   PD_FIRMA_CERT=/percorso/certificato.pem
#        PD_FIRMA_PKCS11_KEY="pkcs11:..."   (PIN in PD_FIRMA_PIN, oppure lo chiede il modulo)
#   3) comando su misura (es. SignPath, Azure Artifact Signing):  PD_FIRMA_COMANDO='mio-firmatore --in "{}"'
#   Facoltativo: PD_FIRMA_TS (server di marca temporale, predefinito http://time.certum.pl)
# Serve osslsigncode (sudo apt install osslsigncode) per i casi 1 e 2.
# Autore: Danilo D'Auria - Licenza MIT
set -euo pipefail
CONF="${PD_FIRMA_CONF:-$HOME/.config/professore-digitale/firma.conf}"
[ -f "$CONF" ] && . "$CONF"
TS="${PD_FIRMA_TS:-http://time.certum.pl}"
NOME="Professore Digitale"
SITO="https://github.com/danilodauria/professore-digitale"

modo() {
  if [ -n "${PD_FIRMA_COMANDO:-}" ]; then echo comando
  elif [ -n "${PD_FIRMA_PFX:-}" ]; then echo pfx
  elif [ -n "${PD_FIRMA_PKCS11_MODULE:-}" ]; then echo pkcs11
  else echo nessuno; fi
}

if [ "${1:-}" = "--prova" ]; then
  m=$(modo)
  if [ "$m" = nessuno ]; then echo "Firma NON configurata: i programmi per Windows non saranno firmati (vedi windows/firma.sh)."; exit 1; fi
  echo "Firma configurata ($m)."; exit 0
fi

M=$(modo)
[ "$M" = nessuno ] && { echo "  (firma non configurata: salto)"; exit 0; }
if [ "$M" != comando ] && ! command -v osslsigncode >/dev/null; then
  echo "✘ Serve osslsigncode per firmare: sudo apt install osslsigncode"; exit 1
fi

for f in "$@"; do
  [ -f "$f" ] || continue
  if [ "$M" != comando ] && osslsigncode extract-signature -in "$f" -out "$f.firma-esistente" >/dev/null 2>&1; then
    rm -f "$f.firma-esistente"
    echo "  = ha già una firma (la lascio): $(basename "$f")"; continue
  fi
  tmp="$f.firmato"
  case "$M" in
    comando) eval "${PD_FIRMA_COMANDO//\{\}/$f}" ;;
    pfx) osslsigncode sign -pkcs12 "$PD_FIRMA_PFX" ${PD_FIRMA_PASSWORD:+-pass "$PD_FIRMA_PASSWORD"} \
           -n "$NOME" -i "$SITO" -h sha256 ${TS:+$([ "$TS" = none ] || echo -t "$TS")} -in "$f" -out "$tmp" >/dev/null && mv "$tmp" "$f" ;;
    pkcs11) osslsigncode sign -pkcs11module "$PD_FIRMA_PKCS11_MODULE" -certs "$PD_FIRMA_CERT" -key "$PD_FIRMA_PKCS11_KEY" \
           ${PD_FIRMA_PIN:+-pass "$PD_FIRMA_PIN"} -n "$NOME" -i "$SITO" -h sha256 ${TS:+$([ "$TS" = none ] || echo -t "$TS")} -in "$f" -out "$tmp" >/dev/null && mv "$tmp" "$f" ;;
  esac
  echo "  ✔ firmato: $(basename "$f")"
done
