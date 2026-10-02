/* Professore Digitale per Windows - API (stesse risposte del server Python di Linux)
 * /api/status, chat, tts, stt, data/(chiave), packs, update-check, update-download, update-install, setup/(azione)
 * Ideato e sviluppato da Danilo D'Auria - Licenza MIT */
#include "pd.h"
#include <shellapi.h>

static const char *DATA_KEYS[] = { "settings", "progress", "history", "board", "practice", NULL };

/* ------------------------------------------------------------------ utilita' delle richieste */
static jv *read_json(req_t *r, char *err, size_t errn) {
    if (strcmp(r->ctype, "application/json")) { snprintf(err, errn, "Content-Type deve essere application/json"); return NULL; }
    if (!r->body_len) return jnew(J_OBJ);
    jv *v = json_parse(r->body, r->body_len, err, errn);
    return v;
}
static int data_key_ok(const char *k) { for (int i = 0; DATA_KEYS[i]; i++) if (!strcmp(DATA_KEYS[i], k)) return 1; return 0; }

static jv *read_settings(void) {
    wchar_t *p = path_join(G.data_dir, L"settings.json");
    buf_t b; jv *v = NULL; char e[64];
    if (file_read(p, &b, PD_MAX_JSON)) { v = json_parse(b.p, b.n, e, sizeof e); buf_free(&b); }
    free(p);
    return v;
}
static const char *update_url_effective(jv *settings) {
    const char *u = jstr(settings, "updateUrl", "");
    return (u && *u) ? u : G.update_url;
}

/* ------------------------------------------------------------------ pacchetti di contenuti */
/* Controllo essenziale lato server; la validazione completa (stesse regole di pd_packs.py) la fa
 * js/packs.js nel browser, anche per i pacchetti elencati da questo server. */
static int pack_check(const jv *p, buf_t *errs) {
    int n = 0;
#define ERR(msg) do { if (n < 10) { if (errs->n > 1) buf_adds(errs, ", "); json_str(errs, msg); } n++; } while (0)
    if (!p || p->t != J_OBJ) { ERR("il file non contiene un oggetto JSON"); return n; }
    const char *f = jstr(p, "formato", "");
    if (strcmp(f, "professore-digitale-contenuti")) ERR("formato: deve essere \"professore-digitale-contenuti\"");
    jv *fv = jget(p, "formato_versione");
    if (!fv || fv->t != J_NUM || fv->num != 1) ERR("formato_versione: deve essere 1");
    if (!re_id(jstr(p, "id", ""))) ERR("id: solo lettere minuscole, cifre e trattini (2-49 caratteri)");
    const char *t = jstr(p, "titolo", NULL);
    if (!t || !*t) ERR("pacchetto.titolo: manca");
    if (!re_ver(jstr(p, "versione", ""))) ERR("versione: formato atteso tipo 1.0.0");
    jv *req = jget(p, "richiede_app");
    if (req && req->t == J_STR && req->slen) {
        if (!re_ver(req->str)) ERR("richiede_app: formato atteso tipo 2.1.0");
        else if (version_cmp(req->str, G.version) > 0) {
            char m[160]; snprintf(m, sizeof m, "richiede_app: serve il Professore Digitale %s o successivo (installato: %s)", req->str, G.version);
            ERR(m);
        }
    }
    jv *d = jget(p, "domande"), *l = jget(p, "lezioni");
    if (d && d->t != J_ARR) ERR("domande: deve essere un elenco");
    if (l && l->t != J_ARR) ERR("lezioni: deve essere un elenco");
    if ((!d || d->t != J_ARR || !d->n) && (!l || l->t != J_ARR || !l->n)) ERR("pacchetto: serve almeno una domanda o una lezione");
#undef ERR
    return n;
}

typedef struct { char id[64]; char ver[32]; char origine[16]; char *file; char *raw; } pack_entry;

static int cmp_wstr(const void *a, const void *b) { return wcscmp(*(wchar_t * const *)a, *(wchar_t * const *)b); }

