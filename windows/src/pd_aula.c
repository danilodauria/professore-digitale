/* Professore Digitale per Windows - Quadro dell'aula (rete locale) e stato della connessione
 * Stesso comportamento di src/server/pd_aula.py:
 *   aulaRuolo = "facilitatore": ascolta in rete locale SOLO /aula/info e /aula/ciao (porta 8766, TCP)
 *                               e risponde alla ricerca "PD-AULA?" (porta 8767, UDP);
 *   aulaRuolo = "allievo":      cerca il PC del facilitatore e ogni 20 secondi gli invia un riepilogo.
 * Solo indirizzi della rete locale; l'interfaccia resta su 127.0.0.1. Compatibile con Windows XP SP3.
 * «Mano alzata» (3.3): presenza con  mano: {alzata, da, messaggio};  risposta mirata nella risposta a /aula/ciao
 *   mano: {da, stato: "arrivo"|"risolto"};  API locali /api/aula/mano e /api/aula/rispondi (come pd_aula.py).
 * Ideato e sviluppato da Danilo D'Auria - Licenza MIT */
#include "pd.h"
#include <objbase.h>

#define AULA_TCP 8766
#define AULA_UDP 8767
#define AULA_MAX_CIAO (64 * 1024)
#define AULA_MAX_CLIENTI 200
#define AULA_INTERVALLO 20
#define AULA_INTERVALLO_MANO 5          /* con la mano alzata la presenza parte ogni 5 s */
#define MANO_MAX_S (30 * 60)            /* la mano si abbassa da sola dopo 30 minuti */
#define MANO_MAX_TESTO 120              /* caratteri (non byte) */
#define MANO_BUF 488                    /* 120 caratteri UTF-8 di al massimo 4 byte */

typedef struct {
    char id[48]; double visto; char *json;                /* json = record senza "visto" */
    int m_alzata; long long m_da; double m_dal;            /* mano: da = istante dell'allievo, dal = ora del facilitatore */
    char m_stato[12]; char m_msg[MANO_BUF];
} cliente_t;

static CRITICAL_SECTION A; static LONG a_init = 0;
static char ruolo[16] = "", c_nome[64] = "Aula", c_codice[16] = "", c_server[104] = "", c_allievo[64] = "";
static cliente_t clienti[AULA_MAX_CLIENTI]; static int nclienti = 0;
static long long ann_id = 0; static char ann_testo[512] = "";
static char *presenza = NULL;                          /* ultimo JSON dall'interfaccia (PC allievo) */
static char srv_ip[64] = ""; static int srv_porta = AULA_TCP; static char srv_nome[64] = "", srv_pc[64] = "", srv_ver[24] = "";
static unsigned long long srv_t = 0;
static unsigned long long inv_t = 0; static int inv_ok = 0; static char inv_err[160] = "";
static long long ann_ric_id = 0; static char ann_ric[512] = "";
static SOCKET tcp_s = INVALID_SOCKET, udp_s = INVALID_SOCKET;
static volatile LONG fac_attivo = 0;
static int mano_alzata = 0; static long long mano_da = 0; static char mano_msg[MANO_BUF] = "", mano_risp[12] = "";   /* PC allievo */
static HANDLE sveglia = NULL; static volatile LONG forza_invio = 0;   /* invio immediato della presenza */

static void al(void) { if (InterlockedCompareExchange(&a_init, 1, 0) == 0) InitializeCriticalSection(&A); EnterCriticalSection(&A); }
static void au(void) { LeaveCriticalSection(&A); }
static double now_s(void) { FILETIME ft; GetSystemTimeAsFileTime(&ft); ULARGE_INTEGER u; u.LowPart = ft.dwLowDateTime; u.HighPart = ft.dwHighDateTime; return (double)(u.QuadPart - 116444736000000000ULL) / 1e7; }

/* ------------------------------------------------------------------ mano alzata: testi e numeri */
static int car_controllo(const unsigned char *p, size_t L, size_t i) {   /* 0-31, 127, U+0080-U+009F */
    return p[i] < 0x20 || p[i] == 0x7f || (p[i] == 0xC2 && i + 1 < L && p[i + 1] >= 0x80 && p[i + 1] <= 0x9F);
}
static size_t conta_car(const char *s, size_t L) { size_t n = 0; for (size_t i = 0; i < L; i++) if (((unsigned char)s[i] & 0xC0) != 0x80) n++; return n; }
static void togli_spazi(char *s) {
    size_t L = strlen(s), a = 0;
    while (L && s[L - 1] == ' ') s[--L] = 0;
    while (s[a] == ' ') a++;
    if (a) memmove(s, s + a, L - a + 1);
}
static void taglia_car(char *s, size_t max) {           /* al massimo max caratteri, senza spezzare l'UTF-8 */
    size_t n = 0, i = 0;
    for (; s[i]; i++) if (((unsigned char)s[i] & 0xC0) != 0x80 && n++ == max) break;
    s[i] = 0;
}
/* testo ricevuto dalla rete: senza caratteri di controllo, al massimo 120 caratteri (come testo_pulito in pd_aula.py) */
static void testo_pulito(const jv *v, char *out, size_t n) {
    out[0] = 0;
    if (!v || v->t != J_STR) return;
    const unsigned char *p = (const unsigned char *)v->str; size_t L = v->slen, o = 0;
    for (size_t i = 0; i < L && o + 4 < n; i++) {
        if (car_controllo(p, L, i)) { if (p[i] == 0xC2) i++; continue; }
        out[o++] = (char)p[i];
    }
    out[o] = 0;
    togli_spazi(out); taglia_car(out, MANO_MAX_TESTO); togli_spazi(out);
}
/* validazione stretta del messaggio dell'allievo (API locale): NULL se va bene, altrimenti l'errore */
static const char *controlla_messaggio(const jv *v, char *out, size_t n) {
    out[0] = 0;
    if (!v || v->t == J_NULL) return NULL;
    if (v->t != J_STR) return "il messaggio deve essere un testo";
    char *t = (char *)malloc(v->slen + 1); memcpy(t, v->str, v->slen); t[v->slen] = 0;
    size_t L = v->slen, a = 0;
    while (L && t[L - 1] == ' ') L--;
    while (a < L && t[a] == ' ') a++;
    const char *err = NULL;
    for (size_t i = a; i < L && !err; i++) if (car_controllo((const unsigned char *)t, L, i)) err = "il messaggio contiene caratteri non ammessi";
    if (!err && conta_car(t + a, L - a) > MANO_MAX_TESTO) err = "il messaggio è troppo lungo (al massimo 120 caratteri)";
    if (!err && L - a >= n) err = "il messaggio è troppo lungo (al massimo 120 caratteri)";
    if (!err) { memcpy(out, t + a, L - a); out[L - a] = 0; }
    free(t);
    return err;
}
static long long num_grande(const jv *v) {             /* istante in secondi: intero tra 0 e 10^11 */
    if (!v || v->t != J_NUM || !(v->num >= 0)) return 0;
    return v->num > 1e11 ? 100000000000LL : (long long)v->num;
}
static int id_valido(const jv *v) {
    if (!v || v->t != J_STR || v->slen == 0 || v->slen > 40) return 0;
    for (size_t i = 0; i < v->slen; i++) if (!isalnum((unsigned char)v->str[i]) || (unsigned char)v->str[i] > 127) { if (v->str[i] != '-') return 0; }
    return 1;
}
/* mano di questo PC (allievo); con il lock preso. Dopo 30 minuti si abbassa da sola */
static void mano_scadenza(void) { if (mano_alzata && now_s() - (double)mano_da > MANO_MAX_S) { mano_alzata = 0; mano_msg[0] = 0; mano_risp[0] = 0; } }
static void mano_allievo_json(buf_t *b) {
    mano_scadenza();
    buf_addf(b, "{\"alzata\": %s, \"da\": %lld, \"messaggio\": ", mano_alzata ? "true" : "false", mano_da); json_str(b, mano_msg);
    buf_adds(b, ", \"risposta\": "); json_str(b, mano_risp); buf_adds(b, "}");
}
/* mano di un allievo come la vede il facilitatore (stessi campi di _mano_cliente in pd_aula.py) */
static int mano_su(const cliente_t *c, double ora, int *attesa) {
    int att = c->m_dal > 0 ? (int)(ora - c->m_dal) : 0;
    if (attesa) *attesa = att < 0 ? 0 : att;
    return c->m_alzata && att < MANO_MAX_S;
}
static void mano_cliente_json(buf_t *b, const cliente_t *c, double ora) {
    int att, su = mano_su(c, ora, &att);
    buf_addf(b, "{\"alzata\": %s, \"da\": %lld, \"messaggio\": ", su ? "true" : "false", c->m_da); json_str(b, su ? c->m_msg : "");
    buf_adds(b, ", \"stato\": "); json_str(b, su ? c->m_stato : ""); buf_addf(b, ", \"attesa_s\": %d}", su ? att : 0);
}

