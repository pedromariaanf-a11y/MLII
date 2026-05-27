"""
Add PC1 and PC2 columns to the clustered CSV using the same pipeline as teste.ipynb:
  1. Select the 11 clustering features
  2. Apply RobustScaler (default params)
  3. PCA(n_components=2)
  4. Save PC1, PC2 back into the CSV
"""
import pandas as pd
from sklearn.preprocessing import RobustScaler
from sklearn.decomposition import PCA

CSV_PATH = "clustered_startups_real_values.csv"

features_to_scale = [
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
]

df = pd.read_csv(CSV_PATH)
print(f"Loaded {len(df)} rows from {CSV_PATH}")

# Scale with RobustScaler (same as notebook)
scaler = RobustScaler()
scaled = scaler.fit_transform(df[features_to_scale].fillna(0))

# 2-component PCA for visualization (same as notebook's pca_vis)
pca = PCA(n_components=2)
components = pca.fit_transform(scaled)

print(f"Explained variance: {pca.explained_variance_ratio_}")
print(f"Cumulative: {sum(pca.explained_variance_ratio_):.3f}")

df["PC1"] = components[:, 0]
df["PC2"] = components[:, 1]

df.to_csv(CSV_PATH, index=False)
print(f"Saved PC1, PC2 columns to {CSV_PATH}")
