/* Professore Digitale per Windows - utilita' (buffer, testi, file, SHA-256, processi)
 * Ideato e sviluppato da Danilo D'Auria - Licenza MIT */
#include "pd.h"
#include <shlobj.h>
#include <process.h>

/* ------------------------------------------------------------------ buffer */
void buf_init(buf_t *b) { b->p = NULL; b->n = b->cap = 0; }
void buf_free(buf_t *b) { free(b->p); buf_init(b); }
int buf_reserve(buf_t *b, size_t extra) {
    if (b->n + extra + 1 <= b->cap) return 1;
    size_t nc = b->cap ? b->cap : 256;
    while (nc < b->n + extra + 1) nc *= 2;
    char *np = (char *)realloc(b->p, nc);
    if (!np) return 0;
    b->p = np; b->cap = nc;
    return 1;
}
int buf_add(buf_t *b, const void *data, size_t n) {
    if (!buf_reserve(b, n)) return 0;
    if (n) memcpy(b->p + b->n, data, n);
    b->n += n; b->p[b->n] = 0;
    return 1;
}
int buf_adds(buf_t *b, const char *s) { return buf_add(b, s, strlen(s)); }
int buf_addf(buf_t *b, const char *fmt, ...) {
    va_list ap; char tmp[512];
    va_start(ap, fmt);
    int k = vsnprintf(tmp, sizeof tmp, fmt, ap);
    va_end(ap);
    if (k < 0) return 0;
    if ((size_t)k < sizeof tmp) return buf_add(b, tmp, (size_t)k);
    if (!buf_reserve(b, (size_t)k)) return 0;
    va_start(ap, fmt);
    vsnprintf(b->p + b->n, (size_t)k + 1, fmt, ap);
    va_end(ap);
    b->n += (size_t)k;
    return 1;
}
char *buf_steal(buf_t *b) {
    char *p = b->p;
    if (!p) { p = (char *)calloc(1, 1); }
    buf_init(b);
    return p;
}

/* ------------------------------------------------------------------ testi */
wchar_t *u8to16(const char *s) {
    if (!s) s = "";
    int n = MultiByteToWideChar(CP_UTF8, 0, s, -1, NULL, 0);
    if (n <= 0) n = 1;
    wchar_t *w = (wchar_t *)calloc((size_t)n + 1, sizeof(wchar_t));
    if (w) MultiByteToWideChar(CP_UTF8, 0, s, -1, w, n);
    return w;
}
char *u16to8(const wchar_t *s) {
    if (!s) s = L"";
    int n = WideCharToMultiByte(CP_UTF8, 0, s, -1, NULL, 0, NULL, NULL);
    if (n <= 0) n = 1;
    char *u = (char *)calloc((size_t)n + 1, 1);
    if (u) WideCharToMultiByte(CP_UTF8, 0, s, -1, u, n, NULL, NULL);
    return u;
}
wchar_t *wcsdup_printf(const wchar_t *fmt, ...) {
    va_list ap; size_t cap = 512;
    for (;;) {
        wchar_t *w = (wchar_t *)malloc(cap * sizeof(wchar_t));
        if (!w) return NULL;
        va_start(ap, fmt);
        int k = _vsnwprintf(w, cap, fmt, ap);
        va_end(ap);
        if (k >= 0 && (size_t)k < cap) { w[k] = 0; return w; }
        free(w); cap *= 2;
        if (cap > (1u << 20)) return NULL;
    }
}
char *strdup_printf(const char *fmt, ...) {
    va_list ap;
    va_start(ap, fmt);
    int k = vsnprintf(NULL, 0, fmt, ap);
    va_end(ap);
    if (k < 0) return NULL;
    char *s = (char *)malloc((size_t)k + 1);
    if (!s) return NULL;
    va_start(ap, fmt);
    vsnprintf(s, (size_t)k + 1, fmt, ap);
    va_end(ap);
    return s;
}

