import { formatCompact, formatNumber, formatPercent, prettifyColumn } from "./analysis.js";

export const CLUSTER_COLORS = ["#2f6f68", "#d95f4f", "#3f5f9e", "#c58b2d", "#6f8d3b", "#7a5c99"];

export function renderChartCopy(container, title, explanation, how, takeaway) {
  container.innerHTML = `
    <h3>${escapeHtml(title)}</h3>
    <p>${escapeHtml(explanation)}</p>
    <p class="how"><strong>How to read this chart:</strong> ${escapeHtml(how)}</p>
    <p class="takeaway"><strong>Key takeaway:</strong> ${escapeHtml(takeaway)}</p>
  `;
}

export function renderMetricCards(container, cards) {
  container.innerHTML = cards
    .map(
      (card) => `
        <article class="metric-card">
          <div class="metric-label">${escapeHtml(card.label)}</div>
          <div class="metric-value">${escapeHtml(card.value)}</div>
          <p class="metric-note">${escapeHtml(card.note ?? "")}</p>
        </article>
      `,
    )
    .join("");
}

export function renderEmpty(container, message) {
  container.innerHTML = `<div class="chart-empty">${escapeHtml(message)}</div>`;
}

export function renderBarChart(container, data, options = {}) {
  if (!data?.length) return renderEmpty(container, "No values available for this chart.");
  const width = 720;
  const height = options.height ?? Math.max(240, data.length * 34 + 80);
  const margin = { top: 18, right: 28, bottom: 46, left: options.left ?? 150 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const max = Math.max(...data.map((item) => item.value ?? item.count), 1);
  const barHeight = innerHeight / data.length;
  const color = options.color ?? "#2f6f68";

  const svg = createSvg(width, height);
  const group = svgEl("g", { transform: `translate(${margin.left},${margin.top})` });
  svg.appendChild(group);

  data.forEach((item, index) => {
    const value = item.value ?? item.count;
    const y = index * barHeight + 3;
    const barWidth = (value / max) * innerWidth;
    const rect = svgEl("rect", {
      x: 0,
      y,
      width: Math.max(1, barWidth),
      height: Math.max(6, barHeight - 6),
      rx: 5,
      fill: item.color ?? color,
    });
    rect.appendChild(svgEl("title", {}, `${item.label}: ${formatNumber(value)}`));
    group.appendChild(rect);
    group.appendChild(
      svgEl(
        "text",
        { x: -10, y: y + Math.max(6, barHeight - 6) / 2 + 4, "text-anchor": "end", class: "tick-label" },
        truncate(item.label, 22),
      ),
    );
    const labelInside = barWidth > innerWidth - 82;
    group.appendChild(
      svgEl(
        "text",
        {
          x: labelInside ? Math.max(12, barWidth - 7) : barWidth + 7,
          y: y + Math.max(6, barHeight - 6) / 2 + 4,
          "text-anchor": labelInside ? "end" : "start",
          class: labelInside ? "bar-label-invert" : "bar-label",
        },
        options.valueFormatter ? options.valueFormatter(value, item) : formatCompact(value),
      ),
    );
  });

  group.appendChild(svgEl("line", { x1: 0, y1: innerHeight + 6, x2: innerWidth, y2: innerHeight + 6, class: "grid-line" }));
  container.replaceChildren(svg);
}

export function renderHistogram(container, bins, options = {}) {
  if (!bins?.length) return renderEmpty(container, "No numeric values available for this feature.");
  const width = 720;
  const height = 300;
  const margin = { top: 20, right: 24, bottom: 72, left: 56 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const max = Math.max(...bins.map((bin) => bin.count), 1);
  const barWidth = innerWidth / bins.length;
  const svg = createSvg(width, height);
  const group = svgEl("g", { transform: `translate(${margin.left},${margin.top})` });
  svg.appendChild(group);

  // Y-axis grid lines and tick labels
  const yTicks = niceTickCount(max);
  for (let i = 0; i <= yTicks; i += 1) {
    const tickValue = Math.round((max / yTicks) * i);
    const y = innerHeight - (tickValue / max) * innerHeight;
    group.appendChild(svgEl("line", { x1: 0, y1: y, x2: innerWidth, y2: y, class: "grid-line" }));
    group.appendChild(
      svgEl(
        "text",
        { x: -8, y: y + 4, "text-anchor": "end", class: "tick-label" },
        formatCompact(tickValue),
      ),
    );
  }

  bins.forEach((bin, index) => {
    const heightValue = (bin.count / max) * innerHeight;
    const x = index * barWidth + 2;
    const y = innerHeight - heightValue;
    const rect = svgEl("rect", {
      x,
      y,
      width: Math.max(1, barWidth - 4),
      height: Math.max(1, heightValue),
      rx: 4,
      fill: options.color ?? "#3f5f9e",
    });
    rect.appendChild(svgEl("title", {}, `${bin.label}: ${formatNumber(bin.count)} rows`));
    group.appendChild(rect);
    // Show x-axis labels: at most ~8 labels, rotated to avoid overlap
    const maxLabels = Math.min(bins.length, 8);
    const labelStep = Math.max(1, Math.ceil(bins.length / maxLabels));
    if (index % labelStep === 0 || index === bins.length - 1) {
      const label = svgEl(
        "text",
        {
          x: x + barWidth / 2,
          y: innerHeight + 16,
          "text-anchor": "end",
          class: "tick-label",
          transform: `rotate(-35 ${x + barWidth / 2} ${innerHeight + 16})`,
        },
        formatCompact(bin.x0),
      );
      group.appendChild(label);
    }
  });

  group.appendChild(svgEl("line", { x1: 0, y1: innerHeight, x2: innerWidth, y2: innerHeight, class: "grid-line" }));
  group.appendChild(svgEl("text", { x: innerWidth / 2, y: innerHeight + 58, "text-anchor": "middle", class: "axis-label" }, prettifyColumn(options.column ?? "")));
  group.appendChild(svgEl("text", { x: -42, y: innerHeight / 2, transform: `rotate(-90,-42,${innerHeight / 2})`, "text-anchor": "middle", class: "axis-label" }, "Rows"));
  container.replaceChildren(svg);
}

export function renderHeatmap(container, heatmap, options = {}) {
  if (!heatmap?.rows?.length || !heatmap?.columns?.length) {
    return renderEmpty(container, "No matrix values available.");
  }
  const cellSize = options.cellSize ?? 46;
  const left = options.left ?? 150;
  const top = options.top ?? 72;
  const scaleBarWidth = 18;
  const scaleBarGap = 24;
  const scaleBarLabelSpace = 42;
  const gridWidth = heatmap.columns.length * cellSize;
  const gridHeight = heatmap.rows.length * cellSize;
  const width = left + gridWidth + scaleBarGap + scaleBarWidth + scaleBarLabelSpace;
  const height = top + gridHeight + 26;
  const svg = createSvg(width, height);
  const valueMap = new Map(heatmap.cells.map((cell) => [`${cell.row}|||${cell.column}`, cell.value]));
  const maxAbs = Math.max(...heatmap.cells.map((cell) => Math.abs(cell.value ?? 0)), 1);

  heatmap.columns.forEach((column, index) => {
    svg.appendChild(
      svgEl(
        "text",
        {
          x: left + index * cellSize + cellSize / 2,
          y: top - 12,
          "text-anchor": "middle",
          class: "tick-label",
          transform: `rotate(-35 ${left + index * cellSize + cellSize / 2} ${top - 12})`,
        },
        truncate(prettifyColumn(column), 16),
      ),
    );
  });

  heatmap.rows.forEach((row, rowIndex) => {
    svg.appendChild(
      svgEl(
        "text",
        { x: left - 10, y: top + rowIndex * cellSize + cellSize / 2 + 4, "text-anchor": "end", class: "tick-label" },
        truncate(row, 22),
      ),
    );
    heatmap.columns.forEach((column, columnIndex) => {
      const value = valueMap.get(`${row}|||${column}`);
      const rect = svgEl("rect", {
        x: left + columnIndex * cellSize,
        y: top + rowIndex * cellSize,
        width: cellSize - 2,
        height: cellSize - 2,
        rx: 5,
        fill: heatColor(value, maxAbs, options.palette),
      });
      rect.appendChild(svgEl("title", {}, `${row} / ${prettifyColumn(column)}: ${formatNumber(value ?? 0, 2)}`));
      svg.appendChild(rect);
      svg.appendChild(
        svgEl(
          "text",
          {
            x: left + columnIndex * cellSize + cellSize / 2,
            y: top + rowIndex * cellSize + cellSize / 2 + 4,
            "text-anchor": "middle",
            class: "tick-label",
          },
          Number.isFinite(value) ? formatNumber(value, 1) : "",
        ),
      );
    });
  });

  // ── Color scale bar ──
  const barX = left + gridWidth + scaleBarGap;
  const barY = top;
  const barHeight = gridHeight;
  const steps = 60;
  const isCorrelation = options.palette === "correlation";
  const scaleMax = isCorrelation ? 1 : maxAbs;

  for (let i = 0; i < steps; i += 1) {
    // Map from top (positive) to bottom (negative)
    const t = i / (steps - 1);           // 0 = top, 1 = bottom
    const val = scaleMax * (1 - 2 * t);  // +max at top, -max at bottom
    const color = heatColor(val, maxAbs, options.palette);
    const sliceH = barHeight / steps;
    svg.appendChild(svgEl("rect", {
      x: barX,
      y: barY + i * sliceH,
      width: scaleBarWidth,
      height: sliceH + 0.5,
      fill: color,
    }));
  }

  // Border around the scale bar
  svg.appendChild(svgEl("rect", {
    x: barX,
    y: barY,
    width: scaleBarWidth,
    height: barHeight,
    fill: "none",
    stroke: "#ccc",
    "stroke-width": 1,
    rx: 3,
  }));

  // Tick labels: top (+max), middle (0), bottom (-max)
  const labelX = barX + scaleBarWidth + 6;
  const ticks = [
    { y: barY + 4, label: isCorrelation ? "+1" : `+${formatNumber(scaleMax, 1)}` },
    { y: barY + barHeight / 2 + 4, label: "0" },
    { y: barY + barHeight + 4, label: isCorrelation ? "−1" : `−${formatNumber(scaleMax, 1)}` },
  ];
  for (const tick of ticks) {
    svg.appendChild(
      svgEl("text", { x: labelX, y: tick.y, "text-anchor": "start", class: "tick-label" }, tick.label),
    );
  }

  container.replaceChildren(svg);
}

export function renderScatter(container, points, options = {}) {
  if (!points?.length) return renderEmpty(container, "No projection points available.");
  const width = 900;
  const height = 430;
  const margin = { top: 24, right: 26, bottom: 56, left: 58 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const xExtent = extent(points.map((point) => point.x));
  const yExtent = extent(points.map((point) => point.y));
  const clusters = [...new Set(points.map((point) => point.cluster))].sort((a, b) =>
    String(a).localeCompare(String(b), undefined, { numeric: true }),
  );
  const colorByCluster = Object.fromEntries(clusters.map((cluster, index) => [cluster, CLUSTER_COLORS[index % CLUSTER_COLORS.length]]));
  const svg = createSvg(width, height);
  const group = svgEl("g", { transform: `translate(${margin.left},${margin.top})` });
  svg.appendChild(group);

  for (let i = 0; i <= 4; i += 1) {
    const x = (innerWidth / 4) * i;
    const y = (innerHeight / 4) * i;
    group.appendChild(svgEl("line", { x1: x, y1: 0, x2: x, y2: innerHeight, class: "grid-line" }));
    group.appendChild(svgEl("line", { x1: 0, y1: y, x2: innerWidth, y2: y, class: "grid-line" }));
  }

  for (const point of points) {
    const cx = scale(point.x, xExtent[0], xExtent[1], 0, innerWidth);
    const cy = scale(point.y, yExtent[0], yExtent[1], innerHeight, 0);
    const circle = svgEl("circle", {
      cx,
      cy,
      r: 3.2,
      fill: colorByCluster[point.cluster],
      opacity: 0.68,
    });
    circle.appendChild(
      svgEl(
        "title",
        {},
        `${point.name ?? "Startup"}\nCluster ${point.cluster}\n${point.market ?? ""} ${point.country ?? ""}`,
      ),
    );
    group.appendChild(circle);
  }

  group.appendChild(svgEl("line", { x1: 0, y1: innerHeight, x2: innerWidth, y2: innerHeight, stroke: "#aeb9b5" }));
  group.appendChild(svgEl("line", { x1: 0, y1: 0, x2: 0, y2: innerHeight, stroke: "#aeb9b5" }));
  group.appendChild(svgEl("text", { x: innerWidth / 2, y: innerHeight + 40, "text-anchor": "middle", class: "axis-label" }, options.xLabel ?? "Component 1"));
  group.appendChild(svgEl("text", { x: -42, y: innerHeight / 2, transform: `rotate(-90,-42,${innerHeight / 2})`, "text-anchor": "middle", class: "axis-label" }, options.yLabel ?? "Component 2"));

  const wrapper = document.createElement("div");
  wrapper.appendChild(svg);
  wrapper.appendChild(renderLegend(clusters.map((cluster) => ({ label: `Cluster ${cluster}`, color: colorByCluster[cluster] }))));
  container.replaceChildren(wrapper);
}

export function renderTable(container, columns, rows, options = {}) {
  if (!rows?.length) return renderEmpty(container, "No rows to show.");
  const table = document.createElement("table");
  table.innerHTML = `
    <thead>
      <tr>${columns.map((column) => `<th>${escapeHtml(column.label ?? column.key)}</th>`).join("")}</tr>
    </thead>
    <tbody>
      ${rows
        .map(
          (row) => `
            <tr>
              ${columns
                .map((column) => {
                  const raw = typeof column.value === "function" ? column.value(row) : row[column.key];
                  const value = column.format ? column.format(raw, row) : raw;
                  return `<td>${escapeHtml(value ?? "")}</td>`;
                })
                .join("")}
            </tr>
          `,
        )
        .join("")}
    </tbody>
  `;
  if (options.maxHeight) container.style.maxHeight = `${options.maxHeight}px`;
  container.replaceChildren(table);
}

export function renderOutliers(container, outliers, formatter) {
  if (!outliers?.length) {
    container.innerHTML = `<div class="chart-empty">No outliers available.</div>`;
    return;
  }
  container.innerHTML = outliers
    .map(({ row, value }) => {
      const name = row.name ?? "Unnamed startup";
      const market = row.market ?? "Unknown market";
      const status = row.status ?? "Unknown status";
      const country = row.country_code ?? "Unknown country";
      return `
        <div class="outlier-item">
          <strong>${escapeHtml(name)}</strong>
          <span>${escapeHtml(formatter(value))} total funding</span>
          <span>${escapeHtml(market)} - ${escapeHtml(status)} - ${escapeHtml(country)}</span>
        </div>
      `;
    })
    .join("");
}

export function renderLegend(items) {
  const legend = document.createElement("div");
  legend.className = "legend";
  legend.innerHTML = `<span class="legend-label">Legend:</span>` + items
    .map(
      (item) => `
        <span class="legend-item">
          <span class="legend-swatch" style="background:${item.color}"></span>
          ${escapeHtml(item.label)}
        </span>
      `,
    )
    .join("");
  return legend;
}

function niceTickCount(maxValue) {
  if (maxValue <= 5) return maxValue;
  if (maxValue <= 10) return 5;
  if (maxValue <= 20) return 4;
  return 5;
}

function createSvg(width, height) {
  return svgEl("svg", {
    viewBox: `0 0 ${width} ${height}`,
    role: "img",
    width: "100%",
    height: "100%",
    preserveAspectRatio: "xMidYMid meet",
  });
}

function svgEl(name, attrs = {}, text = null) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", name);
  for (const [key, value] of Object.entries(attrs)) {
    node.setAttribute(key, value);
  }
  if (text !== null) node.textContent = text;
  return node;
}

function scale(value, domainMin, domainMax, rangeMin, rangeMax) {
  if (domainMin === domainMax) return (rangeMin + rangeMax) / 2;
  return rangeMin + ((value - domainMin) / (domainMax - domainMin)) * (rangeMax - rangeMin);
}

function extent(values) {
  const clean = values.filter(Number.isFinite);
  if (!clean.length) return [0, 1];
  const min = Math.min(...clean);
  const max = Math.max(...clean);
  const padding = (max - min || 1) * 0.08;
  return [min - padding, max + padding];
}

function heatColor(value, maxAbs, palette) {
  if (!Number.isFinite(value)) return "#f1f4f2";
  if (palette === "correlation") {
    const intensity = Math.min(1, Math.abs(value));
    return value >= 0 ? blend("#f7fbf9", "#2f6f68", intensity) : blend("#f7fbf9", "#d95f4f", intensity);
  }
  const intensity = Math.min(1, Math.abs(value) / maxAbs);
  return value >= 0 ? blend("#f7fbf9", "#3f5f9e", intensity) : blend("#f7fbf9", "#c58b2d", intensity);
}

function blend(a, b, amount) {
  const first = hexToRgb(a);
  const second = hexToRgb(b);
  const mixed = first.map((value, index) => Math.round(value + (second[index] - value) * amount));
  return `rgb(${mixed[0]}, ${mixed[1]}, ${mixed[2]})`;
}

function hexToRgb(hex) {
  const clean = hex.replace("#", "");
  return [0, 2, 4].map((offset) => parseInt(clean.slice(offset, offset + 2), 16));
}

function truncate(value, max) {
  const text = String(value ?? "");
  return text.length > max ? `${text.slice(0, Math.max(1, max - 1))}...` : text;
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
