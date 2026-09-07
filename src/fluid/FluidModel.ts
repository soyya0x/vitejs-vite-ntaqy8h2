import { FluidField } from './FluidField';
import { NavierStokes } from './NavierStokes';
import type { FluidParameters } from './NavierStokes';

export interface FluidCondition {
  width: number;
  height: number;

  gridX: number;
  gridY: number;

  density: number;
  viscosity: number;

  initialSpeed: number;

  inlet: {
    y: number;
    height: number;
  };

  outlet: {
    y: number;
    height: number;
  };

  mode: 'escape' | 'open';

  obstacles: {
    x: number;
    y: number;
    width: number;
    height: number;
  }[];
}

export class FluidModel {
  readonly field: FluidField;

  particles: {
    x: number;
    y: number;
    radius: number;
  }[] = [];

  private solver: NavierStokes;

  private condition: FluidCondition;

  constructor(condition: FluidCondition) {
    this.condition = condition;

    this.field = new FluidField(
      condition.gridX,
      condition.gridY,
      condition.width,
      condition.height
    );

    const parameters: FluidParameters = {
      density: condition.density,

      viscosity: condition.viscosity,

      dt: 0.001,
    };

    this.solver = new NavierStokes(this.field, parameters);

    this. initialize();
  }

  private initialize() {
    const { nx, ny } = this.field;

    this.field.clear();
    this.particles = [];
    if (this.condition.mode === 'escape') {
      // ① 탈출형: 처음부터 내부에 입자가 존재
      for (let x = 80; x <= 300; x += 25) {
        for (let y = 100; y <= 400; y += 25) {
          this.particles.push({
            x,
            y,
            radius: 4,
          });
        }
      }
    } else {
      // ② 유입·유출형: 처음에는 내부를 비워둠
      this.particles = [];
    }

    /*
     * 유체 전체에 초기 밀도 설정
     */

    for (let j = 1; j <= ny; j++) {
      for (let i = 1; i <= nx; i++) {
        const k = this.field.index(i, j);

        this.field.density[k] = this.condition.density;
      }
    }

    /*
 * 초기 유체 속도 설정
 */
this.applyInitialVelocity();
  }

  update() {
    if (this.condition.mode === 'open') {
      this.applyInlet();
    }
  
    for (let i = 0; i < 16; i++) {
      this.applyBoundaryConditions();
      this.solver.step();
    }
  
    this.applyBoundaryConditions();
  
    if (this.condition.mode === 'open') {
      this.applyInlet();
      this.spawnInletParticles();
    }
  
    this.updateParticles();
  }


   private applyInlet() {
  const { initialSpeed, inlet } = this.condition;
  const { nx, ny } = this.field;


    const minJ = Math.max(
      1,
      Math.floor((inlet.y - inlet.height / 2) / this.field.dy) + 1
    );

    const maxJ = Math.min(
      ny,
      Math.ceil((inlet.y + inlet.height / 2) / this.field.dy)
    );

    for (let j = minJ; j <= maxJ; j++) {
      const k = this.field.index(1, j);

      this.field.u[k] = initialSpeed;

      this.field.v[k] = 0;
    }
  }

  private applyInitialVelocity() {
    const { nx, ny } = this.field;
    const speed = this.condition.initialSpeed;

    for (let j = 1; j <= ny; j++) {
      for (let i = 1; i <= nx; i++) {
        const k = this.field.index(i, j);

        this.field.u[k] = speed;
        this.field.v[k] = 0;
      }
    }
  }

  private applyBoundaryConditions() {
    const { nx, ny } = this.field;

    /*
     * 위쪽 / 아래쪽 벽
     */

    for (let i = 0; i <= nx + 1; i++) {
      this.field.u[this.field.index(i, 0)] = 0;

      this.field.v[this.field.index(i, 0)] = 0;

      this.field.u[this.field.index(i, ny + 1)] = 0;

      this.field.v[this.field.index(i, ny + 1)] = 0;
    }

    /*
     * 왼쪽 벽
     *
     * 입구 부분만 열린다.
     */

    for (let j = 1; j <= ny; j++) {
      const y = (j - 0.5) * this.field.dy;
    
      const insideInlet =
        this.condition.mode === 'open' &&
        y >= this.condition.inlet.y - this.condition.inlet.height / 2 &&
        y <= this.condition.inlet.y + this.condition.inlet.height / 2;
    
      if (!insideInlet) {
        this.field.u[this.field.index(1, j)] = 0;
        this.field.v[this.field.index(1, j)] = 0;
      }
    }


    /*
     * 오른쪽 출구
     *
     * 출구에서는 속도의
     * 공간 미분을 0으로 둔다.
     */

    for (let j = 1; j <= ny; j++) {
      const k = this.field.index(nx, j);

      const outside = this.field.index(nx + 1, j);

      this.field.u[outside] = this.field.u[k];

      this.field.v[outside] = this.field.v[k];
    }
  }

  getVelocity(x: number, y: number) {
    const i = Math.max(
      1,
      Math.min(this.field.nx, Math.floor(x / this.field.dx) + 1)
    );
    const j = Math.max(
      1,
      Math.min(this.field.ny, Math.floor(y / this.field.dy) + 1)
    );
    const k = this.field.index(i, j);

    return {
      x: this.field.u[k],
      y: this.field.v[k],
    };
  }

  private spawnInletParticles() {
    const { inlet } = this.condition;
  
    for (let i = 0; i < 3; i++) {
      const y =
        inlet.y -
        inlet.height / 2 +
        Math.random() * inlet.height;
  
      this.particles.push({
        x: 5,
        y,
        radius: 4,
      });
    }
  }

  private updateParticles() {
    const dt = 0.016;

    for (const particle of this.particles) {
      const velocity = this.getVelocity(particle.x, particle.y);

      particle.x += velocity.x * dt;
      particle.y += velocity.y * dt;
    }

    /*
     * 오른쪽 출구를 통과한 입자는 제거한다.
     */
    this.particles = this.particles.filter(
      (particle) => particle.x <= this.condition.width + 20
    );
  }
}
