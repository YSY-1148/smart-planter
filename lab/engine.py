import ctypes as C
from pathlib import Path
from build import build, ROOT
from lessons import LESSONS

FIELDS = ('boot last_command sample_number manual_started manual_ms germ_at water_changed '
          'temp_on10 temp_off10 rh_on10 rh_off10 lux_target germ_threshold10 germ10 '
          'have_sample manual humidity_demand fan_demand refill_fault water_seen water_raw water_stable alarms '
          'sample_at sample_counter sample_temp10 sample_humidity10 sample_lux sample_valid '
          'out_led out_fan out_drip out_mist out_refill manual_led manual_fan manual_drip manual_mist manual_refill '
          'drip_on drip_has_stopped drip_started drip_stopped mist_on mist_has_stopped mist_started mist_stopped '
          'refill_on refill_has_stopped refill_started refill_stopped now').split()
ACKS = {-1:'CRC 错误，未执行',0:'接受',1:'重复命令，未重执行',2:'参数非法',3:'命令过期',4:'旧序号',5:'启动编号不符'}
ALARMS = [(1,'采样过期'),(2,'温湿度无效'),(4,'光照无效'),(8,'液位低'),(16,'补液超时锁定'),(32,'液位输入无效'),(64,'发芽率未知')]
SOURCES = ['common/planter.c','common/planter.h','common/protocol.c','common/protocol.h',
           'stm32/src/app.c','stm32/src/board.c','stm32/include/FreeRTOSConfig.h','esp32/src/main.cpp']


class Native:
    def __init__(self, traced=True):
        self.dll = C.CDLL(str(build(traced)))
        spec = {
            'lab_reset':([C.c_uint32,C.c_uint32],None),
            'lab_sample':([C.c_uint32,C.c_uint32,C.c_int,C.c_int,C.c_int,C.c_int],None),
            'lab_step':([C.c_uint32,C.c_int,C.c_int],None),
            'lab_command':([C.c_int,C.POINTER(C.c_int32),C.c_uint32,C.c_uint32,C.c_int,C.c_uint32,C.c_uint32,C.c_int],C.c_int),
            'lab_state':([C.POINTER(C.c_int64)],C.c_int),
            'lab_trace_clear':([],None),'lab_trace_size':([],C.c_int),
            'lab_trace_at':([C.c_int,C.POINTER(C.c_int64)],C.c_int),
            'lab_frame':([C.POINTER(C.c_uint8),C.c_int],None),
            'lab_layout':([C.POINTER(C.c_int)],C.c_int),
        }
        for name,(args,ret) in spec.items():
            fn=getattr(self.dll,name); fn.argtypes=args; fn.restype=ret

    def state(self):
        values=(C.c_int64*64)(); size=self.dll.lab_state(values)
        assert size==len(FIELDS)
        return dict(zip(FIELDS,values[:size]))

    def traces(self):
        result=[]
        for i in range(self.dll.lab_trace_size()):
            values=(C.c_int64*64)(); line=self.dll.lab_trace_at(i,values)
            result.append(dict(file='common/planter.c',line=line,state=dict(zip(FIELDS,values[:len(FIELDS)]))))
        return result

    def frame(self, command=False):
        data=(C.c_uint8*74)(); self.dll.lab_frame(data,int(command)); return list(data)


