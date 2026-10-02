/* Professore Digitale per Windows - intelligenza artificiale locale (facoltativa)
 *  - Windows 10 22H2 / Windows 11: Ollama (http://127.0.0.1:11434)
 *  - Windows 7 / 8 / 8.1 (64 bit): "motore compatibile" KoboldCpp con un modello GGUF (API in stile OpenAI)
 * Se l'IA manca o non risponde, l'interfaccia usa la guida interna: il Professore non si blocca mai.
 * Ideato e sviluppato da Danilo D'Auria - Licenza MIT */
#include "pd.h"

typedef struct {
    char motore[16];          /* "ollama" | "compatibile" | "" */
    char modello[128];        /* nome del modello Ollama o etichetta del GGUF */
    char titolo[160];
    wchar_t exe[MAX_PATH];    /* koboldcpp-nocuda.exe */
    wchar_t gguf[MAX_PATH];
    char argomenti[256];      /* opzioni in piu' per il motore (es. --noavx2) */
    int porta;
} ai_conf;

static ai_conf C;
static HANDLE g_engine = NULL;           /* processo del motore avviato da noi */
static volatile LONG g_starting = 0;

static void conf_path(wchar_t *out) { wchar_t *p = path_join(G.local_dir, L"ia.json"); wcsncpy(out, p, MAX_PATH - 1); out[MAX_PATH - 1] = 0; free(p); }

void ai_reload_config(void) {
    wchar_t p[MAX_PATH]; conf_path(p);
    buf_t b; char e[64];
    EnterCriticalSection(&G.lock);
    memset(&C, 0, sizeof C);
    C.porta = 5001;
    if (file_read(p, &b, 65536)) {
        jv *v = json_parse(b.p, b.n, e, sizeof e);
        if (v) {
            snprintf(C.motore, sizeof C.motore, "%s", jstr(v, "motore", ""));
            snprintf(C.modello, sizeof C.modello, "%s", jstr(v, "modello", ""));
            snprintf(C.titolo, sizeof C.titolo, "%s", jstr(v, "titolo", C.modello));
            snprintf(C.argomenti, sizeof C.argomenti, "%s", jstr(v, "argomenti", ""));
            wchar_t *w = u8to16(jstr(v, "exe", "")); wcsncpy(C.exe, w, MAX_PATH - 1); free(w);
            w = u8to16(jstr(v, "gguf", "")); wcsncpy(C.gguf, w, MAX_PATH - 1); free(w);
            int port = (int)jnum(v, "porta", 5001); if (port > 1024 && port < 65535) C.porta = port;
            json_free(v);
        }
        buf_free(&b);
    }
    LeaveCriticalSection(&G.lock);
}

int ai_ollama_installed(wchar_t *exe, size_t n) {
    wchar_t cand[MAX_PATH];
    wchar_t *la = _wgetenv(L"LOCALAPPDATA");
    if (la) {
        _snwprintf(cand, MAX_PATH, L"%ls\\Programs\\Ollama\\ollama.exe", la); cand[MAX_PATH - 1] = 0;
        if (file_exists(cand)) { if (exe) { wcsncpy(exe, cand, n - 1); exe[n - 1] = 0; } return 1; }
    }
    wchar_t found[MAX_PATH];
    if (SearchPathW(NULL, L"ollama.exe", NULL, MAX_PATH, found, NULL)) { if (exe) { wcsncpy(exe, found, n - 1); exe[n - 1] = 0; } return 1; }
    return 0;
}

/* ------------------------------------------------------------------ disponibilita' */
static int ollama_models(buf_t *names_json, char *first, size_t fn) {
    char url[300]; snprintf(url, sizeof url, "%s/api/tags", G.ollama_host);
    buf_t b; http_result r;
    if (!http_get_mem(url, 4u * 1024u * 1024u, 3, &b, &r)) { buf_free(&b); return 0; }
    char e[64]; jv *v = json_parse(b.p, b.n, e, sizeof e);
    buf_free(&b);
    if (!v) return 0;
    jv *m = jget(v, "models");
    int k = 0;
    if (names_json) buf_adds(names_json, "[");
    for (size_t i = 0; m && m->t == J_ARR && i < m->n; i++) {
        const char *nm = jstr(m->items[i], "name", NULL);
        if (!nm || !*nm) continue;
        if (names_json) { if (k) buf_adds(names_json, ", "); json_str(names_json, nm); }
        if (!k && first) snprintf(first, fn, "%s", nm);
        k++;
    }
    if (names_json) buf_adds(names_json, "]");
    json_free(v);
    return 1;
}
int ai_ollama_alive(void) { return ollama_models(NULL, NULL, 0); }

