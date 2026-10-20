/* Professore Digitale per Windows - server HTTP locale (solo 127.0.0.1, controllo Host/Origin)
 * Ideato e sviluppato da Danilo D'Auria - Licenza MIT */
#include "pd.h"
#include <process.h>

static SOCKET g_listen = INVALID_SOCKET;

void send_raw(req_t *r, const char *data, size_t n) {
    while (n > 0) {
        int k = send(r->s, data, n > 65536 ? 65536 : (int)n, 0);
        if (k <= 0) return;
        data += k; n -= (size_t)k;
    }
}

static const char *reason(int code) {
    switch (code) {
        case 200: return "OK"; case 303: return "See Other"; case 429: return "Too Many Requests"; case 400: return "Bad Request"; case 403: return "Forbidden"; case 404: return "Not Found";
        case 405: return "Method Not Allowed"; case 409: return "Conflict"; case 413: return "Payload Too Large";
        case 500: return "Internal Server Error"; case 502: return "Bad Gateway"; case 503: return "Service Unavailable";
        default: return "OK";
    }
}

void send_response(req_t *r, int code, const char *ctype, const void *body, size_t n, const char *extra) {
    if (r->sent) return;
    r->sent = 1;
    buf_t h; buf_init(&h);
    buf_addf(&h, "HTTP/1.1 %d %s\r\nServer: ProfessoreDigitale/%s\r\nContent-Type: %s\r\nContent-Length: %u\r\n"
                 "X-Content-Type-Options: nosniff\r\nX-Frame-Options: DENY\r\nReferrer-Policy: no-referrer\r\n"
                 "Cache-Control: no-store\r\nConnection: close\r\n%s\r\n",
             code, reason(code), G.version, ctype, (unsigned)n, extra ? extra : "");
    send_raw(r, h.p, h.n);
    buf_free(&h);
    if (!r->head_only && n) send_raw(r, (const char *)body, n);
}
void send_json(req_t *r, int code, buf_t *json) { send_response(r, code, "application/json; charset=utf-8", json->p, json->n, NULL); }
void send_error(req_t *r, int code, const char *msg) {
    buf_t b; buf_init(&b);
    buf_adds(&b, "{\"ok\": false, \"error\": "); json_str(&b, msg); buf_adds(&b, "}");
    send_json(r, code, &b);
    buf_free(&b);
}
void send_ok(req_t *r) { buf_t b; buf_init(&b); buf_adds(&b, "{\"ok\": true}"); send_json(r, 200, &b); buf_free(&b); }

/* ------------------------------------------------------------------ file statici */
static const char *mime_of(const wchar_t *p) {
    const wchar_t *e = wcsrchr(p, L'.');
    if (!e) return "application/octet-stream";
    if (!_wcsicmp(e, L".html")) return "text/html; charset=utf-8";
    if (!_wcsicmp(e, L".js")) return "application/javascript; charset=utf-8";
    if (!_wcsicmp(e, L".css")) return "text/css; charset=utf-8";
    if (!_wcsicmp(e, L".svg")) return "image/svg+xml; charset=utf-8";
    if (!_wcsicmp(e, L".json")) return "application/json; charset=utf-8";
    if (!_wcsicmp(e, L".png")) return "image/png";
    if (!_wcsicmp(e, L".ico")) return "image/x-icon";
    if (!_wcsicmp(e, L".pdf")) return "application/pdf";
    if (!_wcsicmp(e, L".txt")) return "text/plain; charset=utf-8";
    if (!_wcsicmp(e, L".woff2")) return "font/woff2";
    return "application/octet-stream";
}

static int hexv(char c) { return c >= '0' && c <= '9' ? c - '0' : c >= 'a' && c <= 'f' ? c - 'a' + 10 : c >= 'A' && c <= 'F' ? c - 'A' + 10 : -1; }

void handle_static(req_t *r) {
    char rel[2048]; size_t o = 0;
    const char *p = r->path;
    if (!strcmp(p, "/") || !*p) p = "/index.html";
    while (*p == '/') p++;
    for (; *p && o < sizeof rel - 1; p++) {
        char c = *p;
        if (c == '%' && hexv(p[1]) >= 0 && hexv(p[2]) >= 0) { c = (char)(hexv(p[1]) * 16 + hexv(p[2])); p += 2; }
        if (c == '\\' || c == ':' || c == 0) { send_error(r, 404, "non trovato"); return; }
        rel[o++] = c == '/' ? '\\' : c;
    }
    rel[o] = 0;
    /* niente risalite fuori dalla cartella dell'interfaccia */
    if (strstr(rel, "..") || rel[0] == '\\') { send_error(r, 404, "non trovato"); return; }
    wchar_t *wrel = u8to16(rel), *full = path_join(G.web_dir, wrel);
    free(wrel);
    buf_t data;
    if (!file_exists(full) || !file_read(full, &data, 64u * 1024u * 1024u)) { free(full); send_error(r, 404, "non trovato"); return; }
    const char *extra = NULL;
    if (!strcmp(rel, "index.html"))
        extra = "Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-eval' blob:; "
                "style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob: data:; "
                "connect-src 'self'; font-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'\r\n";
    send_response(r, 200, mime_of(full), data.p, data.n, extra);
    buf_free(&data);
    free(full);
}

