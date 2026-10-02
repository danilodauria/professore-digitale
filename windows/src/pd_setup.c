/* Professore Digitale per Windows - configurazione guidata e automatica
 *
 *  1. riconosce l'hardware (sistema, processore, memoria, scheda video, disco);
 *  2. sceglie dal catalogo il motore e il modello di IA migliori per QUEL computer;
 *  3. scarica e installa tutto (solo dopo il consenso dell'utente), verificando ogni file
 *     con SHA-256 quando la fonte pubblica l'impronta (GitHub, Hugging Face) e controllando
 *     comunque integrita' e dimensioni;
 *  4. prepara e installa la "chiavetta" per i PC senza Internet.
 *
 * Il catalogo dei modelli (catalogo-ia.json) si aggiorna senza reinstallare: Danilo lo pubblica
 * insieme agli aggiornamenti, cosi' i nuovi PC ricevono sempre "l'IA migliore del momento".
 * Ideato e sviluppato da Danilo D'Auria - Licenza MIT */
#include "pd.h"
#include <shlobj.h>
#include <shellapi.h>

/* ================================================================== catalogo */
int pd_mem_sink(void *p, const char *d, size_t n);
int install_vosk_zip(const wchar_t *zip);
static jv *g_cat = NULL;
static char g_cat_ver[32] = "";

static jv *load_json_file(const wchar_t *p) {
    buf_t b; char e[128]; jv *v = NULL;
    if (file_read(p, &b, 1u << 20)) { v = json_parse(b.p, b.n, e, sizeof e); buf_free(&b); }
    return v;
}
static void catalog_load(void) {
    wchar_t *a = path_join(G.install_dir, L"catalogo-ia.json"), *b = path_join(G.local_dir, L"catalogo-ia.json");
    jv *ca = load_json_file(a), *cb = load_json_file(b);
    free(a); free(b);
    if (cb && strcmp(jstr(cb, "formato", ""), "professore-digitale-catalogo-ia")) { json_free(cb); cb = NULL; }
    jv *use = ca;
    if (cb && (!ca || version_cmp(jstr(cb, "versione", "0"), jstr(ca, "versione", "0")) > 0)) { use = cb; json_free(ca); }
    else json_free(cb);
    EnterCriticalSection(&G.lock);
    json_free(g_cat); g_cat = use;
    snprintf(g_cat_ver, sizeof g_cat_ver, "%s", use ? jstr(use, "versione", "") : "");
    LeaveCriticalSection(&G.lock);
}

/* ================================================================== piano per questo computer */
typedef struct {
    char motore[16];             /* ollama | compatibile | nessuno */
    char motivo[600];
    char modello[128];
    int stt_ok, piper_ok, browser_xp;
    pd_hw hw;
} plan_t;

static pd_hw g_hw; static DWORD g_hw_t = 0;
static void hw_cached(pd_hw *h) {
    EnterCriticalSection(&G.lock);
    if (!g_hw_t || GetTickCount() - g_hw_t > 120000) { hw_detect(&g_hw); g_hw_t = GetTickCount(); if (!g_hw_t) g_hw_t = 1; }
    *h = g_hw;
    LeaveCriticalSection(&G.lock);
}

static jv *engine_list(const char *motore) {
    jv *e = jget(g_cat, motore);
    jv *m = e ? jget(e, "modelli") : NULL;
    return m && m->t == J_ARR ? m : NULL;
}

/* un modello "va bene" se c'e' abbastanza memoria (RAM, oppure scheda video dedicata) e spazio */
static int model_fits(const jv *m, const pd_hw *h, int *why_slow) {
    double gb = jnum(m, "gb", 1);
    long long ram = (long long)jnum(m, "ram_mb", 4000), vram = (long long)jnum(m, "vram_mb", 0);
    int lento_ok = jbool(m, "pc_lenti", 0);
    int ok_mem = h->ram_mb >= ram || (h->gpu_discrete && vram > 0 && h->vram_mb >= vram && h->ram_mb >= ram / 2);
    int ok_disk = h->disk_free_mb <= 0 || h->disk_free_mb >= (long long)(gb * 1024 * 1.2) + 1024;
    int weak = (!h->avx2 || h->cpus < 4) && !h->gpu_discrete;
    if (why_slow) *why_slow = weak && !lento_ok;
    return ok_mem && ok_disk && !(weak && !lento_ok);
}

static void make_plan(plan_t *p) {
    memset(p, 0, sizeof *p);
    hw_cached(&p->hw);
    pd_hw *h = &p->hw;
    if (!g_cat) catalog_load();
    EnterCriticalSection(&G.lock);
    p->stt_ok = h->is64os && !h->arm64;          /* Vosk: Windows a 64 bit (x64) */
    p->piper_ok = h->is64os && !h->arm64 && (h->os_major >= 10 || (h->os_major == 6 && h->os_minor >= 1));
    p->browser_xp = h->os_major < 6 || (h->os_major == 6 && h->os_minor == 0);
    if (!h->is64os) {
        snprintf(p->motore, sizeof p->motore, "nessuno");
        snprintf(p->motivo, sizeof p->motivo, "Windows a 32 bit: i motori di intelligenza artificiale locale richiedono un sistema a 64 bit. "
                 "Il Professore risponde con la sua guida interna, che funziona sempre.");
    } else if (h->os_major < 6 || (h->os_major == 6 && h->os_minor == 0)) {
        snprintf(p->motore, sizeof p->motore, "nessuno");
        snprintf(p->motivo, sizeof p->motivo, "%s non è supportato dai motori di IA moderni. Il Professore usa la guida interna; "
                 "lezioni, voce, lavagna e palestra funzionano normalmente.", h->os_major == 5 ? "Windows XP" : "Windows Vista");
    } else if (h->ram_mb && h->ram_mb < 2500) {
        snprintf(p->motore, sizeof p->motore, "nessuno");
        snprintf(p->motivo, sizeof p->motivo, "Con meno di 3 GB di memoria l'IA sarebbe troppo lenta per una lezione. Il Professore usa la guida interna.");
    } else if ((h->os_major == 10 && h->os_build >= 19045) || h->os_major > 10) {
        snprintf(p->motore, sizeof p->motore, "ollama");
        snprintf(p->motivo, sizeof p->motivo, "%s: si usa Ollama, il motore più diffuso e aggiornato, che sfrutta anche la scheda video se adatta.", h->os_build >= 22000 ? "Windows 11" : "Windows 10 22H2");
    } else if (h->arm64) {
        snprintf(p->motore, sizeof p->motore, "nessuno");
        snprintf(p->motivo, sizeof p->motivo, "Su questo Windows ARM serve almeno Windows 11 per l'IA locale.");
    } else {
        snprintf(p->motore, sizeof p->motore, "compatibile");
        snprintf(p->motivo, sizeof p->motivo, "Ollama richiede Windows 10 22H2 o successivo: per %s si usa il motore compatibile (KoboldCpp), "
                 "che funziona anche sui sistemi meno recenti.", h->os_major == 6 && h->os_minor == 1 ? "Windows 7" : h->os_major == 6 ? "Windows 8/8.1" : "questa versione di Windows");
    }
    if (strcmp(p->motore, "nessuno")) {
        jv *list = engine_list(p->motore);
        for (size_t i = 0; list && i < list->n; i++)
            if (!jbool(list->items[i], "solo_manuale", 0) && model_fits(list->items[i], h, NULL)) snprintf(p->modello, sizeof p->modello, "%s", jstr(list->items[i], "nome", ""));
        if (!p->modello[0] && list && list->n) snprintf(p->modello, sizeof p->modello, "%s", jstr(list->items[0], "nome", ""));
        if (!list) { snprintf(p->motore, sizeof p->motore, "nessuno"); snprintf(p->motivo, sizeof p->motivo, "Catalogo dei modelli non disponibile."); }
    }
    LeaveCriticalSection(&G.lock);
}

static char g_reco[128] = "";
const char *setup_recommended_model(void) {
    static DWORD t = 0;
    if (!t || GetTickCount() - t > 300000) { plan_t p; make_plan(&p); snprintf(g_reco, sizeof g_reco, "%s", p.modello); t = GetTickCount(); if (!t) t = 1; }
    return g_reco;
}

/* ================================================================== stato del lavoro in corso */
typedef struct {
    LONG running;
    volatile LONG cancel;
    char titolo[200];
    char fase[300];
    int passo, passi;
    double percento;            /* -1 = indeterminato */
    long long fatto, totale;
    char log[40][300]; int nlog;
    int finito, riuscito;
    char errore[400];
    char esito_modello[128];
    char esito_motore[16];
} job_t;
static job_t J;

