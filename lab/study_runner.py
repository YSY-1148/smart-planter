"""Run one native teaching lesson in a separate process (the DLL has global state)."""
import json
import sys

from engine import Simulation
from lessons import LESSONS


TOPIC_STEPS = {
    17: [('先取得25°C样本', {'inputs': {'temp':25}, 'ms':2000}),
         ('改为30°C，仅过100 ms', {'inputs': {'temp':30}, 'ms':100}),
         ('等到下一次环境采样', {'ms':1900})],
    18: [('25°C初始关闭', {'inputs': {'temp':25}, 'ms':2000}),
         ('恰好28°C开启', {'inputs': {'temp':28}, 'ms':2000}),
         ('27°C保持开启', {'inputs': {'temp':27}, 'ms':2000}),
         ('恰好26°C关闭', {'inputs': {'temp':26}, 'ms':2000}),
         ('重置后直接27°C：仍关闭', {'reset':True, 'inputs': {'temp':27}, 'ms':2000})],
    20: [('1000 lx第一份样本', {'inputs': {'lux':1000}, 'ms':2000}),
         ('100 ms后仍是旧样本', {'ms':100}),
         ('下一份样本再次调整', {'ms':1900}),
         ('恰好9000 lx保持', {'inputs': {'lux':9000}, 'ms':2000}),
         ('恰好11000 lx保持', {'inputs': {'lux':11000}, 'ms':2000}),
         ('BH1750失效后关闭自动补光', {'inputs': {'light':False}, 'ms':2000})],
    21: [('t=100 ms首次看到低液位', {'inputs': {'low':True}, 'ms':100}),
         ('t=300 ms，仅稳定200 ms', {'ms':200}),
         ('t=400 ms，已稳定300 ms', {'ms':100})],
    22: [('低湿度触发滴灌，记录启动点', {'inputs': {'rh':45}, 'ms':2000}),
         ('启动后5 s，达到运行上限', {'ms':5000}),
         ('停止后59.9 s，仍在冷却', {'ms':59900}),
         ('停止后60 s，可以重启', {'ms':100})]
}


def run(lesson_id, topic_id=None):
    lesson = next((item for item in LESSONS if item['id'] == lesson_id), None)
    if lesson is None:
        raise ValueError('未知实验')
    sim = Simulation()
    sim.action({'action': 'lesson', 'id': lesson_id})
    observations = []
    for label, operation in TOPIC_STEPS.get(topic_id, lesson['steps']):
        if topic_id in TOPIC_STEPS:
            if operation.get('reset'): sim.reset(0)
            if 'inputs' in operation: sim.set_inputs(operation['inputs'])
            sim.advance(operation.get('ms',100))
        else:
            sim.next_experiment()
        snap = sim.snapshot()
        observations.append(dict(label=label, elapsed=snap['elapsed'], state=snap['state'],
                                 inputs=dict(snap['inputs']), alarms=snap['alarms'],
                                 command=snap['command']))
    return dict(id=lesson_id, title=(f'专题 {topic_id} 边界验证' if topic_id in TOPIC_STEPS else lesson['title']), observations=observations,
                evidence='原项目 C 控制代码 / 独立进程 / 模拟输入与时间；不是硬件实测')


if __name__ == '__main__':
    print(json.dumps(run(sys.argv[1],int(sys.argv[2]) if len(sys.argv)>2 else None), ensure_ascii=True, allow_nan=False))
