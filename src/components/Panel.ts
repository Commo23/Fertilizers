export interface PanelOptions {
  id: string;
  title: string;
  className?: string;
  /** WorldMonitor panels support a close control; embedded page omits it. */
  closable?: boolean;
  /**
   * Some WorldMonitor panels expose a live count badge.
   * Kept for compatibility; badge is only rendered when panel calls insertLiveCountBadge().
   */
  showCount?: boolean;
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

  protected setContent(html: string): void {
    this.content.innerHTML = html;
  }

  protected showLoading(message = 'Loading…'): void {
    this.setContent(
      `<div style="padding:14px;color:hsl(var(--muted-foreground));font-size:12px">${message}</div>`,
    );
  }

  protected showError(message: string, onRetry?: () => void): void {
    this.setContent(
      `<div style="padding:14px;display:flex;flex-direction:column;gap:10px">
        <div style="color:hsl(var(--destructive));font-weight:600;font-size:12px">Error</div>
        <div style="color:hsl(var(--muted-foreground));font-size:12px">${message}</div>
        ${onRetry ? `<button class="wm-panel-retry" style="align-self:flex-start;padding:6px 10px;border-radius:6px;border:1px solid hsl(var(--border));background:hsl(var(--card));color:hsl(var(--foreground));cursor:pointer;font-size:12px">Retry</button>` : ''}
      </div>`,
    );

    if (!onRetry) return;
    const btn = this.content.querySelector<HTMLButtonElement>('.wm-panel-retry');
    if (btn) btn.onclick = onRetry;
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
