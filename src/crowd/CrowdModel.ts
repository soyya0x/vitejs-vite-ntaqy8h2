import type { InitialCondition } from '../core/InitialCondition';
import type { Simulation } from '../core/Simulation';
import type { Agent } from './Agent';
import type { LargeViewTrajectory } from '../data/largeviewzoomA';

export class CrowdModel implements Simulation {
  agents: Agent[] = [];

  private roomWidth = 800;
  private roomHeight = 500;

  private mode: 'closed' | 'continuous' = 'closed';
  private shape: 'rectangle' | 'corridor' = 'rectangle';

  private exit = {
    x: 800,
    y: 250,
    width: 100,
  };

  private entrance = {
    x: 0,
    y: 250,
    width: 100,
  };

  private obstacles: {
    x: number;
    y: number;
    width: number;
    height: number;
  }[] = [];

  /*
   * =========================
   * 군중 물리 파라미터
   * =========================
   */

  private desiredSpeed = 80;
  private repulsionStrength = 180;
  private agentRadius = 6;
  private obstacleRepulsionStrength = 250;

  /*
   * =========================
   * LargeView 데이터
   * =========================
   *
   * true:
   * 실제 trajectory 재생
   *
   * false:
   * 실제 데이터를 초기조건으로만 사용하고
   * 이후 물리 모델로 계산
   */

  private dataMode = false;

  private trajectoryData: LargeViewTrajectory[] = [];
  private trajectoryTime = 0;
  private trajectoryStartFrame = 0;

  private readonly trajectoryFrameRate = 10;

  private dataMinX = 0;
  private dataMaxX = 1;
  private dataMinY = 0;
  private dataMaxY = 1;

  /*
   * =========================
   * 연속 유입 조건
   * =========================
   */

  private timeSinceLastSpawn = 0;

  // 0.4초마다 한 명 생성
  private spawnInterval = 0.4;

  // 동시에 존재할 수 있는 최대 인원
  private maxAgents = 40;

  private enteredCount = 0;
  private exitedCount = 0;

  /*
   * =========================
   * 초기화
   * =========================
   */

  initialize(condition: InitialCondition) {
    this.roomWidth = condition.width;
    this.roomHeight = condition.height;

    this.mode = condition.mode;
    this.shape = condition.shape;

    this.exit = condition.exit;
    this.entrance = condition.entrance;

    this.obstacles = condition.obstacles;

    this.desiredSpeed = condition.initialSpeed;

    this.dataMode = false;
    this.trajectoryData = [];
    this.trajectoryTime = 0;
    this.trajectoryStartFrame = 0;

    this.timeSinceLastSpawn = 0;
    this.enteredCount = 0;
    this.exitedCount = 0;

    /*
     * =========================
     * 탈출형
     * =========================
     *
     * 시작 순간부터 공간 안에
     * 모든 군중이 존재한다.
     */

    if (this.mode === 'closed') {
      this.agents = condition.positions.map(
        (position) => ({
          position: {
            ...position,
          },

          velocity: {
            x: 0,
            y: 0,
          },

          radius: this.agentRadius,
          mass: 1,
        })
      );

      return;
    }

    /*
     * =========================
     * 유입·유출형
     * =========================
     *
     * 시작할 때 공간은 비어 있다.
     *
     * 이후 update()에서
     * 왼쪽 입구를 통해
     * 사람이 계속 들어온다.
     */

    this.agents = [];
  }

  /*
   * ====================================================
   * LargeView 실제 trajectory 재생
   * ====================================================
   */

  setTrajectoryData(
    data: LargeViewTrajectory[]
  ) {
    this.dataMode = true;

    this.trajectoryData = data;

    this.trajectoryTime = 0;

    if (data.length === 0) {
      this.agents = [];
      return;
    }

    const allFrames = data.flatMap(
      (trajectory) =>
        trajectory.points.map(
          (point) => point.frame
        )
    );

    if (allFrames.length === 0) {
      this.agents = [];
      return;
    }

    this.trajectoryStartFrame =
      Math.min(...allFrames);

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (const trajectory of data) {
      for (const point of trajectory.points) {
        minX = Math.min(
          minX,
          point.x
        );

        maxX = Math.max(
          maxX,
          point.x
        );

        minY = Math.min(
          minY,
          point.y
        );

        maxY = Math.max(
          maxY,
          point.y
        );
      }
    }

    this.dataMinX = minX;
    this.dataMaxX = maxX;
    this.dataMinY = minY;
    this.dataMaxY = maxY;

    this.updateTrajectoryAgents();
  }

