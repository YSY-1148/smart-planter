#include "FreeRTOS.h"
#include "task.h"
#include "queue.h"
#include "board.h"
typedef struct { Message m; uint32_t received; } Command;
static QueueHandle_t samples, statuses, commands, acks;
static StaticQueue_t sample_cb, status_cb, command_cb, ack_cb;
static uint8_t sample_data[sizeof(SensorSample)], status_data[sizeof(Message)];
static uint8_t command_data[8*sizeof(Command)], ack_data[8*sizeof(Message)];
static StaticTask_t sensor_cb, control_cb, comm_cb, idle_cb;
static StackType_t sensor_stack[512], control_stack[768], comm_stack[768], idle_stack[128];
static void SensorTask(void *arg) {
    (void)arg;
    TickType_t next=xTaskGetTickCount();
    SensorSample s={0};
    for (;;) {
        board_sensor_read(&s); s.at_ms=board_ms(); s.number++;
        xQueueOverwrite(samples,&s);
        vTaskDelayUntil(&next,pdMS_TO_TICKS(2000));
    }
}
static void ControlTask(void *arg) {
    (void)arg;
    Planter p; planter_init(&p,board_boot_id());
    TickType_t next=xTaskGetTickCount();
    board_watchdog_start();
    for (;;) {
        SensorSample s; Command c; Message state;
        uint32_t now=board_ms();
        if (xQueueReceive(samples,&s,0)==pdTRUE) planter_sample(&p,&s);
        for (int i=0;i<8 && xQueueReceive(commands,&c,0)==pdTRUE;i++) {
            Message ack={.type=MSG_ACK,.seq=c.m.seq};
            ack.v[0]=planter_command(&p,&c.m,c.received,now);
            ack.v[3]=(int32_t)p.boot;
            xQueueSend(acks,&ack,0);
        }
        planter_step(&p,board_water_low(),true,now);
        board_outputs(&p.out);
        planter_telemetry(&p,now,0,&state);
        xQueueOverwrite(statuses,&state);
        board_watchdog_feed();
        vTaskDelayUntil(&next,pdMS_TO_TICKS(100));
    }
}
static void CommTask(void *arg) {
    (void)arg;
    ProtoParser parser={0}; uint32_t last=0, seq=0;
    for (;;) {
        uint8_t byte; Message m;
        while (board_uart_read(&byte)) {
            if (proto_feed(&parser,byte,&m) && m.type==MSG_COMMAND) {
                Command c={m,board_ms()};
                if (xQueueSend(commands,&c,0)!=pdTRUE) {
                    Message ack={.type=MSG_ACK,.seq=m.seq}; ack.v[0]=9;
                    board_uart_write(&ack);
                }
            }
        }
        for (int i=0;i<8 && xQueueReceive(acks,&m,0)==pdTRUE;i++) board_uart_write(&m);
        uint32_t now=board_ms();
        if (now-last>=1000u && xQueuePeek(statuses,&m,0)==pdTRUE) {
            m.seq=++seq; board_uart_write(&m); last=now;
        }
        vTaskDelay(pdMS_TO_TICKS(5));
    }
}
void vApplicationGetIdleTaskMemory(StaticTask_t **cb, StackType_t **stack, uint32_t *n) {
    *cb=&idle_cb; *stack=idle_stack; *n=128;
}
void vApplicationStackOverflowHook(TaskHandle_t task, char *name) {
    (void)task; (void)name; board_panic();
}
void app_start(void) {
    samples=xQueueCreateStatic(1,sizeof(SensorSample),sample_data,&sample_cb);
    statuses=xQueueCreateStatic(1,sizeof(Message),status_data,&status_cb);
    commands=xQueueCreateStatic(8,sizeof(Command),command_data,&command_cb);
    acks=xQueueCreateStatic(8,sizeof(Message),ack_data,&ack_cb);
    configASSERT(samples && statuses && commands && acks);
    configASSERT(xTaskCreateStatic(SensorTask,"sensor",512,0,3,sensor_stack,&sensor_cb));
    configASSERT(xTaskCreateStatic(ControlTask,"control",768,0,4,control_stack,&control_cb));
    configASSERT(xTaskCreateStatic(CommTask,"comm",768,0,2,comm_stack,&comm_cb));
    vTaskStartScheduler();
}
