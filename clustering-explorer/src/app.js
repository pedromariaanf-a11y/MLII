import { DEFAULT_DATASETS, loadDatasets, parseCsv, toDisplayValue, toNumber } from "./data-loader.js";
import {
  chooseClusterFeatures,
  chooseInterpretableFeatures,
  computeClusterSummary,
  computeCorrelationMatrix,
  computeFeatureSeparation,
  computePcaProjection,
  ensureClusters,
  formatMoney,
  formatNumber,
  formatPercent,
  getOutliers,
  histogram,
  naturalSort,
  prettifyColumn,
  summarizeDataset,
  uniqueClusterValues,
} from "./analysis.js";
import {
  CLUSTER_COLORS,
  escapeHtml,
  renderBarChart,
  renderChartCopy,
  renderEmpty,
  renderHeatmap,
  renderHistogram,
  renderMetricCards,
  renderOutliers,
  renderScatter,
  renderTable,
} from "./charts.js";
import { generateInsights } from "./insights.js";

const state = {
  model: null,
};

const el = {};

document.addEventListener("DOMContentLoaded", () => {
  cacheElements();
  attachFallbackLoader();
  loadInitialData();
});

function cacheElements() {
  for (const id of [
    "loadStatus",
    "fallbackLoader",
    "manualCsvInput",
    "sourceDetails",
    "overviewMetrics",
    "datasetMetrics",
    "missingCopy",
    "missingChart",
    "histogramCopy",
    "numericColumnSelect",
    "histogramChart",
    "categoryCopy",
    "categoricalColumnSelect",
    "categoryChart",
    "correlationCopy",
    "correlationHeatmap",
    "schemaTable",
    "methodCards",
    "clusterSizeCopy",
    "clusterSizeChart",
    "featureCompareCopy",
    "featureCompareSelect",
    "featureByClusterChart",
    "clusterProfiles",
    "clusterComparisonTable",
    "projectionCopy",
    "projectionChart",
    "clusterHeatmapCopy",
    "clusterHeatmap",
    "outlierCopy",
    "outlierList",
    "insightsGrid",
    "tableSearch",
    "clusterFilter",
    "tableStatus",
    "sampleTable",
  ]) {
    el[id] = document.getElementById(id);
  }
}

async function loadInitialData() {
  setStatus("Loading the clustered startup dataset...", "loading");
  try {
    const { datasets, errors } = await loadDatasets(DEFAULT_DATASETS);
    buildAndRender(datasets, errors);
  } catch (error) {
    setStatus(
      `Could not load the required CSV automatically. ${error.message}. Try the manual loader below, or run a local server from the repository root.`,
      "error",
    );
    el.fallbackLoader.classList.remove("hidden");
  }
}

function attachFallbackLoader() {
  el.manualCsvInput.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setStatus(`Reading ${file.name}...`, "loading");
    try {
      const text = await file.text();
      const parsed = parseCsv(text);
      buildAndRender(
        {
          clustered: {
            id: "clustered",
            label: file.name,
            path: "manual file selection",
            headers: parsed.headers,
            rows: parsed.rows,
          },
        },
        [],
      );
      el.fallbackLoader.classList.add("hidden");
    } catch (error) {
      setStatus(`The selected CSV could not be parsed: ${error.message}`, "error");
    }
  });
}

function buildAndRender(datasets, loadErrors) {
  const clustered = datasets.clustered;
  const raw = datasets.raw ?? null;
  const datasetSummary = summarizeDataset(clustered);
  const rawSummary = raw ? summarizeDataset(raw) : null;
  const clusterFeatures = chooseClusterFeatures(datasetSummary);
  const clusterResult = ensureClusters(
    clustered.rows.map((row, index) => ({ ...row, __rowNumber: index + 1 })),
    clustered.headers,
    clusterFeatures,
  );
  const rows = clusterResult.rows;
  const renderSummary = summarizeDataset({ ...clustered, rows });
  const featureColumns = chooseClusterFeatures(renderSummary);
  const interpretableFeatures = chooseInterpretableFeatures(renderSummary);
  const clusterSummary = computeClusterSummary(
    rows,
    clusterResult.clusterColumn,
    featureColumns,
    renderSummary.categoricalColumns,
  );
  const separation = computeFeatureSeparation(clusterSummary);
  const correlationColumns = chooseInterpretableFeatures(renderSummary).slice(0, 8);
  const correlations = computeCorrelationMatrix(rows, correlationColumns);
  const projection = computePcaProjection(rows, clusterResult.clusterColumn, featureColumns);
  const outliers = getOutliers(rows);

  state.model = {
    datasets,
    loadErrors,
    rows,
    datasetSummary: renderSummary,
    rawSummary,
    clusterResult,
    clusterSummary,
    separation,
    correlations,
    projection,
    outliers,
    featureColumns,
    interpretableFeatures,
  };

  setStatus(
    `Loaded ${formatNumber(rows.length)} clustered startup rows from ${clustered.path}. Existing files were read only.`,
    "success",
  );
  renderAll();
}

