/* Professore Digitale per Windows - voce (sintesi) e microfono (riconoscimento), entrambi offline
 *  Sintesi:  voci naturali Piper Riccardo e Paola (64 bit, incluse)  >  voci italiane di Windows (SAPI 5, da XP in poi)
 *  Microfono: Vosk con modello italiano, tramite pd-stt.exe (64 bit, processo separato)
 * Ideato e sviluppato da Danilo D'Auria - Licenza MIT */
#define COBJMACROS
#define INITGUID
#include "pd.h"
#include <objbase.h>
#include <sapi.h>

DEFINE_GUID(PD_SPDFID_WaveFormatEx, 0xC31ADBAE, 0x527F, 0x4ff5, 0xA2, 0x30, 0xF6, 0x2B, 0xB6, 0x1F, 0xF7, 0x0C);
#define PD_VOICES_SAPI    L"HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Speech\\Voices"
#define PD_VOICES_ONECORE L"HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Speech_OneCore\\Voices"
#define MAX_TTS_CHARS 6000

static CRITICAL_SECTION vlock; static LONG vinit = 0;

static void vl(void) { if (InterlockedCompareExchange(&vinit, 1, 0) == 0) InitializeCriticalSection(&vlock); EnterCriticalSection(&vlock); }
static void vu(void) { LeaveCriticalSection(&vlock); }


/* ------------------------------------------------------------------ elenco delle voci
 * Voci naturali Piper (incluse nell'installatore: Paola, donna, e Riccardo, uomo; solo Windows a 64 bit)
 * e tutte le voci italiane di Windows (SAPI 5 e OneCore), maschili e femminili. */
typedef struct { char id[320]; char nome[200]; char genere[2]; int piper; wchar_t rif[MAX_PATH]; } voce_t;
#define MAX_VOCI 32
static voce_t g_voci[MAX_VOCI]; static int g_nvoci = 0; static DWORD g_voci_t = 0;
static wchar_t g_piper_exe[MAX_PATH];

static int is64os(void) {
    SYSTEM_INFO si; GetNativeSystemInfo(&si);
    return si.wProcessorArchitecture == PROCESSOR_ARCHITECTURE_AMD64 || si.wProcessorArchitecture == 12;
}

static void aggiungi_piper(const wchar_t *dir, voce_t *v, int *n) {
    wchar_t pat[MAX_PATH]; _snwprintf(pat, MAX_PATH, L"%ls\\*.onnx", dir); pat[MAX_PATH - 1] = 0;
    WIN32_FIND_DATAW fd; HANDLE h = FindFirstFileW(pat, &fd);
    if (h == INVALID_HANDLE_VALUE) return;
    do {
        wchar_t full[MAX_PATH], js[MAX_PATH];
        _snwprintf(full, MAX_PATH, L"%ls\\%ls", dir, fd.cFileName); full[MAX_PATH - 1] = 0;
        _snwprintf(js, MAX_PATH, L"%ls.json", full); js[MAX_PATH - 1] = 0;
        if (!file_exists(js)) continue;
        char *b8 = u16to8(fd.cFileName); size_t L = strlen(b8); if (L > 5) b8[L - 5] = 0;   /* senza .onnx */
        int k; for (k = 0; k < *n; k++) if (v[k].piper && !strcmp(v[k].id + 6, b8)) break;
        if (k == *n) { if (*n >= MAX_VOCI) { free(b8); break; } (*n)++; }
        voce_t *x = &v[k]; memset(x, 0, sizeof *x);
        x->piper = 1; snprintf(x->id, sizeof x->id, "piper:%s", b8); wcsncpy(x->rif, full, MAX_PATH - 1);
        const char *chi = strchr(b8, '-'); char nome[64] = "";
        if (chi) { const char *f = strchr(chi + 1, '-'); size_t l = f ? (size_t)(f - chi - 1) : strlen(chi + 1); if (l > 60) l = 60; memcpy(nome, chi + 1, l); nome[l] = 0; }
        if (!strcmp(nome, "paola") || !strcmp(nome, "serena")) x->genere[0] = 'f';
        else if (!strcmp(nome, "riccardo")) x->genere[0] = 'm';
        if (nome[0]) nome[0] = (char)toupper((unsigned char)nome[0]);
        snprintf(x->nome, sizeof x->nome, "%s (%s, voce naturale)", nome[0] ? nome : b8, x->genere[0] == 'm' ? "uomo" : x->genere[0] == 'f' ? "donna" : "voce");
        free(b8);
    } while (FindNextFileW(h, &fd));
    FindClose(h);
}

