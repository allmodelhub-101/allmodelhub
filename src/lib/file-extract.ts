import type { SupabaseClient } from "@supabase/supabase-js";

const TEXT_TYPES = new Set([
  "text/plain", "text/csv", "text/markdown", "application/json", "application/xml",
  "text/xml", "text/javascript", "application/javascript", "text/typescript"
]);

export async function extractText(file: File): Promise<{ text: string | null; status: "ready" | "unsupported" | "failed" }> {
  const buffer = Buffer.from(await file.arrayBuffer());
  try {
    if (TEXT_TYPES.has(file.type) || /\.(txt|md|csv|json|xml|js|ts|tsx|jsx|py|php|css|html)$/i.test(file.name)) {
      return { text: buffer.toString("utf8").slice(0, 1_500_000), status: "ready" };
    }
    if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
      const pdf = (await import("pdf-parse")).default;
      const parsed = await pdf(buffer);
      return { text: parsed.text.slice(0, 1_500_000), status: "ready" };
    }
    if (file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || /\.docx$/i.test(file.name)) {
      const mammoth = await import("mammoth");
      const parsed = await mammoth.extractRawText({ buffer });
      return { text: parsed.value.slice(0, 1_500_000), status: "ready" };
    }
    if (/\.(xlsx|xls)$/i.test(file.name)) {
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(buffer, { type: "buffer" });
      const parts = workbook.SheetNames.map((name) => `# ${name}\n${XLSX.utils.sheet_to_csv(workbook.Sheets[name])}`);
      return { text: parts.join("\n\n").slice(0, 1_500_000), status: "ready" };
    }
    return { text: null, status: "unsupported" };
  } catch {
    return { text: null, status: "failed" };
  }
}

export async function signedFileUrl(admin: SupabaseClient, storagePath: string) {
  const { data, error } = await admin.storage.from("user-files").createSignedUrl(storagePath, 300);
  if (error) throw error;
  return data.signedUrl;
}
