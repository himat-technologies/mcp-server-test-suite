export interface BenchmarkConfig { iterations: number; warmups: number; thresholdMs: number; payload: string }
export interface BenchmarkStats { samples: number[]; average: number; min: number; max: number; median: number; p95: number; totalMs: number; payloadBytes: number; throughput: number; passed: boolean }
export type Clock = () => number;
export async function runBenchmark(config: BenchmarkConfig, task: () => void | Promise<void>, clock: Clock = () => performance.now()): Promise<BenchmarkStats> {
  const iterations = Math.max(1, Math.min(1000, Math.floor(config.iterations)));
  const warmups = Math.max(0, Math.min(100, Math.floor(config.warmups)));
  for (let i = 0; i < warmups; i += 1) await task();
  const startAll = clock();
  const samples: number[] = [];
  for (let i = 0; i < iterations; i += 1) {
    const start = clock(); await task(); const end = clock(); samples.push(Math.max(0, end - start));
  }
  const endAll = clock();
  const sorted = [...samples].sort((a, b) => a - b);
  const sum = samples.reduce((a, b) => a + b, 0);
  const percentile = (p: number) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1))] ?? 0;
  const average = sum / samples.length;
  const totalMs = Math.max(0, endAll - startAll);
  const payloadBytes = new TextEncoder().encode(config.payload).length;
  return { samples, average, min: sorted[0] ?? 0, max: sorted[sorted.length - 1] ?? 0, median: percentile(0.5), p95: percentile(0.95), totalMs, payloadBytes, throughput: totalMs > 0 ? iterations / (totalMs / 1000) : 0, passed: average <= config.thresholdMs };
}
