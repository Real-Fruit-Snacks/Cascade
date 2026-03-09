export function parseFileParts(filePath: string): { fileName: string; dir: string | null } {
  const parts = filePath.replace(/\\/g, '/').split('/');
  const fileName = parts.pop()?.replace(/\.md$/, '') ?? filePath;
  const dir = parts.length > 0 ? parts.join('/') : null;
  return { fileName, dir };
}
