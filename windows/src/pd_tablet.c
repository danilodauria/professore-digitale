/* Professore Digitale per Windows - «Condividi con i tablet dell'aula» (3.4)
 * Stesso comportamento di src/server/pd_tablet.py e della classe TabletHandler di pd_server.py:
 *   SPENTA per impostazione predefinita; si accende SOLO dal PC (POST /api/tablet su 127.0.0.1, impostazione
 *   tabletCondividi). Accesa, apre un secondo ascolto su tutte le interfacce, porta 8768 (PD_TABLET_PORT nei test):
 *   - solo IP privati 10/8, 172.16/12, 192.168/16, 169.254/16 (loopback solo con PD_TABLET_LOOPBACK=1, per i test);
 *   - Host = IP di questo PC su cui e' arrivata la connessione + porta; Origin uguale (se presente);
 *   - codice di 6 cifre: http://IP:8768/?c=CODICE -> cookie casuale (HttpOnly, SameSite=Strict, 12 ore) e ritorno a "/";
 *     al massimo 10 tentativi al minuto per indirizzo;
 *   - con la sessione: file dell'interfaccia, GET /api/status (ridotta), /api/packs (senza percorsi), /api/rete,
 *     POST /api/tts, /api/chat (poche richieste insieme), /api/ospite/presenza (quadro dell'aula). Il resto: 403.
 * Compatibile con Windows XP SP3 (CryptGenRandom, Winsock 2). Ideato e sviluppato da Danilo D'Auria - Licenza MIT */
#include "pd.h"
#include <wincrypt.h>

#define TAB_PORTA 8768
#define TAB_SESSIONE_S (12 * 3600)
#define TAB_MAX_SESSIONI 60
#define TAB_TENTATIVI 10
#define TAB_MAX_IP 256
#define TAB_CHAT_MAX 2
#define TAB_TTS_MAX 4
#define TAB_MAX_PRESENZA (64 * 1024)

typedef struct { char token[33]; char id[9]; char ip[48]; double creata, visto; char nome[256]; char pagina[512]; } sess_t;
typedef struct { char ip[48]; double t[TAB_TENTATIVI]; int n; } tent_t;

static CRITICAL_SECTION T; static LONG t_init = 0;
static int attivo = 0, porta = TAB_PORTA, loopback = 0;
static char codice[8] = "", errore[200] = "";
static sess_t sess[TAB_MAX_SESSIONI]; static int nsess = 0;
static tent_t tent[TAB_MAX_IP]; static int ntent = 0;
static SOCKET ls = INVALID_SOCKET;
static volatile LONG n_chat = 0, n_tts = 0;

static void tl(void) { if (InterlockedCompareExchange(&t_init, 1, 0) == 0) InitializeCriticalSection(&T); EnterCriticalSection(&T); }
static void tu(void) { LeaveCriticalSection(&T); }
static double ora(void) { FILETIME ft; GetSystemTimeAsFileTime(&ft); ULARGE_INTEGER u; u.LowPart = ft.dwLowDateTime; u.HighPart = ft.dwHighDateTime; return (double)(u.QuadPart - 116444736000000000ULL) / 1e7; }

/* ------------------------------------------------------------------ numeri casuali (CryptGenRandom, presente in XP) */
static int casuale(unsigned char *b, DWORD n) {
    HCRYPTPROV p;
    if (!CryptAcquireContextW(&p, NULL, NULL, PROV_RSA_FULL, CRYPT_VERIFYCONTEXT | CRYPT_SILENT)) return 0;
    BOOL ok = CryptGenRandom(p, n, b);
    CryptReleaseContext(p, 0);
    return ok ? 1 : 0;
}
static int esadecimale(char *out, int nbyte) {
    unsigned char b[32];
    if (nbyte > 32 || !casuale(b, (DWORD)nbyte)) return 0;
    for (int i = 0; i < nbyte; i++) snprintf(out + 2 * i, 3, "%02x", b[i]);
    return 1;
}
static void nuovo_codice(void) {          /* con il lock preso */
    char vecchio[8]; snprintf(vecchio, sizeof vecchio, "%s", codice);
    do {
        unsigned char b[4] = { 0, 0, 0, 0 };
        if (!casuale(b, 4)) { LARGE_INTEGER q; QueryPerformanceCounter(&q); memcpy(b, &q.LowPart, 4); }
        unsigned v = ((unsigned)b[0] << 24 | (unsigned)b[1] << 16 | (unsigned)b[2] << 8 | b[3]) % 1000000u;
        snprintf(codice, sizeof codice, "%06u", v);
    } while (!strcmp(codice, vecchio));
}