static void aggiungi_sapi(const wchar_t *catid, voce_t *v, int *n) {
    ISpObjectTokenCategory *cat = NULL;
    if (FAILED(CoCreateInstance(&CLSID_SpObjectTokenCategory, NULL, CLSCTX_ALL, &IID_ISpObjectTokenCategory, (void **)&cat)) || !cat) return;
    if (FAILED(ISpObjectTokenCategory_SetId(cat, catid, FALSE))) { ISpObjectTokenCategory_Release(cat); return; }
    const wchar_t *lingue[2] = { L"Language=410", L"Language=810" };   /* italiano (Italia), italiano (Svizzera) */
    for (int l = 0; l < 2; l++) {
        IEnumSpObjectTokens *en = NULL;
        if (FAILED(ISpObjectTokenCategory_EnumTokens(cat, lingue[l], NULL, &en)) || !en) continue;
        ISpObjectToken *tok = NULL; ULONG got = 0;
        while (*n < MAX_VOCI && SUCCEEDED(IEnumSpObjectTokens_Next(en, 1, &tok, &got)) && got == 1 && tok) {
            WCHAR *id = NULL, *nm = NULL, *gen = NULL; ISpDataKey *attr = NULL;
            ISpObjectToken_GetId(tok, &id);
            ISpObjectToken_GetStringValue(tok, NULL, &nm);
            if (SUCCEEDED(ISpObjectToken_OpenKey(tok, L"Attributes", &attr)) && attr) { ISpDataKey_GetStringValue(attr, L"Gender", &gen); ISpDataKey_Release(attr); }
            if (id && nm) {
                char *n8 = u16to8(nm), *i8 = u16to8(id);
                int dup = 0; for (int k = 0; k < *n; k++) if (!v[k].piper && !strcmp(v[k].nome, n8)) dup = 1;   /* stessa voce in SAPI e OneCore */
                if (!dup) {
                    voce_t *x = &v[(*n)++]; memset(x, 0, sizeof *x);
                    snprintf(x->id, sizeof x->id, "sapi:%s", i8); snprintf(x->nome, sizeof x->nome, "%s", n8);
                    wcsncpy(x->rif, catid, MAX_PATH - 1);
                    if (gen && !_wcsicmp(gen, L"Male")) x->genere[0] = 'm'; else if (gen && !_wcsicmp(gen, L"Female")) x->genere[0] = 'f';
                }
                free(n8); free(i8);
            }
            if (id) CoTaskMemFree(id);
            if (nm) CoTaskMemFree(nm);
            if (gen) CoTaskMemFree(gen);
            ISpObjectToken_Release(tok); tok = NULL;
        }
        IEnumSpObjectTokens_Release(en);
    }
    ISpObjectTokenCategory_Release(cat);
}

