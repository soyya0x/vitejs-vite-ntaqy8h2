import './style.css';
import { FluidModel } from './fluid/FluidModel';
import { Renderer } from './rendering/Renderer';
import {
  CrowdModel,
  type CrowdCondition,
} from './crowd/CrowdModel';
import {
  loadLargeViewZoomA,
  type LargeViewTrajectory,
} from './data/largeviewzoomA';

/* =========================
   기본 조건
========================= */

const canvas = document.createElement('canvas');
document.body.appendChild(canvas);

const roomWidth = 800;
const roomHeight = 500;

let initialSpeed = 30;
let fluidDensity = 1000;
let fluidParticleDensity = 0.35;
let viscosity = 0.000001;

let running = false;

/*
 * escape
 * = 공간 안에 사람이 이미 존재 → 오른쪽 출구로 탈출
 *
 * open
 * = 왼쪽에서 사람이 계속 유입 → 오른쪽으로 유출
 */
let experimentMode: 'escape' | 'open' = 'escape';

let currentModel: 'fluid' | 'crowd' = 'crowd';

const renderer = new Renderer(canvas);
renderer.setupCamera(roomWidth, roomHeight);

let fluid: FluidModel;

const crowd = new CrowdModel();

/* =========================
   LargeView 실제 데이터
========================= */

let largeViewData: LargeViewTrajectory[] = [];
let largeViewDataLoaded = false;
let largeViewLoading = false;


/* =========================
   군중 기본 초기조건
========================= */

let crowdDensity = 1;

function createCrowdPositions(
  width: number,
  height: number,
  density: number
) {
  const positions: {
    x: number;
    y: number;
  }[] = [];

  /*
   * density = 0.1 → 적은 인원
   * density = 1.0 → 많은 인원
   *
   * 방 전체 면적에 비례해서
   * 사람 수를 결정한다.
   */
  const minAgents = 10;
  const maxAgents = 1000;

  const count = Math.round(
    minAgents +
      (maxAgents - minAgents) * density
  );

  /*
   * 방 전체에 격자 형태로 배치
   */
  const columns = Math.ceil(
    Math.sqrt(
      count * (width / height)
    )
  );

  const rows = Math.ceil(
    count / columns
  );

  const spacingX =
    width / (columns + 1);

  const spacingY =
    height / (rows + 1);

  for (let row = 0; row < rows; row++) {
    for (
      let column = 0;
      column < columns;
      column++
    ) {
      if (positions.length >= count) {
        break;
      }

      positions.push({
        x: spacingX * (column + 1),
        y: spacingY * (row + 1),
      });
    }
  }

  return positions;
}

const crowdCondition: CrowdCondition = {
  width: roomWidth,
  height: roomHeight,

  density: crowdDensity,

  initialSpeed,

  positions: createCrowdPositions(
    roomWidth,
    roomHeight,
    crowdDensity
  ),

  mode: 'closed',

  shape: 'corridor',

  exit: {
    x: roomWidth,
    y: roomHeight / 2,
    width: 120,
  },

  entrance: {
    x: 0,
    y: roomHeight / 2,
    width: 120,
  },

  obstacles: [],
};

crowd.initialize(crowdCondition);


/* =========================
   유체 모델
========================= */

function createFluid() {
  return new FluidModel({
    width: roomWidth,
    height: roomHeight,

    gridX: 80,
    gridY: 50,

    density: fluidDensity,
    particleDensity: fluidParticleDensity,
    viscosity,

    initialSpeed,

    inlet: {
      y: roomHeight / 2,
      height: 120,
    },

    outlet: {
      y: roomHeight / 2,
      height: 120,
    },

    mode: experimentMode,

    obstacles: [],
  });
}

fluid = createFluid();

/* =========================
   UI
========================= */

const panel = document.createElement('div');
panel.className = 'fluid-panel';

