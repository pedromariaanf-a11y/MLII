# Startup Funding Analysis Using Machine Learning

*Machine Learning II — University Group Project, NOVA IMS*

---

## Overview

This repository contains an academic unsupervised learning project developed for the Machine Learning II course at NOVA IMS. The goal was to analyze historical startup investment records and explore whether clustering algorithms could identify meaningful financing profiles without relying on predefined labels.

Startups raise capital across various vehicles—such as seed grants, venture capital rounds, debt facilities, and private equity. Using K-Means clustering and Principal Component Analysis (PCA) on historical Crunchbase data, we identified empirical funding patterns across thousands of companies. Rather than treating clusters as fixed startup categories, we evaluate them as data-driven profiles reflecting how capital sources were historically combined.

The analysis is organized across three main Jupyter notebooks: data cleaning and feature engineering ([`teste.ipynb`](teste.ipynb)), primary four-cluster profiling ([`analise_clustering.ipynb`](analise_clustering.ipynb)), and a dedicated subclustering analysis of early-stage startups ([`cluster0_subclustering_analysis.ipynb`](cluster0_subclustering_analysis.ipynb)). A companion interactive web application is included in [`clustering-explorer/`](clustering-explorer/).

---

## Objectives

- Clean and preprocess a high-dimensional, historical venture investment dataset with heavy zero-inflation.
- Engineer domain-specific features capturing both overall funding scale and relative capital composition.
- Apply Principal Component Analysis (PCA) to reduce collinearity while retaining the primary continuous variance.
- Evaluate K-Means clustering to identify empirical financing profiles.
- Profile identified groups using median financial metrics, round counts, industry representation, and observed company status.
- Conduct a subclustering analysis on the large early-stage segment (Cluster 0) to untangle its internal variation.

---

## Dataset and Preprocessing

The analysis uses a historical Crunchbase venture investments dataset ([`investments_VC.csv`](investments_VC.csv)) sourced from Kaggle. It contains company-level records covering market sectors, operating statuses, locations, round counts, and funding amounts across multiple financing stages.

### Filtering Pipeline

The raw dataset contains **54,294 records** and **39 columns**. The final clustering dataset contains **36,931 startups** and **11 engineered numerical features**:

1. **Empty Record Removal:** 4,856 rows where all fields were missing were removed via `dropna(how='all')`, leaving 49,438 records.
2. **Missing Name Drop:** 1 row missing the startup name was removed, leaving 49,437 records.
3. **Irrelevant Column Pruning:** Non-informative identifier and administrative attributes (`permalink`, `homepage_url`, `state_code`, `region`, `founded_month`, `founded_quarter`, `founded_year`) were dropped.
4. **Targeted Missing Value Removal:** Startups missing `funding_total_usd` or `market` were removed (11,039 records), as both are central for financial and sector profiling, leaving 38,398 records.
5. **Zero-Funding Removal:** 1,467 companies reporting $0 across all evaluated funding categories were removed, yielding the final sample of **36,931 startups**.

> **Dataset Note:** This dataset is a historical snapshot reflecting investments up to approximately 2014. It is not a live database, and market valuations and round sizes have grown considerably since this period.

---

## Methodology

### Handling Zeros and Sparsity

Most startups in the dataset raised capital through only one or two specific mechanisms. Several specialized financing columns contained over 98% to 99% zeros (`equity_crowdfunding`, `undisclosed`, `convertible_note`, `post_ipo_equity`, `post_ipo_debt`, `secondary_market`, `product_crowdfunding`). These seven sparse columns were removed.

Similarly, individual round columns (`round_A` through `round_H`) were over 95% zeros. Instead of keeping sparse individual columns, we engineered a single ordinal feature:

- **`stage_level` (0 to 8):** Encodes the furthest funding round attained (0 = none, 1 = Round A, up to 8 = Round H), summarizing round progression before dropping the individual round indicators.

### Feature Engineering

To capture both the overall volume of capital and its relative composition, 11 numerical features were prepared:

1. **Early-Stage Aggregation:** `seed`, `angel`, and `grant` funding were combined into `early_stage_funding` to consolidate early check sizes.
2. **Funding Composition Ratios:** Four proportions relative to total funding were computed and clipped to $[0, 1]$: `early_stage_funding_ratio`, `venture_ratio`, `debt_financing_ratio`, and `private_equity_ratio`.
3. **Log Transformations:** To handle extreme right-skewness and heavy tails, $\log(1 + x)$ was applied to all monetary amounts and round counts (`log_funding_total_usd`, `log_funding_rounds`, `log_early_stage_funding`, `log_venture`, `log_debt_financing`, `log_private_equity`).
4. **Round Trajectory:** `stage_level`.

### Feature Scaling