/* scrive {"packs": [...], "errori": [...]}  oppure (solo_versioni) restituisce l'elenco per update-check */
static int load_packs(pack_entry **out, buf_t *errors) {
    struct { const char *orig; const wchar_t *dir; } dirs[3] = { { "sistema", G.system_packs }, { "computer", G.local_packs }, { "utente", G.user_packs } };
    pack_entry *list = NULL; int n = 0, cap = 0;
    int first_err = 1;
    for (int d = 0; d < 3; d++) {
        wchar_t *pat = path_join(dirs[d].dir, L"*.json");
        WIN32_FIND_DATAW fd; HANDLE h = FindFirstFileW(pat, &fd);
        free(pat);
        if (h == INVALID_HANDLE_VALUE) continue;
        wchar_t **names = NULL; int nn = 0, nc = 0;
        do {
            if (fd.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY) continue;
            size_t L = wcslen(fd.cFileName);
            if (L < 6 || _wcsicmp(fd.cFileName + L - 5, L".json")) continue;
            if (nn == nc) { nc = nc ? nc * 2 : 16; names = (wchar_t **)realloc(names, (size_t)nc * sizeof *names); }
            names[nn++] = _wcsdup(fd.cFileName);
        } while (FindNextFileW(h, &fd));
        FindClose(h);
        qsort(names, (size_t)nn, sizeof *names, cmp_wstr);
        for (int i = 0; i < nn; i++) {
            wchar_t *full = path_join(dirs[d].dir, names[i]);
            char *full8 = u16to8(full);
            buf_t b, errs; buf_init(&errs); buf_adds(&errs, "[");
            char perr[200] = "";
            jv *p = NULL;
            long long sz = file_size(full);
            if (sz > (long long)PD_MAX_PACK) { json_str(&errs, "file troppo grande (max 2 MB)"); }
            else if (!file_read(full, &b, PD_MAX_PACK)) { json_str(&errs, "file non leggibile"); }
            else {
                p = json_parse(b.p, b.n, perr, sizeof perr);
                if (!p) { char m[260]; snprintf(m, sizeof m, "JSON non leggibile: %s", perr); json_str(&errs, m); }
                else pack_check(p, &errs);
                if (p && errs.n == 1) {
                    const char *id = jstr(p, "id", ""), *ver = jstr(p, "versione", "0");
                    int found = -1;
                    for (int k = 0; k < n; k++) if (!strcmp(list[k].id, id)) found = k;
                    if (found >= 0 && version_cmp(ver, list[found].ver) < 0) { /* resta la versione piu' alta */ }
                    else {
                        pack_entry e; memset(&e, 0, sizeof e);
                        snprintf(e.id, sizeof e.id, "%s", id); snprintf(e.ver, sizeof e.ver, "%s", ver);
                        snprintf(e.origine, sizeof e.origine, "%s", dirs[d].orig);
                        e.file = _strdup(full8);
                        e.raw = (char *)malloc(p->rawlen + 1); memcpy(e.raw, p->raw, p->rawlen); e.raw[p->rawlen] = 0;
                        if (found >= 0) { free(list[found].file); free(list[found].raw); list[found] = e; }
                        else { if (n == cap) { cap = cap ? cap * 2 : 8; list = (pack_entry *)realloc(list, (size_t)cap * sizeof *list); } list[n++] = e; }
                    }
                }
                buf_free(&b);
            }
            buf_adds(&errs, "]");
            if (errs.n > 2 && errors) {
                if (!first_err) buf_adds(errors, ", ");
                first_err = 0;
                buf_adds(errors, "{\"file\": "); json_str(errors, full8); buf_adds(errors, ", \"errori\": "); buf_add(errors, errs.p, errs.n); buf_adds(errors, "}");
            }
            buf_free(&errs); json_free(p); free(full8); free(full); free(names[i]);
        }
        free(names);
    }
    *out = list;
    return n;
}
static void free_packs(pack_entry *l, int n) { for (int i = 0; i < n; i++) { free(l[i].file); free(l[i].raw); } free(l); }

