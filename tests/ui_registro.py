"""Prove del registro presenze e del resoconto per l'ente (src/web/js/registro.js).
Chiamata da tests/test_ui.py:  prova(page, ROOT, check, SHOTS)
Crea un corso con 3 iscritti e 3 incontri da 2 ore, controlla i numeri del resoconto, il CSV,
la stampa e che il registro resti dopo aver ricaricato la pagina; alla fine rimette il registro di prima."""
import json, os, tempfile

ISCRITTI = ["Maria Rossi", "Giuseppe Verdi", "Anna Bianchi"]


def prova(page, ROOT, check, SHOTS):
    page.wait_for_function("window.PD && PD.registro && PD.registro.dati")
    vista_orig = page.viewport_size or {"width": 1366, "height": 800}
    tema_orig = page.evaluate("document.documentElement.getAttribute('data-theme')")
    copia = page.evaluate("JSON.stringify(PD.registro.dati())")
    errori = []
    page.on("pageerror", lambda e: errori.append(str(e)))

    def prepara(sezione):
        """Mostra il registro in un riquadro creato al volo dentro la vista #/enti (enti.js puo' non esserci ancora)."""
        page.evaluate("""(sez) => {
          var v = document.getElementById('view-enti');
          if (!v) { v = document.createElement('section'); v.id = 'view-enti'; document.querySelector('main, body').appendChild(v); }
          Array.prototype.forEach.call(v.children, function (c) { if (c.id !== 'rg-prova') { c.setAttribute('data-rg-nascosto', '1'); c.style.display = 'none'; } });
          if (v.hidden) {   // vista #/enti non ancora definita: la si mostra solo per la prova
            Array.prototype.forEach.call(document.querySelectorAll('section.view:not([hidden])'), function (x) { x.hidden = true; x.setAttribute('data-rg-rimetti', '1'); });
            v.hidden = false; v.setAttribute('data-rg-svelata', '1');
          }
          var d = document.getElementById('rg-prova');
          if (!d) { d = document.createElement('div'); d.id = 'rg-prova'; v.insertBefore(d, v.firstChild); }
          PD.registro.render(d, sez);
        }""", sezione)
        page.wait_for_selector("#rg-prova .rg")

    def pulisci_div():
        page.evaluate("""() => {
          var d = document.getElementById('rg-prova'); if (d) d.parentNode.removeChild(d);
          Array.prototype.forEach.call(document.querySelectorAll('[data-rg-nascosto]'), function (c) { c.style.display = ''; c.removeAttribute('data-rg-nascosto'); });
          Array.prototype.forEach.call(document.querySelectorAll('[data-rg-svelata]'), function (c) { c.hidden = true; c.removeAttribute('data-rg-svelata'); });
          Array.prototype.forEach.call(document.querySelectorAll('[data-rg-rimetti]'), function (c) { c.hidden = false; c.removeAttribute('data-rg-rimetti'); });
        }""")

    try:
        page.evaluate("PD.registro.ripristina({versione: 1, corsi: []})")
        page.goto(ROOT + "#/enti")
        page.wait_for_timeout(400)
        prepara("registro")
        B = "#rg-prova "
        check("registro: avviso di riservatezza", "solo su questo computer" in page.inner_text(B + ".rg-privacy"))

        # --- corso ---
        page.fill(B + "[data-nuovo=nome]", "Il computer senza paura")
        page.fill(B + "[data-nuovo=ente]", "Associazione Borgoprova Insieme")
        page.fill(B + "[data-nuovo=sede]", "Biblioteca di Borgoprova")
        page.fill(B + "[data-nuovo=facilitatore]", "Luca Facilitatore")
        page.fill(B + "[data-nuovo=inizio]", "2026-10-01")
        page.fill(B + "[data-nuovo=fine]", "2026-12-20")
        page.click(B + "[data-rg=crea-corso]")
        page.wait_for_selector(B + ".rg-iscritti")
        check("registro: corso creato", page.evaluate("PD.registro.dati().corsi.length === 1 && PD.registro.dati().corsi[0].ente === 'Associazione Borgoprova Insieme'"))

        # --- iscritti (anche con Invio) ---
        for i, n in enumerate(ISCRITTI):
            page.fill(B + ".rg-aggiungi input", n)
            if i == 2:
                page.press(B + ".rg-aggiungi input", "Enter")
            else:
                page.click(B + "[data-rg=aggiungi]")
        page.fill(B + ".rg-aggiungi input", "maria  rossi")
        page.click(B + "[data-rg=aggiungi]")
        check("registro: 3 iscritti (niente doppioni)", page.evaluate("PD.registro.dati().corsi[0].iscritti.length") == 3,
              page.evaluate("PD.registro.dati().corsi[0].iscritti.map(function(i){return i.nome})"))
        if page.evaluate("!!(PD.profili && PD.profili.elenco && PD.profili.elenco().length)"):
            check("registro: proposte le persone di questo computer", page.locator(B + "[data-rg=dal-pc]").count() == 1)

        # --- 3 incontri da 2 ore: tutti / Maria e Anna / solo Maria ---
        presenze = [None, ["Maria Rossi", "Anna Bianchi"], ["Maria Rossi"]]
        for k, data in enumerate(["2026-10-01", "2026-10-08", "2026-10-15"]):
            page.click(B + "[data-rg=nuovo-inc]")
            page.wait_for_selector(B + ".rg-appello")
            page.fill(B + ".rg-appello [data-m=data]", data)
            page.dispatch_event(B + ".rg-appello [data-m=data]", "change")
            page.fill(B + ".rg-appello [data-m=inizio]", "15:00"); page.dispatch_event(B + ".rg-appello [data-m=inizio]", "change")
            page.fill(B + ".rg-appello [data-m=fine]", "17:00"); page.dispatch_event(B + ".rg-appello [data-m=fine]", "change")
            if k == 0 and page.locator(B + ".rg-appello [data-m=incontroPronto]").count():
                page.select_option(B + ".rg-appello [data-m=incontroPronto]", index=1)
                check("registro: l'incontro pronto compila l'argomento", page.input_value(B + ".rg-appello [data-m=argomento]") != "")
            else:
                page.fill(B + ".rg-appello [data-m=argomento]", "Argomento %d" % (k + 1))
                page.dispatch_event(B + ".rg-appello [data-m=argomento]", "change")
            if presenze[k] is None:
                page.click(B + "[data-rg=tutti]")
            else:
                for n in presenze[k]:
                    page.click(B + ".rg-pres:has-text('%s')" % n)
            if k == 0:
                page.screenshot(path=SHOTS + "/registro-appello.png", full_page=False)
            page.click(B + "[data-rg=fatto]")
        n_lista = page.inner_text(B + ".rg-inc-lista")
        check("registro: elenco con i presenti", "3/3" in n_lista and "2/3" in n_lista and "1/3" in n_lista, n_lista)

        # elimina con conferma (incontro in piu')
        page.click(B + "[data-rg=nuovo-inc]"); page.click(B + "[data-rg=fatto]")
        check("registro: 4 incontri prima di eliminare", page.evaluate("PD.registro.dati().corsi[0].incontri.length") == 4)
        vuoto_id = page.evaluate("PD.registro.dati().corsi[0].incontri.filter(function(m){return !m.presenti.length})[0].id")
        page.click(B + "[data-rg=elimina][data-id='%s']" % vuoto_id)
        page.click(B + "[data-rg=no]")
        check("registro: «No» non elimina", page.evaluate("PD.registro.dati().corsi[0].incontri.length") == 4)
        page.click(B + "[data-rg=elimina][data-id='%s']" % vuoto_id)
        page.click(B + "[data-rg=elimina-si]")
        check("registro: incontro eliminato dopo conferma", page.evaluate("PD.registro.dati().corsi[0].incontri.length") == 3)
        page.screenshot(path=SHOTS + "/registro-1280.png", full_page=True)

        # --- numeri del resoconto ---
        s = page.evaluate("PD.registro.resoconto()")
        check("resoconto: 3 incontri, 6 ore", s["incontri"] == 3 and s["ore"] == 6, (s["incontri"], s["ore"]))
        check("resoconto: 6 presenze, 12 ore-persona", s["presenze"] == 6 and s["orePersona"] == 12, (s["presenze"], s["orePersona"]))
        check("resoconto: frequenza 66,7% e 3 partecipanti", s["frequenza"] == 66.7 and s["partecipanti"] == 3, (s["frequenza"], s["partecipanti"]))
        per = {p["nome"]: p for p in s["persone"]}
        check("resoconto: per persona", per["Maria Rossi"]["presenze"] == 3 and per["Maria Rossi"]["perc"] == 100 and
              per["Giuseppe Verdi"]["ore"] == 2 and per["Anna Bianchi"]["perc"] == 66.7, per)
        s2 = page.evaluate("PD.registro.resoconto(null, '2026-10-02', '')")
        check("resoconto: periodo dal 2/10", s2["incontri"] == 2 and s2["ore"] == 4 and s2["presenze"] == 3 and s2["partecipanti"] == 2,
              (s2["incontri"], s2["ore"], s2["presenze"]))

        # --- vista del resoconto ---
        prepara("resoconto")
        testo = page.inner_text(B + ".rg-numeri")
        check("resoconto: numeri a schermo", "66,7%" in testo and "12" in testo, testo)
        page.screenshot(path=SHOTS + "/registro-resoconto-1280.png", full_page=True)

        # CSV delle presenze dal pulsante (download intercettato)
        with page.expect_download() as dl:
            page.click(B + "[data-rg=csv-presenze]")
        d = dl.value
        cartella = tempfile.mkdtemp()
        percorso = os.path.join(cartella, "presenze.csv"); d.save_as(percorso)
        raw = open(percorso, "rb").read()
        check("csv: BOM UTF-8 e nome .csv", raw.startswith(b"\xef\xbb\xbf") and d.suggested_filename.endswith(".csv"), d.suggested_filename)
        righe = raw.decode("utf-8-sig").strip().split("\r\n")
        check("csv presenze: intestazione + 3 iscritti + 2 righe di totale", len(righe) == 6, righe)
        check("csv presenze: date in colonna", righe[0].startswith("Partecipante;01/10/2026 15:00-17:00;08/10/2026"), righe[0])
        r_maria = [r for r in righe if r.startswith("Maria Rossi;")]
        r_gius = [r for r in righe if r.startswith("Giuseppe Verdi;")]
        check("csv presenze: X e assente", r_maria and r_maria[0] == "Maria Rossi;X;X;X;3;6;100" and
              r_gius and r_gius[0] == "Giuseppe Verdi;X;assente;assente;1;2;33,3", (r_maria, r_gius))
        rie = page.evaluate("PD.registro.csvRiepilogo()")
        check("csv riepilogo: ore e frequenza", "Ore totali di formazione;6" in rie and "Frequenza media %;66,7" in rie and "Ore-persona;12" in rie, rie[:400])

        # --- stampa: si cattura l'HTML e si mostra l'anteprima con i fogli di stile di stampa ---
        page.evaluate("""() => { window.__stampa = null; window.__printOrig = window.print; window.print = function () {};
          window.__phOrig = PD.printHTML; PD.printHTML = function (h, o) { window.__stampa = h; return window.__phOrig(h, o); }; }""")
        page.click(B + "[data-rg=stampa]")
        page.wait_for_timeout(400)
        h = page.evaluate("window.__stampa") or ""
        check("stampa: intestazione, tabelle e firma", "Associazione Borgoprova Insieme" in h and "Luca Facilitatore" in h and
              "rg-firma" in h and "Registro delle presenze" in h and "Il computer senza paura" in h, h[:300])
        page.emulate_media(media="print")
        page.set_viewport_size({"width": 794, "height": 1123})
        page.screenshot(path=SHOTS + "/registro-stampa.png", full_page=True)
        page.emulate_media(media="screen")
        page.set_viewport_size(vista_orig)
        page.evaluate("""() => { window.print = window.__printOrig; PD.printHTML = window.__phOrig; document.body.classList.remove('printing');
          var s = document.getElementById('pd-print-page'); if (s) s.remove(); var a = document.getElementById('print-area'); if (a) a.innerHTML = ''; }""")

        # --- telefono e tema scuro ---
        page.set_viewport_size({"width": 390, "height": 844})
        prepara("registro")
        page.wait_for_timeout(200)
        larg = page.evaluate("[document.documentElement.scrollWidth, document.documentElement.clientWidth]")
        check("registro 390 px: niente scorrimento orizzontale", larg[0] <= larg[1] + 1, larg)
        page.screenshot(path=SHOTS + "/registro-390.png", full_page=True)
        prepara("resoconto")
        larg = page.evaluate("[document.documentElement.scrollWidth, document.documentElement.clientWidth]")
        check("resoconto 390 px: niente scorrimento orizzontale", larg[0] <= larg[1] + 1, larg)
        page.screenshot(path=SHOTS + "/registro-resoconto-390.png", full_page=True)
        page.set_viewport_size(vista_orig)
        page.evaluate("document.documentElement.setAttribute('data-theme', 'dark')")
        prepara("registro")
        page.click("#rg-prova [data-rg=modifica] >> nth=0")
        page.screenshot(path=SHOTS + "/registro-scuro.png", full_page=True)
        page.click("#rg-prova [data-rg=fatto]")

        # --- importazione: unisce senza cancellare ---
        dati = page.evaluate("PD.registro.dati()")
        imp = json.loads(json.dumps(dati))
        c = imp["corsi"][0]
        c["incontri"] = c["incontri"][:1]          # meno incontri: non deve cancellare gli altri
        c["incontri"][0]["presenti"] = []          # meno presenze: non deve toglierle
        c["incontri"].append({"id": "m-importato", "data": "2026-10-22", "inizio": "15:00", "fine": "16:30", "argomento": "Importato", "presenti": [c["iscritti"][1]["id"]]})
        imp["corsi"].append({"id": "c-altro", "nome": "Corso importato", "iscritti": [], "incontri": []})
        prepara("registro")
        page.set_input_files("#rg-prova [data-rg=importa]", files=[{"name": "registro.json", "mimeType": "application/json", "buffer": json.dumps(imp).encode()}])
        page.wait_for_function("PD.registro.dati().corsi.length === 2")
        s3 = page.evaluate("PD.registro.resoconto('%s')" % dati["corsi"][0]["id"])
        check("importa: unione sicura (niente perso, incontro aggiunto)", s3["incontri"] == 4 and s3["presenze"] == 7 and s3["ore"] == 7.5,
              (s3["incontri"], s3["presenze"], s3["ore"]))

        # --- resta dopo aver ricaricato la pagina ---
        page.wait_for_timeout(900)
        page.reload()
        page.wait_for_function("window.PD && PD.registro && PD.registro.dati().corsi.length > 0", timeout=10000)
        dopo = page.evaluate("PD.registro.dati()")
        check("registro: resta dopo il ricaricamento", len(dopo["corsi"]) == 2 and len(dopo["corsi"][0]["incontri"]) == 4 and
              len(dopo["corsi"][0]["iscritti"]) == 3, [len(x["incontri"]) for x in dopo["corsi"]])
        check("registro: nessun errore JavaScript", not errori, errori)
    finally:
        try:
            page.set_viewport_size(vista_orig)
            page.evaluate("(t) => { if (t) document.documentElement.setAttribute('data-theme', t); else document.documentElement.removeAttribute('data-theme'); }", tema_orig)
            pulisci_div()
            page.evaluate("(c) => PD.registro.ripristina(JSON.parse(c))", copia)
            page.wait_for_timeout(600)
        except Exception as e:  # la pagina potrebbe essere in ricaricamento
            check("registro: ripristino dei dati di prima", False, repr(e))
