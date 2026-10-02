/* Professore Digitale per Windows - pd-stt.exe: riconoscimento vocale offline (Vosk)
 * Processo separato a 64 bit (il motore Vosk esiste solo a 64 bit), cosi' il programma principale
 * resta compatibile anche con i PC a 32 bit e con Windows XP.
 *   pd-stt.exe --probe --models DIR        -> {"engine": "vosk"} oppure {"engine": null}
 *   pd-stt.exe --models DIR file.wav       -> {"text": "..."} oppure {"error": "..."}
 * La libreria libvosk.dll (licenza Apache 2.0) sta nella stessa cartella e viene caricata a richiesta.
 * Ideato e sviluppato da Danilo D'Auria - Licenza MIT */
#ifndef UNICODE
#define UNICODE
#endif
#ifndef _UNICODE
#define _UNICODE
#endif
#include <windows.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <wchar.h>

typedef void *(*vosk_model_new_t)(const char *);
typedef void (*vosk_model_free_t)(void *);
typedef void *(*vosk_recognizer_new_t)(void *, float);
typedef void (*vosk_recognizer_free_t)(void *);
typedef int (*vosk_accept_t)(void *, const char *, int);
typedef const char *(*vosk_result_t)(void *);
typedef void (*vosk_set_log_level_t)(int);

static void out_json_error(const char *m) { printf("{\"error\": \"%s\"}\n", m); fflush(stdout); }

/* stampa una stringa JSON a partire da UTF-8 (escape minimo) */
static void put_json_str(const char *s) {
    putchar('"');
    for (; *s; s++) {
        unsigned char c = (unsigned char)*s;
        if (c == '"' || c == '\\') { putchar('\\'); putchar(c); }
        else if (c == '\n') fputs("\\n", stdout);
        else if (c < 0x20) printf("\\u%04x", c);
        else putchar(c);
    }
    putchar('"');
}

/* estrae il valore di "text" dal JSON di Vosk (stringa semplice, senza escape particolari) */
static void append_text(char *acc, size_t cap, const char *json) {
    const char *k = strstr(json, "\"text\"");
    if (!k) return;
    k = strchr(k + 6, '"');
    if (!k) return;
    k++;
    const char *e = k;
    while (*e && *e != '"') { if (*e == '\\' && e[1]) e++; e++; }
    size_t L = (size_t)(e - k), cur = strlen(acc);
    if (!L) return;
    if (cur && cur + 1 < cap) { acc[cur++] = ' '; acc[cur] = 0; }
    if (cur + L >= cap) L = cap - cur - 1;
    memcpy(acc + cur, k, L); acc[cur + L] = 0;
}

/* Vosk apre i file con percorsi "stretti": il nome corto 8.3 evita problemi con lettere accentate */
static char *narrow_path(const wchar_t *w) {
    wchar_t sh[MAX_PATH];
    DWORD n = GetShortPathNameW(w, sh, MAX_PATH);
    const wchar_t *use = (n && n < MAX_PATH) ? sh : w;
    int k = WideCharToMultiByte(CP_ACP, 0, use, -1, NULL, 0, NULL, NULL);
    char *s = (char *)malloc((size_t)k + 1);
    WideCharToMultiByte(CP_ACP, 0, use, -1, s, k, NULL, NULL);
    return s;
}

