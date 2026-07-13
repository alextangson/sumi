import type { Field, Particle } from './field';
import type { Palette } from './palette';
import type { Rect } from '../types';
import type { MotionStyle } from '../types';

/** Optional 3D view parameters for perspective rendering. */
export type ViewParams = {
  yaw: number;
  pitch: number;
  /** Focal length in normalized scene units. Default 1.8. */
  focal?: number;
  /** Pivot in normalized space (default 0, formation center). */
  pivotX?: number;
  pivotY?: number;
};

export type ParticleShape = 'square' | 'round' | 'soft';
export type RendererBackend = 'webgl2' | 'unavailable';

export type ParticleRenderer = {
  readonly backend: RendererBackend;
  resize(width: number, height: number): void;
  setField(field: Field): void;
  setMorph(field: Field, from: string, to: string): void;
  render(
    rect: Rect,
    canvasCssWidth: number,
    canvasCssHeight: number,
    view?: ViewParams,
    now?: number,
    shimmerAmp?: number,
    parallaxAmp?: number,
    progress?: number,
    stagger?: number,
    scatter?: number,
    motion?: MotionStyle,
  ): void;
  destroy(): void;
};

const FLOATS_PER_PARTICLE = 9;

/** Pack mutable particle state into one tightly interleaved GPU buffer. */
export function packParticles(particles: Particle[], out?: Float32Array): Float32Array {
  const required = particles.length * FLOATS_PER_PARTICLE;
  const data = out?.length === required ? out : new Float32Array(required);
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    const o = i * FLOATS_PER_PARTICLE;
    data[o] = p.x;
    data[o + 1] = p.y;
    data[o + 2] = p.z;
    data[o + 3] = p.lvl;
    data[o + 4] = p.x;
    data[o + 5] = p.y;
    data[o + 6] = p.z;
    data[o + 7] = p.phase;
    data[o + 8] = p.dep;
  }
  return data;
}

/** Pack named formation endpoints once; the vertex shader animates between them. */
export function packMorphParticles(
  particles: Particle[],
  from: string,
  to: string,
  out?: Float32Array,
): Float32Array {
  const required = particles.length * FLOATS_PER_PARTICLE;
  const data = out?.length === required ? out : new Float32Array(required);
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    const a = p.targets[from];
    const b = p.targets[to];
    if (!a) throw new Error(`sumi: formation "${from}" is not available for GPU morph`);
    if (!b) throw new Error(`sumi: formation "${to}" is not available for GPU morph`);
    const o = i * FLOATS_PER_PARTICLE;
    data[o] = a.x;
    data[o + 1] = a.y;
    data[o + 2] = a.z ?? 0;
    data[o + 3] = b.lvl;
    data[o + 4] = b.x;
    data[o + 5] = b.y;
    data[o + 6] = b.z ?? 0;
    data[o + 7] = p.phase;
    data[o + 8] = p.dep;
  }
  return data;
}

export function particleShapeId(shape: ParticleShape): number {
  return shape === 'square' ? 0 : shape === 'round' ? 1 : 2;
}

export function motionStyleId(motion: MotionStyle): number {
  return motion === 'direct' ? 0
    : motion === 'flow' ? 1
    : motion === 'burst' ? 2
    : motion === 'vortex' ? 3
    : 4;
}

function parseRgb(color: string): [number, number, number] {
  const values = color.match(/[\d.]+/g)?.slice(0, 3).map(Number);
  if (!values || values.length < 3) return [0, 0, 0];
  return [values[0] / 255, values[1] / 255, values[2] / 255];
}

