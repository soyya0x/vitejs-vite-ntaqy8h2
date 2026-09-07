import './style.css';
import { FluidModel } from './fluid/FluidModel';
import { Renderer } from './rendering/Renderer';
import { CrowdModel } from './crowd/CrowdModel';
import { loadLargeViewZoomA } from './data/largeviewzoomA';

const canvas = document.createElement('canvas');
document.body.appendChild(canvas);

const roomWidth = 800;
const roomHeight = 500;

let initialSpeed = 30;
let fluidDensity = 1000;
let viscosity = 0.000001;

let running = false;

const renderer = new Renderer(canvas);
renderer.setupCamera(roomWidth, roomHeight);

let fluid: FluidModel;
let currentModel: 'fluid' | 'crowd' = 'fluid';

let largeViewDataLoaded = false;
let largeViewLoading = false;

const crowd = new CrowdModel();

const crowdCondition = {
  width: roomWidth,
  height: roomHeight,
  density: 1,
  initialSpeed: 80,

  positions: Array.from({ length: 40 }, (_, index) => ({
    x: 100 + (index % 8) * 35,
    y: 130 + Math.floor(index / 8) * 45,
  })),
  mode: 'closed' as const,
  shape: 'corridor' as const,

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

function createFluid() {
  return new FluidModel({
    width: roomWidth,
    height: roomHeight,

    gridX: 80,
    gridY: 50,

    density: fluidDensity,
    viscosity: viscosity,

    initialSpeed: initialSpeed,

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

/* =========================
   UI
========================= */

const panel = document.createElement('div');
panel.className = 'fluid-panel';

panel.innerHTML = `
  <h1>유체 흐름 실험</h1>

  <p class="description">
    서로 다른 접근법으로 흐름을 비교합니다.
  </p>

  <div class="model-buttons">

    <button
      id="fluidModelButton"
      class="model-button selected"
    >
      <strong>① 근본 유체역학</strong>
      <small>Navier–Stokes 기반</small>
    </button>

    <button
      id="largezoomModelButton"
      class="model-button"
    >
      <strong>② largezoomA 데이터</strong>
      <small>실제 데이터 기반</small>
    </button>

  </div>

  <h3>실험 조건</h3>

<div class="model-buttons">
  <button id="escapeModeButton" class="model-button selected">
    <strong>① 탈출형</strong>
    <small>고립된 공간 → 외부</small>
  </button>

  <button id="openModeButton" class="model-button">
    <strong>② 유입·유출형</strong>
    <small>외부 → 공간 → 외부</small>
  </button>
</div>

  <h4>유체 조건</h4>

  <label class="fluid-panellabel">
    초기 속도
    <input
      id="speed"
      type="range"
      min="1"
      max="100"
      value="${initialSpeed}"
    />
    <span id="speedValue">${initialSpeed}</span>
  </label>

  <label class="fluid-panellabel">
    밀도
    <input
      id="density"
      type="range"
      min="100"
      max="2000"
      value="${fluidDensity}"
    />
    <span id="densityValue">${fluidDensity}</span>
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

  <div class="status">

    <div>
      모델:
      <strong id="modelStatus">
        근본 유체역학
      </strong>
    </div>

    <div>
      계산 방식:
      <strong id="calculationStatus">
  Navier–Stokes
</strong>
    </div>

  </div>
`;

document.body.appendChild(panel);

/* =========================
   DOM
========================= */

const speedInput = document.getElementById('speed') as HTMLInputElement;

const densityInput = document.getElementById('density') as HTMLInputElement;

const viscosityInput = document.getElementById('viscosity') as HTMLInputElement;

const speedValue = document.getElementById('speedValue')!;

const densityValue = document.getElementById('densityValue')!;

const viscosityValue = document.getElementById('viscosityValue')!;

const fluidModelButton = document.getElementById(
  'fluidModelButton'
) as HTMLButtonElement;

const largezoomModelButton = document.getElementById(
  'largezoomModelButton'
) as HTMLButtonElement;

const modelStatus = document.getElementById('modelStatus')!;

const startButton = document.getElementById('startButton') as HTMLButtonElement;

const resetButton = document.getElementById('resetButton') as HTMLButtonElement;

const escapeModeButton = document.getElementById(
  'escapeModeButton'
) as HTMLButtonElement;

const openModeButton = document.getElementById(
  'openModeButton'
) as HTMLButtonElement;

let experimentMode: 'escape' | 'open' = 'escape';

fluid = createFluid();

/* =========================
   입력값
========================= */

speedInput.addEventListener('input', () => {
  initialSpeed = Number(speedInput.value);
  speedValue.textContent = String(initialSpeed);
});

densityInput.addEventListener('input', () => {
  fluidDensity = Number(densityInput.value);
  densityValue.textContent = String(fluidDensity);
});

viscosityInput.addEventListener('input', () => {
  viscosity = Number(viscosityInput.value);
  viscosityValue.textContent = viscosity.toFixed(6);
});

/* =========================
   모델 선택
========================= */

fluidModelButton.addEventListener('click', () => {
  currentModel = 'fluid';

  fluidModelButton.classList.add('selected');
  largezoomModelButton.classList.remove('selected');

  modelStatus.textContent = '근본 유체역학';
});

largezoomModelButton.addEventListener('click', async () => {
  currentModel = 'crowd';

  largezoomModelButton.classList.add('selected');
  fluidModelButton.classList.remove('selected');

  modelStatus.textContent = 'LargeView_zoom_A 실제 데이터';

  if (!largeViewDataLoaded && !largeViewLoading) {
    largeViewLoading = true;

    modelStatus.textContent = 'LargeView_zoom_A 불러오는 중...';

    try {
      const data = await loadLargeViewZoomA();

      crowd.setTrajectoryData(data);

      largeViewDataLoaded = true;
      modelStatus.textContent = `LargeView_zoom_A 실제 데이터 (${data.length}명)`;
    } catch (error) {
      console.error(error);

      modelStatus.textContent = 'LargeView_zoom_A 불러오기 실패';

      currentModel = 'fluid';

      largezoomModelButton.classList.remove('selected');
      fluidModelButton.classList.add('selected');
    } finally {
      largeViewLoading = false;
    }
  }
});

/* =========================
   실험 조건 선택
========================= */

escapeModeButton.addEventListener('click', () => {
  experimentMode = 'escape';

  escapeModeButton.classList.add('selected');
  openModeButton.classList.remove('selected');

  fluid = createFluid();
  crowd.initialize(crowdCondition);
});

openModeButton.addEventListener('click', () => {
  experimentMode = 'open';
  openModeButton.classList.add('selected');
  escapeModeButton.classList.remove('selected');

  fluid = createFluid();

  const openCrowdCondition = {
    ...crowdCondition,
    positions: [],
    mode: 'continuous' as const,
  };

  crowd.initialize(openCrowdCondition);
});

/* =========================
   시작
========================= */

startButton.addEventListener('click', () => {
  running = !running;
  startButton.textContent = running ? '⏸ 정지' : '▶ 시작';

  if (running) {
    panel.classList.add('hidden');
  } else {
    panel.classList.remove('hidden');
  }
});

/* =========================
   초기화
========================= */

resetButton.addEventListener('click', () => {
  running = false;
  startButton.textContent = '▶ 시작';
  panel.classList.remove('hidden');

  fluid = createFluid();

  if (experimentMode === 'escape') {
    crowd.initialize(crowdCondition);
  } else {
    crowd.initialize({
      ...crowdCondition,
      positions: [],
      mode: 'continuous' as const,
    });
  }
});

/* =========================
   애니메이션
========================= */

let lastTime = performance.now();

function animate(currentTime: number) {
  const dt = Math.min((currentTime - lastTime) / 1000, 0.016);

  lastTime = currentTime;

  /*
   * =========================
   * 계산
   * =========================
   */

  if (running) {
    if (currentModel === 'fluid') {
      fluid.update();
    } else {
      crowd.update(dt);
    }
  }

  /*
   * =========================
   * 화면 초기화
   * =========================
   */

  renderer.clear();

  /*
   * =========================
   * 방 그리기
   * =========================
   */

  renderer.renderRoom(roomWidth, roomHeight, {
    x: roomWidth,
    y: roomHeight / 2,
    width: 120,
  });

  /*
   * =========================
   * 선택된 모델 그리기
   * =========================
   */

  if (currentModel === 'fluid') {
    renderer.renderFluidParticles(fluid.particles);
  } else {
    renderer.renderAgents(crowd.agents);
  }

  requestAnimationFrame(animate);
}

requestAnimationFrame(animate);

window.addEventListener('resize', () => {
  renderer.resize();
  renderer.setupCamera(roomWidth, roomHeight);
});
