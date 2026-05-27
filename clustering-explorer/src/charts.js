import { formatCompact, formatNumber, prettifyColumn } from "./analysis.js";

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
  const margin = { top: 18, right: 34, bottom: 54, left: options.left ?? 150 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const rawMax = Math.max(...data.map((item) => item.value ?? item.count).filter(Number.isFinite), 1);
  const scaleMax = Number.isFinite(options.scaleMax) && options.scaleMax > 0
    ? Math.max(options.scaleMax, rawMax)
    : niceScaleMax(rawMax, options.scalePadding ?? 0.14);
  const barHeight = innerHeight / data.length;
  const color = options.color ?? "#2f6f68";
  const axisFormatter = options.axisFormatter ?? formatCompact;

  const svg = createSvg(width, height);
  const group = svgEl("g", { transform: `translate(${margin.left},${margin.top})` });
  svg.appendChild(group);

  data.forEach((item, index) => {
    const value = item.value ?? item.count;
    const y = index * barHeight + 3;
    const label = options.valueFormatter ? options.valueFormatter(value, item) : formatCompact(value);
    const barWidth = Math.min(1, value / scaleMax) * innerWidth;
    const labelWidth = estimateSvgTextWidth(label, 12);
    const outsideRoom = barWidth + labelWidth + 12 <= innerWidth;
    const labelInside = !outsideRoom && barWidth > labelWidth + 14;
    const labelX = labelInside
      ? Math.max(labelWidth + 8, barWidth - 7)
      : Math.max(4, Math.min(barWidth + 7, innerWidth - labelWidth - 4));
    const rect = svgEl("rect", {
      x: 0,
      y,
      width: Math.max(1, barWidth),
      height: Math.max(6, barHeight - 6),
      rx: 5,
      fill: item.color ?? color,
    });
    rect.appendChild(svgEl("title", {}, `${item.label}: ${label}`));
    group.appendChild(rect);
    group.appendChild(
      svgEl(
        "text",
        { x: -10, y: y + Math.max(6, barHeight - 6) / 2 + 4, "text-anchor": "end", class: "tick-label" },
        truncate(item.label, 22),
      ),
    );
    group.appendChild(
      svgEl(
        "text",
        {
          x: labelX,
          y: y + Math.max(6, barHeight - 6) / 2 + 4,
          "text-anchor": labelInside ? "end" : "start",
          class: labelInside ? "bar-label-invert" : "bar-label",
        },
        label,
      ),
    );
  });

  group.appendChild(svgEl("line", { x1: 0, y1: innerHeight + 6, x2: innerWidth, y2: innerHeight + 6, class: "grid-line" }));
  group.appendChild(svgEl("text", { x: 0, y: innerHeight + 26, "text-anchor": "start", class: "tick-label" }, "0"));
  group.appendChild(
    svgEl(
      "text",
      { x: innerWidth, y: innerHeight + 26, "text-anchor": "end", class: "tick-label" },
      axisFormatter(scaleMax),
    ),
  );
  container.replaceChildren(svg);
}

export function renderHistogram(container, bins, options = {}) {
  if (!bins?.length) return renderEmpty(container, "No numeric values available for this feature.");
  const width = 720;
  const height = 300;
  const margin = { top: 20, right: 24, bottom: 72, left: 56 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const rawMax = Math.max(...bins.map((bin) => bin.count).filter(Number.isFinite), 1);
  const scaleMax = niceCountMax(rawMax);
  const barWidth = innerWidth / bins.length;
  const svg = createSvg(width, height);
  const group = svgEl("g", { transform: `translate(${margin.left},${margin.top})` });
  svg.appendChild(group);

  // Y-axis grid lines and tick labels
  const yTicks = niceTickCount(scaleMax);
  for (let i = 0; i <= yTicks; i += 1) {
    const tickValue = Math.round((scaleMax / yTicks) * i);
    const y = innerHeight - (tickValue / scaleMax) * innerHeight;
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
    const heightValue = (bin.count / scaleMax) * innerHeight;
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
  const scaleBarLabelSpace = 58;
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
            class: "heatmap-value-label",
            fill: heatLabelColor(value, maxAbs, options.palette),
            stroke: heatLabelStroke(value, maxAbs, options.palette),
          },
          formatHeatmapValue(value, options.palette),
        ),
      );
    });
  });

  // Color scale bar
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
    { y: barY + 4, label: isCorrelation ? "+1.00" : `+${formatNumber(scaleMax, 2)}` },
    { y: barY + barHeight / 2 + 4, label: "0" },
    { y: barY + barHeight + 4, label: isCorrelation ? "-1.00" : `-${formatNumber(scaleMax, 2)}` },
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

