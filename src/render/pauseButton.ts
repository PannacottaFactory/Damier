/**
 * Bouton pause à l'écran (coin supérieur droit). En DOM plutôt que dans le canvas :
 * accessible, cliquable/tapable sans gérer de hit-test, et hors de la zone de swipe.
 */
export class PauseButton {
  private readonly el: HTMLButtonElement;

  constructor(onClick: () => void) {
    this.el = document.createElement('button');
    this.el.type = 'button';
    Object.assign(this.el.style, {
      position: 'fixed',
      top: '14px',
      right: '14px',
      width: '44px',
      height: '44px',
      padding: '0',
      display: 'none',
      alignItems: 'center',
      justifyContent: 'center',
      font: '700 16px "JetBrains Mono", ui-monospace, monospace',
      color: '#e8ecff',
      background: 'rgba(10, 14, 40, 0.55)',
      border: '1px solid rgba(45, 226, 230, 0.55)',
      borderRadius: '8px',
      boxShadow: '0 0 12px rgba(45, 226, 230, 0.35)',
      cursor: 'pointer',
      zIndex: '20',
      touchAction: 'manipulation',
    } satisfies Partial<CSSStyleDeclaration>);
    // Le bouton ne doit pas déclencher de swipe ni voler le focus clavier au jeu.
    this.el.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.el.addEventListener('click', (e) => {
      e.preventDefault();
      onClick();
      this.el.blur();
    });
    document.body.appendChild(this.el);
    this.set(false);
  }

  show(): void {
    this.el.style.display = 'flex';
  }

  set(paused: boolean): void {
    this.el.textContent = paused ? '▶' : '❚❚';
    this.el.setAttribute('aria-label', paused ? 'Reprendre' : 'Pause');
    this.el.title = paused ? 'Reprendre (Échap / P)' : 'Pause (Échap / P)';
  }
}