const VERTEX_SHADER = `#version 300 es
precision highp float;
precision highp int;

layout(location = 0) in vec4 a_fromLevel;
layout(location = 1) in vec4 a_toPhase;
layout(location = 2) in float a_depth;

uniform vec2 u_canvas;
uniform vec4 u_rect;
uniform vec2 u_pivot;
uniform float u_dpr;
uniform float u_time;
uniform float u_shimmer;
uniform float u_parallax;
uniform float u_yaw;
uniform float u_pitch;
uniform float u_focal;
uniform float u_levels;
uniform float u_count;
uniform float u_progress;
uniform float u_stagger;
uniform float u_scatter;
uniform int u_hasView;
uniform int u_shape;
uniform int u_isMorph;
uniform int u_motion;

out float v_level;
out float v_phase;

void main() {
  float t = 1.0;
  if (u_isMorph == 1) {
    float start = (float(gl_VertexID) / max(1.0, u_count)) * u_stagger;
    t = u_stagger > 0.0 && u_stagger < 1.0
      ? clamp((u_progress - start) / (1.0 - u_stagger), 0.0, 1.0)
      : u_progress;
  }

  vec3 fromPosition = a_fromLevel.xyz;
  vec3 toPosition = a_toPhase.xyz;
  vec3 position = mix(fromPosition, toPosition, t);

  if (u_isMorph == 1 && u_scatter > 0.0 && u_motion != 0) {
    vec2 delta = toPosition.xy - fromPosition.xy;
    float distance = max(0.0001, length(delta));
    float bendSign = sin(a_toPhase.w * 1.73) >= 0.0 ? 1.0 : -1.0;
    float envelope = sin(t * 3.14159265) * u_scatter * (0.45 + a_depth * 0.55);
    vec2 phaseDirection = vec2(cos(a_toPhase.w), sin(a_toPhase.w));

    if (u_motion == 1) {
      float eddy = sin(t * 6.2831853 + a_toPhase.w) * 0.22;
      vec2 perpendicular = vec2(-delta.y, delta.x) / distance;
      position.xy += (perpendicular * bendSign + phaseDirection * eddy) * envelope;
    } else if (u_motion == 2) {
      vec2 radial = normalize(position.xy + phaseDirection * 0.04);
      position.xy += radial * envelope * 2.2;
    } else if (u_motion == 3) {
      float angle = envelope * 11.0 * bendSign;
      float ca = cos(angle);
      float sa = sin(angle);
      position.xy = mat2(ca, -sa, sa, ca) * position.xy;
      position.xy += phaseDirection * envelope * 0.3;
    } else {
      vec2 wave = vec2(
        sin(position.y * 18.0 + a_toPhase.w + t * 6.2831853),
        cos(position.x * 18.0 - a_toPhase.w + t * 3.14159265)
      );
      position.xy += wave * envelope * 0.85;
    }
  }

  float x = position.x;
  float y = position.y;
  float z = position.z;
  float scale = 1.0;
  float cameraZ = 0.0;

  if (u_hasView == 1) {
    float cy = cos(u_yaw);
    float sy = sin(u_yaw);
    float cp = cos(u_pitch);
    float sp = sin(u_pitch);
    float ex = x - u_pivot.x;
    float ey = y - u_pivot.y;
    float x1 = ex * cy + z * sy;
    float z1 = -ex * sy + z * cy;
    float yr = ey * cp - z1 * sp;
    cameraZ = ey * sp + z1 * cp;
    float perspective = u_focal / max(0.25, u_focal + cameraZ);
    scale = clamp(perspective, 0.72, 1.45);
    x = u_pivot.x + x1 * perspective;
    y = u_pivot.y + yr * perspective;
  }

  float fieldSize = min(u_rect.z, u_rect.w);
  vec2 pixel = vec2(
    u_rect.x + u_rect.z * 0.5 + x * fieldSize,
    u_rect.y + u_rect.w * 0.5 + y * fieldSize
  );

  if (u_hasView == 1 && u_parallax > 0.0) {
    pixel += vec2(u_yaw, u_pitch) * u_parallax * a_depth;
  }
  if (u_shimmer > 0.0) {
    pixel.x += sin(u_time * 0.0011 + a_toPhase.w) * u_shimmer;
    pixel.y += cos(u_time * 0.0013 + a_toPhase.w) * u_shimmer;
  }

  vec2 clip = vec2(
    pixel.x / u_canvas.x * 2.0 - 1.0,
    1.0 - pixel.y / u_canvas.y * 2.0
  );
  float clipDepth = u_hasView == 1 ? clamp(cameraZ * 0.7, -0.9, 0.9) : 0.0;
  gl_Position = vec4(clip, clipDepth, 1.0);

  float level = clamp(a_fromLevel.w / max(1.0, u_levels - 1.0), 0.0, 1.0);
  float depthShade = u_hasView == 1 ? (scale - 1.0) * 0.7 : 0.0;
  v_level = clamp(level + depthShade, 0.0, 1.0);
  v_phase = a_toPhase.w;

  float baseSize = 1.3 + 1.9 * level * level;
  float organicSize = u_shape == 2
    ? 1.12 + 0.16 * (0.5 + 0.5 * sin(a_toPhase.w * 2.17))
    : 1.0;
  gl_PointSize = max(1.0, baseSize * organicSize * scale * u_dpr);
}
`;

