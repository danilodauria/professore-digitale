#!/usr/bin/env python3
"""Professore Digitale - raccoglie i testi italiani dell'interfaccia da tradurre (dalla 3.7).

Avvia il server dai sorgenti con dati vuoti, apre con Chromium (Playwright) tutte le pagine e le sotto-pagine,
raccoglie i testi visibili e gli attributi (placeholder, title, aria-label, alt) e aggiunge i testi scritti nei file
JavaScript dell'interfaccia (avvisi, finestre). Esclude i CONTENUTI (lezioni, guida, pacchetti, quiz, banca delle
domande di Nonni Teach): quelli li traduce l'IA locale.
La prima volta scrive tools/i18n/lista.json (elenco FISSO delle chiavi: testo normalizzato, numeri → #, giorni → @g, mesi → @m);
poi scrive nuovi.json = i testi che i dizionari non conoscono ancora (da tradurre in extra.tsv).
Uso: python3 tools/i18n/estrai.py [--solo-pagine]
© Danilo D'Auria — codice MIT
"""
import glob
import json
import os
import re
import subprocess
import sys
import tempfile
import time

QUI = os.path.dirname(os.path.abspath(__file__))
RADICE = os.path.dirname(os.path.dirname(QUI))
sys.path.insert(0, QUI)
from chiavi import chiave, contenuti  # noqa: E402

PORTA = 18877
# pagine di CONTENUTO: i loro testi si traducono a mano solo se compaiono anche altrove (interfaccia)
RE_CONTENUTO = re.compile(r"^(lessons/.+|cultura/.+|fenice|libro|board/.+|enti/incontri/.+|enti/digcomp|competenze)$")
ROTTE = """home percorso percorso/inizia lessons ask board practice vita truffa lettera mente nonni nonni/nuova nonni/archivio
nonni/liberatoria quiz competenze cultura libro fenice aula enti enti/incontri enti/registro enti/digcomp editor settings
licenza sostieni tablet ripasso profili profili/scegli mente/diario setup""".split()

JS = r"""() => { const out=[]; const ok = t => t && /[A-Za-zÀ-ÿ]{2}/.test(t);
 const w=document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n;
 while(n=w.nextNode()){ const p=n.parentElement; if(!p||/SCRIPT|STYLE|TEXTAREA|CODE|PRE/.test(p.tagName)) continue;
   if(p.closest('[data-no-trad],pre,code,.msg.user,.msg.bot.da-ia,#print-area,[hidden]')) continue;
   const t=n.nodeValue.replace(/\s+/g,' ').trim(); if(ok(t)) out.push(t); }
 document.querySelectorAll('[placeholder],[title],[aria-label],[alt]').forEach(e=>{ if(e.closest('[data-no-trad],[hidden]')) return;
   ['placeholder','title','aria-label','alt'].forEach(a=>{const v=e.getAttribute(a); if(ok(v)) out.push(v.replace(/\s+/g,' ').trim());});});
 document.querySelectorAll('input[type=button],input[type=submit]').forEach(e=>{ if(ok(e.value)) out.push(e.value.trim()); });
 return out; }"""


RE_CODICE = re.compile(r"\.replace\(|/g\b|\+ ?['\"]|['\"] ?\+|//|\\\\[sdwb]|-m[a-z]\">|^[a-z0-9 _-]+-[a-z0-9 _-]+$")


def pulisci_pezzo(t):
    """Toglie i resti di HTML e di codice dai testi letti nei file JavaScript; None se non è un testo."""
    t = re.sub(r"^.*?['\"]\s*>(?=\S)", "", t) if re.match(r"^[^A-Za-zÀ-ÿ]*['\"]\s*>|^\)\s*\+\s*'", t) else t
    t = t.lstrip(">").strip()
    if not t or RE_CODICE.search(t):
        return None
    return t


def rotte_dinamiche(pg):
    return pg.evaluate("""() => {
      const r = [];
      (window.PD_LESSONS || (PD.lessons && PD.lessons()) || []).forEach(l => { if (l && l.id) r.push('lessons/' + l.id); });
      if (PD.vita && PD.vita.simulatori) PD.vita.simulatori().forEach(s => r.push('vita/' + s.id));
      if (PD.mente && PD.mente.giochi) PD.mente.giochi().forEach(g => r.push('mente/' + g.id));
      ['click','dblclick','drag','typing','scroll','rightclick','copypaste','select','keys','memory','scam'].forEach(x => r.push('practice/' + x));
      document.querySelectorAll('[data-go^="#/"]').forEach(a => r.push(a.getAttribute('data-go').slice(2)));
      return r; }""")


