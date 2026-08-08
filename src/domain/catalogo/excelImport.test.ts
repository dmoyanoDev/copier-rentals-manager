import { describe, it, expect } from 'vitest';
import { detectColumnMapping, parseExcelRow, importCatalogRows } from './excelImport';

// Mismo orden de columnas que la hoja real "PRECIO DE VENTA INSUMOS Y EQUIP" (verificado
// leyendo el archivo directamente) — el resto de columnas derivadas (COSTO USD c/iva, %,
// los precios de venta, etc.) no se usan en la importación, se recalculan con pricing.ts.
const REAL_HEADER = [
  'TIPO', 'PROVEEDOR', 'COD. DEL PRODUCTO', 'MARCA', 'CALIDAD', 'NOMBRE - MODELO', 'IVA',
  'COSTO USD', 'COSTO USD c/iva', 'COSTO s/iva', 'COSTO $ C/IVA', '%', 'CYBER MONDAY',
];

function row(tipo: string, proveedor: string, codigo: string | number | null, marca: string, calidad: string, nombre: string, costoUsd: unknown) {
  return [tipo, proveedor, codigo, marca, calidad, nombre, 1.21, costoUsd, null, null, null, 0.25, 0.15];
}

describe('detectColumnMapping', () => {
  it('encuentra el índice correcto para cada campo conocido', () => {
    const map = detectColumnMapping(REAL_HEADER);
    expect(map.tipo).toBe(0);
    expect(map.proveedor).toBe(1);
    expect(map.codigo).toBe(2);
    expect(map.marca).toBe(3);
    expect(map.calidad).toBe(4);
    expect(map.nombre).toBe(5);
    expect(map.costoUsd).toBe(7);
  });

  it('no confunde "COSTO USD" con "COSTO USD c/iva" (serían un match por substring, no por exacto)', () => {
    const map = detectColumnMapping(REAL_HEADER);
    expect(map.costoUsd).toBe(7); // no 8 (COSTO USD c/iva)
  });

  it('devuelve undefined para un campo cuyo encabezado no aparece', () => {
    const map = detectColumnMapping(['TIPO', 'PROVEEDOR']);
    expect(map.nombre).toBeUndefined();
    expect(map.costoUsd).toBeUndefined();
  });
});