static void jlog(const char *fmt, ...) {
    char m[300]; va_list ap; va_start(ap, fmt); vsnprintf(m, sizeof m, fmt, ap); va_end(ap);
    EnterCriticalSection(&G.lock);
    if (J.nlog == 40) { memmove(J.log[0], J.log[1], sizeof J.log[0] * 39); J.nlog = 39; }
    snprintf(J.log[J.nlog++], 300, "%s", m);
    LeaveCriticalSection(&G.lock);
    pd_log("configurazione: %s", m);
}
static void jphase(int passo, const char *fmt, ...) {
    char m[300]; va_list ap; va_start(ap, fmt); vsnprintf(m, sizeof m, fmt, ap); va_end(ap);
    EnterCriticalSection(&G.lock);
    if (passo) J.passo = passo;
    snprintf(J.fase, sizeof J.fase, "%s", m); J.percento = -1; J.fatto = J.totale = 0;
    LeaveCriticalSection(&G.lock);
    jlog("%s", m);
}
static void on_progress(void *ctx, long long done, long long total) {
    (void)ctx;
    EnterCriticalSection(&G.lock);
    J.fatto = done; J.totale = total;
    J.percento = total > 0 ? 100.0 * (double)done / (double)total : -1;
    LeaveCriticalSection(&G.lock);
}
static void job_progress_json(buf_t *b) {
    EnterCriticalSection(&G.lock);
    buf_addf(b, "{\"ok\": true, \"in_corso\": %s, \"finito\": %s, \"riuscito\": %s, \"passo\": %d, \"passi\": %d, \"percento\": %.1f, \"fatto\": %lld, \"totale\": %lld",
             J.running ? "true" : "false", J.finito ? "true" : "false", J.riuscito ? "true" : "false", J.passo, J.passi, J.percento, J.fatto, J.totale);
    buf_adds(b, ", \"titolo\": "); json_str(b, J.titolo);
    buf_adds(b, ", \"fase\": "); json_str(b, J.fase);
    buf_adds(b, ", \"errore\": "); json_str(b, J.errore);
    buf_adds(b, ", \"modello\": "); json_str(b, J.esito_modello);
    buf_adds(b, ", \"motore\": "); json_str(b, J.esito_motore);
    buf_adds(b, ", \"registro\": [");
    for (int i = 0; i < J.nlog; i++) { if (i) buf_adds(b, ", "); json_str(b, J.log[i]); }
    buf_adds(b, "]}");
    LeaveCriticalSection(&G.lock);
}

/* ================================================================== scaricamenti verificati */
static const char *size_h(long long b, char *out, size_t n) {
    if (b >= 1024LL * 1024 * 1024) snprintf(out, n, "%.1f GB", (double)b / (1024.0 * 1024 * 1024));
    else snprintf(out, n, "%.0f MB", (double)b / (1024.0 * 1024));
    return out;
}

/* impronta di un file di una release GitHub (campo "digest"), se pubblicata */
static int github_asset(const char *repo, const char *tag, const char *name, const char *suffix,
                        char *url, size_t un, char sha[65], char *real_name, size_t rn) {
    char api[512];
    if (tag && *tag) snprintf(api, sizeof api, "https://api.github.com/repos/%s/releases/tags/%s", repo, tag);
    else snprintf(api, sizeof api, "https://api.github.com/repos/%s/releases/latest", repo);
    buf_t b; http_result r; char e[64];
    sha[0] = 0;
    if (!http_get_mem(api, 4u << 20, 30, &b, &r)) { buf_free(&b); return 0; }
    jv *v = json_parse(b.p, b.n, e, sizeof e);
    buf_free(&b);
    jv *assets = v ? jget(v, "assets") : NULL;
    int found = 0;
    for (size_t i = 0; assets && assets->t == J_ARR && i < assets->n; i++) {
        const char *n = jstr(assets->items[i], "name", "");
        size_t L = strlen(n), ls = suffix ? strlen(suffix) : 0;
        if ((name && !strcmp(n, name)) || (suffix && L > ls && !_stricmp(n + L - ls, suffix))) {
            snprintf(url, un, "%s", jstr(assets->items[i], "browser_download_url", ""));
            if (real_name) snprintf(real_name, rn, "%s", n);
            const char *d = jstr(assets->items[i], "digest", "");
            if (!strncmp(d, "sha256:", 7) && re_sha(d + 7)) snprintf(sha, 65, "%s", d + 7);
            found = url[0] != 0;
            break;
        }
    }
    json_free(v);
    return found;
}

/* impronta di un file su Hugging Face (oggetti LFS: "lfs": {"oid": sha256}) */
static int hf_sha(const char *repo, const char *path, char sha[65]) {
    char api[600], dir[300] = "";
    const char *sl = strrchr(path, '/');
    if (sl) snprintf(dir, sizeof dir, "/%.*s", (int)(sl - path), path);
    snprintf(api, sizeof api, "https://huggingface.co/api/models/%s/tree/main%s", repo, dir);
    buf_t b; http_result r; char e[64];
    sha[0] = 0;
    if (!http_get_mem(api, 8u << 20, 30, &b, &r)) { buf_free(&b); return 0; }
    jv *v = json_parse(b.p, b.n, e, sizeof e);
    buf_free(&b);
    for (size_t i = 0; v && v->t == J_ARR && i < v->n; i++) {
        if (strcmp(jstr(v->items[i], "path", ""), path)) continue;
        jv *lfs = jget(v->items[i], "lfs");
        const char *oid = lfs ? jstr(lfs, "oid", "") : "";
        if (re_sha(oid)) snprintf(sha, 65, "%s", oid);
    }
    json_free(v);
    return sha[0] != 0;
}

/* scarica con verifica: se sha e' noto deve coincidere; altrimenti si registra l'impronta calcolata */
static int fetch(const char *what, const char *url, const char *sha, const wchar_t *dest, long long min_size, char *got_sha) {
    char s1[32];
    if (file_exists(dest) && sha && re_sha(sha)) {
        char hx[65];
        if (sha256_file(dest, hx) && !strcmp(hx, sha)) { jlog("%s: già presente e verificato.", what); if (got_sha) strcpy(got_sha, hx); return 1; }
    }
    jphase(0, "Scarico %s…", what);
    http_result r; memset(&r, 0, sizeof r);
    if (!http_download(url, dest, 600, &J.cancel, on_progress, NULL, &r)) {
        snprintf(J.errore, sizeof J.errore, "%s: %s", what, r.error[0] ? r.error : "download non riuscito");
        return 0;
    }
    long long sz = file_size(dest);
    if (sz < min_size) { DeleteFileW(dest); snprintf(J.errore, sizeof J.errore, "%s: file troppo piccolo, probabilmente non è quello giusto", what); return 0; }
    jphase(0, "Verifico l'impronta SHA-256 di %s (%s)…", what, size_h(sz, s1, sizeof s1));
    char hx[65];
    if (!sha256_file(dest, hx)) { snprintf(J.errore, sizeof J.errore, "%s: file non leggibile", what); return 0; }
    if (sha && re_sha(sha)) {
        if (strcmp(hx, sha)) { DeleteFileW(dest); snprintf(J.errore, sizeof J.errore, "%s: impronta SHA-256 diversa da quella pubblicata, file scartato", what); return 0; }
        jlog("✔ %s verificato (SHA-256 come pubblicato dalla fonte).", what);
    } else jlog("✔ %s scaricato in modo sicuro (https). Impronta: %.16s…", what, hx);
    if (got_sha) strcpy(got_sha, hx);
    return 1;
}

/* ================================================================== Ollama */
static int wait_ollama(int seconds) {
    for (int i = 0; i < seconds * 2; i++) {
        if (J.cancel) return 0;
        if (ai_ollama_alive()) return 1;
        if (i == 6) { wchar_t exe[MAX_PATH]; if (ai_ollama_installed(exe, MAX_PATH)) { wchar_t *q = quote_arg(exe), *cl = wcsdup_printf(L"%ls serve", q); HANDLE h = start_process(cl, NULL, 1, NULL); if (h) CloseHandle(h); free(q); free(cl); } }
        Sleep(500);
    }
    return 0;
}

static int install_ollama_setup(const wchar_t *setup) {
    jphase(0, "Installo Ollama (in modo silenzioso, nella cartella dell'utente: non serve la password)…");
    wchar_t *q = quote_arg(setup), *cl = wcsdup_printf(L"%ls /VERYSILENT /SUPPRESSMSGBOXES /NORESTART /SP-", q);
    DWORD code = 1;
    int ok = run_process(cl, NULL, "", 0, NULL, 20 * 60 * 1000, &code, 0);
    free(q); free(cl);
    if (!ok || !ai_ollama_installed(NULL, 0)) { snprintf(J.errore, sizeof J.errore, "installazione di Ollama non riuscita (codice %lu)", (unsigned long)code); return 0; }
    jlog("✔ Ollama installato.");
    return 1;
}

static int ensure_ollama_installed(const wchar_t *tmpdir) {
    if (ai_ollama_installed(NULL, 0)) { jlog("Ollama è già installato."); return 1; }
    jv *o = jget(g_cat, "ollama");
    char url[1024] = "", sha[65] = "", name[128];
    jphase(0, "Cerco l'ultima versione di Ollama…");
    if (!github_asset(jstr(o, "github", "ollama/ollama"), "", jstr(o, "asset", "OllamaSetup.exe"), NULL, url, sizeof url, sha, name, sizeof name))
        snprintf(url, sizeof url, "%s", jstr(o, "setup_url", "https://ollama.com/download/OllamaSetup.exe"));
    wchar_t *dest = path_join(tmpdir, L"OllamaSetup.exe");
    int ok = fetch("l'installatore di Ollama", url, sha, dest, 10 * 1024 * 1024, NULL) && install_ollama_setup(dest);
    DeleteFileW(dest); free(dest);
    return ok;
}

