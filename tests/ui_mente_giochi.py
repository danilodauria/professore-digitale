"""Test dei giochi di parole della «Ginnastica per la mente» (src/web/js/mente-giochi.js).
Chiamato da tests/test_ui.py: prova(page, ROOT, check, SHOTS).
Controlla registrazione, generatore del cruciverba (30 semi x 3 livelli), contenuti (dizionario e frasi),
gioca per intero cruciverba facile (tastiera fisica e a schermo), Indovina la frase, Parole mescolate,
Completa il proverbio e Parole a catena; stampa, telefono e tema scuro.
Rimette a posto progressi e impostazioni che cambia. Autore: Danilo D'Auria - Licenza MIT"""

V = "#view-mente"
IDS = ["cruciverba", "frase", "anagramma", "proverbio", "catena"]

VERIFICA_JS = r"""() => {
  var G = PD.menteGiochi, errori = [], conteggi = {1: [], 2: [], 3: []};
  var diz = {}; G.dizionario.forEach(function (d) { diz[d.parola] = d.def; });
  function verifica(cw) {
    var e = [], R = cw.righe, C = cw.colonne, corse = [], visti = {};
    for (var r = 0; r < R; r++) { var c = 0; while (c < C) { if (cw.sol[r][c]) { var s = c; while (c < C && cw.sol[r][c]) c++;
      if (c - s >= 2) corse.push("o" + r + "," + s + ":" + cw.sol[r].slice(s, c).join("")); } else c++; } }
    for (var c2 = 0; c2 < C; c2++) { var r2 = 0; while (r2 < R) { if (cw.sol[r2][c2]) { var s2 = r2, w = "";
      while (r2 < R && cw.sol[r2][c2]) { w += cw.sol[r2][c2]; r2++; } if (w.length >= 2) corse.push("v" + s2 + "," + c2 + ":" + w); } else r2++; } }
    var messe = cw.parole.map(function (p) { return p.dir + p.r + "," + p.c + ":" + p.parola; });
    if (corse.sort().join("|") !== messe.slice().sort().join("|")) e.push("incroci incoerenti");
    cw.parole.forEach(function (p) {
      if (visti[p.parola]) e.push("doppione " + p.parola); visti[p.parola] = 1;
      if (diz[p.parola] !== p.def) e.push("definizione " + p.parola);
      if (p.len !== p.parola.length) e.push("lunghezza " + p.parola);
      var n = cw.numeri[p.r + "," + p.c]; if (n !== p.num) e.push("numero " + p.parola);
    });
    var celle = [], vis = {};
    for (var a = 0; a < R; a++) for (var b = 0; b < C; b++) if (cw.sol[a][b]) celle.push([a, b]);
    var pila = [celle[0]]; vis[celle[0]] = 1;
    while (pila.length) { var x = pila.pop(); [[1,0],[-1,0],[0,1],[0,-1]].forEach(function (d) { var y = [x[0]+d[0], x[1]+d[1]];
      if (y[0] >= 0 && y[1] >= 0 && y[0] < R && y[1] < C && cw.sol[y[0]][y[1]] && !vis[y]) { vis[y] = 1; pila.push(y); } }); }
    if (Object.keys(vis).length !== celle.length) e.push("griglia non connessa");
    return e;
  }
  var lim = {1: [5, 6, 6], 2: [8, 10, 8], 3: [12, 14, 10]};
  for (var l = 1; l <= 3; l++) for (var i = 0; i < 30; i++) {
    var cw = G.genera("prova-" + i, l), e = verifica(cw);
    if (cw.parole.length < lim[l][0] || cw.parole.length > lim[l][1]) e.push("parole " + cw.parole.length);
    if (cw.righe > lim[l][2] || cw.colonne > lim[l][2]) e.push("dimensioni " + cw.righe + "x" + cw.colonne);
    conteggi[l].push(cw.parole.length);
    if (e.length) errori.push("liv " + l + " seme " + i + ": " + e.join(", "));
  }
  var a = G.genera("stesso", 2), b = G.genera("stesso", 2);
  return { errori: errori, conteggi: conteggi, deterministico: JSON.stringify(a.sol) === JSON.stringify(b.sol) };
}"""

