export interface BillingCalculationInput {
  initial: number;
  final: number;
  price: number;       // base price of the plan
  limit: number;       // copies limit included in the plan
  excessPrice: number; // price per excess copy
  applyIva: boolean;
  ivaRate: number;     // e.g. 21.0
  isUnofficial: boolean;
  creditNote: number;
  debitNote: number;
}

export interface BillingCalculationResult {
  copies: number;
  excess: number;
  fixedCost: number;
  excessCost: number;
  netCost: number;
  ivaCost: number;
  total: number;
}

/**
 * Calcula los detalles de facturación mensuales de acuerdo a la lectura inicial/final,
 * el plan asignado, el IVA y las notas de crédito/débito.
 */
export function calculateBilling(input: BillingCalculationInput): BillingCalculationResult {
  const copies = Math.max(0, input.final - input.initial);
  const excess = Math.max(0, copies - input.limit);
  const fixedCost = input.price;
  const excessCost = excess * input.excessPrice;
  const netCost = fixedCost + excessCost;

  const actualIvaRate = (!input.isUnofficial && input.applyIva) ? input.ivaRate : 0;
  const ivaCost = netCost * (actualIvaRate / 100);
  const total = netCost + ivaCost - input.creditNote + input.debitNote;

  return {
    copies,
    excess,
    fixedCost,
    excessCost,
    netCost,
    ivaCost,
    total,
  };
}