panel.innerHTML = `
  <h1>군중 흐름 물리 시뮬레이션</h1>

  <p class="description">
    실제 군중 데이터를 초기조건으로 사용하여
    군중의 물리적 거동을 시뮬레이션합니다.
  </p>

  <div class="status">
    <div>
      연구 흐름:
      <strong>
        실제 데이터 → 초기조건 → 물리 모델 → 군중 움직임
      </strong>
    </div>
  </div>

  <h3>모델 선택</h3>

  <div class="model-buttons">
    <button
      id="crowdModelButton"
      class="model-button selected"
    >
      <strong>① 군중 물리 모델</strong>
      <small>실제 데이터에서 초기조건 추출</small>
    </button>

    <button
      id="fluidModelButton"
      class="model-button"
    >
      <strong>② 유체역학 모델</strong>
      <small>Navier–Stokes 기반 비교 모델</small>
    </button>
  </div>

  <h3>실제 데이터</h3>

  <button
    id="loadDataButton"
    class="model-button"
  >
    <strong>LargeView_zoom_A 불러오기</strong>
    <small>
      실제 군중 궤적 → 초기 위치·초기 속도
    </small>
  </button>

  <h3>실험 조건</h3>

  <div class="model-buttons">

    <button
      id="escapeModeButton"
      class="model-button selected"
    >
      <strong>① 탈출형</strong>
      <small>고립된 공간 → 외부</small>
    </button>

    <button
      id="openModeButton"
      class="model-button"
    >
      <strong>② 유입·유출형</strong>
      <small>외부 → 공간 → 외부</small>
    </button>

  </div>

  <h4>초기조건</h4>

  <label class="fluid-panellabel">
    초기 속도
    <input
      id="speed"
      type="range"
      min="1"
      max="100"
      value="${initialSpeed}"
    />
    <span id="speedValue">
      ${initialSpeed}
    </span>
  </label>

  <label class="fluid-panellabel">
    군중 밀도
    <input
      id="crowdDensity"
      type="range"
      min="0.1"
      max="1"
      step="0.05"
      value="${crowdDensity}"
    />
    <span id="crowdDensityValue">
      ${crowdDensity.toFixed(2)}
    </span>
  </label>

  <label class="fluid-panellabel">
    유체 입자 밀도
    <input
      id="fluidParticleDensity"
      type="range"
      min="0.1"
      max="1"
      step="0.05"
      value="${fluidParticleDensity}"
    />
    <span id="fluidParticleDensityValue">
      ${fluidParticleDensity.toFixed(2)}
    </span>
  </label>

  <label class="fluid-panellabel">
    유체 밀도
    <input
      id="density"
      type="range"
      min="100"
      max="2000"
      value="${fluidDensity}"
    />
    <span id="densityValue">
      ${fluidDensity}
    </span>
  </label>

  <label class="fluid-panellabel">
    동점성계수
    <input
      id="viscosity"
      type="range"
      min="0"
      max="0.001"
      step="0.000001"
      value="${viscosity}"
    />
    <span id="viscosityValue">
      ${viscosity.toFixed(6)}
    </span>
  </label>

  <h4>현재 상태</h4>

  <div class="status">

    <div>
      모델:
      <strong id="modelStatus">
        군중 물리 모델
      </strong>
    </div>

    <div>
      초기조건:
      <strong id="conditionStatus">
        기본 군중 배치
      </strong>
    </div>

    <div>
      계산:
      <strong id="calculationStatus">
        사람 간 상호작용 기반
      </strong>
    </div>

  </div>

  <div class="experiment-buttons">

    <button
      id="startButton"
      class="primary"
    >
      ▶ 시작
    </button>

    <button
      id="resetButton"
    >
      🔄 초기화
    </button>

  </div>
`;

document.body.appendChild(panel);

/* =========================
   DOM
========================= */

const speedInput =
  document.getElementById('speed') as HTMLInputElement;

const densityInput =
  document.getElementById('density') as HTMLInputElement;

  const crowdDensityInput =
  document.getElementById(
    'crowdDensity'
  ) as HTMLInputElement;

const crowdDensityValue =
  document.getElementById(
    'crowdDensityValue'
  )!;

  const fluidParticleDensityInput =
  document.getElementById(
    'fluidParticleDensity'
  ) as HTMLInputElement;

const fluidParticleDensityValue =
  document.getElementById(
    'fluidParticleDensityValue'
  )!;

const viscosityInput =
  document.getElementById('viscosity') as HTMLInputElement;

const speedValue =
  document.getElementById('speedValue')!;

const densityValue =
  document.getElementById('densityValue')!;

const viscosityValue =
  document.getElementById('viscosityValue')!;

