export interface ExperimentRecord {
  time: number;
  remaining: number;
  entered: number;
  exited: number;
  averageSpeed: number;
  density: number;
}

export class ExperimentRecorder {
  private records: ExperimentRecord[] = [];

  start() {
    this.records = [];
  }

  record(data: ExperimentRecord) {
    this.records.push(data);
  }

  getRecords() {
    return [...this.records];
  }

  clear() {
    this.records = [];
  }

  exportCSV(filename = 'crowd-experiment.csv') {
    if (this.records.length === 0) {
      return;
    }

    const header = 'time,remaining,entered,exited,averageSpeed,density';

    const rows = this.records.map((record) =>
      [
        record.time,
        record.remaining,
        record.entered,
        record.exited,
        record.averageSpeed,
        record.density,
      ].join(',')
    );

    const csv = [header, ...rows].join('\n');

    const blob = new Blob([csv], {
      type: 'text/csv;charset=utf-8;',
    });

    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');

    link.href = url;
    link.download = filename;

    link.click();

    URL.revokeObjectURL(url);
  }
}
