/* Professore Digitale per Windows - NONNI TEACH (dalla 3.6): interviste registrate, podcast e sito da pubblicare.
 * Stesse API e risposte di src/server/pd_nonni.py (Linux):
 *   GET  /api/nonni, /api/nonni/<id>, /api/nonni/<id>/file/<nome>, /api/nonni/sito.zip
 *   POST /api/nonni/salva, /api/nonni/<id>/audio/<n> (corpo audio), /api/nonni/<id>/monta|elimina,
 *        /api/nonni/sito, /api/nonni/importa (dal Consulente Digitale di questo PC), /api/nonni/importa-backup (.cdbackup)
 * Ogni intervista sta in %APPDATA%\ProfessoreDigitale\nonni-teach\<id>\ (episodio.json, rNN.*, dNN.wav, podcast.mp3).
 * Il podcast si monta con FFmpeg, se c'e' (winget install Gyan.FFmpeg, oppure ffmpeg.exe in %LOCALAPPDATA%\ProfessoreDigitale\ffmpeg).
 * Nulla esce dal computer: il sito lo carica l'utente nel repository GitHub «nonni-teach».
 * Ideato e sviluppato da Danilo D'Auria - Licenza MIT */
#include "pd.h"
#include <math.h>
#include <time.h>
#include <zlib.h>

#define NT_MAX_AUDIO   (80u * 1024u * 1024u)
#define NT_MAX_BACKUP  (400u * 1024u * 1024u)
#define NT_MAX_Q       60
static const char *SITO_PREDEFINITO = "https://danilodauria.github.io/nonni-teach/";