/* ------------------------------------------------------------------ rete: utilita' */
static int ip_privato(unsigned long a_host) {          /* a_host in ordine dell'host */
    unsigned b1 = (a_host >> 24) & 255, b2 = (a_host >> 16) & 255;
    return b1 == 10 || b1 == 127 || (b1 == 172 && b2 >= 16 && b2 <= 31) || (b1 == 192 && b2 == 168) || (b1 == 169 && b2 == 254) ||
           (b1 == 192 && b2 == 0) || (b1 == 100 && b2 >= 64 && b2 <= 127);
}
static int ip_str_privato(const char *s) { unsigned long a = inet_addr(s); return a != INADDR_NONE && ip_privato(ntohl(a)); }

static void nome_pc(char *out, size_t n) {
    char h[256] = "";
    if (gethostname(h, sizeof h) != 0 || !h[0]) snprintf(h, sizeof h, "computer");
    snprintf(out, n, "%.60s", h);
}

/* indirizzi IPv4 di questo computer (nessun pacchetto inviato) */
static int indirizzi(char ips[][20], int max) {
    int n = 0;
    const char *dest[3] = { "10.255.255.255", "192.168.255.255", "172.31.255.255" };
    for (int i = 0; i < 3 && n < max; i++) {
        SOCKET s = socket(AF_INET, SOCK_DGRAM, IPPROTO_UDP);
        if (s == INVALID_SOCKET) continue;
        struct sockaddr_in d; memset(&d, 0, sizeof d); d.sin_family = AF_INET; d.sin_port = htons(1); d.sin_addr.s_addr = inet_addr(dest[i]);
        if (connect(s, (struct sockaddr *)&d, sizeof d) == 0) {
            struct sockaddr_in me; int L = sizeof me;
            if (getsockname(s, (struct sockaddr *)&me, &L) == 0 && me.sin_addr.s_addr && (ntohl(me.sin_addr.s_addr) >> 24) != 127) {
                const char *t = inet_ntoa(me.sin_addr); int dup = 0;
                for (int k = 0; k < n; k++) if (!strcmp(ips[k], t)) dup = 1;
                if (!dup) snprintf(ips[n++], 20, "%s", t);
            }
        }
        closesocket(s);
    }
    char h[256];
    if (gethostname(h, sizeof h) == 0) {
        struct hostent *he = gethostbyname(h);
        for (int i = 0; he && he->h_addrtype == AF_INET && he->h_addr_list[i] && n < max; i++) {
            struct in_addr a; memcpy(&a, he->h_addr_list[i], 4);
            if ((ntohl(a.s_addr) >> 24) == 127) continue;
            const char *t = inet_ntoa(a); int dup = 0;
            for (int k = 0; k < n; k++) if (!strcmp(ips[k], t)) dup = 1;
            if (!dup) snprintf(ips[n++], 20, "%s", t);
        }
    }
    return n;
}
static void ips_json(buf_t *b) {
    char ips[8][20]; int n = indirizzi(ips, 8);
    buf_adds(b, "[");
    for (int i = 0; i < n; i++) { if (i) buf_adds(b, ", "); json_str(b, ips[i]); }
    buf_adds(b, "]");
}

/* ------------------------------------------------------------------ connessione a Internet */
static unsigned long long rete_t = 0; static int rete_on = 0; static char rete_via[24] = "";
static int prova_tcp(const char *ip, int porta, int ms) {
    SOCKET s = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
    if (s == INVALID_SOCKET) return 0;
    u_long nb = 1; ioctlsocket(s, FIONBIO, &nb);
    struct sockaddr_in d; memset(&d, 0, sizeof d); d.sin_family = AF_INET; d.sin_port = htons((u_short)porta); d.sin_addr.s_addr = inet_addr(ip);
    int ok = 0;
    if (connect(s, (struct sockaddr *)&d, sizeof d) == 0) ok = 1;
    else if (WSAGetLastError() == WSAEWOULDBLOCK) {
        fd_set w, e; FD_ZERO(&w); FD_ZERO(&e); FD_SET(s, &w); FD_SET(s, &e);
        struct timeval tv = { ms / 1000, (ms % 1000) * 1000 };
        if (select(0, NULL, &w, &e, &tv) > 0 && FD_ISSET(s, &w) && !FD_ISSET(s, &e)) ok = 1;
    }
    closesocket(s);
    return ok;
}
void aula_rete_json(buf_t *b, int forza) {
    static const char *bers[4][2] = { { "1.1.1.1", "443" }, { "9.9.9.9", "443" }, { "8.8.8.8", "53" }, { "208.67.222.222", "443" } };
    al(); int fresco = rete_t && now_ms() - rete_t < 45000 && !forza; au();
    if (!fresco) {
        int on = 0; char via[24] = "";
        for (int i = 0; i < 4 && !on; i++) if (prova_tcp(bers[i][0], atoi(bers[i][1]), 2500)) { on = 1; snprintf(via, sizeof via, "%s", bers[i][0]); }
        al(); rete_on = on; snprintf(rete_via, sizeof rete_via, "%s", via); rete_t = now_ms(); au();
    }
    al();
    buf_addf(b, "{\"ok\": true, \"online\": %s, \"via\": ", rete_on ? "true" : "false"); json_str(b, rete_via);
    buf_addf(b, ", \"eta_s\": %d}", (int)((now_ms() - rete_t) / 1000));
    au();
}

