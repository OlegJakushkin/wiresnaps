import {it,expect} from 'vitest';
import {emptyProject,parseProject,electricalCircuit} from '../src/project';
import {simulationEnvironment} from '../src/environment';

it('night removes ambient light on initial load and saved-project reload without erasing daylight',()=>{
 const p=emptyProject();p.environment={light:.65,wind:5,sound:.3,temperature:24};p.presentation.night=true;
 expect(simulationEnvironment(p)).toEqual({...p.environment,light:0});expect(p.environment.light).toBe(.65);
 const saved=parseProject(JSON.stringify(p));expect(electricalCircuit(saved).environment.light).toBe(0);
 saved.presentation.night=false;expect(electricalCircuit(saved).environment).toEqual(p.environment);
});
