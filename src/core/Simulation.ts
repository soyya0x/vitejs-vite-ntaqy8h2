import type { InitialCondition } from './InitialCondition';

export interface Simulation {
  initialize(condition: InitialCondition): void;
  update(dt: number): void;
}