/* ------------------------------------------------------------------ impostazioni */
static void leggi_impostazioni(void) {
    wchar_t *p = path_join(G.data_dir, L"settings.json");
    buf_t f; jv *s = NULL; char e[64];
    if (file_read(p, &f, PD_MAX_JSON)) { s = json_parse(f.p, f.n, e, sizeof e); buf_free(&f); }
    free(p);
    const char *r = jstr(s, "aulaRuolo", "");
    al();
    snprintf(ruolo, sizeof ruolo, "%s", !strcmp(r, "facilitatore") || !strcmp(r, "allievo") ? r : "");
    const char *nm = jstr(s, "aulaNome", ""); snprintf(c_nome, sizeof c_nome, "%.60s", nm && *nm ? nm : "Aula");
    snprintf(c_codice, sizeof c_codice, "%.12s", jstr(s, "aulaCodice", ""));
    snprintf(c_server, sizeof c_server, "%.100s", jstr(s, "aulaServer", ""));
    snprintf(c_allievo, sizeof c_allievo, "%.60s", jstr(s, "studentName", ""));
    au();
    json_free(s);
}

/* ------------------------------------------------------------------ persistenza dei clienti */
static void salva_clienti(void) {          /* chiamare con il lock preso */
    buf_t b; buf_init(&b);
    buf_adds(&b, "{\"clienti\": {");
    for (int i = 0; i < nclienti; i++) {
        if (i) buf_adds(&b, ", ");
        cliente_t *c = &clienti[i];
        json_str(&b, c->id); buf_addf(&b, ": {\"visto\": %.3f, \"r\": %s", c->visto, c->json);
        buf_addf(&b, ", \"m\": {\"alzata\": %s, \"da\": %lld, \"dal\": %.3f, \"stato\": ", c->m_alzata ? "true" : "false", c->m_da, c->m_dal);
        json_str(&b, c->m_stato); buf_adds(&b, ", \"messaggio\": "); json_str(&b, c->m_msg); buf_adds(&b, "}}");
    }
    buf_addf(&b, "}, \"annuncio\": {\"id\": %lld, \"testo\": ", ann_id); json_str(&b, ann_testo); buf_adds(&b, "}}");
    wchar_t *p = path_join(G.data_dir, L"aula-clienti-win.json");
    mkdirs(G.data_dir); file_write_atomic(p, b.p, b.n);
    free(p); buf_free(&b);
}
static void carica_clienti(void) {
    wchar_t *p = path_join(G.data_dir, L"aula-clienti-win.json");
    buf_t f; char e[64];
    if (file_read(p, &f, 8u * 1024u * 1024u)) {
        jv *d = json_parse(f.p, f.n, e, sizeof e), *c = jget(d, "clienti"), *a = jget(d, "annuncio");
        al();
        for (size_t i = 0; c && c->t == J_OBJ && i < c->n && nclienti < AULA_MAX_CLIENTI; i++) {
            jv *x = c->items[i], *r = jget(x, "r");
            if (!r || r->t != J_OBJ) continue;
            cliente_t *k = &clienti[nclienti++]; memset(k, 0, sizeof *k);
            snprintf(k->id, sizeof k->id, "%.40s", c->keys[i]); k->visto = jnum(x, "visto", 0);
            jv *m = jget(x, "m");
            if (m) {
                k->m_alzata = jbool(m, "alzata", 0); k->m_da = num_grande(jget(m, "da")); k->m_dal = jnum(m, "dal", 0);
                const char *st = jstr(m, "stato", ""); snprintf(k->m_stato, sizeof k->m_stato, "%s", !strcmp(st, "arrivo") || !strcmp(st, "risolto") ? st : "");
                testo_pulito(jget(m, "messaggio"), k->m_msg, sizeof k->m_msg);
            }
            k->json = (char *)malloc(r->rawlen + 1); memcpy(k->json, r->raw, r->rawlen); k->json[r->rawlen] = 0;
        }
        if (a) { ann_id = (long long)jnum(a, "id", 0); snprintf(ann_testo, sizeof ann_testo, "%.500s", jstr(a, "testo", "")); }
        au();
        json_free(d); buf_free(&f);
    }
    free(p);
}

/* ------------------------------------------------------------------ facilitatore: ricezione */
static void str_lim(buf_t *b, const jv *o, const char *k, size_t max) {
    const char *s = jstr(o, k, ""); size_t L = strlen(s);
    if (L > max) { L = max; while (L && ((unsigned char)s[L] & 0xC0) == 0x80) L--; }   /* non spezzare un carattere UTF-8 */
    json_strn(b, s, L);
}
static long long num_lim(const jv *o, const char *k) { double d = jnum(o, k, 0); if (d < 0) d = 0; if (d > 1e7) d = 1e7; return (long long)d; }

