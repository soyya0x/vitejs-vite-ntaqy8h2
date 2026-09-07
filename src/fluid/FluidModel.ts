import { FluidField } from './FluidField';
import { NavierStokes } from './NavierStokes';
import type { FluidParameters } from './NavierStokes';

export interface FluidCondition {
  width: number;
  height: number;

  gridX: number;
  gridY: number;

  density: number;
  particleDensity: number;
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
      /*
       * 탈출형:
       * 유체 입자 밀도에 따라
       * 전체 공간에 균일하게 입자를 배치한다.
       */
    
      const minParticles = 20;
      const maxParticles = 1000;
    
      const count = Math.round(
        minParticles +
          (maxParticles - minParticles) *
            this.condition.particleDensity
      );
    
      const columns = Math.ceil(
        Math.sqrt(
          count *
            (this.condition.width /
              this.condition.height)
        )
      );
    
      const rows = Math.ceil(
        count / columns
      );
    
      const spacingX =
        this.condition.width /
        (columns + 1);
    
      const spacingY =
        this.condition.height /
        (rows + 1);
    
      for (let row = 0; row < rows; row++) {
        for (
          let column = 0;
          column < columns;
          column++
        ) {
          if (this.particles.length >= count) {
            break;
          }
    
          this.particles.push({
            x: spacingX * (column + 1),
            y: spacingY * (row + 1),
            radius: 2,
          });
        }
      }
    } else {
      /*
       * 유입·유출형:
       * 시작할 때는 0개.
       * 이후 입구에서 particleDensity에 따라
       * 유입되는 입자 수를 결정한다.
       */
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

  /*
 * 오른쪽 벽
 *
 * 출구 부분만 열린다.
 */
for (let j = 1; j <= ny; j++) {
  const y = (j - 0.5) * this.field.dy;

  const insideOutlet =
    y >=
      this.condition.outlet.y -
        this.condition.outlet.height / 2 &&
    y <=
      this.condition.outlet.y +
        this.condition.outlet.height / 2;

  const k = this.field.index(nx, j);
  const outside = this.field.index(nx + 1, j);

  if (insideOutlet) {
    /*
     * 출구:
     * 속도의 공간 미분을 0으로 둔다.
     */
    this.field.u[outside] =
      this.field.u[k];

    this.field.v[outside] =
      this.field.v[k];
  } else {
    /*
     * 출구가 아닌 오른쪽 벽:
     * 벽면 속도를 0으로 둔다.
     */
    this.field.u[outside] = 0;
    this.field.v[outside] = 0;
  }
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

    const minSpawn = 1;
    const maxSpawn = 20;

    const spawnCount = Math.round(
      minSpawn +
        (maxSpawn - minSpawn) *
          this.condition.particleDensity
    );

    for (let i = 0; i < spawnCount; i++) {
      const y =
        inlet.y -
        inlet.height / 2 +
        Math.random() * inlet.height;

      this.particles.push({
        x: 5,
        y,
        radius: 2,
      });
    }
  }


  private updateParticles() {
    const dt = 0.016;
    const particleSpeedScale = 6;
  
    const radius = 2;
  
    for (const particle of this.particles) {
      const velocity =
        this.getVelocity(
          particle.x,
          particle.y
        );
  
        const nextX =
  particle.x +
  velocity.x *
  dt *
  particleSpeedScale;

const nextY =
  particle.y +
  velocity.y *
  dt *
  particleSpeedScale;

particle.x = nextX;
particle.y = nextY;
  
      /*
       * =========================
       * 위쪽 / 아래쪽 벽
       * =========================
       *
       * 입자가 벽을 넘어가지 못하게
       * 위치 자체를 제한한다.
       */
  
      if (particle.y < radius) {
        particle.y = radius;
      }
      
      if (
        particle.y >
        this.condition.height - radius
      ) {
        particle.y =
          this.condition.height - radius;
      }
  
      /*
       * =========================
       * 왼쪽 벽
       * =========================
       *
       * 유입·유출형에서는
       * 왼쪽 입구만 통과 가능.
       */
  
      const insideInlet =
        this.condition.mode === 'open' &&
        particle.y >=
          this.condition.inlet.y -
            this.condition.inlet.height / 2 &&
        particle.y <=
          this.condition.inlet.y +
            this.condition.inlet.height / 2;
  
      if (
        particle.x < radius &&
        !insideInlet
      ) {
        particle.x = radius;
      }
  
      /*
       * =========================
       * 오른쪽 벽
       * =========================
       *
       * 출구 부분만 통과 가능.
       */
  
      const insideOutlet =
        particle.y >=
          this.condition.outlet.y -
            this.condition.outlet.height / 2 &&
        particle.y <=
          this.condition.outlet.y +
            this.condition.outlet.height / 2;
  
      /*
       * 출구가 아닌 오른쪽 벽에
       * 입자가 닿으면 벽 안쪽으로 되돌린다.
       */
      if (
        particle.x >
          this.condition.width - radius &&
        !insideOutlet
      ) {
        particle.x =
          this.condition.width - radius;
      }
    }
  
    /*
     * =========================
     * 오른쪽 출구 통과 입자 제거
     * =========================
     */
  
    this.particles =
      this.particles.filter(
        (particle) =>
          particle.x <=
          this.condition.width + 20
      );
  }
}