/* ------------------------------------------------------------------ piccole utilita' */
static int re_nt_id(const char *s) {                 /* ^[a-z0-9][a-z0-9-]{2,70}$ */
    size_t n = strlen(s);
    if (n < 3 || n > 71) return 0;
    for (size_t i = 0; i < n; i++) {
        char c = s[i];
        if (!((c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || (i && c == '-'))) return 0;
    }
    return 1;
}
static int est_ok(const char *e) {
    static const char *E[] = { "webm", "ogg", "oga", "mp4", "m4a", "wav", "mp3", NULL };
    for (int i = 0; E[i]; i++) if (!strcmp(e, E[i])) return 1;
    return 0;
}
/* ^(r|d)\d{2}\.(webm|ogg|oga|mp4|m4a|wav|mp3)$|^(podcast\.mp3|intro\.wav)$  (+ episodio.json e capitoli.txt se tutti) */
static int re_file(const char *s, int tutti) {
    if (!strcmp(s, "podcast.mp3") || !strcmp(s, "intro.wav")) return 1;
    if (tutti && (!strcmp(s, "episodio.json") || !strcmp(s, "capitoli.txt"))) return 1;
    if ((s[0] == 'r' || s[0] == 'd') && isdigit((unsigned char)s[1]) && isdigit((unsigned char)s[2]) && s[3] == '.') return est_ok(s + 4);
    return 0;
}
static const char *tipo_audio(const char *nome) {
    const char *e = strrchr(nome, '.'); e = e ? e + 1 : "";
    if (!strcmp(e, "webm")) return "audio/webm";
    if (!strcmp(e, "ogg") || !strcmp(e, "oga")) return "audio/ogg";
    if (!strcmp(e, "mp4") || !strcmp(e, "m4a")) return "audio/mp4";
    if (!strcmp(e, "wav")) return "audio/wav";
    if (!strcmp(e, "mp3")) return "audio/mpeg";
    return "application/octet-stream";
}
/* come " ".join(str(x).split())[:n]: spazi compattati, al massimo n caratteri (UTF-8) */
static char *testo(const char *s, size_t n) {
    if (!s) s = "";
    size_t L = strlen(s), o = 0, car = 0;
    char *out = (char *)malloc(L + 1);
    int spazio = 0;
    for (size_t i = 0; i < L; i++) {
        unsigned char c = (unsigned char)s[i];
        if (c == ' ' || c == '\t' || c == '\n' || c == '\r' || c == '\f' || c == '\v') { spazio = 1; continue; }
        if ((c & 0xC0) != 0x80) {                     /* inizio di un carattere */
            if (spazio && o) { if (car >= n) break; out[o++] = ' '; car++; }
            if (car >= n) break;
            car++;
        }
        spazio = 0;
        out[o++] = (char)c;
    }
    out[o] = 0;
    return out;
}
static char *jtesto(const jv *o, const char *k, size_t n) {
    jv *v = jget(o, k);
    if (v && v->t == J_NUM) { char t[64]; snprintf(t, sizeof t, "%.15g", v->num); return testo(t, n); }
    return testo(v && v->t == J_STR ? v->str : "", n);
}
static int jvero(const jv *o, const char *k) {       /* bool(x) di Python */
    jv *v = jget(o, k);
    if (!v) return 0;
    if (v->t == J_TRUE) return 1;
    if (v->t == J_NUM) return v->num != 0;
    if (v->t == J_STR) return v->slen > 0;
    if (v->t == J_ARR || v->t == J_OBJ) return v->n > 0;
    return 0;
}
static void num(buf_t *b, double x) {
    char t[64]; snprintf(t, sizeof t, "%.3f", x);
    char *p = t + strlen(t) - 1;
    while (*p == '0') *p-- = 0;
    if (*p == '.') *p = 0;
    buf_adds(b, t);
}
static void html(buf_t *b, const char *s) {           /* html.escape(s, quote=True) */
    for (; s && *s; s++) {
        switch (*s) {
            case '&': buf_adds(b, "&amp;"); break;
            case '<': buf_adds(b, "&lt;"); break;
            case '>': buf_adds(b, "&gt;"); break;
            case '"': buf_adds(b, "&quot;"); break;
            case '\'': buf_adds(b, "&#x27;"); break;
            default: buf_add(b, s, 1);
        }
    }
}
static wchar_t *nt_dir(void) { wchar_t *d = path_join(G.data_dir, L"nonni-teach"); mkdirs(d); return d; }
static wchar_t *ep_dir(const char *id) { wchar_t *d = nt_dir(), *w = u8to16(id), *p = path_join(d, w); free(d); free(w); return p; }
static wchar_t *ep_file(const char *id, const char *nome) { wchar_t *d = ep_dir(id), *w = u8to16(nome), *p = path_join(d, w); free(d); free(w); return p; }
/* il JSON letto da un file: jv->raw punta dentro al testo, che deve restare vivo finche' si usa il valore */
typedef struct { jv *v; buf_t b; int ha_b; } jdoc;
static jv *leggi_json_w(jdoc *d, const wchar_t *p, size_t lim) {
    char e[64];
    d->v = NULL; d->ha_b = 0;
    if (file_read(p, &d->b, lim)) { d->ha_b = 1; d->v = json_parse(d->b.p, d->b.n, e, sizeof e); }
    return d->v;
}
static void jdoc_free(jdoc *d) { json_free(d->v); d->v = NULL; if (d->ha_b) buf_free(&d->b); d->ha_b = 0; }

/* ------------------------------------------------------------------ episodio in memoria */
typedef struct { char *testo, *tema, *nota, *file; double durata; } ntq;
typedef struct {
    char id[80];
    char *titolo, *intervistato, *luogo, *contesto, *intervistatore, *descrizione, *data, *podcast, *origine, *capitoli;
    int cr, cp, ha_durata; double creato, durata;
    ntq q[NT_MAX_Q]; int nq;
} ntep;
static void ep_free(ntep *e) {
    free(e->titolo); free(e->intervistato); free(e->luogo); free(e->contesto); free(e->intervistatore); free(e->descrizione);
    free(e->data); free(e->podcast); free(e->origine); free(e->capitoli);
    for (int i = 0; i < e->nq; i++) { free(e->q[i].testo); free(e->q[i].tema); free(e->q[i].nota); free(e->q[i].file); }
    memset(e, 0, sizeof *e);
}
static char *sdup(const jv *o, const char *k) { const char *s = jstr(o, k, ""); return _strdup(s ? s : ""); }
static void ep_da_json(const jv *v, ntep *e) {
    memset(e, 0, sizeof *e);
    snprintf(e->id, sizeof e->id, "%s", jstr(v, "id", ""));
    e->titolo = sdup(v, "titolo"); e->intervistato = sdup(v, "intervistato"); e->luogo = sdup(v, "luogo"); e->contesto = sdup(v, "contesto");
    e->intervistatore = sdup(v, "intervistatore"); e->descrizione = sdup(v, "descrizione"); e->data = sdup(v, "data"); e->podcast = sdup(v, "podcast");
    e->origine = sdup(v, "origine");
    e->cr = jvero(v, "consenso_registrare"); e->cp = jvero(v, "consenso_pubblicare");
    e->creato = jnum(v, "creato", 0); e->ha_durata = jget(v, "durata") != NULL; e->durata = jnum(v, "durata", 0);
    jv *c = jget(v, "capitoli");
    if (c && c->t == J_ARR) { e->capitoli = (char *)malloc(c->rawlen + 1); memcpy(e->capitoli, c->raw, c->rawlen); e->capitoli[c->rawlen] = 0; }
    else e->capitoli = _strdup("[]");
    jv *d = jget(v, "domande");
    for (size_t i = 0; d && d->t == J_ARR && i < d->n && e->nq < NT_MAX_Q; i++) {
        jv *q = d->items[i];
        if (!q || q->t != J_OBJ) continue;
        ntq *x = &e->q[e->nq++];
        x->testo = sdup(q, "testo"); x->tema = sdup(q, "tema"); x->nota = sdup(q, "nota"); x->file = sdup(q, "file"); x->durata = jnum(q, "durata", 0);
    }
}
static void q_json(buf_t *b, const ntq *q, int n) {
    buf_addf(b, "{\"n\": %d, \"testo\": ", n); json_str(b, q->testo); buf_adds(b, ", \"tema\": "); json_str(b, q->tema);
    buf_adds(b, ", \"nota\": "); json_str(b, q->nota); buf_adds(b, ", \"file\": "); json_str(b, q->file); buf_adds(b, ", \"durata\": "); num(b, q->durata);
    buf_adds(b, "}");
}
static void ep_json(buf_t *b, const ntep *e, int ok) {
    buf_adds(b, "{"); if (ok) buf_adds(b, "\"ok\": true, ");
    buf_adds(b, "\"id\": "); json_str(b, e->id);
    buf_adds(b, ", \"titolo\": "); json_str(b, e->titolo); buf_adds(b, ", \"intervistato\": "); json_str(b, e->intervistato);
    buf_adds(b, ", \"luogo\": "); json_str(b, e->luogo); buf_adds(b, ", \"contesto\": "); json_str(b, e->contesto);
    buf_adds(b, ", \"intervistatore\": "); json_str(b, e->intervistatore); buf_adds(b, ", \"descrizione\": "); json_str(b, e->descrizione);
    buf_addf(b, ", \"consenso_registrare\": %s, \"consenso_pubblicare\": %s, \"licenza\": \"CC BY-NC-SA 4.0\", \"creato\": ", e->cr ? "true" : "false", e->cp ? "true" : "false");
    num(b, e->creato);
    buf_adds(b, ", \"data\": "); json_str(b, e->data); buf_adds(b, ", \"podcast\": "); json_str(b, e->podcast);
    buf_adds(b, ", \"capitoli\": "); buf_adds(b, e->capitoli ? e->capitoli : "[]");
    buf_adds(b, ", \"domande\": [");
    for (int i = 0; i < e->nq; i++) { if (i) buf_adds(b, ", "); q_json(b, &e->q[i], i + 1); }
    buf_adds(b, "]");
    if (e->ha_durata) { buf_adds(b, ", \"durata\": "); num(b, e->durata); }
    if (e->origine && *e->origine) { buf_adds(b, ", \"origine\": "); json_str(b, e->origine); }
    buf_adds(b, "}");
}
static int ep_carica(const char *id, ntep *e) {
    wchar_t *p = ep_file(id, "episodio.json");
    jdoc d; jv *v = leggi_json_w(&d, p, PD_MAX_JSON);
    free(p);
    if (!v || v->t != J_OBJ) { jdoc_free(&d); return 0; }
    ep_da_json(v, e);
    jdoc_free(&d);
    return 1;
}
static int ep_salva(const ntep *e) {
    buf_t b; buf_init(&b); ep_json(&b, e, 0);
    wchar_t *p = ep_file(e->id, "episodio.json");
    int ok = file_write_atomic(p, b.p, b.n);
    free(p); buf_free(&b);
    return ok;
}

/* ------------------------------------------------------------------ FFmpeg */
static int ffmpeg(wchar_t *out, size_t n) {
    wchar_t tmp[MAX_PATH], *part;
    if (SearchPathW(NULL, L"ffmpeg.exe", NULL, MAX_PATH, tmp, &part)) { wcsncpy(out, tmp, n - 1); out[n - 1] = 0; return 1; }
    wchar_t la[MAX_PATH] = L"";
    GetEnvironmentVariableW(L"LOCALAPPDATA", la, MAX_PATH);
    const wchar_t *cand[4]; wchar_t c1[MAX_PATH], c2[MAX_PATH], c3[MAX_PATH];
    _snwprintf(c1, MAX_PATH, L"%ls\\ffmpeg\\ffmpeg.exe", G.local_dir); c1[MAX_PATH - 1] = 0;
    _snwprintf(c2, MAX_PATH, L"%ls\\Microsoft\\WinGet\\Links\\ffmpeg.exe", la); c2[MAX_PATH - 1] = 0;
    _snwprintf(c3, MAX_PATH, L"%ls\\ffmpeg\\ffmpeg.exe", G.install_dir); c3[MAX_PATH - 1] = 0;
    cand[0] = c1; cand[1] = c2; cand[2] = c3; cand[3] = NULL;
    for (int i = 0; cand[i]; i++) if (file_exists(cand[i])) { wcsncpy(out, cand[i], n - 1); out[n - 1] = 0; return 1; }
    /* winget senza collegamenti: %LOCALAPPDATA%\Microsoft\WinGet\Packages\Gyan.FFmpeg*\*\bin\ffmpeg.exe */
    if (la[0]) {
        wchar_t pat[MAX_PATH]; _snwprintf(pat, MAX_PATH, L"%ls\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg*", la); pat[MAX_PATH - 1] = 0;
        WIN32_FIND_DATAW fd; HANDLE h = FindFirstFileW(pat, &fd);
        if (h != INVALID_HANDLE_VALUE) {
            do {
                if (!(fd.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY)) continue;
                wchar_t sub[MAX_PATH]; _snwprintf(sub, MAX_PATH, L"%ls\\Microsoft\\WinGet\\Packages\\%ls\\*", la, fd.cFileName); sub[MAX_PATH - 1] = 0;
                WIN32_FIND_DATAW f2; HANDLE h2 = FindFirstFileW(sub, &f2);
                if (h2 == INVALID_HANDLE_VALUE) continue;
                do {
                    if (!(f2.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY) || f2.cFileName[0] == L'.') continue;
                    wchar_t ex[MAX_PATH]; _snwprintf(ex, MAX_PATH, L"%ls\\Microsoft\\WinGet\\Packages\\%ls\\%ls\\bin\\ffmpeg.exe", la, fd.cFileName, f2.cFileName); ex[MAX_PATH - 1] = 0;
                    if (file_exists(ex)) { wcsncpy(out, ex, n - 1); out[n - 1] = 0; FindClose(h2); FindClose(h); return 1; }
                } while (FindNextFileW(h2, &f2));
                FindClose(h2);
            } while (FindNextFileW(h, &fd));
            FindClose(h);
        }
    }
    return 0;
}
static void cmd_add(buf_t *cmd, const wchar_t *arg) {   /* buf di wchar_t */
    wchar_t *q = quote_arg(arg);
    if (cmd->n) buf_add(cmd, L" ", sizeof(wchar_t));
    buf_add(cmd, q, wcslen(q) * sizeof(wchar_t));
    free(q);
}
static void cmd_add8(buf_t *cmd, const char *arg) { wchar_t *w = u8to16(arg); cmd_add(cmd, w); free(w); }
static wchar_t *cmd_fine(buf_t *cmd) { buf_add(cmd, L"\0", sizeof(wchar_t)); return (wchar_t *)cmd->p; }
static double durata(const wchar_t *ff, const wchar_t *path) {
    buf_t cmd; buf_init(&cmd);
    cmd_add(&cmd, ff); cmd_add(&cmd, L"-hide_banner"); cmd_add(&cmd, L"-i"); cmd_add(&cmd, path); cmd_add(&cmd, L"-f"); cmd_add(&cmd, L"null"); cmd_add(&cmd, L"-");
    buf_t out; DWORD code = 0;
    double d = 0;
    buf_init(&out);
    if (run_process(cmd_fine(&cmd), NULL, NULL, 0, &out, 180000, &code, 1)) {
        buf_add(&out, "", 1);
        const char *p = out.p, *last = NULL;
        while ((p = strstr(p, "time=")) != NULL) { if (isdigit((unsigned char)p[5])) last = p + 5; p += 5; }
        int h, m; double s;
        if (last && sscanf(last, "%d:%d:%lf", &h, &m, &s) == 3) d = h * 3600 + m * 60 + s;
        else if ((p = strstr(out.p, "Duration: ")) && sscanf(p + 10, "%d:%d:%lf", &h, &m, &s) == 3) d = h * 3600 + m * 60 + s;
        buf_free(&out);
    }
    buf_free(&cmd);
    return d;
}

/* ------------------------------------------------------------------ voce di Neura (femminile) */
static int voce_neura(char *id, size_t n) {
    buf_t b; buf_init(&b); tts_voices_json(&b);
    char e[64]; jv *v = json_parse(b.p, b.n, e, sizeof e);
    id[0] = 0;
    for (int giro = 0; giro < 2 && !id[0]; giro++)
        for (size_t i = 0; v && v->t == J_ARR && i < v->n; i++) {
            jv *x = v->items[i];
            if (!strcmp(jstr(x, "genere", ""), "f") && (giro || jbool(x, "naturale", 0))) { snprintf(id, n, "%s", jstr(x, "id", "")); break; }
        }
    json_free(v); buf_free(&b);
    return id[0] != 0;
}

/* ------------------------------------------------------------------ risposte: un file intero, a pezzi */
static void manda_file(req_t *r, const wchar_t *p, const char *ctype, const char *extra) {
    HANDLE h = CreateFileW(p, GENERIC_READ, FILE_SHARE_READ, NULL, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, NULL);
    if (h == INVALID_HANDLE_VALUE) { send_error(r, 404, "file non trovato"); return; }
    LARGE_INTEGER sz; GetFileSizeEx(h, &sz);
    r->sent = 1;
    buf_t hd; buf_init(&hd);
    buf_addf(&hd, "HTTP/1.1 200 OK\r\nServer: ProfessoreDigitale/%s\r\nContent-Type: %s\r\nContent-Length: %I64d\r\n"
                  "X-Content-Type-Options: nosniff\r\nX-Frame-Options: DENY\r\nReferrer-Policy: no-referrer\r\n"
                  "Cache-Control: no-store\r\nConnection: close\r\n%s\r\n", G.version, ctype, sz.QuadPart, extra ? extra : "");
    send_raw(r, hd.p, hd.n); buf_free(&hd);
    if (!r->head_only) {
        char *blk = (char *)malloc(1 << 16); DWORD got;
        while (blk && ReadFile(h, blk, 1 << 16, &got, NULL) && got) send_raw(r, blk, got);
        free(blk);
    }
    CloseHandle(h);
}

/* ------------------------------------------------------------------ elenco */
typedef struct { double creato; char *json; } voce_el;
static int cmp_el(const void *a, const void *b) {
    double x = ((const voce_el *)a)->creato, y = ((const voce_el *)b)->creato;
    return x < y ? 1 : x > y ? -1 : 0;
}
/* id delle cartelle con episodio.json (ordinate); restituisce quante */
static int cartelle(const wchar_t *base, char ***out) {
    wchar_t *pat = path_join(base, L"*");
    WIN32_FIND_DATAW fd; HANDLE h = FindFirstFileW(pat, &fd);
    free(pat);
    char **l = NULL; int n = 0, cap = 0;
    if (h != INVALID_HANDLE_VALUE) {
        do {
            if (!(fd.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY) || fd.cFileName[0] == L'.') continue;
            char *id = u16to8(fd.cFileName);
            if (!re_nt_id(id)) { free(id); continue; }
            if (n == cap) { cap = cap ? cap * 2 : 16; l = (char **)realloc(l, (size_t)cap * sizeof *l); }
            l[n++] = id;
        } while (FindNextFileW(h, &fd));
        FindClose(h);
    }
    *out = l;
    return n;
}
static void elenco_json(buf_t *b) {
    wchar_t *base = nt_dir();
    char **ids; int n = cartelle(base, &ids);
    voce_el *el = (voce_el *)calloc((size_t)n + 1, sizeof *el); int k = 0;
    for (int i = 0; i < n; i++) {
        wchar_t *w = u8to16(ids[i]), *d = path_join(base, w), *p = path_join(d, L"episodio.json");
        jdoc dv; jv *v = leggi_json_w(&dv, p, PD_MAX_JSON);
        if (v && v->t == J_OBJ) {
            buf_t o; buf_init(&o); buf_adds(&o, "{");
            int primo = 1, risposte = 0;
            for (size_t j = 0; j < v->n; j++) {
                if (!strcmp(v->keys[j], "domande") || !strcmp(v->keys[j], "risposte")) continue;
                if (!primo) buf_adds(&o, ", ");
                primo = 0;
                json_str(&o, v->keys[j]); buf_adds(&o, ": "); buf_add(&o, v->items[j]->raw, v->items[j]->rawlen);
            }
            jv *dd = jget(v, "domande");
            for (size_t j = 0; dd && dd->t == J_ARR && j < dd->n; j++) { const char *f = jstr(dd->items[j], "file", ""); if (f && *f) risposte++; }
            buf_addf(&o, "%s\"risposte\": %d}", primo ? "" : ", ", risposte);
            el[k].creato = jnum(v, "creato", 0); el[k].json = buf_steal(&o); k++;
        }
        jdoc_free(&dv); free(w); free(d); free(p); free(ids[i]);
    }
    free(ids); free(base);
    qsort(el, (size_t)k, sizeof *el, cmp_el);
    buf_adds(b, "[");
    for (int i = 0; i < k; i++) { if (i) buf_adds(b, ", "); buf_adds(b, el[i].json); free(el[i].json); }
    buf_adds(b, "]");
    free(el);
}

/* ------------------------------------------------------------------ Consulente Digitale di questo PC */
static void cartella_consulente(wchar_t *out, size_t n) {
    wchar_t e[MAX_PATH] = L"";
    if (GetEnvironmentVariableW(L"PD_CONSULENTE_DIR", e, MAX_PATH) && e[0]) { wcsncpy(out, e, n - 1); out[n - 1] = 0; return; }
    if (!GetEnvironmentVariableW(L"APPDATA", e, MAX_PATH)) e[0] = 0;
    _snwprintf(out, n, L"%ls\\ConsulenteDigitale", e[0] ? e : L"."); out[n - 1] = 0;
}
static int ep_valido(const jv *v, const char *id) {
    jv *d = jget(v, "domande");
    return v && v->t == J_OBJ && d && d->t == J_ARR && !strcmp(jstr(v, "id", ""), id);
}
static void stato_consulente(buf_t *b) {
    wchar_t cd[MAX_PATH]; cartella_consulente(cd, MAX_PATH);
    wchar_t *base = path_join(cd, L"nonni-teach"), *mio = nt_dir();
    char **ids; int n = cartelle(base, &ids), tot = 0, nuove = 0;
    for (int i = 0; i < n; i++) {
        wchar_t *w = u8to16(ids[i]), *d = path_join(base, w), *p = path_join(d, L"episodio.json");
        jdoc dv; jv *v = leggi_json_w(&dv, p, PD_MAX_JSON);
        if (ep_valido(v, ids[i])) {
            tot++;
            wchar_t *m = path_join(mio, w), *mp = path_join(m, L"episodio.json");
            if (!file_exists(mp)) nuove++;
            free(m); free(mp);
        }
        jdoc_free(&dv); free(w); free(d); free(p); free(ids[i]);
    }
    free(ids);
    char *b8 = u16to8(base);
    buf_adds(b, "{\"cartella\": "); json_str(b, b8); buf_addf(b, ", \"episodi\": %d, \"nuove\": %d}", tot, nuove);
    free(b8); free(base); free(mio);
}
/* preferenze del Consulente {url, titolo, autore, email} (valore diretto o {"value": ...}); 0 se nessuna */
static int prefs_json(const jv *p, buf_t *b) {
    if (p && p->t == J_OBJ && jget(p, "value") && jget(p, "value")->t == J_OBJ) p = jget(p, "value");
    if (!p || p->t != J_OBJ) return 0;
    static const char *K[] = { "url", "titolo", "autore", "email", NULL };
    int n = 0;
    for (int i = 0; K[i]; i++) {
        char *t = jtesto(p, K[i], 200);
        if (*t) { buf_adds(b, n ? ", " : "{"); json_str(b, K[i]); buf_adds(b, ": "); json_str(b, t); n++; }
        free(t);
    }
    if (n) buf_adds(b, "}");
    return n;
}
/* copia le interviste valide di base\<id>\ nella cartella di Nonni Teach (mai sopra quelle che ci sono gia') */
static void copia_interviste(const wchar_t *base, buf_t *idlist, int *copiate, int *saltate) {
    wchar_t *mio = nt_dir();
    char **ids; int n = cartelle(base, &ids);
    for (int i = 0; i < n; i++) {
        wchar_t *w = u8to16(ids[i]), *d = path_join(base, w), *p = path_join(d, L"episodio.json");
        jdoc dv; jv *v = leggi_json_w(&dv, p, PD_MAX_JSON);
        if (ep_valido(v, ids[i])) {
            wchar_t *dest = path_join(mio, w);
            if (dir_exists(dest) || file_exists(dest)) (*saltate)++;
            else {
                wchar_t *tmp = wcsdup_printf(L"%ls.importo", dest);
                rmtree(tmp); mkdirs(tmp);
                wchar_t *pat = path_join(d, L"*");
                WIN32_FIND_DATAW fd; HANDLE h = FindFirstFileW(pat, &fd);
                free(pat);
                if (h != INVALID_HANDLE_VALUE) {
                    do {
                        if (fd.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY) continue;
                        char *nome = u16to8(fd.cFileName);
                        if (re_file(nome, 1) && fd.nFileSizeHigh == 0 && fd.nFileSizeLow <= NT_MAX_AUDIO) {
                            wchar_t *s = path_join(d, fd.cFileName), *t = path_join(tmp, fd.cFileName);
                            CopyFileW(s, t, FALSE);
                            free(s); free(t);
                        }
                        free(nome);
                    } while (FindNextFileW(h, &fd));
                    FindClose(h);
                }
                buf_t j; buf_init(&j);
                /* episodio.json: tutto come prima piu' «origine» */
                buf_adds(&j, "{");
                int primo = 1;
                for (size_t k = 0; k < v->n; k++) {
                    if (!strcmp(v->keys[k], "origine")) continue;
                    if (!primo) buf_adds(&j, ", ");
                    primo = 0;
                    json_str(&j, v->keys[k]); buf_adds(&j, ": "); buf_add(&j, v->items[k]->raw, v->items[k]->rawlen);
                }
                buf_adds(&j, primo ? "\"origine\": \"Consulente Digitale\"}" : ", \"origine\": \"Consulente Digitale\"}");
                wchar_t *ej = path_join(tmp, L"episodio.json");
                file_write_atomic(ej, j.p, j.n);
                free(ej); buf_free(&j);
                if (MoveFileW(tmp, dest)) {
                    if (*copiate) buf_adds(idlist, ", ");
                    json_str(idlist, ids[i]);
                    (*copiate)++;
                } else rmtree(tmp);
                free(tmp);
            }
            free(dest);
        }
        jdoc_free(&dv); free(w); free(d); free(p); free(ids[i]);
    }
    free(ids); free(mio);
}
static void importa_consulente(req_t *r) {
    wchar_t cd[MAX_PATH]; cartella_consulente(cd, MAX_PATH);
    wchar_t *base = path_join(cd, L"nonni-teach");
    buf_t ids; buf_init(&ids);
    int copiate = 0, saltate = 0;
    copia_interviste(base, &ids, &copiate, &saltate);
    buf_t b; buf_init(&b);
    buf_addf(&b, "{\"ok\": true, \"copiate\": %d, \"saltate\": %d, \"id\": [", copiate, saltate);
    buf_add(&b, ids.p, ids.n); buf_adds(&b, "], \"prefs\": ");
    wchar_t *pf = path_join(cd, L"nonni.json");
    jdoc dp; jv *p = leggi_json_w(&dp, pf, PD_MAX_JSON);
    if (!prefs_json(p, &b)) buf_adds(&b, "null");
    char *b8 = u16to8(base);
    buf_adds(&b, ", \"cartella\": "); json_str(&b, b8); buf_adds(&b, "}");
    send_json(r, 200, &b);
    free(b8); jdoc_free(&dp); free(pf); buf_free(&b); buf_free(&ids); free(base);
}
static void importa_backup(req_t *r) {
    if (!r->body_len || r->body_len > NT_MAX_BACKUP) { send_error(r, 400, "file vuoto o troppo grande"); return; }
    wchar_t *zp = path_join(G.local_dir, L"nonni-import.zip"), *td = path_join(G.local_dir, L"nonni-import");
    mkdirs(G.local_dir); rmtree(td);
    char err[300] = "";
    if (!file_write_atomic(zp, r->body, r->body_len)) { send_error(r, 500, "impossibile salvare il file"); free(zp); free(td); return; }
    if (!unzip_to(zp, td, NULL, err, sizeof err)) {
        char m[400]; snprintf(m, sizeof m, "non è un file di copia del Consulente Digitale (.cdbackup) valido: %s", err);
        send_error(r, 400, m);
    } else {
        wchar_t *base = path_join(td, L"nonni-teach");
        buf_t ids; buf_init(&ids);
        int copiate = 0, saltate = 0;
        copia_interviste(base, &ids, &copiate, &saltate);
        buf_t pr; buf_init(&pr);
        int hp = 0;
        wchar_t *pj = path_join(td, L"nonni.json");
        jdoc dp; jv *p = leggi_json_w(&dp, pj, PD_MAX_JSON);
        hp = prefs_json(p, &pr);
        jdoc_free(&dp); free(pj);
        if (!hp) {
            wchar_t *bj = path_join(td, L"consulente-digitale-backup.json");
            jdoc dt; jv *t = leggi_json_w(&dt, bj, 64u * 1024u * 1024u);
            jv *dati = jget(t, "dati");
            if (dati && dati->t == J_OBJ && jget(dati, "nonni")) { buf_free(&pr); buf_init(&pr); hp = prefs_json(jget(dati, "nonni"), &pr); }
            jdoc_free(&dt); free(bj);
        }
        if (!copiate && !saltate && !hp)
            send_error(r, 400, "nel file non ci sono interviste di Nonni Teach (nel Consulente: Impostazioni, «💾 Crea un backup» spuntando «con le registrazioni»)");
        else {
            buf_t b; buf_init(&b);
            buf_addf(&b, "{\"ok\": true, \"copiate\": %d, \"saltate\": %d, \"id\": [", copiate, saltate);
            buf_add(&b, ids.p, ids.n); buf_adds(&b, "], \"prefs\": ");
            if (hp) buf_add(&b, pr.p, pr.n); else buf_adds(&b, "null");
            buf_adds(&b, "}");
            send_json(r, 200, &b); buf_free(&b);
        }
        buf_free(&pr); buf_free(&ids); free(base);
    }
    rmtree(td); DeleteFileW(zp);
    free(zp); free(td);
}

/* ------------------------------------------------------------------ salvataggio */
static void salva(req_t *r, jv *req) {
    jv *ep = jget(req, "episodio");
    if (!ep || ep->t != J_OBJ) { send_error(r, 400, "dati non validi"); return; }
    char id[96];
    snprintf(id, sizeof id, "%s", jstr(ep, "id", "") ? jstr(ep, "id", "") : "");
    if (!id[0]) {
        char *nome = jtesto(ep, "intervistato", 40), slug[96]; size_t o = 0; int trat = 0;
        for (const unsigned char *c = (const unsigned char *)nome; *c && o < sizeof slug - 2; c++) {
            unsigned char x = (unsigned char)tolower(*c < 0x80 ? *c : 0);
            if ((x >= 'a' && x <= 'z') || (x >= '0' && x <= '9')) { slug[o++] = (char)x; trat = 0; }
            else if (!trat) { slug[o++] = '-'; trat = 1; }
            if (*c >= 0x80) while ((c[1] & 0xC0) == 0x80) c++;
        }
        slug[o] = 0;
        char *s = slug; while (*s == '-') s++;
        size_t L = strlen(s); while (L && s[L - 1] == '-') s[--L] = 0;
        SYSTEMTIME st; GetLocalTime(&st);
        snprintf(id, sizeof id, "%04d%02d%02d-%02d%02d-%s", st.wYear, st.wMonth, st.wDay, st.wHour, st.wMinute, *s ? s : "intervista");
        free(nome);
    }
    if (!re_nt_id(id)) { send_error(r, 400, "intervista non valida"); return; }
    if (!jvero(ep, "consenso_registrare")) { send_error(r, 400, "serve il consenso della persona intervistata per registrare"); return; }
    wchar_t *d = ep_dir(id); mkdirs(d); free(d);
    ntep vec; int ha_vec = ep_carica(id, &vec);
    ntep e; memset(&e, 0, sizeof e);
    snprintf(e.id, sizeof e.id, "%s", id);
    jv *qs = jget(ep, "domande");
    for (size_t i = 0; qs && qs->t == J_ARR && i < qs->n && i < NT_MAX_Q; i++) {
        jv *q = qs->items[i];
        if (!q || q->t != J_OBJ) continue;
        ntq *x = &e.q[e.nq];      /* come in Python: la risposta resta legata alla posizione nell'elenco */
        x->testo = jtesto(q, "testo", 500); x->tema = jtesto(q, "tema", 40); x->nota = jtesto(q, "nota", 2000);
        x->file = _strdup(ha_vec && (int)i < vec.nq ? vec.q[i].file : "");
        x->durata = ha_vec && (int)i < vec.nq ? vec.q[i].durata : 0;
        e.nq++;
    }
    char *t = jtesto(ep, "titolo", 160);
    if (!*t) { free(t); t = _strdup("Intervista"); }
    e.titolo = t;
    e.intervistato = jtesto(ep, "intervistato", 80); e.luogo = jtesto(ep, "luogo", 80); e.contesto = jtesto(ep, "contesto", 30);
    e.intervistatore = jtesto(ep, "intervistatore", 120); e.descrizione = jtesto(ep, "descrizione", 1500);
    e.cr = 1; e.cp = jvero(ep, "consenso_pubblicare");
    if (ha_vec && vec.creato) e.creato = vec.creato;
    else { FILETIME ft; GetSystemTimeAsFileTime(&ft); ULARGE_INTEGER u; u.LowPart = ft.dwLowDateTime; u.HighPart = ft.dwHighDateTime; e.creato = (double)(u.QuadPart - 116444736000000000ULL) / 1e7; }
    if (ha_vec && vec.data && *vec.data) e.data = _strdup(vec.data);
    else { SYSTEMTIME st; GetLocalTime(&st); char dd[16]; snprintf(dd, sizeof dd, "%04d-%02d-%02d", st.wYear, st.wMonth, st.wDay); e.data = _strdup(dd); }
    e.podcast = _strdup(ha_vec ? vec.podcast : "");
    e.capitoli = _strdup(ha_vec && vec.capitoli ? vec.capitoli : "[]");
    e.ha_durata = ha_vec && vec.ha_durata && vec.durata; e.durata = ha_vec ? vec.durata : 0;
    e.origine = _strdup(ha_vec && vec.origine ? vec.origine : "");
    if (ha_vec) ep_free(&vec);
    if (!ep_salva(&e)) send_error(r, 500, "impossibile salvare l'intervista");
    else { buf_t b; buf_init(&b); ep_json(&b, &e, 1); send_json(r, 200, &b); buf_free(&b); }
    ep_free(&e);
}

static void salva_audio(req_t *r, const char *id, int n) {
    ntep e;
    if (!re_nt_id(id) || !ep_carica(id, &e)) { send_error(r, 400, "intervista non trovata"); return; }
    if (!e.cr) { ep_free(&e); send_error(r, 400, "manca il consenso"); return; }
    if (n < 1 || n > e.nq) { ep_free(&e); send_error(r, 400, "domanda non valida"); return; }
    if (strncmp(r->ctype, "audio/", 6)) { ep_free(&e); send_error(r, 400, "serve un file audio"); return; }
    if (!r->body_len || r->body_len > NT_MAX_AUDIO) { ep_free(&e); send_error(r, 400, "registrazione vuota o troppo grande"); return; }
    const char *est = !strcmp(r->ctype, "audio/ogg") ? "ogg" : !strcmp(r->ctype, "audio/mp4") ? "m4a" : (!strcmp(r->ctype, "audio/wav") || !strcmp(r->ctype, "audio/x-wav")) ? "wav"
                    : !strcmp(r->ctype, "audio/mpeg") ? "mp3" : "webm";
    wchar_t *d = ep_dir(id), pat[32];
    _snwprintf(pat, 32, L"r%02d.*", n); pat[31] = 0;
    wchar_t *pp = path_join(d, pat);
    WIN32_FIND_DATAW fd; HANDLE h = FindFirstFileW(pp, &fd);
    if (h != INVALID_HANDLE_VALUE) { do { wchar_t *f = path_join(d, fd.cFileName); DeleteFileW(f); free(f); } while (FindNextFileW(h, &fd)); FindClose(h); }
    free(pp);
    char nome[32]; snprintf(nome, sizeof nome, "r%02d.%s", n, est);
    wchar_t *f = ep_file(id, nome);
    if (!file_write_atomic(f, r->body, r->body_len)) { send_error(r, 500, "impossibile salvare la registrazione"); free(f); free(d); ep_free(&e); return; }
    wchar_t ff[MAX_PATH];
    double du = ffmpeg(ff, MAX_PATH) ? floor(durata(ff, f) * 10 + 0.5) / 10 : 0;
    free(e.q[n - 1].file); e.q[n - 1].file = _strdup(nome); e.q[n - 1].durata = du;
    free(e.podcast); e.podcast = _strdup("");          /* il montaggio va rifatto */
    ep_salva(&e);
    buf_t b; buf_init(&b);
    q_json(&b, &e.q[n - 1], n);
    b.n--; buf_adds(&b, ", \"ok\": true}");
    send_json(r, 200, &b);
    buf_free(&b); free(f); free(d); ep_free(&e);
}

/* ------------------------------------------------------------------ montaggio del podcast */
static void meta_esc(buf_t *b, const char *s) {
    for (; s && *s; s++) { if (*s == '=' || *s == ';' || *s == '#' || *s == '\\' || *s == '\n') buf_add(b, "\\", 1); buf_add(b, s, 1); }
}
static void monta(req_t *r, const char *id) {
    ntep e;
    if (!re_nt_id(id) || !ep_carica(id, &e)) { send_error(r, 400, "intervista non trovata"); return; }
    int fatte = 0;
    for (int i = 0; i < e.nq; i++) if (*e.q[i].file) fatte++;
    if (!fatte) { ep_free(&e); send_error(r, 400, "non ci sono ancora risposte registrate"); return; }
    wchar_t ff[MAX_PATH];
    if (!ffmpeg(ff, MAX_PATH)) {
        ep_free(&e);
        buf_t b; buf_init(&b);
        buf_adds(&b, "{\"ok\": false, \"serve_ffmpeg\": true, \"messaggio\": \"Per unire le registrazioni in un unico MP3 serve FFmpeg, un programma libero e gratuito. Intanto le risposte si ascoltano una per una.\"}");
        send_json(r, 200, &b); buf_free(&b);
        return;
    }
    char voce[160] = "";
    int con_voce = tts_engine_count() > 0;
    if (con_voce) voce_neura(voce, sizeof voce);
    wchar_t *d = ep_dir(id);
    /* pezzi: titolo (o NULL) + percorso */
    char *titoli[2 * NT_MAX_Q + 1]; wchar_t *pezzi[2 * NT_MAX_Q + 1]; int np = 0;
    int intro = 0;
#define VOCE(TESTO, NOME, OUT) do { buf_t w_; char u_[32] = "", e_[200] = ""; OUT = NULL; buf_init(&w_); \
        if (con_voce && tts_synthesize(TESTO, 0.95, NULL, voce[0] ? voce : NULL, &w_, u_, sizeof u_, e_, sizeof e_)) { \
            wchar_t *p_ = ep_file(id, NOME); if (file_write_atomic(p_, w_.p, w_.n)) OUT = p_; else free(p_); } buf_free(&w_); } while (0)
    {
        buf_t t; buf_init(&t);
        buf_adds(&t, "Nonni Teach. "); buf_adds(&t, e.titolo); buf_adds(&t, ". ");
        if (*e.intervistato) { buf_adds(&t, "Racconta: "); buf_adds(&t, e.intervistato); buf_adds(&t, ". "); }
        if (*e.luogo) { buf_adds(&t, "A "); buf_adds(&t, e.luogo); }
        buf_adds(&t, ". Registrato il "); buf_adds(&t, e.data); buf_adds(&t, ".");
        wchar_t *p; VOCE(t.p, "intro.wav", p);
        if (p) { titoli[np] = _strdup("Presentazione"); pezzi[np++] = p; intro = 1; }
        buf_free(&t);
    }
    for (int i = 0; i < e.nq; i++) {
        if (!*e.q[i].file) continue;
        char nome[16]; snprintf(nome, sizeof nome, "d%02d.wav", i + 1);
        wchar_t *p; VOCE(e.q[i].testo, nome, p);
        char *tit = strdup_printf("%d. %s", i + 1, e.q[i].testo);
        if (p) { titoli[np] = tit; pezzi[np++] = p; tit = NULL; }
        titoli[np] = tit; pezzi[np++] = ep_file(id, e.q[i].file);
    }
#undef VOCE
    /* durate e capitoli */
    double t = 0, inizi[2 * NT_MAX_Q + 1]; int nc = 0; char *ctit[2 * NT_MAX_Q + 1];
    for (int i = 0; i < np; i++) {
        double du = durata(ff, pezzi[i]);
        if (titoli[i]) { ctit[nc] = titoli[i]; inizi[nc++] = floor(t * 100 + 0.5) / 100; }
        t += du;
    }
    double totale = floor(t * 100 + 0.5) / 100;
    buf_t m; buf_init(&m);
    buf_adds(&m, ";FFMETADATA1\ntitle="); meta_esc(&m, e.titolo);
    buf_adds(&m, "\nartist="); meta_esc(&m, *e.intervistato ? e.intervistato : "Nonni Teach");
    buf_adds(&m, "\nalbum=Nonni Teach\ngenre=Podcast\ndate="); buf_add(&m, e.data, strlen(e.data) < 4 ? strlen(e.data) : 4);
    buf_adds(&m, "\ncomment="); meta_esc(&m, "Registrato con il Professore Digitale di Danilo D'Auria - CC BY-NC-SA 4.0"); buf_adds(&m, "\n");
    buf_t caps; buf_init(&caps); buf_adds(&caps, "[");
    for (int i = 0; i < nc; i++) {
        double fine = i + 1 < nc ? inizi[i + 1] : totale;
        char tt[4096]; snprintf(tt, sizeof tt, "%s", ctit[i]);
        { size_t c = 0, k = 0; for (; tt[k]; k++) if (((unsigned char)tt[k] & 0xC0) != 0x80 && c++ == 120) break; tt[k] = 0; }
        buf_addf(&m, "[CHAPTER]\nTIMEBASE=1/1000\nSTART=%d\nEND=%d\ntitle=", (int)(inizi[i] * 1000), (int)(fine * 1000)); meta_esc(&m, tt); buf_adds(&m, "\n");
        if (i) buf_adds(&caps, ", ");
        buf_adds(&caps, "{\"titolo\": "); json_str(&caps, ctit[i]); buf_adds(&caps, ", \"inizio\": "); num(&caps, inizi[i]); buf_adds(&caps, ", \"fine\": "); num(&caps, fine); buf_adds(&caps, "}");
    }
    buf_adds(&caps, "]");
    wchar_t *meta = ep_file(id, "capitoli.txt"), *uscita = ep_file(id, "podcast.mp3");
    file_write_atomic(meta, m.p, m.n);
    buf_t cmd; buf_init(&cmd);
    cmd_add(&cmd, ff); cmd_add(&cmd, L"-hide_banner"); cmd_add(&cmd, L"-y");
    for (int i = 0; i < np; i++) { cmd_add(&cmd, L"-i"); cmd_add(&cmd, pezzi[i]); }
    cmd_add(&cmd, L"-i"); cmd_add(&cmd, meta);
    buf_t fil; buf_init(&fil);
    for (int i = 0; i < np; i++) buf_addf(&fil, "[%d:a]aresample=44100,aformat=sample_fmts=fltp:channel_layouts=mono,loudnorm=I=-18:TP=-2[a%d];", i, i);
    for (int i = 0; i < np; i++) buf_addf(&fil, "[a%d]", i);
    buf_addf(&fil, "concat=n=%d:v=0:a=1[out]", np);
    char nmeta[16]; snprintf(nmeta, sizeof nmeta, "%d", np);
    cmd_add(&cmd, L"-filter_complex"); cmd_add8(&cmd, fil.p); cmd_add(&cmd, L"-map"); cmd_add(&cmd, L"[out]");
    cmd_add(&cmd, L"-map_metadata"); cmd_add8(&cmd, nmeta); cmd_add(&cmd, L"-map_chapters"); cmd_add8(&cmd, nmeta);
    cmd_add(&cmd, L"-c:a"); cmd_add(&cmd, L"libmp3lame"); cmd_add(&cmd, L"-q:a"); cmd_add(&cmd, L"5"); cmd_add(&cmd, L"-id3v2_version"); cmd_add(&cmd, L"3"); cmd_add(&cmd, uscita);
    buf_t out; DWORD code = 1;
    buf_init(&out);
    int ok = run_process(cmd_fine(&cmd), d, NULL, 0, &out, 1800000, &code, 1);
    if (!ok || code != 0 || !file_exists(uscita)) {
        buf_add(&out, "", 1);
        const char *coda = out.p ? out.p : ""; size_t L = strlen(coda);
        char msg[600]; snprintf(msg, sizeof msg, "FFmpeg non è riuscito a montare il podcast: %s", L > 400 ? coda + L - 400 : coda);
        send_error(r, 500, msg);
    } else {
        free(e.podcast); e.podcast = _strdup("podcast.mp3");
        free(e.capitoli); e.capitoli = _strdup(caps.p);
        e.ha_durata = 1; e.durata = floor(t * 10 + 0.5) / 10;
        ep_salva(&e);
        buf_t b; buf_init(&b);
        buf_adds(&b, "{\"ok\": true, \"podcast\": \"podcast.mp3\", \"capitoli\": "); buf_add(&b, caps.p, caps.n);
        buf_adds(&b, ", \"durata\": "); num(&b, e.durata); buf_addf(&b, ", \"voce_domande\": %s}", intro ? "true" : "false");
        send_json(r, 200, &b); buf_free(&b);
    }
    buf_free(&out);
    buf_free(&cmd); buf_free(&fil); buf_free(&m); buf_free(&caps);
    for (int i = 0; i < np; i++) { free(titoli[i]); free(pezzi[i]); }
    free(meta); free(uscita); free(d); ep_free(&e);
}

