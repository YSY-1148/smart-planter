#include "planter.h"
static Planter planter;
static uint32_t sequence;
void sim_init(uint32_t boot) { planter_init(&planter,boot); sequence=0; }
void sim_step(uint32_t now, int temp10, int rh10, int lux, int low, uint8_t *frame) {
    if (!planter.have_sample || now-planter.sample.at_ms>=2000u) {
        SensorSample s={.at_ms=now,.number=now/2000u+1u,.temp10=temp10,.humidity10=rh10,.lux=lux,.valid=3};
        planter_sample(&planter,&s);
    }
    planter_step(&planter,low!=0,true,now);
    Message telemetry; planter_telemetry(&planter,now,++sequence,&telemetry); proto_encode(&telemetry,frame);
}
void sim_command(const uint8_t *frame, uint32_t now, uint8_t *out) {
    ProtoParser parser={0}; Message m={0}, ack={.type=MSG_ACK};
    bool valid=false;
    for (int i=0;i<PROTO_SIZE;i++) valid|=proto_feed(&parser,frame[i],&m);
    ack.seq=m.seq; ack.v[0]=valid?planter_command(&planter,&m,now,now):ACK_INVALID;
    ack.v[3]=(int32_t)planter.boot;
    proto_encode(&ack,out);
}
