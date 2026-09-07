import type { Agent } from '../crowd/Agent';

export class Renderer {
  private ctx: CanvasRenderingContext2D;

  private scale = 1;

  private offsetX = 0;
  private offsetY = 0;

  constructor(private canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('Canvas를 사용할 수 없습니다.');
    }

    this.ctx = ctx;

    this.resize();
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;

    this.canvas.width = window.innerWidth * dpr;

    this.canvas.height = window.innerHeight * dpr;

    this.canvas.style.width = `${window.innerWidth}px`;

    this.canvas.style.height = `${window.innerHeight}px`;

    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  setupCamera(roomWidth: number, roomHeight: number) {
    const screenWidth = window.innerWidth;

    const screenHeight = window.innerHeight;

    const availableWidth = screenWidth * 0.9;

    const availableHeight = screenHeight * 0.75;

    this.scale = Math.min(
      availableWidth / roomWidth,
      availableHeight / roomHeight
    );

    const displayedWidth = roomWidth * this.scale;

    const displayedHeight = roomHeight * this.scale;

    this.offsetX = (screenWidth - displayedWidth) / 2;

    this.offsetY = (screenHeight - displayedHeight) / 2;
  }

  clear() {
    this.ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  }

  renderRoom(
    roomWidth: number,
    roomHeight: number,
    exit: {
      x: number;
      y: number;
      width: number;
    }
  ) {
    const ctx = this.ctx;

    ctx.save();

    ctx.translate(this.offsetX, this.offsetY);

    ctx.scale(this.scale, this.scale);

    ctx.strokeRect(0, 0, roomWidth, roomHeight);

    ctx.fillRect(roomWidth, exit.y - exit.width / 2, 10, exit.width);

    ctx.restore();
  }

  renderObstacles(
    obstacles: {
      x: number;
      y: number;
      width: number;
      height: number;
    }[]
  ) {
    const ctx = this.ctx;

    ctx.save();

    ctx.translate(this.offsetX, this.offsetY);

    ctx.scale(this.scale, this.scale);

    for (const obstacle of obstacles) {
      ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
    }

    ctx.restore();
  }

  renderAgents(agents: Agent[]) {
    const ctx = this.ctx;

    ctx.save();

    ctx.translate(this.offsetX, this.offsetY);

    ctx.scale(this.scale, this.scale);

    for (const agent of agents) {
      ctx.beginPath();

      ctx.arc(agent.position.x, agent.position.y, agent.radius, 0, Math.PI * 2);

      ctx.fill();
    }

    ctx.restore();
  }

  renderFluidParticles(
      particles: {
          x: number;
              y: number;
                  radius: number;
                    }[]
                    ) {
                      const ctx = this.ctx;

                        ctx.save();

                          ctx.translate(this.offsetX, this.offsetY);
                            ctx.scale(this.scale, this.scale);

                              for (const particle of particles) {
                                  ctx.beginPath();
                                      ctx.arc(
                                            particle.x,
                                                  particle.y,
                                                        particle.radius,
                                                              0,
                                                                    Math.PI * 2
                                                                        );
                                                                            ctx.fill();
                                                                              }

                                                                                ctx.restore();
                                                                                }

  renderFluidVelocity(field: {
    nx: number;
    ny: number;
    dx: number;
    dy: number;
    u: Float64Array;
    v: Float64Array;
    index: (i: number, j: number) => number;
  }) {
    const ctx = this.ctx;

    ctx.save();

    ctx.translate(this.offsetX, this.offsetY);

    ctx.scale(this.scale, this.scale);

    const arrowScale = 8;

    for (let j = 1; j <= field.ny; j += 2) {
      for (let i = 1; i <= field.nx; i += 2) {
        const k = field.index(i, j);

        const x = (i - 0.5) * field.dx;

        const y = (j - 0.5) * field.dy;

        const vx = field.u[k];

        const vy = field.v[k];

        const magnitude = Math.sqrt(vx * vx + vy * vy);

        if (magnitude < 0.01) {
          continue;
        }

        const endX = x + vx * arrowScale;

        const endY = y + vy * arrowScale;

        ctx.beginPath();

        ctx.moveTo(x, y);

        ctx.lineTo(endX, endY);

        const angle = Math.atan2(endY - y, endX - x);

        const headLength = 3;

        ctx.moveTo(endX, endY);

        ctx.lineTo(
          endX - headLength * Math.cos(angle - Math.PI / 6),
          endY - headLength * Math.sin(angle - Math.PI / 6)
        );

        ctx.stroke();

        ctx.moveTo(endX, endY);

        ctx.lineTo(
          endX - headLength * Math.cos(angle + Math.PI / 6),
          endY - headLength * Math.sin(angle + Math.PI / 6)
        );

        ctx.stroke();
      }
    }

    ctx.restore();
  }

  screenToWorld(screenX: number, screenY: number) {
    return {
      x: (screenX - this.offsetX) / this.scale,

      y: (screenY - this.offsetY) / this.scale,
    };
  }
}