static void scan_voci(int force) {
    vl();
    if (!force && g_voci_t && GetTickCount() - g_voci_t < 300000) { vu(); return; }
    vu();
    voce_t v[MAX_VOCI]; int n = 0; wchar_t exe[MAX_PATH] = L"";
    if (is64os()) {
        wchar_t cand[2][MAX_PATH];
        _snwprintf(cand[0], MAX_PATH, L"%ls\\piper\\piper.exe", G.local_dir); cand[0][MAX_PATH - 1] = 0;
        _snwprintf(cand[1], MAX_PATH, L"%ls\\piper\\piper.exe", G.install_dir); cand[1][MAX_PATH - 1] = 0;
        for (int i = 0; i < 2 && !exe[0]; i++) {
            if (!file_exists(cand[i])) continue;
            wchar_t *q = quote_arg(cand[i]), *cl = wcsdup_printf(L"%ls --version", q);
            wchar_t dir[MAX_PATH]; wcsncpy(dir, cand[i], MAX_PATH - 1); dir[MAX_PATH - 1] = 0; wchar_t *sl = wcsrchr(dir, L'\\'); if (sl) *sl = 0;
            DWORD code = 1; buf_t out;
            if (run_process(cl, dir, "", 0, &out, 20000, &code, 1) && code == 0) wcsncpy(exe, cand[i], MAX_PATH - 1);
            else pd_log("Piper non avviabile su questo computer");
            buf_free(&out); free(q); free(cl);
        }
        if (exe[0]) {
            wchar_t *inc = path_join(G.install_dir, L"voci"), *usr = path_join(G.models_dir, L"piper");
            aggiungi_piper(inc, v, &n); aggiungi_piper(usr, v, &n);
            free(inc); free(usr);
        }
    }
    /* in cima Riccardo (il Professore e' un uomo), poi Paola, poi le altre voci naturali */
    for (int i = 0; i < n; i++) for (int j = i + 1; j < n; j++) {
        int ri = strstr(v[i].id, "riccardo") ? 0 : strstr(v[i].id, "paola") ? 1 : 2, rj = strstr(v[j].id, "riccardo") ? 0 : strstr(v[j].id, "paola") ? 1 : 2;
        if (rj < ri) { voce_t t = v[i]; v[i] = v[j]; v[j] = t; }
    }
    HRESULT ci = CoInitializeEx(NULL, COINIT_MULTITHREADED);
    aggiungi_sapi(PD_VOICES_SAPI, v, &n);
    aggiungi_sapi(PD_VOICES_ONECORE, v, &n);
    if (SUCCEEDED(ci)) CoUninitialize();
    vl();
    memcpy(g_voci, v, sizeof v); g_nvoci = n; wcsncpy(g_piper_exe, exe, MAX_PATH - 1); g_piper_exe[MAX_PATH - 1] = 0;
    g_voci_t = GetTickCount(); if (!g_voci_t) g_voci_t = 1;
    vu();
}

void tts_invalidate(void) { vl(); g_voci_t = 0; vu(); }
static unsigned __stdcall preriscalda(void *a) { (void)a; scan_voci(1); return 0; }
void tts_init(void) { HANDLE t = (HANDLE)_beginthreadex(NULL, 0, preriscalda, NULL, 0, NULL); if (t) CloseHandle(t); }

static int conta(int piper) { scan_voci(0); vl(); int k = 0; for (int i = 0; i < g_nvoci; i++) if (g_voci[i].piper == piper) k++; vu(); return k; }
static int sapi_available(void) { return conta(0) > 0; }
int tts_has_piper(void) { return conta(1) > 0; }

int sapi_italian_voices(buf_t *out) {
    scan_voci(0);
    vl();
    int ok = 0;
    for (int i = 0; i < g_nvoci; i++) if (!g_voci[i].piper) { json_str(out, g_voci[i].nome); ok = 1; break; }
    if (!ok) buf_adds(out, "null");
    vu();
    return ok;
}

void tts_voices_json(buf_t *b) {
    scan_voci(0);
    vl();
    buf_adds(b, "[");
    for (int i = 0; i < g_nvoci; i++) {
        voce_t *x = &g_voci[i];
        if (i) buf_adds(b, ", ");
        buf_adds(b, "{\"id\": "); json_str(b, x->id); buf_adds(b, ", \"nome\": "); json_str(b, x->nome);
        buf_adds(b, ", \"genere\": "); json_str(b, x->genere); buf_addf(b, ", \"motore\": \"%s\", \"naturale\": %s}", x->piper ? "piper" : "sapi", x->piper ? "true" : "false");
    }
    buf_adds(b, "]");
    vu();
}