typedef struct { char status[200]; int err; buf_t line; } pull_ctx;
static int pull_sink(void *p, const char *d, size_t n) {
    pull_ctx *x = (pull_ctx *)p;
#define line (x->line)
    if (J.cancel) return 0;
    buf_add(&line, d, n);
    char *s = line.p, *nl;
    while ((nl = memchr(s, '\n', line.n - (size_t)(s - line.p))) != NULL) {
        *nl = 0; char e[64];
        jv *v = json_parse(s, strlen(s), e, sizeof e);
        if (v) {
            const char *er = jstr(v, "error", NULL);
            if (er) { snprintf(J.errore, sizeof J.errore, "Ollama: %s", er); x->err = 1; }
            const char *st = jstr(v, "status", "");
            double tot = jnum(v, "total", 0), cmp = jnum(v, "completed", 0);
            if (strcmp(st, x->status)) { snprintf(x->status, sizeof x->status, "%s", st); }
            EnterCriticalSection(&G.lock);
            if (tot > 0) { J.totale = (long long)tot; J.fatto = (long long)cmp; J.percento = 100.0 * cmp / tot; }
            if (!strncmp(st, "pulling", 7)) snprintf(J.fase, sizeof J.fase, "Scarico il modello (%s)…", tot > 1e8 ? "parte principale" : "file accessorio");
            else if (*st) snprintf(J.fase, sizeof J.fase, "Ollama: %s", st);
            LeaveCriticalSection(&G.lock);
            json_free(v);
        }
        s = nl + 1;
    }
    size_t rest = line.n - (size_t)(s - line.p);
    memmove(line.p, s, rest); line.n = rest;
    return 1;
#undef line
}

static int ollama_pull(const char *model) {
    jphase(0, "Scarico il modello %s con Ollama (può richiedere diversi minuti)…", model);
    char url[300]; snprintf(url, sizeof url, "%s/api/pull", G.ollama_host);
    buf_t body; buf_init(&body); buf_adds(&body, "{\"model\": "); json_str(&body, model); buf_adds(&body, ", \"stream\": true}");
    pull_ctx x; memset(&x, 0, sizeof x);
    http_result r;
    buf_init(&x.line);
    int ok = http_request("POST", url, "application/json", body.p, body.n, 3600, pull_sink, &x, &r);
    buf_free(&body); buf_free(&x.line);
    if (!ok || x.err || r.status != 200) {
        if (!J.errore[0]) snprintf(J.errore, sizeof J.errore, "download del modello non riuscito: %s", r.error[0] ? r.error : "errore di Ollama");
        return 0;
    }
    jlog("✔ Modello %s pronto.", model);
    return 1;
}

static void test_answer(int compat, const char *model) {
    jphase(0, "Faccio una prova in italiano…");
    char url[300]; buf_t body, out; buf_init(&body);
    const char *q = "Rispondi in una sola frase, in italiano semplice: che cos'e' il mouse del computer?";
    if (compat) {
        snprintf(url, sizeof url, "http://127.0.0.1:5001/v1/chat/completions");
        buf_adds(&body, "{\"model\": \"koboldcpp\", \"max_tokens\": 80, \"messages\": [{\"role\": \"user\", \"content\": "); json_str(&body, q); buf_adds(&body, "}]}");
    } else {
        snprintf(url, sizeof url, "%s/api/chat", G.ollama_host);
        buf_adds(&body, "{\"model\": "); json_str(&body, model);
        buf_adds(&body, ", \"stream\": false, \"think\": false, \"options\": {\"num_predict\": 80}, \"messages\": [{\"role\": \"user\", \"content\": "); json_str(&body, q); buf_adds(&body, "}]}");
    }
    http_result r; buf_init(&out);
    int ok = http_request("POST", url, "application/json", body.p, body.n, 300, pd_mem_sink, &out, &r);
    char e[64]; jv *v = ok ? json_parse(out.p, out.n, e, sizeof e) : NULL;
    const char *ans = NULL;
    if (v) {
        if (compat) { jv *ch = jget(v, "choices"); if (ch && ch->t == J_ARR && ch->n) ans = jstr(jget(ch->items[0], "message"), "content", NULL); }
        else ans = jstr(jget(v, "message"), "content", NULL);
    }
    if (ans && *ans) { char a[220]; snprintf(a, sizeof a, "%s", ans); jlog("✔ Il modello risponde: «%s»", a); }
    else jlog("! La prova non ha dato risposta (il primo avvio può essere lento): riprovate dalla pagina Chiedi al Professore.");
    json_free(v); buf_free(&body); buf_free(&out);
}
int pd_mem_sink(void *p, const char *d, size_t n) { buf_t *b = (buf_t *)p; return b->n + n < (8u << 20) && buf_add(b, d, n); }

static int write_ia_conf(const char *motore, const char *modello, const char *titolo, const wchar_t *exe, const wchar_t *gguf, const char *args) {
    buf_t b; buf_init(&b);
    char *e8 = u16to8(exe ? exe : L""), *g8 = u16to8(gguf ? gguf : L"");
    buf_adds(&b, "{\n \"motore\": "); json_str(&b, motore);
    buf_adds(&b, ",\n \"modello\": "); json_str(&b, modello);
    buf_adds(&b, ",\n \"titolo\": "); json_str(&b, titolo);
    buf_adds(&b, ",\n \"exe\": "); json_str(&b, e8);
    buf_adds(&b, ",\n \"gguf\": "); json_str(&b, g8);
    buf_adds(&b, ",\n \"argomenti\": "); json_str(&b, args ? args : "");
    buf_adds(&b, ",\n \"porta\": 5001\n}\n");
    wchar_t *p = path_join(G.local_dir, L"ia.json");
    int ok = file_write_atomic(p, b.p, b.n);
    free(p); free(e8); free(g8); buf_free(&b);
    ai_reload_config();
    return ok;
}

static jv *find_model(const char *motore, const char *nome) {
    jv *list = engine_list(motore);
    for (size_t i = 0; list && i < list->n; i++) if (!strcmp(jstr(list->items[i], "nome", ""), nome)) return list->items[i];
    return NULL;
}

static const char *compat_args(const pd_hw *h) { return !h->avx ? "--failsafe" : !h->avx2 ? "--noavx2" : ""; }

static int wait_compat(int seconds) {
    char url[96]; snprintf(url, sizeof url, "http://127.0.0.1:5001/v1/models");
    for (int i = 0; i < seconds; i++) {
        if (J.cancel) return 0;
        buf_t b; http_result r;
        int ok = http_get_mem(url, 1u << 20, 2, &b, &r); buf_free(&b);
        if (ok) return 1;
        if (i == 1 || i % 30 == 0) { char se[4], sd[4]; (void)se; (void)sd; buf_t s; buf_init(&s); ai_status_json(&s); buf_free(&s); }
        Sleep(1000);
    }
    return 0;
}

/* ================================================================== componenti */
static int do_compat(const char *nome, const wchar_t *kitdir, const pd_hw *h) {
    jv *eng = jget(g_cat, "compatibile"), *m = find_model("compatibile", nome);
    if (!m) { snprintf(J.errore, sizeof J.errore, "modello sconosciuto: %s", nome); return 0; }
    wchar_t *iadir = path_join(G.local_dir, L"ia"); mkdirs(iadir);
    const char *asset = jstr(eng, "asset", "koboldcpp-nocuda.exe");
    wchar_t *wasset = u8to16(asset), *exe = path_join(kitdir ? kitdir : iadir, wasset);
    char url[1024] = "", sha[65] = "", rn[128];
    jphase(0, "Cerco il motore compatibile (KoboldCpp %s)…", jstr(eng, "tag", ""));
    if (!github_asset(jstr(eng, "github", "LostRuins/koboldcpp"), jstr(eng, "tag", ""), asset, NULL, url, sizeof url, sha, rn, sizeof rn))
        snprintf(url, sizeof url, "https://github.com/%s/releases/download/%s/%s", jstr(eng, "github", "LostRuins/koboldcpp"), jstr(eng, "tag", ""), asset);
    int ok = fetch("il motore compatibile", url, sha, exe, 5 * 1024 * 1024, NULL);
    const char *repo = jstr(m, "hf", ""), *file = jstr(m, "file", "");
    wchar_t *wfile = u8to16(file), *mdir = path_join(kitdir ? kitdir : iadir, L"modelli"), *gguf = NULL;
    mkdirs(mdir); gguf = path_join(mdir, wfile);
    if (ok) {
        char hsha[65] = "";
        jphase(0, "Controllo l'impronta pubblicata del modello…");
        hf_sha(repo, file, hsha);
        char murl[1024]; snprintf(murl, sizeof murl, "https://huggingface.co/%s/resolve/main/%s", repo, file);
        char what[200]; snprintf(what, sizeof what, "il modello %s", jstr(m, "titolo", nome));
        ok = fetch(what, murl, hsha, gguf, 50 * 1024 * 1024, NULL);
    }
    if (ok && !kitdir) {
        write_ia_conf("compatibile", nome, jstr(m, "titolo", nome), exe, gguf, compat_args(h));
        jphase(0, "Avvio il motore compatibile (la prima volta può servire un minuto)…");
        buf_t s; buf_init(&s); ai_status_json(&s); buf_free(&s);
        if (wait_compat(240)) { jlog("✔ Motore compatibile attivo."); test_answer(1, nome); }
        else jlog("! Il motore non ha ancora risposto: si avvierà con il Professore. Se non funziona, scegliete un modello più piccolo.");
        snprintf(J.esito_modello, sizeof J.esito_modello, "%s", jstr(m, "titolo", nome));
        snprintf(J.esito_motore, sizeof J.esito_motore, "compatibile");
    }
    free(iadir); free(wasset); free(exe); free(wfile); free(mdir); free(gguf);
    return ok;
}

