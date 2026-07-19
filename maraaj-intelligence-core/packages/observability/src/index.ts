
export interface MetricPoint {
  name: string;
  value: number;
  labels?: Record<string, string>;
}

const counters = new Map<string, number>();
const histograms = new Map<string, number[]>();

export function incCounter(name: string, labels: Record<string, string> = {}, by = 1) {
  const key = `${name}|${JSON.stringify(labels)}`;
  counters.set(key, (counters.get(key) ?? 0) + by);
}

export function observeDuration(name: string, ms: number, labels: Record<string, string> = {}) {
  const key = `${name}|${JSON.stringify(labels)}`;
  const arr = histograms.get(key) ?? [];
  arr.push(ms);
  histograms.set(key, arr.slice(-500));
}

export function renderPrometheus(): string {
  const lines: string[] = [];
  for (const [key, value] of counters) {
    const [name, labels] = key.split("|");
    lines.push(`# TYPE ${name} counter`);
    lines.push(`${name}${labels && labels !== "{}" ? labels : ""} ${value}`);
  }
  return lines.join("\n") + "\n";
}

export async function withSpan<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const start = Date.now();
  try {
    return await fn();
  } finally {
    observeDuration(name, Date.now() - start);
  }
}
