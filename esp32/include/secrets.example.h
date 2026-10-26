#pragma once
#define WIFI_SSID "CHANGE_ME"
#define WIFI_PASSWORD "CHANGE_ME"
#define MQTT_HOST "mqtt.example.com"
#define MQTT_PORT 8883
#define MQTT_USER "planter-001"
#define MQTT_PASSWORD "CHANGE_ME"
#define DEVICE_ID "planter-001"
static const char MQTT_CA[] = R"CERT(
-----BEGIN CERTIFICATE-----
REPLACE_WITH_CONTENTS_OF_cloud_mosquitto_certs_ca_crt
-----END CERTIFICATE-----
)CERT";