export function renderScatter3D(container, points, options = {}) {
  if (!points?.length) return renderEmpty(container, "No 3D projection points available.");
  if (container.__cluster3dFrame) cancelAnimationFrame(container.__cluster3dFrame);
  if (container.__cluster3dRenderer?.dispose) container.__cluster3dRenderer.dispose();
  if (container.__cluster3dObserver?.disconnect) container.__cluster3dObserver.disconnect();

  renderEmpty(container, "Preparing 3D cluster view...");
  import("../vendor/three.module.min.js")
    .then((THREE) => renderThreeScatter3D(container, points, THREE, options))
    .catch(() => renderCanvasScatter3D(container, points, options));
}

function renderThreeScatter3D(container, points, THREE, options = {}) {
  const clusters = [...new Set(points.map((point) => point.cluster))].sort((a, b) =>
    String(a).localeCompare(String(b), undefined, { numeric: true }),
  );
  const colorByCluster = Object.fromEntries(clusters.map((cluster, index) => [cluster, CLUSTER_COLORS[index % CLUSTER_COLORS.length]]));
  const prepared = prepare3DPoints(points, colorByCluster);

  const shell = document.createElement("div");
  shell.className = "cluster-3d-shell";
  const tooltip = document.createElement("div");
  tooltip.className = "cluster-3d-tooltip hidden";
  shell.appendChild(tooltip);
  shell.appendChild(renderLegend(clusters.map((cluster) => ({ label: `Cluster ${cluster}`, color: colorByCluster[cluster] }))));
  container.replaceChildren(shell);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x101918);
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 0, 4.2);
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.domElement.className = "cluster-3d-canvas";
  renderer.domElement.setAttribute("role", "img");
  renderer.domElement.setAttribute("aria-label", "3D PCA cluster landscape");
  shell.prepend(renderer.domElement);
  container.__cluster3dRenderer = renderer;

  const group = new THREE.Group();
  scene.add(group);

  const grid = new THREE.GridHelper(2.8, 8, 0xffffff, 0xffffff);
  grid.position.y = -1.15;
  grid.material.transparent = true;
  grid.material.opacity = 0.14;
  group.add(grid);

  const axes = new THREE.AxesHelper(1.45);
  axes.material.transparent = true;
  axes.material.opacity = 0.7;
  group.add(axes);

  const pointClouds = [];
  for (const cluster of clusters) {
    const clusterPoints = prepared.filter((point) => point.cluster === cluster);
    const positions = new Float32Array(clusterPoints.length * 3);
    clusterPoints.forEach((point, index) => {
      positions[index * 3] = point.nx * 1.35;
      positions[index * 3 + 1] = point.ny * 1.15;
      positions[index * 3 + 2] = point.nz * 1.25;
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      color: new THREE.Color(colorByCluster[cluster]),
      size: 0.035,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
    });
    const cloud = new THREE.Points(geometry, material);
    cloud.userData.points = clusterPoints;
    group.add(cloud);
    pointClouds.push(cloud);
  }

  group.rotation.x = -0.58;
  group.rotation.y = 0.72;

  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  const mouse = new THREE.Vector2();
  const raycaster = new THREE.Raycaster();
  raycaster.params.Points.threshold = 0.055;

  renderer.domElement.addEventListener("pointerdown", (event) => {
    dragging = true;
    lastX = event.clientX;
    lastY = event.clientY;
    renderer.domElement.setPointerCapture(event.pointerId);
  });
  renderer.domElement.addEventListener("pointermove", (event) => {
    if (dragging) {
      group.rotation.y += (event.clientX - lastX) * 0.008;
      group.rotation.x += (event.clientY - lastY) * 0.006;
      group.rotation.x = Math.max(-1.25, Math.min(1.25, group.rotation.x));
      lastX = event.clientX;
      lastY = event.clientY;
    }
    updateThreeTooltip(event, renderer.domElement, camera, raycaster, pointClouds, mouse, tooltip);
  });
  renderer.domElement.addEventListener("pointerup", () => {
    dragging = false;
  });
  renderer.domElement.addEventListener("pointerleave", () => {
    dragging = false;
    tooltip.classList.add("hidden");
  });

  const resize = () => {
    const rect = shell.getBoundingClientRect();
    const width = Math.max(320, Math.round(rect.width));
    const height = Math.max(420, Math.round(rect.height));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  resize();
  const observer = new ResizeObserver(resize);
  observer.observe(shell);
  container.__cluster3dObserver = observer;

  function frame() {
    if (!dragging) group.rotation.y += 0.0035;
    renderer.render(scene, camera);
    container.__cluster3dFrame = requestAnimationFrame(frame);
  }
  frame();
}

