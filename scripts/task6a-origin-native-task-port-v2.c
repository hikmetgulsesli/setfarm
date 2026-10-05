#include <stdio.h>

/* Refusal-only checkpoint; no child, thread, Mach call or authority. */
int main(void) {
    fputs("TASK6A_NATIVE_TASK_PORT_PROBE_REFUSED\n", stderr);
    return 2;
}
