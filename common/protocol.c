#include "protocol.h"
#include <string.h>
static void put32(uint8_t *p, uint32_t x) {
    for (int i=0;i<4;i++) p[i]=(uint8_t)(x>>(8*i));
}
static uint32_t get32(const uint8_t *p) {
    uint32_t x=0;
    for (int i=0;i<4;i++) x|=(uint32_t)p[i]<<(8*i);
    return x;
}
uint16_t proto_crc(const uint8_t *data, size_t n) {
    uint16_t crc=0xffff;
    while (n--) {
        crc^=(uint16_t)*data++<<8;
        for (int i=0;i<8;i++) crc=(uint16_t)((crc&0x8000)?(crc<<1)^0x1021:crc<<1);
    }
    return crc;
}
void proto_encode(const Message *m, uint8_t out[PROTO_SIZE]) {
    out[0]=0xa5; out[1]=0x5a; out[2]=1; out[3]=m->type;
    put32(out+4,m->seq);
    for (int i=0;i<PROTO_VALUES;i++) put32(out+8+i*4,(uint32_t)m->v[i]);
    uint16_t crc=proto_crc(out,PROTO_SIZE-2);
    out[72]=(uint8_t)crc; out[73]=(uint8_t)(crc>>8);
}
bool proto_feed(ProtoParser *p, uint8_t byte, Message *out) {
    p->data[p->used++]=byte;
    while (p->used && p->data[0]!=0xa5) {
        memmove(p->data,p->data+1,--p->used);
    }
    if (p->used<PROTO_SIZE) return false;
    uint16_t crc=(uint16_t)(p->data[72]|((uint16_t)p->data[73]<<8));
    bool good=p->data[1]==0x5a && p->data[2]==1 &&
        p->data[3]>=MSG_TELEMETRY && p->data[3]<=MSG_ACK &&
        crc==proto_crc(p->data,PROTO_SIZE-2);
    if (good) {
        out->type=p->data[3]; out->seq=get32(p->data+4);
        for (int i=0;i<PROTO_VALUES;i++) {
            uint32_t bits=get32(p->data+8+i*4);
            memcpy(&out->v[i],&bits,sizeof(bits));
        }
        p->used=0;
        return true;
    }
    memmove(p->data,p->data+1,--p->used);
    return false;
}
