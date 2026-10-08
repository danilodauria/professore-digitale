"""Prove dell'interfaccia: «Accessibilità vera» (accessibilita.js / accessibilita.css).
Chiamata da tests/test_ui.py con prova(page, ROOT, check, SHOTS)."""


def prova(page, ROOT, check, SHOTS):
    orig = page.evaluate("JSON.stringify({t: PD.settings.tremore, v: PD.settings.vista, l: PD.settings.leggiFocus,"
                         " c: PD.settings.voiceCommands, fs: PD.settings.fontSize, th: PD.settings.theme})")
    vp = page.viewport_size
    try:
        _prove(page, ROOT, check, SHOTS)
    finally:
        page.evaluate("""(o) => { o = JSON.parse(o);
            PD.settings.tremore = o.t; PD.settings.vista = o.v; PD.settings.leggiFocus = o.l; PD.settings.voiceCommands = o.c;
            PD.settings.fontSize = o.fs; PD.settings.theme = o.th; PD.saveSettings();
            if (window.__a11ySpeak) { PD.speak = window.__a11ySpeak; window.__a11ySpeak = null; } }""", orig)
        page.wait_for_timeout(700)  # il salvataggio sul server parte dopo 400 ms
        if vp:
            page.set_viewport_size(vp)
        page.goto(ROOT + "#/home")
        page.wait_for_selector("#view-home h1")



def _due_clic(page, sel):
    """Due clic veloci nello stesso punto (il mouse, senza attese tra uno e l'altro: anche su PC lenti restano vicini)."""
    page.locator(sel).scroll_into_view_if_needed()
    bb = page.locator(sel).bounding_box()
    x, y = bb["x"] + bb["width"] / 2, bb["y"] + bb["height"] / 2
    page.mouse.click(x, y); page.mouse.click(x, y)

