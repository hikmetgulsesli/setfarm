/* Layout-only candidate. No runtime function or Mach operation. */
#include <mach/message.h>
#include <stddef.h>
#include <stdint.h>

typedef struct {
    mach_msg_header_t header;
    uint8_t payload[32];
} sf_continuity_message_v2;

typedef uint8_t sf_continuity_frame_v2[32];