  /*
   * ====================================================
   * LargeView → 군중 물리 초기조건
   * ====================================================
   *
   * 실제 군중 데이터에서
   *
   * 첫 번째 위치
   * +
   * 첫 두 관측점의 차이로 계산한 속도
   *
   * 를 초기조건으로 사용한다.
   *
   * 이후 실제 trajectory를 재생하지 않고
   * 물리 모델이 군중의 움직임을 계산한다.
   */

  seedFromTrajectoryData(
    data: LargeViewTrajectory[]
  ) {
    if (data.length === 0) {
      this.agents = [];
      this.dataMode = false;
      return;
    }

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (const trajectory of data) {
      for (const point of trajectory.points) {
        minX = Math.min(
          minX,
          point.x
        );

        maxX = Math.max(
          maxX,
          point.x
        );

        minY = Math.min(
          minY,
          point.y
        );

        maxY = Math.max(
          maxY,
          point.y
        );
      }
    }

    if (
      !Number.isFinite(minX) ||
      !Number.isFinite(maxX) ||
      !Number.isFinite(minY) ||
      !Number.isFinite(maxY)
    ) {
      this.agents = [];
      this.dataMode = false;
      return;
    }

    this.dataMinX = minX;
    this.dataMaxX = maxX;
    this.dataMinY = minY;
    this.dataMaxY = maxY;

    const scaleX =
      this.roomWidth /
      Math.max(
        this.dataMaxX -
          this.dataMinX,
        0.001
      );

    const scaleY =
      this.roomHeight /
      Math.max(
        this.dataMaxY -
          this.dataMinY,
        0.001
      );

    const agents: Agent[] = [];

    for (const trajectory of data) {
      const points =
        trajectory.points;

      if (points.length === 0) {
        continue;
      }

      const first =
        points[0];

      const second =
        points.length > 1
          ? points[1]
          : points[0];

      const position =
        this.mapDataPosition(
          first.x,
          first.y
        );

      const velocityX =
        (second.x - first.x) *
        scaleX *
        this.trajectoryFrameRate;

      const velocityY =
        -(second.y - first.y) *
        scaleY *
        this.trajectoryFrameRate;

      agents.push({
        position,

        velocity: {
          x: velocityX,
          y: velocityY,
        },

        radius:
          this.agentRadius,

        mass: 1,
      });
    }

    this.agents = agents;

    /*
     * 실제 trajectory 재생 종료.
     *
     * 이제부터 물리 모델이 계산한다.
     */

    this.dataMode = false;
    this.trajectoryData = [];
    this.trajectoryTime = 0;
  }

  /*
   * ====================================================
   * 데이터 좌표 → 시뮬레이션 좌표
   * ====================================================
   */

  private mapDataPosition(
    x: number,
    y: number
  ) {
    const padding = 30;

    const dataWidth =
      Math.max(
        this.dataMaxX -
          this.dataMinX,
        0.001
      );

    const dataHeight =
      Math.max(
        this.dataMaxY -
          this.dataMinY,
        0.001
      );

    const availableWidth =
      Math.max(
        this.roomWidth -
          padding * 2,
        1
      );

    const availableHeight =
      Math.max(
        this.roomHeight -
          padding * 2,
        1
      );

    const scale =
      Math.min(
        availableWidth /
          dataWidth,

        availableHeight /
          dataHeight
      );

    const renderedWidth =
      dataWidth * scale;

    const renderedHeight =
      dataHeight * scale;

    const offsetX =
      (this.roomWidth -
        renderedWidth) /
      2;

    const offsetY =
      (this.roomHeight -
        renderedHeight) /
      2;

    return {
      x:
        offsetX +
        (x - this.dataMinX) *
          scale,

      y:
        this.roomHeight -
        (
          offsetY +
          (y - this.dataMinY) *
            scale
        ),
    };
  }

  /*
   * ====================================================
   * 실제 trajectory 재생
   * ====================================================
   */

