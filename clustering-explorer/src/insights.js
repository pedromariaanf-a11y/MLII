import { formatMoney, formatNumber, formatPercent, prettifyColumn } from "./analysis.js";

export function generateInsights({ datasetSummary, clusterSummary, separation, correlations, outliers }) {
  const insights = [];
  const largest = clusterSummary.largest;
  const smallest = clusterSummary.smallest;

  if (largest) {
    const topFeature = largest.distinguishing[0];
    insights.push({
      kicker: "Most common pattern",
      title: `Cluster ${largest.cluster} is the main population`,
      tone: "blue",
      body: `It contains ${formatNumber(largest.count)} startups, or ${formatPercent(largest.percentage)} of the clustered dataset. Its clearest signal is ${prettifyColumn(topFeature?.feature ?? "its funding profile")}, which is ${topFeature?.direction ?? "different"} than the overall average.`,
    });
  }

  if (smallest) {
    const topFeature = smallest.distinguishing[0];
    insights.push({
      kicker: "Small but interesting group",
      title: `Cluster ${smallest.cluster} is the smallest cluster`,
      tone: "warm",
      body: `Only ${formatNumber(smallest.count)} startups sit here. Its smaller size makes it useful as a specific profile, especially around ${prettifyColumn(topFeature?.feature ?? "a few funding features")}.`,
    });
  }

  if (separation?.length) {
    const strongest = separation[0];
    insights.push({
      kicker: "Feature that separates clusters most",
      title: prettifyColumn(strongest.feature),
      tone: "gold",
      body: `The widest cluster-to-cluster gap is in ${prettifyColumn(strongest.feature)}. Cluster ${strongest.high.cluster} is highest and Cluster ${strongest.low.cluster} is lowest, so this feature deserves attention during the explanation.`,
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

  return insights.slice(0, 8);
}

function ratioInsights(clusterSummary) {
  const ratioFeatures = ["venture_ratio", "debt_financing_ratio", "private_equity_ratio", "early_stage_funding_ratio"];
  const strongest = ratioFeatures
    .map((feature) => {
      const ranked = clusterSummary.clusters
        .map((cluster) => ({
          cluster: cluster.cluster,
          value: cluster.features[feature]?.median,
        }))
        .filter((item) => Number.isFinite(item.value))
        .sort((a, b) => b.value - a.value);
      if (!ranked.length || ranked[0].value <= 0) return null;
      const gap = ranked[0].value - (ranked[1]?.value ?? 0);
      return { feature, leader: ranked[0], gap };
    })
    .filter(Boolean)
    .sort((a, b) => b.gap - a.gap)[0];

  if (!strongest) return [];
  return [
    {
      kicker: "Funding mix signal",
      title: `Cluster ${strongest.leader.cluster} stands out on ${prettifyColumn(strongest.feature)}`,
      tone: "teal",
      body: `Its median ${prettifyColumn(strongest.feature)} is the clearest funding-source share difference among the displayed ratios, which helps explain why this group is separate.`,
    },
  ];
}
