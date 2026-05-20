import { isMissing, toDisplayValue, toNumber } from "./data-loader.js";

export const CLUSTER_NAME_HINTS = {
  0: "Broad early-stage group",
  1: "Debt-financed startups",
  2: "Private equity profile",
  3: "Venture-backed growth group",
};

// Feature names inferred from teste.ipynb; this app reuses the concept only.
export const KNOWN_CLUSTER_FEATURES = [
  "log_funding_total_usd",
  "log_funding_rounds",
  "log_early_stage_funding",
  "log_venture",
  "log_debt_financing",
  "log_private_equity",
  "stage_level",
  "early_stage_funding_ratio",
  "venture_ratio",
  "debt_financing_ratio",
  "private_equity_ratio",
];

export const INTERPRETABLE_FEATURES = [
  "funding_total_usd",
  "funding_rounds",
  "early_stage_funding",
  "venture",
  "debt_financing",
  "private_equity",
  "stage_level",
  "early_stage_funding_ratio",
  "venture_ratio",
  "debt_financing_ratio",
  "private_equity_ratio",
];

const COLUMN_LABELS = {
  funding_total_usd: "Total funding",
  funding_rounds: "Funding rounds",
  early_stage_funding: "Early-stage funding",
  venture: "Venture funding",
  debt_financing: "Debt financing",
  private_equity: "Private equity",
  stage_level: "Stage level",
  early_stage_funding_ratio: "Early-stage share",
  venture_ratio: "Venture share",
  debt_financing_ratio: "Debt share",
  private_equity_ratio: "Private equity share",
  log_funding_total_usd: "Log total funding",
  log_funding_rounds: "Log funding rounds",
  log_early_stage_funding: "Log early-stage funding",
  log_venture: "Log venture funding",
  log_debt_financing: "Log debt financing",
  log_private_equity: "Log private equity",
  country_code: "Country",
  SubCluster_Name: "Subcluster",
};

const UNIT_USD = ["funding_total_usd", "early_stage_funding", "venture", "debt_financing", "private_equity"];
const UNIT_PERCENT = ["early_stage_funding_ratio", "venture_ratio", "debt_financing_ratio", "private_equity_ratio"];
const UNIT_COUNT = ["funding_rounds", "stage_level"];

/** Returns the unit type for a feature column: 'USD', '%', 'count', or 'log'. */
export function featureUnit(column) {
  if (UNIT_USD.includes(column)) return "USD";
  if (UNIT_PERCENT.includes(column)) return "%";
  if (UNIT_COUNT.includes(column)) return "count";
  if (String(column).startsWith("log_")) return "log";
  return "";
}

/** Returns a readable label suffix like '(USD)' or '(%)'. */
export function featureUnitLabel(column) {
  const unit = featureUnit(column);
  if (unit === "USD") return "(USD)";
  if (unit === "%") return "(%)";
  if (unit === "count") return "(count)";
  if (unit === "log") return "(log-scale)";
  return "";
}

export function summarizeDataset(dataset, options = {}) {
  const rows = dataset.rows ?? [];
  const headers = dataset.headers ?? [];
  const profiles = headers.map((column) => profileColumn(rows, column));
  const numericColumns = profiles.filter((profile) => profile.type === "number").map((profile) => profile.name);
  const categoricalColumns = profiles
    .filter((profile) => profile.type === "category")
    .map((profile) => profile.name);
  const dateColumns = profiles.filter((profile) => profile.type === "date").map((profile) => profile.name);

  return {
    label: dataset.label ?? options.label ?? "Dataset",
    path: dataset.path ?? "",
    rows: rows.length,
    columns: headers.length,
    profiles,
    numericColumns,
    categoricalColumns,
    dateColumns,
    missingTop: profiles
      .filter((profile) => profile.missing > 0)
      .sort((a, b) => b.missingRate - a.missingRate)
      .slice(0, 12),
    warnings: buildWarnings(rows.length, profiles),
  };
}

