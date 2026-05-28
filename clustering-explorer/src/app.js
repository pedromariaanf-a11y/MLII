import { DEFAULT_DATASETS, loadDatasets, parseCsv, toDisplayValue, toNumber } from "./data-loader.js";
import {
  chooseClusterFeatures,
  chooseInterpretableFeatures,
  computeClusterSummary,
  computeCorrelationMatrix,
  computeFeatureSeparation,
  computePcaProjection,
  ensureClusters,
  featureUnit,
  featureUnitLabel,
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
import { startugotchi_render } from "./startugotchi.js";

const state = {
  model: null,
  guess: {
    currentRow: null,
    answered: false,
    correct: 0,
    total: 0,
  },
};

const ZERO_SOURCE_FEATURES = [
  { column: "venture", label: "Venture funding" },
  { column: "debt_financing", label: "Debt financing" },
  { column: "private_equity", label: "Private equity" },
  { column: "early_stage_funding", label: "Early-stage funding" },
];

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
    "zeroProblemCopy",
    "zeroProblemChart",
    "zeroFeatureSelect",
    "zeroFeatureBreakdown",
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
    "cluster0",
    "cluster0Intro",
    "cluster0Metrics",
    "subclusterSizeCopy",
    "subclusterSizeChart",
    "subclusterFundingCopy",
    "subclusterFundingChart",
    "subclusterProfiles",
    "subclusterComparisonTable",
    "projectionCopy",
    "projectionChart",
    "clusterHeatmapCopy",
    "clusterHeatmap",
    "outlierCopy",
    "outlierList",
    "insightsGrid",
    "businessGrid",
    "tableSearch",
    "clusterFilter",
    "tableStatus",
    "sampleTable",
    "guessTitle",
    "guessSubtitle",
    "guessScore",
    "guessFacts",
    "guessOptions",
    "guessFeedback",
    "guessNextButton",
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
  const cluster0Dataset = datasets.cluster0 ?? null;
  const datasetSummary = summarizeDataset(clustered);
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
  // Combine both sets so the cluster summary has stats for every column the UI needs
  const allFeatureColumns = [...new Set([...featureColumns, ...interpretableFeatures])];
  const clusterSummary = computeClusterSummary(
    rows,
    clusterResult.clusterColumn,
    allFeatureColumns,
    renderSummary.categoricalColumns,
  );
  const separation = computeFeatureSeparation(clusterSummary);
  const correlationColumns = chooseInterpretableFeatures(renderSummary).slice(0, 8);
  const correlations = computeCorrelationMatrix(rows, correlationColumns);
  const projection = computePcaProjection(rows, clusterResult.clusterColumn, featureColumns);
  const outliers = getOutliers(rows);
  const cluster0 = buildCluster0Model(cluster0Dataset, rows.length, clusterSummary);
  const zeroSummary = computeZeroSummary(rows);

  state.model = {
    datasets,
    loadErrors,
    rows,
    datasetSummary: renderSummary,
    zeroSummary,
    clusterResult,
    clusterSummary,
    separation,
    correlations,
    projection,
    outliers,
    featureColumns,
    interpretableFeatures,
    cluster0,
  };
  resetGuessState();

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
  renderCluster0(model);
  renderVisuals(model);
  renderInsights(model);
  renderBusiness(model);
  renderExplorer(model);
  renderGuessGame(model);
  startugotchi_render(model);
}

function renderSourceDetails(model) {
  const zeroText = model.zeroSummary.highest
    ? `${model.zeroSummary.highest.label} is zero in ${formatPercent(model.zeroSummary.highest.zeroRate)} of rows.`
    : "No zero-heavy funding field was detected.";
  const errors = model.loadErrors?.length
    ? `<p class="source-note">${escapeHtml(model.loadErrors.map((item) => `${item.config.label} did not load`).join("; "))}</p>`
    : "";
  el.sourceDetails.innerHTML = `
    <p class="eyebrow">Presentation inputs</p>
    <h2>Exported output only</h2>
    <div class="source-list">
      <div class="source-item">
        <strong>Exported dataset</strong>
        <span>${escapeHtml(model.datasets.clustered.path)} - ${formatNumber(model.rows.length)} clustered rows</span>
      </div>
      <div class="source-item">
        <strong>Notebook path</strong>
        <span>../teste.ipynb - feature engineering, RobustScaler, PCA, and K-Means reference.</span>
      </div>
      <div class="source-item source-warning">
        <strong>Zero-heavy issue</strong>
        <span>${escapeHtml(zeroText)}</span>
      </div>
    </div>
    ${errors}
  `;
}

