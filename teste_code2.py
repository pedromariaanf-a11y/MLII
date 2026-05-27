import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.preprocessing import RobustScaler
from sklearn.cluster import KMeans
from sklearn.decomposition import PCA
from sklearn.metrics import silhouette_score
import plotly.express as px
df = pd.read_csv("investments_VC.csv", encoding="latin1")

df
#retirar colunas irrelevantes#
irrelevant_col = ['permalink', 'homepage_url', 'state_code', 'region', 'founded_month', 'founded_quarter', 'founded_year']
df.drop(columns = irrelevant_col, inplace = True)
initial_rows = len(df)

# Remove rows where ALL values are missing
df.dropna(how='all', inplace=True)

print(f"Rows removed: {initial_rows - len(df)}")
lista_para_analise = df.select_dtypes(include=['number']).columns.tolist()

# Calcular métricas
total_rows = len(df)
non_zero_counts = (df[lista_para_analise] != 0).sum()
zero_percentages = (df[lista_para_analise] == 0).mean() * 100

# 5. Criar a Tabela de Resumo
summary_df = pd.DataFrame({
    'Coluna': lista_para_analise,
    'Zeros (%)': zero_percentages.map('{:.1f}%'.format),
    'Empresas com valor': non_zero_counts.values
})

# Função para definir a Conclusão baseada nos limites (thresholds)
def definir_conclusao(pct):
    if pct > 99.5: return "Descartável (Ruído puro)"
    if pct > 98.5: return "Candidata a Drop"
    if pct > 95.0: return "Limite (Ainda relevante)"
    return "Útil (Bom volume de dados)"

summary_df['Conclusão'] = zero_percentages.apply(definir_conclusao).values

# Exibir o resultado final
print("TABELA DE ANÁLISE DE VARIÂNCIA (ROUNDS)")
print("-" * 75)
print(summary_df.to_string(index=False))

# 3. Criar o Stage Level usando TODOS os rounds (do mais alto para o mais baixo)
def get_full_stage(row):
    if row['round_H'] > 0: return 8
    if row['round_G'] > 0: return 7
    if row['round_F'] > 0: return 6
    if row['round_E'] > 0: return 5
    if row['round_D'] > 0: return 4
    if row['round_C'] > 0: return 3
    if row['round_B'] > 0: return 2
    if row['round_A'] > 0: return 1
    return 0

df['stage_level'] = df.apply(get_full_stage, axis=1)

# Lista de ELIMINAÇÃO 
cols_to_remove = [
    'round_A', 'round_B', 'round_C', 'round_D', 'round_E', 'round_F', 'round_G', 'round_H']

df.drop(columns=[c for c in cols_to_remove if c in df.columns], inplace=True)

print(f"Dataset reduzido para {df.shape[1]} colunas.")
print("A trajetória de todas as empresas foi salva na coluna 'stage_level'.")

ZERO_THRESHOLD = 0.98  # Drop columns with more than 98% zeros
NULL_THRESHOLD = 0.90  # Drop columns with more than 90% missing values

# Identify columns with too many Zeros
zero_ratio = (df == 0).sum() / len(df)
cols_to_drop_zeros = zero_ratio[zero_ratio > ZERO_THRESHOLD].index.tolist()

# Identify columns with too many Nulls (NaN)
null_ratio = df.isnull().sum() / len(df)
cols_to_drop_nulls = null_ratio[null_ratio > NULL_THRESHOLD].index.tolist()

all_cols_to_drop = list(set(cols_to_drop_zeros + cols_to_drop_nulls))

# DROP
all_cols_to_drop = list(set(cols_to_drop_zeros + cols_to_drop_nulls))

print(f"Dropping {len(cols_to_drop_zeros)} columns due to Zeros: {cols_to_drop_zeros}")
print(f"Dropping {len(cols_to_drop_nulls)} columns due to Nulls: {cols_to_drop_nulls}")

df.drop(columns=all_cols_to_drop, inplace=True)

