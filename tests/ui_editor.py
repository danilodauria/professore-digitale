"""Test di «Crea lezioni e quiz» (src/web/js/editor.js). Chiamato da tests/test_ui.py: prova(page, ROOT, check, SHOTS).
Crea da zero un pacchetto (1 lezione con 2 passi, schema e quiz; 1 domanda-risposta), lo controlla, lo salva e usa,
lo scarica, lo riapre e lo modifica (versione 1.0.1), prova un errore e alla fine RIMUOVE il pacchetto di prova."""
import json, os

TITOLO = "Prova editor Borgoprova"
PID = "prova-editor-borgoprova"
DOMANDA = "Come prenoto la visita all'ambulatorio di Borgoprova?"
RISPOSTA_CORTA = "Telefonate all'ambulatorio negli orari di apertura e chiedete un appuntamento con il medico, portando la tessera sanitaria e un documento."
RISPOSTA = ("Potete prenotare la visita all'ambulatorio di Borgoprova in due modi: andando di persona allo sportello negli orari di apertura "
            "oppure dal sito del Comune di Borgoprova, nella pagina delle prenotazioni. Tenete pronti la tessera sanitaria e la ricetta del medico. "
            "Alla fine annotate il codice della prenotazione: serve per spostare o annullare la visita.")


def prova(page, ROOT, check, SHOTS):
    page.goto(ROOT + "#/home")
    page.wait_for_selector("#view-home h1")
    bozza = page.evaluate("(() => { try { return localStorage.getItem('pd.editor.bozza'); } catch (e) { return null; } })()")
    tema = page.evaluate("PD.settings.theme")
    errori = []
    gestore = lambda e: errori.append(str(e))
    page.on("pageerror", gestore)
    try:
        _prova(page, ROOT, check, SHOTS, errori)
    finally:
        page.remove_listener("pageerror", gestore)
        # rimette tutto a posto: pacchetto di prova rimosso, bozza precedente, tema
        page.evaluate("""([pid, b, t]) => {
            var en = (PD.packs.list || []).filter(function (e) { return e.pacchetto.id === pid; })[0];
            var p = en ? PD.packs.remove(pid).catch(function () {}) : Promise.resolve();
            return p.then(function () {
              PD.editor.azzera();
              try { if (b) localStorage.setItem('pd.editor.bozza', b); } catch (e) {}
              PD.settings.theme = t; PD.saveSettings();
            });
        }""", [PID, bozza, tema])
        page.set_viewport_size({"width": 1366, "height": 800})
        page.goto(ROOT + "#/home")


def campo(page, f):
    return page.locator('#view-editor [data-f="%s"]' % f)


