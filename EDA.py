import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.preprocessing import RobustScaler
from sklearn.cluster import KMeans
from sklearn.decomposition import PCA
from sklearn.metrics import silhouette_score
import plotly.express as px

def format_usd(x):
    if pd.isna(x):
        return ""
    if abs(x) >= 1_000_000_000:
        return f"${x/1_000_000_000:.2f}B"
    elif abs(x) >= 1_000_000:
        return f"${x/1_000_000:.2f}M"
    elif abs(x) >= 1_000:
        return f"${x/1_000:.1f}K"
    else:
        return f"${x:,.0f}"

def definir_conclusao(pct):
    if pct > 99.5: return "Descartável (Ruído puro)"
    if pct > 98.5: return "Candidata a Drop"
    if pct > 95.0: return "Limite (Ainda relevante)"
    return "Útil (Bom volume de dados)"

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