static int ricevi(const char *body, size_t n, const char *ip, buf_t *out) {
    char e[100]; jv *d = json_parse(body, n, e, sizeof e);
    if (!d || d->t != J_OBJ) { json_free(d); buf_adds(out, "{\"ok\": false, \"error\": \"richiesta non valida\"}"); return 400; }
    al(); int fac = !strcmp(ruolo, "facilitatore"); char cod[16]; snprintf(cod, sizeof cod, "%s", c_codice); au();
    if (!fac) { json_free(d); buf_adds(out, "{\"ok\": false, \"error\": \"questo PC non è il facilitatore\"}"); return 503; }
    if (cod[0] && strcmp(jstr(d, "codice", ""), cod)) { json_free(d); buf_adds(out, "{\"ok\": false, \"error\": \"codice dell'aula non corretto\"}"); return 403; }
    const char *id = jstr(d, "id", "");
    size_t L = strlen(id); int ok = L > 0 && L <= 40;
    for (size_t i = 0; ok && i < L; i++) if (!isalnum((unsigned char)id[i]) && id[i] != '-') ok = 0;
    if (!ok) { json_free(d); buf_adds(out, "{\"ok\": false, \"error\": \"id non valido\"}"); return 400; }
    jv *p = jget(d, "progressi"), *att = jget(d, "attivita"), *sis = jget(d, "sistema"), *comp = jget(d, "componenti");
    buf_t r; buf_init(&r);
    buf_adds(&r, "{\"id\": "); json_str(&r, id); buf_adds(&r, ", \"ip\": "); json_str(&r, ip);
    buf_adds(&r, ", \"pc\": "); str_lim(&r, d, "pc", 60); buf_adds(&r, ", \"utente\": "); str_lim(&r, d, "utente", 60);
    buf_adds(&r, ", \"versione\": "); str_lim(&r, d, "versione", 20);
    buf_adds(&r, ", \"sistema\": {\"os\": "); str_lim(&r, sis, "os", 80); buf_addf(&r, ", \"ram_mb\": %lld, \"cpus\": %lld, \"arch\": ", num_lim(sis, "ram_mb"), num_lim(sis, "cpus")); str_lim(&r, sis, "arch", 20);
    buf_adds(&r, "}, \"componenti\": {\"ia\": "); str_lim(&r, comp, "ia", 60); buf_adds(&r, ", \"voce\": "); str_lim(&r, comp, "voce", 60); buf_adds(&r, ", \"microfono\": "); str_lim(&r, comp, "microfono", 40);
    buf_adds(&r, "}, \"attivita\": {\"vista\": "); str_lim(&r, att, "vista", 30); buf_adds(&r, ", \"titolo\": "); str_lim(&r, att, "titolo", 120);
    buf_addf(&r, ", \"inattivo_s\": %lld}", num_lim(att, "inattivo_s"));
    buf_addf(&r, ", \"progressi\": {\"lezioni_fatte\": %lld, \"lezioni_totali\": %lld, \"palestra\": %lld, \"quiz\": [", num_lim(p, "lezioni_fatte"), num_lim(p, "lezioni_totali"), num_lim(p, "palestra"));
    jv *q = jget(p, "quiz"); int k = 0;
    for (size_t i = 0; q && q->t == J_ARR && i < q->n && i < 20; i++) {
        jv *x = q->items[i]; if (x->t != J_OBJ) continue;
        if (k++) buf_adds(&r, ", ");
        buf_adds(&r, "{\"titolo\": "); str_lim(&r, x, "titolo", 80); buf_addf(&r, ", \"migliore\": %lld, \"superata\": %s}", num_lim(x, "migliore"), jbool(x, "superata", 0) ? "true" : "false");
    }
    buf_adds(&r, "], \"attestati\": ["); jv *a = jget(p, "attestati"); k = 0;
    for (size_t i = 0; a && a->t == J_ARR && i < a->n && i < 30; i++) {
        jv *x = a->items[i]; if (x->t != J_OBJ) continue;
        if (k++) buf_adds(&r, ", ");
        buf_adds(&r, "{\"titolo\": "); str_lim(&r, x, "titolo", 80); buf_adds(&r, ", \"data\": "); str_lim(&r, x, "data", 20); buf_addf(&r, ", \"punteggio\": %lld}", num_lim(x, "punteggio"));
    }
    buf_adds(&r, "]}}");
    jv *mj = jget(d, "mano"), *ma = jget(mj, "alzata");
    int m_alz = ma && ma->t == J_TRUE; long long m_da = num_grande(jget(mj, "da"));
    char m_msg[MANO_BUF]; if (m_alz) testo_pulito(jget(mj, "messaggio"), m_msg, sizeof m_msg); else m_msg[0] = 0;
    al();
    int idx = -1;
    for (int i = 0; i < nclienti; i++) if (!strcmp(clienti[i].id, id)) idx = i;
    if (idx < 0) {
        if (nclienti >= AULA_MAX_CLIENTI) { int v = 0; for (int i = 1; i < nclienti; i++) if (clienti[i].visto < clienti[v].visto) v = i; free(clienti[v].json); clienti[v] = clienti[--nclienti]; }
        idx = nclienti++; memset(&clienti[idx], 0, sizeof clienti[idx]); snprintf(clienti[idx].id, sizeof clienti[idx].id, "%s", id);
    }
    cliente_t *kc = &clienti[idx];
    free(kc->json); kc->json = buf_steal(&r); kc->visto = now_s();
    if (m_alz && m_da) {
        /* stessa richiesta di prima: si conservano l'ora d'arrivo e la risposta del facilitatore */
        if (!(kc->m_da == m_da && kc->m_dal > 0)) { kc->m_stato[0] = 0; kc->m_dal = kc->visto; }
        kc->m_alzata = strcmp(kc->m_stato, "risolto") != 0; kc->m_da = m_da; snprintf(kc->m_msg, sizeof kc->m_msg, "%s", m_msg);
    } else { kc->m_alzata = 0; kc->m_da = m_da; kc->m_dal = 0; kc->m_stato[0] = 0; kc->m_msg[0] = 0; }
    salva_clienti();
    buf_adds(out, "{\"ok\": true, \"nome\": "); json_str(out, c_nome); buf_addf(out, ", \"annuncio\": {\"id\": %lld, \"testo\": ", ann_id); json_str(out, ann_testo); buf_adds(out, "}");
    if (m_alz && m_da && kc->m_stato[0]) { buf_addf(out, ", \"mano\": {\"da\": %lld, \"stato\": ", m_da); json_str(out, kc->m_stato); buf_adds(out, "}"); }   /* risposta mirata */
    buf_adds(out, "}");
    au();
    json_free(d);
    return 200;
}

static void info_json(buf_t *b) {
    char pc[64]; nome_pc(pc, sizeof pc);
    al();
    buf_adds(b, "{\"app\": \"professore-digitale\", \"ruolo\": \"facilitatore\", \"nome\": "); json_str(b, c_nome);
    buf_adds(b, ", \"pc\": "); json_str(b, pc); buf_adds(b, ", \"versione\": "); json_str(b, G.version);
    buf_addf(b, ", \"porta\": %d, \"codice_richiesto\": %s}", AULA_TCP, c_codice[0] ? "true" : "false");
    au();
}

static void risposta(SOCKET s, int code, buf_t *b) {
    char h[256];
    int n = snprintf(h, sizeof h, "HTTP/1.1 %d %s\r\nContent-Type: application/json; charset=utf-8\r\nContent-Length: %u\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n",
                     code, code == 200 ? "OK" : code == 403 ? "Forbidden" : code == 404 ? "Not Found" : code == 503 ? "Service Unavailable" : "Bad Request", (unsigned)b->n);
    send(s, h, n, 0);
    size_t o = 0; while (o < b->n) { int k = send(s, b->p + o, (int)(b->n - o), 0); if (k <= 0) break; o += (size_t)k; }
}

static unsigned __stdcall lan_conn(void *arg) {
    SOCKET s = (SOCKET)(UINT_PTR)arg;
    struct sockaddr_in peer; int pl = sizeof peer; char ip[20] = "";
    getpeername(s, (struct sockaddr *)&peer, &pl); snprintf(ip, sizeof ip, "%s", inet_ntoa(peer.sin_addr));
    DWORD tmo = 10000; setsockopt(s, SOL_SOCKET, SO_RCVTIMEO, (const char *)&tmo, sizeof tmo);
    buf_t out; buf_init(&out);
    if (!ip_privato(ntohl(peer.sin_addr.s_addr))) { buf_adds(&out, "{\"ok\": false}"); risposta(s, 403, &out); goto fine; }
    {
        char *hdr = (char *)malloc(8193); size_t hn = 0; char *end = NULL;
        while (hn < 8192) { int k = recv(s, hdr + hn, (int)(8192 - hn), 0); if (k <= 0) break; hn += (size_t)k; hdr[hn] = 0; if ((end = strstr(hdr, "\r\n\r\n")) != NULL) break; }
        if (!end) { free(hdr); goto fine; }
        *end = 0;
        char met[8] = "", path[256] = "";
        sscanf(hdr, "%7s %255s", met, path);
        char *qm = strchr(path, '?'); if (qm) *qm = 0;
        long long cl = 0; char *c, *low;
        for (low = hdr; *low; low++) *low = (char)tolower((unsigned char)*low);
        c = strstr(hdr, "\r\ncontent-length:"); if (c) cl = _atoi64(c + 17);
        if (!_stricmp(met, "GET") && !strcmp(path, "/aula/info")) { info_json(&out); risposta(s, 200, &out); }
        else if (!_stricmp(met, "POST") && !strcmp(path, "/aula/ciao") && cl > 0 && cl <= AULA_MAX_CIAO) {
            char *body = (char *)malloc((size_t)cl + 1); size_t got = hn - (size_t)(end + 4 - hdr);
            if (got > (size_t)cl) got = (size_t)cl;
            memcpy(body, end + 4, got);
            while (got < (size_t)cl) { int k = recv(s, body + got, (int)((size_t)cl - got), 0); if (k <= 0) break; got += (size_t)k; }
            body[got] = 0;
            if (got == (size_t)cl) { int code = ricevi(body, got, ip, &out); risposta(s, code, &out); }
            free(body);
        } else { buf_adds(&out, "{\"ok\": false}"); risposta(s, 404, &out); }
        free(hdr);
    }
fine:
    shutdown(s, SD_SEND); closesocket(s); buf_free(&out);
    return 0;
}

