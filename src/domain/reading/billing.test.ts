import { describe, it, expect } from 'vitest';
import { calculateBilling } from './billing';

describe('calculateBilling', () => {
  it('debe calcular valores correctos cuando el consumo es menor al límite del plan (sin excedente)', () => {
    const result = calculateBilling({
      initial: 1000,
      final: 2500,
      price: 119000,
      limit: 3000,
      excessPrice: 49,
      applyIva: true,
      ivaRate: 21,
      isUnofficial: false,
      creditNote: 0,
      debitNote: 0,
    });

    expect(result.copies).toBe(1500);
    expect(result.excess).toBe(0);
    expect(result.fixedCost).toBe(119000);
    expect(result.excessCost).toBe(0);
    expect(result.netCost).toBe(119000);
    expect(result.ivaCost).toBe(24990); // 119000 * 0.21
    expect(result.total).toBe(143990);
  });

  it('debe calcular excedente y costos correctos cuando supera el límite del plan', () => {
    const result = calculateBilling({
      initial: 1000,
      final: 4500,
      price: 119000,
      limit: 3000,
      excessPrice: 49,
      applyIva: true,
      ivaRate: 21,
      isUnofficial: false,
      creditNote: 5000,
      debitNote: 2000,
    });

    expect(result.copies).toBe(3500);
    expect(result.excess).toBe(500);
    expect(result.fixedCost).toBe(119000);
    expect(result.excessCost).toBe(24500); // 500 * 49
    expect(result.netCost).toBe(143500);
    expect(result.ivaCost).toBe(30135); // 143500 * 0.21
    expect(result.total).toBe(143500 + 30135 - 5000 + 2000); // 170635
  });

  it('no debe aplicar IVA si la factura se marca como informal/no oficial', () => {
    const result = calculateBilling({
      initial: 1000,
      final: 2000,
      price: 50000,
      limit: 1000,
      excessPrice: 20,
      applyIva: true,
      ivaRate: 21,
      isUnofficial: true,
      creditNote: 0,
      debitNote: 0,
    });

    expect(result.ivaCost).toBe(0);
    expect(result.total).toBe(50000);
  });
});
