#ifndef PLANTER_CONTROL_H
#define PLANTER_CONTROL_H
#include "protocol.h"
enum { SENSOR_DHT=1, SENSOR_LIGHT=2 };
enum { OP_CONFIG=1, OP_MANUAL=2, OP_AUTO=3, OP_GERMINATION=4, OP_CLEAR_FAULT=5 };
enum { ACK_OK=0, ACK_DUPLICATE=1, ACK_INVALID=2, ACK_EXPIRED=3, ACK_STALE=4, ACK_BOOT=5 };
enum { ALARM_STALE=1, ALARM_DHT=2, ALARM_LIGHT=4, ALARM_LOW_WATER=8,
       ALARM_REFILL_TIMEOUT=16, ALARM_WATER_INVALID=32, ALARM_GERM_UNKNOWN=64 };
typedef struct {
    uint32_t at_ms, number;
    int32_t temp10, humidity10, lux;
    uint8_t valid;
} SensorSample;
typedef struct { uint8_t led, fan, drip, mist, refill; } Outputs;
typedef struct { bool on, has_stopped; uint32_t started, stopped; } Pump;
typedef struct {
    uint32_t boot, last_command, sample_number, manual_started, manual_ms, germ_at;
    uint32_t water_changed;
    int32_t temp_on10, temp_off10, rh_on10, rh_off10, lux_target, germ_threshold10;
    int32_t germ10;
    bool have_sample, manual, humidity_demand, fan_demand, refill_fault;
    bool water_seen, water_raw, water_stable;
    uint16_t alarms;
    SensorSample sample;
    Outputs out, manual_out;
    Pump drip, mist, refill;
} Planter;
void planter_init(Planter *p, uint32_t boot);
void planter_sample(Planter *p, const SensorSample *s);
int planter_command(Planter *p, const Message *m, uint32_t received, uint32_t now);
void planter_step(Planter *p, bool water_low, bool water_valid, uint32_t now);
void planter_telemetry(const Planter *p, uint32_t now, uint32_t seq, Message *m);
#endif