static unsigned __stdcall lan_accept(void *arg) {
    SOCKET ls = (SOCKET)(UINT_PTR)arg;
    for (;;) {
        SOCKET c = accept(ls, NULL, NULL);
        if (c == INVALID_SOCKET) { if (!fac_attivo) break; Sleep(50); continue; }
        HANDLE t = (HANDLE)_beginthreadex(NULL, 128 * 1024, lan_conn, (void *)(UINT_PTR)c, 0, NULL);
        if (t) CloseHandle(t); else closesocket(c);
    }
    return 0;
}

static unsigned __stdcall udp_loop(void *arg) {
    SOCKET u = (SOCKET)(UINT_PTR)arg;
    char buf[300];
    for (;;) {
        struct sockaddr_in from; int fl = sizeof from;
        int k = recvfrom(u, buf, sizeof buf - 1, 0, (struct sockaddr *)&from, &fl);
        if (k < 0) { if (!fac_attivo || WSAGetLastError() == WSAENOTSOCK) break; if (WSAGetLastError() == WSAETIMEDOUT) continue; Sleep(50); continue; }
        buf[k] = 0;
        while (k > 0 && (buf[k - 1] == '\n' || buf[k - 1] == '\r' || buf[k - 1] == ' ')) buf[--k] = 0;
        if (!strcmp(buf, "PD-AULA?") && ip_privato(ntohl(from.sin_addr.s_addr)) && fac_attivo) {
            buf_t b; buf_init(&b); info_json(&b);
            sendto(u, b.p, (int)b.n, 0, (struct sockaddr *)&from, fl);
            buf_free(&b);
        }
    }
    return 0;
}

static void avvia_facilitatore(void) {
    if (fac_attivo) return;
    InterlockedExchange(&fac_attivo, 1);
    SOCKET s = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
    struct sockaddr_in a; memset(&a, 0, sizeof a); a.sin_family = AF_INET; a.sin_port = htons(AULA_TCP); a.sin_addr.s_addr = htonl(INADDR_ANY);
    if (s != INVALID_SOCKET && bind(s, (struct sockaddr *)&a, sizeof a) == 0 && listen(s, 32) == 0) {
        tcp_s = s; HANDLE t = (HANDLE)_beginthreadex(NULL, 0, lan_accept, (void *)(UINT_PTR)s, 0, NULL); if (t) CloseHandle(t);
    } else { if (s != INVALID_SOCKET) closesocket(s); pd_log("aula: porta %d non disponibile", AULA_TCP); }
    SOCKET u = socket(AF_INET, SOCK_DGRAM, IPPROTO_UDP);
    BOOL on = TRUE; if (u != INVALID_SOCKET) setsockopt(u, SOL_SOCKET, SO_REUSEADDR, (const char *)&on, sizeof on);
    a.sin_port = htons(AULA_UDP);
    if (u != INVALID_SOCKET && bind(u, (struct sockaddr *)&a, sizeof a) == 0) {
        DWORD t1 = 1000; setsockopt(u, SOL_SOCKET, SO_RCVTIMEO, (const char *)&t1, sizeof t1);
        udp_s = u; HANDLE t = (HANDLE)_beginthreadex(NULL, 0, udp_loop, (void *)(UINT_PTR)u, 0, NULL); if (t) CloseHandle(t);
    } else { if (u != INVALID_SOCKET) closesocket(u); pd_log("aula: scoperta UDP non disponibile"); }
    pd_log("aula: PC del facilitatore attivo");
}
static void ferma_facilitatore(void) {
    if (!fac_attivo) return;
    InterlockedExchange(&fac_attivo, 0);
    if (tcp_s != INVALID_SOCKET) { closesocket(tcp_s); tcp_s = INVALID_SOCKET; }
    if (udp_s != INVALID_SOCKET) { closesocket(udp_s); udp_s = INVALID_SOCKET; }
}

/* ------------------------------------------------------------------ ricerca (broadcast) */
static int cerca(buf_t *b, int ms, char *primo_ip, size_t pin, int *primo_porta) {
    int trovati = 0;
    if (primo_ip) primo_ip[0] = 0;
    buf_adds(b, "[");
    SOCKET s = socket(AF_INET, SOCK_DGRAM, IPPROTO_UDP);
    if (s == INVALID_SOCKET) { buf_adds(b, "]"); return 0; }
    BOOL on = TRUE; setsockopt(s, SOL_SOCKET, SO_BROADCAST, (const char *)&on, sizeof on);
    DWORD t1 = 300; setsockopt(s, SOL_SOCKET, SO_RCVTIMEO, (const char *)&t1, sizeof t1);
    char ips[8][20]; int n = indirizzi(ips, 8);
    char dest[10][20]; int nd = 0; snprintf(dest[nd++], 20, "255.255.255.255");
    for (int i = 0; i < n && nd < 10; i++) { char t[20]; snprintf(t, sizeof t, "%s", ips[i]); char *dot = strrchr(t, '.'); if (dot) { strcpy(dot + 1, "255"); snprintf(dest[nd++], 20, "%s", t); } }
    for (int i = 0; i < nd; i++) {
        struct sockaddr_in d; memset(&d, 0, sizeof d); d.sin_family = AF_INET; d.sin_port = htons(AULA_UDP); d.sin_addr.s_addr = inet_addr(dest[i]);
        sendto(s, "PD-AULA?", 8, 0, (struct sockaddr *)&d, sizeof d);
    }
    char visti[16][20]; int nv = 0;
    unsigned long long fine = now_ms() + (unsigned long long)ms;
    while (now_ms() < fine && nv < 16) {
        char buf[2048]; struct sockaddr_in from; int fl = sizeof from;
        int k = recvfrom(s, buf, sizeof buf - 1, 0, (struct sockaddr *)&from, &fl);
        if (k <= 0) continue;
        buf[k] = 0;
        const char *ip = inet_ntoa(from.sin_addr); int dup = 0;
        for (int i = 0; i < nv; i++) if (!strcmp(visti[i], ip)) dup = 1;
        if (dup || !ip_privato(ntohl(from.sin_addr.s_addr))) continue;
        char e[64]; jv *v = json_parse(buf, (size_t)k, e, sizeof e);
        if (v && !strcmp(jstr(v, "app", ""), "professore-digitale")) {
            snprintf(visti[nv++], 20, "%s", ip);
            if (trovati++) buf_adds(b, ", ");
            buf_adds(b, "{\"app\": \"professore-digitale\", \"ruolo\": \"facilitatore\", \"nome\": "); json_str(b, jstr(v, "nome", ""));
            buf_adds(b, ", \"pc\": "); json_str(b, jstr(v, "pc", "")); buf_adds(b, ", \"versione\": "); json_str(b, jstr(v, "versione", ""));
            buf_addf(b, ", \"porta\": %d, \"codice_richiesto\": %s, \"ip\": ", (int)jnum(v, "porta", AULA_TCP), jbool(v, "codice_richiesto", 0) ? "true" : "false");
            json_str(b, ip); buf_adds(b, "}");
            if (primo_ip && !primo_ip[0]) {
                snprintf(primo_ip, pin, "%s", ip); if (primo_porta) *primo_porta = (int)jnum(v, "porta", AULA_TCP);
                al(); snprintf(srv_nome, sizeof srv_nome, "%.60s", jstr(v, "nome", "")); snprintf(srv_pc, sizeof srv_pc, "%.60s", jstr(v, "pc", "")); snprintf(srv_ver, sizeof srv_ver, "%.20s", jstr(v, "versione", "")); au();
            }
        }
        json_free(v);
    }
    closesocket(s);
    buf_adds(b, "]");
    return trovati;
}

