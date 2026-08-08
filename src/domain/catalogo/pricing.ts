import { PartCatalogItem, PricingSetting, PricingScope, TipoProducto } from '@/domain/types';

// Constantes fijas, no configurables — no son parámetros comerciales del catálogo, son
// reglas ya establecidas en otra parte de esta app (IVA, ver domain/budget/calculations.ts)
// o recargos que la propia planilla Excel escribe como literales en la fórmula en vez de
// referenciar una celda de parámetro (ver la verificación hecha sobre la hoja real).
const IVA_RATE = 0.21;
const RECARGO_TRANSFERENCIA = 0.095;
const RECARGO_6_CUOTAS = 0.27;

const PRICING_FIELDS = [
  'transportePct', 'precioListaPct', 'precioEfectivoPct', 'licitacionesPct',
  'insumosRepuestosPct', 'equiposPct', 'promocionesPct', 'promocionesActiva',
] as const;
type PricingField = typeof PRICING_FIELDS[number];

const FALLBACK_DEFAULTS: Record<PricingField, number | boolean> = {
  transportePct: 0, precioListaPct: 0, precioEfectivoPct: 0, licitacionesPct: 0,
  insumosRepuestosPct: 0, equiposPct: 0, promocionesPct: 0, promocionesActiva: false,
};

export interface ResolvedField<T> {
  value: T;
  source: PricingScope;
}

export type ResolvedPricingConfig = {
  [K in Exclude<PricingField, 'promocionesActiva'>]: ResolvedField<number>;
} & {
  promocionesActiva: ResolvedField<boolean>;
};

const TIPOS_INSUMO_REPUESTO: TipoProducto[] = ['INSUMOS', 'REPUESTO'];

/**
 * Resuelve los 8 campos de config de precios para un ítem, cada uno de forma
 * independiente: unidad > categoría > global. Un override de categoría/unidad puede
 * traer solo ALGUNOS campos no-nulos — los que deja en null se heredan del nivel
 * siguiente, no del override entero.
 */
export function resolvePricingConfig(item: PartCatalogItem, settings: PricingSetting[]): ResolvedPricingConfig {
  const globalRow = settings.find(s => s.scope === 'global') ?? null;
  const categoriaRow = item.tipoProducto
    ? settings.find(s => s.scope === 'categoria' && s.scopeKey === item.tipoProducto) ?? null
    : null;
  const unidadRow = settings.find(s => s.scope === 'unidad' && s.scopeKey === item.id) ?? null;

  const resolveOne = <T,>(field: PricingField): ResolvedField<T> => {
    if (unidadRow && unidadRow[field] != null) return { value: unidadRow[field] as T, source: 'unidad' };
    if (categoriaRow && categoriaRow[field] != null) return { value: categoriaRow[field] as T, source: 'categoria' };
    const globalValue = globalRow?.[field];
    return { value: (globalValue != null ? globalValue : FALLBACK_DEFAULTS[field]) as T, source: 'global' };
  };

  return {
    transportePct: resolveOne<number>('transportePct'),
    precioListaPct: resolveOne<number>('precioListaPct'),
    precioEfectivoPct: resolveOne<number>('precioEfectivoPct'),
    licitacionesPct: resolveOne<number>('licitacionesPct'),
    insumosRepuestosPct: resolveOne<number>('insumosRepuestosPct'),
    equiposPct: resolveOne<number>('equiposPct'),
    promocionesPct: resolveOne<number>('promocionesPct'),
    promocionesActiva: resolveOne<boolean>('promocionesActiva'),
  };
}

export interface CatalogItemPriceBreakdown {
  dolarUsado: number;
  costoBaseArs: number;
  costoConTransporte: number;
  costoConIva: number;
  // Markup de costo aplicado según tipo de producto (insumosRepuestosPct o equiposPct,
  // según corresponda) — no es un precio de venta, es un ajuste de costo previo a
  // calcular cualquier precio de venta, igual que transporte.
  costoAjustadoPorTipo: number;
  precioEfectivo: number;
  precioTransferencia: number;
  precioLista: number;
  precio6Cuotas: number;
  precioLicitacion: number;
  // null = la promoción no aplica (inactiva, o el % da un precio mayor al de lista —
  // ver el guardrail más abajo). No inventar un número cuando no corresponde.
  precioPromocion: number | null;
  precioFinal: number;
}

