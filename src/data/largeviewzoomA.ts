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

export async function loadLargeViewZoomA(): Promise<LargeViewTrajectory[]> {
  const response = await fetch('/data/LargeView_zoom_A.txt');

  if (!response.ok) {
    throw new Error(
      `LargeView_zoom_A.txt를 불러오지 못했습니다. (${response.status})`
    );
  }

  const text = await response.text();

  const trajectories = new Map<number, LargeViewPoint[]>();

  const lines = text.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    // 주석 / 빈 줄 무시
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const values = trimmed.split(/\s+/);

    // id frame x y z t x_RGF y_RGF
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

  return result;
}