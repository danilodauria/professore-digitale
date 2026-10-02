/* Professore Digitale per Windows - lettura e scrittura JSON (RFC 8259), senza librerie esterne
 * Ideato e sviluppato da Danilo D'Auria - Licenza MIT */
#include "pd.h"
#include <math.h>

typedef struct { const char *s, *e, *p; char *err; size_t errn; int depth; } jp;

static void jerr(jp *p, const char *m) {
    if (p->err && !p->err[0]) snprintf(p->err, p->errn, "%s (posizione %d)", m, (int)(p->p - p->s));
}
static void ws(jp *p) { while (p->p < p->e && (*p->p == ' ' || *p->p == '\t' || *p->p == '\n' || *p->p == '\r')) p->p++; }

jv *jnew(jtype t) { jv *v = (jv *)calloc(1, sizeof(jv)); if (v) v->t = t; return v; }

static int push(jv *c, jv *item, char *key) {
    if (c->n == c->cap) {
        size_t nc = c->cap ? c->cap * 2 : 8;
        jv **ni = (jv **)realloc(c->items, nc * sizeof(jv *));
        if (!ni) return 0;
        c->items = ni;
        if (c->t == J_OBJ) {
            char **nk = (char **)realloc(c->keys, nc * sizeof(char *));
            if (!nk) return 0;
            c->keys = nk;
        }
        c->cap = nc;
    }
    c->items[c->n] = item;
    if (c->t == J_OBJ) c->keys[c->n] = key;
    c->n++;
    return 1;
}

static void put_utf8(buf_t *b, unsigned cp) {
    char t[4];
    if (cp < 0x80) { t[0] = (char)cp; buf_add(b, t, 1); }
    else if (cp < 0x800) { t[0] = (char)(0xC0 | (cp >> 6)); t[1] = (char)(0x80 | (cp & 0x3F)); buf_add(b, t, 2); }
    else if (cp < 0x10000) { t[0] = (char)(0xE0 | (cp >> 12)); t[1] = (char)(0x80 | ((cp >> 6) & 0x3F)); t[2] = (char)(0x80 | (cp & 0x3F)); buf_add(b, t, 3); }
    else { t[0] = (char)(0xF0 | (cp >> 18)); t[1] = (char)(0x80 | ((cp >> 12) & 0x3F)); t[2] = (char)(0x80 | ((cp >> 6) & 0x3F)); t[3] = (char)(0x80 | (cp & 0x3F)); buf_add(b, t, 4); }
}
static int hex4(const char *q, unsigned *out) {
    unsigned v = 0;
    for (int i = 0; i < 4; i++) {
        char c = q[i]; v <<= 4;
        if (c >= '0' && c <= '9') v |= (unsigned)(c - '0');
        else if (c >= 'a' && c <= 'f') v |= (unsigned)(c - 'a' + 10);
        else if (c >= 'A' && c <= 'F') v |= (unsigned)(c - 'A' + 10);
        else return 0;
    }
    *out = v; return 1;
}

static char *parse_string(jp *p, size_t *len) {
    /* p->p punta alle virgolette di apertura */
    buf_t b; buf_init(&b);
    p->p++;
    while (p->p < p->e) {
        unsigned char c = (unsigned char)*p->p;
        if (c == '"') { p->p++; *len = b.n; return buf_steal(&b); }
        if (c < 0x20) { jerr(p, "carattere di controllo in una stringa"); buf_free(&b); return NULL; }
        if (c == '\\') {
            if (p->p + 1 >= p->e) break;
            char e = p->p[1]; p->p += 2;
            switch (e) {
                case '"': buf_add(&b, "\"", 1); break;
                case '\\': buf_add(&b, "\\", 1); break;
                case '/': buf_add(&b, "/", 1); break;
                case 'b': buf_add(&b, "\b", 1); break;
                case 'f': buf_add(&b, "\f", 1); break;
                case 'n': buf_add(&b, "\n", 1); break;
                case 'r': buf_add(&b, "\r", 1); break;
                case 't': buf_add(&b, "\t", 1); break;
                case 'u': {
                    unsigned cp;
                    if (p->p + 4 > p->e || !hex4(p->p, &cp)) { jerr(p, "sequenza \\u non valida"); buf_free(&b); return NULL; }
                    p->p += 4;
                    if (cp >= 0xD800 && cp <= 0xDBFF) {
                        unsigned lo;
                        if (p->p + 6 <= p->e && p->p[0] == '\\' && p->p[1] == 'u' && hex4(p->p + 2, &lo) && lo >= 0xDC00 && lo <= 0xDFFF) {
                            p->p += 6; cp = 0x10000 + ((cp - 0xD800) << 10) + (lo - 0xDC00);
                        } else cp = 0xFFFD;
                    } else if (cp >= 0xDC00 && cp <= 0xDFFF) cp = 0xFFFD;
                    put_utf8(&b, cp);
                    break;
                }
                default: jerr(p, "sequenza di escape non valida"); buf_free(&b); return NULL;
            }
            continue;
        }
        buf_add(&b, p->p, 1);
        p->p++;
    }
    jerr(p, "stringa non terminata");
    buf_free(&b);
    return NULL;
}

