"""Prove del «Ripasso intelligente» e della «Domanda del giorno» (src/web/js/ripasso.js).
Chiamata da tests/test_ui.py: prova(page, ROOT, check, SHOTS). Rimette a posto i dati che cambia."""


def testo_opt(o):
    """testo di un pulsante di risposta senza la lettera A/B/C"""
    p = o.inner_text().strip().split(None, 1)
    return p[1].strip() if len(p) > 1 else p[0]


def prova(page, ROOT, check, SHOTS):
    page.goto(ROOT + "#/home")
    page.wait_for_selector("#view-home .hero")
    salvato = page.evaluate("JSON.stringify({r: PD.progress.ripasso || null, dg: PD.settings.domandaGiorno, th: PD.settings.theme})")
    vp = page.viewport_size

    def ev(js, arg=None):
        return page.evaluate(js, arg) if arg is not None else page.evaluate(js)

    def ricarica(hash_="#/home", sel="#view-home .hero"):
        page.wait_for_timeout(700)   # salvataggio ritardato del server
        page.goto(ROOT + hash_)
        page.reload()
        page.wait_for_selector(sel)

    try:
        check("ripasso: API esposta", ev("!!(PD.registraRisposta && PD.ripasso && PD.ripasso.daRipassare && PD.ripasso.schedeOggi)"))
        ev("delete PD.progress.ripasso; PD.saveProgress()")
        Q = [
            {"q": "Prova ripasso: quale tasto annulla?", "o": ["Ctrl + Z", "Ctrl + P", "Ctrl + S"], "a": 0, "e": "Z come zitto: torna indietro.", "fonte": "Prova", "lezione": "file"},
            {"q": "Prova ripasso: dove si buttano i file?", "o": ["Cestino", "Scrivania", "Stampante"], "a": 0, "e": "Il cestino conserva i file eliminati.", "fonte": "Prova"},
            {"q": "Prova ripasso: cosa serve per navigare?", "o": ["Un browser", "Una calcolatrice", "Il blocco note"], "a": 0, "e": "Il browser apre i siti.", "fonte": "Prova", "prova": "x"},
        ]
        # giusta al primo colpo: nessuna scheda
        ev("q => PD.registraRisposta(q, true)", Q[0])
        check("ripasso: risposta giusta nuova non crea schede", ev("Object.keys(PD.progress.ripasso.schede).length") == 0)
        for q in Q:
            ev("q => PD.registraRisposta(q, false)", q)
        info = ev("""() => { var S = PD.progress.ripasso.schede, k = Object.keys(S);
            var d = new Date(); d.setDate(d.getDate() + 1);
            var dom = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
            return { n: k.length, box: k.every(x => S[x].scatola === 1), date: k.every(x => S[x].prossima === dom), sbagli: k.every(x => S[x].sbagli === 1),
                     oggi: PD.ripasso.daRipassare(), tot: PD.ripasso.totale(), chiave: PD.ripasso.chiave(' PROVA ripasso:  quale tasto annulla? ') === PD.ripasso.chiave('Prova ripasso: quale tasto annulla?') }; }""")
        check("ripasso: 3 schede nella scatola 1", info["n"] == 3 and info["box"] and info["sbagli"], info)
        check("ripasso: prossima = domani", info["date"], info)
        check("ripasso: oggi niente da ripassare", info["oggi"] == 0 and info["tot"] == 3, info)
        check("ripasso: chiave stabile", info["chiave"])
        # giusta prima della scadenza (es. di nuovo nella lezione): non avanza
        ev("q => PD.registraRisposta(q, true)", Q[0])
        check("ripasso: giusta prima della scadenza non fa avanzare",
              ev("q => PD.progress.ripasso.schede[PD.ripasso.chiave(q)].scatola", Q[0]["q"]) == 1)

        # forziamo le date: tutte in scadenza oggi, la terza gia' nella scatola 5
        ev("""qs => { var R = PD.progress.ripasso, o = PD.ripasso.oggi();
            qs.forEach(q => { R.schede[PD.ripasso.chiave(q)].prossima = o; });
            R.schede[PD.ripasso.chiave(qs[2])].scatola = 5; PD.saveProgress(); }""", [q["q"] for q in Q])
        check("ripasso: 3 da ripassare dopo aver forzato le date", ev("PD.ripasso.daRipassare()") == 3)

        page.goto(ROOT + "#/quiz"); page.goto(ROOT + "#/home"); page.wait_for_selector("#rip-tile")
        check("ripasso: riquadro Inizio con il numero", "3 domande vi aspettano" in page.inner_text("#rip-tile"), page.inner_text("#rip-tile"))

        page.goto(ROOT + "#/ripasso"); page.wait_for_selector("#rip-via")
        nums = page.inner_text("#view-ripasso .rip-numeri")
        check("ripasso: cruscotto con i numeri", "3" in nums and "da ripassare oggi" in nums, nums)
        page.screenshot(path=SHOTS + "/ripasso-1-cruscotto.png", full_page=True)
        page.click("#rip-via")
        corrette = {q["q"]: q["o"][q["a"]] for q in Q}
        esiti = {}
        for i in range(3):
            page.wait_for_selector("#view-ripasso .quiz-opt:not([disabled])")
            testo = page.inner_text("#view-ripasso .quiz-q h3").strip()
            giusta = corrette.get(testo)
            vuole = testo != Q[1]["q"]       # la seconda domanda la sbagliamo di proposito
            esiti[testo] = vuole
            opts = page.query_selector_all("#view-ripasso .quiz-opt")
            scelto = None
            for o in opts:
                t = testo_opt(o)
                if (t == giusta) == vuole:
                    scelto = o; break
            if i == 0:
                check("ripasso: lettere A B C e pulsante Leggi", page.is_visible("#rip-leggi") and page.inner_text("#view-ripasso .quiz-opt .lett") in "ABC")
                page.screenshot(path=SHOTS + "/ripasso-2-domanda.png")
            scelto.click()
            page.wait_for_selector("#rip-avanti")
            if i == 0:
                check("ripasso: spiegazione dopo la risposta", "Esatto" in page.inner_text("#view-ripasso .explain") or "Non proprio" in page.inner_text("#view-ripasso .explain"))
            page.click("#rip-avanti")
        page.wait_for_selector("#view-ripasso .rip-fine")
        fine = page.inner_text("#view-ripasso")
        check("ripasso: riepilogo finale", "2 su 3" in fine and "Domani riproviamo" in fine and Q[1]["q"] in fine, fine[:300])
        page.screenshot(path=SHOTS + "/ripasso-3-fine.png", full_page=True)
        st = ev("""qs => { var R = PD.progress.ripasso, o = PD.ripasso.oggi();
            function piu(n) { var p = o.split('-'), d = new Date(+p[0], +p[1] - 1, +p[2], 12); d.setDate(d.getDate() + n);
              return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
            var s = qs.map(q => R.schede[PD.ripasso.chiave(q)]);
            return { a: [s[0].scatola, s[0].prossima === piu(3)], b: [s[1].scatola, s[1].prossima === piu(1), s[1].sbagli],
                     c: [!!s[2].imparata, s[2].prossima], serie: PD.ripasso.serie(), imp: PD.ripasso.imparate(), oggi: PD.ripasso.daRipassare(), tot: PD.ripasso.totale() }; }""",
                [q["q"] for q in Q])
        check("ripasso: giusta -> scatola 2, tra 3 giorni", st["a"] == [2, True], st)
        check("ripasso: sbagliata -> scatola 1, domani", st["b"] == [1, True, 2], st)
        check("ripasso: oltre la scatola 5 -> imparata", st["c"] == [True, ""] and st["imp"] == 1, st)
        check("ripasso: conteggi e serie", st["oggi"] == 0 and st["tot"] == 2 and st["serie"] == 1, st)

        # vista senza nulla da ripassare: «Ripassa comunque»
        page.goto(ROOT + "#/home"); page.goto(ROOT + "#/ripasso"); page.wait_for_selector("#rip-comunque")
        check("ripasso: messaggio sereno e Ripassa comunque", "Per oggi avete finito" in page.inner_text("#view-ripasso"))
        page.click("#rip-comunque"); page.wait_for_selector("#view-ripasso .quiz-opt")
        check("ripasso: Ripassa comunque propone le schede", page.inner_text("#view-ripasso .quiz-q h3").strip() in corrette)
        page.click("#rip-esci"); page.wait_for_selector("#rip-comunque")

        # limite di 400 schede (in memoria, poi si torna indietro)
        lim = ev("""() => { var copia = JSON.stringify(PD.progress.ripasso);
            for (var i = 0; i < 420; i++) PD.registraRisposta({q: 'Domanda finta ' + i, o: ['a', 'b'], a: 0, e: ''}, false);
            var n = Object.keys(PD.progress.ripasso.schede).length; PD.progress.ripasso = JSON.parse(copia); PD.saveProgress(); return n; }""")
        check("ripasso: al massimo 400 schede", lim == 400, lim)

        # ---- domanda del giorno ----
        ev("PD.settings.domandaGiorno = true; PD.saveSettings(); PD.progress.ripasso.giorno = {}; PD.saveProgress()")
        ricarica()
        page.wait_for_selector("#rip-giorno")
        q1 = page.inner_text("#rip-giorno .rip-gq"); o1 = page.inner_text("#rip-giorno .quiz-q")
        check("domanda del giorno: visibile nell'Inizio", bool(q1.strip()))
        ricarica()
        page.wait_for_selector("#rip-giorno")
        check("domanda del giorno: stessa domanda e stesso ordine ricaricando",
              page.inner_text("#rip-giorno .rip-gq") == q1 and page.inner_text("#rip-giorno .quiz-q") == o1)
        page.screenshot(path=SHOTS + "/ripasso-4-domanda-giorno.png", full_page=True)
        G = ev("PD.progress.ripasso.giorno")
        giusta_txt = G["item"]["o"][G["item"]["a"]]
        sbagliata = [o for o in page.query_selector_all("#rip-giorno .quiz-opt") if testo_opt(o) != giusta_txt][0]
        sbagliata.click()
        page.wait_for_selector("#rip-giorno .rip-domani")
        check("domanda del giorno: spiegazione e «Domani un'altra!»", "Domani un'altra" in page.inner_text("#rip-giorno"))
        check("domanda del giorno: sbagliata -> entra nel ripasso",
              ev("k => !!PD.progress.ripasso.schede[k] && PD.progress.ripasso.schede[k].scatola === 1", G["chiave"]))
        ricarica()
        page.wait_for_selector("#rip-giorno")
        txt = page.inner_text("#rip-giorno")
        check("domanda del giorno: resta la stessa (gia' risposta) dopo il ricaricamento",
              page.inner_text("#rip-giorno .rip-gq") == q1 and "Domani un'altra" in txt and not page.query_selector("#rip-giorno .quiz-opt"))
        page.click("#rip-g-chiudi")
        check("domanda del giorno: chiudibile per oggi", not page.query_selector("#rip-giorno"))
        ricarica()
        check("domanda del giorno: resta chiusa ricaricando", not page.query_selector("#rip-giorno"))

        # ---- impostazioni ----
        ev("PD.progress.ripasso.giorno = {}; PD.saveProgress()")
        page.goto(ROOT + "#/settings"); page.wait_for_selector("#rip-impostazioni")
        check("impostazioni: riquadro ripasso", "Ripasso e domanda del giorno" in page.inner_text("#rip-impostazioni") and page.is_checked("#s-domgiorno"))
        page.uncheck("#s-domgiorno")
        check("impostazioni: interruttore salva", ev("PD.settings.domandaGiorno") is False)
        page.goto(ROOT + "#/home"); page.wait_for_selector("#rip-tile")
        check("impostazioni: domanda del giorno spenta", not page.query_selector("#rip-giorno"))
        page.goto(ROOT + "#/settings"); page.wait_for_selector("#rip-azzera")
        page.check("#s-domgiorno")
        page.click("#rip-azzera")
        check("impostazioni: azzera chiede conferma", ev("PD.ripasso.totale()") > 0 and "Sicuri" in page.inner_text("#rip-azzera"))
        page.click("#rip-azzera")
        check("impostazioni: azzera il ripasso", ev("PD.ripasso.totale() === 0 && PD.ripasso.imparate() === 0"))

        # ---- telefono e tema scuro ----
        for q in Q:
            ev("q => PD.registraRisposta(q, false)", q)
        ev("""() => { var R = PD.progress.ripasso, o = PD.ripasso.oggi(); for (var k in R.schede) R.schede[k].prossima = o;
             R.giorno = {}; PD.settings.theme = 'dark'; PD.saveSettings(); PD.saveProgress(); }""")
        page.set_viewport_size({"width": 1280, "height": 800})
        page.goto(ROOT + "#/settings"); page.goto(ROOT + "#/home"); page.wait_for_selector("#rip-giorno")
        page.screenshot(path=SHOTS + "/ripasso-5-home-scuro-1280.png", full_page=True)
        page.goto(ROOT + "#/ripasso"); page.wait_for_selector("#rip-via")
        page.screenshot(path=SHOTS + "/ripasso-6-scuro-1280.png", full_page=True)
        page.set_viewport_size({"width": 390, "height": 800})
        for h, sel, nome in (("#/ripasso", "#rip-via", "ripasso-7-telefono"), ("#/home", "#rip-giorno", "ripasso-8-home-telefono")):
            page.goto(ROOT + "#/settings"); page.goto(ROOT + h); page.wait_for_selector(sel); page.wait_for_timeout(300)
            over = ev("document.documentElement.scrollWidth > window.innerWidth + 1")
            check("ripasso: nessuno scorrimento orizzontale a 390 px (" + h + ")", not over)
            page.screenshot(path=SHOTS + "/" + nome + ".png", full_page=True)
        page.goto(ROOT + "#/ripasso"); page.wait_for_selector("#rip-via"); page.click("#rip-via"); page.wait_for_selector("#view-ripasso .quiz-opt")
        check("ripasso: domanda leggibile a 390 px", not ev("document.documentElement.scrollWidth > window.innerWidth + 1"))
        page.screenshot(path=SHOTS + "/ripasso-9-domanda-telefono.png", full_page=True)
    finally:
        # rimettere a posto i dati
        if vp:
            page.set_viewport_size(vp)
        page.evaluate("""s => { s = JSON.parse(s);
            if (s.r) PD.progress.ripasso = s.r; else delete PD.progress.ripasso;
            PD.settings.domandaGiorno = s.dg; PD.settings.theme = s.th; PD.saveSettings(); PD.saveProgress(); }""", salvato)
        page.wait_for_timeout(700)
        page.goto(ROOT + "#/home")
