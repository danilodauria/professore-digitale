#!/usr/bin/env python3
"""Controlla che un .exe usi solo DLL e funzioni presenti in Windows XP SP3.
Legge la tabella delle importazioni con objdump (mingw-w64) e cerca funzioni introdotte da Vista in poi.
Uso: python3 windows/tools/controlla_xp.py ProfessoreDigitale.exe
Autore: Danilo D'Auria - Licenza MIT"""
import re, subprocess, sys

DLL_XP = {"kernel32.dll", "user32.dll", "gdi32.dll", "advapi32.dll", "shell32.dll", "ole32.dll", "oleaut32.dll",
          "ws2_32.dll", "winhttp.dll", "msvcrt.dll", "comdlg32.dll", "comctl32.dll", "shlwapi.dll", "version.dll",
          "winmm.dll", "crypt32.dll", "wininet.dll", "iphlpapi.dll", "psapi.dll", "rpcrt4.dll", "uuid.dll"}
NON_XP = set("""
GetTickCount64 InitializeCriticalSectionEx InitOnceExecuteOnce InitOnceBeginInitialize InitOnceComplete
InitializeSRWLock AcquireSRWLockExclusive AcquireSRWLockShared ReleaseSRWLockExclusive ReleaseSRWLockShared
TryAcquireSRWLockExclusive InitializeConditionVariable SleepConditionVariableCS SleepConditionVariableSRW
WakeConditionVariable WakeAllConditionVariable CreateSymbolicLinkW CreateSymbolicLinkA GetFinalPathNameByHandleW
SetFileInformationByHandle GetFileInformationByHandleEx CancelIoEx CreateEventExW CreateMutexExW CreateSemaphoreExW
CreateWaitableTimerExW FlsAlloc FlsFree FlsGetValue FlsSetValue GetLocaleInfoEx LCIDToLocaleName LocaleNameToLCID
CompareStringEx LCMapStringEx GetUserDefaultLocaleName inet_pton inet_ntop InetPtonW InetNtopW WSAPoll GetErrorMode
QueryFullProcessImageNameW QueryFullProcessImageNameA GetProductInfo Wow64DisableWow64FsRedirection Wow64RevertWow64FsRedirection
SHGetKnownFolderPath SHCreateItemFromParsingName TaskDialog TaskDialogIndirect RegGetValueW RegGetValueA RegDeleteTreeW
RegSetKeyValueW CreateThreadpoolWork SubmitThreadpoolWork GetCurrentProcessorNumber GetLogicalProcessorInformationEx
GetSystemTimePreciseAsFileTime SetThreadErrorMode AddDllDirectory SetDefaultDllDirectories GetDynamicTimeZoneInformation
EnumSystemLocalesEx ResolveLocaleName IsValidLocaleName GetTimeFormatEx GetDateFormatEx GetNamedPipeClientProcessId
_fseeki64 _ftelli64 _get_errno _set_errno _wfopen_s strcpy_s wcscpy_s sprintf_s swprintf_s _vsnprintf_s memcpy_s
_localtime64_s _gmtime64_s wcsnlen strnlen _wcsnlen IsWow64Process2 GetSystemDefaultLocaleName
""".split())

exe = sys.argv[1]
out = subprocess.run(["i686-w64-mingw32-objdump", "-p", exe], capture_output=True, text=True).stdout
dll, problems, n = None, [], 0
for line in out.splitlines():
    m = re.match(r"\s*DLL Name: (\S+)", line)
    if m:
        dll = m.group(1).lower()
        if dll not in DLL_XP:
            problems.append("DLL non presente in Windows XP: " + dll)
        continue
    m = re.match(r"\s+[0-9a-f]+\s+[0-9]+\s+(\w+)\s*$", line)
    if m and dll:
        n += 1
        if m.group(1) in NON_XP:
            problems.append("%s: %s (richiede Windows Vista o successivo)" % (dll, m.group(1)))
if problems:
    print("✘ Compatibilità con Windows XP NON rispettata:")
    for p in problems:
        print("   ", p)
    sys.exit(1)
print("✔ Compatibilità Windows XP SP3: %d funzioni importate, tutte disponibili" % n)