/* ------------------------------------------------------------------ allievo: invio */
static void id_pc(char *out, size_t n) {
    wchar_t *p = path_join(G.data_dir, L"aula-id.txt");
    buf_t f; out[0] = 0;
    if (file_read(p, &f, 256)) { size_t L = f.n < n - 1 ? f.n : n - 1; memcpy(out, f.p, L); out[L] = 0; while (L && (out[L - 1] == '\n' || out[L - 1] == '\r' || out[L - 1] == ' ')) out[--L] = 0; buf_free(&f); }
    if (!out[0]) {
        GUID g; CoCreateGuid(&g);
        snprintf(out, n, "%08lx-%04x-%04x-%02x%02x-%02x%02x%02x%02x%02x%02x", (unsigned long)g.Data1, g.Data2, g.Data3, g.Data4[0], g.Data4[1], g.Data4[2], g.Data4[3], g.Data4[4], g.Data4[5], g.Data4[6], g.Data4[7]);
        mkdirs(G.data_dir); file_write_atomic(p, out, strlen(out));
    }
    free(p);
}
typedef struct { buf_t *b; } sink_ctx;
static int sink_mem(void *c, const char *d, size_t n) { sink_ctx *x = (sink_ctx *)c; if (x->b->n + n > AULA_MAX_CIAO) return 0; return buf_add(x->b, d, n); }

static void invia(void) {
    char host[128] = ""; int porta = AULA_TCP;
    al(); char man[104]; snprintf(man, sizeof man, "%s", c_server); au();
    if (man[0]) {
        const char *h = man; if (!_strnicmp(h, "http://", 7)) h += 7;
        snprintf(host, sizeof host, "%s", h); char *sl = strchr(host, '/'); if (sl) *sl = 0;
        char *col = strchr(host, ':'); if (col) { porta = atoi(col + 1); *col = 0; }
        al(); snprintf(srv_ip, sizeof srv_ip, "%s", host); srv_porta = porta; au();
    } else {
        al(); int fresco = srv_ip[0] && now_ms() - srv_t < 300000; if (fresco) { snprintf(host, sizeof host, "%s", srv_ip); porta = srv_porta; } au();
        if (!host[0]) {
            buf_t tmp; buf_init(&tmp); char ip[64]; int pp = AULA_TCP;
            cerca(&tmp, 1500, ip, sizeof ip, &pp); buf_free(&tmp);
            if (ip[0]) { snprintf(host, sizeof host, "%s", ip); porta = pp; al(); snprintf(srv_ip, sizeof srv_ip, "%s", ip); srv_porta = pp; srv_t = now_ms(); au(); }
        }
    }
    if (!host[0]) { al(); inv_t = now_ms(); inv_ok = 0; snprintf(inv_err, sizeof inv_err, "nessun PC del facilitatore trovato in rete"); au(); return; }
    if (!ip_str_privato(host)) { al(); inv_t = now_ms(); inv_ok = 0; snprintf(inv_err, sizeof inv_err, "l'indirizzo del facilitatore deve essere nella rete locale"); au(); return; }
    static pd_hw hw; static int hw_ok = 0;
    if (!hw_ok) { hw_detect(&hw); hw_ok = 1; }
    char id[64], pc[64]; id_pc(id, sizeof id); nome_pc(pc, sizeof pc);
    buf_t b; buf_init(&b);
    al();
    buf_adds(&b, "{\"id\": "); json_str(&b, id); buf_adds(&b, ", \"codice\": "); json_str(&b, c_codice); buf_adds(&b, ", \"pc\": "); json_str(&b, pc);
    char e[64]; jv *pr = presenza ? json_parse(presenza, strlen(presenza), e, sizeof e) : NULL;
    buf_adds(&b, ", \"utente\": "); json_str(&b, c_allievo[0] ? c_allievo : jstr(pr, "utente", ""));
    buf_adds(&b, ", \"versione\": "); json_str(&b, G.version);
    buf_adds(&b, ", \"sistema\": {\"os\": "); json_str(&b, hw.os_name); buf_addf(&b, ", \"ram_mb\": %lld, \"cpus\": %d, \"arch\": ", hw.ram_mb, hw.cpus);
    json_str(&b, hw.arm64 ? "ARM64" : hw.is64os ? "64 bit" : "32 bit"); buf_adds(&b, "}");
    const char *chiavi[3] = { "componenti", "attivita", "progressi" };
    for (int i = 0; i < 3; i++) { jv *x = jget(pr, chiavi[i]); buf_addf(&b, ", \"%s\": ", chiavi[i]); if (x && x->t == J_OBJ) buf_add(&b, x->raw, x->rawlen); else buf_adds(&b, "{}"); }
    mano_scadenza();
    buf_addf(&b, ", \"mano\": {\"alzata\": %s, \"da\": %lld, \"messaggio\": ", mano_alzata ? "true" : "false", mano_da); json_str(&b, mano_alzata ? mano_msg : ""); buf_adds(&b, "}");
    buf_adds(&b, "}");
    json_free(pr);
    au();
    char url[200]; snprintf(url, sizeof url, "http://%s:%d/aula/ciao", host, porta);
    buf_t risp; buf_init(&risp); sink_ctx sc = { &risp }; http_result hr;
    int ok = http_request("POST", url, "application/json", b.p, b.n, 6, sink_mem, &sc, &hr);
    al();
    inv_t = now_ms();
    if (ok && hr.status == 200) {
        inv_ok = 1; inv_err[0] = 0;
        jv *r = json_parse(risp.p ? risp.p : "{}", risp.n, e, sizeof e), *a = jget(r, "annuncio");
        if (jstr(r, "nome", NULL)) snprintf(srv_nome, sizeof srv_nome, "%.60s", jstr(r, "nome", ""));
        if (a) { ann_ric_id = (long long)jnum(a, "id", 0); snprintf(ann_ric, sizeof ann_ric, "%.500s", jstr(a, "testo", "")); }
        jv *m = jget(r, "mano"); const char *st = jstr(m, "stato", "");
        if (mano_da && num_grande(jget(m, "da")) == mano_da) {          /* risposta del facilitatore a QUESTA richiesta */
            if (!strcmp(st, "risolto")) { mano_alzata = 0; mano_msg[0] = 0; snprintf(mano_risp, sizeof mano_risp, "risolto"); }
            else if (!strcmp(st, "arrivo") && mano_alzata) snprintf(mano_risp, sizeof mano_risp, "arrivo");
        }
        json_free(r);
    } else {
        inv_ok = 0; snprintf(inv_err, sizeof inv_err, "%s", hr.status == 403 ? "codice dell'aula non corretto" : "il PC del facilitatore non risponde");
        if (!c_server[0]) srv_ip[0] = 0;
    }
    au();
    buf_free(&b); buf_free(&risp);
}

