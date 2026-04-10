import { Panel } from '@/components/Panel';
import { escapeHtml } from '@/utils/sanitize';
import { fetchHormuzTracker } from '@/services/hormuz-tracker';
import type { HormuzTrackerData, HormuzChart, HormuzSeries } from '@/services/hormuz-tracker';

const CHART_COLORS = ['#e67e22', '#1abc9c', '#9b59b6', '#27ae60'];
const ZERO_COLOR = 'rgba(231,76,60,0.5)';

function unitForLabel(label: string): string {
  switch (label) {
    case 'crude_oil': return 'mb/d';
    case 'lng': return 'bcf/d';
    case 'fertilizer': return 'mt/d';
    case 'transits': return 'units';
    default: return 'units';
  }
}

function decimalsForLabel(label: string): number {
  switch (label) {
    case 'crude_oil': return 1;
    case 'lng': return 1;
    case 'fertilizer': return 2;
    case 'transits': return 0;
    default: return 0;
  }
}

function statusColor(status: string): string {
  switch (status) {
    case 'closed':     return '#e74c3c';
    case 'disrupted':  return '#e67e22';
    case 'restricted': return '#f39c12';
    default:           return '#2ecc71';
  }
}

function barChart(series: HormuzSeries[], color: string, unit: string, width: number, height = 56): string {
  if (!series.length) return `<div style="height:${height}px;display:flex;align-items:center;color:var(--text-dim);font-size:10px">No data</div>`;

  const max = Math.max(...series.map(p => p.value), 1);
  const len = Math.max(1, series.length);
  const step = width / len;
  const barW = Math.max(1, Math.floor(step * 0.85));
  const gap = Math.max(0, Math.floor(step - barW));

  let x = 0;
  const rects = series.map(p => {
    const h = Math.max(p.value > 0 ? 2 : 1, Math.round((p.value / max) * (height - 2)));
    const fill = p.value === 0 ? ZERO_COLOR : color;
    const rect = `<rect x="${x}" y="${height - h}" width="${barW}" height="${h}" fill="${fill}" rx="1"/>`;
    x += barW + gap;
    return rect;
  });

  x = 0;
  const hits = series.map(p => {
    const hit = `<rect class="hbar" x="${x}" y="0" width="${barW}" height="${height}" fill="transparent" data-date="${escapeHtml(p.date)}" data-val="${p.value}" data-unit="${escapeHtml(unit)}" style="cursor:crosshair"/>`;
    x += barW + gap;
    return hit;
  });

  return `<svg class="hz-svg" viewBox="0 0 ${width} ${height}" width="100%" height="${height}" preserveAspectRatio="none" style="display:block;overflow:visible">${rects.join('')}${hits.join('')}</svg>`;
}

function renderChart(chart: HormuzChart, idx: number, width: number): string {
  const color = CHART_COLORS[idx % CHART_COLORS.length] ?? '#3498db';
  const last = chart.series[chart.series.length - 1];
  const decimals = decimalsForLabel(chart.label);
  const lastVal = last ? Number(last.value).toFixed(decimals) : 'N/A';
  const lastDate = last ? last.date.slice(5) : '';
  const unit = unitForLabel(chart.label);

  return `
    <div class="hz-chart">
      <div class="hz-chart-head">
        <span class="hz-chart-title">${escapeHtml(chart.title)}</span>
        <span class="hz-chart-last" style="color:${color}">${escapeHtml(lastVal)} <span class="hz-chart-meta">${unit} · ${escapeHtml(lastDate)}</span></span>
      </div>
      <div class="hz-chart-body">${barChart(chart.series, color, unit, width)}</div>
    </div>`;
}

export class HormuzPanel extends Panel {
  private data: HormuzTrackerData | null = null;
  private tooltipBound = false;
  private chartWidth = 520;
  private ro: ResizeObserver | null = null;

