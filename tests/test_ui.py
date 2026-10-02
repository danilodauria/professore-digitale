#!/usr/bin/env python3
"""Test end-to-end del Professore Digitale con Chromium (Playwright).
Uso: python3 tests/test_ui.py <url_base> <cartella_screenshot> [mock_ollama_url]
"""
import json, os, sys, time, urllib.request
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
    ctx = b.new_context(viewport={"width": 1366, "height": 800})
    page = ctx.new_page()
    errors, tts_calls = [], []
    page.on("pageerror", lambda e: errors.append("pageerror: " + str(e)))
    page.on("console", lambda m: errors.append("console: " + m.text) if m.type == "error" else None)
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
    check("elenco lezioni (%d)" % n, n == page.evaluate("PD_LESSONS.length"), n)
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
    page.wait_for_selector(".quiz-q")
    answers = page.evaluate("PD_LESSONS[0].quiz.map(q => q.a)")
    for qi, a in enumerate(answers):
        page.click('.quiz-q[data-q="%d"] .quiz-opt[data-o="%d"]' % (qi, a))
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
    got = page.evaluate("(qs) => Object.fromEntries(qs.map(q => { const r = PD.search(q, 1)[0]; return [q, r ? [r.doc.title, r.score] : null]; }))", list(probe))
    wrong = {q: got[q] for q in probe if not got[q] or got[q][0] != probe[q] or got[q][1] < 3.2}
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
        [json.load(open(f, encoding="utf-8")) for f in __import__("glob").glob(os.path.join(here, "..", "src", "contenuti", "*.json"))])
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

    # --- telefono / schermo stretto ---
    m = b.new_context(viewport={"width": 390, "height": 800}).new_page()
    m.on("pageerror", lambda e: errors.append("mobile pageerror: " + str(e)))
    m.goto(ROOT + "#/lessons/file/0"); m.wait_for_selector("#lesson-board .diagram svg", timeout=20000)
    over = m.evaluate("document.documentElement.scrollWidth > window.innerWidth + 1")
    check("nessuno scorrimento orizzontale su telefono", not over)
    m.screenshot(path=SHOTS + "/13-telefono.png", full_page=False)

    errs = [e for e in errors if "favicon" not in e and "api/stt" not in e and "503" not in e]
    check("nessun errore JavaScript", not errs, errs)
    b.close()

fails = [r for r in results if not r[1]]
print("\nRISULTATO: %d/%d test superati" % (len(results) - len(fails), len(results)))
sys.exit(1 if fails else 0)
