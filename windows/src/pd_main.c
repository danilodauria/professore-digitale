/* ==============================================================================
 *  PROFESSORE DIGITALE per Windows - avvio, unica istanza, icona nell'area di
 *  notifica, apertura della finestra dell'applicazione nel browser.
 *  ProfessoreDigitale.exe [--configura] [--no-browser] [--status] [--stop]
 *                         [--version] [--port N] [--idle-timeout S]
 *  Ideato e sviluppato da Danilo D'Auria - Tecnico IT & Divulgatore Digitale per il Sociale
 *  Licenza MIT
 * ============================================================================== */
#include "pd.h"
#include <shlobj.h>
#include <shellapi.h>

pd_state G;
int setup_busy(void);

#define WM_PD_TRAY (WM_APP + 1)
#define IDM_OPEN 1
#define IDM_SETUP 2
#define IDM_MANUAL 3
#define IDM_DATA 4
#define IDM_QUIT 9

static NOTIFYICONDATAW g_nid;
static HANDLE g_quit = NULL;          /* chiusura richiesta (anche senza finestra, es. sessione senza desktop) */
void request_quit(void) { if (g_quit) SetEvent(g_quit); }
static int g_console = 0;

/* ------------------------------------------------------------------ percorsi */
static void env_or(wchar_t *dst, const wchar_t *env, const wchar_t *fallback) {
    wchar_t *e = _wgetenv(env);
    wcsncpy(dst, e && *e ? e : fallback, MAX_PATH - 1); dst[MAX_PATH - 1] = 0;
}
static void folder(int csidl, wchar_t *out) {
    out[0] = 0;
    if (FAILED(SHGetFolderPathW(NULL, csidl | CSIDL_FLAG_CREATE, NULL, 0, out))) {
        wchar_t *up = _wgetenv(L"USERPROFILE"); wcsncpy(out, up ? up : L"C:\\", MAX_PATH - 1);
    }
}

static void read_small(const wchar_t *p, char *out, size_t n) {
    buf_t b; out[0] = 0;
    if (file_read(p, &b, 4096)) { snprintf(out, n, "%s", b.p); buf_free(&b); }
    for (char *c = out; *c; c++) if (*c == '\r' || *c == '\n' || *c == ' ') { *c = 0; break; }
}

