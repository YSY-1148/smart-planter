"""Native-C reference results for checking the browser clock and Wasm adapter."""
import argparse
import json
from pathlib import Path
import random
from engine import Simulation
from lessons import LESSONS


def generate(output):
    sim=Simulation();actions=[]
    def record(action,trace=False):
        snap=sim.action(action)
        keys=['state','inputs','elapsed','lesson','step_index','command','frame','layout','alarms']
        if trace: keys.append('trace')
        actions.append(dict(action=action,expected={k:snap[k] for k in keys}))
    for lesson in LESSONS:
        record({'action':'lesson','id':lesson['id']})
        for step in lesson['steps']: record({'action':'experiment'},True)
    record({'action':'lesson','id':'fan'})
    rng=random.Random(20261121)
    for i in range(300):
        kind=i%7
        if kind==0: record({'action':'inputs','values':dict(temp=rng.randrange(150,401)/10+.05,rh=rng.randrange(200,801)/10,lux=rng.randrange(60001),low=bool(rng.randrange(2)),dht=bool(rng.randrange(2)),light=bool(rng.randrange(2)),sampling=True)})
        elif kind==1: record({'action':'advance','ms':rng.choice([100,2000,5000,6500,60000])})
        elif kind==2: record({'action':'command','op':2,'args':[rng.randrange(101),rng.randrange(2),0,0,0,3000]})
        elif kind==3: record({'action':'command','op':3,'duplicate':bool(rng.randrange(2)),'corrupt':bool(rng.randrange(2))})
        elif kind==4: record({'action':'command','op':4,'args':[rng.randrange(1001)],'ttl':rng.choice([100,10000]),'age':rng.choice([0,100]),'boot':rng.choice([20261114,1])})
        elif kind==5: record({'action':'advance','ms':rng.choice([100,2000,5000,60000])})
        else: record({'action':'inputs','values':{'sampling':bool(rng.randrange(2)),'water_valid':bool(rng.randrange(2))}})
    record({'action':'lesson','id':'fan'})
    record({'action':'inputs','values':{'physics':True,'temp':27.95,'rh':49.95}})
    for _ in range(10): record({'action':'advance','ms':2000})
    Path(output).parent.mkdir(parents=True,exist_ok=True)
    Path(output).write_text(json.dumps(actions,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    print(f'Generated {len(actions)} native reference snapshots')


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--output',default='lab/.qa/browser-fixtures.json');args=parser.parse_args();generate(args.output)
