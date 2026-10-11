#!/usr/bin/env python3
"""Test dell'app per telefono e tablet (PWA, tools/make_pwa.py), indipendente dagli altri test.
Crea l'app in una cartella temporanea, la serve con python3 -m http.server su 127.0.0.1 (contesto sicuro)
nel percorso /app/ come su GitHub Pages, e con Playwright Chromium controlla:
manifest e icone, service worker attivo, funzionamento SENZA Internet (home, lezione, progressi),
lettura di una foto (OCR) prima con la rete e poi senza, nessuna richiesta fuori da 127.0.0.1,
avviso «nuova versione disponibile» e aggiornamento.
Uso: python3 tests/test_pwa.py [CARTELLA_SCREENSHOT]      (porta: PD_PWA_PORT, predefinita 8881)
Autore: Danilo D'Auria - Licenza MIT"""
import json, os, shutil, subprocess, sys, tempfile, time, urllib.request

QUI = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(QUI, ".."))
sys.path.insert(0, os.path.join(ROOT, "tools"))
sys.path.insert(0, QUI)
from make_pwa import crea_pwa  # noqa: E402
from ui_lettera import immagine_png  # noqa: E402
from ui_mobile import ATTIVAZIONE  # noqa: E402
from PIL import Image  # noqa: E402
from playwright.sync_api import sync_playwright  # noqa: E402

PORTA = int(os.environ.get("PD_PWA_PORT", "8881"))
BASE = "http://127.0.0.1:%d/" % PORTA
APP = BASE + "app/"
URL = APP + "?nosaluto&noprofilo"
T = tempfile.mkdtemp(prefix="pd-pwa-")
SITO = os.path.join(T, "sito")
SHOTS = sys.argv[1] if len(sys.argv) > 1 else os.path.join(T, "shots")
os.makedirs(SHOTS, exist_ok=True)
WEB = os.path.join(ROOT, "src", "web")
ESITI = []


def check(nome, ok, dettaglio=""):
    ESITI.append(bool(ok))
    print(("  ✔ " if ok else "  ✘ ") + nome + ("" if ok or dettaglio == "" else "  → " + str(dettaglio)[:400]))