/* ------------------------------------------------------------------ rete */
static int ip_ok(const char *ip) {
    unsigned long a = inet_addr(ip);
    if (!ip || !*ip || a == INADDR_NONE) return 0;
    unsigned long h = ntohl(a); unsigned b1 = (h >> 24) & 255, b2 = (h >> 16) & 255;
    if (b1 == 127) return loopback;
    return b1 == 10 || (b1 == 172 && b2 >= 16 && b2 <= 31) || (b1 == 192 && b2 == 168) || (b1 == 169 && b2 == 254);
}

static unsigned __stdcall accetta(void *arg) {
    SOCKET s = (SOCKET)(UINT_PTR)arg;
    for (;;) {
        SOCKET c = accept(s, NULL, NULL);
        if (c == INVALID_SOCKET) { tl(); int fine = ls != s; tu(); if (fine) break; Sleep(50); continue; }
        HANDLE t = (HANDLE)_beginthreadex(NULL, 256 * 1024, http_conn_ospite, (void *)(UINT_PTR)c, 0, NULL);
        if (t) CloseHandle(t); else closesocket(c);
    }
    return 0;
}

static int accendi(void) {                /* con il lock preso */
    if (attivo) return 1;
    SOCKET s = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
    if (s == INVALID_SOCKET) { snprintf(errore, sizeof errore, "la porta %d è occupata o bloccata (errore %d)", porta, WSAGetLastError()); return 0; }
    BOOL excl = TRUE; setsockopt(s, SOL_SOCKET, SO_EXCLUSIVEADDRUSE, (const char *)&excl, sizeof excl);
    struct sockaddr_in a; memset(&a, 0, sizeof a);
    a.sin_family = AF_INET; a.sin_port = htons((u_short)porta); a.sin_addr.s_addr = htonl(INADDR_ANY);
    if (bind(s, (struct sockaddr *)&a, sizeof a) != 0 || listen(s, 32) != 0) {
        snprintf(errore, sizeof errore, "la porta %d è occupata o bloccata (errore %d)", porta, WSAGetLastError());
        closesocket(s); pd_log("tablet: %s", errore);
        return 0;
    }
    ls = s; attivo = 1; errore[0] = 0; nsess = 0; ntent = 0;
    nuovo_codice();
    HANDLE t = (HANDLE)_beginthreadex(NULL, 0, accetta, (void *)(UINT_PTR)s, 0, NULL);
    if (t) CloseHandle(t);
    pd_log("tablet: condivisione accesa sulla porta %d", porta);
    return 1;
}
static void spegni(void) {                /* con il lock preso */
    attivo = 0; codice[0] = 0; nsess = 0; ntent = 0;
    if (ls != INVALID_SOCKET) { SOCKET s = ls; ls = INVALID_SOCKET; closesocket(s); pd_log("tablet: condivisione spenta"); }
}

void tablet_init(void) {
    const char *p = getenv("PD_TABLET_PORT"), *l = getenv("PD_TABLET_LOOPBACK");
    if (p && atoi(p) > 0 && atoi(p) < 65536) porta = atoi(p);
    loopback = l && !strcmp(l, "1");
    wchar_t *f = path_join(G.data_dir, L"settings.json");
    buf_t b; jv *s = NULL; char e[64];
    if (file_read(f, &b, PD_MAX_JSON)) { s = json_parse(b.p, b.n, e, sizeof e); buf_free(&b); }
    free(f);
    jv *v = jget(s, "tabletCondividi");
    if (v && v->t == J_TRUE) { tl(); accendi(); tu(); }   /* scelta fatta su questo PC: si riaccende con un codice nuovo */
    json_free(s);
}

