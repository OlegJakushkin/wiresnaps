export type Target='atmega328p'|'pic16f877a';
export type Expr={kind:'number';value:number}|{kind:'variable';slot:number}|{kind:'read';pin:number}|{kind:'adc';pin:number}|{kind:'not';value:Expr}|{kind:'binary';op:'+'|'-'|'*'|'/'|'<'|'=';left:Expr;right:Expr};
export type Statement={id:string}&({kind:'write'|'pwm';pin:number;value:Expr}|{kind:'wait';milliseconds:number}|{kind:'set';slot:number;value:Expr}|{kind:'serial';value:Expr}|{kind:'repeat';count:Expr;body:Statement[]}|{kind:'forever';body:Statement[]}|{kind:'if';condition:Expr;then:Statement[];otherwise:Statement[]});
export interface Program {version:1;target:Target;start:Statement[];}
export interface Compiled {bytes:Uint8Array;trace:Record<number,string>;sourceMap:Record<number,string>;target:Target;}
const opcode={'+':4,'-':5,'*':6,'/':7,'<':8,'=':9} as const;
export class CompileError extends Error {constructor(message:string,public blockId?:string){super(message);}}
export function compile(program:Program):Compiled {
 if(program.version!==1)throw new CompileError('This program uses a different block version.');
 const bytes:number[]=[],trace:Record<number,string>={},sourceMap:Record<number,string>={};let token=0,depth=0,maxDepth=0,loopDepth=0;
 const emit=(...values:number[])=>bytes.push(...values);
 const integer=(n:number,max:number,label:string)=>{if(!Number.isInteger(n)||n<0||n>max)throw new CompileError(`${label} must be a whole number from 0 to ${max}.`);};
 const expr=(e:Expr):void=>{
  switch(e.kind){
   case 'number':integer(e.value,255,'Number');emit(1,e.value);break;
   case 'variable':integer(e.slot,7,'Variable');emit(2,e.slot);break;
   case 'read':integer(e.pin,program.target==='atmega328p'?19:15,'Pin');emit(15,e.pin);break;
   case 'adc':integer(e.pin,program.target==='atmega328p'?5:7,'Sensor pin');emit(16,e.pin);break;
   case 'not':expr(e.value);emit(10);return;
   case 'binary':expr(e.left);expr(e.right);emit(opcode[e.op]);depth--;return;
  }depth++;maxDepth=Math.max(depth,maxDepth);
 };
 const jump=(op:number)=>{emit(op,0,0);return bytes.length-2;};
 const patch=(at:number,target:number)=>{bytes[at]=target&255;bytes[at+1]=target>>8;};
 const statements=(list:Statement[])=>{for(const s of list){
  if(++token>65535)throw new CompileError('This program has too many blocks.',s.id);
  trace[token]=s.id;sourceMap[bytes.length]=s.id;emit(20,token&255,token>>8);
  switch(s.kind){
   case 'write':case 'pwm':{
    integer(s.pin,program.target==='atmega328p'?19:16,'Pin');
    if(s.kind==='pwm'&&!(program.target==='atmega328p'?[5,6]:[16]).includes(s.pin))throw new CompileError('Choose a pin that supports dimming: '+(program.target==='atmega328p'?'5 or 6.':'16.'),s.id);
    if(s.kind==='write'&&program.target==='pic16f877a'&&s.pin===16)throw new CompileError('Use pin 16 with the dimming block.',s.id);
    expr(s.value);emit(s.kind==='write'?14:17,s.pin);depth--;break;
   }
   case 'wait':integer(s.milliseconds,60000,'Wait');emit(13,s.milliseconds&255,s.milliseconds>>8);break;
   case 'set':integer(s.slot,7,'Variable');expr(s.value);emit(3,s.slot);depth--;break;
   case 'serial':expr(s.value);emit(18);depth--;break;
   case 'if':{expr(s.condition);depth--;const otherwise=jump(12);statements(s.then);const end=jump(11);patch(otherwise,bytes.length);statements(s.otherwise);patch(end,bytes.length);break;}
   case 'forever':{if(!s.body.length)throw new CompileError('Add something inside the forever block.',s.id);const start=bytes.length;statements(s.body);emit(11,start&255,start>>8);break;}
   case 'repeat':{
    if(loopDepth>=8)throw new CompileError('Use fewer loops inside other loops.',s.id);const variable=8+loopDepth++;
    expr(s.count);depth--;emit(3,variable);const start=bytes.length;emit(2,variable);const end=jump(12);
    statements(s.body);emit(2,variable,1,1,5,3,variable,11,start&255,start>>8);patch(end,bytes.length);loopDepth--;break;
   }
  }
 }};
 statements(program.start);emit(19);
 if(bytes.length>4096)throw new CompileError(`This program needs ${bytes.length} bytes; this controller has room for 4096. Try using a repeat block.`);
 if(maxDepth>32)throw new CompileError('That calculation has too many calculations inside it. Use a variable for an intermediate answer.');
 return {bytes:Uint8Array.from(bytes),trace,sourceMap,target:program.target};
}
export function hexRecord(address:number,data:number[]){const values=[data.length,address>>8,address&255,0,...data];values.push((-values.reduce((a,b)=>a+b,0))&255);return ':'+values.map(x=>x.toString(16).padStart(2,'0').toUpperCase()).join('');}
export function packageFirmware(runtime:string,program:Compiled):string {
 const pic=program.target==='pic16f877a',offset=pic?0x2000:0x6000;
 // Reject overlap before packaging; only complete, checksum-valid runtime files.
 let eof=false;let extended=0;const lines:string[]=[];
 for(const line of runtime.trim().split(/\r?\n/)){
  if(!/^:[0-9a-f]+$/i.test(line))throw new CompileError('The controller firmware is damaged.');
  const b=Array.from({length:(line.length-1)/2},(_,i)=>parseInt(line.slice(1+i*2,3+i*2),16));
  if(b.length!==b[0]+5||b.reduce((a,v)=>a+v,0)%256)throw new CompileError('The controller firmware checksum is wrong.');
  if(b[3]===1){eof=true;continue;}if(b[3]===4)extended=(b[4]*256+b[5])*65536;
  if(b[3]===0){const address=extended+b[1]*256+b[2];if(address<offset+(pic?8192:4096)&&address+b[0]>offset)throw new CompileError('The program would overwrite controller firmware.');}
  lines.push(line);
 }
 if(!eof)throw new CompileError('The controller firmware is incomplete.');
 if(extended)lines.push(':020000040000FA');
 const payload=Array.from(program.bytes).flatMap(b=>pic?[b,0x34]:[b]);
 for(let i=0;i<payload.length;i+=16)lines.push(hexRecord(offset+i,payload.slice(i,i+16)));
 lines.push(':00000001FF');return lines.join('\n')+'\n';
}
