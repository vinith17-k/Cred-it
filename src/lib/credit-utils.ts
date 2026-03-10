export function formatCurrency(amount: number): string {
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`;
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(2)} L`;
  return `₹${amount.toLocaleString("en-IN")}`;
}

export function getRiskCategory(score: number): { label: string; color: string } {
  if (score >= 80) return { label: "Very Safe", color: "text-success" };
  if (score >= 65) return { label: "Low Risk", color: "text-info" };
  if (score >= 40) return { label: "Moderate Risk", color: "text-warning" };
  return { label: "High Risk", color: "text-destructive" };
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}
