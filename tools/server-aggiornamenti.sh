#!/bin/bash
# ==============================================================================
#  Professore Digitale - server degli aggiornamenti in RETE LOCALE
#  Un PC dell'aula (o un Raspberry Pi) mette a disposizione degli altri PC la
#  cartella preparata con tools/pubblica-locale.sh. Nessun Internet necessario.
#
#  Uso:  tools/server-aggiornamenti.sh CARTELLA [--porta 8080]            (finché la finestra resta aperta)
#        tools/server-aggiornamenti.sh CARTELLA [--porta 8080] --servizio  (sempre attivo, anche dopo il riavvio)
#        tools/server-aggiornamenti.sh --ferma-servizio
#  Autore: Danilo D'Auria - Licenza MIT
# ==============================================================================
set -euo pipefail
DIR=""; PORTA=8080; SERV=0
UNIT="$HOME/.config/systemd/user/professore-digitale-aggiornamenti.service"
while [ $# -gt 0 ]; do
  case "$1" in
    --porta) PORTA="${2:?}"; shift 2 ;;
    --servizio) SERV=1; shift ;;
    --ferma-servizio) systemctl --user disable --now professore-digitale-aggiornamenti.service 2>/dev/null || true
                      rm -f "$UNIT"; echo "Servizio fermato e rimosso."; exit 0 ;;
    -h|--help) sed -n '2,11p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) DIR="$1"; shift ;;
  esac
done
[ -n "$DIR" ] && [ -f "$DIR/aggiornamenti.json" ] || { echo "Indicate la cartella preparata con tools/pubblica-locale.sh"; exit 1; }
DIR=$(cd "$DIR" && pwd)
IPS=$(hostname -I 2>/dev/null | tr ' ' '\n' | grep -E '^(10|172\.(1[6-9]|2[0-9]|3[01])|192\.168)\.' || true)

echo "Indirizzo da scrivere nel Professore Digitale (Impostazioni → Aggiornamenti):"
if [ -n "$IPS" ]; then for ip in $IPS; do echo "    http://$ip:$PORTA/aggiornamenti.json"; done
else echo "    http://INDIRIZZO-DI-QUESTO-PC:$PORTA/aggiornamenti.json   (vedi: hostname -I)"; fi
echo "Se il PC ha un firewall attivo, aprite la porta:  sudo ufw allow $PORTA/tcp"

if [ "$SERV" = 1 ]; then
  mkdir -p "$(dirname "$UNIT")"
  cat > "$UNIT" <<EOS
[Unit]
Description=Professore Digitale - server degli aggiornamenti in rete locale
After=network-online.target

[Service]
ExecStart=/usr/bin/python3 -m http.server $PORTA --bind 0.0.0.0 --directory "$DIR"
Restart=on-failure

[Install]
WantedBy=default.target
EOS
  systemctl --user daemon-reload && systemctl --user enable --now professore-digitale-aggiornamenti.service
  loginctl enable-linger "$USER" 2>/dev/null || echo "Per tenerlo attivo anche senza accesso utente:  sudo loginctl enable-linger $USER"
  echo "✔ Servizio attivo. Per fermarlo:  tools/server-aggiornamenti.sh --ferma-servizio"
else
  echo "Server attivo (chiudete con Ctrl+C)…"
  exec python3 -m http.server "$PORTA" --bind 0.0.0.0 --directory "$DIR"
fi