/* ------------------------------------------------------------------ file */
int file_read(const wchar_t *path, buf_t *out, size_t limit) {
    HANDLE h = CreateFileW(path, GENERIC_READ, FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE, NULL,
                           OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, NULL);
    if (h == INVALID_HANDLE_VALUE) return 0;
    LARGE_INTEGER sz;
    if (!GetFileSizeEx(h, &sz) || (unsigned long long)sz.QuadPart > limit) { CloseHandle(h); return 0; }
    buf_init(out);
    if (!buf_reserve(out, (size_t)sz.QuadPart)) { CloseHandle(h); return 0; }
    DWORD got = 0; size_t total = 0;
    while (total < (size_t)sz.QuadPart) {
        DWORD want = (DWORD)(((size_t)sz.QuadPart - total) > (1u << 20) ? (1u << 20) : ((size_t)sz.QuadPart - total));
        if (!ReadFile(h, out->p + total, want, &got, NULL) || got == 0) break;
        total += got;
    }
    CloseHandle(h);
    out->n = total; out->p[total] = 0;
    return 1;
}
int file_write_atomic(const wchar_t *path, const void *data, size_t n) {
    wchar_t *tmp = wcsdup_printf(L"%ls.tmp", path);
    if (!tmp) return 0;
    HANDLE h = CreateFileW(tmp, GENERIC_WRITE, 0, NULL, CREATE_ALWAYS, FILE_ATTRIBUTE_NORMAL, NULL);
    if (h == INVALID_HANDLE_VALUE) { free(tmp); return 0; }
    DWORD w = 0; size_t done = 0; int ok = 1;
    while (done < n) {
        DWORD chunk = (DWORD)((n - done) > (1u << 20) ? (1u << 20) : (n - done));
        if (!WriteFile(h, (const char *)data + done, chunk, &w, NULL) || w == 0) { ok = 0; break; }
        done += w;
    }
    FlushFileBuffers(h);
    CloseHandle(h);
    if (ok) ok = MoveFileExW(tmp, path, MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH) != 0;
    if (!ok) DeleteFileW(tmp);
    free(tmp);
    return ok;
}
int file_exists(const wchar_t *path) {
    DWORD a = GetFileAttributesW(path);
    return a != INVALID_FILE_ATTRIBUTES && !(a & FILE_ATTRIBUTE_DIRECTORY);
}
int dir_exists(const wchar_t *path) {
    DWORD a = GetFileAttributesW(path);
    return a != INVALID_FILE_ATTRIBUTES && (a & FILE_ATTRIBUTE_DIRECTORY);
}
long long file_size(const wchar_t *path) {
    WIN32_FILE_ATTRIBUTE_DATA d;
    if (!GetFileAttributesExW(path, GetFileExInfoStandard, &d)) return -1;
    return ((long long)d.nFileSizeHigh << 32) | d.nFileSizeLow;
}
int mkdirs(const wchar_t *path) {
    if (dir_exists(path)) return 1;
    wchar_t tmp[MAX_PATH * 2];
    wcsncpy(tmp, path, MAX_PATH * 2 - 1); tmp[MAX_PATH * 2 - 1] = 0;
    for (wchar_t *p = tmp + 3; *p; p++) {
        if (*p == L'\\' || *p == L'/') {
            wchar_t c = *p; *p = 0;
            if (!dir_exists(tmp)) CreateDirectoryW(tmp, NULL);
            *p = c;
        }
    }
    if (!dir_exists(tmp)) CreateDirectoryW(tmp, NULL);
    return dir_exists(path);
}
int rmtree(const wchar_t *path) {
    if (!dir_exists(path)) { if (file_exists(path)) return DeleteFileW(path) != 0; return 1; }
    wchar_t *pat = path_join(path, L"*");
    WIN32_FIND_DATAW fd;
    HANDLE h = FindFirstFileW(pat, &fd);
    free(pat);
    if (h != INVALID_HANDLE_VALUE) {
        do {
            if (!wcscmp(fd.cFileName, L".") || !wcscmp(fd.cFileName, L"..")) continue;
            wchar_t *full = path_join(path, fd.cFileName);
            if (fd.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY) rmtree(full);
            else { SetFileAttributesW(full, FILE_ATTRIBUTE_NORMAL); DeleteFileW(full); }
            free(full);
        } while (FindNextFileW(h, &fd));
        FindClose(h);
    }
    return RemoveDirectoryW(path) != 0;
}
wchar_t *path_join(const wchar_t *a, const wchar_t *b) {
    size_t la = wcslen(a);
    int sep = la && (a[la - 1] == L'\\' || a[la - 1] == L'/');
    return wcsdup_printf(sep ? L"%ls%ls" : L"%ls\\%ls", a, b);
}