void paths_init(void) {
    wchar_t self[MAX_PATH];
    GetModuleFileNameW(NULL, self, MAX_PATH);
    wchar_t *sl = wcsrchr(self, L'\\'); if (sl) *sl = 0;
    wcsncpy(G.install_dir, self, MAX_PATH - 1);
    wchar_t tmp[MAX_PATH];
    _snwprintf(tmp, MAX_PATH, L"%ls\\web", G.install_dir); tmp[MAX_PATH - 1] = 0;
    env_or(G.web_dir, L"PD_WEB_DIR", tmp);
    /* versione "da chiavetta": con il file portatile.txt accanto al programma i dati restano sulla chiavetta */
    wchar_t *port = path_join(G.install_dir, L"portatile.txt");
    int portable = file_exists(port) && !_wgetenv(L"PD_DATA_DIR");
    free(port);
    if (portable) _snwprintf(tmp, MAX_PATH, L"%ls\\dati", G.install_dir);
    else { folder(CSIDL_APPDATA, tmp); wcsncat(tmp, L"\\" PD_APP_DIR, MAX_PATH - wcslen(tmp) - 1); }
    tmp[MAX_PATH - 1] = 0;
    env_or(G.data_dir, L"PD_DATA_DIR", tmp);
    if ((portable || _wgetenv(L"PD_DATA_DIR")) && !_wgetenv(L"PD_LOCAL_DIR")) _snwprintf(tmp, MAX_PATH, L"%ls\\locale", G.data_dir);
    else { folder(CSIDL_LOCAL_APPDATA, tmp); wcsncat(tmp, L"\\" PD_APP_DIR, MAX_PATH - wcslen(tmp) - 1); }
    tmp[MAX_PATH - 1] = 0;
    env_or(G.local_dir, L"PD_LOCAL_DIR", tmp);
    _snwprintf(G.models_dir, MAX_PATH, L"%ls\\models", G.local_dir);
    _snwprintf(G.user_packs, MAX_PATH, L"%ls\\contenuti", G.data_dir);
    _snwprintf(tmp, MAX_PATH, L"%ls\\contenuti", G.install_dir); tmp[MAX_PATH - 1] = 0;
    env_or(G.system_packs, L"PD_SYSTEM_PACKS", tmp);
    folder(CSIDL_COMMON_APPDATA, tmp); wcsncat(tmp, L"\\" PD_APP_DIR L"\\contenuti", MAX_PATH - wcslen(tmp) - 1);
    env_or(G.local_packs, L"PD_LOCAL_PACKS", tmp);
    mkdirs(G.data_dir); mkdirs(G.local_dir);

    wchar_t *vp = path_join(G.install_dir, L"VERSION");
    read_small(vp, G.version, sizeof G.version);
    free(vp);
    if (!re_ver3(G.version)) snprintf(G.version, sizeof G.version, "0.0.0");
    snprintf(G.update_url, sizeof G.update_url, "https://raw.githubusercontent.com/danilodauria/professore-digitale/main/aggiornamenti.json");
    wchar_t *dp = path_join(G.install_dir, L"distribuzione.json");
    buf_t b; char e[64];
    if (file_read(dp, &b, 65536)) {
        jv *v = json_parse(b.p, b.n, e, sizeof e);
        if (v) {
            const char *u = jstr(v, "aggiornamenti_url", ""); if (*u) snprintf(G.update_url, sizeof G.update_url, "%s", u);
            snprintf(G.pagina, sizeof G.pagina, "%s", jstr(v, "pagina", ""));
            json_free(v);
        }
        buf_free(&b);
    }
    free(dp);
    const char *oh = getenv("OLLAMA_HOST");
    if (oh && *oh) snprintf(G.ollama_host, sizeof G.ollama_host, "%s%s", strncmp(oh, "http", 4) ? "http://" : "", oh);
    else snprintf(G.ollama_host, sizeof G.ollama_host, "http://127.0.0.1:11434");
    size_t L = strlen(G.ollama_host); while (L && G.ollama_host[L - 1] == '/') G.ollama_host[--L] = 0;
}

typedef HRESULT (WINAPI *SHGetKnownFolderPath_t)(const GUID *, DWORD, HANDLE, PWSTR *);
wchar_t *downloads_dir(void) {
    wchar_t *e = _wgetenv(L"PD_DOWNLOAD_DIR");
    if (e && *e) { mkdirs(e); return _wcsdup(e); }
    static const GUID FOLDERID_Downloads_PD = { 0x374de290, 0x123f, 0x4565, { 0x91, 0x64, 0x39, 0xc4, 0x92, 0x5e, 0x46, 0x7b } };
    SHGetKnownFolderPath_t f = (SHGetKnownFolderPath_t)(void *)GetProcAddress(GetModuleHandleW(L"shell32.dll"), "SHGetKnownFolderPath");
    if (f) { PWSTR p = NULL; if (SUCCEEDED(f(&FOLDERID_Downloads_PD, 0, NULL, &p)) && p) { wchar_t *r = _wcsdup(p); CoTaskMemFree(p); return r; } }
    wchar_t *up = _wgetenv(L"USERPROFILE");
    if (up) { wchar_t *d = path_join(up, L"Downloads"); if (dir_exists(d)) return d; free(d); }
    wchar_t desk[MAX_PATH]; folder(CSIDL_DESKTOPDIRECTORY, desk);   /* Windows XP: niente cartella Download */
    return _wcsdup(desk);
}

/* ------------------------------------------------------------------ console (per --status, --version) */
static void attach_console(void) {
    if (g_console) return;
    if (AttachConsole((DWORD)-1)) { freopen("CONOUT$", "w", stdout); freopen("CONOUT$", "w", stderr); }
    g_console = 1;
}
static void say(const char *fmt, ...) {
    char m[4096]; va_list ap; va_start(ap, fmt); vsnprintf(m, sizeof m, fmt, ap); va_end(ap);
    attach_console();
    fputs(m, stdout); fflush(stdout);
}

