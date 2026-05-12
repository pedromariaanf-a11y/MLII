export const DEFAULT_DATASETS = [
  {
    id: "clustered",
    label: "Clustered startup profile",
    path: "../clustered_startups_real_values.csv",
    required: true,
  },
  {
    id: "raw",
    label: "Raw VC investments dataset",
    path: "../investments_VC.csv",
    required: false,
  },
  {
    id: "cluster0",
    label: "Cluster 0 subcluster profile",
    path: "../cluster0_subclustered_explained.csv",
    required: false,
  },
];

export async function loadDatasets(configs = DEFAULT_DATASETS) {
  const results = await Promise.all(
    configs.map(async (config) => {
      try {
        return {
          config,
          dataset: await loadCsvDataset(config),
          error: null,
        };
      } catch (error) {
        return { config, dataset: null, error };
      }
    }),
  );

  const requiredFailures = results.filter((item) => item.config.required && item.error);
  if (requiredFailures.length) {
    const message = requiredFailures
      .map((item) => `${item.config.label}: ${item.error.message}`)
      .join("; ");
    const error = new Error(message);
    error.results = results;
    throw error;
  }

  const datasets = {};
  const errors = [];
  for (const item of results) {
    if (item.dataset) datasets[item.config.id] = item.dataset;
    if (item.error) errors.push({ id: item.config.id, error: item.error, config: item.config });
  }
  return { datasets, errors };
}

export async function loadCsvDataset(config) {
  const response = await fetch(config.path, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} while reading ${config.path}`);
  }
  const text = await response.text();
  const parsed = parseCsv(text);
  return {
    id: config.id,
    label: config.label,
    path: config.path,
    headers: parsed.headers,
    rows: parsed.rows,
  };
}

export function parseCsv(text) {
  if (!text || !text.trim()) {
    return { headers: [], rows: [] };
  }

  const records = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(cleanCell(field));
      field = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(cleanCell(field));
      if (row.some((value) => value !== null && value !== "")) records.push(row);
      row = [];
      field = "";
      continue;
    }

    field += char;
  }

  row.push(cleanCell(field));
  if (row.some((value) => value !== null && value !== "")) records.push(row);

  if (!records.length) return { headers: [], rows: [] };

  const headers = uniqueHeaders(records[0].map((header) => String(header ?? "").trim()));
  const rows = records.slice(1).map((record) => {
    const item = {};
    headers.forEach((header, index) => {
      item[header] = record[index] ?? null;
    });
    return item;
  });

  return { headers, rows };
}

export function cleanCell(value) {
  const trimmed = String(value ?? "").replace(/^\uFEFF/, "").trim();
  return trimmed === "" ? null : trimmed;
}

function uniqueHeaders(headers) {
  const seen = new Map();
  return headers.map((header, index) => {
    const base = header || `Column ${index + 1}`;
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return count === 0 ? base : `${base}_${count + 1}`;
  });
}

export function isMissing(value) {
  return value === null || value === undefined || String(value).trim() === "";
}

export function toNumber(value) {
  if (isMissing(value)) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const cleaned = String(value)
    .trim()
    .replace(/[$%]/g, "")
    .replace(/,/g, "");
  if (!cleaned || cleaned.toLowerCase() === "nan") return null;
  const number = Number(cleaned);
  return Number.isFinite(number) ? number : null;
}

export function toDisplayValue(value) {
  if (isMissing(value)) return "(missing)";
  return String(value);
}