/* ------------------------------------------------------------------ SHA-256 (FIPS 180-4) */
typedef struct { unsigned int h[8]; unsigned long long len; unsigned char blk[64]; size_t bl; } sha_ctx;
static const unsigned int K256[64] = {
    0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
    0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
    0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
    0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
    0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
    0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
    0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
    0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2 };
#define ROR(x, n) (((x) >> (n)) | ((x) << (32 - (n))))
static void sha_block(sha_ctx *c, const unsigned char *p) {
    unsigned int w[64], a, b, cc, d, e, f, g, h, t1, t2;
    for (int i = 0; i < 16; i++) w[i] = (unsigned)p[i*4] << 24 | (unsigned)p[i*4+1] << 16 | (unsigned)p[i*4+2] << 8 | p[i*4+3];
    for (int i = 16; i < 64; i++) {
        unsigned s0 = ROR(w[i-15], 7) ^ ROR(w[i-15], 18) ^ (w[i-15] >> 3);
        unsigned s1 = ROR(w[i-2], 17) ^ ROR(w[i-2], 19) ^ (w[i-2] >> 10);
        w[i] = w[i-16] + s0 + w[i-7] + s1;
    }
    a = c->h[0]; b = c->h[1]; cc = c->h[2]; d = c->h[3]; e = c->h[4]; f = c->h[5]; g = c->h[6]; h = c->h[7];
    for (int i = 0; i < 64; i++) {
        t1 = h + (ROR(e, 6) ^ ROR(e, 11) ^ ROR(e, 25)) + ((e & f) ^ (~e & g)) + K256[i] + w[i];
        t2 = (ROR(a, 2) ^ ROR(a, 13) ^ ROR(a, 22)) + ((a & b) ^ (a & cc) ^ (b & cc));
        h = g; g = f; f = e; e = d + t1; d = cc; cc = b; b = a; a = t1 + t2;
    }
    c->h[0] += a; c->h[1] += b; c->h[2] += cc; c->h[3] += d; c->h[4] += e; c->h[5] += f; c->h[6] += g; c->h[7] += h;
}
static void sha_init(sha_ctx *c) {
    static const unsigned int iv[8] = { 0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19 };
    memcpy(c->h, iv, sizeof iv); c->len = 0; c->bl = 0;
}
static void sha_update(sha_ctx *c, const void *data, size_t n) {
    const unsigned char *p = (const unsigned char *)data;
    c->len += n;
    while (n) {
        size_t k = 64 - c->bl; if (k > n) k = n;
        memcpy(c->blk + c->bl, p, k); c->bl += k; p += k; n -= k;
        if (c->bl == 64) { sha_block(c, c->blk); c->bl = 0; }
    }
}
static void sha_final(sha_ctx *c, char hex[65]) {
    unsigned long long bits = c->len * 8;
    unsigned char pad = 0x80, z = 0, lenb[8];
    sha_update(c, &pad, 1);
    while (c->bl != 56) sha_update(c, &z, 1);
    for (int i = 0; i < 8; i++) lenb[i] = (unsigned char)(bits >> (56 - 8 * i));
    sha_update(c, lenb, 8);
    for (int i = 0; i < 8; i++) sprintf(hex + i * 8, "%08x", c->h[i]);
    hex[64] = 0;
}
void sha256_hex(const void *data, size_t n, char hex[65]) {
    sha_ctx c; sha_init(&c); sha_update(&c, data, n); sha_final(&c, hex);
}
int sha256_file(const wchar_t *path, char hex[65]) {
    HANDLE h = CreateFileW(path, GENERIC_READ, FILE_SHARE_READ, NULL, OPEN_EXISTING, FILE_FLAG_SEQUENTIAL_SCAN, NULL);
    if (h == INVALID_HANDLE_VALUE) return 0;
    sha_ctx c; sha_init(&c);
    char *blk = (char *)malloc(1 << 20);
    DWORD got;
    if (!blk) { CloseHandle(h); return 0; }
    while (ReadFile(h, blk, 1 << 20, &got, NULL) && got) sha_update(&c, blk, got);
    free(blk);
    CloseHandle(h);
    sha_final(&c, hex);
    return 1;
}

