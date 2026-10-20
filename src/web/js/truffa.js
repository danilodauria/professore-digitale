/* ==============================================================================
 *  PROFESSORE DIGITALE - «È una truffa?»
 *  L'allievo incolla, scrive o detta un SMS, un'email, un messaggio o racconta una telefonata:
 *  un motore a regole (offline) cerca i segnali tipici delle truffe, li evidenzia nel testo
 *  e spiega cosa fare. Facoltativo: un secondo parere dall'IA locale.
 *  Nello storico si salvano solo data, tipo, esito e un'anteprima breve (mai il testo intero).
 *  JavaScript puro (ES5). Ideato e sviluppato da Danilo D'Auria - Licenza MIT
 * ============================================================================== */
(function () {
  "use strict";
  var PD = window.PD, $ = PD.$, $$ = PD.$$, esc = PD.esc;

  /* ------------------------------------------------------------------------
   *  Normalizzazione: minuscole, senza accenti, spazi compattati.
   *  pos[i] = posizione nel testo originale del carattere i del testo normalizzato
   *  (serve per evidenziare nel testo vero le parti trovate).
   * ---------------------------------------------------------------------- */
  var ACC = { "à": "a", "á": "a", "â": "a", "ä": "a", "ã": "a", "è": "e", "é": "e", "ê": "e", "ë": "e", "ì": "i", "í": "i", "î": "i", "ï": "i",
    "ò": "o", "ó": "o", "ô": "o", "ö": "o", "õ": "o", "ù": "u", "ú": "u", "û": "u", "ü": "u", "ç": "c", "ñ": "n",
    "’": "'", "‘": "'", "`": "'", "´": "'", "“": '"', "”": '"', "«": '"', "»": '"', "€": "€" };
  function normalizza(t) {
    var s = "", pos = [], spazio = true;
    t = String(t || "");
    for (var i = 0; i < t.length; i++) {
      var c = t.charAt(i);
      if (/\s/.test(c)) { if (!spazio) { s += " "; pos.push(i); } spazio = true; continue; }
      if (/[̀-ͯ]/.test(c)) continue;
      var l = c.toLowerCase(); if (l.length !== 1) l = c;
      s += ACC[l] || l; pos.push(i); spazio = false;
    }
    return { s: s, pos: pos };
  }

  /* ------------------------------------------------------------------------
   *  Collegamenti e domini
   * ---------------------------------------------------------------------- */
  var TLD_NOTI = "it com net org eu info biz gov edu io ly gl gd top xyz click link online site shop store live icu ru cn tk ml ga cf gq buzz cfd sbs vip club win loan bid rest lol support help pw su work kim fun space ws cc app uk fr ch nl pl ro".split(" ");
  var TLD_STRANI = "top xyz click link online site shop store live icu ru cn tk ml ga cf gq buzz cfd sbs vip club win loan bid rest lol support help pw su work kim fun space ws cc info".split(" ");
  var ACCORCIATORI = "bit.ly tinyurl.com t.ly cutt.ly is.gd goo.gl ow.ly rb.gy shorturl.at t.co s.id rebrand.ly tiny.cc bit.do qrco.de tny.sh shorturl.it".split(" ");
  var MARCHI = "poste bancoposta postepay inps agenziaentrate agenzia-entrate entrate amazon paypal intesa sanpaolo unicredit bper bnl fineco nexi telepass enel dhl brt bartolini sda gls fedex inpost apple icloud microsoft netflix carabinieri polizia spid ministero banca bank".split(" ");
  /* domini ufficiali (o loro sottodomini): il marchio qui dentro è normale */
  var UFFICIALI = "poste.it posteitaliane.it inps.it agenziaentrate.gov.it gov.it amazon.it amazon.com paypal.com paypal.it intesasanpaolo.com unicredit.it bper.it bnl.it mps.it fineco.it finecobank.com nexi.it telepass.com enel.it dhl.com dhl.it brt.it sda.it gls-italy.com ups.com fedex.com inpost.it apple.com icloud.com microsoft.com netflix.com carabinieri.it poliziadistato.it commissariatodips.it".split(" ");
  var POSTA_GRATUITA = /^(gmail\.com|libero\.it|hotmail\.(com|it)|outlook\.(com|it)|yahoo\.(com|it)|virgilio\.it|alice\.it|tiscali\.it|live\.(com|it)|aol\.com|icloud\.com|proton\.me|protonmail\.com|mail\.ru|gmx\.(com|net|de))$/;

  function dominioRegistrato(host) {
    var p = host.split(".");
    if (p.length >= 3 && /^(gov|co|com|org|net|edu)$/.test(p[p.length - 2])) return p.slice(-3).join(".");
    return p.slice(-2).join(".");
  }
  function ufficiale(host) {
    for (var i = 0; i < UFFICIALI.length; i++) {
      var u = UFFICIALI[i];
      if (host === u || host.slice(-(u.length + 1)) === "." + u) return true;
    }
    return false;
  }
  /* motivi per cui un indirizzo è sospetto (vuoto = nessun motivo evidente) */
  function motiviDominio(host, ip) {
    var m = [];
    if (ip) { m.push("è fatto solo di numeri (i siti veri hanno un nome)"); return m; }
    var reg = dominioRegistrato(host), tld = host.split(".").pop();
    if (ACCORCIATORI.indexOf(host.replace(/^www\./, "")) >= 0) { m.push("è un indirizzo «accorciato», che nasconde il sito vero"); return m; }
    if (ufficiale(host)) return m;
    if (TLD_STRANI.indexOf(tld) >= 0) m.push("finisce con «." + tld + "», un finale poco usato dagli enti e dalle aziende italiane");
    var nome = reg.slice(0, reg.length - tld.length - 1);
    var marchio = null;
    for (var i = 0; i < MARCHI.length; i++) if (host.indexOf(MARCHI[i]) >= 0) { marchio = MARCHI[i]; break; }
    if (marchio) m.push("contiene il nome «" + marchio + "», ma non è l'indirizzo ufficiale: è un'imitazione");
    else if ((nome.match(/-/g) || []).length >= 2) m.push("ha molti trattini, tipico degli indirizzi falsi");
    if (/(verifica|sicurezza|sblocc|rimborso|assistenza|login|accesso|conferma|aggiorn|premi|giacenza|consegna|secure|verify|account|update)/.test(nome) && !marchio)
      m.push("contiene parole come «verifica», «sicurezza» o «rimborso»: gli indirizzi veri non sono fatti così");
    return m;
  }
  /* trova i collegamenti e gli indirizzi email nel testo normalizzato */
  function trovaLink(s) {
    var out = [], re = /(https?:\/\/)?((?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+([a-z]{2,12}))(?::\d+)?(\/[^\s"'<>]*)?/g, m;
    while ((m = re.exec(s))) {
      var prima = m.index > 0 ? s.charAt(m.index - 1) : "";
      var host = m[2], email = prima === "@";
      if (!m[1] && !email && !/^www\./.test(host) && TLD_NOTI.indexOf(m[3]) < 0) continue;
      if (/[a-z0-9_.-]/.test(prima) && !email) continue;
      var fine = m.index + m[0].length;
      while (fine > m.index && /[.,;:!?)\]]/.test(s.charAt(fine - 1))) fine--;
      out.push({ a: m.index, b: fine, host: host.replace(/^www\./, "www."), email: email, motivi: motiviDominio(host, false) });
    }
    var reIp = /(https?:\/\/)\d{1,3}(?:\.\d{1,3}){3}(?::\d+)?(\/[^\s]*)?/g;
    while ((m = reIp.exec(s))) out.push({ a: m.index, b: m.index + m[0].length, host: m[0], email: false, motivi: motiviDominio("", true) });
    return out;
  }

  /* ------------------------------------------------------------------------
   *  Tabella dei segnali (testo normalizzato: minuscole e senza accenti)
   * ---------------------------------------------------------------------- */
  var VERBI_RICHIESTA = "(comunic|forni|dett|ditt|dic[ae]|dir(mi|ci|le|e)|dimmi|invi|mand|inser|conferm|legg|ripet|digit|compil|scriv|indic|aggiorn|verific|serv|ser?ve|chied|dar(e|ci|mi)|dat(e|eci)|dia |dacci|fotograf)";
  var SEGRETI = "(codic[ei] (segret|di sicurezza|otp|dispositiv|di verifica|di conferma|di accesso|ricevut|arrivat|che (le|ti|vi|gli) )|\\botp\\b|\\bpin\\b|password|passw|credenziali|nome utente|username|dati (della|delle) (sua |tua |vostra )?cart|numero (della|di) (sua |tua |vostra )?carta|\\bcvv\\b|\\bcvc\\b|codice di sicurezza|scadenza (della )?carta|\\biban\\b|codice spid|credenziali spid)";
  var SEGNALI = [
    { id: "codici", peso: 4, titolo: "Chiede codici, PIN, password o dati della carta",
      spiegazione: "Banca, Poste, enti e forze dell'ordine non chiedono MAI codici, PIN, password o i numeri della carta, né per telefono né per messaggio. Chi li chiede vuole entrare nel vostro conto.",
      re: [new RegExp(VERBI_RICHIESTA + "[^.!?\\n]{0,45}" + SEGRETI, "g"), new RegExp(SEGRETI + "[^.!?\\n]{0,30}(che (le|ti|vi|mi|ci|gli) (e|sono|e stato) (appena )?arrivat|ricevut[oi] (per|via|tramite) sms|ci (serve|servono)|deve (comunicar|dettar|fornir)|da comunicare)", "g"),
        /(il|lo|quel|un) codice che (le|ti|vi|gli|mi|ci) (e |sta |e' |hanno |abbiamo )?(appena )?(arrivat|mandat|inviat)/g, /\b(leggi|legga|leggere|leggerci|leggergli|dettare|dettami|detti|dettargli|mi (dica|legga)|dirgli|dargli|comunicargli) (il|lo|quel) codice/g] },
    { id: "remoto", peso: 5, grave: true, titolo: "Vuole farvi installare un'app per il «controllo a distanza»",
      spiegazione: "Programmi come AnyDesk, TeamViewer o QuickSupport permettono a uno sconosciuto di comandare il vostro telefono o computer e di entrare nella vostra banca. Nessun operatore serio ve li fa installare.",
      re: [/\b(any ?desk|team ?viewer|quick ?support|rust ?desk|ultra ?viewer|airdroid|supremo|splashtop|logmein)\b/g,
        /(assistenza|controllo|accesso|collegamento) (remot[oa]|a distanza)/g, /(install|scaric)[a-z]* (un'|una |l'|questa |la nostra )?(app|applicazione|programma)[^.!?]{0,40}(assistenza|sicurezza|verifica|aiut|antifrode|operator|controll)/g] },
    { id: "contanti", peso: 5, grave: true, titolo: "Chiede di consegnare soldi o gioielli a un «incaricato»",
      spiegazione: "È la truffa del finto carabiniere, avvocato o nipote. Nessun carabiniere, avvocato o tribunale manda qualcuno a casa a ritirare contanti, oro o gioielli. Nel dubbio chiamate il 112.",
      re: [/(contanti|soldi|denaro|gioielli|oro|preziosi|orologi|fedi|collan)[^.!?]{0,90}(incaricat|collega|passer(a|anno|o) (a |da )?(prender|ritirar|da lei|da voi|a casa)|verr(a|anno) (a |da )|ritir|consegn|mandiamo|messo|corriere)/g,
        /(incaricat|collega|corriere|avvocato|maresciallo|carabinier|appuntato)[^.!?]{0,90}(contanti|gioielli|\boro\b|preziosi)/g, /\bcauzione\b/g] },
    { id: "parente", peso: 3, titolo: "Racconta di un parente nei guai (incidente, arresto, ospedale)",
      spiegazione: "Spaventare con la notizia di un figlio o nipote in difficoltà serve a farvi agire d'impulso. Chiudete e chiamate voi il vostro familiare al numero che conoscete.",
      re: [/(nipote|figli[oa]|tuo figlio|suo figlio|vostro figlio|genero|nuora|marito|moglie)[^.!?]{0,70}(incidente|arrestat|fermat|in carcere|in caserma|in ospedale|investit|in stato di fermo|nei guai)/g,
        /(incidente|arrestat|fermat|in caserma)[^.!?]{0,60}(nipote|figli[oa]|genero|nuora)/g] },
    { id: "nuovonumero", peso: 4, titolo: "«Ho cambiato numero» o «il telefono si è rotto»",
      spiegazione: "È l'inizio della truffa «Ciao mamma / Ciao papà»: un estraneo finge di essere un figlio con un numero nuovo e poco dopo chiede soldi. Chiamate vostro figlio al numero vecchio, che conoscete già.",
      re: [/(ho|abbiamo) cambiato (il )?numero|(nuovo|questo e il mio) numero|numero nuovo|(telefono|cellulare|smartphone) [^.!?]{0,30}(rott|cadut|pers[oa]|in riparazione|non funziona)|salva(lo|te|ti)? (questo|il nuovo|il mio nuovo) numero|memorizza (questo|il nuovo) numero|cancella (pure )?il (vecchio|mio vecchio) numero/g] },
    { id: "pagamento", peso: 3, titolo: "Chiede un pagamento, un bonifico o una ricarica",
      spiegazione: "Chi chiede di pagare in fretta, con bonifico istantaneo, ricariche, buoni regalo o criptovalute sa che quei soldi non tornano indietro.",
      re: [/(fai|fare|faccia|fate|farmi|effettu|esegu|disporre|disponga|puoi fare|potresti fare|mi fai|mi faresti|mandar|mandami|mandarmi|invia|inviar|versar|pagar|paga|paghi|ricaric)[a-z]*[^.!?]{0,30}(bonifico|ricarica|versamento|pagamento|giroconto|\d+[.,]?\d* ?(euro|€)|€ ?\d+)/g,
        /(bonifico|pagamento|versamento) (urgente|subito|istantaneo|immediato)/g,
        /(buon[oi] (regalo|amazon|google|apple|itunes|steam)|gift ?card|paysafe ?card|ricarica (postepay|paysafe|la carta)|western union|money ?gram|\bbitcoin\b|criptovalut|cripto ?monet|\busdt\b|wallet)/g,
        /mi (servono|serve|servirebbero|servirebbe) [^.!?]{0,25}(soldi|euro|€|\d{2,})/g, /(conto (sicuro|di sicurezza|protetto|temporaneo))/g] },
    { id: "pacco", peso: 3, titolo: "Un pacco «in giacenza» o spese di spedizione da pagare",
      spiegazione: "I finti corrieri scrivono che un pacco è fermo e chiedono pochi euro: in realtà vogliono i dati della vostra carta. Controllate le spedizioni solo dal sito o dall'app dove avete comprato.",
      re: [/in giacenza|giacenza/g, /(pacc[oh]i?|spedizion[ei]|consegna)[^.!?]{0,60}(sospes|bloccat|trattenut|fermo|non (e |e stato |e stata )?(stat[oa] )?consegnat|non (e )?possibile consegnar)/g,
        /(spese|costi|tassa|tasse|dazi|diritti) (di |per la )?(spedizione|sdoganamento|doganal|consegna|riconsegna)/g, /indirizzo (di consegna )?(incomplet|errat|non valid|non corrett)/g, /riprogramma(re|te)? (la )?consegna/g] },
    { id: "premio", peso: 3, titolo: "Promette premi, vincite, regali o rimborsi",
      spiegazione: "Nessuno regala niente a sorpresa. Premi, vincite e «rimborsi a vostro favore» sono un'esca per farvi cliccare o pagare una piccola «spesa».",
      re: [/\b(hai|avete|lei ha|e stato|sei stato|e stata|sei stata|siete stati) (appena )?(vint|selezionat|estratt)/g, /\bha (appena )?vinto (un|una|il|la|\d)[^.!?]{0,25}(premio|buono|smartphone|iphone|telefono|euro|€|viaggio|auto|crociera)/g, /\bvincit(a|e|or)|\bvincer[ea]\b|\bestrazione\b|congratulazioni|complimenti! hai/g,
        /\brimbors[oi]\b|credito a (suo|tuo|vostro) favore|somma a (suo|tuo|vostro) favore|(le|ti|vi) spetta(no)? (un |una |il )?(rimborso|bonus|premio|accredito)|accredito in (attesa|sospeso)/g,
        /(premio|regalo|omaggio|buono) (in palio|per te|per lei|da ritirare|gratuito)|(hai|ha) ricevuto un (premio|regalo|omaggio)/g] },
    { id: "garantito", peso: 3, titolo: "Promette guadagni facili, sicuri o «garantiti»",
      spiegazione: "Nessun investimento serio garantisce guadagni alti e sicuri, né permette di raddoppiare i soldi. Chi lo promette vuole i vostri risparmi.",
      re: [/(guadagn|rendiment|profitt|interess)[a-z]*[^.!?]{0,30}(garantit|sicur[io]|assicurat|facil|da casa|senza rischi|al mese|al giorno|alla settimana)/g,
        /raddoppia(re|te)? (i tuoi |il tuo |i suoi |il suo |i vostri |il vostro )?(soldi|capitale|investimento|risparmi)|senza (alcun )?rischio/g] },
    { id: "investimento", peso: 3, titolo: "Propone investimenti, trading o criptovalute",
      spiegazione: "Trading online e criptovalute proposti da sconosciuti (spesso con finte pubblicità di persone famose o finti consulenti) sono truffe molto diffuse. Per investire parlate con la vostra banca, di persona.",
      re: [/\btrading\b|\bforex\b|piattaforma (di investimento|di trading)|\bbroker\b/g,
        /(investi|investire|investite|investimento)[^.!?]{0,40}(cripto|bitcoin|solo \d+|minimo|\d+ ?(euro|€))/g] },
    { id: "romance", peso: 1, titolo: "Parole d'amore da una persona conosciuta solo online",
      spiegazione: "Chi vi conosce solo via internet e dopo poco parla d'amore, ma non si fa mai vedere in videochiamata, spesso prepara una richiesta di soldi.",
      re: [/amore mio|tesoro mio|ti amo|anima gemella|mio caro amore|mia cara amore|conosciut[io] (su|in) (facebook|instagram|internet|chat|tiktok|un sito)|non vedo l'ora di (conoscerti|abbracciarti)/g] },
    { id: "urgenza", peso: 2, titolo: "Mette fretta: «subito», «entro 24 ore», «ultimo avviso»",
      spiegazione: "La fretta è il primo trucco dei truffatori: vogliono che agiate prima di ragionare o di chiedere a qualcuno. Le cose vere si possono sempre verificare con calma.",
      re: [/entro (le |i |il )?(prossim[ei] )?\d+ ?(ore|h|minuti|giorni|gg)\b|entro (oggi|stasera|domani|la giornata|mezzanotte|fine giornata)|ultimo avviso|ultima (possibilita|occasione|notifica)|immediatamente|\burgent[ei]|\burgenza|al piu presto|scade (oggi|domani|a breve)|solo per oggi|non perdere tempo/g] },
    { id: "minaccia", peso: 2, titolo: "Minaccia blocchi, sospensioni, multe o guai",
      spiegazione: "«Il conto verrà bloccato», «avete una multa», «denuncia a vostro carico»: le minacce servono a spaventare. Banche ed enti non comunicano così e non chiedono di risolvere con un clic.",
      re: [/(verra|sara|e stat[oa]|e|risulta|viene|sono stat[ei]|sono) (temporaneamente |momentaneamente |definitivamente )?(disattivat|sospes|bloccat|limitat|chius|cancellat|disabilitat|scadut)/g,
        /(conto|carta|account|utenza|profilo|servizio|linea|abbonamento|contratto|bancomat|postepay|spid|pratica)[^.!?]{0,30}(sospes|bloccat|limitat|disattivat|scadut|congelat)/g,
        /accesso (anomalo|sospetto|non autorizzato)|attivita (sospett|anomal|insolit|fraudolent)|movimenti (sospett|anomal)|operazion[ei] (sospett|anomal|non autorizzat)|tentativo di accesso/g,
        /\bmult[ae]\b|sanzion|pignorament|azion[ei] legal|denuncia a (suo|tuo|vostro) carico|procedimento penale|mandato di|ufficiale giudiziario/g] },
    { id: "clicca", peso: 2, titolo: "Vi chiede di cliccare o di «verificare i dati»",
      spiegazione: "«Clicca qui», «accedi al link», «aggiorna i tuoi dati»: è così che si arriva su siti falsi che copiano quelli veri. Per entrare nel sito di un ente, digitate voi l'indirizzo o usate l'app ufficiale.",
      re: [/\bclicc|\bclick\b|premi (qui|sul link|il link)|tocca (qui|il link)|apri il link|(accedi|acceda|accedere|entra|entri) (qui|al link|dal link|tramite il link|al seguente)|segui(te)? il link|(al|nel|dal) (seguente )?link|link (qui )?(sotto|in basso|seguente)/g,
        /(verifica|verificare|verifichi|aggiorna|aggiornare|aggiorni|conferma|confermare|confermi|completa|completare|completi|sblocca|sbloccare|sblocchi|riattiva|riattivare|riattivi)[a-z]* (i |il |la |le |l')?(tuoi |suoi |vostri |propri |sua |tua )?(dati|identita|account|profilo|carta|conto|utenza|accesso|modulo|procedura|pagamento)/g] },
    { id: "segreto", peso: 3, titolo: "Chiede di non dirlo a nessuno o di non riattaccare",
      spiegazione: "Chi vi chiede il segreto vuole impedirvi di chiedere aiuto. È proprio il momento di parlarne con una persona di fiducia.",
      re: [/non (lo )?(dir(lo|e|gli)?|dica|dite|dica niente|dire niente|parlarne|ne parli|ne parlate|raccontar(lo|e)?|lo dica|lo dite|dirlo|avvisare|avvisi|chiamare|chiami|informare|informi)[^.!?]{0,25}(a nessuno|nessuno|ai (suoi|tuoi|vostri) (familiari|famigliari|figli|parenti)|alla banca|in banca|in filiale|all'ufficio postale|con nessuno)/g,
        /rest(i|a|ate|are) tra noi|in (assoluto )?segreto|massima riservatezza|non (chiuda|chiudere|chiudete|riattacchi|riattaccare|riattaccate)|rest(i|a|ate|are) in linea|non interromp/g] },
    { id: "pagamentonum", peso: 4, titolo: "Chiede di richiamare un numero a pagamento o estero",
      spiegazione: "I numeri che iniziano con 899, 894, 895, 892, 166 o 144 e certi prefissi esteri costano moltissimo al minuto. Non richiamate i numeri scritti nei messaggi sospetti.",
      re: [/\b(899|894|895|892|166|144)[ .]?\d{2,}/g, /\+88[0-9]|\b0088\d/g] },
    { id: "offerta", peso: 2, titolo: "Un'offerta troppo bella per essere vera",
      spiegazione: "Telefoni a 1 euro, sconti del 90%, prodotti gratis «solo per oggi»: sono esche per prendere i dati della carta o farvi abbonare senza volerlo.",
      re: [/sconto (del )?[6-9]\d ?%|-[6-9]\d ?%|a (soli|solo) \d+[.,]?\d* ?(euro|€)|(iphone|samsung|smartphone|tv|televisore|buono)[^.!?]{0,30}\b[1-9][.,]?\d{0,2} ?(euro|€)|offerta (esclusiva|limitata|imperdibile|riservata)|pochi pezzi|ultimi pezzi|\bgratis\b|gratuitament/g] },
    { id: "generico", peso: 1, titolo: "Saluto generico: «Gentile cliente»",
      spiegazione: "La vostra banca o il vostro fornitore di solito vi chiamano per nome. «Gentile cliente» o «Caro utente» si usa nei messaggi mandati a migliaia di persone.",
      re: [/(gentile|caro|cara|egregio|gentilissimo) (cliente|utente|titolare|correntista|contribuente|abbonato|signore\/a|sig\.\/sig\.ra|beneficiario)/g] },
    { id: "estero", peso: 1, titolo: "Numero sconosciuto, nascosto o estero",
      spiegazione: "Un numero che non conoscete, nascosto o con un prefisso straniero non è per forza una truffa, ma è un motivo in più per non fidarsi subito.",
      re: [/numero (sconosciuto|privato|anonimo|nascosto|che non conosco|estero|straniero)|(prefisso|numero) (estero|straniero|internazionale)|chiamata (dall'estero|internazionale|anonima)/g, /\+(?!39)\d{1,3}[ ]?\d{3,}/g, /\b00(?!39)\d{2}[ ]?\d{4,}/g] },
    { id: "ente", peso: 1, titolo: "Si presenta come un ente, una banca o un'azienda nota",
      spiegazione: "I truffatori usano nomi che ispirano fiducia (banca, Poste, INPS, Agenzia delle Entrate, carabinieri, corrieri). Il nome da solo non prova niente: verificate voi, con i contatti ufficiali.",
      re: [/\b(banca|bancoposta|poste|postepay|posteitaliane|inps|agenzia (delle )?entrate|carabinier[ei]|polizia|guardia di finanza|maresciallo|questura|tribunale|ministero|corriere|amazon|paypal|ufficio (antifrode|sicurezza)|antifrode|servizio clienti|operatore|assistenza (clienti|tecnica)|supporto tecnico|microsoft|apple|windows|enel|telepass|nexi|intesa|unicredit|bper|fineco|dhl|brt|bartolini|gls|sda|inpost|fedex)\b/g] }
  ];
  var LINK_SOSPETTO = { id: "linksospetto", peso: 4, titolo: "Un collegamento sospetto" };
  var LINK = { id: "link", peso: 1, titolo: "Contiene un collegamento",
    spiegazione: "Un collegamento in un messaggio non è per forza pericoloso, ma è la via più usata per portarvi su siti falsi. Se riguarda soldi o dati, non apritelo: digitate voi l'indirizzo ufficiale." };
  var MITTENTE = { id: "mittente", peso: 2, titolo: "Dice di essere un ente, ma scrive da un indirizzo email qualsiasi",
    spiegazione: "Banche ed enti non scrivono da indirizzi gratuiti come gmail o libero, né da indirizzi con nomi strani. Il nome mostrato come mittente si può falsificare facilmente." };
  /* combinazioni: segnali che, insieme, pesano di più */
  var COMBO = [
    { id: "finto-operatore", peso: 2, se: function (h) { return h.ente && (h.codici || h.remoto || h.contanti || (h.pagamento && !h.premio && !h.offerta)); },
      titolo: "Un «operatore» che chiede cose che un ente vero non chiede mai",
      spiegazione: "Banca, Poste, INPS, Agenzia delle Entrate e forze dell'ordine non chiedono codici, app di assistenza, bonifici «di sicurezza» o consegne di denaro. È il segno tipico del finto operatore." },
    { id: "ciao-mamma", peso: 3, se: function (h, s) { return h.nuovonumero && /\b(mamma|mami|mammina|papa|papi|babbo|nonna|nonno|ma|pa)\b/.test(s); },
      titolo: "«Ciao mamma / Ciao papà» da un numero nuovo",
      spiegazione: "Un figlio vero con un numero nuovo si può sempre chiamare o sentire a voce. Prima di fare qualunque cosa telefonate al suo numero di sempre o fategli una domanda che solo lui conosce." },
    { id: "amore-soldi", peso: 5, se: function (h, s) { return h.romance && (h.pagamento || /soldi|denaro|euro|€|biglietto (aereo|del volo)|dogana|spese mediche|ospedale|prestito/.test(s)); },
      titolo: "Amore a distanza e richiesta di soldi",
      spiegazione: "È la «truffa romantica»: prima l'affetto, poi un'emergenza (dogana, ospedale, biglietto aereo). Non mandate mai soldi a chi non avete incontrato di persona." }
  ];
  var LIVELLI = {
    alto: { ico: "🔴", testo: "Molto probabilmente è una truffa", cls: "alto" },
    medio: { ico: "🟠", testo: "Attenzione: ci sono segnali sospetti", cls: "medio" },
    basso: { ico: "🟢", testo: "Non vedo segnali tipici di truffa — ma nel dubbio verificate", cls: "basso" }
  };

  /* ------------------------------------------------------------------------
   *  Analisi
   * ---------------------------------------------------------------------- */
  function analizza(testo, tipo) {
    var N = normalizza(testo), s = N.s, segnali = [], h = {}, intervalli = [], punti = 0, grave = false;
    function orig(a, b) { return a < b && b <= N.pos.length ? [N.pos[a], N.pos[b - 1] + 1] : null; }
    function snip(r) { return r ? String(testo).slice(r[0], r[1]).replace(/\s+/g, " ").slice(0, 120) : ""; }
    function aggiungi(def, trovati, spieg) {
      var r0 = trovati.length ? trovati[0] : null;
      segnali.push({ id: def.id, titolo: def.titolo, spiegazione: spieg || def.spiegazione, trovato: snip(r0), peso: def.peso });
      trovati.forEach(function (r) { if (r) intervalli.push(r); });
      h[def.id] = true; punti += def.peso; if (def.grave) grave = true;
    }
    SEGNALI.forEach(function (def) {
      var trovati = [];
      def.re.forEach(function (re) {
        re.lastIndex = 0; var m, giri = 0;
        while ((m = re.exec(s)) && giri++ < 20) {
          if (!m[0].length) { re.lastIndex++; continue; }
          trovati.push(orig(m.index, m.index + m[0].length));
        }
      });
      if (trovati.length) aggiungi(def, trovati);
    });
    /* collegamenti */
    var links = trovaLink(s), sosp = links.filter(function (l) { return l.motivi.length && !l.email; });
    var web = links.filter(function (l) { return !l.email; });
    if (sosp.length) {
      var l0 = sosp[0];
      aggiungi(LINK_SOSPETTO, sosp.map(function (l) { return orig(l.a, l.b); }),
        "L'indirizzo «" + l0.host + "» " + l0.motivi.join("; ") + ". Non apritelo: se volete controllare, digitate voi l'indirizzo ufficiale che conoscete.");
    } else if (web.length) aggiungi(LINK, web.map(function (l) { return orig(l.a, l.b); }));
    var mail = links.filter(function (l) { return l.email; });
    var mailStrana = mail.filter(function (l) { return l.motivi.length || (h.ente && POSTA_GRATUITA.test(l.host)); });
    if (mailStrana.length) aggiungi(MITTENTE, mailStrana.map(function (l) { return orig(l.a, l.b); }));
    COMBO.forEach(function (c) { if (c.se(h, s)) aggiungi(c, []); });
    /* un nome di ente da solo non è un segnale: lo mostriamo solo se c'è anche altro */
    if (h.ente && segnali.length === 1) { segnali = []; punti = 0; intervalli = []; h = {}; }
    var livello = grave || punti >= 6 ? "alto" : punti >= 3 ? "medio" : "basso";
    segnali.sort(function (a, b) { return b.peso - a.peso; });
    return { livello: livello, punti: punti, segnali: segnali, intervalli: unisci(intervalli), tipo: tipo || "" };
  }
  function unisci(r) {
    r = r.filter(Boolean).sort(function (a, b) { return a[0] - b[0]; });
    var out = [];
    r.forEach(function (x) { var u = out[out.length - 1]; if (u && x[0] <= u[1]) u[1] = Math.max(u[1], x[1]); else out.push([x[0], x[1]]); });
    return out;
  }
  function evidenzia(testo, intervalli) {
    var h = "", i = 0;
    intervalli.forEach(function (r) { h += esc(testo.slice(i, r[0])) + "<mark>" + esc(testo.slice(r[0], r[1])) + "</mark>"; i = r[1]; });
    return (h + esc(testo.slice(i))).replace(/\n/g, "<br>");
  }

  /* ------------------------------------------------------------------------
   *  Cosa fare adesso
   * ---------------------------------------------------------------------- */
  function cosaFare(r) {
    var h = {}; r.segnali.forEach(function (x) { h[x.id] = true; });
    var tel = r.tipo === "telefonata", p = [];
    if (r.livello === "basso") {
      p.push("Se il messaggio arriva da una persona o da un ente che conoscete e vi aspettavate, potete procedere con la solita attenzione.");
      p.push("Se vi chiede soldi, codici o dati, fermatevi comunque: verificate chiamando voi la persona o l'ente al numero che conoscete già.");
      p.push("Nel dubbio chiedete a una persona di fiducia: il Professore guarda solo i segnali più comuni e può sbagliare.");
      return { passi: p, gia: false };
    }
    if (tel) p.push("Riattaccate con calma: non siete obbligati a continuare la telefonata, anche se l'altra persona insiste.");
    if (h.link || h.linksospetto || h.clicca) p.push("Non cliccate sui collegamenti e non aprite allegati.");
    p.push(tel ? "Non richiamate il numero che vi ha chiamato o che vi hanno dato." : "Non rispondete al messaggio e non richiamate i numeri scritti lì dentro.");
    p.push("Non date a nessuno codici, PIN, password, il codice arrivato per SMS o i dati della carta: chi li chiede non è la vostra banca.");
    if (h.pagamento || h.contanti || h.parente || h.pacco || h.premio || h.investimento || h.garantito || h["ciao-mamma"] || h["amore-soldi"])
      p.push("Non fate bonifici, ricariche o pagamenti e non consegnate soldi o gioielli a nessuno.");
    if (h.remoto) p.push("Non installate le app che vi chiedono (AnyDesk, TeamViewer, QuickSupport…). Se l'avete già fatto, spegnete il dispositivo e fatelo controllare.");
    if (h.nuovonumero || h["ciao-mamma"] || h.parente) p.push("Chiamate voi il vostro familiare al numero di sempre, quello che conoscete già.");
    if (h.contanti || h.parente) p.push("Se qualcuno dice di essere delle forze dell'ordine e vi chiede soldi o gioielli, chiamate il 112 e raccontate tutto.");
    p.push("Verificate per conto vostro: chiamate il numero ufficiale scritto sul retro della carta, sulla bolletta o sul contratto; oppure digitate a mano l'indirizzo del sito ufficiale; oppure andate di persona in filiale o all'ufficio.");
    p.push("Bloccate il numero o il mittente e cancellate il messaggio. Parlatene con una persona di fiducia.");
    return { passi: p, gia: true };
  }
  var GIA = [
    "Chiamate subito la vostra banca (il numero è sul retro della carta) e fate bloccare carta e conto.",
    "Cambiate le password, cominciando da quella dell'email e della banca.",
    "Se avete installato un'app di controllo a distanza, disinstallatela e fate controllare il dispositivo da una persona esperta.",
    "Conservate i messaggi e annotate numeri, nomi e orari: serviranno come prova.",
    "Denunciate alla Polizia Postale (sito ufficiale commissariatodips.it) oppure ai Carabinieri o alla Polizia. Non vergognatevi: succede a tante persone."
  ];
  var REGOLE = [
    ["Nessuno vi chiede i codici", "Banca, Poste, INPS e forze dell'ordine non chiedono MAI codici, PIN, password o i numeri della carta, né al telefono né per messaggio."],
    ["La fretta è un campanello d'allarme", "Chi vi mette paura o urgenza vuole che non ragioniate. Prendetevi sempre tempo."],
    ["Non cliccate sui collegamenti", "Per entrare nel sito della banca o di un ente digitate voi l'indirizzo, oppure usate l'app ufficiale."],
    ["Verificate voi, con i numeri ufficiali", "Chiamate il numero scritto sul retro della carta, sulla bolletta o sul contratto. Mai quello scritto nel messaggio."],
    ["«Ciao mamma, ho cambiato numero»", "Prima di tutto chiamate vostro figlio al numero vecchio, che conoscete già."],
    ["Nessuno viene a ritirare soldi o gioielli", "Carabinieri, avvocati e tribunali non chiedono cauzioni né mandano incaricati a casa. Nel dubbio chiamate il 112."],
    ["Niente app su richiesta di sconosciuti", "Programmi come AnyDesk o TeamViewer danno a un estraneo il comando del vostro telefono o computer."],
    ["Nessuno regala niente", "Premi, vincite, rimborsi inattesi e guadagni «garantiti» sono esche."],
    ["Attenzione ai pagamenti strani", "Ricariche, buoni regalo e criptovalute chiesti da sconosciuti sono soldi persi per sempre."],
    ["Il segreto è un trucco", "Se vi dicono «non dirlo a nessuno», ditelo subito a una persona di fiducia. E se è già successo: banca, password, denuncia."]
  ];

  /* ------------------------------------------------------------------------
   *  Esempi pronti (nomi di fantasia)
   * ---------------------------------------------------------------------- */
  var ESEMPI = [
    { t: "📱 Carta bloccata", tipo: "sms", x: "Banca del Borgo: la sua carta è stata BLOCCATA per un accesso anomalo. Per sbloccarla entro 24 ore acceda qui: http://bancadelborgo-sicurezza-clienti.top/sblocco" },
    { t: "📦 Pacco in giacenza", tipo: "sms", x: "Il suo pacco è in giacenza presso il nostro deposito: indirizzo incompleto. Paghi 1,99 € di spese di spedizione per la riconsegna: https://bit.ly/3pAcco" },
    { t: "👩 «Ciao mamma»", tipo: "messaggio", x: "Ciao mamma, ho cambiato numero perché il telefono mi è caduto e si è rotto. Salva questo numero. Mi serve un favore urgente: puoi farmi un bonifico di 980 euro? Ti spiego dopo." },
    { t: "👮 Finto carabiniere", tipo: "telefonata", x: "Mi ha chiamato un signore dicendo di essere un maresciallo dei carabinieri. Mi ha detto che mio nipote ha fatto un incidente ed è stato fermato e che serve una cauzione. Passerà un suo collega a ritirare contanti o gioielli. Mi ha detto di non dirlo a nessuno e di restare in linea." },
    { t: "🏛️ Rimborso del fisco", tipo: "email", x: "Da: Agenzia Entrate <rimborsi@agenzia-entrate-rimborsi.info>\nGentile contribuente, risulta un rimborso fiscale a suo favore di 486,50 €. Per riceverlo compili il modulo con i dati della sua carta entro 48 ore: www.agenzia-entrate-rimborsi.info" },
    { t: "📈 Investimento cripto", tipo: "messaggio", x: "Guadagna 3.000 € al mese da casa con il trading di criptovalute! Rendimento garantito del 30%. Ti segue un nostro consulente: installa AnyDesk e investi solo 250 €." },
    { t: "🏦 Finto operatore", tipo: "telefonata", x: "Mi ha chiamato l'ufficio antifrode della banca: dicono che ci sono movimenti sospetti sul mio conto. Mi chiedono di leggere il codice che mi è arrivato per SMS e di spostare i soldi su un conto di sicurezza." },
    { t: "🎁 Premio a 2 €", tipo: "sms", x: "Congratulazioni! Sei stato selezionato per vincere uno smartphone a solo 2 €. Offerta valida solo per oggi: clicca qui https://premi-fortunati.click" },
    { t: "🧒 Messaggio del figlio", tipo: "messaggio", x: "Ciao mamma, stasera passo a prendere i bambini verso le 7. Ci vediamo dopo, un bacio!" },
    { t: "🏨 Prenotazione vera", tipo: "email", x: "Gentile Maria Bianchi, grazie per aver scelto l'Albergo Belvedere. La sua prenotazione n. 4521 per il 12 ottobre è confermata. Il pagamento avverrà in struttura all'arrivo. Per qualsiasi domanda può rispondere a questa email. A presto!" }
  ];
  var TIPI = [["", "🤷 Non so"], ["sms", "📱 SMS"], ["email", "✉️ Email"], ["messaggio", "💬 WhatsApp / messaggio"], ["telefonata", "📞 Telefonata"], ["sito", "🌐 Sito"]];
  function nomeTipo(t) { for (var i = 0; i < TIPI.length; i++) if (TIPI[i][0] === t) return TIPI[i][1]; return TIPI[0][1]; }

  /* ------------------------------------------------------------------------
   *  Storico (solo anteprima breve, cifre lunghe nascoste)
   * ---------------------------------------------------------------------- */
  function storico() {
    var t = PD.progress.truffa;
    if (!t || typeof t !== "object") t = PD.progress.truffa = { controlli: [] };
    if (!Array.isArray(t.controlli)) t.controlli = [];
    return t.controlli;
  }
  function anteprima(testo) {
    var a = String(testo).replace(/\s+/g, " ").trim().replace(/\d{4,}/g, function (d) { return new Array(Math.min(d.length, 6) + 1).join("•"); });
    return a.length > 80 ? a.slice(0, 79) + "…" : a;
  }
  function registra(testo, r) {
    var c = storico();
    c.unshift({ quando: new Date().toISOString(), tipo: r.tipo, livello: r.livello, anteprima: anteprima(testo) });
    if (c.length > 10) c.length = 10;
    PD.saveProgress();
  }

  PD.truffa = { analizza: analizza, esempi: ESEMPI, regole: REGOLE, normalizza: normalizza };

  /* ------------------------------------------------------------------------
   *  Pagina
   * ---------------------------------------------------------------------- */
  var stato = { r: null, testo: "", ctrl: null };

  function htmlEsito(r, testo, perStampa) {
    var L = LIVELLI[r.livello], cf = cosaFare(r);
    var h = '<div class="tr-verdetto tr-' + L.cls + '" role="status"><span class="tr-ico" aria-hidden="true">' + L.ico + '</span><div><b>' + esc(L.testo) + "</b>" +
      '<div class="small">' + (r.segnali.length ? (r.segnali.length === 1 ? "Ho trovato 1 segnale" : "Ho trovato " + r.segnali.length + " segnali") + (r.livello === "basso" ? " di poco conto." : ".") : "Non ho trovato i segnali che conosco.") +
      " Il Professore può sbagliare: non è mai una garanzia al 100%.</div></div></div>";
    if (r.segnali.length) {
      h += '<h3>' + (r.livello === "basso" ? "🔎 Piccoli dettagli che ho notato" : "🔎 I segnali che ho trovato") + "</h3><ol class=\"tr-segnali\">" + r.segnali.map(function (x) {
        return '<li class="tr-p' + Math.min(x.peso, 5) + '"><b>' + esc(x.titolo) + "</b>" + (x.trovato ? ' <span class="tr-trovato">«' + esc(x.trovato) + "»</span>" : "") +
          '<div class="small">' + esc(x.spiegazione) + "</div></li>";
      }).join("") + "</ol>";
    }
    if (testo && r.intervalli.length) h += '<details class="tr-testo"' + (perStampa ? " open" : "") + '><summary>🖍️ Il testo con le parti sospette evidenziate</summary><div class="tr-testo-corpo">' + evidenzia(testo, r.intervalli) + "</div></details>";
    h += "<h3>✅ Cosa fare adesso</h3><ol class=\"tr-passi\">" + cf.passi.map(function (p) { return "<li>" + esc(p) + "</li>"; }).join("") + "</ol>";
    h += '<div class="notice small tr-gia"><b>⚠️ Se avete già dato dati o soldi</b><ol>' + GIA.map(function (p) { return "<li>" + esc(p) + "</li>"; }).join("") + "</ol></div>";
    return h;
  }
  function testoParlato(r) {
    var L = LIVELLI[r.livello], cf = cosaFare(r);
    var t = L.testo.replace(" — ", ". ") + ".\n";
    if (r.segnali.length) t += "Ecco cosa ho notato. " + r.segnali.map(function (x) { return x.titolo + ". " + x.spiegazione; }).join("\n") + "\n";
    t += "Cosa fare adesso. " + cf.passi.join("\n");
    return t;
  }
  function stampa() {
    var r = stato.r; if (!r) return;
    var d = new Date();
    var html = '<header class="p-testa"><div><b>Professore Digitale</b> · È una truffa?</div><div>' + d.toLocaleDateString("it-IT") + "</div></header>" +
      "<h1>🕵️ Controllo di un messaggio sospetto</h1><p><b>Tipo:</b> " + esc(nomeTipo(r.tipo)) + "</p>" +
      '<div class="tr-stampa-testo">' + evidenzia(stato.testo, r.intervalli) + "</div>" + htmlEsito(r, "", true) +
      PD.piedeStampa("Il controllo automatico può sbagliare: nel dubbio verificate sempre con i contatti ufficiali.");
    PD.printHTML('<div class="tr-stampa">' + html + "</div>", "verticale");
  }

  function quando(iso) {
    var d = new Date(iso); if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString("it-IT") + " " + ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2);
  }
  function htmlStorico() {
    var c = storico();
    if (!c.length) return '<p class="small muted">Ancora nessun controllo. Qui vedrete gli ultimi 10 (solo l\'inizio del testo, per la vostra riservatezza).</p>';
    return '<ul class="tr-storico">' + c.map(function (x) {
      var L = LIVELLI[x.livello] || LIVELLI.basso;
      return '<li><span class="tr-st-ico" title="' + esc(L.testo) + '">' + L.ico + '</span><div><div class="small muted">' + esc(quando(x.quando)) + " · " + esc(nomeTipo(x.tipo)) + "</div>" +
        '<div class="tr-st-ant">' + esc(x.anteprima) + "</div></div></li>";
    }).join("") + '</ul><button class="btn ghost" id="tr-cancella-storico">🗑️ Cancella lo storico</button>';
  }

  PD.views.truffa = function (el) {
    var tipo = stato.tipo || "";
    el.innerHTML =
      '<div class="lesson-head"><span class="big-ico">🕵️</span><div><h1 style="margin:0">È una truffa?</h1>' +
      '<p class="lead" style="margin:0">Incollate, scrivete' + (PD.sttReady() ? " o dettate" : "") + " un SMS, un'email, un messaggio, oppure raccontate una telefonata ricevuta. " +
      "Il Professore vi dice quali segnali di truffa vede e cosa fare.</p></div></div>" +
      '<div class="card tr-box">' +
      '<fieldset class="tr-tipi"><legend class="small muted">Che cos\'è? (facoltativo)</legend>' + TIPI.map(function (t) {
        return '<label class="tr-tipo"><input type="radio" name="tr-tipo" value="' + t[0] + '"' + (t[0] === tipo ? " checked" : "") + "><span>" + t[1] + "</span></label>";
      }).join("") + "</fieldset>" +
      '<label for="tr-testo" class="tr-etichetta">Il messaggio (o il racconto della telefonata)</label>' +
      '<textarea id="tr-testo" rows="6" placeholder="Per incollare: tasto destro del mouse → Incolla, oppure Ctrl+V. Per una telefonata scrivete cosa vi hanno detto."></textarea>' +
      '<div class="row tr-azioni"><button class="btn big" id="tr-controlla">🔍 Controlla</button>' +
      (PD.sttReady() ? '<button class="btn big ghost" id="tr-mic" title="Premete e parlate; premete di nuovo per finire">🎤 Detta</button>' : "") +
      '<button class="btn ghost" id="tr-pulisci">🧹 Cancella il testo</button></div>' +
      '<p class="small muted">🔒 Il controllo avviene su questo computer, senza Internet. Il testo non viene salvato.</p>' +
      '<div class="tr-esempi"><div class="small"><b>Prova con un esempio:</b></div><div class="row">' + ESEMPI.map(function (e, i) {
        return '<button class="btn ghost tr-es" data-es="' + i + '">' + esc(e.t) + "</button>";
      }).join("") + "</div></div></div>" +
      '<div id="tr-esito" class="card tr-esito" hidden aria-live="polite"></div>' +
      '<details class="card tr-regole"><summary><h2>📜 Le 10 regole d\'oro contro le truffe</h2></summary><ol>' + REGOLE.map(function (r) {
        return "<li><b>" + esc(r[0]) + ".</b> " + esc(r[1]) + "</li>";
      }).join("") + '</ol><button class="btn ghost" id="tr-leggi-regole">🔊 Leggi le regole</button></details>' +
      '<div class="card tr-storico-box"><h2>🕑 Ultimi controlli</h2><div id="tr-storico">' + htmlStorico() + "</div></div>";

    var ta = $("#tr-testo", el);
    if (stato.testo) ta.value = stato.testo;
    function tipoScelto() { var r = $('input[name="tr-tipo"]:checked', el); return r ? r.value : ""; }
    $$('input[name="tr-tipo"]', el).forEach(function (r) { r.onchange = function () { stato.tipo = tipoScelto(); }; });
    function aggiornaStorico() {
      $("#tr-storico", el).innerHTML = htmlStorico();
      var b = $("#tr-cancella-storico", el);
      if (b) b.onclick = function () {
        if (!confirm("Cancellare l'elenco degli ultimi controlli?")) return;
        PD.progress.truffa = { controlli: [] }; PD.saveProgress(); aggiornaStorico(); PD.toast("🗑️ Storico cancellato.");
      };
    }
    aggiornaStorico();

    function controlla() {
      var testo = ta.value.trim();
      if (testo.length < 3) { PD.toast("Scrivete o incollate prima il messaggio da controllare."); ta.focus(); return; }
      ferma();
      var r = analizza(testo, tipoScelto());
      stato.r = r; stato.testo = testo; stato.tipo = r.tipo;
      registra(testo, r);
      var box = $("#tr-esito", el);
      box.hidden = false;
      box.className = "card tr-esito tr-bordo-" + r.livello;
      box.innerHTML = htmlEsito(r, testo) +
        '<div class="row tr-azioni"><button class="btn" id="tr-leggi">🔊 Leggi</button><button class="btn ghost" id="tr-stampa">🖨️ Stampa questo controllo</button>' +
        (PD.server && PD.aiReady() ? '<button class="btn ghost" id="tr-ia">🤖 Chiedi anche all\'IA</button>' : "") + "</div>" +
        '<div id="tr-ia-box" hidden></div>';
      $("#tr-leggi", box).onclick = function () { PD.speak(testoParlato(r), true); };
      $("#tr-stampa", box).onclick = stampa;
      var ia = $("#tr-ia", box); if (ia) ia.onclick = function () { chiediIA(testo, r, box); };
      aggiornaStorico();
      PD.setProf(r.livello === "basso" ? "riposo" : "pensiero");
      setTimeout(function () { if (PD.profState === "pensiero") PD.setProf("riposo"); }, 1500);
      if (box.scrollIntoView) box.scrollIntoView({ behavior: "smooth", block: "start" });
      if (PD.settings.autoReadAnswers) PD.speak(LIVELLI[r.livello].testo.replace(" — ", ". "));
    }
    $("#tr-controlla", el).onclick = controlla;
    ta.onkeydown = function (e) { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); controlla(); } };
    $("#tr-pulisci", el).onclick = function () { ta.value = ""; stato.testo = ""; stato.r = null; ferma(); $("#tr-esito", el).hidden = true; ta.focus(); };
    var mic = $("#tr-mic", el);
    if (mic) mic.onclick = function () {
      var attivo = PD.recorder.active && PD.recorder.active();
      PD.recorder.toggle(function (t) {
        mic.textContent = "🎤 Detta";
        ta.value = (ta.value.trim() ? ta.value.trim() + " " : "") + t; ta.focus();
      });
      mic.textContent = attivo ? "🎤 Detta" : "■ Basta così";
    };
    $$(".tr-es", el).forEach(function (b) {
      b.onclick = function () {
        var e = ESEMPI[+b.getAttribute("data-es")];
        ta.value = e.x;
        $$('input[name="tr-tipo"]', el).forEach(function (r) { r.checked = r.value === e.tipo; });
        stato.tipo = e.tipo;
        controlla();
      };
    });
    $("#tr-leggi-regole", el).onclick = function () {
      PD.speak("Le dieci regole d'oro contro le truffe.\n" + REGOLE.map(function (r, i) { return (i + 1) + ". " + r[0] + ". " + r[1]; }).join("\n"), true);
    };
  };

  /* ------------------------------------------------------------------------
   *  Secondo parere dall'IA locale (facoltativo)
   * ---------------------------------------------------------------------- */
  var PROMPT_IA =
    "Sei il Professore Digitale e aiuti persone anziane e principianti a riconoscere le truffe. Rispondi in italiano semplice, dando del voi, in modo breve (massimo 120 parole).\n" +
    "Ti viene dato un messaggio o il racconto di una telefonata. Rispondi così:\n" +
    "1. Una frase con il tuo giudizio prudente (truffa probabile / sospetto / nessun segnale evidente).\n" +
    "2. Un breve elenco puntato dei segnali sospetti che vedi.\n" +
    "3. Un breve elenco di cosa fare (non cliccare, non dare codici, verificare con i contatti ufficiali digitati a mano o scritti sul retro della carta).\n" +
    "Regole: non dire MAI che un messaggio è sicuro al 100%; nel dubbio consiglia di verificare. Non inventare numeri di telefono né indirizzi di siti. Non scrivere schemi o codice.";
  function ferma() { if (stato.ctrl) { try { stato.ctrl.abort(); } catch (e) { /* ignora */ } stato.ctrl = null; } }
  function chiediIA(testo, r, box) {
    var out = $("#tr-ia-box", box), btn = $("#tr-ia", box);
    ferma();
    out.hidden = false; out.className = "tr-ia";
    out.innerHTML = '<h3>🤖 Il parere dell\'IA locale <span class="small muted">(' + esc(PD.currentModel()) + ')</span></h3><div class="tr-ia-testo" data-no-trad><span class="muted">' + esc(PD.i18n ? PD.i18n.t("Sto pensando…") : "Sto pensando…") + '</span></div>' +
      '<p class="small muted">L\'IA può sbagliare: conta di più il controllo qui sopra. In ogni caso, verificate sempre con i contatti ufficiali.</p>' +
      '<button class="btn ghost" id="tr-ia-stop">■ Ferma</button>';
    var dove = $(".tr-ia-testo", out), stop = $("#tr-ia-stop", out);
    if (btn) btn.disabled = true;
    PD.setProf("pensiero");
    var ctrl = stato.ctrl = new AbortController(), full = "";
    stop.onclick = ferma;
    var utente = (r.tipo ? "Tipo: " + nomeTipo(r.tipo).replace(/^\S+\s/, "") + "\n" : "") + "Messaggio da controllare:\n\"\"\"\n" + testo.slice(0, 3000) + "\n\"\"\"\n" +
      "Il controllo automatico ha trovato questi segnali: " + (r.segnali.map(function (x) { return x.titolo; }).join("; ") || "nessuno") + ".";
    function fine() {
      if (btn) btn.disabled = false; stop.hidden = true; if (stato.ctrl === ctrl) stato.ctrl = null;
      if (PD.profState === "pensiero") PD.setProf("riposo");
    }
    fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, signal: ctrl.signal,
      body: JSON.stringify({ model: PD.currentModel(), messages: [{ role: "system", content: PROMPT_IA + (PD.i18n ? PD.i18n.istruzioneIA() : "") }, { role: "user", content: utente }] }) })
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
        if (PD.settings.autoReadAnswers) PD.speak(t, false, { tradotto: true });
      })
      .catch(function (err) {
        fine();
        if (err && err.name === "AbortError") { if (!full.trim()) dove.innerHTML = '<span class="muted">Richiesta fermata.</span>'; return; }
        dove.innerHTML = '<p class="notice small">L\'IA locale non ha risposto (' + esc(err.message) + "). Vale il controllo qui sopra.</p>";
      });
  }
  function pulisci(t) {
    t = PD.stripThink ? PD.stripThink(t) : String(t || "");
    return t.replace(/\[DIAGRAMMA\][\s\S]*?(\[\/DIAGRAMMA\]|$)/g, "").replace(/```[\s\S]*?(```|$)/g, "");
  }

  PD.hooks.homeTiles.push(function () {
    return PD.tileHTML("🕵️", "È una truffa?", "Incollate o dettate un messaggio sospetto: il Professore vi dice cosa ne pensa.", "#/truffa");
  });
})();