static jv *parse_value(jp *p);

static jv *parse_value(jp *p) {
    ws(p);
    if (p->p >= p->e) { jerr(p, "fine inattesa"); return NULL; }
    const char *start = p->p;
    jv *v = NULL;
    char c = *p->p;
    if (c == '{' || c == '[') {
        if (++p->depth > 64) { jerr(p, "annidamento eccessivo"); return NULL; }
        v = jnew(c == '{' ? J_OBJ : J_ARR);
        if (!v) return NULL;
        p->p++; ws(p);
        char close = c == '{' ? '}' : ']';
        if (p->p < p->e && *p->p == close) { p->p++; }
        else for (;;) {
            char *key = NULL;
            if (v->t == J_OBJ) {
                ws(p);
                if (p->p >= p->e || *p->p != '"') { jerr(p, "attesa una chiave tra virgolette"); json_free(v); return NULL; }
                size_t kl; key = parse_string(p, &kl);
                if (!key) { json_free(v); return NULL; }
                ws(p);
                if (p->p >= p->e || *p->p != ':') { jerr(p, "attesi i due punti"); free(key); json_free(v); return NULL; }
                p->p++;
            }
            jv *item = parse_value(p);
            if (!item) { free(key); json_free(v); return NULL; }
            if (!push(v, item, key)) { free(key); json_free(item); json_free(v); return NULL; }
            ws(p);
            if (p->p < p->e && *p->p == ',') { p->p++; continue; }
            if (p->p < p->e && *p->p == close) { p->p++; break; }
            jerr(p, "attesa una virgola o la chiusura"); json_free(v); return NULL;
        }
        p->depth--;
    } else if (c == '"') {
        v = jnew(J_STR);
        if (!v) return NULL;
        v->str = parse_string(p, &v->slen);
        if (!v->str) { free(v); return NULL; }
    } else if (c == 't' && p->e - p->p >= 4 && !strncmp(p->p, "true", 4)) { v = jnew(J_TRUE); p->p += 4; }
    else if (c == 'f' && p->e - p->p >= 5 && !strncmp(p->p, "false", 5)) { v = jnew(J_FALSE); p->p += 5; }
    else if (c == 'n' && p->e - p->p >= 4 && !strncmp(p->p, "null", 4)) { v = jnew(J_NULL); p->p += 4; }
    else if (c == '-' || (c >= '0' && c <= '9')) {
        const char *q = p->p; int isint = 1;
        if (*q == '-') q++;
        if (q >= p->e || !(*q >= '0' && *q <= '9')) { jerr(p, "numero non valido"); return NULL; }
        if (*q == '0') q++; else while (q < p->e && *q >= '0' && *q <= '9') q++;
        if (q < p->e && *q == '.') { isint = 0; q++; if (q >= p->e || !(*q >= '0' && *q <= '9')) { jerr(p, "numero non valido"); return NULL; } while (q < p->e && *q >= '0' && *q <= '9') q++; }
        if (q < p->e && (*q == 'e' || *q == 'E')) { isint = 0; q++; if (q < p->e && (*q == '+' || *q == '-')) q++; if (q >= p->e || !(*q >= '0' && *q <= '9')) { jerr(p, "numero non valido"); return NULL; } while (q < p->e && *q >= '0' && *q <= '9') q++; }
        char tmp[64]; size_t L = (size_t)(q - p->p); if (L > 63) L = 63;
        memcpy(tmp, p->p, L); tmp[L] = 0;
        v = jnew(J_NUM); if (!v) return NULL;
        v->num = strtod(tmp, NULL); v->is_int = isint;
        p->p = q;
    } else { jerr(p, "valore non valido"); return NULL; }
    if (v) { v->raw = start; v->rawlen = (size_t)(p->p - start); }
    return v;
}

jv *json_parse(const char *s, size_t n, char *err, size_t errn) {
    jp p; p.s = p.p = s; p.e = s + n; p.err = err; p.errn = errn; p.depth = 0;
    if (err && errn) err[0] = 0;
    /* salta un eventuale BOM UTF-8 */
    if (n >= 3 && (unsigned char)s[0] == 0xEF && (unsigned char)s[1] == 0xBB && (unsigned char)s[2] == 0xBF) p.p += 3;
    jv *v = parse_value(&p);
    if (!v) return NULL;
    ws(&p);
    if (p.p != p.e) { jerr(&p, "testo in piu' dopo il JSON"); json_free(v); return NULL; }
    return v;
}