  constructor() {
    super({ id: 'hormuz-tracker', title: 'Hormuz Trade Tracker' });
    if (typeof ResizeObserver !== 'undefined') {
      this.ro = new ResizeObserver(() => {
        if (!this.data) return;
        const w = this.getTargetChartWidth();
        if (Math.abs(w - this.chartWidth) < 24) return;
        this.chartWidth = w;
        this.renderPanel();
      });
      this.ro.observe(this.element);
    }
  }

  public async fetchData(): Promise<boolean> {
    this.showLoading();
    try {
      const data = await fetchHormuzTracker();
      if (!data) {
        this.showError('Hormuz data unavailable', () => void this.fetchData());
        return false;
      }
      this.data = data;
      this.renderPanel();
      this.bindTooltip();
      return true;
    } catch (e) {
      this.showError(e instanceof Error ? e.message : 'Failed to load', () => void this.fetchData());
      return false;
    }
  }

  private bindTooltip(): void {
    if (this.tooltipBound || !this.element) return;
    this.tooltipBound = true;

    this.element.addEventListener('mousemove', (e: Event) => {
      const target = e.target as Element;
      if (!target.classList?.contains('hbar')) return;
      const date = (target.getAttribute('data-date') ?? '').slice(5);
      const val = target.getAttribute('data-val') ?? '';
      const unit = target.getAttribute('data-unit') ?? '';
      const tip = this.element?.querySelector<HTMLElement>('.hz-tip');
      if (!tip) return;
      const barRect = (target as SVGRectElement).getBoundingClientRect();
      tip.style.left = `${barRect.left + barRect.width / 2}px`;
      tip.style.top = `${Math.max(8, barRect.top - 28)}px`;
      tip.style.transform = 'translateX(-50%)';
      tip.style.opacity = '1';
      tip.textContent = `${date}  ${val} ${unit}`;
    });

    this.element.addEventListener('mouseleave', () => {
      const tip = this.element?.querySelector<HTMLElement>('.hz-tip');
      if (tip) tip.style.opacity = '0';
    });
  }

  private renderPanel(): void {
    if (!this.data) return;
    const d = this.data;
    const sColor = statusColor(d.status);

    this.chartWidth = this.getTargetChartWidth();
    const charts = d.charts.length
      ? d.charts.map((c, i) => renderChart(c, i, this.chartWidth)).join('')
      : '<div style="color:var(--text-dim);font-size:11px;padding:8px 0">Chart data unavailable</div>';

    const dateStr = d.updatedDate ? `<span style="font-size:10px;color:var(--text-dim)">${escapeHtml(d.updatedDate)}</span>` : '';
    const summary = d.summary ? `<div class="hz-summary">${escapeHtml(d.summary)}</div>` : '';

    const html = `
      <div class="hz-root">
        <div class="hz-tip" style="position:fixed;pointer-events:none;background:rgba(15,17,26,0.95);border:1px solid rgba(255,255,255,0.15);border-radius:4px;padding:3px 8px;font-size:10px;color:#fff;white-space:nowrap;z-index:9999;opacity:0;transition:opacity 0.08s;letter-spacing:0.02em"></div>
        <div class="hz-top">
          <div class="hz-badges">
            <span class="hz-status" style="background:${sColor}">${d.status.toUpperCase()}</span>
            ${dateStr}
          </div>
          ${summary}
        </div>
        <div class="hz-charts">${charts}</div>
        <div class="hz-source">
          Source: <a href="${escapeHtml(d.attribution.url)}" target="_blank" rel="noopener">${escapeHtml(d.attribution.source)}</a>
        </div>
      </div>`;

    this.setContent(html);
  }

  private getTargetChartWidth(): number {
    const hostW = Math.max(320, Math.floor(this.element.getBoundingClientRect().width));
    // minus panel padding
    const w = Math.max(320, hostW - 44);
    // keep reasonable on ultra-wide; charts look better with some max
    return Math.min(980, w);
  }

  public override destroy(): void {
    try { this.ro?.disconnect(); } catch {}
    this.ro = null;
    super.destroy();
  }
}