/* ------------------------------------------------------------------ istanza gia' attiva */
static wchar_t *runtime_path(void) { return path_join(G.local_dir, L"runtime.json"); }
static int running_port(char *version, size_t vn) {
    wchar_t *p = runtime_path(); buf_t b; char e[64]; int port = 0;
    if (file_read(p, &b, 4096)) {
        jv *v = json_parse(b.p, b.n, e, sizeof e);
        if (v) { port = (int)jnum(v, "port", 0); snprintf(version, vn, "%s", jstr(v, "version", "")); json_free(v); }
        buf_free(&b);
    }
    free(p);
    if (port <= 0) return 0;
    char url[64]; snprintf(url, sizeof url, "http://127.0.0.1:%d/api/heartbeat", port);
    http_result r; char origin_ok = 1; (void)origin_ok;
    if (!http_request("POST", url, "application/json", "{}", 2, 3, NULL, NULL, &r) || r.status != 200) return 0;
    return port;
}
static void write_runtime(void) {
    char j[160]; snprintf(j, sizeof j, "{\"port\": %d, \"pid\": %lu, \"version\": \"%s\"}", G.port, (unsigned long)GetCurrentProcessId(), G.version);
    wchar_t *p = runtime_path(); file_write_atomic(p, j, strlen(j)); free(p);
}
static void remove_runtime(void) {
    wchar_t *p = runtime_path(); buf_t b; char e[64];
    if (file_read(p, &b, 4096)) {
        jv *v = json_parse(b.p, b.n, e, sizeof e);
        if (v && (DWORD)jnum(v, "pid", 0) == GetCurrentProcessId()) DeleteFileW(p);
        json_free(v); buf_free(&b);
    }
    free(p);
}

/* ------------------------------------------------------------------ browser */
static int app_path(const wchar_t *exe, wchar_t *out) {
    HKEY roots[2] = { HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE };
    REGSAM views[2] = { 0x0100, 0x0200 };   /* KEY_WOW64_64KEY, KEY_WOW64_32KEY */
    wchar_t key[300]; _snwprintf(key, 300, L"SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\%ls", exe); key[299] = 0;
    for (int r = 0; r < 2; r++) for (int v = 0; v < 2; v++) {
        HKEY h;
        if (RegOpenKeyExW(roots[r], key, 0, KEY_READ | views[v], &h) != ERROR_SUCCESS && (v || RegOpenKeyExW(roots[r], key, 0, KEY_READ, &h) != ERROR_SUCCESS)) continue;
        wchar_t val[MAX_PATH]; DWORD sz = sizeof val - 2, type;
        int ok = RegQueryValueExW(h, NULL, NULL, &type, (BYTE *)val, &sz) == ERROR_SUCCESS;
        RegCloseKey(h);
        if (ok) {
            val[sz / 2] = 0;
            wchar_t *s = val; if (*s == L'"') { s++; wchar_t *q = wcschr(s, L'"'); if (q) *q = 0; }
            wchar_t ex[MAX_PATH]; ExpandEnvironmentStringsW(s, ex, MAX_PATH);
            if (file_exists(ex)) { wcsncpy(out, ex, MAX_PATH - 1); out[MAX_PATH - 1] = 0; return 1; }
        }
    }
    return 0;
}
static int try_path(const wchar_t *base_env, const wchar_t *rest, wchar_t *out) {
    wchar_t *b = _wgetenv(base_env);
    if (!b) return 0;
    _snwprintf(out, MAX_PATH, L"%ls\\%ls", b, rest); out[MAX_PATH - 1] = 0;
    return file_exists(out);
}
static int find_supermium(wchar_t *out) {
    return try_path(L"ProgramFiles", L"Supermium\\chrome.exe", out) || try_path(L"ProgramFiles(x86)", L"Supermium\\chrome.exe", out) ||
           try_path(L"LOCALAPPDATA", L"Supermium\\Application\\chrome.exe", out) || try_path(L"ProgramFiles", L"Supermium\\Application\\chrome.exe", out);
}
static int is_chromium(const wchar_t *exe) {
    wchar_t low[MAX_PATH]; wcsncpy(low, exe, MAX_PATH - 1); low[MAX_PATH - 1] = 0; _wcslwr(low);
    return wcsstr(low, L"chrome") || wcsstr(low, L"msedge") || wcsstr(low, L"brave") || wcsstr(low, L"chromium") ||
           wcsstr(low, L"vivaldi") || wcsstr(low, L"supermium") || wcsstr(low, L"thorium");
}

