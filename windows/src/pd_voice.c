/* Professore Digitale per Windows - voce (sintesi) e microfono (riconoscimento), entrambi offline
 *  Sintesi:  Piper "Paola" (64 bit, facoltativa)  >  voce italiana di Windows (SAPI 5, da XP in poi)
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
static DWORD sapi_checked = 0; static int sapi_ok = 0;
static wchar_t sapi_cat[160];                 /* categoria in cui si trova la voce italiana */
static wchar_t sapi_name[160];

static void vl(void) { if (InterlockedCompareExchange(&vinit, 1, 0) == 0) InitializeCriticalSection(&vlock); EnterCriticalSection(&vlock); }
static void vu(void) { LeaveCriticalSection(&vlock); }

void tts_invalidate(void) { vl(); sapi_checked = 0; vu(); }

/* ------------------------------------------------------------------ Piper */
static int piper_paths(wchar_t *exe, wchar_t *model) {
    _snwprintf(exe, MAX_PATH, L"%ls\\piper\\piper.exe", G.local_dir); exe[MAX_PATH - 1] = 0;
    if (!file_exists(exe)) return 0;
    wchar_t pat[MAX_PATH]; _snwprintf(pat, MAX_PATH, L"%ls\\piper\\*.onnx", G.models_dir); pat[MAX_PATH - 1] = 0;
    WIN32_FIND_DATAW fd; HANDLE h = FindFirstFileW(pat, &fd);
    if (h == INVALID_HANDLE_VALUE) return 0;
    _snwprintf(model, MAX_PATH, L"%ls\\piper\\%ls", G.models_dir, fd.cFileName); model[MAX_PATH - 1] = 0;
    FindClose(h);
    return 1;
}

/* ------------------------------------------------------------------ SAPI */
static int find_italian(ISpObjectTokenCategory **pcat, ISpObjectToken **ptok, const wchar_t *catid) {
    ISpObjectTokenCategory *cat = NULL; IEnumSpObjectTokens *en = NULL; ISpObjectToken *tok = NULL;
    if (FAILED(CoCreateInstance(&CLSID_SpObjectTokenCategory, NULL, CLSCTX_ALL, &IID_ISpObjectTokenCategory, (void **)&cat)) || !cat) return 0;
    if (FAILED(ISpObjectTokenCategory_SetId(cat, catid, FALSE))) { ISpObjectTokenCategory_Release(cat); return 0; }
    /* 410 = italiano (Italia), 810 = italiano (Svizzera) */
    if (SUCCEEDED(ISpObjectTokenCategory_EnumTokens(cat, L"Language=410", NULL, &en)) && en) {
        ULONG got = 0;
        IEnumSpObjectTokens_Next(en, 1, &tok, &got);
        if (!got) tok = NULL;
        IEnumSpObjectTokens_Release(en); en = NULL;
    }
    if (!tok && SUCCEEDED(ISpObjectTokenCategory_EnumTokens(cat, L"Language=810", NULL, &en)) && en) {
        ULONG got = 0; IEnumSpObjectTokens_Next(en, 1, &tok, &got); if (!got) tok = NULL;
        IEnumSpObjectTokens_Release(en);
    }
    if (!tok) { ISpObjectTokenCategory_Release(cat); return 0; }
    *pcat = cat; *ptok = tok;
    return 1;
}

static int sapi_available(void) {
    vl();
    if (sapi_checked && GetTickCount() - sapi_checked < 300000) { int r = sapi_ok; vu(); return r; }
    vu();
    int ok = 0; wchar_t catid[160] = L"", name[160] = L"";
    HRESULT ci = CoInitializeEx(NULL, COINIT_MULTITHREADED);
    const wchar_t *cats[2] = { PD_VOICES_SAPI, PD_VOICES_ONECORE };
    for (int i = 0; i < 2 && !ok; i++) {
        ISpObjectTokenCategory *cat; ISpObjectToken *tok;
        if (find_italian(&cat, &tok, cats[i])) {
            WCHAR *nm = NULL;
            if (SUCCEEDED(ISpObjectToken_GetStringValue(tok, NULL, &nm)) && nm) { wcsncpy(name, nm, 159); CoTaskMemFree(nm); }
            wcsncpy(catid, cats[i], 159);
            ISpObjectToken_Release(tok); ISpObjectTokenCategory_Release(cat);
            ok = 1;
        }
    }
    if (SUCCEEDED(ci)) CoUninitialize();
    vl();
    sapi_ok = ok; sapi_checked = GetTickCount(); if (!sapi_checked) sapi_checked = 1;
    wcsncpy(sapi_cat, catid, 159); wcsncpy(sapi_name, name, 159);
    vu();
    return ok;
}