/* ------------------------------------------------------------------ zip (senza compressione) */
typedef struct { char *nome; unsigned crc, size, off; } zvoce;
static int zip_scrivi(const wchar_t *zp, const wchar_t *dir) {
    HANDLE z = CreateFileW(zp, GENERIC_WRITE, 0, NULL, CREATE_ALWAYS, FILE_ATTRIBUTE_NORMAL, NULL);
    if (z == INVALID_HANDLE_VALUE) return 0;
    zvoce v[1024]; int n = 0; unsigned off = 0; DWORD w;
    const char *sub[2] = { "", "audio/" };
    char *blk = (char *)malloc(1 << 16);
    for (int s = 0; s < 2 && blk; s++) {
        wchar_t *d = s ? path_join(dir, L"audio") : _wcsdup(dir), *pat = path_join(d, L"*");
        WIN32_FIND_DATAW fd; HANDLE h = FindFirstFileW(pat, &fd);
        free(pat);
        if (h != INVALID_HANDLE_VALUE) {
            do {
                if ((fd.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY) || n >= 1024) continue;
                wchar_t *full = path_join(d, fd.cFileName);
                char *nome8 = u16to8(fd.cFileName);
                char *nome = strdup_printf("%s%s", sub[s], nome8); free(nome8);
                HANDLE f = CreateFileW(full, GENERIC_READ, FILE_SHARE_READ, NULL, OPEN_EXISTING, 0, NULL);
                free(full);
                if (f == INVALID_HANDLE_VALUE) { free(nome); continue; }
                unsigned crc = (unsigned)crc32(0L, Z_NULL, 0), size = 0; DWORD got;
                while (ReadFile(f, blk, 1 << 16, &got, NULL) && got) { crc = (unsigned)crc32(crc, (const Bytef *)blk, got); size += got; }
                unsigned char lh[30]; unsigned L = (unsigned)strlen(nome);
                memset(lh, 0, 30);
                lh[0] = 0x50; lh[1] = 0x4b; lh[2] = 3; lh[3] = 4; lh[4] = 20; lh[6] = 0; lh[7] = 0x08;   /* versione 2.0, nomi UTF-8 */
                lh[14] = crc & 255; lh[15] = crc >> 8 & 255; lh[16] = crc >> 16 & 255; lh[17] = crc >> 24;
                for (int k = 0; k < 2; k++) { unsigned x = size; int o = 18 + 4 * k; lh[o] = x & 255; lh[o + 1] = x >> 8 & 255; lh[o + 2] = x >> 16 & 255; lh[o + 3] = x >> 24; }
                lh[12] = 0x21; lh[26] = L & 255; lh[27] = L >> 8;           /* data: 1 gennaio 1980 */
                WriteFile(z, lh, 30, &w, NULL); WriteFile(z, nome, L, &w, NULL);
                LARGE_INTEGER zero; zero.QuadPart = 0; SetFilePointerEx(f, zero, NULL, FILE_BEGIN);
                while (ReadFile(f, blk, 1 << 16, &got, NULL) && got) WriteFile(z, blk, got, &w, NULL);
                CloseHandle(f);
                v[n].nome = nome; v[n].crc = crc; v[n].size = size; v[n].off = off; n++;
                off += 30 + L + size;
            } while (FindNextFileW(h, &fd));
            FindClose(h);
        }
        free(d);
    }
    free(blk);
    unsigned cd_off = off, cd_size = 0;
    for (int i = 0; i < n; i++) {
        unsigned char ch[46]; unsigned L = (unsigned)strlen(v[i].nome);
        memset(ch, 0, 46);
        ch[0] = 0x50; ch[1] = 0x4b; ch[2] = 1; ch[3] = 2; ch[4] = 20; ch[6] = 20; ch[9] = 0x08;
        unsigned vals[3] = { v[i].crc, v[i].size, v[i].size };
        for (int k = 0; k < 3; k++) { int o = 16 + 4 * k; ch[o] = vals[k] & 255; ch[o + 1] = vals[k] >> 8 & 255; ch[o + 2] = vals[k] >> 16 & 255; ch[o + 3] = vals[k] >> 24; }
        ch[14] = 0x21; ch[28] = L & 255; ch[29] = L >> 8;
        ch[42] = v[i].off & 255; ch[43] = v[i].off >> 8 & 255; ch[44] = v[i].off >> 16 & 255; ch[45] = v[i].off >> 24;
        WriteFile(z, ch, 46, &w, NULL); WriteFile(z, v[i].nome, L, &w, NULL);
        cd_size += 46 + L;
        free(v[i].nome);
    }
    unsigned char eo[22]; memset(eo, 0, 22);
    eo[0] = 0x50; eo[1] = 0x4b; eo[2] = 5; eo[3] = 6;
    eo[8] = n & 255; eo[9] = n >> 8; eo[10] = n & 255; eo[11] = n >> 8;
    eo[12] = cd_size & 255; eo[13] = cd_size >> 8 & 255; eo[14] = cd_size >> 16 & 255; eo[15] = cd_size >> 24;
    eo[16] = cd_off & 255; eo[17] = cd_off >> 8 & 255; eo[18] = cd_off >> 16 & 255; eo[19] = cd_off >> 24;
    WriteFile(z, eo, 22, &w, NULL);
    CloseHandle(z);
    return 1;
}

