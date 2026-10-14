/** Prefer clipboard items; some browsers expose image files only in FileList.
 * Never fetch pasted HTML or remote URLs as references. */
export function clipboardImageFiles(data: {
  items?: ArrayLike<{ kind: string; type: string; getAsFile(): File | null }>;
  files?: ArrayLike<File>;
}): File[] {
  const items = Array.from(data.items || [])
    .filter(item => item.kind === "file" && item.type.startsWith("image/"))
    .map(item => item.getAsFile()).filter((file): file is File => Boolean(file));
  return items.length ? items : Array.from(data.files || []).filter(file => file.type.startsWith("image/"));
}