/* ------------------------------------------------------------------ ciclo */
static void applica(void) {
    leggi_impostazioni();
    al(); int fac = !strcmp(ruolo, "facilitatore"), all = !strcmp(ruolo, "allievo"); au();
    if (fac) avvia_facilitatore(); else ferma_facilitatore();
    if (!all) { al(); if (!c_server[0]) srv_ip[0] = 0; au(); }
}
static unsigned __stdcall ciclo(void *arg) {
    (void)arg;
    HRESULT ci = CoInitializeEx(NULL, COINIT_MULTITHREADED);
    unsigned long long ultimo = 0;
    for (;;) {
        applica();
        al(); int all = !strcmp(ruolo, "allievo"); mano_scadenza(); int su = mano_alzata; au();
        unsigned long long iv = (su ? AULA_INTERVALLO_MANO : AULA_INTERVALLO) * 1000ULL;
        if (all && (InterlockedExchange(&forza_invio, 0) || now_ms() - ultimo >= iv)) { invia(); ultimo = now_ms(); }
        if (sveglia) WaitForSingleObject(sveglia, 5000); else Sleep(5000);
    }
    if (SUCCEEDED(ci)) CoUninitialize();
    return 0;
}
void aula_init(void) {
    sveglia = CreateEventW(NULL, FALSE, FALSE, NULL);
    carica_clienti();
    HANDLE t = (HANDLE)_beginthreadex(NULL, 0, ciclo, NULL, 0, NULL);
    if (t) CloseHandle(t);
}
int aula_facilitatore(void) { al(); int f = !strcmp(ruolo, "facilitatore"); au(); return f; }

/* ------------------------------------------------------------------ API locale */
static void stato_json(buf_t *b) {
    char pc[64]; nome_pc(pc, sizeof pc);
    double ora = now_s();
    al();
    buf_adds(b, "{\"ok\": true, \"ruolo\": "); json_str(b, ruolo); buf_adds(b, ", \"nome\": "); json_str(b, c_nome);
    buf_adds(b, ", \"codice\": "); json_str(b, c_codice); buf_adds(b, ", \"pc\": "); json_str(b, pc);
    au();
    buf_adds(b, ", \"ips\": "); ips_json(b);
    al();
    buf_addf(b, ", \"porta\": %d, \"versione\": ", AULA_TCP); json_str(b, G.version); buf_adds(b, ", \"sistema_os\": \"Windows\"");
    if (!strcmp(ruolo, "facilitatore")) {
        buf_addf(b, ", \"in_ascolto\": %s, \"scoperta\": %s, \"clienti\": [", tcp_s != INVALID_SOCKET ? "true" : "false", udp_s != INVALID_SOCKET ? "true" : "false");
        /* ordinati per nome dell'allievo */
        int ord[AULA_MAX_CLIENTI]; for (int i = 0; i < nclienti; i++) ord[i] = i;
        for (int i = 0; i < nclienti; i++) for (int j = i + 1; j < nclienti; j++) {
            char e[16]; jv *x = json_parse(clienti[ord[i]].json, strlen(clienti[ord[i]].json), e, sizeof e), *y = json_parse(clienti[ord[j]].json, strlen(clienti[ord[j]].json), e, sizeof e);
            if (_stricmp(jstr(x, "utente", ""), jstr(y, "utente", "")) > 0) { int t = ord[i]; ord[i] = ord[j]; ord[j] = t; }
            json_free(x); json_free(y);
        }
        for (int i = 0; i < nclienti; i++) {
            cliente_t *c = &clienti[ord[i]];
            int fa = (int)(ora - c->visto); if (fa < 0) fa = 0;
            if (i) buf_adds(b, ", ");
            size_t L = strlen(c->json);
            buf_add(b, c->json, L - 1);   /* senza la graffa finale */
            buf_addf(b, ", \"visto\": %.3f, \"fa_s\": %d, \"online\": %s, \"mano\": ", c->visto, fa, fa < AULA_INTERVALLO * 3 + 10 ? "true" : "false");
            mano_cliente_json(b, c, ora); buf_adds(b, "}");
        }
        buf_addf(b, "], \"annuncio\": {\"id\": %lld, \"testo\": ", ann_id); json_str(b, ann_testo); buf_adds(b, "}");
    } else if (!strcmp(ruolo, "allievo")) {
        buf_adds(b, ", \"server\": ");
        if (srv_ip[0]) {
            buf_adds(b, "{\"ip\": "); json_str(b, srv_ip); buf_adds(b, ", \"nome\": "); json_str(b, srv_nome); buf_adds(b, ", \"pc\": "); json_str(b, srv_pc);
            buf_addf(b, ", \"porta\": %d, \"versione\": ", srv_porta); json_str(b, srv_ver); buf_addf(b, ", \"manuale\": %s}", c_server[0] ? "true" : "false");
        } else buf_adds(b, "null");
        buf_addf(b, ", \"invio\": {\"ok\": %s, \"errore\": ", inv_ok ? "true" : "false"); json_str(b, inv_err);
        if (inv_t) buf_addf(b, ", \"fa_s\": %d}", (int)((now_ms() - inv_t) / 1000)); else buf_adds(b, ", \"fa_s\": null}");
        buf_addf(b, ", \"annuncio\": {\"id\": %lld, \"testo\": ", ann_ric_id); json_str(b, ann_ric);
        buf_adds(b, "}, \"allievo\": "); json_str(b, c_allievo);
        buf_adds(b, ", \"mano\": "); mano_allievo_json(b);
    }
    buf_adds(b, "}");
    au();
}