def _prova(page, ROOT, check, SHOTS, errori):
    standalone = ROOT.startswith("file:")
    page.evaluate("(pid) => { PD.editor.azzera(); var en = (PD.packs.list || []).filter(function (e) { return e.pacchetto.id === pid; })[0]; return en ? PD.packs.remove(pid) : null; }", PID)
    page.set_viewport_size({"width": 1280, "height": 900})
    page.goto(ROOT + "#/editor")
    page.wait_for_selector("#view-editor .ed-tabs")
    check("editor: 5 schede", page.locator("#view-editor .ed-tab").count() == 5)
    check("editor: modelli pronti per partire", page.locator("#view-editor [data-modello]").count() == 3)
    autore = page.evaluate("PD.settings.teacherName || ''")
    check("editor: autore precompilato con il nome del facilitatore", campo(page, "autore").input_value() == autore)

    # --- pacchetto ---
    campo(page, "titolo").fill(TITOLO)
    campo(page, "descrizione").fill("Pacchetto di prova creato dal test automatico.")
    page.wait_for_timeout(350)
    check("editor: id generato dal titolo", page.inner_text("#ed-id") == PID, page.inner_text("#ed-id"))

    # --- lezione: 2 passi, schema, quiz di 2 domande ---
    page.click('#view-editor [data-tab="lezioni"]')
    page.click('#view-editor [data-act="nuova-lezione"]')
    campo(page, "lezioni.0.titolo").fill("Prenotare la visita a Borgoprova")
    page.click('#view-editor [data-icona="🏥"]')
    campo(page, "lezioni.0.obiettivo").fill("Prenotare una visita senza fare la fila.")
    campo(page, "lezioni.0.passi.0.titolo").fill("Dove si prenota")
    campo(page, "lezioni.0.passi.0.testo").fill("Si prenota allo sportello oppure dal sito del Comune.")
    # aiuto di formattazione: grassetto sulla parola selezionata
    page.evaluate("""() => { var t = document.querySelector('#view-editor [data-f="lezioni.0.passi.0.testo"]'); var i = t.value.indexOf('sportello'); t.focus(); t.setSelectionRange(i, i + 9); }""")
    page.click('#view-editor [data-fmt="b"][data-per="ed-lezioni-0-passi-0-testo"]')
    check("editor: pulsante grassetto", "**sportello**" in campo(page, "lezioni.0.passi.0.testo").input_value(), campo(page, "lezioni.0.passi.0.testo").input_value())
    check("editor: anteprima del testo con il grassetto", "<strong>sportello</strong>" in page.inner_html('#view-editor [data-md="lezioni.0.passi.0.testo"]'))
    page.click('#view-editor [data-act="aggiungi-schema"][data-per="lezioni.0.passi.0"]')
    for k, t in enumerate(["Apro il sito", "Prenota una visita", "Confermo"]):
        campo(page, "lezioni.0.passi.0._riquadri.%d" % k).fill(t)
    page.click('#view-editor [data-act="vedi-schema"][data-per="lezioni.0.passi.0"]')
    page.wait_for_selector('#view-editor [data-lavagna="lezioni.0.passi.0"] .diagram svg', timeout=20000)
    check("editor: lo schema a riquadri si disegna", True)
    page.click('#view-editor [data-act="passo"]')
    campo(page, "lezioni.0.passi.1.titolo").fill("Il giorno della visita")
    t = campo(page, "lezioni.0.passi.1.testo")
    t.fill("Arrivate dieci minuti prima\nPortate la tessera sanitaria\nPortate la ricetta")
    page.wait_for_timeout(100)
    t.focus(); page.evaluate("""() => { var t = document.querySelector('#view-editor [data-f="lezioni.0.passi.1.testo"]'); t.setSelectionRange(0, t.value.length); }""")
    page.click('#view-editor [data-fmt="ol"][data-per="ed-lezioni-0-passi-1-testo"]')
    check("editor: elenco numerato", t.input_value().startswith("1. Arrivate") and "\n3. Portate la ricetta" in t.input_value(), t.input_value())
    campo(page, "lezioni.0.palestra").select_option("click")
    for j, (d, o, e) in enumerate([("Dove si prenota la visita?", ["Allo sportello o sul sito", "Al bar"], "Si prenota allo sportello o dal sito del Comune."),
                                   ("Cosa portate il giorno della visita?", ["Niente", "Tessera sanitaria e ricetta", "La password"], "Servono tessera sanitaria e ricetta.")]):
        page.click('#view-editor [data-act="domanda-quiz"]')
        campo(page, "lezioni.0.quiz.%d.domanda" % j).fill(d)
        for k, x in enumerate(o):
            campo(page, "lezioni.0.quiz.%d.opzioni.%d" % (j, k)).fill(x)
        campo(page, "lezioni.0.quiz.%d.spiegazione" % j).fill(e)
    # la risposta giusta della seconda domanda è la B; la terza risposta vuota si toglie da sola
    page.locator('#view-editor [data-f="lezioni.0.quiz.1.corretta"][value="1"]').check()
    page.wait_for_timeout(350)
    pk = page.evaluate("PD.editor.costruisci()")
    L = pk["lezioni"][0]
    check("editor: lezione costruita (2 passi, schema Mermaid, 2 domande)",
          len(L["passi"]) == 2 and L["passi"][0]["schema"] == 'flowchart LR\n  A["Apro il sito"] --> B["Prenota una visita"] --> C["Confermo"]'
          and len(L["quiz"]) == 2 and L["quiz"][1]["corretta"] == 1 and L["quiz"][0]["opzioni"] == ["Allo sportello o sul sito", "Al bar"]
          and L["icona"] == "🏥" and L["palestra"] == "click" and L["id"].startswith(PID), L)

    # anteprima per l'allievo
    page.click('#view-editor .ed-sez-head [data-act="anteprima-lezione"]')
    page.wait_for_selector("#ed-anteprima .step-text h2")
    page.wait_for_selector("#ed-anteprima .chalkboard .diagram svg", timeout=20000)
    check("editor: anteprima della lezione", "Dove si prenota" in page.inner_text("#ed-anteprima .step-text h2"))
    page.screenshot(path=SHOTS + "/ed-01-lezione.png", full_page=True)
    page.click('#ed-anteprima [data-ap-step="quiz"]')
    page.click('#ed-anteprima .quiz-q[data-ap-q="1"] .quiz-opt[data-ap-o="1"]')
    check("editor: anteprima del quiz (risposta giusta)", "right" in (page.get_attribute('#ed-anteprima .quiz-q[data-ap-q="1"] .quiz-opt[data-ap-o="1"]', "class") or ""))
    page.click("#ed-ap-chiudi")

    # --- domanda e risposta, con l'errore della risposta troppo corta ---
    page.click('#view-editor [data-tab="domande"]')
    page.click('#view-editor [data-act="nuova-domanda"]')
    campo(page, "domande.0.domanda").fill(DOMANDA)
    campo(page, "domande.0.domanda").press("Tab")
    page.wait_for_timeout(100)
    kw = page.evaluate("PD.editor.stato().pack.domande[0].parole_chiave")
    check("editor: parole chiave suggerite dalla domanda (3-8)", 3 <= len(kw) <= 8 and "ambulatorio" in kw, kw)
    campo(page, "domande.0._testo").fill(RISPOSTA_CORTA)
    page.wait_for_timeout(400)
    msg = page.inner_text('#view-editor [data-err="domande.0._testo"]')
    n = len(RISPOSTA_CORTA.split())
    check("editor: errore leggibile accanto al campo (risposta troppo corta)", ("almeno 40 parole: ora ne ha %d" % n) in msg, msg)
    check("editor: contatore sulla scheda con le cose da correggere", page.inner_text('#view-editor [data-conta="domande"]').strip() != "")
    page.click('#view-editor [data-tab="controlla"]')
    check("editor: «Salva e usa» bloccato finché ci sono errori", page.is_disabled('#view-editor .ed-pannello [data-act="salva"]'))
    check("editor: elenco degli errori in italiano", "almeno 40 parole" in page.inner_text("#view-editor .ed-lista-err"))
    page.click('#view-editor .ed-lista-err [data-vai="domande.0._testo"]')
    page.wait_for_timeout(100)
    check("editor: il link dell'errore porta al campo", page.evaluate("document.activeElement && document.activeElement.getAttribute('data-f')") == "domande.0._testo")
    campo(page, "domande.0._testo").fill(RISPOSTA)
    page.click('#view-editor [data-act="opz"][data-lista="domande.0._passi"]')
    campo(page, "domande.0._passi.0").fill("Aprite il sito del Comune di Borgoprova.")
    page.click('#view-editor [data-act="opz"][data-lista="domande.0._passi"]')
    campo(page, "domande.0._passi.1").fill("Scegliete il giorno e confermate.")
    page.wait_for_timeout(400)
    check("editor: nessun errore sulla risposta dopo la correzione", page.inner_text('#view-editor [data-err="domande.0._testo"]').strip() == "")

    # --- controllo con il validatore del programma ---
    page.click('#view-editor [data-tab="controlla"]')
    page.wait_for_selector("#ed-pronto")
    r = page.evaluate("(() => { var c = PD.editor.controlla(); return { e: c.errori.map(function (x) { return x.m; }), v: PD.packs.validate(PD.editor.costruisci()) }; })()")
    check("editor: il validatore accetta il pacchetto", not r["e"] and not r["v"], r)
    page.screenshot(path=SHOTS + "/ed-02-controlla.png", full_page=True)

    # --- salva e usa ---
    page.click('#view-editor .ed-pannello [data-act="salva"]')
    page.wait_for_selector("#ed-salvato", timeout=15000)
    info = page.evaluate("""(pid) => { var en = PD.packs.list.filter(function (e) { return e.pacchetto.id === pid; })[0];
        return { v: en && en.pacchetto.versione, o: en && en.origine, lez: (window.PD_LESSONS || []).filter(function (L) { return L.pack === pid; }).map(function (L) { return L.id; }) }; }""", PID)
    check("editor: salvato e installato (versione 1.0.0)", info["v"] == "1.0.0" and info["o"] == "utente" and len(info["lez"]) == 1, info)
    found = page.evaluate("(q) => { var r = PD.search(q, 1)[0]; return r ? [r.doc.title, r.score >= PD.KB_THRESHOLD] : null; }", "come si prenota una visita in ambulatorio a borgoprova")
    check("editor: la domanda viene trovata da PD.search", found and found[0] == DOMANDA and found[1], found)
    page.click('#ed-salvato [data-go^="#/lessons/"]')
    page.wait_for_selector("#view-lessons .step-text h2")
    check("editor: il link porta alla lezione creata", "Dove si prenota" in page.inner_text("#view-lessons .step-text h2"))
    page.goto(ROOT + "#/lessons")
    page.wait_for_selector("#view-lessons .tile")
    check("editor: la lezione compare in #/lessons", "Prenotare la visita a Borgoprova" in page.inner_text("#view-lessons"))
    if not standalone:
        disk = page.evaluate("fetch('/api/packs').then(function (r) { return r.json(); }).then(function (j) { return j.packs.filter(function (e) { return e.pacchetto.id === '%s'; }).length; })" % PID)
        check("editor: pacchetto salvato dal server", disk == 1, disk)

    # --- scarica il file e verifica ---
    page.goto(ROOT + "#/editor")
    page.wait_for_selector("#view-editor .ed-tabs")
    with page.expect_download() as dl:
        page.click('#view-editor .ed-top [data-act="scarica"]')
    path = dl.value.path()
    nome = dl.value.suggested_filename
    with open(path, encoding="utf-8") as f:
        pj = json.load(f)
    def ha_campi_interni(o):
        if isinstance(o, dict):
            return any(k.startswith("_") for k in o) or any(ha_campi_interni(v) for v in o.values())
        if isinstance(o, list):
            return any(ha_campi_interni(v) for v in o)
        return False
    ok = nome == PID + "-1.0.0.json" and pj["formato"] == "professore-digitale-contenuti" and pj.get("autore", "") == autore
    ok = ok and pj["id"] == PID and pj["versione"] == "1.0.0" and len(pj["lezioni"]) == 1 and len(pj["lezioni"][0]["passi"]) == 2 \
        and pj["lezioni"][0]["passi"][0]["schema"].startswith("flowchart LR") and len(pj["lezioni"][0]["quiz"]) == 2 \
        and pj["domande"][0]["domanda"] == DOMANDA and 3 <= len(pj["domande"][0]["parole_chiave"]) <= 8 \
        and pj["domande"][0]["risposta"].endswith("1. Aprite il sito del Comune di Borgoprova.\n2. Scegliete il giorno e confermate.") \
        and pj.get("richiede_app") == page.evaluate("PD.version") and not ha_campi_interni(pj) and DOMANDA in pj.get("suggerimenti", [])
    check("editor: file scaricato con il contenuto giusto", ok, (nome, json.dumps(pj, ensure_ascii=False)[:500]))

    # --- riapre il file, modifica e salva: versione 1.0.1 ---
    page.evaluate("PD.editor.azzera()")
    page.wait_for_selector('#view-editor [data-modello="comune"]')
    page.set_input_files("#ed-file", path)
    page.wait_for_function("PD.editor.stato().pack.titolo === '%s'" % TITOLO)
    st = page.evaluate("(() => { var s = PD.editor.stato(); return [s.pack.id, s.meta.versione, s.pack.lezioni[0].passi[0]._riquadri, s.pack.domande[0]._passi.length]; })()")
    check("editor: file riaperto (schema e passi tornano modificabili)", st[0] == PID and st[1] == "1.0.0" and st[2] == ["Apro il sito", "Prenota una visita", "Confermo"] and st[3] == 2, st)
    page.click('#view-editor [data-tab="lezioni"]')
    page.click('#view-editor [data-lez="0"]')
    campo(page, "lezioni.0.titolo").fill("Prenotare la visita a Borgoprova (aggiornata)")
    page.wait_for_timeout(350)
    check("editor: modifiche non salvate segnalate", "non salvate" in page.inner_text("#ed-top-stato"))
    page.click('#view-editor .ed-top [data-act="salva"]')
    page.wait_for_selector("#ed-salvato", timeout=15000)
    v2 = page.evaluate("(pid) => { var en = PD.packs.list.filter(function (e) { return e.pacchetto.id === pid; })[0]; return en && [en.pacchetto.versione, en.pacchetto.lezioni[0].titolo, en.pacchetto.lezioni[0].id]; }", PID)
    check("editor: versione aumentata da sola (1.0.1), stessa lezione", v2 and v2[0] == "1.0.1" and v2[1].endswith("(aggiornata)") and v2[2] == info["lez"][0], v2)
    page.click('#view-editor [data-tab="pacchetto"]')
    check("editor: «I miei pacchetti» elenca il pacchetto", PID in page.inner_html("#view-editor .ed-miei"))

    # --- modello pronto e copia di una lezione esistente ---
    copia = page.evaluate("""() => { var s = PD.editor.stato(); var n = s.pack.lezioni.length; return n; }""")
    page.click('#view-editor [data-tab="lezioni"]')
    page.select_option("#ed-copia-lez", page.evaluate("PD_LESSONS[0].id"))
    page.click('#view-editor [data-act="copia-lezione"]')
    cp = page.evaluate("(() => { var s = PD.editor.stato(), L = s.pack.lezioni[s.pack.lezioni.length - 1]; var b = PD.editor.costruisci(); return [s.pack.lezioni.length, L.id, b.lezioni[b.lezioni.length - 1].id, PD_LESSONS[0].id, L.titolo === PD_LESSONS[0].title]; })()")
    check("editor: copia di una lezione esistente con un id nuovo", cp[0] == copia + 1 and cp[1] == "" and cp[2] != cp[3] and cp[2].startswith(PID) and cp[4], cp)
    page.evaluate("PD.editor.azzera()")
    page.click('#view-editor [data-modello="comune"]')
    m = page.evaluate("(() => { var c = PD.editor.controlla(); return [c.errori.length, c.consigli.some(function (x) { return /parentesi/.test(x.m); }), PD.editor.costruisci().lezioni[0].passi[1].schema]; })()")
    check("editor: modello «Servizi del nostro Comune» valido con spazi [da completare]", m[0] == 0 and m[1] and m[2].startswith("flowchart LR"), m)
    page.click('#view-editor [data-tab="pacchetto"]')
    page.click('#view-editor [data-act="nuovo"]')
    page.click('#view-editor [data-act="nuovo"]')
    page.wait_for_selector('#view-editor [data-modello="associazione"]')
    page.click('#view-editor [data-modello="associazione"]')
    m2 = page.evaluate("PD.editor.controlla().errori.length")
    check("editor: modello «associazione» valido", m2 == 0, m2)

    # --- grande quiz: limiti del validatore con messaggi chiari ---
    page.click('#view-editor [data-tab="quiz"]')
    page.click('#view-editor [data-act="crea-prova"]')
    campo(page, "prove.0.titolo").fill("Quiz di prova")
    page.wait_for_timeout(350)
    check("editor: grande quiz, servono almeno 5 domande", "almeno 5 domande: ora ce ne sono 0" in page.inner_text('#view-editor [data-err="prove.0.domande"]'))
    campo(page, "prove.0.domande_per_prova").fill("3")
    page.wait_for_timeout(350)
    check("editor: grande quiz, domande per prova 5-100", "tra 5 e 100" in page.inner_text('#view-editor [data-err="prove.0.domande_per_prova"]'))
    page.screenshot(path=SHOTS + "/ed-03-grande-quiz.png", full_page=True)

    # --- telefono e tema scuro ---
    page.click('#view-editor [data-tab="lezioni"]')
    page.click('#view-editor [data-lez="0"]')
    page.set_viewport_size({"width": 390, "height": 800})
    page.wait_for_timeout(300)
    over = page.evaluate("document.documentElement.scrollWidth > window.innerWidth + 1")
    check("editor: nessuno scorrimento orizzontale a 390 px", not over)
    page.screenshot(path=SHOTS + "/ed-04-telefono.png", full_page=False)
    page.click('#view-editor [data-tab="domande"]')
    over = page.evaluate("document.documentElement.scrollWidth > window.innerWidth + 1")
    check("editor: domande leggibili a 390 px", not over)
    page.screenshot(path=SHOTS + "/ed-05-telefono-domande.png", full_page=True)
    page.set_viewport_size({"width": 1280, "height": 900})
    page.evaluate("PD.settings.theme = 'dark'; PD.saveSettings();")
    page.click('#view-editor [data-tab="lezioni"]')
    page.click('#view-editor [data-lez="0"]')
    page.screenshot(path=SHOTS + "/ed-06-scuro.png", full_page=False)
    page.click('#view-editor [data-tab="pacchetto"]')
    page.screenshot(path=SHOTS + "/ed-07-scuro-pacchetto.png", full_page=True)

    # --- rimozione del pacchetto di prova ---
    page.click('#view-editor [data-rimuovi="%s"]' % PID)
    page.click('#view-editor [data-rimuovi="%s"]' % PID)
    page.wait_for_function("!PD.packs.list.some(function (e) { return e.pacchetto.id === '%s'; })" % PID)
    gone = page.evaluate("!(window.PD_LESSONS || []).some(function (L) { return L.pack === '%s'; })" % PID)
    check("editor: pacchetto di prova rimosso, le lezioni spariscono", gone)
    check("editor: nessun errore JavaScript", not errori, errori)
