import type { DecimalString } from "./money";

/** Counts submitted Unicode code points without normalizing or trimming the input. */
export function countSubmittedCharacters(text: string) {
  return Array.from(text).length.toString() as DecimalString;
}