/* ------------------------------------------------------------------ sessioni */
static void pulisci(double t) {           /* con il lock preso: via le sessioni scadute */
    for (int i = 0; i < nsess;) { if (t - sess[i].creata > TAB_SESSIONE_S) sess[i] = sess[--nsess]; else i++; }
}
static int trova(const char *token) {     /* con il lock preso */
    if (!token || !*token) return -1;
    for (int i = 0; i < nsess; i++) if (!strcmp(sess[i].token, token)) return i;
    return -1;
}
/* 1 se il token e' di una sessione valida (aggiorna ultimo accesso e indirizzo) */
static int sessione(const char *token, const char *ip) {
    double t = ora(); int ok = 0;
    tl();
    int i = attivo ? trova(token) : -1;
    if (i >= 0 && t - sess[i].creata > TAB_SESSIONE_S) { sess[i] = sess[--nsess]; i = -1; }
    if (i >= 0) { sess[i].visto = t; snprintf(sess[i].ip, sizeof sess[i].ip, "%s", ip); ok = 1; }
    tu();
    return ok;
}
/* "ok" (token in out), "sbagliato", "troppi", "spento" */
static const char *prova_codice(const char *ip, const char *c, char *token_out) {
    double t = ora();
    const char *esito = "sbagliato";
    tl();
    if (!attivo) { tu(); return "spento"; }
    int k = -1;
    for (int i = 0; i < ntent; i++) if (!strcmp(tent[i].ip, ip)) k = i;
    if (k < 0) {
        if (ntent >= TAB_MAX_IP) {                 /* niente memoria senza limiti: si dimentica il piu' vecchio */
            int v = 0; for (int i = 1; i < ntent; i++) if (tent[i].t[tent[i].n ? tent[i].n - 1 : 0] < tent[v].t[tent[v].n ? tent[v].n - 1 : 0]) v = i;
            tent[v] = tent[--ntent];
        }
        k = ntent++; memset(&tent[k], 0, sizeof tent[k]); snprintf(tent[k].ip, sizeof tent[k].ip, "%s", ip);
    }
    tent_t *x = &tent[k]; int m = 0;
    for (int i = 0; i < x->n; i++) if (t - x->t[i] < 60) x->t[m++] = x->t[i];
    x->n = m;
    if (x->n >= TAB_TENTATIVI) { tu(); return "troppi"; }
    x->t[x->n++] = t;
    int buono = strlen(c) == 6 && !strcmp(c, codice);
    for (int i = 0; buono && i < 6; i++) if (c[i] < '0' || c[i] > '9') buono = 0;
    if (buono) {
        pulisci(t);
        if (nsess >= TAB_MAX_SESSIONI) { int v = 0; for (int i = 1; i < nsess; i++) if (sess[i].visto < sess[v].visto) v = i; sess[v] = sess[--nsess]; }
        sess_t *s = &sess[nsess]; memset(s, 0, sizeof *s);
        if (esadecimale(s->token, 16) && esadecimale(s->id, 4)) {
            snprintf(s->ip, sizeof s->ip, "%s", ip); s->creata = s->visto = t; nsess++;
            snprintf(token_out, 33, "%s", s->token); esito = "ok";
        } else esito = "spento";
    }
    tu();
    return esito;
}

/* ------------------------------------------------------------------ pagina del codice (identica a pd_tablet.py) */
static const char *PAGINA1 =
    "<!doctype html>\n"
    "<html lang=\"it\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n"
    "<title>Professore Digitale - codice</title>\n"
    "<style>\n"
    "body{margin:0;font-family:\"DejaVu Sans\",Arial,sans-serif;background:#f4f1ea;color:#1d2433;display:flex;min-height:100vh;align-items:center;justify-content:center}\n"
    "main{background:#fff;border-radius:18px;box-shadow:0 6px 24px rgba(0,0,0,.12);padding:2rem 1.6rem;max-width:26rem;margin:1rem;text-align:center}\n"
    "h1{font-size:1.6rem;margin:.2rem 0 1rem}p{font-size:1.25rem;line-height:1.45}\n"
    "input{font-size:2.2rem;letter-spacing:.3em;text-align:center;width:11rem;padding:.4rem;border:3px solid #2f5d8a;border-radius:12px}\n"
    "button{font-size:1.4rem;margin-top:1rem;padding:.7rem 2rem;border:0;border-radius:12px;background:#2f5d8a;color:#fff}\n"
    ".err{color:#a01818;font-weight:bold}\n"
    "</style></head><body><main>\n"
    "<h1>&#128241; Professore Digitale</h1>\n"
    "<p>Inserite il codice che vedete sullo schermo del facilitatore.</p>\n";
