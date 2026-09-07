import { FluidField } from './FluidField';
import { PressureSolver } from './PressureSolver';

export interface FluidParameters {
  density: number;
  viscosity: number;
  dt: number;
}

export class NavierStokes {
  private pressureSolver: PressureSolver;

  constructor(private field: FluidField, private parameters: FluidParameters) {
    this.pressureSolver = new PressureSolver(field);
  }

  step() {
    const { nx, ny, dx, dy } = this.field;

    const { density, viscosity, dt } = this.parameters;

    const oldU = this.field.u.slice();

    const oldV = this.field.v.slice();

    /*
     * 1. 대류 + 점성
     */

    for (let j = 1; j <= ny; j++) {
      for (let i = 1; i <= nx; i++) {
        const k = this.field.index(i, j);

        const duDx =
          (oldU[this.field.index(i + 1, j)] -
            oldU[this.field.index(i - 1, j)]) /
          (2 * dx);

        const duDy =
          (oldU[this.field.index(i, j + 1)] -
            oldU[this.field.index(i, j - 1)]) /
          (2 * dy);

        const dvDx =
          (oldV[this.field.index(i + 1, j)] -
            oldV[this.field.index(i - 1, j)]) /
          (2 * dx);

        const dvDy =
          (oldV[this.field.index(i, j + 1)] -
            oldV[this.field.index(i, j - 1)]) /
          (2 * dy);

        const laplaceU =
          (oldU[this.field.index(i + 1, j)] -
            2 * oldU[k] +
            oldU[this.field.index(i - 1, j)]) /
            (dx * dx) +
          (oldU[this.field.index(i, j + 1)] -
            2 * oldU[k] +
            oldU[this.field.index(i, j - 1)]) /
            (dy * dy);

        const laplaceV =
          (oldV[this.field.index(i + 1, j)] -
            2 * oldV[k] +
            oldV[this.field.index(i - 1, j)]) /
            (dx * dx) +
          (oldV[this.field.index(i, j + 1)] -
            2 * oldV[k] +
            oldV[this.field.index(i, j - 1)]) /
            (dy * dy);

        this.field.u[k] =
          oldU[k] +
          dt * (-oldU[k] * duDx - oldV[k] * duDy + viscosity * laplaceU);

        this.field.v[k] =
          oldV[k] +
          dt * (-oldU[k] * dvDx - oldV[k] * dvDy + viscosity * laplaceV);
      }
    }

    /*
     * 2. 압력 계산
     */

    this.pressureSolver.solve(dt, density);

    /*
     * 3. 압력으로 속도 보정
     */

    for (let j = 1; j <= ny; j++) {
      for (let i = 1; i <= nx; i++) {
        const k = this.field.index(i, j);

        const dpDx =
          (this.field.pressure[this.field.index(i + 1, j)] -
            this.field.pressure[this.field.index(i - 1, j)]) /
          (2 * dx);

        const dpDy =
          (this.field.pressure[this.field.index(i, j + 1)] -
            this.field.pressure[this.field.index(i, j - 1)]) /
          (2 * dy);

        this.field.u[k] -= (dt * dpDx) / density;

        this.field.v[k] -= (dt * dpDy) / density;
      }
    }
  }
}