class Server:
    """python3 -m http.server: si spegne per simulare davvero l'assenza di Internet."""
    p = None

    def avvia(self):
        self.p = subprocess.Popen([sys.executable, "-m", "http.server", str(PORTA), "--bind", "127.0.0.1", "--directory", SITO],
                                  stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        for _ in range(50):
            try:
                urllib.request.urlopen(APP + "manifest.webmanifest", timeout=1).read()
                return
            except OSError:
                time.sleep(0.1)
        raise SystemExit("server di prova non partito sulla porta %d" % PORTA)

    def ferma(self):
        if self.p:
            self.p.terminate()
            self.p.wait()
            self.p = None


def prova_manifest():
    m = json.loads(urllib.request.urlopen(APP + "manifest.webmanifest").read().decode("utf-8"))
    check("manifest: nome, lingua, display, start_url/scope relativi",
          m.get("name") == "Professore Digitale" and m.get("short_name") == "Professore" and m.get("lang") == "it" and
          m.get("display") == "standalone" and m.get("start_url") == "./" and m.get("scope") == "./", m)
    check("manifest: colori", m.get("theme_color", "").startswith("#") and m.get("background_color", "").startswith("#"))
    scopi = set()
    for ic in m.get("icons", []):
        p = os.path.join(SITO, "app", ic["src"])
        lato = int(ic["sizes"].split("x")[0])
        ok = os.path.isfile(p) and Image.open(p).size == (lato, lato) and ic["type"] == "image/png"
        check("icona %s %s (%s)" % (ic["src"], ic["sizes"], ic["purpose"]), ok)
        scopi.add((lato, ic["purpose"]))
    check("icone 192/512 normali e maskable", {(192, "any"), (512, "any"), (512, "maskable")} <= scopi, scopi)
    a = os.path.join(SITO, "app", "icone", "apple-touch-icon.png")
    check("apple-touch-icon 180x180 senza trasparenza", os.path.isfile(a) and Image.open(a).size == (180, 180) and Image.open(a).mode == "RGB")
    html = open(os.path.join(SITO, "app", "index.html"), encoding="utf-8").read()
    testa = html.split("</head>")[0]
    check("index.html: manifest, theme-color, meta iOS, apple-touch-icon nel <head>",
          all(x in testa for x in ('rel="manifest" href="manifest.webmanifest"', 'name="theme-color"', 'name="apple-mobile-web-app-capable" content="yes"',
                                   'name="apple-mobile-web-app-title" content="Professore"', 'rel="apple-touch-icon"', "serviceWorker")))
    check("index.html: nessuna risorsa esterna", "https://" not in testa and 'src="http' not in html and "cdn." not in testa)
    sw = open(os.path.join(SITO, "app", "sw.js"), encoding="utf-8").read()
    check("sw.js: segnaposto sostituiti e ES5 (niente let/const/=>)", not any(x in sw for x in ("__VERSIONE__", "__IMPRONTA", "__FILE_APP__")) and
          " => " not in sw and "\nlet " not in sw and "const " not in sw and "async " not in sw)


def prova_ocr(page, nome, selettore):
    page.goto(URL + "#/lettera")
    try:
        page.wait_for_selector(selettore, state="attached", timeout=15000)
    except Exception:
        page.screenshot(path=SHOTS + "/errore-ocr.png", full_page=True)
        check("OCR %s: pagina della lettera con il caricamento della foto" % nome, False,
              page.evaluate("[location.href, PD.lettera.ocrPossibile(), matchMedia('(pointer: coarse)').matches, document.querySelectorAll('#lt-file').length]"))
        return
    page.set_input_files(selettore, files=[{"name": "lettera.png", "mimeType": "image/png", "buffer": immagine_png()}])
    page.wait_for_selector(".lt-ocr.lt-ocr-ok, .lt-ocr.lt-ocr-male", timeout=180000)
    letto = page.input_value("#lt-testo")
    ok = "lt-ocr-ok" in page.get_attribute("#lt-ocr", "class") and "87" in letto
    totale = page.evaluate("PD.lettera.analizza(document.getElementById('lt-testo').value).totale")
    check("OCR %s: foto letta e importo trovato" % nome, ok and totale and abs(totale["valore"] - 87.4) < 0.01, [page.inner_text("#lt-ocr"), letto, totale])


def main():
    os.makedirs(SITO)
    crea_pwa(WEB, os.path.join(SITO, "app"))
    srv = Server()
    srv.avvia()
    try:
        print("== manifest e icone")
        prova_manifest()
        with sync_playwright() as pw:
            b = pw.chromium.launch()
            ctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True,
                                service_workers="allow")
            richieste, errori = [], []
            ctx.on("request", lambda r: richieste.append(r.url))
            page = ctx.new_page()
            page.on("pageerror", lambda e: errori.append(str(e)))

            print("== prima apertura (con Internet)")
            page.goto(URL + "#/home")
            page.wait_for_selector("#view-home .hero")
            check("app: segnali PD_PWA e PD_OCR_LOCALE", page.evaluate("window.PD_PWA === true && window.PD_OCR_LOCALE === true && !PD.server"))
            page.wait_for_function("navigator.serviceWorker.controller !== null", timeout=20000)
            stato = page.evaluate("navigator.serviceWorker.ready.then(r => r.active && r.active.state)")
            check("service worker registrato, attivo e al comando della pagina", stato == "activated", stato)
            chiavi = page.evaluate("caches.keys()")
            check("cache dell'app creata (nome con la versione)", any(k.startswith("professore-app-") for k in chiavi), chiavi)
            check("lettera: OCR disponibile nell'app", page.evaluate("PD.lettera.ocrPossibile()"))
            page.screenshot(path=SHOTS + "/pwa-home-390.png")

            # una lezione: il passo visto resta nei progressi
            lez = page.evaluate("PD.lessonsOf ? PD.lessonsOf('corso')[0].id : window.PD_LESSONS[0].id")
            page.goto(URL + "#/lessons/" + lez + "/1")
            page.wait_for_function("PD.progress.lessons && PD.progress.lessons[%s] && PD.progress.lessons[%s].seen.indexOf(1) >= 0" % (json.dumps(lez), json.dumps(lez)))
            page.evaluate("PD.progress.provaPwa = 'resta'; PD.saveProgress()")

            print("== lettura di una foto (con Internet: i file si salvano)")
            page.goto(URL + "#/lettera")
            page.wait_for_selector("#lt-file", state="attached")
            cap = page.get_attribute("#lt-foto", "capture") if page.locator("#lt-foto").count() else None
            check("telefono: pulsante che apre la fotocamera (capture=environment)", cap == "environment" and
                  page.get_attribute("#lt-foto", "accept") == "image/*", cap)
            check("tesseract.js non caricato finché non serve", not any("/vendor/ocr/" in u for u in richieste))
            prova_ocr(page, "con Internet", "#lt-foto")
            page.screenshot(path=SHOTS + "/pwa-lettera-390.png", full_page=True)
            in_cache = page.evaluate("""caches.keys().then(ks => Promise.all(ks.filter(k => k.indexOf('professore-ocr-') === 0)
                .map(k => caches.open(k).then(c => c.keys()).then(rs => rs.map(r => r.url.split('/vendor/ocr/')[1]))))).then(a => [].concat.apply([], a))""")
            check("file OCR salvati al primo uso", "tesseract.min.js" in in_cache and "worker.min.js" in in_cache and
                  "lang/ita.traineddata.gz" in in_cache and any(x.startswith("tesseract-core") for x in in_cache), in_cache)

            print("== senza Internet (server spento e browser offline)")
            srv.ferma()
            ctx.set_offline(True)
            page.reload()
            page.goto(URL + "#/home")
            page.wait_for_selector("#view-home .hero", timeout=15000)
            check("offline: la home si apre", page.is_visible("#view-home .hero"))
            page.goto(URL + "#/lessons/" + lez + "/2")
            page.wait_for_selector("#view-lessons .lesson-nav", timeout=10000)
            check("offline: una lezione si apre", page.is_visible("#view-lessons .lesson-nav"))
            check("offline: i progressi restano", page.evaluate("PD.progress.provaPwa === 'resta' && PD.progress.lessons[%s].seen.indexOf(1) >= 0" % json.dumps(lez)))
            page.screenshot(path=SHOTS + "/pwa-offline-lezione-390.png")
            # nuova pagina, OCR da zero (worker nuovo): i file arrivano dalla cache
            page.goto(URL + "#/home")
            page.reload()
            page.wait_for_selector("#view-home .hero")
            check("offline: pagina ricaricata, motore di lettura da preparare di nuovo", page.evaluate("!PD.lettera._ocr.worker && typeof window.Tesseract === 'undefined'"))
            prova_ocr(page, "senza Internet", "#lt-file")   # dopo il ricaricamento offline Playwright perde (pointer: coarse)
            check("offline: nessun avviso «serve Internet» per la lettura", page.locator(".lt-ocr-prima:not([hidden])").count() == 0)
            ctx.set_offline(False)

            print("== nuova versione disponibile")
            vecchie = page.evaluate("caches.keys()")
            crea_pwa(WEB, os.path.join(SITO, "app"), versione="9.9.9-prova")
            srv.avvia()
            page.reload()
            page.wait_for_selector("#pd-nuova-versione", timeout=30000)
            testo = page.inner_text("#pd-nuova-versione")
            check("avviso gentile della nuova versione", "nuova versione del Professore" in testo and "Aggiorna" in testo, testo)
            page.screenshot(path=SHOTS + "/pwa-nuova-versione-390.png")
            page.click("#pd-aggiorna")
            page.wait_for_function("document.readyState === 'complete' && !document.getElementById('pd-nuova-versione') && window.PD && PD.progress", timeout=20000)
            page.wait_for_function("caches.keys().then(ks => ks.filter(k => k.indexOf('professore-app-') === 0).length === 1)")
            nuove = page.evaluate("caches.keys()")
            check("aggiornato: nuova cache, vecchie cancellate", any("9.9.9-prova" in k for k in nuove) and
                  not any(k in nuove for k in vecchie if k.startswith("professore-app-")), [vecchie, nuove])
            check("aggiornato: la pagina è la nuova versione", page.evaluate("window.PD_VERSION") == "9.9.9-prova")
            check("aggiornato: i file OCR non si riscaricano (stessa cache)", any(k.startswith("professore-ocr-") for k in nuove))
            check("aggiornato: i progressi restano", page.evaluate("PD.progress.provaPwa === 'resta'"))

            print("== primo avvio sul telefono: «Toccate qui per cominciare»")
            vctx = b.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
            vctx.add_init_script(ATTIVAZIONE)   # un telefono vero, appena aperta l'app, non ha ancora ricevuto tocchi
            vctx.on("request", lambda r: richieste.append(r.url))
            vp = vctx.new_page()
            vp.on("pageerror", lambda e: errori.append(str(e)))
            vp.goto(APP + "?noprofilo#/home")
            try:
                vp.wait_for_selector("#pd-tocca", timeout=8000)
                invito = vp.inner_text("#pd-tocca")
            except Exception:
                invito = ""
            check("app: invito «Toccate qui per cominciare» al primo avvio", "Toccate qui per cominciare" in invito, invito)
            vp.screenshot(path=SHOTS + "/pwa-tocca-390.png")
            if invito:
                vp.tap("#pd-tocca-btn")
                vp.wait_for_selector("#pd-tocca", state="detached", timeout=5000)
                check("app: dopo il tocco l'invito sparisce e la voce è sbloccata",
                      vp.evaluate("sessionStorage.getItem('pd.voceSbloccata') === '1'") and vp.is_visible("#pd-bubble"))
            vctx.close()

            # tablet
            tab = b.new_context(viewport={"width": 820, "height": 1180}, is_mobile=True, has_touch=True)
            tab.on("request", lambda r: richieste.append(r.url))
            tp = tab.new_page()
            tp.on("pageerror", lambda e: errori.append(str(e)))
            tp.goto(URL + "#/home")
            tp.wait_for_selector("#view-home .hero")
            tp.screenshot(path=SHOTS + "/pwa-home-820.png")
            tp.goto(URL + "#/lettera")
            tp.wait_for_selector("#lt-testo")
            tp.screenshot(path=SHOTS + "/pwa-lettera-820.png")
            for p, w in ((page, 390), (tp, 820)):
                largo = p.evaluate("document.documentElement.scrollWidth")
                check("nessuno scorrimento orizzontale a %d px" % w, largo <= w + 2, largo)
            # tablet appena arrivato, senza Internet prima di aver mai letto una foto: avviso gentile
            tp.wait_for_function("navigator.serviceWorker.controller !== null", timeout=20000)
            tab.set_offline(True)
            tp.goto(URL + "#/home")
            tp.reload()
            tp.wait_for_selector("#view-home .hero")
            tp.goto(URL + "#/lettera")
            tp.wait_for_selector("#lt-testo")
            try:
                tp.wait_for_selector(".lt-ocr-prima:not([hidden])", timeout=5000)
                nota = tp.inner_text(".lt-ocr-prima")
            except Exception:
                nota = ""
            check("offline, foto mai lette: «la prima volta serve Internet»", "serve Internet" in nota, nota)
            tp.screenshot(path=SHOTS + "/pwa-lettera-820-offline.png")
            tab.set_offline(False)
            tab.close()

            fuori = [u for u in richieste if not (u.startswith(BASE) or u.startswith("data:") or u.startswith("blob:"))]
            check("nessuna richiesta fuori da 127.0.0.1", not fuori, fuori[:5])
            # /api/status (fuori dall'app) è l'unica richiesta che può fallire: nessun errore JavaScript
            check("nessun errore JavaScript", not errori, errori[:3])
            b.close()
    finally:
        srv.ferma()
    print("Screenshot in", SHOTS)
    ok = all(ESITI)
    print(("✔ APP PER TELEFONO: %d controlli superati" if ok else "✘ APP PER TELEFONO: %d controlli, alcuni non superati") % len(ESITI))
    if len(sys.argv) <= 1:
        shutil.rmtree(T, ignore_errors=True)
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
