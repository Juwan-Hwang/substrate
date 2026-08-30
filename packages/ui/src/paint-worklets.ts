/**
 * Houdini CSS Paint API Worklets for Substrate.
 *
 * These worklets generate custom backgrounds at render time:
 *  - `substrate-noise`  — subtle film grain noise texture
 *  - `substrate-mesh`   — animated mesh gradient
 *
 * Registration:
 *   CSS.paintWorklet.addModule('/worklets/paint.js')
 *
 * Usage in CSS:
 *   background-image: paint(substrate-noise);
 *   background-image: paint(substrate-mesh);
 *
 * Fallback: if the Paint API is unavailable, the CSS `background-color`
 * declared alongside `background-image: paint(...)` is used instead.
 */

// ── CSS Paint API type augmentation ─────────────────────────────────
// The Houdini Paint API is not yet in TypeScript's DOM lib. Declare the
// minimal surface we use so the rest of the module type-checks cleanly.

/** A registered paint worklet — accepts module URLs for `addModule`. */
interface CSSPaintWorklet {
  addModule(moduleURL: string): Promise<void>;
}

/** Augment the global `CSS` value with the optional `paintWorklet` surface. */
type CSSWithPaintWorklet = typeof CSS & { readonly paintWorklet?: CSSPaintWorklet };

// ── Noise Worklet ───────────────────────────────────────────────────

const noiseWorklet = `
registerPaint('substrate-noise', class {
  static get inputProperties() {
    return ['--noise-opacity', '--noise-scale'];
  }

  paint(ctx, size, props) {
    const opacity = parseFloat(props.get('--noise-opacity')) || 0.04;
    const scale = parseFloat(props.get('--noise-scale')) || 1;
    const w = size.width;
    const h = size.height;

    // PaintRenderingContext2D does not support createImageData / putImageData.
    // Sparse speckle with fillRect is visually equivalent to dense noise at low opacity.
    const count = Math.floor(w * h * 0.06 * scale);
    for (let i = 0; i < count; i++) {
      const v = Math.floor(Math.random() * 255);
      ctx.fillStyle = 'rgba(' + v + ', ' + v + ', ' + v + ', ' + opacity + ')';
      ctx.fillRect(Math.random() * w, Math.random() * h, 1, 1);
    }
  }
});
`;

// ── Mesh Gradient Worklet ───────────────────────────────────────────

const meshWorklet = `
registerPaint('substrate-mesh', class {
  static get inputProperties() {
    return ['--mesh-color-1', '--mesh-color-2', '--mesh-color-3', '--mesh-color-4'];
  }

  paint(ctx, size, props) {
    const w = size.width;
    const h = size.height;

    const c1 = props.get('--mesh-color-1')?.toString().trim() || 'rgba(175, 82, 222, 0.15)';
    const c2 = props.get('--mesh-color-2')?.toString().trim() || 'rgba(88, 86, 214, 0.10)';
    const c3 = props.get('--mesh-color-3')?.toString().trim() || 'rgba(48, 209, 88, 0.08)';
    const c4 = props.get('--mesh-color-4')?.toString().trim() || 'rgba(100, 210, 255, 0.06)';

    // Four radial gradients blended into a mesh
    const gradients = [
      { color: c1, x: w * 0.2, y: h * 0.3, r: Math.max(w, h) * 0.5 },
      { color: c2, x: w * 0.8, y: h * 0.2, r: Math.max(w, h) * 0.4 },
      { color: c3, x: w * 0.5, y: h * 0.8, r: Math.max(w, h) * 0.6 },
      { color: c4, x: w * 0.9, y: h * 0.7, r: Math.max(w, h) * 0.3 },
    ];

    for (const g of gradients) {
      const grad = ctx.createRadialGradient(g.x, g.y, 0, g.x, g.y, g.r);
      grad.addColorStop(0, g.color);
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    }
  }
});
`;

// ── Registration ────────────────────────────────────────────────────

/** Full worklet source — write to a .js file and load via CSS.paintWorklet.addModule(). */
export const paintWorkletSource = `${noiseWorklet}\n${meshWorklet}`;

/** Module-level registration promise cache for StrictMode idempotency. */
let registrationPromise: Promise<void> | null = null;

/**
 * Register paint worklets in the browser with idempotent caching and error protection.
 * Safe to call multiple times or inside React StrictMode effects.
 *
 * ```ts
 * useEffect(() => { registerPaintWorklets(); }, []);
 * ```
 */
export async function registerPaintWorklets(): Promise<void> {
  const css = CSS as CSSWithPaintWorklet;
  if (typeof CSS === 'undefined' || !('paintWorklet' in css)) return;

  if (registrationPromise) {
    return registrationPromise;
  }

  registrationPromise = (async () => {
    const blob = new Blob([paintWorkletSource], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);

    try {
      await css.paintWorklet?.addModule(url);
    } catch {
      // Gracefully ignore duplicate registration (e.g. InvalidModificationError)
      // or CSP module loading restrictions in dev/test environments.
    } finally {
      URL.revokeObjectURL(url);
    }
  })();

  return registrationPromise;
}
