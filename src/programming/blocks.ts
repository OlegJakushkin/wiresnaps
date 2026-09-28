import * as Blockly from 'blockly/core';
import * as en from 'blockly/msg/en';
import type { Expr,Program,Statement,Target } from './compiler';
import { CompileError } from './compiler';
Blockly.setLocale(Object.fromEntries(Object.entries(en).filter((entry):entry is [string,string]=>typeof entry[1]==='string')));
const numberInput=(name:string)=>({type:'input_value',name,check:'Number'});
const statement=(type:string,message0:string,args0:object[],colour:number,extra:object={})=>({type,message0,args0,colour,previousStatement:null,nextStatement:null,...extra});
Blockly.defineBlocksWithJsonArray([
 {type:'ws_start',message0:'when I press run %1 %2',args0:[{type:'input_dummy'},{type:'input_statement',name:'DO'}],colour:42},
 statement('ws_write','set pin %1 to %2',[{type:'field_number',name:'PIN',value:6,min:0,max:19,precision:1},numberInput('VALUE')],168),
 statement('ws_pwm','dim pin %1 to %2',[{type:'field_number',name:'PIN',value:6,min:0,max:19,precision:1},numberInput('VALUE')],168),
 statement('ws_wait','wait %1 milliseconds',[{type:'field_number',name:'MS',value:500,min:0,max:60000,precision:1}],208),
 statement('ws_forever','forever %1',[{type:'input_statement',name:'DO'}],208),
 statement('ws_repeat','repeat %1 times %2',[numberInput('COUNT'),{type:'input_statement',name:'DO'}],208),
 statement('ws_if','if %1 then %2 otherwise %3',[numberInput('CONDITION'),{type:'input_statement',name:'THEN'},{type:'input_statement',name:'ELSE'}],208),
 statement('ws_set','set memory %1 to %2',[{type:'field_number',name:'SLOT',value:1,min:1,max:8,precision:1},numberInput('VALUE')],290),
 statement('ws_serial','send letter code %1',[numberInput('VALUE')],290),
 {type:'ws_number',message0:'%1',args0:[{type:'field_number',name:'VALUE',value:1,min:0,max:255,precision:1}],output:'Number',colour:110},
 {type:'ws_math',message0:'%1 %2 %3',args0:[numberInput('LEFT'),{type:'field_dropdown',name:'OP',options:[['+','+'],['−','-'],['×','*'],['÷','/'],['is less than','<'],['equals','=']]},numberInput('RIGHT')],inputsInline:true,output:'Number',colour:110},
 {type:'ws_not',message0:'not %1',args0:[numberInput('VALUE')],output:'Number',colour:110},
 {type:'ws_read',message0:'button at pin %1',args0:[{type:'field_number',name:'PIN',value:2,min:0,max:19,precision:1}],output:'Number',colour:168},
 {type:'ws_adc',message0:'sensor %1 (0 to 255)',args0:[{type:'field_number',name:'PIN',value:0,min:0,max:7,precision:1}],output:'Number',colour:168},
 {type:'ws_get',message0:'memory %1',args0:[{type:'field_number',name:'SLOT',value:1,min:1,max:8,precision:1}],output:'Number',colour:290},
]);
const block=(type:string,inputs?:object)=>({kind:'block',type,inputs});
const shadow=(value=1)=>({shadow:{type:'ws_number',fields:{VALUE:value}}});
export const toolbox={kind:'categoryToolbox',contents:[
 {kind:'category',name:'Start',colour:'#d1a52c',contents:[block('ws_start')]},
 {kind:'category',name:'Pins & sensors',colour:'#479a82',contents:[block('ws_write',{VALUE:shadow()}),block('ws_pwm',{VALUE:shadow(128)}),block('ws_read'),block('ws_adc')]},
 {kind:'category',name:'Time & loops',colour:'#508cb9',contents:[block('ws_wait'),block('ws_forever'),block('ws_repeat',{COUNT:shadow(4)}),block('ws_if',{CONDITION:shadow()})]},
 {kind:'category',name:'Numbers',colour:'#83aa4b',contents:[block('ws_number'),block('ws_math',{LEFT:shadow(),RIGHT:shadow()}),block('ws_not',{VALUE:shadow()})]},
 {kind:'category',name:'Memory & words',colour:'#a574b1',contents:[block('ws_set',{VALUE:shadow()}),block('ws_get'),block('ws_serial',{VALUE:shadow(65)})]}
]};
const blinkOff={type:'ws_write',fields:{PIN:6},inputs:{VALUE:{block:{type:'ws_number',fields:{VALUE:0}}}},next:{block:{type:'ws_wait',fields:{MS:500}}}};
const blinkOn={type:'ws_write',fields:{PIN:6},inputs:{VALUE:{block:{type:'ws_number',fields:{VALUE:1}}}},next:{block:{type:'ws_wait',fields:{MS:500},next:{block:blinkOff}}}};
export const blinkWorkspace={blocks:{languageVersion:0,blocks:[{type:'ws_start',x:35,y:35,inputs:{DO:{block:{type:'ws_forever',inputs:{DO:{block:blinkOn}}}}}}]}};
export function programFromWorkspace(workspace:Blockly.Workspace,target:Target):Program {
 const starts=workspace.getTopBlocks(true).filter(b=>b.type==='ws_start');if(starts.length!==1)throw new CompileError('Use exactly one “when I press run” block.');
 if(workspace.getTopBlocks(true).some(b=>b.type!=='ws_start'&&!b.isShadow()))throw new CompileError('Connect each block to the program so it has a turn to run.');
 const value=(b:Blockly.Block|null):Expr=>{
  if(!b)throw new CompileError('A number socket is empty. Add a number or a sensor block.');
  switch(b.type){case 'ws_number':return {kind:'number',value:Number(b.getFieldValue('VALUE'))};case 'ws_get':return {kind:'variable',slot:Number(b.getFieldValue('SLOT'))-1};case 'ws_read':case 'ws_adc':return {kind:b.type==='ws_read'?'read':'adc',pin:Number(b.getFieldValue('PIN'))};case 'ws_not':return {kind:'not',value:value(b.getInputTargetBlock('VALUE'))};case 'ws_math':return {kind:'binary',op:b.getFieldValue('OP'),left:value(b.getInputTargetBlock('LEFT')),right:value(b.getInputTargetBlock('RIGHT'))};default:throw new CompileError('This block cannot be used as a number.',b.id);}
 };
 const list=(first:Blockly.Block|null):Statement[]=>{const result:Statement[]=[];for(let b=first;b;b=b.getNextBlock()){
  const id=b.id;switch(b.type){
   case 'ws_write':case 'ws_pwm':result.push({id,kind:b.type==='ws_write'?'write':'pwm',pin:Number(b.getFieldValue('PIN')),value:value(b.getInputTargetBlock('VALUE'))});break;
   case 'ws_wait':result.push({id,kind:'wait',milliseconds:Number(b.getFieldValue('MS'))});break;
   case 'ws_set':result.push({id,kind:'set',slot:Number(b.getFieldValue('SLOT'))-1,value:value(b.getInputTargetBlock('VALUE'))});break;
   case 'ws_serial':result.push({id,kind:'serial',value:value(b.getInputTargetBlock('VALUE'))});break;
   case 'ws_forever':result.push({id,kind:'forever',body:list(b.getInputTargetBlock('DO'))});break;
   case 'ws_repeat':result.push({id,kind:'repeat',count:value(b.getInputTargetBlock('COUNT')),body:list(b.getInputTargetBlock('DO'))});break;
   case 'ws_if':result.push({id,kind:'if',condition:value(b.getInputTargetBlock('CONDITION')),then:list(b.getInputTargetBlock('THEN')),otherwise:list(b.getInputTargetBlock('ELSE'))});break;
   default:throw new CompileError('This block is not supported by this controller.',id);
  }
 }return result;};
 return {version:1,target,start:list(starts[0].getInputTargetBlock('DO'))};
}