static int sapi_speak(const wchar_t *text, double rate, const wchar_t *wavpath, const char *token_id8, char *err, size_t errn) {
    HRESULT ci = CoInitializeEx(NULL, COINIT_MULTITHREADED);
    ISpVoice *v = NULL; ISpStream *st = NULL; ISpObjectToken *tok = NULL;
    int ok = 0;
    wchar_t *tid = u8to16(token_id8);
    if (FAILED(CoCreateInstance(&CLSID_SpVoice, NULL, CLSCTX_ALL, &IID_ISpVoice, (void **)&v)) || !v) { snprintf(err, errn, "voce di Windows non disponibile"); goto out; }
    if (FAILED(CoCreateInstance(&CLSID_SpObjectToken, NULL, CLSCTX_ALL, &IID_ISpObjectToken, (void **)&tok)) || !tok ||
        FAILED(ISpObjectToken_SetId(tok, NULL, tid, FALSE))) { snprintf(err, errn, "voce italiana di Windows non trovata"); goto out; }
    ISpVoice_SetVoice(v, tok);
    long r = (long)((rate - 1.0) * 12.0 + (rate >= 1.0 ? 0.5 : -0.5));
    if (r < -10) r = -10;
    if (r > 10) r = 10;
    ISpVoice_SetRate(v, r);
    if (FAILED(CoCreateInstance(&CLSID_SpStream, NULL, CLSCTX_ALL, &IID_ISpStream, (void **)&st)) || !st) { snprintf(err, errn, "flusso audio non disponibile"); goto out; }
    WAVEFORMATEX wf; memset(&wf, 0, sizeof wf);
    wf.wFormatTag = WAVE_FORMAT_PCM; wf.nChannels = 1; wf.nSamplesPerSec = 22050; wf.wBitsPerSample = 16;
    wf.nBlockAlign = 2; wf.nAvgBytesPerSec = 44100;
    if (FAILED(ISpStream_BindToFile(st, wavpath, SPFM_CREATE_ALWAYS, &PD_SPDFID_WaveFormatEx, &wf, 0))) { snprintf(err, errn, "impossibile creare il file audio"); goto out; }
    ISpVoice_SetOutput(v, (IUnknown *)st, TRUE);
    HRESULT hr = ISpVoice_Speak(v, text, SPF_IS_NOT_XML, NULL);
    ISpStream_Close(st);
    if (FAILED(hr)) { snprintf(err, errn, "la voce di Windows non ha parlato (errore 0x%08lx)", (unsigned long)hr); goto out; }
    ok = 1;
out:
    if (tok) ISpObjectToken_Release(tok);
    if (st) ISpStream_Release(st);
    if (v) ISpVoice_Release(v);
    if (SUCCEEDED(ci)) CoUninitialize();
    free(tid);
    return ok;
}

/* ------------------------------------------------------------------ elenco motori */
int tts_engine_count(void) { return (tts_has_piper() ? 1 : 0) + (sapi_available() ? 1 : 0); }
void tts_engines_json(buf_t *b) {
    int k = 0;
    buf_adds(b, "[");
    if (tts_has_piper()) { buf_adds(b, "\"piper\""); k++; }
    if (sapi_available()) { if (k) buf_adds(b, ", "); buf_adds(b, "\"sapi\""); }
    buf_adds(b, "]");
}
/* ------------------------------------------------------------------ pulizia del testo */
static wchar_t *clean_for_speech(const char *text8) {
    wchar_t *t = u8to16(text8);
    size_t n = wcslen(t);
    wchar_t *o = (wchar_t *)calloc(n * 2 + 32, sizeof(wchar_t));
    size_t k = 0;
    for (size_t i = 0; i < n;) {
        if (!wcsncmp(t + i, L"```", 3)) { const wchar_t *e = wcsstr(t + i + 3, L"```"); i = e ? (size_t)(e - t) + 3 : n; o[k++] = L' '; continue; }
        if (!wcsncmp(t + i, L"[DIAGRAMMA]", 11)) { const wchar_t *e = wcsstr(t + i, L"[/DIAGRAMMA]"); i = e ? (size_t)(e - t) + 12 : n; o[k++] = L' '; continue; }
        if (!wcsncmp(t + i, L"http://", 7) || !wcsncmp(t + i, L"https://", 8)) {
            while (i < n && !iswspace(t[i])) i++;
            const wchar_t *rep = L" indirizzo web "; while (*rep) o[k++] = *rep++;
            continue;
        }
        wchar_t c = t[i];
        if (c >= 0xD800 && c <= 0xDFFF) { i++; o[k++] = L' '; continue; }          /* emoji e simboli fuori dal piano base */
        if ((c >= 0x2600 && c <= 0x27BF) || c == 0xFE0F || c == 0x200D) { i++; o[k++] = L' '; continue; }
        if (wcschr(L"*_#`>|~", c)) { i++; o[k++] = L' '; continue; }
        o[k++] = c; i++;
    }
    o[k] = 0;
    /* spazi multipli */
    size_t w = 0; int sp = 1;
    for (size_t i = 0; i < k; i++) {
        if (iswspace(o[i])) { if (!sp) o[w++] = L' '; sp = 1; }
        else { o[w++] = o[i]; sp = 0; }
    }
    while (w && o[w - 1] == L' ') w--;
    o[w] = 0;
    if (w > MAX_TTS_CHARS) o[MAX_TTS_CHARS] = 0;
    free(t);
    return o;
}

