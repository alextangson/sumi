export type Rng = () => number; // [0,1)
export type Pt = { x: number; y: number; lvl: number; z?: number }; // x,y normalized [-0.5,0.5]; lvl int 0..levels-1; z optional depth
export type WeightedPt = { x: number; y: number; weight: number; lvl: number };
export type PixelBuffer = { data: Uint8ClampedArray; width: number; height: number }; // RGBA row-major
export type Rect = { x: number; y: number; w: number; h: number };
export type MotionStyle = 'direct' | 'flow' | 'burst' | 'vortex' | 'wave';