print("Dataset simplified and saved successfully.")

df.shape
df.info()

df.describe()
# 1. Limpar a coluna 'funding_total_usd' (Transformar texto em número real)
# Note que o nome da coluna no seu CSV tem espaços: ' funding_total_usd '
df[' funding_total_usd '] = df[' funding_total_usd '].str.replace(',', '') # Tira as vírgulas
df[' funding_total_usd '] = pd.to_numeric(df[' funding_total_usd '], errors='coerce') # Vira número

# Tratar o Status (Operating, Acquired, Closed)
# Como são poucos valores, vamos transformar em Categoria para economizar RAM
df['status'] = df['status'].astype('category')

# Remover linhas onde o nome da empresa é nulo (Não servem para nada)
df.dropna(subset=['name'], inplace=True)
print(df.isnull().sum())

df
# Remover linhas duplicadas
rows_before = len(df)
df.drop_duplicates(inplace=True)
rows_after = len(df)

print(f"Linhas removidas por duplicação: {rows_before - rows_after}")
print(f"Shape final: {df.shape}")
print(f"Total de registros únicos: {rows_after}")
# Obter todas as colunas numéricas
numeric_columns = df.select_dtypes(include=['number']).columns.tolist()

print(f"Total de variáveis numéricas: {len(numeric_columns)}")
print(f"Variáveis: {numeric_columns}")

df_numeric = df[numeric_columns]
df_numeric.var()

df.columns = df.columns.str.strip()
xy = len(df)
print(f"Linhas originais: {len(df)}")
# Remover linhas onde 'funding_total_usd' OU 'market' são nulos
# Estas são as colunas vitais para definir o perfil da startup
df.dropna(subset=['funding_total_usd', 'market'], inplace=True)

print(f"Linhas removidas: {xy - len(df)}")
print(f"Linhas restantes: {len(df)}")
zero_pct = (df == 0).mean() * 100
print("Percentage of zeros in each feature:")
print(zero_pct.round(2))

# Check rows with all zeros in funding types
funding_cols = ['seed', 'venture', 'debt_financing', 'angel', 'grant', 'private_equity']
all_zero_funding = (df[funding_cols] == 0).all(axis=1)
print(f"\nRows with all zero funding types: {all_zero_funding.sum()} out of {len(df)} ({all_zero_funding.mean()*100:.2f}%)")

# Rows with zero in venture (main funding)
zero_venture = (df['venture'] == 0)
print(f"Rows with zero venture funding: {zero_venture.sum()} ({zero_venture.mean()*100:.2f}%)")

all_zero_funding = (df[funding_cols] == 0).all(axis=1)
df = df[~all_zero_funding]
# 1. Combine similar funding types BEFORE the log transformation
df['early_stage_funding'] = df['seed'] + df['angel'] + df['grant']

# Now you can drop the highly sparse original columns
df.drop(columns=['seed', 'angel', 'grant'], inplace=True)
funding_type_cols = [
    'early_stage_funding',
    'venture',
    'debt_financing',
    'private_equity'
]

# Avoid division by zero
total_funding_safe = df['funding_total_usd'].replace(0, np.nan)

for col in funding_type_cols:
    df[f'{col}_ratio'] = df[col] / total_funding_safe

# Replace NaN values with 0
# This means: if total funding is zero or unavailable, the ratio is treated as 0
ratio_cols = [f'{col}_ratio' for col in funding_type_cols]
df[ratio_cols] = df[ratio_cols].fillna(0)

# Optional: cap ratios at 1 in case some funding-type values exceed total funding
# due to inconsistencies in the dataset
df[ratio_cols] = df[ratio_cols].clip(lower=0, upper=1)

print("Funding ratios created:")
display(df[ratio_cols].head())
columns_to_log = [
    'funding_total_usd', 
    'funding_rounds', 
    'early_stage_funding', 
    'venture', 
    'debt_financing', 
    'private_equity'
]

