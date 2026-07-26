/**
 * Status Ring — compact circular progress indicator.
 * Ported from Zephyr, adapted to TypeScript.
 *
 * States: idle → progress(percent) / indeterminate(spin) → success / error
 */

const SVG_NS = 'http://www.w3.org/2000/svg';
const RADIUS = 16;
const CIRC = 2 * Math.PI * RADIUS;
const COLOR_SUCCESS = '#3ecf8e';
const COLOR_ERROR = '#ec6b5e';

let _gradSeq = 0;

export interface StatusRingOptions {
  revertDelay?: number;
}

export interface StatusRing {
  show: () => void;
  hide: () => void;
  setProgress: (percent: number) => void;
  setIndeterminate: () => void;
  setSuccess: () => void;
  setError: () => void;
  destroy: () => void;
}

export function createStatusRing(buttonEl: HTMLElement, opts: StatusRingOptions = {}): StatusRing {
  const parent = buttonEl?.parentNode;
  if (!parent) {
    const noop = () => {};
    return { show: noop, hide: noop, setProgress: noop, setIndeterminate: noop, setSuccess: noop, setError: noop, destroy: noop };
  }
  const revertDelay = opts.revertDelay ?? 3000;
  const gradId = `aevum-sr-grad-${++_gradSeq}`;

  const zone = document.createElement('div');
  zone.className = 'aevum-sr-zone';
  zone.style.display = 'none';

  const wrap = document.createElement('div');
  wrap.className = 'aevum-sr-wrap';

  const svg = document.createElementNS(SVG_NS, 'svg') as SVGSVGElement;
  svg.setAttribute('class', 'aevum-sr-svg');
  svg.setAttribute('width', '40');
  svg.setAttribute('height', '40');
  svg.setAttribute('viewBox', '0 0 40 40');
  svg.style.transform = 'rotate(-90deg)';

  const defs = document.createElementNS(SVG_NS, 'defs');
  const grad = document.createElementNS(SVG_NS, 'linearGradient');
  grad.setAttribute('id', gradId);
  grad.setAttribute('x1', '0');
  grad.setAttribute('y1', '0');
  grad.setAttribute('x2', '1');
  grad.setAttribute('y2', '1');
  const stop1 = document.createElementNS(SVG_NS, 'stop');
  stop1.setAttribute('offset', '0');
  stop1.setAttribute('stop-color', 'var(--accent-primary)');
  stop1.setAttribute('stop-opacity', '0.4');
  const stop2 = document.createElementNS(SVG_NS, 'stop');
  stop2.setAttribute('offset', '1');
  stop2.setAttribute('stop-color', 'var(--accent-primary)');
  grad.appendChild(stop1);
  grad.appendChild(stop2);
  defs.appendChild(grad);
  svg.appendChild(defs);

  const track = document.createElementNS(SVG_NS, 'circle');
  track.setAttribute('cx', '20');
  track.setAttribute('cy', '20');
  track.setAttribute('r', String(RADIUS));
  track.setAttribute('fill', 'none');
  track.setAttribute('stroke', 'var(--aevum-bg-muted)');
  track.setAttribute('stroke-width', '2.5');
  svg.appendChild(track);

  const turn = document.createElementNS(SVG_NS, 'g');
  turn.setAttribute('class', 'aevum-sr-turn');

  const fill = document.createElementNS(SVG_NS, 'circle');
  fill.setAttribute('class', 'aevum-sr-fill');
  fill.setAttribute('cx', '20');
  fill.setAttribute('cy', '20');
  fill.setAttribute('r', String(RADIUS));
  fill.setAttribute('fill', 'none');
  fill.setAttribute('stroke', `url(#${gradId})`);
  fill.setAttribute('stroke-width', '3');
  fill.setAttribute('stroke-linecap', 'round');
  fill.setAttribute('stroke-dasharray', CIRC.toFixed(2));
  fill.setAttribute('stroke-dashoffset', CIRC.toFixed(2));
  turn.appendChild(fill);
  svg.appendChild(turn);
  wrap.appendChild(svg);

  const center = document.createElement('div');
  center.className = 'aevum-sr-center';
  center.textContent = '—';
  wrap.appendChild(center);
  zone.appendChild(wrap);
  parent.insertBefore(zone, buttonEl.nextSibling);

  let revertTimer: ReturnType<typeof setTimeout> | null = null;

  const clearRevert = () => {
    if (revertTimer) {
      clearTimeout(revertTimer);
      revertTimer = null;
    }
  };

  const resetStroke = () => {
    fill.style.stroke = '';
    fill.setAttribute('stroke', `url(#${gradId})`);
  };

  const setOffset = (fraction: number) => {
    fill.setAttribute('stroke-dashoffset', (CIRC * (1 - Math.max(0, Math.min(1, fraction)))).toFixed(2));
  };

  const showIcon = (kind: 'check' | 'cross', color: string) => {
    center.replaceChildren();
    center.style.color = color;
    const iconSvg = document.createElementNS(SVG_NS, 'svg');
    iconSvg.setAttribute('class', 'aevum-sr-icon');
    iconSvg.setAttribute('viewBox', '0 0 24 24');
    iconSvg.setAttribute('width', '16');
    iconSvg.setAttribute('height', '16');

    if (kind === 'check') {
      const p = document.createElementNS(SVG_NS, 'path');
      p.setAttribute('d', 'M5 13 L10 18 L19 7');
      p.setAttribute('fill', 'none');
      p.setAttribute('stroke', 'currentColor');
      p.setAttribute('stroke-width', '2.5');
      p.setAttribute('stroke-linecap', 'round');
      p.setAttribute('stroke-linejoin', 'round');
      p.style.strokeDasharray = '30';
      p.style.strokeDashoffset = '30';
      p.style.animation = 'aevum-sr-draw 0.45s cubic-bezier(0.65,0,0.35,1) forwards';
      iconSvg.appendChild(p);
    } else {
      const l1 = document.createElementNS(SVG_NS, 'line');
      l1.setAttribute('x1', '7');
      l1.setAttribute('y1', '7');
      l1.setAttribute('x2', '17');
      l1.setAttribute('y2', '17');
      l1.setAttribute('stroke', 'currentColor');
      l1.setAttribute('stroke-width', '2.5');
      l1.setAttribute('stroke-linecap', 'round');
      l1.style.strokeDasharray = '15';
      l1.style.strokeDashoffset = '15';
      l1.style.animation = 'aevum-sr-draw 0.22s cubic-bezier(0.65,0,0.35,1) forwards';
      const l2 = document.createElementNS(SVG_NS, 'line');
      l2.setAttribute('x1', '17');
      l2.setAttribute('y1', '7');
      l2.setAttribute('x2', '7');
      l2.setAttribute('y2', '17');
      l2.setAttribute('stroke', 'currentColor');
      l2.setAttribute('stroke-width', '2.5');
      l2.setAttribute('stroke-linecap', 'round');
      l2.style.strokeDasharray = '15';
      l2.style.strokeDashoffset = '15';
      l2.style.animation = 'aevum-sr-draw 0.22s cubic-bezier(0.65,0,0.35,1) 0.14s forwards';
      iconSvg.appendChild(l1);
      iconSvg.appendChild(l2);
    }
    center.appendChild(iconSvg);
  };

  const showText = (text: string) => {
    center.replaceChildren();
    center.style.color = '';
    const span = document.createElement('span');
    span.className = 'aevum-sr-pct';
    span.textContent = text;
    center.appendChild(span);
  };

  const show = () => {
    buttonEl.style.display = 'none';
    zone.style.display = 'flex';
  };

  const hide = () => {
    clearRevert();
    zone.style.display = 'none';
    buttonEl.style.display = '';
    fill.classList.remove('aevum-sr-dashing');
    turn.classList.remove('aevum-sr-spinning');
    resetStroke();
    setOffset(0);
    showText('—');
  };

  const setProgress = (percent: number) => {
    clearRevert();
    fill.classList.remove('aevum-sr-dashing');
    turn.classList.remove('aevum-sr-spinning');
    resetStroke();
    setOffset(percent / 100);
    showText(`${Math.round(percent)}%`);
  };

  const setIndeterminate = () => {
    clearRevert();
    resetStroke();
    fill.classList.add('aevum-sr-dashing');
    turn.classList.add('aevum-sr-spinning');
    center.replaceChildren();
    center.style.color = '';
  };

  const setSuccess = () => {
    clearRevert();
    fill.classList.remove('aevum-sr-dashing');
    turn.classList.remove('aevum-sr-spinning');
    fill.removeAttribute('stroke');
    fill.style.stroke = COLOR_SUCCESS;
    setOffset(1);
    showIcon('check', COLOR_SUCCESS);
    revertTimer = setTimeout(hide, revertDelay);
  };

  const setError = () => {
    clearRevert();
    fill.classList.remove('aevum-sr-dashing');
    turn.classList.remove('aevum-sr-spinning');
    fill.removeAttribute('stroke');
    fill.style.stroke = COLOR_ERROR;
    setOffset(1);
    showIcon('cross', COLOR_ERROR);
    revertTimer = setTimeout(hide, revertDelay);
  };

  const destroy = () => {
    clearRevert();
    hide();
    zone.remove();
  };

  return { show, hide, setProgress, setIndeterminate, setSuccess, setError, destroy };
}
