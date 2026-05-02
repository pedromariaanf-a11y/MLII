# Startup Funding Clustering Analysis

This project applies unsupervised learning to a venture-capital startup dataset to identify funding-pattern clusters. The analysis is intended as an academic workflow: transparent cleaning decisions, documented feature engineering, explicit model validation, and interpretable cluster profiles.

## Repository Contents

- `investments_VC.csv` - raw startup funding dataset.
- `teste.ipynb` - main data-cleaning, feature-engineering, scaling, model-selection, clustering, and output-generation notebook.
- `analise_clustering.ipynb` - cluster profiling and interpretation notebook.
- `clustered_startups_real_values.csv` - regenerated output from `teste.ipynb`, with cleaned real-value features and the final cluster label.
- `EDA.py` - lightweight command-line EDA helper for quick dataset checks.
- `requirements.txt` - Python dependencies needed to run the notebooks.

## Academic Objective

The goal is to group startups by funding amount, funding composition, number of funding rounds, and stage progression. The clusters are descriptive rather than predictive: they summarize common funding profiles in the dataset and should be interpreted as patterns in the available Crunchbase-style records, not as universal startup categories.

## Setup

Create and activate a Python environment, then install the dependencies:

```bash
pip install -r requirements.txt
```

Then open the notebooks with Jupyter:

```bash
jupyter notebook
```

## Run Order

1. Run `teste.ipynb` from a clean kernel.
2. Confirm it writes `clustered_startups_real_values.csv`.
3. Run `analise_clustering.ipynb` from a clean kernel.
4. Review the final cluster report, plots, and limitations.

## Modeling Choice

The final model fits K-Means on the full robust-scaled feature set. PCA is used only for visualization and dimensionality summaries. This preserves the full engineered feature space for clustering while still allowing 2D/3D visual inspection.

The default number of clusters is `k=4`. The notebook reports inertia, silhouette score, cluster sizes, and stability checks across random seeds for `k=2` through `k=9` so the choice can be defended academically.

## Cluster Interpretation

The analysis notebook derives final cluster names from the resulting profiles. The expected interpretation is:

- Early-stage / low funding: smaller median funding totals and fewer rounds.
- Debt-financed startups: higher debt-financing share relative to other groups.
- Private equity / capital intensive: high total funding with a strong private-equity component.
- Venture-backed growth: high venture funding, more rounds, and later funding stages.

Because K-Means labels are arbitrary, the notebook assigns names after profiling the saved cluster labels.

## Data Quality Notes

The workflow standardizes whitespace in column names and market labels, converts funding totals to numeric values, combines sparse early-stage funding types, and reports row counts at each cleaning stage. It also checks suspicious records such as negative funding, zero total funding with positive subtype funding, and subtype funding totals greater than total funding.

## Limitations

The dataset is sparse and may be incomplete or historically biased. Funding subtype columns can be inconsistent with total funding, and the clustering result depends on feature choices, scaling, and the selected `k`. These clusters are useful for exploratory segmentation, but they should not be treated as causal or predictive classes.