class Simulation:
    def __init__(self, traced=True):
        self.native=Native(traced); self.lesson=LESSONS[0]
        app_lines=(ROOT/'stm32/src/app.c').read_text(encoding='utf-8').splitlines()
        self.commit_line=next(i+1 for i,line in enumerate(app_lines) if 'board_outputs(&p.out)' in line)
        self.reset()

    def reset(self, start=0):
        self.now=start & 0xffffffff; self.elapsed=0; self.sequence=0; self.sample_number=0
        self.inputs=dict(temp=25.,rh=60.,lux=10000,low=False,dht=True,light=True,water_valid=True,sampling=True,network=True,physics=False)
        self.last_sample_elapsed=-2000; self.step_index=0; self.events=[]; self.trace=[]; self.last_command=None
        self.native.dll.lab_reset(20261114,self.now); self.tick(0)
        self.add_event('实验复位；控制核心已初始化')

    def add_event(self,text):
        self.events.append(dict(at=self.elapsed,now=self.now,text=text)); self.events=self.events[-100:]

    def tick(self, dt):
        before=self.native.state()
        self.elapsed+=dt; self.now=(self.now+dt)&0xffffffff
        if self.inputs['physics'] and dt:
            # Deliberately simple, optional teaching model, not calibrated crop physics.
            seconds=dt/1000
            self.inputs['temp']=max(0,min(50,self.inputs['temp']+(0.02-0.1*before['out_fan'])*seconds))
            self.inputs['rh']=max(0,min(100,self.inputs['rh']+(-0.03+0.2*before['out_drip']+0.6*before['out_mist'])*seconds))
        self.native.dll.lab_trace_clear()
        if self.inputs['sampling'] and self.elapsed-self.last_sample_elapsed>=2000:
            self.sample_number+=1; self.last_sample_elapsed=self.elapsed
            valid=int(self.inputs['dht']) | (int(self.inputs['light'])<<1)
            self.native.dll.lab_sample(self.now,self.sample_number,round(self.inputs['temp']*10),round(self.inputs['rh']*10),round(self.inputs['lux']),valid)
        self.native.dll.lab_step(self.now,int(self.inputs['low']),int(self.inputs['water_valid']))
        self.trace=self.native.traces(); after=self.native.state()
        old_pins={key:before[key] for key in ('out_led','out_fan','out_drip','out_mist','out_refill')}
        trace_inputs=dict(self.inputs)
        for point in self.trace:
            point['pins']=old_pins; point['kind']='native'; point['elapsed']=self.elapsed; point['inputs']=trace_inputs
        self.trace.append(dict(file='stm32/src/app.c',line=self.commit_line,state=after,
                               pins={key:after[key] for key in old_pins},kind='gpio_model',elapsed=self.elapsed,inputs=trace_inputs))
        names={'out_fan':'风扇','out_drip':'滴灌泵','out_mist':'喷雾泵','out_refill':'补液泵','out_led':'补光 PWM','manual':'手动模式','refill_fault':'补液故障锁存'}
        for key,name in names.items():
            if before[key]!=after[key]: self.add_event(f'{name}: {before[key]} → {after[key]}')
        if before['alarms']!=after['alarms']:
            self.add_event('告警: '+('、'.join(name for bit,name in ALARMS if after['alarms']&bit) or '无'))

    def advance(self, ms):
        ms=int(ms)
        if ms<0 or ms>120000 or ms%100: raise ValueError('推进时间必须是 0–120000 范围内的 100 ms 整数倍')
        # Retain state-changing cycles as well as the final cycle. A long jump
        # must not hide a pump timeout or a sensor failure that happened midway.
        keys=('out_led','out_fan','out_drip','out_mist','out_refill','manual',
              'alarms','refill_fault','water_raw','water_stable','fan_demand',
              'humidity_demand','sample_temp10','sample_humidity10','sample_lux','sample_valid')
        recorded=[]; previous=self.native.state()
        for index in range(ms//100):
            self.tick(100); current=self.native.state()
            if index==ms//100-1 or any(previous[key]!=current[key] for key in keys):
                recorded.extend(self.trace)
            previous=current
        if recorded: self.trace=recorded

    def set_inputs(self, data):
        for key,value in data.items():
            if key not in self.inputs: raise ValueError('未知输入 '+key)
            if key in ('temp','rh','lux'):
                value=float(value)
                bounds={'temp':(-20,60),'rh':(0,100),'lux':(0,60000)}[key]
                if not bounds[0]<=value<=bounds[1]: raise ValueError('输入越界 '+key)
            elif not isinstance(value,bool): raise ValueError('开关参数必须为布尔值')
            self.inputs[key]=value

    def command(self, data):
        before=self.native.state()
        op=int(data.get('op',3)); args=data.get('args',[])
        if len(args)>6: raise ValueError('最多 6 个参数')
        args=[int(x) for x in args]+[0]*(6-len(args))
        if any(x<-(2**31) or x>=2**31 for x in args): raise ValueError('参数超出 int32_t')
        duplicate=bool(data.get('duplicate',False))
        if not duplicate: self.sequence+=1
        ttl=int(data.get('ttl',10000)); age=int(data.get('age',0)); boot=int(data.get('boot',20261114))
        if not -2147483648<=ttl<=2147483647 or not 0<=age<=120000 or not 0<=boot<=0xffffffff: raise ValueError('时间或启动编号越界')
        self.native.dll.lab_trace_clear()
        code=self.native.dll.lab_command(op,(C.c_int32*6)(*args),self.sequence,boot,ttl,(self.now-age)&0xffffffff,self.now,int(data.get('corrupt',False)))
        self.trace=self.native.traces()
        for point in self.trace:
            point['pins']={key:before[key] for key in ('out_led','out_fan','out_drip','out_mist','out_refill')}
            point['kind']='native'; point['elapsed']=self.elapsed; point['inputs']=dict(self.inputs)
        self.last_command=dict(op=op,args=args,seq=self.sequence,code=code,text=ACKS.get(code,str(code)),frame=self.native.frame(True))
        self.add_event(f'指令 #{self.sequence} / 操作 {op}: '+self.last_command['text'])
        return code

    def next_experiment(self):
        steps=self.lesson['steps']
        if self.step_index>=len(steps): return
        label,action=steps[self.step_index]
        self.add_event('实验步骤: '+label)
        if 'inputs' in action: self.set_inputs(action['inputs'])
        if 'ms_before' in action: self.advance(action['ms_before'])
        command_trace=[]
        if 'command' in action:
            self.command(action['command']); command_trace=list(self.trace)
        self.advance(action.get('ms',100))
        if command_trace: self.trace=command_trace+self.trace
        self.step_index+=1

    def snapshot(self):
        state=self.native.state(); layout=(C.c_int*6)(); self.native.dll.lab_layout(layout)
        return dict(state=state,inputs=self.inputs,elapsed=self.elapsed,events=self.events,
                    trace=self.trace,lesson=self.lesson['id'],step_index=self.step_index,
                    command=self.last_command,frame=self.native.frame(),layout=list(layout),
                    alarms=[name for bit,name in ALARMS if state['alarms']&bit])

    def action(self,data):
        kind=data.get('action')
        if kind=='reset': self.reset(self.lesson.get('start',0))
        elif kind=='lesson':
            found=next((x for x in LESSONS if x['id']==data.get('id')),None)
            if not found: raise ValueError('未知课程')
            self.lesson=found; self.reset(found.get('start',0))
        elif kind=='inputs': self.set_inputs(data.get('values',{}))
        elif kind=='advance': self.advance(data.get('ms',100))
        elif kind=='command':
            self.command(data); trace=list(self.trace); self.advance(100); self.trace=trace+self.trace
        elif kind=='experiment': self.next_experiment()
        else: raise ValueError('未知操作')
        return self.snapshot()


def source_files():
    return {name:(ROOT/name).read_text(encoding='utf-8') for name in SOURCES}