/* ------------------------------------------------------------------ lettura della richiesta */
static void lower(char *s) { for (; *s; s++) *s = (char)tolower((unsigned char)*s); }

static int recv_all(SOCKET s, char *dst, size_t n) {
    size_t got = 0;
    while (got < n) {
        int k = recv(s, dst + got, (int)((n - got) > 65536 ? 65536 : (n - got)), 0);
        if (k <= 0) return 0;
        got += (size_t)k;
    }
    return 1;
}

static int host_ok(req_t *r) {
    char a[64], b[64];
    snprintf(a, sizeof a, "127.0.0.1:%d", G.port);
    snprintf(b, sizeof b, "localhost:%d", G.port);
    return !strcmp(r->host, a) || !strcmp(r->host, b);
}
static int origin_ok(req_t *r) {
    if (!r->origin[0]) return 1;                 /* richieste non da browser o GET della stessa origine */
    char a[64], b[64];
    snprintf(a, sizeof a, "http://127.0.0.1:%d", G.port);
    snprintf(b, sizeof b, "http://localhost:%d", G.port);
    return !strcmp(r->origin, a) || !strcmp(r->origin, b);
}

static void serve_conn(SOCKET s, int ospite) {
    req_t r; memset(&r, 0, sizeof r); r.s = s; r.clen = 0; r.ospite = ospite;
    {
        struct sockaddr_in a; int al = sizeof a;
        if (getpeername(s, (struct sockaddr *)&a, &al) == 0) snprintf(r.ip, sizeof r.ip, "%s", inet_ntoa(a.sin_addr));
        al = sizeof a;
        if (getsockname(s, (struct sockaddr *)&a, &al) == 0) snprintf(r.local, sizeof r.local, "%s", inet_ntoa(a.sin_addr));
    }
    DWORD tmo = 30000;
    setsockopt(s, SOL_SOCKET, SO_RCVTIMEO, (const char *)&tmo, sizeof tmo);
    char *hdr = (char *)malloc(65537); size_t hn = 0; char *end = NULL;
    if (!hdr) { closesocket(s); return; }
    while (hn < 65536) {
        int k = recv(s, hdr + hn, (int)(65536 - hn), 0);
        if (k <= 0) break;
        hn += (size_t)k; hdr[hn] = 0;
        if ((end = strstr(hdr, "\r\n\r\n")) != NULL) break;
    }
    if (!end) { free(hdr); closesocket(s); return; }
    *end = 0;
    char *body_start = end + 4; size_t already = hn - (size_t)(body_start - hdr);
    /* riga di richiesta */
    char *line = hdr, *nl = strstr(line, "\r\n");
    if (nl) *nl = 0;
    char target[2048] = "";
    if (sscanf(line, "%7s %2047s", r.method, target) != 2) { free(hdr); closesocket(s); return; }
    char *q = strchr(target, '?'); if (q) { if (strstr(q, "forza=1")) r.forza = 1; snprintf(r.query, sizeof r.query, "%s", q + 1); *q = 0; }
    snprintf(r.path, sizeof r.path, "%s", target);
    /* intestazioni */
    char *h = nl ? nl + 2 : NULL;
    while (h && *h) {
        char *e = strstr(h, "\r\n"); if (e) *e = 0;
        char *colon = strchr(h, ':');
        if (colon) {
            *colon = 0; char *v = colon + 1; while (*v == ' ' || *v == '\t') v++;
            lower(h);
            if (!strcmp(h, "host")) { snprintf(r.host, sizeof r.host, "%s", v); lower(r.host); }
            else if (!strcmp(h, "origin")) snprintf(r.origin, sizeof r.origin, "%s", v);
            else if (!strcmp(h, "content-type")) { snprintf(r.ctype, sizeof r.ctype, "%s", v); char *sc = strchr(r.ctype, ';'); if (sc) *sc = 0; lower(r.ctype); char *t = r.ctype + strlen(r.ctype); while (t > r.ctype && t[-1] == ' ') *--t = 0; }
            else if (!strcmp(h, "content-length")) r.clen = _atoi64(v);
            else if (!strcmp(h, "cookie")) snprintf(r.cookie, sizeof r.cookie, "%s", v);
        }
        h = e ? e + 2 : NULL;
    }
    if (!strcmp(r.method, "HEAD")) { r.head_only = 1; strcpy(r.method, "GET"); }
    if (ospite) {
        /* tablet dell'aula: rete locale, Host, codice/sessione e lista bianca (pd_tablet.c) */
        if (!tablet_ingresso(&r)) goto out;
    } else if (!host_ok(&r)) { send_error(&r, 403, "host non consentito"); goto out; }
    InterlockedExchange(&G.last_seen, (LONG)GetTickCount());
    if (!strcmp(r.method, "POST")) {
        if (!ospite && !origin_ok(&r)) { send_error(&r, 403, "origine non consentita"); goto out; }
        size_t limit = !strcmp(r.path, "/api/stt") ? PD_MAX_BODY : nonni_limite(r.path) ? nonni_limite(r.path) : PD_MAX_JSON + 64 * 1024;
        if (r.clen < 0 || (unsigned long long)r.clen > limit) { send_error(&r, 400, "richiesta troppo grande"); goto out; }
        r.body = (char *)malloc((size_t)r.clen + 1);
        if (!r.body) { send_error(&r, 500, "memoria insufficiente"); goto out; }
        size_t take = already > (size_t)r.clen ? (size_t)r.clen : already;
        memcpy(r.body, body_start, take);
        if ((size_t)r.clen > take && !recv_all(s, r.body + take, (size_t)r.clen - take)) goto out;
        r.body_len = (size_t)r.clen; r.body[r.body_len] = 0;
    } else if (strcmp(r.method, "GET")) { send_error(&r, 405, "metodo non consentito"); goto out; }

    if (!strncmp(r.path, "/api/", 5)) handle_api(&r);
    else if (!strcmp(r.method, "GET")) handle_static(&r);
    else send_error(&r, 404, "API sconosciuta");
    if (!r.sent) send_error(&r, 500, "nessuna risposta");
out:
    shutdown(s, SD_SEND);
    { char drain[512]; DWORD t2 = 200; setsockopt(s, SOL_SOCKET, SO_RCVTIMEO, (const char *)&t2, sizeof t2); while (recv(s, drain, sizeof drain, 0) > 0) {} }
    closesocket(s);
    free(r.body);
    free(hdr);
}
static unsigned __stdcall conn_thread(void *arg) { serve_conn((SOCKET)(UINT_PTR)arg, 0); return 0; }
unsigned __stdcall http_conn_ospite(void *arg) { serve_conn((SOCKET)(UINT_PTR)arg, 1); return 0; }

