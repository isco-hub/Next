const GSM7_BASIC =
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";

const GSM7_EXTENDED = "^{}\\[~]|€";

const GSM7_SET = new Set(`${GSM7_BASIC}${GSM7_EXTENDED}`);

export type SmsEncoding = "GSM-7" | "UCS-2";

export interface SmsSegments {
  encoding: SmsEncoding;
  units: number;
  segments: number;
  perSegment: number;
  remaining: number;
  extendedCharacters: number;
}

export const isGsm7 = (text: string): boolean =>
  [...text].every((character) => GSM7_SET.has(character));

export const countSmsSegments = (text: string): SmsSegments => {
  const gsm = isGsm7(text);
  const extendedCharacters = gsm
    ? [...text].filter((character) => GSM7_EXTENDED.includes(character)).length
    : 0;
  const units = gsm ? [...text].length + extendedCharacters : text.length;

  if (gsm) {
    const perSegment = units <= 160 ? 160 : 153;
    const segments = units === 0 ? 0 : Math.ceil(units / perSegment);
    return {
      encoding: "GSM-7",
      units,
      segments,
      perSegment,
      remaining: segments === 0 ? 160 : segments * perSegment - units,
      extendedCharacters,
    };
  }

  const perSegment = units <= 70 ? 70 : 67;
  const segments = units === 0 ? 0 : Math.ceil(units / perSegment);
  return {
    encoding: "UCS-2",
    units,
    segments,
    perSegment,
    remaining: segments === 0 ? 70 : segments * perSegment - units,
    extendedCharacters: 0,
  };
};
