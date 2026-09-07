export interface ComparisonRecord {
  time: number;

  crowdRemaining: number;
  fluidRemaining: number;

  crowdExited: number;
  fluidExited: number;

  crowdAverageSpeed: number;
  fluidAverageSpeed: number;
}

export function compare(
  time: number,

  crowdRemaining: number,
  fluidRemaining: number,

  crowdExited: number,
  fluidExited: number,

  crowdAverageSpeed: number,
  fluidAverageSpeed: number
): ComparisonRecord {
  return {
    time,

    crowdRemaining,
    fluidRemaining,

    crowdExited,
    fluidExited,

    crowdAverageSpeed,
    fluidAverageSpeed,
  };
}