static void api_packs(req_t *r) {
    buf_t errs; buf_init(&errs);
    pack_entry *l; int n = load_packs(&l, &errs);
    buf_t b; buf_init(&b);
    buf_adds(&b, "{\"ok\": true, \"packs\": [");
    for (int i = 0; i < n; i++) {
        if (i) buf_adds(&b, ", ");
        buf_adds(&b, "{\"origine\": "); json_str(&b, l[i].origine);
        buf_adds(&b, ", \"file\": "); json_str(&b, l[i].file);
        buf_adds(&b, ", \"pacchetto\": "); buf_adds(&b, l[i].raw); buf_adds(&b, "}");
    }
    buf_adds(&b, "], \"errori\": ["); if (errs.n) buf_add(&b, errs.p, errs.n); buf_adds(&b, "]}");
    send_json(r, 200, &b);
    buf_free(&b); buf_free(&errs); free_packs(l, n);
}

static int import_pack(jv *pack, char *file_out, size_t fon, char *err, size_t errn) {
    buf_t errs; buf_init(&errs); buf_adds(&errs, "[");
    int ne = pack_check(pack, &errs);
    if (ne) {
        snprintf(err, errn, "pacchetto non valido: %.*s", (int)(errs.n > 400 ? 400 : errs.n - 1), errs.p + 1);
        buf_free(&errs); return 0;
    }
    buf_free(&errs);
    mkdirs(G.user_packs);
    wchar_t *wid = u8to16(jstr(pack, "id", "x")), *name = wcsdup_printf(L"%ls.json", wid), *path = path_join(G.user_packs, name);
    buf_t out; buf_init(&out); json_write(&out, pack, 1, 0);
    int ok = file_write_atomic(path, out.p, out.n);
    char *p8 = u16to8(path); snprintf(file_out, fon, "%s", p8); free(p8);
    if (!ok) snprintf(err, errn, "impossibile salvare il pacchetto");
    buf_free(&out); free(wid); free(name); free(path);
    return ok;
}

/* ------------------------------------------------------------------ aggiornamenti (solo su richiesta) */
static char *url_join(const char *base, const char *rel) {
    if (!_strnicmp(rel, "http://", 7) || !_strnicmp(rel, "https://", 8)) return _strdup(rel);
    const char *scheme_end = strstr(base, "://");
    if (!scheme_end) return _strdup(rel);
    if (rel[0] == '/') {
        const char *host_end = strchr(scheme_end + 3, '/');
        size_t L = host_end ? (size_t)(host_end - base) : strlen(base);
        return strdup_printf("%.*s%s", (int)L, base, rel);
    }
    const char *last = strrchr(scheme_end + 3, '/');
    size_t L = last ? (size_t)(last - base + 1) : strlen(base);
    return last ? strdup_printf("%.*s%s", (int)L, base, rel) : strdup_printf("%s/%s", base, rel);
}

static int ver_like(const char *s) {   /* ^\d+(\.\d+){0,2}$ */
    if (!s || !*s) return 0;
    int dots = 0;
    for (const char *p = s; *p; p++) {
        if (*p == '.') { if (p == s || p[1] == 0 || p[-1] == '.') return 0; dots++; }
        else if (*p < '0' || *p > '9') return 0;
    }
    return dots <= 2;
}

