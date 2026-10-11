# -*- coding: utf-8 -*-
"""Test di voce e microfono su telefoni e tablet (3.5, src/web/js/voce.js): chiamato da tests/test_ui.py con
prova(page, ROOT, check, SHOTS). Apre un contesto «telefono» (390x844, touch, Chrome per Android) in cui:
- le API del server sono bloccate, così la pagina si comporta come l'app per telefono (PWA: window.PD_PWA, niente server);
- speechSynthesis e SpeechRecognition sono sostituiti da finti controllabili (add_init_script): la sintesi finta,
  come Chrome per Android, rifiuta di parlare («not-allowed») finché la pagina non riceve un tocco; le voci arrivano
  in ritardo come su iOS, con lang «it_IT».
Controlla: invito «Toccate qui per cominciare», saluto dopo il tocco, invito quando la voce resta muta, microfono spento
di base con spiegazione onesta, «Accendo» → domanda dettata e risposta, comando a voce «avanti», «Spegni il microfono»;
e che sul PC non cambi nulla. Autore: Danilo D'Auria - Licenza MIT"""

UA_ANDROID = ("Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) "
              "Chrome/126.0.0.0 Mobile Safari/537.36")

# Playwright dà alla pagina appena aperta una «attivazione» che un telefono vero non ha: qui la pagina è attiva solo
# dopo un vero tocco, un clic o un tasto (eventi «isTrusted»), per circa un secondo, come in Chrome. Usato anche da test_pwa.py.
ATTIVAZIONE = r"""
(function () {
  var att = { hasBeenActive: false, isActive: false }, tAtt = 0;
  ["touchend", "click", "keydown", "pointerup"].forEach(function (t) {
    window.addEventListener(t, function (e) {
      if (!e.isTrusted) return;
      att.hasBeenActive = true; att.isActive = true; clearTimeout(tAtt); tAtt = setTimeout(function () { att.isActive = false; }, 1000);
    }, true);
  });
  Object.defineProperty(navigator, "userActivation", { value: att, configurable: true });
})();
"""

FINTI = r"""
(function () {
  window.PD_PWA = true;
  var log = window.__voce = { dette: [], tentativi: 0, rifiutate: 0, sbloccata: false, muta: false, ascolti: 0, frase: "come faccio una videochiamata" };
  var voci = [];
  setTimeout(function () {   // come iOS: le voci arrivano dopo un po'
    voci = [{ name: "Samantha", lang: "en-US", localService: true, voiceURI: "s" }, { name: "Luca", lang: "it_IT", localService: true, voiceURI: "l" }];
    if (ss.onvoiceschanged) ss.onvoiceschanged({});
  }, 400);
  function Utt(t) { this.text = t; this.lang = ""; this.rate = 1; this.volume = 1; this.voice = null; }
  var coda = [];
  var ss = {
    speaking: false, pending: false, paused: false, onvoiceschanged: null,
    getVoices: function () { return voci.slice(); },
    addEventListener: function () {}, removeEventListener: function () {},
    speak: function (u) {
      log.tentativi++;
      var gesto = navigator.userActivation && navigator.userActivation.isActive;
      if (!log.sbloccata && !gesto) {          // Chrome per Android: senza un tocco la voce non parte
        log.rifiutate++;
        setTimeout(function () { if (u.onerror) u.onerror({ error: "not-allowed" }); }, 20);
        return;
      }
      log.sbloccata = true;
      if (log.muta) return;                     // voce che resta muta, senza errori (come iOS)
      log.dette.push({ text: u.text, lang: u.lang, voce: u.voice && u.voice.name, volume: u.volume });
      ss.speaking = true;
      var t = setTimeout(function () { ss.speaking = false; if (u.onend) u.onend({}); }, 120);
      coda.push({ u: u, t: t });
      setTimeout(function () { if (u.onstart) u.onstart({}); }, 10);
    },
    cancel: function () {
      coda.forEach(function (c) { clearTimeout(c.t); if (c.u.onerror) c.u.onerror({ error: "interrupted" }); });
      coda = []; ss.speaking = false;
    },
    pause: function () { ss.paused = true; }, resume: function () { ss.paused = false; }
  };
  Object.defineProperty(window, "speechSynthesis", { value: ss, configurable: true, writable: true });
  window.SpeechSynthesisUtterance = Utt;

  function Rec() { this.lang = ""; this.interimResults = false; this.continuous = false; this.onresult = null; this.onend = null; this.onerror = null; }
  function risultati(parti) {
    var r = parti.map(function (p) { var x = [{ transcript: p[0], confidence: 0.9 }]; x.isFinal = p[1]; return x; });
    return r;
  }
  Rec.prototype.start = function () {
    var self = this, frase = log.frase; log.ascolti++; log.lingua = this.lang; log.provvisori = this.interimResults;
    self._t = [
      setTimeout(function () { if (self.onresult) self.onresult({ resultIndex: 0, results: risultati([[frase.split(" ").slice(0, 2).join(" "), false]]) }); }, 150),
      setTimeout(function () { log.provvisorio = (document.getElementById("question") || {}).value; }, 400),
      setTimeout(function () { if (self.onresult) self.onresult({ resultIndex: 0, results: risultati([[frase, true]]) }); }, 700),
      setTimeout(function () { if (self.onend) self.onend({}); }, 800)
    ];
  };
  Rec.prototype.stop = function () { var self = this; setTimeout(function () { if (self.onend) self.onend({}); }, 10); };
  Rec.prototype.abort = Rec.prototype.stop;
  window.webkitSpeechRecognition = Rec;
  window.SpeechRecognition = undefined;
})();
"""