/* ------------------------------------------------------------------ versioni e controlli di formato */
static void vparts(const char *v, long out[3]) {
    out[0] = out[1] = out[2] = 0;
    int k = 0;
    while (v && *v && k < 3) {
        if (*v >= '0' && *v <= '9') { out[k++] = strtol(v, (char **)&v, 10); }
        else v++;
    }
}
int version_cmp(const char *a, const char *b) {
    long x[3], y[3]; vparts(a, x); vparts(b, y);
    for (int i = 0; i < 3; i++) if (x[i] != y[i]) return x[i] < y[i] ? -1 : 1;
    return 0;
}
int re_id(const char *s) {
    size_t n = s ? strlen(s) : 0;
    if (n < 2 || n > 49) return 0;
    if (!((s[0] >= 'a' && s[0] <= 'z') || (s[0] >= '0' && s[0] <= '9'))) return 0;
    for (size_t i = 1; i < n; i++)
        if (!((s[i] >= 'a' && s[i] <= 'z') || (s[i] >= '0' && s[i] <= '9') || s[i] == '-')) return 0;
    return 1;
}
static int digits(const char **p) { int k = 0; while (**p >= '0' && **p <= '9') { (*p)++; k++; } return k; }
int re_ver(const char *s) {
    if (!s) return 0;
    if (!digits(&s) || *s++ != '.' || !digits(&s)) return 0;
    if (!*s) return 1;
    if (*s++ != '.' || !digits(&s)) return 0;
    return *s == 0;
}
int re_ver3(const char *s) {
    if (!s) return 0;
    if (!digits(&s) || *s++ != '.' || !digits(&s) || *s++ != '.' || !digits(&s)) return 0;
    return *s == 0;
}
int re_sha(const char *s) {
    if (!s || strlen(s) != 64) return 0;
    for (int i = 0; i < 64; i++) if (!((s[i] >= '0' && s[i] <= '9') || (s[i] >= 'a' && s[i] <= 'f'))) return 0;
    return 1;
}

/* ------------------------------------------------------------------ registro (solo errori e fatti utili) */
void pd_log(const char *fmt, ...) {
    static CRITICAL_SECTION cs; static LONG init = 0;
    if (InterlockedCompareExchange(&init, 1, 0) == 0) InitializeCriticalSection(&cs);
    if (!G.local_dir[0]) return;
    char msg[2048];
    va_list ap; va_start(ap, fmt); vsnprintf(msg, sizeof msg, fmt, ap); va_end(ap);
    SYSTEMTIME st; GetLocalTime(&st);
    EnterCriticalSection(&cs);
    wchar_t *p = path_join(G.local_dir, L"server.log");
    if (p) {
        if (file_size(p) > 512 * 1024) {
            wchar_t *old = path_join(G.local_dir, L"server.log.1");
            if (old) { MoveFileExW(p, old, MOVEFILE_REPLACE_EXISTING); free(old); }
        }
        FILE *f = _wfopen(p, L"ab");
        if (f) {
            fprintf(f, "%04d-%02d-%02d %02d:%02d:%02d %s\r\n", st.wYear, st.wMonth, st.wDay, st.wHour, st.wMinute, st.wSecond, msg);
            fclose(f);
        }
        free(p);
    }
    if (getenv("PD_DEBUG")) { fprintf(stderr, "[pd] %s\n", msg); fflush(stderr); }
    LeaveCriticalSection(&cs);
}
unsigned long long now_ms(void) {
    FILETIME ft; GetSystemTimeAsFileTime(&ft);
    return ((((unsigned long long)ft.dwHighDateTime) << 32) | ft.dwLowDateTime) / 10000ULL;
}

