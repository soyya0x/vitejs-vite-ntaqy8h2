export interface LargeViewPoint {
  id: number;
  frame: number;
  x: number;
  y: number;
}

export interface LargeViewTrajectory {
  id: number;
  points: LargeViewPoint[];
}

const DATA_URL =
  '/LargeView_zoom_A.txt';


export async function loadLargeViewZoomA(): Promise<LargeViewTrajectory[]> {
  const response = await fetch(DATA_URL);

  if (!response.ok) {
    throw new Error(
      `LargeView_zoom_A 로드 실패: HTTP ${response.status}`
    );
  }

  const text = await response.text();

  const trajectories = new Map<number, LargeViewPoint[]>();

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const values = trimmed.split(/\s+/);

    if (values.length < 4) {
      continue;
    }

    const id = Number(values[0]);
    const frame = Number(values[1]);
    const x = Number(values[2]);
    const y = Number(values[3]);

    if (
      !Number.isFinite(id) ||
      !Number.isFinite(frame) ||
      !Number.isFinite(x) ||
      !Number.isFinite(y)
    ) {
      continue;
    }

    if (!trajectories.has(id)) {
      trajectories.set(id, []);
    }

    trajectories.get(id)!.push({
      id,
      frame,
      x,
      y,
    });
  }

  const result: LargeViewTrajectory[] = [];

  for (const [id, points] of trajectories) {
    points.sort((a, b) => a.frame - b.frame);

    result.push({
      id,
      points,
    });
  }

  result.sort((a, b) => a.id - b.id);

  console.log(
    `LargeView_zoom_A 로드 완료: ${result.length}명`
  );

  return result;
}