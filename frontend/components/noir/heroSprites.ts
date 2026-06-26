/**
 * Pre-rendered offscreen sprites + textures for the hero canvas. Building these
 * ONCE and blitting them with globalCompositeOperation="lighter" is what keeps
 * additive bloom cheap, no per-particle shadowBlur (which is brutally slow).
 * All monochrome.
 */

/** A soft radial glow sprite (square, transparent edges). */
export function makeRadialSprite(
  size: number,
  stops: Array<[number, string]>,
): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const g = c.getContext("2d");
  if (g) {
    const grad = g.createRadialGradient(
      size / 2,
      size / 2,
      0,
      size / 2,
      size / 2,
      size / 2,
    );
    for (const [stop, color] of stops) grad.addColorStop(stop, color);
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
  }
  return c;
}

/** The standard set of glow sprites the renderer reuses. */
export interface HeroSprites {
  /** tight bright dot, particles. */
  dot: HTMLCanvasElement;
  /** soft wide halo, core volumetric body. */
  halo: HTMLCanvasElement;
  /** small hot kernel, dense core centre. */
  kernel: HTMLCanvasElement;
}

export function makeHeroSprites(): HeroSprites {
  return {
    dot: makeRadialSprite(64, [
      [0.0, "rgba(255,255,255,1)"],
      [0.32, "rgba(255,255,255,0.62)"],
      [0.7, "rgba(228,234,242,0.14)"],
      [1.0, "rgba(255,255,255,0)"],
    ]),
    halo: makeRadialSprite(512, [
      [0.0, "rgba(255,255,255,0.55)"],
      [0.12, "rgba(236,240,248,0.34)"],
      [0.34, "rgba(196,206,222,0.16)"],
      [0.62, "rgba(150,162,182,0.05)"],
      [1.0, "rgba(0,0,0,0)"],
    ]),
    kernel: makeRadialSprite(256, [
      [0.0, "rgba(255,255,255,1)"],
      [0.2, "rgba(255,255,255,0.7)"],
      [0.5, "rgba(232,238,246,0.2)"],
      [1.0, "rgba(255,255,255,0)"],
    ]),
  };
}

/**
 * A tileable film-grain texture (monochrome noise) drawn at low opacity over the
 * whole frame for cinematic texture. Seeded so it's deterministic; size kept
 * small and tiled via pattern so it costs almost nothing per frame.
 */
export function makeGrainTexture(size = 128, seed = 0x9e37): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const g = c.getContext("2d");
  if (g) {
    const img = g.createImageData(size, size);
    let a = seed >>> 0;
    const rnd = () => {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.floor(rnd() * 255);
      img.data[i] = v;
      img.data[i + 1] = v;
      img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }
  return c;
}