CONTENUTI_JS = r"""() => {
  var G = PD.menteGiochi, p = [], visti = {}, testi = {};
  G.dizionario.forEach(function (d) {
    if (!/^[A-Z]{3,12}$/.test(d.parola)) p.push("parola strana " + d.parola);
    if (visti[d.parola]) p.push("doppione " + d.parola); visti[d.parola] = 1;
    if (!d.def || d.def.length < 6 || !d.gruppo) p.push("definizione " + d.parola);
    if (new RegExp("(^|[^A-Z])" + d.parola + "([^A-Z]|$)").test(G.norm(d.def))) p.push("la definizione contiene " + d.parola);
  });
  G.frasi.forEach(function (f) {
    if (!/^[A-Za-zÀÈÉÌÒÙàèéìòù ',.!?:]+$/.test(f.testo)) p.push("caratteri strani: " + f.testo);
    if (!f.categoria) p.push("senza categoria: " + f.testo);
    if (!f.spiega) p.push("senza spiegazione: " + f.testo);
    var k = G.norm(f.testo).replace(/[^A-Z]/g, ""); if (testi[k]) p.push("frase doppia: " + f.testo); testi[k] = 1;
    if (f.manca) {
      if (!new RegExp("(^|[^A-Za-zÀ-ÿ])" + f.manca + "(?![A-Za-zÀ-ÿ])", "i").test(f.testo)) p.push("parola che manca assente: " + f.testo);
      if (f.sbagliate.length < 3) p.push("poche alternative: " + f.testo);
    }
  });
  return { problemi: p, parole: G.dizionario.length, frasi: G.frasi.length,
           proverbi: G.frasi.filter(function (f) { return f.tipo === "P"; }).length,
           completabili: G.frasi.filter(function (f) { return f.manca; }).length };
}"""


def prova(page, ROOT, check, SHOTS):
    errori = []
    gestore = lambda e: errori.append(str(e))
    page.on("pageerror", gestore)
    salvato = page.evaluate("""() => ({ mente: JSON.stringify((PD.progress || {}).mente || null), voce: PD.settings.voice, tema: PD.settings.theme })""")
    page.evaluate("() => { PD.settings.voice = false; PD.stopSpeech(); }")
    stampa_orig = page.evaluate("() => { window.__pdPrintOrig = PD.printHTML; return !!PD.printHTML; }")
    try:
        _prova(page, ROOT, check, SHOTS)
    finally:
        page.evaluate("""(s) => {
            if (window.__pdPrintOrig) PD.printHTML = window.__pdPrintOrig;
            if (PD.mente) delete PD.mente.dataProva;
            var v = JSON.parse(s.mente);
            if (v) PD.progress.mente = v; else delete PD.progress.mente;
            PD.saveProgress();
            PD.settings.voice = s.voce; PD.settings.theme = s.tema; PD.saveSettings(); PD.applySettings();
            document.body.classList.remove('printing');
        }""", salvato)
        page.set_viewport_size({"width": 1366, "height": 800})
        page.evaluate("() => PD.go('#/home')")
        page.remove_listener("pageerror", gestore)
    check("mente-giochi: nessun errore JavaScript", not errori, "; ".join(errori[:3]))


def vai(page, h, sel):
    page.evaluate("(h) => PD.go(h)", h)
    page.wait_for_selector(sel, timeout=8000)


def sol(page):
    return page.evaluate("() => PD.menteGiochi.corrente")


def fine_ok(page, gioco):
    page.wait_for_selector(V + " .mente-fine:not([hidden]) .mente-fine-card", timeout=8000)
    return page.evaluate("(g) => { var s = PD.mente.stato(g); return s && s.volte >= 1 && s.massimo > 0 ? s : null; }", gioco)


def nessuno_scorrimento(page):
    return page.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1")


