/* Professore Digitale per Windows - estrazione di archivi .zip (modello vocale, voce naturale)
 * Usa zlib (licenza zlib) collegata staticamente. Protegge da percorsi malevoli nell'archivio e
 * controlla il CRC di ogni file. Ideato e sviluppato da Danilo D'Auria - Licenza MIT */
#include "pd.h"
#include <zlib.h>

static unsigned rd16(const unsigned char *p) { return p[0] | p[1] << 8; }
static unsigned rd32(const unsigned char *p) { return p[0] | p[1] << 8 | p[2] << 16 | (unsigned)p[3] << 24; }

static int read_at(HANDLE f, long long off, void *dst, DWORD n) {
    LARGE_INTEGER li; li.QuadPart = off;
    DWORD got = 0;
    return SetFilePointerEx(f, li, NULL, FILE_BEGIN) && ReadFile(f, dst, n, &got, NULL) && got == n;
}

static int safe_name(const char *n) {
    if (!*n || n[0] == '/' || n[0] == '\\' || strchr(n, ':')) return 0;
    const char *p = n;
    while (*p) {
        const char *e = p; while (*e && *e != '/' && *e != '\\') e++;
        if (e - p == 2 && p[0] == '.' && p[1] == '.') return 0;
        p = *e ? e + 1 : e;
    }
    return 1;
}

int unzip_to(const wchar_t *zip, const wchar_t *dest, volatile LONG *cancel, char *err, size_t errn) {
    HANDLE f = CreateFileW(zip, GENERIC_READ, FILE_SHARE_READ, NULL, OPEN_EXISTING, 0, NULL);
    if (f == INVALID_HANDLE_VALUE) { snprintf(err, errn, "archivio non leggibile"); return 0; }
    LARGE_INTEGER sz; GetFileSizeEx(f, &sz);
    long long size = sz.QuadPart;
    unsigned char tail[65536 + 22];
    DWORD tl = (DWORD)(size < (long long)sizeof tail ? size : (long long)sizeof tail);
    int ok = 0;
    unsigned char *cd = NULL;
    if (tl < 22 || !read_at(f, size - tl, tail, tl)) { snprintf(err, errn, "archivio troppo piccolo o rovinato"); goto out; }
    long eocd = -1;
    for (long i = (long)tl - 22; i >= 0; i--) if (rd32(tail + i) == 0x06054b50) { eocd = i; break; }
    if (eocd < 0) { snprintf(err, errn, "archivio zip non valido"); goto out; }
    unsigned entries = rd16(tail + eocd + 10);
    unsigned cd_size = rd32(tail + eocd + 12), cd_off = rd32(tail + eocd + 16);
    if (cd_off == 0xFFFFFFFFu || (long long)cd_off + cd_size > size) { snprintf(err, errn, "archivio zip non supportato"); goto out; }
    cd = (unsigned char *)malloc(cd_size);
    if (!cd || !read_at(f, cd_off, cd, cd_size)) { snprintf(err, errn, "indice dell'archivio non leggibile"); goto out; }
    mkdirs(dest);
    unsigned pos = 0;
    unsigned char *inb = (unsigned char *)malloc(1 << 16), *outb = (unsigned char *)malloc(1 << 16);
    for (unsigned e = 0; e < entries; e++) {
        if (cancel && *cancel) { snprintf(err, errn, "annullato"); goto out2; }
        if (pos + 46 > cd_size || rd32(cd + pos) != 0x02014b50) { snprintf(err, errn, "indice dell'archivio rovinato"); goto out2; }
        unsigned method = rd16(cd + pos + 10), crc = rd32(cd + pos + 16), csize = rd32(cd + pos + 20), usize = rd32(cd + pos + 24);
        unsigned nlen = rd16(cd + pos + 28), xlen = rd16(cd + pos + 30), clen = rd16(cd + pos + 32), loff = rd32(cd + pos + 42);
        if (pos + 46 + nlen > cd_size) { snprintf(err, errn, "indice dell'archivio rovinato"); goto out2; }
        char name[1024]; unsigned nl = nlen < sizeof name - 1 ? nlen : (unsigned)sizeof name - 1;
        memcpy(name, cd + pos + 46, nl); name[nl] = 0;
        pos += 46 + nlen + xlen + clen;
        if (!safe_name(name)) { snprintf(err, errn, "percorso non valido nell'archivio: %s", name); goto out2; }
        for (char *c = name; *c; c++) if (*c == '/') *c = '\\';
        wchar_t *wn = u8to16(name), *full = path_join(dest, wn);
        free(wn);
        size_t L = strlen(name);
        if (L && name[L - 1] == '\\') { mkdirs(full); free(full); continue; }
        wchar_t *parent = _wcsdup(full); wchar_t *sl = wcsrchr(parent, L'\\'); if (sl) { *sl = 0; mkdirs(parent); } free(parent);
        unsigned char lh[30];
        if (!read_at(f, loff, lh, 30) || rd32(lh) != 0x04034b50) { free(full); snprintf(err, errn, "file rovinato nell'archivio"); goto out2; }
        long long data_off = (long long)loff + 30 + rd16(lh + 26) + rd16(lh + 28);
        HANDLE o = CreateFileW(full, GENERIC_WRITE, 0, NULL, CREATE_ALWAYS, FILE_ATTRIBUTE_NORMAL, NULL);
        free(full);
        if (o == INVALID_HANDLE_VALUE) { snprintf(err, errn, "impossibile scrivere i file estratti"); goto out2; }
        LARGE_INTEGER li; li.QuadPart = data_off; SetFilePointerEx(f, li, NULL, FILE_BEGIN);
        unsigned long c2 = crc32(0L, Z_NULL, 0);
        unsigned left = csize; DWORD got, w; int fail = 0;
        if (method == 0) {
            while (left && !fail) {
                DWORD want = left > (1u << 16) ? (1u << 16) : left;
                if (!ReadFile(f, inb, want, &got, NULL) || !got) { fail = 1; break; }
                c2 = crc32(c2, inb, got); WriteFile(o, inb, got, &w, NULL); left -= got;
            }
        } else if (method == 8) {
            z_stream zs; memset(&zs, 0, sizeof zs);
            if (inflateInit2(&zs, -MAX_WBITS) != Z_OK) fail = 1;
            int zr = Z_OK;
            while (!fail && zr != Z_STREAM_END) {
                if (!zs.avail_in) {
                    if (!left) { fail = 1; break; }
                    DWORD want = left > (1u << 16) ? (1u << 16) : left;
                    if (!ReadFile(f, inb, want, &got, NULL) || !got) { fail = 1; break; }
                    left -= got; zs.next_in = inb; zs.avail_in = got;
                }
                zs.next_out = outb; zs.avail_out = 1 << 16;
                zr = inflate(&zs, Z_NO_FLUSH);
                if (zr != Z_OK && zr != Z_STREAM_END) { fail = 1; break; }
                DWORD produced = (DWORD)((1 << 16) - zs.avail_out);
                if (produced) { c2 = crc32(c2, outb, produced); WriteFile(o, outb, produced, &w, NULL); }
            }
            inflateEnd(&zs);
        } else fail = 1;
        CloseHandle(o);
        if (fail) { snprintf(err, errn, "estrazione non riuscita (%s)", name); goto out2; }
        if (c2 != crc || (method == 0 && csize != usize)) { snprintf(err, errn, "controllo di integrita' fallito: %s", name); goto out2; }
    }
    ok = 1;
out2:
    free(inb); free(outb);
out:
    free(cd);
    CloseHandle(f);
    return ok;
}
