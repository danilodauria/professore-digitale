"""Prove di «Il nostro percorso» (percorsi.js, data-percorsi.js): maschera di benvenuto alla prima apertura,
scelta di contesto / chi / questionario, percorso coerente, spunte automatiche e manuali, cambio di contesto senza
perdere i progressi, stampa del programma, riquadro nell'Inizio, nessun rimando rotto in nessun contesto,
censimento di tutto ciò che c'è nel programma («non si dimentica niente»), telefono e tema scuro.
Chiamato da tests/test_ui.py: prova(page, ROOT, check, SHOTS)."""
import json

# Ciò che VOLUTAMENTE non compare in un contesto (con il motivo). Le voci controllate per ogni contesto sono:
# le lezioni del corso, i 11 esercizi della Palestra, i 6 simulatori della Vita digitale, «È una truffa?»,
# «Spiegami questa lettera», ripasso, competenze, Chiedi, Ginnastica per la mente, Cultura generale, libro,
# FeniceOS, quiz del corso e Grande Quiz dell'Informatica. Ogni voce o è nel percorso o è qui.
ESCLUSI = {
    "anziani": {},
    "sociale": {},
    "biblioteca": {},
    "casa": {},
    "altro": {},
    "primaria": {
        "lezione:smartphone": "età: i bambini usano il telefono dei genitori; la comunicazione si fa con «Buone maniere in rete»",
        "lezione:pa": "SPID, CIE e pagoPA riguardano gli adulti",
        "lezione:linux": "il riuso si tratta con «Il computer e l'ambiente» e FeniceOS",
        "lezione:acquisti-sicuri": "i bambini non comprano online",
        "lezione:foto-ricordi": "trasferire e copiare le foto è un compito degli adulti",
        "vita:identita": "identità digitale: adulti", "vita:visita": "prenotazioni sanitarie: adulti",
        "vita:pagamento": "pagamenti: adulti", "vita:banca": "banca online: adulti",
        "lettera": "lettere e avvisi ufficiali: adulti",
        "quiz:informatica": "264 domande del manuale per adulti: troppo per la primaria (c'è il quiz del corso)",
    },
    "secondaria": {
        "lezione:mouse": "gesti già noti ai ragazzi (se serve, la Palestra resta a disposizione)",
        "lezione:desktop": "finestre già note; si ripassano in «Scorciatoie e scrittura veloce»",
        "lezione:smartphone": "uso del telefono già noto: si lavora su netiquette, privacy e benessere",
        "lezione:foto-ricordi": "le foto si trattano dal lato privacy («I miei dati valgono»)",
        "palestra:click": "gesto già noto", "palestra:dblclick": "gesto già noto", "palestra:scroll": "gesto già noto",
        "palestra:rightclick": "gesto già noto", "palestra:memory": "gioco per principianti del mouse",
        "vita:visita": "prenotazioni sanitarie: adulti", "vita:pagamento": "pagamenti: adulti", "vita:banca": "banca online: adulti",
        "lettera": "lettere ufficiali: adulti",
        "mente": "la Ginnastica per la mente è pensata per gli adulti: in classe si usano quiz e progetti",
    },
    "migranti": {
        "lezione:linux": "il riuso non è una priorità del corso di italiano",
        "lezione:foto-ricordi": "si tratta a richiesta, non è una priorità",
        "fenice": "testo tecnico e lungo: non adatto a chi impara l'italiano",
    },
    "parrocchia": {
        "lezione:linux": "il riuso non è una priorità del laboratorio tra generazioni",
        "fenice": "il riuso non è una priorità del laboratorio tra generazioni",
    },
    "rsa": {
        "lezione:computer": "sessioni brevi: si parte dai gesti, non dalla teoria", "lezione:tastiera": "scrivere stanca: si usano voce e vocali",
        "lezione:desktop": "l'operatore apre le finestre", "lezione:file": "l'operatore gestisce i file", "lezione:internet": "l'operatore apre le pagine",
        "lezione:email": "si comunica con videochiamate e vocali", "lezione:password": "gli account li gestiscono familiari e struttura (la regola d'oro resta)",
        "lezione:pa": "le pratiche le seguono struttura e familiari", "lezione:ia": "non prioritaria in RSA", "lezione:linux": "non prioritaria in RSA",
        "lezione:acquisti-sicuri": "gli acquisti li fanno i familiari",
        "palestra:dblclick": "si usano solo i gesti essenziali", "palestra:drag": "gesto faticoso", "palestra:typing": "scrivere stanca",
        "palestra:keys": "scrivere stanca", "palestra:scroll": "lo fa l'operatore", "palestra:rightclick": "gesto non necessario",
        "palestra:select": "gesto non necessario", "palestra:copypaste": "gesto non necessario",
        "vita:identita": "pratiche dei familiari", "vita:visita": "le visite le prenota la struttura", "vita:pagamento": "pagamenti dei familiari",
        "vita:banca": "banca dei familiari", "vita:posta": "niente email: videochiamate e vocali",
        "truffa": "i messaggi sospetti si mostrano all'operatore (regola d'oro)", "fenice": "non prioritaria in RSA",
        "quiz:corso": "i quiz lunghi stancano: c'è la domanda del giorno", "quiz:informatica": "i quiz lunghi stancano",
    },
    "comune": {
        "lezione:ia": "non è un bisogno da sportello", "lezione:linux": "non è un bisogno da sportello",
        "lezione:foto-ricordi": "non è un bisogno da sportello: si indirizza alla biblioteca o al centro anziani",
        "mente": "non è un'attività da sportello", "fenice": "non è un bisogno da sportello",
    },
    "impiego": {
        "lezione:linux": "non prioritario per la ricerca di lavoro", "lezione:acquisti-sicuri": "non prioritario per la ricerca di lavoro",
        "lezione:foto-ricordi": "non prioritario per la ricerca di lavoro", "fenice": "non prioritario per la ricerca di lavoro",
    },
}
# Nel programma ma fuori da ogni percorso, di proposito
ESCLUSI_SEMPRE = {
    "sostieni": "pagina per sostenere il progetto, non didattica",
    "setup": "configurazione tecnica (solo Windows), la fa chi installa",
    "attestato": "si apre dal quiz superato (rimando «quiz»)",
    "windows-primi-passi": "domande della guida per Windows: si raggiungono da «Chiedi al Professore»",
    "ebook": "nel programma non ci sono ebook (biblioteca: lo dice la nota del contesto)",
}

