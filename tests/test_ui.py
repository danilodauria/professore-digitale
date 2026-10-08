#!/usr/bin/env python3
"""Test end-to-end del Professore Digitale con Chromium (Playwright).
Uso: python3 tests/test_ui.py <url_base> <cartella_screenshot> [mock_ollama_url]
"""
import json, os, sys, time, urllib.request, urllib.error
from playwright.sync_api import sync_playwright

BASE = sys.argv[1].rstrip("/")
SHOTS = sys.argv[2]
MOCK = sys.argv[3] if len(sys.argv) > 3 else None
ROOT = BASE if BASE.startswith("file:") else BASE + "/"
os.makedirs(SHOTS, exist_ok=True)
results = []

def check(name, cond, detail=""):
    results.append((name, bool(cond), detail))
    print(("  OK  " if cond else "  FAIL") + " " + name + ("  -> " + str(detail) if detail and not cond else ""))

with sync_playwright() as p:
    b = p.chromium.launch(args=["--autoplay-policy=no-user-gesture-required", "--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"])
    ctx = b.new_context(viewport={"width": 1366, "height": 800}, accept_downloads=True)
    # il saluto all'avvio si prova a parte: qui la nuvoletta non deve coprire i pulsanti
    ctx.add_init_script("try { sessionStorage.setItem('pd.salutato', '1') } catch (e) {}")
    page = ctx.new_page()
    errors, tts_calls = [], []
    page.on("pageerror", lambda e: errors.append("pageerror: " + str(e)))
    # «special-words» è un file facoltativo che il motore OCR cerca da solo: il suo avviso non è un errore del Professore
    page.on("console", lambda m: errors.append("console: " + m.text) if m.type == "error" and "special-words" not in m.text else None)
    page.on("request", lambda r: tts_calls.append(r.url) if r.url.endswith("/api/tts") else None)

    page.goto(ROOT + "")
    page.wait_for_selector("#view-home .hero")
    standalone = BASE.startswith("file:")
    check("home visualizzata", page.is_visible("#view-home h1"))
    chips = page.inner_text("#chips")
    check("chip di stato", "Offline" in chips, chips)
    if MOCK:
        check("IA rilevata", "qwen2.5:1.5b" in chips, chips)
    page.screenshot(path=SHOTS + "/01-home.png")

    # --- occhi del Professore che seguono il mouse ---
    def eye_x():
        v = page.evaluate("getComputedStyle(document.querySelector('#view-home svg.prof')).getPropertyValue('--pd-lx')")
        return float((v or "0").replace("px", "") or 0)
    pb = page.locator("#view-home svg.prof").bounding_box()
    page.mouse.move(pb["x"] + pb["width"] + 500, pb["y"] + pb["height"] / 2, steps=4); page.wait_for_timeout(700)
    right = eye_x()
    page.mouse.move(3, pb["y"] + pb["height"] / 2, steps=4); page.wait_for_timeout(700)
    left = eye_x()
    check("occhi seguono il mouse", right > 2 and left < -2, (right, left))
    page.evaluate("PD.settings.eyesFollow = false"); page.mouse.move(pb["x"] + pb["width"] + 400, pb["y"]); page.wait_for_timeout(1200)
    check("occhi fermi se disattivati", abs(eye_x()) < 0.3, eye_x())
    page.evaluate("PD.settings.eyesFollow = true")

    # --- lezioni ---
    page.click("text=Lezioni >> nth=0")
    page.wait_for_selector("#view-lessons .tile")
    n = page.locator("#view-lessons .tile").count()
    check("elenco lezioni (%d)" % n, n == page.evaluate("PD.lessonsOf('corso').length"), n)
    page.screenshot(path=SHOTS + "/02-lezioni.png")
    page.goto(ROOT + "#/lessons/computer/1")
    page.wait_for_selector("#lesson-board .diagram svg", timeout=20000)
    check("schema lezione disegnato", page.locator("#lesson-board .diagram svg").count() == 1)
    page.screenshot(path=SHOTS + "/03-lezione.png")
    page.click("#read-step")
    page.wait_for_timeout(1500)
    if not standalone and page.evaluate("PD.status.tts.engines.length > 0"):
        check("voce richiesta al server", len(tts_calls) > 0, tts_calls)
        page.click("#btn-stop") if page.is_visible("#btn-stop") else None

    # tutti gli schemi (lezioni + guida) devono essere validi
    bad = page.evaluate("""async () => {
      const codes = [];
      PD_LESSONS.forEach(L => L.steps.forEach(s => s.d && codes.push([L.id + ':' + s.t, s.d])));
      PD_KB.forEach(e => e.d && codes.push(['kb:' + e.q, e.d]));
      const bad = [];
      for (const [k, c] of codes) {
        const div = document.createElement('div'); document.body.appendChild(div);
        const ok = await PD.renderDiagram(div, c, '');
        if (!ok || !div.querySelector('svg')) bad.push(k);
        div.remove();
      }
      return {n: codes.length, bad};
    }""")
    check("tutti gli schemi validi (%d)" % bad["n"], not bad["bad"], bad["bad"])

    # quiz completo
    page.goto(ROOT + "#/lessons/computer/quiz")
    page.wait_for_selector("#view-lessons .quiz-q")
    answers = page.evaluate("PD_LESSONS[0].quiz.map(q => q.a)")
    for qi, a in enumerate(answers):
        page.click('#view-lessons .quiz-q[data-q="%d"] .quiz-opt[data-o="%d"]' % (qi, a))
    page.wait_for_selector("#quiz-end .notice.ok")
    check("quiz completato", "3 su 3" in page.inner_text("#quiz-end"))
    page.screenshot(path=SHOTS + "/04-quiz.png")
    if not standalone:
        page.wait_for_timeout(900)
        saved = json.loads(urllib.request.urlopen(ROOT + "api/data/progress").read())["value"]
        check("progressi salvati su disco", saved and saved["lessons"]["computer"]["done"] is True, saved)

    # --- ricerca nella guida ---
    probe = {
        "come faccio la chiocciola": "Come si scrive la chiocciola @?",
        "mi è arrivato un sms per un pacco da pagare": "Mi è arrivato un SMS del pacco da pagare",
        "come si spegne": "Come si spegne il computer?",
        "cos'è lo spid": "Cos'è lo SPID?",
        "ho cancellato una foto per sbaglio": "Ho cancellato un file per sbaglio",
        "videochiamata con mio nipote": "Come si fa una videochiamata?",
        "password sicura": "Come creo una password sicura?",
        "copiare e incollare un testo": "Come si copia e incolla?",
        "il computer si è bloccato": "Il computer è bloccato, cosa faccio?",
        "cos'è il wifi": "Cos'è il Wi-Fi?",
        "come si allega una foto": "Come si allega una foto a un'email?",
        "dove sono i file scaricati": "Dove trovo i file scaricati?",
    }
    if page.evaluate("PD_KB.some(e => e.pack === 'vita-quotidiana')"):
        probe.update({"come stampo una lettera": "Come stampo un documento?", "posso usare il wifi del bar": "Posso usare il Wi-Fi pubblico?",
                      "come passo le foto dal telefono al computer": "Come trasferisco le foto dal telefono al computer?",
                      "comprare su internet in sicurezza": "Come compro online in sicurezza?", "cos'è il bluetooth": "Cos'è il Bluetooth?"})
    if page.evaluate("PD_KB.some(e => e.pack === 'cultura-storia')"):
        probe.update({"chi era garibaldi": "Chi era Giuseppe Garibaldi?", "quando è caduto l'impero romano": "Quando è caduto l'Impero romano d'Occidente?",
                      "perché ci sono le stagioni": "Perché ci sono le stagioni?", "quante ossa abbiamo": "Quante ossa ha il corpo umano?",
                      "dove si trova la gioconda": "Dove si trova la Gioconda?", "cosa dice l'articolo 1": "Cosa dice l'articolo 1 della Costituzione?",
                      "che cos'è feniceos": "Cos'è FeniceOS?", "perché si chiama fenice": "Perché si chiama FeniceOS?",
                      "che cos'è la tecnologia gentile": "Che cos'è la Tecnologia Gentile?"})
    if page.evaluate("PD_KB.some(e => e.pack === 'windows-primi-passi')"):
        probe.update({"il programma non risponde": "Cosa faccio se un programma di Windows non risponde?",
                      "dov'è il menu start": "Cos'è il menu Start di Windows?",
                      "mi è comparso un messaggio che dice di chiamare l'assistenza microsoft": "Cosa fare se sullo schermo compare un messaggio che dice di chiamare l'assistenza Microsoft?",
                      "la tastiera scrive simboli strani": "Come si cambia la lingua della tastiera se escono simboli strani?",
                      "come faccio una foto dello schermo su windows": "Come faccio uno screenshot su Windows?",
                      "come tolgo la chiavetta": "Come si toglie in sicurezza una chiavetta USB su Windows?",
                      "serve l'antivirus": "Cos'è Windows Defender, l'antivirus di Windows?",
                      "dove sono i file scaricati": ("Dove trovo i file scaricati?", "Dove finiscono i file scaricati su Windows?")})
    got = page.evaluate("(qs) => Object.fromEntries(qs.map(q => { const r = PD.search(q, 1)[0]; return [q, r ? [r.doc.title, r.score] : null]; }))", list(probe))
    ok_title = lambda q: probe[q] if isinstance(probe[q], tuple) else (probe[q],)
    wrong = {q: got[q] for q in probe if not got[q] or got[q][0] not in ok_title(q) or got[q][1] < 3.2}
    check("ricerca guida interna (%d domande)" % len(probe), not wrong, wrong)
    nonsense = page.evaluate("(PD.search('ricetta della carbonara con guanciale', 1)[0] || {score: 0}).score")
    check("domanda fuori tema sotto soglia", nonsense < 3.2, nonsense)

    # --- chiedi: IA (mock) ---
    page.goto(ROOT + "#/ask")
    page.wait_for_selector("#question")
    page.click("#clear-chat")
    check("nuova conversazione", page.evaluate("PD.history.length") == 0)
    if MOCK:
        page.fill("#question", "Cos'è il wifi?")
        page.click("#send")
        page.wait_for_selector(".msg.bot >> text=strada invisibile", timeout=20000)
        page.wait_for_selector("#ask-board .diagram svg", timeout=20000)
        last = page.evaluate("PD.history[PD.history.length-1]")
        check("risposta IA in streaming", last["source"] == "ai" and "[DIAGRAMMA]" not in last["content"], last)
        check("schema IA sulla lavagna", page.locator("#ask-board .diagram svg").count() == 1)
        sent = json.loads(urllib.request.urlopen(MOCK + "/last").read())
        sysmsg = sent["messages"][0]["content"]
        check("prompt di sistema + contesto guida", "Professore Digitale" in sysmsg and "Wi-Fi" in sysmsg and sent["model"] == "qwen2.5:1.5b", sysmsg[-300:])
        page.screenshot(path=SHOTS + "/05-chiedi-ia.png")
        page.evaluate("PD.settings.aiEnabled = false")
    # --- chiedi: guida interna ---
    page.fill("#question", "come si scrive la chiocciola")
    page.press("#question", "Enter")
    page.wait_for_selector(".msg.bot >> text=Alt Gr", timeout=10000)
    check("risposta dalla guida interna", page.evaluate("PD.history[PD.history.length-1].source") == "kb")
    page.fill("#question", "ricetta della carbonara")
    page.press("#question", "Enter")
    page.wait_for_selector(".msg.bot >> text=Non ho trovato", timeout=10000)
    check("risposta 'non trovato' gentile", True)
    page.screenshot(path=SHOTS + "/06-chiedi-guida.png")
    page.evaluate("PD.stopSpeech()")

    # --- microfono: WAV generato dal browser accettato dal server ---
    if not standalone:
        st = page.evaluate("""async () => {
          const pcm = new Float32Array(16000); for (let i=0;i<pcm.length;i++) pcm[i] = Math.sin(i/10)*0.3;
          const r = await fetch('/api/stt', {method:'POST', headers:{'Content-Type':'audio/wav'}, body: PD.recorder.encodeWav(pcm, 16000)});
          return [r.status, await r.json()];
        }""")
        check("endpoint microfono (WAV valido, motore assente -> 503 chiaro)", st[0] in (200, 503) and ("error" in st[1] or "text" in st[1]), st)

    # --- lavagna ---
    page.goto(ROOT + "#/board")
    page.wait_for_selector("#big-board .diagram svg", timeout=20000)
    page.click("#diag-next")
    page.wait_for_timeout(600)
    check("lavagna schemi", page.locator("#big-board .diagram svg").count() == 1)
    page.screenshot(path=SHOTS + "/07-lavagna.png")
    page.goto(ROOT + "#/board/disegno")
    page.wait_for_selector("#board-canvas")
    box = page.locator("#board-canvas").bounding_box()
    page.mouse.move(box["x"] + 100, box["y"] + 100); page.mouse.down()
    for i in range(20):
        page.mouse.move(box["x"] + 100 + i * 15, box["y"] + 100 + (i % 5) * 20)
    page.mouse.up()
    page.click('[data-color="#fde047"]')
    page.mouse.move(box["x"] + 200, box["y"] + 250); page.mouse.down(); page.mouse.move(box["x"] + 500, box["y"] + 260); page.mouse.up()
    lit = page.evaluate("""() => { const c = document.getElementById('board-canvas'); const d = c.getContext('2d').getImageData(0,0,c.width,c.height).data;
      let n = 0; for (let i=0;i<d.length;i+=4) if (d[i] > 200 && d[i+1] > 200) n++; return n; }""")
    check("disegno sulla lavagna", lit > 500, lit)
    page.screenshot(path=SHOTS + "/08-disegno.png")

    # --- palestra ---
    page.goto(ROOT + "#/practice/click")
    for i in range(10):
        page.click(".target")
    page.wait_for_selector("text=palloncini in")
    check("esercizio clic", True)
    page.goto(ROOT + "#/practice/dblclick")
    page.wait_for_selector(".folder-ico")
    for i in range(5):
        page.locator(".folder-ico").nth(i).dblclick()
    page.wait_for_selector("text=tutte le cartelle", timeout=5000)
    check("esercizio doppio clic", True)
    page.goto(ROOT + "#/practice/drag")
    page.wait_for_selector(".draggable")
    for i in range(5):
        d = page.locator(".draggable").first.bounding_box(); z = page.locator("#dz").bounding_box()
        page.mouse.move(d["x"] + d["width"] / 2, d["y"] + d["height"] / 2); page.mouse.down()
        page.mouse.move(z["x"] + z["width"] / 2, z["y"] + z["height"] / 2, steps=8); page.mouse.up()
    page.wait_for_selector("text=Tutto in ordine", timeout=5000)
    check("esercizio trascinamento", True)
    page.goto(ROOT + "#/practice/typing")
    page.wait_for_selector("#ti")
    words = page.evaluate("['casa','sole','mare','gatto','nonna','computer','Roma','Buongiorno','Ciao Maria','posta elettronica','mario@esempio.it','Password-Sicura-7']")
    for w in words:
        page.wait_for_function("!document.getElementById('ti') || !document.getElementById('ti').disabled")
        page.fill("#ti", w)
        page.wait_for_timeout(800)
    page.wait_for_selector("text=tutte le parole", timeout=5000)
    check("esercizio tastiera", True)
    page.screenshot(path=SHOTS + "/09-palestra.png")

    # --- impostazioni e persistenza ---
    page.goto(ROOT + "#/settings")
    page.wait_for_selector("#s-theme")
    page.select_option("#s-theme", "dark")
    page.click("#btn-font-up")
    page.wait_for_timeout(900)
    page.screenshot(path=SHOTS + "/10-impostazioni-scuro.png", full_page=True)
    page.reload()
    page.wait_for_selector("#s-theme")
    check("impostazioni persistenti", page.evaluate("document.documentElement.dataset.theme") == "dark" and page.evaluate("PD.settings.fontSize") == 22)
    # --- sostieni il progetto (3.1) ---
    check("riquadro Sostieni nelle impostazioni", page.locator("#sostieni-card").count() == 1)
    page.click("#sostieni-card [data-go='#/sostieni']")
    page.wait_for_selector("#view-sostieni .sostieni-qr svg")
    txt = page.inner_text("#view-sostieni")
    check("pagina Sostieni con IBAN, PayPal e 2 QR", "IT82 F360 8105 1382 6570 4265 952" in txt and "paypal.me/DDauria" in txt
          and page.locator("#view-sostieni .sostieni-qr svg").count() == 2, txt[:200])
    page.click("#view-sostieni [data-cosa='IBAN']")
    page.wait_for_timeout(300)
    check("copia IBAN con messaggio", "copiato" in page.inner_text("#view-sostieni") or "selezionatelo" in page.inner_text("#view-sostieni"))
    page.screenshot(path=SHOTS + "/10b-sostieni.png", full_page=True)
    page.goto(ROOT + "#/lessons/truffe/1")
    page.wait_for_selector("#lesson-board .diagram svg", timeout=20000)
    page.screenshot(path=SHOTS + "/11-lezione-scuro.png")
    page.select_option("#s-theme", "contrast") if page.is_visible("#s-theme") else page.evaluate("PD.settings.theme='contrast'; PD.saveSettings()")
    page.goto(ROOT + "#/home"); page.wait_for_timeout(400)
    page.screenshot(path=SHOTS + "/12-contrasto.png")
    page.evaluate("PD.settings.theme='light'; PD.settings.fontSize=20; PD.settings.aiEnabled=true; PD.saveSettings()")

    # --- pacchetti di contenuti ---
    here = os.path.dirname(os.path.abspath(__file__))
    page.goto(ROOT + "#/settings"); page.wait_for_selector("#packs-list")
    page.wait_for_timeout(300)
    expected = page.evaluate("""(files) => files.filter(f => !f.richiede_app || PD.cmpVersion(f.richiede_app, PD.version) <= 0).length""",
        [json.load(open(f, encoding="utf-8")) for f in __import__("glob").glob(os.path.join(here, "..", "src", "contenuti", "*.json")) +
         (__import__("glob").glob(os.path.join(here, "..", "windows", "contenuti", "*.json")) if os.environ.get("PD_TEST_WINDOWS") else [])])
    check("pacchetti inclusi caricati (%d, gli altri rifiutati per versione)" % expected, page.evaluate("PD.packs.list.length") == expected and
          page.evaluate("PD.packs.errors.every(e => e.errori.every(x => x.indexOf('richiede_app') === 0))"),
          page.evaluate("[PD.packs.list.length, PD.packs.errors]"))
    page.set_input_files("#pack-import", os.path.join(here, "dati", "pacchetto-prova.json"))
    page.wait_for_selector("#pack-res .notice.ok", timeout=10000)
    check("importazione pacchetto", "Pacchetto di prova" in page.inner_text("#packs-list"))
    page.goto(ROOT + "#/lessons"); page.wait_for_selector("#view-lessons .tile")
    check("nuova lezione nell'elenco", "Lezione di prova" in page.inner_text("#view-lessons"))
    page.goto(ROOT + "#/lessons/prova-lezione/0"); page.wait_for_selector("#lesson-board .diagram svg", timeout=20000)
    check("nuova lezione con schema", True)
    page.goto(ROOT + "#/ask"); page.wait_for_selector("#question")
    page.evaluate("PD.settings.aiEnabled=false")
    page.fill("#question", "come si innaffia il cactus digitale"); page.press("#question", "Enter")
    page.wait_for_selector(".msg.bot >> text=non si innaffia", timeout=10000)
    check("nuova domanda nella guida interna", True)
    page.evaluate("PD.stopSpeech(); PD.settings.aiEnabled=true")
    bad = os.path.join(here, "dati", "_non_valido.json")
    open(bad, "w").write('{"formato":"professore-digitale-contenuti","formato_versione":1,"id":"x y"}')
    page.goto(ROOT + "#/settings"); page.wait_for_selector("#pack-import", state="attached")
    page.set_input_files("#pack-import", bad); page.wait_for_selector("#pack-res >> text=non importato", timeout=10000)
    os.unlink(bad)
    check("pacchetto non valido rifiutato con spiegazione", "id" in page.inner_text("#pack-res"))
    if not standalone and os.environ.get("PD_TEST_SITO"):
        sito = os.environ["PD_TEST_SITO"]
        page.fill("#s-upd", sito + "/aggiornamenti.json"); page.click("#check-upd")
        page.wait_for_selector("#upd-res >> text=9.9.9", timeout=15000)
        txt = page.inner_text("#upd-res")
        check("controllo aggiornamenti con note", "Nota di prova 1" in txt and "Contenuti remoti di prova" in txt, txt[:300])
        page.click("#upd-deb"); page.wait_for_selector("#upd-deb-res .notice.ok", timeout=15000)
        if os.environ.get("PD_TEST_WINDOWS"):
            dl = os.path.join(os.environ["PD_TEST_DOWNLOADS"], "ProfessoreDigitale-Setup-9.9.9.exe")
        else:
            dl = os.path.join(os.environ["PD_TEST_HOME"], "Scaricati", "professore-digitale_9.9.9_all.deb")
        check("pacchetto scaricato e verificato (SHA-256)", os.path.isfile(dl), page.inner_text("#upd-deb-res"))
        page.click("[data-pack-dl]"); page.wait_for_selector("#upd-res >> text=✔ installato", timeout=15000)
        check("contenuti scaricati dal sito", "prova-remota" in page.evaluate("PD.packs.list.map(x => x.pacchetto.id).join(',')"))
        page.screenshot(path=SHOTS + "/14-aggiornamenti.png", full_page=True)
    ids = page.evaluate("PD.packs.list.filter(x => x.origine === 'utente').map(x => x.pacchetto.id)")
    for pid in ids:
        page.click('[data-pack-remove="%s"]' % pid); page.wait_for_timeout(500)
    check("rimozione pacchetti importati", page.evaluate("PD.packs.list.filter(x => x.origine === 'utente').length") == 0)
    page.evaluate("PD.settings.theme='light'; PD.settings.fontSize=20; PD.settings.aiEnabled=true; PD.saveSettings()")

    # --- configurazione guidata (solo versione Windows) ---
    if not standalone and page.evaluate("!!(PD.status && PD.status.setup)"):
        page.goto(ROOT + "#/setup"); page.wait_for_selector("#setup-body dl.kv", timeout=20000)
        check("configurazione guidata: computer e piano", page.is_visible('.nav-btn[data-view="setup"]') and "Memoria" in page.inner_text("#setup-body"))
        check("configurazione guidata: modelli o spiegazione", page.locator("#models .model").count() >= 2 or "guida interna" in page.inner_text("#setup-body"))
        page.screenshot(path=SHOTS + "/15-configura.png", full_page=True)
        page.evaluate("PD.settings.theme='dark'; PD.saveSettings()"); page.wait_for_timeout(300)
        page.screenshot(path=SHOTS + "/16-configura-scuro.png", full_page=True)
        page.evaluate("PD.settings.theme='light'; PD.saveSettings()")
    elif not standalone:
        check("menu di configurazione nascosto dove non serve", not page.is_visible('.nav-btn[data-view="setup"]'))

    # --- 3.0: percorsi, grandi quiz, attestato, palestra nuova, stampa, presenza ---
    for v, sel in (("quiz", "#view-quiz .tile"), ("cultura", "#view-cultura .materia"), ("cultura/cultura-storia", "#view-cultura .qa"),
                   ("fenice", "#view-fenice .sezione-fenice"), ("libro", "#view-libro .qa"), ("aula", "#view-aula h1")):
        page.goto(ROOT + "#/" + v); page.wait_for_selector(sel, timeout=15000)
        check("pagina " + v, page.is_visible(sel))
    page.screenshot(path=SHOTS + "/20-aula.png", full_page=True)
    page.goto(ROOT + "#/fenice"); page.wait_for_selector("#view-fenice .chalkboard .diagram svg", timeout=20000)
    page.screenshot(path=SHOTS + "/21-fenice.png", full_page=False)
    page.goto(ROOT + "#/cultura/cultura-storia"); page.wait_for_selector(".qa-cerca")
    page.fill(".qa-cerca", "garibaldi"); page.wait_for_timeout(200)
    vis = page.evaluate("[...document.querySelectorAll('#view-cultura .qa')].filter(d => !d.hidden).length")
    check("ricerca tra le domande di storia", 1 <= vis <= 4, vis)
    page.screenshot(path=SHOTS + "/22-storia.png", full_page=False)
    nprove = page.evaluate("PD.prove().length")
    check("grandi quiz caricati (informatica, corso, 5 culture, riuso, libro)", nprove >= 9, nprove)
    check("Grande Quiz dell'Informatica: 264 domande", page.evaluate("PD.prove().filter(p => p.id === 'informatica')[0].domande.length") == 264)
    page.goto(ROOT + "#/quiz/informatica"); page.wait_for_selector("#q-via")
    page.fill("#q-nome", "Maria Rossi"); page.click("#q-via")
    for i in range(30):
        page.wait_for_selector("#view-quiz .quiz-opt:not([disabled])"); page.locator("#view-quiz .quiz-opt").first.click(); page.click("#q-avanti")
    page.wait_for_selector("#q-ancora")
    r = page.evaluate("PD.progress.quiz.informatica")
    check("quiz completato e registrato", r and r["tentativi"] == 1 and r["totale"] == 30, r)
    page.screenshot(path=SHOTS + "/23-quiz-fine.png", full_page=False)
    page.evaluate("""() => { (PD.progress.attestati = PD.progress.attestati || []).push({ codice: 'PD-TEST-INF-1', prova: 'informatica', titolo: "Il Grande Quiz dell'Informatica",
        attestato: 'Alfabetizzazione digitale e informatica di base', nome: 'Maria Rossi', punteggio: 27, totale: 30, perc: 90, giudizio: 'Ottimo',
        data: new Date().toISOString(), facilitatore: 'Danilo D\\'Auria' }); PD.saveProgress(); PD.go('#/attestato/PD-TEST-INF-1'); }""")
    page.wait_for_selector("#att-box svg")
    check("attestato con il nome", "Maria Rossi" in page.inner_html("#att-box"))
    page.screenshot(path=SHOTS + "/24-attestato.png", full_page=False)
    with page.expect_download(timeout=30000) as dl:
        page.click("#att-pdf")
    pdf = dl.value.path(); data = open(pdf, "rb").read()
    check("attestato in PDF (A4 orizzontale)", data[:5] == b"%PDF-" and b"/MediaBox [0 0 842 595]" in data and len(data) > 100000, len(data))
    page.evaluate("window.print = function () { window.__stampato = (window.__stampato || 0) + 1; }")
    page.goto(ROOT + "#/lessons/computer/1"); page.wait_for_selector("#lesson-board .diagram svg", timeout=20000)
    page.evaluate("PD.printTopic()"); page.wait_for_function("window.__stampato >= 1", timeout=20000)
    passi = page.evaluate("document.querySelectorAll('#print-area .p-passo').length")
    check("stampa della lezione intera", passi == page.evaluate("PD_LESSONS.filter(l => l.id === 'computer')[0].steps.length"), passi)
    page.evaluate("document.body.classList.remove('printing')")
    # palestra nuova
    page.goto(ROOT + "#/practice"); n_ex = page.evaluate("document.querySelectorAll('#view-practice .tile').length")
    check("palestra: 11 esercizi", n_ex == 11, n_ex)
    page.goto(ROOT + "#/practice/keys"); page.wait_for_selector("#tk")
    page.keyboard.press("Enter"); page.wait_for_timeout(700)
    check("tasti speciali: Invio riconosciuto", "2 di" in page.inner_text("#sc"), page.inner_text("#sc"))
    page.goto(ROOT + "#/practice/copypaste"); page.wait_for_selector("#dst")
    frase = page.input_value("#src"); page.evaluate("(v) => { const d = document.querySelector('#dst'); d.value = v; d.dispatchEvent(new Event('input')); }", frase)
    page.wait_for_timeout(800)
    check("copia e incolla: frase riconosciuta", "2 di" in page.inner_text("#sc"), page.inner_text("#sc"))
    page.goto(ROOT + "#/practice/memory"); page.wait_for_selector(".carta")
    check("memory: 12 carte", page.evaluate("document.querySelectorAll('.carta').length") == 12)
    page.goto(ROOT + "#/practice/scam"); page.wait_for_selector("#scelte button"); page.click("#scelte button >> nth=0"); page.wait_for_selector("#avanti")
    check("riconosci la truffa: spiegazione", page.is_visible("#exp .notice"))
    page.goto(ROOT + "#/practice/rightclick"); page.wait_for_selector(".file-ico")
    page.click('.file-ico[data-f="0"]', button="right"); page.wait_for_selector(".ctx-menu"); page.click('.ctx-menu [data-c="Copia"]'); page.wait_for_timeout(300)
    check("clic destro: menu e comando", "2 di" in page.inner_text("#sc"), page.inner_text("#sc"))
    page.screenshot(path=SHOTS + "/25-clic-destro.png", full_page=False)
    # saluti, congedo, inattivita'
    t = page.evaluate("[9, 15, 20, 23].map(h => PD.testoSaluto(new Date(2026, 0, 5, h)))")
    check("saluto secondo l'ora", t[0].startswith("Buongiorno") and t[1].startswith("Buon pomeriggio") and t[2].startswith("Buonasera") and "tardi" in t[3], t)
    page.evaluate("PD.progress.promemoria = [{ t: 'Chiamare il medico' }]")
    c = page.evaluate("PD.testoCongedo(new Date(2026, 0, 5, 23)).join(' ')")
    check("congedo: promemoria e buona notte", "Chiamare il medico" in c and "Buona notte" in c, c)
    page.goto(ROOT + "#/home"); page.wait_for_selector("#home-promemoria li")
    page.click("#btn-exit"); page.wait_for_selector(".uscita")
    check("finestra di uscita con i promemoria", "Chiamare il medico" in page.inner_text(".uscita"))
    page.screenshot(path=SHOTS + "/26-uscita.png", full_page=False)
    page.click("#u-resta")
    page.evaluate("PD.progress.promemoria = []; PD.saveProgress(); PD.settings.voice = false; PD.idleConfig = { primo: 1, secondo: 2, attesa: 3 }; PD.idleReset()")
    page.wait_for_function("PD.idleState().fase >= 1", timeout=20000)
    check("consiglio quando il Professore è inattivo", page.is_visible("#pd-bubble"))
    page.wait_for_function("PD.profState === 'attesa'", timeout=30000)
    check("poi si mette in attesa", page.evaluate("PD.profState") == "attesa")
    page.screenshot(path=SHOTS + "/27-attesa.png", full_page=False)
    page.mouse.move(200, 300); page.mouse.move(260, 320); page.wait_for_timeout(400)
    check("si risveglia muovendo il mouse", page.evaluate("PD.profState") != "attesa")
    page.evaluate("PD.idleConfig = { primo: 99999, secondo: 99999, attesa: 99999 }; PD.settings.voice = true; PD.bubbleClose()")
    page.wait_for_function("!document.querySelector('#net').classList.contains('attesa')", timeout=20000)
    check("indicatore Online presente", page.is_visible("#net"), page.get_attribute("#net", "class"))
    if not standalone:
        voci = page.evaluate("PD.status.tts.voices || []")
        generi = set(v["genere"] for v in voci)
        if not os.environ.get("PD_TEST_WINDOWS"):   # in Wine non ci sono voci italiane di Windows
            check("voci maschili e femminili disponibili", {"m", "f"} <= generi, voci)
    if not standalone and [v for v in page.evaluate("PD.status.tts.voices || []") if v["genere"] == "f"]:
        st = page.evaluate("""async () => { const r = await fetch('/api/tts', {method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({text: 'Prova', voice: %s})}); return [r.status, r.headers.get('X-TTS-Engine')]; }""" % json.dumps([v for v in voci if v["genere"] == "f"][0]["id"]))
        check("sintesi con la voce scelta", st[0] == 200, st)
    if not standalone:
        page.goto(ROOT + "#/settings"); page.wait_for_selector("#test-voice")
        check("scelta della voce in Impostazioni", not voci or page.evaluate("document.querySelectorAll('#s-voiceid option').length") == len(voci) + 1)
        # aula: questo PC diventa il facilitatore e riceve un allievo simulato
        aula = page.evaluate("""async () => { PD.settings.aulaRuolo = 'facilitatore'; PD.settings.aulaCodice = '4321';
            await PD.api('/api/data/settings', {value: PD.settings}); return await PD.api('/api/aula/applica', {}); }""")
        check("aula: PC del facilitatore in ascolto", aula.get("ruolo") == "facilitatore" and aula.get("in_ascolto"), aula)
        porta = aula.get("porta")
        ip = (aula.get("ips") or ["127.0.0.1"])[0]
        def ciao(codice):
            req = urllib.request.Request("http://%s:%d/aula/ciao" % (ip, porta), headers={"Content-Type": "application/json"},
                data=json.dumps({"id": "test-pc-1", "codice": codice, "pc": "PC-AULA-3", "utente": "Giuseppe Verdi", "versione": "3.0.0",
                                 "sistema": {"os": "Linux Mint 22", "ram_mb": 4096}, "attivita": {"vista": "lessons", "titolo": "Lezione: Il mouse"},
                                 "progressi": {"lezioni_fatte": 4, "lezioni_totali": 15, "quiz": [{"titolo": "Il Grande Quiz di Storia", "migliore": 85, "superata": True}]}}).encode())
            try:
                with urllib.request.build_opener(urllib.request.ProxyHandler({})).open(req, timeout=8) as r: return r.status
            except urllib.error.HTTPError as e: return e.code
        check("aula: codice sbagliato rifiutato", ciao("0000") == 403)
        check("aula: allievo ricevuto", ciao("4321") == 200)
        page.goto(ROOT + "#/aula"); page.wait_for_selector(".tab-aula td", timeout=15000)
        check("quadro dell'aula con l'allievo", "Giuseppe Verdi" in page.inner_text(".tab-aula"))
        page.screenshot(path=SHOTS + "/28-aula-facilitatore.png", full_page=True)
        page.evaluate("""async () => { PD.settings.aulaRuolo = ''; await PD.api('/api/data/settings', {value: PD.settings}); await PD.api('/api/aula/rimuovi', {id: '*'}); return PD.api('/api/aula/applica', {}); }""")
    # saluto vocale all'avvio (nuova finestra senza il segno "gia' salutato")
    g = b.new_context(viewport={"width": 1366, "height": 800}).new_page()
    g.goto(ROOT + "#/home"); g.wait_for_selector("#pd-bubble", timeout=15000)
    check("saluto all'avvio", any(w in g.inner_text("#pd-bubble") for w in ("Buongiorno", "Buon pomeriggio", "Buonasera")))
    g.close()

    # --- moduli della 3.2: ognuno ha il suo file tests/ui_<modulo>.py con prova(page, ROOT, check, SHOTS) ---
    import importlib.util
    for _nome in ("ui_vita", "ui_vita2", "ui_truffa", "ui_profili", "ui_ripasso", "ui_accessibilita", "ui_enti", "ui_registro", "ui_lettera", "ui_aula_mano", "ui_editor", "ui_mente", "ui_mente_giochi", "ui_tablet"):
        _s = importlib.util.spec_from_file_location(_nome, os.path.join(os.path.dirname(os.path.abspath(__file__)), _nome + ".py"))
        _m = importlib.util.module_from_spec(_s); _s.loader.exec_module(_m)
        print("  ·· " + _nome)
        page.goto(ROOT + "#/home"); page.wait_for_selector("#view-home h1")
        try:
            _m.prova(page, ROOT, check, SHOTS)
        except Exception as _e:
            check("modulo %s completato senza eccezioni" % _nome, False, repr(_e)[:400])

    # --- telefono / schermo stretto ---
    m = b.new_context(viewport={"width": 390, "height": 800}).new_page()
    m.on("pageerror", lambda e: errors.append("mobile pageerror: " + str(e)))
    m.goto(ROOT + "#/lessons/file/0"); m.wait_for_selector("#lesson-board .diagram svg", timeout=20000)
    over = m.evaluate("document.documentElement.scrollWidth > window.innerWidth + 1")
    check("nessuno scorrimento orizzontale su telefono", not over)
    m.screenshot(path=SHOTS + "/13-telefono.png", full_page=False)
    if not standalone and page.evaluate("!!(PD.status && PD.status.setup)"):
        m.goto(ROOT + "#/setup"); m.wait_for_selector("#setup-body dl.kv", timeout=20000); m.wait_for_timeout(1500)
        check("configurazione leggibile su schermo stretto", not m.evaluate("document.documentElement.scrollWidth > window.innerWidth + 1"))
        m.screenshot(path=SHOTS + "/17-configura-telefono.png", full_page=True)

    errs = [e for e in errors if "favicon" not in e and "api/stt" not in e and "503" not in e]
    check("nessun errore JavaScript", not errs, errs)
    b.close()

fails = [r for r in results if not r[1]]
print("\nRISULTATO: %d/%d test superati" % (len(results) - len(fails), len(results)))
sys.exit(1 if fails else 0)