static int launch(const wchar_t *exe, const wchar_t *args) {
    wchar_t *q = quote_arg(exe), *cl = wcsdup_printf(L"%ls %ls", q, args);
    STARTUPINFOW si; PROCESS_INFORMATION pi; memset(&si, 0, sizeof si); si.cb = sizeof si;
    BOOL ok = CreateProcessW(NULL, cl, NULL, NULL, FALSE, 0, NULL, NULL, &si, &pi);
    if (ok) { CloseHandle(pi.hThread); CloseHandle(pi.hProcess); }
    free(q); free(cl);
    return ok;
}

int open_app_window(const char *hash) {
    char url8[300]; snprintf(url8, sizeof url8, "http://127.0.0.1:%d/%s", G.port, hash ? hash : "");
    wchar_t *url = u8to16(url8);
    wchar_t exe[MAX_PATH] = L"";
    wchar_t *pref = _wgetenv(L"PD_BROWSER");
    int found = 0;
    if (pref && *pref) {
        if (file_exists(pref)) { wcsncpy(exe, pref, MAX_PATH - 1); found = 1; }
        else { wchar_t n[80]; _snwprintf(n, 80, L"%ls.exe", pref); n[79] = 0; found = app_path(n, exe); }
    }
    pd_hw h; memset(&h, 0, sizeof h);
    OSVERSIONINFOW v; memset(&v, 0, sizeof v); v.dwOSVersionInfoSize = sizeof v; GetVersionExW(&v);
    int old_win = v.dwMajorVersion < 6 || (v.dwMajorVersion == 6 && v.dwMinorVersion == 0);
    if (!found && old_win) found = find_supermium(exe);
    if (!found) found = app_path(L"msedge.exe", exe) || app_path(L"chrome.exe", exe) || find_supermium(exe) ||
                        app_path(L"brave.exe", exe) || app_path(L"vivaldi.exe", exe) || app_path(L"chromium.exe", exe);
    int ok = 0;
    if (found && is_chromium(exe)) {
        /* finestra "da applicazione", senza barre, con un profilo dedicato (ricorda il permesso del microfono) */
        wchar_t prof[MAX_PATH]; _snwprintf(prof, MAX_PATH, L"%ls\\browser", G.local_dir); prof[MAX_PATH - 1] = 0;
        wchar_t *qp = quote_arg(prof);
        wchar_t *args = wcsdup_printf(L"--app=%ls --user-data-dir=%ls --no-first-run --no-default-browser-check --start-maximized "
                                      L"--disable-features=Translate --autoplay-policy=no-user-gesture-required%ls",
                                      url, qp, old_win ? L" --disable-gpu-rasterization" : L"");
        ok = launch(exe, args);
        free(qp); free(args);
    }
    if (!ok) {
        wchar_t ff[MAX_PATH];
        if ((found && !is_chromium(exe) && wcsncpy(ff, exe, MAX_PATH)) || app_path(L"firefox.exe", ff)) {
            wchar_t *args = wcsdup_printf(L"-new-window %ls", url);
            ok = launch(ff, args); free(args);
        }
    }
    if (!ok) ok = (INT_PTR)ShellExecuteW(NULL, L"open", url, NULL, NULL, SW_SHOWNORMAL) > 32;
    free(url);
    return ok;
}

