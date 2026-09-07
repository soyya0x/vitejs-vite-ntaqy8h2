import { FluidField } from './FluidField';

export class PressureSolver {
  constructor(private field: FluidField, private iterations = 80) {}

  solve(dt: number, density: number) {
    const { nx, ny, dx, dy } = this.field;

    const dx2 = dx * dx;
    const dy2 = dy * dy;

    for (let iteration = 0; iteration < this.iterations; iteration++) {
      for (let j = 1; j <= ny; j++) {
        for (let i = 1; i <= nx; i++) {
          const k = this.field.index(i, j);

          const duDx =
            (this.field.u[this.field.index(i + 1, j)] -
              this.field.u[this.field.index(i - 1, j)]) /
            (2 * dx);

          const dvDy =
            (this.field.v[this.field.index(i, j + 1)] -
              this.field.v[this.field.index(i, j - 1)]) /
            (2 * dy);

          const divergence = duDx + dvDy;

          const right =
            (this.field.pressure[this.field.index(i + 1, j)] +
              this.field.pressure[this.field.index(i - 1, j)]) /
            dx2;

          const upDown =
            (this.field.pressure[this.field.index(i, j + 1)] +
              this.field.pressure[this.field.index(i, j - 1)]) /
            dy2;

          const denominator = 2 / dx2 + 2 / dy2;

          this.field.pressure[k] =
            (right + upDown - (density / dt) * divergence) / denominator;
        }
      }
    }
  }
}