int wmain(int argc, wchar_t **argv) {
    const wchar_t *models = NULL, *wav = NULL; int probe = 0;
    for (int i = 1; i < argc; i++) {
        if (!wcscmp(argv[i], L"--probe")) probe = 1;
        else if (!wcscmp(argv[i], L"--models") && i + 1 < argc) models = argv[++i];
        else wav = argv[i];
    }
    if (!models) { out_json_error("manca --models"); return 1; }
    wchar_t mdir[MAX_PATH];
    _snwprintf(mdir, MAX_PATH, L"%ls\\vosk-it", models); mdir[MAX_PATH - 1] = 0;

    /* la DLL si cerca solo accanto a questo programma */
    wchar_t self[MAX_PATH]; GetModuleFileNameW(NULL, self, MAX_PATH);
    wchar_t *sl = wcsrchr(self, L'\\'); if (sl) *sl = 0;
    SetDllDirectoryW(self);
    wchar_t dll[MAX_PATH]; _snwprintf(dll, MAX_PATH, L"%ls\\libvosk.dll", self); dll[MAX_PATH - 1] = 0;
    HMODULE m = LoadLibraryExW(dll, NULL, LOAD_WITH_ALTERED_SEARCH_PATH);
    DWORD attr = GetFileAttributesW(mdir);
    int model_ok = attr != INVALID_FILE_ATTRIBUTES && (attr & FILE_ATTRIBUTE_DIRECTORY);
    if (probe) {
        if (m && model_ok) printf("{\"engine\": \"vosk\", \"model\": \"vosk-it\"}\n");
        else printf("{\"engine\": null}\n");
        return 0;
    }
    if (!m) { out_json_error("motore Vosk non trovato"); return 1; }
    if (!model_ok) { out_json_error("modello italiano non installato"); return 1; }
    if (!wav) { out_json_error("manca il file audio"); return 1; }

    vosk_set_log_level_t setlog = (vosk_set_log_level_t)(void *)GetProcAddress(m, "vosk_set_log_level");
    vosk_model_new_t mnew = (vosk_model_new_t)(void *)GetProcAddress(m, "vosk_model_new");
    vosk_model_free_t mfree = (vosk_model_free_t)(void *)GetProcAddress(m, "vosk_model_free");
    vosk_recognizer_new_t rnew = (vosk_recognizer_new_t)(void *)GetProcAddress(m, "vosk_recognizer_new");
    vosk_recognizer_free_t rfree = (vosk_recognizer_free_t)(void *)GetProcAddress(m, "vosk_recognizer_free");
    vosk_accept_t acc = (vosk_accept_t)(void *)GetProcAddress(m, "vosk_recognizer_accept_waveform");
    vosk_result_t res = (vosk_result_t)(void *)GetProcAddress(m, "vosk_recognizer_result");
    vosk_result_t fin = (vosk_result_t)(void *)GetProcAddress(m, "vosk_recognizer_final_result");
    if (!mnew || !rnew || !acc || !res || !fin) { out_json_error("libreria Vosk non compatibile"); return 1; }
    if (setlog) setlog(-1);

    FILE *f = _wfopen(wav, L"rb");
    if (!f) { out_json_error("file audio non leggibile"); return 1; }
    unsigned char hdr[12];
    if (fread(hdr, 1, 12, f) != 12 || memcmp(hdr, "RIFF", 4) || memcmp(hdr + 8, "WAVE", 4)) { fclose(f); out_json_error("serve audio WAV"); return 1; }
    /* cerca i blocchi "fmt " e "data" */
    unsigned rate = 16000, channels = 1, bits = 16; long data_len = -1;
    for (;;) {
        unsigned char ch[8];
        if (fread(ch, 1, 8, f) != 8) break;
        unsigned len = ch[4] | ch[5] << 8 | ch[6] << 16 | (unsigned)ch[7] << 24;
        if (!memcmp(ch, "fmt ", 4)) {
            unsigned char fm[40]; unsigned take = len > sizeof fm ? sizeof fm : len;
            if (fread(fm, 1, take, f) != take) break;
            channels = fm[2] | fm[3] << 8; rate = fm[4] | fm[5] << 8 | fm[6] << 16 | (unsigned)fm[7] << 24; bits = fm[14] | fm[15] << 8;
            if (len > take) fseek(f, (long)(len - take), SEEK_CUR);
            if (len & 1) fseek(f, 1, SEEK_CUR);
        } else if (!memcmp(ch, "data", 4)) { data_len = (long)len; break; }
        else fseek(f, (long)(len + (len & 1)), SEEK_CUR);
    }
    if (data_len < 0 || channels != 1 || bits != 16) { fclose(f); out_json_error("serve audio WAV mono 16 bit"); return 1; }

    wchar_t *wmodel = mdir;
    char *nm = narrow_path(wmodel);
    void *model = mnew(nm);
    free(nm);
    if (!model) { fclose(f); out_json_error("modello italiano non caricato"); return 1; }
    void *rec = rnew(model, (float)rate);
    static char text[65536]; text[0] = 0;
    char buf[8000]; size_t got;
    while ((got = fread(buf, 1, sizeof buf, f)) > 0) {
        if (acc(rec, buf, (int)got)) append_text(text, sizeof text, res(rec));
    }
    append_text(text, sizeof text, fin(rec));
    fclose(f);
    if (rfree) rfree(rec);
    if (mfree) mfree(model);
    printf("{\"text\": "); put_json_str(text); printf("}\n");
    fflush(stdout);
    return 0;
}
