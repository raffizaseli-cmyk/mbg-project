/**
 * web/lib/utils.ts
 * Unit conversion helpers (mirroring backend/utils/unit_converter.py)
 */

/** Convert base unit value to display value */
export function toDisplay(baseQty: number, conversionFactor: number): number {
  if (!conversionFactor || conversionFactor === 0) return baseQty;
  return baseQty / conversionFactor;
}

/** Convert display value to base unit value */
export function toBase(displayQty: number, conversionFactor: number): number {
  return displayQty * conversionFactor;
}

/** Format stock for display: "50 kg", "200 pcs", "3.25 liter" */
export function formatStok(
  baseQty: number,
  displayUnit: string,
  conversionFactor: number
): string {
  const display = toDisplay(baseQty, conversionFactor);
  if (display === Math.floor(display)) {
    return `${display} ${displayUnit}`;
  }
  return `${display.toFixed(2)} ${displayUnit}`;
}

/** Unit groups for dropdown */
export const UNIT_GROUPS = {
  berat: [
    { value: "kg", label: "Kilogram (kg)", base: "gram", factor: 1000 },
    { value: "ons", label: "Ons", base: "gram", factor: 100 },
    { value: "gram", label: "Gram", base: "gram", factor: 1 },
  ],
  cair: [
    { value: "liter", label: "Liter", base: "ml", factor: 1000 },
    { value: "ml", label: "Mililiter (ml)", base: "ml", factor: 1 },
  ],
  satuan: [
    { value: "pcs", label: "Pcs", base: "pcs", factor: 1 },
    { value: "ikat", label: "Ikat", base: "pcs", factor: 1 },
    { value: "bungkus", label: "Bungkus", base: "pcs", factor: 1 },
    { value: "karung", label: "Karung", base: "pcs", factor: 1 },
    { value: "tabung", label: "Tabung", base: "pcs", factor: 1 },
    { value: "buah", label: "Buah", base: "pcs", factor: 1 },
    { value: "pack", label: "Pack", base: "pcs", factor: 1 },
    { value: "dus", label: "Dus", base: "pcs", factor: 1 },
    { value: "botol", label: "Botol", base: "pcs", factor: 1 },
  ],
};

/** Flat list of all units */
export const ALL_UNITS = [
  ...UNIT_GROUPS.berat,
  ...UNIT_GROUPS.cair,
  ...UNIT_GROUPS.satuan,
];

/** Get unit info by value */
export function getUnitInfo(unitValue: string) {
  return ALL_UNITS.find((u) => u.value === unitValue.toLowerCase());
}
