#ifndef PLANTER_PROTOCOL_H
#define PLANTER_PROTOCOL_H
#include <stdint.h>
#include <stddef.h>
#include <stdbool.h>
#ifdef __cplusplus
extern "C" {
#endif
#define PROTO_VALUES 16
#define PROTO_SIZE 74
enum { MSG_TELEMETRY=1, MSG_COMMAND=2, MSG_ACK=3 };
typedef struct { uint8_t type; uint32_t seq; int32_t v[PROTO_VALUES]; } Message;
typedef struct { uint8_t data[PROTO_SIZE]; size_t used; } ProtoParser;
uint16_t proto_crc(const uint8_t *data, size_t size);
void proto_encode(const Message *m, uint8_t out[PROTO_SIZE]);
bool proto_feed(ProtoParser *p, uint8_t byte, Message *out);
#ifdef __cplusplus
}
#endif
#endif