static unsigned __stdcall accept_thread(void *arg) {
    (void)arg;
    for (;;) {
        SOCKET c = accept(g_listen, NULL, NULL);
        if (c == INVALID_SOCKET) { if (WSAGetLastError() == WSAEINTR || WSAGetLastError() == WSAENOTSOCK) break; Sleep(20); continue; }
        HANDLE t = (HANDLE)_beginthreadex(NULL, 256 * 1024, conn_thread, (void *)(UINT_PTR)c, 0, NULL);
        if (t) CloseHandle(t); else closesocket(c);
    }
    return 0;
}

int http_server_start(int port_from) {
    WSADATA w;
    if (WSAStartup(MAKEWORD(2, 2), &w)) return 0;
    for (int port = port_from; port < port_from + 30; port++) {
        SOCKET s = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
        if (s == INVALID_SOCKET) return 0;
        BOOL excl = TRUE;   /* nessun altro programma puo' "rubare" la porta */
        setsockopt(s, SOL_SOCKET, SO_EXCLUSIVEADDRUSE, (const char *)&excl, sizeof excl);
        struct sockaddr_in a; memset(&a, 0, sizeof a);
        a.sin_family = AF_INET; a.sin_port = htons((u_short)port); a.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
        if (bind(s, (struct sockaddr *)&a, sizeof a) == 0 && listen(s, 64) == 0) {
            g_listen = s; G.port = port;
            HANDLE t = (HANDLE)_beginthreadex(NULL, 0, accept_thread, NULL, 0, NULL);
            if (t) CloseHandle(t);
            return port;
        }
        closesocket(s);
    }
    return 0;
}