void aula_api(req_t *r, const char *azione, jv *req) {
    buf_t b; buf_init(&b);
    if (!azione) { stato_json(&b); send_json(r, 200, &b); }
    else if (!strcmp(azione, "presenza")) {
        al(); free(presenza); presenza = (char *)malloc(req->rawlen + 1); memcpy(presenza, req->raw, req->rawlen); presenza[req->rawlen] = 0; au();
        buf_t s; buf_init(&s); stato_json(&s);
        char e[64]; jv *st = json_parse(s.p, s.n, e, sizeof e);
        buf_adds(&b, "{\"ok\": true, \"ruolo\": "); json_str(&b, jstr(st, "ruolo", ""));
        const char *k[3] = { "annuncio", "invio", "server" };
        for (int i = 0; i < 3; i++) { jv *x = jget(st, k[i]); buf_addf(&b, ", \"%s\": ", k[i]); if (x) buf_add(&b, x->raw, x->rawlen); else buf_adds(&b, "null"); }
        buf_adds(&b, "}");
        json_free(st); buf_free(&s);
        send_json(r, 200, &b);
    } else if (!strcmp(azione, "applica")) { applica(); stato_json(&b); send_json(r, 200, &b); }
    else if (!strcmp(azione, "cerca")) {
        char pc[64]; nome_pc(pc, sizeof pc);
        buf_adds(&b, "{\"ok\": true, \"trovati\": "); cerca(&b, 2000, NULL, 0, NULL);
        /* server degli aggiornamenti nella rete locale (se configurato) */
        wchar_t *p = path_join(G.data_dir, L"settings.json"); buf_t f; jv *s = NULL; char e[64];
        if (file_read(p, &f, PD_MAX_JSON)) { s = json_parse(f.p, f.n, e, sizeof e); buf_free(&f); }
        free(p);
        const char *u = jstr(s, "updateUrl", "");
        buf_adds(&b, ", \"aggiornamenti\": ");
        if (u && !_strnicmp(u, "http://", 7) && url_is_local_host(u)) {
            buf_t x; http_result hr; int ok = http_get_mem(u, 1024 * 1024, 3, &x, &hr) && hr.status == 200; buf_free(&x);
            buf_adds(&b, "{\"url\": "); json_str(&b, u); buf_addf(&b, ", \"raggiungibile\": %s}", ok ? "true" : "false");
        } else buf_adds(&b, "null");
        json_free(s);
        buf_adds(&b, ", \"ips\": "); ips_json(&b); buf_adds(&b, ", \"pc\": "); json_str(&b, pc); buf_adds(&b, "}");
        send_json(r, 200, &b);
    } else if (!strcmp(azione, "annuncio")) {
        al(); ann_id = (long long)now_s(); snprintf(ann_testo, sizeof ann_testo, "%.500s", jstr(req, "testo", "")); salva_clienti();
        buf_addf(&b, "{\"ok\": true, \"annuncio\": {\"id\": %lld, \"testo\": ", ann_id); json_str(&b, ann_testo); buf_adds(&b, "}}"); au();
        send_json(r, 200, &b);
    } else if (!strcmp(azione, "rimuovi")) {
        const char *id = jstr(req, "id", "");
        al();
        for (int i = 0; i < nclienti;) {
            if (!strcmp(id, "*") || !strcmp(clienti[i].id, id)) { free(clienti[i].json); clienti[i] = clienti[--nclienti]; }
            else i++;
        }
        salva_clienti(); au();
        send_ok(r);
    } else if (!strcmp(azione, "mano")) {                  /* PC allievo: alza/abbassa la mano */
        jv *a = jget(req, "alzata"); char msg[MANO_BUF]; const char *err = NULL;
        al(); int all = !strcmp(ruolo, "allievo"); au();
        if (!req || req->t != J_OBJ) send_error(r, 400, "richiesta non valida");
        else if (!all) send_error(r, 409, "questo PC non è collegato all'aula come allievo");
        else if (!a || (a->t != J_TRUE && a->t != J_FALSE)) send_error(r, 400, "«alzata» deve essere true o false");
        else if ((err = controlla_messaggio(jget(req, "messaggio"), msg, sizeof msg)) != NULL) send_error(r, 400, err);
        else {
            al();
            mano_scadenza();
            if (a->t == J_TRUE && !mano_alzata) {
                long long ora = (long long)now_s();
                mano_alzata = 1; mano_da = ora > mano_da + 1 ? ora : mano_da + 1; mano_risp[0] = 0;
                snprintf(mano_msg, sizeof mano_msg, "%s", msg);
            } else if (a->t == J_TRUE) snprintf(mano_msg, sizeof mano_msg, "%s", msg);
            else { mano_alzata = 0; mano_msg[0] = 0; mano_risp[0] = 0; }
            buf_adds(&b, "{\"ok\": true, \"mano\": "); mano_allievo_json(&b); buf_adds(&b, "}");
            au();
            InterlockedExchange(&forza_invio, 1); if (sveglia) SetEvent(sveglia);   /* la presenza parte subito */
            send_json(r, 200, &b);
        }
    } else if (!strcmp(azione, "rispondi")) {              /* PC facilitatore: «Arrivo!» o «Risolto» */
        jv *idv = jget(req, "id"), *stv = jget(req, "stato");
        al(); int fac = !strcmp(ruolo, "facilitatore"); au();
        int st_ok = stv && stv->t == J_STR && stv->slen == strlen(stv->str) && (!strcmp(stv->str, "arrivo") || !strcmp(stv->str, "risolto"));
        if (!req || req->t != J_OBJ) send_error(r, 400, "richiesta non valida");
        else if (!fac) send_error(r, 409, "questo PC non è il facilitatore");
        else if (!id_valido(idv)) send_error(r, 400, "id non valido");
        else if (!st_ok) send_error(r, 400, "stato non valido (arrivo o risolto)");
        else {
            double ora = now_s(); int code = 200; const char *e = NULL;
            al();
            cliente_t *c = NULL;
            for (int i = 0; i < nclienti; i++) if (!strcmp(clienti[i].id, idv->str)) c = &clienti[i];
            if (!c) { code = 404; e = "allievo non trovato"; }
            else if (!mano_su(c, ora, NULL)) { code = 409; e = "questo allievo non ha la mano alzata"; }
            else {
                snprintf(c->m_stato, sizeof c->m_stato, "%s", stv->str);
                if (!strcmp(stv->str, "risolto")) c->m_alzata = 0;
                salva_clienti();
                buf_adds(&b, "{\"ok\": true, \"id\": "); json_str(&b, c->id); buf_adds(&b, ", \"mano\": "); mano_cliente_json(&b, c, ora); buf_adds(&b, "}");
            }
            au();
            if (e) send_error(r, code, e); else send_json(r, 200, &b);
        }
    } else send_error(r, 404, "API sconosciuta");
    buf_free(&b);
}

/* ------------------------------------------------------------------ per i tablet dell'aula (pd_tablet.c) */
int aula_indirizzi(char ips[][20], int max) { return indirizzi(ips, max); }
int aula_codice_facilitatore(char *codice, size_t n) {
    al(); int fac = !strcmp(ruolo, "facilitatore"); snprintf(codice, n, "%s", c_codice); au();
    return fac;
}
int aula_ricevi(const char *body, size_t n, const char *ip, buf_t *out) { return ricevi(body, n, ip, out); }