int tts_synthesize(const char *text, double rate, const char *engine, const char *voice, buf_t *wav, char *used, size_t usedn, char *err, size_t errn) {
    wchar_t *clean = clean_for_speech(text);
    if (!clean[0]) { free(clean); snprintf(err, errn, "testo vuoto"); return 0; }
    if (rate < 0.5) rate = 0.5;
    if (rate > 1.6) rate = 1.6;
    scan_voci(0);
    voce_t v[MAX_VOCI]; int n; wchar_t pe[MAX_PATH];
    vl(); memcpy(v, g_voci, sizeof v); n = g_nvoci; wcsncpy(pe, g_piper_exe, MAX_PATH); vu();
    if (!n) {
        free(clean);
        snprintf(err, errn, "nessuna voce italiana installata (Impostazioni di Windows -> Ora e lingua -> Voce, oppure le voci naturali dall'installatore)");
        return 0;
    }
    /* ordine: la voce scelta; altrimenti (compatibilita') il motore chiesto; poi le predefinite */
    int ord[MAX_VOCI], no = 0;
    for (int i = 0; i < n && voice && *voice; i++) if (!strcmp(v[i].id, voice)) ord[no++] = i;
    if (!no && engine && !strcmp(engine, "sapi")) for (int i = 0; i < n && !no; i++) if (!v[i].piper) ord[no++] = i;
    for (int i = 0; i < n; i++) { int dup = 0; for (int k = 0; k < no; k++) if (ord[k] == i) dup = 1; if (!dup) ord[no++] = i; }
    wchar_t tmpdir[MAX_PATH], tmpf[MAX_PATH];
    GetTempPathW(MAX_PATH, tmpdir);
    GetTempFileNameW(tmpdir, L"pdv", 0, tmpf);
    int ok = 0;
    for (int t = 0; t < no && t < 3 && !ok; t++) {
        voce_t *x = &v[ord[t]];
        if (x->piper) {
            char *t8 = u16to8(clean);
            wchar_t *qe = quote_arg(pe), *qm = quote_arg(x->rif), *qo = quote_arg(tmpf);
            wchar_t *cl = wcsdup_printf(L"%ls --model %ls --output_file %ls --length_scale %.2f", qe, qm, qo, 1.0 / rate);
            wchar_t dir[MAX_PATH]; wcsncpy(dir, pe, MAX_PATH - 1); dir[MAX_PATH - 1] = 0; wchar_t *sl = wcsrchr(dir, L'\\'); if (sl) *sl = 0;
            DWORD code = 1;
            if (run_process(cl, dir, t8, strlen(t8), NULL, 120000, &code, 1) && code == 0 && file_size(tmpf) > 44) ok = 1;
            else pd_log("piper non riuscito (codice %lu)", (unsigned long)code);
            free(t8); free(qe); free(qm); free(qo); free(cl);
        } else {
            char e2[200] = "";
            if (sapi_speak(clean, rate, tmpf, x->id + 5, e2, sizeof e2) && file_size(tmpf) > 44) ok = 1;
            else { snprintf(err, errn, "%s", e2[0] ? e2 : "sintesi vocale non riuscita"); pd_log("SAPI: %s", err); }
        }
        if (ok) snprintf(used, usedn, "%s", x->piper ? "piper" : "sapi");
    }
    if (ok) ok = file_read(tmpf, wav, 64u * 1024u * 1024u);
    if (!ok && !err[0]) snprintf(err, errn, "sintesi vocale non riuscita");
    DeleteFileW(tmpf);
    free(clean);
    return ok;
}

/* ------------------------------------------------------------------ microfono (Vosk) */
static DWORD stt_t = 0; static char stt_eng[32] = "", stt_det[512] = "";