const crowdModelButton =
  document.getElementById(
    'crowdModelButton'
  ) as HTMLButtonElement;

const fluidModelButton =
  document.getElementById(
    'fluidModelButton'
  ) as HTMLButtonElement;

const loadDataButton =
  document.getElementById(
    'loadDataButton'
  ) as HTMLButtonElement;

const modelStatus =
  document.getElementById('modelStatus')!;

const conditionStatus =
  document.getElementById('conditionStatus')!;

const calculationStatus =
  document.getElementById('calculationStatus')!;

const startButton =
  document.getElementById(
    'startButton'
  ) as HTMLButtonElement;

const resetButton =
  document.getElementById(
    'resetButton'
  ) as HTMLButtonElement;

const escapeModeButton =
  document.getElementById(
    'escapeModeButton'
  ) as HTMLButtonElement;

const openModeButton =
  document.getElementById(
    'openModeButton'
  ) as HTMLButtonElement;

/* =========================
   모델 선택
========================= */

crowdModelButton.addEventListener(
  'click',
  () => {

    currentModel = 'crowd';

    crowdModelButton.classList.add('selected');
    fluidModelButton.classList.remove('selected');

    modelStatus.textContent =
      '군중 물리 모델';

    calculationStatus.textContent =
      '사람 간 상호작용 기반';

    /*
     * LargeView는
     * 탈출형에서만 실제 초기조건으로 적용
     */
    if (
      largeViewDataLoaded &&
      experimentMode === 'escape'
    ) {

      crowd.seedFromTrajectoryData(
        largeViewData
      );

      conditionStatus.textContent =
        `탈출형 · 실제 군중 ${largeViewData.length}명`;
    }

    if (
      !largeViewDataLoaded &&
      experimentMode === 'escape'
    ) {

      crowd.initialize(
        crowdCondition
      );

      conditionStatus.textContent =
        '탈출형 · 기본 군중 배치';
    }

    if (experimentMode === 'open') {

      crowd.initialize({
        ...crowdCondition,
        positions: [],
        mode: 'continuous',
      });

      conditionStatus.textContent =
        '유입·유출형 · 입구에서 지속적으로 유입';
    }
  }
);

/* =========================
   유체 모델 선택
========================= */

fluidModelButton.addEventListener(
  'click',
  () => {

    currentModel = 'fluid';

    fluidModelButton.classList.add('selected');
    crowdModelButton.classList.remove('selected');

    modelStatus.textContent =
      '유체역학 모델';

    calculationStatus.textContent =
      'Navier–Stokes';

    conditionStatus.textContent =
      '유체 초기조건';
  }
);

/* =========================
   LargeView 데이터 불러오기
========================= */

async function loadLargeViewData() {

  if (largeViewLoading) {
    return;
  }

  largeViewLoading = true;

  loadDataButton.disabled = true;

  loadDataButton.innerHTML = `
    <strong>
      LargeView 데이터 불러오는 중...
    </strong>

    <small>
      실제 군중 궤적을 읽고 있습니다.
    </small>
  `;

  try {

    const data =
      await loadLargeViewZoomA();

    largeViewData =
      data;

    largeViewDataLoaded =
      true;

    /*
     * 탈출형일 때만
     * LargeView를 실제 초기조건으로 사용
     */
    if (
      experimentMode === 'escape'
    ) {

      crowd.seedFromTrajectoryData(
        largeViewData
      );

      conditionStatus.textContent =
        `탈출형 · 실제 군중 ${data.length}명`;

      calculationStatus.textContent =
        '실제 초기 위치·속도 + 사람 간 상호작용';

    } else {

      /*
       * 유입·유출형에서는
       * 데이터를 저장만 하고
       * 현재 군중 상태를 덮어쓰지 않음
       */

      conditionStatus.textContent =
        '유입·유출형 · 현재 유입 조건 유지';

      calculationStatus.textContent =
        '입구 유입 + 군중 상호작용';
    }

    currentModel =
      'crowd';

    crowdModelButton.classList.add(
      'selected'
    );

    fluidModelButton.classList.remove(
      'selected'
    );

    modelStatus.textContent =
      '군중 물리 모델';

    loadDataButton.innerHTML = `
      <strong>
        ✓ LargeView 데이터 불러옴
      </strong>

      <small>
        ${
          experimentMode === 'escape'
            ? '실제 군중을 탈출형 초기조건으로 적용'
            : '실제 데이터 저장 완료 · 유입·유출 조건 유지'
        }
      </small>
    `;

  } catch (error) {

    console.error(error);

    conditionStatus.textContent =
      '데이터 불러오기 실패';

    loadDataButton.innerHTML = `
      <strong>
        LargeView 데이터 불러오기 실패
      </strong>

      <small>
        다시 눌러주세요.
      </small>
    `;

  } finally {

    largeViewLoading =
      false;

    loadDataButton.disabled =
      false;
  }
}