CENSIMENTO_JS = r"""() => {
  const voci = {}, add = (k, cosa) => { voci[k] = cosa; };
  (window.PD_LESSONS || []).forEach(L => add('lezione:' + L.id, PD.lessonArea(L)));
  [...document.querySelectorAll('#view-practice [data-go^="#/practice/"]')].forEach(b => add('palestra:' + b.getAttribute('data-go').split('/')[2], 'palestra'));
  PD.vita.elenco().forEach(s => add('vita:' + s.id, 'vita'));
  PD.mente.elenco().forEach(g => add('mente:' + g.id, 'mente'));
  add('mente:diario', 'mente');
  PD.prove().forEach(p => add('quiz:' + p.id, 'quiz'));
  (window.PD_INCONTRI || []).forEach(i => add('incontro:' + i.id, 'incontro'));
  ['incontri', 'registro', 'resoconto', 'digcomp'].forEach(t => add('enti:' + t, 'enti'));
  const pacchetti = {}; PD.lessonsOf('cultura').forEach(L => pacchetti[L.pack] = 1);
  Object.keys(pacchetti).forEach(p => add('cultura:' + p, 'cultura'));
  const viste = { truffa: 'truffa', lettera: 'lettera', ripasso: 'ripasso', competenze: 'competenze', ask: 'chiedi', settings: 'impostazioni',
    profili: 'profili', board: 'lavagna', editor: 'editor', aula: 'aula', tablet: 'tablet', quiz: 'quiz', libro: 'libro', fenice: 'fenice', mente: 'mente' };
  const altreViste = Object.keys(PD.views).filter(v => !viste[v] && ['home', 'lessons', 'practice', 'vita', 'cultura', 'enti', 'percorso'].indexOf(v) < 0);
  Object.keys(viste).forEach(v => { if (PD.views[v]) add(viste[v], 'vista'); });
  const rif = PD.percorsi.riferimenti(), presi = {};
  Object.keys(rif).forEach(r => { const i = r.indexOf(':'), tipo = i < 0 ? r : r.slice(0, i), id = i < 0 ? '' : r.slice(i + 1);
    presi[r] = 1; presi[tipo] = 1;
    if (tipo === 'chiedi') presi.chiedi = 1; });
  const coperta = k => {
    if (presi[k]) return true;
    const area = voci[k];
    if (k.indexOf('lezione:') === 0) {
      const L = PD_LESSONS.find(l => 'lezione:' + l.id === k);
      if (area === 'cultura') return !!presi['cultura:' + L.pack];
      if (area === 'libro') return !!presi.libro;
      if (area === 'fenice') return !!presi.fenice;
    }
    return false;
  };
  return { voci: voci, mancanti: Object.keys(voci).filter(k => !coperta(k)), altreViste: altreViste, n: Object.keys(voci).length };
}"""

