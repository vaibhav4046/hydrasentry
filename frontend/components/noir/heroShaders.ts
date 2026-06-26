/**
 * GLSL (ES 3.00 / WebGL2) shader sources for the monochrome GPU particle hero.
 *
 * STRICT MONOCHROME: the fragment shader only ever varies WHITE intensity, no
 * hue, ever. "Danger" (tainted chain) is brighter + faster, not coloured.
 *
 * VERTEX, per-point animation, all on the GPU from immutable base attributes +
 * a handful of uniforms (one rAF only updates uTime/uMouse/uStage/uHover):
 *   • viewBox → clip mapping (same 1000x720 space as the badge overlay).
 *   • organic CURL/SIMPLEX noise drift (continuous shimmer; never keyframed).
 *   • EDGE flow: a luminous packet travels core→node along each spoke (memories
 *     streaming); tainted spokes flow faster.
 *   • MOUSE displacement/attraction (points near the cursor bend + brighten) and
 *     a whole-field PARALLAX tilt by depth (near layers shift more).
 *   • slow BREATHING scale on the core.
 *   • gl_PointSize scales by depth (z) → real depth/parallax + depth-of-field.
 * It passes a per-point brightness + softness to the fragment via varyings.
 *
 * FRAGMENT, soft round sprite (radial alpha falloff) for natural additive bloom
 * (renderer uses gl.blendFunc(ONE, ONE)); brightness from depth + tainted, with
 * a touch of core-distance lift. Discards fully-transparent corners cheaply.
 */