function renderAll() {
  const model = state.model;
  renderSourceDetails(model);
  renderOverview(model);
  renderDataset(model);
  renderClustering(model);
  renderVisuals(model);
  renderInsights(model);
  renderExplorer(model);
}

function renderSourceDetails(model) {
  const rawText = model.rawSummary
    ? `${formatNumber(model.rawSummary.rows)} raw rows available for context`
    : "Raw CSV was optional and was not loaded";
  const errors = model.loadErrors?.length
    ? `<p class="source-note">${escapeHtml(model.loadErrors.map((item) => `${item.config.label} did not load`).join("; "))}</p>`
    : "";
  el.sourceDetails.innerHTML = `
    <p class="eyebrow">Read-only inputs</p>
    <h2>Loaded project files</h2>
    <div class="source-list">
      <div class="source-item">
        <strong>${escapeHtml(model.datasets.clustered.label)}</strong>
        <span>${escapeHtml(model.datasets.clustered.path)} - ${formatNumber(model.rows.length)} clustered rows</span>
      </div>
      <div class="source-item">
        <strong>Raw dataset context</strong>
        <span>${escapeHtml(rawText)}</span>
      </div>
      <div class="source-item">
        <strong>Notebook inference</strong>
        <span>K-Means, RobustScaler, PCA visualization, K=4, existing Cluster labels.</span>
      </div>
    </div>
    ${errors}
  `;
}

function renderOverview(model) {
  const summary = model.datasetSummary;
  renderMetricCards(el.overviewMetrics, [
    {
      label: "Clustered rows",
      value: formatNumber(summary.rows),
      note: "Startups in the exported cluster profile.",
    },
    {
      label: "Columns",
      value: formatNumber(summary.columns),
      note: "Information, engineered features, and labels.",
    },
    {
      label: "Clusters",
      value: formatNumber(model.clusterSummary.clusters.length),
      note: model.clusterResult.usedExisting ? "Read from the CSV labels." : "Generated only inside this app.",
    },
    {
      label: "Largest cluster",
      value: `Cluster ${model.clusterSummary.largest?.cluster ?? "n/a"}`,
      note: `${formatPercent(model.clusterSummary.largest?.percentage ?? 0)} of rows.`,
    },
  ]);
}

function renderDataset(model) {
  const summary = model.datasetSummary;
  const missingCells = summary.missingTop.map((profile) => ({
    label: prettifyColumn(profile.name),
    value: profile.missing,
  }));

  renderMetricCards(el.datasetMetrics, [
    {
      label: "Numeric features",
      value: formatNumber(summary.numericColumns.length),
      note: "Funding amounts, ratios, log features, and stage values.",
    },
    {
      label: "Categorical features",
      value: formatNumber(summary.categoricalColumns.length),
      note: "Company descriptors such as market, status, country, and city.",
    },
    {
      label: "Columns with missing values",
      value: formatNumber(summary.missingTop.length),
      note: summary.warnings[0] ?? "No major missing-value warning found.",
    },
  ]);

  renderChartCopy(
    el.missingCopy,
    "Missing Values",
    "This chart shows which fields have the most blank entries in the clustered dataset.",
    "Longer bars mean more missing rows for that column.",
    missingCells.length
      ? `${prettifyColumn(summary.missingTop[0].name)} has the most missing values at ${formatPercent(summary.missingTop[0].missingRate)}.`
      : "The loaded clustered dataset has no detected missing values.",
  );
  renderBarChart(el.missingChart, missingCells, {
    color: "#d95f4f",
    valueFormatter: (value) => formatNumber(value),
  });

  populateSelect(el.numericColumnSelect, summary.numericColumns.filter((column) => !/^cluster$/i.test(column)), prettifyColumn);
  el.numericColumnSelect.onchange = () => renderHistogramPanel(model);
  renderHistogramPanel(model);

  const categoricalOptions = summary.categoricalColumns.filter((column) => !["name", "category_list"].includes(column));
  populateSelect(el.categoricalColumnSelect, categoricalOptions, prettifyColumn);
  el.categoricalColumnSelect.onchange = () => renderCategoryPanel(model);
  renderCategoryPanel(model);

  renderChartCopy(
    el.correlationCopy,
    "Correlation Heatmap",
    "This matrix compares important numeric funding fields to show which ones tend to move together.",
    "Darker teal cells are stronger positive relationships; darker coral cells are stronger negative relationships.",
    model.correlations.strongest
      ? `${prettifyColumn(model.correlations.strongest.x)} and ${prettifyColumn(model.correlations.strongest.y)} have the strongest displayed relationship.`
      : "There were not enough numeric values to compute a strong relationship.",
  );
  renderHeatmap(
    el.correlationHeatmap,
    {
      rows: model.correlations.columns.map(prettifyColumn),
      columns: model.correlations.columns,
      cells: model.correlations.cells.map((cell) => ({
        row: prettifyColumn(cell.y),
        column: cell.x,
        value: cell.value,
      })),
    },
    { palette: "correlation", cellSize: 48, left: 150 },
  );

  renderSchemaTable(summary);
}

