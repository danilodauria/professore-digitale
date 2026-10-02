/* Professore Digitale per Windows - riconoscimento dell'hardware (per scegliere l'IA adatta)
 * Sistema operativo, processore (AVX/AVX2), memoria, scheda video e memoria video, spazio libero.
 * Tutto funziona anche su Windows XP: le funzioni recenti sono caricate solo se presenti.
 * Ideato e sviluppato da Danilo D'Auria - Licenza MIT */
#include "pd.h"
#include <cpuid.h>

#ifndef PROCESSOR_ARCHITECTURE_ARM64
#define PROCESSOR_ARCHITECTURE_ARM64 12
#endif

typedef LONG (WINAPI *RtlGetVersion_t)(OSVERSIONINFOEXW *);
typedef BOOL (WINAPI *IsWow64Process2_t)(HANDLE, USHORT *, USHORT *);

static void reg_str(HKEY root, const wchar_t *key, const wchar_t *name, char *out, size_t n) {
    HKEY h; out[0] = 0;
    if (RegOpenKeyExW(root, key, 0, KEY_READ | 0x0100 /* KEY_WOW64_64KEY */, &h) != ERROR_SUCCESS &&
        RegOpenKeyExW(root, key, 0, KEY_READ, &h) != ERROR_SUCCESS) return;
    wchar_t buf[256]; DWORD sz = sizeof buf - sizeof(wchar_t), type = 0;
    if (RegQueryValueExW(h, name, NULL, &type, (BYTE *)buf, &sz) == ERROR_SUCCESS && (type == REG_SZ || type == REG_EXPAND_SZ)) {
        buf[sz / sizeof(wchar_t)] = 0;
        char *u = u16to8(buf);
        snprintf(out, n, "%s", u);
        free(u);
        /* spazi in eccesso (frequenti nel nome del processore) */
        char *s = out, *d = out; int sp = 1;
        for (; *s; s++) { if (*s == ' ') { if (!sp) *d++ = ' '; sp = 1; } else { *d++ = *s; sp = 0; } }
        if (d > out && d[-1] == ' ') d--;
        *d = 0;
    }
    RegCloseKey(h);
}

static unsigned long long xgetbv0(void) {
    unsigned int a, d;
    __asm__ volatile(".byte 0x0f, 0x01, 0xd0" : "=a"(a), "=d"(d) : "c"(0));
    return ((unsigned long long)d << 32) | a;
}

static void cpu_features(pd_hw *h) {
    unsigned a, b, c, d;
    if (!__get_cpuid(1, &a, &b, &c, &d)) return;
    h->sse2 = (d >> 26) & 1;
    int osxsave = (c >> 27) & 1, avx = (c >> 28) & 1, fma = (c >> 12) & 1;
    int ymm_ok = 0;
    if (osxsave) ymm_ok = (xgetbv0() & 6) == 6;     /* il sistema salva i registri AVX */
    h->avx = avx && ymm_ok;
    h->fma = fma && h->avx;
    if (h->avx && __get_cpuid_max(0, NULL) >= 7) {
        __cpuid_count(7, 0, a, b, c, d);
        h->avx2 = (b >> 5) & 1;
    }
}

/* ---- memoria video: DXGI (Vista+), poi registro dei driver (valore a 64 bit, Windows 10+) ---- */
typedef struct { const void *lpVtbl; } IUnk;
typedef struct {
    WCHAR Description[128]; UINT VendorId, DeviceId, SubSysId, Revision;
    SIZE_T DedicatedVideoMemory, DedicatedSystemMemory, SharedSystemMemory; LUID AdapterLuid;
} DXGI_ADAPTER_DESC_PD;
static const GUID IID_IDXGIFactory_PD = { 0x7b7166ec, 0x21c7, 0x44ae, { 0xb2, 0x1a, 0xc9, 0xae, 0x32, 0x1a, 0xe3, 0x69 } };
typedef HRESULT (WINAPI *CreateDXGIFactory_t)(REFIID, void **);
/* tabelle virtuali minime: IUnknown(3) + IDXGIObject(4) + IDXGIFactory::EnumAdapters e' il n. 7 */
typedef HRESULT (STDMETHODCALLTYPE *EnumAdapters_t)(void *, UINT, void **);
typedef HRESULT (STDMETHODCALLTYPE *GetDesc_t)(void *, DXGI_ADAPTER_DESC_PD *);
typedef ULONG (STDMETHODCALLTYPE *Release_t)(void *);

