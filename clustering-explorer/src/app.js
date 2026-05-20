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
  renderStackedBarChart,
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
    "cluster0",
    "cluster0Intro",
    "cluster0Metrics",
    "subclusterSizeCopy",
    "subclusterSizeChart",
    "subclusterFundingCopy",
    "subclusterFundingChart",
    "subclusterCompositionCopy",
    "subclusterCompositionChart",
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
  const cluster0Dataset = datasets.cluster0 ?? null;
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
    cluster0,
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
  renderCluster0(model);
  renderVisuals(model);
  renderInsights(model);
  renderBusiness(model);
  renderExplorer(model);
}

function renderSourceDetails(model) {
  const rawText = model.rawSummary
    ? `${formatNumber(model.rawSummary.rows)} raw rows available for context`
    : "Raw CSV was optional and was not loaded";
  const cluster0Text = model.cluster0
    ? `${formatNumber(model.cluster0.rows.length)} Cluster 0 rows with subcluster labels`
    : "Cluster 0 subcluster file was optional and was not loaded";
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
        <strong>Cluster 0 zoom</strong>
        <span>${escapeHtml(cluster0Text)}</span>
      </div>
      <div class="source-item">
        <strong>Notebook path</strong>
        <span>Funding features, RobustScaler, PCA, K-Means with K=4, then Cluster 0 subclustering with K=3.</span>
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
      label: "Main clusters",
      value: formatNumber(model.clusterSummary.clusters.length),
      note: model.clusterResult.usedExisting ? "Read from the exported CSV labels." : "Generated only inside this app.",
    },
    {
      label: "Cluster 0 subgroups",
      value: model.cluster0 ? formatNumber(model.cluster0.clusterSummary.clusters.length) : "n/a",
      note: model.cluster0
        ? `${formatPercent(model.cluster0.shareOfDataset)} of the clustered data is examined more closely.`
        : "Subcluster file was not loaded.",
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
  const unitHint = featureUnitLabel(column);
  renderChartCopy(
    el.histogramCopy,
    `Numerical Distribution ${unitHint}`,
    "This chart shows how startups are spread across a selected funding feature.",
    "Each bar is a value range; taller bars mean more startups fall into that range.",
    column ? `${prettifyColumn(column)} ${unitHint} is shown with ${formatNumber(histogram(model.rows, column).length)} value ranges.` : "Choose a numeric feature to inspect its distribution.",
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
      note: "The notebook groups similar funding profiles.",
    },
    {
      label: "Preparation",
      value: "Scaler + PCA",
      note: "RobustScaler reduces outlier impact; PCA makes compact model inputs.",
    },
    {
      label: "Features used",
      value: formatNumber(model.featureColumns.length),
      note: "Funding totals, rounds, stage, and funding-source ratios.",
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
  renderBarChart(el.featureByClusterChart, rows, {
    left: 110,
    valueFormatter: (value) => formatFeatureValue(feature, value),
  });
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
    "Verdict: keep it. Cluster 0 is the largest main group, so the subclustering is useful as a complementary explanation. It should not replace the four-cluster model.";

  renderMetricCards(el.cluster0Metrics, [
    {
      label: "Cluster 0 rows",
      value: formatNumber(cluster0.rows.length),
      note: `${formatPercent(cluster0.shareOfDataset)} of the clustered startups.`,
    },
    {
      label: "Subclusters",
      value: formatNumber(summary.clusters.length),
      note: "K=3 was chosen because it gives three easy-to-explain profiles.",
    },
    {
      label: "Silhouette",
      value: formatNumber(cluster0.notebookSilhouette, 2),
      note: "Notebook sample score: acceptable for a simple explanatory split.",
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
    "This keeps the comparison simple by using median total funding instead of averages.",
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

  const composition = buildFundingComposition(summary);
  renderChartCopy(
    el.subclusterCompositionCopy,
    "Funding Mix Inside Cluster 0",
    "This shows which funding source dominates each internal group.",
    "Each bar is one subcluster; the colored parts show average funding-source share.",
    "The split is easy to explain: seed/early-stage companies, small VC-backed companies, and early-stage companies with more rounds.",
  );
  renderStackedBarChart(el.subclusterCompositionChart, composition.rows, {
    left: 190,
    legend: composition.legend,
  });

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

function renderBusiness(model) {
  const cluster0 = model.clusterSummary.clusters.find((cluster) => String(cluster.cluster) === "0");
  const cluster0Subgroups = model.cluster0?.clusterSummary.clusters.length ?? 0;

  const cards = [
    {
      title: "What the model is useful for",
      body: "It segments startups by funding behavior. It does not predict success, but it helps explain which companies look financially similar.",
    },
    {
      title: "Main portfolio reading",
      body: `Cluster 0 is the broad early-stage base (${formatPercent(cluster0?.percentage ?? 0)}). Cluster 3 is the clearer VC growth group, Cluster 1 mixes venture with debt, and Cluster 2 is the private-equity-heavy group.`,
    },
    {
      title: "Why Cluster 0 matters",
      body: cluster0Subgroups
        ? `Because Cluster 0 is very large, the K=3 subclustering makes the story more useful: seed-stage, small VC-backed, and multi-round early-stage startups.`
        : "Cluster 0 is large enough that it deserves a separate explanation, but the subcluster file was not loaded.",
    },
    {
      title: "How to present it",
      body: "Start with the four main clusters, then use Cluster 0 as a zoom-in example. That keeps the analysis simple while showing deeper thinking.",
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

function buildFundingComposition(clusterSummary) {
  const segments = [
    { feature: "early_stage_funding_ratio", label: "Early-stage", color: CLUSTER_COLORS[0] },
    { feature: "venture_ratio", label: "Venture", color: CLUSTER_COLORS[2] },
    { feature: "debt_financing_ratio", label: "Debt", color: CLUSTER_COLORS[1] },
    { feature: "private_equity_ratio", label: "Private equity", color: CLUSTER_COLORS[3] },
  ];
  return {
    legend: segments.map((segment) => ({ label: segment.label, color: segment.color })),
    rows: clusterSummary.clusters.map((cluster) => ({
      label: cluster.cluster,
      segments: segments.map((segment) => ({
        label: segment.label,
        value: cluster.features[segment.feature]?.mean ?? 0,
        color: segment.color,
      })),
    })),
  };
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
