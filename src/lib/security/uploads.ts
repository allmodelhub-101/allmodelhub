const proofTypes = {
  "application/pdf": { extension: "pdf", matches: (bytes: Uint8Array) => new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-" },
  "image/png": { extension: "png", matches: (bytes: Uint8Array) => [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte) },
  "image/jpeg": { extension: "jpg", matches: (bytes: Uint8Array) => [0xff, 0xd8, 0xff].every((byte, index) => bytes[index] === byte) },
  "image/webp": { extension: "webp", matches: (bytes: Uint8Array) => new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP" }
} as const;

export function verifyPaymentProof(bytes: Uint8Array, declaredType: string) {
  const definition = proofTypes[declaredType as keyof typeof proofTypes];
  if (!definition || !definition.matches(bytes)) return null;
  return { contentType: declaredType, extension: definition.extension };
}