static int stt_paths(wchar_t *exe, wchar_t *model) {
    _snwprintf(exe, MAX_PATH, L"%ls\\stt\\pd-stt.exe", G.install_dir); exe[MAX_PATH - 1] = 0;
    _snwprintf(model, MAX_PATH, L"%ls\\vosk-it", G.models_dir); model[MAX_PATH - 1] = 0;
    if (!file_exists(exe)) return 0;
    wchar_t am[MAX_PATH], conf[MAX_PATH];
    _snwprintf(am, MAX_PATH, L"%ls\\am", model); am[MAX_PATH - 1] = 0;
    _snwprintf(conf, MAX_PATH, L"%ls\\conf", model); conf[MAX_PATH - 1] = 0;
    return dir_exists(am) || dir_exists(conf);
}

void stt_status(char *engine, size_t en, char *detail, size_t dn, int force) {
    vl();
    if (!force && stt_t && GetTickCount() - stt_t < 60000) {
        snprintf(engine, en, "%s", stt_eng); snprintf(detail, dn, "%s", stt_det); vu(); return;
    }
    vu();
    wchar_t exe[MAX_PATH], model[MAX_PATH];
    char e[32] = "", d[512] = "";
    pd_hw dummy; (void)dummy;
    SYSTEM_INFO si; GetNativeSystemInfo(&si);
    int is64 = si.wProcessorArchitecture == PROCESSOR_ARCHITECTURE_AMD64 || si.wProcessorArchitecture == 12;
    if (is64 && stt_paths(exe, model)) {
        if (force) {
            /* prova reale: carica il motore e il modello */
            wchar_t *qe = quote_arg(exe), *qm = quote_arg(G.models_dir);
            wchar_t *cl = wcsdup_printf(L"%ls --probe --models %ls", qe, qm);
            buf_t out; DWORD code = 1;
            if (run_process(cl, NULL, "", 0, &out, 60000, &code, 1) && out.p && strstr(out.p, "\"vosk\"")) snprintf(e, sizeof e, "vosk");
            else pd_log("prova del microfono non riuscita: %s", out.p ? out.p : "(nessuna risposta)");
            buf_free(&out); free(qe); free(qm); free(cl);
        } else snprintf(e, sizeof e, "vosk");
        if (e[0]) { char *m8 = u16to8(model); snprintf(d, sizeof d, "%s", m8); free(m8); }
    }
    vl();
    snprintf(stt_eng, sizeof stt_eng, "%s", e); snprintf(stt_det, sizeof stt_det, "%s", d);
    stt_t = GetTickCount(); if (!stt_t) stt_t = 1;
    vu();
    snprintf(engine, en, "%s", e); snprintf(detail, dn, "%s", d);
}

int stt_transcribe(const char *wav, size_t n, buf_t *text_json, char *err, size_t errn) {
    char eng[32], det[512];
    stt_status(eng, sizeof eng, det, sizeof det, 0);
    if (!eng[0]) { snprintf(err, errn, "riconoscimento vocale non installato"); return 0; }
    wchar_t exe[MAX_PATH], model[MAX_PATH];
    stt_paths(exe, model);
    wchar_t tmpdir[MAX_PATH], tmpf[MAX_PATH];
    GetTempPathW(MAX_PATH, tmpdir);
    GetTempFileNameW(tmpdir, L"pds", 0, tmpf);
    int ok = 0;
    if (file_write_atomic(tmpf, wav, n)) {
        wchar_t *qe = quote_arg(exe), *qm = quote_arg(G.models_dir), *qf = quote_arg(tmpf);
        wchar_t *cl = wcsdup_printf(L"%ls --models %ls %ls", qe, qm, qf);
        buf_t out; DWORD code = 1;
        if (run_process(cl, NULL, "", 0, &out, 300000, &code, 1) && out.p) {
            char e[64]; jv *v = json_parse(out.p, out.n, e, sizeof e);
            if (v && jget(v, "text")) { json_str(text_json, jstr(v, "text", "")); ok = 1; }
            else snprintf(err, errn, "riconoscimento vocale non riuscito: %s", v ? jstr(v, "error", "errore") : "nessuna risposta");
            json_free(v);
        } else snprintf(err, errn, "riconoscimento vocale non riuscito");
        if (!ok) { vl(); stt_t = 0; vu(); }
        buf_free(&out); free(qe); free(qm); free(qf); free(cl);
    } else snprintf(err, errn, "impossibile salvare l'audio");
    DeleteFileW(tmpf);
    return ok;
}
