import ctypes as C
import random
import unittest
from engine import Simulation, Native, source_files, FIELDS
from lessons import LESSONS


class LabTests(unittest.TestCase):
    def setUp(self): self.sim=Simulation()
    def state(self): return self.sim.native.state()

    def test_hysteresis(self):
        results=[]
        for temp in [25,29,27,25]:
            self.sim.set_inputs({'temp':temp});self.sim.advance(2000);results.append(self.state()['out_fan'])
        self.assertEqual(results,[0,1,1,0])

    def test_sampling_is_not_control_period(self):
        self.sim.set_inputs({'temp':31});self.sim.advance(100)
        self.assertEqual(self.state()['sample_temp10'],250)
        self.assertEqual(self.state()['out_fan'],0)
        self.sim.advance(1900);self.assertEqual(self.state()['out_fan'],1)

    def test_pump_timeout_and_rest(self):
        self.sim.set_inputs({'rh':45});self.sim.advance(2000)
        self.assertEqual(self.state()['out_drip'],1)
        self.sim.advance(5000);self.assertEqual(self.state()['out_drip'],0)
        self.sim.advance(59900);self.assertEqual(self.state()['out_drip'],0)
        self.sim.advance(100);self.assertEqual(self.state()['out_drip'],1)

    def test_light_once_per_sample(self):
        self.sim.set_inputs({'lux':1000});self.sim.advance(2000)
        self.assertEqual(self.state()['out_led'],5)
        self.sim.advance(100);self.assertEqual(self.state()['out_led'],5)
        self.sim.advance(1900);self.assertEqual(self.state()['out_led'],10)

    def test_low_water_debounce_and_latch(self):
        self.sim.set_inputs({'low':True});self.sim.advance(100)
        self.assertEqual(self.state()['out_refill'],0)
        self.sim.advance(200);self.assertEqual(self.state()['out_refill'],0)
        self.sim.advance(100);self.assertEqual(self.state()['out_refill'],1)
        self.sim.advance(20000)
        self.assertEqual(self.state()['refill_fault'],1);self.assertEqual(self.state()['out_refill'],0)

    def test_manual_duplicate_does_not_extend(self):
        command={'op':2,'args':[60,1,0,0,0,3000]}
        self.assertEqual(self.sim.command(command),0)
        start=self.state()['manual_started'];self.sim.advance(1000)
        self.assertEqual(self.sim.command({**command,'duplicate':True}),1)
        self.assertEqual(self.state()['manual_started'],start)
        self.sim.advance(2000);self.assertEqual(self.state()['manual'],0)

    def test_stale_and_invalid_are_independent(self):
        self.sim.set_inputs({'temp':30});self.sim.advance(2000)
        self.sim.set_inputs({'sampling':False});self.sim.advance(6600)
        self.assertEqual(self.state()['out_fan'],0);self.assertTrue(self.state()['alarms']&1)
        self.sim.set_inputs({'sampling':True,'dht':False});self.sim.advance(2000)
        self.assertFalse(self.state()['alarms']&1);self.assertTrue(self.state()['alarms']&2)
        self.assertFalse(self.state()['alarms']&4)

    def test_crc_and_command_validation(self):
        self.assertEqual(self.sim.command({'op':2,'args':[80,1,0,0,0,5000],'corrupt':True}),-1)
        self.assertEqual(self.state()['manual'],0)
        self.assertEqual(self.sim.command({'op':3,'ttl':100,'age':100}),3)
        self.assertEqual(self.sim.command({'op':3,'boot':1}),5)
        self.assertEqual(self.sim.command({'op':2,'args':[100,0,1,1,0,1000]}),2)

    def test_real_crc_frame(self):
        frame=self.sim.native.frame();crc=0xffff
        for byte in frame[:-2]:
            crc^=byte<<8
            for _ in range(8): crc=((crc<<1)^0x1021 if crc&0x8000 else crc<<1)&0xffff
        self.assertEqual(crc,frame[72]|frame[73]<<8)
        self.assertEqual(len(frame),74)

    def test_germination_does_not_override_demand(self):
        self.sim.command({'op':4,'args':[900]});self.sim.advance(2000)
        self.assertEqual(self.state()['out_mist'],0)
        self.sim.set_inputs({'rh':45});self.sim.advance(2000)
        self.assertEqual(self.state()['out_mist'],1);self.assertEqual(self.state()['out_drip'],0)

    def test_rollover(self):
        self.sim.reset(0xffffff00);self.sim.advance(400);self.assertEqual(self.sim.now,144)
        self.sim.command({'op':2,'args':[50,1,0,0,0,1000]});self.sim.advance(1000)
        self.assertEqual(self.state()['manual'],0)

    def test_gpio_commit_is_last(self):
        self.sim.set_inputs({'temp':30});self.sim.advance(2000)
        trace=self.sim.trace
        self.assertEqual(trace[-1]['kind'],'gpio_model');self.assertEqual(trace[-1]['pins']['out_fan'],1)
        self.assertTrue(all(x['pins']['out_fan']==0 for x in trace[:-1]))
        self.assertTrue(any(x['state']['fan_demand']==1 for x in trace[:-1]))

    def test_long_advance_retains_intermediate_transitions(self):
        self.sim.set_inputs({'low':True});self.sim.advance(21400)
        commits=[p for p in self.sim.trace if p['kind']=='gpio_model']
        self.assertTrue(any(p['elapsed']==400 and p['pins']['out_refill']==1 for p in commits))
        self.assertTrue(any(p['elapsed']==20400 and p['state']['refill_fault']==1 and p['pins']['out_refill']==0 for p in commits))
        self.assertEqual(commits[-1]['elapsed'],21400)
        self.assertEqual([p['elapsed'] for p in commits],sorted(p['elapsed'] for p in commits))

    def test_all_lessons_run_and_all_anchors_exist(self):
        sources=source_files()
        for lesson in LESSONS:
            with self.subTest(lesson=lesson['id']):
                self.assertIn(lesson['anchor'],sources[lesson['file']])
                self.sim.action({'action':'lesson','id':lesson['id']})
                for _ in lesson['steps']: self.sim.next_experiment()
                self.assertEqual(self.sim.step_index,len(lesson['steps']))
                self.assertEqual(len(self.sim.snapshot()['state']),len(FIELDS))
                self.assertEqual(self.sim.trace[-1]['state'],self.state())

    def test_observation_callbacks_preserve_original_behavior(self):
        # Compile an unmodified original separately and compare after every operation.
        observed=self.sim.native;plain=Native(False);rng=random.Random(20261114)
        observed.dll.lab_reset(123,0);plain.dll.lab_reset(123,0)
        now=0xffffff00
        for i in range(400):
            now=(now+rng.choice([100,2000,5000,6500,60000]))&0xffffffff
            sample=(now,i+1,rng.randrange(100,451),rng.randrange(200,901),rng.randrange(60000),rng.randrange(4))
            if i%4!=0:
                observed.dll.lab_sample(*sample);plain.dll.lab_sample(*sample)
            if i%11==0:
                args=(C.c_int32*6)(rng.randrange(101),rng.randrange(2),0,0,0,3000)
                codes=[n.dll.lab_command(2,args,i+1,123,10000,now,now,0) for n in (observed,plain)]
                self.assertEqual(codes[0],codes[1])
            low=rng.randrange(2);valid=rng.randrange(2)
            observed.dll.lab_step(now,low,valid);plain.dll.lab_step(now,low,valid)
            self.assertEqual(observed.state(),plain.state(),f'divergence at operation {i}')
            self.assertEqual(observed.frame(),plain.frame())


if __name__=='__main__': unittest.main(verbosity=2)