static int compat_alive(void) {
    char url[96]; snprintf(url, sizeof url, "http://127.0.0.1:%d/v1/models", C.porta);
    buf_t b; http_result r;
    int ok = http_get_mem(url, 1u << 20, 2, &b, &r);
    buf_free(&b);
    return ok;
}

/* ------------------------------------------------------------------ avvio dei motori */
static unsigned __stdcall start_engine_thread(void *arg) {
    (void)arg;
    if (!strcmp(C.motore, "compatibile")) {
        if (!compat_alive() && file_exists(C.exe) && file_exists(C.gguf)) {
            SYSTEM_INFO si; GetSystemInfo(&si);
            int threads = (int)si.dwNumberOfProcessors > 2 ? (int)si.dwNumberOfProcessors - 1 : 1;
            wchar_t *qe = quote_arg(C.exe), *qm = quote_arg(C.gguf), *extra = u8to16(C.argomenti);
            wchar_t *cl = wcsdup_printf(L"%ls --model %ls --port %d --host 127.0.0.1 --contextsize 4096 --threads %d --skiplauncher --quiet %ls",
                                        qe, qm, C.porta, threads, extra);
            wchar_t dir[MAX_PATH]; wcsncpy(dir, C.exe, MAX_PATH - 1); dir[MAX_PATH - 1] = 0;
            wchar_t *sl = wcsrchr(dir, L'\\'); if (sl) *sl = 0;
            pd_log("avvio del motore compatibile: %ls", cl);
            g_engine = start_process(cl, dir, 1, NULL);
            if (!g_engine) pd_log("motore compatibile non avviato (errore %lu)", GetLastError());
            /* se le opzioni per i processori datati non sono riconosciute, si riprova senza */
            else if (C.argomenti[0] && WaitForSingleObject(g_engine, 8000) == WAIT_OBJECT_0) {
                CloseHandle(g_engine);
                wchar_t *cl2 = wcsdup_printf(L"%ls --model %ls --port %d --host 127.0.0.1 --contextsize 4096 --threads %d --skiplauncher --quiet",
                                             qe, qm, C.porta, threads);
                pd_log("il motore si e' chiuso subito: riprovo senza \"%s\"", C.argomenti);
                g_engine = start_process(cl2, dir, 1, NULL);
                free(cl2);
            }
            free(qe); free(qm); free(extra); free(cl);
        }
    } else {
        /* Ollama: di solito parte da solo all'accensione; se e' installato ma fermo, lo avviamo noi */
        wchar_t exe[MAX_PATH];
        if (!ai_ollama_alive() && ai_ollama_installed(exe, MAX_PATH) && !getenv("PD_NO_ENGINE_START")) {
            wchar_t *q = quote_arg(exe), *cl = wcsdup_printf(L"%ls serve", q);
            pd_log("avvio di Ollama: %ls", cl);
            g_engine = start_process(cl, NULL, 1, NULL);
            free(q); free(cl);
        }
    }
    InterlockedExchange(&g_starting, 0);
    return 0;
}
static void ensure_engine(void) {
    if (InterlockedCompareExchange(&g_starting, 1, 0) != 0) return;
    if (g_engine && WaitForSingleObject(g_engine, 0) == WAIT_TIMEOUT) { InterlockedExchange(&g_starting, 0); return; }
    if (g_engine) { CloseHandle(g_engine); g_engine = NULL; }
    HANDLE t = (HANDLE)_beginthreadex(NULL, 0, start_engine_thread, NULL, 0, NULL);
    if (t) CloseHandle(t); else InterlockedExchange(&g_starting, 0);
}

void ai_init(void) { ai_reload_config(); if (C.motore[0] || ai_ollama_installed(NULL, 0)) ensure_engine(); }
void ai_shutdown(void) {
    if (g_engine) { TerminateProcess(g_engine, 0); CloseHandle(g_engine); g_engine = NULL; }
}

