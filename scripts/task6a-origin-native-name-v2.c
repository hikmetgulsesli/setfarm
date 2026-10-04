#include <stdio.h>
#include <unistd.h>

/* Ordinary diagnostic only. No native identity or child effect is open yet. */
int main(int argc, char **argv) {
    (void)argc;
    (void)argv;
    (void)fputs("TASK6A_NATIVE_NAME_PROBE_REFUSED\n", stderr);
    return 2;
}