  private updateTrajectoryAgents() {
    const currentFrame =
      this.trajectoryStartFrame +
      this.trajectoryTime *
        this.trajectoryFrameRate;

    const agents: Agent[] = [];

    for (const trajectory of this.trajectoryData) {
      const points =
        trajectory.points;

      if (points.length === 0) {
        continue;
      }

      let rightIndex = 0;

      while (
        rightIndex <
          points.length &&
        points[rightIndex].frame <
          currentFrame
      ) {
        rightIndex++;
      }

      if (rightIndex === 0) {
        const point =
          points[0];

        agents.push({
          position:
            this.mapDataPosition(
              point.x,
              point.y
            ),

          velocity: {
            x: 0,
            y: 0,
          },

          radius: 3,
          mass: 1,
        });

        continue;
      }

      if (
        rightIndex >=
        points.length
      ) {
        continue;
      }

      const left =
        points[rightIndex - 1];

      const right =
        points[rightIndex];

      const frameSpan =
        right.frame -
        left.frame;

      const alpha =
        frameSpan > 0
          ? (
              currentFrame -
              left.frame
            ) / frameSpan
          : 0;

      const x =
        left.x +
        (right.x -
          left.x) *
          alpha;

      const y =
        left.y +
        (right.y -
          left.y) *
          alpha;

      const position =
        this.mapDataPosition(
          x,
          y
        );

      const scaleX =
        this.roomWidth /
        Math.max(
          this.dataMaxX -
            this.dataMinX,
          0.001
        );

      const scaleY =
        this.roomHeight /
        Math.max(
          this.dataMaxY -
            this.dataMinY,
          0.001
        );

      const velocityX =
        (right.x -
          left.x) *
        scaleX *
        this.trajectoryFrameRate;

      const velocityY =
        -(right.y -
          left.y) *
        scaleY *
        this.trajectoryFrameRate;

      agents.push({
        position,

        velocity: {
          x: velocityX,
          y: velocityY,
        },

        radius: 3,
        mass: 1,
      });
    }

    this.agents =
      agents;
  }

  /*
   * trajectory 시간 업데이트
   */

  private updateTrajectoryData(
    dt: number
  ) {
    if (
      this.trajectoryData.length ===
      0
    ) {
      this.agents = [];
      return;
    }

    this.trajectoryTime += dt;

    this.updateTrajectoryAgents();

    const maxFrame =
      Math.max(
        ...this.trajectoryData.map(
          (trajectory) =>
            trajectory.points.length >
            0
              ? trajectory.points[
                  trajectory.points.length -
                    1
                ].frame
              : 0
        )
      );

    const maxTime =
      Math.max(
        0,

        (
          maxFrame -
          this.trajectoryStartFrame
        ) /
          this.trajectoryFrameRate
      );

    if (
      this.trajectoryTime >=
      maxTime
    ) {
      this.trajectoryTime =
        maxTime;
    }
  }

  /*
   * ====================================================
   * Agent 생성
   * ====================================================
   */

  private createAgent(
    x: number,
    y: number
  ): Agent {
    return {
      position: {
        x,
        y,
      },

      velocity: {
        x: 0,
        y: 0,
      },

      radius:
        this.agentRadius,

      mass: 1,
    };
  }

  /*
   * ====================================================
   * 물리 시뮬레이션
   * ====================================================
   */