/* ------------------------------------------------------------------ icona nell'area di notifica */
void tray_notify(const wchar_t *title, const wchar_t *msg) {
    if (!g_nid.hWnd) return;
    g_nid.uFlags = NIF_INFO;
    wcsncpy(g_nid.szInfoTitle, title, 63); wcsncpy(g_nid.szInfo, msg, 255);
    g_nid.dwInfoFlags = NIIF_INFO;
    Shell_NotifyIconW(NIM_MODIFY, &g_nid);
}

static void open_manual(void) {
    wchar_t *p = path_join(G.web_dir, L"docs\\Vademecum_Professore_Digitale_Windows.pdf");
    if (!file_exists(p)) { free(p); p = path_join(G.install_dir, L"Vademecum_Professore_Digitale_Windows.pdf"); }
    ShellExecuteW(NULL, L"open", p, NULL, NULL, SW_SHOWNORMAL);
    free(p);
}

static void quit_app(HWND hwnd) {
    (void)hwnd;
    request_quit();
}

static LRESULT CALLBACK wndproc(HWND hwnd, UINT msg, WPARAM wp, LPARAM lp) {
    switch (msg) {
    case WM_PD_TRAY:
        if (lp == WM_LBUTTONDBLCLK || lp == WM_LBUTTONUP) { InterlockedExchange(&G.last_seen, (LONG)GetTickCount()); open_app_window(""); }
        else if (lp == WM_RBUTTONUP || lp == WM_CONTEXTMENU) {
            HMENU m = CreatePopupMenu();
            AppendMenuW(m, MF_STRING | MF_DEFAULT, IDM_OPEN, L"Apri il Professore Digitale");
            AppendMenuW(m, MF_STRING, IDM_SETUP, L"Configura IA e voce");
            AppendMenuW(m, MF_STRING, IDM_MANUAL, L"Vademecum (PDF)");
            AppendMenuW(m, MF_STRING, IDM_DATA, L"Cartella dei progressi");
            AppendMenuW(m, MF_SEPARATOR, 0, NULL);
            AppendMenuW(m, MF_STRING, IDM_QUIT, L"Chiudi il Professore Digitale");
            POINT pt; GetCursorPos(&pt);
            SetForegroundWindow(hwnd);
            int cmd = TrackPopupMenu(m, TPM_RETURNCMD | TPM_RIGHTBUTTON, pt.x, pt.y, 0, hwnd, NULL);
            DestroyMenu(m);
            PostMessageW(hwnd, WM_NULL, 0, 0);
            InterlockedExchange(&G.last_seen, (LONG)GetTickCount());
            if (cmd == IDM_OPEN) open_app_window("");
            else if (cmd == IDM_SETUP) open_app_window("#/setup");
            else if (cmd == IDM_MANUAL) open_manual();
            else if (cmd == IDM_DATA) ShellExecuteW(NULL, L"open", G.data_dir, NULL, NULL, SW_SHOWNORMAL);
            else if (cmd == IDM_QUIT) quit_app(hwnd);
        }
        return 0;
    case WM_CLOSE: quit_app(hwnd); return 0;
    case WM_QUERYENDSESSION: return TRUE;
    case WM_ENDSESSION: if (wp) { ai_shutdown(); remove_runtime(); } return 0;
    }
    return DefWindowProcW(hwnd, msg, wp, lp);
}