/**
 * Reproduce, generalizada a los % resueltos, la cascada de precios verificada
 * fórmula por fórmula contra la hoja real "PRECIO DE VENTA INSUMOS Y EQUIP":
 *   costo (en `item.moneda`) -> [si es importado: + transporte] -> + IVA (fijo, 21%)
 *   -> + markup por tipo de producto (insumos/repuestos o equipos) -> costo ajustado
 *   -> cada precio de venta es un margen (costo / (1 - %)) o un recargo sobre el
 *      efectivo, según corresponda — nunca un descuento aplicado al revés.
 * Función pura — no hace fetch, no lee reloj ni estado; todo entra por parámetro.
 */
export function calculateCatalogItemPrices(
  item: PartCatalogItem,
  resolved: ResolvedPricingConfig,
  dolarUsado: number
): CatalogItemPriceBreakdown {
  const costoBase = item.costoBase ?? 0;
  const esImportado = item.moneda === 'USD';

  const costoBaseArs = esImportado ? costoBase * dolarUsado : costoBase;
  // El transporte es un recargo de importación — no tiene sentido aplicarlo a un ítem
  // cuyo costo ya está en pesos (proveedor local).
  const costoConTransporte = esImportado ? costoBaseArs * (1 + resolved.transportePct.value) : costoBaseArs;
  const costoConIva = costoConTransporte * (1 + IVA_RATE);

  const esInsumoORepuesto = item.tipoProducto != null && TIPOS_INSUMO_REPUESTO.includes(item.tipoProducto);
  const tipoPct = esInsumoORepuesto ? resolved.insumosRepuestosPct.value : resolved.equiposPct.value;
  const costoAjustadoPorTipo = costoConIva * (1 + tipoPct);

  const precioEfectivo = divideByRemainingMargin(costoAjustadoPorTipo, resolved.precioEfectivoPct.value);
  const precioTransferencia = precioEfectivo * (1 + RECARGO_TRANSFERENCIA);
  const precioLista = divideByRemainingMargin(precioEfectivo, resolved.precioListaPct.value);
  const precio6Cuotas = precioEfectivo * (1 + RECARGO_6_CUOTAS);
  const precioLicitacion = divideByRemainingMargin(costoAjustadoPorTipo, resolved.licitacionesPct.value);

  const precioPromocionRaw = divideByRemainingMargin(costoAjustadoPorTipo, resolved.promocionesPct.value);
  // Guardrail: una promoción mal cargada nunca puede terminar cobrando más que el
  // precio de lista normal — si eso pasa, se ignora la promoción.
  const precioPromocion = (resolved.promocionesActiva.value && precioPromocionRaw < precioLista)
    ? precioPromocionRaw
    : null;

  return {
    dolarUsado,
    costoBaseArs,
    costoConTransporte,
    costoConIva,
    costoAjustadoPorTipo,
    precioEfectivo,
    precioTransferencia,
    precioLista,
    precio6Cuotas,
    precioLicitacion,
    precioPromocion,
    precioFinal: precioPromocion ?? precioLista,
  };
}

// costo / (1 - %) — el margen se calcula sobre el precio de venta, no sobre el costo
// (mismo criterio que toda la planilla original). Un % >= 1 (100%) rompería la cuenta
// (división por cero o negativo) — se acota a un máximo defensivo del 95%.
function divideByRemainingMargin(costo: number, pct: number): number {
  const safePct = Math.min(Math.max(pct, 0), 0.95);
  return costo / (1 - safePct);
}

/**
 * Costo unitario en ARS a cachear en `partsCatalog.costoUnitario` — el campo que ya leen
 * stats.ts (Etapa 6), PartsPicker y los snapshots de PartUsageEntry. Se recalcula cada vez
 * que se guarda el ítem o cambia el dólar manual (ver bulkSyncAction en context.tsx).
 */
export function resolveCostoUnitarioArs(item: PartCatalogItem, dolarUsado: number): number {
  const costoBase = item.costoBase ?? 0;
  return item.moneda === 'USD' ? costoBase * dolarUsado : costoBase;
}