int ai_status_json(buf_t *b) {
    buf_t models; buf_init(&models);
    int ok = 0;
    const char *eng = NULL, *title = NULL;
    char host[300];
    if (!strcmp(C.motore, "compatibile")) {
        ok = compat_alive();
        snprintf(host, sizeof host, "http://127.0.0.1:%d", C.porta);
        buf_adds(&models, "["); if (ok) json_str(&models, C.titolo[0] ? C.titolo : "modello locale"); buf_adds(&models, "]");
        eng = "compatibile"; title = "KoboldCpp (motore compatibile)";
        if (!ok) ensure_engine();
    } else {
        ok = ollama_models(&models, NULL, 0);
        if (!ok) { buf_free(&models); buf_adds(&models, "[]"); if (ai_ollama_installed(NULL, 0)) ensure_engine(); }
        snprintf(host, sizeof host, "%s", G.ollama_host);
        eng = ok || ai_ollama_installed(NULL, 0) ? "ollama" : NULL; title = "Ollama";
    }
    buf_addf(b, "\"ai\": {\"available\": %s, \"host\": ", ok ? "true" : "false"); json_str(b, host);
    buf_adds(b, ", \"models\": "); buf_add(b, models.p, models.n);
    buf_adds(b, ", \"recommended\": "); json_str(b, setup_recommended_model());
    buf_adds(b, ", \"engine\": "); if (eng) json_str(b, eng); else buf_adds(b, "null");
    buf_adds(b, ", \"engine_title\": "); json_str(b, eng ? title : "");
    buf_adds(b, "}");
    buf_free(&models);
    return ok;
}

/* ------------------------------------------------------------------ conversazione in streaming */
typedef struct {
    req_t *r;
    http_result *res;
    int compat;
    int started;              /* intestazioni gia' inviate al browser */
    int client_gone;
    buf_t line;               /* riga incompleta */
    buf_t errbody;            /* corpo della risposta di errore */
} chat_ctx;

static void start_stream(chat_ctx *x) {
    const char *h = "HTTP/1.1 200 OK\r\nContent-Type: application/x-ndjson; charset=utf-8\r\nConnection: close\r\n"
                    "X-Content-Type-Options: nosniff\r\nX-Frame-Options: DENY\r\nReferrer-Policy: no-referrer\r\nCache-Control: no-store\r\n\r\n";
    send_raw(x->r, h, strlen(h));
    x->r->sent = 1; x->started = 1;
}

static int emit(chat_ctx *x, const char *text, int done, const char *error) {
    buf_t o; buf_init(&o);
    buf_adds(&o, "{\"t\": "); json_str(&o, text ? text : "");
    if (done) buf_adds(&o, ", \"done\": true");
    if (error) { buf_adds(&o, ", \"error\": "); json_str(&o, error); }
    buf_adds(&o, "}\n");
    int k = send(x->r->s, o.p, (int)o.n, 0);
    buf_free(&o);
    InterlockedExchange(&G.last_seen, (LONG)GetTickCount());
    if (k <= 0) { x->client_gone = 1; return 0; }
    return 1;
}

static int handle_line(chat_ctx *x, char *ln) {
    size_t L = strlen(ln);
    while (L && (ln[L - 1] == '\r' || ln[L - 1] == ' ')) ln[--L] = 0;
    if (!L) return 1;
    char e[64];
    if (x->compat) {
        if (strncmp(ln, "data:", 5)) return 1;
        char *d = ln + 5; while (*d == ' ') d++;
        if (!strcmp(d, "[DONE]")) return emit(x, "", 1, NULL);
        jv *v = json_parse(d, strlen(d), e, sizeof e);
        if (!v) return 1;
        jv *ch = jget(v, "choices");
        const char *t = "";
        int fin = 0;
        if (ch && ch->t == J_ARR && ch->n) {
            jv *delta = jget(ch->items[0], "delta");
            t = jstr(delta, "content", "");
            const char *fr = jstr(ch->items[0], "finish_reason", NULL);
            fin = fr && *fr;
        }
        int ok = (t && *t) ? emit(x, t, 0, NULL) : 1;
        (void)fin;
        json_free(v);
        return ok;
    }
    jv *v = json_parse(ln, L, e, sizeof e);
    if (!v) return 1;
    jv *msg = jget(v, "message");
    const char *t = jstr(msg, "content", "");
    const char *er = jstr(v, "error", NULL);
    int ok = emit(x, t, jbool(v, "done", 0), er);
    json_free(v);
    return ok;
}

static int chat_sink(void *p, const char *data, size_t n) {
    chat_ctx *x = (chat_ctx *)p;
    if (x->res->status != 200) { if (x->errbody.n < 2000) buf_add(&x->errbody, data, n); return 1; }
    if (!x->started) start_stream(x);
    buf_add(&x->line, data, n);
    char *s = x->line.p; char *nl;
    while ((nl = memchr(s, '\n', x->line.n - (size_t)(s - x->line.p))) != NULL) {
        *nl = 0;
        if (!handle_line(x, s)) return 0;
        s = nl + 1;
    }
    size_t rest = x->line.n - (size_t)(s - x->line.p);
    memmove(x->line.p, s, rest); x->line.n = rest; x->line.p[rest] = 0;
    return 1;
}

static void trunc_utf8(char *s, size_t max) {
    size_t L = strlen(s);
    if (L <= max) return;
    while (max > 0 && ((unsigned char)s[max] & 0xC0) == 0x80) max--;
    s[max] = 0;
}