static void create_window(HINSTANCE inst, int tray) {
    WNDCLASSW wc; memset(&wc, 0, sizeof wc);
    wc.lpfnWndProc = wndproc; wc.hInstance = inst; wc.lpszClassName = L"ProfessoreDigitaleServer";
    RegisterClassW(&wc);
    G.hwnd = CreateWindowExW(0, wc.lpszClassName, PD_APP_NAME, 0, 0, 0, 0, 0, NULL, NULL, inst, NULL);
    if (!G.hwnd) G.hwnd = CreateWindowExW(0, wc.lpszClassName, PD_APP_NAME, 0, 0, 0, 0, 0, HWND_MESSAGE, NULL, inst, NULL);
    if (!G.hwnd) { pd_log("finestra di servizio non creata: niente icona nell'area di notifica"); return; }
    if (!tray) return;
    memset(&g_nid, 0, sizeof g_nid);
    g_nid.cbSize = sizeof g_nid;
    g_nid.hWnd = G.hwnd; g_nid.uID = 1;
    g_nid.uFlags = NIF_ICON | NIF_TIP | NIF_MESSAGE;
    g_nid.uCallbackMessage = WM_PD_TRAY;
    g_nid.hIcon = (HICON)LoadImageW(inst, MAKEINTRESOURCEW(1), IMAGE_ICON, GetSystemMetrics(SM_CXSMICON), GetSystemMetrics(SM_CYSMICON), 0);
    if (!g_nid.hIcon) g_nid.hIcon = LoadIconW(NULL, (LPCWSTR)IDI_APPLICATION);
    _snwprintf(g_nid.szTip, 63, L"Professore Digitale %hs – attivo", G.version);
    Shell_NotifyIconW(NIM_ADD, &g_nid);
    /* la prima volta spieghiamo dove trovare il Professore */
    wchar_t *flag = path_join(G.local_dir, L"benvenuto.ok");
    if (!file_exists(flag)) {
        tray_notify(L"Professore Digitale", L"Il Professore è attivo. Lo ritrovate qui, accanto all'orologio: clic per aprirlo, tasto destro per le altre funzioni.");
        file_write_atomic(flag, "1", 1);
    }
    free(flag);
}

