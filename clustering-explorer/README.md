# Startup Clustering Explorer

This is a standalone interactive app for explaining the dataset, clustering
results, visualisations, and notable insights in this project.

It is intentionally isolated in `clustering-explorer/`. It does not edit,
rename, move, delete, or overwrite any existing project file.

## What The App Does

- Loads `clustered_startups_real_values.csv` as the primary clustered dataset.
- Optionally loads `cluster0_subclustered_explained.csv` for the Cluster 0
  zoom-in analysis.
- Uses the existing `Cluster` labels directly when they are present.
- Frames the source as a real Crunchbase startup dataset from Kaggle, with the
  app presenting exported notebook output rather than rerunning the notebook.
- Highlights the zero-heavy funding-source columns as a major data issue.
- Adds a Zero Problem panel that compares zero rates by funding source and
  explains the modeling response.
- Explains the dataset shape, columns, inferred types, missing values, basic
  numeric distributions, category counts, and correlations.
- Explains the clustering workflow inferred from the notebooks:
  selected funding fields, engineered log and ratio features, RobustScaler,
  K-Means with `K=4`, and a two-component PCA view for presentation.
- Explains the Cluster 0 subclustering as a complementary K=3 analysis, not as
  a replacement for the main four-cluster model.
- Builds interactive cluster visuals:
  cluster sizes, feature comparisons, profile cards, a two-component PCA
  projection, a cluster feature heatmap, largest-funding observations, and a
  searchable row explorer.
- Generates plain-English "Curiosities & Insights" from the loaded data.

## Read-Only Inputs

The app reads these existing files at runtime:

- `../clustered_startups_real_values.csv`
- `../cluster0_subclustered_explained.csv`

The implementation was informed by these existing read-only project files:

- `../teste.ipynb`

## How To Run

From the repository root:

```powershell
python -m http.server 8787 --bind 127.0.0.1
```

Then open:

```text
http://127.0.0.1:8787/clustering-explorer/
```

If `python` is not available on PATH in this Codex workspace, the bundled
runtime can be used:

```powershell
& "C:\Users\pedro\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe" -m http.server 8787 --bind 127.0.0.1
```

Opening `index.html` directly as a file may prevent the browser from fetching
CSV files. The page includes a manual CSV upload fallback for that case.

## Assumptions

- `clustered_startups_real_values.csv` is the authoritative clustered output.
- The original data source was a real Crunchbase dataset from Kaggle.
- The existing `Cluster` column should be used directly and not recomputed.
- The clustering method is inferred from `teste.ipynb` as K-Means with four
  clusters and engineered funding features.
- The PCA projection is for explanation and visualisation only. If exported
  `PC1` and `PC2` columns exist, the app uses them; otherwise it computes a
  read-only two-component browser projection from the engineered features. It
  does not replace the original notebook model.
- If a future CSV has no cluster labels, the app can create temporary fallback
  K-Means labels in browser memory only. It does not write those labels back to
  disk.

## Files Created

- `clustering-explorer/index.html`
- `clustering-explorer/README.md`
- `clustering-explorer/src/styles.css`
- `clustering-explorer/src/data-loader.js`
- `clustering-explorer/src/analysis.js`
- `clustering-explorer/src/charts.js`
- `clustering-explorer/src/insights.js`
- `clustering-explorer/src/app.js`

## Preservation Confirmation

No existing project files are modified by this app. The app only reads existing
CSV and notebook/script files and adds new files inside `clustering-explorer/`.

Optional manual integration later could link to
`clustering-explorer/index.html` from another app or README, but that would
require editing existing files and was intentionally not done here.
