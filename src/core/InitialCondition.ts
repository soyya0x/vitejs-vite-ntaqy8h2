import type { Vector2 } from './Vector2';
import type { Obstacle } from './Obstacle';

export type SimulationMode = 'closed' | 'continuous';

export type RoomShape = 'rectangle' | 'corridor';

export interface InitialCondition {
  width: number;
  height: number;

  density: number;
  initialSpeed: number;

  positions: Vector2[];

  mode: SimulationMode;

  shape: RoomShape;

  exit: {
    x: number;
    y: number;
    width: number;
  };

  entrance: {
    x: number;
    y: number;
    width: number;
  };

  obstacles: Obstacle[];
}