static void gpu_dxgi(pd_hw *h) {
    HMODULE m = LoadLibraryW(L"dxgi.dll");
    if (!m) return;
    CreateDXGIFactory_t f = (CreateDXGIFactory_t)(void *)GetProcAddress(m, "CreateDXGIFactory");
    void *fac = NULL;
    if (f && SUCCEEDED(f(&IID_IDXGIFactory_PD, &fac)) && fac) {
        void **vt = *(void ***)fac;
        for (UINT i = 0; i < 8; i++) {
            void *ad = NULL;
            if (FAILED(((EnumAdapters_t)vt[7])(fac, i, &ad)) || !ad) break;
            void **avt = *(void ***)ad;
            DXGI_ADAPTER_DESC_PD dsc; memset(&dsc, 0, sizeof dsc);
            if (SUCCEEDED(((GetDesc_t)avt[8])(ad, &dsc)) && dsc.VendorId != 0x1414 /* rendering software */) {
                long long mb = (long long)(dsc.DedicatedVideoMemory / (1024 * 1024));
                if (mb > h->vram_mb || !h->gpu[0]) {
                    char *n8 = u16to8(dsc.Description);
                    snprintf(h->gpu, sizeof h->gpu, "%s", n8); free(n8);
                    h->vram_mb = mb; h->gpu_vendor = (int)dsc.VendorId;
                }
            }
            ((Release_t)avt[2])(ad);
        }
        ((Release_t)vt[2])(fac);
    }
    FreeLibrary(m);
}

static void gpu_registry(pd_hw *h) {
    /* {4d36e968-...} = classe "Schede video"; qwMemorySize e' affidabile anche oltre i 4 GB */
    const wchar_t *cls = L"SYSTEM\\CurrentControlSet\\Control\\Class\\{4d36e968-e325-11ce-bfc1-08002be10318}";
    HKEY hc;
    if (RegOpenKeyExW(HKEY_LOCAL_MACHINE, cls, 0, KEY_READ, &hc) != ERROR_SUCCESS) return;
    for (DWORD i = 0; i < 16; i++) {
        wchar_t sub[64]; DWORD sl = 64;
        if (RegEnumKeyExW(hc, i, sub, &sl, NULL, NULL, NULL, NULL) != ERROR_SUCCESS) break;
        HKEY hs;
        if (RegOpenKeyExW(hc, sub, 0, KEY_READ, &hs) != ERROR_SUCCESS) continue;
        unsigned long long q = 0; DWORD sz = sizeof q, type = 0;
        long long mb = 0;
        if (RegQueryValueExW(hs, L"HardwareInformation.qwMemorySize", NULL, &type, (BYTE *)&q, &sz) == ERROR_SUCCESS && type == REG_QWORD)
            mb = (long long)(q / (1024 * 1024));
        else {
            DWORD dw = 0; sz = sizeof dw;
            if (RegQueryValueExW(hs, L"HardwareInformation.MemorySize", NULL, &type, (BYTE *)&dw, &sz) == ERROR_SUCCESS && (type == REG_DWORD || type == REG_BINARY))
                mb = (long long)(dw / (1024 * 1024));
        }
        wchar_t desc[160]; DWORD dsz = sizeof desc - 2; type = 0;
        int has_desc = RegQueryValueExW(hs, L"DriverDesc", NULL, &type, (BYTE *)desc, &dsz) == ERROR_SUCCESS && type == REG_SZ;
        if (has_desc) desc[dsz / 2] = 0;
        if (mb > h->vram_mb) {
            h->vram_mb = mb;
            if (has_desc) { char *d8 = u16to8(desc); snprintf(h->gpu, sizeof h->gpu, "%s", d8); free(d8); }
        } else if (!h->gpu[0] && has_desc) { char *d8 = u16to8(desc); snprintf(h->gpu, sizeof h->gpu, "%s", d8); free(d8); }
        RegCloseKey(hs);
    }
    RegCloseKey(hc);
}

static const char *os_label(int maj, int min, int build, int server) {
    (void)server;
    if (maj == 5 && min == 1) return "Windows XP";
    if (maj == 5 && min == 2) return "Windows XP x64 / Server 2003";
    if (maj == 6 && min == 0) return "Windows Vista";
    if (maj == 6 && min == 1) return "Windows 7";
    if (maj == 6 && min == 2) return "Windows 8";
    if (maj == 6 && min == 3) return "Windows 8.1";
    if (maj == 10 && build >= 22000) return "Windows 11";
    if (maj == 10) return "Windows 10";
    return "Windows";
}