static const char *PAGINA2 =
    "<form method=\"get\" action=\"/\"><input name=\"c\" inputmode=\"numeric\" pattern=\"[0-9]{6}\" maxlength=\"6\" autocomplete=\"off\" autofocus aria-label=\"Codice di 6 cifre\"><br>\n"
    "<button type=\"submit\">Entra</button></form>\n"
    "</main></body></html>\n";

static void pagina_codice(req_t *r, int code, const char *esito) {
    const char *msg = !strcmp(esito, "sbagliato") ? "Il codice non è giusto. Controllate le cifre e riprovate." :
                      !strcmp(esito, "troppi") ? "Troppi tentativi. Aspettate un minuto e riprovate." :
                      !strcmp(esito, "scaduto") ? "Il collegamento è scaduto o il codice è cambiato: inserite il nuovo codice." : NULL;
    buf_t b; buf_init(&b);
    buf_adds(&b, PAGINA1);
    if (msg) buf_addf(&b, "<p class=\"err\" role=\"alert\">%s</p>\n", msg);
    buf_adds(&b, PAGINA2);
    send_response(r, code, "text/html; charset=utf-8", b.p, b.n,
                  "Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'\r\n");
    buf_free(&b);
}

/* ------------------------------------------------------------------ ingresso delle richieste dei tablet */
static void token_da_cookie(const char *c, char *out) {   /* (^|;)\s*pd_tablet=([0-9a-f]{32})\s*(;|$) */
    out[0] = 0;
    for (const char *p = c; p && *p;) {
        while (*p == ' ' || *p == '\t') p++;
        if (!strncmp(p, "pd_tablet=", 10)) {
            const char *v = p + 10; int i = 0;
            while (i < 32 && ((v[i] >= '0' && v[i] <= '9') || (v[i] >= 'a' && v[i] <= 'f'))) i++;
            const char *d = v + i; while (*d == ' ' || *d == '\t') d++;
            if (i == 32 && (*d == ';' || *d == 0)) { memcpy(out, v, 32); out[32] = 0; return; }
        }
        p = strchr(p, ';'); if (p) p++;
    }
}
static void valore_c(const char *q, char *out, size_t n) {     /* ?c=123456 */
    out[0] = 0;
    for (const char *p = q; p && *p;) {
        if (p[0] == 'c' && p[1] == '=') {
            size_t i = 0; p += 2;
            while (*p && *p != '&' && i < n - 1) { out[i++] = *p == '+' ? ' ' : *p; p++; }
            out[i] = 0;
            size_t a = 0, L = strlen(out);
            while (L && out[L - 1] == ' ') out[--L] = 0;
            while (out[a] == ' ') a++;
            if (a) memmove(out, out + a, L - a + 1);
            return;
        }
        p = strchr(p, '&'); if (p) p++;
    }
}
static int consentita(const char *met, const char *path) {
    if (!strcmp(met, "POST")) return !strcmp(path, "/api/tts") || !strcmp(path, "/api/chat") || !strcmp(path, "/api/ospite/presenza");
    return !strcmp(path, "/api/status") || !strcmp(path, "/api/packs") || !strcmp(path, "/api/rete");
}

int tablet_ingresso(req_t *r) {
    if (!ip_ok(r->ip)) { send_error(r, 403, "solo dalla rete locale"); return 0; }
    char h[80]; snprintf(h, sizeof h, "%s:%d", r->local, porta);
    if (strcmp(r->host, h)) { send_error(r, 403, !strcmp(r->method, "POST") ? "origine non consentita" : "host non consentito"); return 0; }
    int post = !strcmp(r->method, "POST");
    if (post && r->origin[0]) {
        char o[300]; snprintf(o, sizeof o, "http://%s", r->host);
        if (strcmp(r->origin, o)) { send_error(r, 403, "origine non consentita"); return 0; }
    }
    if (!post && strcmp(r->method, "GET")) return 1;              /* altri metodi: 405 */
    if (!post && !strcmp(r->path, "/")) {
        char c[64]; valore_c(r->query, c, sizeof c);
        if (c[0]) {
            char tok[33] = ""; const char *esito = prova_codice(r->ip, c, tok);
            if (!strcmp(esito, "ok")) {
                char extra[256];
                snprintf(extra, sizeof extra, "Location: /\r\nSet-Cookie: pd_tablet=%s; Path=/; Max-Age=%d; HttpOnly; SameSite=Strict\r\n", tok, TAB_SESSIONE_S);
                send_response(r, 303, "text/plain; charset=utf-8", "", 0, extra);
            } else pagina_codice(r, !strcmp(esito, "troppi") ? 429 : 403, esito);
            return 0;
        }
    }
    token_da_cookie(r->cookie, r->token);
    if (!sessione(r->token, r->ip)) {
        if (!post && (!strcmp(r->path, "/") || !strcmp(r->path, "/index.html")) ) pagina_codice(r, 200, r->token[0] ? "scaduto" : "");
        else send_error(r, 403, "serve il codice del facilitatore");
        return 0;
    }
    if ((post || !strncmp(r->path, "/api/", 5)) && !consentita(r->method, r->path)) { send_error(r, 403, "non consentito dai tablet"); return 0; }
    return 1;
}