export const HERO_VERT = /* glsl */ `#version 300 es
precision highp float;

// immutable per-point attributes (see heroFieldGeo.ts)
in vec3 aBase;   // (x, y) viewBox pos, z depth [-1..1]
in vec4 aRnd;    // (phase, sizeSeed, brightSeed, driftSeed)
in vec4 aMeta;   // (kind, anchorIndex, tainted, flow)

uniform vec2  uViewBox;    // (1000, 720)
uniform vec2  uResolution; // device px (for point-size DPR scaling)
uniform float uTime;       // seconds
uniform vec2  uMouse;      // smoothed pointer, normalised -1..1 (centre origin)
uniform vec2  uMousePx;    // smoothed pointer in viewBox space (for attraction)
uniform float uMouseActive;// 0..1 presence
uniform float uStage;      // active demo stage (-1 = show all)
uniform float uHover;      // hovered anchor index (-1 = none)
uniform float uAnchorStage[16]; // per-anchor reveal stage (indexed by anchorIndex)
uniform float uBreath;     // 0..1 breathing phase (precomputed on CPU, cheap)
uniform float uDpr;        // device pixel ratio (capped)
uniform float uReduced;    // 1.0 => reduced-motion: freeze drift/flow
uniform float uCorePulse;  // 0..1 extra core energy while a demo runs

out float vBright;  // 0..1 brightness handed to the fragment
out float vSoft;    // softness 0..1 (far = softer falloff → DoF)
out float vTaint;   // tainted flag passthrough (subtle warm-white lift only)

// ---- hash + 3D simplex-ish noise (Ashima-style, compact) -------------------
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0);
  const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy));
  vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);
  vec3 l=1.0-g;
  vec3 i1=min(g.xyz,l.zxy);
  vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;
  vec3 x2=x0-i2+C.yyy;
  vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(
    i.z+vec4(0.0,i1.z,i2.z,1.0))
    +i.y+vec4(0.0,i1.y,i2.y,1.0))
    +i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857;
  vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z);
  vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy;
  vec4 y=y_*ns.x+ns.yyyy;
  vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);
  vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0;
  vec4 s1=floor(b1)*2.0+1.0;
  vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
  vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);
  vec3 p1=vec3(a0.zw,h.y);
  vec3 p2=vec3(a1.xy,h.z);
  vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);
  m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
// cheap curl-ish drift: gradient of two offset noise fields
vec2 curl(vec2 p, float t){
  float e=0.85;
  float n1=snoise(vec3(p*0.012, t));
  float n2=snoise(vec3(p*0.012+vec2(e), t+5.2));
  return vec2(n2, -n1);
}

void main(){
  float kind   = aMeta.x;        // 0 core,1 branch,2 edge,3 dust
  float anchor = aMeta.y;
  float taint  = aMeta.z;
  float flow   = aMeta.w;        // 0..1 along edge (edge pts)
  float phase  = aRnd.x;
  float sizeSeed = aRnd.y;
  float brightSeed = aRnd.z;
  float driftSeed = aRnd.w;

  vec2 pos = aBase.xy;
  float z  = aBase.z;            // depth -1..1
  float t  = uTime;
  float anim = 1.0 - uReduced;   // freeze motion under reduced-motion

  // ---- staged reveal: edges gated by their anchor's stage (cheap) ----------
  // A spoke's filament appears at its node's stage; before then it's dimmed and
  // pulled toward the core so a staged demo "grows" the branches outward.
  // uStage < 0 => show everything (idle hero). Core/branch/dust always shown.
  float gateBright = 1.0;
  float gateGrow = 0.0;   // 0 = at base pos, 1 = collapsed toward core
  if(uStage >= 0.0 && kind > 1.5 && kind < 2.5 && anchor >= 0.0){
    int ai = int(anchor + 0.5);
    float reveal = (ai >= 0 && ai < 16) ? uAnchorStage[ai] : 0.0;
    float on = step(reveal, uStage + 0.001);   // 1 once stage reached
    gateBright = mix(0.04, 1.0, on);
    gateGrow = 1.0 - on;
  }

  // ---- breathing core --------------------------------------------------------
  float breathe = mix(0.94, 1.10, uBreath);
  if(kind < 0.5){
    // core motes orbit the centre slowly + scale with breath
    vec2 c = uViewBox * vec2(0.5, 0.4583);  // CORE ≈ (500, 330) in 1000x720
    vec2 rel = pos - c;
    float a = (driftSeed - 0.5) * 0.5 * t * anim;  // slow swirl
    float cs = cos(a), sn = sin(a);
    rel = mat2(cs, -sn, sn, cs) * rel * breathe;
    pos = c + rel;
  }

  // ---- organic curl drift (continuous shimmer) ------------------------------
  float driftAmp = (kind < 0.5) ? 6.0 : (kind < 1.5 ? 9.0 : (kind < 2.5 ? 7.0 : 16.0));
  vec2 d = curl(pos + driftSeed * 40.0, t * 0.06 * anim) * driftAmp * anim;
  pos += d;

  // ---- edge flow: luminous packet travels core->node ------------------------
  // brightness rides a moving gaussian along the flow coord; tainted flows faster.
  float flowBright = 1.0;
  if(kind > 1.5 && kind < 2.5){
    float speed = (taint > 0.5) ? 0.42 : 0.24;
    float head = fract(t * speed * anim + phase);          // packet position 0..1
    float dd = abs(flow - head);
    dd = min(dd, 1.0 - dd);                                 // wrap
    float packet = exp(-dd * dd * 55.0);                    // tight luminous packet
    // keep a baseline so the filament reads end-to-end (memories streaming, not blinking)
    flowBright = mix(taint > 0.5 ? 0.5 : 0.32, 1.0, packet);
    // staged reveal for spokes: hide until the node's stage (handled via uStage on CPU-set ANCHOR_STAGE not available here; approximate with anchor presence)
  }

  // ---- mouse attraction: bend + brighten near the cursor --------------------
  float glow = 0.0;
  if(uMouseActive > 0.01){
    vec2 toM = uMousePx - pos;
    float dist = length(toM);
    float R = 240.0;
    if(dist < R){
      float k = 1.0 - dist / R;
      k = k * k * uMouseActive;
      pos += normalize(toM + 1e-4) * k * 18.0;              // gentle bend toward cursor
      glow = k;
    }
  }

  // ---- hovered node: its whole filament brightens ---------------------------
  float hoverLift = 0.0;
  if(uHover >= 0.0 && abs(anchor - uHover) < 0.5){
    hoverLift = 0.6;
  }

  // ---- staged grow: collapse not-yet-revealed spokes toward the core --------
  if(gateGrow > 0.0){
    vec2 c = uViewBox * vec2(0.5, 0.4583);
    pos = mix(pos, c, gateGrow * 0.92);
  }

  // ---- whole-field parallax tilt by depth -----------------------------------
  // near layers (z>0) shift further; field leans INTO the cursor like a window.
  float parAmt = mix(4.0, 26.0, clamp(z * 0.5 + 0.5, 0.0, 1.0));
  pos += -uMouse * parAmt;

  // ---- viewBox -> clip space -------------------------------------------------
  vec2 clip = (pos / uViewBox) * 2.0 - 1.0;
  clip.y = -clip.y;                                          // flip Y (screen down)
  gl_Position = vec4(clip, 0.0, 1.0);

  // ---- point size by depth + DPR (depth-of-field) ---------------------------
  float depth01 = clamp(z * 0.5 + 0.5, 0.0, 1.0);
  float baseSize = mix(1.1, 3.2, sizeSeed);                  // per-point base
  float depthScale = mix(0.55, 1.55, depth01);               // far smaller, near bigger
  float twinkle = anim > 0.5 ? (0.82 + 0.18 * sin(t * 1.7 + phase * 30.0)) : 1.0;
  float coreBreath = (kind < 0.5) ? mix(0.92, 1.12, uBreath) : 1.0;
  float size = baseSize * depthScale * twinkle * coreBreath;
  size *= (1.0 + glow * 0.9 + hoverLift * 0.7);
  // tainted motes a touch larger so the danger chain reads as denser
  size *= (taint > 0.5 ? 1.18 : 1.0);
  gl_PointSize = size * uDpr;

  // ---- brightness handed to the fragment ------------------------------------
  float b = brightSeed;
  b *= mix(0.5, 1.0, depth01);                               // far dimmer (DoF)
  b *= flowBright * gateBright;
  b += glow * 0.55 + hoverLift * 0.5;
  // tainted chain hotter, and hotter still while a demo runs (uCorePulse)
  if(taint > 0.5) b = mix(b, 1.0, 0.45 + 0.35 * uCorePulse);
  // core energy lift during a run
  if(kind < 0.5) b += uCorePulse * 0.25 * (1.0 - depth01 * 0.5);
  vBright = clamp(b, 0.0, 1.3);
  vSoft = mix(0.5, 1.0, 1.0 - depth01);                      // far → softer sprite
  vTaint = taint;
}
`;

