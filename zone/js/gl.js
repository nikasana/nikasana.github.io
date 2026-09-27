'use strict';
// ---------- WebGL renderer for the Lowest and Ultra-low settings ----------
// Many phones paint a 2D canvas with the CPU. On Lowest almost everything big is already a ready-made picture (ground
// tiles with baked scenery, props, mutant frames, damage numbers), so those go to a WebGL canvas underneath the game
// canvas, where the GPU draws them in a few batched calls from shared texture pages. The 2D canvas on top keeps the
// player, bullets, effects and overlays. If WebGL is missing or lost, everything silently stays on the 2D path.
const GLR = {
  ok: false, active: false, gen: 1, pages: [], own: new Map(), tiles: new Map(), map: new WeakMap(),
  PAGE: 2048, MAXP: 4, QMAX: 4096, n: 0, tex: null,
  init() {
    try {
      const c = document.createElement('canvas'); c.id = 'glLayer';
      c.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;display:none;pointer-events:none;';
      cv.parentNode.insertBefore(c, cv);
      const gl = c.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false, premultipliedAlpha: true, preserveDrawingBuffer: false, powerPreference: 'high-performance' });
      if (!gl) return;
      // only with a real GPU: a software WebGL (SwiftShader, llvmpipe…) gets copied back to the CPU every frame
      const dbg = gl.getExtension('WEBGL_debug_renderer_info'), rn = String(dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
      this.renderer = rn;
      if (!window.__forceGL && /swiftshader|llvmpipe|softpipe|software|basic render|microsoft basic/i.test(rn)) return;
      const sh = (t, src) => { const s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
      const p = gl.createProgram();
      gl.attachShader(p, sh(gl.VERTEX_SHADER, 'attribute vec2 p;attribute vec2 t;attribute float a;uniform vec2 r;varying vec2 v;varying float al;void main(){v=t;al=a;gl_Position=vec4(p.x/r.x*2.0-1.0,1.0-p.y/r.y*2.0,0.0,1.0);}'));
      gl.attachShader(p, sh(gl.FRAGMENT_SHADER, 'precision mediump float;uniform sampler2D s;varying vec2 v;varying float al;void main(){gl_FragColor=texture2D(s,v)*al;}'));
      gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) return;
      gl.useProgram(p);
      this.buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
      this.data = new Float32Array(this.QMAX * 30);
      gl.bufferData(gl.ARRAY_BUFFER, this.data.byteLength, gl.DYNAMIC_DRAW);
      const P = gl.getAttribLocation(p, 'p'), T = gl.getAttribLocation(p, 't'), A = gl.getAttribLocation(p, 'a');
      gl.enableVertexAttribArray(P); gl.vertexAttribPointer(P, 2, gl.FLOAT, false, 20, 0);
      gl.enableVertexAttribArray(T); gl.vertexAttribPointer(T, 2, gl.FLOAT, false, 20, 8);
      gl.enableVertexAttribArray(A); gl.vertexAttribPointer(A, 1, gl.FLOAT, false, 20, 16);
      this.uR = gl.getUniformLocation(p, 'r');
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      c.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this.ok = false; this.active = false; c.style.display = 'none'; });
      this.cv = c; this.gl = gl; this.ok = true;
    } catch (e) { this.ok = false; }
  },
  want() { return this.ok && minGfx() && Save.set && Save.set.gpuDraw !== false; },
  begin() {
    const gl = this.gl, c = this.cv;
    if (c.width !== cv.width || c.height !== cv.height) { c.width = cv.width; c.height = cv.height; }
    if (c.style.display !== 'block') c.style.display = 'block';
    gl.viewport(0, 0, c.width, c.height); gl.uniform2f(this.uR, c.width, c.height);
    gl.clearColor(0.05, 0.047, 0.035, 1); gl.clear(gl.COLOR_BUFFER_BIT);
    this.n = 0; this.tex = null; this.active = true;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); // the 2D layer on top starts see-through
  },
  end() { this.flush(); this.active = false; },
  off() { if (this.cv && this.cv.style.display !== 'none') this.cv.style.display = 'none'; },
  newTex() {
    this.flush();
    const gl = this.gl, t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.tex = null; return t;
  },
  // where a canvas lives on the GPU: a slot on a shared 2048² page, or its own texture when it is large
  slot(c) {
    let s = this.map.get(c);
    if (s && s.gen === this.gen) return s;
    const gl = this.gl, w = c.width, h = c.height;
    if (w > 512 || h > 512) {
      let t = this.own.get(c);
      if (!t) {
        if (this.own.size > 40) { const [k, v] = this.own.entries().next().value; gl.deleteTexture(v); this.own.delete(k); }
        t = this.newTex(); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c); this.own.set(c, t);
      }
      s = { gen: this.gen, t, u0: 0, v0: 0, u1: 1, v1: 1 };
    } else {
      const S = this.PAGE, pad = 2;
      let pg = this.pages[this.pages.length - 1];
      if (pg && pg.x + w + pad > S) { pg.y += pg.rh + pad; pg.x = 0; pg.rh = 0; }
      if (!pg || pg.y + h + pad > S) {
        if (this.pages.length >= this.MAXP) { // every page full: start over (sprites re-upload as they are drawn)
          this.flush(); this.gen++; for (const q of this.pages) { q.x = 0; q.y = 0; q.rh = 0; } this.pages.push(this.pages.shift()); pg = this.pages[this.pages.length - 1];
          for (const q of this.pages) { gl.bindTexture(gl.TEXTURE_2D, q.t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, S, S, 0, gl.RGBA, gl.UNSIGNED_BYTE, null); } this.tex = null;
        } else {
          const t = this.newTex(); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, S, S, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
          pg = { t, x: 0, y: 0, rh: 0 }; this.pages.push(pg);
        }
      }
      this.flush(); // draw what is queued before touching texture bindings
      gl.bindTexture(gl.TEXTURE_2D, pg.t); this.tex = null;
      gl.texSubImage2D(gl.TEXTURE_2D, 0, pg.x, pg.y, gl.RGBA, gl.UNSIGNED_BYTE, c);
      s = { gen: this.gen, t: pg.t, u0: pg.x / S, v0: pg.y / S, u1: (pg.x + w) / S, v1: (pg.y + h) / S };
      pg.x += w + pad; if (h > pg.rh) pg.rh = h;
    }
    this.map.set(c, s); return s;
  },
  // ground tiles change as you walk: each gets its own texture, dropped when the tile leaves the ground cache
  tile(c, x, y) {
    let t = this.tiles.get(c);
    if (!t) {
      const gl = this.gl;
      if (this.tiles.size > GROUND.max + 4) for (const [k, v] of this.tiles) { if (![...GROUND.map.values()].some((g) => g.c === k)) { gl.deleteTexture(v.t); this.tiles.delete(k); } }
      const tx = this.newTex(); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
      this.tiles.set(c, t = { gen: -1, t: tx, u0: 0, v0: 0, u1: 1, v1: 1 });
    }
    this.push(t, x, y, c.width, c.height, 1);
  },
  quad(c, x, y, a) { this.push(this.slot(c), x, y, c.width, c.height, a); },
  push(s, x, y, w, h, a) {
    if (this.tex !== s.t) { this.flush(); this.tex = s.t; }
    if (this.n >= this.QMAX) this.flush();
    const d = this.data, i = this.n * 30, x1 = x + w, y1 = y + h, u0 = s.u0, v0 = s.v0, u1 = s.u1, v1 = s.v1;
    d[i] = x; d[i + 1] = y; d[i + 2] = u0; d[i + 3] = v0; d[i + 4] = a;
    d[i + 5] = x1; d[i + 6] = y; d[i + 7] = u1; d[i + 8] = v0; d[i + 9] = a;
    d[i + 10] = x; d[i + 11] = y1; d[i + 12] = u0; d[i + 13] = v1; d[i + 14] = a;
    d[i + 15] = x; d[i + 16] = y1; d[i + 17] = u0; d[i + 18] = v1; d[i + 19] = a;
    d[i + 20] = x1; d[i + 21] = y; d[i + 22] = u1; d[i + 23] = v0; d[i + 24] = a;
    d[i + 25] = x1; d[i + 26] = y1; d[i + 27] = u1; d[i + 28] = v1; d[i + 29] = a;
    this.n++;
  },
  flush() {
    if (!this.n || !this.tex) { this.n = 0; return; }
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.data.subarray(0, this.n * 30));
    gl.drawArrays(gl.TRIANGLES, 0, this.n * 6);
    this.n = 0;
  },
};
GLR.init();
GLR.main = cv.getContext('2d');
{
  // every frame on Lowest: WebGL layer first, then the (see-through) 2D layer
  const _render = render;
  render = function (title) {
    if (!GLR.want()) { GLR.off(); return _render.apply(this, arguments); }
    GLR.begin();
    try { return _render.apply(this, arguments); } finally { GLR.end(); }
  };
}
