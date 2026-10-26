#ifndef PLANTER_BOARD_H
#define PLANTER_BOARD_H
#include "planter.h"
void board_init(void);
void board_panic(void);
uint32_t board_ms(void);
uint32_t board_boot_id(void);
void board_sensor_read(SensorSample *s);
bool board_water_low(void);
void board_outputs(const Outputs *o);
bool board_uart_read(uint8_t *byte);
bool board_uart_write(const Message *m);
void board_watchdog_start(void);
void board_watchdog_feed(void);
void app_start(void);
#endif
