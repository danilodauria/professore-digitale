/* ==============================================================================
 *  PROFESSORE DIGITALE per Windows - intestazione comune
 *  Server locale nativo (C, API Win32), compatibile da Windows XP SP3 a Windows 11.
 *  Ideato e sviluppato da Danilo D'Auria - Licenza MIT
 *
 *  Regole (vedi CLAUDE.md): niente dipendenze esterne a runtime, ascolto solo su
 *  127.0.0.1, controllo Host/Origin, nessuna connessione a Internet se non su
 *  richiesta esplicita dell'utente, ogni file scaricato verificato con SHA-256.
 *  Le funzioni usate devono esistere in Windows XP SP3: quelle piu' recenti
 *  (DXGI, RtlGetVersion, SHGetKnownFolderPath...) si caricano con GetProcAddress.
 * ============================================================================== */
#ifndef PD_H
#define PD_H

#ifndef _WIN32_WINNT
#define _WIN32_WINNT 0x0501
#endif
#ifndef WINVER
#define WINVER 0x0501
#endif
#ifndef UNICODE
#define UNICODE
#endif
#ifndef _UNICODE
#define _UNICODE
#endif
#define WIN32_LEAN_AND_MEAN
#include <winsock2.h>
#include <windows.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdarg.h>
#include <wchar.h>
#include <process.h>
#include <ctype.h>

#define PD_APP_NAME      L"Professore Digitale"
#define PD_APP_DIR       L"ProfessoreDigitale"
#define PD_DEFAULT_PORT  8765
#define PD_MAX_BODY      (8u * 1024u * 1024u)     /* audio del microfono */
#define PD_MAX_JSON      (2u * 1024u * 1024u)
#define PD_MAX_PACK      (2u * 1024u * 1024u)

/* ------------------------------------------------------------------ buffer */
typedef struct { char *p; size_t n, cap; } buf_t;
void   buf_init(buf_t *b);
void   buf_free(buf_t *b);
int    buf_reserve(buf_t *b, size_t extra);
int    buf_add(buf_t *b, const void *data, size_t n);
int    buf_adds(buf_t *b, const char *s);
int    buf_addf(buf_t *b, const char *fmt, ...);
char  *buf_steal(buf_t *b);                       /* restituisce la stringa (terminata da 0) */

/* ------------------------------------------------------------------ JSON */
typedef enum { J_NULL, J_FALSE, J_TRUE, J_NUM, J_STR, J_ARR, J_OBJ } jtype;
typedef struct jv {
    jtype t;
    double num;
    int is_int;                 /* numero scritto senza parte decimale/esponente */
    char *str; size_t slen;     /* stringa decodificata (UTF-8) */
    struct jv **items;          /* elementi di array/oggetto */
    char **keys;                /* chiavi (solo oggetti) */
    size_t n, cap;
    const char *raw; size_t rawlen;   /* testo originale del valore */
} jv;
jv   *json_parse(const char *s, size_t n, char *err, size_t errn);
void  json_free(jv *v);
jv   *jget(const jv *obj, const char *key);
const char *jstr(const jv *obj, const char *key, const char *def);
double jnum(const jv *obj, const char *key, double def);
int   jbool(const jv *obj, const char *key, int def);
void  json_str(buf_t *b, const char *s);          /* "stringa" con escape */
void  json_strn(buf_t *b, const char *s, size_t n);
void  json_write(buf_t *b, const jv *v, int indent, int level);
/* oggetto costruito al volo */
jv   *jnew(jtype t);
void  jadd(jv *container, const char *key, jv *val);
jv   *jnew_str(const char *s);
jv   *jnew_num(double d);

