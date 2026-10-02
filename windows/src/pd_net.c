/* Professore Digitale per Windows - connessioni in uscita (WinHTTP, presente da Windows XP SP2)
 * Usate SOLO per: IA locale (127.0.0.1), controllo aggiornamenti e configurazione guidata, sempre su
 * richiesta dell'utente. Ideato e sviluppato da Danilo D'Auria - Licenza MIT */
#include "pd.h"
#include <winhttp.h>

#ifndef WINHTTP_FLAG_SECURE_PROTOCOL_TLS1_1
#define WINHTTP_FLAG_SECURE_PROTOCOL_TLS1_1 0x00000200
#endif
#ifndef WINHTTP_FLAG_SECURE_PROTOCOL_TLS1_2
#define WINHTTP_FLAG_SECURE_PROTOCOL_TLS1_2 0x00000800
#endif
#ifndef WINHTTP_FLAG_SECURE_PROTOCOL_TLS1_3
#define WINHTTP_FLAG_SECURE_PROTOCOL_TLS1_3 0x00002000
#endif

/* ------------------------------------------------------------------ indirizzi consentiti */
static int host_is_local(const char *h) {
    char host[256]; size_t n = 0;
    if (*h == '[') {                     /* IPv6 */
        h++;
        while (*h && *h != ']' && n < sizeof host - 1) host[n++] = (char)tolower((unsigned char)*h++);
        host[n] = 0;
        if (!strcmp(host, "::1")) return 1;
        if ((host[0] == 'f' && (host[1] == 'c' || host[1] == 'd'))) return 1;           /* fc00::/7 */
        if (!strncmp(host, "fe8", 3) || !strncmp(host, "fe9", 3) || !strncmp(host, "fea", 3) || !strncmp(host, "feb", 3)) return 1;
        return 0;
    }
    while (*h && *h != ':' && *h != '/' && n < sizeof host - 1) host[n++] = (char)tolower((unsigned char)*h++);
    host[n] = 0;
    if (!strcmp(host, "localhost")) return 1;
    size_t L = strlen(host);
    if ((L > 6 && !strcmp(host + L - 6, ".local")) || (L > 4 && !strcmp(host + L - 4, ".lan")) ||
        (L > 10 && !strcmp(host + L - 10, ".home.arpa"))) return 1;
    unsigned a, b, c, d; char extra;
    if (sscanf(host, "%u.%u.%u.%u%c", &a, &b, &c, &d, &extra) == 4 && a < 256 && b < 256 && c < 256 && d < 256) {
        if (a == 10 || a == 127) return 1;
        if (a == 172 && b >= 16 && b <= 31) return 1;
        if (a == 192 && b == 168) return 1;
        if (a == 169 && b == 254) return 1;
    }
    return 0;
}
int url_is_local_host(const char *url) {
    const char *p = strstr(url, "://");
    return p ? host_is_local(p + 3) : 0;
}
int url_allowed(const char *url) {
    if (!url) return 0;
    for (const char *q = url; *q; q++) if ((unsigned char)*q <= ' ') return 0;
    if (!_strnicmp(url, "https://", 8) && url[8]) return 1;
    if (!_strnicmp(url, "http://", 7) && url[7]) return host_is_local(url + 7);
    return 0;
}

/* ------------------------------------------------------------------ errori in italiano */
static void net_error(http_result *res, DWORD e, const char *where) {
    const char *m;
    switch (e) {
        case 12007: m = "indirizzo non trovato: il computer e' collegato a Internet?"; break;
        case 12029: m = "impossibile collegarsi al server"; break;
        case 12002: m = "il server non risponde (tempo scaduto)"; break;
        case 12030: m = "collegamento interrotto"; break;
        case 12175: case 12157: case 12045: case 12044: case 12169:
            m = "connessione sicura non riuscita (su Windows 7 servono gli aggiornamenti per TLS 1.2, KB3140245; "
                "su Windows XP e Vista i siti moderni non sono raggiungibili: usate la chiavetta)"; break;
        case 12006: m = "indirizzo non valido"; break;
        case 12017: m = "operazione annullata"; break;
        default: m = NULL;
    }
    if (m) snprintf(res->error, sizeof res->error, "%s", m);
    else snprintf(res->error, sizeof res->error, "errore di rete %lu (%s)", (unsigned long)e, where);
}

static void apply_protocols(HINTERNET s) {
    DWORD p = WINHTTP_FLAG_SECURE_PROTOCOL_TLS1 | WINHTTP_FLAG_SECURE_PROTOCOL_TLS1_1 | WINHTTP_FLAG_SECURE_PROTOCOL_TLS1_2 |
              WINHTTP_FLAG_SECURE_PROTOCOL_TLS1_3;
    if (WinHttpSetOption(s, WINHTTP_OPTION_SECURE_PROTOCOLS, &p, sizeof p)) return;
    p &= ~WINHTTP_FLAG_SECURE_PROTOCOL_TLS1_3;
    if (WinHttpSetOption(s, WINHTTP_OPTION_SECURE_PROTOCOLS, &p, sizeof p)) return;
    p = WINHTTP_FLAG_SECURE_PROTOCOL_TLS1;      /* Windows XP: TLS 1.0 soltanto */
    WinHttpSetOption(s, WINHTTP_OPTION_SECURE_PROTOCOLS, &p, sizeof p);
}