function renderHistogramPanel(model) {
  const column = el.numericColumnSelect.value;
  renderChartCopy(
    el.histogramCopy,
    "Numerical Distribution",
    "This chart shows how rows are spread across the selected numeric feature.",
    "Each bar is a value range; taller bars mean more startups fall into that range.",
    column ? `${prettifyColumn(column)} is shown with ${formatNumber(histogram(model.rows, column).length)} value ranges.` : "Choose a numeric feature to inspect its distribution.",
  );
  if (!column) return renderEmpty(el.histogramChart, "No numeric feature selected.");
  renderHistogram(el.histogramChart, histogram(model.rows, column), { column, color: "#3f5f9e" });
}

function renderCategoryPanel(model) {
  const column = el.categoricalColumnSelect.value;
  const counts = column ? categoryCountsForModel(model, column, 12) : [];
  renderChartCopy(
    el.categoryCopy,
    "Categorical Values",
    "This chart surfaces the most common labels in a selected categorical column.",
    "Longer bars mean that value appears in more startup rows.",
    counts.length ? `${counts[0].label} is the most common value for ${prettifyColumn(column)}.` : "Choose a categorical feature to inspect its most common values.",
  );
  renderBarChart(el.categoryChart, counts, {
    color: "#6f8d3b",
    valueFormatter: (value, item) => `${formatNumber(value)} (${formatPercent(item.percentage)})`,
  });
}

function renderSchemaTable(summary) {
  const rows = summary.profiles.map((profile) => ({
    column: profile.name,
    type: profile.type,
    missing: profile.missing,
    missingRate: profile.missingRate,
    unique: profile.unique,
    example: profile.example,
  }));
  renderTable(
    el.schemaTable,
    [
      { key: "column", label: "Column" },
      { key: "type", label: "Type" },
      { key: "missing", label: "Missing", format: formatNumber },
      { key: "missingRate", label: "Missing %", format: formatPercent },
      { key: "unique", label: "Unique", format: formatNumber },
      { key: "example", label: "Example", format: (value) => toDisplayValue(value) },
    ],
    rows,
    { maxHeight: 420 },
  );
}

function renderClustering(model) {
  const clusterSummary = model.clusterSummary;
  renderMetricCards(el.methodCards, [
    {
      label: "Method detected",
      value: "K-Means",
      note: "Inferred from teste.ipynb and EDA.py imports.",
    },
    {
      label: "Label source",
      value: model.clusterResult.usedExisting ? "Existing CSV labels" : "Fallback labels",
      note: model.clusterResult.method,
    },
    {
      label: "Features used",
      value: formatNumber(model.featureColumns.length),
      note: "Filtered to the engineered clustering features present in the CSV.",
    },
  ]);

  renderChartCopy(
    el.clusterSizeCopy,
    "Cluster Sizes",
    "This chart compares how many startups belong to each cluster.",
    "A longer bar means the cluster contains more rows.",
    clusterSummary.largest
      ? `Cluster ${clusterSummary.largest.cluster} is largest with ${formatPercent(clusterSummary.largest.percentage)} of startups.`
      : "No clusters were available.",
  );
  renderBarChart(
    el.clusterSizeChart,
    clusterSummary.clusters.map((cluster, index) => ({
      label: `Cluster ${cluster.cluster}`,
      value: cluster.count,
      color: CLUSTER_COLORS[index % CLUSTER_COLORS.length],
    })),
    { valueFormatter: formatNumber },
  );

  populateSelect(el.featureCompareSelect, model.interpretableFeatures, prettifyColumn);
  el.featureCompareSelect.onchange = () => renderFeatureCompare(model);
  renderFeatureCompare(model);

  renderClusterProfiles(clusterSummary);
  renderClusterComparison(model);
}