const FRAGMENT_SHADER = `#version 300 es
precision highp float;
precision highp int;

uniform vec3 u_paper;
uniform vec3 u_ink;
uniform int u_shape;

in float v_level;
in float v_phase;
out vec4 outColor;

void main() {
  vec2 point = gl_PointCoord * 2.0 - 1.0;
  float radius = length(point);
  float alpha = 1.0;

  if (u_shape == 1) {
    alpha = 1.0 - smoothstep(0.82, 1.0, radius);
  } else if (u_shape == 2) {
    float angle = atan(point.y, point.x);
    float edge = 0.82
      + 0.08 * sin(angle * 3.0 + v_phase)
      + 0.04 * sin(angle * 7.0 + v_phase * 1.7);
    alpha = 1.0 - smoothstep(0.42, edge, radius);
    alpha *= 0.78 + 0.22 * (0.5 + 0.5 * sin(v_phase * 0.91));
  }

  if (alpha <= 0.01) discard;
  vec3 color = mix(u_paper, u_ink, v_level);
  outColor = vec4(color, alpha);
}
`;

function compileShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string,
): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('sumi: unable to create WebGL2 shader');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) ?? 'unknown shader error';
    gl.deleteShader(shader);
    throw new Error(`sumi: WebGL2 shader compile failed: ${message}`);
  }
  return shader;
}

function createProgram(gl: WebGL2RenderingContext): WebGLProgram {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
  const program = gl.createProgram();
  if (!program) throw new Error('sumi: unable to create WebGL2 program');
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(program) ?? 'unknown link error';
    gl.deleteProgram(program);
    throw new Error(`sumi: WebGL2 program link failed: ${message}`);
  }
  return program;
}

function uniform(gl: WebGL2RenderingContext, program: WebGLProgram, name: string): WebGLUniformLocation {
  const location = gl.getUniformLocation(program, name);
  if (location === null) throw new Error(`sumi: WebGL2 uniform ${name} is unavailable`);
  return location;
}

function unavailableRenderer(): ParticleRenderer {
  return {
    backend: 'unavailable',
    resize() {},
    setField() {},
    setMorph() {},
    render() {},
    destroy() {},
  };
}

