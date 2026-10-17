# Startup Clustering Explorer

An interactive web companion for exploring the dataset, clustering results, and startup profiles generated in this project.

The application runs entirely in the browser (client-side) using vanilla HTML, CSS, and JavaScript. It does not modify, retrain, or overwrite any project models or datasets.

---

## What the Explorer Does

- **Visualizes Exported Clustered Data:** Loads [`clustered_startups_real_values.csv`](../clustered_startups_real_values.csv) to display the four primary startup clusters ($K=4$) identified in the academic analysis.
- **Cluster 0 Subclustering View:** Loads [`cluster0_subclustered_explained.csv`](../cluster0_subclustered_explained.csv) to explore the three sub-profiles identified within early-stage startups ($K=3$).
- **Sparsity & Zero-Inflation Panel:** Explains the "Zero Problem" in venture data, comparing zero-rates across funding categories and clarifying the feature engineering choices made in the notebooks.
- **Interactive 2D PCA Scatter Plot:** Allows visual inspection of cluster distributions across the first two principal components.
- **Cluster Profiles & Heatmaps:** Displays median financial profiles, funding ratios, and feature lift across segments.
- **Searchable Startup Table:** Enables searching, sorting, and filtering individual startups by name, market sector, country, and cluster.

### What the Explorer Does Not Do

- It **does not retrain** machine learning models or recalculate cluster assignments.
- It **does not run Python** or require a backend server beyond standard static file hosting.
- It **does not overwrite** or edit CSV files on disk.

---

## How to Run Locally

Because modern web browsers block asynchronous local file requests (`fetch` over `file:///`) due to CORS security policies, the application must be served over a local HTTP connection.

From the **repository root directory**, run:

```powershell
python -m http.server 8000
```

Then open your browser and navigate to:

```text
http://localhost:8000/clustering-explorer/
```

*(Note: If opened directly by double-clicking `index.html`, the browser may block automatic loading of the CSV files. The page includes a manual file picker fallback allowing you to select the CSV files manually from disk).*

---

## Data Inputs

The application reads the following exported project files at runtime:

- `../clustered_startups_real_values.csv` (Primary four-cluster dataset)
- `../cluster0_subclustered_explained.csv` (Cluster 0 subclustering dataset)

---

## Directory Structure

```text
clustering-explorer/
├── index.html            # Application entry point and layout
├── README.md             # Explorer documentation
├── pca_clusters.png      # Reference 2D PCA figure
├── src/                  # Application source modules
│   ├── app.js            # Main controller and tab orchestration
│   ├── data-loader.js    # CSV parsing and schema validation
│   ├── analysis.js       # In-memory aggregations and statistics
│   ├── charts.js         # Chart.js rendering wrappers
│   ├── insights.js       # Curiosities and data summary generator
│   └── styles.css        # Dashboard styling and layout
└── vendor/               # Bundled third-party libraries (no CDN required)
    ├── chart.umd.min.js  # Chart.js (v4.4.1)
    └── papaparse.min.js  # PapaParse (v5.4.1)
```