/* ------------------------------------------------------------------ sito del podcast (repository «nonni-teach») */
static int url_valido(const char *u) {      /* ^https://[A-Za-z0-9.-]+(/[A-Za-z0-9._~/-]*)?$ */
    if (strncmp(u, "https://", 8)) return 0;
    const char *p = u + 8; int host = 0;
    for (; *p && *p != '/'; p++) { if (!(isalnum((unsigned char)*p) || *p == '.' || *p == '-')) return 0; host++; }
    if (!host) return 0;
    for (; *p; p++) if (!(isalnum((unsigned char)*p) || strchr("._~/-", *p))) return 0;
    return 1;
}
static int email_valida(const char *s) {    /* ^[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9.-]{1,180}\.[A-Za-z]{2,24}$ */
    const char *at = strchr(s, '@');
    if (!at || at == s || at - s > 64) return 0;
    for (const char *p = s; p < at; p++) if (!(isalnum((unsigned char)*p) || strchr("._%+-", *p))) return 0;
    const char *dom = at + 1, *dot = strrchr(dom, '.');
    if (!dot || dot == dom || dot - dom > 180) return 0;
    for (const char *p = dom; p < dot; p++) if (!(isalnum((unsigned char)*p) || *p == '.' || *p == '-')) return 0;
    size_t tl = strlen(dot + 1);
    if (tl < 2 || tl > 24) return 0;
    for (const char *p = dot + 1; *p; p++) if (!isalpha((unsigned char)*p)) return 0;
    return 1;
}
static void hms(buf_t *b, double x) {
    int s = (int)x;
    if (s >= 3600) buf_addf(b, "%d:%02d:%02d", s / 3600, s % 3600 / 60, s % 60); else buf_addf(b, "%d:%02d", s / 60, s % 60);
}
static void data_rfc(buf_t *b, double t) {     /* email.utils.formatdate (UTC) */
    static const char *G7[] = { "Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat" };
    static const char *M12[] = { "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec" };
    time_t tt = (time_t)t; struct tm *g = gmtime(&tt);
    if (!g) { buf_adds(b, "Thu, 01 Jan 1970 00:00:00 -0000"); return; }
    buf_addf(b, "%s, %02d %s %04d %02d:%02d:%02d -0000", G7[g->tm_wday], g->tm_mday, M12[g->tm_mon], g->tm_year + 1900, g->tm_hour, g->tm_min, g->tm_sec);
}
static int scrivi_testo(const wchar_t *dir, const wchar_t *nome, buf_t *b) { wchar_t *p = path_join(dir, nome); int ok = file_write_atomic(p, b->p, b->n); free(p); return ok; }