describe('parseExcelRow', () => {
  const columnMap = detectColumnMapping(REAL_HEADER);

  it('parsea una fila real de producto correctamente', () => {
    const r = parseExcelRow(row('MULTIFUNCION MONOCROMATICA', 'STI', 408534, 'RICOH', 'ORIGINAL', 'MULTIFUNCION RICOH M320F', 334), columnMap);
    expect(r).not.toBeNull();
    expect(r!.nombre).toBe('MULTIFUNCION RICOH M320F');
    expect(r!.tipoProducto).toBe('MULTIFUNCION MONOCROMATICA');
    expect(r!.proveedor).toBe('STI');
    expect(r!.codigo).toBe('408534');
    expect(r!.marca).toBe('RICOH');
    expect(r!.subcategoria).toBe('ORIGINAL');
    expect(r!.moneda).toBe('USD');
    expect(r!.costoBase).toBe(334);
    expect(r!.activo).toBe(true);
  });

  it('devuelve null para una fila sin nombre (basura/fila vacía)', () => {
    const r = parseExcelRow(row('', '', null, '', '', '', null), columnMap);
    expect(r).toBeNull();
  });

  it('devuelve null para una fila de encabezado repetida en medio de la hoja', () => {
    const r = parseExcelRow(row('TIPO', 'PROVEEDOR', null, 'MARCA', 'CALIDAD', 'NOMBRE - MODELO', null), columnMap);
    expect(r).toBeNull();
  });

  it('devuelve null para una VARIANTE de fila de encabezado (nombre="MODELO", no matchea los alias de nombre, pero tipo/proveedor sí matchean los suyos) — caso real encontrado en la planilla', () => {
    const r = parseExcelRow(row('TIPO', 'PROVEEDOR', null, 'MARCA', 'CALIDAD', 'MODELO', null), columnMap);
    expect(r).toBeNull();
  });

  it('una fila real cuyo nombre casualmente contuviera la palabra "modelo" (no exacta) sigue importándose', () => {
    const r = parseExcelRow(row('INSUMOS', 'STI', 1, 'RICOH', 'ORIGINAL', 'CILINDRO MODELO NUEVO X200', 100), columnMap);
    expect(r).not.toBeNull();
    expect(r!.nombre).toBe('CILINDRO MODELO NUEVO X200');
  });

  it('normaliza un proveedor basura ("VER PRECIO") a null en vez de guardarlo tal cual', () => {
    const r = parseExcelRow(row('INSUMOS', 'VER PRECIO', 1, 'RICOH', 'ORIGINAL', 'TONER X', 100), columnMap);
    expect(r).not.toBeNull();
    expect(r!.proveedor).toBeNull();
  });

  it('un proveedor en blanco (espacio) también se normaliza a null', () => {
    const r = parseExcelRow(row('INSUMOS', ' ', 1, 'RICOH', 'ORIGINAL', 'TONER X', 100), columnMap);
    expect(r!.proveedor).toBeNull();
  });

  it('un tipo no reconocido en la taxonomía queda null, no se inventa una categoría', () => {
    const r = parseExcelRow(row('CATEGORIA_INEXISTENTE', 'STI', 1, 'RICOH', 'ORIGINAL', 'ALGO RARO', 100), columnMap);
    expect(r).not.toBeNull();
    expect(r!.tipoProducto).toBeNull();
  });

  it('un costo no numérico ("DISCONTINUADA") deja costoBase null y activo false — no se inventa un precio', () => {
    const r = parseExcelRow(row('MULTIFUNCION MONOCROMATICA', 'STI', 416187, 'RICOH', 'ORIGINAL', 'RICOH MP 301SPF', 'DISCONTINUADA'), columnMap);
    expect(r).not.toBeNull();
    expect(r!.costoBase).toBeNull();
    expect(r!.activo).toBe(false);
  });

  it('un costo de 0 o negativo tampoco se considera válido', () => {
    const r = parseExcelRow(row('INSUMOS', 'STI', 1, 'RICOH', 'ORIGINAL', 'ALGO', 0), columnMap);
    expect(r!.costoBase).toBeNull();
    expect(r!.activo).toBe(false);
  });

  it('categoria legado: INSUMOS mapea a Insumo', () => {
    const r = parseExcelRow(row('INSUMOS', 'STI', 1, 'RICOH', 'ORIGINAL', 'TONER X', 100), columnMap);
    expect(r!.categoria).toBe('Insumo');
  });

  it('categoria legado: REPUESTO mapea a Repuesto', () => {
    const r = parseExcelRow(row('REPUESTO', 'STI', 1, 'RICOH', 'ORIGINAL', 'FUSOR X', 100), columnMap);
    expect(r!.categoria).toBe('Repuesto');
  });

  it('categoria legado: un tipo de equipo (no Insumo/Repuesto) cae en Repuesto como default neutro', () => {
    const r = parseExcelRow(row('ESCANER', 'STI', 1, 'RICOH', 'ORIGINAL', 'ESCANER X', 100), columnMap);
    expect(r!.categoria).toBe('Repuesto');
  });
});

describe('importCatalogRows — pipeline completo', () => {
  it('separa filas basura de filas reales y arma el resumen correctamente', () => {
    const rows = [
      row('INSUMOS', 'STI', 1, 'RICOH', 'ORIGINAL', 'TONER A', 100),
      row('', '', null, '', '', '', null), // basura: sin nombre
      row('TIPO', 'PROVEEDOR', null, 'MARCA', 'CALIDAD', 'NOMBRE - MODELO', null), // basura: encabezado repetido
      row('MULTIFUNCION COLOR', 'BBOX', 2, 'RICOH', 'ORIGINAL', 'IMPRESORA B', 500),
      row('TIPO_RARO', 'STI', 3, 'RICOH', 'ORIGINAL', 'ITEM SIN TIPO', 50),
      row('REPUESTO', 'STI', 4, 'RICOH', 'ORIGINAL', 'FUSOR DISCONTINUADO', 'DISCONTINUADA'),
    ];
    const summary = importCatalogRows(rows, REAL_HEADER);

    expect(summary.totalRawRows).toBe(6);
    expect(summary.skippedJunkRows).toBe(2);
    expect(summary.imported).toHaveLength(4);
    expect(summary.sinTipoReconocido).toHaveLength(1);
    expect(summary.sinTipoReconocido[0].nombre).toBe('ITEM SIN TIPO');
    expect(summary.sinCostoValido).toHaveLength(1);
    expect(summary.sinCostoValido[0].nombre).toBe('FUSOR DISCONTINUADO');
  });
});
