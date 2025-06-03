export function formatSize(
  size: number,
  opts?: { unit?: "o" | "b"; decimals?: number }
): string {
  const { unit = "o", decimals = 1 } = opts || {};
  let value = size;
  let suffix = "o";

  if (unit === "b") {
    value = value * 8;
    suffix = "b";
  }

  const units = ["", "K", "M", "G", "T", "P"];
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }

  return `${value.toFixed(decimals)} ${units[i]}${suffix}`;
}