static int do_ollama(const char *nome, const wchar_t *tmpdir) {
    if (!ensure_ollama_installed(tmpdir)) return 0;
    jphase(0, "Avvio il servizio Ollama…");
    if (!wait_ollama(90)) { if (!J.errore[0]) snprintf(J.errore, sizeof J.errore, "il servizio Ollama non risponde: riavviate il computer e riprovate"); return 0; }
    jlog("✔ Ollama è attivo.");
    if (!ollama_pull(nome)) return 0;
    write_ia_conf("ollama", nome, nome, NULL, NULL, "");
    test_answer(0, nome);
    snprintf(J.esito_modello, sizeof J.esito_modello, "%s", nome);
    snprintf(J.esito_motore, sizeof J.esito_motore, "ollama");
    return 1;
}

static int do_vosk(const wchar_t *kitdir, const wchar_t *tmpdir) {
    jv *v = jget(jget(g_cat, "voce"), "vosk");
    const char *url = jstr(v, "url", "https://alphacephei.com/vosk/models/vosk-model-small-it-0.22.zip");
    const char *sha = jstr(v, "sha256", "");
    const char *nm = strrchr(url, '/'); nm = nm ? nm + 1 : "vosk-it.zip";
    wchar_t *wnm = u8to16(nm), *zip = path_join(kitdir ? kitdir : tmpdir, wnm);
    int ok = fetch("il modello vocale italiano (Vosk)", url, sha, zip, 1024 * 1024, NULL);
    if (ok && !kitdir) {
        ok = install_vosk_zip(zip);
        DeleteFileW(zip);
    }
    free(wnm); free(zip);
    return ok;
}
int install_vosk_zip(const wchar_t *zip) {
    jphase(0, "Estraggo il modello vocale…");
    wchar_t *tmp = path_join(G.models_dir, L"vosk-tmp"), *dest = path_join(G.models_dir, L"vosk-it");
    rmtree(tmp);
    char e[300];
    if (!unzip_to(zip, tmp, &J.cancel, e, sizeof e)) { snprintf(J.errore, sizeof J.errore, "modello vocale: %s", e); rmtree(tmp); free(tmp); free(dest); return 0; }
    /* la cartella del modello e' quella che contiene "am" o "conf" */
    wchar_t found[MAX_PATH] = L"";
    wchar_t *am = path_join(tmp, L"am");
    if (dir_exists(am)) wcsncpy(found, tmp, MAX_PATH - 1);
    free(am);
    if (!found[0]) {
        wchar_t *pat = path_join(tmp, L"*"); WIN32_FIND_DATAW fd; HANDLE h = FindFirstFileW(pat, &fd); free(pat);
        if (h != INVALID_HANDLE_VALUE) {
            do {
                if (!(fd.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY) || fd.cFileName[0] == L'.') continue;
                wchar_t *sub = path_join(tmp, fd.cFileName), *a2 = path_join(sub, L"am"), *c2 = path_join(sub, L"conf");
                if (dir_exists(a2) || dir_exists(c2)) wcsncpy(found, sub, MAX_PATH - 1);
                free(sub); free(a2); free(c2);
            } while (!found[0] && FindNextFileW(h, &fd));
            FindClose(h);
        }
    }
    int ok = 0;
    if (!found[0]) snprintf(J.errore, sizeof J.errore, "il file non contiene un modello Vosk");
    else { rmtree(dest); ok = MoveFileExW(found, dest, 0) != 0; if (!ok) snprintf(J.errore, sizeof J.errore, "impossibile installare il modello vocale"); }
    rmtree(tmp); free(tmp); free(dest);
    if (ok) {
        char se[32], sd[512];
        stt_status(se, sizeof se, sd, sizeof sd, 1);
        if (se[0]) jlog("✔ Microfono pronto: riconoscimento vocale italiano offline."); else jlog("! Modello installato, ma il motore vocale non risponde: reinstallate il Professore.");
    }
    return ok;
}

static int do_piper(const wchar_t *kitdir, const wchar_t *tmpdir) {
    jv *p = jget(jget(g_cat, "voce"), "piper");
    char url[1024] = "", sha[65] = "", rn[128];
    const char *asset = jstr(p, "asset", "piper_windows_amd64.zip");
    jphase(0, "Cerco la voce naturale (Piper)…");
    if (!github_asset(jstr(p, "github", "rhasspy/piper"), jstr(p, "tag", "2023.11.14-2"), asset, NULL, url, sizeof url, sha, rn, sizeof rn))
        snprintf(url, sizeof url, "https://github.com/%s/releases/download/%s/%s", jstr(p, "github", "rhasspy/piper"), jstr(p, "tag", "2023.11.14-2"), asset);
    wchar_t *wa = u8to16(asset), *zip = path_join(kitdir ? kitdir : tmpdir, wa);
    int ok = fetch("il programma della voce naturale", url, sha, zip, 1024 * 1024, NULL);
    jv *files = jget(p, "file");
    const char *hf = jstr(p, "hf", "rhasspy/piper-voices");
    wchar_t *vdir = kitdir ? _wcsdup(kitdir) : path_join(G.models_dir, L"piper");
    mkdirs(vdir);
    for (size_t i = 0; ok && files && files->t == J_ARR && i < files->n; i++) {
        const char *f = files->items[i]->str ? files->items[i]->str : "";
        const char *base = strrchr(f, '/'); base = base ? base + 1 : f;
        char hs[65] = ""; hf_sha(hf, f, hs);
        char u[1024]; snprintf(u, sizeof u, "https://huggingface.co/%s/resolve/main/%s", hf, f);
        wchar_t *wb = u8to16(base), *dst = path_join(vdir, wb);
        ok = fetch("la voce «Paola»", u, hs, dst, 100, NULL);
        free(wb); free(dst);
    }
    if (ok && !kitdir) {
        jphase(0, "Installo la voce naturale…");
        char e[300];
        if (!unzip_to(zip, G.local_dir, &J.cancel, e, sizeof e)) { snprintf(J.errore, sizeof J.errore, "voce naturale: %s", e); ok = 0; }
        DeleteFileW(zip);
        if (ok) {
            tts_invalidate();
            buf_t wav; char used[32] = "", err[200] = "";
            if (tts_synthesize("Buongiorno, sono il Professore Digitale.", 1.0, NULL, &wav, used, sizeof used, err, sizeof err) && !strcmp(used, "piper"))
                jlog("✔ Voce naturale installata e provata.");
            else jlog("! Voce naturale installata, ma la prova non è riuscita: si userà la voce di Windows.");
            buf_free(&wav);
        }
    }
    free(wa); free(zip); free(vdir);
    return ok;
}

static int do_supermium(const wchar_t *kitdir, const wchar_t *tmpdir, int bits64, int run) {
    jv *b = jget(g_cat, "browser");
    char url[1024] = "", sha[65] = "", rn[160] = "";
    jphase(0, "Cerco il browser Supermium (compatibile con Windows XP e Vista)…");
    if (!github_asset(jstr(b, "github", "win32ss/supermium"), "", NULL, bits64 ? jstr(b, "suffisso_64", "_64_setup.exe") : jstr(b, "suffisso_32", "_32_setup.exe"),
                      url, sizeof url, sha, rn, sizeof rn)) { snprintf(J.errore, sizeof J.errore, "browser: elenco dei file non raggiungibile"); return 0; }
    wchar_t *wn = u8to16(rn), *dest = path_join(kitdir ? kitdir : tmpdir, wn);
    int ok = fetch("il browser Supermium", url, sha, dest, 10 * 1024 * 1024, NULL);
    if (ok && run) {
        jlog("Avvio l'installazione del browser: seguite le finestre che compaiono.");
        HINSTANCE h = ShellExecuteW(NULL, L"open", dest, NULL, NULL, SW_SHOWNORMAL);
        if ((INT_PTR)h <= 32) jlog("! Impossibile avviare l'installazione del browser.");
    }
    free(wn); free(dest);
    return ok;
}

/* ================================================================== lavoro: configurazione online */
typedef struct { char modello[128]; int ia, microfono, voce, browser; wchar_t cartella[MAX_PATH]; char motore[16]; } job_req;
static job_req JR;