/* ------------------------------------------------------------------ processi */
wchar_t *quote_arg(const wchar_t *arg) {
    /* regole di CommandLineToArgvW: barre rovesciate prima delle virgolette raddoppiate */
    size_t n = wcslen(arg);
    wchar_t *out = (wchar_t *)malloc((n * 2 + 3) * sizeof(wchar_t));
    if (!out) return NULL;
    size_t o = 0; out[o++] = L'"';
    for (size_t i = 0; i < n; i++) {
        size_t bs = 0;
        while (i < n && arg[i] == L'\\') { bs++; i++; }
        if (i == n) { for (size_t k = 0; k < bs * 2; k++) out[o++] = L'\\'; break; }
        if (arg[i] == L'"') { for (size_t k = 0; k < bs * 2 + 1; k++) out[o++] = L'\\'; out[o++] = L'"'; }
        else { for (size_t k = 0; k < bs; k++) out[o++] = L'\\'; out[o++] = arg[i]; }
    }
    out[o++] = L'"'; out[o] = 0;
    return out;
}

typedef struct { HANDLE h; const char *data; size_t n; } writer_arg;
static unsigned __stdcall stdin_writer(void *p) {
    writer_arg *w = (writer_arg *)p; DWORD k; size_t done = 0;
    while (done < w->n) {
        if (!WriteFile(w->h, w->data + done, (DWORD)(w->n - done), &k, NULL) || !k) break;
        done += k;
    }
    CloseHandle(w->h);
    return 0;
}

static HANDLE g_job = NULL;
static HANDLE job_handle(void) {
    /* i processi figli (motore IA, sintesi) si chiudono insieme al Professore */
    if (!g_job) {
        g_job = CreateJobObjectW(NULL, NULL);
        if (g_job) {
            JOBOBJECT_EXTENDED_LIMIT_INFORMATION li;
            memset(&li, 0, sizeof li);
            li.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE | JOB_OBJECT_LIMIT_BREAKAWAY_OK;
            SetInformationJobObject(g_job, JobObjectExtendedLimitInformation, &li, sizeof li);
        }
    }
    return g_job;
}

