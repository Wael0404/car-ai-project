/**
 * Part name from a product title, for offers saved before the agent labelled
 * them (free, no AI). Order matters: "filtre à huile" before "huile".
 */
const PART_KEYWORDS: Array<[RegExp, string]> = [
  [/filtre\s+(?:à|a)\s+huile/i, "Filtre à huile"],
  [/filtre\s+(?:(?:à|a)\s+)?air\b/i, "Filtre à air"],
  [/filtre\s+(?:d['’]\s*)?habitacle|filtre\s+(?:à|a)?\s*pollen/i, "Filtre d'habitacle"],
  [/filtre\s+(?:(?:à|a)\s+)?(?:gasoil|gazoil|carburant|essence)/i, "Filtre à carburant"],
  [/kit\s+(?:de\s+)?distribution|courroie\s+de\s+distribution/i, "Kit de distribution"],
  [/courroie/i, "Courroie d'accessoires"],
  [/plaquettes?/i, "Plaquettes de frein"],
  [/disques?\s+de\s+frein/i, "Disques de frein"],
  [/liquide\s+de\s+frein|\bdot\s*[345]/i, "Liquide de frein"],
  [/liquide\s+de\s+refroidissement|antigel|anti-gel|coolant/i, "Liquide de refroidissement"],
  [/bougies?/i, "Bougies"],
  [/batterie/i, "Batterie"],
  [/pneus?\b/i, "Pneus"],
  [/balais?|essuie-glace/i, "Balais d'essuie-glace"],
  [/huile|\b\d{1,2}w-?\d{2}\b/i, "Huile moteur"],
];

export function guessPart(product: string): string {
  return PART_KEYWORDS.find(([re]) => re.test(product))?.[1] ?? "Pièces";
}

/**
 * Maker name written just before the reference in a title, in capitals:
 * "Filtre à huile MISFAT L008" + "L008" -> "MISFAT". Null when unsure.
 */
export function brandFromTitle(product: string, reference: string | null | undefined): string | null {
  if (!reference) return null;
  const at = product.toUpperCase().indexOf(reference.toUpperCase());
  if (at <= 0) return null;
  const isBrand = (w: string) => /^[A-Z][A-Z0-9&-]{1,14}$/.test(w);
  const words = product.slice(0, at).trim().split(/\s+/);
  const before = words.at(-1) ?? "";
  if (isBrand(before)) return before;
  // "GATES Courroie d'accessoire 5PK1153": maker first, in capitals.
  return isBrand(words[0] ?? "") ? words[0]! : null;
}
