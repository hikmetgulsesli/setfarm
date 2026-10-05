/* Pure status parsing. A parsed state never certifies custody or cleanup. */
#include <stddef.h>
#include <stdint.h>

unsigned sf_continuity_decode_status_v2(const uint8_t *bytes, size_t length,
                                       const uint8_t expected_nonce[16]) {
    static const uint8_t magic[8] = {'S','F','S','T','A','T','2','!'};
    if (bytes == NULL || expected_nonce == NULL || length != 32) return 0;
    for (size_t i = 0; i < 8; i++) if (bytes[i] != magic[i]) return 0;
    if (bytes[8] || bytes[9] || bytes[10] || bytes[11] != 2 ||
        bytes[12] || bytes[13] || bytes[14] ||
        bytes[15] < 1 || bytes[15] > 3) return 0;
    for (size_t i = 0; i < 16; i++)
        if (bytes[16 + i] != expected_nonce[i]) return 0;
    return bytes[15];
}

/* Pure status encoding; even state3 cannot certify or enable retention. */
unsigned sf_continuity_encode_status_v2(uint8_t *out, size_t capacity,
                                       unsigned state, const uint8_t nonce[16]) {
    static const uint8_t magic[8] = {'S','F','S','T','A','T','2','!'};
    uint8_t snapshot[16];
    if (out == NULL || nonce == NULL || capacity != 32 ||
        state < 1 || state > 3) return 0;
    for (size_t i = 0; i < 16; i++) snapshot[i] = nonce[i];
    for (size_t i = 0; i < 8; i++) out[i] = magic[i];
    out[8] = 0; out[9] = 0; out[10] = 0; out[11] = 2;
    out[12] = 0; out[13] = 0; out[14] = 0; out[15] = (uint8_t)state;
    for (size_t i = 0; i < 16; i++) out[16 + i] = snapshot[i];
    return 1;
}
