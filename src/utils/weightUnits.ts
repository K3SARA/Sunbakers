/**
 * Utility helpers for weight unit handling and conversion
 * Handles Grams (g) <-> Kilograms (KG) seamless conversions
 */

export const isGramUnit = (unit?: string): boolean => {
  if (!unit) return false;
  const u = unit.trim().toLowerCase();
  return u === 'g' || u === 'gram' || u === 'grams';
};

export const isKgUnit = (unit?: string): boolean => {
  if (!unit) return false;
  const u = unit.trim().toLowerCase();
  return u === 'kg' || u === 'kgs' || u === 'kilogram' || u === 'kilograms';
};

export const isWeightUnit = (unit?: string): boolean => {
  return isGramUnit(unit) || isKgUnit(unit);
};

/**
 * Format quantity and unit for display:
 * e.g.:
 * 1500 g -> "1.5 KG (1,500 g)"
 * 500 g  -> "500 g"
 * 2.5 KG -> "2.5 KG (2,500 g)"
 */
export const formatIngredientQty = (quantity: number, unit?: string): string => {
  const num = Number(quantity) || 0;
  const u = (unit || '').trim();

  if (isGramUnit(u)) {
    if (num >= 1000) {
      const kg = num / 1000;
      const formattedKg = Number.isInteger(kg) ? kg.toString() : parseFloat(kg.toFixed(3)).toString();
      return `${formattedKg} KG (${num.toLocaleString()} g)`;
    }
    return `${num.toLocaleString()} g`;
  }

  if (isKgUnit(u)) {
    const grams = num * 1000;
    const formattedKg = Number.isInteger(num) ? num.toString() : parseFloat(num.toFixed(3)).toString();
    return `${formattedKg} KG (${grams.toLocaleString()} g)`;
  }

  return `${num} ${unit || 'Units'}`;
};

/**
 * Convert quantity from input unit to raw material inventory base unit
 */
export const convertToInventoryBaseQty = (
  enteredQty: number,
  enteredUnit: string,
  baseInventoryUnit?: string
): number => {
  if (isGramUnit(baseInventoryUnit) && enteredUnit === 'KG') {
    return enteredQty * 1000;
  }
  if (isKgUnit(baseInventoryUnit) && enteredUnit === 'g') {
    return enteredQty / 1000;
  }
  return enteredQty;
};

