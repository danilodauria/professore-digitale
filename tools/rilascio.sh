#!/bin/bash
# ==============================================================================
#  Professore Digitale - preparazione di una NUOVA VERSIONE
#  Autore: Danilo D'Auria - Licenza MIT
#
#  Uso:
#    tools/rilascio.sh correzione  "Nota 1" "Nota 2" ...   2.1.0 -> 2.1.1  (solo correzioni)
#    tools/rilascio.sh minore      "Nota 1" ...            2.1.0 -> 2.2.0  (novità compatibili, nuovi contenuti)
#    tools/rilascio.sh maggiore    "Nota 1" ...            2.1.0 -> 3.0.0  (grandi cambiamenti)
#    tools/rilascio.sh 2.5.0       "Nota 1" ...            versione esplicita
#  Opzioni:
#    --senza-test   salta i test automatici (sconsigliato)
#    --senza-git    non crea commit e tag git
#    --apt          genera anche il repository APT firmato (serve una chiave GPG)
#
#  Risultato: cartella dist/pubblica/ pronta da caricare sul sito (GitHub Pages):
#    aggiornamenti.json, pacchetto .deb, versione portatile, contenuti, note, SHA256SUMS
# ==============================================================================
set -euo pipefail
cd "$(dirname "$0")/.."
source ./rilascio.conf

TEST=1; GIT=1; APT=0; ARGS=()
for a in "$@"; do
  case "$a" in
    --senza-test) TEST=0 ;; --senza-git) GIT=0 ;; --apt) APT=1 ;;
    -h|--help) sed -n '2,21p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) ARGS+=("$a") ;;
  esac
done
[ ${#ARGS[@]} -ge 2 ] || { echo "Serve il tipo di versione e almeno una nota. Vedi: tools/rilascio.sh --help"; exit 1; }
TIPO="${ARGS[0]}"; NOTE=("${ARGS[@]:1}")

ATTUALE=$(tr -d ' \n' < VERSION)
IFS=. read -r MA MI PA <<< "$ATTUALE"
case "$TIPO" in
  correzione|patch) NUOVA="$MA.$MI.$((PA + 1))" ;;
  minore|minor)     NUOVA="$MA.$((MI + 1)).0" ;;
  maggiore|major)   NUOVA="$((MA + 1)).0.0" ;;
  *) NUOVA="$TIPO" ;;