export function createParticleRenderer(
  canvas: HTMLCanvasElement,
  palette: Palette,
  shape: ParticleShape,
  dpr: number,
): ParticleRenderer {
  if (typeof WebGL2RenderingContext === 'undefined') return unavailableRenderer();
  const context = canvas.getContext('webgl2', {
    alpha: true,
    antialias: false,
    depth: true,
    premultipliedAlpha: true,
    powerPreference: 'high-performance',
  });
  if (!context) return unavailableRenderer();
  const gl: WebGL2RenderingContext = context;

  const program = createProgram(gl);
  const vao = gl.createVertexArray();
  const buffer = gl.createBuffer();
  if (!vao || !buffer) throw new Error('sumi: unable to allocate WebGL2 particle buffers');

  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 4, gl.FLOAT, false, FLOATS_PER_PARTICLE * 4, 0);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 4, gl.FLOAT, false, FLOATS_PER_PARTICLE * 4, 4 * 4);
  gl.enableVertexAttribArray(2);
  gl.vertexAttribPointer(2, 1, gl.FLOAT, false, FLOATS_PER_PARTICLE * 4, 8 * 4);
  gl.bindVertexArray(null);

  const uniforms = {
    canvas: uniform(gl, program, 'u_canvas'),
    rect: uniform(gl, program, 'u_rect'),
    pivot: uniform(gl, program, 'u_pivot'),
    dpr: uniform(gl, program, 'u_dpr'),
    time: uniform(gl, program, 'u_time'),
    shimmer: uniform(gl, program, 'u_shimmer'),
    parallax: uniform(gl, program, 'u_parallax'),
    yaw: uniform(gl, program, 'u_yaw'),
    pitch: uniform(gl, program, 'u_pitch'),
    focal: uniform(gl, program, 'u_focal'),
    levels: uniform(gl, program, 'u_levels'),
    count: uniform(gl, program, 'u_count'),
    progress: uniform(gl, program, 'u_progress'),
    stagger: uniform(gl, program, 'u_stagger'),
    scatter: uniform(gl, program, 'u_scatter'),
    hasView: uniform(gl, program, 'u_hasView'),
    shape: uniform(gl, program, 'u_shape'),
    isMorph: uniform(gl, program, 'u_isMorph'),
    motion: uniform(gl, program, 'u_motion'),
    paper: uniform(gl, program, 'u_paper'),
    ink: uniform(gl, program, 'u_ink'),
  };

  const paper = parseRgb(palette.colors[0] ?? 'rgb(244,243,238)');
  const ink = parseRgb(palette.colors[palette.levels - 1] ?? 'rgb(17,19,24)');
  let packed: Float32Array | undefined;
  let allocatedBytes = 0;
  let particleCount = 0;
  let morphMode = false;
  let destroyed = false;

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);
  gl.clearColor(0, 0, 0, 0);

  function upload(data: Float32Array): void {
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    if (allocatedBytes !== data.byteLength) {
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
      allocatedBytes = data.byteLength;
    } else {
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, data);
    }
    particleCount = data.length / FLOATS_PER_PARTICLE;
  }

  return {
    backend: 'webgl2',
    resize(width: number, height: number): void {
      if (destroyed) return;
      gl.viewport(0, 0, width, height);
    },
    setField(field: Field): void {
      if (destroyed) return;
      packed = packParticles(field.particles, packed);
      upload(packed);
      morphMode = false;
    },
    setMorph(field: Field, from: string, to: string): void {
      if (destroyed) return;
      packed = packMorphParticles(field.particles, from, to, packed);
      upload(packed);
      morphMode = true;
    },
    render(
      rect: Rect,
      canvasCssWidth: number,
      canvasCssHeight: number,
      view?: ViewParams,
      now = 0,
      shimmerAmp = 0,
      parallaxAmp = 0,
      progress = 1,
      stagger = 0,
      scatter = 0,
      motion: MotionStyle = 'flow',
    ): void {
      if (destroyed || canvasCssWidth <= 0 || canvasCssHeight <= 0) return;

      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.useProgram(program);
      gl.bindVertexArray(vao);
      gl.uniform2f(uniforms.canvas, canvasCssWidth, canvasCssHeight);
      gl.uniform4f(uniforms.rect, rect.x, rect.y, rect.w, rect.h);
      gl.uniform2f(uniforms.pivot, view?.pivotX ?? 0, view?.pivotY ?? 0);
      gl.uniform1f(uniforms.dpr, dpr);
      gl.uniform1f(uniforms.time, now);
      gl.uniform1f(uniforms.shimmer, shimmerAmp);
      gl.uniform1f(uniforms.parallax, parallaxAmp);
      gl.uniform1f(uniforms.yaw, view?.yaw ?? 0);
      gl.uniform1f(uniforms.pitch, view?.pitch ?? 0);
      gl.uniform1f(uniforms.focal, view?.focal ?? 1.8);
      gl.uniform1f(uniforms.levels, palette.levels);
      gl.uniform1f(uniforms.count, particleCount);
      gl.uniform1f(uniforms.progress, progress);
      gl.uniform1f(uniforms.stagger, stagger);
      gl.uniform1f(uniforms.scatter, scatter);
      gl.uniform1i(uniforms.hasView, view ? 1 : 0);
      gl.uniform1i(uniforms.shape, particleShapeId(shape));
      gl.uniform1i(uniforms.isMorph, morphMode ? 1 : 0);
      gl.uniform1i(uniforms.motion, motionStyleId(motion));
      gl.uniform3f(uniforms.paper, paper[0], paper[1], paper[2]);
      gl.uniform3f(uniforms.ink, ink[0], ink[1], ink[2]);
      gl.drawArrays(gl.POINTS, 0, particleCount);
      gl.bindVertexArray(null);
    },
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      gl.deleteBuffer(buffer);
      gl.deleteVertexArray(vao);
      gl.deleteProgram(program);
    },
  };
}
