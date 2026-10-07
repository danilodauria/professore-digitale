"""Test dei profili allievo (src/web/js/profili.js): chiamato da tests/test_ui.py.

prova(page, ROOT, check, SHOTS): crea una seconda persona, completa una lezione, cambia profilo,
ricarica, prova la scelta all'avvio e il recupero di un cambio interrotto, elimina la persona
e alla fine rimette i dati esattamente com'erano.
"""
import json

SNAP = """() => PD.store.load('profili').then(function (p) {
  return JSON.parse(JSON.stringify({ profili: p, progress: PD.progress, history: PD.history, nome: PD.settings.studentName }));
})"""

RESTORE = """(o) => {
  var s = PD.settings; s.studentName = o.nome;
  var coppie = [['profili', o.profili], ['history', o.history], ['settings', s], ['progress', o.progress]];
  coppie.forEach(function (c) { PD.store.save(c[0], c[1]); });
  if (!PD.server) return true;
  return coppie.reduce(function (p, c) {
    return p.then(function () { return PD.api('/api/data/' + c[0], { value: c[1] }); });
  }, Promise.resolve()).then(function () { return true; });
}"""


def prova(page, ROOT, check, SHOTS):
    base = ROOT.split("#")[0]
    errori = []
    page.on("pageerror", lambda e: errori.append(str(e)))
    vp = page.viewport_size or {"width": 1366, "height": 800}

    def apri(hash_="#/home"):
        # passando da about:blank la pagina si ricarica davvero (un cambio del solo «#» non ricaricherebbe)
        page.goto("about:blank")
        page.goto(base + hash_)
        page.wait_for_function("window.PD && PD.profili && PD.profili.attivo() !== '' && !!document.querySelector('.view:not([hidden])')")

    def attendi_home(attivo):
        page.wait_for_function("(id) => PD.profili.attivo() === id && !document.querySelector('#view-home').hidden", arg=attivo, timeout=10000)

    page.evaluate("sessionStorage.setItem('pd.salutato', '1'); sessionStorage.setItem('pd.profiloScelto', '1')")
    apri()
    orig = page.evaluate(SNAP)
    X = page.evaluate("PD.profili.attivo()")
    n0 = len(orig["profili"]["elenco"])
    check("profili: profilo attivo presente", bool(X) and n0 >= 1, orig["profili"])
    check("profili: progressi marcati con il profilo", page.evaluate("PD.progress.profilo") == X)
    corso = page.evaluate("PD.lessonsOf('corso').map(function (l) { return l.id; })")
    fatte = orig["progress"].get("lessons", {})
    lez = next((i for i in corso if not (fatte.get(i) or {}).get("done")), corso[0])
    try:
        # --- nuova persona dalla vista «Chi usa il computer?» ---
        apri("#/profili")
        page.wait_for_selector("#view-profili .pf-persona")
        check("profili: riquadri delle persone", page.locator("#view-profili [data-pf-scegli]").count() == n0)
        page.click("#pf-nuova")
        page.fill("#pf-nome", "Giulia Prova")
        page.click("[data-pf-iconanuova='🌻']")
        page.click("#pf-crea")
        page.wait_for_function("(n) => PD.profili.elenco().length === n + 1", arg=n0)
        Y = page.evaluate("PD.profili.elenco().filter(function (e) { return e.nome === 'Giulia Prova'; })[0].id")
        check("profili: nuova persona creata con icona", page.evaluate("(id) => PD.profili.elenco().filter(function (e) { return e.id === id; })[0].icona", Y) == "🌻")
        check("profili: pulsante nella barra visibile", page.is_visible("#btn-profilo"))
        page.screenshot(path=SHOTS + "/pf-01-persone.png", full_page=True)

        # --- cambio di profilo ---
        page.click("[data-pf-scegli='%s']" % Y)
        attendi_home(Y)
        check("profili: nuovo profilo con progressi vuoti", page.evaluate("Object.keys(PD.progress.lessons).length") == 0)
        check("profili: conversazione vuota", page.evaluate("PD.history.length") == 0)
        check("profili: nome per gli attestati aggiornato", page.evaluate("PD.settings.studentName") == "Giulia Prova")
        check("profili: barra mostra il nome", "Giulia Prova" in page.inner_text("#btn-profilo"))

        # --- lezione completata nel nuovo profilo ---
        page.goto(base + "#/lessons/" + lez + "/quiz")
        page.wait_for_selector("#view-lessons .quiz-q")
        for i in range(page.locator("#view-lessons .quiz-q").count()):
            page.locator("#view-lessons .quiz-q").nth(i).locator(".quiz-opt").first.click()
        page.wait_for_function("(id) => (PD.progress.lessons[id] || {}).done === true", arg=lez)
        page.evaluate("PD.history.push({ role: 'user', content: 'domanda di Giulia' }); PD.store.save('history', PD.history)")
        page.wait_for_timeout(700)  # salvataggio ritardato di PD.store
        in_x = page.evaluate("(a) => !!(PD.profili.progressDi(a[0]).lessons[a[1]] || {}).done", [X, lez])
        check("profili: lezione separata (l'altro profilo non la vede)", not in_x or (fatte.get(lez) or {}).get("done"))

        # --- ricarica: resta tutto ---
        apri("#/home")
        check("profili: dopo il ricaricamento il profilo attivo resta", page.evaluate("PD.profili.attivo()") == Y)
        check("profili: dopo il ricaricamento la lezione resta", page.evaluate("(id) => !!(PD.progress.lessons[id] || {}).done", lez))
        check("profili: dopo il ricaricamento la conversazione resta", page.evaluate("PD.history.length") == 1)
        if page.evaluate("PD.server"):
            disco = page.evaluate("fetch('/api/data/progress').then(function (r) { return r.json(); })")
            check("profili: progress.json sul disco è del profilo attivo", (disco.get("value") or {}).get("profilo") == Y, disco)

        # --- scelta all'avvio: una scheda nuova ha una sessione nuova (nessuna scelta fatta) ---
        page.goto("about:blank")
        t = page.context.new_page()
        t.on("pageerror", lambda e: errori.append(str(e)))
        t.set_viewport_size({"width": 1280, "height": 800})
        t.goto(base + "#/home")
        t.wait_for_selector("#view-profili .pf-avvio")
        check("profili: all'avvio chiede chi usa il computer", "#/profili/scegli" in t.url and t.is_hidden("#view-home"))
        t.screenshot(path=SHOTS + "/pf-02-scelta-avvio.png")
        t.evaluate("document.documentElement.setAttribute('data-theme', 'dark')")
        t.screenshot(path=SHOTS + "/pf-03-scelta-scuro.png")
        t.set_viewport_size({"width": 390, "height": 844})
        t.wait_for_timeout(300)
        check("profili: telefono senza scorrimento orizzontale", t.evaluate("document.documentElement.scrollWidth <= 391"),
              t.evaluate("document.documentElement.scrollWidth"))
        t.screenshot(path=SHOTS + "/pf-04-telefono.png", full_page=True)
        t.set_viewport_size({"width": 1280, "height": 800})
        t.evaluate("PD.applySettings()")
        # --- torno al primo profilo scegliendolo ---
        t.click("[data-pf-scegli='%s']" % X)
        t.wait_for_function("(id) => PD.profili.attivo() === id && !document.querySelector('#view-home').hidden", arg=X, timeout=10000)
        check("profili: scelta ricordata nella sessione", t.evaluate("sessionStorage.getItem('pd.profiloScelto')") == "1")
        t.wait_for_timeout(600)
        t.close()
        apri("#/home")
        check("profili: dopo la scelta all'avvio il primo profilo è attivo", page.evaluate("PD.profili.attivo()") == X)
        check("profili: progressi del primo profilo intatti",
              page.evaluate("(l) => JSON.stringify(PD.progress.lessons) === JSON.stringify(l)", orig["progress"].get("lessons", {})))
        check("profili: conversazione del primo profilo intatta", page.evaluate("PD.history.length") == len(orig["history"] or []))
        check("profili: nome del primo profilo ripristinato", page.evaluate("PD.settings.studentName") == orig["nome"])
        check("profili: progressi dell'altro profilo conservati", page.evaluate("(a) => !!(PD.profili.progressDi(a[0]).lessons[a[1]] || {}).done", [Y, lez]))
        check("profili: esportazione di tutti", len(page.evaluate("PD.profili.esportaTutti().profili")) == n0 + 1)

        # --- cambio interrotto (computer spento a metà): al riavvio si completa senza perdere nulla ---
        page.evaluate("""(a) => PD.store.load('profili').then(function (p) {
            p.dati[a[0]] = { progress: PD.progress, history: PD.history, studentName: PD.settings.studentName };
            p.attivo = a[1];
            PD.store.save('profili', p);
            return PD.server ? PD.api('/api/data/profili', { value: p }) : null;
        })""", [X, Y])
        apri("#/home")
        check("profili: cambio interrotto completato al riavvio",
              page.evaluate("PD.profili.attivo()") == Y and page.evaluate("(id) => !!(PD.progress.lessons[id] || {}).done", lez)
              and page.evaluate("PD.settings.studentName") == "Giulia Prova")
        check("profili: dopo il recupero il primo profilo è al sicuro",
              page.evaluate("(l) => JSON.stringify(PD.profili.progressDi(%s).lessons) === JSON.stringify(l)" % json.dumps(X), orig["progress"].get("lessons", {})))
        page.evaluate("(id) => PD.profili.cambia(id)", X)
        attendi_home(X)

        # --- gestione: cambia nome, elimina con doppia conferma ---
        apri("#/profili")
        page.wait_for_selector("#pf-gestisci")
        check("profili: non si elimina chi usa il computer", page.is_disabled("[data-pf-elimina='%s']" % X))
        page.click("[data-pf-rinomina='%s']" % Y)
        page.fill("#pf-rinomina-" + Y, "Giulia Bis")
        page.click("[data-pf-salvanome='%s']" % Y)
        check("profili: nome cambiato", any(e["nome"] == "Giulia Bis" for e in page.evaluate("PD.profili.elenco()")))
        page.click("[data-pf-elimina='%s']" % Y)
        testo = page.inner_text(".pf-pericolo")
        check("profili: avviso chiaro prima di eliminare", "I progressi di Giulia Bis verranno cancellati da questo computer" in testo, testo)
        page.screenshot(path=SHOTS + "/pf-05-elimina.png", full_page=True)
        page.click("[data-pf-conferma='%s']" % Y)
        check("profili: serve una seconda conferma", len(page.evaluate("PD.profili.elenco()")) == n0 + 1 and page.is_visible("text=Elimina per sempre"))
        page.click("[data-pf-conferma='%s']" % Y)
        page.wait_for_function("(n) => PD.profili.elenco().length === n", arg=n0)
        check("profili: persona eliminata con i suoi dati", page.evaluate("(id) => Object.keys(PD.profili.progressDi(id).lessons).length", Y) == 0)

        # --- riquadro nelle Impostazioni ---
        page.goto(base + "#/settings")
        page.wait_for_selector("#pf-impostazioni")
        check("profili: riquadro nelle impostazioni", "Persone che usano questo computer" in page.inner_text("#pf-impostazioni"))
        check("profili: pulsante della barra nascosto con una persona", n0 > 1 or page.is_hidden("#btn-profilo"))
    finally:
        page.set_viewport_size(vp)
        page.evaluate(RESTORE, orig)
        apri("#/home")
        dopo = page.evaluate(SNAP)
        check("profili: dati rimessi com'erano",
              [e["id"] for e in dopo["profili"]["elenco"]] == [e["id"] for e in orig["profili"]["elenco"]]
              and dopo["progress"] == orig["progress"] and dopo["nome"] == orig["nome"], dopo["profili"])
        check("profili: nessun errore JavaScript", not errori, errori)
