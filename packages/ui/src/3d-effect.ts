// @ts-check
/**
 * 3D hover effect for cards and navigation items.
 * Ported from Zephyr — uses requestAnimationFrame for smooth rendering.
 *
 * @module ui/3d-effect
 */

const leaveTimeouts = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>();

export function setup3DEffect(input: HTMLElement | NodeList | HTMLElement[]): void {
  const elements = input instanceof NodeList || Array.isArray(input) ? input : [input];

  elements.forEach((el) => {
    if (!el || !(el instanceof HTMLElement)) return;

    let frameId: number | null = null;
    let cachedRect: { left: number; top: number; width: number; height: number } | null = null;
    let transitionDisabled = false;

    const handleMouseMove = (e: MouseEvent) => {
      if (!cachedRect) return;
      if (!transitionDisabled) {
        el.style.transition = 'none';
        transitionDisabled = true;
      }
      const pageX = e.pageX;
      const pageY = e.pageY;
      if (frameId) cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(() => {
        frameId = null;
        if (!cachedRect) return;
        const x = pageX - cachedRect.left - cachedRect.width / 2;
        const y = pageY - cachedRect.top - cachedRect.height / 2;
        el.style.transform = `perspective(1000px) rotateX(${-y / 40}deg) rotateY(${x / 40}deg) translateY(-3px)`;
      });
    };

    const handleMouseEnter = () => {
      const t = leaveTimeouts.get(el);
      if (t) {
        clearTimeout(t);
        leaveTimeouts.delete(el);
      }
      transitionDisabled = false;
      const rect = el.getBoundingClientRect();
      cachedRect = {
        left: rect.left + window.scrollX,
        top: rect.top + window.scrollY,
        width: rect.width,
        height: rect.height,
      };
      el.style.willChange = 'transform';
      el.style.transition = 'transform .15s ease-out';
      el.style.transform = 'perspective(1000px) translateY(-3px)';
    };

    const handleMouseLeave = () => {
      if (frameId) cancelAnimationFrame(frameId);
      el.style.transition = 'transform .35s cubic-bezier(.22, 1, .36, 1)';
      el.style.transform = '';
      cachedRect = null;
      const prev = leaveTimeouts.get(el);
      if (prev) clearTimeout(prev);
      const t = setTimeout(() => {
        el.style.transition = '';
        el.style.willChange = '';
        leaveTimeouts.delete(el);
      }, 350);
      leaveTimeouts.set(el, t);
    };

    el.addEventListener('mouseenter', handleMouseEnter);
    el.addEventListener('mousemove', handleMouseMove as EventListener);
    el.addEventListener('mouseleave', handleMouseLeave);
  });
}