PER_CONTESTO_JS = r"""() => {
  const core = [];
  PD.lessonsOf('corso').forEach(L => core.push('lezione:' + L.id));
  [...document.querySelectorAll('#view-practice [data-go^="#/practice/"]')].forEach(b => core.push('palestra:' + b.getAttribute('data-go').split('/')[2]));
  PD.vita.elenco().forEach(s => core.push('vita:' + s.id));
  core.push('truffa', 'lettera', 'ripasso', 'competenze', 'chiedi', 'mente', 'cultura', 'libro', 'fenice', 'quiz:corso', 'quiz:informatica');
  const out = {};
  PD.percorsi.contesti().forEach(C => {
    const perc = PD.percorsi.costruisci(C.id, 'gruppo'), have = {};
    perc.tappe.forEach(t => t.attivita.forEach(x => {
      have[x.att.r] = 1; have[x.tipo] = 1;
      if (x.tipo === 'lezione') { const L = PD_LESSONS.find(l => l.id === x.id); if (L && PD.lessonArea(L) !== 'corso') have[PD.lessonArea(L)] = 1; }
    }));
    out[C.id] = { mancano: core.filter(k => !have[k]), presenti: core.filter(k => have[k]) };
  });
  return out;
}"""

# controllo indipendente dei rimandi: ogni attività visibile di ogni contesto porta a qualcosa che esiste davvero
RIMANDI_JS = r"""() => {
  const rotti = [], prat = [...document.querySelectorAll('#view-practice [data-go^="#/practice/"]')].map(b => b.getAttribute('data-go').split('/')[2]);
  const esiste = (x) => {
    const id = x.id;
    switch (x.tipo) {
      case 'lezione': { const L = PD_LESSONS.find(l => l.id === id); return !!L && (x.att.p == null || !!L.steps[x.att.p]); }
      case 'palestra': return prat.indexOf(id) >= 0;
      case 'vita': return PD.vita.elenco().some(s => s.id === id);
      case 'mente': return !id || id === 'diario' || PD.mente.elenco().some(g => g.id === id);
      case 'quiz': return !id || PD.prove().some(p => p.id === id);
      case 'cultura': return PD.lessonsOf('cultura', id).length > 0;
      case 'chiedi': return !id || PD_KB.some(k => k.q === id);
      case 'incontro': return PD_INCONTRI.some(i => i.id === id);
      case 'enti': return ['incontri', 'registro', 'resoconto', 'digcomp'].indexOf(id) >= 0 && !!PD.views.enti;
      case 'pratica': return !!(x.att.k && x.att.t);
      default: { const v = { libro: 'libro', fenice: 'fenice', truffa: 'truffa', lettera: 'lettera', ripasso: 'ripasso', competenze: 'competenze',
        impostazioni: 'settings', profili: 'profili', lavagna: 'board', editor: 'editor', aula: 'aula', tablet: 'tablet' }[x.tipo];
        return !!(v && PD.views[v] && document.getElementById('view-' + v)); }
    }
  };
  let n = 0;
  PD.percorsi.contesti().forEach(C => ['solo', 'gruppo', 'classe', 'operatore'].forEach(chi => {
    PD.percorsi.costruisci(C.id, chi).tappe.forEach(t => t.attivita.forEach(x => { n++; if (!esiste(x) || !x.ok) rotti.push(C.id + '/' + chi + '/' + t.id + ': ' + x.att.r); }));
  }));
  PD.percorsi.dati.strumenti.forEach(s => { const x = PD.percorsi.risolvi(s); n++; if (!esiste(x)) rotti.push('strumenti: ' + s.r); });
  return { n: n, rotti: rotti };
}"""


