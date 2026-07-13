"use strict";
var Sumi = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/index.ts
  var index_exports = {};
  __export(index_exports, {
    autoInit: () => autoInit,
    barChart: () => barChart,
    column: () => column,
    coverReveal: () => coverReveal,
    createRng: () => createRng,
    donutChart: () => donutChart,
    doubleHelix: () => doubleHelix,
    easedProgress: () => easedProgress,
    fromImage: () => fromImage,
    fromImageData: () => fromImageData,
    fromPoints3d: () => fromPoints3d,
    fromSVGPath: () => fromSVGPath,
    fromShape: () => fromShape,
    fromText: () => fromText,
    imageReveal: () => imageReveal,
    lineChart: () => lineChart,
    parseInkAttributes: () => parseInkAttributes,
    parseStatValue: () => parseStatValue,
    recommendedParticleCount: () => recommendedParticleCount,
    sceneMorph: () => sceneMorph,
    sequenceMorph: () => sequenceMorph,
    statReveal: () => statReveal,
    textReveal: () => textReveal
  });

  // src/engine/rng.ts
  function createRng(seed) {
    let state = seed | 0;
    return function next() {
      state = state + 1831565813 | 0;
      let t = state;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  // src/engine/palette.ts
  function createPalette(bg, ink, levels) {
    const colors = [];
    const sizes = [];
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
  function levelOf(k, levels) {
    const clamped = k < 0 ? 0 : k > 1 ? 1 : k;
    return Math.round(clamped * (levels - 1));
  }

  // src/engine/sample.ts
  function containRect(srcW, srcH, boxW, boxH) {
    const scale = Math.min(boxW / srcW, boxH / srcH);
    const w = srcW * scale;
    const h = srcH * scale;
    const x = (boxW - w) / 2;
    const y = (boxH - h) / 2;
    return { x, y, w, h };
  }
  function samplePixelBuffer(buf, opts) {
    const { data, width, height } = buf;
    const step = opts.step ?? 2;
    const minInk = opts.minInk ?? 0.08;
    const gamma = opts.gamma ?? 1;
    const out = [];
    for (let py = 0; py < height; py += step) {
      for (let px = 0; px < width; px += step) {
        const i = (py * width + px) * 4;
        const luma = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255;
        const darkness = 1 - luma;
        if (darkness <= minInk) continue;
        const weight = Math.pow((darkness - minInk) / (1 - minInk), gamma);
        out.push({
          x: px / width - 0.5,
          y: py / height - 0.5,
          weight,
          lvl: levelOf(darkness, opts.levels)
        });
      }
    }
    return out;
  }

  // src/engine/resample.ts
  function mortonKey(p) {
    const qx = Math.max(0, Math.min(1023, Math.round((p.x + 0.5) * 1023)));
    const qy = Math.max(0, Math.min(1023, Math.round((p.y + 0.5) * 1023)));
    let key = 0;
    for (let bit = 0; bit < 10; bit++) {
      key |= (qx >> bit & 1) << bit * 2;
      key |= (qy >> bit & 1) << bit * 2 + 1;
    }
    return key;
  }
  function matchFormation(source, target) {
    if (source.length !== target.length) {
      throw new Error(`matchFormation: expected equal lengths, got ${source.length} and ${target.length}`);
    }
    const sourceOrder = source.map((_, index) => index).sort((a, b) => mortonKey(source[a]) - mortonKey(source[b]));
    const targetOrder = target.slice().sort((a, b) => mortonKey(a) - mortonKey(b));
    const matched = new Array(target.length);
    for (let rank = 0; rank < sourceOrder.length; rank++) {
      matched[sourceOrder[rank]] = targetOrder[rank];
    }
    return matched;
  }
  function resampleToN(weighted, n, rng) {
    const out = [];
    if (weighted.length === 0) {
      for (let i = 0; i < n; i++) {
        out.push({ x: 0, y: 0, lvl: 0 });
      }
      return out;
    }
    const cum = new Array(weighted.length);
    let total = 0;
    for (let i = 0; i < weighted.length; i++) {
      total += weighted[i].weight;
      cum[i] = total;
    }
    const grain = 0.5 / Math.sqrt(n);
    for (let i = 0; i < n; i++) {
      const target = (i + rng()) / n * total;
      let lo = 0;
      let hi = weighted.length - 1;
      while (lo < hi) {
        const mid = lo + hi >> 1;
        if (cum[mid] < target) lo = mid + 1;
        else hi = mid;
      }
      const src = weighted[lo];
      const jx = (rng() - 0.5) * 2 * grain;
      const jy = (rng() - 0.5) * 2 * grain;
      const x = Math.min(0.5, Math.max(-0.5, src.x + jx));
      const y = Math.min(0.5, Math.max(-0.5, src.y + jy));
      out.push({ x, y, lvl: src.lvl });
    }
    return out;
  }

  // src/engine/formations.ts
  function fromImageData(buf, n, opts, rng) {
    return resampleToN(samplePixelBuffer(buf, opts), n, rng);
  }
  function canvasToPixelBuffer(canvas, ctx) {
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return { data: img.data, width: img.width, height: img.height };
  }
  function fromText(text, n, opts, rng) {
    const size = 1024;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#f4f3ee";
    ctx.fillRect(0, 0, size, size);
    ctx.font = opts.font;
    const metrics = ctx.measureText(text);
    const textW = metrics.width;
    const textH = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
    const maxDimension = Math.max(textW, textH);
    const fit = Math.max(0.02, Math.min(0.98, opts.fit ?? 0.8));
    const scale = maxDimension > 0 ? size * fit / maxDimension : 1;
    const offsetX = (opts.offsetX ?? 0) * size;
    const offsetY = (opts.offsetY ?? 0) * size;
    ctx.fillStyle = "#000";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.save();
    ctx.translate(size / 2 + offsetX, size / 2 + offsetY);
    ctx.scale(scale, scale);
    ctx.fillText(text, 0, 0);
    ctx.restore();
    const buf = canvasToPixelBuffer(canvas, ctx);
    const sampleOpts = { levels: opts.levels };
    return fromImageData(buf, n, sampleOpts, rng);
  }
  function fromImage(img, n, opts, rng) {
    const size = 1024;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return [];
    ctx.fillStyle = "#f4f3ee";
    ctx.fillRect(0, 0, size, size);
    const srcW = img.naturalWidth ?? img.videoWidth ?? img.width ?? size;
    const srcH = img.naturalHeight ?? img.videoHeight ?? img.height ?? size;
    const fit = containRect(srcW || size, srcH || size, size, size);
    ctx.drawImage(img, fit.x, fit.y, fit.w, fit.h);
    const buf = canvasToPixelBuffer(canvas, ctx);
    return fromImageData(buf, n, opts, rng);
  }
  function fromShape(draw, n, opts, rng) {
    const size = 1024;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return [];
    ctx.fillStyle = "#f4f3ee";
    ctx.fillRect(0, 0, size, size);
    draw(ctx, size);
    const buf = canvasToPixelBuffer(canvas, ctx);
    return fromImageData(buf, n, opts, rng);
  }
  function fromSVGPath(pathData, n, opts, rng) {
    const size = 1024;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return [];
    ctx.fillStyle = "#f4f3ee";
    ctx.fillRect(0, 0, size, size);
    const path = new Path2D(pathData);
    if (opts.viewBox) {
      const [minX, minY, vbW, vbH] = opts.viewBox;
      const fit = containRect(vbW, vbH, size, size);
      ctx.save();
      ctx.translate(fit.x - minX * (fit.w / vbW), fit.y - minY * (fit.h / vbH));
      ctx.scale(fit.w / vbW, fit.h / vbH);
    }
    ctx.fillStyle = "#11131A";
    ctx.fill(path);
    if (opts.viewBox) ctx.restore();
    const { viewBox: _vb, ...sampleOpts } = opts;
    const buf = canvasToPixelBuffer(canvas, ctx);
    return fromImageData(buf, n, sampleOpts, rng);
  }

  // src/engine/choreography.ts
  var easeInOut = (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  function phaseProgress(t, phases) {
    const clamped = Math.max(0, Math.min(1, t));
    let prevUntil = 0;
    for (const phase of phases) {
      if (clamped <= phase.until || phase.until >= 1) {
        const span = phase.until - prevUntil;
        const local = span <= 0 ? 1 : (clamped - prevUntil) / span;
        const ease = phase.ease ?? easeInOut;
        const eased = ease(Math.max(0, Math.min(1, local)));
        return prevUntil + eased * (phase.until - prevUntil);
      }
      prevUntil = phase.until;
    }
    return 1;
  }
  function clamp01(t) {
    return t < 0 ? 0 : t > 1 ? 1 : t;
  }
  function easedProgress(rawT, phases, ease) {
    if (phases && phases.length > 0) return phaseProgress(rawT, phases);
    if (ease) return ease(clamp01(rawT));
    return easeInOut(clamp01(rawT));
  }
  function particleT(globalT, stagger, i, n) {
    if (stagger <= 0 || stagger >= 1) return globalT;
    const start = i / n * stagger;
    const local = (globalT - start) / (1 - stagger);
    return Math.max(0, Math.min(1, local));
  }

  // src/engine/field.ts
  function createField(n, rng) {
    const particles = Array.from({ length: n }, () => ({
      targets: {},
      x: 0,
      y: 0,
      z: 0,
      phase: rng() * 2 * Math.PI,
      dep: 0.3 + rng() * 0.7,
      lvl: 0
    }));
    return {
      particles,
      n,
      setFormation(name, pts) {
        if (pts.length !== n) {
          throw new Error(
            `setFormation("${name}"): expected ${n} points, got ${pts.length}`
          );
        }
        for (let i = 0; i < n; i++) {
          particles[i].targets[name] = pts[i];
        }
      },
      step(opts) {
        const { from, to, m, stagger = 0, scatter = 0, motion = "flow" } = opts;
        if (n > 0) {
          const probe = particles[0].targets;
          if (!probe[from]) throw new Error(`step: formation "${from}" not set`);
          if (!probe[to]) throw new Error(`step: formation "${to}" not set`);
        }
        for (let i = 0; i < n; i++) {
          const p = particles[i];
          const a = p.targets[from];
          const b = p.targets[to];
          const t = particleT(m, stagger, i, n);
          p.x = a.x + (b.x - a.x) * t;
          p.y = a.y + (b.y - a.y) * t;
          p.z = (a.z ?? 0) + ((b.z ?? 0) - (a.z ?? 0)) * t;
          if (scatter > 0 && motion !== "direct") {
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const distance = Math.hypot(dx, dy) || 1;
            const bendSign = Math.sin(p.phase * 1.73) >= 0 ? 1 : -1;
            const envelope = Math.sin(t * Math.PI) * scatter * (0.45 + p.dep * 0.55);
            const phaseX = Math.cos(p.phase);
            const phaseY = Math.sin(p.phase);
            if (motion === "flow") {
              const eddy = Math.sin(t * Math.PI * 2 + p.phase) * 0.22;
              p.x += (-dy / distance * bendSign + phaseX * eddy) * envelope;
              p.y += (dx / distance * bendSign + phaseY * eddy) * envelope;
            } else if (motion === "burst") {
              const rx = p.x + phaseX * 0.04;
              const ry = p.y + phaseY * 0.04;
              const radialLength = Math.hypot(rx, ry) || 1;
              p.x += rx / radialLength * envelope * 2.2;
              p.y += ry / radialLength * envelope * 2.2;
            } else if (motion === "vortex") {
              const angle = envelope * 11 * bendSign;
              const cos = Math.cos(angle);
              const sin = Math.sin(angle);
              const px = p.x;
              const py = p.y;
              p.x = px * cos - py * sin + phaseX * envelope * 0.3;
              p.y = px * sin + py * cos + phaseY * envelope * 0.3;
            } else {
              const px = p.x;
              const py = p.y;
              p.x += Math.sin(py * 18 + p.phase + t * Math.PI * 2) * envelope * 0.85;
              p.y += Math.cos(px * 18 - p.phase + t * Math.PI) * envelope * 0.85;
            }
          }
          p.lvl = b.lvl;
        }
      }
    };
  }

  // src/engine/renderer.ts
  var FLOATS_PER_PARTICLE = 9;
  function packParticles(particles, out) {
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
  function packMorphParticles(particles, from, to, out) {
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
  function particleShapeId(shape) {
    return shape === "square" ? 0 : shape === "round" ? 1 : 2;
  }
  function motionStyleId(motion) {
    return motion === "direct" ? 0 : motion === "flow" ? 1 : motion === "burst" ? 2 : motion === "vortex" ? 3 : 4;
  }
  function parseRgb(color) {
    const values = color.match(/[\d.]+/g)?.slice(0, 3).map(Number);
    if (!values || values.length < 3) return [0, 0, 0];
    return [values[0] / 255, values[1] / 255, values[2] / 255];
  }
  var VERTEX_SHADER = `#version 300 es
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
  var FRAGMENT_SHADER = `#version 300 es
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
  function compileShader(gl, type, source) {
    const shader = gl.createShader(type);
    if (!shader) throw new Error("sumi: unable to create WebGL2 shader");
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const message = gl.getShaderInfoLog(shader) ?? "unknown shader error";
      gl.deleteShader(shader);
      throw new Error(`sumi: WebGL2 shader compile failed: ${message}`);
    }
    return shader;
  }
  function createProgram(gl) {
    const vertex = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fragment = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    const program = gl.createProgram();
    if (!program) throw new Error("sumi: unable to create WebGL2 program");
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const message = gl.getProgramInfoLog(program) ?? "unknown link error";
      gl.deleteProgram(program);
      throw new Error(`sumi: WebGL2 program link failed: ${message}`);
    }
    return program;
  }
  function uniform(gl, program, name) {
    const location = gl.getUniformLocation(program, name);
    if (location === null) throw new Error(`sumi: WebGL2 uniform ${name} is unavailable`);
    return location;
  }
  function unavailableRenderer() {
    return {
      backend: "unavailable",
      resize() {
      },
      setField() {
      },
      setMorph() {
      },
      render() {
      },
      destroy() {
      }
    };
  }
  function createParticleRenderer(canvas, palette, shape, dpr) {
    if (typeof WebGL2RenderingContext === "undefined") return unavailableRenderer();
    const context = canvas.getContext("webgl2", {
      alpha: true,
      antialias: false,
      depth: true,
      premultipliedAlpha: true,
      powerPreference: "high-performance"
    });
    if (!context) return unavailableRenderer();
    const gl = context;
    const program = createProgram(gl);
    const vao = gl.createVertexArray();
    const buffer = gl.createBuffer();
    if (!vao || !buffer) throw new Error("sumi: unable to allocate WebGL2 particle buffers");
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
      canvas: uniform(gl, program, "u_canvas"),
      rect: uniform(gl, program, "u_rect"),
      pivot: uniform(gl, program, "u_pivot"),
      dpr: uniform(gl, program, "u_dpr"),
      time: uniform(gl, program, "u_time"),
      shimmer: uniform(gl, program, "u_shimmer"),
      parallax: uniform(gl, program, "u_parallax"),
      yaw: uniform(gl, program, "u_yaw"),
      pitch: uniform(gl, program, "u_pitch"),
      focal: uniform(gl, program, "u_focal"),
      levels: uniform(gl, program, "u_levels"),
      count: uniform(gl, program, "u_count"),
      progress: uniform(gl, program, "u_progress"),
      stagger: uniform(gl, program, "u_stagger"),
      scatter: uniform(gl, program, "u_scatter"),
      hasView: uniform(gl, program, "u_hasView"),
      shape: uniform(gl, program, "u_shape"),
      isMorph: uniform(gl, program, "u_isMorph"),
      motion: uniform(gl, program, "u_motion"),
      paper: uniform(gl, program, "u_paper"),
      ink: uniform(gl, program, "u_ink")
    };
    const paper = parseRgb(palette.colors[0] ?? "rgb(244,243,238)");
    const ink = parseRgb(palette.colors[palette.levels - 1] ?? "rgb(17,19,24)");
    let packed;
    let allocatedBytes = 0;
    let particleCount = 0;
    let morphMode = false;
    let destroyed = false;
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.clearColor(0, 0, 0, 0);
    function upload(data) {
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
      backend: "webgl2",
      resize(width, height) {
        if (destroyed) return;
        gl.viewport(0, 0, width, height);
      },
      setField(field) {
        if (destroyed) return;
        packed = packParticles(field.particles, packed);
        upload(packed);
        morphMode = false;
      },
      setMorph(field, from, to) {
        if (destroyed) return;
        packed = packMorphParticles(field.particles, from, to, packed);
        upload(packed);
        morphMode = true;
      },
      render(rect, canvasCssWidth, canvasCssHeight, view, now2 = 0, shimmerAmp = 0, parallaxAmp = 0, progress = 1, stagger = 0, scatter = 0, motion = "flow") {
        if (destroyed || canvasCssWidth <= 0 || canvasCssHeight <= 0) return;
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.useProgram(program);
        gl.bindVertexArray(vao);
        gl.uniform2f(uniforms.canvas, canvasCssWidth, canvasCssHeight);
        gl.uniform4f(uniforms.rect, rect.x, rect.y, rect.w, rect.h);
        gl.uniform2f(uniforms.pivot, view?.pivotX ?? 0, view?.pivotY ?? 0);
        gl.uniform1f(uniforms.dpr, dpr);
        gl.uniform1f(uniforms.time, now2);
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
      destroy() {
        if (destroyed) return;
        destroyed = true;
        gl.deleteBuffer(buffer);
        gl.deleteVertexArray(vao);
        gl.deleteProgram(program);
      }
    };
  }

  // src/stage/ink-stage.ts
  function defaultEnv() {
    const reducedMotion = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    const mobile = typeof innerWidth === "number" && innerWidth < 760;
    return { reducedMotion, mobile, printing: false };
  }
  function createInkStage(canvas, field, palette, opts) {
    const mode = opts?.mode ?? "auto";
    const env = opts?.env ?? defaultEnv();
    const shape = opts?.shape ?? "soft";
    const idleEnabled = opts?.idle !== false;
    const tiltInput = opts?.tilt;
    const tiltEnabled = tiltInput !== false && tiltInput?.depth !== false;
    const tiltOpts = {
      depth: true,
      maxYaw: tiltInput?.maxYaw ?? 0.42,
      maxPitch: tiltInput?.maxPitch ?? 0.16,
      smoothing: tiltInput?.smoothing ?? 0.06,
      staticYaw: tiltInput?.staticYaw ?? 0.12,
      staticPitch: tiltInput?.staticPitch ?? 0.06
    };
    const SHIMMER = 0.8, PARALLAX = 60, SCATTER = 0.075;
    let rafId = 0;
    let isInViewport = true;
    let isPaused = false;
    let suspendMorph;
    let resumeMorph;
    let suppressIdleOnce = false;
    const dpr = Math.min(typeof devicePixelRatio === "number" && devicePixelRatio || 1, 2);
    const renderer = createParticleRenderer(canvas, palette, shape, dpr);
    canvas.dataset.sumiRenderer = renderer.backend;
    renderer.setField(field);
    let activeMorph;
    let currentYaw = 0;
    let currentPitch = 0;
    let targetYaw = 0;
    let targetPitch = 0;
    let driftYaw = 0;
    function resize() {
      const cw = canvas.clientWidth || (typeof innerWidth === "number" ? innerWidth : 300);
      const ch = canvas.clientHeight || (typeof innerHeight === "number" ? innerHeight : 150);
      const bw = Math.round(cw * dpr);
      const bh = Math.round(ch * dpr);
      if (canvas.width !== bw || canvas.height !== bh) {
        canvas.width = bw;
        canvas.height = bh;
      }
      renderer.resize(bw, bh);
    }
    function onResize() {
      resize();
      snapshotFor(fullRect());
    }
    resize();
    if (typeof window !== "undefined") {
      window.addEventListener("resize", onResize);
    }
    function onMouseMove(e) {
      if (!tiltEnabled) return;
      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const nx = (e.clientX - rect.left) / rect.width;
      const ny = (e.clientY - rect.top) / rect.height;
      targetYaw = (nx - 0.5) * tiltOpts.maxYaw * 2;
      targetPitch = (ny - 0.5) * tiltOpts.maxPitch * 2;
    }
    if (tiltEnabled && typeof window !== "undefined") {
      window.addEventListener("mousemove", onMouseMove);
    }
    function isStatic() {
      return mode === "static" || mode !== "animate" && (env.reducedMotion || env.mobile || env.printing);
    }
    function currentView(overrideYaw, overridePitch) {
      if (!tiltEnabled) return void 0;
      return {
        yaw: overrideYaw ?? currentYaw,
        pitch: overridePitch ?? currentPitch,
        focal: 1.8
      };
    }
    function snapshotFor(rect) {
      if (activeMorph) renderer.setMorph(field, activeMorph.from, activeMorph.to);
      else renderer.setField(field);
      const stat = isStatic();
      const view = tiltEnabled ? currentView(tiltOpts.staticYaw, tiltOpts.staticPitch) : void 0;
      const now2 = typeof performance !== "undefined" ? performance.now() : 0;
      renderer.render(
        rect,
        cssWidth(),
        cssHeight(),
        view,
        now2,
        stat ? 0 : SHIMMER,
        tiltEnabled && !stat ? PARALLAX : 0,
        activeMorph?.m ?? 1,
        activeMorph?.stagger ?? 0,
        activeMorph ? SCATTER : 0,
        activeMorph?.motion ?? "direct"
      );
      if (!stat && !rafId) startIdleLoop();
    }
    function cssWidth() {
      return canvas.clientWidth || canvas.width / dpr;
    }
    function cssHeight() {
      return canvas.clientHeight || canvas.height / dpr;
    }
    function fullRect() {
      return {
        x: 0,
        y: 0,
        w: cssWidth(),
        h: cssHeight()
      };
    }
    let idleRafId = 0;
    function idleTick(time) {
      if (document.hidden) {
        idleRafId = 0;
        return;
      }
      if (tiltEnabled) {
        driftYaw += 4e-3;
        const drift = 0.05 * Math.sin(driftYaw);
        currentYaw += (targetYaw + drift - currentYaw) * tiltOpts.smoothing;
        currentPitch += (targetPitch - currentPitch) * tiltOpts.smoothing;
      }
      renderer.render(fullRect(), cssWidth(), cssHeight(), currentView(), time, SHIMMER, tiltEnabled ? PARALLAX : 0);
      idleRafId = requestAnimationFrame(idleTick);
    }
    function startIdleLoop() {
      if (!idleEnabled || isStatic()) return;
      if (isPaused) return;
      if (!isInViewport) return;
      if (idleRafId) return;
      if (!document.hidden) {
        idleRafId = requestAnimationFrame(idleTick);
      }
    }
    function stopIdleLoop() {
      if (idleRafId) {
        cancelAnimationFrame(idleRafId);
        idleRafId = 0;
      }
    }
    function onVisibilityChange() {
      if (!document.hidden && rafId === 0) startIdleLoop();
    }
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisibilityChange);
    }
    const intersectionObserver = typeof IntersectionObserver === "function" ? new IntersectionObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      isInViewport = entry.isIntersecting;
      if (isInViewport) {
        if (rafId === 0) startIdleLoop();
      } else {
        stopIdleLoop();
      }
    }, { rootMargin: "120px" }) : void 0;
    intersectionObserver?.observe(canvas);
    function morph(from, to, opts2) {
      const durationMs = opts2?.durationMs ?? 1600;
      const stagger = opts2?.stagger ?? 0;
      const motion = opts2?.motion ?? "flow";
      const suppressIdle = suppressIdleOnce;
      suppressIdleOnce = false;
      renderer.setMorph(field, from, to);
      activeMorph = { from, to, m: 0, stagger, motion };
      isPaused = false;
      suspendMorph = void 0;
      resumeMorph = void 0;
      if (isStatic()) {
        field.step({ from, to, m: 1, stagger, motion });
        renderer.setField(field);
        activeMorph = void 0;
        const view = tiltEnabled ? currentView(tiltOpts.staticYaw, tiltOpts.staticPitch) : void 0;
        renderer.render(fullRect(), cssWidth(), cssHeight(), view);
        suspendMorph = void 0;
        resumeMorph = void 0;
        opts2?.onSettle?.();
        return;
      }
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
      stopIdleLoop();
      let start = -1;
      let pausedAt = -1;
      function tick(time) {
        if (start < 0) start = time;
        const rawM = easedProgress((time - start) / durationMs, opts2?.phases, opts2?.ease);
        const m = time - start >= durationMs ? 1 : rawM;
        if (activeMorph) activeMorph.m = m;
        if (tiltEnabled) {
          driftYaw += 4e-3;
          const drift = 0.05 * Math.sin(driftYaw);
          currentYaw += (targetYaw + drift - currentYaw) * tiltOpts.smoothing;
          currentPitch += (targetPitch - currentPitch) * tiltOpts.smoothing;
        }
        renderer.render(
          fullRect(),
          cssWidth(),
          cssHeight(),
          currentView(),
          time,
          SHIMMER,
          tiltEnabled ? PARALLAX : 0,
          m,
          stagger,
          SCATTER,
          motion
        );
        if (m >= 1) {
          field.step({ from, to, m: 1, stagger, motion });
          renderer.setField(field);
          activeMorph = void 0;
          rafId = 0;
          suspendMorph = void 0;
          resumeMorph = void 0;
          opts2?.onSettle?.();
          if (!suppressIdle) startIdleLoop();
        } else {
          rafId = requestAnimationFrame(tick);
        }
      }
      suspendMorph = () => {
        pausedAt = typeof performance !== "undefined" ? performance.now() : 0;
      };
      resumeMorph = () => {
        const now2 = typeof performance !== "undefined" ? performance.now() : 0;
        if (start >= 0 && pausedAt >= 0) start += now2 - pausedAt;
        pausedAt = -1;
        isPaused = false;
        rafId = requestAnimationFrame(tick);
      };
      rafId = requestAnimationFrame(tick);
    }
    function pause() {
      if (isPaused) return;
      isPaused = true;
      stopIdleLoop();
      if (activeMorph && rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
        suspendMorph?.();
      }
    }
    function resume() {
      if (!isPaused) return;
      if (activeMorph && resumeMorph) {
        resumeMorph();
        return;
      }
      isPaused = false;
      startIdleLoop();
    }
    function showFormation(name) {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
      stopIdleLoop();
      isPaused = false;
      suspendMorph = void 0;
      resumeMorph = void 0;
      activeMorph = void 0;
      field.step({ from: name, to: name, m: 1, motion: "direct" });
      renderer.setField(field);
      const view = isStatic() && tiltEnabled ? currentView(tiltOpts.staticYaw, tiltOpts.staticPitch) : currentView();
      renderer.render(fullRect(), cssWidth(), cssHeight(), view);
      startIdleLoop();
    }
    const EXIT_FROM = "__exitFrom";
    const EXIT_TO = "__exitTo";
    function disperseOut(opts2) {
      if (field.n === 0) {
        opts2?.onSettle?.();
        return;
      }
      if (activeMorph) {
        field.step({
          from: activeMorph.from,
          to: activeMorph.to,
          m: activeMorph.m,
          stagger: activeMorph.stagger,
          scatter: SCATTER,
          motion: activeMorph.motion
        });
        renderer.setField(field);
        activeMorph = void 0;
      }
      const spread = opts2?.spread ?? 0.55;
      const durationMs = opts2?.durationMs ?? 800;
      const fromPts = field.particles.map((p) => ({ x: p.x, y: p.y, z: p.z, lvl: p.lvl }));
      const toPts = field.particles.map((p) => {
        const mag = spread * (0.35 + p.dep * 0.9);
        return {
          x: p.x + Math.cos(p.phase) * mag,
          y: p.y + Math.sin(p.phase) * mag,
          z: p.z,
          lvl: Math.floor(p.phase / (Math.PI * 2) * 6)
          // fade toward faint ink dust
        };
      });
      field.setFormation(EXIT_FROM, fromPts);
      field.setFormation(EXIT_TO, toPts);
      if (opts2?.fade !== false) {
        canvas.style.transition = `opacity ${durationMs}ms ease`;
        canvas.style.opacity = "0";
      }
      suppressIdleOnce = true;
      morph(EXIT_FROM, EXIT_TO, { durationMs, onSettle: opts2?.onSettle });
    }
    function destroy() {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
      stopIdleLoop();
      isPaused = true;
      suspendMorph = void 0;
      resumeMorph = void 0;
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibilityChange);
      }
      if (typeof window !== "undefined") {
        window.removeEventListener("resize", onResize);
      }
      if (tiltEnabled && typeof window !== "undefined") {
        window.removeEventListener("mousemove", onMouseMove);
      }
      intersectionObserver?.disconnect();
      renderer.destroy();
    }
    return { isStatic, snapshotFor, morph, pause, resume, showFormation, disperseOut, destroy };
  }

  // src/components/text-layout.ts
  var DEFAULT_FONT = "700 120px sans-serif";
  function computedCanvasFont(el) {
    if (typeof getComputedStyle !== "function") return void 0;
    const style = getComputedStyle(el);
    if (!style.fontSize || !style.fontFamily) return void 0;
    return [
      style.fontStyle,
      style.fontVariant,
      style.fontWeight,
      style.fontSize,
      style.fontFamily
    ].filter(Boolean).join(" ");
  }
  function textSampleOptsForElement(canvas, el, fontOverride, levels = 24) {
    const canvasRect = canvas.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const fieldSize = Math.min(canvasRect.width, canvasRect.height);
    if (fieldSize <= 0 || elRect.width <= 0 || elRect.height <= 0) {
      return { font: fontOverride ?? computedCanvasFont(el) ?? DEFAULT_FONT, levels };
    }
    const canvasCenterX = canvasRect.left + canvasRect.width / 2;
    const canvasCenterY = canvasRect.top + canvasRect.height / 2;
    const elCenterX = elRect.left + elRect.width / 2;
    const elCenterY = elRect.top + elRect.height / 2;
    return {
      font: fontOverride ?? computedCanvasFont(el) ?? DEFAULT_FONT,
      levels,
      fit: Math.min(0.98, Math.max(elRect.width, elRect.height) / fieldSize),
      offsetX: (elCenterX - canvasCenterX) / fieldSize,
      offsetY: (elCenterY - canvasCenterY) / fieldSize
    };
  }

  // src/components/text-reveal.ts
  function dispersed(n, rng) {
    return Array.from({ length: n }, () => ({
      x: rng() - 0.5,
      y: rng() - 0.5,
      lvl: Math.floor(rng() * 7)
      // faint ink dust (not full-contrast noise) → the coalesce reads as ink condensing
    }));
  }
  function textReveal(canvas, h1, opts) {
    canvas.setAttribute("aria-hidden", "true");
    const n = opts.n ?? 8e3;
    const rng = createRng(opts.seed ?? 1);
    const palette = createPalette([244, 243, 238], [17, 19, 24], 24);
    const field = createField(n, rng);
    const cloud = dispersed(n, rng);
    field.setFormation("dispersed", cloud);
    field.setFormation("text", cloud);
    h1.style.opacity = "0";
    h1.style.transition = "opacity 600ms ease";
    canvas.style.transition = "opacity 600ms ease";
    const baseStage = createInkStage(canvas, field, palette, { shape: opts.shape, tilt: false, idle: false });
    let destroyed = false;
    const stage = {
      ...baseStage,
      destroy() {
        destroyed = true;
        baseStage.destroy();
      }
    };
    void (async () => {
      await (document.fonts?.ready ?? Promise.resolve());
      if (destroyed) return;
      const sampleOpts = textSampleOptsForElement(canvas, h1, opts.font);
      const text = fromText(opts.text, n, sampleOpts, rng);
      field.setFormation("text", matchFormation(cloud, text));
      stage.morph("dispersed", "text", {
        durationMs: 1600,
        stagger: 0.12,
        onSettle: () => {
          if (destroyed) return;
          canvas.style.opacity = "0";
          h1.style.opacity = "1";
          opts.onSettle?.();
        }
      });
    })();
    return stage;
  }

  // src/engine/depth.ts
  function coherentDepth(x, y, amplitude) {
    return amplitude * (Math.sin(x * 7.5 + y * 2.5) * 0.55 + Math.sin(x * 3 - y * 6.5 + 1.3) * 0.35 + Math.sin(y * 12 + x * 1.5) * 0.22);
  }
  function withDepth(pts, amplitude) {
    return pts.map((p) => ({ ...p, z: (p.z ?? 0) + coherentDepth(p.x, p.y, amplitude) }));
  }

  // src/components/scene-morph.ts
  var DEFAULT_DEPTH_AMPLITUDE = 0.22;
  function addDepthToFlatFormation(points, amplitude) {
    return points.some((point) => point.z !== void 0) ? points : withDepth(points, amplitude);
  }
  function sceneMorph(canvas, opts) {
    canvas.setAttribute("aria-hidden", "true");
    const n = opts.n ?? opts.from.length;
    const rng = createRng(opts.seed ?? 1);
    const palette = createPalette([244, 243, 238], [17, 19, 24], 24);
    const tiltInput = opts.tilt;
    const tiltEnabled = tiltInput !== false && tiltInput?.depth !== false;
    const amplitude = DEFAULT_DEPTH_AMPLITUDE;
    const field = createField(n, rng);
    const matchedTo = matchFormation(opts.from, opts.to);
    field.setFormation("from", tiltEnabled ? addDepthToFlatFormation(opts.from, amplitude) : opts.from);
    field.setFormation("to", tiltEnabled ? addDepthToFlatFormation(matchedTo, amplitude) : matchedTo);
    const stage = createInkStage(canvas, field, palette, { shape: opts.shape, tilt: tiltInput });
    stage.morph("from", "to", {
      durationMs: opts.durationMs ?? 1600,
      stagger: opts.stagger ?? 0.1,
      motion: opts.motion ?? "flow"
    });
    return stage;
  }

  // src/components/sequence-morph.ts
  var DEFAULT_DEPTH_AMPLITUDE2 = 0.22;
  function now() {
    return typeof performance === "undefined" ? Date.now() : performance.now();
  }
  function formationNames(opts) {
    const names = Object.keys(opts.formations);
    if (names.length === 0) throw new Error("sequenceMorph: expected at least one formation");
    return names;
  }
  function validateSequence(opts, names, initial, n) {
    if (!opts.formations[initial]) {
      throw new Error(`sequenceMorph: initial formation "${initial}" is not defined`);
    }
    if (n < 0 || !Number.isInteger(n)) {
      throw new Error(`sequenceMorph: n must be a non-negative integer, got ${n}`);
    }
    for (const name of names) {
      const points = opts.formations[name];
      if (points.length !== n) {
        throw new Error(`sequenceMorph: formation "${name}" expected ${n} points, got ${points.length}`);
      }
    }
    for (const step of opts.steps) {
      if (!opts.formations[step.to]) {
        throw new Error(`sequenceMorph: step target "${step.to}" is not defined`);
      }
    }
  }
  function shouldAddDepth(tilt) {
    return tilt !== false && tilt?.depth !== false;
  }
  function sequenceMorph(canvas, opts) {
    canvas.setAttribute("aria-hidden", "true");
    const names = formationNames(opts);
    const initial = opts.initial ?? names[0];
    const n = opts.n ?? opts.formations[initial]?.length ?? 0;
    validateSequence(opts, names, initial, n);
    const field = createField(n, createRng(opts.seed ?? 1));
    const initialPoints = opts.formations[initial];
    const addDepth = shouldAddDepth(opts.tilt);
    for (const name of names) {
      const source = name === initial ? initialPoints : matchFormation(initialPoints, opts.formations[name]);
      const points = addDepth && !source.some((point) => point.z !== void 0) ? withDepth(source, DEFAULT_DEPTH_AMPLITUDE2) : source;
      field.setFormation(name, points);
    }
    field.step({ from: initial, to: initial, m: 1, motion: "direct" });
    const palette = createPalette([244, 243, 238], [17, 19, 24], 24);
    const stage = createInkStage(canvas, field, palette, {
      shape: opts.shape,
      tilt: opts.tilt
    });
    let state = "idle";
    let currentFormation = initial;
    let nextStepIndex = 0;
    let timer;
    let pendingAction;
    let remainingDelay = 0;
    let timerStartedAt = 0;
    function setState(next) {
      if (state === next) return;
      state = next;
      opts.onStateChange?.(state);
    }
    function clearTimer() {
      if (timer !== void 0) clearTimeout(timer);
      timer = void 0;
    }
    function runPendingAction() {
      const action = pendingAction;
      pendingAction = void 0;
      remainingDelay = 0;
      timer = void 0;
      action?.();
    }
    function schedule(delayMs, action) {
      clearTimer();
      pendingAction = action;
      remainingDelay = Math.max(0, delayMs);
      if (remainingDelay === 0) {
        runPendingAction();
        return;
      }
      timerStartedAt = now();
      timer = setTimeout(runPendingAction, remainingDelay);
    }
    function finish() {
      opts.onComplete?.();
      if (opts.loop) {
        schedule(opts.loopDelayMs ?? 900, () => {
          stage.showFormation(initial);
          currentFormation = initial;
          nextStepIndex = 0;
          schedule(opts.initialHoldMs ?? 650, runNextStep);
        });
        return;
      }
      setState("complete");
    }
    function runNextStep() {
      if (state !== "playing") return;
      const step = opts.steps[nextStepIndex];
      if (!step) {
        finish();
        return;
      }
      const from = currentFormation;
      const motion = step.motion ?? "flow";
      opts.onStepChange?.({ index: nextStepIndex, from, to: step.to, motion });
      stage.morph(from, step.to, {
        motion,
        durationMs: step.durationMs ?? opts.defaultDurationMs ?? 1600,
        stagger: step.stagger ?? opts.defaultStagger ?? 0.1,
        onSettle: () => {
          if (state === "destroyed") return;
          currentFormation = step.to;
          nextStepIndex += 1;
          schedule(step.holdMs ?? opts.defaultHoldMs ?? 450, runNextStep);
        }
      });
    }
    function finishStaticSequence() {
      const finalFormation = opts.steps[opts.steps.length - 1]?.to ?? initial;
      stage.showFormation(finalFormation);
      currentFormation = finalFormation;
      nextStepIndex = opts.steps.length;
      opts.onComplete?.();
      setState("complete");
    }
    function play() {
      if (state === "destroyed" || state === "playing") return;
      if (state === "paused") {
        resume();
        return;
      }
      if (state === "complete") {
        replay();
        return;
      }
      if (stage.isStatic()) {
        finishStaticSequence();
        return;
      }
      setState("playing");
      schedule(opts.initialHoldMs ?? 650, runNextStep);
    }
    function pause() {
      if (state !== "playing") return;
      if (timer !== void 0) {
        clearTimer();
        remainingDelay = Math.max(0, remainingDelay - (now() - timerStartedAt));
      }
      stage.pause();
      setState("paused");
    }
    function resume() {
      if (state !== "paused") return;
      setState("playing");
      stage.resume();
      if (pendingAction) schedule(remainingDelay, pendingAction);
    }
    function replay() {
      if (state === "destroyed") return;
      clearTimer();
      pendingAction = void 0;
      stage.showFormation(initial);
      currentFormation = initial;
      nextStepIndex = 0;
      if (stage.isStatic()) {
        finishStaticSequence();
        return;
      }
      setState("playing");
      schedule(opts.initialHoldMs ?? 650, runNextStep);
    }
    function destroy() {
      if (state === "destroyed") return;
      clearTimer();
      pendingAction = void 0;
      stage.destroy();
      setState("destroyed");
    }
    const sequence = {
      play,
      pause,
      resume,
      replay,
      getState: () => state,
      getCurrentFormation: () => currentFormation,
      destroy
    };
    if (opts.autoplay !== false) play();
    return sequence;
  }

  // src/components/image-reveal.ts
  var DEFAULT_DEPTH_AMPLITUDE3 = 0.22;
  function dispersed2(n, rng) {
    return Array.from({ length: n }, () => ({
      x: rng() - 0.5,
      y: rng() - 0.5,
      lvl: Math.floor(rng() * 7)
      // faint ink dust (not full-contrast noise) → the coalesce reads as ink condensing
    }));
  }
  function imageReveal(canvas, img, opts) {
    if (opts?.alt) {
      canvas.setAttribute("role", "img");
      canvas.setAttribute("aria-label", opts.alt);
    } else {
      canvas.setAttribute("aria-hidden", "true");
    }
    const n = opts?.n ?? 8e3;
    const rng = createRng(opts?.seed ?? 1);
    const palette = createPalette([244, 243, 238], [17, 19, 24], 24);
    const field = createField(n, rng);
    const tiltInput = opts?.tilt;
    const tiltEnabled = tiltInput !== false && tiltInput?.depth !== false;
    const amplitude = DEFAULT_DEPTH_AMPLITUDE3;
    const rawCloud = dispersed2(n, rng);
    const cloud = tiltEnabled ? withDepth(rawCloud, amplitude) : rawCloud;
    field.setFormation("from", cloud);
    const rawImagePts = fromImage(img, n, { levels: 24 }, rng);
    const rawFallback = rawImagePts.length > 0 ? rawImagePts : rawCloud;
    const matched = matchFormation(rawCloud, rawFallback);
    const imagePts = tiltEnabled ? withDepth(matched, amplitude) : matched;
    field.setFormation("image", imagePts);
    const stage = createInkStage(canvas, field, palette, { shape: opts?.shape, tilt: tiltInput });
    stage.morph("from", "image", { durationMs: 1600, stagger: 0.1 });
    return stage;
  }

  // src/auto-init.ts
  function parseInkAttributes(root) {
    const els = root.querySelectorAll("[data-ink], [data-ink-transition]");
    const specs = [];
    for (const el of Array.from(els)) {
      if (el.hasAttribute("data-ink-transition")) {
        specs.push({ kind: "transition", el });
        continue;
      }
      const ink = el.getAttribute("data-ink");
      if (ink === "title") {
        specs.push({ kind: "title", text: (el.textContent ?? "").trim(), el });
        continue;
      }
      if (ink === "stat") {
        const value = el.getAttribute("data-value");
        if (value !== null) {
          specs.push({ kind: "stat", value, el });
        }
      }
    }
    return specs;
  }
  function autoInit(root) {
    const specs = parseInkAttributes(root);
    for (const spec of specs) {
      if (spec.kind === "title" && spec.el instanceof HTMLElement) {
        const canvas = document.createElement("canvas");
        canvas.setAttribute("aria-hidden", "true");
        spec.el.parentNode?.insertBefore(canvas, spec.el);
        textReveal(canvas, spec.el, { text: spec.text ?? "" });
      }
    }
  }

  // src/components/cover-reveal.ts
  var DEFAULT_DEPTH_AMPLITUDE4 = 0.22;
  function dispersed3(n, rng) {
    return Array.from({ length: n }, () => ({
      x: rng() - 0.5,
      y: rng() - 0.5,
      lvl: Math.floor(rng() * 7)
      // faint ink dust → the coalesce reads as ink condensing
    }));
  }
  function coverReveal(canvas, opts) {
    const { wordmark, tagline } = opts;
    const text = wordmark.textContent ?? "";
    canvas.setAttribute("aria-hidden", "true");
    wordmark.style.transition = "opacity 450ms ease";
    wordmark.style.opacity = "0";
    canvas.style.transition = "opacity 450ms ease";
    if (tagline) {
      tagline.style.opacity = "0";
      tagline.style.transition = "opacity 600ms ease";
    }
    const n = opts.n ?? 3200;
    const rng = createRng(opts.seed ?? 1);
    const palette = createPalette([244, 243, 238], [17, 19, 24], 24);
    const field = createField(n, rng);
    const persistent = opts.persistent === true;
    const tiltInput = persistent ? opts.tilt : false;
    const tiltEnabled = tiltInput !== false && tiltInput?.depth !== false;
    const amp = DEFAULT_DEPTH_AMPLITUDE4;
    const rawCloud = dispersed3(n, rng);
    const cloud = tiltEnabled ? withDepth(rawCloud, amp) : rawCloud;
    field.setFormation("from", cloud);
    field.setFormation("wordmark", cloud);
    const baseStage = createInkStage(canvas, field, palette, {
      shape: opts.shape ?? "round",
      tilt: tiltInput,
      idle: persistent
    });
    let destroyed = false;
    const stage = {
      ...baseStage,
      destroy() {
        destroyed = true;
        baseStage.destroy();
      }
    };
    void (async () => {
      await (document.fonts?.ready ?? Promise.resolve());
      if (destroyed) return;
      const sampleOpts = textSampleOptsForElement(canvas, wordmark, opts.font);
      const rawText = fromText(text, n, sampleOpts, rng);
      const base = rawText.length > 0 ? rawText : rawCloud;
      const matched = matchFormation(rawCloud, base);
      const pts = tiltEnabled ? withDepth(matched, amp) : matched;
      field.setFormation("wordmark", pts);
      stage.morph("from", "wordmark", {
        durationMs: 1600,
        stagger: 0.12,
        onSettle: () => {
          if (destroyed) return;
          if (!persistent) {
            canvas.style.opacity = "0";
            wordmark.style.opacity = "1";
          }
          if (tagline) tagline.style.opacity = "1";
        }
      });
    })();
    return stage;
  }

  // src/components/stat-reveal.ts
  function parseStatValue(value) {
    const m = /^([^0-9\-]*)(-?[0-9][0-9,.]*)([^0-9]*)$/.exec(value.trim());
    if (!m) return null;
    const num = parseFloat(m[2].replace(/,/g, ""));
    if (!Number.isFinite(num)) return null;
    return { num, prefix: m[1], suffix: m[3] };
  }
  function formatNum(num, originalNum) {
    if (originalNum.includes(",")) {
      return Math.round(num).toLocaleString("en-US");
    }
    const dotIdx = originalNum.indexOf(".");
    if (dotIdx !== -1) {
      const decimals = originalNum.length - dotIdx - 1;
      return num.toFixed(decimals);
    }
    return String(Math.round(num));
  }
  function statReveal(canvas, el, opts) {
    const { value, countUp } = opts;
    el.textContent = value;
    let onSettle;
    let sampledValue = value;
    let countRafId = 0;
    let countDelayId;
    if (countUp) {
      const parsed = parseStatValue(value);
      if (parsed !== null) {
        const { num: targetNum, prefix, suffix } = parsed;
        const rawNumStr = /([0-9][0-9,.]*)/.exec(value)?.[1] ?? String(Math.abs(targetNum));
        sampledValue = prefix + formatNum(0, rawNumStr) + suffix;
        el.textContent = sampledValue;
        onSettle = () => {
          countDelayId = setTimeout(() => {
            const duration = 600;
            const start = performance.now();
            function tick(now2) {
              const raw = Math.min(1, (now2 - start) / duration);
              const t = Math.sqrt(raw);
              el.textContent = prefix + formatNum(t * targetNum, rawNumStr) + suffix;
              if (raw < 1) {
                countRafId = requestAnimationFrame(tick);
              } else {
                el.textContent = prefix + formatNum(targetNum, rawNumStr) + suffix;
              }
            }
            countRafId = requestAnimationFrame(tick);
          }, 600);
        };
      }
    }
    const baseStage = textReveal(canvas, el, {
      text: sampledValue,
      font: opts.font,
      n: opts.n,
      seed: opts.seed,
      shape: opts.shape,
      onSettle
    });
    return {
      ...baseStage,
      destroy() {
        if (countRafId) cancelAnimationFrame(countRafId);
        if (countDelayId !== void 0) clearTimeout(countDelayId);
        baseStage.destroy();
      }
    };
  }

  // src/engine/budget.ts
  function recommendedParticleCount(opts) {
    const width = opts?.width ?? (typeof innerWidth === "number" ? innerWidth : 1280);
    const dpr = opts?.dpr ?? (typeof devicePixelRatio === "number" ? devicePixelRatio : 1);
    let budget;
    if (width >= 1200 && dpr <= 1) {
      budget = 15e3;
    } else if (width >= 1200) {
      budget = 12e3;
    } else if (width >= 768) {
      budget = 8e3;
    } else if (width >= 480) {
      budget = 4e3;
    } else {
      budget = 2e3;
    }
    return Math.min(budget, 15e3);
  }

  // src/engine/forms3d.ts
  function column(n, opts, rng) {
    const height = opts?.height ?? 0.8;
    const radius = opts?.radius ?? 0.18;
    const lvlOpt = opts?.lvl ?? 16;
    const rand = rng ?? (() => {
      let s = 2654435769 | 0;
      return () => {
        s = Math.imul(s ^ s >>> 16, 73244475) | 0;
        s = Math.imul(s ^ s >>> 16, 73244475) | 0;
        return (s >>> 0) / 4294967296;
      };
    })();
    const pts = [];
    for (let i = 0; i < n; i++) {
      const v = (rand() - 0.5) * height;
      const theta = rand() * Math.PI * 2;
      const r = radius * Math.sqrt(rand());
      const x = r * Math.cos(theta);
      const z = r * Math.sin(theta);
      const y = v;
      const lvl = typeof lvlOpt === "function" ? Math.max(0, Math.min(23, Math.round(lvlOpt(v / height)))) : lvlOpt;
      pts.push({ x, y, lvl, z });
    }
    return pts;
  }
  function doubleHelix(n, opts, rng) {
    const height = opts?.height ?? 0.78;
    const radius = opts?.radius ?? 0.17;
    const turns = opts?.turns ?? 2.6;
    const rungFraction = Math.max(0, Math.min(0.45, opts?.rungFraction ?? 0.22));
    const rand = rng ?? (() => {
      let s = 2135587861 | 0;
      return () => {
        s = Math.imul(s ^ s >>> 15, 739982445) | 0;
        return (s >>> 0) / 4294967296;
      };
    })();
    const rungCount = Math.floor(n * rungFraction);
    const strandCount = n - rungCount;
    const perStrand = Math.max(1, Math.ceil(strandCount / 2));
    const pts = [];
    for (let i = 0; i < strandCount; i++) {
      const strand = i & 1;
      const rank = Math.floor(i / 2);
      const t = Math.min(1, (rank + rand() * 0.35) / perStrand);
      const angle = t * turns * Math.PI * 2 + strand * Math.PI;
      const tube = (rand() - 0.5) * 0.018;
      pts.push({
        x: (radius + tube) * Math.cos(angle),
        y: (t - 0.5) * height + (rand() - 0.5) * 0.012,
        z: (radius + tube) * Math.sin(angle),
        lvl: strand === 0 ? 21 : 16
      });
    }
    for (let i = 0; i < rungCount; i++) {
      const t = (i + rand()) / Math.max(1, rungCount);
      const angle = t * turns * Math.PI * 2;
      const across = rand() * 2 - 1;
      pts.push({
        x: radius * across * Math.cos(angle),
        y: (t - 0.5) * height + (rand() - 0.5) * 8e-3,
        z: radius * across * Math.sin(angle),
        lvl: 11
      });
    }
    return pts;
  }
  function fromPoints3d(pts3d, n, rng) {
    const out = [];
    if (pts3d.length === 0) {
      for (let i = 0; i < n; i++) {
        out.push({ x: 0, y: 0, lvl: 0, z: 0 });
      }
      return out;
    }
    const total = pts3d.length;
    const grain = 0.5 / Math.sqrt(n);
    let zMin = Infinity, zMax = -Infinity;
    for (const p of pts3d) {
      if (p.z < zMin) zMin = p.z;
      if (p.z > zMax) zMax = p.z;
    }
    const zRange = zMax - zMin;
    const zGrain = Math.min(grain, zRange / Math.max(1, total) * 2);
    for (let i = 0; i < n; i++) {
      const pos = (i + rng()) / n * total;
      const idx = Math.min(total - 1, Math.floor(pos));
      const src = pts3d[idx];
      const jx = (rng() - 0.5) * 2 * grain;
      const jy = (rng() - 0.5) * 2 * grain;
      const jz = (rng() - 0.5) * 2 * zGrain;
      const x = Math.min(0.5, Math.max(-0.5, src.x + jx));
      const y = Math.min(0.5, Math.max(-0.5, src.y + jy));
      const z = Math.min(zMax + grain, Math.max(zMin - grain, src.z + jz));
      const lvl = src.lvl ?? 12;
      out.push({ x, y, lvl, z });
    }
    return out;
  }

  // src/engine/data-forms.ts
  function positiveValues(values) {
    if (values.length === 0) throw new Error("sumi chart formation requires at least one value");
    const clean = values.map((value) => Number.isFinite(value) ? Math.max(0, value) : 0);
    return clean.some((value) => value > 0) ? clean : clean.map(() => 1);
  }
  function weightedIndex(values, target) {
    let cumulative = 0;
    for (let i = 0; i < values.length; i++) {
      cumulative += values[i];
      if (target <= cumulative) return i;
    }
    return values.length - 1;
  }
  function barChart(values, n, opts, rng) {
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
    const points = [];
    for (let i = 0; i < n; i++) {
      const target = (i + rng()) / Math.max(1, n) * total;
      const index = weightedIndex(clean, target);
      const barHeight = Math.max(0.04, clean[index] / max * height);
      points.push({
        x: -width / 2 + (index + 0.5) * slot + (rng() - 0.5) * barWidth,
        y: bottom - rng() * barHeight,
        z: (rng() - 0.5) * depth,
        lvl: 14 + index % 10
      });
    }
    return points;
  }
  function lineChart(values, n, opts, rng) {
    const clean = positiveValues(values);
    const width = opts?.width ?? 0.78;
    const height = opts?.height ?? 0.62;
    const thickness = opts?.thickness ?? 0.025;
    const depth = opts?.depth ?? 0.07;
    const max = Math.max(...clean);
    const count = Math.max(2, clean.length);
    const expanded = clean.length === 1 ? [clean[0], clean[0]] : clean;
    const vertices = expanded.map((value, index) => ({
      x: -width / 2 + index / (count - 1) * width,
      y: 0.31 - value / max * height
    }));
    const lengths = vertices.slice(0, -1).map((point, index) => Math.hypot(vertices[index + 1].x - point.x, vertices[index + 1].y - point.y));
    const total = lengths.reduce((sum, value) => sum + value, 0) || 1;
    const points = [];
    for (let i = 0; i < n; i++) {
      const segment = weightedIndex(lengths, (i + rng()) / Math.max(1, n) * total);
      const a = vertices[segment];
      const b = vertices[segment + 1];
      const t = rng();
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const length = Math.hypot(dx, dy) || 1;
      const jitter = (rng() - 0.5) * thickness;
      points.push({
        x: a.x + dx * t - dy / length * jitter,
        y: a.y + dy * t + dx / length * jitter,
        z: (rng() - 0.5) * depth,
        lvl: 18 + segment % 6
      });
    }
    return points;
  }
  function donutChart(values, n, opts, rng) {
    const clean = positiveValues(values);
    const inner = opts?.innerRadius ?? 0.18;
    const outer = Math.max(inner + 0.02, opts?.outerRadius ?? 0.36);
    const gap = Math.max(0, opts?.gapRadians ?? 0.055);
    const depth = opts?.depth ?? 0.08;
    const total = clean.reduce((sum, value) => sum + value, 0);
    const starts = [];
    let cursor = -Math.PI / 2;
    for (const value of clean) {
      starts.push(cursor);
      cursor += value / total * Math.PI * 2;
    }
    const points = [];
    for (let i = 0; i < n; i++) {
      const index = weightedIndex(clean, (i + rng()) / Math.max(1, n) * total);
      const sweep = clean[index] / total * Math.PI * 2;
      const usableSweep = Math.max(2e-3, sweep - gap);
      const theta = starts[index] + gap / 2 + rng() * usableSweep;
      const radius = Math.sqrt(inner * inner + rng() * (outer * outer - inner * inner));
      points.push({
        x: Math.cos(theta) * radius,
        y: Math.sin(theta) * radius,
        z: (rng() - 0.5) * depth + Math.sin(theta * 2) * depth * 0.16,
        lvl: 13 + index * 3 % 11
      });
    }
    return points;
  }
  return __toCommonJS(index_exports);
})();