Because startup funding spans several orders of magnitude, standard z-score normalization would be heavily skewed by extreme outliers. We used **`RobustScaler`**, which centers features by the median and scales according to the Interquartile Range (IQR).

### PCA and K-Means Clustering

- **PCA for Clustering:** A 3-component PCA was fitted on the 11 scaled features (`df_scaled`), explaining **95.78%** of the cumulative variance. This reduced multicollinearity while serving as the direct input space for K-Means ($K=4$, `k-means++`, `random_state=42`).
- **Robustness Check:** Clustering on the 3 principal components was compared against clustering directly on the 11 scaled features. Clusters 1 and 2 were identical across both approaches, while Clusters 0 and 3 shifted by only 474 observations (~1.3%), confirming stable cluster boundaries. The PCA-based model was exported to [`clustered_startups_real_values.csv`](clustered_startups_real_values.csv).
- **PCA for Visualisation:** A separate 2-component PCA projection was fitted strictly for 2D visual representation, accounting for **89.31%** of variance (PC1: 60.48%, PC2: 28.83%).

---

## Results

The K-Means model groups the 36,931 startups into four distinct financing profiles:

| Cluster | Profile Description | Startups | Share | Median Total Funding | Median Rounds | Dominant Capital Source | Operating / Acquired / Closed |
|:---:|---|---:|---:|---:|---:|---|:---:|
| **0** | Early-stage / Seed / Mixed Low Funding | 24,102 | 65.26% | $1,000,000 | 1 | Seed, angel, grants, and small venture checks | 87.8% / 5.7% / 6.5% |
| **1** | Debt-Financed Startups | 3,819 | 10.34% | $5,550,000 | 3 | Credit & debt facilities combined with venture | 86.1% / 9.3% / 4.6% |
| **2** | Private Equity / Capital Intensive | 1,305 | 3.53% | $36,850,000 | 2 | Large buyout & private equity growth capital | 90.2% / 8.1% / 1.7% |
| **3** | Venture-Backed Growth | 7,705 | 20.86% | $14,906,222 | 2 | Institutional venture capital (Series A/B+) | 78.0% / 17.3% / 4.6% |

### Profile Summaries

- **Cluster 0 (Early-Stage / Low Funding):** Represents the majority of companies in the dataset. Total capital is modest (median $1.00M), typically raised in a single round. Because this cluster groups together small grants, angel investments, seed rounds, and early venture checks, it exhibits considerable internal diversity (explored in the subclustering analysis).
- **Cluster 1 (Debt-Financed Startups):** Companies combining debt facilities (median $1.32M) with venture equity (median $1.45M) across multiple rounds (median 3). In this dataset, debt is typically co-utilized alongside equity rounds rather than acting as a standalone seed mechanism.
- **Cluster 2 (Private Equity / Capital Intensive):** Mature companies with the highest median funding ($36.85M, with median private equity funding of $18.40M) and the lowest observed closure rate (1.67%).
- **Cluster 3 (Venture-Backed Growth):** Follows an institutional venture capital profile (median venture funding $14.00M, median stage level 2). These companies exhibit the highest observed historical acquisition rate in the dataset (**17.35%**, compared to 5.71% in Cluster 0 and 8.09% in Cluster 2).

---

## Subclustering Analysis: Cluster 0

Cluster 0 accounts for **65.26%** (24,102 companies) of the analyzed startups. Because it encompasses funding amounts ranging from small $15k grants to multi-million dollar early venture checks, treating it as a single homogeneous segment conceals early-stage dynamics.

In [`cluster0_subclustering_analysis.ipynb`](cluster0_subclustering_analysis.ipynb), a secondary K-Means clustering ($K=3$) was fitted on the scaled features of Cluster 0. Internal metrics across $K=2$ to $K=9$ supported $K=3$ (average silhouette score of 0.505 and inertia of 15,318), revealing three clear sub-profiles:

| Subcluster | Subcluster Profile | Startups | Cluster 0 Share | Median Funding | Median Rounds | Dominant Funding Mix | Over-Represented Markets (Lift) |
|:---:|---|---:|---:|---:|---:|---|---|
| **0** | Early-stage multi-round | 4,114 | 17.07% | $900,000 | 2.0 | 83.5% Early-stage, 12.9% Venture share | Big Data (2.03x), Analytics (1.19x) |
| **1** | Small / early venture-backed | 10,902 | 45.23% | $2,840,500 | 1.0 | 98.7% Venture share (100% venture participation) | Biotechnology (1.81x), Clean Technology (1.63x) |
| **2** | Small seed-stage | 9,086 | 37.70% | $250,000 | 1.0 | 99.8% Early-stage share (seed, angel, grants) | Apps (1.79x), Android (1.33x) |

### Key Takeaways from Subclustering

