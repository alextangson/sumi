export type Palette = { colors: string[]; sizes: number[]; levels: number };

export function createPalette(
  bg: [number, number, number],
  ink: [number, number, number],
  levels: number,
): Palette {
  const colors: string[] = [];
  const sizes: number[] = [];
  for (let i = 0; i < levels; i++) {
    const k = levels === 1 ? 0 : i / (levels - 1);
    const r = Math.round(bg[0] + (ink[0] - bg[0]) * k);
    const g = Math.round(bg[1] + (ink[1] - bg[1]) * k);
    const b = Math.round(bg[2] + (ink[2] - bg[2]) * k);
    colors.push(`rgb(${r}, ${g}, ${b})`);
    sizes.push(1.3 + 1.9 * k * k);
  }
  return { colors, sizes, levels };
}

export function levelOf(k: number, levels: number): number {
  const clamped = k < 0 ? 0 : k > 1 ? 1 : k;
  return Math.round(clamped * (levels - 1));
}
