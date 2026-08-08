import { TipoProducto, TIPO_PRODUCTO_VALUES } from '@/domain/types';

// Capa de importación/normalización para el Excel de la empresa (hoja "PRECIO DE VENTA
// INSUMOS Y EQUIP" de M&S.xlsx). Funciones puras — no leen el archivo, no escriben a
// Turso, no saben nada de React ni de la UI. El script de siembra (_tmp_import_catalogo.mjs)
// es el único lugar que hace I/O; acá solo vive la lógica de qué significa cada columna y
// qué es una fila real vs. basura.

// Alias conocidos por campo canónico — comparación exacta (trim + uppercase), nunca por
// substring: "COSTO USD" por substring matchearía también "COSTO USD c/iva", que es una
// columna DERIVADA, no el dato de entrada real.
const COLUMN_ALIASES: Record<string, string[]> = {
  tipo: ['TIPO'],
  proveedor: ['PROVEEDOR'],
  codigo: ['COD. DEL PRODUCTO', 'CODIGO', 'CÓDIGO', 'COD PRODUCTO'],
  marca: ['MARCA'],
  calidad: ['CALIDAD'],
  nombre: ['NOMBRE - MODELO', 'NOMBRE-MODELO', 'NOMBRE'],
  costoUsd: ['COSTO USD'],
};

export type ColumnMap = Partial<Record<keyof typeof COLUMN_ALIASES, number>>;

const norm = (s: unknown): string => String(s ?? '').trim().toUpperCase();

/** Busca, para cada campo canónico, el índice de columna cuyo encabezado matchea alguno de sus alias. */
export function detectColumnMapping(headerRow: unknown[]): ColumnMap {
  const map: ColumnMap = {};
  const normalizedHeaders = headerRow.map(norm);
  for (const field of Object.keys(COLUMN_ALIASES) as (keyof typeof COLUMN_ALIASES)[]) {
    const aliases = COLUMN_ALIASES[field];
    const idx = normalizedHeaders.findIndex(h => aliases.includes(h));
    if (idx !== -1) map[field] = idx;
  }
  return map;
}

// Placeholders específicos que no son ecos de encabezado pero tampoco son un proveedor
// real — confirmado leyendo la planilla real.
const PROVEEDOR_PLACEHOLDER_VALUES = new Set(['', 'VER PRECIO']);

/**
 * Detecta una fila de encabezado repetida en medio de la hoja: confirmado en la planilla
 * real que existe MÁS DE UNA variante de fila de encabezado (una dice "NOMBRE - MODELO",
 * otra dice apenas "MODELO" para la misma columna) — comparar solo la celda de nombre
 * contra sus propios alias no alcanza para pescar la segunda variante. En cambio, CADA
 * campo conocido (tipo, proveedor, etc.) sí repite su propio nombre de columna en
 * cualquier fila de encabezado, sea cual sea la variante — así que basta con que UN campo
 * cualquiera matchee su propio alias para descartar toda la fila.
 */
function looksLikeHeaderEcho(rawRow: unknown[], columnMap: ColumnMap): boolean {
  for (const field of Object.keys(COLUMN_ALIASES) as (keyof typeof COLUMN_ALIASES)[]) {
    const idx = columnMap[field];
    if (idx == null) continue;
    const value = norm(rawRow[idx]);
    if (value && COLUMN_ALIASES[field].includes(value)) return true;
  }
  return false;
}

const TIPO_PRODUCTO_SET = new Set<string>(TIPO_PRODUCTO_VALUES);

export interface NormalizedCatalogRow {
  nombre: string;
  tipoProducto: TipoProducto | null;
  categoria: 'Insumo' | 'Repuesto';
  proveedor: string | null;
  codigo: string | null;
  marca: string | null;
  subcategoria: string | null; // CALIDAD (Original/Alternativo/Usada) — no hay un campo dedicado, es el bucket más cercano
  moneda: 'USD';
  costoBase: number | null; // null = costo inválido/faltante en la fuente (ej. "DISCONTINUADA") — no se inventa un número
  activo: boolean; // false cuando el costo de origen no es utilizable — no se puede vender sin costo real
}

