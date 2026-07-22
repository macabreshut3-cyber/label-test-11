export function convertUncToFileUrl(uncPath: string): string {
  if (!uncPath) return '';
  const trimmed = uncPath.trim();
  
  // Return as-is if it's already a web link
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  
  // Handle UNC paths starting with \\
  const normalized = trimmed
    .replace(/^\\\\/, "")
    .split("\\")
    .map(segment => encodeURIComponent(segment))
    .join("/");

  return `file://///${normalized}`;
}