static void job_begin(const char *titolo, int passi) {
    EnterCriticalSection(&G.lock);
    LONG run = J.running;
    memset(&J, 0, sizeof J);
    J.running = run; J.passi = passi; J.percento = -1;
    snprintf(J.titolo, sizeof J.titolo, "%s", titolo);
    LeaveCriticalSection(&G.lock);
}
static void job_end(int ok) {
    EnterCriticalSection(&G.lock);
    J.finito = 1; J.riuscito = ok && !J.cancel; J.running = 0;
    if (J.cancel && !J.errore[0]) snprintf(J.errore, sizeof J.errore, "operazione annullata");
    snprintf(J.fase, sizeof J.fase, "%s", J.riuscito ? "Configurazione completata." : "Configurazione non completata.");
    LeaveCriticalSection(&G.lock);
    jlog("%s", J.riuscito ? "✔ Fatto! Da ora il computer può restare scollegato da Internet." : J.errore);
    tts_invalidate();
    ai_reload_config();
    InterlockedExchange(&G.last_seen, (LONG)GetTickCount());
}

static wchar_t *job_tmpdir(void) {
    wchar_t *t = path_join(G.local_dir, L"scaricamenti"); mkdirs(t); return t;
}

static unsigned __stdcall job_online(void *arg) {
    (void)arg;
    plan_t p; make_plan(&p);
    int n = (JR.ia ? 1 : 0) + (JR.microfono ? 1 : 0) + (JR.voce ? 1 : 0) + (JR.browser ? 1 : 0), k = 0, ok = 1;
    job_begin("Configurazione automatica", n);
    wchar_t *tmp = job_tmpdir();
    jlog("Computer: %s, %lld MB di RAM, %s.", p.hw.os_name, p.hw.ram_mb, p.hw.gpu[0] ? p.hw.gpu : "scheda video non rilevata");
    if (ok && JR.ia) {
        jphase(++k, "Intelligenza artificiale: %s", JR.modello);
        const char *motore = JR.motore[0] ? JR.motore : p.motore;
        if (!strcmp(motore, "ollama")) ok = do_ollama(JR.modello, tmp);
        else if (!strcmp(motore, "compatibile")) ok = do_compat(JR.modello, NULL, &p.hw);
        else { snprintf(J.errore, sizeof J.errore, "%s", p.motivo); ok = 0; }
    }
    if (ok && JR.microfono && !J.cancel) {
        jphase(++k, "Microfono: riconoscimento vocale offline");
        if (!p.stt_ok) { jlog("! Il microfono richiede Windows a 64 bit: passo saltato."); }
        else ok = do_vosk(NULL, tmp);
    }
    if (ok && JR.voce && !J.cancel) {
        jphase(++k, "Voce naturale «Paola»");
        if (!p.piper_ok) jlog("! La voce naturale richiede Windows 7 o successivo a 64 bit: passo saltato.");
        else ok = do_piper(NULL, tmp);
    }
    if (ok && JR.browser && !J.cancel) { jphase(++k, "Browser compatibile"); ok = do_supermium(NULL, tmp, p.hw.is64os, 1); }
    rmtree(tmp); free(tmp);
    job_end(ok);
    return 0;
}

/* ================================================================== chiavetta per i PC senza Internet */
static int copy_file_v(const wchar_t *src, const wchar_t *dst) {
    wchar_t *parent = _wcsdup(dst); wchar_t *sl = wcsrchr(parent, L'\\'); if (sl) { *sl = 0; mkdirs(parent); } free(parent);
    return CopyFileW(src, dst, FALSE) != 0;
}

static wchar_t *ollama_models_dir(void) {
    wchar_t *env = _wgetenv(L"OLLAMA_MODELS");
    if (env && *env) return _wcsdup(env);
    wchar_t *home = _wgetenv(L"USERPROFILE");
    return wcsdup_printf(L"%ls\\.ollama\\models", home ? home : L"C:");
}

/* copia un modello Ollama (manifest + blob) tra la cartella dei modelli e la chiavetta */
static int ollama_copy_model(const char *name, const wchar_t *from_root, const wchar_t *to_root) {
    char model[128], tag[64] = "latest";
    snprintf(model, sizeof model, "%s", name);
    char *c = strchr(model, ':'); if (c) { *c = 0; snprintf(tag, sizeof tag, "%s", c + 1); }
    const char *ns = strchr(model, '/') ? "" : "library\\";
    char rel[400]; snprintf(rel, sizeof rel, "manifests\\registry.ollama.ai\\%s%s\\%s", ns, model, tag);
    for (char *q = rel; *q; q++) if (*q == '/') *q = '\\';
    wchar_t *wrel = u8to16(rel), *msrc = path_join(from_root, wrel), *mdst = path_join(to_root, wrel);
    buf_t b; char e[64]; int ok = 0;
    if (!file_read(msrc, &b, 1u << 20)) { snprintf(J.errore, sizeof J.errore, "modello %s non trovato nella cartella di Ollama", name); goto out; }
    jv *m = json_parse(b.p, b.n, e, sizeof e);
    buf_free(&b);
    if (!m) { snprintf(J.errore, sizeof J.errore, "descrizione del modello non leggibile"); goto out; }
    ok = copy_file_v(msrc, mdst);
    jv *layers = jget(m, "layers");
    size_t total = (layers && layers->t == J_ARR ? layers->n : 0) + 1;
    for (size_t i = 0; ok && i < total; i++) {
        jv *L = i + 1 < total ? layers->items[i] : jget(m, "config");
        const char *dg = jstr(L, "digest", "");
        if (strncmp(dg, "sha256:", 7) || !re_sha(dg + 7)) continue;
        char bn[80]; snprintf(bn, sizeof bn, "blobs\\sha256-%s", dg + 7);
        wchar_t *wbn = u8to16(bn), *s = path_join(from_root, wbn), *d = path_join(to_root, wbn);
        char hx[65];
        jphase(0, "Copio e verifico una parte del modello (%u di %u)…", (unsigned)i + 1, (unsigned)total);
        if (!(file_exists(d) && file_size(d) == file_size(s))) ok = copy_file_v(s, d);
        if (ok && (!sha256_file(d, hx) || strcmp(hx, dg + 7))) { snprintf(J.errore, sizeof J.errore, "una parte del modello è rovinata (impronta diversa)"); ok = 0; }
        free(wbn); free(s); free(d);
    }
    if (!ok && !J.errore[0]) snprintf(J.errore, sizeof J.errore, "copia del modello non riuscita (spazio sulla chiavetta?)");
    json_free(m);
out:
    free(wrel); free(msrc); free(mdst);
    return ok;
}

static void kit_add(buf_t *k, const char *tipo, const wchar_t *kitdir, const wchar_t *file, const char *extra_json) {
    char hx[65] = "";
    if (file) sha256_file(file, hx);
    const wchar_t *base = file ? wcsrchr(file, L'\\') : NULL;
    char *b8 = u16to8(base ? base + 1 : L"");
    if (k->n > 2) buf_adds(k, ",\n  ");
    buf_adds(k, "{\"tipo\": "); json_str(k, tipo);
    if (file) {
        /* percorso relativo alla cartella del kit */
        size_t kl = wcslen(kitdir);
        char *rel = u16to8(file + kl + 1);
        buf_adds(k, ", \"file\": "); json_str(k, rel); free(rel);
        buf_adds(k, ", \"sha256\": "); json_str(k, hx);
    }
    if (extra_json) { buf_adds(k, ", "); buf_adds(k, extra_json); }
    buf_adds(k, "}");
    free(b8);
}

