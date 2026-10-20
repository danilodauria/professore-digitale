/* FINTO ffmpeg.exe per i test della versione Windows (Nonni Teach, 3.6): non converte nulla.
 * Scrive gli argomenti ricevuti in ffmpeg-argomenti.txt (accanto all'exe), risponde «time=00:00:01.25»
 * quando gli si chiede la durata (-f null -) e, per il montaggio, crea il file di uscita (l'ultimo argomento).
 * Compilato da tests/test_windows_api.py con i686-w64-mingw32-gcc. Autore: Danilo D'Auria - Licenza MIT */
#include <stdio.h>
#include <string.h>
#include <windows.h>
int main(int argc, char **argv) {
    char log[MAX_PATH]; GetModuleFileNameA(NULL, log, MAX_PATH);
    char *s = strrchr(log, '\\'); if (s) strcpy(s + 1, "ffmpeg-argomenti.txt");
    FILE *f = fopen(log, "a");
    int nulla = 0;
    for (int i = 1; i < argc; i++) { if (f) fprintf(f, "%s\n", argv[i]); if (!strcmp(argv[i], "null")) nulla = 1; }
    if (f) { fprintf(f, "----\n"); fclose(f); }
    if (nulla) { printf("size=N/A time=00:00:01.25 bitrate=N/A speed=99x\n"); return 0; }
    FILE *o = fopen(argv[argc - 1], "wb");
    if (!o) return 1;
    fputs("ID3 finto podcast", o); fclose(o);
    return 0;
}