static HINTERNET open_session(int local) {
    wchar_t ua[96];
    _snwprintf(ua, 96, L"professore-digitale/%hs (Windows)", G.version);
    ua[95] = 0;
    if (local) return WinHttpOpen(ua, WINHTTP_ACCESS_TYPE_NO_PROXY, WINHTTP_NO_PROXY_NAME, WINHTTP_NO_PROXY_BYPASS, 0);
    /* proxy: quello di WinHTTP (netsh) oppure, se impostato, quello manuale di Internet Explorer/Edge */
    WINHTTP_CURRENT_USER_IE_PROXY_CONFIG ie;
    memset(&ie, 0, sizeof ie);
    HINTERNET s = NULL;
    if (WinHttpGetIEProxyConfigForCurrentUser(&ie) && ie.lpszProxy && ie.lpszProxy[0])
        s = WinHttpOpen(ua, WINHTTP_ACCESS_TYPE_NAMED_PROXY, ie.lpszProxy,
                        ie.lpszProxyBypass ? ie.lpszProxyBypass : WINHTTP_NO_PROXY_BYPASS, 0);
    if (ie.lpszProxy) GlobalFree(ie.lpszProxy);
    if (ie.lpszProxyBypass) GlobalFree(ie.lpszProxyBypass);
    if (ie.lpszAutoConfigUrl) GlobalFree(ie.lpszAutoConfigUrl);
    if (!s) s = WinHttpOpen(ua, WINHTTP_ACCESS_TYPE_DEFAULT_PROXY, WINHTTP_NO_PROXY_NAME, WINHTTP_NO_PROXY_BYPASS, 0);
    if (s) apply_protocols(s);
    return s;
}

int http_request(const char *method, const char *url, const char *ctype, const char *body, size_t body_len,
                 int timeout_s, http_sink sink, void *ctx, http_result *res) {
    http_result dummy; if (!res) res = &dummy;
    memset(res, 0, sizeof *res); res->content_length = -1;
    if (!url || (_strnicmp(url, "http://", 7) && _strnicmp(url, "https://", 8))) { snprintf(res->error, sizeof res->error, "indirizzo non valido"); return 0; }
    wchar_t *wurl = u8to16(url);
    URL_COMPONENTS uc; memset(&uc, 0, sizeof uc); uc.dwStructSize = sizeof uc;
    wchar_t host[256], path[4096];
    uc.lpszHostName = host; uc.dwHostNameLength = 256;
    uc.lpszUrlPath = path; uc.dwUrlPathLength = 4096;
    wchar_t extra[4096]; uc.lpszExtraInfo = extra; uc.dwExtraInfoLength = 4096;
    if (!WinHttpCrackUrl(wurl, 0, 0, &uc)) { free(wurl); net_error(res, GetLastError(), "url"); return 0; }
    free(wurl);
    wchar_t *full = wcsdup_printf(L"%ls%ls", uc.dwUrlPathLength ? path : L"/", uc.dwExtraInfoLength ? extra : L"");
    int local = url_is_local_host(url);
    HINTERNET s = open_session(local), c = NULL, r = NULL;
    int ok = 0;
    if (!s) { net_error(res, GetLastError(), "sessione"); goto done; }
    int to = timeout_s > 0 ? timeout_s * 1000 : 30000;
    WinHttpSetTimeouts(s, 15000, local ? 3000 : 20000, to, to);
    c = WinHttpConnect(s, host, uc.nPort, 0);
    if (!c) { net_error(res, GetLastError(), "connessione"); goto done; }
    wchar_t *wm = u8to16(method);
    r = WinHttpOpenRequest(c, wm, full, NULL, WINHTTP_NO_REFERER, WINHTTP_DEFAULT_ACCEPT_TYPES,
                           uc.nScheme == INTERNET_SCHEME_HTTPS ? WINHTTP_FLAG_SECURE : 0);
    free(wm);
    if (!r) { net_error(res, GetLastError(), "richiesta"); goto done; }
    wchar_t hdr[256] = L"";
    if (ctype) { wchar_t *w = u8to16(ctype); _snwprintf(hdr, 255, L"Content-Type: %ls\r\n", w); hdr[255] = 0; free(w); }
    if (!WinHttpSendRequest(r, hdr[0] ? hdr : WINHTTP_NO_ADDITIONAL_HEADERS, hdr[0] ? (DWORD)-1L : 0,
                            (LPVOID)body, (DWORD)body_len, (DWORD)body_len, 0) ||
        !WinHttpReceiveResponse(r, NULL)) { net_error(res, GetLastError(), "invio"); goto done; }
    DWORD code = 0, sz = sizeof code;
    WinHttpQueryHeaders(r, WINHTTP_QUERY_STATUS_CODE | WINHTTP_QUERY_FLAG_NUMBER, WINHTTP_HEADER_NAME_BY_INDEX, &code, &sz, WINHTTP_NO_HEADER_INDEX);
    res->status = (int)code;
    wchar_t tmp[128]; sz = sizeof tmp;
    if (WinHttpQueryHeaders(r, WINHTTP_QUERY_CONTENT_TYPE, WINHTTP_HEADER_NAME_BY_INDEX, tmp, &sz, WINHTTP_NO_HEADER_INDEX)) {
        char *t = u16to8(tmp); snprintf(res->content_type, sizeof res->content_type, "%s", t); free(t);
    }
    sz = sizeof tmp;
    if (WinHttpQueryHeaders(r, WINHTTP_QUERY_CONTENT_LENGTH, WINHTTP_HEADER_NAME_BY_INDEX, tmp, &sz, WINHTTP_NO_HEADER_INDEX))
        res->content_length = _wtoi64(tmp);
    char *chunk = (char *)malloc(65536);
    if (!chunk) goto done;
    ok = 1;
    for (;;) {
        DWORD avail = 0, got = 0;
        if (!WinHttpQueryDataAvailable(r, &avail)) { net_error(res, GetLastError(), "ricezione"); ok = 0; break; }
        if (!avail) break;
        if (avail > 65536) avail = 65536;
        if (!WinHttpReadData(r, chunk, avail, &got)) { net_error(res, GetLastError(), "lettura"); ok = 0; break; }
        if (!got) break;
        if (sink && !sink(ctx, chunk, got)) { if (!res->error[0]) snprintf(res->error, sizeof res->error, "interrotto"); ok = 0; break; }
    }
    free(chunk);
done:
    if (r) WinHttpCloseHandle(r);
    if (c) WinHttpCloseHandle(c);
    if (s) WinHttpCloseHandle(s);
    free(full);
    return ok;
}

