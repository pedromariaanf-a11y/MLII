"""Quick exploratory checks for the startup funding dataset."""

from pathlib import Path

import pandas as pd


DATA_PATH = Path("investments_VC.csv")


def load_dataset(path: Path = DATA_PATH) -> pd.DataFrame:
    """Load the raw CSV and normalize column-name whitespace."""
    df = pd.read_csv(path, encoding="latin1")
    df.columns = df.columns.str.strip()
    return df


def main() -> None:
    df = load_dataset()

    print("Dataset shape:", df.shape)
    print("\nColumns:")
    print(df.columns.tolist())

    print("\nMissing values by column:")
    print(df.isna().sum().sort_values(ascending=False))

    if "market" in df.columns:
        print("\nTop markets:")
        print(df["market"].astype("string").str.strip().value_counts(dropna=False).head(10))

    if "status" in df.columns:
        print("\nCompany status distribution:")
        print(df["status"].value_counts(dropna=False))


if __name__ == "__main__":
    main()
