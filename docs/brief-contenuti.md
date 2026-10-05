# Brief per chi scrive contenuti del Professore Digitale (3.0.0)

Il Professore Digitale è un'app didattica **offline** per anziani e principianti (centri anziani, scuole,
associazioni). Tutti i contenuti sono in **italiano semplice, tono caldo e paziente, si dà del "voi"**
(«Premete», «Ricordate»). Frasi corte, metafore della vita quotidiana, niente sarcasmo.

## Regole di qualità (non negoziabili)
- **Esattezza**: solo fatti consolidati, verificabili in un buon manuale scolastico o enciclopedia.
  Nel dubbio, non scriverlo. Date e nomi devono essere giusti.
- **Niente dati che invecchiano**: niente prezzi, cifre di popolazione aggiornate, nomi di chi ricopre oggi
  una carica (presidenti, ministri, papa, ecc.), classifiche, «l'anno scorso», «oggi il record è…».
  Usare formulazioni durature («circa», «oltre», «uno dei più…») solo se certe nel tempo.
- **Equilibrio**: su politica, religione, temi controversi si spiegano fatti e istituzioni, mai opinioni di parte.
- Prudenza su soldi, salute e leggi (consigliare di chiedere a un professionista o a una persona di fiducia).
- Niente contenuti protetti da diritto d'autore (testi di canzoni, poesie moderne, brani di libri).
  Citazioni brevi di opere antiche/pubblico dominio ammesse (max una riga).
- Formattazione nel testo: `**grassetto**`, `*corsivo*`, elenchi con `- ` o `1. `, `\n\n` tra paragrafi.
- Schemi Mermaid (facoltativi, solo se aiutano): `flowchart LR` o `flowchart TD`, **max 5–6 riquadri**,
  etichette **sempre tra virgolette**: `A["Testo"] --> B["Testo"]`. Niente parentesi tonde dentro le etichette
  se possibile, niente caratteri speciali strani. Un'emoji all'inizio dell'etichetta è ammessa.

## Formato del pacchetto (file JSON UTF-8, indentazione 1)
```json
{
 "formato": "professore-digitale-contenuti",
 "formato_versione": 1,
 "id": "cultura-storia",                 // minuscole, cifre, trattini
 "titolo": "...",                          // max 120
 "versione": "1.0.0",
 "autore": "Danilo D'Auria",
 "descrizione": "...",                     // max 600
 "richiede_app": "3.0.0",
 "suggerimenti": ["domanda tipo 1", "..."],  // 3-6 domande brevi (max 120 caratteri)
 "domande": [ ... ],
 "lezioni": [ ... ],
 "prove":   [ ... ]
}
```

### domande (guida «Chiedi al Professore», risponde anche senza IA)
```json
{ "domanda": "Chi era Giuseppe Garibaldi?",        // max 300, come la chiederebbe una persona
  "parole_chiave": ["garibaldi", "eroe dei due mondi", "spedizione dei mille", "mille"],  // 3-8, come parlano gli allievi, minuscolo
  "risposta": "…",                                  // 40-120 parole, max 5000 caratteri
  "schema": "flowchart LR\n  A[\"…\"] --> B[\"…\"]", // facoltativo
  "lezione": "id-lezione-collegata" }               // facoltativo: id di una lezione dello stesso pacchetto
```

### lezioni
```json
{ "id": "risorgimento", "icona": "🇮🇹", "titolo": "Il Risorgimento e l'Unità d'Italia",
  "livello": "Storia",            // OBBLIGATORIO e uguale per tutto il pacchetto (raggruppa le lezioni)
  "minuti": 15, "obiettivo": "…", // max 400
  "palestra": "",                 // lasciare vuoto
  "passi": [ { "titolo": "…", "testo": "… 60-160 parole …", "schema": "…facoltativo…", "consiglio": "…facoltativo, max 400…" } ],  // 4-6 passi
  "quiz": [ { "domanda": "…", "opzioni": ["…","…","…"], "corretta": 0, "spiegazione": "… max 600 …" } ] }  // 4-5 domande
```
`corretta` si conta da 0. Variate la posizione della risposta giusta (non sempre la prima!).
Opzioni sbagliate plausibili ma chiaramente sbagliate per chi ha letto la lezione.

### prove (il «Grande Quiz» con attestato finale)
```json
{ "id": "storia", "titolo": "Il Grande Quiz di Storia", "icona": "🏛️",
  "descrizione": "…",                  // max 600
  "attestato": "Storia d'Italia e del mondo",   // titolo dell'argomento stampato sull'attestato, max 120
  "domande_per_prova": 20,             // quante domande pescate a caso per ogni tentativo (5-100)
  "soglia": 0.7,                       // percentuale per superare la prova
  "domande": [ { "domanda": "…", "opzioni": ["…","…","…","…"], "corretta": 2, "spiegazione": "…", "categoria": "Antichità" } ] }
```
Ogni prova: **almeno 3 volte** `domande_per_prova` domande (per variare i tentativi), 3–4 opzioni ciascuna,
spiegazione di 1–2 frasi che insegna qualcosa, `categoria` breve per bilanciare le estrazioni. Le domande della prova
non devono essere copie identiche di quelle dei quiz delle lezioni (possono riprenderne gli argomenti).

## Controllo
Dalla cartella del progetto:
`PD_SHARE_DIR=src python3 packaging/professore-digitale-contenuti valida src/contenuti/NOME.json`
deve stampare ✔. Controllate anche con uno script che: le risposte delle domande siano 40–120 parole; nessuna
domanda ripetuta; `corretta` distribuita (non sempre 0); tutte le etichette Mermaid tra virgolette.