int run_process(const wchar_t *cmdline, const wchar_t *cwd, const char *stdin_data, size_t stdin_len,
                buf_t *out, DWORD timeout_ms, DWORD *exit_code, int hidden) {
    SECURITY_ATTRIBUTES sa = { sizeof sa, NULL, TRUE };
    HANDLE out_r = NULL, out_w = NULL, in_r = NULL, in_w = NULL;
    if (out) { if (!CreatePipe(&out_r, &out_w, &sa, 0)) return 0; SetHandleInformation(out_r, HANDLE_FLAG_INHERIT, 0); }
    if (!CreatePipe(&in_r, &in_w, &sa, 0)) { if (out) { CloseHandle(out_r); CloseHandle(out_w); } return 0; }
    SetHandleInformation(in_w, HANDLE_FLAG_INHERIT, 0);
    STARTUPINFOW si; PROCESS_INFORMATION pi;
    memset(&si, 0, sizeof si); si.cb = sizeof si;
    si.dwFlags = STARTF_USESTDHANDLES | STARTF_USESHOWWINDOW;
    si.wShowWindow = hidden ? SW_HIDE : SW_SHOWNORMAL;
    si.hStdInput = in_r;
    si.hStdOutput = out ? out_w : GetStdHandle(STD_OUTPUT_HANDLE);
    si.hStdError = out ? out_w : GetStdHandle(STD_ERROR_HANDLE);
    wchar_t *cl = _wcsdup(cmdline);
    BOOL ok = CreateProcessW(NULL, cl, NULL, NULL, TRUE, (hidden ? CREATE_NO_WINDOW : 0) | CREATE_UNICODE_ENVIRONMENT,
                             NULL, cwd, &si, &pi);
    free(cl);
    CloseHandle(in_r); if (out) CloseHandle(out_w);
    if (!ok) { CloseHandle(in_w); if (out) CloseHandle(out_r); return 0; }
    HANDLE job = job_handle(); if (job) AssignProcessToJobObject(job, pi.hProcess);
    writer_arg wa = { in_w, stdin_data, stdin_len };
    HANDLE wt = (HANDLE)_beginthreadex(NULL, 0, stdin_writer, &wa, 0, NULL);
    if (out) {
        char tmp[4096]; DWORD k;
        buf_init(out);
        DWORD start = GetTickCount();
        for (;;) {
            DWORD avail = 0;
            if (!PeekNamedPipe(out_r, NULL, 0, NULL, &avail, NULL)) break;
            if (avail) {
                if (!ReadFile(out_r, tmp, avail > sizeof tmp ? sizeof tmp : avail, &k, NULL) || !k) break;
                if (out->n < 16u * 1024u * 1024u) buf_add(out, tmp, k);
                continue;
            }
            if (WaitForSingleObject(pi.hProcess, 30) == WAIT_OBJECT_0) {
                while (PeekNamedPipe(out_r, NULL, 0, NULL, &avail, NULL) && avail &&
                       ReadFile(out_r, tmp, avail > sizeof tmp ? sizeof tmp : avail, &k, NULL) && k) buf_add(out, tmp, k);
                break;
            }
            if (timeout_ms && GetTickCount() - start > timeout_ms) { TerminateProcess(pi.hProcess, 1); break; }
        }
        CloseHandle(out_r);
    }
    DWORD w = WaitForSingleObject(pi.hProcess, out ? 2000 : (timeout_ms ? timeout_ms : INFINITE));
    if (w == WAIT_TIMEOUT) TerminateProcess(pi.hProcess, 1);
    DWORD code = 1; GetExitCodeProcess(pi.hProcess, &code);
    if (exit_code) *exit_code = code;
    if (wt) { WaitForSingleObject(wt, 2000); CloseHandle(wt); }
    CloseHandle(pi.hProcess); CloseHandle(pi.hThread);
    return w != WAIT_TIMEOUT || out != NULL;
}

HANDLE start_process(const wchar_t *cmdline, const wchar_t *cwd, int hidden, const wchar_t *env_extra) {
    STARTUPINFOW si; PROCESS_INFORMATION pi;
    memset(&si, 0, sizeof si); si.cb = sizeof si;
    si.dwFlags = STARTF_USESHOWWINDOW; si.wShowWindow = hidden ? SW_HIDE : SW_SHOWNORMAL;
    wchar_t *cl = _wcsdup(cmdline);
    wchar_t *env = NULL;
    if (env_extra) {
        /* ambiente attuale + variabili aggiuntive (blocco "A=1\0B=2\0\0") */
        wchar_t *cur = GetEnvironmentStringsW();
        size_t lc = 0; while (cur[lc] || cur[lc + 1]) lc++; lc += 2;
        size_t le = 0; while (env_extra[le] || env_extra[le + 1]) le++; le += 2;
        env = (wchar_t *)malloc((lc + le) * sizeof(wchar_t));
        memcpy(env, env_extra, le * sizeof(wchar_t));
        memcpy(env + le - 1, cur, lc * sizeof(wchar_t));
        FreeEnvironmentStringsW(cur);
    }
    BOOL ok = CreateProcessW(NULL, cl, NULL, NULL, FALSE, (hidden ? CREATE_NO_WINDOW : 0) | CREATE_UNICODE_ENVIRONMENT,
                             env, cwd, &si, &pi);
    free(cl); free(env);
    if (!ok) return NULL;
    HANDLE job = job_handle(); if (job) AssignProcessToJobObject(job, pi.hProcess);
    CloseHandle(pi.hThread);
    return pi.hProcess;
}