int tablet_posto(int chat) {
    volatile LONG *n = chat ? &n_chat : &n_tts;
    if (InterlockedIncrement(n) > (chat ? TAB_CHAT_MAX : TAB_TTS_MAX)) { InterlockedDecrement(n); return 0; }
    return 1;
}
void tablet_libera(int chat) { InterlockedDecrement(chat ? &n_chat : &n_tts); }

/* ------------------------------------------------------------------ presenza nel quadro dell'aula */
/* testo dalla rete: senza caratteri di controllo, senza spazi ai lati, al massimo max caratteri (come testo_pulito) */
static void pulito(const jv *v, char *out, size_t n, size_t max) {
    out[0] = 0;
    if (!v || v->t != J_STR) return;
    const unsigned char *p = (const unsigned char *)v->str; size_t L = v->slen, o = 0;
    for (size_t i = 0; i < L && o + 4 < n; i++) {
        if (p[i] < 0x20 || p[i] == 0x7f) continue;
        if (p[i] == 0xC2 && i + 1 < L && p[i + 1] >= 0x80 && p[i + 1] <= 0x9F) { i++; continue; }
        out[o++] = (char)p[i];
    }
    out[o] = 0;
    size_t a = 0; while (out[a] == ' ') a++;
    if (a) memmove(out, out + a, strlen(out + a) + 1);
    size_t c = 0, i = 0;
    for (; out[i]; i++) if (((unsigned char)out[i] & 0xC0) != 0x80 && c++ == max) break;
    out[i] = 0;
    L = strlen(out); while (L && out[L - 1] == ' ') out[--L] = 0;
}

void tablet_presenza(req_t *r, jv *req) {
    if (r->body_len == 0 || r->body_len > TAB_MAX_PRESENZA) { send_error(r, 400, "richiesta non valida"); return; }
    if (!req || req->t != J_OBJ) { send_error(r, 400, "oggetto atteso"); return; }
    jv *att = jget(req, "attivita"); if (att && att->t != J_OBJ) att = NULL;
    char nome[256], pagina[512], id[9] = "";
    pulito(jget(req, "nome"), nome, sizeof nome, 60);
    pulito(jget(att, "titolo"), pagina, sizeof pagina, 120);
    tl();
    int i = trova(r->token);
    if (i >= 0) { snprintf(sess[i].nome, sizeof sess[i].nome, "%s", nome); snprintf(sess[i].pagina, sizeof sess[i].pagina, "%s", pagina); snprintf(id, sizeof id, "%s", sess[i].id); }
    tu();
    if (!id[0]) { send_error(r, 403, "serve il codice del facilitatore"); return; }
    char cod[16]; buf_t b; buf_init(&b);
    if (!aula_codice_facilitatore(cod, sizeof cod)) { buf_adds(&b, "{\"ok\": true, \"aula\": false}"); send_json(r, 200, &b); buf_free(&b); return; }
    buf_t c; buf_init(&c);
    buf_addf(&c, "{\"id\": \"tablet-%s\", \"codice\": ", id); json_str(&c, cod);
    buf_adds(&c, ", \"pc\": \"Tablet o telefono\", \"utente\": "); json_str(&c, nome);
    buf_adds(&c, ", \"versione\": "); json_str(&c, G.version);
    buf_adds(&c, ", \"sistema\": {\"os\": \"Tablet o telefono (ospite)\"}, \"componenti\": {\"ia\": \"IA del PC dell'aula\", \"voce\": \"PC dell'aula\", \"microfono\": \"\"}");
    buf_adds(&c, ", \"attivita\": "); if (att) buf_add(&c, att->raw, att->rawlen); else buf_adds(&c, "{}");
    jv *p = jget(req, "progressi"), *m = jget(req, "mano");
    buf_adds(&c, ", \"progressi\": "); if (p) buf_add(&c, p->raw, p->rawlen); else buf_adds(&c, "null");
    buf_adds(&c, ", \"mano\": "); if (m) buf_add(&c, m->raw, m->rawlen); else buf_adds(&c, "null");
    buf_adds(&c, "}");
    int code = aula_ricevi(c.p, c.n, r->ip, &b);
    if (code == 200 && b.n && b.p[b.n - 1] == '}') { b.n--; buf_adds(&b, ", \"aula\": true}"); }
    send_json(r, code, &b);
    buf_free(&b); buf_free(&c);
}