static unsigned __stdcall job_kit_prepare(void *arg) {
    (void)arg;
    plan_t p; make_plan(&p);
    int n = (JR.ia ? 1 : 0) + (JR.microfono ? 1 : 0) + (JR.voce ? 1 : 0) + (JR.browser ? 1 : 0) + 1, k = 0, ok = 1;
    job_begin("Preparazione della chiavetta", n);
    wchar_t *kit = path_join(JR.cartella, L"ProfessoreDigitale-kit");
    mkdirs(kit);
    char *k8 = u16to8(kit); jlog("Cartella: %s", k8); free(k8);
    buf_t items; buf_init(&items); buf_adds(&items, "[\n  ");
    const char *motore = JR.motore[0] ? JR.motore : p.motore;
    if (ok && JR.ia) {
        jphase(++k, "Intelligenza artificiale: %s (%s)", JR.modello, motore);
        if (!strcmp(motore, "ollama")) {
            wchar_t *setup = path_join(kit, L"OllamaSetup.exe");
            jv *o = jget(g_cat, "ollama"); char url[1024] = "", sha[65] = "", rn[64];
            if (!github_asset(jstr(o, "github", "ollama/ollama"), "", jstr(o, "asset", "OllamaSetup.exe"), NULL, url, sizeof url, sha, rn, sizeof rn))
                snprintf(url, sizeof url, "%s", jstr(o, "setup_url", "https://ollama.com/download/OllamaSetup.exe"));
            ok = fetch("l'installatore di Ollama", url, sha, setup, 10 * 1024 * 1024, NULL);
            if (ok) kit_add(&items, "ollama-setup", kit, setup, NULL);
            /* il modello si copia dalla cartella di Ollama di questo PC (prima lo si scarica, se manca) */
            if (ok) {
                if (!ai_ollama_alive()) { jphase(0, "Avvio Ollama su questo computer…"); if (!wait_ollama(60)) { snprintf(J.errore, sizeof J.errore, "per preparare un modello Ollama serve Ollama attivo su questo computer (Windows 10/11)"); ok = 0; } }
                if (ok) ok = ollama_pull(JR.modello);
                if (ok) {
                    wchar_t *src = ollama_models_dir(), *dst = path_join(kit, L"ollama-modelli");
                    ok = ollama_copy_model(JR.modello, src, dst);
                    if (ok) { buf_t t; buf_init(&t); buf_adds(&t, "\"nome\": "); json_str(&t, JR.modello); buf_adds(&t, ", \"cartella\": \"ollama-modelli\""); kit_add(&items, "ollama-modello", kit, NULL, t.p); buf_free(&t); }
                    free(src); free(dst);
                }
            }
            free(setup);
        } else if (!strcmp(motore, "compatibile")) {
            ok = do_compat(JR.modello, kit, &p.hw);
            if (ok) {
                jv *eng = jget(g_cat, "compatibile"), *m = find_model("compatibile", JR.modello);
                wchar_t *wa = u8to16(jstr(eng, "asset", "koboldcpp-nocuda.exe")), *exe = path_join(kit, wa);
                wchar_t *wf = u8to16(jstr(m, "file", "")), *md = path_join(kit, L"modelli"), *g = path_join(md, wf);
                kit_add(&items, "motore-compatibile", kit, exe, NULL);
                buf_t t; buf_init(&t); buf_adds(&t, "\"nome\": "); json_str(&t, JR.modello); buf_adds(&t, ", \"titolo\": "); json_str(&t, jstr(m, "titolo", JR.modello));
                kit_add(&items, "modello-gguf", kit, g, t.p); buf_free(&t);
                free(wa); free(exe); free(wf); free(md); free(g);
            }
        } else { snprintf(J.errore, sizeof J.errore, "motore sconosciuto"); ok = 0; }
    }
    wchar_t *tmp = job_tmpdir();
    if (ok && JR.microfono && !J.cancel) {
        jphase(++k, "Microfono (modello Vosk)");
        ok = do_vosk(kit, tmp);
        if (ok) { jv *v = jget(jget(g_cat, "voce"), "vosk"); const char *u = jstr(v, "url", "x/vosk.zip"); const char *nm = strrchr(u, '/'); wchar_t *w = u8to16(nm ? nm + 1 : u), *f = path_join(kit, w); kit_add(&items, "vosk", kit, f, NULL); free(w); free(f); }
    }
    if (ok && JR.voce && !J.cancel) {
        jphase(++k, "Voce naturale (Piper)");
        wchar_t *vd = path_join(kit, L"voce");
        mkdirs(vd);
        ok = do_piper(vd, tmp);
        if (ok) {
            jv *pp = jget(jget(g_cat, "voce"), "piper");
            wchar_t *wa = u8to16(jstr(pp, "asset", "piper_windows_amd64.zip")), *z = path_join(vd, wa);
            kit_add(&items, "piper", kit, z, NULL);
            jv *files = jget(pp, "file");
            for (size_t i = 0; files && files->t == J_ARR && i < files->n; i++) {
                const char *f = files->items[i]->str ? files->items[i]->str : ""; const char *bn = strrchr(f, '/');
                wchar_t *wb = u8to16(bn ? bn + 1 : f), *d = path_join(vd, wb);
                kit_add(&items, "piper-voce", kit, d, NULL); free(wb); free(d);
            }
            free(wa); free(z);
        }
        free(vd);
    }
    if (ok && JR.browser && !J.cancel) {
        jphase(++k, "Browser per Windows XP e Vista (Supermium, 32 bit)");
        wchar_t *bd = path_join(kit, L"browser"); mkdirs(bd);
        ok = do_supermium(bd, tmp, 0, 0);
        if (ok) {
            wchar_t *pat = path_join(bd, L"*.exe"); WIN32_FIND_DATAW fd; HANDLE h = FindFirstFileW(pat, &fd); free(pat);
            if (h != INVALID_HANDLE_VALUE) { wchar_t *f = path_join(bd, fd.cFileName); kit_add(&items, "browser", kit, f, NULL); free(f); FindClose(h); }
        }
        free(bd);
    }
    rmtree(tmp); free(tmp);
    if (ok && !J.cancel) {
        jphase(++k, "Aggiungo l'installatore del Professore e il vademecum…");
        wchar_t *dl = downloads_dir(), *nm = wcsdup_printf(L"ProfessoreDigitale-Setup-%hs.exe", G.version), *src = path_join(dl, nm), *dst = path_join(JR.cartella, nm);
        if (file_exists(src) && copy_file_v(src, dst)) jlog("✔ Copiato %ls.", nm);
        else jlog("! Copiate a mano sulla chiavetta anche l'installatore del Professore (ProfessoreDigitale-Setup-%s.exe).", G.version);
        wchar_t *vsrc = path_join(G.web_dir, L"docs\\Vademecum_Professore_Digitale_Windows.pdf"), *vdst = path_join(JR.cartella, L"Vademecum_Professore_Digitale_Windows.pdf");
        if (file_exists(vsrc)) copy_file_v(vsrc, vdst);
        free(dl); free(nm); free(src); free(dst); free(vsrc); free(vdst);
        buf_adds(&items, "\n ]");
        buf_t man; buf_init(&man);
        SYSTEMTIME st; GetLocalTime(&st);
        buf_addf(&man, "{\n \"formato\": \"professore-digitale-kit\",\n \"formato_versione\": 1,\n \"creato\": \"%04d-%02d-%02d\",\n \"app\": ", st.wYear, st.wMonth, st.wDay);
        json_str(&man, G.version);
        buf_adds(&man, ",\n \"motore\": "); json_str(&man, JR.ia ? motore : "");
        buf_adds(&man, ",\n \"elementi\": "); buf_add(&man, items.p, items.n); buf_adds(&man, "\n}\n");
        wchar_t *mp = path_join(kit, L"kit.json");
        ok = file_write_atomic(mp, man.p, man.n);
        wchar_t *lp = path_join(kit, L"LEGGIMI.txt");
        const char *leggimi =
            "\xEF\xBB\xBFPROFESSORE DIGITALE - CHIAVETTA PER I COMPUTER SENZA INTERNET\r\n\r\n"
            "1. Sul computer senza rete installate il Professore Digitale (ProfessoreDigitale-Setup-...exe).\r\n"
            "2. Aprite il Professore, andate in \"Configura IA e voce\" e premete \"Installa dalla chiavetta\".\r\n"
            "3. Scegliete questa cartella (ProfessoreDigitale-kit). Ogni file viene verificato con la sua impronta SHA-256.\r\n\r\n"
            "Il contenuto è descritto in kit.json. Non modificate i file: la verifica li rifiuterebbe.\r\n";
        file_write_atomic(lp, leggimi, strlen(leggimi));
        free(mp); free(lp); buf_free(&man);
    }
    buf_free(&items); free(kit);
    job_end(ok);
    return 0;
}

static int verify_kit_file(const wchar_t *kit, jv *el, wchar_t **out) {
    const char *f = jstr(el, "file", ""), *sha = jstr(el, "sha256", "");
    char safe[600]; snprintf(safe, sizeof safe, "%s", f);
    if (strstr(safe, "..") || strchr(safe, ':') || safe[0] == '\\' || safe[0] == '/') { snprintf(J.errore, sizeof J.errore, "percorso non valido nel kit"); return 0; }
    for (char *c = safe; *c; c++) if (*c == '/') *c = '\\';
    wchar_t *w = u8to16(safe), *p = path_join(kit, w); free(w);
    char hx[65];
    jphase(0, "Verifico %s…", safe);
    if (!file_exists(p) || !sha256_file(p, hx) || strcmp(hx, sha)) { snprintf(J.errore, sizeof J.errore, "%s: file mancante o rovinato (impronta SHA-256 diversa)", safe); free(p); return 0; }
    *out = p;
    return 1;
}

