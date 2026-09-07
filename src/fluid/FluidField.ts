export class FluidField {
  readonly nx: number;
  readonly ny: number;

  readonly dx: number;
  readonly dy: number;

  // 밀도
  density: Float64Array;

  // 속도장
  u: Float64Array;
  v: Float64Array;

  // 압력장
  pressure: Float64Array;

  constructor(nx: number, ny: number, width: number, height: number) {
    this.nx = nx;
    this.ny = ny;

    this.dx = width / nx;
    this.dy = height / ny;

    const size = (nx + 2) * (ny + 2);

    this.density = new Float64Array(size);

    this.u = new Float64Array(size);

    this.v = new Float64Array(size);

    this.pressure = new Float64Array(size);
  }

  index(i: number, j: number): number {
    return i + (this.nx + 2) * j;
  }

  clear() {
    this.density.fill(0);
    this.u.fill(0);
    this.v.fill(0);
    this.pressure.fill(0);
  }
}