def _prova(page, ROOT, check, SHOTS):
    page.evaluate("() => { PD.mente.dataProva = '2026-10-08'; delete PD.progress.mente; PD.saveProgress(); }")
    if not page.evaluate("!!PD.menteGiochi"):
        check("mente-giochi: modulo caricato", False, "PD.menteGiochi assente")
        return

    # ---------------------------------------------------------------- registrazione
    reg = page.evaluate("() => PD.mente.elenco().filter(g => g.categoria === 'parole' && (g.ordine || 0) >= 20).map(g => g.id)")
    check("mente-giochi: 5 giochi registrati", all(i in reg for i in IDS), reg)
    ok = page.evaluate("""() => PD.mente.elenco().filter(g => %s.indexOf(g.id) >= 0)
        .every(g => g.titolo && g.icona && g.descrizione && g.livelli === 3 && typeof g.avvia === 'function')""" % str(IDS).replace("'", '"'))
    check("mente-giochi: giochi con titolo, icona, descrizione e 3 livelli", ok)
    vai(page, "#/mente", V + " [data-gioco=cruciverba]")
    check("mente-giochi: cruciverba nell'elenco dei giochi", page.locator(V + " [data-gioco=frase]").count() == 1)

    # ---------------------------------------------------------------- generatore e contenuti
    r = page.evaluate(VERIFICA_JS)
    check("cruciverba: 90 griglie valide (30 semi x 3 livelli)", not r["errori"], r["errori"][:5])
    check("cruciverba: stesso seme, stessa griglia", r["deterministico"])
    c = page.evaluate(CONTENUTI_JS)
    check("mente-giochi: dizionario con almeno 400 parole", c["parole"] >= 400, c["parole"])
    check("mente-giochi: almeno 150 frasi", c["frasi"] >= 150, c["frasi"])
    check("mente-giochi: almeno 30 proverbi da completare", c["completabili"] >= 30, c["completabili"])
    check("mente-giochi: contenuti puliti (caratteri, categorie, doppioni)", not c["problemi"], c["problemi"][:5])
    print("     parole %d, frasi %d (proverbi %d, da completare %d)" % (c["parole"], c["frasi"], c["proverbi"], c["completabili"]))

    # ---------------------------------------------------------------- cruciverba facile, con la tastiera
    vai(page, "#/mente/cruciverba/1", V + " .mg-cw-griglia")
    cw = sol(page)["soluzione"]
    atteso = page.evaluate("() => PD.menteGiochi.genera('2026-10-08', 1)")
    check("cruciverba: quello di oggi dipende dalla data", atteso["sol"] == cw["sol"])
    check("cruciverba: titolo «di oggi»", "di oggi" in page.inner_text(V + " .mg-testa"))
    n_celle = page.locator(V + " .mg-cw-cella").count()
    check("cruciverba: celle giuste nella griglia", n_celle == sum(1 for riga in cw["sol"] for x in riga if x), n_celle)
    page.screenshot(path=SHOTS + "/mente-giochi-1-cruciverba.png", full_page=True)
    # stampa (griglia vuota + soluzioni)
    page.evaluate("() => { window.__stampa = null; PD.printHTML = function (h, o) { window.__stampa = h; }; }")
    page.click(V + " [data-a=stampa]")
    st = page.evaluate("() => window.__stampa || ''")
    check("cruciverba: stampa con definizioni e soluzioni", "Soluzioni" in st and cw["parole"][0]["def"] in st and "Orizzontali" in st)
    # una lettera sbagliata, poi «Controlla»
    p0 = cw["parole"][0]
    page.click(V + " .mg-cw-def[data-p='0']")
    sbagliata = "Z" if p0["parola"][0] != "Z" else "Q"
    page.keyboard.press(sbagliata)
    page.click(V + " [data-a=controlla]")
    check("cruciverba: «Controlla» segna la lettera sbagliata", page.locator(V + " .mg-cw-cella.rivedere").count() == 1)
    check("cruciverba: messaggio gentile", "rivedere" in page.inner_text(V + " .mg-cw-esito"))
    # tutte le parole: le prime con la tastiera fisica (anche minuscole e accentate), l'ultima con la tastiera a schermo
    for i, p in enumerate(cw["parole"]):
        page.click(V + " .mg-cw-def[data-p='%d']" % i)
        if i == len(cw["parole"]) - 1:
            for ch in p["parola"]:
                if page.locator(V + " .mente-fine:not([hidden])").count():
                    break
                page.click(V + " .mg-tasto[data-t='%s']" % ch)
        else:
            testo = p["parola"].lower()
            if i == 0 and "a" in testo:
                testo = testo.replace("a", "à", 1)   # la À vale come A
            page.keyboard.type(testo)
    s = fine_ok(page, "cruciverba")
    check("cruciverba: completato e salvato in progress.mente.giochi", bool(s) and s["punti"] == s["massimo"], s)
    page.screenshot(path=SHOTS + "/mente-giochi-2-cruciverba-fine.png", full_page=True)

    # aiutini: rivela una lettera / la parola (livello medio)
    vai(page, "#/mente/cruciverba/2", V + " .mg-cw-griglia")
    page.click(V + " [data-a=lettera]")
    check("cruciverba: «Rivela una lettera»", page.locator(V + " .mg-cw-cella.rivelata").count() == 1)
    page.click(V + " [data-a=parola]")
    n = page.evaluate("() => PD.menteGiochi.corrente.soluzione.parole[0].len")
    check("cruciverba: «Rivela la parola»", page.locator(V + " .mg-cw-cella.rivelata").count() == n)
    prima = page.evaluate("() => JSON.stringify(PD.menteGiochi.corrente.soluzione.sol)")
    page.click(V + " [data-a=altro]")
    page.wait_for_selector(V + " [data-a=oggi]")
    check("cruciverba: «Un altro cruciverba» cambia griglia", page.evaluate("() => JSON.stringify(PD.menteGiochi.corrente.soluzione.sol)") != prima)
    page.keyboard.press("ArrowRight"); page.keyboard.press("Backspace")

    # ---------------------------------------------------------------- Indovina la frase, fino alla vittoria
    vai(page, "#/mente/frase/1", V + " .mg-fr-tab")
    f = sol(page)["soluzione"]
    check("frase: categoria come indizio", f["categoria"] in page.inner_text(V + " .mg-fr-cat"))
    check("frase: 8 cuoricini al livello facile", page.inner_text(V + " .mg-cuori").count("❤️") == 8)
    page.screenshot(path=SHOTS + "/mente-giochi-3-frase.png", full_page=True)
    lettere = []
    norm = page.evaluate("(t) => PD.menteGiochi.norm(t).replace(/[^A-Z]/g, '')", f["testo"])
    for ch in norm:
        if ch not in lettere:
            lettere.append(ch)
    # una lettera che non c'e' toglie un cuoricino
    assente = next(x for x in "QZWXKJYHBFV" if x not in lettere)
    page.click(V + " .mg-tasto[data-t='%s']" % assente)
    check("frase: lettera sbagliata toglie un cuoricino", page.inner_text(V + " .mg-cuori").count("❤️") == 7)
    for k, ch in enumerate(lettere):
        if page.locator(V + " .mente-fine:not([hidden])").count():
            break
        if k % 2:
            page.keyboard.press(ch)
        else:
            page.click(V + " .mg-tasto[data-t='%s']" % ch)
    page.wait_for_selector(V + " .mg-spiega", timeout=5000)
    check("frase: spiegazione alla fine", f["spiega"][:20] in page.inner_text(V + " .mg-spiega"))
    s = fine_ok(page, "frase")
    check("frase: vittoria salvata in progress.mente.giochi", bool(s) and s["punti"] >= 1, s)
    # indovinare tutta la frase scrivendola (difficile: 4 cuori)
    vai(page, "#/mente/frase/3", V + " .mg-fr-tab")
    check("frase: 4 cuoricini al livello difficile", page.inner_text(V + " .mg-cuori").count("❤️") == 4)
    f = sol(page)["soluzione"]
    page.click(V + " [data-a=tutta]")
    page.fill(V + " .mg-fr-tutta input", f["testo"].lower())
    page.press(V + " .mg-fr-tutta input", "Enter")
    s = fine_ok(page, "frase")
    check("frase: indovinata scrivendo tutta la frase", bool(s) and s["punti"] == 10, s)

    # ---------------------------------------------------------------- Parole mescolate
    vai(page, "#/mente/anagramma/1", V + " .mg-an-tessere")
    for turno in range(5):
        page.wait_for_selector(V + " .mg-an-tessera:not([disabled])")
        w = sol(page)["soluzione"]["parola"]
        if turno == 0:
            page.click(V + " [data-a=aiuto]")
            check("anagramma: l'aiutino mette la prima lettera", page.inner_text(V + " .mg-an-posto.aiuto") == w[0])
            page.keyboard.type(w[1:].lower())
        else:
            for ch in w:
                page.click(V + " .mg-an-tessera:not([disabled]):text-is('%s')" % ch)
        page.wait_for_selector(V + " .mg-an-risposta.giusta")
        page.click(V + " [data-a=avanti]")
    s = fine_ok(page, "anagramma")
    check("anagramma: 5 parole, punti salvati (9 su 10 con un aiutino)", bool(s) and s["punti"] == 9 and s["massimo"] == 10, s)

    # ---------------------------------------------------------------- Completa il proverbio
    vai(page, "#/mente/proverbio/2", V + " .mg-pr-opz")
    check("proverbio: 4 scelte al livello medio", page.locator(V + " .quiz-opt").count() == 4)
    for k in range(6):
        page.wait_for_selector(V + " .quiz-opt:not([disabled])")
        f = sol(page)["soluzione"]
        page.evaluate("""(a) => { var b = Array.prototype.filter.call(document.querySelectorAll('#view-mente .quiz-opt'),
            function (x) { return (x.getAttribute('data-v') === a.m) === a.giusta; })[0]; b.click(); }""", {"m": f["manca"], "giusta": k > 0})
        page.wait_for_selector(V + " .mg-pr-esito .explain")
        if k == 0:
            check("proverbio: spiegazione dopo la risposta", f["spiega"][:15] in page.inner_text(V + " .mg-pr-esito"))
        page.click(V + " [data-a=avanti]")
    s = fine_ok(page, "proverbio")
    check("proverbio: 5 giusti su 6 salvati", bool(s) and s["punti"] == 5 and s["massimo"] == 6, s)

    # ---------------------------------------------------------------- Parole a catena
    vai(page, "#/mente/catena/1", V + " .mg-ca-form")
    # la catena mostra solo gli ultimi anelli: le parole già usate le ricorda anche il test (usate)
    usate = []
    trova = """([pre, usate]) => { var u = {}; usate.forEach(function (w) { u[w] = 1; }); Array.prototype.forEach.call(document.querySelectorAll('#view-mente .mg-ca-anello'), function (a) { u[a.textContent] = 1; });
        var c = Object.keys(PD.menteGiochi.parole).filter(function (w) { return w.indexOf(pre) === 0 && w.length >= 3 && w !== pre && !u[w]; });
        return c[0] || ''; }"""
    for t in range(5):
        page.wait_for_selector(V + " .mg-ca-coda")
        if page.locator(V + " .mente-fine:not([hidden])").count():
            break
        pre = page.inner_text(V + " .mg-ca-coda")
        if t == 1:
            # parola non nel dizionario: si chiede con fiducia
            page.fill(V + " .mg-input", pre + "ZZOLINO")
            page.press(V + " .mg-input", "Enter")
            page.wait_for_selector(V + " .mg-ca-dubbio")
            check("catena: «È una parola italiana?» per parole sconosciute", "parola italiana" in page.inner_text(V + " .mg-ca-dubbio"))
            page.click(V + " [data-a=no]")
            page.wait_for_selector(V + " .mg-ca-form")
        if t == 2:
            page.fill(V + " .mg-input", "XYZ")
            page.press(V + " .mg-input", "Enter")
            check("catena: avvisa se non comincia bene", pre in page.inner_text(V + " .mg-ca-msg"))
        w = page.evaluate(trova, [pre, usate])
        if w:
            usate.append(w)
        if not w:   # vicolo cieco nel dizionario (parola iniziale a caso): si usa una parola «di fiducia»
            page.fill(V + " .mg-input", (pre + "ARIO").lower())
            page.press(V + " .mg-input", "Enter")
            page.wait_for_selector(V + " .mg-ca-dubbio")
            page.click(V + " [data-a=si]")
            continue
        if t == 3:
            page.click(V + " [data-a=tastiera]")
            page.wait_for_selector(V + " .mg-tastiera")
            page.fill(V + " .mg-input", "")
            for ch in w:
                page.click(V + " .mg-tasto[data-t='%s']" % ch)
            page.click(V + " .mg-tasto[data-t='OK']")
        else:
            page.fill(V + " .mg-input", w.lower())
            page.press(V + " .mg-input", "Enter")
    s = fine_ok(page, "catena")
    check("catena: 5 parole a catena salvate", bool(s) and s["punti"] == 5, s)

    # ---------------------------------------------------------------- telefono e tema scuro
    page.set_viewport_size({"width": 390, "height": 800})
    page.evaluate("() => { PD.settings.theme = 'dark'; PD.applySettings(); }")
    vai(page, "#/mente/cruciverba/3", V + " .mg-cw-griglia")
    check("cruciverba: niente scorrimento orizzontale su telefono", nessuno_scorrimento(page))
    page.screenshot(path=SHOTS + "/mente-giochi-4-cruciverba-telefono-scuro.png", full_page=True)
    vai(page, "#/mente/frase/2", V + " .mg-fr-tab")
    check("frase: niente scorrimento orizzontale su telefono", nessuno_scorrimento(page))
    page.screenshot(path=SHOTS + "/mente-giochi-5-frase-telefono-scuro.png", full_page=True)
    larghe = page.evaluate("""() => { var L = PD.menteGiochi.frasi.slice().sort(function (a, b) {
        function m(t) { return Math.max.apply(null, t.split(' ').map(function (w) { return w.length; })); } return m(b.testo) - m(a.testo); });
        return L[0].testo; }""")
    for gioco in ("anagramma/3", "proverbio/1", "catena/3"):
        vai(page, "#/mente/" + gioco, V + " .mg")
        check("%s: niente scorrimento orizzontale su telefono" % gioco.split("/")[0], nessuno_scorrimento(page))
    page.set_viewport_size({"width": 1280, "height": 800})
    vai(page, "#/mente/frase/1", V + " .mg-fr-tab")
    page.screenshot(path=SHOTS + "/mente-giochi-6-frase-scuro.png", full_page=True)
    page.evaluate("() => { PD.settings.theme = 'light'; PD.applySettings(); }")
    print("     frase con la parola più lunga: " + larghe)