# 2. Apply the log1p transformation and save them as new columns 
# (Adding the 'log_' prefix keeps your data organized)
for col in columns_to_log:
    df[f'log_{col}'] = np.log1p(df[col])

# View the original vs the log-transformed data to see the difference
print("Transformation successful. Here is a sample of 'venture' vs 'log_venture':")
print(df[['venture', 'log_venture']].head())
features_to_scale = [
    'log_funding_total_usd', 
    'log_funding_rounds', 
    'log_early_stage_funding', 
    'log_venture', 
    'log_debt_financing',
    'log_private_equity', 
    'stage_level',

    # Funding composition ratios
    'early_stage_funding_ratio',
    'venture_ratio',
    'debt_financing_ratio',
    'private_equity_ratio'
]
# 2. Create a copy of your dataframe to keep things clean
df_clustering = df.dropna(subset=features_to_scale).copy()

# 3. Initialize the Scaler
scaler = RobustScaler()

# 4. Fit and Transform the data
scaled_arrays = scaler.fit_transform(df_clustering[features_to_scale])

# 5. Convert back to a Pandas DataFrame for easier viewing and EDA
df_scaled = pd.DataFrame(
    scaled_arrays, 
    columns=features_to_scale, 
    index=df_clustering.index
)

# View the scaled data
print("Shape of scaled data:", df_scaled.shape)
df_scaled.head()
# 1. Define the informational columns you want to keep for your App and EDA
# These are the columns that describe the startup but aren't used for the math
info_columns = [
    'name', 
    'category_list', 
    'market', 
    'status', 
    'country_code', 
    'city'
]

# 2. Extract these columns from the dataframe we used for clustering
# We use df_clustering so the indexes match perfectly with df_scaled
df_info = df_clustering[info_columns]

# 3. Combine the informational columns with the scaled numerical columns
# axis=1 means we are joining them side-by-side (column-wise)
df_final = pd.concat([df_info, df_scaled], axis=1)

# 4. View the final dataset ready for K-Means!
print(f"Final Dataset Shape: {df_final.shape}")
display(df_final.head())
pca_full = PCA()
pca_full.fit(df_scaled)

plt.plot(np.cumsum(pca_full.explained_variance_ratio_))
plt.xlabel('Components')
plt.ylabel('Cumulative Variance')
# 1. Initialize PCA to keep 3 components (great for 3D App visualizations later)
pca = PCA(n_components=3)

# 2. Fit and transform your SCALED data
# df_scaled is the output from your RobustScaler
pca_components = pca.fit_transform(df_scaled)

# 3. Create a new dataframe with the dense, non-zero components
df_pca = pd.DataFrame(
    data=pca_components, 
    columns=['PC1', 'PC2', 'PC3'],
    index=df_scaled.index
)

# View how much "information" (variance) these 3 columns captured
print(f"Variance explained by 3 components: {sum(pca.explained_variance_ratio_) * 100:.2f}%")
%%script false --no-raise
inertia = []
silhouette_scores = []
K_range = range(2, 10) # Testing 2 to 9 clusters

for k in K_range:
    # Initialize K-Means
    kmeans = KMeans(n_clusters=k, init='k-means++', random_state=42)
    kmeans.fit(df_pca)
    
    # Calculate Inertia (Elbow Method)
    inertia.append(kmeans.inertia_)
    
    # Calculate Silhouette Score
    score = silhouette_score(df_pca, kmeans.labels_)
    silhouette_scores.append(score)

# Plotting the results
fig, ax1 = plt.subplots(figsize=(10, 5))

# Plot Inertia (Look for the "elbow" or bend)
ax1.plot(K_range, inertia, 'bo-', label='Inertia (WCSS)')
ax1.set_xlabel('Number of Clusters (K)')
ax1.set_ylabel('Inertia', color='b')
ax1.tick_params('y', colors='b')

# Plot Silhouette Score (Look for the highest peak)
ax2 = ax1.twinx()
ax2.plot(K_range, silhouette_scores, 'ro-', label='Silhouette Score')
ax2.set_ylabel('Silhouette Score', color='r')
ax2.tick_params('y', colors='r')