1. **Early Venture Checks:** Nearly half of Cluster 0 (45.23%) consists of companies funded through venture checks, but at smaller amounts than the institutional rounds of Cluster 3. These startups heavily over-index in research- and equipment-intensive fields like Biotechnology and Clean Technology.
2. **Capital Needs Across Sectors:** Software, mobile, and Android startups concentrate in the small seed-stage group ($250k median), reflecting lower initial capital requirements.
3. **Multi-Round Fundraising:** The multi-round group (17.07%, median $900k across 2 rounds) captures startups that raised initial seed capital and subsequently secured follow-on checks.

Subclustering results were exported to [`cluster0_subclustered_explained.csv`](cluster0_subclustered_explained.csv) and [`cluster0_subcluster_profiles.xlsx`](cluster0_subcluster_profiles.xlsx).

---

## Visualisations

The figures below illustrate cluster separation and financial differences, exported directly from the analysis notebooks:

### Cluster Separation in 2D Space
![PCA 2D Cluster Visualization](docs/figures/cluster_pca_2d.png)
*Figure 1: 2D PCA projection of the four primary clusters (from [`teste.ipynb`](teste.ipynb)). Debt-financed startups (Cluster 1, green) and private equity firms (Cluster 2, red) separate along distinct axes from the central equity and seed groups (Clusters 0 and 3).*

### Financial Scale Across Clusters
![Median Total Funding by Cluster](docs/figures/cluster_median_funding.png)
*Figure 2: Median total funding across the four clusters on a logarithmic scale (from [`analise_clustering.ipynb`](analise_clustering.ipynb)), showing scale differences between early-stage accounts ($1.0M) and private equity buyouts ($36.85M).*

### Subcluster Structure Within Cluster 0
![Cluster 0 Subclusters PCA](docs/figures/cluster0_subclusters_pca.png)
*Figure 3: 2D PCA projection of Cluster 0 into three subclusters (from [`cluster0_subclustering_analysis.ipynb`](cluster0_subclustering_analysis.ipynb)), separating small venture-backed startups from seed-stage and multi-round early-stage companies.*

### Funding Composition of Subclusters
![Average Funding Composition by Subcluster](docs/figures/cluster0_funding_composition.png)
*Figure 4: Average funding source breakdown across the three subclusters in Cluster 0 (from [`cluster0_subclustering_analysis.ipynb`](cluster0_subclustering_analysis.ipynb)), highlighting the distinction between pure seed funding and early venture allocations.*

---

## Key Observations and Interpretations

- **Observed Capital Combinations:** In this dataset, debt financing (Cluster 1) rarely appears in isolation; it is overwhelmingly co-utilized with venture equity across multiple rounds. While this indicates that established equity backing frequently accompanies debt in historical venture data, it does not mean debt is impossible to obtain independently.
- **Historical Exit Outcomes:** Startups in Cluster 3 (Venture-Backed Growth) show an observed historical acquisition rate of 17.35%, compared to 5.71% in Cluster 0. While this highlights a historical correlation between institutional venture backing and acquisition exits, it does not establish a causal mechanism or predict future acquisition probability.
- **Sector Capital Intensity:** Industry profiles align strongly with funding vehicles. Capital-heavy sectors (Biotechnology, Clean Technology) are over-represented in venture-backed groups, whereas software and mobile products are concentrated in lightweight seed rounds.
- **Granularity in Skewed Data:** A four-cluster macro model provides a clean high-level view, but the 65% concentration in Cluster 0 demonstrated that dominant macro groups require targeted sub-segmentation to extract actionable detail.

---

## Interactive Explorer

The repository includes a companion web dashboard located in [`clustering-explorer/`](clustering-explorer/):

- **Architecture:** Client-side single-page application built with vanilla HTML5, CSS3, and ES6 JavaScript. Uses custom SVG charting and in-browser CSV parsing with zero external dependencies (no frameworks, CDNs, or npm packages).
- **Purpose:** Serves as a lightweight exploratory tool to inspect the precomputed CSV deliverables ([`clustered_startups_real_values.csv`](clustered_startups_real_values.csv) and [`cluster0_subclustered_explained.csv`](cluster0_subclustered_explained.csv)). It does not execute Python code or retrain models.
- **Features:**
  - Sparsity overview detailing zero rates across funding categories.
  - Interactive 2D PCA scatter plot colored by cluster.
  - Cluster profile cards and summary distributions.
  - Searchable and filterable data table of individual startup records.
  - Dedicated subclustering tab for exploring Cluster 0.
- **Local Setup:** Because web browsers restrict local `fetch` calls over `file:///`, launch a local HTTP server from the repository root:
  ```powershell
  python -m http.server 8000
  ```
  Then open `http://localhost:8000/clustering-explorer/` in your browser. (The explorer also includes a file picker fallback if opened directly).