static void api_update_check(req_t *r, jv *req) {
    jv *settings = read_settings();
    const char *url = jstr(req, "url", "");
    if (!url || !*url) url = update_url_effective(settings);
    char url_copy[1024]; snprintf(url_copy, sizeof url_copy, "%s", url);
    json_free(settings);
    if (!url_allowed(url_copy)) { send_error(r, 502, "indirizzo non valido (serve https, oppure http verso un computer della rete locale)"); return; }
    buf_t b; http_result hr;
    if (!http_get_mem(url_copy, 256 * 1024, 20, &b, &hr)) { send_error(r, 502, hr.error); buf_free(&b); return; }
    char *txt = b.p ? b.p : (char *)"";
    while (*txt == ' ' || *txt == '\n' || *txt == '\r' || *txt == '\t') txt++;
    buf_t o; buf_init(&o);
    char online[64] = "";
    if (*txt == '{') {
        char e[200];
        jv *info = json_parse(txt, strlen(txt), e, sizeof e);
        if (!info) { buf_free(&b); send_error(r, 502, "file degli aggiornamenti non valido"); return; }
        snprintf(online, sizeof online, "%s", jstr(info, "versione", ""));
        if (!ver_like(online)) { json_free(info); buf_free(&b); send_error(r, 502, "risposta non valida dal server degli aggiornamenti"); return; }
        buf_addf(&o, "{\"ok\": true, \"current\": "); json_str(&o, G.version);
        buf_adds(&o, ", \"online\": "); json_str(&o, online);
        buf_addf(&o, ", \"newer\": %s", version_cmp(online, G.version) > 0 ? "true" : "false");
        char data[24]; snprintf(data, sizeof data, "%s", jstr(info, "data", "")); data[20] = 0;
        buf_adds(&o, ", \"data\": "); json_str(&o, data);
        buf_adds(&o, ", \"note\": [");
        jv *note = jget(info, "note");
        for (size_t i = 0; note && note->t == J_ARR && i < note->n && i < 30; i++) {
            if (i) buf_adds(&o, ", ");
            jv *x = note->items[i];
            if (x->t == J_STR) json_strn(&o, x->str, x->slen > 300 ? 300 : x->slen); else json_str(&o, "");
        }
        buf_adds(&o, "]");
        /* per Windows il programma si scarica dalla sezione "windows" (installatore .exe) */
        jv *win = jget(info, "windows");
        const char *pk = win ? jstr(win, "pacchetto", NULL) : NULL;
        const char *sha = win ? jstr(win, "sha256", "") : "";
        char *pkurl = pk ? url_join(url_copy, pk) : NULL;
        buf_adds(&o, ", \"pacchetto\": ");
        if (pkurl && url_allowed(pkurl)) json_str(&o, pkurl); else buf_adds(&o, "null");
        buf_adds(&o, ", \"sha256\": ");
        if (re_sha(sha)) json_str(&o, sha); else buf_adds(&o, "null");
        free(pkurl);
        const char *pg = jstr(info, "pagina", NULL);
        char *pgurl = pg ? url_join(url_copy, pg) : NULL;
        buf_adds(&o, ", \"pagina\": ");
        if (pgurl && url_allowed(pgurl)) json_str(&o, pgurl); else buf_adds(&o, "null");
        free(pgurl);
        /* catalogo dei modelli di IA aggiornato (facoltativo) */
        jv *cat = jget(info, "catalogo_ia");
        const char *caturl = cat ? jstr(cat, "url", NULL) : NULL;
        char *cu = caturl ? url_join(url_copy, caturl) : NULL;
        buf_adds(&o, ", \"catalogo_ia\": ");
        if (cu && url_allowed(cu) && re_sha(jstr(cat, "sha256", ""))) {
            buf_adds(&o, "{\"url\": "); json_str(&o, cu); buf_adds(&o, ", \"sha256\": "); json_str(&o, jstr(cat, "sha256", ""));
            buf_adds(&o, ", \"versione\": "); json_str(&o, jstr(cat, "versione", "")); buf_adds(&o, "}");
        } else buf_adds(&o, "null");
        free(cu);
        /* contenuti */
        pack_entry *l; int n = load_packs(&l, NULL);
        buf_adds(&o, ", \"contenuti\": [");
        jv *cont = jget(info, "contenuti"); int first = 1;
        for (size_t i = 0; cont && cont->t == J_ARR && i < cont->n && i < 50; i++) {
            jv *c = cont->items[i];
            if (c->t != J_OBJ) continue;
            const char *cid = jstr(c, "id", ""), *cver = jstr(c, "versione", ""), *cu2 = jstr(c, "url", NULL);
            if (!re_id(cid) || !re_ver(cver) || !cu2) continue;
            char *full = url_join(url_copy, cu2);
            if (!url_allowed(full)) { free(full); continue; }
            const char *have = NULL;
            for (int k = 0; k < n; k++) if (!strcmp(l[k].id, cid)) have = l[k].ver;
            const char *stato = !have ? "nuovo" : version_cmp(cver, have) > 0 ? "aggiornamento" : "installato";
            const char *csha = jstr(c, "sha256", "");
            if (!first) buf_adds(&o, ", ");
            first = 0;
            buf_adds(&o, "{\"id\": "); json_str(&o, cid);
            buf_adds(&o, ", \"versione\": "); json_str(&o, cver);
            const char *tit = jstr(c, "titolo", cid); buf_adds(&o, ", \"titolo\": "); json_strn(&o, tit, strlen(tit) > 120 ? 120 : strlen(tit));
            const char *des = jstr(c, "descrizione", ""); buf_adds(&o, ", \"descrizione\": "); json_strn(&o, des, strlen(des) > 300 ? 300 : strlen(des));
            buf_adds(&o, ", \"url\": "); json_str(&o, full);
            buf_adds(&o, ", \"sha256\": "); if (re_sha(csha)) json_str(&o, csha); else buf_adds(&o, "null");
            buf_adds(&o, ", \"installata\": "); if (have) json_str(&o, have); else buf_adds(&o, "null");
            buf_adds(&o, ", \"stato\": "); json_str(&o, stato); buf_adds(&o, "}");
            free(full);
        }
        buf_adds(&o, "]}");
        free_packs(l, n);
        json_free(info);
    } else {
        /* vecchio formato: version.txt con il solo numero */
        size_t k = 0; while (txt[k] && txt[k] != '\r' && txt[k] != '\n' && k < sizeof online - 1) { online[k] = txt[k]; k++; }
        online[k] = 0;
        if (!ver_like(online)) { buf_free(&b); send_error(r, 502, "risposta non valida dal server degli aggiornamenti"); return; }
        buf_adds(&o, "{\"ok\": true, \"current\": "); json_str(&o, G.version);
        buf_adds(&o, ", \"online\": "); json_str(&o, online);
        buf_addf(&o, ", \"newer\": %s, \"note\": [], \"data\": \"\", \"pacchetto\": null, \"sha256\": null, \"pagina\": null, \"catalogo_ia\": null, \"contenuti\": []}",
                 version_cmp(online, G.version) > 0 ? "true" : "false");
    }
    send_json(r, 200, &o);
    buf_free(&o); buf_free(&b);
}

