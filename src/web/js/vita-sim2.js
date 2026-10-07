/* ==============================================================================
 *  PROFESSORE DIGITALE - Palestra della vita digitale: simulatori 4, 5, 6
 *  «La banca online» (Banca del Borgo - prova), «Messaggi e videochiamate» (Chiacchiere)
 *  e «La posta elettronica» (PostaFacile prova). Tutti i nomi, i numeri, i codici e
 *  gli IBAN sono di fantasia: niente di reale, niente collegamenti, niente rete.
 *  Il framework (vita.js) disegna fascia PROVA, fumetto, barra dell'indirizzo e telefono;
 *  qui si disegna solo il contenuto del riquadro e si guida con ctx.passo/bravo/errore/fine.
 *  JavaScript puro (ES5). Ideato e sviluppato da Danilo D'Auria - Licenza MIT
 * ============================================================================== */
(function () {
  "use strict";
  var PD = window.PD;
  if (!PD || !PD.vita || typeof PD.vita.registra !== "function") return;
  var $ = PD.$, $$ = PD.$$, esc = PD.esc;
  var giro = 0;

  /* ------------------------------------------------------------------------
   *  Strumenti comuni ai tre simulatori
   * ---------------------------------------------------------------------- */
  function pulito(s) { return String(s == null ? "" : s).replace(/\s+/g, " ").replace(/^\s+|\s+$/g, "").toLowerCase(); }
  function compatto(s) { return String(s == null ? "" : s).toUpperCase().replace(/[^A-Z0-9]/g, ""); }
  function gruppi(s) { return String(s).replace(/(.{4})/g, "$1 ").replace(/\s+$/, ""); }
  function cifra(s) {
    var t = String(s == null ? "" : s).replace(/[^\d,.]/g, "");
    if (/,\d{1,2}$/.test(t)) t = t.replace(/\./g, "").replace(",", "."); else t = t.replace(/,/g, "");
    var n = parseFloat(t);
    return isNaN(n) ? null : n;
  }
  function toast(m) { if (PD.toast) PD.toast(m, 4500); }
  /* quanto spazio occupano in alto le parti che restano ferme (barra, fascia PROVA, guida se fissa) */
  function sopra() {
    var y = 0;
    [".topbar", "header", ".vita-prova", ".vita-guida"].forEach(function (sel) {
      var e = $(sel); if (!e || !e.getBoundingClientRect) return;
      var b = e.getBoundingClientRect().bottom; if (b > y && b < (window.innerHeight || 800) / 2) y = b;
    });
    return y;
  }

  /* Campo grande con etichetta; sotto, lo spazio per «Compila per me» */
  function campo(id, etichetta, o) {
    o = o || {};
    var ph = o.ph ? ' placeholder="' + esc(o.ph) + '"' : "";
    var input = o.area ?
      '<textarea id="' + id + '" class="v2-input" rows="' + (o.righe || 3) + '"' + ph + "></textarea>" :
      '<input id="' + id + '" class="v2-input" type="' + (o.tipo || "text") + '" autocomplete="off" autocapitalize="off" spellcheck="false"' +
        (o.inputmode ? ' inputmode="' + o.inputmode + '"' : "") + (o.valore ? ' value="' + esc(o.valore) + '"' : "") + ph + ">";
    if (o.tipo === "password") input = '<div class="v2-pwriga">' + input + '<button type="button" class="btn ghost v2-mostra" data-per="' + id + '">👁️ Mostra</button></div>';
    return '<div class="v2-campo"><label for="' + id + '">' + etichetta + "</label>" + input +
      (o.nota ? '<div class="small muted v2-nota">' + o.nota + "</div>" : "") +
      '<div class="v2-aiuto" data-v2-aiuto="' + id + '"></div></div>';
  }

  /* Una «sessione» per ogni avvio: i ritardi si annullano se l'utente esce o ricomincia */
  function sessione(box, ctx) {
    var g = String(++giro), errori = {}, S;
    box.setAttribute("data-v2-giro", g);
    S = {
      ctx: ctx,
      vivo: function () { return box.getAttribute("data-v2-giro") === g && document.documentElement.contains(box) && location.hash.indexOf("#/vita/") === 0; },
      /* barra dell'indirizzo e foglio «sul tavolo»: aggiunte facoltative del framework */
      url: function (u, sicuro) { if (ctx.indirizzo) ctx.indirizzo(u, sicuro); },
      foglio: function (o) { if (ctx.foglio) { ctx.foglio(o); return true; } return false; },
      /* ciò che il pulsante «Aiutami» del framework fa lampeggiare */
      indica: function (sel) {
        S.tutti("[data-vita-aiuto]").forEach(function (x) { x.removeAttribute("data-vita-aiuto"); });
        if (sel) S.tutti(sel).forEach(function (x) { x.setAttribute("data-vita-aiuto", "1"); });
      },
      dopo: function (ms, fn) { setTimeout(function () { if (S.vivo()) fn(); }, ms); },
      el: function (sel) { return $(sel, box); },
      tutti: function (sel) { return $$(sel, box); },
      disegna: function (html) {
        box.innerHTML = '<div class="v2-scena">' + html + "</div>";
        /* pagina nuova: se l'inizio della finestra finta e' finito sotto la guida, lo si riporta in vista */
        var su = sopra(), fin = box.closest ? box.closest(".vita-browser") : box;
        var rt = (fin || box).getBoundingClientRect().top;
        if (rt < su - 4) window.scrollBy(0, rt - su - 8);
        S.tutti(".v2-mostra").forEach(function (b) {
          b.addEventListener("click", function () {
            var i = $("#" + b.getAttribute("data-per"), box); if (!i) return;
            var vedi = i.type === "password"; i.type = vedi ? "text" : "password";
            b.textContent = vedi ? "🙈 Nascondi" : "👁️ Mostra";
          });
        });
      },
      clic: function (sel, fn) {
        S.tutti(sel).forEach(function (b) {
          b.addEventListener("click", function (e) { if (e && e.preventDefault) e.preventDefault(); if (S.vivo()) fn(b, e); });
        });
      },
      invio: function (sel, fn) {
        var f = S.el(sel);
        if (f) f.addEventListener("submit", function (e) { e.preventDefault(); if (S.vivo()) fn(f); });
      },
      valore: function (id) { var i = $("#" + id, box); return i ? i.value : ""; },
      vedi: function (sel) {
        var e = typeof sel === "string" ? S.el(sel) : sel;
        if (!e || !e.getBoundingClientRect) return;
        /* come scrollIntoView, ma tenendo conto della guida del Professore che resta in alto */
        var su = sopra(), r = e.getBoundingClientRect(), h = window.innerHeight || document.documentElement.clientHeight;
        var giu = $(".sidebar"), gb = giu ? giu.getBoundingClientRect() : null;
        if (gb && gb.top > h / 2 && gb.top < h) h = gb.top; /* barra di navigazione in basso sul telefono */
        if (r.top < su + 8) window.scrollBy(0, r.top - su - 12);
        else if (r.bottom > h - 8) window.scrollBy(0, Math.min(r.bottom - h + 16, r.top - su - 12));
      },
      /* Sbaglio gentile; dal secondo sullo stesso campo compare «Compila per me» */
      sbaglio: function (chiave, msg, riempi) {
        errori[chiave] = (errori[chiave] || 0) + 1;
        ctx.errore(msg);
        if (errori[chiave] >= 2 && riempi) {
          var posto = $('[data-v2-aiuto="' + chiave + '"]', box);
          if (posto && !posto.firstChild) {
            posto.innerHTML = '<button type="button" class="btn ghost v2-compila">✍️ Compila per me</button>';
            $(".v2-compila", posto).addEventListener("click", function () {
              riempi();
              posto.innerHTML = '<span class="small muted">Ho scritto io per voi: guardate com\'è scritto, poi proseguite.</span>';
              var i = $("#" + chiave, box); if (i && i.focus) i.focus();
            });
          }
        }
        var i = $("#" + chiave, box);
        if (i && i.focus) { try { i.focus(); } catch (x) { /* niente */ } }
        return errori[chiave];
      },
      quanti: function (chiave) { return errori[chiave] || 0; },
      scrivi: function (id, v) { var i = $("#" + id, box); if (i) i.value = v; },
      /* Telefono finto del framework: le azioni valgono solo se la prova è ancora aperta */
      tel: function (opz) {
        if (!opz) { ctx.telefono(null); return; }
        var o = {}, k;
        for (k in opz) if (opz.hasOwnProperty(k)) o[k] = opz[k];
        o.pulsanti = (opz.pulsanti || []).map(function (p) {
          return { testo: p.testo, azione: function () { if (S.vivo()) p.azione(); } };
        });
        ctx.telefono(o);
      },
      /* Domanda a scelta: gli sbagli si spiegano, la risposta giusta va avanti */
      scelte: function (dest, chiave, domanda, opzioni, poi) {
        if (typeof dest === "string") dest = S.el(dest);
        if (!dest) return;
        dest.innerHTML = '<div class="v2-domanda card"><p class="v2-dom-t">' + domanda + "</p>" +
          opzioni.map(function (o, i) { return '<button type="button" class="quiz-opt v2-scelta" data-i="' + i + '">' + esc(o.t) + "</button>"; }).join("") +
          '<div class="v2-spiega" aria-live="polite"></div></div>';
        var spiega = $(".v2-spiega", dest);
        $$(".v2-scelta", dest).forEach(function (b) {
          b.addEventListener("click", function () {
            if (!S.vivo() || b.disabled || b.classList.contains("wrong")) return;
            var o = opzioni[+b.getAttribute("data-i")];
            if (o.ok) {
              $$(".v2-scelta", dest).forEach(function (x) { x.disabled = true; });
              b.classList.add("right");
              spiega.innerHTML = '<div class="notice ok">✅ ' + (o.spiega || esc(o.msg)) + "</div>";
              ctx.bravo(o.msg);
              if (poi) poi(o);
            } else {
              b.classList.add("wrong");
              spiega.innerHTML = '<div class="notice">💡 ' + (o.spiega || esc(o.msg)) + "</div>";
              S.sbaglio(chiave, o.msg);
            }
          });
        });
        S.vedi(dest);
      }
    };
    /* Prima che il framework faccia lampeggiare gli elementi con «💡 Aiutami», si segna quello del passo attuale */
    function primaDiAiutami(e) {
      if (!S.vivo()) { document.removeEventListener("click", primaDiAiutami, true); return; }
      var t = e.target && e.target.closest ? e.target.closest(".vita-aiuto") : null;
      if (t && S.guida) S.indica(S.guida());
    }
    document.addEventListener("click", primaDiAiutami, true);
    return S;
  }

  /* ========================================================================
   *  4) LA BANCA ONLINE — «Banca del Borgo — prova»
   * ====================================================================== */
  var BANCA = {
    codice: "48271593", pw: "Girasole58",
    iban: "IT60X0542811101000000123456", otp: "731604",
    movimenti: [
      { quando: "Ieri", cosa: "Supermercato del Borgo", importo: "− 42,30 €" },
      { quando: "2 giorni fa", cosa: "PAGAMENTO ONLINE XQ-SHOPWRLD 7781", importo: "− 89,90 €", strano: true },
      { quando: "3 giorni fa", cosa: "Accredito pensione", importo: "+ 1.050,00 €", piu: true },
      { quando: "5 giorni fa", cosa: "Bolletta della luce (addebito diretto)", importo: "− 61,15 €" },
      { quando: "6 giorni fa", cosa: "Farmacia del Borgo", importo: "− 12,50 €" },
      { quando: "8 giorni fa", cosa: "Prelievo al bancomat", importo: "− 100,00 €" }
    ]
  };

  function simBanca(box, ctx) {
    var S = sessione(box, ctx), fase = "accesso", dati = { nome: "", iban: "", importo: "", causale: "" };

    S.guida = function () {
      return { accesso: S.valore("v2-codice") ? "#v2-pw" : "#v2-codice", "vai-bonifico": "[data-menu=bonifico]", bonifico: ".v2-input",
        riepilogo: "[data-v2=conferma]", codice: "#v2-codotp", ricevuta: ".v2-esci" }[fase] || null;
    };
    function testata(dentro) {
      return '<div class="v2-testata v2-banca-t"><span class="v2-logo">🏦 Banca del Borgo <small>prova</small></span>' +
        (dentro ? '<span class="v2-chi small">Area clienti</span><button type="button" class="btn v2-esci" data-v2="esci">🚪 Esci</button>' : "") + "</div>";
    }
    function menu(attivo) {
      return '<nav class="v2-menu" aria-label="Menu della banca">' +
        [["conto", "🏠 Conto"], ["bonifico", "↗️ Bonifico"], ["carte", "💳 Carte"], ["documenti", "📄 Documenti"]].map(function (m) {
          return '<button type="button" class="v2-voce' + (m[0] === attivo ? " attiva" : "") + '" data-menu="' + m[0] + '">' + m[1] + "</button>";
        }).join("") + "</nav>";
    }
    function legaDentro() {
      S.clic("[data-v2=esci]", function () {
        if (fase === "ricevuta") esci();
        else toast("Giusto ricordarsene! Usciremo alla fine, quando avremo finito il bonifico.");
      });
      S.clic("[data-menu]", function (b) {
        var m = b.getAttribute("data-menu");
        if (m === "bonifico" && fase === "vai-bonifico") { bonifico(); return; }
        if (m === "conto" && fase === "conto") return;
        if (fase === "vai-bonifico") toast("Per fare il bonifico premete «↗️ Bonifico».");
        else toast("In questa prova seguiamo i passi del Professore: guardate il fumetto.");
      });
    }

    /* 1. Accesso con il foglietto */
    function accesso() {
      fase = "accesso";
      var foglietto = "<p>Codice cliente:<br><b class=\"v2-gr\">4827 1593</b></p><p>Password:<br><b class=\"v2-gr\">Girasole58</b></p>" +
        '<p class="small">Solo per esercitarsi! I dati veri non si tengono su un foglietto attaccato al computer: custoditeli in un posto sicuro.</p>';
      var sulTavolo = S.foglio({ titolo: "📝 Foglietto della prova", html: foglietto });
      S.url("https://www.bancaborgoprova.it/area-clienti");
      S.disegna(testata(false) +
        '<div class="v2-due' + (sulTavolo ? " uno" : "") + '">' +
        '<form class="card v2-modulo" id="v2-accesso" autocomplete="off" novalidate><h2>Accesso all\'area clienti</h2>' +
        campo("v2-codice", "Codice cliente", { inputmode: "numeric", ph: "8 cifre" }) +
        campo("v2-pw", "Password", { tipo: "password" }) +
        '<button class="btn big" type="submit">🔐 Accedi</button>' +
        '<p class="small muted">Non ricordate la password? Nella vita vera si usa «Password dimenticata» sul sito della banca, mai un collegamento arrivato per messaggio.</p></form>' +
        (sulTavolo ? "" : '<aside class="v2-foglietto" aria-label="Foglietto con i dati di prova"><b>📝 Foglietto della prova</b>' + foglietto + "</aside>") + "</div>");
      S.indica("#v2-codice");
      ctx.passo("Entriamo nella banca online. Guardate in alto l'indirizzo: **bancaborgoprova.it**, con il lucchetto 🔒. Copiate dal **foglietto** il codice cliente e la password, poi premete **«Accedi»**.");
      S.invio("#v2-accesso", function () {
        var c = compatto(S.valore("v2-codice")), p = S.valore("v2-pw").replace(/^\s+|\s+$/g, "");
        if (c !== BANCA.codice) {
          S.sbaglio("v2-codice", c ? "Il codice cliente non è giusto. Copiatelo dal foglietto: sono 8 cifre, gli spazi non contano." :
            "Manca il codice cliente: lo trovate sul foglietto.", function () { S.scrivi("v2-codice", "4827 1593"); });
          return;
        }
        if (p !== BANCA.pw) {
          S.sbaglio("v2-pw", p.toLowerCase() === BANCA.pw.toLowerCase() ?
            "Quasi! Nelle password le maiuscole contano: la G di Girasole è maiuscola." :
            "La password non è giusta. Guardate bene il foglietto: Girasole58, con la G maiuscola. Potete premere «Mostra» per vedere cosa avete scritto.",
            function () { S.scrivi("v2-pw", BANCA.pw); });
          return;
        }
        ctx.bravo("Codice e password giusti!");
        S.foglio(null);
        confermaAccesso();
      });
    }

    /* 2. Conferma sul telefono */
    function confermaAccesso() {
      fase = "conferma";
      S.disegna(testata(false) + '<div class="card v2-attesa"><div class="v2-gira" aria-hidden="true">📱</div>' +
        "<h2>Confermate l'accesso sul telefono</h2><p>Vi abbiamo mandato una richiesta sull'app della banca. Aspettiamo la vostra conferma…</p></div>");
      ctx.passo("Per sicurezza la banca chiede una conferma sul telefono. Guardate il telefono qui accanto e premete «Sì, sono io».");
      function mostra() {
        S.tel({ titolo: "App Banca del Borgo", mittente: "Banca del Borgo — prova",
          testo: "Richiesta di accesso dal computer, adesso. Siete voi?",
          pulsanti: [
            { testo: "✅ Sì, sono io", azione: function () { S.tel(null); ctx.bravo("Accesso confermato."); conto(); } },
            { testo: "❌ No, non sono io", azione: function () {
              ctx.errore("Questa volta siete proprio voi a entrare, quindi si preme «Sì». Ma ricordatelo: se arriva una richiesta che NON avete fatto voi, premete «No» e chiamate la banca.");
              S.dopo(400, mostra);
            } }
          ] });
      }
      mostra();
    }

    /* 3-6. Saldo, SMS trappola, movimento sconosciuto */
    function conto() {
      fase = "conto";
      S.url("https://www.bancaborgoprova.it/area-clienti/conto");
      S.disegna(testata(true) + menu("conto") +
        '<div class="card v2-saldo"><div class="small muted">Conto corrente di prova · Intestato a: voi</div>' +
        '<div class="v2-cifra">Saldo disponibile <b>1.284,60 €</b></div></div>' +
        '<div id="v2-dom1"></div>' +
        '<div class="card"><h3 class="v2-h3">Ultimi movimenti</h3><ul class="v2-movimenti">' +
        BANCA.movimenti.map(function (m, i) {
          return '<li><button type="button" class="v2-mov" data-m="' + i + '"><span class="v2-quando small muted">' + esc(m.quando) + "</span>" +
            '<span class="v2-cosa">' + esc(m.cosa) + '</span><span class="v2-imp' + (m.piu ? " piu" : "") + '">' + esc(m.importo) + "</span></button></li>";
        }).join("") + '</ul></div><div id="v2-dom2"></div>');
      legaDentro();
      ctx.passo("Siete dentro! Per prima cosa guardiamo il saldo, cioè quanti soldi ci sono sul conto.");
      S.scelte("#v2-dom1", "saldo", "Quanti soldi ci sono sul conto adesso?", [
        { t: "1.050,00 €", msg: "Quello è l'accredito della pensione, uno dei movimenti. Il saldo è il numero grande in alto." },
        { t: "1.284,60 €", ok: true, msg: "Esatto: è il saldo disponibile." },
        { t: "89,90 €", msg: "Quello è un singolo movimento. Il saldo è il numero grande in alto, «Saldo disponibile»." }
      ], function () { S.dopo(1400, smsTrappola); });
      S.clic(".v2-mov", function (b) {
        if (fase !== "movimenti") { toast("Tra poco guarderemo i movimenti uno per uno."); return; }
        var m = BANCA.movimenti[+b.getAttribute("data-m")];
        if (!m.strano) {
          S.sbaglio("mov", "«" + m.cosa + "» è una spesa che conoscete. Cercate un pagamento con un nome strano, che non vi dice niente.");
          return;
        }
        fase = "cosa-fare";
        b.classList.add("v2-sospetto");
        ctx.passo("Avete trovato il pagamento sospetto. Ora rispondete alla domanda qui sotto: **cosa fate?**");
        ctx.bravo("Proprio quello: «XQ-SHOPWRLD» non vi dice niente.");
        cosaFare();
      });
    }

    function smsTrappola() {
      fase = "sms";
      ctx.passo("È arrivato un SMS sul telefono. Leggetelo con attenzione e decidete cosa fare.");
      function mostra() {
        S.tel({ titolo: "Messaggi", mittente: "BancaBorgo",
          testo: "AVVISO: la vostra carta è stata BLOCCATA per motivi di sicurezza. Cliccate qui per sbloccarla entro oggi: http://bancaborgo-sblocco.xyz/carta",
          pulsanti: [
            { testo: "🔗 Apro il collegamento", azione: function () {
              ctx.errore("Attenzione, era una trappola! La banca non manda collegamenti per «sbloccare» la carta: quel sito è falso e serve a rubare i dati. Non apritelo.");
              S.dopo(500, mostra);
            } },
            { testo: "🗑️ Non lo apro e lo cancello", azione: function () {
              S.tel(null);
              ctx.bravo("Benissimo: messaggio cancellato senza aprirlo.");
              var d = S.el("#v2-dom1");
              if (d) d.innerHTML = '<div class="notice ok">📵 <b>SMS truffa riconosciuto.</b> Il nome del mittente si può falsificare e il collegamento porta a un sito finto. ' +
                "Se avete un dubbio sulla carta, chiamate il numero scritto sul retro della carta: mai quello indicato nel messaggio.</div>";
              S.dopo(1200, movimenti);
            } }
          ] });
      }
      mostra();
    }

    function movimenti() {
      fase = "movimenti";
      S.vedi(".v2-movimenti");
      ctx.passo("Ora leggiamo gli ultimi movimenti. Uno di questi non l'avete fatto voi: toccatelo.");
    }

    function cosaFare() {
      S.scelte("#v2-dom2", "addebito", "Avete trovato un pagamento che non riconoscete. Cosa fate?", [
        { t: "📞 Chiamo subito il numero sul retro della carta, oppure vado in filiale", ok: true,
          msg: "Giusto: avvisare subito la banca con un numero sicuro.",
          spiega: "Giusto! Chiamate il <b>numero scritto sul retro della carta</b> (o quello del contratto e dell'app ufficiale), oppure andate in <b>filiale</b>. La banca può bloccare la carta e aiutarvi a contestare l'addebito. Prima lo fate, meglio è." },
        { t: "📱 Rispondo all'SMS che mi era arrivato prima", msg: "No: quell'SMS era dei truffatori. Usate sempre un contatto sicuro della banca." },
        { t: "🔎 Cerco «assistenza Banca del Borgo» su internet e chiamo il primo numero", msg: "Rischioso: su internet ci sono anche numeri falsi messi dai truffatori. Usate quello sul retro della carta." },
        { t: "⏳ Aspetto qualche settimana per vedere se si sistema", msg: "Meglio di no: bisogna avvisare subito, così la banca blocca la carta e si possono contestare gli addebiti." }
      ], function () {
        fase = "vai-bonifico";
        S.dopo(1600, function () { ctx.passo("Ora facciamo un bonifico a vostro nipote Marco. Premete «↗️ Bonifico» nel menu in alto."); S.vedi(".v2-menu"); });
      });
    }

    /* 7. Bonifico con IBAN dal messaggio di Marco */
    function bonifico() {
      fase = "bonifico";
      S.url("https://www.bancaborgoprova.it/area-clienti/bonifico");
      S.disegna(testata(true) + menu("bonifico") +
        '<form class="card v2-modulo" id="v2-bon" novalidate><h2>↗️ Nuovo bonifico</h2>' +
        campo("v2-nome", "Beneficiario (nome e cognome)", { valore: dati.nome, ph: "Es. Marco Rossi" }) +
        campo("v2-iban", "IBAN del beneficiario", { valore: dati.iban, ph: "IT…", nota: "Copiatelo con calma dal messaggio di Marco, quattro caratteri alla volta. Gli spazi non contano." }) +
        campo("v2-importo", "Importo in euro", { valore: dati.importo, inputmode: "decimal", ph: "Es. 50" }) +
        campo("v2-causale", "Causale (il motivo)", { valore: dati.causale, ph: "Es. Regalo di compleanno" }) +
        '<button class="btn big" type="submit">Prosegui ➜</button></form>');
      legaDentro();
      S.tel({ titolo: "Messaggi", mittente: "Marco (nipote)",
        testo: "Ciao! Grazie per il regalo ❤️ Ecco il mio IBAN: " + gruppi(BANCA.iban) + " — intestato a Marco Rossi. Bastano 50 euro!" });
      ctx.passo("Marco vi ha scritto il suo IBAN sul telefono. Compilate: beneficiario Marco Rossi, l'IBAN copiato dal messaggio, 50 euro e una causale, per esempio «Regalo di compleanno».");
      S.invio("#v2-bon", function () {
        dati.nome = S.valore("v2-nome"); dati.iban = S.valore("v2-iban"); dati.importo = S.valore("v2-importo"); dati.causale = S.valore("v2-causale");
        var n = pulito(dati.nome).replace(/[^a-zàèéìòù ]/g, ""), ib = compatto(dati.iban), imp = cifra(dati.importo);
        if (n !== "marco rossi" && n !== "rossi marco") {
          S.sbaglio("v2-nome", "Il beneficiario è chi riceve i soldi: scrivete «Marco Rossi», come nel messaggio.", function () { S.scrivi("v2-nome", "Marco Rossi"); });
          return;
        }
        if (ib !== BANCA.iban) {
          var msg;
          if (ib.length !== BANCA.iban.length) msg = "L'IBAN italiano ha 27 caratteri (lettere e numeri): voi ne avete scritti " + ib.length + ". Ricontrollate con calma.";
          else {
            var k = 0; while (k < ib.length && ib.charAt(k) === BANCA.iban.charAt(k)) k++;
            var gr = Math.floor(k / 4);
            msg = "C'è una differenza nel gruppo numero " + (gr + 1) + " (nel messaggio è «" + BANCA.iban.substr(gr * 4, 4) + "»). Un solo carattere sbagliato manda i soldi a un altro!";
          }
          S.sbaglio("v2-iban", msg, function () { S.scrivi("v2-iban", gruppi(BANCA.iban)); });
          return;
        }
        if (imp !== 50) {
          S.sbaglio("v2-importo", "L'importo è 50 euro: basta scrivere 50.", function () { S.scrivi("v2-importo", "50"); });
          return;
        }
        if (pulito(dati.causale).length < 3) {
          S.sbaglio("v2-causale", "Scrivete una causale, cioè il motivo del bonifico: per esempio «Regalo di compleanno».", function () { S.scrivi("v2-causale", "Regalo di compleanno"); });
          return;
        }
        ctx.bravo("Modulo compilato bene!");
        riepilogo();
      });
    }

    /* 8. Riepilogo con verifica del nome */
    function riepilogo() {
      fase = "riepilogo";
      S.tel(null);
      S.disegna(testata(true) + menu("bonifico") +
        '<div class="card v2-riepilogo"><h2>Controllate prima di confermare</h2><dl class="v2-dl">' +
        "<dt>A</dt><dd>Marco Rossi</dd><dt>IBAN</dt><dd class=\"v2-gr\">" + esc(gruppi(BANCA.iban)) + "</dd>" +
        "<dt>Importo</dt><dd><b>50,00 €</b></dd><dt>Causale</dt><dd>" + esc(dati.causale) + "</dd></dl>" +
        '<div class="notice ok">✅ <b>Verifica del beneficiario:</b> il nome «Marco Rossi» corrisponde all\'IBAN.</div>' +
        '<p class="small muted">Se la banca vi avvisa che il nome <b>non</b> corrisponde, fermatevi: telefonate a chi deve ricevere i soldi, a un numero che conoscete.</p>' +
        '<div class="row"><button type="button" class="btn big" data-v2="conferma">✔️ Confermo il bonifico</button>' +
        '<button type="button" class="btn ghost" data-v2="modifica">✏️ Modifica</button></div></div>');
      legaDentro();
      ctx.passo("Ecco il riepilogo. Controllate nome, IBAN e importo: la banca ha verificato che il nome corrisponde. Se è tutto giusto, premete «Confermo il bonifico».");
      S.clic("[data-v2=modifica]", function () { bonifico(); });
      S.clic("[data-v2=conferma]", function () { codice(); });
    }

    /* 9. Codice di conferma sul telefono */
    function codice() {
      fase = "codice";
      S.disegna(testata(true) + menu("bonifico") +
        '<form class="card v2-modulo" id="v2-otp" novalidate><h2>🔑 Autorizzate il bonifico</h2>' +
        "<p>Vi abbiamo mandato un codice per SMS. Scrivetelo qui sotto: serve a confermare che siete voi.</p>" +
        campo("v2-codotp", "Codice ricevuto sul telefono", { inputmode: "numeric", ph: "6 cifre" }) +
        '<button class="btn big" type="submit">Autorizza</button></form>');
      legaDentro();
      S.tel({ titolo: "Messaggi", mittente: "BancaBorgo",
        testo: "Codice 731604 per autorizzare il bonifico di 50,00 € a Marco Rossi. Non comunicatelo a nessuno, nemmeno a chi dice di essere della banca." });
      ctx.passo("Sul telefono è arrivato il codice. Leggete bene il messaggio: dice a cosa serve. Copiatelo nel riquadro e premete «Autorizza».");
      S.invio("#v2-otp", function () {
        if (compatto(S.valore("v2-codotp")) !== BANCA.otp) {
          S.sbaglio("v2-codotp", "Il codice non è giusto: copiate le 6 cifre dal messaggio sul telefono.", function () { S.scrivi("v2-codotp", BANCA.otp); });
          return;
        }
        S.tel(null);
        ctx.bravo("Bonifico autorizzato!");
        ricevuta();
      });
    }

    /* 10. Ricevuta e uscita */
    function ricevuta() {
      fase = "ricevuta";
      S.disegna(testata(true) + menu("bonifico") +
        '<div class="card v2-ricevuta"><h2>✅ Bonifico eseguito</h2><dl class="v2-dl">' +
        "<dt>A</dt><dd>Marco Rossi</dd><dt>IBAN</dt><dd class=\"v2-gr\">" + esc(gruppi(BANCA.iban)) + "</dd>" +
        "<dt>Importo</dt><dd>50,00 €</dd><dt>Causale</dt><dd>" + esc(dati.causale) + "</dd>" +
        "<dt>Numero operazione</dt><dd class=\"v2-gr\">PROVA-0000-1234</dd></dl>" +
        '<p class="small muted">La ricevuta si può salvare o stampare: è utile se ci sono problemi. In questa prova non viene salvato niente.</p>' +
        '<button type="button" class="btn ghost" data-v2="salva">🖨️ Salva la ricevuta</button></div>');
      legaDentro();
      S.clic("[data-v2=salva]", function () { toast("Nella vita vera qui si scarica la ricevuta in PDF. Nella prova non si salva niente."); });
      ctx.passo("Fatto! Ecco la ricevuta. Quando avete finito, uscite sempre dal conto: premete «🚪 Esci» in alto.");
      S.vedi(".v2-esci");
    }

    function esci() {
      fase = "uscito";
      S.url("https://www.bancaborgoprova.it/arrivederci");
      S.disegna(testata(false) + '<div class="card v2-attesa"><div class="v2-gira" aria-hidden="true">👋</div><h2>Siete usciti dall\'area clienti</h2>' +
        "<p>Arrivederci! Per sicurezza chiudete anche la finestra del sito.</p></div>");
      ctx.bravo("Bravi: uscire sempre, soprattutto su un computer usato da altri.");
      S.dopo(1600, chiamata);
    }

    /* 11. Trappola: la finta telefonata della banca */
    function chiamata() {
      fase = "chiamata";
      ctx.passo("Pochi minuti dopo squilla il telefono. Ascoltate cosa vi chiedono e decidete.");
      function mostra() {
        S.tel({ titolo: "📞 Chiamata in arrivo", mittente: "«Banca del Borgo»",
          testo: "«Buongiorno, sono dell'ufficio sicurezza della Banca del Borgo. Abbiamo visto un'operazione sospetta sul suo conto. Per annullarla mi dica subito il codice che le è appena arrivato per SMS.»",
          pulsanti: [
            { testo: "🗣️ Gli leggo il codice", azione: function () {
              ctx.errore("No! Chi chiede il codice è un truffatore: con quel codice sposta i vostri soldi. La banca vera non chiede mai codici, password o PIN, né al telefono né per messaggio.");
              S.dopo(500, mostra);
            } },
            { testo: "📵 Riattacco e chiamo io la banca", azione: function () {
              S.tel(null);
              ctx.bravo("Perfetto: avete riattaccato. Il nome sul telefono si può falsificare.");
              S.disegna(testata(false) + '<div class="card"><h2>📵 Telefonata truffa respinta</h2>' +
                "<p>Il nome «Banca del Borgo» sullo schermo del telefono <b>si può falsificare</b>. Se avete un dubbio, riattaccate e chiamate voi la banca " +
                "al <b>numero scritto sul retro della carta</b>, oppure andate in filiale.</p></div>");
              S.dopo(1500, finale);
            } }
          ] });
      }
      mostra();
    }

    function finale() {
      ctx.fine({
        messaggio: "Bravissimi! Siete entrati nella banca online, avete letto saldo e movimenti, riconosciuto un addebito sospetto, fatto un bonifico controllato e respinto due truffe.",
        consigli: [
          "Entrate nella banca online solo dall'app ufficiale o scrivendo voi l'indirizzo: mai da un collegamento ricevuto per SMS, email o chat.",
          "Codici, password e PIN non si dicono a nessuno: la banca non li chiede mai, né al telefono né per messaggio.",
          "Un addebito che non riconoscete? Chiamate subito il numero sul retro della carta o andate in filiale.",
          "Prima di un bonifico controllate IBAN, nome e importo. Se la banca dice che il nome non corrisponde, fermatevi e telefonate al destinatario.",
          "Leggete sempre gli SMS con i codici: dicono a cosa servono. Se non state facendo voi quell'operazione, non usate il codice.",
          "Quando avete finito, premete sempre «Esci»."
        ]
      });
    }

    accesso();
  }

  /* ========================================================================
   *  5) MESSAGGI E VIDEOCHIAMATE — app di fantasia «Chiacchiere»
   * ====================================================================== */
  var SCONOSCIUTO = "+39 3•• ••• ••47";

  function simMessaggi(box, ctx) {
    var S = sessione(box, ctx), fase = "apri", aperta = null, nuovaChat = false, bloccato = false, chiamato = false;
    var chat = {
      anna: { nome: "Figlia Anna", av: "👩", msg: [{ lei: true, t: "Ciao! Ci sentiamo stasera? 😊", ora: "ieri" }] },
      condo: { nome: "Condominio Via dei Tigli", av: "🏢", msg: [{ lei: true, t: "Mario: domani manca l'acqua dalle 9 alle 12", ora: "09:12" }] },
      luisa: { nome: "Luisa (amica)", av: "👵", msg: [{ lei: true, t: "Buongiorno! 🌞", ora: "08:30" }] },
      studio: { nome: "Studio medico Bianchi", av: "🩺", msg: [{ lei: true, t: "Venerdì lo studio resta chiuso", ora: "lun" }] },
      ignoto: { nome: SCONOSCIUTO, av: "❔", msg: [{ lei: true, t: "Ciao mamma, ho cambiato numero, questo è quello nuovo. Mi si è rotto il telefono. Mi serve un bonifico urgente, oggi stesso, poi ti spiego. Non chiamare il vecchio numero, non funziona.", ora: "adesso" }] }
    };
    var FOTO = [
      { id: "fiori", e: "🌷", t: "Fiori del balcone" }, { id: "gatto", e: "🐈", t: "Il gatto Briciola" },
      { id: "torta", e: "🎂", t: "Torta di compleanno" }, { id: "mare", e: "🏖️", t: "Al mare" },
      { id: "monti", e: "🏔️", t: "Gita in montagna" }, { id: "nipoti", e: "👧", t: "I nipoti" }
    ];
    var ordine = ["anna", "condo", "luisa", "studio"];

    S.guida = function () {
      return { apri: "[data-chat=anna]", scrivi: "#v2-testo", foto: "[data-v2=allega], [data-alleg=galleria], [data-foto=fiori], [data-v2=mandafoto]",
        vocale: "#v2-mic", video: "[data-v2=video]", "in-video": "[data-v2=chiudi]", truffa: "[data-chat=ignoto]", blocca: "[data-v2=blocca]" }[fase] || null;
    };
    function app(dentro) { return '<div class="v2-app"><div class="v2-app-t">💬 Chiacchiere <small>prova</small></div>' + dentro + "</div>"; }
    function ultimo(id) { var m = chat[id].msg; return m[m.length - 1]; }

    function lista() {
      aperta = null;
      var ids = (nuovaChat ? ["ignoto"] : []).concat(ordine);
      S.disegna(app('<ul class="v2-chats">' + ids.map(function (id) {
        var c = chat[id], u = ultimo(id), anteprima = u.foto ? "📷 Foto" : u.voce ? "🎤 Messaggio vocale" : u.t;
        return '<li><button type="button" class="v2-chat-voce' + (id === "ignoto" ? " nuova" : "") + '" data-chat="' + id + '"><span class="v2-av">' + c.av + "</span>" +
          '<span class="v2-chat-txt"><b>' + esc(c.nome) + (id === "ignoto" && bloccato ? " 🚫" : "") + '</b><span class="small muted">' + esc(anteprima) + "</span></span>" +
          '<span class="small muted v2-ora">' + esc(u.ora) + "</span>" + (id === "ignoto" && !bloccato ? '<span class="v2-pallino" aria-label="nuovo">1</span>' : "") + "</button></li>";
      }).join("") + "</ul>"));
      S.clic("[data-chat]", function (b) {
        var id = b.getAttribute("data-chat");
        if (fase === "apri" && id !== "anna") { S.sbaglio("apri", "Questa è la chat «" + chat[id].nome + "». Cercate quella di «Figlia Anna»."); return; }
        if (fase === "truffa" && id !== "ignoto") { toast("Aprite la chat del numero sconosciuto, in cima all'elenco."); return; }
        if (fase !== "apri" && fase !== "truffa" && fase !== "blocca" && id !== "anna") { toast("Restiamo nella chat di Anna: guardate il fumetto del Professore."); return; }
        if (fase === "apri") { fase = "scrivi"; ctx.bravo("Ecco la chat con Anna."); }
        apriChat(id);
      });
    }

    function bolla(m) {
      var dentro = m.foto ? '<span class="v2-foto-mini">' + m.foto + "</span>" + (m.t ? "<br>" + esc(m.t) : "") :
        m.voce ? '<span class="v2-voce-msg">🎤 ▶︎ <span class="v2-onda">▁▃▅▂▆▃▅▁▃</span> 0:' + (m.voce < 10 ? "0" : "") + m.voce + "</span>" :
        m.sistema ? esc(m.t) : esc(m.t);
      return '<div class="v2-bolla ' + (m.sistema ? "sistema" : m.lei ? "sua" : "mia") + '">' + dentro + '<span class="v2-ora small">' + esc(m.ora) + (m.lei || m.sistema ? "" : " ✓✓") + "</span></div>";
    }

    function apriChat(id) {
      aperta = id;
      var c = chat[id], ignoto = id === "ignoto";
      S.disegna(app(
        '<div class="v2-chat-t"><button type="button" class="v2-icona" data-v2="indietro" aria-label="Torna all\'elenco">←</button><span class="v2-av">' + c.av + "</span>" +
        "<span class=\"v2-chat-txt\"><b>" + esc(c.nome) + '</b><span class="small">' + (ignoto ? "non è nei contatti" : "in linea") + "</span></span>" +
        (ignoto ? "" : '<button type="button" class="v2-icona" data-v2="video" aria-label="Videochiamata">📹</button><button type="button" class="v2-icona" data-v2="voce" aria-label="Chiamata">📞</button>') + "</div>" +
        (ignoto ? '<div class="v2-avviso-chat">⚠️ Questo numero non è tra i vostri contatti.<div class="row"><button type="button" class="btn ghost" data-v2="aggiungi">➕ Aggiungi ai contatti</button>' +
          '<button type="button" class="btn danger" data-v2="blocca">🚫 Blocca e segnala</button></div></div>' : "") +
        '<div class="v2-messaggi" id="v2-msgs">' + c.msg.map(bolla).join("") + "</div>" +
        '<div id="v2-sotto"></div>' +
        (ignoto ? "" : '<form class="v2-scrivi" id="v2-scrivi"><button type="button" class="v2-icona" data-v2="allega" aria-label="Allega">📎</button>' +
          '<input id="v2-testo" class="v2-input" autocomplete="off" placeholder="Scrivete un messaggio" aria-label="Messaggio">' +
          '<span class="v2-registra" id="v2-reg" aria-live="polite" hidden></span>' +
          '<button type="submit" class="v2-icona v2-invia" aria-label="Invia">➤</button>' +
          '<button type="button" class="v2-icona v2-mic" id="v2-mic" aria-label="Tenete premuto per registrare">🎤</button></form>' +
          '<div class="v2-aiuto" data-v2-aiuto="v2-testo"></div>')));
      fondo();
      S.clic("[data-v2=indietro]", function () {
        if (fase === "truffa" || fase === "blocca" || (fase === "apri")) { lista(); return; }
        toast("Restiamo nella chat di Anna: guardate il fumetto del Professore.");
      });
      if (ignoto) { legaIgnoto(); return; }
      S.clic("[data-v2=voce]", function () { toast("Oggi proviamo la videochiamata: è la telecamera 📹 qui accanto."); });
      S.clic("[data-v2=video]", function () {
        if (fase !== "video") { toast("Ci arriviamo tra poco: guardate il fumetto del Professore."); return; }
        video();
      });
      S.clic("[data-v2=allega]", function () {
        if (fase !== "foto") { toast(fase === "scrivi" ? "Prima scriviamo un messaggio: la foto viene dopo." : "Guardate il fumetto del Professore per il passo di adesso."); return; }
        allega();
      });
      S.invio("#v2-scrivi", function () {
        var t = S.valore("v2-testo").replace(/^\s+|\s+$/g, "");
        if (t.length < 2) {
          S.sbaglio("v2-testo", "Prima scrivete qualcosa nel riquadro bianco in basso, poi premete la freccia ➤.", function () { S.scrivi("v2-testo", "Ciao Anna, come stai?"); });
          return;
        }
        manda({ t: t, ora: "adesso" });
        S.scrivi("v2-testo", "");
        if (fase === "scrivi") {
          fase = "attesa";
          ctx.bravo("Messaggio inviato! Le due spunte ✓✓ vogliono dire che è arrivato.");
          S.dopo(1500, function () {
            arriva("anna", { lei: true, t: "Ciao! Tutto bene, grazie 😊 Mi mandi una foto dei fiori del balcone?", ora: "adesso" });
            fase = "foto";
            ctx.passo("Anna vi chiede una foto. Premete la graffetta 📎, scegliete «Galleria» e poi la foto dei fiori.");
          });
        }
      });
      legaMicrofono();
    }

    function fondo() { var m = S.el("#v2-msgs"); if (m) m.scrollTop = m.scrollHeight; }
    function manda(m) { chat.anna.msg.push(m); var c = S.el("#v2-msgs"); if (c && aperta === "anna") { c.insertAdjacentHTML("beforeend", bolla(m)); fondo(); } }
    function arriva(id, m) { chat[id].msg.push(m); var c = S.el("#v2-msgs"); if (c && aperta === id) { c.insertAdjacentHTML("beforeend", bolla(m)); fondo(); } }

    /* Foto dalla galleria */
    function allega() {
      var sotto = S.el("#v2-sotto");
      sotto.innerHTML = '<div class="v2-foglio"><p><b>Cosa volete inviare?</b></p><div class="v2-tre">' +
        '<button type="button" class="v2-tasto" data-alleg="galleria">🖼️<span>Galleria</span></button>' +
        '<button type="button" class="v2-tasto" data-alleg="foto">📷<span>Fotocamera</span></button>' +
        '<button type="button" class="v2-tasto" data-alleg="doc">📄<span>Documento</span></button></div></div>';
      S.vedi(sotto);
      S.clic("[data-alleg]", function (b) {
        if (b.getAttribute("data-alleg") !== "galleria") { toast("La fotocamera scatta una foto nuova. Qui la foto c'è già: scegliete «Galleria»."); return; }
        galleria();
      });
    }

    function galleria() {
      var sotto = S.el("#v2-sotto");
      sotto.innerHTML = '<div class="v2-foglio"><p><b>🖼️ Galleria</b> — toccate la foto da inviare</p><div class="v2-galleria">' +
        FOTO.map(function (f) { return '<button type="button" class="v2-fotina" data-foto="' + f.id + '"><span class="v2-emoji">' + f.e + "</span><span class=\"small\">" + esc(f.t) + "</span></button>"; }).join("") + "</div></div>";
      S.vedi(sotto);
      S.clic("[data-foto]", function (b) {
        var f = b.getAttribute("data-foto");
        if (f !== "fiori") {
          if (S.sbaglio("foto", "Anna ha chiesto la foto dei fiori del balcone 🌷.") >= 2) { var g = S.el('[data-foto="fiori"]'); if (g) g.classList.add("v2-indica"); }
          return;
        }
        sotto.innerHTML = '<div class="v2-foglio v2-anteprima"><span class="v2-emoji grande">🌷</span><p>Fiori del balcone</p>' +
          '<div class="row"><button type="button" class="btn" data-v2="mandafoto">➤ Invia la foto</button><button type="button" class="btn ghost" data-v2="annulla">Annulla</button></div></div>';
        ctx.bravo("Ecco i fiori del balcone!");
        ctx.passo("Ecco l'anteprima della foto. Se è quella giusta, premete «Invia la foto».");
        S.vedi(sotto);
        S.clic("[data-v2=annulla]", function () { galleria(); });
        S.clic("[data-v2=mandafoto]", function () {
          sotto.innerHTML = "";
          manda({ foto: "🌷", t: "", ora: "adesso" });
          fase = "attesa";
          ctx.bravo("Foto inviata!");
          S.dopo(1400, function () {
            arriva("anna", { lei: true, t: "Che belli! 🌷 Grazie!", ora: "adesso" });
            S.dopo(1400, codiceLuisa);
          });
        });
      });
    }

    /* Trappola 1: il codice di verifica chiesto da un'amica */
    function codiceLuisa() {
      fase = "codice";
      chat.luisa.msg.push({ lei: true, t: "Scusa, ti ho mandato per sbaglio un codice di 6 cifre per SMS. Me lo rimandi qui? È urgente!", ora: "adesso" });
      S.tel({ titolo: "Messaggi", mittente: "Chiacchiere", testo: "Il vostro codice di verifica è 314 159. Non condividetelo con nessuno." });
      var sotto = S.el("#v2-sotto");
      if (!sotto) return;
      sotto.innerHTML = '<div class="v2-banner">💬 <b>Luisa (amica):</b> «Scusa, ti ho mandato per sbaglio un codice di 6 cifre per SMS. Me lo rimandi qui? È urgente!»</div><div id="v2-dom-luisa"></div>';
      ctx.passo("Due messaggi insieme: un codice sul telefono e una richiesta di Luisa. Cosa fate?");
      S.scelte("#v2-dom-luisa", "luisa", "Luisa vi chiede il codice arrivato per SMS. Cosa fate?", [
        { t: "📤 Le mando il codice: è un'amica", msg: "No: quel codice serve a entrare nel VOSTRO profilo. Chi lo chiede vuole rubarvelo, anche se scrive con il nome di un'amica." },
        { t: "🙅 Non lo mando a nessuno e telefono a Luisa per avvisarla", ok: true, msg: "Giusto: i codici di verifica non si danno a nessuno.",
          spiega: "Giusto! Il codice serve a entrare nel <b>vostro</b> profilo. Probabilmente qualcuno ha rubato il profilo di Luisa e ora prova con voi. <b>Non mandatelo</b> e telefonate a Luisa per avvisarla." },
        { t: "🔢 Le mando solo metà del codice", msg: "Neanche metà: non si condivide nessuna parte del codice." }
      ], function () {
        S.tel(null);
        S.dopo(2200, function () {
          var s = S.el("#v2-sotto"); if (s) s.innerHTML = "";
          fase = "vocale";
          ctx.passo("Ora mandiamo un messaggio vocale ad Anna. Tenete premuto il microfono 🎤, dite qualcosa, poi lasciate. Oppure: un clic per iniziare e un clic per inviare.");
          S.vedi("#v2-mic");
        });
      });
    }

    /* Messaggio vocale: tenere premuto (oppure due clic) */
    function legaMicrofono() {
      var mic = S.el("#v2-mic"); if (!mic) return;
      var inizio = 0, timer = null, modo = null, tocco = false;
      /* lo stato prende il posto del campo di testo: il microfono non si sposta sotto il dito */
      function stato(t) {
        var r = S.el("#v2-reg"), i = S.el("#v2-testo"); if (!r || !i) return;
        r.textContent = t || ""; r.hidden = !t; i.hidden = !!t;
      }
      function sec() { return Math.max(1, Math.round((Date.now() - inizio) / 1000)); }
      function parti() {
        inizio = Date.now(); mic.classList.add("v2-rec");
        stato("🔴 0:01 · registrazione…");
        timer = setInterval(function () {
          if (!S.vivo()) { clearInterval(timer); return; }
          stato("🔴 0:" + (sec() < 10 ? "0" : "") + sec() + (modo === "tocco" ? " · premete di nuovo 🎤 per inviare" : " · lasciate per inviare"));
        }, 250);
      }
      function ferma() {
        clearInterval(timer); mic.classList.remove("v2-rec"); stato("");
        var s = sec(); modo = null;
        manda({ voce: Math.min(s, 59), ora: "adesso" });
        fase = "attesa";
        ctx.bravo("Messaggio vocale inviato!");
        S.dopo(1600, function () {
          arriva("anna", { lei: true, t: "Che bello sentire la tua voce! ❤️ Chiamami in video quando vuoi.", ora: "adesso" });
          fase = "video";
          ctx.passo("Anna vi aspetta. Premete la telecamera 📹 in alto per fare una videochiamata.");
        });
      }
      function giu(e) {
        if (e && e.type === "touchstart") tocco = true;
        else if (tocco && e && e.type === "mousedown") return;
        if (e && e.preventDefault) e.preventDefault();
        if (!S.vivo()) return;
        if (fase !== "vocale") { toast(fase === "video" ? "Ora proviamo la videochiamata: premete 📹 in alto." : "Il vocale lo proviamo tra poco: guardate il fumetto del Professore."); return; }
        if (modo === "tocco") { ferma(); return; }
        if (modo) return;
        modo = "tieni"; parti();
      }
      function su(e) {
        if (tocco && e && e.type === "mouseup") return;
        if (modo !== "tieni") return;
        if (Date.now() - inizio >= 1000) ferma();
        else { modo = "tocco"; stato("🔴 Registrazione · premete di nuovo 🎤 per inviare"); }
      }
      mic.addEventListener("mousedown", giu);
      mic.addEventListener("touchstart", giu);
      mic.addEventListener("mouseup", su);
      mic.addEventListener("mouseleave", su);
      mic.addEventListener("touchend", su);
      mic.addEventListener("keydown", function (e) { if ((e.key === "Enter" || e.key === " ") && !e.repeat) giu(e); });
      mic.addEventListener("keyup", function (e) { if (e.key === "Enter" || e.key === " ") su(e); });
    }

    /* Videochiamata finta */
    function video() {
      fase = "in-video";
      var muto = false, cam = true, collegata = false;
      S.disegna(app('<div class="v2-video" id="v2-video"><div class="v2-lei"><span class="v2-emoji enorme">👩</span><b>Anna</b><span class="v2-stato" id="v2-vstato">Chiamata in corso…</span></div>' +
        '<div class="v2-io" id="v2-io">🙂<span class="small">Voi</span></div>' +
        '<div class="v2-vtasti"><button type="button" class="v2-vt" data-v2="muto" aria-label="Microfono">🎤</button>' +
        '<button type="button" class="v2-vt" data-v2="cam" aria-label="Fotocamera">📷</button>' +
        '<button type="button" class="v2-vt rosso" data-v2="chiudi" aria-label="Chiudi la chiamata">📞</button></div></div>'));
      ctx.passo("La chiamata sta partendo… aspettate che Anna risponda.");
      S.dopo(1800, function () {
        collegata = true;
        var st = S.el("#v2-vstato"); if (st) st.textContent = "0:01 · collegati";
        ctx.passo("Ecco Anna! Salutatela. Sotto ci sono i tasti: microfono, fotocamera e quello rosso per chiudere. Quando avete finito, premete il pulsante rosso.");
        var t = 1;
        var iv = setInterval(function () {
          if (!S.vivo() || !S.el("#v2-vstato")) { clearInterval(iv); return; }
          t++; S.el("#v2-vstato").textContent = "0:" + (t < 10 ? "0" : "") + Math.min(t, 59) + " · collegati";
        }, 1000);
      });
      S.clic("[data-v2=muto]", function (b) { muto = !muto; b.classList.toggle("spento", muto); b.textContent = muto ? "🔇" : "🎤"; toast(muto ? "Microfono spento: Anna non vi sente. Premete di nuovo per riaccenderlo." : "Microfono acceso: Anna vi sente."); });
      S.clic("[data-v2=cam]", function (b) { cam = !cam; b.classList.toggle("spento", !cam); var io = S.el("#v2-io"); if (io) io.classList.toggle("buio", !cam); toast(cam ? "Fotocamera accesa: Anna vi vede." : "Fotocamera spenta: Anna non vi vede, ma vi sente."); });
      S.clic("[data-v2=chiudi]", function () {
        if (!collegata) { toast("Aspettate un attimo che Anna risponda, poi salutatela."); return; }
        chat.anna.msg.push({ sistema: true, t: "📹 Videochiamata terminata", ora: "adesso" });
        ctx.bravo("Videochiamata chiusa. Facile, vero?");
        fase = "attesa";
        apriChat("anna");
        S.dopo(1800, truffa);
      });
    }

    /* Trappola 2: «Ciao mamma, ho cambiato numero» */
    function truffa() {
      fase = "truffa";
      nuovaChat = true;
      S.tel({ titolo: "Chiacchiere", mittente: SCONOSCIUTO, testo: chat.ignoto.msg[0].t,
        pulsanti: [{ testo: "Apri", azione: function () { S.tel(null); apriChat("ignoto"); } }] });
      ctx.passo("È arrivato un messaggio da un numero che non conoscete. Tornate all'elenco con la freccia ← e apritelo (oppure premete «Apri» sul telefono).");
    }

    function legaIgnoto() {
      S.tel(null);
      S.clic("[data-v2=indietro]", function () { lista(); });
      S.clic("[data-v2=aggiungi]", function () {
        S.sbaglio("aggiungi", "No: non aggiungete ai contatti un numero sospetto. Prima si verifica chi è, chiamando la persona al numero che conoscete.");
      });
      S.clic("[data-v2=blocca]", function () { chiediBlocco(); });
      if (bloccato) return;
      if (!chiamato) {
        ctx.passo("Leggete bene il messaggio. Scrive con il nome di vostra figlia… ma da un numero nuovo, e chiede soldi con urgenza. Cosa fate?");
        S.scelte("#v2-sotto", "ignoto", "«Ciao mamma, ho cambiato numero… mi serve un bonifico urgente». Cosa fate?", [
          { t: "💸 Faccio subito il bonifico: è urgente!", msg: "Fermi! È la truffa del «finto figlio»: l'urgenza serve a non farvi pensare. Non si paga." },
          { t: "💬 Rispondo e chiedo i dati per il bonifico", msg: "No: rispondendo date corda al truffatore, che vi manderà un IBAN suo. Non si paga." },
          { t: "📞 Chiamo Anna al suo numero di sempre", ok: true, msg: "Giusto: verificate sempre chiamando il numero che conoscete.",
            spiega: "Giusto! Chiamate la persona al <b>numero che avete sempre usato</b>, anche se il messaggio dice di non farlo. In alternativa, fatele una domanda che solo lei sa." }
        ], function () {
          chiamato = true;
          S.dopo(1500, function () {
            var d = S.el("#v2-sotto");
            if (d) d.insertAdjacentHTML("beforeend", '<div class="v2-banner ok">📞 Anna risponde dal numero di sempre: «Ma io non ho cambiato numero! Sto benissimo. È una truffa, non mandare niente!»</div>');
            S.vedi(".v2-banner.ok");
            if (bloccato) chiudi();
            else { ctx.passo("Era proprio una truffa. Ora bloccate questo numero: premete «🚫 Blocca e segnala» in alto."); S.dopo(2500, function () { S.vedi(".v2-avviso-chat"); }); }
          });
        });
      }
    }

    function chiediBlocco() {
      if (bloccato) { toast("Questo numero è già bloccato."); return; }
      var d = S.el(".v2-avviso-chat");
      if (!d) return;
      d.innerHTML = '<div class="v2-dialogo" role="dialog" aria-label="Bloccare il numero?"><p><b>Bloccare ' + esc(SCONOSCIUTO) + "?</b><br>Non potrà più chiamarvi né scrivervi. La segnalazione aiuta a fermarlo anche per gli altri.</p>" +
        '<div class="row"><button type="button" class="btn danger" data-v2="si-blocca">🚫 Blocca e segnala</button><button type="button" class="btn ghost" data-v2="no-blocca">Annulla</button></div></div>';
      S.clic("[data-v2=no-blocca]", function () { apriChat("ignoto"); });
      S.clic("[data-v2=si-blocca]", function () {
        bloccato = true;
        chat.ignoto.msg.push({ sistema: true, t: "🚫 Avete bloccato e segnalato questo numero", ora: "adesso" });
        d.innerHTML = '<div class="notice ok">🚫 Numero bloccato e segnalato.</div>';
        var m = S.el("#v2-msgs"); if (m) { m.insertAdjacentHTML("beforeend", bolla(chat.ignoto.msg[chat.ignoto.msg.length - 1])); fondo(); }
        ctx.bravo("Numero bloccato e segnalato.");
        if (chiamato) chiudi();
        else ctx.passo("Bene, bloccato. Ma se fosse davvero Anna? Rispondete alla domanda: cosa si fa per esserne sicuri?");
      });
    }

    function chiudi() {
      fase = "fine";
      S.dopo(1600, function () {
        ctx.fine({
          messaggio: "Bravissimi! Avete scritto ad Anna, mandato una foto e un vocale, fatto una videochiamata e smascherato due truffe.",
          consigli: [
            "Chi «ha cambiato numero» e chiede soldi è quasi sempre un truffatore: chiamate la persona al numero che conoscete, o fatele una domanda che solo lei sa.",
            "Non pagate mai per fretta: l'urgenza è il trucco preferito dei truffatori.",
            "I codici di verifica che arrivano per SMS non si mandano a nessuno, nemmeno agli amici.",
            "Bloccate e segnalate i numeri sospetti; non aggiungeteli ai contatti.",
            "Prima di inviare una foto guardate l'anteprima: si può sempre annullare.",
            "In videochiamata i tasti sono sempre gli stessi: microfono, fotocamera e il rosso per chiudere."
          ]
        });
      });
    }

    S.url("https://web.chiacchiereprova.it");
    lista();
    ctx.passo("Questa è «Chiacchiere», un'app per messaggi simile a quelle che usate sul telefono. Ecco l'elenco delle chat: aprite quella di «Figlia Anna».");
  }

  /* ========================================================================
   *  6) LA POSTA ELETTRONICA — «PostaFacile prova»
   * ====================================================================== */
  var EMAIL = [
    { id: "giulia", da: "Giulia (nipote)", ind: "giulia.nipote@postafacile.prova", oggetto: "La foto del lago?", ora: "10:05",
      corpo: "<p>Ciao! Come stai? Ti ricordi la gita al lago dell'estate scorsa? Mi mandi la foto che avevi fatto tu? La voglio stampare per la mia camera.</p><p>Un abbraccio grande,<br>Giulia</p>",
      perche: ["Conoscete la mittente e l'indirizzo è quello di sempre.", "Chiede una foto: niente soldi, niente dati, niente collegamenti.", "Il tono è quello di Giulia, senza fretta."],
      nota: "Anche con i parenti: se un giorno un'email «di famiglia» chiedesse soldi, telefonate prima." },
    { id: "pacco", truffa: true, da: "Spedizioni Veloci", ind: "notifiche@spedizlonl-veloci-ritiro.top", oggetto: "⚠️ Il vostro pacco è in giacenza!", ora: "09:41",
      corpo: '<p><mark class="v2-segno">Gentile cliente</mark>, il suo pacco non è stato consegnato perché l\'indirizzo è incompleto.</p>' +
        '<p>Per riceverlo paghi <mark class="v2-segno">1,99 € di spese</mark> <mark class="v2-segno">entro 24 ore, altrimenti il pacco sarà distrutto</mark>.</p>' +
        '<p><button type="button" class="v2-link">📦 Paga ora e riprogramma la consegna</button></p>',
      segnali: ["L'indirizzo del mittente è strano: «spedizlonl» con la L al posto della I, e finisce con «.top».", "«Gentile cliente»: non sa nemmeno il vostro nome.", "Fretta e minaccia: «entro 24 ore o sarà distrutto».", "Chiede un piccolo pagamento con la carta: serve a rubarne i dati."],
      nota: "Aspettate davvero un pacco? Controllate con il codice di spedizione sul sito del corriere, scrivendo voi l'indirizzo." },
    { id: "farmacia", da: "Farmacia del Borgo", ind: "avvisi@farmaciadelborgo.prova", oggetto: "Il vostro ordine è pronto", ora: "ieri",
      corpo: "<p>Buongiorno,</p><p>il prodotto che avete ordinato al banco martedì è arrivato. Potete ritirarlo in farmacia negli orari di apertura.</p><p>Farmacia del Borgo — Piazza Grande</p>",
      perche: ["È la farmacia dove avete fatto davvero l'ordine.", "Vi invita a passare in negozio: non chiede di pagare online né di cliccare.", "Nessuna fretta, nessuna minaccia."],
      nota: "Se un'email «della farmacia» chiedesse i dati della carta, sarebbe una truffa." },
    { id: "rimborso", truffa: true, da: "Ufficio Rimborsi Fiscali", ind: "rimborsi@fisco-rimborso24.com", oggetto: "Rimborso di 248,50 € a vostro favore", ora: "ieri",
      corpo: '<p>Gentile contribuente,</p><p>dopo i controlli annuali <mark class="v2-segno">lei a diritto</mark> a un rimborso di <b>248,50 €</b>.</p>' +
        '<p>Per riceverlo <mark class="v2-segno">inserisca numero della carta, scadenza, codice CVV e PIN</mark> nel modulo sicuro:</p>' +
        '<p><button type="button" class="v2-link">💶 Ricevi il rimborso</button></p>',
      segnali: ["Errori di italiano: «lei a diritto» senza l'acca.", "Chiede numero della carta, CVV e PIN: nessun ufficio pubblico li chiede per email.", "Per ricevere soldi non serve mai il PIN.", "L'indirizzo «fisco-rimborso24.com» non è quello di un ente pubblico."],
      nota: "I rimborsi veri arrivano sul conto o si vedono nell'area personale del sito ufficiale, a cui si entra scrivendo voi l'indirizzo." },
    { id: "comune", da: "Comune di Borgoprova", ind: "notizie@comune.borgoprova.prova", oggetto: "Festa del paese: il programma", ora: "lun",
      corpo: "<p>Care cittadine e cari cittadini,</p><p>domenica in Piazza Grande c'è la festa del paese: banda alle 17, cena insieme alle 20. L'ingresso è libero.</p><p>L'Ufficio Cultura</p>",
      perche: ["È una notizia pubblica, uguale per tutti.", "Non chiede dati, soldi né di cliccare su qualcosa.", "Il mittente è quello del Comune a cui vi siete iscritti."],
      nota: "Le informazioni utili si possono sempre controllare anche sul sito ufficiale o allo sportello." },
    { id: "premio", truffa: true, da: "SUPER PREMI", ind: "vincite@premio-fortuna.win", oggetto: "CONGRATULAZIONI!!! Avete vinto uno smartphone", ora: "dom",
      corpo: '<p><mark class="v2-segno">CONGRATULAZIONI!!!</mark> Siete il nostro visitatore numero 1.000.000 e avete vinto uno smartphone nuovo!</p>' +
        '<p><mark class="v2-segno">Avete solo 10 minuti</mark> per ritirarlo: <mark class="v2-segno">pagate soltanto 2 € di spedizione</mark>.</p>' +
        '<p><button type="button" class="v2-link">🎁 Ritira il premio</button></p>',
      segnali: ["Non avete partecipato a nessun concorso: nessuno regala niente.", "Maiuscole e punti esclamativi per emozionarvi.", "Fretta: «solo 10 minuti».", "Il «piccolo pagamento» serve a rubare i dati della carta.", "L'indirizzo finisce con «.win»: niente a che vedere con un negozio vero."],
      nota: "Davanti a un premio inatteso, la risposta giusta è: cancellare." }
  ];
  var FILE = [
    { id: "lago", e: "🏞️", nome: "lago.jpg" },
    { id: "torta", e: "🎂", nome: "torta-compleanno.jpg" },
    { id: "documento", e: "🪪", nome: "carta-identita.jpg" }
  ];

  function simPosta(box, ctx) {
    var S = sessione(box, ctx), fase = "esamina", cartella = "arrivo", aperta = null, giudizio = {}, cestino = [], tolte = [], inviate = [], allegato = null;

    S.guida = function () {
      if (fase === "esamina") return aperta ? ".v2-verdetto, [data-v2=torna]" : ".v2-mail.nuova";
      if (fase === "rispondi") return aperta === "giulia" ? "[data-v2=rispondi]" : "[data-mail=giulia], [data-v2=indietro]";
      if (fase === "scrivi") return S.valore("v2-corpo") ? (allegato ? "button[type=submit]" : "[data-v2=allega], [data-file=lago]") : "#v2-corpo";
      if (fase === "elimina") return aperta ? "[data-v2=elimina]" : "[data-cart=arrivo]";
      return { "vai-cestino": "[data-cart=cestino]", svuota: "[data-v2=svuota], [data-v2=si-svuota]" }[fase] || null;
    };
    function trova(id) { for (var i = 0; i < EMAIL.length; i++) if (EMAIL[i].id === id) return EMAIL[i]; return null; }
    function inArrivo() { return EMAIL.filter(function (e) { return cestino.indexOf(e.id) < 0 && tolte.indexOf(e.id) < 0; }); }
    function mancano() { return EMAIL.filter(function (e) { return !giudizio[e.id]; }).length; }

    function guscio(vista) {
      var n = inArrivo().filter(function (e) { return !giudizio[e.id]; }).length;
      S.disegna('<div class="v2-posta"><div class="v2-testata v2-posta-t"><span class="v2-logo">✉️ PostaFacile <small>prova</small></span><span class="small v2-chi">voi@postafacile.prova</span></div>' +
        '<div class="v2-posta-corpo"><nav class="v2-cartelle" aria-label="Cartelle">' +
        '<button type="button" class="v2-cart' + (cartella === "arrivo" ? " attiva" : "") + '" data-cart="arrivo">📥 In arrivo' + (n ? " <b>(" + n + ")</b>" : "") + "</button>" +
        '<button type="button" class="v2-cart' + (cartella === "inviata" ? " attiva" : "") + '" data-cart="inviata">📤 Inviata</button>' +
        '<button type="button" class="v2-cart' + (cartella === "cestino" ? " attiva" : "") + '" data-cart="cestino">🗑️ Cestino' + (cestino.length ? " (" + cestino.length + ")" : "") + "</button></nav>" +
        '<div class="v2-posta-vista" id="v2-vista">' + vista + "</div></div></div>");
      S.clic("[data-cart]", function (b) {
        var c = b.getAttribute("data-cart");
        if (fase === "scrivi") { toast("State scrivendo a Giulia: finite prima l'email, oppure premete «Annulla»."); return; }
        cartella = c; aperta = null;
        elenco();
        if (c === "cestino" && fase === "vai-cestino") {
          fase = "svuota";
          ctx.passo("Ecco il Cestino: le email cancellate restano qui per un po'. Premete «🧹 Svuota il cestino» per eliminarle per sempre.");
        }
      });
    }

    function riga(e, conBadge) {
      var g = giudizio[e.id];
      return '<li><button type="button" class="v2-mail' + (g ? "" : " nuova") + '" data-mail="' + e.id + '">' +
        '<span class="v2-mail-da"><b>' + esc(e.da) + '</b><span class="small muted v2-ora">' + esc(e.ora) + "</span></span>" +
        '<span class="v2-mail-ogg">' + esc(e.oggetto) + "</span>" +
        (conBadge && g ? '<span class="v2-badge ' + (e.truffa ? "truffa" : "sicura") + '">' + (e.truffa ? "⚠️ Truffa" : "✅ Sicura") + "</span>" : "") +
        "</button></li>";
    }

    function elenco() {
      var html;
      if (cartella === "arrivo") {
        var lista = inArrivo();
        html = '<h2 class="v2-h2">📥 Posta in arrivo</h2><ul class="v2-mails">' + lista.map(function (e) { return riga(e, true); }).join("") + "</ul>";
      } else if (cartella === "inviata") {
        html = '<h2 class="v2-h2">📤 Posta inviata</h2>' + (inviate.length ? '<ul class="v2-mails">' + inviate.map(function (m) {
          return '<li><div class="v2-mail"><span class="v2-mail-da"><b>A: Giulia (nipote)</b><span class="small muted v2-ora">adesso</span></span><span class="v2-mail-ogg">' + esc(m.oggetto) + " · 📎 " + esc(m.file) + "</span></div></li>";
        }).join("") + "</ul>" : '<p class="muted">Nessuna email inviata.</p>');
      } else {
        html = '<h2 class="v2-h2">🗑️ Cestino</h2>' + (cestino.length ? '<ul class="v2-mails">' + cestino.map(function (id) { return riga(trova(id), false); }).join("") + "</ul>" +
          '<button type="button" class="btn danger" data-v2="svuota">🧹 Svuota il cestino</button><div id="v2-conferma"></div>' :
          '<p class="muted">Il cestino è vuoto.</p>');
      }
      guscio(html);
      S.clic("[data-mail]", function (b) {
        if (cartella === "cestino") { toast("Questa email è nel cestino. Per eliminarla per sempre premete «Svuota il cestino»."); return; }
        apri(b.getAttribute("data-mail"));
      });
      S.clic("[data-v2=svuota]", chiediSvuota);
    }

    function apri(id) {
      var e = trova(id); aperta = id;
      var g = giudizio[id];
      guscio('<div class="v2-azioni row"><button type="button" class="btn ghost" data-v2="indietro">⬅️ Indietro</button>' +
        '<button type="button" class="btn ghost" data-v2="rispondi">↩️ Rispondi</button>' +
        '<button type="button" class="btn ghost" data-v2="elimina">🗑️ Elimina</button></div>' +
        '<article class="v2-email' + (g ? " v2-svela" : "") + '"><h2 class="v2-h2">' + esc(e.oggetto) + "</h2>" +
        '<div class="v2-mitt"><b>' + esc(e.da) + '</b> <span class="v2-ind">&lt;' + (e.truffa && g ? '<mark class="v2-segno">' + esc(e.ind) + "</mark>" : esc(e.ind)) + "&gt;</span>" +
        '<div class="small muted">A: voi@postafacile.prova · ' + esc(e.ora) + "</div></div>" +
        '<div class="v2-testo">' + e.corpo + "</div></article>" +
        '<div id="v2-giudizio">' + (g ? spiegazione(e) : "") + "</div>");
      S.clic("[data-v2=indietro]", function () { aperta = null; elenco(); dopoIndietro(); });
      S.clic("[data-v2=rispondi]", function () {
        if (fase !== "rispondi") { toast(fase === "esamina" ? "Prima decidiamo se ogni email è sicura o una truffa." : "Guardate il fumetto del Professore per il passo di adesso."); return; }
        if (id !== "giulia") { toast("Dobbiamo rispondere a Giulia: tornate indietro e aprite la sua email."); return; }
        scrivi();
      });
      S.clic("[data-v2=elimina]", function () {
        if (fase !== "elimina") { toast(fase === "esamina" ? "Prima decidete se è sicura o una truffa: poi faremo un po' di pulizia." : "Guardate il fumetto del Professore per il passo di adesso."); return; }
        if (!e.truffa) { S.sbaglio("elimina", "Questa email è vera: meglio tenerla. Scegliete una delle truffe."); return; }
        cestino.push(id); aperta = null;
        fase = "vai-cestino";
        cartella = "arrivo"; elenco();
        ctx.bravo("Truffa eliminata!");
        ctx.passo("L'email è finita nel Cestino, non è ancora sparita. Aprite il «🗑️ Cestino» nell'elenco delle cartelle.");
        S.vedi("[data-cart=cestino]");
      });
      S.clic(".v2-link", function () {
        S.sbaglio("link", "Attenzione: non si preme il pulsante di un'email sospetta! Porta a un sito finto che chiede i dati. Nella prova non succede niente, ma nella vita vera sì.");
      });
      if (!g) {
        var dest = S.el("#v2-giudizio");
        dest.innerHTML = '<div class="v2-domanda card"><p class="v2-dom-t">Secondo voi questa email è…</p><div class="row">' +
          '<button type="button" class="btn big v2-verdetto" data-ver="sicura">✅ Sicura</button>' +
          '<button type="button" class="btn big danger v2-verdetto" data-ver="truffa">⚠️ Truffa</button></div></div>';
        S.clic("[data-ver]", function (b) { giudica(e, b.getAttribute("data-ver") === "truffa"); });
        ctx.passo("Leggete con calma: chi la manda (guardate l'indirizzo vero, tra le parentesi), cosa chiede e se mette fretta. Poi decidete: «Sicura» o «Truffa»?");
      }
    }

    function spiegazione(e) {
      return '<div class="notice ' + (e.truffa ? "" : "ok") + ' v2-spiega-mail"><b>' + (e.truffa ? "⚠️ È una truffa. Ecco i segnali:" : "✅ È sicura, perché:") + "</b><ul>" +
        (e.truffa ? e.segnali : e.perche).map(function (s) { return "<li>" + esc(s) + "</li>"; }).join("") + "</ul><p class=\"small\">💡 " + esc(e.nota) + "</p>" +
        '<button type="button" class="btn" data-v2="torna">⬅️ Torna alla posta in arrivo</button></div>';
    }

    function giudica(e, diceTruffa) {
      giudizio[e.id] = true;
      if (diceTruffa === !!e.truffa) ctx.bravo(e.truffa ? "Giusto: è una truffa!" : "Giusto: è un'email sicura.");
      else ctx.errore(e.truffa ? "Questa volta no: è una truffa. Guardate i segnali evidenziati in giallo." : "In realtà questa è sicura: leggete perché qui sotto.");
      var art = S.el(".v2-email"); if (art) art.classList.add("v2-svela");
      var ind = S.el(".v2-ind"); if (ind && e.truffa) ind.innerHTML = '&lt;<mark class="v2-segno">' + esc(e.ind) + "</mark>&gt;";
      var dest = S.el("#v2-giudizio"); dest.innerHTML = spiegazione(e);
      S.clic("[data-v2=torna]", function () { aperta = null; elenco(); dopoIndietro(); });
      S.vedi(dest);
      var n = mancano();
      if (n) S.dopo(900, function () { if (aperta === e.id) ctx.passo("Leggete i segnali, poi tornate alla posta in arrivo. Mancano ancora " + n + (n === 1 ? " email" : " email") + " da controllare."); });
    }

    function dopoIndietro() {
      if (fase === "esamina") {
        var n = mancano();
        if (n) { ctx.passo("Aprite un'email non ancora controllata (quelle senza bollino). Ne mancano " + n + "."); return; }
        fase = "rispondi";
        ctx.bravo("Avete controllato tutte le email!");
        ctx.passo("Ora rispondiamo a Giulia, che vi ha chiesto la foto del lago: aprite la sua email e premete «↩️ Rispondi».");
      }
    }

    /* Risposta a Giulia con allegato */
    function scrivi() {
      fase = "scrivi"; allegato = null;
      guscio('<form class="v2-modulo v2-nuova" id="v2-risposta" novalidate><h2 class="v2-h2">↩️ Rispondi</h2>' +
        '<div class="v2-campo"><label>A</label><div class="v2-fisso">Giulia (nipote) &lt;giulia.nipote@postafacile.prova&gt;</div></div>' +
        '<div class="v2-campo"><label>Oggetto</label><div class="v2-fisso">Re: La foto del lago?</div></div>' +
        campo("v2-corpo", "Testo", { area: true, righe: 4, ph: "Es. Ciao Giulia, ecco la foto del lago!" }) +
        '<div class="v2-campo"><span class="v2-etichetta">Allegati</span><div id="v2-allegati" class="v2-allegati"><span class="muted small">Nessun allegato</span></div>' +
        '<div class="v2-aiuto" data-v2-aiuto="allegato"></div></div>' +
        '<div id="v2-scegli"></div>' +
        '<div class="row"><button type="button" class="btn ghost big" data-v2="allega">📎 Allega un file</button>' +
        '<button type="submit" class="btn big">➤ Invia</button>' +
        '<button type="button" class="btn ghost" data-v2="annulla">Annulla</button></div></form>');
      ctx.passo("Scrivete due righe a Giulia, poi premete «📎 Allega un file» e scegliete la foto del lago. Infine «➤ Invia».");
      S.clic("[data-v2=annulla]", function () { fase = "rispondi"; apri("giulia"); });
      S.clic("[data-v2=allega]", sceltaFile);
      S.invio("#v2-risposta", function () {
        var t = S.valore("v2-corpo").replace(/^\s+|\s+$/g, "");
        if (t.length < 3) {
          S.sbaglio("v2-corpo", "Scrivete qualche parola per Giulia nel riquadro «Testo», per esempio «Ciao Giulia, ecco la foto!».", function () { S.scrivi("v2-corpo", "Ciao Giulia, ecco la foto del lago! Un abbraccio"); });
          return;
        }
        if (!allegato) {
          S.sbaglio("allegato", "Manca l'allegato! Succede spesso: premete «📎 Allega un file» e scegliete la foto del lago.", function () { allega(FILE[0]); });
          return;
        }
        inviate.push({ oggetto: "Re: La foto del lago?", file: allegato.nome });
        fase = "elimina";
        cartella = "inviata"; elenco();
        var v = S.el("#v2-vista"); if (v) v.insertAdjacentHTML("afterbegin", '<div class="notice ok">✅ Email inviata a Giulia, con la foto del lago.</div>');
        ctx.bravo("Email inviata con la foto!");
        S.dopo(1500, function () {
          ctx.passo("Ultima cosa: facciamo pulizia. Tornate in «📥 In arrivo», aprite una delle truffe e premete «🗑️ Elimina».");
        });
      });
    }

    function sceltaFile() {
      var d = S.el("#v2-scegli");
      d.innerHTML = '<div class="v2-foglio"><p><b>📁 Cartella Immagini</b> — scegliete il file da allegare</p><div class="v2-galleria">' +
        FILE.map(function (f) { return '<button type="button" class="v2-fotina" data-file="' + f.id + '"><span class="v2-emoji">' + f.e + '</span><span class="small">' + esc(f.nome) + "</span></button>"; }).join("") + "</div></div>";
      S.vedi(d);
      S.clic("[data-file]", function (b) {
        var id = b.getAttribute("data-file");
        if (id === "documento") { S.sbaglio("file", "Quella è la foto della carta d'identità! I documenti non si mandano per email se non è proprio necessario, e mai a chi li chiede senza motivo. Scegliete la foto del lago."); return; }
        if (id !== "lago") { S.sbaglio("file", "Giulia ha chiesto la foto del lago 🏞️."); return; }
        allega(FILE[0]);
        ctx.bravo("Foto allegata!");
      });
    }

    function allega(f) {
      allegato = f;
      var a = S.el("#v2-allegati"); if (a) a.innerHTML = '<span class="v2-chip">' + f.e + " " + esc(f.nome) + "</span>";
      var d = S.el("#v2-scegli"); if (d) d.innerHTML = "";
      var h = S.el('[data-v2-aiuto="allegato"]'); if (h) h.innerHTML = "";
    }

    /* Svuotare il cestino */
    function chiediSvuota() {
      if (fase !== "svuota") { toast("Guardate il fumetto del Professore per il passo di adesso."); return; }
      var d = S.el("#v2-conferma");
      d.innerHTML = '<div class="v2-dialogo" role="dialog" aria-label="Svuotare il cestino?"><p><b>Svuotare il cestino?</b><br>Le email che contiene verranno cancellate per sempre.</p>' +
        '<div class="row"><button type="button" class="btn danger" data-v2="si-svuota">Sì, svuota</button><button type="button" class="btn ghost" data-v2="no-svuota">Annulla</button></div></div>';
      S.vedi(d);
      S.clic("[data-v2=no-svuota]", function () { d.innerHTML = ""; });
      S.clic("[data-v2=si-svuota]", function () {
        tolte = tolte.concat(cestino); cestino = [];
        fase = "fine";
        elenco();
        ctx.bravo("Cestino vuoto!");
        S.dopo(1400, function () {
          ctx.fine({
            messaggio: "Bravissimi! Avete riconosciuto le email vere e le truffe, risposto a Giulia con la foto e fatto pulizia nella posta.",
            consigli: [
              "Guardate sempre l'indirizzo vero del mittente, tra le parentesi, non solo il nome.",
              "Diffidate di fretta, minacce, premi, rimborsi e piccoli pagamenti da fare subito.",
              "Non premete collegamenti e non aprite allegati inattesi. Se avete un dubbio, andate sul sito scrivendo voi l'indirizzo o telefonate a un numero che conoscete.",
              "Nessun ente serio vi chiede per email password, PIN o i dati della carta.",
              "Prima di premere «Invia» controllate di aver messo l'allegato, e non mandate foto dei documenti se non serve.",
              "Le email cancellate vanno nel Cestino: svuotatelo ogni tanto."
            ]
          });
        });
      });
    }
    S.url("https://posta.postafacileprova.it/in-arrivo");
    elenco();
    ctx.passo("Ecco la vostra casella di posta di prova, con 6 email. Alcune sono vere, altre sono truffe. Apritele una alla volta e decidete.");
  }

  /* ------------------------------------------------------------------------
   *  Registrazione nella Palestra della vita digitale
   * ---------------------------------------------------------------------- */
  PD.vita.registra({
    id: "banca", icona: "🏦", titolo: "La banca online", ordine: 4, durata: "15 minuti", digcomp: ["2.2", "4.2"],
    descrizione: "Entrare nel conto della «Banca del Borgo», leggere saldo e movimenti, fare un bonifico al nipote e riconoscere le false chiamate della banca.",
    avvia: simBanca
  });
  PD.vita.registra({
    id: "messaggi", icona: "💬", titolo: "Messaggi e videochiamate", ordine: 5, durata: "10 minuti", digcomp: ["2.1", "4.2"],
    descrizione: "Scrivere alla figlia, mandare una foto e un vocale, fare una videochiamata e smascherare il finto «ho cambiato numero».",
    avvia: simMessaggi
  });
  PD.vita.registra({
    id: "posta", icona: "📧", titolo: "La posta elettronica", ordine: 6, durata: "15 minuti", digcomp: ["2.1", "4.2", "1.2"],
    descrizione: "Riconoscere 3 email vere e 3 truffe, rispondere alla nipote con una foto allegata e svuotare il cestino.",
    avvia: simPosta
  });
})();