/* ------------------------------------------------------------------ utilita' */
wchar_t *u8to16(const char *s);                   /* malloc */
char    *u16to8(const wchar_t *s);                /* malloc */
wchar_t *wcsdup_printf(const wchar_t *fmt, ...);
char    *strdup_printf(const char *fmt, ...);
int      file_read(const wchar_t *path, buf_t *out, size_t limit);
int      file_write_atomic(const wchar_t *path, const void *data, size_t n);
int      file_exists(const wchar_t *path);
int      dir_exists(const wchar_t *path);
int      mkdirs(const wchar_t *path);
int      rmtree(const wchar_t *path);
long long file_size(const wchar_t *path);
wchar_t *path_join(const wchar_t *a, const wchar_t *b);
int      sha256_file(const wchar_t *path, char hex[65]);
void     sha256_hex(const void *data, size_t n, char hex[65]);
int      version_cmp(const char *a, const char *b);
int      re_id(const char *s);                    /* ^[a-z0-9][a-z0-9-]{1,48}$ */
int      re_ver(const char *s);                   /* ^\d+\.\d+(\.\d+)?$ */
int      re_ver3(const char *s);                  /* ^\d+\.\d+\.\d+$ */
int      re_sha(const char *s);                   /* 64 caratteri esadecimali minuscoli */
void     pd_log(const char *fmt, ...);
unsigned long long now_ms(void);
int      run_process(const wchar_t *cmdline, const wchar_t *cwd, const char *stdin_data, size_t stdin_len,
                     buf_t *out, DWORD timeout_ms, DWORD *exit_code, int hidden);
HANDLE   start_process(const wchar_t *cmdline, const wchar_t *cwd, int hidden, const wchar_t *env_extra);
wchar_t *quote_arg(const wchar_t *arg);

/* ------------------------------------------------------------------ percorsi e stato globale */
typedef struct {
    wchar_t install_dir[MAX_PATH];   /* cartella del programma */
    wchar_t web_dir[MAX_PATH];
    wchar_t data_dir[MAX_PATH];      /* %APPDATA%\ProfessoreDigitale  (dati dell'allievo) */
    wchar_t local_dir[MAX_PATH];     /* %LOCALAPPDATA%\ProfessoreDigitale (modelli, registro) */
    wchar_t models_dir[MAX_PATH];
    wchar_t user_packs[MAX_PATH];
    wchar_t system_packs[MAX_PATH];
    wchar_t local_packs[MAX_PATH];   /* %ProgramData%\ProfessoreDigitale\contenuti (tutti gli utenti) */
    char    version[32];
    char    update_url[1024];
    char    pagina[1024];
    char    ollama_host[256];        /* http://127.0.0.1:11434 */
    int     port;
    int     idle_timeout;            /* secondi, 0 = mai */
    volatile LONG last_seen;         /* GetTickCount dell'ultima richiesta */
    HWND    hwnd;                    /* finestra nascosta (icona nell'area di notifica) */
    CRITICAL_SECTION lock;
} pd_state;
extern pd_state G;

void paths_init(void);
wchar_t *downloads_dir(void);

/* ------------------------------------------------------------------ rete in uscita (WinHTTP) */
typedef int (*http_sink)(void *ctx, const char *data, size_t n);   /* ritorna 0 per interrompere */
typedef struct {
    int status;
    char content_type[128];
    long long content_length;
    char error[256];
} http_result;
int http_request(const char *method, const char *url, const char *ctype, const char *body, size_t body_len,
                 int timeout_s, http_sink sink, void *ctx, http_result *res);
int http_get_mem(const char *url, size_t limit, int timeout_s, buf_t *out, http_result *res);
int http_download(const char *url, const wchar_t *dest, int timeout_s, volatile LONG *cancel,
                  void (*progress)(void *ctx, long long done, long long total), void *ctx,
                  http_result *res);
int url_allowed(const char *url);                 /* https ovunque, http solo in rete locale */
int url_is_local_host(const char *url);