function profileColumn(rows, column) {
  const values = rows.map((row) => row[column]);
  const missing = values.filter(isMissing).length;
  const present = values.filter((value) => !isMissing(value));
  const sample = present[0] ?? null;
  const uniqueValues = new Set();
  for (const value of present.slice(0, 5000)) uniqueValues.add(String(value));

  const numericValues = present.map(toNumber).filter((value) => value !== null);
  const numericRate = present.length ? numericValues.length / present.length : 0;
  const dateRate = inferDateRate(present);

  let type = "category";
  if (/^cluster$/i.test(column)) type = "category";
  else if (numericRate >= 0.86) type = "number";
  else if (dateRate >= 0.86) type = "date";

  return {
    name: column,
    type,
    missing,
    missingRate: rows.length ? missing / rows.length : 0,
    unique: uniqueValues.size,
    example: sample,
    stats: type === "number" ? basicStats(numericValues) : null,
    topValues: type === "category" ? categoricalCounts(rows, column, 8) : [],
  };
}

function inferDateRate(values) {
  if (!values.length) return 0;
  const looksLikeDate = values.filter((value) => {
    const text = String(value);
    if (!/^\d{4}-\d{2}(-\d{2})?$/.test(text)) return false;
    return Number.isFinite(Date.parse(text.length === 7 ? `${text}-01` : text));
  });
  return looksLikeDate.length / values.length;
}

function buildWarnings(rowCount, profiles) {
  const warnings = [];
  if (!rowCount) warnings.push("The dataset is empty.");
  const heavyMissing = profiles.filter((profile) => profile.missingRate >= 0.2);
  if (heavyMissing.length) {
    warnings.push(
      `${heavyMissing.length} columns have at least 20% missing values, led by ${heavyMissing[0].name}.`,
    );
  }
  const mostlyUnique = profiles.filter(
    (profile) => profile.type === "category" && rowCount > 0 && profile.unique / rowCount > 0.8,
  );
  if (mostlyUnique.length) {
    warnings.push(`${mostlyUnique[0].name} behaves like an identifier rather than a grouping feature.`);
  }
  return warnings;
}

export function basicStats(values) {
  const clean = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (!clean.length) {
    return { count: 0, min: null, max: null, mean: null, median: null, q1: null, q3: null, std: null };
  }
  const mean = clean.reduce((sum, value) => sum + value, 0) / clean.length;
  const variance = clean.reduce((sum, value) => sum + (value - mean) ** 2, 0) / clean.length;
  return {
    count: clean.length,
    min: clean[0],
    max: clean[clean.length - 1],
    mean,
    median: quantile(clean, 0.5),
    q1: quantile(clean, 0.25),
    q3: quantile(clean, 0.75),
    std: Math.sqrt(variance),
  };
}

export function quantile(sortedValues, q) {
  if (!sortedValues.length) return null;
  const index = (sortedValues.length - 1) * q;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sortedValues[lower];
  const weight = index - lower;
  return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
}

