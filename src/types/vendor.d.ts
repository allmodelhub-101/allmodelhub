declare module "pdf-parse" {
  type PdfResult = { text: string; numpages?: number; info?: unknown; metadata?: unknown };
  export default function pdf(data: Buffer | Uint8Array): Promise<PdfResult>;
}