static int setup_name_ok(const char *name) {   /* ProfessoreDigitale-Setup-X.Y.Z.exe */
    const char *pre = "ProfessoreDigitale-Setup-";
    size_t L = strlen(name), lp = strlen(pre);
    if (L < lp + 9 || strncmp(name, pre, lp) || _stricmp(name + L - 4, ".exe")) return 0;
    char v[32]; size_t vl = L - lp - 4;
    if (vl >= sizeof v) return 0;
    memcpy(v, name + lp, vl); v[vl] = 0;
    return re_ver3(v);
}

static void api_update_download(req_t *r, jv *req) {
    const char *url = jstr(req, "url", ""), *sha = jstr(req, "sha256", "");
    const char *name = strrchr(url, '/'); name = name ? name + 1 : url;
    if (!setup_name_ok(name)) { send_error(r, 502, "nome del pacchetto non valido"); return; }
    if (!re_sha(sha)) { send_error(r, 502, "manca l'impronta SHA-256: download rifiutato per sicurezza"); return; }
    if (!url_allowed(url)) { send_error(r, 502, "indirizzo non valido"); return; }
    wchar_t *dir = downloads_dir(), *wname = u8to16(name), *dest = path_join(dir, wname);
    wchar_t *tmp = wcsdup_printf(L"%ls.verifica", dest);
    http_result hr; memset(&hr, 0, sizeof hr);
    int ok = http_download(url, tmp, 120, NULL, NULL, NULL, &hr);
    char hex[65];
    if (ok && (file_size(tmp) > 300LL * 1024 * 1024 || !sha256_file(tmp, hex) || strcmp(hex, sha))) {
        DeleteFileW(tmp); send_error(r, 502, "impronta SHA-256 non corrispondente: file scartato");
    } else if (!ok) {
        send_error(r, 502, hr.error[0] ? hr.error : "download non riuscito");
    } else if (!MoveFileExW(tmp, dest, MOVEFILE_REPLACE_EXISTING)) {
        DeleteFileW(tmp); send_error(r, 502, "impossibile salvare il file nella cartella Download");
    } else {
        char *d8 = u16to8(dest);
        buf_t b; buf_init(&b); buf_adds(&b, "{\"ok\": true, \"file\": "); json_str(&b, d8); buf_adds(&b, ", \"installabile\": true}");
        send_json(r, 200, &b); buf_free(&b); free(d8);
    }
    free(dir); free(wname); free(dest); free(tmp);
}