typedef struct { buf_t *b; size_t limit; int over; } mem_ctx;
static int mem_sink(void *p, const char *d, size_t n) {
    mem_ctx *m = (mem_ctx *)p;
    if (m->b->n + n > m->limit) { m->over = 1; return 0; }
    return buf_add(m->b, d, n);
}
int http_get_mem(const char *url, size_t limit, int timeout_s, buf_t *out, http_result *res) {
    mem_ctx m = { out, limit, 0 };
    buf_init(out);
    int ok = http_request("GET", url, NULL, NULL, 0, timeout_s, mem_sink, &m, res);
    if (m.over) { snprintf(res->error, sizeof res->error, "file troppo grande"); return 0; }
    if (ok && (res->status < 200 || res->status >= 300)) {
        snprintf(res->error, sizeof res->error, "il server ha risposto %d", res->status);
        return 0;
    }
    return ok;
}

typedef struct {
    HANDLE f; long long done, total; volatile LONG *cancel;
    void (*progress)(void *, long long, long long); void *ctx; DWORD last; http_result *res;
} dl_ctx;
static int dl_sink(void *p, const char *d, size_t n) {
    dl_ctx *x = (dl_ctx *)p;
    if (x->cancel && *x->cancel) return 0;
    DWORD w;
    if (!WriteFile(x->f, d, (DWORD)n, &w, NULL) || w != n) return 0;
    x->done += (long long)n;
    x->total = x->res ? x->res->content_length : -1;
    if (x->progress && GetTickCount() - x->last > 250) { x->last = GetTickCount(); x->progress(x->ctx, x->done, x->total); }
    return 1;
}
int http_download(const char *url, const wchar_t *dest, int timeout_s, volatile LONG *cancel,
                  void (*progress)(void *ctx, long long done, long long total), void *ctx, http_result *res) {
    wchar_t *part = wcsdup_printf(L"%ls.part", dest);
    HANDLE f = CreateFileW(part, GENERIC_WRITE, 0, NULL, CREATE_ALWAYS, FILE_ATTRIBUTE_NORMAL, NULL);
    if (f == INVALID_HANDLE_VALUE) { snprintf(res->error, sizeof res->error, "impossibile scrivere il file (spazio su disco?)"); free(part); return 0; }
    dl_ctx x; memset(&x, 0, sizeof x);
    x.f = f; x.cancel = cancel; x.progress = progress; x.ctx = ctx; x.total = -1; x.res = res;
    /* la dimensione si conosce solo dopo le intestazioni: il primo progresso la riporta */
    int ok = http_request("GET", url, NULL, NULL, 0, timeout_s, dl_sink, &x, res);
    CloseHandle(f);
    if (ok && (res->status < 200 || res->status >= 300)) { snprintf(res->error, sizeof res->error, "il server ha risposto %d", res->status); ok = 0; }
    if (ok && res->content_length >= 0 && x.done != res->content_length) { snprintf(res->error, sizeof res->error, "download incompleto"); ok = 0; }
    if (cancel && *cancel) { snprintf(res->error, sizeof res->error, "annullato"); ok = 0; }
    if (ok) ok = MoveFileExW(part, dest, MOVEFILE_REPLACE_EXISTING) != 0;
    if (!ok) DeleteFileW(part);
    if (ok && progress) progress(ctx, x.done, x.done);
    free(part);
    return ok;
}
