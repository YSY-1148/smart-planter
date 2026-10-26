#include "stm32f4xx_hal.h"
#include "FreeRTOS.h"
#include "task.h"
#include "board.h"
#include <string.h>
static I2C_HandleTypeDef i2c;
static UART_HandleTypeDef uart;
static DMA_HandleTypeDef rx_dma;
static TIM_HandleTypeDef pwm;
static IWDG_HandleTypeDef watchdog;
static uint8_t rx_data[512];
static uint16_t rx_pos;
static bool bh_ready;
static void check(HAL_StatusTypeDef status) { if (status!=HAL_OK) board_panic(); }
static void gpio(GPIO_TypeDef *port, uint32_t pins, uint32_t mode, uint32_t pull, uint32_t af) {
    GPIO_InitTypeDef c={0}; c.Pin=pins; c.Mode=mode; c.Pull=pull;
    c.Speed=GPIO_SPEED_FREQ_HIGH; c.Alternate=af; HAL_GPIO_Init(port,&c);
}
static void clock_init(void) {
    __HAL_RCC_PWR_CLK_ENABLE();
    __HAL_PWR_VOLTAGESCALING_CONFIG(PWR_REGULATOR_VOLTAGE_SCALE1);
    RCC_OscInitTypeDef o={0}; o.OscillatorType=RCC_OSCILLATORTYPE_HSI;
    o.HSIState=RCC_HSI_ON; o.HSICalibrationValue=RCC_HSICALIBRATION_DEFAULT;
    o.PLL.PLLState=RCC_PLL_ON; o.PLL.PLLSource=RCC_PLLSOURCE_HSI;
    o.PLL.PLLM=16; o.PLL.PLLN=336; o.PLL.PLLP=RCC_PLLP_DIV2; o.PLL.PLLQ=7;
    check(HAL_RCC_OscConfig(&o));
    RCC_ClkInitTypeDef c={0}; c.ClockType=RCC_CLOCKTYPE_HCLK|RCC_CLOCKTYPE_SYSCLK|RCC_CLOCKTYPE_PCLK1|RCC_CLOCKTYPE_PCLK2;
    c.SYSCLKSource=RCC_SYSCLKSOURCE_PLLCLK; c.AHBCLKDivider=RCC_SYSCLK_DIV1;
    c.APB1CLKDivider=RCC_HCLK_DIV4; c.APB2CLKDivider=RCC_HCLK_DIV2;
    check(HAL_RCC_ClockConfig(&c,FLASH_LATENCY_5));
}
void board_init(void) {
    HAL_Init(); clock_init(); HAL_NVIC_SetPriorityGrouping(NVIC_PRIORITYGROUP_4);
    __HAL_RCC_GPIOA_CLK_ENABLE(); __HAL_RCC_GPIOB_CLK_ENABLE(); __HAL_RCC_GPIOD_CLK_ENABLE();
    HAL_GPIO_WritePin(GPIOD,GPIO_PIN_12|GPIO_PIN_13|GPIO_PIN_14|GPIO_PIN_15,GPIO_PIN_RESET);
    gpio(GPIOD,GPIO_PIN_12|GPIO_PIN_13|GPIO_PIN_14|GPIO_PIN_15,GPIO_MODE_OUTPUT_PP,GPIO_NOPULL,0);
    gpio(GPIOB,GPIO_PIN_1,GPIO_MODE_INPUT,GPIO_PULLUP,0);
    gpio(GPIOB,GPIO_PIN_0,GPIO_MODE_OUTPUT_OD,GPIO_PULLUP,0);
    HAL_GPIO_WritePin(GPIOB,GPIO_PIN_0,GPIO_PIN_SET);
    __HAL_RCC_I2C1_CLK_ENABLE();
    gpio(GPIOB,GPIO_PIN_8|GPIO_PIN_9,GPIO_MODE_AF_OD,GPIO_PULLUP,GPIO_AF4_I2C1);
    i2c.Instance=I2C1; i2c.Init.ClockSpeed=100000; i2c.Init.DutyCycle=I2C_DUTYCYCLE_2;
    i2c.Init.AddressingMode=I2C_ADDRESSINGMODE_7BIT;
    check(HAL_I2C_Init(&i2c));
    __HAL_RCC_USART2_CLK_ENABLE(); __HAL_RCC_DMA1_CLK_ENABLE();
    gpio(GPIOA,GPIO_PIN_2|GPIO_PIN_3,GPIO_MODE_AF_PP,GPIO_PULLUP,GPIO_AF7_USART2);
    uart.Instance=USART2; uart.Init.BaudRate=115200; uart.Init.WordLength=UART_WORDLENGTH_8B;
    uart.Init.StopBits=UART_STOPBITS_1; uart.Init.Parity=UART_PARITY_NONE;
    uart.Init.Mode=UART_MODE_TX_RX; uart.Init.HwFlowCtl=UART_HWCONTROL_NONE; uart.Init.OverSampling=UART_OVERSAMPLING_16;
    check(HAL_UART_Init(&uart));
    rx_dma.Instance=DMA1_Stream5; rx_dma.Init.Channel=DMA_CHANNEL_4;
    rx_dma.Init.Direction=DMA_PERIPH_TO_MEMORY; rx_dma.Init.PeriphInc=DMA_PINC_DISABLE;
    rx_dma.Init.MemInc=DMA_MINC_ENABLE; rx_dma.Init.PeriphDataAlignment=DMA_PDATAALIGN_BYTE;
    rx_dma.Init.MemDataAlignment=DMA_MDATAALIGN_BYTE; rx_dma.Init.Mode=DMA_CIRCULAR;
    rx_dma.Init.Priority=DMA_PRIORITY_HIGH; rx_dma.Init.FIFOMode=DMA_FIFOMODE_DISABLE;
    check(HAL_DMA_Init(&rx_dma)); __HAL_LINKDMA(&uart,hdmarx,rx_dma);
    check(HAL_UART_Receive_DMA(&uart,rx_data,sizeof(rx_data)));
    __HAL_DMA_DISABLE_IT(&rx_dma,DMA_IT_HT|DMA_IT_TC|DMA_IT_TE);
    __HAL_UART_DISABLE_IT(&uart,UART_IT_PE); __HAL_UART_DISABLE_IT(&uart,UART_IT_ERR);
    __HAL_RCC_TIM4_CLK_ENABLE();
    gpio(GPIOB,GPIO_PIN_6,GPIO_MODE_AF_PP,GPIO_NOPULL,GPIO_AF2_TIM4);
    pwm.Instance=TIM4; pwm.Init.Prescaler=83; pwm.Init.Period=999;
    pwm.Init.CounterMode=TIM_COUNTERMODE_UP; pwm.Init.ClockDivision=TIM_CLOCKDIVISION_DIV1;
    check(HAL_TIM_PWM_Init(&pwm));
    TIM_OC_InitTypeDef oc={0}; oc.OCMode=TIM_OCMODE_PWM1; oc.OCPolarity=TIM_OCPOLARITY_HIGH;
    check(HAL_TIM_PWM_ConfigChannel(&pwm,&oc,TIM_CHANNEL_1));
    check(HAL_TIM_PWM_Start(&pwm,TIM_CHANNEL_1));
    CoreDebug->DEMCR|=CoreDebug_DEMCR_TRCENA_Msk;
    DWT->CYCCNT=0; DWT->CTRL|=DWT_CTRL_CYCCNTENA_Msk;
}
uint32_t board_ms(void) { return HAL_GetTick(); }
uint32_t board_boot_id(void) {
    __HAL_RCC_RNG_CLK_ENABLE(); RNG_HandleTypeDef rng={0}; rng.Instance=RNG;
    uint32_t id=0; check(HAL_RNG_Init(&rng)); check(HAL_RNG_GenerateRandomNumber(&rng,&id));
    HAL_RNG_DeInit(&rng); return id?id:1;
}
static bool wait_dht(GPIO_PinState level, uint32_t max_us) {
    uint32_t start=DWT->CYCCNT;
    while (HAL_GPIO_ReadPin(GPIOB,GPIO_PIN_0)!=level) {
        if ((uint32_t)(DWT->CYCCNT-start)>max_us*(SystemCoreClock/1000000u)) return false;
    }
    return true;
}
static bool dht_read(int32_t *temp, int32_t *rh) {
    uint8_t b[5]={0}; bool ok=true;
    HAL_GPIO_WritePin(GPIOB,GPIO_PIN_0,GPIO_PIN_RESET); vTaskDelay(pdMS_TO_TICKS(20));
    // DHT11 时序段约 5 ms；USART2 由循环 DMA 接收。
    taskENTER_CRITICAL();
    HAL_GPIO_WritePin(GPIOB,GPIO_PIN_0,GPIO_PIN_SET);
    ok=wait_dht(GPIO_PIN_RESET,100) && wait_dht(GPIO_PIN_SET,100) && wait_dht(GPIO_PIN_RESET,100);
    for (int i=0;i<40 && ok;i++) {
        ok=wait_dht(GPIO_PIN_SET,100);
        uint32_t start=DWT->CYCCNT;
        if (ok) ok=wait_dht(GPIO_PIN_RESET,100);
        uint32_t width=(uint32_t)(DWT->CYCCNT-start)/(SystemCoreClock/1000000u);
        b[i/8]=(uint8_t)((b[i/8]<<1)|(width>45u));
    }
    taskEXIT_CRITICAL();
    if (!ok || (uint8_t)(b[0]+b[1]+b[2]+b[3])!=b[4]) return false;
    *rh=b[0]*10+b[1]; *temp=b[2]*10+(b[3]&0x7f);
    if (b[3]&0x80) *temp=-*temp;
    return *rh>=0 && *rh<=1000 && *temp>=-200 && *temp<=600;
}
static bool bh_read(int32_t *lux) {
    uint8_t raw[2];
    if (!bh_ready) {
        uint8_t on=1, mode=0x10;
        if (HAL_I2C_Master_Transmit(&i2c,0x23<<1,&on,1,20)!=HAL_OK ||
            HAL_I2C_Master_Transmit(&i2c,0x23<<1,&mode,1,20)!=HAL_OK) return false;
        vTaskDelay(pdMS_TO_TICKS(180)); bh_ready=true;
    }
    if (HAL_I2C_Master_Receive(&i2c,0x23<<1,raw,2,20)!=HAL_OK) { bh_ready=false; return false; }
    *lux=(((uint32_t)raw[0]<<8)|raw[1])*10u/12u;
    return true;
}
void board_sensor_read(SensorSample *s) {
    s->valid=0; s->temp10=-1000; s->humidity10=-1; s->lux=-1;
    if (dht_read(&s->temp10,&s->humidity10)) s->valid|=SENSOR_DHT;
    if (bh_read(&s->lux)) s->valid|=SENSOR_LIGHT;
}
bool board_water_low(void) { return HAL_GPIO_ReadPin(GPIOB,GPIO_PIN_1)==GPIO_PIN_SET; }
void board_outputs(const Outputs *o) {
    __HAL_TIM_SET_COMPARE(&pwm,TIM_CHANNEL_1,o->led*10u);
    HAL_GPIO_WritePin(GPIOD,GPIO_PIN_12,o->fan?GPIO_PIN_SET:GPIO_PIN_RESET);
    HAL_GPIO_WritePin(GPIOD,GPIO_PIN_13,o->drip?GPIO_PIN_SET:GPIO_PIN_RESET);
    HAL_GPIO_WritePin(GPIOD,GPIO_PIN_14,o->mist?GPIO_PIN_SET:GPIO_PIN_RESET);
    HAL_GPIO_WritePin(GPIOD,GPIO_PIN_15,o->refill?GPIO_PIN_SET:GPIO_PIN_RESET);
}
bool board_uart_read(uint8_t *b) {
    if (__HAL_UART_GET_FLAG(&uart,UART_FLAG_ORE)) {
        __HAL_UART_CLEAR_OREFLAG(&uart);
        HAL_UART_DMAStop(&uart); rx_pos=0;
        if (HAL_UART_Receive_DMA(&uart,rx_data,sizeof(rx_data))!=HAL_OK) board_panic();
        __HAL_DMA_DISABLE_IT(&rx_dma,DMA_IT_HT|DMA_IT_TC|DMA_IT_TE);
        __HAL_UART_DISABLE_IT(&uart,UART_IT_PE); __HAL_UART_DISABLE_IT(&uart,UART_IT_ERR);
    }
    uint16_t written=(uint16_t)(sizeof(rx_data)-__HAL_DMA_GET_COUNTER(&rx_dma));
    if (written==sizeof(rx_data)) written=0;
    if (rx_pos==written) return false;
    *b=rx_data[rx_pos]; rx_pos=(uint16_t)((rx_pos+1u)%sizeof(rx_data)); return true;
}
bool board_uart_write(const Message *m) {
    uint8_t data[PROTO_SIZE]; proto_encode(m,data);
    return HAL_UART_Transmit(&uart,data,sizeof(data),30)==HAL_OK;
}
void board_watchdog_start(void) {
    watchdog.Instance=IWDG; watchdog.Init.Prescaler=IWDG_PRESCALER_64; watchdog.Init.Reload=2000;
    check(HAL_IWDG_Init(&watchdog));
}
void board_watchdog_feed(void) { HAL_IWDG_Refresh(&watchdog); }
void board_panic(void) {
    __disable_irq(); __HAL_RCC_GPIOD_CLK_ENABLE();
    GPIOD->BSRR=(GPIO_PIN_12|GPIO_PIN_13|GPIO_PIN_14|GPIO_PIN_15)<<16;
    __HAL_RCC_TIM4_CLK_ENABLE(); TIM4->CCR1=0;
    for (;;) {}
}
extern void xPortSysTickHandler(void);
void SysTick_Handler(void) {
    HAL_IncTick();
    if (xTaskGetSchedulerState()!=taskSCHEDULER_NOT_STARTED) xPortSysTickHandler();
}
void HardFault_Handler(void) { board_panic(); }
void MemManage_Handler(void) { board_panic(); }
void BusFault_Handler(void) { board_panic(); }
void UsageFault_Handler(void) { board_panic(); }