esac
[[ "$NUOVA" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "Versione non valida: $NUOVA"; exit 1; }
python3 -c "import sys; a=tuple(map(int,sys.argv[1].split('.'))); b=tuple(map(int,sys.argv[2].split('.'))); sys.exit(0 if b>a else 1)" "$ATTUALE" "$NUOVA" \
  || { echo "La nuova versione ($NUOVA) deve essere maggiore di quella attuale ($ATTUALE)"; exit 1; }

if [ "$GIT" = 1 ] && [ -d .git ] && [ -n "$(git status --porcelain)" ]; then
  echo "! Ci sono modifiche non ancora salvate in git: verranno incluse nel commit della versione $NUOVA."
fi
echo "» Preparo la versione $NUOVA (attuale: $ATTUALE)"

# ---- 1. numero di versione e registro delle modifiche ----
cp VERSION /tmp/.pd-VERSION.bak; cp packaging/changelog /tmp/.pd-changelog.bak
ripristina() { cp /tmp/.pd-VERSION.bak VERSION; cp /tmp/.pd-changelog.bak packaging/changelog; echo "  (VERSION e changelog riportati alla versione $ATTUALE)"; }
echo "$NUOVA" > VERSION
DATA_R=$(LC_ALL=C date -R); DATA_ISO=$(date +%Y-%m-%d)
{
  echo "professore-digitale ($NUOVA) stable; urgency=medium"; echo
  for n in "${NOTE[@]}"; do echo "$n" | fold -s -w 72 | sed '1s/^/  * /; 2,$s/^/    /' | sed 's/ *$//'; done
  echo; echo " -- $MANUTENTORE  $DATA_R"; echo
  cat packaging/changelog
} > packaging/changelog.nuovo
mv packaging/changelog.nuovo packaging/changelog

# ---- 2. test automatici ----
if [ "$TEST" = 1 ]; then
  echo "» Test automatici"
  if ! tests/esegui_test.sh; then
    echo "✘ I test non sono passati: correggete i problemi e rilanciate lo stesso comando."
    ripristina
    exit 1
  fi
fi

# ---- 3. compilazione ----
./build.sh || { echo "✘ Compilazione non riuscita."; ripristina; exit 1; }

# ---- 4. cartella da pubblicare ----
PUB=dist/pubblica; rm -rf "$PUB"; mkdir -p "$PUB/contenuti" archivio
cp "dist/professore-digitale_${NUOVA}_all.deb" dist/professore-digitale-portatile.html "$PUB/"
cp "dist/professore-digitale_${NUOVA}_all.deb" archivio/
mkdir -p "$ARCHIVIO" 2>/dev/null && cp "dist/professore-digitale_${NUOVA}_all.deb" "$ARCHIVIO/" 2>/dev/null || true
[ -d dist/contenuti ] && cp dist/contenuti/*.json "$PUB/contenuti/" 2>/dev/null || true
[ -f docs/Vademecum_Professore_Digitale.pdf ] && cp docs/Vademecum_Professore_Digitale.pdf "$PUB/"
python3 - "$NUOVA" "$DATA_ISO" "$PAGINA_PROGETTO" "$PUB" "${NOTE[@]}" <<'PY'
import hashlib, json, os, sys, glob
ver, data, pagina, pub, note = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5:]
sha = lambda p: hashlib.sha256(open(p, "rb").read()).hexdigest()
deb = "professore-digitale_%s_all.deb" % ver
contenuti = []
for f in sorted(glob.glob(os.path.join(pub, "contenuti", "*.json"))):
    p = json.load(open(f, encoding="utf-8"))
    contenuti.append({"id": p["id"], "titolo": p["titolo"], "versione": p["versione"],
                      "descrizione": p.get("descrizione", ""), "url": "contenuti/" + os.path.basename(f), "sha256": sha(f)})
info = {"versione": ver, "data": data, "note": note, "pacchetto": deb, "sha256": sha(os.path.join(pub, deb)),
        "portatile": "professore-digitale-portatile.html", "pagina": pagina, "contenuti": contenuti}
json.dump(info, open(os.path.join(pub, "aggiornamenti.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
with open(os.path.join(pub, "version.txt"), "w") as f:     # compatibilita' con la versione 2.0.0
    f.write(ver + "\n")
with open(os.path.join(pub, "NOTE-%s.md" % ver), "w", encoding="utf-8") as f:
    f.write("# Professore Digitale %s (%s)\n\n" % (ver, data) + "".join("- %s\n" % n for n in note) +
            "\n## Installazione o aggiornamento\n\n```\nsudo apt install ./%s\n```\n\nImpostazioni e progressi degli allievi vengono conservati.\n" % deb)
PY
(cd "$PUB" && sha256sum -- *.deb *.html *.json contenuti/*.json 2>/dev/null > SHA256SUMS)

# ---- 5. repository APT (facoltativo) ----
[ "$APT" = 1 ] && tools/repo-apt.sh "$PUB/apt"

# ---- 6. git ----
# version.txt nella radice del progetto: lo leggono le installazioni 2.0.0 (controllo aggiornamenti originale)
cp "$PUB/version.txt" version.txt
if [ "$GIT" = 1 ] && [ -d .git ]; then
  git add -A
  git -c user.name="${MANUTENTORE% <*}" -c user.email="$(echo "$MANUTENTORE" | sed 's/.*<\(.*\)>.*/\1/')" commit -qm "Versione $NUOVA" || true
  git tag -a "v$NUOVA" -m "Versione $NUOVA" 2>/dev/null || echo "! tag v$NUOVA già esistente"
  echo "» Git: commit e tag v$NUOVA creati"
fi

echo
echo "✔ Versione $NUOVA pronta in $PUB/"
ls -1 "$PUB"
echo
echo "Prossimi passi:"
echo "  1. Provate il pacchetto su un PC di prova:  sudo apt install ./$PUB/professore-digitale_${NUOVA}_all.deb"
echo "  2. Pubblicate:  tools/pubblica-tutto.sh   (GitHub)   oppure   tools/pubblica-locale.sh --cartella DEST   (senza GitHub)"
echo "     Copia di sicurezza senza GitHub:  tools/backup-locale.sh /media/\$USER/CHIAVETTA"
echo "  3. Dagli altri PC: Impostazioni → Aggiornamenti → «Controlla aggiornamenti»."
