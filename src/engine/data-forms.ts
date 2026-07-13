import type { Pt, Rng } from '../types';

function positiveValues(values: number[]): number[] {
  if (values.length === 0) throw new Error('sumi chart formation requires at least one value');
  const clean = values.map((value) => Number.isFinite(value) ? Math.max(0, value) : 0);
  return clean.some((value) => value > 0) ? clean : clean.map(() => 1);
}

function weightedIndex(values: number[], target: number): number {
  let cumulative = 0;
  for (let i = 0; i < values.length; i++) {
    cumulative += values[i];
    if (target <= cumulative) return i;
  }
  return values.length - 1;
}

export type BarChartOpts = {
  width?: number;
  height?: number;
  gap?: number;
  depth?: number;
};

/** Filled vertical bars, area-weighted so taller bars receive more particles. */
export function barChart(values: number[], n: number, opts: BarChartOpts | undefined, rng: Rng): Pt[] {
  const clean = positiveValues(values);
  const width = opts?.width ?? 0.78;
  const height = opts?.height ?? 0.68;
  const gap = Math.max(0, Math.min(0.8, opts?.gap ?? 0.28));
  const depth = opts?.depth ?? 0.06;
  const max = Math.max(...clean);
  const total = clean.reduce((sum, value) => sum + value, 0);
  const slot = width / clean.length;
  const barWidth = slot * (1 - gap);
  const bottom = 0.36;
  const points: Pt[] = [];

  for (let i = 0; i < n; i++) {
    const target = ((i + rng()) / Math.max(1, n)) * total;
    const index = weightedIndex(clean, target);
    const barHeight = Math.max(0.04, (clean[index] / max) * height);
    points.push({
      x: -width / 2 + (index + 0.5) * slot + (rng() - 0.5) * barWidth,
      y: bottom - rng() * barHeight,
      z: (rng() - 0.5) * depth,
      lvl: 14 + (index % 10),
    });
  }
  return points;
}

export type LineChartOpts = {
  width?: number;
  height?: number;
  thickness?: number;
  depth?: number;
};

/** A particle ribbon following a data polyline, weighted by segment length. */
export function lineChart(values: number[], n: number, opts: LineChartOpts | undefined, rng: Rng): Pt[] {
  const clean = positiveValues(values);
  const width = opts?.width ?? 0.78;
  const height = opts?.height ?? 0.62;
  const thickness = opts?.thickness ?? 0.025;
  const depth = opts?.depth ?? 0.07;
  const max = Math.max(...clean);
  const count = Math.max(2, clean.length);
  const expanded = clean.length === 1 ? [clean[0], clean[0]] : clean;
  const vertices = expanded.map((value, index) => ({
    x: -width / 2 + (index / (count - 1)) * width,
    y: 0.31 - (value / max) * height,
  }));
  const lengths = vertices.slice(0, -1).map((point, index) =>
    Math.hypot(vertices[index + 1].x - point.x, vertices[index + 1].y - point.y));
  const total = lengths.reduce((sum, value) => sum + value, 0) || 1;
  const points: Pt[] = [];

  for (let i = 0; i < n; i++) {
    const segment = weightedIndex(lengths, ((i + rng()) / Math.max(1, n)) * total);
    const a = vertices[segment];
    const b = vertices[segment + 1];
    const t = rng();
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const length = Math.hypot(dx, dy) || 1;
    const jitter = (rng() - 0.5) * thickness;
    points.push({
      x: a.x + dx * t - (dy / length) * jitter,
      y: a.y + dy * t + (dx / length) * jitter,
      z: (rng() - 0.5) * depth,
      lvl: 18 + (segment % 6),
    });
  }
  return points;
}

export type DonutChartOpts = {
  innerRadius?: number;
  outerRadius?: number;
  gapRadians?: number;
  depth?: number;
};

/** Segmented annular chart with shallow z depth for a volumetric data ring. */
export function donutChart(values: number[], n: number, opts: DonutChartOpts | undefined, rng: Rng): Pt[] {
  const clean = positiveValues(values);
  const inner = opts?.innerRadius ?? 0.18;
  const outer = Math.max(inner + 0.02, opts?.outerRadius ?? 0.36);
  const gap = Math.max(0, opts?.gapRadians ?? 0.055);
  const depth = opts?.depth ?? 0.08;
  const total = clean.reduce((sum, value) => sum + value, 0);
  const starts: number[] = [];
  let cursor = -Math.PI / 2;
  for (const value of clean) {
    starts.push(cursor);
    cursor += (value / total) * Math.PI * 2;
  }
  const points: Pt[] = [];

  for (let i = 0; i < n; i++) {
    const index = weightedIndex(clean, ((i + rng()) / Math.max(1, n)) * total);
    const sweep = (clean[index] / total) * Math.PI * 2;
    const usableSweep = Math.max(0.002, sweep - gap);
    const theta = starts[index] + gap / 2 + rng() * usableSweep;
    const radius = Math.sqrt(inner * inner + rng() * (outer * outer - inner * inner));
    points.push({
      x: Math.cos(theta) * radius,
      y: Math.sin(theta) * radius,
      z: (rng() - 0.5) * depth + Math.sin(theta * 2) * depth * 0.16,
      lvl: 13 + (index * 3) % 11,
    });
  }
  return points;
}