/* ------------------------------------------------------------------ server HTTP */
typedef struct {
    SOCKET s;
    char method[8];
    char path[2048];
    char host[256];
    char origin[256];
    char ctype[128];
    long long clen;
    char *body; size_t body_len;
    int head_only;
    int sent;
    int forza;                       /* ?forza=1 nella richiesta */
    int ospite;                      /* richiesta di un tablet dell'aula (pd_tablet.c) */
    char ip[48];                     /* indirizzo di chi chiede */
    char local[48];                  /* indirizzo di questo PC su cui e' arrivata la connessione */
    char cookie[512];
    char query[512];
    char token[40];                  /* sessione del tablet (dal cookie) */
} req_t;
int  http_server_start(int port_from);
void send_raw(req_t *r, const char *data, size_t n);
void send_response(req_t *r, int code, const char *ctype, const void *body, size_t n, const char *extra_headers);
void send_json(req_t *r, int code, buf_t *json);
void send_error(req_t *r, int code, const char *msg);
void send_ok(req_t *r);
void handle_api(req_t *r);
void handle_static(req_t *r);
unsigned __stdcall http_conn_ospite(void *arg);  /* connessione arrivata sull'ascolto dei tablet */

/* ------------------------------------------------------------------ componenti */
/* hardware */
typedef struct {
    int os_major, os_minor, os_build, os_sp;
    char os_name[128];
    char os_display[64];             /* es. 22H2 */
    int is64os, arm64;
    int cpus;
    char cpu[160];
    int sse2, avx, avx2, fma;
    long long ram_mb;
    char gpu[160];
    int gpu_vendor;                   /* 0x10DE NVIDIA, 0x1002 AMD, 0x8086 Intel */
    long long vram_mb;
    int gpu_discrete;
    long long disk_free_mb;
} pd_hw;
void hw_detect(pd_hw *h);
void hw_json(buf_t *b, const pd_hw *h);

/* IA */
void ai_init(void);
void ai_shutdown(void);
int  ai_status_json(buf_t *b);             /* scrive "ai": {...} */
void ai_chat(req_t *r, jv *req);
int  ai_ollama_installed(wchar_t *exe, size_t n);
int  ai_ollama_alive(void);
void ai_reload_config(void);

/* voce */
void tts_engines_json(buf_t *b);
int  tts_engine_count(void);
int  tts_synthesize(const char *text, double rate, const char *engine, const char *voice, buf_t *wav, char *used, size_t usedn, char *err, size_t errn);
void tts_voices_json(buf_t *b);
void tts_init(void);
int  tts_has_piper(void);
void tts_invalidate(void);
int  sapi_italian_voices(buf_t *names_json);
void stt_status(char *engine, size_t en, char *detail, size_t dn, int force);
int  stt_transcribe(const char *wav, size_t n, buf_t *text_json, char *err, size_t errn);

/* aula (rete locale) e connessione */
void aula_init(void);
int  aula_facilitatore(void);
void aula_api(req_t *r, const char *azione, jv *req);
void aula_rete_json(buf_t *b, int forza);
int  aula_indirizzi(char ips[][20], int max);    /* IPv4 di questo PC */
int  aula_codice_facilitatore(char *codice, size_t n);   /* 1 se questo PC e' il facilitatore */
int  aula_ricevi(const char *body, size_t n, const char *ip, buf_t *out);   /* come /aula/ciao */

/* condivisione con i tablet dell'aula (spenta se non la si accende dal PC) */
void tablet_init(void);
void tablet_api(req_t *r, jv *req);              /* GET/POST /api/tablet, solo dal PC */
int  tablet_ingresso(req_t *r);                  /* tablet: 1 = si prosegue, 0 = risposta gia' inviata */
void tablet_presenza(req_t *r, jv *req);         /* POST /api/ospite/presenza */
int  tablet_posto(int chat);                     /* limite di richieste insieme (IA o voce): 1 = c'e' posto */
void tablet_libera(int chat);

/* configurazione guidata */
void setup_api(req_t *r, const char *path);
void setup_plan_json(buf_t *b);
const char *setup_recommended_model(void);

/* Nonni Teach (3.6): interviste, podcast e sito (pd_nonni.c) */
void   nonni_api(req_t *r, int post);
size_t nonni_limite(const char *path);   /* corpo massimo per audio e .cdbackup, 0 = normale */

/* zip */
int unzip_to(const wchar_t *zip, const wchar_t *dest, volatile LONG *cancel, char *err, size_t errn);

/* browser */
int  open_app_window(const char *hash);
void request_quit(void);
void tray_notify(const wchar_t *title, const wchar_t *msg);

#endif