plt.title('Elbow Method and Silhouette Score for Optimal K')
plt.show()
df_pca

# Assuming you chose K=4 (change this if your charts suggest otherwise)
OPTIMAL_K = 4

# Run the final model
final_kmeans = KMeans(n_clusters=OPTIMAL_K, init='k-means++', random_state=42, n_init = 10)
cluster_labels = final_kmeans.fit_predict(df_pca)

df2 = df['Cluster'] = cluster_labels.copy()
df_final['Cluster'] = cluster_labels # df_final is from our previous step with the names/markets

print("Clustering Complete! Startups per cluster:")
print(df_final['Cluster'].value_counts())
print(df_pca.columns)


# Create a 3D scatter plot using the 3 Principal Components
fig = px.scatter_3d(
    df_pca, 
    x='PC1', 
    y='PC2', 
    z='PC3',
    color=df_final['Cluster'].astype(str), # Color by cluster
    hover_name=df_final['name'],         # Show startup name on hover
    hover_data={'market': df_final['market']}, # Show market on hover
    title="Startup Clustering: 3D PCA Market Landscape",
    opacity=0.7
)

# Make the layout look clean for an app
fig.update_layout(margin=dict(l=0, r=0, b=0, t=40))
fig.show()
pca_2 = PCA(n_components=2)
df_pca_2 = pca_2.fit_transform(df_scaled)
plt.figure(figsize=(8,6))

sns.scatterplot(
    x=df_pca_2[:,0],
    y=df_pca_2[:,1],
    hue=df_final['Cluster'].astype(str),
    palette='tab10'
)

plt.xlabel('PC1')
plt.ylabel('PC2')
plt.title('Clusters (K=4) - PCA 2D Visualization')
plt.show()
OPTIMAL_K = 4

kmeans_scaled = KMeans(
    n_clusters=OPTIMAL_K,
    init='k-means++',
    random_state=42,
    n_init=10
)

cluster_labels_scaled = kmeans_scaled.fit_predict(df_scaled)

# Add labels to final dataframe
df_final['Cluster_scaled'] = cluster_labels_scaled

print("K-Means on df_scaled complete!")
print("Startups per cluster:")
print(df_final['Cluster_scaled'].value_counts().sort_index())
# ------------------------------------------------------------
# 2. PCA 2D only for visualization
# ------------------------------------------------------------

pca_vis = PCA(n_components=2)
df_scaled_pca_2d = pca_vis.fit_transform(df_scaled)

df_scaled_pca_2d = pd.DataFrame(
    df_scaled_pca_2d,
    columns=['PC1', 'PC2'],
    index=df_final.index
)

df_scaled_pca_2d['Cluster'] = cluster_labels_scaled.astype(str)

print("Explained variance by 2D PCA:")
print(pca_vis.explained_variance_ratio_)
print("Cumulative explained variance:")
print(pca_vis.explained_variance_ratio_.sum())
# ------------------------------------------------------------
# 3. 2D visualization of K-Means on df_scaled
# ------------------------------------------------------------

plt.figure(figsize=(8, 6))

sns.scatterplot(
    data=df_scaled_pca_2d,
    x='PC1',
    y='PC2',
    hue='Cluster',
    palette='tab10',
    alpha=0.7,
    s=35
)

plt.xlabel('PC1')
plt.ylabel('PC2')
plt.title('K-Means Clusters on df_scaled - PCA 2D Visualization')
plt.legend(title='Cluster')
plt.show()
print("K-Means on df_scaled:")
print(df_final['Cluster_scaled'].value_counts().sort_index())

print("\nK-Means on df_pca:")
print(df_final['Cluster'].value_counts().sort_index())
df_profile_real = df_clustering.copy()
df_profile_real['Cluster'] = df_final['Cluster'].values

df_profile_real.to_csv("clustered_startups_real_values.csv", index=False)