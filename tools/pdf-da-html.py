#!/usr/bin/env python3
"""Stampa in PDF un manuale scritto in HTML (vademecum, guide) con Chromium (Playwright).

Uso:  python3 tools/pdf-da-html.py docs/sorgenti/vademecum-windows.html docs/Vademecum_Professore_Digitale_Windows.pdf "Vademecum per Windows"

Convenzioni dell'HTML:
  <section class="cover">…</section>   copertina a pagina intera, senza piè di pagina (la prima pagina)
  <section class="back">…</section>    quarta di copertina, senza piè di pagina (l'ultima pagina)
  <span class="marca">§§cN§§</span>    segnaposto invisibile all'inizio del capitolo N
  <span class="toc-p" data-c="N"></span> nell'indice: viene riempito con la pagina del capitolo N
Le pagine si numerano contando anche la copertina (come nel vademecum per Linux).
Servono: playwright (Chromium), poppler-utils (pdftotext, pdfseparate, pdfunite) e i caratteri Noto.
Autore: Danilo D'Auria - Codice MIT, contenuti CC BY-NC-SA 4.0"""
import os, re, shutil, subprocess, sys, tempfile
from playwright.sync_api import sync_playwright

src, out, titolo = sys.argv[1], sys.argv[2], (sys.argv[3] if len(sys.argv) > 3 else "Vademecum")
base = "file://" + os.path.abspath(src)
html = open(src, encoding="utf-8").read()
tmp = tempfile.mkdtemp(prefix="pd-pdf-")

FOOTER = ('<div style="width:100%;font-family:\'Noto Sans\',sans-serif;font-size:7.5px;color:#6b7280;'
          'padding:0 18mm;display:flex;justify-content:space-between">'
          '<span>Professore Digitale · ' + titolo + '</span><span>© 2026 Danilo D\'Auria · licenza CC BY-NC-SA 4.0</span>'
          '<span style="font-weight:700;color:#1d5c8f" class="pageNumber"></span></div>')

def variant(mode):
    """mode: corpo (copertine sostituite da pagine vuote), cover, back"""
    if mode == "corpo":
        return html.replace("<body", '<body data-modo="corpo"', 1)
    return html.replace("<body", '<body data-modo="%s"' % mode, 1)

def render(page, content, path, footer):
    page.set_content(content, wait_until="load")
    page.evaluate("document.fonts.ready")
    page.wait_for_timeout(400)
    page.emulate_media(media="print")
    if footer:
        page.pdf(path=path, format="A4", print_background=True, display_header_footer=True,
                 header_template="<span></span>", footer_template=FOOTER,
                 margin={"top": "16mm", "bottom": "16mm", "left": "0", "right": "0"})
    else:
        page.pdf(path=path, format="A4", print_background=True, margin={"top": "0", "bottom": "0", "left": "0", "right": "0"})

def pages_of_markers(pdf):
    n = int(re.search(r"Pages:\s+(\d+)", subprocess.run(["pdfinfo", pdf], capture_output=True, text=True).stdout).group(1))
    found = {}
    for i in range(1, n + 1):
        t = subprocess.run(["pdftotext", "-f", str(i), "-l", str(i), pdf, "-"], capture_output=True, text=True).stdout
        for m in re.findall(r"§§c(\d+)§§", t):
            found.setdefault(m, i)
    return n, found

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page()
    pg.goto(base)          # le immagini relative si risolvono rispetto al file sorgente
    def go(content, path, footer):
        # set_content non conosce la cartella: si inserisce <base>
        content = content.replace("<head>", '<head><base href="%s">' % base, 1)
        render(pg, content, path, footer)
    corpo = os.path.join(tmp, "corpo.pdf")
    go(variant("corpo"), corpo, True)
    n, mk = pages_of_markers(corpo)
    def fill(h):
        return re.sub(r'<span class="toc-p" data-c="(\d+)">[^<]*</span>',
                      lambda m: '<span class="toc-p" data-c="%s">%s</span>' % (m.group(1), mk.get(m.group(1), "")), h)
    html = fill(html)
    go(variant("corpo"), corpo, True)            # seconda passata con l'indice completo
    n2, mk2 = pages_of_markers(corpo)
    if mk2 != mk:                                  # l'indice ha spostato le pagine: terza passata
        mk = mk2; html = fill(html); go(variant("corpo"), corpo, True)
    cover = os.path.join(tmp, "cover.pdf"); back = os.path.join(tmp, "back.pdf")
    go(variant("cover"), cover, False)
    go(variant("back"), back, False)
    b.close()

n = int(re.search(r"Pages:\s+(\d+)", subprocess.run(["pdfinfo", corpo], capture_output=True, text=True).stdout).group(1))
subprocess.run(["pdfseparate", corpo, os.path.join(tmp, "p-%d.pdf")], check=True)
parts = [os.path.join(tmp, "cover.pdf")] + [os.path.join(tmp, "p-%d.pdf" % i) for i in range(2, n)] + [os.path.join(tmp, "back.pdf")]
subprocess.run(["pdfunite"] + parts + [out], check=True)
shutil.rmtree(tmp)
# autore e licenza anche nelle proprietà del PDF (dalla 3.5.2): File → Proprietà nel lettore PDF
try:
    import pikepdf
    with pikepdf.open(out, allow_overwriting_input=True) as pdf:
        tit = "Professore Digitale – " + titolo
        with pdf.open_metadata(set_pikepdf_as_editor=False) as meta:
            meta["dc:title"] = tit
            meta["dc:creator"] = ["Danilo D'Auria"]
            meta["dc:rights"] = "© 2026 Danilo D'Auria – CC BY-NC-SA 4.0 – https://creativecommons.org/licenses/by-nc-sa/4.0/"
            meta["xmpRights:Marked"] = "True"
            meta["xmpRights:WebStatement"] = "https://creativecommons.org/licenses/by-nc-sa/4.0/"
        # le proprietà dopo l'XMP: chiudendo open_metadata pikepdf riscrive le proprietà dall'XMP
        pdf.docinfo["/Title"] = tit
        pdf.docinfo["/Author"] = "Danilo D'Auria"
        pdf.docinfo["/Subject"] = "Contenuti © 2026 Danilo D'Auria – licenza Creative Commons BY-NC-SA 4.0"
        pdf.docinfo["/Keywords"] = "Professore Digitale, FeniceOS, CC BY-NC-SA 4.0, https://creativecommons.org/licenses/by-nc-sa/4.0/"
        pdf.save(out)
except ImportError:
    print("(pikepdf assente: proprietà del PDF non scritte)")
print("creato", out, "-", n, "pagine")