/* ------------------------------------------------------------------ avvio */
int WINAPI wWinMain(HINSTANCE inst, HINSTANCE prev, PWSTR cmdline, int show) {
    (void)prev; (void)cmdline; (void)show;
    memset(&G, 0, sizeof G);
    InitializeCriticalSection(&G.lock);
    SetErrorMode(SEM_FAILCRITICALERRORS | SEM_NOOPENFILEERRORBOX);
    paths_init();
    int argc = 0;
    wchar_t **argv = CommandLineToArgvW(GetCommandLineW(), &argc);
    int no_browser = 0, want_status = 0, want_stop = 0, port = PD_DEFAULT_PORT, tray = 1;
    const char *hash = "";
    G.idle_timeout = 240;
    wchar_t *ep = _wgetenv(L"PD_PORT"); if (ep) port = _wtoi(ep);
    for (int i = 1; i < argc; i++) {
        const wchar_t *a = argv[i];
        if (!wcscmp(a, L"--version") || !wcscmp(a, L"-v")) { say("Professore Digitale %s\n", G.version); return 0; }
        else if (!wcscmp(a, L"--help") || !wcscmp(a, L"/?")) {
            say("Professore Digitale %s - cattedra digitale offline\n"
                "  ProfessoreDigitale.exe              apre il Professore (o la finestra già attiva)\n"
                "  ProfessoreDigitale.exe --configura  apre la configurazione di IA e voce\n"
                "  --status        stato di IA, voce, microfono\n"
                "  --stop          chiude il Professore\n"
                "  --no-browser    avvia solo il server interno\n"
                "  --port N        porta del server interno (predefinita 8765)\n"
                "  --idle-timeout S  secondi di inattività prima della chiusura (0 = mai)\n", G.version);
            return 0;
        }
        else if (!wcscmp(a, L"--status")) want_status = 1;
        else if (!wcscmp(a, L"--stop")) want_stop = 1;
        else if (!wcscmp(a, L"--no-browser") || !wcscmp(a, L"--server")) no_browser = 1;
        else if (!wcscmp(a, L"--no-tray")) tray = 0;
        else if (!wcscmp(a, L"--configura")) hash = "#/setup";
        else if (!wcscmp(a, L"--port") && i + 1 < argc) port = _wtoi(argv[++i]);
        else if (!wcscmp(a, L"--idle-timeout") && i + 1 < argc) G.idle_timeout = _wtoi(argv[++i]);
    }
    if (port < 1024 || port > 65000) port = PD_DEFAULT_PORT;

    char rv[32] = "";
    int rp = running_port(rv, sizeof rv);
    if (want_stop) {
        if (!rp) { say("Il Professore Digitale non è attivo.\n"); return 0; }
        char url[64]; snprintf(url, sizeof url, "http://127.0.0.1:%d/api/shutdown", rp);
        http_result r; http_request("POST", url, "application/json", "{}", 2, 5, NULL, NULL, &r);
        say("Professore Digitale chiuso.\n");
        return 0;
    }
    if (want_status) {
        if (rp) {
            char url[64]; snprintf(url, sizeof url, "http://127.0.0.1:%d/api/status", rp);
            buf_t b; http_result r;
            if (http_get_mem(url, 1u << 20, 10, &b, &r)) say("%s\n", b.p);
            buf_free(&b);
        } else {
            pd_hw h; hw_detect(&h); buf_t b; buf_init(&b); hw_json(&b, &h);
            say("Il Professore Digitale non è attivo. Versione %s\nComputer: %s\n", G.version, b.p);
            buf_free(&b);
        }
        return 0;
    }
    if (rp) {
        if (!strcmp(rv, G.version)) { G.port = rp; if (!no_browser) open_app_window(hash); return 0; }
        /* e' rimasta attiva una versione diversa (dopo un aggiornamento): la chiudiamo */
        char url[64]; snprintf(url, sizeof url, "http://127.0.0.1:%d/api/shutdown", rp);
        http_result r; http_request("POST", url, "application/json", "{}", 2, 5, NULL, NULL, &r);
        Sleep(1500);
    }
    HANDLE mtx = CreateMutexW(NULL, TRUE, L"Local\\ProfessoreDigitale-Server");
    if (GetLastError() == ERROR_ALREADY_EXISTS) {
        /* un altro avvio e' in corso: aspettiamo che sia pronto e apriamo la sua finestra */
        for (int i = 0; i < 40 && !(rp = running_port(rv, sizeof rv)); i++) Sleep(250);
        if (rp) { G.port = rp; if (!no_browser) open_app_window(hash); }
        return 0;
    }
    G.last_seen = (LONG)GetTickCount();
    if (!http_server_start(port)) {
        MessageBoxW(NULL, L"Il Professore Digitale non riesce ad avviarsi: nessuna porta libera sul computer.", PD_APP_NAME, MB_ICONERROR);
        return 2;
    }
    write_runtime();
    pd_log("Professore Digitale %s in ascolto su http://127.0.0.1:%d/", G.version, G.port);
    if (getenv("PD_DEBUG") || no_browser) { say("Professore Digitale %s in ascolto su http://127.0.0.1:%d/\n", G.version, G.port); }
    g_quit = CreateEventW(NULL, TRUE, FALSE, NULL);
    ai_init();
    aula_init();
    tablet_init();     /* condivisione con i tablet: solo se l'utente l'ha accesa su questo PC */
    tts_init();
    create_window(inst, tray && !getenv("PD_NO_TRAY"));
    if (!no_browser) open_app_window(hash);
    /* ciclo principale: messaggi dell'icona, richiesta di chiusura, spegnimento quando nessuno usa il Professore */
    for (;;) {
        DWORD w = MsgWaitForMultipleObjects(1, &g_quit, FALSE, 5000, QS_ALLINPUT);
        if (w == WAIT_OBJECT_0) break;
        MSG msg; int quit = 0;
        while (PeekMessageW(&msg, NULL, 0, 0, PM_REMOVE)) { if (msg.message == WM_QUIT) quit = 1; TranslateMessage(&msg); DispatchMessageW(&msg); }
        if (quit) break;
        DWORD idle = GetTickCount() - (DWORD)G.last_seen;
        if (G.idle_timeout > 0 && idle > (DWORD)G.idle_timeout * 1000u && !setup_busy() && !aula_facilitatore()) { pd_log("inattivo: spegnimento automatico"); break; }
    }
    pd_log("chiusura del Professore Digitale");
    if (g_nid.hWnd) Shell_NotifyIconW(NIM_DELETE, &g_nid);
    ai_shutdown();
    remove_runtime();
    if (mtx) { ReleaseMutex(mtx); CloseHandle(mtx); }
    LocalFree(argv);
    return 0;
}