void ai_chat(req_t *r, jv *req) {
    jv *msgs = jget(req, "messages");
    if (!msgs || msgs->t != J_ARR || !msgs->n) { send_error(r, 400, "nessun messaggio"); return; }
    int compat = !strcmp(C.motore, "compatibile");
    char model[160]; snprintf(model, sizeof model, "%s", jstr(req, "model", ""));
    if (!compat && !model[0]) {
        if (!ollama_models(NULL, model, sizeof model) || !model[0]) { send_error(r, 503, "IA locale non disponibile"); return; }
    }
    double temp = jnum(req, "temperature", 0.4);
    int ctx = (int)jnum(req, "num_ctx", 2048);
    if (ctx < 512 || ctx > 32768) ctx = 2048;
    /* messaggi ripuliti (ultimi 24, ruoli consentiti, testi limitati) */
    buf_t mj; buf_init(&mj); buf_adds(&mj, "[");
    size_t start = msgs->n > 24 ? msgs->n - 24 : 0; int k = 0;
    for (size_t i = start; i < msgs->n; i++) {
        jv *m = msgs->items[i];
        const char *role = jstr(m, "role", "");
        if (strcmp(role, "system") && strcmp(role, "user") && strcmp(role, "assistant")) continue;
        char *content = _strdup(jstr(m, "content", ""));
        trunc_utf8(content, 12000 * 3);
        if (k++) buf_adds(&mj, ", ");
        buf_adds(&mj, "{\"role\": "); json_str(&mj, role); buf_adds(&mj, ", \"content\": "); json_str(&mj, content); buf_adds(&mj, "}");
        free(content);
    }
    buf_adds(&mj, "]");

    for (int attempt = 0; attempt < 2; attempt++) {
        buf_t body; buf_init(&body);
        char url[300];
        if (compat) {
            snprintf(url, sizeof url, "http://127.0.0.1:%d/v1/chat/completions", C.porta);
            buf_adds(&body, "{\"model\": "); json_str(&body, C.modello[0] ? C.modello : "koboldcpp");
            buf_adds(&body, ", \"messages\": "); buf_add(&body, mj.p, mj.n);
            buf_addf(&body, ", \"stream\": true, \"temperature\": %.2f, \"max_tokens\": 700}", temp);
        } else {
            snprintf(url, sizeof url, "%s/api/chat", G.ollama_host);
            buf_adds(&body, "{\"model\": "); json_str(&body, model);
            buf_adds(&body, ", \"messages\": "); buf_add(&body, mj.p, mj.n);
            /* i modelli che "ragionano" (es. qwen3.5) rispondono prima e meglio senza ragionamento esteso */
            buf_addf(&body, ", \"stream\": true%s, \"options\": {\"temperature\": %.2f, \"num_ctx\": %d}, \"keep_alive\": \"15m\"}",
                     attempt == 0 ? ", \"think\": false" : "", temp, ctx);
        }
        http_result res;
        chat_ctx x; memset(&x, 0, sizeof x);
        x.r = r; x.res = &res; x.compat = compat;
        buf_init(&x.line); buf_init(&x.errbody);
        int ok = http_request("POST", url, "application/json", body.p, body.n, 600, chat_sink, &x, &res);
        buf_free(&body);
        if (x.started) {
            if (x.line.n && !x.client_gone) { buf_add(&x.line, "", 0); handle_line(&x, x.line.p); }
            if (!ok && !x.client_gone && !x.r->head_only) emit(&x, "", 1, res.error[0] ? res.error : "collegamento interrotto");
            buf_free(&x.line); buf_free(&x.errbody);
            break;
        }
        if (res.status && res.status != 200) {
            int think_problem = !compat && attempt == 0 && x.errbody.p && strstr(x.errbody.p, "think");
            if (think_problem) { buf_free(&x.line); buf_free(&x.errbody); continue; }   /* modello che non accetta "think" */
            char m[400]; snprintf(m, sizeof m, "%s ha risposto %d: %.300s", compat ? "Il motore compatibile" : "Ollama", res.status, x.errbody.p ? x.errbody.p : "");
            send_error(r, 502, m);
        } else if (res.status == 200) {
            start_stream(&x); emit(&x, "", 1, NULL);       /* risposta vuota */
        } else {
            char m[400]; snprintf(m, sizeof m, "IA locale non raggiungibile: %s", res.error);
            send_error(r, 503, m);
            ensure_engine();
        }
        buf_free(&x.line); buf_free(&x.errbody);
        break;
    }
    buf_free(&mj);
}