static void api_update_install(req_t *r, jv *req) {
    /* avvia l'installatore appena scaricato e verificato; il Professore si chiude per lasciarlo lavorare */
    const char *file = jstr(req, "file", "");
    wchar_t *wf = u8to16(file), *dir = downloads_dir();
    const wchar_t *base = wcsrchr(wf, L'\\');
    char *b8 = u16to8(base ? base + 1 : wf);
    size_t dl = wcslen(dir);
    int ok = base && !_wcsnicmp(wf, dir, dl) && (size_t)(base - wf) == dl && setup_name_ok(b8) && file_exists(wf);
    if (!ok) { send_error(r, 400, "file di installazione non valido"); }
    else {
        HINSTANCE h = ShellExecuteW(NULL, L"open", wf, NULL, dir, SW_SHOWNORMAL);
        if ((INT_PTR)h <= 32) send_error(r, 500, "impossibile avviare l'installazione");
        else { send_ok(r); request_quit(); }
    }
    free(wf); free(dir); free(b8);
}

/* ------------------------------------------------------------------ stato */
static void api_status(req_t *r) {
    static pd_hw hw; static DWORD hw_t = 0;
    EnterCriticalSection(&G.lock);
    if (!hw_t || GetTickCount() - hw_t > 300000) { hw_detect(&hw); hw_t = GetTickCount(); if (!hw_t) hw_t = 1; }
    pd_hw h = hw;
    LeaveCriticalSection(&G.lock);
    jv *settings = read_settings();
    buf_t b; buf_init(&b);
    buf_adds(&b, "{\"ok\": true, \"version\": "); json_str(&b, G.version);
    buf_adds(&b, ", \"mode\": \"server\", \"platform\": \"windows\", \"setup\": true, ");
    ai_status_json(&b);
    buf_adds(&b, ", \"tts\": {\"engines\": "); tts_engines_json(&b); buf_adds(&b, "}");
    char se[32] = "", sd[512] = "";
    stt_status(se, sizeof se, sd, sizeof sd, 0);
    buf_adds(&b, ", \"stt\": {\"engine\": "); if (se[0]) json_str(&b, se); else buf_adds(&b, "null");
    buf_adds(&b, ", \"detail\": "); if (sd[0]) json_str(&b, sd); else buf_adds(&b, "null"); buf_adds(&b, "}");
    char *dd = u16to8(G.data_dir);
    buf_addf(&b, ", \"system\": {\"ram_mb\": %lld, \"cpus\": %d, \"data_dir\": ", h.ram_mb, h.cpus); json_str(&b, dd);
    buf_adds(&b, ", \"os\": "); json_str(&b, h.os_name);
    buf_adds(&b, ", \"arch\": "); json_str(&b, h.arm64 ? "ARM64" : h.is64os ? "64 bit" : "32 bit");
    buf_adds(&b, ", \"cpu\": "); json_str(&b, h.cpu);
    buf_adds(&b, ", \"gpu\": "); json_str(&b, h.gpu);
    buf_addf(&b, ", \"vram_mb\": %lld}", h.vram_mb);
    buf_adds(&b, ", \"update_url\": "); json_str(&b, update_url_effective(settings));
    buf_adds(&b, "}");
    free(dd);
    json_free(settings);
    send_json(r, 200, &b);
    buf_free(&b);
}