function renderOverview(model) {
  const summary = model.datasetSummary;
  renderMetricCards(el.overviewMetrics, [
    {
      label: "Original source",
      value: "Crunchbase",
      note: "Real startup funding data from Kaggle.",
    },
    {
      label: "Exported rows",
      value: formatNumber(summary.rows),
      note: `${formatNumber(summary.columns)} columns in the clustered profile.`,
    },
    {
      label: "Main clusters",
      value: formatNumber(model.clusterSummary.clusters.length),
      note: model.clusterResult.usedExisting ? "Read from exported labels, not refitted in the app." : "Generated only inside this app.",
    },
    {
      label: "Zero-heavy fields",
      value: formatPercent(model.zeroSummary.zeroRate),
      note: "Zero share across source-funding amount fields.",
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
      note: "Real funding values plus engineered ratios, logs, and stage level.",
    },
    {
      label: "Zero-heavy source fields",
      value: formatPercent(model.zeroSummary.zeroRate),
      note: `Across ${formatNumber(model.zeroSummary.features.length)} funding-source amount columns.`,
    },
    {
      label: "Columns with missing values",
      value: formatNumber(summary.missingTop.length),
      note: summary.warnings[0] ?? "No major missing-value warning found.",
    },
  ]);

  renderZeroProblemPanel(model);

  renderChartCopy(
    el.missingCopy,
    "Missing Values",
    "This chart checks blank cells. That is different from the zero-heavy funding fields, where zero usually means no recorded amount for that source.",
    "Longer bars mean more missing rows for that column.",
    missingCells.length
      ? `${prettifyColumn(summary.missingTop[0].name)} has the most missing values at ${formatPercent(summary.missingTop[0].missingRate)}.`
      : "The loaded clustered dataset has no detected missing values.",
  );
  renderBarChart(el.missingChart, missingCells, {
    color: "#d95f4f",
    valueFormatter: (value) => formatNumber(value),
  });

  const numericOptions = preferredColumns(summary.numericColumns, [
    "funding_rounds",
    "funding_total_usd",
    "stage_level",
    "early_stage_funding",
    "venture",
    "debt_financing",
    "private_equity",
  ]);
  populateSelect(el.numericColumnSelect, numericOptions, labelWithUnit);
  el.numericColumnSelect.onchange = () => renderHistogramPanel(model);
  renderHistogramPanel(model);

  const categoricalOptions = preferredColumns(summary.categoricalColumns, ["market", "status", "country_code", "city"]);
  populateSelect(el.categoricalColumnSelect, categoricalOptions, prettifyColumn);
  el.categoricalColumnSelect.onchange = () => renderCategoryPanel(model);
  renderCategoryPanel(model);

  renderChartCopy(
    el.correlationCopy,
    "Correlation Heatmap",
    "This matrix helps justify feature selection by showing which funding fields move together and which add separate signal.",
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

function renderZeroProblemPanel(model) {
  const features = model.zeroSummary.features;
  const highest = model.zeroSummary.highest;
  renderChartCopy(
    el.zeroProblemCopy,
    "Zero Problem by Funding Source",
    "Many Crunchbase funding-source amount columns are real zeros, not blank cells. That means absence of a funding type is part of the signal.",
    "Each bar shows the share of startups where that funding-source amount is exactly zero.",
    highest
      ? `${highest.label} is the most zero-heavy field at ${formatPercent(highest.zeroRate)}. Across these source fields, ${formatPercent(model.zeroSummary.zeroRate)} of values are zero.`
      : "No source-funding zero rates were available.",
  );

  renderBarChart(
    el.zeroProblemChart,
    features.map((feature, index) => ({
      label: feature.label,
      value: feature.zeroRate,
      color: [CLUSTER_COLORS[3], CLUSTER_COLORS[1], CLUSTER_COLORS[2], CLUSTER_COLORS[0]][index % 4],
    })),
    {
      left: 170,
      height: 285,
      scaleMax: 1,
      axisFormatter: (value) => formatPercent(value, 0),
      valueFormatter: (value) => formatPercent(value),
    },
  );

  populateSelect(el.zeroFeatureSelect, features.map((feature) => feature.column), (column) => {
    const feature = features.find((item) => item.column === column);
    return feature?.label ?? prettifyColumn(column);
  });
  el.zeroFeatureSelect.onchange = () => renderZeroFeatureBreakdown(model);
  renderZeroFeatureBreakdown(model);
}

function renderZeroFeatureBreakdown(model) {
  const feature = model.zeroSummary.features.find((item) => item.column === el.zeroFeatureSelect.value)
    ?? model.zeroSummary.highest;
  if (!feature) {
    el.zeroFeatureBreakdown.innerHTML = `<p>No zero-heavy funding-source field was available.</p>`;
    return;
  }

  const nonZeroCount = feature.count - feature.zeroCount;
  el.zeroFeatureBreakdown.innerHTML = `
    <div class="zero-stat-main">
      <span>${formatPercent(feature.zeroRate)}</span>
      <strong>zero values</strong>
    </div>
    <dl class="zero-stat-list">
      <div>
        <dt>Zero rows</dt>
        <dd>${formatNumber(feature.zeroCount)}</dd>
      </div>
      <div>
        <dt>Non-zero rows</dt>
        <dd>${formatNumber(nonZeroCount)}</dd>
      </div>
      <div>
        <dt>Model response</dt>
        <dd>Use source ratios, log transforms, RobustScaler, and median profiles.</dd>
      </div>
    </dl>
  `;
}

function renderHistogramPanel(model) {
  const column = el.numericColumnSelect.value;
  const unitHint = featureUnitLabel(column);
  const zeroFeature = model.zeroSummary.features.find((feature) => feature.column === column);
  const takeaway = zeroFeature && zeroFeature.zeroRate > 0.2
    ? `${formatPercent(zeroFeature.zeroRate)} of ${prettifyColumn(column)} values are zero, which is why the notebook used log features, ratios, and robust scaling.`
    : column
      ? `${prettifyColumn(column)} ${unitHint} is shown with ${formatNumber(histogram(model.rows, column).length)} value ranges.`
      : "Choose a numeric feature to inspect its distribution.";
  renderChartCopy(
    el.histogramCopy,
    `Numerical Distribution ${unitHint}`,
    "This chart shows how startups are spread across a selected funding feature.",
    "Each bar is a value range; taller bars mean more startups fall into that range.",
    takeaway,
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
    "This chart surfaces useful business labels such as market, status, country, or city.",
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
      label: "Method",
      value: "K-Means",
      note: "The app reads the exported labels; it does not refit the model.",
    },
    {
      label: "Feature prep",
      value: "Logs + ratios",
      note: "Logs reduce funding skew; ratios show which source dominates.",
    },
    {
      label: "2D view",
      value: "2 PCs",
      note: `${formatNumber(model.featureColumns.length)} robust-scaled engineered features are projected for the chart.`,
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

  populateGroupedSelect(el.featureCompareSelect, model.interpretableFeatures);
  el.featureCompareSelect.onchange = () => renderFeatureCompare(model);
  renderFeatureCompare(model);

  renderClusterProfiles(clusterSummary);
  renderClusterComparison(model);
}

function renderFeatureCompare(model) {
  const feature = el.featureCompareSelect.value;
  const unitHint = featureUnitLabel(feature);
  const unitType = featureUnit(feature);
  const rows = model.clusterSummary.clusters.map((cluster, index) => ({
    label: `Cluster ${cluster.cluster}`,
    value: cluster.features[feature]?.median ?? 0,
    color: CLUSTER_COLORS[index % CLUSTER_COLORS.length],
  }));
  const top = [...rows].sort((a, b) => b.value - a.value)[0];
  const howText = unitType === "USD"
    ? "Longer bars mean higher median dollar amount for that cluster."
    : unitType === "%"
      ? "Longer bars mean a higher share (0 to 1 scale, where 1 = 100%)."
      : "Longer bars mean a higher median value for that cluster.";
  renderChartCopy(
    el.featureCompareCopy,
    `Feature Medians by Cluster ${unitHint}`,
    "This chart compares cluster medians for a selected real-world funding feature.",
    howText,
    feature && top ? `${top.label} has the highest median ${prettifyColumn(feature)} ${unitHint}.` : "Choose a feature to compare clusters.",
  );
  if (!feature) return renderEmpty(el.featureByClusterChart, "No feature selected.");
  const chartOptions = {
    left: 110,
    axisFormatter: unitType === "USD"
      ? formatMoney
      : unitType === "%"
        ? (value) => formatPercent(value, 0)
        : (value) => formatNumber(value, 1),
    valueFormatter: (value) => formatFeatureValue(feature, value),
  };
  if (unitType === "%") chartOptions.scaleMax = 1;
  renderBarChart(el.featureByClusterChart, rows, chartOptions);
}

function renderClusterProfiles(clusterSummary) {
  el.clusterProfiles.innerHTML = clusterSummary.clusters
    .map((cluster, index) => {
      const status = cluster.topCategories.status?.[0]?.label ?? "mixed status";
      const market = cluster.topCategories.market?.[0]?.label ?? "mixed markets";
      return `
        <article class="profile-card">
          <span class="badge" style="color:${CLUSTER_COLORS[index % CLUSTER_COLORS.length]}">Cluster ${escapeHtml(cluster.cluster)}</span>
          <h3>${escapeHtml(cluster.name)}</h3>
          <p>${escapeHtml(describeMainCluster(cluster))}</p>
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
  const comparisonFeatures = [
    "funding_total_usd",
    "funding_rounds",
    "early_stage_funding_ratio",
    "venture_ratio",
    "debt_financing_ratio",
    "private_equity_ratio",
  ].filter((feature) => model.interpretableFeatures.includes(feature));
  const columns = [
    { key: "cluster", label: "Cluster" },
    { key: "count", label: "Rows", format: formatNumber },
    { key: "percentage", label: "Share", format: formatPercent },
    ...comparisonFeatures.map((feature) => ({
      key: feature,
      label: prettifyColumn(feature),
      value: (row) => row[feature],
      format: (value) => formatFeatureValue(feature, value),
    })),
  ];
  const rows = model.clusterSummary.clusters.map((cluster) => {
    const row = {
      cluster: `Cluster ${cluster.cluster}`,
      count: cluster.count,
      percentage: cluster.percentage,
    };
    for (const feature of comparisonFeatures) {
      row[feature] = cluster.features[feature]?.median;
    }
    return row;
  });
  renderTable(el.clusterComparisonTable, columns, rows);
}

function buildCluster0Model(dataset, totalRows, mainClusterSummary) {
  if (!dataset?.rows?.length) return null;
  const rows = dataset.rows.map((row, index) => ({ ...row, __rowNumber: index + 1 }));
  const summary = summarizeDataset({ ...dataset, rows });
  const featureColumns = chooseInterpretableFeatures(summary);
  const clusterColumn = dataset.headers.includes("SubCluster_Name") ? "SubCluster_Name" : "SubCluster";
  const clusterSummary = computeClusterSummary(rows, clusterColumn, featureColumns, summary.categoricalColumns);
  const mainCluster0 = mainClusterSummary.clusters.find((cluster) => String(cluster.cluster) === "0");

  return {
    dataset,
    rows,
    summary,
    featureColumns,
    clusterColumn,
    clusterSummary,
    shareOfDataset: totalRows ? rows.length / totalRows : mainCluster0?.percentage ?? 0,
    notebookSilhouette: 0.5011,
  };
}

function renderCluster0(model) {
  if (!model.cluster0) {
    el.cluster0.classList.add("hidden");
    return;
  }
  el.cluster0.classList.remove("hidden");
  const cluster0 = model.cluster0;
  const summary = cluster0.clusterSummary;
  const largest = summary.largest;

  el.cluster0Intro.textContent =
    "Verdict: keep it as a zoom-in. The main result is still the four-cluster model; Cluster 0 is split only to make the largest group easier to explain in a presentation.";

  renderMetricCards(el.cluster0Metrics, [
    {
      label: "Cluster 0 rows",
      value: formatNumber(cluster0.rows.length),
      note: `${formatPercent(cluster0.shareOfDataset)} of the clustered startups.`,
    },
    {
      label: "Subclusters",
      value: formatNumber(summary.clusters.length),
      note: "K=3 creates three readable profiles inside the largest group.",
    },
    {
      label: "Silhouette",
      value: formatNumber(cluster0.notebookSilhouette, 2),
      note: "Notebook score used as support, not as a new main model.",
    },
  ]);

  renderChartCopy(
    el.subclusterSizeCopy,
    "Cluster 0 Subcluster Sizes",
    "This chart shows how Cluster 0 splits into three simpler groups.",
    "Longer bars mean more startups inside that subcluster.",
    largest
      ? `${largest.cluster} is the biggest subcluster with ${formatPercent(largest.percentage)} of Cluster 0.`
      : "No subclusters were available.",
  );
  renderBarChart(
    el.subclusterSizeChart,
    summary.clusters.map((cluster, index) => ({
      label: cluster.cluster,
      value: cluster.count,
      color: CLUSTER_COLORS[index % CLUSTER_COLORS.length],
    })),
    { left: 190, valueFormatter: formatNumber },
  );

  renderChartCopy(
    el.subclusterFundingCopy,
    "Median Funding by Subcluster",
    "This keeps the Cluster 0 story focused on one robust comparison instead of repeating every funding-source ratio.",
    "Higher bars mean the typical startup in that subcluster has raised more money.",
    describeSubclusterFundingTakeaway(summary),
  );
  renderBarChart(
    el.subclusterFundingChart,
    summary.clusters.map((cluster, index) => ({
      label: cluster.cluster,
      value: cluster.features.funding_total_usd?.median ?? 0,
      color: CLUSTER_COLORS[index % CLUSTER_COLORS.length],
    })),
    { left: 190, valueFormatter: formatMoney },
  );

  renderSubclusterProfiles(summary);
  renderSubclusterComparison(cluster0);
}

function renderSubclusterProfiles(clusterSummary) {
  el.subclusterProfiles.innerHTML = clusterSummary.clusters
    .map((cluster, index) => `
      <article class="profile-card">
        <span class="badge" style="color:${CLUSTER_COLORS[index % CLUSTER_COLORS.length]}">${escapeHtml(cluster.cluster)}</span>
        <h3>${escapeHtml(cluster.cluster)}</h3>
        <p>${escapeHtml(describeSubcluster(cluster))}</p>
        <div class="profile-stats">
          <span class="profile-stat">${formatNumber(cluster.count)} rows</span>
          <span class="profile-stat">${formatPercent(cluster.percentage)}</span>
          <span class="profile-stat">${formatMoney(cluster.features.funding_total_usd?.median)} median funding</span>
        </div>
      </article>
    `)
    .join("");
}

function renderSubclusterComparison(cluster0) {
  const features = [
    "funding_total_usd",
    "funding_rounds",
    "early_stage_funding_ratio",
    "venture_ratio",
    "debt_financing_ratio",
    "private_equity_ratio",
  ].filter((feature) => cluster0.featureColumns.includes(feature));
  const columns = [
    { key: "subcluster", label: "Subcluster" },
    { key: "count", label: "Rows", format: formatNumber },
    { key: "percentage", label: "Share", format: formatPercent },
    ...features.map((feature) => ({
      key: feature,
      label: prettifyColumn(feature),
      value: (row) => row[feature],
      format: (value) => formatFeatureValue(feature, value),
    })),
  ];
  const rows = cluster0.clusterSummary.clusters.map((cluster) => {
    const row = {
      subcluster: cluster.cluster,
      count: cluster.count,
      percentage: cluster.percentage,
    };
    for (const feature of features) row[feature] = cluster.features[feature]?.median;
    return row;
  });
  renderTable(el.subclusterComparisonTable, columns, rows);
}

function renderVisuals(model) {
  const explained = model.projection.explainedKnown
    ? model.projection.explained.map((value) => formatPercent(value)).join(" + ")
    : "";
  const projectionTakeaway = !model.projection.points.length
    ? "There were not enough numeric clustering features to create a projection."
    : model.projection.source === "exported"
      ? "The plot uses exported PC1 and PC2 columns when they are available in the loaded CSV."
      : `The first two components explain about ${explained} of the robust-scaled feature variation in this app view.`;
  renderChartCopy(
    el.projectionCopy,
    "Two-Component PCA Projection",
    "This mirrors the useful 2D visualization step from teste.ipynb: the clustering labels stay fixed, and the app projects the engineered funding features for explanation.",
    "Each dot is a sampled startup. Nearby dots have similar robust-scaled funding profiles; colors show the exported cluster labels.",
    projectionTakeaway,
  );
  renderScatter(el.projectionChart, model.projection.points, {
    xLabel: "PC1",
    yLabel: "PC2",
  });

  const heatmap = buildClusterHeatmap(model);
  const topSeparation = model.separation[0];
  renderChartCopy(
    el.clusterHeatmapCopy,
    "Cluster Feature Heatmap",
    "This heatmap explains the model decisions by showing which engineered features pull each cluster above or below the dataset average.",
    "Blue cells are higher than average; gold cells are lower than average. The numbers are standardized differences.",
    topSeparation
      ? `${prettifyColumn(topSeparation.feature)} creates the widest displayed split between clusters.`
      : "No feature split could be calculated.",
  );
  renderHeatmap(el.clusterHeatmap, heatmap, { cellSize: 45, left: 120 });

  renderChartCopy(
    el.outlierCopy,
    "Possible Outliers",
    "These rows explain why the workflow used log features, robust scaling, and median profiles instead of relying on raw averages.",
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

function renderBusiness(model) {
  const cluster0 = model.clusterSummary.clusters.find((cluster) => String(cluster.cluster) === "0");
  const cluster0Subgroups = model.cluster0?.clusterSummary.clusters.length ?? 0;

  const cards = [
    {
      title: "What the model is useful for",
      body: "It segments startups by funding behavior: scale, number of rounds, stage, and dominant funding source. It is descriptive, not a success predictor.",
    },
    {
      title: "Main portfolio reading",
      body: `Cluster 0 is the broad early-stage base (${formatPercent(cluster0?.percentage ?? 0)}). Cluster 3 is the VC growth group, Cluster 1 mixes venture with debt, and Cluster 2 is private-equity-heavy.`,
    },
    {
      title: "Why Cluster 0 matters",
      body: cluster0Subgroups
        ? "Because Cluster 0 is very large, the K=3 zoom separates seed-stage, small VC-backed, and multi-round early-stage profiles without changing the main model."
        : "Cluster 0 is large enough that it deserves a separate explanation, but the subcluster file was not loaded.",
    },
    {
      title: "How to present it",
      body: "Present the four clusters first, use the two-component PCA plot to show separation, then use Cluster 0 as a short zoom-in example.",
    },
  ];

  el.businessGrid.innerHTML = cards
    .map(
      (card) => `
        <article class="business-card">
          <h3>${escapeHtml(card.title)}</h3>
          <p>${escapeHtml(card.body)}</p>
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

function resetGuessState() {
  state.guess = {
    currentRow: null,
    answered: false,
    correct: 0,
    total: 0,
  };
}

function renderGuessGame(model) {
  if (!el.guessFacts || !el.guessOptions || !el.guessNextButton) return;
  updateGuessScore();
  el.guessNextButton.onclick = () => startGuessRound(model);
  startGuessRound(model);
}

function startGuessRound(model) {
  const row = pickGuessRow(model);
  if (!row) {
    el.guessTitle.textContent = "No quiz row available";
    el.guessSubtitle.textContent = "";
    el.guessFacts.innerHTML = "";
    el.guessOptions.innerHTML = "";
    el.guessFeedback.textContent = "The exported dataset does not have enough cluster-labelled rows for the quiz.";
    return;
  }

  state.guess.currentRow = row;
  state.guess.answered = false;
  el.guessTitle.textContent = `Anonymous startup #${row.__rowNumber ?? "?"}`;
  el.guessSubtitle.textContent = buildGuessSubtitle(row);
  el.guessFacts.innerHTML = buildGuessFacts(row)
    .map(
      (fact) => `
        <div class="guess-fact">
          <span>${escapeHtml(fact.label)}</span>
          <strong>${escapeHtml(fact.value)}</strong>
          <small>${escapeHtml(fact.note)}</small>
        </div>
      `,
    )
    .join("");

  const clusters = uniqueClusterValues(model.rows, model.clusterResult.clusterColumn);
  el.guessOptions.innerHTML = clusters
    .map((cluster, index) => {
      const color = CLUSTER_COLORS[index % CLUSTER_COLORS.length];
      return `
        <button class="guess-option" type="button" data-cluster="${escapeHtml(cluster)}" style="--cluster-color:${color}">
          <span>Cluster ${escapeHtml(cluster)}</span>
          <small>Lock answer</small>
        </button>
      `;
    })
    .join("");
  for (const button of el.guessOptions.querySelectorAll(".guess-option")) {
    button.onclick = () => handleGuess(model, button.dataset.cluster);
  }

  el.guessFeedback.textContent = "Pick the cluster that best matches this funding profile.";
}

function handleGuess(model, selectedCluster) {
  if (state.guess.answered || !state.guess.currentRow) return;
  state.guess.answered = true;
  state.guess.total += 1;

  const actualCluster = toDisplayValue(state.guess.currentRow[model.clusterResult.clusterColumn]);
  const isCorrect = selectedCluster === actualCluster;
  if (isCorrect) state.guess.correct += 1;
  updateGuessScore();

  for (const button of el.guessOptions.querySelectorAll(".guess-option")) {
    const cluster = button.dataset.cluster;
    button.disabled = true;
    button.classList.toggle("correct", cluster === actualCluster);
    button.classList.toggle("wrong", cluster === selectedCluster && !isCorrect);
  }

  const clusterProfile = model.clusterSummary.clusters.find((cluster) => String(cluster.cluster) === actualCluster);
  const headline = isCorrect
    ? "Correct. You read the funding fingerprint."
    : `Not quite. This one belongs to Cluster ${actualCluster}.`;
  el.guessFeedback.innerHTML = `
    <strong>${escapeHtml(headline)}</strong>
    <p>${escapeHtml(buildGuessExplanation(state.guess.currentRow, actualCluster, clusterProfile))}</p>
  `;
}

function updateGuessScore() {
  if (el.guessScore) el.guessScore.textContent = `${formatNumber(state.guess.correct)} / ${formatNumber(state.guess.total)}`;
}

function pickGuessRow(model) {
  const clusterColumn = model.clusterResult.clusterColumn;
  const candidates = model.rows.filter((row) => {
    const cluster = toDisplayValue(row[clusterColumn]);
    if (cluster === "(missing)") return false;
    return ["funding_total_usd", "funding_rounds", "stage_level", "venture", "debt_financing", "private_equity", "early_stage_funding"]
      .some((column) => Number.isFinite(toNumber(row[column])));
  });
  if (!candidates.length) return null;
  let row = candidates[Math.floor(Math.random() * candidates.length)];
  if (candidates.length > 1 && row === state.guess.currentRow) {
    row = candidates[(candidates.indexOf(row) + 1) % candidates.length];
  }
  return row;
}

function buildGuessSubtitle(row) {
  const market = toDisplayValue(row.market);
  const status = toDisplayValue(row.status);
  const country = toDisplayValue(row.country_code);
  const parts = [market, status, country].filter((part) => part && part !== "(missing)");
  return parts.length ? parts.join(" - ") : "Real exported row, name hidden for the challenge.";
}

function buildGuessFacts(row) {
  const zeroCount = ZERO_SOURCE_FEATURES
    .map((feature) => toNumber(row[feature.column]))
    .filter((value) => Number.isFinite(value) && value === 0)
    .length;
  return [
    {
      label: "Total funding",
      value: formatGuessMoney(row.funding_total_usd),
      note: "Scale signal",
    },
    {
      label: "Funding rounds",
      value: formatGuessNumber(row.funding_rounds, 0),
      note: fundingRoundNote(row.funding_rounds),
    },
    {
      label: "Stage level",
      value: formatGuessNumber(row.stage_level, 1),
      note: stageLevelNote(row.stage_level),
    },
    {
      label: "Top source",
      value: topFundingSource(row).label,
      note: topFundingSource(row).note,
    },
    {
      label: "Venture",
      value: formatGuessMoney(row.venture),
      note: sourceNote(row.venture),
    },
    {
      label: "Debt financing",
      value: formatGuessMoney(row.debt_financing),
      note: sourceNote(row.debt_financing),
    },
    {
      label: "Private equity",
      value: formatGuessMoney(row.private_equity),
      note: sourceNote(row.private_equity),
    },
    {
      label: "Zero source fields",
      value: `${formatNumber(zeroCount)} / ${formatNumber(ZERO_SOURCE_FEATURES.length)}`,
      note: "Absence is also signal",
    },
  ];
}

function buildGuessExplanation(row, actualCluster, clusterProfile) {
  const description = clusterProfile
    ? describeMainCluster(clusterProfile)
    : `Cluster ${actualCluster} is the exported label for this row.`;
  return `${description} This card had ${formatGuessMoney(row.funding_total_usd)} total funding, ${fundingRoundPhrase(row.funding_rounds)}, stage level ${formatGuessNumber(row.stage_level, 1)}, and ${fundingSourceSentence(row)}.`;
}

function topFundingSource(row) {
  const ranked = ZERO_SOURCE_FEATURES
    .map((feature) => ({ label: feature.label.replace(" funding", ""), value: toNumber(row[feature.column]) }))
    .filter((feature) => Number.isFinite(feature.value))
    .sort((a, b) => b.value - a.value);
  const top = ranked[0];
  if (!top || top.value <= 0) return { label: "None above zero", note: "All source amounts are zero" };
  return { label: top.label, note: `${formatMoney(top.value)} recorded` };
}

function fundingSourceSentence(row) {
  const top = topFundingSource(row);
  const zeroCount = ZERO_SOURCE_FEATURES
    .map((feature) => toNumber(row[feature.column]))
    .filter((value) => Number.isFinite(value) && value === 0)
    .length;
  return `${top.label.toLowerCase()} as the strongest source clue, with ${formatNumber(zeroCount)} zero source fields`;
}

function formatGuessMoney(value) {
  const number = toNumber(value);
  return Number.isFinite(number) ? formatMoney(number) : "N/A";
}

function formatGuessNumber(value, digits = 0) {
  const number = toNumber(value);
  return Number.isFinite(number) ? formatNumber(number, digits) : "N/A";
}

function fundingRoundNote(value) {
  const rounds = toNumber(value);
  if (!Number.isFinite(rounds)) return "Not recorded";
  if (rounds <= 1) return "Single formal raise";
  if (rounds >= 4) return "Many recorded raises";
  return "Several recorded raises";
}

function fundingRoundPhrase(value) {
  const rounds = toNumber(value);
  if (!Number.isFinite(rounds)) return "an unrecorded number of funding rounds";
  const label = Math.round(rounds) === 1 ? "funding round" : "funding rounds";
  return `${formatNumber(rounds, 0)} ${label}`;
}

function stageLevelNote(value) {
  const stage = toNumber(value);
  if (!Number.isFinite(stage)) return "Not recorded";
  if (stage <= 1) return "Earlier maturity";
  if (stage >= 3) return "Later maturity";
  return "Middle maturity";
}

function sourceNote(value) {
  const number = toNumber(value);
  if (!Number.isFinite(number)) return "Not recorded";
  return number === 0 ? "No recorded amount" : "Recorded amount";
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

function computeZeroSummary(rows) {
  const features = ZERO_SOURCE_FEATURES.map(({ column, label }) => {
    const values = rows.map((row) => toNumber(row[column])).filter(Number.isFinite);
    const zeroCount = values.filter((value) => value === 0).length;
    return {
      column,
      label,
      count: values.length,
      zeroCount,
      zeroRate: values.length ? zeroCount / values.length : 0,
    };
  }).filter((feature) => feature.count > 0);

  const totalCells = features.reduce((sum, feature) => sum + feature.count, 0);
  const zeroCells = features.reduce((sum, feature) => sum + feature.zeroCount, 0);
  return {
    features,
    totalCells,
    zeroCells,
    zeroRate: totalCells ? zeroCells / totalCells : 0,
    highest: [...features].sort((a, b) => b.zeroRate - a.zeroRate)[0] ?? null,
  };
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

function describeMainCluster(cluster) {
  const id = String(cluster.cluster);
  if (id === "0") {
    return "The largest and most early-stage-heavy group: low median funding, usually one round, and mostly early-stage funding.";
  }
  if (id === "1") {
    return "A mixed financing group where debt financing is much more relevant, usually alongside venture funding.";
  }
  if (id === "2") {
    return "A small, capital-intensive group dominated by private equity and much higher median funding.";
  }
  if (id === "3") {
    return "The clearer venture-backed growth group, with higher stage level and venture funding dominating the funding mix.";
  }
  return `This group is mainly separated by ${prettifyColumn(cluster.distinguishing[0]?.feature ?? "its funding mix")}.`;
}

function describeSubcluster(cluster) {
  const name = String(cluster.cluster).toLowerCase();
  if (name.includes("venture")) {
    return "VC-backed companies that are still smaller or earlier than the main venture-growth cluster.";
  }
  if (name.includes("multi")) {
    return "Early-stage companies with more rounds, suggesting more traction than the simplest seed-stage profile.";
  }
  if (name.includes("seed")) {
    return "Small, usually one-round companies dominated by seed, angel, or grant-style funding.";
  }
  return `This subcluster is mainly separated by ${prettifyColumn(cluster.distinguishing[0]?.feature ?? "its funding mix")}.`;
}

function describeSubclusterFundingTakeaway(clusterSummary) {
  const ranked = [...clusterSummary.clusters].sort(
    (a, b) => (b.features.funding_total_usd?.median ?? 0) - (a.features.funding_total_usd?.median ?? 0),
  );
  const top = ranked[0];
  const bottom = ranked[ranked.length - 1];
  if (!top || !bottom) return "No funding comparison was available.";
  return `${top.cluster} has the highest median funding (${formatMoney(top.features.funding_total_usd?.median)}), while ${bottom.cluster} is lowest (${formatMoney(bottom.features.funding_total_usd?.median)}).`;
}

function preferredColumns(available, preferred) {
  const chosen = preferred.filter((column) => available.includes(column));
  if (chosen.length) return chosen;
  return available.filter((column) => !/^cluster$/i.test(column)).slice(0, 8);
}

function formatFeatureValue(feature, value) {
  if (["funding_total_usd", "early_stage_funding", "venture", "debt_financing", "private_equity"].includes(feature)) {
    return formatMoney(value);
  }
  if (feature.endsWith("_ratio")) return formatPercent(value);
  return formatNumber(value, 1);
}

function populateSelect(select, values, labelFormatter = (value) => value) {
  select.innerHTML = values
    .map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(labelFormatter(value))}</option>`)
    .join("");
}

function populateGroupedSelect(select, values) {
  const groups = { "Dollar amounts (USD)": [], "Shares (%)": [], "Other": [] };
  for (const col of values) {
    const unit = featureUnit(col);
    if (unit === "USD") groups["Dollar amounts (USD)"].push(col);
    else if (unit === "%") groups["Shares (%)"].push(col);
    else groups["Other"].push(col);
  }
  let html = "";
  for (const [groupLabel, cols] of Object.entries(groups)) {
    if (!cols.length) continue;
    html += `<optgroup label="${escapeHtml(groupLabel)}">`;
    for (const col of cols) {
      html += `<option value="${escapeHtml(col)}">${escapeHtml(prettifyColumn(col))}</option>`;
    }
    html += `</optgroup>`;
  }
  select.innerHTML = html;
}

function labelWithUnit(column) {
  const label = prettifyColumn(column);
  const unit = featureUnitLabel(column);
  return unit ? `${label} ${unit}` : label;
}

function setStatus(message, type) {
  el.loadStatus.textContent = message;
  el.loadStatus.className = `notice notice-${type}`;
}
