// Electrical connectivity and signal invariants; these are ideal teaching models.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const scope={window:{}};vm.createContext(scope);
for(const file of ['board-models.js','circuit-hardware.js','circuit-model.js','circuit-guides.js','circuit-extra.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'web',file),'utf8'),scope);
const H=scope.window.CircuitHardware,M=scope.window.CircuitModels;
const pin=name=>H.headers.find(h=>h.name===name).id;
assert.equal(H.headers.length,100);assert.equal(new Set(H.headers.map(h=>h.id)).size,100);
assert.equal(H.packagePins.length,100);assert.equal(H.packagePins[91].name,'PB6');
for(const [id,name] of [['P2.23','PB6'],['P2.19','PB8'],['P2.20','PB9'],['P1.22','PB0'],['P1.21','PB1'],['P1.13','PA3'],['P1.14','PA2'],['P1.44','PD12']])assert.equal(H.headers.find(h=>h.id===id).name,name);
for(const id of Object.keys(M.recipes)){const c=new M.Circuit(id);assert.equal(c.status().complete,false);c.load();assert.equal(c.status().complete,true,id);assert.equal(c.status().short,false,id);assert.equal(c.add('invalid','fake'),false);}
const c=new M.Circuit('gpio');c.load();assert.equal(c.probe('CH1',0,{},{}),3.3);assert.equal(c.probe('CH1',500000,{},{}),0);
c.remove(c.wires.findIndex(w=>w.a==='scope.GND'));assert.equal(c.probe('CH1',0,{},{}),null);c.add('scope.GND',pin('GND'));
c.add(pin('3V'),pin('GND'));assert.equal(c.status().short,true);assert.equal(c.probe('CH1',0,{},{}),null);c.remove(c.wires.length-1);assert.equal(c.status().short,false);
c.clear();assert.equal(c.same('led.A','resistor.B'),false);assert.equal(c.add('P1.48','resistor.B'),false,'NC remains disconnected');
const pwm=new M.Circuit('pwm');pwm.load();
for(const [t,gate,drain] of [[0,3.3,0],[499,3.3,0],[500,0,12],[999,0,12],[1000,3.3,0]]){assert.equal(pwm.probe('CH1',t,{},{}),gate);assert.equal(pwm.probe('CH2',t,{},{}),drain);}
for(const t of [0,123,500,999]){assert.equal(pwm.probe('CH1',t,{},{duty:0}),0);assert.equal(pwm.probe('CH1',t,{},{duty:100}),3.3);}
const uart=new M.Circuit('uart');uart.load();const bits=[1,0,1,0,1,0,0,1,0,1,1,1];
bits.forEach((bit,i)=>assert.equal(uart.probe('CH2',(i+.2)*1e6/115200,{},{byte:165}),bit*3.3));
uart.remove(uart.wires.findIndex(w=>w.a==='esp.GND'));assert.equal(uart.probe('CH2',0,{},{}),null);
const dht=new M.Circuit('dht');dht.load();assert.equal(dht.probe('CH1',0,{},{}),0);assert.equal(dht.probe('CH1',60,{},{}),3.3);
dht.remove(dht.wires.findIndex(w=>w.a==='pullup.A'));assert.equal(dht.probe('CH1',60,{},{}),null);
const i2c=new M.Circuit('i2c');i2c.load();assert.equal(typeof i2c.probe('CH1',0,{},{raw:12000}),'number');
i2c.remove(i2c.wires.findIndex(w=>w.a==='bh.SDA'));assert.equal(i2c.probe('CH2',0,{},{raw:12000}),null);
const collision=new M.Circuit('uart');collision.load();collision.add(pin('PA2'),'esp.TX17');assert.ok(collision.status().short);assert.ok(collision.status().reason.includes('输出端'));
const stuck=new M.Circuit('i2c');stuck.load();stuck.add(pin('PB8'),pin('PB9'));assert.ok(stuck.status().short);
const fan=new M.Circuit('fan');fan.load();fan.control={out_fan:1};assert.equal(fan.probe('CH2',0,{},{}),0);fan.remove(fan.wires.findIndex(w=>w.b==='driver.G'));assert.equal(fan.probe('CH2',0,{},{}),12);
const adc=new M.Circuit('adc');adc.load();assert.equal(adc.probe('CH1',0,{},{voltage:1.65}),1.65);
console.log('PASS full board pin identities, 15 wiring recipes, reference ground, power/output/bus conflicts, PWM, fan gating, UART, ADC and sensor wiring');
