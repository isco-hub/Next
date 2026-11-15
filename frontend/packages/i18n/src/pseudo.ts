const VOWELS: Record<string, string> = {
  a: "á",
  e: "é",
  i: "í",
  o: "ó",
  u: "ú",
  A: "Á",
  E: "É",
  I: "Í",
  O: "Ó",
  U: "Ú",
};

const ACCENTED_ONLY = /[\u00c0-\u024f]/;

export const pseudoLocalize = (text: string): string => {
  if (!text.trim()) return text;
  if (ACCENTED_ONLY.test(text)) return `⟦${text}⟧`;
  const transformed = [...text]
    .map((character) => VOWELS[character] ?? character)
    .join("");
  const padding = "·".repeat(Math.max(2, Math.ceil(transformed.length * 0.32)));
  return `⟦${transformed} ${padding}⟧`;
};

export const isPseudoEnabled = (): boolean => {
  if (typeof window === "undefined") return false;
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.get("pseudo") === "1") return true;
    return window.localStorage.getItem("nextcrop.pseudo") === "1";
  } catch {
    return false;
  }
};

export const setPseudoEnabled = (enabled: boolean): void => {
  try {
    window.localStorage.setItem("nextcrop.pseudo", enabled ? "1" : "0");
  } catch {
    // Storage can be unavailable in private mode; pseudo-localisation is optional.
  }
};