typedef struct { char nome[200]; char *titolo; const char *tipo; } fsito;
static void crea_sito(req_t *r, jv *req) {
    const char *u0 = jstr(req, "url", NULL);
    char *url = testo(u0 && *u0 ? u0 : SITO_PREDEFINITO, 400);
    if (!url_valido(url)) { free(url); send_error(r, 400, "indirizzo del sito non valido (deve iniziare con https://)"); return; }
    if (url[strlen(url) - 1] != '/') { char *x = strdup_printf("%s/", url); free(url); url = x; }
    char *tit = jtesto(req, "titolo", 120), *aut = jtesto(req, "autore", 120), *email = jtesto(req, "email", 200);
    if (!*tit) { free(tit); tit = _strdup("Nonni Teach"); }
    if (!*aut) { free(aut); aut = _strdup("Nonni Teach"); }
    if (*email && !email_valida(email)) { send_error(r, 400, "indirizzo email non valido"); free(url); free(tit); free(aut); free(email); return; }
    wchar_t *sito = path_join(G.data_dir, L"nonni-teach-sito"), *audio = path_join(sito, L"audio");
    rmtree(sito); mkdirs(audio);
    wchar_t *cop = path_join(G.web_dir, L"img\\nonni-teach\\copertina.jpg"), *copd = path_join(sito, L"copertina.jpg");
    int con_cop = file_exists(cop) && CopyFileW(cop, copd, FALSE);
    free(cop); free(copd);
    /* episodi con consenso, dal piu' recente */
    buf_t el; buf_init(&el); elenco_json(&el);
    char e2[64]; jv *lista = json_parse(el.p, el.n, e2, sizeof e2);
    buf_t blocchi, voci; buf_init(&blocchi); buf_init(&voci);
    int nep = 0;
    for (size_t i = 0; lista && lista->t == J_ARR && i < lista->n; i++) {
        jv *x = lista->items[i];
        if (!jvero(x, "consenso_pubblicare")) continue;
        ntep e; if (!ep_carica(jstr(x, "id", ""), &e)) continue;
        fsito fs[NT_MAX_Q]; int nf = 0;
        wchar_t *pod = ep_file(e.id, *e.podcast ? e.podcast : "podcast.mp3");
        if (*e.podcast && file_exists(pod)) {
            snprintf(fs[0].nome, sizeof fs[0].nome, "%s.mp3", e.id);
            wchar_t *w = u8to16(fs[0].nome), *dst = path_join(audio, w); CopyFileW(pod, dst, FALSE); free(w); free(dst);
            fs[0].titolo = e.titolo; fs[0].tipo = "audio/mpeg"; nf = 1;
        } else {
            for (int q = 0; q < e.nq; q++) {
                if (!*e.q[q].file || !re_file(e.q[q].file, 0)) continue;
                wchar_t *src = ep_file(e.id, e.q[q].file);
                if (file_exists(src)) {
                    snprintf(fs[nf].nome, sizeof fs[nf].nome, "%s-%s", e.id, e.q[q].file);
                    wchar_t *w = u8to16(fs[nf].nome), *dst = path_join(audio, w); CopyFileW(src, dst, FALSE); free(w); free(dst);
                    fs[nf].titolo = e.q[q].testo; fs[nf].tipo = tipo_audio(e.q[q].file); nf++;
                }
                free(src);
            }
        }
        free(pod);
        if (nf) {
            nep++;
            /* pagina */
            buf_adds(&blocchi, "<article id=\""); html(&blocchi, e.id); buf_adds(&blocchi, "\"><h2>"); html(&blocchi, e.titolo);
            buf_adds(&blocchi, "</h2><p class=\"meta\">"); html(&blocchi, e.intervistato);
            if (*e.luogo) { buf_adds(&blocchi, " · "); html(&blocchi, e.luogo); }
            buf_adds(&blocchi, " · "); html(&blocchi, e.data); buf_adds(&blocchi, "</p>");
            if (*e.descrizione) { buf_adds(&blocchi, "<p>"); html(&blocchi, e.descrizione); buf_adds(&blocchi, "</p>"); }
            for (int k = 0; k < nf; k++) {
                buf_adds(&blocchi, "<figure><figcaption>"); html(&blocchi, fs[k].titolo); buf_adds(&blocchi, "</figcaption><audio controls preload=\"none\" src=\"audio/");
                html(&blocchi, fs[k].nome); buf_adds(&blocchi, "\"></audio></figure>");
            }
            jv *caps = json_parse(e.capitoli, strlen(e.capitoli), e2, sizeof e2);
            if (caps && caps->t == J_ARR && caps->n && nf == 1) {
                buf_adds(&blocchi, "<ol class=\"cap\">");
                for (size_t c = 0; c < caps->n; c++) {
                    jv *ce = caps->items[c]; jv *in = jget(ce, "inizio");
                    buf_adds(&blocchi, "<li><a href=\"#\" data-t=\""); if (in && in->t == J_NUM) buf_add(&blocchi, in->raw, in->rawlen); else buf_adds(&blocchi, "0");
                    buf_adds(&blocchi, "\">"); hms(&blocchi, jnum(ce, "inizio", 0)); buf_adds(&blocchi, "</a> "); html(&blocchi, jstr(ce, "titolo", "")); buf_adds(&blocchi, "</li>");
                }
                buf_adds(&blocchi, "</ol>");
            }
            json_free(caps);
            int note = 0;
            for (int q = 0; q < e.nq; q++) if (*e.q[q].nota) {
                if (!note++) buf_adds(&blocchi, "<details><summary>Appunti</summary><ul>");
                buf_adds(&blocchi, "<li><b>"); html(&blocchi, e.q[q].testo); buf_adds(&blocchi, "</b> "); html(&blocchi, e.q[q].nota); buf_adds(&blocchi, "</li>");
            }
            if (note) buf_adds(&blocchi, "</ul></details>");
            buf_adds(&blocchi, "</article>");
            /* feed */
            for (int k = 0; k < nf; k++) {
                wchar_t *w = u8to16(fs[k].nome), *pf = path_join(audio, w);
                long long sz = file_size(pf); free(w); free(pf);
                buf_adds(&voci, "<item><title>");
                if (nf == 1) html(&voci, e.titolo); else { html(&voci, e.titolo); buf_adds(&voci, " — "); html(&voci, fs[k].titolo); }
                buf_adds(&voci, "</title><description>"); html(&voci, *e.descrizione ? e.descrizione : e.intervistato);
                buf_adds(&voci, "</description><guid isPermaLink=\"false\">"); html(&voci, e.id); buf_adds(&voci, "/"); html(&voci, fs[k].nome);
                buf_adds(&voci, "</guid><pubDate>"); data_rfc(&voci, e.creato ? e.creato : (double)time(NULL)); buf_adds(&voci, "</pubDate><enclosure url=\"");
                html(&voci, url); buf_adds(&voci, "audio/"); html(&voci, fs[k].nome); buf_addf(&voci, "\" length=\"%I64d\" type=\"%s\"/><itunes:author>", sz < 0 ? 0 : sz, fs[k].tipo);
                html(&voci, *e.intervistato ? e.intervistato : aut); buf_adds(&voci, "</itunes:author>");
                if (e.ha_durata && e.durata && nf == 1) buf_addf(&voci, "<itunes:duration>%d</itunes:duration>", (int)e.durata);
                buf_adds(&voci, "</item>");
            }
        }
        ep_free(&e);
    }
    json_free(lista); buf_free(&el);
    /* index.html */
    buf_t pg; buf_init(&pg);
    buf_adds(&pg, "<!doctype html>\n<html lang=\"it\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">\n<title>"); html(&pg, tit);
    buf_adds(&pg, "</title><meta name=\"description\" content=\"Podcast di Nonni Teach: i nonni insegnano, raccontano e ricordano.\">\n<link rel=\"alternate\" type=\"application/rss+xml\" title=\""); html(&pg, tit);
    buf_adds(&pg, "\" href=\"feed.xml\">");
    if (con_cop) { buf_adds(&pg, "\n<meta property=\"og:title\" content=\""); html(&pg, tit); buf_adds(&pg, "\"><meta property=\"og:image\" content=\""); html(&pg, url); buf_adds(&pg, "copertina.jpg\">"); }
    buf_adds(&pg, "\n<style>\n:root{--f:#060b1a;--p:#0f1a33;--t:#e6f1ff;--t2:#9fb3cf;--n:#38bdf8;--n2:#a78bfa}\n"
                  "@media (prefers-color-scheme: light){:root{--f:#f4f7fc;--p:#fff;--t:#0f1d36;--t2:#4a5b78;--n:#0369a1;--n2:#6d28d9}}\n"
                  "body{margin:0;background:var(--f);color:var(--t);font:18px/1.55 \"Segoe UI\",system-ui,sans-serif}\n"
                  "header{padding:2.5rem 1rem 1.5rem;text-align:center;background:radial-gradient(circle at 50% 0,rgba(56,189,248,.25),transparent 60%)}\n"
                  ".copertina{width:180px;height:180px;border-radius:22px;box-shadow:0 8px 30px rgba(56,189,248,.35)}\n"
                  "h1{margin:.2rem 0;font-size:2.2rem;letter-spacing:.04em}header p{color:var(--t2);margin:.3rem auto;max-width:42rem}\n"
                  "main{max-width:52rem;margin:0 auto;padding:0 16px 3rem}\n"
                  "article{background:var(--p);border:1px solid rgba(125,211,252,.25);border-radius:18px;padding:1rem 1.2rem;margin:1rem 0}\n"
                  "h2{margin:.2rem 0;color:var(--n)}.meta{color:var(--t2);margin:.2rem 0 .6rem}audio{width:100%}figure{margin:.5rem 0}figcaption{font-size:.9rem;color:var(--t2)}\n"
                  ".cap{font-size:.92rem}.cap a{color:var(--n2);font-variant-numeric:tabular-nums}footer{text-align:center;color:var(--t2);font-size:.85rem;padding:2rem 16px}\n"
                  "a{color:var(--n)}\n</style></head><body>\n<header>");
    if (con_cop) { buf_adds(&pg, "<img class=\"copertina\" src=\"copertina.jpg\" alt=\"Copertina del podcast "); html(&pg, tit); buf_adds(&pg, "\" width=\"180\" height=\"180\">"); }
    else buf_adds(&pg, "<div style=\"font-size:3rem\">🎙️</div>");
    buf_adds(&pg, "<h1>"); html(&pg, tit);
    buf_addf(&pg, "</h1><p>I nonni insegnano: ricordi, mestieri, ricette, parole e consigli raccontati dalla loro voce.</p>\n<p><a href=\"feed.xml\">Feed RSS del podcast</a> · %d episodi</p></header>\n<main>", nep);
    if (nep) buf_add(&pg, blocchi.p, blocchi.n); else buf_adds(&pg, "<p>Ancora nessun episodio pubblicato.</p>");
    buf_adds(&pg, "</main>\n<footer>Registrazioni pubblicate con il consenso delle persone intervistate · Contenuti CC BY-NC-SA 4.0 · Curato da "); html(&pg, aut);
    buf_adds(&pg, "<br>\nInterviste condotte da Neura e realizzate con il <b>Professore Digitale</b> ideato e sviluppato da <b>Danilo D'Auria</b> (codice MIT, contenuti CC BY-NC-SA 4.0).</footer>\n"
                  "<script>document.addEventListener(\"click\",function(e){var a=e.target.closest(\"a[data-t]\");if(!a)return;e.preventDefault();\n"
                  "var au=a.closest(\"article\").querySelector(\"audio\");au.currentTime=+a.getAttribute(\"data-t\");au.play();});</script>\n</body></html>");
    scrivi_testo(sito, L"index.html", &pg);
    /* feed.xml */
    buf_t fd; buf_init(&fd);
    buf_adds(&fd, "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<rss version=\"2.0\" xmlns:itunes=\"http://www.itunes.com/dtds/podcast-1.0.dtd\"><channel><title>"); html(&fd, tit);
    buf_adds(&fd, "</title><link>"); html(&fd, url);
    buf_adds(&fd, "</link><language>it</language><description>I nonni insegnano: ricordi e saperi raccontati dalla loro voce. Contenuti CC BY-NC-SA 4.0.</description><itunes:author>"); html(&fd, aut);
    buf_adds(&fd, "</itunes:author>");
    if (con_cop) {
        buf_adds(&fd, "<itunes:image href=\""); html(&fd, url); buf_adds(&fd, "copertina.jpg\"/><image><url>"); html(&fd, url); buf_adds(&fd, "copertina.jpg</url><title>");
        html(&fd, tit); buf_adds(&fd, "</title><link>"); html(&fd, url); buf_adds(&fd, "</link></image>");
    }
    if (*email) { buf_adds(&fd, "<itunes:owner><itunes:name>"); html(&fd, aut); buf_adds(&fd, "</itunes:name><itunes:email>"); html(&fd, email); buf_adds(&fd, "</itunes:email></itunes:owner>"); }
    buf_adds(&fd, "<itunes:explicit>false</itunes:explicit><itunes:type>episodic</itunes:type><itunes:category text=\"Society &amp; Culture\"/><copyright>CC BY-NC-SA 4.0 - "); html(&fd, aut);
    buf_adds(&fd, "</copyright><generator>Professore Digitale di Danilo D'Auria</generator>"); buf_add(&fd, voci.p, voci.n); buf_adds(&fd, "</channel></rss>\n");
    scrivi_testo(sito, L"feed.xml", &fd);
    buf_t lg; buf_init(&lg);
    buf_adds(&lg, "NONNI TEACH - sito del podcast\r\n\r\nCaricate TUTTO il contenuto di questa cartella nel repository GitHub «nonni-teach»\r\n"
                  "con GitHub Desktop: copia dei file (sostituendo quelli vecchi), Commit, Push.\r\n"
                  "Solo la prima volta: su GitHub, Settings > Pages > Deploy from a branch > main.\r\nIndirizzo previsto: ");
    buf_adds(&lg, url); buf_adds(&lg, "\r\nFeed per Spotify e Apple Podcasts: "); buf_adds(&lg, url);
    buf_adds(&lg, "feed.xml\r\n\r\nContengono solo le interviste con il consenso alla pubblicazione.\r\n"
                  "Interviste condotte da Neura con il Professore Digitale di Danilo D'Auria - codice MIT, contenuti CC BY-NC-SA 4.0.\r\n");
    scrivi_testo(sito, L"LEGGIMI.txt", &lg);
    wchar_t *zp = path_join(G.data_dir, L"nonni-teach-sito.zip");
    zip_scrivi(zp, sito);
    char *s8 = u16to8(sito), *z8 = u16to8(zp);
    buf_t b; buf_init(&b);
    buf_adds(&b, "{\"ok\": true, \"cartella\": "); json_str(&b, s8); buf_adds(&b, ", \"zip\": "); json_str(&b, z8);
    buf_addf(&b, ", \"episodi\": %d, \"url\": ", nep); json_str(&b, url); buf_adds(&b, ", \"avvisi\": [");
    int na = 0;
    if (!*email) { json_str(&b, "Senza email di contatto Spotify e Apple Podcasts non accettano il feed."); na++; }
    if (!con_cop) { if (na) buf_adds(&b, ", "); json_str(&b, "Manca la copertina del podcast."); }
    buf_adds(&b, "]}");
    send_json(r, 200, &b);
    buf_free(&b); free(s8); free(z8); free(zp);
    buf_free(&pg); buf_free(&fd); buf_free(&lg); buf_free(&blocchi); buf_free(&voci);
    free(sito); free(audio); free(url); free(tit); free(aut); free(email);
}

/* ------------------------------------------------------------------ smistamento */
size_t nonni_limite(const char *path) {
    if (strncmp(path, "/api/nonni/", 11)) return 0;
    if (!strcmp(path, "/api/nonni/importa-backup")) return NT_MAX_BACKUP;
    if (strstr(path, "/audio/")) return NT_MAX_AUDIO;
    return 0;
}

void nonni_api(req_t *r, int post) {
    const char *path = r->path;
    if (!post) {
        if (!strcmp(path, "/api/nonni")) {
            buf_t b; buf_init(&b);
            wchar_t ff[MAX_PATH]; char voce[160];
            wchar_t *sito = path_join(G.data_dir, L"nonni-teach-sito"); char *s8 = u16to8(sito);
            buf_adds(&b, "{\"ok\": true, \"episodi\": "); elenco_json(&b);
            buf_addf(&b, ", \"ffmpeg\": %s, \"voce_neura\": ", ffmpeg(ff, MAX_PATH) ? "true" : "false");
            if (voce_neura(voce, sizeof voce)) json_str(&b, voce); else buf_adds(&b, "null");
            buf_adds(&b, ", \"sito\": "); json_str(&b, s8);
            buf_adds(&b, ", \"url_predefinito\": "); json_str(&b, SITO_PREDEFINITO);
            buf_adds(&b, ", \"consulente\": "); stato_consulente(&b);
            buf_adds(&b, ", \"sistema\": \"windows\"}");
            send_json(r, 200, &b);
            buf_free(&b); free(s8); free(sito);
            return;
        }
        if (!strcmp(path, "/api/nonni/sito.zip")) {
            wchar_t *zp = path_join(G.data_dir, L"nonni-teach-sito.zip");
            if (!file_exists(zp)) send_error(r, 404, "prima create il sito");
            else manda_file(r, zp, "application/zip", "Content-Disposition: attachment; filename=\"nonni-teach-sito.zip\"\r\n");
            free(zp);
            return;
        }
        /* /api/nonni/<id>  e  /api/nonni/<id>/file/<nome> */
        char id[96] = "", nome[128] = "";
        const char *p = path + 11, *sl = strchr(p, '/');
        size_t L = sl ? (size_t)(sl - p) : strlen(p);
        if (L >= sizeof id) { send_error(r, 404, "intervista non valida"); return; }
        memcpy(id, p, L); id[L] = 0;
        if (!re_nt_id(id)) { send_error(r, 404, "intervista non valida"); return; }
        if (!sl) {
            wchar_t *f = ep_file(id, "episodio.json");
            jdoc dv; jv *v = leggi_json_w(&dv, f, PD_MAX_JSON);
            free(f);
            if (!v || v->t != J_OBJ) { jdoc_free(&dv); send_error(r, 404, "intervista non trovata"); return; }
            buf_t b; buf_init(&b); buf_adds(&b, "{\"ok\": true");
            for (size_t j = 0; j < v->n; j++) { if (!strcmp(v->keys[j], "ok")) continue; buf_adds(&b, ", "); json_str(&b, v->keys[j]); buf_adds(&b, ": "); buf_add(&b, v->items[j]->raw, v->items[j]->rawlen); }
            buf_adds(&b, "}");
            send_json(r, 200, &b); buf_free(&b); jdoc_free(&dv);
            return;
        }
        if (!strncmp(sl, "/file/", 6) && strlen(sl + 6) < sizeof nome) {
            snprintf(nome, sizeof nome, "%s", sl + 6);
            if (!re_file(nome, 0)) { send_error(r, 404, "file non valido"); return; }
            wchar_t *f = ep_file(id, nome);
            if (!file_exists(f)) send_error(r, 404, "file non trovato"); else manda_file(r, f, tipo_audio(nome), NULL);
            free(f);
            return;
        }
        send_error(r, 404, "API sconosciuta");
        return;
    }
    /* POST con corpo audio o zip */
    {
        char id[96]; int n = 0, k = 0;
        if (sscanf(path, "/api/nonni/%95[a-z0-9-]/audio/%2d%n", id, &n, &k) == 2 && path[k] == 0) { salva_audio(r, id, n); return; }
    }
    if (!strcmp(path, "/api/nonni/importa-backup")) { importa_backup(r); return; }
    char err[300] = "";
    if (strcmp(r->ctype, "application/json")) { send_error(r, 400, "Content-Type deve essere application/json"); return; }
    jv *req = r->body_len ? json_parse(r->body, r->body_len, err, sizeof err) : jnew(J_OBJ);
    if (!req) { send_error(r, 400, err[0] ? err : "JSON non valido"); return; }
    if (!strcmp(path, "/api/nonni/salva")) salva(r, req);
    else if (!strcmp(path, "/api/nonni/sito")) crea_sito(r, req);
    else if (!strcmp(path, "/api/nonni/importa")) importa_consulente(r);
    else {
        char id[96], az[16]; int k = 0;
        if (sscanf(path, "/api/nonni/%95[a-z0-9-]/%15[a-z]%n", id, az, &k) == 2 && path[k] == 0 && re_nt_id(id)) {
            if (!strcmp(az, "elimina")) { wchar_t *d = ep_dir(id); rmtree(d); free(d); send_ok(r); }
            else if (!strcmp(az, "monta")) monta(r, id);
            else send_error(r, 404, "API sconosciuta");
        } else send_error(r, 404, "API sconosciuta");
    }
    json_free(req);
}