loadDataButton.addEventListener(
  'click',
  loadLargeViewData
);

/* =========================
   속도
========================= */

speedInput.addEventListener(
  'input',
  () => {

    initialSpeed =
  Number(speedInput.value);

speedValue.textContent =
  String(initialSpeed);

crowdCondition.initialSpeed =
  initialSpeed;

crowd.setDesiredSpeed(
  initialSpeed
);


    if (
      currentModel === 'fluid'
    ) {

      fluid =
        createFluid();
    }
  }
);

/* =========================
   군중 밀도
========================= */

crowdDensityInput.addEventListener(
  'input',
  () => {

    crowdDensity =
      Number(crowdDensityInput.value);

    crowdDensityValue.textContent =
      crowdDensity.toFixed(2);

    /*
     * 탈출형에서는
     * 밀도 변경 즉시
     * 공 개수와 배치를 다시 계산한다.
     */
    if (
      experimentMode === 'escape'
    ) {

      crowdCondition.density =
        crowdDensity;

      crowdCondition.positions =
        createCrowdPositions(
          roomWidth,
          roomHeight,
          crowdDensity
        );

      /*
       * 현재 화면의 군중을
       * 즉시 새로운 초기조건으로 교체
       */
      crowd.initialize(
        crowdCondition
      );

      conditionStatus.textContent =
        `탈출형 · 군중 밀도 ${crowdDensity.toFixed(2)} · ${crowd.agents.length}명`;
    }
  }
);

/* =========================
   유체 입자 밀도
========================= */

fluidParticleDensityInput.addEventListener(
  'input',
  () => {
    fluidParticleDensity =
      Number(
        fluidParticleDensityInput.value
      );

    fluidParticleDensityValue.textContent =
      fluidParticleDensity.toFixed(2);

    /*
     * 입자 밀도를 바꾸면
     * 현재 유체의 입자 수와 배치를
     * 즉시 다시 계산한다.
     */
    fluid =
      createFluid();

    conditionStatus.textContent =
      experimentMode === 'escape'
        ? `탈출형 · 유체 입자 밀도 ${fluidParticleDensity.toFixed(2)} · ${fluid.particles.length}개`
        : `유입·유출형 · 유체 입자 밀도 ${fluidParticleDensity.toFixed(2)}`;
  }
);

/* =========================
   유체 밀도
========================= */

densityInput.addEventListener(
  'input',
  () => {

    fluidDensity =
      Number(densityInput.value);

    densityValue.textContent =
      String(fluidDensity);

    fluid =
      createFluid();
  }
);

/* =========================
   점성
========================= */

viscosityInput.addEventListener(
  'input',
  () => {

    viscosity =
      Number(viscosityInput.value);

    viscosityValue.textContent =
      viscosity.toFixed(6);

    fluid =
      createFluid();
  }
);

/* =========================
   탈출형
========================= */

escapeModeButton.addEventListener(
  'click',
  () => {

    experimentMode =
      'escape';

    escapeModeButton.classList.add(
      'selected'
    );

    openModeButton.classList.remove(
      'selected'
    );

    fluid =
      createFluid();

    /*
     * 탈출형:
     *
     * 공간 내부에 사람이 존재
     * ↓
     * 사람 간 상호작용
     * ↓
     * 오른쪽 출구로 탈출
     */

    if (
      largeViewDataLoaded
    ) {

      crowd.seedFromTrajectoryData(
        largeViewData
      );

      conditionStatus.textContent =
        `탈출형 · 실제 군중 ${largeViewData.length}명`;

      calculationStatus.textContent =
        '실제 초기 위치·속도 + 군중 상호작용';

    } else {

      crowd.initialize(
        crowdCondition
      );

      conditionStatus.textContent =
        '탈출형 · 공간 내부에 군중 존재';

      calculationStatus.textContent =
        '기본 초기조건 + 군중 상호작용';
    }

    currentModel =
      'crowd';

    crowdModelButton.classList.add(
      'selected'
    );

    fluidModelButton.classList.remove(
      'selected'
    );

    modelStatus.textContent =
      '군중 물리 모델';
  }
);

