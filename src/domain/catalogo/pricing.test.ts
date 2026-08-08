import { describe, it, expect } from 'vitest';
import { resolvePricingConfig, calculateCatalogItemPrices, resolveCostoUnitarioArs } from './pricing';
import { PartCatalogItem, PricingSetting } from '@/domain/types';

// Fila base "todo en global" — mismos valores sembrados en producción (ver
// backup/route.ts, ensureSchemaSynced 13b), salvo donde un test necesita otro número
// para aislar lo que está probando.
const globalRow: PricingSetting = {
  id: 'pricing-global',
  scope: 'global',
  scopeKey: null,
  transportePct: 0.05,
  precioListaPct: 0.19,
  precioEfectivoPct: 0.25,
  licitacionesPct: 0.25,
  insumosRepuestosPct: 0.25,
  equiposPct: 0.25,
  promocionesPct: 0,
  promocionesActiva: false,
};

const ricohM320F: PartCatalogItem = {
  id: 'part-ricoh-m320f',
  nombre: 'MULTIFUNCION RICOH M320F',
  categoria: 'Repuesto',
  unidad: 'Unidad',
  costoUnitario: 0,
  stockActual: 0,
  stockMinimo: 0,
  tipoProducto: 'MULTIFUNCION MONOCROMATICA',
  moneda: 'USD',
  costoBase: 334,
};

describe('calculateCatalogItemPrices — cascada verificada contra la hoja real', () => {
  it('reproduce el costo con IVA verificado de la planilla (334 USD, transporte 5%, IVA 21%, dólar 1560) cuando el markup por tipo es 0', () => {
    const resolved = resolvePricingConfig(ricohM320F, [{ ...globalRow, equiposPct: 0 }]);
    const result = calculateCatalogItemPrices(ricohM320F, resolved, 1560);
    // 334 * 1.05 * 1.21 * 1560 = 661981.32 — verificado con la fórmula real de la celda (I8)
    expect(result.costoConIva).toBeCloseTo(661981.32, 2);
    expect(result.costoAjustadoPorTipo).toBeCloseTo(661981.32, 2); // equiposPct=0, no cambia
  });

  it('aplica el margen de efectivo (25%) igual que V-EN PESOS CONTADO EFECTIVO de la planilla', () => {
    const resolved = resolvePricingConfig(ricohM320F, [{ ...globalRow, equiposPct: 0 }]);
    const result = calculateCatalogItemPrices(ricohM320F, resolved, 1560);
    // 661981.32 / 0.75 = 882641.76 — verificado
    expect(result.precioEfectivo).toBeCloseTo(882641.76, 2);
  });

  it('deriva transferencia/lista/6cuotas del efectivo, igual que la planilla', () => {
    const resolved = resolvePricingConfig(ricohM320F, [{ ...globalRow, equiposPct: 0 }]);
    const result = calculateCatalogItemPrices(ricohM320F, resolved, 1560);
    expect(result.precioTransferencia).toBeCloseTo(966492.7272, 2); // 882641.76 * 1.095
    expect(result.precioLista).toBeCloseTo(1089681.185185, 2);      // 882641.76 / 0.81
    expect(result.precio6Cuotas).toBeCloseTo(1120955.0352, 2);      // 882641.76 * 1.27
  });

  it('el markup por tipo de producto (equipos) se aplica antes de calcular cualquier precio de venta', () => {
    const resolved = resolvePricingConfig(ricohM320F, [{ ...globalRow, equiposPct: 0.10 }]);
    const result = calculateCatalogItemPrices(ricohM320F, resolved, 1560);
    expect(result.costoAjustadoPorTipo).toBeCloseTo(661981.32 * 1.10, 2);
    expect(result.precioEfectivo).toBeCloseTo((661981.32 * 1.10) / 0.75, 2);
  });

  it('un insumo/repuesto usa insumosRepuestosPct, no equiposPct, aunque difieran mucho', () => {
    const item: PartCatalogItem = { ...ricohM320F, tipoProducto: 'INSUMOS', moneda: 'ARS', costoBase: 100 };
    const resolved = resolvePricingConfig(item, [{ ...globalRow, insumosRepuestosPct: 0.20, equiposPct: 0.50 }]);
    const result = calculateCatalogItemPrices(item, resolved, 1560);
    // ARS nativo: sin transporte. 100 * 1.21 = 121; * 1.20 (insumosRepuestos, no equipos) = 145.2
    expect(result.costoConTransporte).toBeCloseTo(100, 2);
    expect(result.costoConIva).toBeCloseTo(121, 2);
    expect(result.costoAjustadoPorTipo).toBeCloseTo(145.2, 2);
  });

  it('un ítem con costo en ARS no recibe el recargo de transporte (es de importación)', () => {
    const item: PartCatalogItem = { ...ricohM320F, moneda: 'ARS', costoBase: 1000 };
    const resolved = resolvePricingConfig(item, [globalRow]);
    const result = calculateCatalogItemPrices(item, resolved, 1560);
    expect(result.costoBaseArs).toBe(1000);
    expect(result.costoConTransporte).toBe(1000); // igual al base, no *1.05
  });

  it('promoción: si el % da un precio mayor al de lista, se ignora (guardrail)', () => {
    // precioLista se compone en 2 pasos desde el costo (efectivo -> lista), mientras que
    // promoción es 1 solo paso desde el costo ajustado — con 1000 ARS de costo base y los
    // % default (efectivo 25%, lista 19%, equipos 25%), precioLista da ~2489.71. Un
    // promocionesPct de 0.30 solo (probado antes, no dispara el guardrail) no alcanza;
    // hace falta > ~39% para que el paso único de promoción supere al compuesto de lista.
    const item: PartCatalogItem = { ...ricohM320F, moneda: 'ARS', costoBase: 1000 };
    const resolved = resolvePricingConfig(item, [{ ...globalRow, promocionesPct: 0.60, promocionesActiva: true }]);
    const result = calculateCatalogItemPrices(item, resolved, 1560);
    expect(result.precioPromocion).toBeNull();
    expect(result.precioFinal).toBe(result.precioLista);
  });

  it('promoción activa y por debajo de lista, se aplica como precio final', () => {
    const item: PartCatalogItem = { ...ricohM320F, moneda: 'ARS', costoBase: 1000 };
    const resolved = resolvePricingConfig(item, [{ ...globalRow, promocionesPct: 0.05, promocionesActiva: true }]);
    const result = calculateCatalogItemPrices(item, resolved, 1560);
    expect(result.precioPromocion).not.toBeNull();
    expect(result.precioPromocion!).toBeLessThan(result.precioLista);
    expect(result.precioFinal).toBe(result.precioPromocion);
  });

  it('promoción inactiva nunca se aplica aunque el % sea favorable', () => {
    const item: PartCatalogItem = { ...ricohM320F, moneda: 'ARS', costoBase: 1000 };
    const resolved = resolvePricingConfig(item, [{ ...globalRow, promocionesPct: 0.05, promocionesActiva: false }]);
    const result = calculateCatalogItemPrices(item, resolved, 1560);
    expect(result.precioPromocion).toBeNull();
  });
});