For further details, refer to [`clustering-explorer/README.md`](clustering-explorer/README.md).

---

## Technologies Used

- **Python 3.10+** (tested environment)
- **Data processing & analysis:** `pandas`, `numpy`, `scipy`
- **Machine Learning:** `scikit-learn` (`RobustScaler`, `KMeans`, `PCA`, `silhouette_score`)
- **Static visualisations:** `matplotlib`, `seaborn`, `plotly`
- **Workbook exports:** `openpyxl`
- **Notebook environment:** `jupyter`
- **Companion Web Explorer:** HTML5, CSS3, JavaScript (ES6 Modules) with native SVG rendering and zero external runtime libraries

---

## Repository Structure

```text
MLII/
├── README.md                              # Main project documentation
├── analise_clustering.ipynb               # Four-cluster statistical profiling & visual analysis
├── cluster0_subclustering_analysis.ipynb  # Cluster 0 deep-dive & subclustering (K=3)
├── teste.ipynb                            # Main pipeline: cleaning, feature engineering, PCA, K-Means
│
├── investments_VC.csv                     # Raw Crunchbase dataset (54,294 rows)
├── clustered_startups_real_values.csv     # Exported clustered dataset (36,931 startups, K=4)
├── cluster0_subclustered_explained.csv    # Exported Cluster 0 dataset with subclusters (K=3)
├── cluster0_subcluster_profiles.xlsx      # Summary Excel profile of Cluster 0 subclusters
│
├── add_pca_columns.py                     # Helper script to compute 2D PCA columns for CSV
├── teste_code.py                          # Procedural script export of teste.ipynb
├── teste_code2.py                         # Partial procedural script export of teste.ipynb
│
├── docs/
│   └── figures/                           # Visual figures exported from notebooks for documentation
│       ├── cluster_pca_2d.png
│       ├── cluster_median_funding.png
│       ├── cluster0_subclusters_pca.png
│       ├── cluster0_funding_composition.png
│       └── cluster0_elbow_silhouette.png
│
└── clustering-explorer/                   # Companion client-side interactive web application
    ├── index.html                         # Application markup
    ├── README.md                          # Explorer documentation and local setup
    ├── pca_clusters.png                   # Reference 2D PCA plot
    ├── src/                               # JavaScript application modules & CSS
    └── vendor/                            # Vendor directory
```

---

## Running the Project

### Exploring the Notebooks

1. Clone or download the repository.
2. Set up a Python virtual environment (Python 3.10 or later recommended):
   ```bash
   python -m venv .venv
   # Windows (PowerShell):
   .venv\Scripts\Activate.ps1
   # macOS / Linux:
   source .venv/bin/activate
   ```
3. Install the standard data science libraries:
   ```bash
   pip install pandas numpy scikit-learn matplotlib seaborn scipy plotly openpyxl jupyter
   ```
4. Launch Jupyter:
   ```bash
   jupyter lab
   # or: jupyter notebook
   ```
5. Run the notebooks in sequence:
   - [`teste.ipynb`](teste.ipynb): Data cleaning, feature engineering, PCA, and primary K-Means clustering.
   - [`analise_clustering.ipynb`](analise_clustering.ipynb): Post-clustering cluster profiling.
   - [`cluster0_subclustering_analysis.ipynb`](cluster0_subclustering_analysis.ipynb): Subclustering analysis of Cluster 0.

> **Precomputed Outputs:** All engineered CSV tables, final cluster assignments, Excel summaries, and figures are included in the repository. You can review individual notebooks and results directly without needing to re-run the full pipeline.

### Running the Interactive Explorer

To view the companion dashboard locally, run the following command from the repository root:

```powershell
python -m http.server 8000
```

Then navigate to `http://localhost:8000/clustering-explorer/` in your browser.

---

## Limitations

- **Historical Cross-Sectional Data:** The dataset is a snapshot reflecting investments up to approximately 2014. Startup valuation norms, round sizes, and market conditions have shifted significantly since then.
- **Reporting and Survivorship Bias:** Crunchbase data relies heavily on voluntary reporting and public announcements. Successful funding rounds and active companies are more likely to be recorded than quiet failures or unannounced wind-downs.
- **Sparsity in Specialized Vehicles:** Several financing categories (such as crowdfunding, convertible notes, and secondary markets) had over 98% missing or zero values, requiring their removal and focusing the analysis on primary equity, debt, and stage counts.
- **Observational Findings:** Cluster assignments reflect empirical funding profiles in this dataset. They do not represent causal factors for startup success or exit outcomes.

---

## Academic Context

This project was developed collaboratively as part of the **Machine Learning II** course within the Data Science curriculum at **NOVA Information Management School (NOVA IMS)**, Lisbon, Portugal.