export function categoricalCounts(rows, column, limit = 12) {
  const counts = new Map();
  for (const row of rows) {
    const value = toDisplayValue(row[column]);
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count, percentage: rows.length ? count / rows.length : 0 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export function histogram(rows, column, bins = 12) {
  const values = rows.map((row) => toNumber(row[column])).filter((value) => Number.isFinite(value));
  if (!values.length) return [];
  const sorted = [...values].sort((a, b) => a - b);
  const stats = basicStats(sorted);
  const min = stats.min;
  const max = stats.max;
  if (min === max) {
    return [{ x0: min, x1: max, label: formatCompact(min), count: values.length }];
  }

  // ── Case 1: small-range integers → one bar per integer value ──
  const allIntegers = sorted.every((v) => Number.isInteger(v));
  const intRange = max - min;
  if (allIntegers && intRange <= 30) {
    const counts = new Map();
    for (const v of sorted) counts.set(v, (counts.get(v) ?? 0) + 1);
    const result = [];
    for (let v = min; v <= max; v += 1) {
      result.push({ x0: v, x1: v, label: String(v), count: counts.get(v) ?? 0 });
    }
    return result;
  }

  // ── Case 2: zero-heavy data → separate "0" bar + histogram of non-zeros ──
  const zeroCount = sorted.filter((v) => v === 0).length;
  const zeroRate = values.length ? zeroCount / values.length : 0;
  if (zeroRate > 0.3) {
    const nonZero = sorted.filter((v) => v > 0);
    if (!nonZero.length) {
      // Every single value is 0
      return [{ x0: 0, x1: 0, label: "0 (all rows)", count: zeroCount }];
    }
    const nonZeroBins = buildBins(nonZero, Math.max(2, bins - 1));
    return [
      { x0: 0, x1: 0, label: "0 (none)", count: zeroCount },
      ...nonZeroBins,
    ];
  }

  // ── Case 3: continuous data ──
  return buildBins(sorted, bins);
}

/** Build histogram bins for a sorted array of positive values. */
function buildBins(sorted, bins) {
  const stats = basicStats(sorted);
  let min = stats.min;
  let max = stats.max;
  if (min === max) {
    return [{ x0: min, x1: max, label: formatCompact(min), count: sorted.length }];
  }

  // Trim extreme outliers using IQR fencing
  const q1 = stats.q1 ?? min;
  const q3 = stats.q3 ?? max;
  const iqr = q3 - q1;
  if (iqr > 0) {
    const fence = q3 + 3 * iqr;
    const trimmedMax = sorted.filter((v) => v <= fence).pop() ?? max;
    if (trimmedMax > min && trimmedMax < max) {
      max = trimmedMax;
    }
  }

  // Detect skew for log-spaced bins
  const median = stats.median ?? (min + max) / 2;
  const useLog = min >= 0 && max > 0 && median > 0 && max / median > 20;

  let edges;
  if (useLog) {
    const shift = min === 0 ? 1 : 0;
    const logMin = Math.log10(min + shift);
    const logMax = Math.log10(max + shift);
    const logStep = (logMax - logMin) / bins;
    edges = Array.from({ length: bins + 1 }, (_, i) =>
      i === bins ? max : Math.pow(10, logMin + logStep * i) - shift,
    );
    edges[0] = min;
  } else {
    const step = (max - min) / bins;
    edges = Array.from({ length: bins + 1 }, (_, i) =>
      i === bins ? max : min + step * i,
    );
  }

  const result = Array.from({ length: bins }, (_, i) => ({
    x0: edges[i],
    x1: edges[i + 1],
    label: `${formatCompact(edges[i])} – ${formatCompact(edges[i + 1])}`,
    count: 0,
  }));

  for (const value of sorted) {
    if (value > max) {
      result[bins - 1].count += 1;
      continue;
    }
    let lo = 0;
    let hi = bins - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (value < edges[mid + 1]) hi = mid;
      else lo = mid + 1;
    }
    result[lo].count += 1;
  }
  return result;
}

export function detectClusterColumn(rows, headers) {
  const candidates = ["Cluster", "cluster", "cluster_label", "Cluster_scaled"];
  for (const candidate of candidates) {
    if (headers.includes(candidate) && rows.some((row) => !isMissing(row[candidate]))) return candidate;
  }
  return null;
}

export function chooseClusterFeatures(summary) {
  const presentKnown = KNOWN_CLUSTER_FEATURES.filter((column) => summary.numericColumns.includes(column));
  if (presentKnown.length >= 3) return presentKnown;
  return summary.numericColumns.filter((column) => !/^cluster$/i.test(column)).slice(0, 10);
}

export function chooseInterpretableFeatures(summary) {
  const present = INTERPRETABLE_FEATURES.filter((column) => summary.numericColumns.includes(column));
  if (present.length >= 3) return present;
  return summary.numericColumns.filter((column) => !/^cluster$/i.test(column)).slice(0, 8);
}

export function ensureClusters(rows, headers, featureColumns) {
  const existing = detectClusterColumn(rows, headers);
  if (existing) {
    return {
      rows,
      clusterColumn: existing,
      usedExisting: true,
      method: "Existing labels from clustered_startups_real_values.csv",
      generatedK: uniqueClusterValues(rows, existing).length,
    };
  }

  if (!rows.length || !featureColumns.length) {
    return {
      rows: rows.map((row) => ({ ...row, __cluster: "0" })),
      clusterColumn: "__cluster",
      usedExisting: false,
      method: "No usable labels or features were available",
      generatedK: rows.length ? 1 : 0,
    };
  }

  const k = Math.min(4, Math.max(2, Math.round(Math.sqrt(rows.length / 2)) || 2));
  const labels = runKMeansFallback(rows, featureColumns, k);
  return {
    rows: rows.map((row, index) => ({ ...row, __cluster: labels[index] })),
    clusterColumn: "__cluster",
    usedExisting: false,
    method: `In-browser fallback K-Means with K=${k}`,
    generatedK: k,
  };
}

export function uniqueClusterValues(rows, clusterColumn) {
  return [...new Set(rows.map((row) => toDisplayValue(row[clusterColumn])))]
    .filter((value) => value !== "(missing)")
    .sort(naturalSort);
}

export function naturalSort(a, b) {
  const numberA = Number(a);
  const numberB = Number(b);
  if (Number.isFinite(numberA) && Number.isFinite(numberB)) return numberA - numberB;
  return String(a).localeCompare(String(b), undefined, { numeric: true });
}

export function computeClusterSummary(rows, clusterColumn, featureColumns, categoricalColumns) {
  const clusters = uniqueClusterValues(rows, clusterColumn);
  const globalStats = Object.fromEntries(
    featureColumns.map((feature) => [feature, basicStats(rows.map((row) => toNumber(row[feature])).filter(Number.isFinite))]),
  );

  const clusterRows = new Map(clusters.map((cluster) => [cluster, []]));
  for (const row of rows) {
    const cluster = toDisplayValue(row[clusterColumn]);
    if (clusterRows.has(cluster)) clusterRows.get(cluster).push(row);
  }

  const profiles = clusters.map((cluster) => {
    const subset = clusterRows.get(cluster) ?? [];
    const features = {};
    for (const feature of featureColumns) {
      const values = subset.map((row) => toNumber(row[feature])).filter(Number.isFinite);
      features[feature] = basicStats(values);
    }
    const distinguishing = featureColumns
      .map((feature) => {
        const global = globalStats[feature];
        const local = features[feature];
        const score = global?.std ? ((local.mean ?? 0) - (global.mean ?? 0)) / global.std : 0;
        return {
          feature,
          score,
          direction: score >= 0 ? "higher" : "lower",
          localMean: local.mean,
          globalMean: global?.mean,
        };
      })
      .sort((a, b) => Math.abs(b.score) - Math.abs(a.score))
      .slice(0, 4);

    const topCategories = {};
    for (const column of categoricalColumns.filter((column) => ["status", "market", "country_code"].includes(column))) {
      topCategories[column] = categoricalCounts(subset, column, 4);
    }

    return {
      cluster,
      name: CLUSTER_NAME_HINTS[cluster] ?? `Cluster ${cluster}`,
      count: subset.length,
      percentage: rows.length ? subset.length / rows.length : 0,
      features,
      distinguishing,
      topCategories,
    };
  });

  return {
    clusterColumn,
    clusters: profiles,
    globalStats,
    featureColumns,
    largest: [...profiles].sort((a, b) => b.count - a.count)[0] ?? null,
    smallest: [...profiles].sort((a, b) => a.count - b.count)[0] ?? null,
  };
}

export function computeFeatureSeparation(clusterSummary) {
  return clusterSummary.featureColumns
    .map((feature) => {
      const values = clusterSummary.clusters
        .map((cluster) => ({
          cluster: cluster.cluster,
          value: cluster.features[feature]?.mean,
        }))
        .filter((item) => Number.isFinite(item.value));
      if (values.length < 2) return null;
      const sorted = [...values].sort((a, b) => a.value - b.value);
      const low = sorted[0];
      const high = sorted[sorted.length - 1];
      const global = clusterSummary.globalStats[feature];
      const score = global?.std ? (high.value - low.value) / global.std : high.value - low.value;
      return { feature, low, high, score };
    })
    .filter(Boolean)
    .sort((a, b) => Math.abs(b.score) - Math.abs(a.score));
}

export function computeCorrelationMatrix(rows, columns, limit = 8) {
  const selected = columns.slice(0, limit);
  const valuesByColumn = Object.fromEntries(
    selected.map((column) => [column, rows.map((row) => toNumber(row[column]))]),
  );
  const cells = [];
  let strongest = null;

  for (let i = 0; i < selected.length; i += 1) {
    for (let j = 0; j < selected.length; j += 1) {
      const x = selected[i];
      const y = selected[j];
      const value = pearson(valuesByColumn[x], valuesByColumn[y]);
      cells.push({ x, y, value });
      if (i < j && Number.isFinite(value)) {
        const candidate = { x, y, value, magnitude: Math.abs(value) };
        if (!strongest || candidate.magnitude > strongest.magnitude) strongest = candidate;
      }
    }
  }

  return { columns: selected, cells, strongest };
}

function pearson(aValues, bValues) {
  const pairs = [];
  for (let i = 0; i < aValues.length; i += 1) {
    const a = aValues[i];
    const b = bValues[i];
    if (Number.isFinite(a) && Number.isFinite(b)) pairs.push([a, b]);
  }
  if (pairs.length < 3) return null;
  const meanA = pairs.reduce((sum, pair) => sum + pair[0], 0) / pairs.length;
  const meanB = pairs.reduce((sum, pair) => sum + pair[1], 0) / pairs.length;
  let numerator = 0;
  let denomA = 0;
  let denomB = 0;
  for (const [a, b] of pairs) {
    numerator += (a - meanA) * (b - meanB);
    denomA += (a - meanA) ** 2;
    denomB += (b - meanB) ** 2;
  }
  const denom = Math.sqrt(denomA * denomB);
  return denom ? numerator / denom : null;
}

export function computePcaProjection(rows, clusterColumn, featureColumns, maxPoints = 2200) {
  if (rows.length < 3 || featureColumns.length < 2) {
    return { points: [], explained: [0, 0], features: featureColumns, fallback: true };
  }

  const stats = featureColumns.map((feature) => {
    const values = rows.map((row) => toNumber(row[feature])).filter(Number.isFinite).sort((a, b) => a - b);
    const median = quantile(values, 0.5) ?? 0;
    const q1 = quantile(values, 0.25) ?? median;
    const q3 = quantile(values, 0.75) ?? median;
    const iqr = q3 - q1 || basicStats(values).std || 1;
    return { feature, median, iqr };
  });

  const vectors = rows.map((row) =>
    stats.map(({ feature, median, iqr }) => {
      const value = toNumber(row[feature]);
      const scaled = ((Number.isFinite(value) ? value : median) - median) / iqr;
      return Math.max(-8, Math.min(8, scaled));
    }),
  );

  const covariance = covarianceMatrix(vectors);
  const totalVariance = covariance.reduce((sum, row, index) => sum + row[index], 0) || 1;
  const pc1 = powerIteration(covariance);
  const lambda1 = eigenvalue(covariance, pc1);
  const deflated = deflate(covariance, pc1, lambda1);
  const pc2 = powerIteration(deflated);
  const lambda2 = eigenvalue(covariance, pc2);

  const sampleIndexes = stratifiedSampleIndexes(rows, clusterColumn, maxPoints);
  const points = sampleIndexes.map((index) => {
    const vector = vectors[index];
    const row = rows[index];
    return {
      x: dot(vector, pc1),
      y: dot(vector, pc2),
      cluster: toDisplayValue(row[clusterColumn]),
      name: row.name ?? row.Name ?? `Row ${index + 1}`,
      market: row.market ?? row["market"] ?? "",
      status: row.status ?? "",
      country: row.country_code ?? "",
      rowIndex: index,
    };
  });

  return {
    points,
    explained: [lambda1 / totalVariance, lambda2 / totalVariance],
    features: featureColumns,
    fallback: false,
  };
}

function covarianceMatrix(vectors) {
  const count = vectors.length;
  const width = vectors[0]?.length ?? 0;
  const matrix = Array.from({ length: width }, () => Array(width).fill(0));
  for (const vector of vectors) {
    for (let i = 0; i < width; i += 1) {
      for (let j = i; j < width; j += 1) {
        matrix[i][j] += vector[i] * vector[j];
      }
    }
  }
  const denom = Math.max(1, count - 1);
  for (let i = 0; i < width; i += 1) {
    for (let j = i; j < width; j += 1) {
      matrix[i][j] /= denom;
      matrix[j][i] = matrix[i][j];
    }
  }
  return matrix;
}

function powerIteration(matrix, iterations = 70) {
  const size = matrix.length;
  let vector = Array.from({ length: size }, (_, index) => (index + 1) / size);
  for (let step = 0; step < iterations; step += 1) {
    const next = matrix.map((row) => dot(row, vector));
    const magnitude = Math.sqrt(next.reduce((sum, value) => sum + value * value, 0)) || 1;
    vector = next.map((value) => value / magnitude);
  }
  return vector;
}

function eigenvalue(matrix, vector) {
  return dot(vector, matrix.map((row) => dot(row, vector)));
}

function deflate(matrix, vector, value) {
  return matrix.map((row, i) => row.map((cell, j) => cell - value * vector[i] * vector[j]));
}

function dot(a, b) {
  return a.reduce((sum, value, index) => sum + value * b[index], 0);
}

function stratifiedSampleIndexes(rows, clusterColumn, maxPoints) {
  if (rows.length <= maxPoints) return rows.map((_, index) => index);
  const clusters = uniqueClusterValues(rows, clusterColumn);
  const byCluster = new Map(clusters.map((cluster) => [cluster, []]));
  rows.forEach((row, index) => {
    const cluster = toDisplayValue(row[clusterColumn]);
    if (byCluster.has(cluster)) byCluster.get(cluster).push(index);
  });

  const result = [];
  for (const cluster of clusters) {
    const indexes = byCluster.get(cluster);
    const target = Math.max(60, Math.round((indexes.length / rows.length) * maxPoints));
    const step = Math.max(1, Math.floor(indexes.length / target));
    for (let i = 0; i < indexes.length && result.length < maxPoints; i += step) {
      result.push(indexes[i]);
    }
  }
  return result.slice(0, maxPoints);
}

function runKMeansFallback(rows, featureColumns, k) {
  const usableFeatures = featureColumns.slice(0, 10);
  const stats = usableFeatures.map((feature) => {
    const values = rows.map((row) => toNumber(row[feature])).filter(Number.isFinite).sort((a, b) => a - b);
    const median = quantile(values, 0.5) ?? 0;
    const iqr = (quantile(values, 0.75) ?? median) - (quantile(values, 0.25) ?? median) || 1;
    return { feature, median, iqr };
  });
  const vectors = rows.map((row) =>
    stats.map(({ feature, median, iqr }) => {
      const value = toNumber(row[feature]);
      return ((Number.isFinite(value) ? value : median) - median) / iqr;
    }),
  );
  const centroids = Array.from({ length: k }, (_, clusterIndex) => {
    const index = Math.floor((clusterIndex / Math.max(1, k - 1)) * (vectors.length - 1));
    return [...vectors[index]];
  });
  let labels = Array(rows.length).fill(0);

  for (let iteration = 0; iteration < 45; iteration += 1) {
    let changed = false;
    labels = vectors.map((vector, index) => {
      let best = 0;
      let bestDistance = Infinity;
      for (let cluster = 0; cluster < k; cluster += 1) {
        const distance = squaredDistance(vector, centroids[cluster]);
        if (distance < bestDistance) {
          best = cluster;
          bestDistance = distance;
        }
      }
      if (labels[index] !== best) changed = true;
      return best;
    });
    const sums = Array.from({ length: k }, () => Array(usableFeatures.length).fill(0));
    const counts = Array(k).fill(0);
    vectors.forEach((vector, index) => {
      const label = labels[index];
      counts[label] += 1;
      vector.forEach((value, featureIndex) => {
        sums[label][featureIndex] += value;
      });
    });
    for (let cluster = 0; cluster < k; cluster += 1) {
      if (!counts[cluster]) continue;
      centroids[cluster] = sums[cluster].map((sum) => sum / counts[cluster]);
    }
    if (!changed) break;
  }

  return labels.map(String);
}

function squaredDistance(a, b) {
  return a.reduce((sum, value, index) => sum + (value - b[index]) ** 2, 0);
}

export function getOutliers(rows, column = "funding_total_usd", limit = 8) {
  return rows
    .map((row) => ({ row, value: toNumber(row[column]) }))
    .filter((item) => Number.isFinite(item.value))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

export function formatNumber(value, digits = 0) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "n/a";
  const requested = Number(digits);
  const safeMax = Math.max(0, Math.min(20, Number.isFinite(requested) ? Math.floor(requested) : 0));
  const safeMin = Math.max(0, Math.min(safeMax, Number.isFinite(requested) ? Math.floor(requested) : 0));
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: safeMax,
    minimumFractionDigits: safeMin,
  }).format(num);
}

export function formatPercent(value, digits = 1) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "n/a";
  return `${formatNumber(num * 100, digits)}%`;
}

export function formatMoney(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "n/a";
  const abs = Math.abs(num);
  if (abs >= 1_000_000_000) return `$${formatNumber(num / 1_000_000_000, 2)}B`;
  if (abs >= 1_000_000) return `$${formatNumber(num / 1_000_000, 2)}M`;
  if (abs >= 1_000) return `$${formatNumber(num / 1_000, 1)}K`;
  return `$${formatNumber(num, 0)}`;
}

export function formatCompact(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "n/a";
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(num);
}

export function prettifyColumn(column) {
  if (COLUMN_LABELS[column]) return COLUMN_LABELS[column];
  return String(column)
    .replace(/^log_/, "log ")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .replace(/\bUsd\b/g, "USD");
}
