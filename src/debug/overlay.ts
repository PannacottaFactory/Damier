/**
 * Overlay de debug (F1) : un simple <pre> en DOM au-dessus du canvas,
 * rafraîchi ~10 fois par seconde pour ne pas peser sur le rendu.
 * Les commandes de triche (I, 1–9, N, ralenti) arriveront avec les étapes concernées.
 */
export type DebugInfo = Record<string, string | number>;

export class DebugOverlay {
  private readonly el: HTMLPreElement;
  private visible = false;
  private frames = 0;
  private fpsWindowStart = performance.now();
  private fps = 0;
  private lastPaint = 0;

  constructor() {
    this.el = document.createElement('pre');
    Object.assign(this.el.style, {
      position: 'fixed',
      top: '12px',
      left: '12px',
      margin: '0',
      padding: '10px 12px',
      font: '12px/1.45 "JetBrains Mono", ui-monospace, Consolas, monospace',
      color: '#c8ffd4',
      background: 'rgba(0, 0, 0, 0.6)',
      border: '1px solid rgba(200, 255, 212, 0.25)',
      borderRadius: '6px',
      pointerEvents: 'none',
      whiteSpace: 'pre',
      display: 'none',
      zIndex: '10',
    } satisfies Partial<CSSStyleDeclaration>);
    document.body.appendChild(this.el);
  }

  get isVisible(): boolean {
    return this.visible;
  }

  toggle(): void {
    this.visible = !this.visible;
    this.el.style.display = this.visible ? 'block' : 'none';
  }

  /** À appeler à chaque frame ; `info` n'est évalué que lors d'un rafraîchissement. */
  frame(info: () => DebugInfo): void {
    // Mesure du FPS réel (performance.now sert ici uniquement à mesurer, jamais à piloter le jeu).
    const t = performance.now();
    this.frames++;
    if (t - this.fpsWindowStart >= 500) {
      this.fps = (this.frames * 1000) / (t - this.fpsWindowStart);
      this.frames = 0;
      this.fpsWindowStart = t;
    }
    if (!this.visible || t - this.lastPaint < 100) return;
    this.lastPaint = t;

    const data: DebugInfo = { FPS: this.fps.toFixed(0), ...info() };
    const width = Math.max(...Object.keys(data).map((k) => k.length));
    this.el.textContent = Object.entries(data)
      .map(([k, v]) => `${k.padEnd(width)}  ${v}`)
      .join('\n');
  }
}