void json_free(jv *v) {
    if (!v) return;
    for (size_t i = 0; i < v->n; i++) { json_free(v->items[i]); if (v->keys) free(v->keys[i]); }
    free(v->items); free(v->keys); free(v->str); free(v);
}

jv *jget(const jv *o, const char *key) {
    if (!o || o->t != J_OBJ) return NULL;
    for (size_t i = o->n; i-- > 0;) if (!strcmp(o->keys[i], key)) return o->items[i];   /* l'ultima chiave vince */
    return NULL;
}
const char *jstr(const jv *o, const char *key, const char *def) {
    jv *v = jget(o, key);
    return v && v->t == J_STR ? v->str : def;
}
double jnum(const jv *o, const char *key, double def) {
    jv *v = jget(o, key);
    return v && v->t == J_NUM ? v->num : def;
}
int jbool(const jv *o, const char *key, int def) {
    jv *v = jget(o, key);
    if (!v) return def;
    if (v->t == J_TRUE) return 1;
    if (v->t == J_FALSE || v->t == J_NULL) return 0;
    return def;
}

jv *jnew_str(const char *s) {
    jv *v = jnew(J_STR); if (!v) return NULL;
    v->slen = strlen(s ? s : ""); v->str = (char *)malloc(v->slen + 1);
    memcpy(v->str, s ? s : "", v->slen + 1);
    return v;
}
jv *jnew_num(double d) { jv *v = jnew(J_NUM); if (v) { v->num = d; v->is_int = (d == floor(d) && fabs(d) < 1e15); } return v; }
void jadd(jv *c, const char *key, jv *val) {
    if (!c || !val) return;
    char *k = NULL;
    if (c->t == J_OBJ) { k = (char *)malloc(strlen(key) + 1); strcpy(k, key); }
    if (!push(c, val, k)) { free(k); json_free(val); }
}

void json_strn(buf_t *b, const char *s, size_t n) {
    static const char hexd[] = "0123456789abcdef";
    buf_reserve(b, n + 2);
    buf_add(b, "\"", 1);
    size_t run = 0;
    for (size_t i = 0; i < n; i++) {
        unsigned char c = (unsigned char)s[i];
        const char *rep = NULL; char u[7];
        if (c == '"') rep = "\\\"";
        else if (c == '\\') rep = "\\\\";
        else if (c == '\n') rep = "\\n";
        else if (c == '\r') rep = "\\r";
        else if (c == '\t') rep = "\\t";
        else if (c < 0x20 || c == 0x7f) { u[0] = '\\'; u[1] = 'u'; u[2] = '0'; u[3] = '0'; u[4] = hexd[c >> 4]; u[5] = hexd[c & 15]; u[6] = 0; rep = u; }
        else if (c == 0xE2 && i + 2 < n && (unsigned char)s[i + 1] == 0x80 && ((unsigned char)s[i + 2] == 0xA8 || (unsigned char)s[i + 2] == 0xA9)) {
            rep = (unsigned char)s[i + 2] == 0xA8 ? "\\u2028" : "\\u2029";
            buf_add(b, s + i - run, run); run = 0; buf_adds(b, rep); i += 2; continue;
        }
        if (rep) { buf_add(b, s + i - run, run); run = 0; buf_adds(b, rep); }
        else run++;
    }
    buf_add(b, s + n - run, run);
    buf_add(b, "\"", 1);
}
void json_str(buf_t *b, const char *s) { json_strn(b, s ? s : "", s ? strlen(s) : 0); }

static void nl(buf_t *b, int indent, int level) {
    if (indent <= 0) return;
    buf_add(b, "\n", 1);
    for (int i = 0; i < indent * level; i++) buf_add(b, " ", 1);
}
void json_write(buf_t *b, const jv *v, int indent, int level) {
    if (!v) { buf_adds(b, "null"); return; }
    switch (v->t) {
        case J_NULL: buf_adds(b, "null"); break;
        case J_TRUE: buf_adds(b, "true"); break;
        case J_FALSE: buf_adds(b, "false"); break;
        case J_NUM:
            if (v->is_int && fabs(v->num) < 1e15) buf_addf(b, "%.0f", v->num);
            else if (isfinite(v->num)) buf_addf(b, "%.17g", v->num);
            else buf_adds(b, "null");
            break;
        case J_STR: json_strn(b, v->str, v->slen); break;
        case J_ARR: case J_OBJ: {
            buf_add(b, v->t == J_OBJ ? "{" : "[", 1);
            for (size_t i = 0; i < v->n; i++) {
                if (i) buf_add(b, ",", 1);
                nl(b, indent, level + 1);
                if (v->t == J_OBJ) { json_str(b, v->keys[i]); buf_adds(b, indent > 0 ? ": " : ":"); }
                json_write(b, v->items[i], indent, level + 1);
            }
            if (v->n) nl(b, indent, level);
            buf_add(b, v->t == J_OBJ ? "}" : "]", 1);
            break;
        }
    }
}