export const HERO_FRAG = /* glsl */ `#version 300 es
precision highp float;

in float vBright;
in float vSoft;
in float vTaint;

uniform float uExposure;   // global intensity trim (keeps additive bloom in check)
uniform float uTimeF;      // time (seconds) for animated film grain
uniform vec2  uResolutionF;// device px, for grain coordinates

out vec4 fragColor;

// cheap hash for per-fragment film grain (monochrome, no texture/data-URI, so
// it cannot fail to decode at any DPR the way a CSS noise background can).
float hash21(vec2 p){
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

void main(){
  // round sprite: radial falloff from point centre
  vec2 uv = gl_PointCoord * 2.0 - 1.0;
  float r = dot(uv, uv);
  if(r > 1.0) discard;                       // cheap circular clip
  // soft gaussian-ish core; far points (vSoft high) fall off softer (DoF haze)
  float hardness = mix(3.2, 1.4, vSoft);
  float alpha = exp(-r * hardness);
  // a tiny hot core for nearer/brighter motes → crisp sparkle on additive blend
  float core = pow(max(0.0, 1.0 - r), 4.0);
  float a = (alpha * 0.85 + core * 0.5) * vBright * uExposure;

  // subtle FILM GRAIN baked into each mote, a touch of per-fragment luminance
  // jitter, animated by time. Keeps the field cinematic without a fragile CSS
  // noise layer. Monochrome (scales intensity only). Very low amplitude.
  float g = hash21(gl_FragCoord.xy + fract(uTimeF) * 91.7);
  a *= (1.0 - 0.10 + 0.10 * g);

  // STRICT MONOCHROME. Tainted motes are not coloured, only nudged toward the
  // very brightest white so the danger chain reads as the hottest part of the
  // field (intensity, never hue).
  vec3 col = vec3(1.0);
  fragColor = vec4(col * a, a);              // premultiplied-style; blend = ONE,ONE
}
`;
