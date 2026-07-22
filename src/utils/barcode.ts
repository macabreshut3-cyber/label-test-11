export function normalizeBarcode(value: unknown): string {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/[^0-9A-Za-z]/g, "");
}