void hw_detect(pd_hw *h) {
    memset(h, 0, sizeof *h);
    /* sistema operativo (RtlGetVersion non mente come GetVersionEx) */
    OSVERSIONINFOEXW v; memset(&v, 0, sizeof v); v.dwOSVersionInfoSize = sizeof v;
    RtlGetVersion_t rgv = (RtlGetVersion_t)(void *)GetProcAddress(GetModuleHandleW(L"ntdll.dll"), "RtlGetVersion");
    if (!rgv || rgv(&v) != 0) GetVersionExW((OSVERSIONINFOW *)&v);
    h->os_major = (int)v.dwMajorVersion; h->os_minor = (int)v.dwMinorVersion; h->os_build = (int)v.dwBuildNumber;
    h->os_sp = v.wServicePackMajor;
    reg_str(HKEY_LOCAL_MACHINE, L"SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion", L"DisplayVersion", h->os_display, sizeof h->os_display);
    if (!h->os_display[0]) reg_str(HKEY_LOCAL_MACHINE, L"SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion", L"ReleaseId", h->os_display, sizeof h->os_display);
    /* architettura */
    SYSTEM_INFO si; GetNativeSystemInfo(&si);
    h->is64os = si.wProcessorArchitecture == PROCESSOR_ARCHITECTURE_AMD64 || si.wProcessorArchitecture == PROCESSOR_ARCHITECTURE_ARM64 ||
                si.wProcessorArchitecture == PROCESSOR_ARCHITECTURE_IA64;
    h->arm64 = si.wProcessorArchitecture == PROCESSOR_ARCHITECTURE_ARM64;
    IsWow64Process2_t iw2 = (IsWow64Process2_t)(void *)GetProcAddress(GetModuleHandleW(L"kernel32.dll"), "IsWow64Process2");
    if (iw2) { USHORT pm = 0, nm = 0; if (iw2(GetCurrentProcess(), &pm, &nm) && nm == 0xAA64) { h->arm64 = 1; h->is64os = 1; } }
    h->cpus = (int)si.dwNumberOfProcessors;
    char sp[24] = "";
    if (h->os_sp && h->os_major < 10) snprintf(sp, sizeof sp, " SP%d", h->os_sp);
    snprintf(h->os_name, sizeof h->os_name, "%s%s%s%s (build %d, %s)", os_label(h->os_major, h->os_minor, h->os_build, 0),
             h->os_display[0] ? " " : "", h->os_display, sp, h->os_build, h->arm64 ? "ARM64" : h->is64os ? "64 bit" : "32 bit");
    /* processore */
    reg_str(HKEY_LOCAL_MACHINE, L"HARDWARE\\DESCRIPTION\\System\\CentralProcessor\\0", L"ProcessorNameString", h->cpu, sizeof h->cpu);
    if (!h->arm64) cpu_features(h);
    /* memoria */
    MEMORYSTATUSEX ms; ms.dwLength = sizeof ms;
    if (GlobalMemoryStatusEx(&ms)) h->ram_mb = (long long)(ms.ullTotalPhys / (1024 * 1024));
    /* scheda video */
    gpu_dxgi(h);
    gpu_registry(h);
    if (h->gpu_vendor == 0) {
        char low[160]; snprintf(low, sizeof low, "%s", h->gpu);
        for (char *p = low; *p; p++) *p = (char)tolower((unsigned char)*p);
        if (strstr(low, "nvidia") || strstr(low, "geforce") || strstr(low, "quadro") || strstr(low, "rtx")) h->gpu_vendor = 0x10DE;
        else if (strstr(low, "radeon") || strstr(low, "amd")) h->gpu_vendor = 0x1002;
        else if (strstr(low, "intel")) h->gpu_vendor = 0x8086;
    }
    /* una scheda NVIDIA/AMD con almeno 2 GB e' "dedicata" e utile all'IA; le integrate usano la RAM */
    h->gpu_discrete = (h->gpu_vendor == 0x10DE || h->gpu_vendor == 0x1002) && h->vram_mb >= 2000;
    /* spazio libero dove vanno i modelli */
    ULARGE_INTEGER fb;
    if (G.local_dir[0] && GetDiskFreeSpaceExW(G.local_dir, &fb, NULL, NULL)) h->disk_free_mb = (long long)(fb.QuadPart / (1024 * 1024));
    else if (GetDiskFreeSpaceExW(L"C:\\", &fb, NULL, NULL)) h->disk_free_mb = (long long)(fb.QuadPart / (1024 * 1024));
}

void hw_json(buf_t *b, const pd_hw *h) {
    buf_adds(b, "{\"os\": "); json_str(b, h->os_name);
    buf_addf(b, ", \"os_major\": %d, \"os_minor\": %d, \"os_build\": %d", h->os_major, h->os_minor, h->os_build);
    buf_adds(b, ", \"arch\": "); json_str(b, h->arm64 ? "arm64" : h->is64os ? "x64" : "x86");
    buf_adds(b, ", \"cpu\": "); json_str(b, h->cpu[0] ? h->cpu : "sconosciuto");
    buf_addf(b, ", \"cpus\": %d, \"avx\": %s, \"avx2\": %s, \"ram_mb\": %lld", h->cpus, h->avx ? "true" : "false", h->avx2 ? "true" : "false", h->ram_mb);
    buf_adds(b, ", \"gpu\": "); json_str(b, h->gpu[0] ? h->gpu : "non rilevata");
    buf_addf(b, ", \"vram_mb\": %lld, \"gpu_dedicata\": %s, \"disco_libero_mb\": %lld}", h->vram_mb, h->gpu_discrete ? "true" : "false", h->disk_free_mb);
}
