#include <Arduino.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/queue.h"
#include <time.h>
#include <sys/time.h>
#include "protocol.h"
#if __has_include("secrets.h")
#include "secrets.h"
#else
#include "secrets.example.h"
#endif

struct Received { Message message; uint32_t at; };
static HardwareSerial stm32(2);
static WiFiClientSecure transport;
static PubSubClient mqtt(transport);
static QueueHandle_t telemetryQueue, ackQueue, commandQueue;
static char telemetryTopic[96], commandTopic[96], ackTopic[96], statusTopic[96];
static bool pending=false;
static Message waiting;
static uint64_t expiresAt;
static uint32_t sentAt;
static unsigned attempts;

static uint64_t epochMs() { struct timeval t; gettimeofday(&t,nullptr); return (uint64_t)t.tv_sec*1000u+t.tv_usec/1000u; }
static bool publishAck(uint32_t id, int code, const char *stage) {
    StaticJsonDocument<256> doc;
    doc["id"]=id; doc["code"]=code; doc["stage"]=stage; doc["at_ms"]=epochMs();
    char out[256]; serializeJson(doc,out,sizeof(out));
    return mqtt.connected() && mqtt.publish(ackTopic,out,false);
}
static void UartTask(void *arg) {
    (void)arg;
    ProtoParser parser={}; Message message;
    for (;;) {
        while (stm32.available()) {
            if (!proto_feed(&parser,(uint8_t)stm32.read(),&message)) continue;
            Received received={message,millis()};
            if (message.type==MSG_TELEMETRY) xQueueOverwrite(telemetryQueue,&received);
            else if (message.type==MSG_ACK) xQueueSend(ackQueue,&received,0);
        }
        if (xQueueReceive(commandQueue,&message,0)==pdTRUE) {
            uint8_t frame[PROTO_SIZE]; proto_encode(&message,frame); stm32.write(frame,sizeof(frame));
        }
        vTaskDelay(pdMS_TO_TICKS(2));
    }
}
static void commandReceived(char *topic, byte *payload, unsigned length) {
    if (strcmp(topic,commandTopic) || length>1024) return;
    StaticJsonDocument<1024> doc;
    if (deserializeJson(doc,payload,length) || !doc["id"].is<uint32_t>()) return;
    uint32_t id=doc["id"].as<uint32_t>();
    if (!id || id>INT32_MAX) return;
    if (pending) { if (id!=waiting.seq) publishAck(id,9,"gateway"); return; }
    if (!doc["boot"].is<uint32_t>() || !doc["op"].is<int>() ||
        !doc["issued_ms"].is<uint64_t>() || !doc["expires_ms"].is<uint64_t>() ||
        !doc["args"].is<JsonArray>() || doc["args"].size()!=6) {
        publishAck(id,2,"gateway"); return;
    }
    uint64_t now=epochMs(), issued=doc["issued_ms"], expiry=doc["expires_ms"];
    if (now<1700000000000ULL || issued>now+5000u || expiry<=now || expiry<=issued ||
        expiry-issued>30000u || expiry-now>30000u) { publishAck(id,3,"gateway"); return; }
    Received latest;
    if (xQueuePeek(telemetryQueue,&latest,0)!=pdTRUE || millis()-latest.at>5000u) {
        publishAck(id,6,"gateway"); return;
    }
    uint32_t boot=doc["boot"].as<uint32_t>();
    if (boot!=(uint32_t)latest.message.v[0]) { publishAck(id,5,"gateway"); return; }
    Message m={}; m.type=MSG_COMMAND; m.seq=id; m.v[0]=doc["op"].as<int>();
    for (int i=0;i<6;i++) {
        if (!doc["args"][i].is<int32_t>()) { publishAck(id,2,"gateway"); return; }
        m.v[i+1]=doc["args"][i].as<int32_t>();
    }
    m.v[7]=(int32_t)boot; m.v[8]=(int32_t)(expiry-now);
    if (xQueueSend(commandQueue,&m,0)!=pdTRUE) { publishAck(id,9,"gateway"); return; }
    waiting=m; expiresAt=expiry; pending=true; sentAt=millis(); attempts=1;
}
static bool publishTelemetry(const Received &received) {
    const Message &m=received.message;
    StaticJsonDocument<1024> doc;
    doc["device"]=DEVICE_ID; doc["boot"]=(uint32_t)m.v[0]; doc["seq"]=m.seq;
    doc["uptime_s"]=m.v[1]; doc["at_ms"]=epochMs(); doc["sample_age_ms"]=millis()-received.at;
    if (m.v[6]&1) { doc["temp_c"]=m.v[2]/10.0; doc["humidity_pct"]=m.v[3]/10.0; }
    else { doc["temp_c"]=nullptr; doc["humidity_pct"]=nullptr; }
    if (m.v[6]&2) doc["lux"]=m.v[4]; else doc["lux"]=nullptr;
    doc["water_low"]=(bool)m.v[5]; doc["sensor_mask"]=m.v[6];
    doc["mode"]=m.v[7]?"manual":"auto";
    JsonObject outputs=doc.createNestedObject("outputs");
    outputs["led_pct"]=m.v[8]; outputs["fan"]=(bool)m.v[9]; outputs["drip"]=(bool)m.v[10];
    outputs["mist"]=(bool)m.v[11]; outputs["refill"]=(bool)m.v[12];
    doc["alarms"]=m.v[13];
    if (m.v[14]>=0) doc["germination_pct"]=m.v[14]/10.0; else doc["germination_pct"]=nullptr;
    doc["last_command"]=m.v[15];
    char out[1024]; size_t n=serializeJson(doc,out,sizeof(out));
    return n<sizeof(out) && mqtt.publish(telemetryTopic,out,false);
}
void setup() {
    Serial.begin(115200);
    snprintf(telemetryTopic,sizeof(telemetryTopic),"planter/%s/telemetry",DEVICE_ID);
    snprintf(commandTopic,sizeof(commandTopic),"planter/%s/command",DEVICE_ID);
    snprintf(ackTopic,sizeof(ackTopic),"planter/%s/ack",DEVICE_ID);
    snprintf(statusTopic,sizeof(statusTopic),"planter/%s/status",DEVICE_ID);
    telemetryQueue=xQueueCreate(1,sizeof(Received)); ackQueue=xQueueCreate(8,sizeof(Received));
    commandQueue=xQueueCreate(8,sizeof(Message));
    configASSERT(telemetryQueue && ackQueue && commandQueue);
    stm32.setRxBufferSize(1024); stm32.begin(115200,SERIAL_8N1,16,17);
    configASSERT(xTaskCreatePinnedToCore(UartTask,"stm32-uart",4096,nullptr,3,nullptr,1)==pdPASS);
    WiFi.mode(WIFI_STA); WiFi.setAutoReconnect(true); WiFi.begin(WIFI_SSID,WIFI_PASSWORD);
    configTime(0,0,"pool.ntp.org","time.cloudflare.com");
    transport.setCACert(MQTT_CA); transport.setHandshakeTimeout(5);
    mqtt.setServer(MQTT_HOST,MQTT_PORT); mqtt.setCallback(commandReceived);
    configASSERT(mqtt.setBufferSize(1536)); mqtt.setKeepAlive(20); mqtt.setSocketTimeout(2);
}
void loop() {
    static uint32_t lastConnect=0, lastWifi=0, lastReport=0, lastSeq=0, lastBoot=0;
    uint32_t now=millis();
    if (WiFi.status()!=WL_CONNECTED && now-lastWifi>=10000u) { WiFi.reconnect(); lastWifi=now; }
    if (WiFi.status()==WL_CONNECTED && time(nullptr)>1700000000 && !mqtt.connected() && now-lastConnect>=5000u) {
        lastConnect=now;
        char clientId[80]; uint64_t chip=ESP.getEfuseMac();
        snprintf(clientId,sizeof(clientId),"%s-%08lx",DEVICE_ID,(unsigned long)(chip&0xffffffffu));
        if (mqtt.connect(clientId,MQTT_USER,MQTT_PASSWORD,statusTopic,1,true,"{\"gateway_online\":false}")) {
            mqtt.subscribe(commandTopic,1);
            mqtt.publish(statusTopic,"{\"gateway_online\":true}",true);
            lastSeq=0;
            Serial.println("MQTT connected");
        } else Serial.printf("MQTT state=%d\n",mqtt.state());
    }
    if (mqtt.connected()) mqtt.loop();
    Received ack;
    if (mqtt.connected() && xQueuePeek(ackQueue,&ack,0)==pdTRUE) {
        if (publishAck(ack.message.seq,ack.message.v[0],"stm32")) {
            if (pending && waiting.seq==ack.message.seq) pending=false;
            xQueueReceive(ackQueue,&ack,0);
        }
    }
    if (pending) {
        uint64_t epoch=epochMs();
        if (epoch>=expiresAt || (attempts>=3 && millis()-sentAt>=800u)) {
            if (publishAck(waiting.seq,7,"gateway")) pending=false;
        } else if (millis()-sentAt>=800u && attempts<3) {
            waiting.v[8]=(int32_t)(expiresAt-epoch);
            if (xQueueSend(commandQueue,&waiting,0)==pdTRUE) { attempts++; sentAt=millis(); }
        }
    }
    Received latest;
    if (mqtt.connected() && millis()-lastReport>=1000u && xQueuePeek(telemetryQueue,&latest,0)==pdTRUE &&
        millis()-latest.at<=5000u && (latest.message.seq!=lastSeq || (uint32_t)latest.message.v[0]!=lastBoot)) {
        if (publishTelemetry(latest)) { lastSeq=latest.message.seq; lastBoot=(uint32_t)latest.message.v[0]; lastReport=millis(); }
    }
    delay(10);
}
