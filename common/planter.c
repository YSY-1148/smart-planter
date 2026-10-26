#include "planter.h"
#include <string.h>
#define ENV_MAX_AGE_MS 6500u
#define GERM_MAX_AGE_MS 1800000u
#define PUMP_MAX_MS 5000u
#define PUMP_REST_MS 60000u
#define REFILL_MAX_MS 20000u
static uint32_t elapsed(uint32_t now, uint32_t then) { return now-then; }
static bool bit(int32_t x) { return x==0 || x==1; }
static bool pump_step(Pump *p, bool request, uint32_t now, uint32_t max_ms, uint32_t rest) {
    if (p->on && (!request || elapsed(now,p->started)>=max_ms)) {
        p->on=false; p->stopped=now; p->has_stopped=true;
    } else if (!p->on && request && (!p->has_stopped || elapsed(now,p->stopped)>=rest)) {
        p->on=true; p->started=now;
    }
    return p->on;
}
void planter_init(Planter *p, uint32_t boot) {
    memset(p,0,sizeof(*p)); p->boot=boot;
    p->temp_on10=280; p->temp_off10=260;
    p->rh_on10=500; p->rh_off10=700;
    p->lux_target=10000; p->germ_threshold10=800; p->germ10=-1;
    p->sample_number=UINT32_MAX;
}
void planter_sample(Planter *p, const SensorSample *s) { p->sample=*s; p->have_sample=true; }
int planter_command(Planter *p, const Message *m, uint32_t received, uint32_t now) {
    if (m->type!=MSG_COMMAND || !m->seq || m->seq>INT32_MAX) return ACK_INVALID;
    if ((uint32_t)m->v[7]!=p->boot) return ACK_BOOT;
    if (m->v[8]<=0 || m->v[8]>30000 || elapsed(now,received)>=(uint32_t)m->v[8]) return ACK_EXPIRED;
    if (m->seq==p->last_command) return ACK_DUPLICATE;
    if (m->seq<p->last_command) return ACK_STALE;
    const int32_t *v=m->v;
    switch (v[0]) {
    case OP_CONFIG:
        if (v[1]<100 || v[1]>450 || v[2]<50 || v[2]>v[1]-10 ||
            v[3]<200 || v[3]>800 || v[4]<v[3]+50 || v[4]>900 ||
            v[5]<100 || v[5]>50000 || v[6]<0 || v[6]>1000) return ACK_INVALID;
        p->temp_on10=v[1]; p->temp_off10=v[2]; p->rh_on10=v[3];
        p->rh_off10=v[4]; p->lux_target=v[5]; p->germ_threshold10=v[6];
        break;
    case OP_MANUAL:
        if (v[1]<0 || v[1]>100 || !bit(v[2]) || !bit(v[3]) || !bit(v[4]) || !bit(v[5]) ||
            v[6]<1000 || v[6]>30000 || (v[3] && v[4]) || (v[5] && (v[3] || v[4]))) return ACK_INVALID;
        p->manual_out=(Outputs){(uint8_t)v[1],(uint8_t)v[2],(uint8_t)v[3],(uint8_t)v[4],(uint8_t)v[5]};
        p->manual=true; p->manual_started=now; p->manual_ms=(uint32_t)v[6];
        break;
    case OP_AUTO: p->manual=false; break;
    case OP_GERMINATION:
        if (v[1]<0 || v[1]>1000) return ACK_INVALID;
        p->germ10=v[1]; p->germ_at=now;
        break;
    case OP_CLEAR_FAULT:
        p->refill_fault=false;
        break;
    default: return ACK_INVALID;
    }
    p->last_command=m->seq;
    return ACK_OK;
}
void planter_step(Planter *p, bool low, bool water_valid, uint32_t now) {
    if (!p->water_seen || p->water_raw!=low) {
        p->water_seen=true; p->water_raw=low; p->water_changed=now; p->water_stable=false;
    }
    if (elapsed(now,p->water_changed)>=300u) p->water_stable=true;
    bool fresh=p->have_sample && elapsed(now,p->sample.at_ms)<=ENV_MAX_AGE_MS;
    bool dht=fresh && (p->sample.valid&SENSOR_DHT);
    bool light=fresh && (p->sample.valid&SENSOR_LIGHT);
    bool germ=p->germ10>=0 && elapsed(now,p->germ_at)<=GERM_MAX_AGE_MS;
    p->alarms=(!fresh?ALARM_STALE:0) | (!dht?ALARM_DHT:0) | (!light?ALARM_LIGHT:0) |
        (low?ALARM_LOW_WATER:0) | (!water_valid?ALARM_WATER_INVALID:0) | (!germ?ALARM_GERM_UNKNOWN:0);
    if (p->manual && elapsed(now,p->manual_started)>=p->manual_ms) p->manual=false;
    if (dht) {
        if (p->sample.temp10>=p->temp_on10) p->fan_demand=true;
        else if (p->sample.temp10<=p->temp_off10) p->fan_demand=false;
        if (p->sample.humidity10<=p->rh_on10) p->humidity_demand=true;
        else if (p->sample.humidity10>=p->rh_off10) p->humidity_demand=false;
    } else { p->fan_demand=false; p->humidity_demand=false; }
    Outputs desired={0};
    if (p->manual) desired=p->manual_out;
    else {
        desired.fan=p->fan_demand;
        desired.led=p->out.led;
        if (!light) desired.led=0;
        else if (p->sample.number!=p->sample_number) {
            int led=desired.led;
            if (p->sample.lux<p->lux_target*9/10) led+=5;
            else if (p->sample.lux>p->lux_target*11/10) led-=5;
            desired.led=(uint8_t)(led<0?0:led>100?100:led);
        }
        desired.drip=p->humidity_demand && (!germ || p->germ10<p->germ_threshold10);
        desired.mist=p->humidity_demand && germ && p->germ10>=p->germ_threshold10;
        desired.refill=low;
    }
    if (p->have_sample) p->sample_number=p->sample.number;
    bool can_water=water_valid && p->water_stable && !low;
    bool can_refill=water_valid && p->water_stable && low && !p->refill_fault;
    if (p->refill.on && elapsed(now,p->refill.started)>=REFILL_MAX_MS && desired.refill && can_refill)
        p->refill_fault=true;
    desired.refill=desired.refill && can_refill && !p->refill_fault;
    desired.drip=desired.drip && can_water && !desired.refill;
    desired.mist=desired.mist && can_water && !desired.refill && !desired.drip;
    p->out=desired;
    p->out.drip=pump_step(&p->drip,desired.drip,now,PUMP_MAX_MS,PUMP_REST_MS);
    p->out.mist=pump_step(&p->mist,desired.mist,now,PUMP_MAX_MS,PUMP_REST_MS);
    p->out.refill=pump_step(&p->refill,desired.refill,now,REFILL_MAX_MS,1000u);
    if (p->refill_fault) p->alarms|=ALARM_REFILL_TIMEOUT;
}
void planter_telemetry(const Planter *p, uint32_t now, uint32_t seq, Message *m) {
    memset(m,0,sizeof(*m)); m->type=MSG_TELEMETRY; m->seq=seq;
    m->v[0]=(int32_t)p->boot; m->v[1]=(int32_t)(now/1000u);
    bool fresh=p->have_sample && elapsed(now,p->sample.at_ms)<=ENV_MAX_AGE_MS;
    uint8_t valid=fresh?p->sample.valid:0;
    m->v[2]=(valid&SENSOR_DHT)?p->sample.temp10:-1000;
    m->v[3]=(valid&SENSOR_DHT)?p->sample.humidity10:-1;
    m->v[4]=(valid&SENSOR_LIGHT)?p->sample.lux:-1;
    m->v[5]=p->water_raw; m->v[6]=valid; m->v[7]=p->manual;
    m->v[8]=p->out.led; m->v[9]=p->out.fan; m->v[10]=p->out.drip;
    m->v[11]=p->out.mist; m->v[12]=p->out.refill; m->v[13]=p->alarms;
    m->v[14]=(p->alarms&ALARM_GERM_UNKNOWN)?-1:p->germ10;
    m->v[15]=(int32_t)p->last_command;
}