/* ------------------------------------------------------------------ smistamento */
void handle_api(req_t *r) {
    const char *path = r->path;
    int post = !strcmp(r->method, "POST");
    char err[300] = "";
    jv *req = NULL;

    if (!strncmp(path, "/api/setup/", 11)) { setup_api(r, path + 11); return; }

    if (!post) {
        if (!strcmp(path, "/api/status")) { api_status(r); return; }
        if (!strcmp(path, "/api/packs")) { api_packs(r); return; }
        if (!strncmp(path, "/api/data/", 10)) {
            const char *key = path + 10;
            if (!data_key_ok(key)) { send_error(r, 404, "chiave sconosciuta"); return; }
            wchar_t *wk = u8to16(key), *name = wcsdup_printf(L"%ls.json", wk), *p = path_join(G.data_dir, name);
            buf_t f, b; buf_init(&b);
            buf_adds(&b, "{\"ok\": true, \"value\": ");
            int got = 0;
            if (file_read(p, &f, 32u * 1024u * 1024u)) {
                char e[64]; jv *v = json_parse(f.p, f.n, e, sizeof e);   /* file rovinato = come assente */
                if (v) { buf_add(&b, f.p, f.n); got = 1; json_free(v); }
                buf_free(&f);
            }
            if (!got) buf_adds(&b, "null");
            buf_adds(&b, "}");
            send_json(r, 200, &b);
            buf_free(&b); free(wk); free(name); free(p);
            return;
        }
        send_error(r, 404, "API sconosciuta");
        return;
    }

    if (!strcmp(path, "/api/heartbeat")) { send_ok(r); return; }

    if (!strcmp(path, "/api/stt")) {
        if (strcmp(r->ctype, "audio/wav") && strcmp(r->ctype, "audio/x-wav")) { send_error(r, 400, "serve audio/wav"); return; }
        if (r->body_len < 1000 || memcmp(r->body, "RIFF", 4)) { send_error(r, 400, "audio non valido"); return; }
        buf_t t; buf_init(&t);
        if (!stt_transcribe(r->body, r->body_len, &t, err, sizeof err)) { send_error(r, 503, err); buf_free(&t); return; }
        char eng[32] = "", det[16];
        stt_status(eng, sizeof eng, det, sizeof det, 0);
        buf_t b; buf_init(&b);
        buf_adds(&b, "{\"ok\": true, \"text\": "); buf_add(&b, t.p, t.n); buf_adds(&b, ", \"engine\": "); json_str(&b, eng); buf_adds(&b, "}");
        send_json(r, 200, &b);
        buf_free(&b); buf_free(&t);
        return;
    }

    req = read_json(r, err, sizeof err);
    if (!req) { send_error(r, 400, err[0] ? err : "JSON non valido"); return; }

    if (!strcmp(path, "/api/chat")) { ai_chat(r, req); }
    else if (!strcmp(path, "/api/tts")) {
        buf_t wav; buf_init(&wav);
        char used[32] = "";
        jv *rate = jget(req, "rate");
        if (!tts_synthesize(jstr(req, "text", ""), rate && rate->t == J_NUM ? rate->num : 1.0, jstr(req, "engine", NULL),
                            &wav, used, sizeof used, err, sizeof err)) send_error(r, 503, err);
        else {
            char extra[64]; snprintf(extra, sizeof extra, "X-TTS-Engine: %s\r\n", used);
            send_response(r, 200, "audio/wav", wav.p, wav.n, extra);
        }
        buf_free(&wav);
    }
    else if (!strncmp(path, "/api/data/", 10)) {
        const char *key = path + 10;
        if (!data_key_ok(key)) send_error(r, 404, "chiave sconosciuta");
        else {
            jv *v = jget(req, "value");
            mkdirs(G.data_dir);
            wchar_t *wk = u8to16(key), *name = wcsdup_printf(L"%ls.json", wk), *p = path_join(G.data_dir, name);
            int ok = v ? file_write_atomic(p, v->raw, v->rawlen) : file_write_atomic(p, "null", 4);
            if (ok) send_ok(r); else send_error(r, 500, "impossibile salvare i dati");
            free(wk); free(name); free(p);
        }
    }
    else if (!strcmp(path, "/api/update-check")) api_update_check(r, req);
    else if (!strcmp(path, "/api/update-download")) api_update_download(r, req);
    else if (!strcmp(path, "/api/update-install")) api_update_install(r, req);
    else if (!strcmp(path, "/api/packs/import")) {
        char file[MAX_PATH * 3];
        jv *pack = jget(req, "pack");
        if (!import_pack(pack, file, sizeof file, err, sizeof err)) send_error(r, 400, err);
        else { buf_t b; buf_init(&b); buf_adds(&b, "{\"ok\": true, \"file\": "); json_str(&b, file); buf_adds(&b, "}"); send_json(r, 200, &b); buf_free(&b); }
    }
    else if (!strcmp(path, "/api/packs/remove")) {
        const char *id = jstr(req, "id", "");
        if (!re_id(id)) send_error(r, 400, "id non valido");
        else {
            wchar_t *wid = u8to16(id), *name = wcsdup_printf(L"%ls.json", wid), *p = path_join(G.user_packs, name);
            if (!file_exists(p)) send_error(r, 404, "pacchetto non presente tra quelli importati");
            else if (!DeleteFileW(p)) send_error(r, 500, "impossibile rimuovere il pacchetto");
            else send_ok(r);
            free(wid); free(name); free(p);
        }
    }
    else if (!strcmp(path, "/api/packs/download")) {
        const char *url = jstr(req, "url", ""), *sha = jstr(req, "sha256", "");
        buf_t b; http_result hr;
        if (!url_allowed(url)) send_error(r, 502, "download non riuscito: indirizzo non valido (serve https, oppure http verso un computer della rete locale)");
        else if (!http_get_mem(url, PD_MAX_PACK, 20, &b, &hr)) { char m[300]; snprintf(m, sizeof m, "download non riuscito: %s", hr.error); send_error(r, 502, m); buf_free(&b); }
        else {
            char hex[65]; sha256_hex(b.p, b.n, hex);
            char e2[200];
            jv *pack = NULL;
            if (sha && *sha && strcmp(hex, sha)) send_error(r, 502, "download non riuscito: impronta SHA-256 non corrispondente");
            else if (!(pack = json_parse(b.p, b.n, e2, sizeof e2))) { char m[300]; snprintf(m, sizeof m, "download non riuscito: %s", e2); send_error(r, 502, m); }
            else {
                char file[MAX_PATH * 3];
                if (!import_pack(pack, file, sizeof file, err, sizeof err)) send_error(r, 400, err);
                else {
                    buf_t o; buf_init(&o);
                    buf_adds(&o, "{\"ok\": true, \"file\": "); json_str(&o, file);
                    buf_adds(&o, ", \"id\": "); json_str(&o, jstr(pack, "id", ""));
                    buf_adds(&o, ", \"versione\": "); json_str(&o, jstr(pack, "versione", "")); buf_adds(&o, "}");
                    send_json(r, 200, &o); buf_free(&o);
                }
            }
            json_free(pack); buf_free(&b);
        }
    }
    else if (!strcmp(path, "/api/stt-reprobe")) {
        char se[32] = "", sd[512] = "";
        tts_invalidate();
        ai_reload_config();
        stt_status(se, sizeof se, sd, sizeof sd, 1);
        buf_t b; buf_init(&b);
        buf_adds(&b, "{\"ok\": true, \"stt\": {\"engine\": "); if (se[0]) json_str(&b, se); else buf_adds(&b, "null");
        buf_adds(&b, ", \"model\": "); if (sd[0]) json_str(&b, sd); else buf_adds(&b, "null"); buf_adds(&b, "}}");
        send_json(r, 200, &b); buf_free(&b);
    }
    else if (!strcmp(path, "/api/open")) {
        /* apre in Esplora file una cartella del Professore (dati, registro) */
        const char *what = jstr(req, "what", "data");
        const wchar_t *dir = !strcmp(what, "log") || !strcmp(what, "models") ? G.local_dir : G.data_dir;
        mkdirs(dir);
        ShellExecuteW(NULL, L"open", dir, NULL, NULL, SW_SHOWNORMAL);
        send_ok(r);
    }
    else if (!strcmp(path, "/api/shutdown")) {
        send_ok(r);
        request_quit();
    }
    else send_error(r, 404, "API sconosciuta");
    json_free(req);
}