  update(dt: number) {
    /*
     * 실제 trajectory 재생 모드
     */

    if (this.dataMode) {
      this.updateTrajectoryData(dt);
      return;
    }

    /*
     * ==================================================
     * 유입·유출형
     * ==================================================
     *
     * 공간에 존재하는 사람 수가
     * 최대 인원보다 적으면
     * 일정한 간격으로 입구에서 생성한다.
     */

    if (
      this.mode === 'continuous'
    ) {
      this.timeSinceLastSpawn += dt;

      if (
        this.timeSinceLastSpawn >=
          this.spawnInterval &&
        this.agents.length <
          this.maxAgents
      ) {
        this.spawnAgent();

        this.timeSinceLastSpawn = 0;
      }
    }

    const remainingAgents: Agent[] =
      [];

    /*
     * ==================================================
     * 모든 사람의 물리 계산
     * ==================================================
     */

    for (
      const agent of this.agents
    ) {

      /*
       * ------------------------------
       * 목표 위치
       * ------------------------------
       */

      let targetX =
        this.exit.x;

      let targetY =
        this.exit.y;

      /*
       * 탈출형 / 유입·유출형 모두
       * 최종적으로 오른쪽 출구를 향한다.
       */

      const dx =
        targetX -
        agent.position.x;

      const dy =
        targetY -
        agent.position.y;

      const distance =
        Math.sqrt(
          dx * dx +
          dy * dy
        );

      if (
        distance === 0
      ) {
        remainingAgents.push(
          agent
        );

        continue;
      }

      const directionX =
        dx / distance;

      const directionY =
        dy / distance;

      /*
       * ------------------------------
       * 목표 방향 힘
       * ------------------------------
       */

      let forceX =
        directionX *
        this.desiredSpeed;

      let forceY =
        directionY *
        this.desiredSpeed;

      /*
       * ------------------------------
       * 사람 ↔ 사람 반발력
       * ------------------------------
       */

      for (
        const other of this.agents
      ) {
        if (
          agent === other
        ) {
          continue;
        }

        const diffX =
          agent.position.x -
          other.position.x;

        const diffY =
          agent.position.y -
          other.position.y;

        const otherDistance =
          Math.sqrt(
            diffX * diffX +
            diffY * diffY
          );

        const interactionDistance =
          30;

        if (
          otherDistance > 0 &&
          otherDistance <
            interactionDistance
        ) {
          const strength =
            (
              interactionDistance -
              otherDistance
            ) /
            interactionDistance;

          forceX +=
            (
              diffX /
              otherDistance
            ) *
            strength *
            this.repulsionStrength;

          forceY +=
            (
              diffY /
              otherDistance
            ) *
            strength *
            this.repulsionStrength;
        }
      }

      /*
       * ------------------------------
       * 장애물 반발력
       * ------------------------------
       */

      for (
        const obstacle of
          this.obstacles
      ) {
        const closestX =
          Math.max(
            obstacle.x,

            Math.min(
              agent.position.x,

              obstacle.x +
                obstacle.width
            )
          );

        const closestY =
          Math.max(
            obstacle.y,

            Math.min(
              agent.position.y,

              obstacle.y +
                obstacle.height
            )
          );

        const diffX =
          agent.position.x -
          closestX;

        const diffY =
          agent.position.y -
          closestY;

        const obstacleDistance =
          Math.sqrt(
            diffX * diffX +
            diffY * diffY
          );

        const interactionDistance =
          25;

        if (
          obstacleDistance > 0 &&
          obstacleDistance <
            interactionDistance
        ) {
          const strength =
            (
              interactionDistance -
              obstacleDistance
            ) /
            interactionDistance;

          forceX +=
            (
              diffX /
              obstacleDistance
            ) *
            strength *
            this.obstacleRepulsionStrength;

          forceY +=
            (
              diffY /
              obstacleDistance
            ) *
            strength *
            this.obstacleRepulsionStrength;
        }
      }

      /*
       * ------------------------------
       * 속도 계산
       * ------------------------------
       */

      const forceMagnitude =
        Math.sqrt(
          forceX * forceX +
          forceY * forceY
        );

      if (
        forceMagnitude > 0
      ) {
        agent.velocity.x =
          (
            forceX /
            forceMagnitude
          ) *
          this.desiredSpeed;

        agent.velocity.y =
          (
            forceY /
            forceMagnitude
          ) *
          this.desiredSpeed;
      }

      /*
       * ------------------------------
       * 위치 업데이트
       * ------------------------------
       */

      agent.position.x +=
        agent.velocity.x *
        dt;

      agent.position.y +=
        agent.velocity.y *
        dt;

      /*
       * 벽
       */

      this.keepInsideRoom(
        agent
      );

      /*
       * 장애물
       */

      this.resolveObstacleCollision(
        agent
      );

      /*
       * ------------------------------
       * 오른쪽 출구 통과
       * ------------------------------
       */

      const exitTop =
        this.exit.y -
        this.exit.width /
          2;

      const exitBottom =
        this.exit.y +
        this.exit.width /
          2;

      const insideExit =
        agent.position.y >=
          exitTop &&
        agent.position.y <=
          exitBottom;

      if (
        agent.position.x >
          this.roomWidth &&
        insideExit
      ) {
        this.exitedCount++;

        continue;
      }

      remainingAgents.push(
        agent
      );
    }

    this.agents =
      remainingAgents;
  }

  /*
   * ====================================================
   * 파라미터 설정
   * ====================================================
   */

  setDesiredSpeed(
    speed: number
  ) {
    this.desiredSpeed =
      Math.max(
        0,
        speed
      );
  }

  setRepulsionStrength(
    strength: number
  ) {
    this.repulsionStrength =
      Math.max(
        0,
        strength
      );
  }

  setAgentRadius(
    radius: number
  ) {
    this.agentRadius =
      Math.max(
        0.1,
        radius
      );

    for (
      const agent of
        this.agents
    ) {
      agent.radius =
        this.agentRadius;
    }
  }

  setObstacleRepulsionStrength(
    strength: number
  ) {
    this.obstacleRepulsionStrength =
      Math.max(
        0,
        strength
      );
  }

  /*
   * ====================================================
   * 유입·유출형 사람 생성
   * ====================================================
   *
   * 반드시 왼쪽 입구에서 생성한다.
   */