static unsigned __stdcall job_kit_install(void *arg) {
    (void)arg;
    plan_t p; make_plan(&p);
    job_begin("Installazione dalla chiavetta", 1);
    wchar_t kit[MAX_PATH]; wcsncpy(kit, JR.cartella, MAX_PATH - 1); kit[MAX_PATH - 1] = 0;
    wchar_t *mp = path_join(kit, L"kit.json");
    if (!file_exists(mp)) { free(mp); wchar_t *k2 = path_join(kit, L"ProfessoreDigitale-kit"); wcsncpy(kit, k2, MAX_PATH - 1); free(k2); mp = path_join(kit, L"kit.json"); }
    jv *man = load_json_file(mp);
    free(mp);
    int ok = 1;
    if (!man || strcmp(jstr(man, "formato", ""), "professore-digitale-kit")) { snprintf(J.errore, sizeof J.errore, "in questa cartella non c'è una chiavetta del Professore (manca kit.json)"); ok = 0; }
    jv *els = man ? jget(man, "elementi") : NULL;
    EnterCriticalSection(&G.lock); J.passi = els && els->t == J_ARR ? (int)els->n : 1; LeaveCriticalSection(&G.lock);
    wchar_t *iadir = path_join(G.local_dir, L"ia"), *exe = NULL, *gguf = NULL;
    char gg_name[128] = "", gg_title[160] = "", oll_model[128] = "";
    for (size_t i = 0; ok && els && els->t == J_ARR && i < els->n && !J.cancel; i++) {
        jv *el = els->items[i];
        const char *tipo = jstr(el, "tipo", "");
        jphase((int)i + 1, "Elemento %u di %u: %s", (unsigned)i + 1, (unsigned)els->n, tipo);
        wchar_t *f = NULL;
        if (!strcmp(tipo, "ollama-modello")) {
            if (strcmp(p.motore, "ollama")) { jlog("! Modello Ollama saltato: su questo computer Ollama non è supportato."); continue; }
            wchar_t *wc = u8to16(jstr(el, "cartella", "ollama-modelli")), *src = path_join(kit, wc), *dst = ollama_models_dir();
            snprintf(oll_model, sizeof oll_model, "%s", jstr(el, "nome", ""));
            ok = ollama_copy_model(oll_model, src, dst);
            free(wc); free(src); free(dst);
            continue;
        }
        if (!verify_kit_file(kit, el, &f)) { ok = 0; break; }
        if (!strcmp(tipo, "ollama-setup")) {
            if (strcmp(p.motore, "ollama")) jlog("! Ollama saltato: richiede Windows 10 22H2 o Windows 11.");
            else if (ai_ollama_installed(NULL, 0)) jlog("Ollama è già installato.");
            else ok = install_ollama_setup(f);
        } else if (!strcmp(tipo, "motore-compatibile")) {
            if (!p.hw.is64os) jlog("! Motore compatibile saltato: serve Windows a 64 bit.");
            else { mkdirs(iadir); const wchar_t *b = wcsrchr(f, L'\\'); exe = path_join(iadir, b + 1); ok = copy_file_v(f, exe); }
        } else if (!strcmp(tipo, "modello-gguf")) {
            if (p.hw.is64os) {
                wchar_t *md = path_join(iadir, L"modelli"); mkdirs(md);
                const wchar_t *b = wcsrchr(f, L'\\'); gguf = path_join(md, b + 1); free(md);
                jphase(0, "Copio il modello sul disco…");
                ok = copy_file_v(f, gguf);
                snprintf(gg_name, sizeof gg_name, "%s", jstr(el, "nome", "")); snprintf(gg_title, sizeof gg_title, "%s", jstr(el, "titolo", gg_name));
            }
        } else if (!strcmp(tipo, "vosk")) {
            if (p.stt_ok) ok = install_vosk_zip(f); else jlog("! Microfono saltato: serve Windows a 64 bit.");
        } else if (!strcmp(tipo, "piper")) {
            if (p.piper_ok) { char e[300]; if (!unzip_to(f, G.local_dir, &J.cancel, e, sizeof e)) { snprintf(J.errore, sizeof J.errore, "voce naturale: %s", e); ok = 0; } }
        } else if (!strcmp(tipo, "piper-voce")) {
            if (p.piper_ok) { wchar_t *vd = path_join(G.models_dir, L"piper"); mkdirs(vd); const wchar_t *b = wcsrchr(f, L'\\'); wchar_t *d = path_join(vd, b + 1); ok = copy_file_v(f, d); free(d); free(vd); }
        } else if (!strcmp(tipo, "browser")) {
            if (p.browser_xp) { jlog("Avvio l'installazione del browser Supermium: seguite le finestre."); ShellExecuteW(NULL, L"open", f, NULL, NULL, SW_SHOWNORMAL); }
            else jlog("Browser Supermium non necessario su questo computer.");
        }
        free(f);
    }
    if (ok && exe && gguf) {
        write_ia_conf("compatibile", gg_name, gg_title, exe, gguf, compat_args(&p.hw));
        jphase(0, "Avvio il motore compatibile…");
        buf_t s; buf_init(&s); ai_status_json(&s); buf_free(&s);
        if (wait_compat(240)) jlog("✔ Motore compatibile attivo."); else jlog("! Il motore si avvierà con il Professore.");
        snprintf(J.esito_modello, sizeof J.esito_modello, "%s", gg_title); snprintf(J.esito_motore, sizeof J.esito_motore, "compatibile");
    }
    if (ok && oll_model[0]) {
        write_ia_conf("ollama", oll_model, oll_model, NULL, NULL, "");
        if (wait_ollama(60)) jlog("✔ Ollama attivo con il modello %s.", oll_model);
        snprintf(J.esito_modello, sizeof J.esito_modello, "%s", oll_model); snprintf(J.esito_motore, sizeof J.esito_motore, "ollama");
    }
    if (ok) { tts_invalidate(); char se[32], sd[512]; stt_status(se, sizeof se, sd, sizeof sd, 1); }
    free(iadir); free(exe); free(gguf);
    json_free(man);
    job_end(ok);
    return 0;
}

/* ================================================================== scelta della cartella (finestra di Windows) */
typedef struct { wchar_t title[200]; wchar_t out[MAX_PATH]; int ok; } dlg_arg;
static unsigned __stdcall dlg_thread(void *p) {
    dlg_arg *a = (dlg_arg *)p;
    CoInitializeEx(NULL, COINIT_APARTMENTTHREADED);
    HWND owner = CreateWindowExW(WS_EX_TOPMOST | WS_EX_TOOLWINDOW, L"STATIC", L"", WS_POPUP, 0, 0, 0, 0, NULL, NULL, NULL, NULL);
    if (owner) { ShowWindow(owner, SW_SHOWNA); SetForegroundWindow(owner); }
    BROWSEINFOW bi; memset(&bi, 0, sizeof bi);
    bi.hwndOwner = owner; bi.lpszTitle = a->title;
    bi.ulFlags = BIF_RETURNONLYFSDIRS | 0x0040 /* BIF_NEWDIALOGSTYLE */ | 0x0010 /* BIF_EDITBOX */;
    LPITEMIDLIST il = SHBrowseForFolderW(&bi);
    if (il) { a->ok = SHGetPathFromIDListW(il, a->out) != 0; CoTaskMemFree(il); }
    if (owner) DestroyWindow(owner);
    CoUninitialize();
    return 0;
}
static int choose_folder(const wchar_t *title, wchar_t *out) {
    dlg_arg a; memset(&a, 0, sizeof a);
    wcsncpy(a.title, title, 199);
    HANDLE t = (HANDLE)_beginthreadex(NULL, 0, dlg_thread, &a, 0, NULL);
    if (!t) return 0;
    WaitForSingleObject(t, INFINITE); CloseHandle(t);
    if (a.ok) { wcsncpy(out, a.out, MAX_PATH - 1); out[MAX_PATH - 1] = 0; }
    return a.ok;
}

/* ================================================================== API /api/setup/... */
static void info_json(buf_t *b) {
    plan_t p; make_plan(&p);
    buf_adds(b, "{\"ok\": true, \"hardware\": "); hw_json(b, &p.hw);
    buf_adds(b, ", \"piano\": {\"motore\": "); json_str(b, p.motore);
    buf_adds(b, ", \"motivo\": "); json_str(b, p.motivo);
    buf_adds(b, ", \"modello\": "); json_str(b, p.modello);
    buf_addf(b, ", \"microfono_possibile\": %s, \"voce_naturale_possibile\": %s, \"browser_xp\": %s",
             p.stt_ok ? "true" : "false", p.piper_ok ? "true" : "false", p.browser_xp ? "true" : "false");
    buf_adds(b, ", \"modelli\": [");
    EnterCriticalSection(&G.lock);
    jv *list = strcmp(p.motore, "nessuno") ? engine_list(p.motore) : NULL;
    for (size_t i = 0; list && i < list->n; i++) {
        jv *m = list->items[i]; int slow = 0;
        int fits = model_fits(m, &p.hw, &slow);
        if (i) buf_adds(b, ", ");
        buf_adds(b, "{\"nome\": "); json_str(b, jstr(m, "nome", ""));
        buf_adds(b, ", \"titolo\": "); json_str(b, jstr(m, "titolo", ""));
        buf_adds(b, ", \"descrizione\": "); json_str(b, jstr(m, "descrizione", ""));
        buf_addf(b, ", \"gb\": %.1f, \"ram_mb\": %d, \"adatto\": %s, \"lento\": %s, \"consigliato\": %s}", jnum(m, "gb", 0), (int)jnum(m, "ram_mb", 0),
                 fits ? "true" : "false", slow ? "true" : "false", !strcmp(jstr(m, "nome", ""), p.modello) ? "true" : "false");
    }
    buf_adds(b, "]}");
    buf_adds(b, ", \"catalogo\": "); json_str(b, g_cat_ver);
    /* elenco completo per motore: serve a preparare la chiavetta per PC diversi da questo */
    buf_adds(b, ", \"modelli_per_motore\": {");
    const char *mot[2] = { "ollama", "compatibile" };
    for (int k = 0; k < 2; k++) {
        jv *l2 = engine_list(mot[k]);
        buf_addf(b, "%s\"%s\": [", k ? ", " : "", mot[k]);
        for (size_t i = 0; l2 && i < l2->n; i++) {
            if (i) buf_adds(b, ", ");
            buf_adds(b, "{\"nome\": "); json_str(b, jstr(l2->items[i], "nome", ""));
            buf_adds(b, ", \"titolo\": "); json_str(b, jstr(l2->items[i], "titolo", ""));
            buf_addf(b, ", \"gb\": %.1f}", jnum(l2->items[i], "gb", 0));
        }
        buf_adds(b, "]");
    }
    buf_adds(b, "}");
    LeaveCriticalSection(&G.lock);
    /* cosa c'e' gia' */
    wchar_t oexe[MAX_PATH];
    int oi = ai_ollama_installed(oexe, MAX_PATH);
    buf_addf(b, ", \"installato\": {\"ollama\": %s, \"ollama_attivo\": %s", oi ? "true" : "false", oi && ai_ollama_alive() ? "true" : "false");
    char se[32] = "", sd[512] = ""; stt_status(se, sizeof se, sd, sizeof sd, 0);
    buf_addf(b, ", \"microfono\": %s", se[0] ? "true" : "false");
    wchar_t pe[MAX_PATH]; _snwprintf(pe, MAX_PATH, L"%ls\\piper\\piper.exe", G.local_dir); pe[MAX_PATH - 1] = 0;
    buf_addf(b, ", \"voce_naturale\": %s, \"voce_windows\": ", file_exists(pe) ? "true" : "false");
    sapi_italian_voices(b);
    wchar_t *ia = path_join(G.local_dir, L"ia.json"); jv *conf = load_json_file(ia); free(ia);
    buf_adds(b, ", \"ia\": ");
    if (conf) { buf_adds(b, "{\"motore\": "); json_str(b, jstr(conf, "motore", "")); buf_adds(b, ", \"modello\": "); json_str(b, jstr(conf, "modello", "")); buf_adds(b, "}"); }
    else buf_adds(b, "null");
    json_free(conf);
    buf_adds(b, "}");
    EnterCriticalSection(&G.lock);
    buf_addf(b, ", \"lavoro_in_corso\": %s}", J.running ? "true" : "false");
    LeaveCriticalSection(&G.lock);
}

