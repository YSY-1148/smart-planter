(() => {
const titles = `写出基本电机模型方程
解释弱磁控制
介绍无位置传感器控制
电机启动前的准备与自检
电流环参数整定
ADC 采样过程与周期
姿态估计如何实现
控制器如何设计
控制算法怎样落实为程序
传感器与 MCU 如何通信
SPI 的通信过程
上位机怎样实现
分析电路拓扑
解释器件选型
采样信号调理电路设计
主控芯片的选择依据
MCU 超频的影响
电源芯片选型
测量电源纹波
电源纹波的影响
计算电源纹波
纹波从哪里产生
Buck 与 Boost 电路
同步与异步通信
内部时钟与外部晶振
通信对时钟精度的要求
介绍 MQTT
收发包错误的定位
频繁争用互斥锁的影响
原子操作的底层实现
变换器控制环程序设计
前馈解耦中的电网电压项
中断频率与 ISR 优化
F28335 上 int 的大小
并发执行与临界资源
局部、全局变量存储位置
静态全局变量的初始化
为什么选择 STM32F4
双 MCU 为什么选择 SPI
结构体在项目中的使用
雷达滤波算法优化
递推数列第 n 项
指定位设置与清除
四种指针声明的区别
六步换相与矢量控制选择
电流、速度双环的整定流程
如何判断整定合适
程序长期运行稳定性
亲自实现矢量控制的经历
无人机控制回路
内环为什么使用 PD
研究算法相对 PID 的优势
速度环参数的物理影响因素
锁相环原理
SOGI 伯德图
平均电流的测量
控制延时的测量
PR 控制器参数整定
LCL 滤波器参数设计
含谐波信号的有效值
软件实现 1 kHz 低通
RC 低通截止频率与传递函数
逆变器指标、THD 与 PF
PFC 控制算法应用
项目中的前馈控制
MATLAB 阶跃响应
编译到装载的过程
静态链接与动态链接
PLT 桩的调用过程
函数参数如何传递
调用栈保存什么
中断与系统调用
设计任务栈
ARM 通用寄存器的作用
不同 MCU 的区别
项目中的编译优化
HardFault 定位
没有调试器如何查死机
Modbus 帧边界与解析
为何自写调度器而不用 RTOS
volatile 与共享计数器原子性
const 与实际存储区域
结构体对齐与 packed
重叠缓冲区的复制
函数指针与回调生命周期
整数提升、混合运算与移位
单生产者单消费者环形队列
链接脚本与装载、运行地址
O0 正常而 O2 异常
浮点算法转定点
Cortex-M 异常入栈
抢占优先级、子优先级与分组
FromISR 与最高系统调用优先级
ISR 最坏执行时间与工作转移
循环 DMA 接收不定长数据
D-cache 与 DMA 一致性
ADC 采样率与信号源阻抗
PWM 频率、占空比及更新时刻
UART 吞吐与传输时长
看门狗怎样检查业务存活
同优先级任务是否轮流运行
优先级反转及继承的边界
通知、信号量、互斥锁与队列选择
任务栈大小的估计
任务创建失败的排查
队列传指针与 DMA 覆盖
软件定时器回调阻塞
周期漂移与执行超时
低 CPU 占用下的任务延迟
内存泄漏、碎片和峰值需求
UART 乱码的排查顺序
SPI 模式与采样沿
I2C 总线卡死与恢复
Modbus RTU 判帧
RS-485 DE 与发送完成
CAN 仲裁与发送错误
CAN Bus-Off 分析及恢复
CAN 位时序与采样点
CAN 负载与低优先级饥饿
CAN FD 与经典 CAN 兼容
Linux 启动链与阶段定位
字符设备阻塞读取及 poll
内核同步原语的上下文限制
设备树匹配与 probe 失败
虚拟地址、MMU、TLB 与 DMA
epoll 边沿触发和非阻塞 I/O
TCP 半包、多帧与非法长度
生产消费失衡与反压
core dump 后继续追根因
智能指针、循环引用与线程
FOC 完整数据流
PWM 调制与死区补偿
电流采样与 PWM 同步
离散 PI 与采样周期
积分饱和与抗饱和
多控制环带宽配合
编码器方向、零点与极对数
三相电流不平衡排查
无感启动与阶段切换
弱磁中的电压、电流和转矩约束
Bootloader 跳转 APP
固件头与合法性检查
升级中断电的恢复
CRC、哈希和数字签名
UDS 刷写与超时状态
复位原因的记录
HardFault 现场保存
日志不干扰控制任务
现场偶发复位实验
长期与故障注入测试
编写并发环形缓冲区
编写可恢复协议解析器
实现并验证 CRC16
无符号时间戳回绕
非阻塞按键状态机
在线滑动平均
带限幅与抗饱和的 PID
CAN 分包与重组
固定块内存池
多任务嵌入式系统综合设计`.split('\n');
const range=(a,b)=>Array.from({length:b-a+1},(_,i)=>a+i);
const groups={
 'C 语言与内存':[34,36,37,40,42,43,44,70,71,...range(81,86)],
 '控制逻辑与算法':[8,9,41,154,155,156],
 'STM32 与外设':[6,10,11,...range(13,26),38,39,75,97,98,99,111,112,113],
 '中断与 DMA':[30,33,74,87,91,92,94,95,96,151],
 '串口协议':[28,79,114,115,152,153],
 'FreeRTOS':[29,35,73,80,93,...range(101,110),159,160],
 'ESP32 与网络':[12,27,127,128],
 '调试与升级':[48,67,68,69,76,77,78,88,89,100,...range(141,150)],
 '工业通信':[...range(116,120),158],
 'Linux 与驱动':[72,...range(121,126),129,130],
 '电机与电源控制':[1,2,3,4,5,7,31,32,45,46,47,...range(49,66),90,...range(131,140),157]
};
const related={fan:[8,9,81],pump:[154,155],light:[43,98],water:[48,149,150],manual:[28,128],stale:[43],germ:[8,9],crc:[28,83,84,152,153],wrap:[86,154],tasks:[29,35,73,80,101,103,104,106,108,109,160],memory:[34,36,37,40,44,70,71,82,83,85],offline:[12,27,128]};
const chipRelated={structure:[16,17,25],i2c:[10,113],uart:[24,26,99,111],irq:[30,33,92,93,94],dma:[87,95,106,151],pwm:[98],queue:[29,35,103,160],watchdog:[100,146,149]};
const evidence=[
 [1,3,'discuss/353157264850755584'],[4,6,'discuss/353158346712752128'],
 [7,12,'creation/subject/cfe8d7bf14ed4cfeb33e81cb25f61778'],[13,15,'discuss/353158680747122688'],
 [16,26,'discuss/389109336897785856?sourceSSR=subject'],[27,30,'discuss/405316940581904384'],
 [31,37,'feed/main/detail/5b18165cd3c243d6a37da38e5d54024c'],[38,41,'discuss/533074402619985920'],
 [42,44,'feed/main/detail/1f1afdf4d5744b769718e114f1ab226b?sourceSSR=users'],
 [45,49,'feed/main/detail/e426cbb3257f475599c1cb9eaea9a6af'],[50,53,'feed/main/detail/cbc59873787742308c788a3a276ed6ab'],
 [54,63,'feed/main/detail/3442889dceb246588cd1d90357b9781d?sourceSSR=users'],
 [64,66,'feed/main/detail/6558e36dd1b14f1884d8db60ccdc407c?sourceSSR=users'],
 [67,74,'feed/main/detail/a2523dc38b1f4335925bd5214556c232'],
 [75,80,'feed/main/detail/96dfc0f8391c443d98e39ceb6d0f3f34?sourceSSR=dynamic']
];
window.LAB_QUESTIONS=titles.map((title,index)=>{const id=index+1;const source=evidence.find(([a,b])=>id>=a&&id<=b);return {id,title,kind:id<=80?'面经整理':'延伸练习',group:Object.entries(groups).find(([,ids])=>ids.includes(id))[0],lesson:Object.entries(related).find(([,ids])=>ids.includes(id))?.[0]||null,chip:Object.entries(chipRelated).find(([,ids])=>ids.includes(id))?.[0]||null,source:source?'https://www.nowcoder.com/'+source[2]:null};});
})();