  private spawnAgent() {

    const entranceTop =
      this.entrance.y -
      this.entrance.width /
        2 +
      this.agentRadius;

    const entranceBottom =
      this.entrance.y +
      this.entrance.width /
        2 -
      this.agentRadius;

    const y =
      entranceTop +
      Math.random() *
        (
          entranceBottom -
          entranceTop
        );

    /*
     * 입구 근처가 이미 사람으로
     * 막혀 있으면 이번 생성은 취소한다.
     */

    const spawnX =
      this.entrance.x +
      this.agentRadius;

    const blocked =
      this.agents.some(
        (agent) => {

          const dx =
            agent.position.x -
            spawnX;

          const dy =
            agent.position.y -
            y;

          const distance =
            Math.sqrt(
              dx * dx +
              dy * dy
            );

          return distance < 18;
        }
      );

    if (blocked) {
      return;
    }

    /*
     * 입구에서 생성
     */

    const agent =
      this.createAgent(
        spawnX,
        y
      );

    /*
     * 처음부터 입구 → 출구 방향으로
     * 이동하도록 초기속도를 설정한다.
     */

    agent.velocity.x =
      this.desiredSpeed;

    agent.velocity.y = 0;

    this.agents.push(
      agent
    );

    this.enteredCount++;
  }

  /*
   * ====================================================
   * 공간 벽
   * ====================================================
   */

  private keepInsideRoom(
    agent: Agent
  ) {
    const r =
      agent.radius;

    /*
     * 위쪽 벽
     */

    if (
      agent.position.y < r
    ) {
      agent.position.y = r;
      agent.velocity.y = 0;
    }

    /*
     * 아래쪽 벽
     */

    if (
      agent.position.y >
      this.roomHeight - r
    ) {
      agent.position.y =
        this.roomHeight - r;

      agent.velocity.y = 0;
    }

    /*
     * 왼쪽 벽
     *
     * 탈출형에서는 막혀 있다.
     *
     * 유입·유출형에서는
     * 입구 구간만 열린다.
     */

    if (
      this.mode === 'closed' &&
      agent.position.x < r
    ) {
      agent.position.x = r;
      agent.velocity.x = 0;
    }

    if (
      this.mode ===
      'continuous'
    ) {
      const entranceTop =
        this.entrance.y -
        this.entrance.width /
          2;

      const entranceBottom =
        this.entrance.y +
        this.entrance.width /
          2;

      const insideEntrance =
        agent.position.y >=
          entranceTop &&
        agent.position.y <=
          entranceBottom;

      if (
        agent.position.x < 0 &&
        !insideEntrance
      ) {
        agent.position.x = 0;
        agent.velocity.x = 0;
      }
    }

    /*
     * 오른쪽 벽
     *
     * 출구 구간만 열린다.
     */

    const exitTop =
      this.exit.y -
      this.exit.width /
        2;

    const exitBottom =
      this.exit.y +
      this.exit.width /
        2;

    const insideExit =
      agent.position.y >=
        exitTop &&
      agent.position.y <=
        exitBottom;

    if (
      agent.position.x >
        this.roomWidth - r &&
      !insideExit
    ) {
      agent.position.x =
        this.roomWidth - r;

      agent.velocity.x = 0;
    }
  }

  /*
   * ====================================================
   * 장애물 충돌
   * ====================================================
   */

  private resolveObstacleCollision(
    agent: Agent
  ) {
    for (
      const obstacle of
        this.obstacles
    ) {
      const closestX =
        Math.max(
          obstacle.x,

          Math.min(
            agent.position.x,

            obstacle.x +
              obstacle.width
          )
        );

      const closestY =
        Math.max(
          obstacle.y,

          Math.min(
            agent.position.y,

            obstacle.y +
              obstacle.height
          )
        );

      const dx =
        agent.position.x -
        closestX;

      const dy =
        agent.position.y -
        closestY;

      const distance =
        Math.sqrt(
          dx * dx +
          dy * dy
        );

      if (
        distance <
        agent.radius
      ) {
        if (
          Math.abs(dx) >
          Math.abs(dy)
        ) {
          if (dx >= 0) {
            agent.position.x =
              obstacle.x +
              obstacle.width +
              agent.radius;
          } else {
            agent.position.x =
              obstacle.x -
              agent.radius;
          }

          agent.velocity.x = 0;
        } else {
          if (dy >= 0) {
            agent.position.y =
              obstacle.y +
              obstacle.height +
              agent.radius;
          } else {
            agent.position.y =
              obstacle.y -
              agent.radius;
          }

          agent.velocity.y = 0;
        }
      }
    }
  }

  /*
   * ====================================================
   * 통계
   * ====================================================
   */

  getEnteredCount() {
    return this.enteredCount;
  }

  getExitedCount() {
    return this.exitedCount;
  }
}