def prova(page, ROOT, check, SHOTS):
    errori = []
    on_err = lambda e: errori.append(str(e))
    page.on("pageerror", on_err)
    standalone = ROOT.startswith("file:")

    def vai(h, sel, timeout=15000):
        page.goto(ROOT + h)
        page.wait_for_selector(sel, timeout=timeout)

    vai("#/practice", "#view-practice .tile")   # il censimento legge gli esercizi dalla pagina della Palestra
    orig = page.evaluate("""() => JSON.stringify({ p: PD.progress.percorso === undefined ? null : PD.progress.percorso,
        s: PD.settings.percorsoContesto === undefined ? null : PD.settings.percorsoContesto,
        lez: PD.progress.lessons.computer || null, voce: PD.settings.voice, tema: PD.settings.theme })""")
    orig = json.loads(orig)
    try:
        # ---------------------------------------------------------------- dati: rimandi, censimento, sicurezza
        v = page.evaluate("PD.percorsi.verifica()")
        check("percorsi: nessun rimando rotto né tappa incompleta (verifica interna)", not v, v[:8])
        r = page.evaluate(RIMANDI_JS)
        check("percorsi: tutti i rimandi di tutti i contesti esistono (%d attività, 12 contesti × 4 «chi»)" % r["n"], not r["rotti"] and r["n"] > 1000, r["rotti"][:10])
        c = page.evaluate(CENSIMENTO_JS)
        check("percorsi: censimento, ogni contenuto del programma è in almeno un percorso (%d voci)" % c["n"], not c["mancanti"], c["mancanti"])
        sconosciute = [x for x in c["altreViste"] if x not in ESCLUSI_SEMPRE]
        check("percorsi: le altre pagine sono escluse di proposito (%s)" % ", ".join(c["altreViste"]), not sconosciute, sconosciute)
        pc = page.evaluate(PER_CONTESTO_JS)
        check("percorsi: ogni contesto ha una lista di esclusioni", set(pc) == set(ESCLUSI), sorted(set(pc) ^ set(ESCLUSI)))
        dimenticati = {k: [x for x in pc[k]["mancano"] if x not in ESCLUSI.get(k, {})] for k in pc}
        dimenticati = {k: v for k, v in dimenticati.items() if v}
        check("percorsi: in ogni contesto nulla è dimenticato (o c'è, o è escluso con un motivo)", not dimenticati, dimenticati)
        incoerenti = {k: [x for x in ESCLUSI.get(k, {}) if x in pc[k]["presenti"]] for k in pc}
        incoerenti = {k: v for k, v in incoerenti.items() if v}
        check("percorsi: le esclusioni dichiarate sono davvero assenti", not incoerenti, incoerenti)
        sic = page.evaluate("""() => PD.percorsi.contesti().map(C => {
            const risp = {}; PD.percorsi.dati.domande.forEach(d => risp[d.id] = 'si');
            const perc = PD.percorsi.costruisci(C.id), f = perc.fasi.filter(f => f.id === 'sicurezza')[0];
            const noteSic = perc.tappe.filter(t => t.sicurezza && PD.percorsi.statoTappa(t, { risposte: risp, spunte: {} }).giaNota).length;
            const truffe = perc.tappe.some(t => t.sicurezza && t.attivita.some(x => x.att.r === 'lezione:truffe' || x.att.r === 'palestra:scam'));
            return [C.id, perc.fasi.length, f ? f.tappe.length : 0, noteSic, truffe, perc.fasi.every(f => f.tappe.length > 0)];
        })""")
        cattivi = [s for s in sic if s[1] != 8 or s[2] < 1 or s[3] != 0 or not s[4] or not s[5]]
        check("percorsi: 8 fasi in ogni contesto, sicurezza sempre presente e mai saltata", not cattivi, cattivi)
        fac = page.evaluate("""() => PD.percorsi.dati.fasi.filter(f => f.id !== 'mente').every(f => f.incontri.length > 0 && f.consiglio)
            && PD.percorsi.dati.fasi.every(f => f.consiglio)""")
        check("percorsi: ogni fase ha un consiglio di conduzione e (tranne la mente) un incontro pronto", fac)

        # ---------------------------------------------------------------- maschera alla prima apertura (sessione nuova)
        ctx = page.context.browser.new_context(viewport={"width": 1280, "height": 860})
        t = ctx.new_page()
        t.on("pageerror", on_err)
        if standalone:   # nella portatile ogni contesto ha il suo archivio: nessun percorso già scelto
            pass
        t.goto(ROOT)
        t.wait_for_selector("#view-percorso .pc-maschera, #view-profili .pf-avvio", timeout=20000)
        if t.is_visible("#view-profili .pf-avvio"):
            # ordine: prima la persona, poi il percorso
            t.click(".pf-persona.attivo")
            t.wait_for_selector("#view-percorso .pc-maschera", timeout=15000)
            check("percorsi: la maschera arriva dopo la scelta della persona", True)
        check("percorsi: maschera alla prima apertura", "#/percorso/inizia" in t.url and t.is_visible("#view-percorso .pc-maschera"), t.url)
        t.wait_for_timeout(1300)
        check("percorsi: il saluto aspetta la fine della maschera", not t.is_visible("#pd-bubble"))
        check("percorsi: maschera con 12 contesti", t.locator("[data-pc-contesto]").count() == 12)
        t.screenshot(path=SHOTS + "/pc-01-maschera-dove.png")
        t.click('[data-pc-contesto="anziani"]')
        t.wait_for_selector("[data-pc-chi]")
        check("percorsi: chi è consigliato per il contesto", "consigliato" in t.inner_text('[data-pc-chi="gruppo"]'))
        t.screenshot(path=SHOTS + "/pc-02-maschera-chi.png")
        t.click('[data-pc-chi="gruppo"]')
        t.wait_for_selector(".pc-domanda")
        check("percorsi: domande per il gruppo", "gruppo" in t.inner_text(".pc-d-testo"), t.inner_text(".pc-d-testo"))
        t.screenshot(path=SHOTS + "/pc-03-questionario.png")
        risposte = ["si", "si", "poco", "no", "no", "no", "no", "no"]
        for i, x in enumerate(risposte):
            t.wait_for_selector('.pc-domanda:has-text("Domanda %d di 8") [data-pc-risp="%s"]' % (i + 1, x))
            t.click('[data-pc-risp="%s"]' % x)
        t.wait_for_selector(".pc-riepilogo")
        t.screenshot(path=SHOTS + "/pc-04-riepilogo.png")
        P = t.evaluate("PD.progress.percorso")
        check("percorsi: scelte salvate (contesto, chi, risposte, livello)", P and P["contesto"] == "anziani" and P["chi"] == "gruppo"
              and P["risposte"]["mouse"] == "si" and P["livello"] == "pratica" and P.get("iniziato"), P)
        note = t.evaluate("""() => { const perc = PD.percorsi.attuale(); return perc.tappe.filter(x => PD.percorsi.statoTappa(x).giaNota).map(x => x.id); }""")
        fatte = t.evaluate("() => PD.percorsi.attuale().tappe.filter(x => PD.percorsi.statoTappa(x).completa).map(x => x.id)")
        check("percorsi: le tappe già note si saltano (computer, mouse, tastiera)", "mouse" in note and "tastiera" in note
              and ("computer" in note or "computer" in fatte) and "file" not in note, [note, fatte])
        t.click("#pc-via")
        t.wait_for_selector("#view-percorso .pc-prossima")
        check("percorsi: dopo la maschera il saluto con il percorso", "percorso" in t.inner_text("#pd-bubble"), t.inner_text("#pd-bubble") if t.is_visible("#pd-bubble") else "")
        t.screenshot(path=SHOTS + "/pc-05-percorso.png")
        ctx.close()
        if not standalone:   # la sessione nuova ha scritto sul disco: ricarichiamo i dati
            page.reload(); page.wait_for_selector("#view-practice .tile")

        # ---------------------------------------------------------------- scelta da Impostazioni / Inizio, percorso coerente
        page.evaluate("PD.settings.voice = false")
        vai("#/settings", "#pc-impostazioni")
        check("percorsi: riquadro nelle Impostazioni", "Il nostro percorso" in page.inner_text("#pc-impostazioni"))
        page.click('#pc-impostazioni [data-go="#/percorso/inizia"]')
        page.wait_for_selector("[data-pc-contesto]")
        page.click('[data-pc-contesto="biblioteca"]'); page.wait_for_selector("[data-pc-chi]")
        page.click('[data-pc-chi="operatore"]'); page.wait_for_selector("#pc-q-salta")
        page.click("#pc-q-salta"); page.wait_for_selector(".pc-riepilogo")
        page.click("#pc-via"); page.wait_for_selector("#view-percorso .pc-prossima")
        coer = page.evaluate("""() => { const perc = PD.percorsi.attuale(), P = PD.progress.percorso;
            return { c: P.contesto, chi: P.chi, liv: P.livello, n: perc.tappe.length, fasi: document.querySelectorAll('#view-percorso .pc-fase').length,
              righe: document.querySelectorAll('#view-percorso .pc-tappa').length, prima: perc.tappe[0].id,
              prox: document.querySelector('#pc-prossima h2').textContent, sic: !!document.querySelector('#pc-fase-sicurezza .pc-tappa'),
              cond: !!document.querySelector('.pc-conduce a[href*="#/enti/incontri/"]'), str: document.querySelectorAll('.pc-strumenti [data-pc-vai]').length }; }""")
        check("percorsi: percorso generato coerente (biblioteca, operatore, 8 fasi, tutte le tappe)", coer["c"] == "biblioteca" and coer["chi"] == "operatore"
              and coer["liv"] == "primi" and coer["fasi"] == 8 and coer["righe"] == coer["n"] and coer["n"] >= 20 and coer["sic"], coer)
        check("percorsi: prima tappa in grande («Continua da qui»)", "Accoglienza allo sportello" in coer["prox"] and coer["prima"] == "sportello", coer["prox"])
        check("percorsi: per chi conduce incontri pronti, consigli e strumenti", coer["cond"] and coer["str"] >= 4, coer)
        page.screenshot(path=SHOTS + "/pc-06-biblioteca.png", full_page=False)

        # ---------------------------------------------------------------- spunte: manuale e automatica
        page.click('#pc-prossima [data-pc-spunta="pratica:bisogno"]')
        page.wait_for_timeout(300)
        check("percorsi: spunta manuale salvata", page.evaluate("!!PD.progress.percorso.spunte['pratica:bisogno']"))
        page.evaluate("""() => { PD.progress.lessons.computer = { seen: [0, 1, 2, 3, 4], done: true, quiz: { score: 3, total: 3 }, when: new Date().toISOString() }; PD.saveProgress(); }""")
        vai("#/home", "#view-home .hero"); vai("#/percorso", "#view-percorso .pc-fase")
        fatta = page.evaluate("document.querySelector('.pc-tappa[data-pc-t=\"computer\"]').classList.contains('fatta')")
        auto = page.evaluate("""() => { const i = document.querySelector('.pc-tappa[data-pc-t="computer"] [data-pc-spunta="lezione:computer"]'); return i && i.checked && i.disabled; }""")
        check("percorsi: spunta automatica dopo la lezione completata", fatta and auto, [fatta, auto])
        # apertura di un'attività: ricorda la tappa e porta al contenuto
        page.click('.pc-tappa[data-pc-t="mouse"] > summary')
        page.click('.pc-tappa[data-pc-t="mouse"] [data-pc-apri="palestra:click"]')
        page.wait_for_selector("#view-practice:not([hidden])")
        check("percorsi: «Apri» porta all'esercizio e ricorda la tappa", "#/practice/click" in page.url and page.evaluate("PD.progress.percorso.ultimaTappa") == "mouse", page.url)
        vai("#/percorso", "#pc-prossima")
        check("percorsi: «Continua da qui» riparte dall'ultima tappa aperta", "mouse" in page.inner_text("#pc-prossima").lower(), page.inner_text("#pc-prossima h2"))
        # tappa segnata a mano
        page.click('#pc-prossima [data-pc-tappa-fatta="mouse"]'); page.wait_for_timeout(300)
        check("percorsi: tappa segnata come fatta", page.evaluate("!!PD.progress.percorso.spunte['tappa:mouse']") and "mouse" not in page.inner_text("#pc-prossima h2").lower())

        # ---------------------------------------------------------------- voce
        page.evaluate("window.__pcVoce = []; window.__pcSpeak = PD.speak; PD.speak = function (t) { window.__pcVoce.push(t); return Promise.resolve(); }; PD.settings.voice = true")
        vai("#/home", "#view-home .hero"); vai("#/percorso", "#pc-prossima"); page.wait_for_timeout(700)
        page.click("#pc-prossima [data-pc-leggi]")
        voce = page.evaluate("window.__pcVoce")
        check("percorsi: il Professore legge la tappa a voce", any(x.startswith("Tappa ") for x in voce), voce)
        page.evaluate("PD.speak = window.__pcSpeak; PD.settings.voice = false")

        # ---------------------------------------------------------------- cambio di contesto senza perdere i progressi
        page.click('[data-go="#/percorso/inizia"]'); page.wait_for_selector("[data-pc-contesto]")
        check("percorsi: cambio di contesto con il contesto attuale già scelto", page.locator('[data-pc-contesto="biblioteca"].scelta').count() == 1)
        page.click('[data-pc-contesto="comune"]'); page.wait_for_selector("[data-pc-chi]")
        page.click('[data-pc-chi="operatore"]'); page.wait_for_selector("#pc-q-tieni")
        page.click("#pc-q-tieni"); page.wait_for_selector(".pc-riepilogo")
        page.click("#pc-via"); page.wait_for_selector("#view-percorso .pc-prossima")
        dopo = page.evaluate("""() => ({ c: PD.progress.percorso.contesto, sp: PD.progress.percorso.spunte,
            comp: document.querySelector('.pc-tappa[data-pc-t="computer"]').classList.contains('fatta'),
            mouse: document.querySelector('.pc-tappa[data-pc-t="mouse"]').classList.contains('fatta'),
            imp: PD.settings.percorsoContesto })""")
        check("percorsi: cambio di contesto senza perdere i progressi", dopo["c"] == "comune" and dopo["sp"].get("pratica:bisogno") and dopo["comp"] and dopo["mouse"]
              and dopo["imp"] == "comune", dopo)

        # ---------------------------------------------------------------- stampa del programma
        page.evaluate("window.__pcPrint = null; window.__pcPH = PD.printHTML; PD.printHTML = function (h, o) { window.__pcPrint = [h, o]; }")
        page.click("#pc-stampa")
        st = page.evaluate("""() => { const d = document.createElement('div'); d.innerHTML = window.__pcPrint[0];
            return { o: window.__pcPrint[1], fasi: d.querySelectorAll('h2.pc-p-fase').length, righe: d.querySelectorAll('tbody tr').length,
              n: PD.percorsi.attuale().tappe.length, t: d.textContent }; }""")
        page.evaluate("PD.printHTML = window.__pcPH")
        check("percorsi: stampa del programma per l'ente (8 fasi, una riga per tappa, DigComp)", st["o"] == "verticale" and st["fasi"] == 8 and st["righe"] == st["n"]
              and "Programma del percorso" in st["t"] and "DigComp" in st["t"] and "Incontri pronti" in st["t"], {k: st[k] for k in ("o", "fasi", "righe", "n")})

        # ---------------------------------------------------------------- riquadro nell'Inizio, in alto
        vai("#/home", "#pc-home")
        home = page.evaluate("""() => { const c = document.getElementById('pc-home'); return { dopoHero: !!(c.previousElementSibling && c.previousElementSibling.classList.contains('hero')),
            t: c.innerText, go: !!c.querySelector('[data-go="#/percorso"]') }; }""")
        check("percorsi: riquadro in cima all'Inizio («Tappa N di M»)", home["dopoHero"] and "Tappa" in home["t"] and " di " in home["t"] and home["go"], home)
        page.screenshot(path=SHOTS + "/pc-07-inizio.png")

        # ---------------------------------------------------------------- ogni contesto si apre senza errori
        n_err = len(errori)
        for cid in page.evaluate("PD.percorsi.contesti().map(c => c.id)"):
            page.evaluate("(c) => { PD.progress.percorso.contesto = c; PD.progress.percorso.chi = 'gruppo'; }", cid)
            vai("#/home", "#view-home .hero"); vai("#/percorso", "#view-percorso .pc-fase")
        check("percorsi: le pagine dei 12 contesti si aprono senza errori", len(errori) == n_err, errori[n_err:])
        page.evaluate("PD.progress.percorso.contesto = 'anziani'; PD.saveProgress()")

        # ---------------------------------------------------------------- telefono e tema scuro
        page.evaluate("PD.bubbleClose && PD.bubbleClose()")
        page.set_viewport_size({"width": 390, "height": 844})
        page.evaluate("PD.settings.theme = 'dark'; PD.applySettings()")
        larghi = []
        for h, sel in (("#/home", "#pc-home"), ("#/percorso", "#pc-prossima"), ("#/percorso/inizia", "[data-pc-contesto]")):
            vai(h, sel); page.wait_for_timeout(300)
            if page.evaluate("document.documentElement.scrollWidth > window.innerWidth + 1"): larghi.append(h)
            page.screenshot(path=SHOTS + "/pc-08-telefono-%s.png" % h.strip("#/").replace("/", "-"), full_page=False)
        page.click('[data-pc-contesto="anziani"]'); page.wait_for_selector("[data-pc-chi]")
        page.click('[data-pc-chi="solo"]'); page.wait_for_selector(".pc-domanda")
        if page.evaluate("document.documentElement.scrollWidth > window.innerWidth + 1"): larghi.append("questionario")
        page.screenshot(path=SHOTS + "/pc-09-telefono-questionario.png")
        page.click("#pc-dopo"); page.wait_for_selector("#view-percorso .pc-fase")   # «Annulla»: si torna al percorso
        check("percorsi: telefono (390 px) e tema scuro senza scorrimento orizzontale", not larghi, larghi)
        page.evaluate("PD.settings.theme = 'contrast'; PD.applySettings()")
        vai("#/percorso", "#pc-prossima")
        page.screenshot(path=SHOTS + "/pc-10-contrasto.png")
        check("percorsi: nessun errore JavaScript", not errori, errori[:5])
    finally:
        page.set_viewport_size({"width": 1366, "height": 800})
        page.evaluate("""(o) => {
            if (o.p === null) delete PD.progress.percorso; else PD.progress.percorso = o.p;
            if (o.lez === null) delete PD.progress.lessons.computer; else PD.progress.lessons.computer = o.lez;
            if (o.s === null) delete PD.settings.percorsoContesto; else PD.settings.percorsoContesto = o.s;
            PD.settings.voice = o.voce; PD.settings.theme = o.tema;
            if (window.__pcPH) PD.printHTML = window.__pcPH; if (window.__pcSpeak) PD.speak = window.__pcSpeak;
            PD.saveProgress(); PD.saveSettings(); if (PD.stopSpeech) PD.stopSpeech(); if (PD.bubbleClose) PD.bubbleClose(); }""", orig)
        page.wait_for_timeout(900)
        page.remove_listener("pageerror", on_err)
        page.goto(ROOT + "#/home"); page.wait_for_selector("#view-home h1")