/* =========================
   유입·유출형
========================= */

openModeButton.addEventListener(
  'click',
  () => {

    experimentMode =
      'open';

    openModeButton.classList.add(
      'selected'
    );

    escapeModeButton.classList.remove(
      'selected'
    );

    fluid =
      createFluid();

    /*
     * 유입·유출형:
     *
     * 처음에는 사람 0명
     * ↓
     * 왼쪽 입구에서 유입
     * ↓
     * 공간 내부 이동
     * ↓
     * 오른쪽 출구로 유출
     */

    crowd.initialize({
      ...crowdCondition,
      positions: [],
      mode: 'continuous',
    });

    conditionStatus.textContent =
      '유입·유출형 · 입구에서 지속적으로 유입';

    calculationStatus.textContent =
      '입구 유입 + 군중 상호작용';

    currentModel =
      'crowd';

    crowdModelButton.classList.add(
      'selected'
    );

    fluidModelButton.classList.remove(
      'selected'
    );

    modelStatus.textContent =
      '군중 물리 모델';
  }
);

/* =========================
   시작 / 정지
========================= */

startButton.addEventListener(
  'click',
  () => {

    running =
      !running;

    startButton.textContent =
      running
        ? '⏸ 정지'
        : '▶ 시작';

    if (running) {

      panel.classList.add(
        'hidden'
      );

    } else {

      panel.classList.remove(
        'hidden'
      );
    }
  }
);

/* =========================
   초기화
========================= */

resetButton.addEventListener(
  'click',
  () => {

    running =
      false;

    startButton.textContent =
      '▶ 시작';

    panel.classList.remove(
      'hidden'
    );

    fluid =
      createFluid();

    /*
     * 탈출형 + LargeView
     */

    if (
      currentModel === 'crowd' &&
      experimentMode === 'escape' &&
      largeViewDataLoaded
    ) {

      crowd.seedFromTrajectoryData(
        largeViewData
      );

      conditionStatus.textContent =
        `탈출형 · 실제 군중 ${largeViewData.length}명`;

      return;
    }

    /*
     * 탈출형 + 기본 데이터
     */

    if (
      experimentMode === 'escape'
    ) {

      crowd.initialize(
        crowdCondition
      );

      conditionStatus.textContent =
        '탈출형 · 기본 군중 배치';

      return;
    }

    /*
     * 유입·유출형
     */

    crowd.initialize({
      ...crowdCondition,
      positions: [],
      mode: 'continuous',
    });

    conditionStatus.textContent =
      '유입·유출형 · 연속 유입 초기조건';
  }
);

/* =========================
   애니메이션
========================= */

let lastTime =
  performance.now();

function animate(
  currentTime: number
) {

  const dt =
    Math.min(
      (currentTime - lastTime) / 1000,
      0.016
    );

  lastTime =
    currentTime;

  /* =========================
     물리 계산
  ========================= */

  if (running) {

    if (
      currentModel === 'fluid'
    ) {

      fluid.update();

    } else {

      crowd.update(dt);
    }
  }

  /* =========================
     화면 초기화
  ========================= */

  renderer.clear();

  /* =========================
     공간
  ========================= */

  renderer.renderRoom(
    roomWidth,
    roomHeight,
    {
      x: roomWidth,
      y: roomHeight / 2,
      width: 120,
    }
  );

  /* =========================
     결과 출력
  ========================= */

  if (
    currentModel === 'fluid'
  ) {

    renderer.renderFluidParticles(
      fluid.particles
    );

  } else {

    renderer.renderAgents(
      crowd.agents
    );
  }

  requestAnimationFrame(
    animate
  );
}

requestAnimationFrame(
  animate
);

/* =========================
   화면 크기
========================= */

window.addEventListener(
  'resize',
  () => {

    renderer.resize();

    renderer.setupCamera(
      roomWidth,
      roomHeight
    );
  }
);