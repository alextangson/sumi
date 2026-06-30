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
    column: () => column,
    coverReveal: () => coverReveal,
    createRng: () => createRng,
    easedProgress: () => easedProgress,
    fromImage: () => fromImage,
    fromImageData: () => fromImageData,
    fromPoints3d: () => fromPoints3d,
    fromSVGPath: () => fromSVGPath,
    fromShape: () => fromShape,
    fromText: () => fromText,
    imageReveal: () => imageReveal,
    parseInkAttributes: () => parseInkAttributes,
    parseStatValue: () => parseStatValue,
    recommendedParticleCount: () => recommendedParticleCount,
    sceneMorph: () => sceneMorph,
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
    const target = size * 0.8;
    const scale = textW > 0 && textH > 0 ? Math.min(target / textW, target / textH) : 1;
    const match = opts.font.match(/(\d+(?:\.\d+)?)(px|pt|em|rem)/);
    if (match) {
      const origSize = parseFloat(match[1]);
      const unit = match[2];
      ctx.font = opts.font.replace(match[0], `${origSize * scale}${unit}`);
    }
    ctx.fillStyle = "#000";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, size / 2, size / 2);
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
  function fromShape(draw2, n, opts, rng) {
    const size = 1024;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return [];
    ctx.fillStyle = "#f4f3ee";
    ctx.fillRect(0, 0, size, size);
    draw2(ctx, size);
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
        const { from, to, m, stagger = 0 } = opts;
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
          p.lvl = b.lvl;
        }
      }
    };
  }

  // src/stage/map.ts
  function mapNormalizedToRect(pt, rect) {
    const s = Math.min(rect.w, rect.h);
    return {
      x: rect.x + rect.w / 2 + pt.x * s,
      y: rect.y + rect.h / 2 + pt.y * s
    };
  }

  // src/engine/depth.ts
  function coherentDepth(x, y, amplitude) {
    return amplitude * (Math.sin(x * 7.5 + y * 2.5) * 0.55 + Math.sin(x * 3 - y * 6.5 + 1.3) * 0.35 + Math.sin(y * 12 + x * 1.5) * 0.22);
  }
  function withDepth(pts, amplitude) {
    return pts.map((p) => ({ ...p, z: coherentDepth(p.x, p.y, amplitude) }));
  }
  function project3d(x, y, z, yaw, pitch, focal, pivotX = 0, pivotY = 0) {
    const cy = Math.cos(yaw);
    const sy = Math.sin(yaw);
    const cp = Math.cos(pitch);
    const sp = Math.sin(pitch);
    const ex = x - pivotX;
    const Yv = y - pivotY;
    const X1 = ex * cy + z * sy;
    const Z1 = -ex * sy + z * cy;
    const Yr = Yv * cp - Z1 * sp;
    const Z2 = Yv * sp + Z1 * cp;
    const persp = focal / (focal + Z2);
    const scale = Math.max(0.72, Math.min(1.45, persp));
    return {
      x: pivotX + X1 * persp,
      y: pivotY + Yr * persp,
      scale
    };
  }

  // src/engine/renderer.ts
  function buildSprites(palette, shape, dpr) {
    if (typeof document === "undefined") return [];
    if (shape === "square") return [];
    const sprites = [];
    for (let lvl = 0; lvl < palette.levels; lvl++) {
      const size = Math.ceil(palette.sizes[lvl] * dpr);
      const oc = document.createElement("canvas");
      oc.width = size;
      oc.height = size;
      const cx = oc.getContext("2d");
      if (!cx) return [];
      const r = size / 2;
      const cx_ = r;
      const cy_ = r;
      if (shape === "round") {
        cx.fillStyle = palette.colors[lvl];
        cx.beginPath();
        cx.arc(cx_, cy_, r, 0, Math.PI * 2);
        cx.fill();
      } else {
        const grad = cx.createRadialGradient(cx_, cy_, 0, cx_, cy_, r);
        grad.addColorStop(0, palette.colors[lvl]);
        grad.addColorStop(1, "rgba(0,0,0,0)");
        cx.fillStyle = grad;
        cx.beginPath();
        cx.arc(cx_, cy_, r, 0, Math.PI * 2);
        cx.fill();
      }
      sprites.push(oc);
    }
    return sprites;
  }
  function bucketize(particles) {
    return particles.slice().sort((a, b) => a.lvl - b.lvl);
  }
  function resolvePosition(p, rect, view) {
    if (view) {
      const focal = view.focal ?? 1.8;
      const pivotX = view.pivotX ?? 0;
      const pivotY = view.pivotY ?? 0;
      const proj = project3d(p.x, p.y, p.z, view.yaw, view.pitch, focal, pivotX, pivotY);
      const mapped2 = mapNormalizedToRect(proj, rect);
      return { x: mapped2.x, y: mapped2.y, sizeMul: proj.scale };
    }
    const mapped = mapNormalizedToRect(p, rect);
    return { x: mapped.x, y: mapped.y, sizeMul: 1 };
  }
  function draw(ctx, field, palette, rect, dpr, shape = "square", sprites = [], view) {
    ctx.clearRect(rect.x * dpr, rect.y * dpr, rect.w * dpr, rect.h * dpr);
    const sorted = bucketize(field.particles);
    if (shape === "square" || sprites.length === 0) {
      let cur = -1;
      for (const p of sorted) {
        if (p.lvl !== cur) {
          cur = p.lvl;
          ctx.fillStyle = palette.colors[cur];
        }
        const { x, y, sizeMul } = resolvePosition(p, rect, view);
        const size = palette.sizes[cur] * sizeMul;
        ctx.fillRect(x * dpr, y * dpr, size * dpr, size * dpr);
      }
    } else {
      for (const p of sorted) {
        const sprite = sprites[p.lvl];
        if (!sprite) continue;
        const { x, y, sizeMul } = resolvePosition(p, rect, view);
        const halfSize = sprite.width * 0.5 * sizeMul;
        ctx.drawImage(sprite, x * dpr - halfSize, y * dpr - halfSize);
      }
    }
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
    const shape = opts?.shape ?? "round";
    const tiltInput = opts?.tilt;
    const tiltEnabled = tiltInput !== false && tiltInput?.depth !== false;
    const tiltOpts = {
      depth: true,
      maxYaw: tiltInput?.maxYaw ?? 0.42,
      maxPitch: tiltInput?.maxPitch ?? 0.16,
      smoothing: tiltInput?.smoothing ?? 0.06,
      autoDrift: tiltInput?.autoDrift ?? 3e-4,
      staticYaw: tiltInput?.staticYaw ?? 0.12,
      staticPitch: tiltInput?.staticPitch ?? 0.06,
      amplitude: tiltInput?.amplitude ?? 0.06
    };
    let rafId = 0;
    const dpr = Math.min(typeof devicePixelRatio === "number" && devicePixelRatio || 1, 2);
    const sprites = buildSprites(palette, shape, dpr);
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
      const nx = (e.clientX - rect.left) / rect.width;
      const ny = (e.clientY - rect.top) / rect.height;
      targetYaw = (nx - 0.5) * tiltOpts.maxYaw * 2;
      targetPitch = (ny - 0.5) * tiltOpts.maxPitch * 2;
    }
    if (tiltEnabled && typeof canvas.addEventListener === "function") {
      canvas.addEventListener("mousemove", onMouseMove);
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
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const view = tiltEnabled ? currentView(tiltOpts.staticYaw, tiltOpts.staticPitch) : void 0;
      draw(ctx, field, palette, rect, dpr, shape, sprites, view);
    }
    function fullRect() {
      return {
        x: 0,
        y: 0,
        w: canvas.clientWidth || canvas.width,
        h: canvas.clientHeight || canvas.height
      };
    }
    let idleRafId = 0;
    function idleTick() {
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
      const dpr2 = typeof devicePixelRatio === "number" && devicePixelRatio || 1;
      const ctx = canvas.getContext("2d");
      if (ctx) draw(ctx, field, palette, fullRect(), dpr2, shape, sprites, currentView());
      idleRafId = requestAnimationFrame(idleTick);
    }
    function startIdleLoop() {
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
      if (!document.hidden && idleRafId === 0 && rafId === 0) {
        idleRafId = requestAnimationFrame(idleTick);
      }
    }
    if (tiltEnabled && typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisibilityChange);
    }
    function morph(from, to, opts2) {
      const durationMs = opts2?.durationMs ?? 1600;
      const stagger = opts2?.stagger ?? 0;
      const currentDpr = typeof devicePixelRatio === "number" && devicePixelRatio || 1;
      const ctx = canvas.getContext("2d");
      if (isStatic()) {
        field.step({ from, to, m: 1, stagger });
        if (ctx) {
          const view = tiltEnabled ? currentView(tiltOpts.staticYaw, tiltOpts.staticPitch) : void 0;
          draw(ctx, field, palette, fullRect(), currentDpr, shape, sprites, view);
        }
        opts2?.onSettle?.();
        return;
      }
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
      stopIdleLoop();
      let start = -1;
      function tick(time) {
        if (start < 0) start = time;
        const rawM = easedProgress((time - start) / durationMs, opts2?.phases, opts2?.ease);
        const m = time - start >= durationMs ? 1 : rawM;
        field.step({ from, to, m, stagger });
        if (tiltEnabled) {
          driftYaw += 4e-3;
          const drift = 0.05 * Math.sin(driftYaw);
          currentYaw += (targetYaw + drift - currentYaw) * tiltOpts.smoothing;
          currentPitch += (targetPitch - currentPitch) * tiltOpts.smoothing;
        }
        if (ctx) draw(ctx, field, palette, fullRect(), currentDpr, shape, sprites, currentView());
        if (m >= 1) {
          rafId = 0;
          opts2?.onSettle?.();
          if (tiltEnabled) startIdleLoop();
        } else {
          rafId = requestAnimationFrame(tick);
        }
      }
      rafId = requestAnimationFrame(tick);
    }
    function destroy() {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
      stopIdleLoop();
      if (tiltEnabled && typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibilityChange);
      }
      if (typeof window !== "undefined") {
        window.removeEventListener("resize", onResize);
      }
      if (tiltEnabled && typeof canvas.removeEventListener === "function") {
        canvas.removeEventListener("mousemove", onMouseMove);
      }
    }
    return { isStatic, snapshotFor, morph, destroy };
  }

  // src/components/text-reveal.ts
  var DEFAULT_DEPTH_AMPLITUDE = 0.22;
  function dispersed(n, rng) {
    return Array.from({ length: n }, () => ({
      x: rng() - 0.5,
      y: rng() - 0.5,
      lvl: Math.floor(rng() * 24)
    }));
  }
  function textReveal(canvas, h1, opts) {
    canvas.setAttribute("aria-hidden", "true");
    const n = opts.n ?? 8e3;
    const font = opts.font ?? "700 120px sans-serif";
    const rng = createRng(opts.seed ?? 1);
    const palette = createPalette([244, 243, 238], [17, 19, 24], 24);
    const field = createField(n, rng);
    const tiltInput = opts.tilt;
    const tiltEnabled = tiltInput !== false && tiltInput?.depth !== false;
    const amplitude = tiltInput?.amplitude ?? DEFAULT_DEPTH_AMPLITUDE;
    const rawCloud = dispersed(n, rng);
    const cloud = tiltEnabled ? withDepth(rawCloud, amplitude) : rawCloud;
    field.setFormation("dispersed", cloud);
    field.setFormation("text", cloud);
    h1.style.opacity = "0";
    h1.style.transition = "opacity 600ms ease";
    canvas.style.transition = "opacity 600ms ease";
    const stage = createInkStage(canvas, field, palette, { shape: opts.shape, tilt: tiltInput });
    void (async () => {
      await document.fonts.ready;
      const rawText = fromText(opts.text, n, { font, levels: 24 }, rng);
      const text = tiltEnabled ? withDepth(rawText, amplitude) : rawText;
      field.setFormation("text", text);
      stage.morph("dispersed", "text", {
        durationMs: 1600,
        onSettle: () => {
          canvas.style.opacity = "0";
          h1.style.opacity = "1";
          opts.onSettle?.();
        }
      });
    })();
    return stage;
  }

  // src/components/scene-morph.ts
  var DEFAULT_DEPTH_AMPLITUDE2 = 0.22;
  function sceneMorph(canvas, opts) {
    canvas.setAttribute("aria-hidden", "true");
    const n = opts.n ?? opts.from.length;
    const rng = createRng(opts.seed ?? 1);
    const palette = createPalette([244, 243, 238], [17, 19, 24], 24);
    const tiltInput = opts.tilt;
    const tiltEnabled = tiltInput !== false && tiltInput?.depth !== false;
    const amplitude = tiltInput?.amplitude ?? DEFAULT_DEPTH_AMPLITUDE2;
    const field = createField(n, rng);
    field.setFormation("from", tiltEnabled ? withDepth(opts.from, amplitude) : opts.from);
    field.setFormation("to", tiltEnabled ? withDepth(opts.to, amplitude) : opts.to);
    const stage = createInkStage(canvas, field, palette, { shape: opts.shape, tilt: tiltInput });
    stage.morph("from", "to", { durationMs: 1600 });
    return stage;
  }

  // src/components/image-reveal.ts
  var DEFAULT_DEPTH_AMPLITUDE3 = 0.22;
  function dispersed2(n, rng) {
    return Array.from({ length: n }, () => ({
      x: rng() - 0.5,
      y: rng() - 0.5,
      lvl: Math.floor(rng() * 24)
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
    const amplitude = tiltInput?.amplitude ?? DEFAULT_DEPTH_AMPLITUDE3;
    const rawCloud = dispersed2(n, rng);
    const cloud = tiltEnabled ? withDepth(rawCloud, amplitude) : rawCloud;
    field.setFormation("from", cloud);
    const rawImagePts = fromImage(img, n, { levels: 24 }, rng);
    const rawFallback = rawImagePts.length > 0 ? rawImagePts : rawCloud;
    const imagePts = tiltEnabled ? withDepth(rawFallback, amplitude) : rawFallback;
    field.setFormation("image", imagePts);
    const stage = createInkStage(canvas, field, palette, { shape: opts?.shape, tilt: tiltInput });
    stage.morph("from", "image", { durationMs: 1600 });
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
  function coverReveal(canvas, opts) {
    const { wordmark, tagline } = opts;
    const text = wordmark.textContent ?? "";
    if (tagline) {
      tagline.style.opacity = "0";
      tagline.style.transition = "opacity 600ms ease";
    }
    const stage = textReveal(canvas, wordmark, {
      text,
      n: opts.n,
      seed: opts.seed,
      shape: opts.shape,
      onSettle: () => {
        if (tagline) {
          tagline.style.transition = tagline.style.transition || "opacity 600ms ease";
          tagline.style.opacity = "1";
        }
      }
    });
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
    if (countUp) {
      const parsed = parseStatValue(value);
      if (parsed !== null) {
        const { num: targetNum, prefix, suffix } = parsed;
        const rawNumStr = /([0-9][0-9,.]*)/.exec(value)?.[1] ?? String(Math.abs(targetNum));
        el.textContent = prefix + formatNum(0, rawNumStr) + suffix;
        onSettle = () => {
          const duration = 1e3;
          const start = performance.now();
          function tick(now) {
            const raw = Math.min(1, (now - start) / duration);
            const t = Math.sqrt(raw);
            el.textContent = prefix + formatNum(t * targetNum, rawNumStr) + suffix;
            if (raw < 1) {
              requestAnimationFrame(tick);
            } else {
              el.textContent = prefix + formatNum(targetNum, rawNumStr) + suffix;
            }
          }
          requestAnimationFrame(tick);
        };
      }
    }
    const stage = textReveal(canvas, el, {
      text: value,
      n: opts.n,
      seed: opts.seed,
      shape: opts.shape,
      onSettle
    });
    return stage;
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
    const lvlOpt = opts?.lvl ?? 12;
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
  return __toCommonJS(index_exports);
})();