function renderCanvasScatter3D(container, points, options = {}) {
  if (!points?.length) return renderEmpty(container, "No 3D projection points available.");
  if (container.__cluster3dFrame) cancelAnimationFrame(container.__cluster3dFrame);

  const width = options.width ?? 1000;
  const height = options.height ?? 520;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.className = "cluster-3d-canvas";
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", "3D PCA cluster landscape");

  const tooltip = document.createElement("div");
  tooltip.className = "cluster-3d-tooltip hidden";

  const clusters = [...new Set(points.map((point) => point.cluster))].sort((a, b) =>
    String(a).localeCompare(String(b), undefined, { numeric: true }),
  );
  const colorByCluster = Object.fromEntries(clusters.map((cluster, index) => [cluster, CLUSTER_COLORS[index % CLUSTER_COLORS.length]]));
  const prepared = prepare3DPoints(points, colorByCluster);
  const shell = document.createElement("div");
  shell.className = "cluster-3d-shell";
  shell.appendChild(canvas);
  shell.appendChild(tooltip);
  shell.appendChild(renderLegend(clusters.map((cluster) => ({ label: `Cluster ${cluster}`, color: colorByCluster[cluster] }))));
  container.replaceChildren(shell);

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  let angleX = -0.58;
  let angleY = 0.72;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let pointer = null;

  canvas.addEventListener("pointerdown", (event) => {
    dragging = true;
    lastX = event.clientX;
    lastY = event.clientY;
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener("pointermove", (event) => {
    pointer = eventToCanvas(event, canvas);
    if (dragging) {
      angleY += (event.clientX - lastX) * 0.008;
      angleX += (event.clientY - lastY) * 0.006;
      angleX = Math.max(-1.25, Math.min(1.25, angleX));
      lastX = event.clientX;
      lastY = event.clientY;
    }
  });
  canvas.addEventListener("pointerup", () => {
    dragging = false;
  });
  canvas.addEventListener("pointerleave", () => {
    dragging = false;
    pointer = null;
    tooltip.classList.add("hidden");
  });

  function frame() {
    if (!dragging) angleY += 0.0035;
    const projected = draw3DScene(ctx, prepared, { width, height, angleX, angleY, pointer, tooltip });
    container.__cluster3dProjected = projected;
    container.__cluster3dFrame = requestAnimationFrame(frame);
  }
  frame();
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

function prepare3DPoints(points, colorByCluster) {
  const xExtent = extent(points.map((point) => point.x));
  const yExtent = extent(points.map((point) => point.y));
  const zExtent = extent(points.map((point) => Number.isFinite(point.z) ? point.z : 0));

  return points.map((point) => ({
    ...point,
    nx: normalize(point.x, xExtent[0], xExtent[1]),
    ny: normalize(point.y, yExtent[0], yExtent[1]),
    nz: normalize(Number.isFinite(point.z) ? point.z : 0, zExtent[0], zExtent[1]),
    color: colorByCluster[point.cluster] ?? CLUSTER_COLORS[0],
  }));
}

function draw3DScene(ctx, points, state) {
  const { width, height, angleX, angleY, pointer, tooltip } = state;
  const projected = [];
  ctx.clearRect(0, 0, width, height);

  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#101918");
  gradient.addColorStop(0.55, "#1b2426");
  gradient.addColorStop(1, "#2a2118");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  draw3DGrid(ctx, { width, height, angleX, angleY });

  for (const point of points) {
    const screen = project3D(point.nx, point.ny, point.nz, { width, height, angleX, angleY });
    projected.push({ ...screen, point });
  }

  projected.sort((a, b) => a.depth - b.depth);
  for (const item of projected) {
    const alpha = Math.max(0.28, Math.min(0.92, 0.58 + item.depth * 0.16));
    const radius = Math.max(2.1, Math.min(5.2, 3.4 + item.depth * 0.8));
    ctx.beginPath();
    ctx.arc(item.x, item.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = withAlpha(item.point.color, alpha);
    ctx.fill();
  }

  if (pointer) update3DTooltip(projected, pointer, tooltip);
  return projected;
}

function draw3DGrid(ctx, state) {
  const gridColor = "rgba(255,255,255,0.11)";
  const axisColor = "rgba(255,255,255,0.62)";
  ctx.lineWidth = 1;
  for (let step = -1; step <= 1.001; step += 0.5) {
    draw3DLine(ctx, [-1, step, -1], [1, step, -1], state, gridColor);
    draw3DLine(ctx, [step, -1, -1], [step, 1, -1], state, gridColor);
    draw3DLine(ctx, [-1, -1, step], [1, -1, step], state, "rgba(255,255,255,0.07)");
  }
  draw3DLine(ctx, [-1.12, 0, 0], [1.12, 0, 0], state, axisColor);
  draw3DLine(ctx, [0, -1.12, 0], [0, 1.12, 0], state, axisColor);
  draw3DLine(ctx, [0, 0, -1.12], [0, 0, 1.12], state, axisColor);
}

function draw3DLine(ctx, start, end, state, color) {
  const a = project3D(start[0], start[1], start[2], state);
  const b = project3D(end[0], end[1], end[2], state);
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.strokeStyle = color;
  ctx.stroke();
}

function project3D(x, y, z, state) {
  const { width, height, angleX, angleY } = state;
  const cosY = Math.cos(angleY);
  const sinY = Math.sin(angleY);
  const cosX = Math.cos(angleX);
  const sinX = Math.sin(angleX);
  const rotatedX = x * cosY + z * sinY;
  const rotatedZ = -x * sinY + z * cosY;
  const rotatedY = y * cosX - rotatedZ * sinX;
  const depth = y * sinX + rotatedZ * cosX;
  const perspective = 3.2;
  const scale3D = perspective / (perspective - depth * 0.72);
  return {
    x: width / 2 + rotatedX * width * 0.34 * scale3D,
    y: height / 2 - rotatedY * height * 0.38 * scale3D,
    depth,
    scale: scale3D,
  };
}

function update3DTooltip(projected, pointer, tooltip) {
  let nearest = null;
  for (const item of projected) {
    const distance = Math.hypot(item.x - pointer.x, item.y - pointer.y);
    if (distance < 13 && (!nearest || distance < nearest.distance)) nearest = { ...item, distance };
  }
  if (!nearest) {
    tooltip.classList.add("hidden");
    return;
  }
  tooltip.classList.remove("hidden");
  tooltip.style.left = `${nearest.x}px`;
  tooltip.style.top = `${nearest.y}px`;
  tooltip.innerHTML = `
    <strong>${escapeHtml(nearest.point.name ?? "Startup")}</strong>
    <span>Cluster ${escapeHtml(nearest.point.cluster)}</span>
    <span>${escapeHtml(nearest.point.market ?? "")} ${escapeHtml(nearest.point.country ?? "")}</span>
  `;
}

function updateThreeTooltip(event, canvas, camera, raycaster, pointClouds, mouse, tooltip) {
  const rect = canvas.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const hit = raycaster.intersectObjects(pointClouds, false)[0];
  if (!hit) {
    tooltip.classList.add("hidden");
    return;
  }
  const point = hit.object.userData.points?.[hit.index];
  if (!point) {
    tooltip.classList.add("hidden");
    return;
  }
  tooltip.classList.remove("hidden");
  tooltip.style.left = `${event.clientX - rect.left}px`;
  tooltip.style.top = `${event.clientY - rect.top}px`;
  tooltip.innerHTML = `
    <strong>${escapeHtml(point.name ?? "Startup")}</strong>
    <span>Cluster ${escapeHtml(point.cluster)}</span>
    <span>${escapeHtml(point.market ?? "")} ${escapeHtml(point.country ?? "")}</span>
  `;
}

function eventToCanvas(event, canvas) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * canvas.width,
    y: ((event.clientY - rect.top) / rect.height) * canvas.height,
  };
}

function normalize(value, min, max) {
  if (min === max) return 0;
  return ((value - min) / (max - min)) * 2 - 1;
}

function withAlpha(hex, alpha) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
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

function estimateSvgTextWidth(value, fontSize = 12) {
  return String(value ?? "").length * fontSize * 0.58;
}

function niceScaleMax(maxValue, padding = 0.14) {
  if (!Number.isFinite(maxValue) || maxValue <= 0) return 1;
  const padded = maxValue * (1 + padding);
  const magnitude = 10 ** Math.floor(Math.log10(padded));
  const normalized = padded / magnitude;
  const steps = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
  const step = steps.find((candidate) => normalized <= candidate) ?? 10;
  return step * magnitude;
}

function niceCountMax(maxValue) {
  return Math.max(1, Math.ceil(niceScaleMax(maxValue, 0.12)));
}

function niceTickCount(maxValue) {
  if (maxValue <= 6) return Math.max(2, Math.ceil(maxValue));
  if (maxValue <= 10) return 4;
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

function heatIntensity(value, maxAbs, palette) {
  if (!Number.isFinite(value)) return 0;
  if (palette === "correlation") return Math.min(1, Math.abs(value));
  return Math.min(1, Math.abs(value) / Math.max(maxAbs, 1));
}

function heatLabelColor(value, maxAbs, palette) {
  return heatIntensity(value, maxAbs, palette) > 0.56 ? "#ffffff" : "#172126";
}

function heatLabelStroke(value, maxAbs, palette) {
  return heatIntensity(value, maxAbs, palette) > 0.56
    ? "rgba(23, 33, 38, 0.5)"
    : "rgba(255, 255, 255, 0.78)";
}

function formatHeatmapValue(value, palette) {
  if (!Number.isFinite(value)) return "";
  const displayValue = Math.abs(value) < 0.005 ? 0 : value;
  const prefix = palette === "correlation" || displayValue <= 0 ? "" : "+";
  return `${prefix}${formatNumber(displayValue, 2)}`;
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