/* ------------------------------------------------------------------ API locale del PC: /api/tablet */
static void stato_json(buf_t *b, const char *err) {
    char ips[8][20]; int n = aula_indirizzi(ips, 8);
    char lista[9][20]; int k = 0;
    for (int i = 0; i < n; i++) if (ip_ok(ips[i])) snprintf(lista[k++], 20, "%s", ips[i]);
    if (loopback) snprintf(lista[k++], 20, "127.0.0.1");
    double t = ora();
    tl();
    pulisci(t);
    if (err) { buf_adds(b, "{\"ok\": false, \"error\": "); json_str(b, err); buf_adds(b, ", "); } else buf_adds(b, "{\"ok\": true, ");
    buf_addf(b, "\"attivo\": %s, \"porta\": %d, \"codice\": ", attivo ? "true" : "false", porta); json_str(b, codice);
    buf_adds(b, ", \"ips\": [");
    for (int i = 0; i < k; i++) { if (i) buf_adds(b, ", "); json_str(b, lista[i]); }
    buf_adds(b, "], \"indirizzi\": [");
    for (int i = 0; attivo && i < k; i++) buf_addf(b, "%s\"http://%s:%d/?c=%s\"", i ? ", " : "", lista[i], porta, codice);
    buf_adds(b, "], \"dispositivi\": [");
    int ord[TAB_MAX_SESSIONI]; for (int i = 0; i < nsess; i++) ord[i] = i;
    for (int i = 0; i < nsess; i++) for (int j = i + 1; j < nsess; j++) if (sess[ord[j]].visto > sess[ord[i]].visto) { int x = ord[i]; ord[i] = ord[j]; ord[j] = x; }
    for (int i = 0; i < nsess; i++) {
        sess_t *s = &sess[ord[i]];
        if (i) buf_adds(b, ", ");
        buf_adds(b, "{\"id\": "); json_str(b, s->id); buf_adds(b, ", \"ip\": "); json_str(b, s->ip);
        buf_adds(b, ", \"nome\": "); json_str(b, s->nome); buf_adds(b, ", \"pagina\": "); json_str(b, s->pagina);
        buf_addf(b, ", \"fa_s\": %d}", (int)(t - s->visto));
    }
    buf_adds(b, "], \"errore\": "); json_str(b, errore); buf_adds(b, "}");
    tu();
}

void tablet_api(req_t *r, jv *req) {
    buf_t b; buf_init(&b);
    if (req) {
        const char *az = jstr(req, "azione", "");
        if (!strcmp(az, "accendi")) {
            tl(); int ok = accendi(); char e[200]; snprintf(e, sizeof e, "%s", errore); tu();
            if (!ok) { stato_json(&b, e); send_json(r, 409, &b); buf_free(&b); return; }
        } else if (!strcmp(az, "spegni")) { tl(); spegni(); tu(); }
        else if (!strcmp(az, "codice")) { tl(); if (attivo) { nuovo_codice(); nsess = 0; } tu(); }   /* i tablet devono rientrare */
        else if (!strcmp(az, "togli")) {
            const char *id = jstr(req, "id", "");
            tl(); for (int i = 0; i < nsess;) { if (!strcmp(sess[i].id, id)) sess[i] = sess[--nsess]; else i++; } tu();
        } else { send_error(r, 400, "azione non valida (accendi, spegni, codice, togli)"); buf_free(&b); return; }
    }
    stato_json(&b, NULL);
    send_json(r, 200, &b);
    buf_free(&b);
}
