#include "planter.h"
#include <assert.h>
#include <stdio.h>
#include <string.h>
static SensorSample sample(uint32_t now, uint32_t n, int rh, int lux) {
    return (SensorSample){.at_ms=now,.number=n,.temp10=300,.humidity10=rh,.lux=lux,.valid=3};
}
static Message cmd(uint32_t id, int op, uint32_t boot) {
    Message m={.type=MSG_COMMAND,.seq=id}; m.v[0]=op; m.v[7]=(int32_t)boot; m.v[8]=10000; return m;
}
static void test_protocol(void) {
    assert(proto_crc((const uint8_t *)"123456789",9)==0x29b1);
    Message input={.type=MSG_COMMAND,.seq=0x1234}, out={0};
    for (int i=0;i<PROTO_VALUES;i++) input.v[i]=i%2?-i:i*10000;
    uint8_t good[PROTO_SIZE], bad[PROTO_SIZE]; proto_encode(&input,good);
    ProtoParser p={0}; int hits=0;
    for (int i=0;i<PROTO_SIZE;i++) hits+=proto_feed(&p,good[i],&out);
    assert(hits==1 && out.type==input.type && out.seq==input.seq && !memcmp(out.v,input.v,sizeof(out.v)));
    for (int offset=0;offset<PROTO_SIZE;offset++) {
        memcpy(bad,good,sizeof(bad)); bad[offset]^=0x08; memset(&p,0,sizeof(p)); hits=0;
        for (int i=0;i<PROTO_SIZE;i++) hits+=proto_feed(&p,bad[i],&out);
        for (int i=0;i<PROTO_SIZE;i++) hits+=proto_feed(&p,good[i],&out);
        assert(hits==1 && out.seq==input.seq);
    }
    for (int lost=0;lost<PROTO_SIZE;lost++) {
        memset(&p,0,sizeof(p)); hits=0;
        for (int i=0;i<PROTO_SIZE;i++) if (i!=lost) hits+=proto_feed(&p,good[i],&out);
        for (int i=0;i<PROTO_SIZE;i++) hits+=proto_feed(&p,good[i],&out);
        assert(hits==1);
    }
    puts("PASS CRC, frame roundtrip, corruption and dropped-byte recovery");
}
static void test_control(void) {
    Planter p; planter_init(&p,42); SensorSample s=sample(0,1,400,1000); planter_sample(&p,&s);
    planter_step(&p,false,true,0); assert(!p.out.drip && p.out.led==5 && p.out.fan);
    planter_step(&p,false,true,300); assert(p.out.drip && !p.out.mist && p.out.led==5);
    planter_step(&p,false,true,5300); assert(!p.out.drip);
    s=sample(6300,2,400,1000); planter_sample(&p,&s); planter_step(&p,false,true,6300); assert(!p.out.drip);
    s=sample(65300,3,400,1000); planter_sample(&p,&s); planter_step(&p,false,true,65300); assert(p.out.drip);
    planter_step(&p,true,true,65400); assert(!p.out.drip && !p.out.mist && !p.out.refill);
    planter_step(&p,true,true,65700); assert(p.out.refill);
    planter_step(&p,true,true,85700); assert(!p.out.refill && (p.alarms&ALARM_REFILL_TIMEOUT));
    planter_step(&p,true,true,90000); assert(!p.out.refill);
    Message clear=cmd(1,OP_CLEAR_FAULT,42); assert(planter_command(&p,&clear,90000,90000)==ACK_OK);
    planter_step(&p,true,true,90001); assert(p.out.refill);
    planter_step(&p,false,true,90002); assert(!p.out.refill);
    puts("PASS light step, fan, water debounce, pump runtime/cooldown and refill latch");
}
static void test_commands(void) {
    Planter p; planter_init(&p,77); Message m=cmd(1,OP_MANUAL,77);
    m.v[1]=30; m.v[2]=1; m.v[6]=1000;
    assert(planter_command(&p,&m,0,0)==ACK_OK);
    planter_step(&p,false,true,0); assert(p.manual && p.out.led==30);
    assert(planter_command(&p,&m,800,800)==ACK_DUPLICATE);
    planter_step(&p,false,true,1000); assert(!p.manual && !p.out.led);
    m=cmd(2,OP_AUTO,78); assert(planter_command(&p,&m,0,0)==ACK_BOOT);
    m=cmd(2,OP_AUTO,77); assert(planter_command(&p,&m,0,10000)==ACK_EXPIRED);
    m=cmd(3,OP_AUTO,77); assert(planter_command(&p,&m,0,0)==ACK_OK);
    m.seq=2; assert(planter_command(&p,&m,0,0)==ACK_STALE);
    m=cmd(4,OP_MANUAL,77); m.v[3]=1; m.v[4]=1; m.v[6]=1000;
    assert(planter_command(&p,&m,0,0)==ACK_INVALID);
    m=cmd(4,OP_CONFIG,77); m.v[1]=280; m.v[2]=280;
    assert(planter_command(&p,&m,0,0)==ACK_INVALID);
    puts("PASS duplicate suppression, manual lease, expiry, boot binding and validation");
}
static void test_germ_and_stale(void) {
    Planter p; planter_init(&p,1); Message m=cmd(1,OP_GERMINATION,1); m.v[1]=900;
    assert(planter_command(&p,&m,0,0)==ACK_OK);
    SensorSample s=sample(0,1,400,12000); planter_sample(&p,&s);
    planter_step(&p,false,true,0); planter_step(&p,false,true,300);
    assert(p.out.mist && !p.out.drip);
    planter_step(&p,false,true,7000); assert(!p.out.mist && p.out.led==0 && !p.out.fan && (p.alarms&ALARM_STALE));
    s=sample(1800001,2,400,12000); planter_sample(&p,&s); planter_step(&p,false,true,1800001);
    assert(p.out.drip && !p.out.mist && (p.alarms&ALARM_GERM_UNKNOWN));
    planter_step(&p,false,false,1800100); assert(!p.out.drip && !p.out.mist && !p.out.refill);
    puts("PASS germination routing, stale sensors, expired inference and invalid water");
}
static void test_wrap_and_repeated_manual(void) {
    Planter p; planter_init(&p,3); Message m=cmd(1,OP_MANUAL,3);
    m.v[3]=1; m.v[6]=30000; uint32_t start=UINT32_MAX-1000;
    assert(planter_command(&p,&m,start,start)==ACK_OK);
    planter_step(&p,false,true,start); planter_step(&p,false,true,start+300);
    assert(p.out.drip);
    m.seq=2; assert(planter_command(&p,&m,start+4000,start+4000)==ACK_OK);
    planter_step(&p,false,true,start+5300); assert(!p.out.drip);
    m.seq=3; assert(planter_command(&p,&m,start+5400,start+5400)==ACK_OK);
    planter_step(&p,false,true,start+5400); assert(!p.out.drip);
    puts("PASS uint32 tick wrap and repeated commands cannot reset pump runtime");
}
int main(void) {
    test_protocol(); test_control(); test_commands(); test_germ_and_stale(); test_wrap_and_repeated_manual();
    puts("All C tests passed"); return 0;
}