def main():
    from playwright.sync_api import sync_playwright
    dati = tempfile.mkdtemp()
    env = dict(os.environ, PD_DATA_DIR=dati, HOME=tempfile.mkdtemp(), OLLAMA_HOST="http://127.0.0.1:9")
    srv = subprocess.Popen([sys.executable, "-B", os.path.join(RADICE, "src/server/pd_server.py"), "--port", str(PORTA), "--idle-timeout", "0"],
                           env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    visti, trovati = set(), {}
    try:
        time.sleep(2.5)
        with sync_playwright() as p:
            b = p.chromium.launch()
            pg = b.new_page(viewport={"width": 1366, "height": 900})
            base = "http://127.0.0.1:%d/?nosaluto&noprofilo&nopercorso#/" % PORTA
            coda = list(ROTTE)
            pg.goto(base + "home"); pg.wait_for_timeout(2500)
            coda += rotte_dinamiche(pg)
            while coda:
                r = coda.pop(0)
                if r in visti or len(visti) > 400 or "'" in r:
                    continue
                visti.add(r)
                try:
                    pg.goto(base + r); pg.wait_for_timeout(900)
                    for s in pg.evaluate(JS):
                        trovati.setdefault(s, set()).add(r)
                    for x in pg.evaluate("() => Array.from(document.querySelectorAll('[data-go^=\"#/\"]')).map(a => a.getAttribute('data-go').slice(2))"):
                        if x not in visti and len(x.split("/")) <= 3:
                            coda.append(x)
                except Exception as e:  # pagina che non si apre: si va avanti
                    print("!", r, e)
            b.close()
    finally:
        srv.terminate()
    # testi scritti nei file JavaScript (avvisi, finestre, pulsanti creati al volo)
    for f in sorted(glob.glob(os.path.join(RADICE, "src/web/js/*.js"))):
        nome = os.path.basename(f)
        if nome.startswith("data-") or nome in ("i18n.js", "qr.js", "compat.js"):
            continue
        testo = open(f, encoding="utf-8").read()
        for m in re.finditer(r'"((?:[^"\\\n]|\\.){3,600})"|\'((?:[^\'\\\n]|\\.){3,600})\'', testo):
            lit = (m.group(1) or m.group(2) or "").replace("\\'", "'").replace('\\"', '"').replace("\\n", " ")
            for pezzo in re.split(r"<[^>]*>", lit):
                pezzo = re.sub(r"\s+", " ", pezzo.replace("&nbsp;", " ")).strip()
                if len(pezzo) < 3 or not re.search(r"[a-zà-ù]{2,}\s+[a-zà-ù]|^[A-ZÈ][a-zà-ù]+[ .!?…:]|[àèéìòù]", pezzo):
                    continue
                if re.search(r"[{};=]|^\w+\(|\bfunction\b|\bvar\b|^[\w.-]+$|https?:|\.js$|#/", pezzo):
                    continue
                pezzo = pulisci_pezzo(pezzo)
                if pezzo:
                    trovati.setdefault(pezzo, set()).add("js:" + nome)
    # contenuti: pacchetti, lezioni, guida, Nonni Teach, FeniceOS, incontri, DigComp (anche a pezzi: sottostringhe di 12+ caratteri)
    escludi = contenuti(RADICE, piu=("data-fenice.js", "data-incontri.js", "data-digcomp.js"))
    corpus = chiave("\n".join(escludi))
    escludi_k = set(chiave(x) for x in escludi)
    lista = {}
    for s, dove in trovati.items():
        k = chiave(s)
        if k in escludi_k or len(k) > 200 or (len(k) >= 12 and k in corpus):
            continue
        ui = [d for d in dove if not RE_CONTENUTO.match(d)]
        if not ui:
            continue
        if any(d == "js:mente-giochi.js" for d in ui) and "|" in s:   # parole e frasi dei giochi (italiane per natura)
            continue
        lista.setdefault(k, sorted(ui)[0])
    chiavi = sorted(lista)
    # lista.json è FISSA (gli indici dei lotti t*.tsv puntano lì): i testi nuovi vanno in nuovi.json → da tradurre in extra.tsv
    noti = set()
    try:
        noti = set(json.load(open(os.path.join(RADICE, "src/web/i18n/en.json"), encoding="utf-8"))["t"])
    except (OSError, ValueError, KeyError):
        pass
    if not os.path.exists(os.path.join(QUI, "lista.json")):
        json.dump([[k, lista[k]] for k in chiavi], open(os.path.join(QUI, "lista.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=0)
    nuovi = [[k, lista[k]] for k in chiavi if k not in noti]
    json.dump(nuovi, open(os.path.join(QUI, "nuovi.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=0)
    print("pagine visitate:", len(visti), " testi:", len(chiavi), " caratteri:", sum(len(k) for k in chiavi),
          " senza traduzione (nuovi.json):", len(nuovi))


if __name__ == "__main__":
    main()
