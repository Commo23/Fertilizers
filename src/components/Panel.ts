export interface PanelOptions {
  id: string;
  title: string;
  className?: string;
  /** WorldMonitor panels support a close control; embedded page omits it. */
  closable?: boolean;
}

/**
 * Minimal panel shell for LiveNewsPanel (WorldMonitor-style imperative UI).
 */
export class Panel {
  protected element: HTMLElement;
  protected content: HTMLElement;
  protected header: HTMLElement;
  protected panelId: string;

  constructor(options: PanelOptions) {
    this.panelId = options.id;
    this.element = document.createElement('div');
    this.element.className = `wm-live-panel panel ${options.className || ''}`.trim();
    this.element.dataset.panel = options.id;

    this.header = document.createElement('div');
    this.header.className = 'panel-header';

    const headerLeft = document.createElement('div');
    headerLeft.className = 'panel-header-left';

    const title = document.createElement('span');
    title.className = 'panel-title';
    title.textContent = options.title;
    headerLeft.appendChild(title);

    this.header.appendChild(headerLeft);

    this.content = document.createElement('div');
    this.content.className = 'panel-content';
    this.content.id = `${options.id}Content`;

    this.element.appendChild(this.header);
    this.element.appendChild(this.content);
  }

  public getElement(): HTMLElement {
    return this.element;
  }

  protected insertLiveCountBadge(count: number): void {
    const headerLeft = this.header.querySelector('.panel-header-left');
    if (!headerLeft) return;
    const badge = document.createElement('span');
    badge.className = 'panel-live-count';
    badge.textContent = `${count}`;
    headerLeft.appendChild(badge);
  }

  public destroy(): void {
    this.element.remove();
  }
}
