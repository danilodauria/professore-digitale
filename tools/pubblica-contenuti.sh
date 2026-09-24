#!/bin/bash
# ==============================================================================
#  Professore Digitale - pubblica SOLO i contenuti (domande e lezioni), senza
#  una nuova versione del programma. Gli utenti li ricevono con un clic da
#  Impostazioni → Aggiornamenti → «Controlla aggiornamenti».
#  Uso:  tools/pubblica-contenuti.sh
#  Prima: aumentate il campo "versione" del pacchetto modificato in src/contenuti/
#  Autore: Danilo D'Auria - Licenza MIT
# ==============================================================================
set -euo pipefail
cd "$(dirname "$0")/.."
PUB=dist/pubblica
[ -f "$PUB/aggiornamenti.json" ] || { echo "Manca $PUB/aggiornamenti.json: eseguite prima tools/rilascio.sh"; exit 1; }
PD_SHARE_DIR=src python3 packaging/professore-digitale-contenuti valida src/contenuti/*.json
mkdir -p "$PUB/contenuti"; cp src/contenuti/*.json "$PUB/contenuti/"
python3 - "$PUB" <<'PY'
import glob, hashlib, json, os, sys
pub = sys.argv[1]; f = os.path.join(pub, "aggiornamenti.json")
info = json.load(open(f, encoding="utf-8")); vecchi = {c["id"]: c["versione"] for c in info.get("contenuti", [])}
info["contenuti"] = []
for p in sorted(glob.glob(os.path.join(pub, "contenuti", "*.json"))):
    d = json.load(open(p, encoding="utf-8"))
    info["contenuti"].append({"id": d["id"], "titolo": d["titolo"], "versione": d["versione"], "descrizione": d.get("descrizione", ""),
                              "url": "contenuti/" + os.path.basename(p), "sha256": hashlib.sha256(open(p, "rb").read()).hexdigest()})
    stato = "nuovo" if d["id"] not in vecchi else ("aggiornato " + vecchi[d["id"]] + " → " + d["versione"] if vecchi[d["id"]] != d["versione"] else "invariato")
    print("  %-28s v%-8s %s" % (d["id"], d["versione"], stato))
json.dump(info, open(f, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
PY
(cd "$PUB" && sha256sum -- *.deb *.html *.json contenuti/*.json 2>/dev/null > SHA256SUMS)
echo "✔ Contenuti aggiornati in $PUB/. Caricate di nuovo la cartella sul sito."
