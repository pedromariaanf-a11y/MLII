import { formatMoney, formatNumber, formatPercent, prettifyColumn } from "./analysis.js";

export function generateInsights({ datasetSummary, rawSummary, clusterSummary, separation, correlations, outliers }) {
  const insights = [];
  const largest = clusterSummary.largest;
  const smallest = clusterSummary.smallest;

  if (largest) {
    const topFeature = largest.distinguishing[0];
    insights.push({
      kicker: "Most common pattern",
      title: `Cluster ${largest.cluster} is the main population`,
      tone: "blue",
      body: `It contains ${formatNumber(largest.count)} startups, or ${formatPercent(largest.percentage)} of the clustered dataset. This group appears most different on ${prettifyColumn(topFeature?.feature ?? "its funding profile")}, where it is ${topFeature?.direction ?? "different"} than the overall average.`,
    });
  }

  if (smallest) {
    const topFeature = smallest.distinguishing[0];
    insights.push({
      kicker: "Small but interesting group",
      title: `Cluster ${smallest.cluster} is the smallest cluster`,
      tone: "warm",
      body: `Only ${formatNumber(smallest.count)} startups sit here. Smaller clusters often point to a more specific behavior; this one appears especially shaped by ${prettifyColumn(topFeature?.feature ?? "a few funding features")}.`,
    });
  }

  if (separation?.length) {
    const strongest = separation[0];
    insights.push({
      kicker: "Feature that separates clusters most",
      title: prettifyColumn(strongest.feature),
      tone: "gold",
      body: `The widest cluster-to-cluster gap is in ${prettifyColumn(strongest.feature)}. Cluster ${strongest.high.cluster} is highest, while Cluster ${strongest.low.cluster} is lowest, so this feature is especially useful for telling the groups apart.`,
    });
  }

  const missing = datasetSummary.missingTop?.[0];
  if (missing) {
    insights.push({
      kicker: "Missing-value curiosity",
      title: `${prettifyColumn(missing.name)} has the most missing values`,
      tone: "warm",
      body: `${formatPercent(missing.missingRate)} of rows are missing this field. That does not break the cluster labels, but it is a reminder to be careful when interpreting geography or dates if those fields are involved.`,
    });
  }

  if (correlations?.strongest) {
    const corr = correlations.strongest;
    insights.push({
      kicker: "Strongest relationship",
      title: `${prettifyColumn(corr.x)} and ${prettifyColumn(corr.y)}`,
      tone: "blue",
      body: `These two numeric features have the strongest correlation in the displayed matrix at ${formatNumber(corr.value, 2)}. Positive values mean they tend to rise together; negative values mean one tends to fall as the other rises.`,
    });
  }

  const ratioStories = ratioInsights(clusterSummary);
  insights.push(...ratioStories);

  if (outliers?.length) {
    const top = outliers[0];
    insights.push({
      kicker: "Possible outlier",
      title: top.row.name ?? "Largest funding observation",
      tone: "gold",
      body: `The largest funding value loaded is ${formatMoney(top.value)}. Large values like this can strongly shape averages, which is why the app also uses medians in the cluster profiles.`,
    });
  }

  if (rawSummary && rawSummary.rows > datasetSummary.rows) {
    insights.push({
      kicker: "Before and after",
      title: "The clustered dataset is a filtered profile table",
      tone: "blue",
      body: `The raw VC file has ${formatNumber(rawSummary.rows)} rows, while the clustered profile has ${formatNumber(datasetSummary.rows)} rows. The clustered version focuses on rows with the engineered funding features needed for the model.`,
    });
  }

  return insights.slice(0, 8);
}

function ratioInsights(clusterSummary) {
  const ratioFeatures = ["venture_ratio", "debt_financing_ratio", "private_equity_ratio", "early_stage_funding_ratio"];
  return ratioFeatures
    .map((feature) => {
      const ranked = clusterSummary.clusters
        .map((cluster) => ({
          cluster: cluster.cluster,
          value: cluster.features[feature]?.median,
        }))
        .filter((item) => Number.isFinite(item.value))
        .sort((a, b) => b.value - a.value);
      if (!ranked.length || ranked[0].value <= 0) return null;
      return {
        kicker: "Cluster-specific behavior",
        title: `Cluster ${ranked[0].cluster} leads on ${prettifyColumn(feature)}`,
        tone: "teal",
        body: `This group has the highest median ${prettifyColumn(feature)}. Compared with other clusters, it appears more defined by this funding source or stage mix.`,
      };
    })
    .filter(Boolean)
    .slice(0, 2);
}