def _prove(page, ROOT, check, SHOTS):
    page.goto(ROOT + "#/settings")
    page.wait_for_selector("#pd-a11y-card")
    check("a11y: riquadro nelle Impostazioni", page.locator("#pd-a11y-card input[data-a11y]").count() == 4)
    check("a11y: pulsante ♿ nella barra", page.is_visible("#btn-a11y"))
    stt = page.evaluate("PD.sttReady()")
    if not stt:
        check("a11y: comandi a voce disabilitati senza riconoscimento", page.locator("#a11y-voiceCommands").is_disabled())

    # --- mani che tremano ---
    page.evaluate("PD.settings.tremore = false; PD.saveSettings()")
    page.check("#a11y-tremore")
    check("a11y: classe pd-tremore", page.evaluate("document.documentElement.classList.contains('pd-tremore')"))
    check("a11y: impostazione tremore salvata", page.evaluate("PD.settings.tremore === true"))
    page.goto(ROOT + "#/lessons/computer/1")
    page.wait_for_selector("#view-lessons .lesson-nav .btn")
    piccoli = page.evaluate("""() => Array.prototype.slice.call(document.querySelectorAll('#view-lessons .btn, .topbar .icon-btn'))
        .filter(b => b.getClientRects().length).map(b => b.getBoundingClientRect())
        .filter(r => r.height < 55.5 || r.width < 55.5).length""")
    check("a11y: pulsanti almeno 56 px con tremore", piccoli == 0, piccoli)
    # protezione dal doppio clic involontario
    page.evaluate("""() => { var b = document.createElement('button'); b.id = 'a11y-conta'; b.className = 'btn';
        b.textContent = 'Conta'; b.setAttribute('data-n', '0');
        b.onclick = function () { b.setAttribute('data-n', +b.getAttribute('data-n') + 1); };
        document.querySelector('#view-lessons').appendChild(b); }""")
    _due_clic(page, "#a11y-conta")
    n1 = page.evaluate("+document.querySelector('#a11y-conta').getAttribute('data-n')")
    check("a11y: doppio clic involontario ignorato", n1 == 1, n1)
    page.wait_for_timeout(800)
    page.click("#a11y-conta")
    n2 = page.evaluate("+document.querySelector('#a11y-conta').getAttribute('data-n')")
    check("a11y: clic successivo (dopo 0,8 s) accettato", n2 == 2, n2)
    check("a11y: PD.tremore per la Palestra", page.evaluate("PD.tremore.attivo() && PD.tremore.sogliaDoppioClic === 900"))
    page.evaluate("PD.settings.tremore = false; PD.saveSettings()")
    check("a11y: tremore disattivato", not page.evaluate("document.documentElement.classList.contains('pd-tremore')"))
    _due_clic(page, "#a11y-conta")
    n3 = page.evaluate("+document.querySelector('#a11y-conta').getAttribute('data-n')")
    check("a11y: senza tremore i clic contano tutti", n3 == 4, n3)

    # --- vedo poco ---
    page.evaluate("PD.settings.fontSize = 18; PD.settings.vista = true; PD.saveSettings()")
    fs = page.evaluate("parseFloat(getComputedStyle(document.documentElement).fontSize)")
    check("a11y: vedo poco → testo almeno 24 px", page.evaluate("document.documentElement.classList.contains('pd-vista')") and fs >= 24, fs)
    page.evaluate("PD.settings.vista = false; PD.saveSettings()")
    fs2 = page.evaluate("parseFloat(getComputedStyle(document.documentElement).fontSize)")
    check("a11y: vedo poco spento → testo normale", fs2 == 18, fs2)

    # --- comandi ---
    page.goto(ROOT + "#/lessons/computer/1")
    page.wait_for_selector("#view-lessons .lesson-nav")
    ok = page.evaluate("PD.comando('Avanti.')")
    page.wait_for_timeout(200)
    check("a11y: comando «avanti» cambia passo", ok and page.evaluate("location.hash") == "#/lessons/computer/2", page.evaluate("location.hash"))
    ok = page.evaluate("PD.comando('torna indietro')")
    page.wait_for_timeout(200)
    check("a11y: comando «indietro»", ok and page.evaluate("location.hash") == "#/lessons/computer/1", page.evaluate("location.hash"))
    check("a11y: comando tollerante «avandi»", page.evaluate("PD.comando('avandi')"))
    page.wait_for_timeout(200)
    f0 = page.evaluate("PD.settings.fontSize")
    check("a11y: comando «più grande»", page.evaluate("PD.comando('Più grande')") and page.evaluate("PD.settings.fontSize") == f0 + 2)
    check("a11y: comando «più piccolo»", page.evaluate("PD.comando('più piccolo')") and page.evaluate("PD.settings.fontSize") == f0)
    page.evaluate("PD.comando('Inizio')"); page.wait_for_timeout(200)
    check("a11y: comando «inizio»", page.evaluate("location.hash") == "#/home" and page.is_visible("#view-home h1"))
    page.evaluate("PD.comando('palestra')"); page.wait_for_timeout(200)
    check("a11y: comando «palestra»", page.evaluate("location.hash") == "#/practice")
    page.evaluate("PD.settings.autoSendVoice_a11y = PD.settings.autoSendVoice; PD.settings.autoSendVoice = false")
    page.evaluate("PD.comando('Chiedi come si accende il computer')"); page.wait_for_timeout(300)
    q = page.evaluate("(document.querySelector('#question') || {}).value")
    check("a11y: comando «chiedi …» porta la domanda", page.evaluate("location.hash") == "#/ask" and "accende il computer" in (q or ""), q)
    page.evaluate("PD.settings.autoSendVoice = PD.settings.autoSendVoice_a11y; delete PD.settings.autoSendVoice_a11y")
    check("a11y: comando sconosciuto → false", page.evaluate("PD.comando('banana volante') === false"))
    check("a11y: testo della pagina da rileggere", 10 < len(page.evaluate("PD.testoPagina()")) <= 801)

    # --- leggi ciò che indico (spia su PD.speak) ---
    page.goto(ROOT + "#/home")
    page.wait_for_selector("#view-home h1")
    page.evaluate("""() => { window.__a11ySpeak = PD.speak; window.__letti = [];
        PD.speak = function (t) { window.__letti.push(t); return Promise.resolve(); };
        PD.stopSpeech(); PD.settings.leggiFocus = true; PD.saveSettings(); }""")
    page.focus("#btn-font-up")
    page.keyboard.press("Tab")
    page.wait_for_timeout(150)
    letti = page.evaluate("window.__letti")
    check("a11y: focus da tastiera letto ad alta voce", len(letti) >= 1 and len(letti[-1]) > 2, letti)
    page.hover(".nav-btn[data-view='lessons']")
    page.wait_for_timeout(1200)
    letti = page.evaluate("window.__letti")
    check("a11y: mouse fermo su un pulsante → letto", any("Lezioni" in t for t in letti), letti)
    n = len(letti)
    page.mouse.move(5, 5); page.hover(".nav-btn[data-view='lessons']"); page.wait_for_timeout(1100)
    check("a11y: stesso elemento non ripetuto subito", len(page.evaluate("window.__letti")) == n, page.evaluate("window.__letti"))
    page.evaluate("PD.settings.leggiFocus = false; PD.saveSettings(); PD.speak = window.__a11ySpeak; window.__a11ySpeak = null")

    # --- menu rapido ♿ ---
    page.click("#btn-a11y")
    check("a11y: menu rapido aperto", page.is_visible("#pd-a11y-menu"))
    page.keyboard.press("Escape")

    # --- screenshot: vedo poco + alto contrasto ---
    page.evaluate("PD.settings.vista = true; PD.settings.tremore = true; PD.settings.theme = 'contrast'; PD.saveSettings()")
    page.goto(ROOT + "#/lessons/computer/1")
    page.wait_for_selector("#view-lessons .lesson-nav")
    page.evaluate("var t = document.getElementById('toast'); if (t) t.hidden = true; PD.stopSpeech()")
    page.focus("#view-lessons .lesson-nav .btn")
    page.screenshot(path=SHOTS + "/a11y-vista-1280.png")
    page.set_viewport_size({"width": 390, "height": 844})
    page.wait_for_timeout(300)
    largo = page.evaluate("document.documentElement.scrollWidth")
    check("a11y: niente scorrimento orizzontale a 390 px", largo <= 391, largo)
    page.screenshot(path=SHOTS + "/a11y-vista-390.png")
    page.goto(ROOT + "#/settings")
    page.wait_for_selector("#pd-a11y-card")
    page.locator("#pd-a11y-card").scroll_into_view_if_needed()
    page.screenshot(path=SHOTS + "/a11y-impostazioni-390.png")
    largo = page.evaluate("document.documentElement.scrollWidth")
    check("a11y: impostazioni a 390 px senza scorrimento orizzontale", largo <= 391, largo)
