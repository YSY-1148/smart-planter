#include "planter.h"
#include <stddef.h>
#include <stdint.h>
#include <string.h>

#ifdef _WIN32
#define API __declspec(dllexport)
#else
#define API __attribute__((visibility("default")))
#endif

static Planter plant;
static uint32_t clock_ms;
static int trace_count;
static int trace_lines[256];
static int64_t trace_states[256][64];
static uint8_t last_frame[PROTO_SIZE];

API int lab_state(int64_t *v) {
    int i=0;
#define V(x) v[i++]=(int64_t)(x)
    V(plant.boot); V(plant.last_command); V(plant.sample_number);
    V(plant.manual_started); V(plant.manual_ms); V(plant.germ_at); V(plant.water_changed);
    V(plant.temp_on10); V(plant.temp_off10); V(plant.rh_on10); V(plant.rh_off10);
    V(plant.lux_target); V(plant.germ_threshold10); V(plant.germ10);
    V(plant.have_sample); V(plant.manual); V(plant.humidity_demand); V(plant.fan_demand);
    V(plant.refill_fault); V(plant.water_seen); V(plant.water_raw); V(plant.water_stable); V(plant.alarms);
    V(plant.sample.at_ms); V(plant.sample.number); V(plant.sample.temp10);
    V(plant.sample.humidity10); V(plant.sample.lux); V(plant.sample.valid);
    V(plant.out.led); V(plant.out.fan); V(plant.out.drip); V(plant.out.mist); V(plant.out.refill);
    V(plant.manual_out.led); V(plant.manual_out.fan); V(plant.manual_out.drip);
    V(plant.manual_out.mist); V(plant.manual_out.refill);
#define P(x) V(plant.x.on); V(plant.x.has_stopped); V(plant.x.started); V(plant.x.stopped)
    P(drip); P(mist); P(refill);
    V(clock_ms);
#undef P
#undef V
    return i;
}

void lab_trace(int line) {
    if (trace_count>=256) return;
    trace_lines[trace_count]=line;
    lab_state(trace_states[trace_count]);
    trace_count++;
}
API void lab_trace_clear(void) { trace_count=0; }
API int lab_trace_size(void) { return trace_count; }
API int lab_trace_at(int index, int64_t *v) {
    if (index<0 || index>=trace_count) return 0;
    memcpy(v,trace_states[index],sizeof(trace_states[index]));
    return trace_lines[index];
}
API void lab_reset(uint32_t boot, uint32_t now) {
    clock_ms=now; trace_count=0; planter_init(&plant,boot);
}
API void lab_sample(uint32_t now, uint32_t number, int temp, int rh, int lux, int valid) {
    SensorSample s={.at_ms=now,.number=number,.temp10=temp,.humidity10=rh,.lux=lux,.valid=(uint8_t)valid};
    clock_ms=now; planter_sample(&plant,&s);
}
API void lab_step(uint32_t now, int low, int valid) {
    clock_ms=now; planter_step(&plant,low!=0,valid!=0,now);
}
API int lab_command(int op, const int32_t *args, uint32_t seq, uint32_t boot,
                    int ttl, uint32_t received, uint32_t now, int corrupt) {
    clock_ms=now;
    Message m={.type=MSG_COMMAND,.seq=seq};
    m.v[0]=op;
    for (int i=0;i<6;i++) m.v[i+1]=args[i];
    memcpy(&m.v[7],&boot,sizeof(boot)); m.v[8]=ttl;
    proto_encode(&m,last_frame);
    if (corrupt) last_frame[20]^=1;
    ProtoParser parser={0}; Message decoded={0}; bool good=false;
    for (int i=0;i<PROTO_SIZE;i++) if (proto_feed(&parser,last_frame[i],&decoded)) good=true;
    return good?planter_command(&plant,&decoded,received,now):-1;
}
API void lab_frame(uint8_t *out, int command) {
    if (command) { memcpy(out,last_frame,PROTO_SIZE); return; }
    Message m; planter_telemetry(&plant,clock_ms,1,&m); proto_encode(&m,out);
}
API int lab_layout(int *v) {
    v[0]=(int)sizeof(Planter); v[1]=(int)sizeof(SensorSample); v[2]=(int)sizeof(Message);
    v[3]=(int)offsetof(Message,type); v[4]=(int)offsetof(Message,seq); v[5]=(int)offsetof(Message,v);
    return 6;
}
