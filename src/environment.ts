import type {Project} from './types';

// The saved light level is the child's daylight setting. Night removes ambient
// sunlight from every electrical model, without losing that setting on return.
export function simulationEnvironment(p:Pick<Project,'environment'|'presentation'>):Project['environment']{
 return {...p.environment,light:p.presentation.night?0:p.environment.light};
}