static int start_job(req_t *r, unsigned (__stdcall *fn)(void *)) {
    if (InterlockedCompareExchange(&J.running, 1, 0) != 0) { send_error(r, 409, "c'è già una configurazione in corso"); return 0; }
    J.cancel = 0;
    HANDLE t = (HANDLE)_beginthreadex(NULL, 0, fn, NULL, 0, NULL);
    if (!t) { J.running = 0; send_error(r, 500, "impossibile avviare la configurazione"); return 0; }
    CloseHandle(t);
    send_ok(r);
    return 1;
}

static void read_job_req(jv *req, int need_model) {
    memset(&JR, 0, sizeof JR);
    snprintf(JR.modello, sizeof JR.modello, "%s", jstr(req, "modello", ""));
    snprintf(JR.motore, sizeof JR.motore, "%s", jstr(req, "motore", ""));
    JR.ia = JR.modello[0] != 0 && need_model;
    JR.microfono = jbool(req, "microfono", 0);
    JR.voce = jbool(req, "voce_naturale", 0);
    JR.browser = jbool(req, "browser", 0);
    const char *c = jstr(req, "cartella", "");
    if (c && *c) { wchar_t *w = u8to16(c); wcsncpy(JR.cartella, w, MAX_PATH - 1); free(w); }
}

void setup_api(req_t *r, const char *path) {
    int post = !strcmp(r->method, "POST");
    if (!g_cat) catalog_load();
    if (!post && !strcmp(path, "info")) { buf_t b; buf_init(&b); info_json(&b); send_json(r, 200, &b); buf_free(&b); return; }
    if (!post && !strcmp(path, "progress")) { buf_t b; buf_init(&b); job_progress_json(&b); send_json(r, 200, &b); buf_free(&b); return; }
    if (!post) { send_error(r, 404, "API sconosciuta"); return; }
    char err[200] = "";
    jv *req = NULL;
    if (strcmp(r->ctype, "application/json") || !(req = json_parse(r->body ? r->body : "{}", r->body_len ? r->body_len : 2, err, sizeof err))) {
        send_error(r, 400, err[0] ? err : "serve JSON"); return;
    }
    if (!strcmp(path, "cancel")) { InterlockedExchange(&J.cancel, 1); send_ok(r); }
    else if (!strcmp(path, "start")) {
        read_job_req(req, 1);
        if (JR.ia) {
            plan_t p; make_plan(&p);
            const char *mot = JR.motore[0] ? JR.motore : p.motore;
            if (!strcmp(mot, "nessuno") || (strcmp(mot, "ollama") && strcmp(mot, "compatibile"))) { send_error(r, 400, p.motivo); json_free(req); return; }
            EnterCriticalSection(&G.lock); jv *m = find_model(mot, JR.modello); LeaveCriticalSection(&G.lock);
            if (!m && strcmp(mot, "ollama")) { send_error(r, 400, "modello non presente nel catalogo"); json_free(req); return; }
            if (!m) {  /* Ollama: si accettano anche nomi scritti a mano, purche' semplici */
                for (const char *c = JR.modello; *c; c++) if (!(isalnum((unsigned char)*c) || strchr(".:-_/", *c))) { send_error(r, 400, "nome del modello non valido"); json_free(req); return; }
            }
        }
        if (!JR.ia && !JR.microfono && !JR.voce && !JR.browser) send_error(r, 400, "niente da configurare");
        else start_job(r, job_online);
    }
    else if (!strcmp(path, "kit-prepare") || !strcmp(path, "kit-install")) {
        int prep = !strcmp(path, "kit-prepare");
        read_job_req(req, prep);
        if (J.running) { send_error(r, 409, "c'è già una configurazione in corso"); json_free(req); return; }
        if (!JR.cartella[0] && !choose_folder(prep ? L"Scegliete la chiavetta (o la cartella) dove preparare i file per i PC senza Internet"
                                                     : L"Scegliete la cartella ProfessoreDigitale-kit sulla chiavetta", JR.cartella)) {
            send_error(r, 400, "nessuna cartella scelta"); json_free(req); return;
        }
        if (!dir_exists(JR.cartella)) { send_error(r, 400, "cartella non trovata"); json_free(req); return; }
        if (prep && !JR.ia && !JR.microfono && !JR.voce && !JR.browser) { send_error(r, 400, "niente da preparare"); json_free(req); return; }
        start_job(r, prep ? job_kit_prepare : job_kit_install);
    }
    else if (!strcmp(path, "catalog-update")) {
        const char *url = jstr(req, "url", ""), *sha = jstr(req, "sha256", "");
        buf_t b; http_result hr; char hx[65], e[100];
        if (!url_allowed(url) || !re_sha(sha)) send_error(r, 400, "catalogo: indirizzo o impronta non validi");
        else if (!http_get_mem(url, 1u << 20, 30, &b, &hr)) { send_error(r, 502, hr.error); buf_free(&b); }
        else {
            sha256_hex(b.p, b.n, hx);
            jv *c = json_parse(b.p, b.n, e, sizeof e);
            if (strcmp(hx, sha)) send_error(r, 502, "catalogo: impronta SHA-256 diversa, file scartato");
            else if (!c || strcmp(jstr(c, "formato", ""), "professore-digitale-catalogo-ia")) send_error(r, 502, "catalogo non valido");
            else {
                wchar_t *p = path_join(G.local_dir, L"catalogo-ia.json");
                if (file_write_atomic(p, b.p, b.n)) { catalog_load(); buf_t o; buf_init(&o); buf_adds(&o, "{\"ok\": true, \"versione\": "); json_str(&o, g_cat_ver); buf_adds(&o, "}"); send_json(r, 200, &o); buf_free(&o); }
                else send_error(r, 500, "impossibile salvare il catalogo");
                free(p);
            }
            json_free(c); buf_free(&b);
        }
    }
    else if (!strcmp(path, "remove")) {
        const char *cosa = jstr(req, "cosa", "");
        if (J.running) send_error(r, 409, "c'è una configurazione in corso");
        else if (!strcmp(cosa, "ia")) {
            wchar_t *ia = path_join(G.local_dir, L"ia"), *cf = path_join(G.local_dir, L"ia.json");
            ai_shutdown(); Sleep(500);
            rmtree(ia); DeleteFileW(cf); free(ia); free(cf);
            ai_reload_config();
            send_ok(r);
        } else if (!strcmp(cosa, "microfono")) {
            wchar_t *v = path_join(G.models_dir, L"vosk-it"); rmtree(v); free(v);
            char se[32], sd[512]; stt_status(se, sizeof se, sd, sizeof sd, 1);
            send_ok(r);
        } else if (!strcmp(cosa, "voce")) {
            wchar_t *a = path_join(G.local_dir, L"piper"), *b2 = path_join(G.models_dir, L"piper"); rmtree(a); rmtree(b2); free(a); free(b2);
            tts_invalidate();
            send_ok(r);
        } else send_error(r, 400, "componente sconosciuto");
    }
    else send_error(r, 404, "API sconosciuta");
    json_free(req);
}

void setup_plan_json(buf_t *b) { info_json(b); }

int setup_busy(void) { return J.running != 0; }