def _contesto(browser):
    ctx = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True,
                              user_agent=UA_ANDROID)
    ctx.add_init_script(ATTIVAZIONE)
    ctx.add_init_script(FINTI)
    # il percorso guidato all'avvio (percorsi.js) si prova a parte: qui conta il saluto
    ctx.add_init_script("try { sessionStorage.setItem('pd.profiloScelto', '1'); sessionStorage.setItem('pd.percorsoVisto', '1') } catch (e) {}")
    # niente server: come l'app sul telefono (e i dati del server di prova restano intatti)
    ctx.route("**/api/**", lambda r: r.abort())
    return ctx


def prova(page, ROOT, check, SHOTS):
    # ------------------------------------------------------------- sul PC non cambia nulla
    pc = page.evaluate("""() => ({ mobile: PD.mobile, stato: PD.micWeb.stato(), invito: !!document.getElementById('pd-tocca'),
                                   lettore: PD.lettoreAudio() === null, pronto: PD.sttReady() === PD.sttLocale() })""")
    check("telefono: sul PC niente modalità telefono, niente microfono del telefono, niente invito", pc == {
        "mobile": False, "stato": "no", "invito": False, "lettore": True, "pronto": True}, pc)
    page.goto(ROOT + "#/ask")
    page.wait_for_selector("#view-ask #composer")
    check("telefono: sul PC «Chiedi al Professore» senza «Parla con la voce»", page.locator("#mic-voce").count() == 0 and
          page.locator("#view-ask #mic").count() == 1)
    page.goto(ROOT + "#/settings")
    page.wait_for_selector("#view-settings .card")
    check("telefono: sul PC il riquadro Microfono resta quello di prima", page.locator("#s-mictel").count() == 0 and
          page.locator("#view-settings #s-autosend").count() == 1)
    page.goto(ROOT + "#/home")

    browser = page.context.browser
    ctx = _contesto(browser)
    tel = ctx.new_page()
    errori = []
    tel.on("pageerror", lambda e: errori.append(str(e)))
    try:
        # ------------------------------------------------------------- 1. saluto: invito, tocco, voce
        tel.goto(ROOT + "#/home")
        tel.wait_for_selector("#view-home .hero")
        try:
            tel.wait_for_selector("#pd-tocca", timeout=6000)
        except Exception:
            pass
        st = tel.evaluate("[PD.mobile, !PD.server, !!window.PD_PWA, PD.micWeb.stato()]")
        check("telefono: contesto mobile come l'app (niente server)", st == [True, True, True, "spento"], st)
        check("telefono: invito «Toccate qui per cominciare» all'avvio", tel.is_visible("#pd-tocca") and
              "Toccate qui per cominciare" in tel.inner_text("#pd-tocca"))
        check("telefono: prima del tocco il Professore non ha detto nulla", tel.evaluate("__voce.dette.length") == 0,
              tel.evaluate("__voce"))
        tel.screenshot(path=SHOTS + "/60-telefono-invito.png")
        larga = tel.evaluate("document.documentElement.scrollWidth")
        check("telefono: invito senza scorrimento orizzontale", larga <= 392, larga)
        tel.tap("#pd-tocca-btn")
        tel.wait_for_function("__voce.dette.some(d => /Buongiorno|Buon pomeriggio|Buonasera/.test(d.text))", timeout=8000)
        v = tel.evaluate("__voce")
        saluto = [d for d in v["dette"] if "Professore Digitale" in d["text"] or d["text"].startswith("Buon")]
        check("telefono: dopo il tocco speechSynthesis.speak chiamata (sblocco muto) e invito chiuso",
              v["dette"] and v["dette"][0]["volume"] == 0 and not tel.is_visible("#pd-tocca"), v)
        check("telefono: il saluto parte con una voce italiana (lang «it_IT» accettata)",
              saluto and saluto[0]["lang"] == "it-IT" and saluto[0]["voce"] == "Luca", saluto)
        check("telefono: frasi corte per Chrome Android (≤ 160 caratteri)", all(len(d["text"]) <= 161 for d in v["dette"]), v["dette"])
        check("telefono: sblocco ricordato per la sessione", tel.evaluate("sessionStorage.getItem('pd.voceSbloccata') === '1'"))
        tel.evaluate("PD.bubbleClose()")

        # ------------------------------------------------------------- 2. voce muta (iOS): invito dopo 1,5 s
        p2 = ctx.new_page()
        p2.on("pageerror", lambda e: errori.append(str(e)))
        p2.goto(ROOT + "?nosaluto#/home")
        p2.wait_for_selector("#view-home .hero")
        p2.evaluate("__voce.sbloccata = true; __voce.muta = true; sessionStorage.removeItem('pd.invitoVisto'); PD.speak('Prova della voce.', true)")
        p2.wait_for_selector("#pd-tocca", timeout=6000)
        check("telefono: voce che non parte entro 1,5 s → invito", p2.is_visible("#pd-tocca"))
        p2.evaluate("__voce.muta = false")
        p2.tap("#pd-tocca-btn")
        p2.wait_for_function("__voce.dette.some(d => d.text.indexOf('Prova della voce') >= 0)", timeout=5000)
        check("telefono: dopo il tocco la frase viene ripetuta", True)
        p2.close()

        # ------------------------------------------------------------- 3. microfono: consenso, domanda, risposta
        tel.goto(ROOT + "#/ask")
        tel.wait_for_selector("#view-ask #composer")
        check("telefono: microfono spento di base (pulsante 🎤 nascosto, «Parla con la voce» visibile)",
              not tel.is_visible("#mic") and tel.is_visible("#mic-voce") and "Parla con la voce" in tel.inner_text("#mic-voce") and
              tel.evaluate("PD.settings.micTelefono === false && PD.sttReady() === false"))
        tel.tap("#mic-voce")
        tel.wait_for_selector("#pd-mic-consenso")
        spieg = tel.inner_text("#pd-mic-consenso")
        check("telefono: spiegazione onesta prima di accendere (Google, inviato, non salva)",
              "Google" in spieg and "inviato a loro" in spieg and "non salva nulla" in spieg and "Accendo" in spieg and "No grazie" in spieg, spieg)
        check("telefono: nessun ascolto prima del consenso", tel.evaluate("__voce.ascolti") == 0)
        tel.screenshot(path=SHOTS + "/61-telefono-microfono-consenso.png")
        tel.tap("#pd-mic-no")
        check("telefono: «No grazie» lascia spento", tel.evaluate("PD.settings.micTelefono === false && __voce.ascolti === 0") and
              not tel.is_visible("#mic"))
        n0 = tel.evaluate("PD.history.length")
        tel.tap("#mic-voce")
        tel.wait_for_selector("#pd-mic-si")
        tel.tap("#pd-mic-si")
        tel.wait_for_selector("#pd-ascolto", timeout=3000)
        check("telefono: «Vi ascolto…» visibile mentre si parla", "ascolto" in tel.inner_text("#pd-ascolto").lower() or "«" in tel.inner_text("#pd-ascolto"))
        tel.screenshot(path=SHOTS + "/62-telefono-microfono-ascolto.png")
        tel.wait_for_function("PD.history.length >= %d" % (n0 + 2), timeout=8000)
        v = tel.evaluate("__voce")
        dom = tel.evaluate("PD.history.slice(-2)")
        check("telefono: Web Speech in italiano con risultati provvisori", v["lingua"] == "it-IT" and v["provvisori"] is True and
              v.get("provvisorio") == "come faccio", v)
        check("telefono: domanda dettata inviata e risposta", dom[0]["role"] == "user" and dom[0]["content"] == "Come faccio una videochiamata" and
              dom[1]["role"] == "assistant" and "video" in dom[1]["content"].lower(), dom)
        check("telefono: impostazione micTelefono accesa e salvata", tel.evaluate("PD.settings.micTelefono === true && JSON.parse(localStorage.getItem('pd.settings')).micTelefono === true"))
        check("telefono: ora c'è il pulsante 🎤 e «Spegni il microfono»", tel.is_visible("#mic") and "Spegni" in tel.inner_text("#mic-voce"))
        tel.wait_for_timeout(300)
        tel.screenshot(path=SHOTS + "/63-telefono-microfono-acceso.png")
        # secondo giro con il pulsante 🎤, senza invio automatico: il testo resta nel campo
        tel.evaluate("PD.settings.autoSendVoice = false; __voce.frase = 'cos è il wifi'")
        tel.tap("#mic")
        tel.wait_for_function("document.getElementById('question').value === 'Cos è il wifi'", timeout=5000)
        check("telefono: 🎤 senza invio automatico → testo nel campo", True)
        tel.evaluate("PD.settings.autoSendVoice = true; document.getElementById('question').value = ''")

        # ------------------------------------------------------------- 4. comandi a voce con la voce del telefono
        tel.goto(ROOT + "#/lessons/computer/0")
        tel.wait_for_selector("#view-lessons .lesson-nav")
        tel.evaluate("PD.settings.voiceCommands = true; PD.saveSettings()")
        tel.wait_for_selector("#pd-voce-btn")
        tel.evaluate("__voce.frase = 'avanti'")
        tel.tap("#pd-voce-btn")
        tel.wait_for_function("location.hash === '#/lessons/computer/1'", timeout=5000)
        check("telefono: comando a voce «avanti» con la voce del telefono", True)
        tel.evaluate("PD.settings.voiceCommands = false; PD.saveSettings()")
        # «È una truffa?»: il pulsante «🎤 Detta» compare quando la voce del telefono è accesa
        tel.goto(ROOT + "#/truffa")
        tel.wait_for_selector("#tr-testo")
        tel.evaluate("__voce.frase = 'ho ricevuto un sms dalla banca'")
        ok_det = tel.is_visible("#tr-mic")
        if ok_det:
            tel.tap("#tr-mic")
            tel.wait_for_function("document.getElementById('tr-testo').value.indexOf('Ho ricevuto un sms dalla banca') >= 0", timeout=5000)
        check("telefono: «È una truffa?» detta con la voce del telefono", ok_det)

        # ------------------------------------------------------------- 5. Impostazioni e spegnimento
        tel.goto(ROOT + "#/settings")
        tel.wait_for_selector("#s-mictel", state="attached")
        check("telefono: interruttore «Parla con la voce» nelle Impostazioni (acceso)", tel.is_checked("#s-mictel"))
        tel.goto(ROOT + "#/ask")
        tel.wait_for_selector("#mic-voce")
        tel.tap("#mic-voce")
        check("telefono: «Spegni il microfono» nasconde il 🎤 e spegne", not tel.is_visible("#mic") and
              tel.evaluate("PD.settings.micTelefono === false && PD.sttReady() === false && !PD.recorder.active()") and
              "Parla con la voce" in tel.inner_text("#mic-voce"))
        tel.goto(ROOT + "#/settings")
        tel.wait_for_selector("#s-mictel", state="attached")
        tel.evaluate("document.getElementById('s-mictel').scrollIntoView({block: 'center'})")
        tel.tap("#s-mictel", force=True)
        tel.wait_for_selector("#pd-mic-consenso")
        check("telefono: accendere dalle Impostazioni chiede il consenso", not tel.is_checked("#s-mictel"))
        tel.tap("#pd-mic-si")
        check("telefono: dopo «Accendo» l'interruttore è acceso", tel.is_checked("#s-mictel") and tel.evaluate("PD.settings.micTelefono"))
        tel.evaluate("document.getElementById('pd-mic-carta').scrollIntoView({block: 'center'})")
        tel.screenshot(path=SHOTS + "/64-telefono-impostazioni-microfono.png")
        tel.tap("#s-mictel", force=True)
        check("telefono: spento dalle Impostazioni", tel.evaluate("PD.settings.micTelefono === false"))

        # ------------------------------------------------------------- 6. browser senza riconoscimento (es. Firefox)
        p3 = ctx.new_page()
        p3.add_init_script("window.webkitSpeechRecognition = undefined; window.SpeechRecognition = undefined;")
        p3.on("pageerror", lambda e: errori.append(str(e)))
        p3.goto(ROOT + "?nosaluto#/ask")
        p3.wait_for_selector("#view-ask #composer")
        check("telefono: senza Web Speech niente pulsante, spiegazione gentile",
              p3.evaluate("PD.micWeb.stato()") == "assente" and not p3.is_visible("#mic") and p3.locator("#mic-voce").count() == 0 and
              "non sa riconoscere la voce" in p3.inner_text("#mic-nota"))
        p3.close()
        # ------------------------------------------------------------- 7. tablet collegato in http (contesto non sicuro)
        p4 = ctx.new_page()
        p4.add_init_script("Object.defineProperty(window, 'isSecureContext', { value: false, configurable: true });")
        p4.on("pageerror", lambda e: errori.append(str(e)))
        p4.goto(ROOT + "?nosaluto#/ask")
        p4.wait_for_selector("#view-ask #composer")
        stato4 = p4.evaluate("PD.micWeb.stato()")
        p4.tap("#mic-voce")
        p4.wait_for_selector("#pd-mic-consenso")
        sp = p4.inner_text("#pd-mic-consenso")
        link = p4.get_attribute("#pd-mic-consenso a", "href") or ""
        check("telefono: su http (tablet collegato) il pulsante spiega che serve l'app, con il link",
              stato4 == "insicuro" and "app installata dal sito" in sp and link.endswith("/app/") and p4.evaluate("__voce.ascolti") == 0, [stato4, sp, link])
        p4.close()
        check("telefono: nessun errore JavaScript", not errori, errori[:3])
    finally:
        ctx.close()
