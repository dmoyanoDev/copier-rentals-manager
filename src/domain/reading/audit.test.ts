import { describe, it, expect } from 'vitest';
import { auditReading } from './audit';

describe('auditReading', () => {
  it('debe alertar peligro crítico si la lectura final es menor que la inicial', () => {
    const alerts = auditReading({
      initial: 5000,
      final: 4500,
      limit: 1000,
      price: 50000,
      excessPrice: 10,
      applyIva: false,
      ivaRate: 21,
      isUnofficial: false,
      creditNote: 0,
      debitNote: 0,
      billingStatus: 'no-facturado',
      historicalReadings: [],
    });

    expect(alerts.some(a => a.type === 'danger' && a.message.includes('final es menor'))).toBe(true);
  });

  it('debe alertar anomalía si la lectura inicial es cero y la final es extremadamente alta', () => {
    const alerts = auditReading({
      initial: 0,
      final: 12000,
      limit: 1000,
      price: 50000,
      excessPrice: 10,
      applyIva: false,
      ivaRate: 21,
      isUnofficial: false,
      creditNote: 0,
      debitNote: 0,
      billingStatus: 'no-facturado',
      historicalReadings: [],
    });

    expect(alerts.some(a => a.type === 'danger' && a.message.includes('extremadamente alta'))).toBe(true);
  });

  it('debe alertar advertencia si el excedente supera el triple del límite del plan', () => {
    const alerts = auditReading({
      initial: 1000,
      final: 5500, // diff = 4500. limit = 1000. excess = 3500. 3500 > 3 * 1000
      limit: 1000,
      price: 50000,
      excessPrice: 10,
      applyIva: false,
      ivaRate: 21,
      isUnofficial: false,
      creditNote: 0,
      debitNote: 0,
      billingStatus: 'no-facturado',
      historicalReadings: [],
    });

    expect(alerts.some(a => a.type === 'warning' && a.message.includes('desproporcionado respecto al límite'))).toBe(true);
  });

  it('debe alertar advertencia si el consumo mensual actual supera el doble del promedio histórico', () => {
    const alerts = auditReading({
      initial: 1000,
      final: 3500, // consumo = 2500
      limit: 1000,
      price: 50000,
      excessPrice: 10,
      applyIva: false,
      ivaRate: 21,
      isUnofficial: false,
      creditNote: 0,
      debitNote: 0,
      billingStatus: 'no-facturado',
      historicalReadings: [
        { initial: 0, final: 1000 },   // consumo = 1000
        { initial: 1000, final: 2000 },  // consumo = 1000
      ], // promedio = 1000. 2500 > 1000 * 2.
    });

    expect(alerts.some(a => a.type === 'warning' && a.message.includes('promedio histórico'))).toBe(true);
  });

  it('debe alertar si se marca como facturada pero faltan datos de la factura', () => {
    const alerts = auditReading({
      initial: 1000,
      final: 1500,
      limit: 1000,
      price: 50000,
      excessPrice: 10,
      applyIva: false,
      ivaRate: 21,
      isUnofficial: false,
      creditNote: 0,
      debitNote: 0,
      billingStatus: 'facturada',
      invoiceNumber: '',
      invoiceDate: '',
      historicalReadings: [],
    });

    expect(alerts.some(a => a.type === 'warning' && a.message.includes('no se ingresó número de factura'))).toBe(true);
  });
});