function renderFeatureCompare(model) {
  const feature = el.featureCompareSelect.value;
  const rows = model.clusterSummary.clusters.map((cluster, index) => ({
    label: `Cluster ${cluster.cluster}`,
    value: cluster.features[feature]?.median ?? 0,
    color: CLUSTER_COLORS[index % CLUSTER_COLORS.length],
  }));
  const top = [...rows].sort((a, b) => b.value - a.value)[0];
  renderChartCopy(
    el.featureCompareCopy,
    "Feature Averages by Cluster",
    "This chart compares cluster medians for a selected real-world funding feature.",
    "Higher bars mean that cluster has a higher median value for the selected feature.",
    feature && top ? `${top.label} has the highest median ${prettifyColumn(feature)}.` : "Choose a feature to compare clusters.",
  );
  if (!feature) return renderEmpty(el.featureByClusterChart, "No feature selected.");
  renderBarChart(el.featureByClusterChart, rows, {
    left: 110,
    valueFormatter: (value) => (feature.includes("usd") || ["venture", "debt_financing", "private_equity", "early_stage_funding"].includes(feature) ? formatMoney(value) : formatNumber(value, 2)),
  });
}

function renderClusterProfiles(clusterSummary) {
  el.clusterProfiles.innerHTML = clusterSummary.clusters
    .map((cluster, index) => {
      const top = cluster.distinguishing[0];
      const status = cluster.topCategories.status?.[0]?.label ?? "mixed status";
      const market = cluster.topCategories.market?.[0]?.label ?? "mixed markets";
      return `
        <article class="profile-card">
          <span class="badge" style="color:${CLUSTER_COLORS[index % CLUSTER_COLORS.length]}">Cluster ${escapeHtml(cluster.cluster)}</span>
          <h3>${escapeHtml(cluster.name)}</h3>
          <p>
            This cluster appears to be characterized by ${escapeHtml(prettifyColumn(top?.feature ?? "its funding mix"))},
            which is ${escapeHtml(top?.direction ?? "different")} compared with the overall dataset.
          </p>
          <div class="profile-stats">
            <span class="profile-stat">${formatNumber(cluster.count)} rows</span>
            <span class="profile-stat">${formatPercent(cluster.percentage)}</span>
          </div>
          <div class="profile-tags">
            <span class="profile-tag">${escapeHtml(status)}</span>
            <span class="profile-tag">${escapeHtml(market)}</span>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderClusterComparison(model) {
  const columns = [
    { key: "cluster", label: "Cluster" },
    { key: "count", label: "Rows", format: formatNumber },
    { key: "percentage", label: "Share", format: formatPercent },
    ...model.interpretableFeatures.slice(0, 7).map((feature) => ({
      key: feature,
      label: prettifyColumn(feature),
      value: (row) => row[feature],
      format: (value) =>
        feature.includes("usd") || ["venture", "debt_financing", "private_equity", "early_stage_funding"].includes(feature)
          ? formatMoney(value)
          : formatNumber(value, 2),
    })),
  ];
  const rows = model.clusterSummary.clusters.map((cluster) => {
    const row = {
      cluster: `Cluster ${cluster.cluster}`,
      count: cluster.count,
      percentage: cluster.percentage,
    };
    for (const feature of model.interpretableFeatures.slice(0, 7)) {
      row[feature] = cluster.features[feature]?.median;
    }
    return row;
  });
  renderTable(el.clusterComparisonTable, columns, rows);
}

function renderVisuals(model) {
  const explained = model.projection.explained.map((value) => formatPercent(value)).join(" + ");
  renderChartCopy(
    el.projectionCopy,
    "2D PCA-Style Cluster Projection",
    "The app recomputes a two-component projection from the engineered clustering features for visual explanation only.",
    "Each dot is a sampled startup. Nearby dots have similar scaled funding profiles; colors show cluster labels.",
    model.projection.points.length
      ? `The first two components explain about ${explained} of the scaled feature variation in this browser-side view.`
      : "There were not enough numeric clustering features to create a projection.",
  );
  renderScatter(el.projectionChart, model.projection.points, {
    xLabel: "Component 1",
    yLabel: "Component 2",
  });

  const heatmap = buildClusterHeatmap(model);
  const topSeparation = model.separation[0];
  renderChartCopy(
    el.clusterHeatmapCopy,
    "Cluster Feature Heatmap",
    "This heatmap shows whether each cluster is above or below the dataset average for key engineered features.",
    "Blue cells are higher than average; gold cells are lower than average. The numbers are standardized differences.",
    topSeparation
      ? `${prettifyColumn(topSeparation.feature)} creates the widest displayed split between clusters.`
      : "No feature split could be calculated.",
  );
  renderHeatmap(el.clusterHeatmap, heatmap, { cellSize: 45, left: 120 });

  renderChartCopy(
    el.outlierCopy,
    "Possible Outliers",
    "These are the largest total funding observations in the clustered dataset.",
    "Read them as context, not as errors. Very large startups can pull averages upward.",
    model.outliers[0]
      ? `${model.outliers[0].row.name ?? "The top row"} has ${formatMoney(model.outliers[0].value)} in total funding.`
      : "No funding outliers were available.",
  );
  renderOutliers(el.outlierList, model.outliers, formatMoney);
}

function renderInsights(model) {
  const insights = generateInsights(model);
  el.insightsGrid.innerHTML = insights
    .map(
      (insight) => `
        <article class="insight-card" data-tone="${escapeHtml(insight.tone ?? "teal")}">
          <div class="insight-kicker">${escapeHtml(insight.kicker)}</div>
          <h3>${escapeHtml(insight.title)}</h3>
          <p>${escapeHtml(insight.body)}</p>
        </article>
      `,
    )
    .join("");
}

function renderExplorer(model) {
  const clusters = uniqueClusterValues(model.rows, model.clusterResult.clusterColumn);
  el.clusterFilter.innerHTML = `<option value="all">All clusters</option>${clusters
    .map((cluster) => `<option value="${escapeHtml(cluster)}">Cluster ${escapeHtml(cluster)}</option>`)
    .join("")}`;
  const update = () => renderSampleTable(model);
  el.tableSearch.oninput = update;
  el.clusterFilter.onchange = update;
  renderSampleTable(model);
}

function renderSampleTable(model) {
  const term = el.tableSearch.value.trim().toLowerCase();
  const selectedCluster = el.clusterFilter.value;
  const clusterColumn = model.clusterResult.clusterColumn;
  const filtered = model.rows.filter((row) => {
    const matchesCluster = selectedCluster === "all" || toDisplayValue(row[clusterColumn]) === selectedCluster;
    if (!matchesCluster) return false;
    if (!term) return true;
    return ["name", "market", "status", "country_code", "city", clusterColumn].some((column) =>
      String(row[column] ?? "").toLowerCase().includes(term),
    );
  });
  const sample = filtered.slice(0, 180);
  el.tableStatus.textContent = `Showing ${formatNumber(sample.length)} of ${formatNumber(filtered.length)} matching rows.`;
  renderTable(
    el.sampleTable,
    [
      { key: "name", label: "Startup", format: (value) => toDisplayValue(value) },
      { key: "market", label: "Market", format: (value) => toDisplayValue(value) },
      { key: "status", label: "Status", format: (value) => toDisplayValue(value) },
      { key: "country_code", label: "Country", format: (value) => toDisplayValue(value) },
      { key: "funding_total_usd", label: "Funding", format: (value) => formatMoney(toNumber(value)) },
      { key: clusterColumn, label: "Cluster", format: (value) => `Cluster ${toDisplayValue(value)}` },
    ],
    sample,
    { maxHeight: 520 },
  );
}

function categoryCountsForModel(model, column, limit) {
  const counts = new Map();
  for (const row of model.rows) {
    const value = toDisplayValue(row[column]);
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, value: count, count, percentage: model.rows.length ? count / model.rows.length : 0 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

function buildClusterHeatmap(model) {
  const columns = model.featureColumns.slice(0, 8);
  const rows = model.clusterSummary.clusters.map((cluster) => `Cluster ${cluster.cluster}`);
  const cells = [];
  for (const cluster of model.clusterSummary.clusters) {
    for (const column of columns) {
      const global = model.clusterSummary.globalStats[column];
      const local = cluster.features[column];
      const value = global?.std ? ((local?.mean ?? 0) - (global.mean ?? 0)) / global.std : 0;
      cells.push({ row: `Cluster ${cluster.cluster}`, column, value });
    }
  }
  return { rows, columns, cells };
}

function populateSelect(select, values, labelFormatter = (value) => value) {
  select.innerHTML = values
    .map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(labelFormatter(value))}</option>`)
    .join("");
}

function setStatus(message, type) {
  el.loadStatus.textContent = message;
  el.loadStatus.className = `notice notice-${type}`;
}