describe('resolvePricingConfig — prioridad unidad > categoría > global, campo por campo', () => {
  const categoriaRow: PricingSetting = {
    id: 'pricing-categoria-MULTIFUNCION MONOCROMATICA',
    scope: 'categoria',
    scopeKey: 'MULTIFUNCION MONOCROMATICA',
    transportePct: 0.08,
    precioListaPct: null,
    precioEfectivoPct: null,
    licitacionesPct: null,
    insumosRepuestosPct: null,
    equiposPct: null,
    promocionesPct: null,
    promocionesActiva: null,
  };
  const unidadRow: PricingSetting = {
    id: 'pricing-unidad-part-ricoh-m320f',
    scope: 'unidad',
    scopeKey: 'part-ricoh-m320f',
    transportePct: null,
    precioListaPct: null,
    precioEfectivoPct: null,
    licitacionesPct: null,
    insumosRepuestosPct: null,
    equiposPct: null,
    promocionesPct: 0.15,
    promocionesActiva: true,
  };

  it('usa el valor de unidad cuando existe, aunque también haya categoría y global', () => {
    const resolved = resolvePricingConfig(ricohM320F, [globalRow, categoriaRow, unidadRow]);
    expect(resolved.promocionesPct.value).toBe(0.15);
    expect(resolved.promocionesPct.source).toBe('unidad');
  });

  it('usa el valor de categoría cuando la unidad no trae ese campo', () => {
    const resolved = resolvePricingConfig(ricohM320F, [globalRow, categoriaRow, unidadRow]);
    expect(resolved.transportePct.value).toBe(0.08);
    expect(resolved.transportePct.source).toBe('categoria');
  });

  it('un override parcial (solo 1 campo) no bloquea la herencia del resto — no es todo o nada', () => {
    const resolved = resolvePricingConfig(ricohM320F, [globalRow, categoriaRow, unidadRow]);
    // categoriaRow solo trae transportePct; precioListaPct debe seguir viniendo de global
    expect(resolved.precioListaPct.value).toBe(globalRow.precioListaPct);
    expect(resolved.precioListaPct.source).toBe('global');
  });

  it('sin ningún override, todo viene de global', () => {
    const resolved = resolvePricingConfig(ricohM320F, [globalRow]);
    for (const field of ['transportePct', 'precioListaPct', 'precioEfectivoPct', 'licitacionesPct', 'insumosRepuestosPct', 'equiposPct', 'promocionesPct'] as const) {
      expect(resolved[field].source).toBe('global');
    }
  });

  it('una categoría no matchea si el ítem tiene un tipoProducto distinto', () => {
    const otroItem: PartCatalogItem = { ...ricohM320F, tipoProducto: 'ESCANER' };
    const resolved = resolvePricingConfig(otroItem, [globalRow, categoriaRow]);
    expect(resolved.transportePct.source).toBe('global'); // categoriaRow es para MULTIFUNCION MONOCROMATICA, no ESCANER
  });
});

describe('resolveCostoUnitarioArs', () => {
  it('convierte a ARS cuando la moneda es USD', () => {
    expect(resolveCostoUnitarioArs({ ...ricohM320F, moneda: 'USD', costoBase: 100 }, 1560)).toBe(156000);
  });
  it('devuelve el costo base directo cuando ya está en ARS', () => {
    expect(resolveCostoUnitarioArs({ ...ricohM320F, moneda: 'ARS', costoBase: 5000 }, 1560)).toBe(5000);
  });
});
