/* Professore Digitale per Windows - pd-kokoro.exe (64 bit, dalla 3.8)
 * Voce naturale Kokoro (Nicola, uomo; Sara, donna) con la libreria sherpa-onnx-c-api.dll (Apache 2.0).
 * Resta acceso e legge le richieste dallo standard input, una per riga, in UTF-8 (cosi' le lettere accentate
 * arrivano giuste qualunque sia la lingua di Windows):
 *     sid <TAB> velocita <TAB> file.wav <TAB> testo   ->   "OK"  oppure  "ERR messaggio"
 * All'avvio scrive "PRONTO" (modello caricato) oppure "ERR messaggio". Lo stesso protocollo del server per Linux (pd_kokoro.py).
 * Uso:  pd-kokoro.exe CARTELLA_MODELLO THREAD
 * Ideato e sviluppato da Danilo D'Auria - Licenza MIT */
#include <windows.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <fcntl.h>
#include <io.h>
#include "c-api.h"

static void riga(const char *s) { fputs(s, stdout); fputc('\n', stdout); fflush(stdout); }

static int scrivi_wav(const wchar_t *path, const float *x, int n, int sr) {
    FILE *f = _wfopen(path, L"wb");
    if (!f) return 0;
    unsigned int dati = (unsigned int)n * 2u, v;
    unsigned short s;
    fwrite("RIFF", 1, 4, f); v = 36u + dati; fwrite(&v, 4, 1, f); fwrite("WAVEfmt ", 1, 8, f);
    v = 16; fwrite(&v, 4, 1, f); s = 1; fwrite(&s, 2, 1, f); s = 1; fwrite(&s, 2, 1, f);
    v = (unsigned int)sr; fwrite(&v, 4, 1, f); v = (unsigned int)sr * 2u; fwrite(&v, 4, 1, f);
    s = 2; fwrite(&s, 2, 1, f); s = 16; fwrite(&s, 2, 1, f);
    fwrite("data", 1, 4, f); fwrite(&dati, 4, 1, f);
    for (int i = 0; i < n; i++) {
        float y = x[i] * 32767.0f;
        if (y > 32767.0f) y = 32767.0f;
        if (y < -32768.0f) y = -32768.0f;
        short z = (short)y; fwrite(&z, 2, 1, f);
    }
    int ok = !ferror(f);
    return fclose(f) == 0 && ok;
}

int wmain(int argc, wchar_t **argv) {
    if (argc < 3) { riga("ERR uso: pd-kokoro.exe CARTELLA_MODELLO THREAD"); return 2; }
    _setmode(_fileno(stdin), _O_BINARY);
    /* percorsi relativi alla cartella del modello: funzionano anche se il nome dell'utente ha lettere accentate */
    if (!SetCurrentDirectoryW(argv[1])) { riga("ERR cartella del modello non trovata"); return 1; }
    SherpaOnnxOfflineTtsConfig c;
    memset(&c, 0, sizeof c);
    c.model.kokoro.model = "model.int8.onnx";
    c.model.kokoro.voices = "voices.bin";
    c.model.kokoro.tokens = "tokens.txt";
    c.model.kokoro.data_dir = "espeak-ng-data";
    c.model.kokoro.length_scale = 1.0f;
    c.model.kokoro.lang = "it";
    c.model.kokoro.dict_dir = "";
    c.model.kokoro.lexicon = "";
    c.model.num_threads = _wtoi(argv[2]) > 0 ? _wtoi(argv[2]) : 2;
    c.model.provider = "cpu";
    c.max_num_sentences = 1;
    c.silence_scale = 0.2f;
    const SherpaOnnxOfflineTts *tts = SherpaOnnxCreateOfflineTts(&c);
    if (!tts) { riga("ERR modello Kokoro non caricato"); return 1; }
    int voci = SherpaOnnxOfflineTtsNumSpeakers(tts);
    riga("PRONTO");
    static char buf[65536];
    while (fgets(buf, sizeof buf, stdin)) {
        size_t n = strlen(buf);
        while (n && (buf[n - 1] == '\n' || buf[n - 1] == '\r')) buf[--n] = 0;
        char *t1 = strchr(buf, '\t'), *t2 = t1 ? strchr(t1 + 1, '\t') : NULL, *t3 = t2 ? strchr(t2 + 1, '\t') : NULL;
        if (!t3) { riga("ERR richiesta non valida"); continue; }
        *t1 = *t2 = *t3 = 0;
        int sid = atoi(buf);
        float vel = (float)atof(t1 + 1);
        if (vel < 0.5f) vel = 0.5f;
        if (vel > 2.0f) vel = 2.0f;
        if (sid < 0 || sid >= voci) { riga("ERR voce inesistente"); continue; }
        wchar_t dest[MAX_PATH];
        if (!MultiByteToWideChar(CP_UTF8, 0, t2 + 1, -1, dest, MAX_PATH)) { riga("ERR file non valido"); continue; }
        const SherpaOnnxGeneratedAudio *a = SherpaOnnxOfflineTtsGenerate(tts, t3 + 1, sid, vel);
        if (!a) { riga("ERR sintesi non riuscita"); continue; }
        int ok = a->n > 0 && scrivi_wav(dest, a->samples, a->n, a->sample_rate);
        SherpaOnnxDestroyOfflineTtsGeneratedAudio(a);
        riga(ok ? "OK" : "ERR audio non scritto");
    }
    SherpaOnnxDestroyOfflineTts(tts);
    return 0;
}
