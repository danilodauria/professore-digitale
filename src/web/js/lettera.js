/* ==============================================================================
 *  PROFESSORE DIGITALE - «Spiegami questa lettera»
 *  L'allievo fotografa (o scansiona) una bolletta, una multa, una lettera del Comune o dell'INPS,
 *  oppure ne scrive/incolla il testo. Il Professore:
 *   1. legge il testo SUL PC, senza Internet (OCR con tesseract.js servito da vendor/ocr/,
 *      caricato solo quando serve e solo con il server locale);
 *   2. spiega in parole semplici con un motore a regole offline: tipo di documento, mittente,
 *      importi e totale, scadenze («mancano N giorni»), codici utili, termini per il ricorso,
 *      glossario delle parole difficili, cosa fare passo passo, controllo anti-truffa;
 *   3. legge a voce, stampa, e «dimentica» la lettera.
 *  Privacy: niente viene salvato né inviato. In progress.lettera solo conteggi (mai il testo).
 *  JavaScript puro (ES5). Ideato e sviluppato da Danilo D'Auria - Licenza MIT
 * ============================================================================== */
(function () {
  "use strict";
  var PD = window.PD, $ = PD.$, $$ = PD.$$, esc = PD.esc;

  /* ------------------------------------------------------------------------
   *  Testo: normalizzazione e correzione degli errori tipici dell'OCR
   * ---------------------------------------------------------------------- */
  var ACC = { "à": "a", "á": "a", "â": "a", "ä": "a", "è": "e", "é": "e", "ê": "e", "ë": "e", "ì": "i", "í": "i", "î": "i", "ï": "i",
    "ò": "o", "ó": "o", "ô": "o", "ö": "o", "ù": "u", "ú": "u", "û": "u", "ü": "u", "ç": "c", "ñ": "n",
    "’": "'", "‘": "'", "`": "'", "´": "'", "“": '"', "”": '"', "«": '"', "»": '"' };
  function senzaAccenti(t) {
    var s = "";
    for (var i = 0; i < t.length; i++) { var c = t.charAt(i); s += ACC[c] || c; }
    return s;
  }
  /* Nei gruppi fatti quasi solo di cifre l'OCR scambia O/0, l/1, S/5, B/8: li correggiamo
   * carattere per carattere (la lunghezza resta uguale, così le posizioni servono per evidenziare). */
  var CIFRE_FALSE = { "O": "0", "o": "0", "I": "1", "l": "1", "|": "1", "S": "5", "B": "8" };
  function sistemaCifre(t) {
    t = String(t || "");
    return t.replace(/[\dOoIl|SB][\dOoIl|SB.,\/]*[\dOoIl|SB]/g, function (g, pos) {
      var cifre = (g.match(/\d/g) || []).length, alfa = (g.match(/[\dOoIl|SB]/g) || []).length;
      if (cifre < 2 || cifre < alfa * 0.6) return g;
      /* si corregge solo la lettera che non tocca altre lettere (così «INPS.0000» resta com'è) */
      return g.replace(/[OoIl|SB]/g, function (c, k) {
        var prima = t.charAt(pos + k - 1), dopo = t.charAt(pos + k + 1);
        return /[A-Za-zÀ-ÿ]/.test(prima) || /[A-Za-zÀ-ÿ]/.test(dopo) ? c : CIFRE_FALSE[c];
      });
    });
  }
  /* parole chiave che l'OCR sbaglia spesso: le correggiamo per somiglianza (distanza di modifica) */
  var VOCABOLARIO = ("bolletta bollette fornitura fornitore energia elettrica consumi consumo scadenza pagamento pagare sollecito raccomandata giacenza " +
    "verbale violazione pensione cedolino prenotazione referto contratto offerta recesso tributi tributo riscossione cartella intimazione " +
    "notifica notificato ricorso autotutela rateizzazione rateazione conguaglio acconto accise domiciliazione decadenza sanzione sanzioni " +
    "interessi totale importo dovuto destinatario ambulatorio impegnativa previdenza prestazione indebito accertamento contestazione " +
    "decurtazione patente fatturazione fattura depurazione fognatura acquedotto telefonia insoluto morosita diffida pignoramento " +
    "amministrativo ingiunzione imponibile potenza impegnata autolettura cauzionale versamento postale comune agenzia entrate " +
    "polizia municipale locale finanziamento correntista estratto rendiconto ripensamento sottoscrizione condizioni generali " +
    "ospedaliera sanitaria specialistica ticket bonifico tassa rifiuti automobilistica trasmissione dichiarazione reddituale").split(" ");
  function distanza(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    var prec = [], cur, i, j;
    for (j = 0; j <= b.length; j++) prec.push(j);
    for (i = 1; i <= a.length; i++) {
      cur = [i]; var minimo = i;
      for (j = 1; j <= b.length; j++) {
        var v = Math.min(prec[j] + 1, cur[j - 1] + 1, prec[j - 1] + (a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1));
        cur.push(v); if (v < minimo) minimo = v;
      }
      if (minimo > max) return max + 1;
      prec = cur;
    }
    return prec[b.length];
  }
  var cacheParole = {};
  function correggiParola(w) {
    if (w.length < 6 || VOCABOLARIO.indexOf(w) >= 0) return w;
    if (cacheParole.hasOwnProperty(w)) return cacheParole[w];
    var max = w.length >= 10 ? 2 : 1, best = w, bd = max + 1;
    for (var i = 0; i < VOCABOLARIO.length; i++) {
      var d = distanza(w, VOCABOLARIO[i], max);
      if (d < bd) { bd = d; best = VOCABOLARIO[i]; if (d === 1 && max === 1) break; }
    }
    cacheParole[w] = best;
    return best;
  }
  /* testo per riconoscere le parole: minuscolo, senza accenti, spazi compattati, parole corrette */
  function perParole(t) {
    var s = senzaAccenti(sistemaCifre(t).toLowerCase()).replace(/\s+/g, " ");
    return s.replace(/[a-z0-9]+/g, function (w) {
      if (/\d/.test(w) && /[a-z]{3}/.test(w) && (w.match(/\d/g) || []).length === 1) w = w.replace(/0/g, "o").replace(/1/g, "i").replace(/5/g, "s");
      return /\d/.test(w) ? w : correggiParola(w);
    });
  }

  /* ------------------------------------------------------------------------
   *  Tipi di documento: parole chiave con il loro peso (testo normalizzato)
   * ---------------------------------------------------------------------- */
  var TIPI = {
    luce: { t: "Bolletta della luce", ico: "💡", gruppo: "bolletta", k: [["energia elettrica", 4], ["\\bkwh\\b", 4], ["\\bpod\\b", 3], ["potenza (impegnata|disponibile)", 3], ["fornitura (di )?(energia|luce)", 3], ["bolletta (della )?luce", 4], ["materia energia", 3], ["\\bf1\\b|\\bf2\\b|\\bf3\\b", 1]] },
    gas: { t: "Bolletta del gas", ico: "🔥", gruppo: "bolletta", k: [["gas naturale", 4], ["\\bsmc\\b", 4], ["\\bpdr\\b", 3], ["metri cubi", 2], ["fornitura (di )?gas", 3], ["bolletta (del )?gas", 4], ["metano", 2], ["materia gas", 3]] },
    acqua: { t: "Bolletta dell'acqua", ico: "💧", gruppo: "bolletta", k: [["servizio idrico", 4], ["acquedotto", 3], ["depurazione", 3], ["fognatura", 3], ["bolletta (dell')?acqua", 4], ["consumo (di )?acqua", 3], ["\\bidric[oa]\\b", 2]] },
    telefono: { t: "Bolletta del telefono o di Internet", ico: "📞", gruppo: "bolletta", k: [["linea (fissa|mobile|telefonica)", 3], ["\\bfibra\\b", 3], ["\\badsl\\b", 3], ["\\bmodem\\b", 2], ["traffico (telefonico|dati|voce)", 3], ["\\bsim\\b", 2], ["\\bgiga\\b", 2], ["telefonia", 3], ["\\binternet\\b", 1], ["canone mensile", 1]] },
    bolletta: { t: "Bolletta", ico: "🧾", k: [["bollett[ae]", 3], ["fattura", 2], ["fornitura", 2], ["consum[oi]", 2], ["periodo di fatturazione", 3], ["\\blettura\\b", 1], ["(numero|codice) cliente", 1], ["domiciliazione", 1]] },
    avviso: { t: "Avviso di pagamento (tasse e tributi)", ico: "🏛️", k: [["\\btari\\b", 5], ["tassa (sui )?rifiuti", 5], ["tribut[oi]", 3], ["\\bimu\\b", 4], ["bollo auto", 5], ["tass[ae] automobilistic[ah]e?", 5], ["avviso di pagamento", 3], ["ufficio tributi", 4], ["canone unico", 3], ["\\bpagopa\\b", 1], ["codice avviso", 1], ["\\btasi\\b|\\bcosap\\b|\\btosap\\b", 3]] },
    multa: { t: "Multa (verbale di contravvenzione)", ico: "🚓", k: [["\\bverbale\\b", 3], ["codice della strada", 5], ["\\bc\\.? ?d\\.? ?s\\b", 2], ["violazione", 2], ["\\btarga\\b", 2], ["polizia (locale|municipale|stradale)", 3], ["decurtazione", 3], ["punti (della|dalla|sulla) patente", 3], ["autovelox|limite di velocita", 3], ["\\bsosta\\b|divieto", 1], ["contravvenzione", 4], ["\\bcontestazione\\b", 1]] },
    cartella: { t: "Cartella o avviso dell'Agenzia delle Entrate", ico: "📑", k: [["cartella (di pagamento|esattoriale)", 6], ["agenzia (delle )?entrate[ -]*riscossione", 6], ["\\briscossione\\b", 2], ["intimazione", 4], ["avviso di accertamento", 4], ["agenzia (delle )?entrate", 3], ["fermo amministrativo", 3], ["pignoramento", 2], ["rottamazione|definizione agevolata", 3], ["\\bf24\\b", 1], ["\\bruolo\\b", 1]] },
    inps: { t: "Comunicazione dell'INPS", ico: "👵", k: [["\\binps\\b", 4], ["pension[ei]|pensionat", 3], ["cedolino", 3], ["prestazion[ei]", 1], ["assegno (unico|sociale|di inclusione)", 3], ["\\bnaspi\\b", 3], ["\\bred\\b", 1], ["dichiarazione reddituale", 3], ["previdenza", 2], ["\\bindebito\\b", 2], ["invalidita|accompagnamento", 2]] },
    raccomandata: { t: "Avviso di giacenza (raccomandata da ritirare)", ico: "📮", k: [["avviso di (giacenza|ricevimento|deposito)", 6], ["giacenza", 3], ["raccomandata", 2], ["ufficio postale", 2], ["atti giudiziari", 3], ["ritir(o|are|arla|atela)", 2], ["destinatario (e )?assente|in sua assenza|in vostra assenza", 3], ["\\bdelega\\b", 1]] },
    sollecito: { t: "Sollecito di pagamento o messa in mora", ico: "⏰", k: [["sollecito", 5], ["messa in mora", 6], ["\\bdiffida\\b", 3], ["insolut", 3], ["morosita", 3], ["recupero crediti", 5], ["mancato pagamento", 2], ["risulta(no)? non (ancora )?pagat", 3], ["ultimo avviso", 2]] },
    sanitario: { t: "Prenotazione o referto sanitario", ico: "🩺", k: [["prenotazion[ei]", 3], ["referto", 4], ["\\b(asl|asp|ausl|ats|ulss)\\b", 3], ["\\bcup\\b", 3], ["ambulatori", 3], ["visita (specialistica|medica|cardiologica|oculistica|di controllo)", 3], ["\\bticket\\b", 2], ["impegnativa|ricetta", 2], ["\\besam[ei]\\b", 1], ["azienda sanitaria|ospedal", 3], ["digiuno", 2], ["\\breparto\\b", 1]] },
    contratto: { t: "Contratto o offerta commerciale", ico: "✍️", k: [["\\bofferta\\b", 2], ["\\bcontratto\\b", 2], ["\\bproposta\\b", 2], ["condizioni generali", 3], ["\\brecesso\\b", 2], ["sottoscri", 2], ["promozion", 2], ["diritto di ripensamento", 4], ["\\battivazione\\b", 1], ["\\bsconto\\b", 1], ["\\bvantaggios", 1]] },
    banca: { t: "Lettera della banca", ico: "🏦", k: [["\\bbanca\\b", 2], ["conto corrente", 3], ["estratto conto", 4], ["carta di (credito|debito)", 2], ["\\bfiliale\\b", 2], ["\\bmutuo\\b", 3], ["finanziamento", 2], ["correntista", 3], ["rendiconto", 2], ["documento di sintesi", 3], ["\\babi\\b|\\bcab\\b", 1]] }
  };
  var GENERICO = { t: "Lettera o documento", ico: "✉️" };
  var ORDINE = ["sollecito", "cartella", "multa", "raccomandata", "avviso", "inps", "sanitario", "luce", "gas", "acqua", "telefono", "bolletta", "banca", "contratto"];
  var PAGAMENTO = { luce: 1, gas: 1, acqua: 1, telefono: 1, bolletta: 1, avviso: 1, multa: 1, cartella: 1, sollecito: 1 };

  function punteggi(p) {
    var sc = {};
    Object.keys(TIPI).forEach(function (id) {
      var n = 0;
      TIPI[id].k.forEach(function (k) { if (new RegExp(k[0]).test(p)) n += k[1]; });
      sc[id] = n;
    });
    /* le bollette di un servizio prendono anche i punti della «bolletta» generica */
    ["luce", "gas", "acqua", "telefono"].forEach(function (id) { if (sc[id] > 0) sc[id] += sc.bolletta; });
    return sc;
  }
  function riconosciTipo(p) {
    var sc = punteggi(p), best = "generico", bv = 2;
    /* un sollecito o una messa in mora resta tale anche se parla di una bolletta della luce o dell'acqua */
    if (sc.sollecito >= 5 && sc.sollecito >= sc.cartella) return { id: "sollecito", punti: sc };
    ORDINE.forEach(function (id) { if (sc[id] > bv) { bv = sc[id]; best = id; } });
    return { id: best, punti: sc };
  }

  /* ------------------------------------------------------------------------
   *  Mittente
   * ---------------------------------------------------------------------- */
  var MITTENTI = [
    { re: /\bcomune di\s+[A-ZÀ-Ý][A-Za-zÀ-ÿ'\-]+(?:\s+[A-ZÀ-Ý][A-Za-zÀ-ÿ'\-]+){0,2}/i },
    { re: /\bagenzia\s+delle\s+entrate(?:\s*[-–]\s*riscossione)?/i },
    { re: /\bINPS\b/, nome: "INPS (Istituto Nazionale della Previdenza Sociale)" },
    { re: /\bpolizia\s+(?:locale|municipale|stradale)(?:\s+(?:di|del|della)\s+[A-ZÀ-Ý][A-Za-zÀ-ÿ'\-]+(?:\s+[A-ZÀ-Ý][A-Za-zÀ-ÿ'\-]+)?)?/i },
    { re: /\b(?:azienda\s+(?:sanitaria|ospedaliera)|ASL|ASP|AUSL|ULSS)\b[^\n,.;:]{0,40}/i },
    { re: /\bospedale\s+[^\n,.;:]{3,40}/i },
    { re: /\b(?:prefettura|tribunale|giudice di pace|ministero|regione)\s+(?:di|del|della|dell')\s*[A-ZÀ-Ý][^\n,.;:]{2,35}/i },
    { re: /\bbanca\s+[A-ZÀ-Ý][A-Za-zÀ-ÿ'\-]*(?:\s+(?:del|della|di|dei)?\s*[A-ZÀ-Ý][A-Za-zÀ-ÿ'\-]*){0,3}/ },
    { re: /[A-ZÀ-Ý][A-Za-zÀ-ÿ&'.\-]*(?:[ ][A-Za-zÀ-ÿ&'.\-]+){0,5}?\s+(?:S\.?\s?p\.?\s?A\.?|S\.?\s?r\.?\s?l\.?|S\.?\s?n\.?\s?c\.?)(?![A-Za-z])/ },
    { re: /\bufficio\s+postale\s+(?:di\s+)?[A-ZÀ-Ý][^\n,.;:]{0,30}/i },
    { re: /\bposte\s+italiane\b/i },
    { re: /\bufficio\s+(?:tributi|anagrafe|tecnico|entrate)\b/i }
  ];
  function maiuscoleGentili(s) {
    if (/[a-zà-ÿ]/.test(s)) return s;
    return s.toLowerCase().replace(/(^|[\s\-–'(])([a-zà-ÿ])/g, function (x, a, b) { return a + b.toUpperCase(); })
      .replace(/ (Di|Del|Della|Dei|Delle|E|Per|Al|Alla) /g, function (x) { return x.toLowerCase(); }).replace(/\b(Inps|Cup|Asl|Asp|Ausl|Ats|Ulss|Tari|Imu|Aci|Pra)\b/g, function (x) { return x.toUpperCase(); });
  }
  function trovaMittente(t) {
    var best = null;
    var dich = /\bmittente\s*:\s*([^\n]{3,60})/i.exec(t);
    if (dich) return maiuscoleGentili(dich[1].replace(/[\s\-–:,;]+$/, "").trim());
    MITTENTI.forEach(function (m) {
      var x = m.re.exec(t);
      if (x && (!best || x.index < best.i)) best = { i: x.index, nome: m.nome || x[0] };
    });
    if (best) {
      var n = best.nome.replace(/\s+/g, " ").replace(/[\s\-–:,]+$/, "").trim();
      if (/\.$/.test(n) && !/[A-Z]\.$/.test(n)) n = n.slice(0, -1);
      return maiuscoleGentili(n).slice(0, 70);
    }
    /* «Da: nome <email>» delle email */
    var da = /^\s*da\s*:\s*([^\n<]{3,60})/im.exec(t);
    if (da) return da[1].trim();
    /* altrimenti la prima riga, se sembra un'intestazione */
    var righe = String(t).split(/\n/);
    for (var i = 0; i < Math.min(righe.length, 3); i++) {
      var r = righe[i].trim();
      if (r.length >= 3 && r.length <= 60 && /[A-Za-z]{3}/.test(r) && !/\d{3}/.test(r) && !/^(gentile|egregi|caro|cara|spett|oggetto)/i.test(r)) return maiuscoleGentili(r);
    }
    return "";
  }

  /* ------------------------------------------------------------------------
   *  Importi in euro
   * ---------------------------------------------------------------------- */
  var NUM = "(\\d{1,3}(?:[.'’]\\d{3})+(?:,\\d{1,2})?|\\d+(?:[.,]\\d{2})?)";
  var RE_EURO_DOPO = new RegExp(NUM + "\\s?(€|eur(?:o)?\\b)", "gi");
  var RE_EURO_PRIMA = new RegExp("(€|\\beur(?:o)?\\b)\\s?(?:\\:\\s?)?" + NUM, "gi");
  var RE_IMPORTO_ETICHETTA = /(totale|importo|da pagare|dovut[oa]|saldo|da versare|somma)[^\d\n€]{0,25}(\d{1,3}(?:\.\d{3})*,\d{2})(?![\d.,\/])/gi;
  function valoreNumero(s) {
    s = s.replace(/['’]/g, "");
    if (s.indexOf(",") >= 0) return parseFloat(s.replace(/\./g, "").replace(",", "."));
    if (/\.\d{2}$/.test(s) && !/\.\d{3}/.test(s)) return parseFloat(s);
    return parseFloat(s.replace(/\./g, ""));
  }
  function formatoEuro(v) {
    var p = v.toFixed(2).split("."), i = p[0], o = "";
    while (i.length > 3) { o = "." + i.slice(-3) + o; i = i.slice(0, -3); }
    return i + o + "," + p[1] + " €";
  }
  /* quanto è probabile che sia «il totale da pagare» (0 = no) */
  function rangoTotale(et) {
    if (/consum|precedent|gia pagat|pagat[oie] il|credito|\biva\b|imponibile|\bquota|mensil|pension|lord|rimbors|accisa|oneri|canone|minimo|massimo|fino a|annu[oa]|stimat|sconto|risparmi/.test(et)) return 0;
    if (/ridott|\brata\b|\b\d+\s?[aª°]? rata|scontat/.test(et)) return 1;
    if (/(totale|importo|somma) (da pagare|dovut|complessiv|da versare|bolletta|fattura|avviso)|da pagare|da versare|unica soluzione|totale dovuto|importo dovuto|somma dovuta|importo totale|totale complessivo/.test(et)) return 3;
    if (/totale|saldo|importo|dovut/.test(et)) return 2;
    return 0;
  }
  function trovaImporti(f, occupati) {
    var trovati = [];
    function libero(a, b) {
      for (var i = 0; i < occupati.length; i++) if (a < occupati[i][1] && b > occupati[i][0]) return false;
      for (i = 0; i < trovati.length; i++) if (a < trovati[i].b && b > trovati[i].a) return false;
      return true;
    }
    function aggiungi(a, b, num) {
      var v = valoreNumero(num);
      if (!(v > 0) || v > 10000000 || !libero(a, b)) return;
      trovati.push({ a: a, b: b, valore: Math.round(v * 100) / 100, testo: f.slice(a, b).replace(/\s+/g, " ") });
    }
    var m;
    RE_EURO_DOPO.lastIndex = 0;
    while ((m = RE_EURO_DOPO.exec(f))) aggiungi(m.index, m.index + m[0].length, m[1]);
    RE_EURO_PRIMA.lastIndex = 0;
    while ((m = RE_EURO_PRIMA.exec(f))) aggiungi(m.index, m.index + m[0].length, m[2]);
    RE_IMPORTO_ETICHETTA.lastIndex = 0;
    while ((m = RE_IMPORTO_ETICHETTA.exec(f))) { var a = m.index + m[0].length - m[2].length; aggiungi(a, a + m[2].length, m[2]); }
    trovati.sort(function (x, y) { return x.a - y.a; });
    /* etichetta: le parole prima dell'importo (sulla stessa riga o subito sopra) */
    trovati.forEach(function (x, i) {
      var inizio = Math.max(i ? trovati[i - 1].b : 0, x.a - 70), pezzo = f.slice(inizio, x.a);
      var righe = pezzo.split(/[\n;]/), et = righe.pop();
      if (et.replace(/[^A-Za-z]/g, "").length < 4 && righe.length) et = righe.pop() + " " + et;
      et = et.replace(/\s+/g, " ").replace(/^[\s:;,.\-–]+|[\s:;,.\-–(]+$/g, "").trim();
      x.etichetta = et.length > 50 ? "…" + et.slice(-49) : et;
      x.rango = rangoTotale(senzaAccenti(et.toLowerCase()));
    });
    return trovati;
  }
  function sceltaTotale(importi, tipo) {
    var best = null;
    importi.forEach(function (x) { if (x.rango >= 2 && (!best || x.rango > best.rango)) best = x; });
    if (!best && PAGAMENTO[tipo]) {
      importi.forEach(function (x) { if (x.rango > 0 && (!best || x.valore > best.valore)) best = x; });
      if (!best && importi.length === 1) best = importi[0];
    }
    if (best) best.totale = true;
    return best;
  }

  /* ------------------------------------------------------------------------
   *  Date e scadenze
   * ---------------------------------------------------------------------- */
  var MESI = { gennaio: 1, gen: 1, febbraio: 2, feb: 2, marzo: 3, mar: 3, aprile: 4, apr: 4, maggio: 5, mag: 5, giugno: 6, giu: 6, luglio: 7, lug: 7,
    agosto: 8, ago: 8, settembre: 9, set: 9, sett: 9, ottobre: 10, ott: 10, novembre: 11, nov: 11, dicembre: 12, dic: 12 };
  var RE_DATA_NUM = /\b(\d{1,2})\s?[\/\-.]\s?(\d{1,2})\s?[\/\-.]\s?(\d{4}|\d{2})(?![\d,])/g;
  var RE_DATA_TESTO = /\b(\d{1,2})\s?[°º]?\s+(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre|gen|feb|mar|apr|mag|giu|lug|ago|sett|set|ott|nov|dic)\.?\s+(\d{4})\b/gi;
  function dataValida(g, m, a) {
    if (a < 100) a += 2000;
    if (m < 1 || m > 12 || g < 1 || g > 31 || a < 1990 || a > 2100) return null;
    var d = new Date(a, m - 1, g);
    return d.getMonth() === m - 1 ? d : null;
  }
  function iso(d) { return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); }
  function dataIt(d) { return ("0" + d.getDate()).slice(-2) + "/" + ("0" + (d.getMonth() + 1)).slice(-2) + "/" + d.getFullYear(); }
  var GIORNI_SETT = ["domenica", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato"];
  var NOMI_MESI = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
  function dataLunga(d) { return GIORNI_SETT[d.getDay()] + " " + d.getDate() + " " + NOMI_MESI[d.getMonth()] + " " + d.getFullYear(); }
  function trovaDate(f) {
    var out = [], m, d;
    RE_DATA_NUM.lastIndex = 0;
    while ((m = RE_DATA_NUM.exec(f))) {
      d = dataValida(+m[1], +m[2], +m[3]);
      if (d) out.push({ a: m.index, b: m.index + m[0].length, d: d });
    }
    RE_DATA_TESTO.lastIndex = 0;
    while ((m = RE_DATA_TESTO.exec(f))) {
      d = dataValida(+m[1], MESI[m[2].toLowerCase()], +m[3]);
      if (d) out.push({ a: m.index, b: m.index + m[0].length, d: d });
    }
    out.sort(function (x, y) { return x.a - y.a; });
    out.forEach(function (x, i) {
      var prima = senzaAccenti(f.slice(Math.max(i ? out[i - 1].b : 0, x.a - 80), x.a).toLowerCase()).replace(/\s+/g, " ");
      var dopo = senzaAccenti(f.slice(x.b, x.b + 25).toLowerCase());
      /* parole più vicine alla data: contano di più */
      var vicino = prima.slice(-45);
      if (/(entro|scadenza|scade|scadra|non oltre|termine ultimo|valid[oa] fino|ritir[a-z]* (entro|non oltre)|pagare entro|pagamento entro|versare entro)/.test(vicino)) x.tipo = "scadenza";
      else if (/(appuntamento|prenotat[oa]|presentarsi|si present|visita|esame|il giorno|giorno)/.test(vicino) || /^\s*,?\s*(alle|ore|h)\s?\d/.test(dopo)) x.tipo = "appuntamento";
      else if (/(violazione|accertat|commess|rilevat)/.test(vicino)) x.tipo = "fatto";
      else if (/(periodo|\bdal\b|\bal\b|consumi)/.test(prima.slice(-25))) x.tipo = "periodo";
      else x.tipo = "data";
    });
    return out;
  }
  function giorniDa(d, oggi) {
    var a = new Date(oggi.getFullYear(), oggi.getMonth(), oggi.getDate()).getTime();
    var b = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    return Math.round((b - a) / 86400000);
  }
  function testoGiorni(g, appuntamento) {
    if (g > 1) return "mancano " + g + " giorni";
    if (g === 1) return "manca 1 giorno: è domani!";
    if (g === 0) return "è oggi!";
    if (appuntamento) return g === -1 ? "era ieri" : "è già passato (" + (-g) + " giorni fa)";
    return g === -1 ? "già scaduta (ieri)" : "già scaduta da " + (-g) + " giorni";
  }
  var NUMERI_PAROLE = { cinque: 5, dieci: 10, quindici: 15, venti: 20, trenta: 30, quaranta: 40, sessanta: 60, novanta: 90, centoventi: 120, centottanta: 180 };
  function trovaTermini(f) {
    var out = [], visti = {}, m;
    var re = /\b(?:entro\s+(?:e non oltre\s+)?(?:il termine di\s+)?|nel termine di\s+|termine di\s+)(\d{1,3}|cinque|dieci|quindici|venti|trenta|quaranta|sessanta|novanta|centoventi|centottanta)\s*(?:\(\w+\)\s*)?(giorni|gg\.?|mesi)\b(?:(?!\bentro\b|\boppure\b)[^.;:\n]){0,80}/gi;
    while ((m = re.exec(f))) {
      var frase = m[0].replace(/\s+/g, " ").trim(), n = NUMERI_PAROLE[m[1].toLowerCase()] || +m[1];
      var p = senzaAccenti(frase.toLowerCase()), contesto = senzaAccenti(f.slice(Math.max(0, m.index - 90), m.index).toLowerCase());
      contesto = contesto.split(/[\n.;]/).pop();
      var pc = p + " " + contesto, scopo = /ricorso|opposizione|impugna|contesta/.test(pc) ? "r" : /pag|vers|saldare|ridott/.test(pc) ? "p" :
        /ritir/.test(pc) ? "t" : /ripensament|recede|recesso|disdett|annull/.test(pc) ? "c" : /present|invia|trasmett|comunic|document/.test(pc) ? "d" : "";
      var chiave = n + m[2].charAt(0) + scopo + (/notific|ricev|ricevim|consegn/.test(p) ? "n" : "");
      if (visti[chiave]) continue;
      visti[chiave] = true;
      var unita = /mes/i.test(m[2]) ? (n === 1 ? "mese" : "mesi") : (n === 1 ? "giorno" : "giorni");
      var sp = "Avete " + n + " " + unita + { r: " per fare ricorso o contestare.", p: " per pagare.", t: " per ritirarla.", d: " per rispondere o mandare quello che chiedono.", c: " per cambiare idea e annullare il contratto, senza spiegare il perché.", "": "." }[scopo];
      if (/notific|ricev|ricevim|consegn/.test(p)) sp += " Si contano dal giorno in cui la lettera vi è stata consegnata (la «notifica»): segnatevi quella data.";
      out.push({ testo: frase, n: n, spiegazione: sp, a: m.index, b: m.index + m[0].length });
    }
    return out;
  }

  /* ------------------------------------------------------------------------
   *  Codici utili
   * ---------------------------------------------------------------------- */
  function ibanValido(iban) {
    var s = iban.slice(4) + iban.slice(0, 4), r = 0;
    for (var i = 0; i < s.length; i++) {
      var c = s.charAt(i), v = /\d/.test(c) ? c : String(c.charCodeAt(0) - 55);
      for (var j = 0; j < v.length; j++) r = (r * 10 + +v.charAt(j)) % 97;
    }
    return r === 1;
  }
  var CODICI = [
    { tipo: "IBAN", re: /\b([A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]){11,30})\b/g, spieg: "Le coordinate di un conto corrente, per pagare con bonifico.",
      ok: function (v, prima) {
        var x = v.replace(/\s/g, "");
        if (x.length < 15 || x.length > 34) return false;
        if (x.slice(0, 2) === "IT" && x.length !== 27 && !/iban/i.test(prima)) return false;
        return ibanValido(x) || /iban|coordinate|bonifico|c\/c/i.test(prima);
      } },
    { tipo: "Codice avviso di pagamento", re: /(?:codice|numero|n\.)\s*(?:avviso|iuv)[^0-9\n]{0,15}((?:\d[ ]?){17}\d)/gi, gruppo: 1, spieg: "Il numero di 18 cifre per pagare con pagoPA: in banca, alla posta, dal tabaccaio o con l'app della banca." },
    { tipo: "Codice POD (luce)", re: /\b(IT\s?\d{3}\s?E\s?\d{7,8}[A-Z]?)\b/gi, gruppo: 1, spieg: "Il codice del vostro contatore della luce: non cambia mai, anche se cambiate fornitore." },
    { tipo: "Codice PDR (gas)", re: /\bPDR\b[^0-9\n]{0,15}(\d{14})\b/gi, gruppo: 1, spieg: "Il codice del vostro contatore del gas: non cambia mai, anche se cambiate fornitore." },
    { tipo: "Numero cliente", re: /(?:codice|numero|n\.|cod\.)\s*(?:cliente|utente|utenza|contratto|contribuente)\s*(?:n\.?|nr\.?)?\s*:?\s*([A-Z0-9][A-Z0-9\-\/.]{3,20})/gi, gruppo: 1, spieg: "Il vostro numero presso chi vi scrive: tenetelo a portata di mano quando telefonate o andate allo sportello." },
    { tipo: "Numero del verbale", re: /verbale\b[^0-9\n]{0,70}?(?:n\.|nr\.?|numero|n°)\s*:?\s*([A-Z0-9][A-Z0-9\-\/]{2,20})/gi, gruppo: 1, spieg: "Il numero della multa: serve per pagarla o per fare ricorso." },
    { tipo: "Targa", re: /\btarga\b[^A-Z0-9\n]{0,15}([A-Z]{2}\s?\d{3}\s?[A-Z]{2})\b/gi, gruppo: 1, spieg: "La targa del veicolo: controllate che sia proprio la vostra." },
    { tipo: "Protocollo", re: /\bprot(?:ocollo|\.)\s*(?:n\.?|nr\.?|numero|n°)?\s*:?\s*([A-Z0-9][A-Z0-9\-\/.]{2,25})/gi, gruppo: 1, spieg: "Il numero con cui l'ufficio ha registrato la lettera: citatelo se rispondete o telefonate." },
    { tipo: "Codice fiscale", re: /\b([A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z])\b/g, gruppo: 1, spieg: "Il codice fiscale: controllate che sia il vostro. È un dato personale: non datelo a chi non conosce." },
    { tipo: "Numero della raccomandata", re: /raccomandata\b[^0-9\n]{0,25}(?:n\.|nr\.?|numero|n°)\s*:?\s*(\d[\d ]{8,16}\d)/gi, gruppo: 1, spieg: "Il numero della raccomandata: serve all'ufficio postale per trovarla." },
    { tipo: "Numero della cartella", re: /cartella\b[^0-9\n]{0,30}(?:n\.|nr\.?|numero|n°)\s*:?\s*(\d[\d ]{10,24}\d)/gi, gruppo: 1, spieg: "Il numero della cartella: serve per pagare, chiedere le rate o informazioni." },
    { tipo: "Numero di pratica o prenotazione", re: /(?:pratica|prenotazione|codice prenotazione|impegnativa|ricetta|\bnre\b)\s*(?:n\.|nr\.?|numero|n°|codice)?\s*:?\s*([A-Z0-9]*\d[A-Z0-9\-\/]{2,20})/gi, gruppo: 1, spieg: "Il numero della pratica o della prenotazione: portatelo con voi e citatelo se telefonate." }
  ];
  function trovaCodici(f) {
    var out = [];
    CODICI.forEach(function (c) {
      c.re.lastIndex = 0;
      var m, giri = 0;
      while ((m = c.re.exec(f)) && giri++ < 20) {
        var v = c.gruppo ? m[c.gruppo] : m[1], a = m.index + m[0].lastIndexOf(v);
        if (!/\d/.test(v)) continue;
        var prima = f.slice(Math.max(0, a - 40), a);
        if (c.ok && !c.ok(v, prima)) continue;
        var dup = out.some(function (o) { return a < o.b && a + v.length > o.a; });
        if (dup) continue;
        var x = { tipo: c.tipo, valore: v.replace(/\s+/g, " ").trim(), spiegazione: c.spieg, a: a, b: a + v.length };
        if (c.tipo === "IBAN") {
          var pulito = v.replace(/\s/g, "");
          x.paese = pulito.slice(0, 2);
          x.valido = ibanValido(pulito);
          if (!x.valido) x.spiegazione += " Attenzione: questo IBAN non torna (forse è stato letto male, oppure è falso): ricontrollatelo sulla carta.";
          else if (x.paese !== "IT") x.spiegazione += " È un conto estero (inizia con «" + x.paese + "», non con «IT»).";
        }
        out.push(x);
      }
    });
    out.sort(function (x, y) { return x.a - y.a; });
    return out;
  }

  /* ------------------------------------------------------------------------
   *  Glossario delle parole burocratiche (si mostrano solo quelle presenti)
   * ---------------------------------------------------------------------- */
  var GLOSSARIO = [
    ["Mora", /\bmora\b|interessi (di|per) mora|moratori/, "Un ritardo nel pagare. Gli «interessi di mora» sono i soldi in più da pagare perché si paga in ritardo."],
    ["Sollecito", /sollecit/, "Un promemoria: vi ricordano che un pagamento risulta non ancora fatto. Se avete già pagato, conservate la ricevuta e fatelo presente."],
    ["Messa in mora", /messa in mora|costituzione in mora/, "Una richiesta formale di pagare entro un certo tempo. Dopo quella data possono partire interessi o altre azioni: non ignoratela."],
    ["Diffida", /\bdiffida/, "Un avvertimento formale: vi chiedono di fare (o di smettere di fare) qualcosa, altrimenti agiranno per vie legali."],
    ["Notifica", /notific/, "La consegna ufficiale di un documento. Da quel giorno di solito partono i tempi per pagare o fare ricorso."],
    ["Ricorso", /ricors/, "La richiesta, a un giudice o a un'autorità, di annullare o cambiare una decisione che ritenete sbagliata. Ha tempi precisi."],
    ["Autotutela", /autotutela/, "La richiesta, gratuita, all'ufficio che ha sbagliato di correggere da solo l'errore. Non ferma i tempi del ricorso."],
    ["Rateizzazione", /rateizz|rateazion|dilazion|pagamento (a|in) rate/, "Pagare un debito un po' alla volta, a rate. Di solito va chiesta: chiedete come fare all'ufficio che vi ha scritto."],
    ["Conguaglio", /conguagli/, "Un ricalcolo: confrontano quanto avete pagato con stime e quanto avete consumato davvero. Può essere a vostro favore o da pagare."],
    ["Acconto", /\bacconto|\bacconti\b/, "Una parte pagata in anticipo, di solito in base a una stima. Poi arriva il conguaglio."],
    ["POD", /\bpod\b/, "Il codice del contatore della luce (inizia con IT e contiene una E). Identifica il punto dove arriva la corrente."],
    ["PDR", /\bpdr\b/, "Il codice del contatore del gas, di 14 cifre. Identifica il punto dove arriva il gas."],
    ["Accise", /\baccis[ae]/, "Tasse dello Stato che si pagano sui consumi di luce, gas e carburanti. Sono in tutte le bollette."],
    ["Oneri di sistema", /oneri (generali )?di sistema/, "Costi stabiliti per legge in bolletta (per esempio per le energie rinnovabili). Li pagano tutti, con qualunque fornitore."],
    ["Canone RAI", /canone (rai|tv|televisivo|di abbonamento alla televisione)/, "La tassa per il possesso del televisore. Si paga nella bolletta della luce, a rate. Chi ha diritto all'esenzione deve chiederla."],
    ["TARI", /\btari\b|tassa (sui )?rifiuti/, "La tassa sui rifiuti, che si paga al Comune. Si calcola sui metri quadrati della casa e sul numero di persone."],
    ["F24", /\bf24\b/, "Il modulo per pagare tasse e tributi allo Stato. Si paga in banca, alla posta o con l'home banking."],
    ["pagoPA", /\bpago ?pa\b|codice avviso|\biuv\b/, "Il sistema per pagare la Pubblica Amministrazione con il codice avviso: in banca, alla posta, dal tabaccaio o con l'app della banca."],
    ["Raccomandata A/R", /raccomandata|\ba\/r\b|ricevuta di ritorno|avviso di ricevimento/, "Una lettera consegnata a mano con firma. Con «A/R» (avviso di ricevimento) chi la manda riceve la prova che l'avete avuta."],
    ["Giacenza", /giacenza|in deposito/, "La lettera non vi è stata consegnata perché non eravate in casa: è conservata all'ufficio postale per un certo numero di giorni."],
    ["Atti giudiziari", /atti giudiziari|atto giudiziario/, "Documenti di tribunali o di uffici pubblici (multe, cartelle, cause). Sono importanti: ritirateli sempre."],
    ["Decadenza", /decadenz|decad(e|ere|uto)/, "Perdere un diritto perché non lo si è usato entro il tempo previsto."],
    ["Sanzione", /sanzion/, "Una punizione, di solito una somma da pagare, per non aver rispettato una regola o una scadenza."],
    ["Interessi legali", /interessi legali|tasso legale/, "Una piccola percentuale in più, stabilita per legge, che si aggiunge ai debiti pagati in ritardo."],
    ["Domiciliazione", /domiciliazion|addebito (diretto|automatico|su conto)|\bsdd\b|\brid\b/, "Il pagamento automatico dal conto: la banca paga la bolletta da sola alla scadenza. Non dovete fare nulla."],
    ["IBAN", /\biban\b/, "Il codice di un conto corrente (in Italia 27 caratteri, inizia con IT). Serve per i bonifici."],
    ["Codice fiscale", /codice fiscale|\bc\.f\.\b/, "Il codice di 16 caratteri che identifica ogni persona per il fisco. È un dato personale."],
    ["Scadenza", /scadenz/, "L'ultimo giorno utile per fare qualcosa (pagare, rispondere, ritirare)."],
    ["Insoluto / Morosità", /insolut|morosit|moros[oa]/, "Un pagamento non fatto. «Moroso» è chi è in ritardo con i pagamenti."],
    ["Cartella di pagamento", /cartella (di pagamento|esattoriale)/, "La richiesta di pagare un debito con lo Stato o un ente (tasse, multe, contributi), mandata dall'agente della riscossione."],
    ["Intimazione", /intimazion/, "Un ultimo avvertimento a pagare, di solito entro 5 giorni, prima di azioni come il pignoramento."],
    ["Ingiunzione", /ingiunzion/, "Un ordine di pagare. Ha tempi precisi per pagare o opporsi: fatevi aiutare subito."],
    ["Fermo amministrativo", /fermo amministrativo/, "Un blocco sull'auto per debiti non pagati: non si può usare né vendere finché non si paga."],
    ["Pignoramento", /pignorament/, "Quando, per un debito, vengono presi soldi dal conto, dallo stipendio, dalla pensione o dei beni."],
    ["IVA", /\biva\b/, "L'imposta sul valore aggiunto: una tassa compresa nel prezzo di quasi tutto quello che si compra."],
    ["Quota fissa", /quota fissa/, "La parte della bolletta che si paga sempre, anche se non si consuma nulla."],
    ["Quota energia / quota variabile", /quota (energia|variabile|consumi)|materia (energia|gas|prima)|spesa per la materia/, "La parte della bolletta che dipende da quanto avete consumato."],
    ["Potenza impegnata", /potenza (impegnata|disponibile|contrattuale)/, "Quanta corrente potete usare insieme prima che salti il contatore (per le case di solito 3 kW)."],
    ["Lettura stimata o effettiva", /lettura (stimata|effettiva|rilevata|presunta)|consumi (stimati|effettivi|presunti)|autolettura/, "Stimata: il consumo è calcolato a occhio. Effettiva: letta sul contatore. Con l'autolettura la comunicate voi."],
    ["kWh e Smc", /\bkwh\b|\bsmc\b/, "Le unità con cui si misurano i consumi: kWh (chilowattora) per la luce, Smc (metri cubi) per il gas."],
    ["Deposito cauzionale", /deposito cauzionale|cauzione/, "Una somma che il fornitore trattiene come garanzia e restituisce quando chiudete il contratto."],
    ["Bonus sociale", /bonus sociale|bonus (luce|gas|acqua|bollette)/, "Uno sconto sulle bollette per le famiglie con ISEE basso. Spesso arriva in automatico se avete presentato l'ISEE."],
    ["Verbale", /\bverbale\b/, "Il documento scritto in cui un agente descrive un fatto, per esempio una multa."],
    ["Decurtazione dei punti", /decurtazion|punti (della|dalla|sulla) patente/, "Alcune multe tolgono anche dei punti dalla patente."],
    ["Giudice di pace", /giudice di pace/, "Un giudice a cui si può fare ricorso, per esempio contro una multa (di solito entro 30 giorni dalla notifica)."],
    ["Prefetto", /prefett/, "Il rappresentante dello Stato nella provincia: a lui si può fare ricorso contro una multa (di solito entro 60 giorni)."],
    ["Protocollo", /protocoll|\bprot\./, "Il numero con cui un ufficio registra una lettera: va citato se rispondete."],
    ["ISEE", /\bisee\b/, "Un numero che misura la situazione economica della famiglia. Serve per bonus, sconti e aiuti. Si fa gratis al CAF."],
    ["Cedolino", /cedolin/, "Il foglio che spiega, mese per mese, quanto vi viene pagato (pensione o stipendio) e le trattenute."],
    ["Indebito", /\bindebit/, "Soldi ricevuti senza averne diritto (spesso per un errore) che l'ente chiede di restituire. Si può verificare con il patronato."],
    ["RED (dichiarazione reddituale)", /\bred\b|dichiarazione reddituale/, "La comunicazione dei redditi che l'INPS chiede ad alcuni pensionati. Si fa gratis al CAF o al patronato."],
    ["Ticket", /\bticket\b/, "La parte che si paga per visite ed esami del servizio sanitario. Alcune persone ne sono esenti."],
    ["Impegnativa", /impegnativ|ricetta (medica|elettronica|dematerializzata)|\bnre\b/, "La richiesta del medico per fare una visita o un esame (detta anche ricetta)."],
    ["CUP", /\bcup\b/, "Il Centro Unico di Prenotazione: l'ufficio (o il numero) per prenotare visite ed esami."],
    ["Esenzione", /\besenzion|\besent[ei]\b/, "Il diritto a non pagare (per esempio il ticket o il canone), per età, reddito o malattia. Di solito va chiesto."],
    ["Recesso", /\brecess/, "Chiudere un contratto. La legge e il contratto dicono come e con quanto preavviso."],
    ["Diritto di ripensamento", /ripensament/, "Per i contratti fatti a distanza o fuori dai negozi potete annullare tutto, di solito entro 14 giorni, senza spiegare il perché."],
    ["PEC", /\bpec\b|posta elettronica certificata/, "La posta elettronica certificata: un'email che ha lo stesso valore di una raccomandata."],
    ["Delega", /\bdelega/, "Un foglio firmato con cui autorizzate un'altra persona a fare qualcosa al posto vostro (per esempio ritirare una raccomandata)."],
    ["Rimborso", /\brimbors/, "Soldi che vi vengono restituiti. Attenzione: chi vi chiede di pagare qualcosa per ricevere un rimborso è un truffatore."]
  ];
  function trovaGlossario(p) {
    return GLOSSARIO.filter(function (g) { return g[1].test(p); }).map(function (g) { return { parola: g[0], spiegazione: g[2] }; });
  }

  /* ------------------------------------------------------------------------
   *  Cosa fare (prudente: mai consigli legali o fiscali definitivi)
   * ---------------------------------------------------------------------- */
  var AIUTO = "Se non siete sicuri, chiedete al CAF, al patronato, all'ufficio del Comune o a una persona di fiducia: portate la lettera con voi.";
  var PAGARE_BENE = "Pagate solo con i modi scritti sulla lettera vera (codice avviso pagoPA, bollettino, F24, domiciliazione), in banca, alla posta, dal tabaccaio o con l'app della vostra banca. Mai con ricariche, buoni regalo o a persone che vi telefonano.";
  var COSA_FARE = {
    bolletta: ["Controllate che il nome e l'indirizzo siano i vostri e che il periodo sia giusto.",
      "Guardate il «totale da pagare» e la scadenza. Se avete la domiciliazione (pagamento automatico dalla banca) non dovete fare nulla.",
      "Confrontate con le bollette precedenti: se la cifra è molto più alta, guardate se c'è un conguaglio o una lettura stimata.",
      PAGARE_BENE,
      "Se qualcosa non torna, chiamate il servizio clienti al numero scritto sulla bolletta o sul contratto (non quello di un messaggio) o andate allo sportello.",
      "Conservate la bolletta e la ricevuta del pagamento."],
    avviso: ["Controllate che nome, indirizzo e dati della casa o dell'auto siano giusti.",
      "Segnatevi la scadenza: spesso si può pagare in un'unica soluzione o a rate, ognuna con la sua data.",
      PAGARE_BENE,
      "Se pensate che ci sia un errore (per esempio i metri quadrati o il numero di persone), andate all'ufficio tributi del Comune o all'ufficio indicato: si può chiedere la correzione.",
      "Conservate l'avviso e la ricevuta per almeno 5 anni."],
    multa: ["Controllate targa, data, ora e luogo: devono essere quelli del vostro veicolo.",
      "Segnatevi il giorno in cui avete ricevuto la multa: da lì partono i tempi.",
      "Se pagate presto (di solito entro 5 giorni dalla notifica) spesso c'è uno sconto: leggete bene la lettera.",
      "Se pensate che sia sbagliata, si può fare ricorso: di solito al Giudice di pace entro 30 giorni o al Prefetto entro 60 giorni. Fatevi aiutare.",
      PAGARE_BENE,
      "Se la multa toglie punti, potrebbe essere chiesto chi guidava: rispondete entro i tempi scritti."],
    cartella: ["Non ignoratela: le cartelle hanno tempi precisi e, se non si paga, possono crescere interessi e arrivare blocchi.",
      "Controllate a che cosa si riferisce (tassa, multa, contributo) e di che anno è.",
      "Se il debito vi sembra già pagato, molto vecchio o non vostro, si può chiedere una verifica o la sospensione: fatevi aiutare dal CAF o da un professionista.",
      "Se non riuscite a pagare tutto insieme, chiedete se si può pagare a rate.",
      PAGARE_BENE,
      "Diffidate di chi vi telefona chiedendo di pagare la cartella con un bonifico a un conto diverso da quello scritto sulla lettera."],
    inps: ["Leggete con calma che cosa vi chiedono: un documento, una dichiarazione, una restituzione di soldi o è solo un'informazione?",
      "Se c'è una data entro cui rispondere, segnatevela.",
      "Il patronato e il CAF aiutano gratis con le pratiche INPS: portate la lettera e un documento d'identità.",
      "L'INPS non chiede mai di pagare con ricariche, né codici o dati della carta per telefono, SMS o email.",
      "Conservate la lettera con le altre carte della pensione."],
    raccomandata: ["Andate a ritirarla presto: la lettera resta all'ufficio indicato solo per un certo numero di giorni.",
      "Portate l'avviso e un documento d'identità. Se non potete andare voi, una persona di fiducia può ritirarla con una delega firmata e i documenti.",
      "Non sapere cosa c'è dentro non vi protegge: anche se non la ritirate, dopo un po' di tempo la lettera si considera ricevuta.",
      "Attenzione ai finti avvisi: un avviso vero è su carta nella cassetta delle lettere. Se arriva per SMS o email con un link o un pagamento da fare, è una truffa."],
    sollecito: ["Controllate se avete già pagato: cercate la ricevuta o guardate l'estratto conto.",
      "Se avete già pagato, contattate chi vi scrive (con i recapiti della bolletta o del contratto) e mandate la ricevuta.",
      "Se non avete pagato, fatelo entro la data indicata per evitare interessi o la sospensione del servizio. Se è difficile, chiedete di pagare a rate.",
      PAGARE_BENE,
      "Attenzione: i truffatori mandano finti solleciti. Verificate sempre con il numero scritto sul contratto o sulla bolletta, mai con quello del messaggio."],
    sanitario: ["Segnatevi data, ora e indirizzo dell'appuntamento.",
      "Leggete se servono preparazioni (per esempio essere a digiuno) e cosa portare: impegnativa, tessera sanitaria, esami precedenti.",
      "Se non potete andare, disdite per tempo: si libera il posto per altri e a volte si evita di pagare lo stesso.",
      "Il referto spiegatelo sempre con il vostro medico: il Professore non può dare spiegazioni mediche."],
    contratto: ["Non firmate subito: prendetevi il tempo di leggere e di far leggere a una persona di fiducia.",
      "Guardate quanto si paga davvero ogni mese, per quanto tempo, e cosa succede dopo la promozione.",
      "Controllate come si può disdire (recesso) e se ci sono costi per uscire.",
      "Per i contratti fatti al telefono o fuori dai negozi c'è il diritto di ripensamento (di solito 14 giorni).",
      "Non date dati, codici o firme a chi si presenta alla porta o al telefono senza che l'abbiate cercato voi."],
    banca: ["Controllate che la lettera sia della vostra banca e che i dati (nome, conto) siano giusti.",
      "Se parla di cambi delle condizioni, di costi o di movimenti che non riconoscete, andate in filiale o chiamate il numero scritto sul retro della carta.",
      "La banca non chiede mai codici, PIN o password per lettera, telefono, SMS o email.",
      "Conservate gli estratti conto e le comunicazioni importanti."],
    generico: ["Leggete con calma: chi vi scrive? Che cosa vi chiede? Entro quando?",
      "Se c'è una scadenza, segnatevela sul calendario.",
      "Se vi chiede soldi o dati, verificate prima con i contatti ufficiali (non quelli scritti in un messaggio sospetto)."]
  };
  function cosaFare(tipo, risultato) {
    var g = TIPI[tipo] && TIPI[tipo].gruppo ? TIPI[tipo].gruppo : tipo;
    var p = (COSA_FARE[g] || COSA_FARE.generico).slice();
    if (risultato.truffa && risultato.truffa.livello !== "basso")
      p.unshift("Prima di tutto: questa lettera ha dei segnali sospetti (vedete il riquadro rosso). Non pagate e non chiamate i numeri scritti qui finché non avete verificato.");
    p.push(AIUTO);
    return p;
  }

  /* ------------------------------------------------------------------------
   *  Controllo anti-truffa: usa PD.truffa.analizza (se c'è) e aggiunge i segnali tipici delle lettere false
   * ---------------------------------------------------------------------- */
  /* segnali di truffa.js che hanno senso anche in una lettera vera (gli altri, come «chiede un pagamento»
   * o «parla di giacenza», sono normali in bollette e avvisi) */
  var TIENI = { codici: 1, remoto: 1, contanti: 1, parente: 1, nuovonumero: 1, garantito: 1, investimento: 1, segreto: 1, pagamentonum: 1,
    linksospetto: 1, mittente: 1, clicca: 1, "ciao-mamma": 1, "amore-soldi": 1 };
  var RE_PAGA_STRANO = /buon[oi] regalo|gift ?card|ricarica (postepay|paysafe|prepagata|la carta)|paysafe ?card|\bricarica\b[^.\n]{0,30}(carta|prepagata)|western union|money ?gram|bitcoin|criptovalut|\busdt\b/i;
  var RE_FRETTA = /entro (le )?(prossime )?(24|48|72) ore|immediatamente|entro (oggi|stasera|domani)|pena la sospensione immediata/i;
  function controlloTruffa(testo, codici) {
    var base = PD.truffa && PD.truffa.analizza ? PD.truffa.analizza(testo, "Lettera") : null;
    var segnali = [], punti = 0, grave = false;
    if (base) base.segnali.forEach(function (s) {
      if (!TIENI[s.id]) return;
      segnali.push({ id: s.id, titolo: s.titolo, spiegazione: s.spiegazione, trovato: s.trovato, peso: s.peso });
      punti += s.peso; if (s.id === "remoto" || s.id === "contanti") grave = true;
    });
    var m = RE_PAGA_STRANO.exec(testo);
    if (m) { segnali.push({ id: "pagastrano", peso: 5, titolo: "Chiede di pagare con ricariche, buoni regalo o criptovalute",
      spiegazione: "Nessun Comune, fornitore, ente o banca chiede di pagare così. È il segno tipico delle lettere e dei messaggi falsi.", trovato: m[0] }); punti += 5; grave = true; }
    codici.forEach(function (c) {
      if (c.tipo === "IBAN" && c.paese !== "IT") {
        segnali.push({ id: "ibanestero", peso: 3, titolo: "Fa pagare su un conto estero", trovato: c.valore,
          spiegazione: "L'IBAN inizia con «" + c.paese + "»: è un conto all'estero. Comuni, enti e fornitori italiani usano conti italiani (IT) o il codice avviso pagoPA." });
        punti += 3;
      }
    });
    m = RE_FRETTA.exec(testo);
    if (m && segnali.length) { segnali.push({ id: "fretta", peso: 2, titolo: "Mette molta fretta", trovato: m[0],
      spiegazione: "Le lettere vere danno giorni o settimane di tempo. «Entro 24 ore» o «immediatamente» serve a non farvi ragionare." }); punti += 2; }
    segnali.sort(function (a, b) { return b.peso - a.peso; });
    var livello = grave || punti >= 6 ? "alto" : punti >= 3 ? "medio" : "basso";
    return { livello: livello, segnali: segnali, motore: !!base };
  }

  /* ------------------------------------------------------------------------
   *  Analisi completa
   * ---------------------------------------------------------------------- */
  function analizza(testo, oggi) {
    testo = String(testo || "");
    oggi = oggi instanceof Date ? oggi : new Date();
    var f = sistemaCifre(testo), p = perParole(testo);
    var tipo = riconosciTipo(p), def = TIPI[tipo.id] || GENERICO;
    var date = trovaDate(f), codici = trovaCodici(f), termini = trovaTermini(f);
    var occupati = date.map(function (d) { return [d.a, d.b]; }).concat(codici.map(function (c) { return [c.a, c.b]; }));
    var importi = trovaImporti(f, occupati), totale = sceltaTotale(importi, tipo.id);
    var scadenze = [], visti = {};
    date.forEach(function (d) {
      if (d.tipo === "appuntamento" && (tipo.id === "multa" || tipo.id === "cartella")) d.tipo = "fatto";
      if (d.tipo !== "scadenza" && d.tipo !== "appuntamento") return;
      var k = iso(d.d) + d.tipo;
      if (visti[k]) return;
      visti[k] = true;
      var g = giorniDa(d.d, oggi), app = d.tipo === "appuntamento";
      scadenze.push({ data: iso(d.d), dataIt: dataIt(d.d), giorni: g, tipo: d.tipo, scaduta: g < 0,
        testo: (app ? "Appuntamento: " : "Scadenza: ") + dataLunga(d.d) + " — " + testoGiorni(g, app) });
    });
    scadenze.sort(function (a, b) { return a.data < b.data ? -1 : a.data > b.data ? 1 : 0; });
    var r = {
      tipo: tipo.id, titoloTipo: def.t, icona: def.ico, mittente: trovaMittente(testo),
      importi: importi.map(function (x) { return { valore: x.valore, testo: x.testo, etichetta: x.etichetta, totale: !!x.totale }; }),
      totale: totale ? { valore: totale.valore, testo: formatoEuro(totale.valore), etichetta: totale.etichetta } : null,
      scadenze: scadenze,
      date: date.map(function (d) { return { data: iso(d.d), tipo: d.tipo }; }),
      termini: termini.map(function (t) { return { testo: t.testo, giorni: t.n, spiegazione: t.spiegazione }; }),
      codici: codici.map(function (c) { return { tipo: c.tipo, valore: c.valore, spiegazione: c.spiegazione }; }),
      glossario: trovaGlossario(p)
    };
    r.truffa = controlloTruffa(testo, codici);
    r.cosaFare = cosaFare(tipo.id, r);
    /* parti da evidenziare nel testo originale */
    var iv = [];
    importi.forEach(function (x) { iv.push([x.a, x.b, x.totale ? "totale" : "soldi"]); });
    date.forEach(function (d) { iv.push([d.a, d.b, d.tipo === "scadenza" || d.tipo === "appuntamento" ? "scadenza" : "data"]); });
    codici.forEach(function (c) { iv.push([c.a, c.b, "codice"]); });
    /* i «tempi» non devono coprire cifre, date o codici: si accorciano prima del primo che contengono */
    termini.forEach(function (t) {
      var fine = t.b;
      iv.forEach(function (x) { if (x[0] > t.a && x[0] < fine) fine = x[0]; });
      if (fine - t.a > 3) iv.push([t.a, fine, "termine"]);
    });
    iv.sort(function (a, b) { return a[0] - b[0] || b[1] - a[1]; });
    var fuori = [];
    iv.forEach(function (x) { var u = fuori[fuori.length - 1]; if (!u || x[0] >= u[1]) fuori.push(x); });
    Object.defineProperty(r, "_intervalli", { value: fuori, enumerable: false });
    return r;
  }
  function evidenzia(testo, iv) {
    var h = "", i = 0;
    (iv || []).forEach(function (r) {
      h += esc(testo.slice(i, r[0])) + '<mark class="lt-m lt-m-' + r[2] + '">' + esc(testo.slice(r[0], r[1])) + "</mark>"; i = r[1];
    });
    return (h + esc(testo.slice(i))).replace(/\n/g, "<br>");
  }

  /* ------------------------------------------------------------------------
   *  Esempi pronti (tutto di fantasia: nomi, codici, indirizzi)
   * ---------------------------------------------------------------------- */
  var ESEMPI = [
    { t: "💡 Bolletta della luce", x: "Energia del Borgo S.p.A.\nBolletta della luce - Fornitura di energia elettrica\nGentile Maria Esempio, Via dei Tigli 4, 00000 Borgoprova\nCodice cliente: 000123456   Codice POD: IT001E00000000\nPeriodo di fatturazione: dal 01/08/2026 al 30/09/2026\nConsumi: 420 kWh (lettura stimata)\nSpesa per la materia energia: 61,20 €\nOneri di sistema: 9,15 €  Accise e IVA: 14,05 €  Canone RAI: 18,00 €\nTotale da pagare: 112,35 €\nScadenza: entro il 16/11/2026\nPotete pagare con il codice avviso pagoPA in banca, alla posta o dal tabaccaio. Se avete la domiciliazione bancaria l'importo sarà addebitato automaticamente." },
    { t: "🚓 Multa", x: "COMUNE DI BORGOPROVA - Polizia Locale\nVerbale di accertamento di violazione al Codice della Strada n. 2026/0457\nIl giorno 12/09/2026 alle ore 10:40 in Via Roma, il veicolo con targa ZZ 000 ZZ sostava in divieto di sosta (art. 158 C.d.S.).\nImporto ridotto del 30% se pagato entro 5 giorni dalla notifica: 29,40 €\nTotale da pagare entro 60 giorni dalla notifica: 42,00 €\nContro il presente verbale è ammesso ricorso al Prefetto entro 60 giorni dalla notifica oppure al Giudice di pace entro 30 giorni.\nNon è prevista la decurtazione di punti dalla patente." },
    { t: "🏛️ TARI del Comune", x: "Comune di Borgoprova - Ufficio Tributi\nAvviso di pagamento TARI 2026 (tassa sui rifiuti)\nContribuente: Giovanni Prova - Codice fiscale PRVGNN50A01Z000X\nSuperficie: 85 mq - Componenti del nucleo: 2\nTotale dovuto: 236,00 €\nPagamento in unica soluzione: 236,00 € entro il 16/12/2026\nOppure in due rate: prima rata 118,00 € entro il 16/12/2026; seconda rata 118,00 € entro il 16/02/2027\nCodice avviso: 0000 0000 0000 0000 01\nIn caso di mancato pagamento sarà applicata la sanzione del 30% oltre agli interessi legali.\nPer informazioni o correzioni rivolgersi all'Ufficio Tributi." },
    { t: "👵 Lettera INPS", x: "INPS - Istituto Nazionale della Previdenza Sociale - Sede di Borgoprova\nProt. n. INPS.0000.2026.000123\nOggetto: richiesta della dichiarazione reddituale (RED) per la pensione\nGentile signora Anna Esempio,\nper continuare a ricevere correttamente le prestazioni collegate al reddito (importo lordo mensile della pensione 845,20 €) è necessario trasmettere la dichiarazione reddituale RED entro il 30/11/2026.\nPotete rivolgervi gratuitamente a un CAF o a un patronato.\nIn mancanza della dichiarazione, la prestazione potrà essere sospesa e potrà essere richiesta la restituzione delle somme come indebito." },
    { t: "📮 Avviso di giacenza", x: "AVVISO DI GIACENZA - Ufficio postale di Borgoprova Centro\nIn vostra assenza non è stato possibile consegnare la raccomandata n. 000000000000 (atti giudiziari).\nMittente: Comune di Borgoprova\nPotete ritirarla presso l'ufficio postale di Via Garibaldi 1, dal lunedì al venerdì, 8:20 - 13:35.\nLa raccomandata resterà in giacenza e potrete ritirarla entro il 23/10/2026.\nPortate questo avviso e un documento d'identità. Per il ritiro da parte di un'altra persona serve una delega firmata." },
    { t: "⚠️ Falsa bolletta (truffa)", x: "Energia del Borgo S.p.A. - AVVISO DI SOSPENSIONE\nGentile cliente, la sua bolletta della luce risulta non pagata.\nTotale da pagare: 129,90 €\nLa fornitura di energia elettrica sarà sospesa entro 24 ore.\nPaghi subito con bonifico all'IBAN LT00 0000 0000 0000 0000 intestato a M. Rossi oppure con buono regalo o ricarica della carta prepagata.\nPer evitare la sospensione clicchi qui: http://energia-borgo-pagamenti.top/paga" }
  ];

  /* ------------------------------------------------------------------------
   *  OCR: tesseract.js servito in locale da vendor/ocr/, caricato solo quando serve
   * ---------------------------------------------------------------------- */
  var OCR = { stato: "spento", worker: null, promessa: null, simd: null };
  function baseOcr() { return location.href.replace(/[#?].*$/, "").replace(/[^\/]*$/, "") + "vendor/ocr/"; }
  function ocrPossibile() {
    return !!(PD.server && /^https?:$/.test(location.protocol) && typeof WebAssembly === "object" && typeof Worker === "function" &&
      window.Promise && window.URL && document.createElement("canvas").getContext);
  }
  function haSimd() {
    if (OCR.simd !== null) return OCR.simd;
    try {
      OCR.simd = WebAssembly.validate(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11]));
    } catch (e) { OCR.simd = false; }
    return OCR.simd;
  }
  function caricaScript(src) {
    return new Promise(function (ok, ko) {
      if (window.Tesseract) return ok();
      var s = document.createElement("script");
      s.src = src; s.async = true;
      s.onload = function () { if (window.Tesseract) ok(); else ko(new Error("motore di lettura non disponibile")); };
      s.onerror = function () { ko(new Error("motore di lettura non trovato")); };
      document.head.appendChild(s);
    });
  }
  /* avviso: funzione chiamata con (fase, frazione 0..1) */
  OCR.avviso = null;
  function logger(m) {
    if (!OCR.avviso || !m) return;
    var fasi = { "loading tesseract core": ["carico", 0, 0.12], "initializing tesseract": ["preparo", 0.12, 0.15], "loading language traineddata": ["lingua", 0.15, 0.2],
      "initializing api": ["preparo", 0.2, 0.22], "recognizing text": ["leggo", 0.22, 1] };
    var f = fasi[m.status];
    if (f) OCR.avviso(f[0], f[1] + (f[2] - f[1]) * (m.progress || 0));
  }
  function creaWorker(simd) {
    var b = baseOcr();
    return window.Tesseract.createWorker("ita", 1, {
      workerPath: b + "worker.min.js",
      corePath: b + (simd ? "tesseract-core-simd-lstm.wasm.js" : "tesseract-core-lstm.wasm.js"),
      langPath: b + "lang", workerBlobURL: false, cacheMethod: "none", gzip: true, logger: logger,
      errorHandler: function () { /* gestito dalle promesse */ }
    });
  }
  function preparaOcr() {
    if (OCR.worker) return Promise.resolve(OCR.worker);
    if (OCR.promessa) return OCR.promessa;
    OCR.stato = "carico";
    OCR.promessa = caricaScript(baseOcr() + "tesseract.min.js").then(function () {
      var simd = haSimd();
      return creaWorker(simd).catch(function (e) {
        if (!simd) throw e;
        OCR.simd = false;
        return creaWorker(false);      /* il motore veloce (SIMD) non parte: riprovo con quello semplice */
      });
    }).then(function (w) {
      return w.setParameters({ user_defined_dpi: "300", preserve_interword_spaces: "1" }).then(function () { return w; }, function () { return w; });
    }).then(function (w) {
      OCR.worker = w; OCR.stato = "pronto"; OCR.promessa = null; return w;
    }, function (e) {
      OCR.stato = "errore"; OCR.promessa = null; throw e;
    });
    return OCR.promessa;
  }
  function chiudiOcr() {
    var w = OCR.worker;
    OCR.worker = null; OCR.promessa = null; OCR.stato = "spento";
    if (w) { try { w.terminate(); } catch (e) { /* ignora */ } }
  }

  /* ------------------------------------------------------------------------
   *  Immagine: carica, ridimensiona (~2000 px), ruota, scala di grigi, contrasto
   * ---------------------------------------------------------------------- */
  var MAX_LATO = 2000;
  function preparaImmagine(sorgente, larg, alt, rot) {
    var sc = Math.min(MAX_LATO / Math.max(larg, alt), 2);
    var w = Math.max(1, Math.round(larg * sc)), h = Math.max(1, Math.round(alt * sc));
    var giro = rot % 180 !== 0, c = document.createElement("canvas");
    c.width = giro ? h : w; c.height = giro ? w : h;
    var x = c.getContext("2d");
    x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height);
    x.save();
    x.translate(c.width / 2, c.height / 2);
    x.rotate(rot * Math.PI / 180);
    x.drawImage(sorgente, -w / 2, -h / 2, w, h);
    x.restore();
    /* scala di grigi e contrasto: allunga i livelli tra il 2% più scuro e il 2% più chiaro */
    try {
      var img = x.getImageData(0, 0, c.width, c.height), d = img.data, n = d.length / 4, ist = [], i, v;
      for (i = 0; i < 256; i++) ist.push(0);
      var grigi = new Uint8Array(n);
      for (i = 0; i < n; i++) {
        v = (d[i * 4] * 299 + d[i * 4 + 1] * 587 + d[i * 4 + 2] * 114) / 1000 | 0;
        grigi[i] = v; ist[v]++;
      }
      var basso = 0, alto = 255, acc = 0;
      for (i = 0; i < 256; i++) { acc += ist[i]; if (acc > n * 0.02) { basso = i; break; } }
      acc = 0;
      for (i = 255; i >= 0; i--) { acc += ist[i]; if (acc > n * 0.02) { alto = i; break; } }
      if (alto - basso < 40) { basso = Math.max(0, basso - 20); alto = Math.min(255, alto + 20); }
      var k = 255 / Math.max(1, alto - basso);
      for (i = 0; i < n; i++) {
        v = (grigi[i] - basso) * k;
        v = v < 0 ? 0 : v > 255 ? 255 : v;
        d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v; d[i * 4 + 3] = 255;
      }
      x.putImageData(img, 0, 0);
    } catch (e) { /* immagine non leggibile pixel per pixel: va bene così */ }
    return c;
  }

  /* ------------------------------------------------------------------------
   *  Conteggi anonimi (mai il testo)
   * ---------------------------------------------------------------------- */
  function conta(tipo) {
    var l = PD.progress.lettera;
    if (!l || typeof l !== "object") l = PD.progress.lettera = { volte: 0, tipi: {} };
    if (typeof l.volte !== "number") l.volte = 0;
    if (!l.tipi || typeof l.tipi !== "object") l.tipi = {};
    l.volte++;
    l.tipi[tipo] = (l.tipi[tipo] || 0) + 1;
    PD.saveProgress();
  }

  /* ------------------------------------------------------------------------
   *  Pagina
   * ---------------------------------------------------------------------- */
  var stato = { testo: "", r: null, img: null, rot: 0, canvas: null, stream: null, ctrl: null, lettura: 0, modo: "" };
  var vista = null;

  function fermaWebcam() {
    if (stato.stream) {
      try { stato.stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) { /* ignora */ }
      stato.stream = null;
    }
    if (vista) { var v = $("#lt-video", vista); if (v) { v.srcObject = null; } var b = $("#lt-cam-box", vista); if (b) b.hidden = true; }
  }
  function fermaIA() { if (stato.ctrl) { try { stato.ctrl.abort(); } catch (e) { /* ignora */ } stato.ctrl = null; } }
  function annullaLettura() { stato.lettura++; chiudiOcr(); }

  function htmlSpiegazione(r, perStampa) {
    var h = '<div class="lt-tipo"><span class="lt-tipo-ico" aria-hidden="true">' + r.icona + '</span><div><div class="small muted">Mi sembra…</div><h2>' + esc(r.titoloTipo) + "</h2>" +
      (r.mittente ? '<div class="lt-mitt">Da: <b>' + esc(r.mittente) + "</b></div>" : '<div class="lt-mitt small muted">Non ho capito bene chi la manda: guardate l\'intestazione in alto.</div>') + "</div></div>";
    if (r.truffa.livello !== "basso") {
      h += '<div class="lt-truffa lt-truffa-' + r.truffa.livello + '" role="alert"><b>' + (r.truffa.livello === "alto" ? "🔴 Attenzione: potrebbe essere una lettera FALSA" : "🟠 Attenzione: ci sono segnali sospetti") + "</b>" +
        "<ul>" + r.truffa.segnali.map(function (s) { return "<li><b>" + esc(s.titolo) + ".</b> " + esc(s.spiegazione) + (s.trovato ? ' <span class="lt-trovato">«' + esc(s.trovato) + "»</span>" : "") + "</li>"; }).join("") + "</ul>" +
        '<div class="small">Non pagate e non chiamate i numeri scritti qui. Verificate con i contatti che conoscete già (bolletta vecchia, contratto, sito digitato a mano) o andate di persona allo sportello.</div></div>';
    }
    /* riquadri principali: soldi e date */
    h += '<div class="lt-chiave">';
    if (r.totale) h += '<div class="lt-box lt-box-soldi"><div class="small">💶 Da pagare</div><div class="lt-grande">' + esc(r.totale.testo) + "</div>" + (r.totale.etichetta ? '<div class="small muted">«' + esc(r.totale.etichetta) + "»</div>" : "") + "</div>";
    else h += '<div class="lt-box lt-box-soldi lt-vuoto"><div class="small">💶 Da pagare</div><div>' + (r.importi.length ? "Non ho trovato un «totale da pagare»: guardate le cifre qui sotto." : "Non ho trovato somme da pagare.") + "</div></div>";
    var prossima = r.scadenze.filter(function (s) { return !s.scaduta; })[0] || r.scadenze[r.scadenze.length - 1];
    if (prossima) h += '<div class="lt-box lt-box-data' + (prossima.scaduta ? " lt-scaduta" : prossima.giorni <= 7 ? " lt-vicina" : "") + '"><div class="small">📅 ' + (prossima.tipo === "appuntamento" ? "Appuntamento" : "Scadenza") + '</div><div class="lt-grande">' + esc(prossima.dataIt) + '</div><div class="lt-giorni">' + esc(prossima.testo.split(" — ")[1]) + "</div></div>";
    else if (r.termini.length) h += '<div class="lt-box lt-box-data"><div class="small">📅 Tempo a disposizione</div><div class="lt-grande">' + r.termini[0].giorni + ' giorni</div><div class="small muted">' + esc(r.termini[0].testo) + "</div></div>";
    else h += '<div class="lt-box lt-box-data lt-vuoto"><div class="small">📅 Scadenza</div><div>Non ho trovato una data di scadenza.</div></div>';
    h += "</div>";
    if (r.scadenze.length > 1) h += "<h3>📅 Tutte le date importanti</h3><ul class=\"lt-lista\">" + r.scadenze.map(function (s) { return '<li class="' + (s.scaduta ? "lt-scaduta" : "") + '">' + esc(s.testo) + "</li>"; }).join("") + "</ul>";
    if (r.termini.length) h += "<h3>⏳ Tempi da rispettare</h3><ul class=\"lt-lista\">" + r.termini.map(function (t) { return "<li><b>«" + esc(t.testo) + "»</b><div class=\"small\">" + esc(t.spiegazione) + "</div></li>"; }).join("") + "</ul>";
    if (r.importi.length > 1 || (r.importi.length === 1 && !r.totale)) h += "<h3>💶 Le cifre nella lettera</h3><ul class=\"lt-lista lt-importi\">" + r.importi.map(function (x) {
      return '<li class="' + (x.totale ? "lt-tot" : "") + '"><span class="lt-cifra">' + esc(formatoEuro(x.valore)) + "</span> <span class=\"small muted\">" + esc(x.etichetta || "") + "</span>" + (x.totale ? ' <b class="lt-tag">totale</b>' : "") + "</li>";
    }).join("") + "</ul>";
    if (r.codici.length) h += "<h3>🔢 Codici utili</h3><ul class=\"lt-lista lt-codici\">" + r.codici.map(function (c) {
      return '<li><span class="lt-cod-tipo">' + esc(c.tipo) + '</span> <code class="lt-cod">' + esc(c.valore) + '</code><div class="small">' + esc(c.spiegazione) + "</div></li>";
    }).join("") + "</ul>";
    h += "<h3>✅ Cosa fare, passo passo</h3><ol class=\"lt-passi\">" + r.cosaFare.map(function (p) { return "<li>" + esc(p) + "</li>"; }).join("") + "</ol>";
    if (r.glossario.length) h += "<h3>📖 Le parole difficili, spiegate</h3><dl class=\"lt-glossario\">" + r.glossario.map(function (g) { return "<dt>" + esc(g.parola) + "</dt><dd>" + esc(g.spiegazione) + "</dd>"; }).join("") + "</dl>";
    h += '<p class="small muted lt-avvertenza">Il Professore legge la lettera con regole semplici e può sbagliare: controllate sempre cifre e date sulla lettera vera. ' +
      "Non è un consiglio legale o fiscale." + (perStampa ? "" : " " + esc(AIUTO)) + "</p>";
    return h;
  }
  function testoParlato(r) {
    var t = "Mi sembra: " + r.titoloTipo + ".";
    if (r.mittente) t += " La manda: " + r.mittente + ".";
    if (r.truffa.livello !== "basso") t += "\nAttenzione! Ci sono segnali sospetti: potrebbe essere una lettera falsa. " + r.truffa.segnali.map(function (s) { return s.titolo; }).join(". ") + ".";
    if (r.totale) t += "\nDa pagare: " + r.totale.testo.replace(" €", " euro") + ".";
    r.scadenze.forEach(function (s) { t += "\n" + s.testo.replace(" — ", ": ") + "."; });
    r.termini.forEach(function (x) { t += "\n" + x.spiegazione; });
    t += "\nCosa fare. " + r.cosaFare.join("\n");
    return t;
  }
  function stampa() {
    var r = stato.r; if (!r) return;
    var html = '<header class="p-testa"><div><b>Professore Digitale</b> · Spiegami questa lettera</div><div>' + new Date().toLocaleDateString("it-IT") + "</div></header>" +
      "<h1>✉️ La spiegazione della lettera</h1>" + htmlSpiegazione(r, true) +
      '<footer class="p-piede">Stampato dal Professore Digitale · software libero ideato da Danilo D\'Auria · funziona senza Internet. ' +
      "La lettura automatica può sbagliare: controllate sempre la lettera vera. " + esc(AIUTO) + "</footer>";
    PD.printHTML('<div class="lt-stampa">' + html + "</div>", "verticale");
  }

  function htmlPagina() {
    var ocr = ocrPossibile(), cam = ocr && navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === "function";
    var perche = !PD.server ? "Nella versione portatile (quella che si apre senza installare niente) il Professore non può leggere le foto: scrivete o incollate qui sotto il testo della lettera. Con il Professore installato sul computer potete anche fotografarla."
      : "Questo browser è troppo vecchio per leggere le foto: scrivete o incollate qui sotto il testo della lettera.";
    return '<div class="lesson-head"><span class="big-ico">✉️</span><div><h1 style="margin:0">Spiegami questa lettera</h1>' +
      '<p class="lead" style="margin:0">Una bolletta, una multa, una lettera del Comune o dell\'INPS, una raccomandata… ' +
      (ocr ? "Fotografatela o scansionatela, oppure scrivetene il testo:" : "Scrivetene o incollatene il testo:") + " il Professore ve la spiega con parole semplici.</p></div></div>" +
      '<div class="notice ok lt-privacy">🔒 <b>Resta tutto su questo computer.</b> La lettera contiene dati personali: il Professore la legge qui, senza Internet, ' +
      "non la salva e non la manda a nessuno. Quando avete finito premete «🗑️ Dimentica questa lettera».</div>" +
      '<div class="card lt-box-ingresso">' +
      (ocr ? '<h2>1. Date la lettera al Professore</h2><div class="row lt-sorgenti">' +
        '<input type="file" id="lt-file" accept="image/*,.pdf,application/pdf" class="lt-nascosto"><label class="btn big lt-file-btn" for="lt-file">📷 Carica la foto o la scansione</label>' +
        (cam ? '<button class="btn big ghost" id="lt-cam">🎥 Usa la webcam</button>' : "") + "</div>" +
        '<p class="small muted">Consigli: lettera ben distesa, con tanta luce, foto dritta e da vicino, senza ombre. Vanno bene le foto del telefono (JPG o PNG).</p>' +
        '<div id="lt-cam-box" class="lt-cam" hidden><video id="lt-video" autoplay playsinline muted></video><div class="row"><button class="btn big" id="lt-scatta">📸 Scatta la foto</button><button class="btn ghost" id="lt-cam-stop">✖ Spegni la webcam</button></div></div>' +
        '<div id="lt-img-box" class="lt-img" hidden><div class="lt-anteprima"><canvas id="lt-canvas" aria-label="Anteprima della lettera"></canvas></div>' +
        '<div class="row lt-img-azioni"><button class="btn ghost" id="lt-ruota-s" title="Ruota a sinistra">↺ Ruota</button><button class="btn ghost" id="lt-ruota-d" title="Ruota a destra">↻ Ruota</button>' +
        '<button class="btn big" id="lt-leggi-img">📖 Leggi la lettera</button></div>' +
        '<div id="lt-ocr" class="lt-ocr" hidden aria-live="polite"><div class="lt-ocr-msg"></div><div class="progress big"><span></span></div><button class="btn ghost" id="lt-ocr-stop">■ Annulla</button></div></div>' +
        '<h2 class="lt-h2-testo">2. Il testo della lettera</h2><p class="small muted lt-nota-testo">Dopo la lettura il testo compare qui: l\'occhio del computer a volte sbaglia, potete correggerlo. Oppure scrivetelo o incollatelo voi.</p>'
        : '<p class="notice info small lt-no-ocr">ℹ️ ' + esc(perche) + "</p>") +
      '<label for="lt-testo" class="lt-etichetta">Il testo della lettera</label>' +
      '<textarea id="lt-testo" rows="8" placeholder="Per incollare: tasto destro del mouse → Incolla, oppure Ctrl+V. Potete anche copiare a mano le righe più importanti."></textarea>' +
      '<div class="row lt-azioni"><button class="btn big" id="lt-spiega">💡 Spiegamela</button>' +
      '<button class="btn ghost" id="lt-dimentica">🗑️ Dimentica questa lettera</button></div>' +
      '<div class="lt-esempi"><div class="small"><b>Provate con un esempio</b> (lettere inventate, nessun dato vero):</div><div class="row">' + ESEMPI.map(function (e, i) {
        return '<button class="btn ghost lt-es" data-es="' + i + '">' + esc(e.t) + "</button>";
      }).join("") + "</div></div></div>" +
      '<div id="lt-esito" class="card lt-esito" hidden aria-live="polite"></div>';
  }

  PD.views.lettera = function (el) {
    vista = el;
    el.innerHTML = htmlPagina();
    var ta = $("#lt-testo", el);
    if (stato.testo) ta.value = stato.testo;
    ta.oninput = function () { stato.testo = ta.value; };

    function mostraEsito(r, testo) {
      var box = $("#lt-esito", el);
      box.hidden = false;
      box.className = "card lt-esito" + (r.truffa.livello === "alto" ? " lt-bordo-alto" : "");
      box.innerHTML = htmlSpiegazione(r) +
        '<details class="lt-testo-ev"><summary>🖍️ Il testo con le parti importanti evidenziate</summary><div class="lt-legenda small">' +
        '<mark class="lt-m lt-m-totale">totale</mark> <mark class="lt-m lt-m-soldi">cifre</mark> <mark class="lt-m lt-m-scadenza">scadenze</mark> <mark class="lt-m lt-m-codice">codici</mark> <mark class="lt-m lt-m-termine">tempi</mark></div>' +
        '<div class="lt-testo-corpo">' + evidenzia(testo, r._intervalli) + "</div></details>" +
        '<div class="row lt-azioni"><button class="btn" id="lt-leggi">🔊 Leggi la spiegazione</button><button class="btn ghost" id="lt-stampa">🖨️ Stampa la spiegazione</button>' +
        (PD.server && PD.aiReady() ? '<button class="btn ghost" id="lt-ia">🤖 Chiedi anche all\'IA un riassunto</button>' : "") +
        '<button class="btn ghost" id="lt-dimentica2">🗑️ Dimentica questa lettera</button></div><div id="lt-ia-box" hidden></div>';
      $("#lt-leggi", box).onclick = function () { PD.speak(testoParlato(r), true); };
      $("#lt-stampa", box).onclick = stampa;
      $("#lt-dimentica2", box).onclick = dimentica;
      var ia = $("#lt-ia", box); if (ia) ia.onclick = function () { chiediIA(testo, r, box); };
    }
    function spiega() {
      var testo = ta.value.trim();
      if (testo.length < 10) { PD.toast("Scrivete, incollate o fate leggere prima il testo della lettera."); ta.focus(); return; }
      fermaIA();
      var r = analizza(testo);
      stato.r = r; stato.testo = ta.value;
      conta(r.tipo);
      mostraEsito(r, testo);
      PD.setProf("pensiero");
      setTimeout(function () { if (PD.profState === "pensiero") PD.setProf("riposo"); }, 1200);
      var box = $("#lt-esito", el);
      if (box.scrollIntoView) box.scrollIntoView({ behavior: "smooth", block: "start" });
      if (PD.settings.autoReadAnswers) PD.speak("Mi sembra: " + r.titoloTipo + "." + (r.totale ? " Da pagare: " + r.totale.testo.replace(" €", " euro") + "." : ""));
    }
    function dimentica() {
      annullaLettura(); fermaWebcam(); fermaIA();
      if (PD.stopSpeech) PD.stopSpeech();
      stato.testo = ""; stato.r = null; stato.img = null; stato.canvas = null; stato.rot = 0;
      ta.value = "";
      var f = $("#lt-file", el); if (f) f.value = "";
      var ib = $("#lt-img-box", el); if (ib) ib.hidden = true;
      var cv = $("#lt-canvas", el); if (cv) { cv.width = 1; cv.height = 1; }
      var box = $("#lt-esito", el); box.hidden = true; box.innerHTML = "";
      PD.toast("🗑️ Fatto: ho dimenticato la lettera. Sul computer non è rimasto niente.");
      window.scrollTo(0, 0);
    }
    $("#lt-spiega", el).onclick = spiega;
    $("#lt-dimentica", el).onclick = dimentica;
    ta.onkeydown = function (e) { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); spiega(); } };
    $$(".lt-es", el).forEach(function (b) {
      b.onclick = function () { ta.value = ESEMPI[+b.getAttribute("data-es")].x; stato.testo = ta.value; spiega(); };
    });
    if (stato.r && stato.testo) mostraEsito(stato.r, stato.testo.trim());

    /* --- immagine e OCR (solo con il server locale) --- */
    if (!$("#lt-file", el)) return;
    function disegna() {
      if (!stato.img) return;
      stato.canvas = preparaImmagine(stato.img, stato.img.naturalWidth || stato.img.videoWidth || stato.img.width,
        stato.img.naturalHeight || stato.img.videoHeight || stato.img.height, stato.rot);
      var cv = $("#lt-canvas", el);
      cv.width = stato.canvas.width; cv.height = stato.canvas.height;
      cv.getContext("2d").drawImage(stato.canvas, 0, 0);
      $("#lt-img-box", el).hidden = false;
    }
    function usaImmagine(img) {
      annullaLettura();
      stato.img = img; stato.rot = 0;
      disegna();
      $("#lt-ocr", el).hidden = true;
      var b = $("#lt-leggi-img", el);
      if (b.scrollIntoView) b.scrollIntoView({ behavior: "smooth", block: "center" });
      leggi();
    }
    if (stato.img) disegna();
    $("#lt-file", el).onchange = function () {
      var file = this.files && this.files[0];
      if (!file) return;
      if (/pdf$/i.test(file.type) || /\.pdf$/i.test(file.name)) {
        this.value = "";
        PD.toast("Per ora il Professore legge solo le foto (JPG o PNG). Aprite il PDF, selezionate il testo e incollatelo qui, oppure fotografate lo schermo.", 9000);
        return;
      }
      if (!/^image\//.test(file.type)) { this.value = ""; PD.toast("Questo file non sembra una foto. Scegliete un'immagine JPG o PNG."); return; }
      var lettore = new FileReader();
      lettore.onload = function () {
        var img = new Image();
        img.onload = function () { usaImmagine(img); };
        img.onerror = function () { PD.toast("Non riesco ad aprire questa foto. Provate con un'altra (JPG o PNG)."); };
        img.src = lettore.result;
      };
      lettore.readAsDataURL(file);
    };
    $("#lt-ruota-s", el).onclick = function () { annullaLettura(); stato.rot = (stato.rot + 270) % 360; disegna(); $("#lt-ocr", el).hidden = true; };
    $("#lt-ruota-d", el).onclick = function () { annullaLettura(); stato.rot = (stato.rot + 90) % 360; disegna(); $("#lt-ocr", el).hidden = true; };
    $("#lt-leggi-img", el).onclick = leggi;
    $("#lt-ocr-stop", el).onclick = function () {
      annullaLettura();
      $(".lt-ocr-msg", $("#lt-ocr", el)).textContent = "Lettura annullata. Potete ruotare la foto e riprovare, oppure scrivere il testo.";
      $("#lt-ocr-stop", el).hidden = true; $(".progress", $("#lt-ocr", el)).hidden = true;
      $("#lt-leggi-img", el).disabled = false;
    };

    function leggi() {
      if (!stato.canvas) return;
      var mio = ++stato.lettura, box = $("#lt-ocr", el), msg = $(".lt-ocr-msg", box), barra = $(".progress > span", box), btn = $("#lt-leggi-img", el);
      box.hidden = false; $(".progress", box).hidden = false; $("#lt-ocr-stop", el).hidden = false; btn.disabled = true;
      box.className = "lt-ocr";
      var testi = { carico: "Preparo gli occhiali del Professore…", preparo: "Preparo gli occhiali del Professore…", lingua: "Ripasso l'italiano…",
        leggo: "Sto leggendo la lettera… ci vuole circa un minuto sui computer vecchi." };
      function avviso(fase, fr) {
        if (mio !== stato.lettura) return;
        msg.textContent = testi[fase] || testi.leggo;
        barra.style.width = Math.round(Math.max(3, Math.min(100, fr * 100))) + "%";
      }
      avviso("carico", 0.02);
      OCR.avviso = avviso;
      PD.setProf("pensiero");
      preparaOcr().then(function (w) {
        if (mio !== stato.lettura) return null;
        avviso("leggo", 0.22);
        return w.recognize(stato.canvas);
      }).then(function (res) {
        if (mio !== stato.lettura || !res) return;
        OCR.avviso = null;
        var testo = String(res.data && res.data.text || "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
        var conf = res.data && typeof res.data.confidence === "number" ? res.data.confidence : 100;
        btn.disabled = false; $("#lt-ocr-stop", el).hidden = true;
        if (PD.profState === "pensiero") PD.setProf("riposo");
        if (testo.replace(/\s/g, "").length < 15) {
          box.className = "lt-ocr lt-ocr-male";
          msg.textContent = "Non sono riuscito a leggere quasi niente. Provate a ruotare la foto (↺ ↻) o a rifarla più da vicino, con più luce e senza ombre. Oppure scrivete il testo qui sotto.";
          return;
        }
        ta.value = testo; stato.testo = testo;
        barra.style.width = "100%";
        box.className = "lt-ocr lt-ocr-ok";
        msg.textContent = conf < 55 ? "✅ Ho letto la lettera, ma la foto non era molto chiara: controllate bene il testo qui sotto (soprattutto cifre e date) e correggetelo se serve."
          : "✅ Ho letto la lettera. Controllate il testo qui sotto: se vedete errori correggeteli. Ecco la spiegazione.";
        spiega();
      }).catch(function (e) {
        if (mio !== stato.lettura) return;
        OCR.avviso = null; chiudiOcr();
        btn.disabled = false; $("#lt-ocr-stop", el).hidden = true; $(".progress", box).hidden = true;
        if (PD.profState === "pensiero") PD.setProf("riposo");
        box.className = "lt-ocr lt-ocr-male";
        msg.textContent = "Mi dispiace, su questo computer non riesco a leggere le foto (" + (e && e.message ? e.message : e) + "). Potete scrivere o incollare il testo qui sotto: la spiegazione funziona lo stesso.";
      });
    }

    /* --- webcam: si accende solo con un clic --- */
    var camBtn = $("#lt-cam", el);
    if (camBtn) camBtn.onclick = function () {
      fermaWebcam();
      navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false }).then(function (s) {
        if (vista !== el || !document.body.contains(el)) { s.getTracks().forEach(function (t) { t.stop(); }); return; }
        stato.stream = s;
        var v = $("#lt-video", el);
        v.srcObject = s;
        $("#lt-cam-box", el).hidden = false;
        if (v.play) { var pr = v.play(); if (pr && pr.catch) pr.catch(function () { /* parte da sola */ }); }
      }, function () {
        PD.toast("Non riesco ad accendere la webcam (forse non c'è, o è usata da un altro programma, o non è stato dato il permesso). Potete caricare una foto.", 8000);
      });
    };
    $("#lt-cam-stop", el).onclick = fermaWebcam;
    $("#lt-scatta", el).onclick = function () {
      var v = $("#lt-video", el);
      if (!v.videoWidth) { PD.toast("La webcam si sta ancora accendendo: aspettate un attimo e riprovate."); return; }
      var c = document.createElement("canvas");
      c.width = v.videoWidth; c.height = v.videoHeight;
      c.getContext("2d").drawImage(v, 0, 0);
      fermaWebcam();
      usaImmagine(c);
    };
  };

  /* quando si cambia pagina: webcam spenta, lettura e IA fermate */
  window.addEventListener("hashchange", function () {
    if (/^#\/lettera/.test(location.hash)) return;
    fermaWebcam(); fermaIA();
    if (OCR.worker || OCR.promessa) annullaLettura();
  });

  /* ------------------------------------------------------------------------
   *  Riassunto dall'IA locale (facoltativo)
   * ---------------------------------------------------------------------- */
  var PROMPT_IA =
    "Sei il Professore Digitale e aiuti persone anziane e principianti a capire lettere, bollette e avvisi. Rispondi in italiano semplice, dando del voi, in modo breve (massimo 150 parole).\n" +
    "Ti viene dato il testo di una lettera (letto da una foto: può contenere errori di lettura). Rispondi con quattro punti brevi:\n" +
    "1. Che cos'è e chi la manda.\n2. Che cosa chiede (pagare, rispondere, ritirare, nulla).\n3. Entro quando, se c'è una data.\n4. Cosa fare, con prudenza.\n" +
    "Regole: usa SOLO i dati scritti nella lettera; se un dato non c'è o non è chiaro, dillo. Non inventare cifre, date, numeri di telefono né indirizzi di siti. " +
    "Non dare consigli legali o fiscali definitivi: suggerisci di chiedere al CAF, al patronato, all'ufficio del Comune o a una persona di fiducia. Se vedi segnali di truffa, dillo. Non scrivere schemi o codice.";
  function pulisci(t) {
    t = PD.stripThink ? PD.stripThink(t) : String(t || "");
    return t.replace(/\[DIAGRAMMA\][\s\S]*?(\[\/DIAGRAMMA\]|$)/g, "").replace(/```[\s\S]*?(```|$)/g, "");
  }
  function chiediIA(testo, r, box) {
    var out = $("#lt-ia-box", box), btn = $("#lt-ia", box);
    fermaIA();
    out.hidden = false; out.className = "lt-ia";
    out.innerHTML = '<h3>🤖 Il riassunto dell\'IA locale <span class="small muted">(' + esc(PD.currentModel()) + ')</span></h3><div class="lt-ia-testo"><span class="muted">Sto pensando…</span></div>' +
      '<p class="small muted">Anche l\'IA funziona su questo computer, senza Internet. Può sbagliare: controllate sempre sulla lettera vera.</p>' +
      '<button class="btn ghost" id="lt-ia-stop">■ Ferma</button>';
    var dove = $(".lt-ia-testo", out), stop = $("#lt-ia-stop", out);
    if (btn) btn.disabled = true;
    PD.setProf("pensiero");
    var ctrl = stato.ctrl = new AbortController(), full = "";
    stop.onclick = fermaIA;
    var utente = "Testo della lettera:\n\"\"\"\n" + testo.slice(0, 4000) + "\n\"\"\"\n" +
      "Il controllo automatico ha trovato: tipo «" + r.titoloTipo + "»" + (r.mittente ? ", mittente «" + r.mittente + "»" : "") +
      (r.totale ? ", totale " + r.totale.testo : "") + (r.scadenze.length ? ", date: " + r.scadenze.map(function (s) { return s.dataIt; }).join(", ") : "") +
      (r.truffa.livello !== "basso" ? ", SEGNALI DI TRUFFA: " + r.truffa.segnali.map(function (s) { return s.titolo; }).join("; ") : "") + ".";
    function fine() {
      if (btn) btn.disabled = false; stop.hidden = true; if (stato.ctrl === ctrl) stato.ctrl = null;
      if (PD.profState === "pensiero") PD.setProf("riposo");
    }
    fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, signal: ctrl.signal,
      body: JSON.stringify({ model: PD.currentModel(), messages: [{ role: "system", content: PROMPT_IA }, { role: "user", content: utente }] }) })
      .then(function (res) {
        if (!res.ok) return res.json().then(function (j) { throw new Error(j.error || "errore IA"); });
        var reader = res.body.getReader(), dec = new TextDecoder(), buf = "";
        function pompa() {
          return reader.read().then(function (x) {
            if (x.done) return;
            buf += dec.decode(x.value, { stream: true });
            var righe = buf.split("\n"); buf = righe.pop();
            righe.forEach(function (ln) {
              if (!ln.trim()) return;
              var o; try { o = JSON.parse(ln); } catch (e) { return; }
              if (o.error) throw new Error(o.error);
              if (o.t) { full += o.t; dove.innerHTML = PD.md(pulisci(full)); }
            });
            return pompa();
          });
        }
        return pompa();
      })
      .then(function () {
        fine();
        var t = pulisci(full);
        if (!t.trim()) throw new Error("risposta vuota");
        dove.innerHTML = PD.md(t);
        if (PD.settings.autoReadAnswers) PD.speak(t);
      })
      .catch(function (err) {
        fine();
        if (err && err.name === "AbortError") { if (!full.trim()) dove.innerHTML = '<span class="muted">Richiesta fermata.</span>'; return; }
        dove.innerHTML = '<p class="notice small">L\'IA locale non ha risposto (' + esc(err.message) + "). Vale la spiegazione qui sopra.</p>";
      });
  }

  PD.lettera = { analizza: analizza, esempi: ESEMPI, glossario: GLOSSARIO.map(function (g) { return g[0]; }), ocrPossibile: ocrPossibile, _ocr: OCR };

  PD.hooks.homeTiles.push(function () {
    return PD.tileHTML("✉️", "Spiegami questa lettera", "Fotografate una bolletta o una lettera: il Professore ve la spiega.", "#/lettera");
  });
})();