int sapi_italian_voices(buf_t *out) {
    int ok = sapi_available();
    vl();
    char *n = u16to8(sapi_name);
    if (ok) json_str(out, n); else buf_adds(out, "null");
    free(n);
    vu();
    return ok;
}

static int sapi_speak(const wchar_t *text, double rate, const wchar_t *wavpath, char *err, size_t errn) {
    HRESULT ci = CoInitializeEx(NULL, COINIT_MULTITHREADED);
    ISpVoice *v = NULL; ISpStream *st = NULL; ISpObjectTokenCategory *cat = NULL; ISpObjectToken *tok = NULL;
    int ok = 0;
    wchar_t catid[160];
    vl(); wcsncpy(catid, sapi_cat, 159); catid[159] = 0; vu();
    if (FAILED(CoCreateInstance(&CLSID_SpVoice, NULL, CLSCTX_ALL, &IID_ISpVoice, (void **)&v)) || !v) { snprintf(err, errn, "voce di Windows non disponibile"); goto out; }
    if (!catid[0] || !find_italian(&cat, &tok, catid)) { snprintf(err, errn, "nessuna voce italiana installata in Windows"); goto out; }
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
    if (cat) ISpObjectTokenCategory_Release(cat);
    if (st) ISpStream_Release(st);
    if (v) ISpVoice_Release(v);
    if (SUCCEEDED(ci)) CoUninitialize();
    return ok;
}

/* ------------------------------------------------------------------ elenco motori */
int tts_engine_count(void) {
    wchar_t e[MAX_PATH], m[MAX_PATH];
    return piper_paths(e, m) + sapi_available();
}
void tts_engines_json(buf_t *b) {
    wchar_t e[MAX_PATH], m[MAX_PATH]; int k = 0;
    buf_adds(b, "[");
    if (piper_paths(e, m)) { buf_adds(b, "\"piper\""); k++; }
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

int tts_synthesize(const char *text, double rate, const char *engine, buf_t *wav, char *used, size_t usedn, char *err, size_t errn) {
    wchar_t *clean = clean_for_speech(text);
    if (!clean[0]) { free(clean); snprintf(err, errn, "testo vuoto"); return 0; }
    if (rate < 0.5) rate = 0.5;
    if (rate > 1.6) rate = 1.6;
    wchar_t pe[MAX_PATH], pm[MAX_PATH];
    int has_piper = piper_paths(pe, pm), has_sapi = sapi_available();
    if (!has_piper && !has_sapi) {
        free(clean);
        snprintf(err, errn, "nessuna voce italiana installata (Impostazioni di Windows -> Ora e lingua -> Voce, oppure la voce naturale dalla configurazione guidata)");
        return 0;
    }
    const char *order[2]; int no = 0;
    if (engine && !strcmp(engine, "sapi") && has_sapi) order[no++] = "sapi";
    if (has_piper) order[no++] = "piper";
    if (has_sapi && !(no && !strcmp(order[0], "sapi"))) order[no++] = "sapi";
    wchar_t tmpdir[MAX_PATH], tmpf[MAX_PATH];
    GetTempPathW(MAX_PATH, tmpdir);
    GetTempFileNameW(tmpdir, L"pdv", 0, tmpf);
    int ok = 0;
    for (int i = 0; i < no && !ok; i++) {
        if (!strcmp(order[i], "piper")) {
            char *t8 = u16to8(clean);
            wchar_t *qe = quote_arg(pe), *qm = quote_arg(pm), *qo = quote_arg(tmpf);
            wchar_t *cl = wcsdup_printf(L"%ls --model %ls --output_file %ls --length_scale %.2f", qe, qm, qo, 1.0 / rate);
            wchar_t dir[MAX_PATH]; wcsncpy(dir, pe, MAX_PATH - 1); dir[MAX_PATH - 1] = 0; wchar_t *sl = wcsrchr(dir, L'\\'); if (sl) *sl = 0;
            DWORD code = 1;
            if (run_process(cl, dir, t8, strlen(t8), NULL, 120000, &code, 1) && code == 0 && file_size(tmpf) > 44) ok = 1;
            else pd_log("piper non riuscito (codice %lu)", (unsigned long)code);
            free(t8); free(qe); free(qm); free(qo); free(cl);
        } else {
            char e2[200] = "";
            if (sapi_speak(clean, rate, tmpf, e2, sizeof e2) && file_size(tmpf) > 44) ok = 1;
            else { snprintf(err, errn, "%s", e2[0] ? e2 : "sintesi vocale non riuscita"); pd_log("SAPI: %s", err); }
        }
        if (ok) snprintf(used, usedn, "%s", order[i]);
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
