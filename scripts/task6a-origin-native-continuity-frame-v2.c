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

/* Pure NONCE bytes; no randomness, channel or shutdown authority. */
unsigned sf_continuity_encode_nonce_v2(uint8_t *nonce_frame, size_t capacity,
                                      const uint8_t nonce[16]) {
    static const uint8_t magic[8] = {'S','F','N','O','N','C','2','!'};
    uint8_t snapshot[16];
    if (nonce_frame == NULL || nonce == NULL || capacity != 32) return 0;
    for (size_t i = 0; i < 16; i++) snapshot[i] = nonce[i];
    for (size_t i = 0; i < 8; i++) nonce_frame[i] = magic[i];
    nonce_frame[8] = 0; nonce_frame[9] = 0; nonce_frame[10] = 0; nonce_frame[11] = 2;
    nonce_frame[12] = 0; nonce_frame[13] = 0; nonce_frame[14] = 0; nonce_frame[15] = 0;
    for (size_t i = 0; i < 16; i++) nonce_frame[16 + i] = snapshot[i];
    return 1;
}

/* Structural NONCE extraction only; no provenance or channel authority. */
unsigned sf_continuity_decode_nonce_v2(const uint8_t *bytes, size_t length,
                                      uint8_t nonce_out[16]) {
    static const uint8_t magic[8] = {'S','F','N','O','N','C','2','!'};
    uint8_t snapshot[16];
    if (bytes == NULL || nonce_out == NULL || length != 32) return 0;
    for (size_t i = 0; i < 8; i++) if (bytes[i] != magic[i]) return 0;
    if (bytes[8] || bytes[9] || bytes[10] || bytes[11] != 2 ||
        bytes[12] || bytes[13] || bytes[14]) return 0;
    if (bytes[15] != 0) return 0;
    for (size_t i = 0; i < 16; i++) snapshot[i] = bytes[16 + i];
    for (size_t i = 0; i < 16; i++) nonce_out[i] = snapshot[i];
    return 1;
}

/* Pure END bytes; never permission to send, release or terminate an owner. */
unsigned sf_continuity_encode_end_v2(uint8_t *end_frame, size_t capacity,
                                    const uint8_t nonce[16]) {
    static const uint8_t magic[8] = {'S','F','E','N','D','V','2','!'};
    uint8_t snapshot[16];
    if (end_frame == NULL || nonce == NULL || capacity != 32) return 0;
    for (size_t i = 0; i < 16; i++) snapshot[i] = nonce[i];
    for (size_t i = 0; i < 8; i++) end_frame[i] = magic[i];
    end_frame[8] = 0; end_frame[9] = 0; end_frame[10] = 0; end_frame[11] = 2;
    end_frame[12] = 0; end_frame[13] = 0; end_frame[14] = 0; end_frame[15] = 0;
    for (size_t i = 0; i < 16; i++) end_frame[16 + i] = snapshot[i];
    return 1;
}

/* Pure END matching; never authorize release or exit of an uncertain owner. */
unsigned sf_continuity_decode_end_v2(const uint8_t *end_bytes, size_t length,
                                    const uint8_t expected_nonce[16]) {
    static const uint8_t magic[8] = {'S','F','E','N','D','V','2','!'};
    if (end_bytes == NULL || expected_nonce == NULL || length != 32) return 0;
    for (size_t i = 0; i < 8; i++) if (end_bytes[i] != magic[i]) return 0;
    if (end_bytes[8] || end_bytes[9] || end_bytes[10] || end_bytes[11] != 2 ||
        end_bytes[12] || end_bytes[13] || end_bytes[14] || end_bytes[15]) return 0;
    for (size_t i = 0; i < 16; i++)
        if (end_bytes[16 + i] != expected_nonce[i]) return 0;
    return 1;
}