/**
 * Convierte una fila cruda (array indexado, mismo orden que headerRow) en un ítem de
 * catálogo normalizado, o null si la fila es basura (sin nombre real, o es una fila de
 * encabezado repetida).
 */
export function parseExcelRow(rawRow: unknown[], columnMap: ColumnMap): NormalizedCatalogRow | null {
  const get = (field: keyof typeof COLUMN_ALIASES): unknown => {
    const idx = columnMap[field];
    return idx != null ? rawRow[idx] : null;
  };

  const nombreRaw = String(get('nombre') ?? '').trim();
  if (!nombreRaw) return null;
  if (looksLikeHeaderEcho(rawRow, columnMap)) return null;

  const tipoRaw = norm(get('tipo'));
  const tipoProducto: TipoProducto | null = TIPO_PRODUCTO_SET.has(tipoRaw) ? (tipoRaw as TipoProducto) : null;

  const proveedorRaw = String(get('proveedor') ?? '').trim();
  const proveedor = proveedorRaw && !PROVEEDOR_PLACEHOLDER_VALUES.has(proveedorRaw.toUpperCase())
    ? proveedorRaw
    : null;

  const codigoRaw = get('codigo');
  const codigo = codigoRaw != null && String(codigoRaw).trim() !== '' ? String(codigoRaw).trim() : null;

  const marcaRaw = String(get('marca') ?? '').trim();
  const marca = marcaRaw || null;

  const calidadRaw = String(get('calidad') ?? '').trim();
  const subcategoria = calidadRaw || null;

  const costoUsdRaw = get('costoUsd');
  const costoUsdNum = typeof costoUsdRaw === 'number' ? costoUsdRaw : Number(costoUsdRaw);
  const costoValido = typeof costoUsdRaw === 'number' && !isNaN(costoUsdNum) && costoUsdNum > 0;

  // Legado: `categoria` (Insumo/Repuesto) es un campo angosto de 2 valores que ya usan
  // Ventas y PartsPicker con su propio significado — no se ensancha. Solo TIPO=INSUMOS
  // mapea a 'Insumo'; todo lo demás (REPUESTO explícito, o cualquier tipo de equipo)
  // entra como 'Repuesto', que es el valor legado más neutro disponible.
  const categoria: 'Insumo' | 'Repuesto' = tipoProducto === 'INSUMOS' ? 'Insumo' : 'Repuesto';

  return {
    nombre: nombreRaw,
    tipoProducto,
    categoria,
    proveedor,
    codigo,
    marca,
    subcategoria,
    moneda: 'USD',
    costoBase: costoValido ? costoUsdNum : null,
    activo: costoValido,
  };
}

export interface ImportSummary {
  totalRawRows: number;
  imported: NormalizedCatalogRow[];
  skippedJunkRows: number;
  sinTipoReconocido: NormalizedCatalogRow[];
  sinCostoValido: NormalizedCatalogRow[];
}

/** Procesa todas las filas crudas de la hoja y devuelve el resultado + un resumen para revisar antes de escribir. */
export function importCatalogRows(rawRows: unknown[][], headerRow: unknown[]): ImportSummary {
  const columnMap = detectColumnMapping(headerRow);
  const imported: NormalizedCatalogRow[] = [];
  let skippedJunkRows = 0;

  for (const raw of rawRows) {
    const parsed = parseExcelRow(raw, columnMap);
    if (!parsed) { skippedJunkRows++; continue; }
    imported.push(parsed);
  }

  return {
    totalRawRows: rawRows.length,
    imported,
    skippedJunkRows,
    sinTipoReconocido: imported.filter(r => r.tipoProducto === null),
    sinCostoValido: imported.filter(r => !r.activo),
  };
}
