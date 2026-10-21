/* Solo per i test con Wine su processori Intel con AMX (Sapphire Rapids e successivi).
 * Linux concede le istruzioni AMX a un programma solo se lo chiede (arch_prctl ARCH_REQ_XCOMP_PERM); Windows le concede
 * sempre e onnxruntime per Windows le usa senza chiedere: sotto Wine darebbe «illegal instruction». Questa libreria,
 * caricata con LD_PRELOAD, chiede il permesso per il processo di Wine. Su Windows vero non serve.
 * Autore: Danilo D'Auria - Licenza MIT */
#include <unistd.h>
#include <sys/syscall.h>
__attribute__((constructor)) static void permesso_amx(void) { syscall(SYS_arch_prctl, 0x1023 /* ARCH_REQ_XCOMP_PERM */, 18 /* XTILEDATA */); }
