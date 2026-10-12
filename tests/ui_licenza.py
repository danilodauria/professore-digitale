"""Prove dell'interfaccia: licenza dei contenuti CC BY-NC-SA 4.0 (dalla 3.5.2).
Menu, pagina #/licenza, Impostazioni, Inizio, piè di pagina delle stampe, attestato, pacchetti con il campo «licenza».
Chiamato da tests/test_ui.py: prova(page, ROOT, check, SHOTS). Rimette a posto ciò che cambia."""
import os


def prova(page, ROOT, check, SHOTS):
    errori = []
    def su_errore(e):
        errori.append(str(e))
    page.on("pageerror", su_errore)
    page.add_init_script("try { sessionStorage.setItem('pd.salutato', '1') } catch (e) {}")
    try:
        _prova(page, ROOT, check, SHOTS)
    finally:
        try:
            page.evaluate("() => { if (window.__printOrig) window.print = window.__printOrig; document.body.classList.remove('printing');"
                          " var a = document.getElementById('print-area'); if (a) a.innerHTML = ''; var s = document.getElementById('pd-print-page'); if (s) s.remove(); }")
            page.set_viewport_size({"width": 1366, "height": 800})
        except Exception:
            pass
        page.remove_listener("pageerror", su_errore)
    check("licenza: nessun errore JavaScript", not errori, errori[:3])


def _prova(page, ROOT, check, SHOTS):
    page.wait_for_function("() => { const v = document.getElementById('app-version'); return v && v.textContent.trim().length > 0; }")
    page.evaluate("() => PD.go('#/home')")
    page.wait_for_selector("#view-home .hero")

    # menu laterale: la riga della licenza porta alla pagina
    cred = page.inner_text(".sidebar .credit")
    check("licenza: il menu dice codice MIT e contenuti CC BY-NC-SA 4.0", "MIT" in cred and "CC BY-NC-SA 4.0" in cred, cred)
    check("licenza: in fondo all'Inizio c'è il collegamento alla licenza",
          page.locator('#view-home a[data-go="#/licenza"]').count() == 1)

    page.click(".sidebar .credit a.credit-lic")
    page.wait_for_selector("#view-licenza #licenza-card")
    t = page.inner_text("#view-licenza")
    check("licenza: la pagina spiega le tre condizioni",
          all(x in t for x in ("Attribuzione", "Non commerciale", "Condividi allo stesso modo", "Danilo D'Auria", "MIT")), t[:300])
    check("licenza: bollino Creative Commons disegnato (nessuna immagine esterna)",
          page.locator("#view-licenza svg.cc-badge").count() == 1 and page.locator("#view-licenza img").count() == 0)
    cit = page.inner_text("#licenza-citazione")
    check("licenza: citazione consigliata come nel Grande Quiz",
          cit.startswith("«Professore Digitale") and "CC BY-NC-SA 4.0" in cit and "danilodauria.github.io/professore-digitale" in cit, cit)
    link = page.get_attribute('#view-licenza a[rel~="license"]', "href") or ""
    check("licenza: collegamento alla licenza in italiano", link.endswith("/by-nc-sa/4.0/deed.it"), link)
    if SHOTS:
        page.screenshot(path=os.path.join(SHOTS, "70-licenza.png"), full_page=True)

    # «Copia la citazione» (negli appunti finti: il test non tocca quelli veri)
    page.evaluate("() => { window.__copiato = ''; try { Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: function (s) { window.__copiato = s; return Promise.resolve(); } } }); } catch (e) {} }")
    page.click("#licenza-copia")
    page.wait_for_timeout(200)
    copiato = page.evaluate("() => window.__copiato || ''")
    check("licenza: «Copia la citazione» copia il testo giusto", copiato == cit, copiato)

    # Impostazioni: riga nelle Informazioni e riquadro completo
    page.evaluate("() => PD.go('#/settings')")
    page.wait_for_selector("#view-settings #licenza-card")
    info = page.inner_text("#view-settings")
    check("licenza: Impostazioni → Informazioni con la doppia licenza", "Codice MIT" in info and "Creative Commons BY-NC-SA 4.0" in info)

    # piè di pagina delle stampe e attestato
    page.evaluate("() => { window.__printOrig = window.print; window.print = function () { window.__stampato = (window.__stampato || 0) + 1; }; }")
    piede = page.evaluate("() => PD.piedeStampa('Prova.')")
    check("licenza: piè di pagina comune delle stampe", "CC BY-NC-SA 4.0" in piede and "Danilo D'Auria" in piede and "Prova." in piede, piede)
    page.evaluate("() => PD.go('#/lessons/' + window.PD_LESSONS[0].id + '/0')")
    page.wait_for_timeout(500)
    page.evaluate("() => PD.printTopic()")
    page.wait_for_function("() => ((document.getElementById('print-area') || {}).textContent || '').indexOf('BY-NC-SA') >= 0", timeout=15000)
    testo = page.evaluate("() => (document.getElementById('print-area') || {}).textContent || ''")
    check("licenza: la stampa di una lezione riporta autore e licenza", "CC BY-NC-SA 4.0" in testo and "Danilo D'Auria" in testo, testo[-300:])
    svg = page.evaluate("() => PD.attestatoSVG({ codice: 'PD-PROVA', prova: 'informatica', titolo: 'Il Grande Quiz dell\\'Informatica', attestato: 'Prova', nome: 'Maria Rossi',"
                        " punteggio: 25, totale: 30, perc: 83, giudizio: 'Ottimo', data: new Date().toISOString() })")
    check("licenza: l'attestato riporta la licenza dei contenuti", "CC BY-NC-SA 4.0" in svg and "Licenza MIT" not in svg)

    # pacchetti: campo «licenza» facoltativo, controllato come in pd_packs.py
    esiti = page.evaluate("""() => {
      var p = PD.packs.template();
      var ok = PD.packs.validate(p).length === 0;
      p.licenza = 123; var tipo = PD.packs.validate(p).length > 0;
      p.licenza = new Array(202).join('x'); var lungo = PD.packs.validate(p).length > 0;
      delete p.licenza; var senza = PD.packs.validate(p).length === 0;
      return { ok: ok, tipo: tipo, lungo: lungo, senza: senza, modello: PD.packs.template().licenza };
    }""")
    check("licenza: il modello dei pacchetti propone CC BY-NC-SA 4.0 ed è valido", esiti["ok"] and esiti["modello"] == "CC BY-NC-SA 4.0", esiti)
    check("licenza: campo «licenza» controllato (testo, max 200, facoltativo)", esiti["tipo"] and esiti["lungo"] and esiti["senza"], esiti)
    progetto = ["cultura-arte", "cultura-attualita", "cultura-geografia", "cultura-scienze", "cultura-storia", "feniceos",
                "grande-quiz-informatica", "tecnologia-gentile", "vita-quotidiana", "windows-primi-passi"]
    inclusi = page.evaluate("(ids) => (PD.packs.list || []).filter(function (e) { return e.origine !== 'utente' && ids.indexOf(e.pacchetto.id) >= 0; })"
                            ".map(function (e) { return [e.pacchetto.id, e.pacchetto.licenza || ''] })", progetto)
    if inclusi:
        senza = [i for i, l in inclusi if l != "CC BY-NC-SA 4.0"]
        check("licenza: i pacchetti del progetto dichiarano CC BY-NC-SA 4.0", not senza, senza)
