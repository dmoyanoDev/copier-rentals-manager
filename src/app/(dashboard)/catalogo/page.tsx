'use client';

import React, { useState, useMemo } from 'react';
import { useManagement } from '@/lib/context';
import { Card, CardContent } from '@/components/ui/card';
import { TableContainer, Table, TableHeader, TableRow, TableHeaderCell, TableBody, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Modal } from '@/components/ui/modal';
import { Badge } from '@/components/ui/badge';
import { PartCatalogItem, PricingSetting, TipoProducto, TIPO_PRODUCTO_VALUES } from '@/domain/types';
import { formatCurrency } from '@/lib/utils';
import { resolvePricingConfig, calculateCatalogItemPrices } from '@/domain/catalogo/pricing';
import { Plus, Edit, Trash2, RefreshCw, DollarSign, Settings, Tag, ChevronDown, ChevronRight } from 'lucide-react';

// Los 7 % configurables + la activación de promociones — un solo lugar para no repetir
// la lista 3 veces (global/categoría/unidad).
const PCT_FIELDS: { key: keyof PricingFieldsDraft; label: string }[] = [
    { key: 'transportePct', label: '% Transporte' },
    { key: 'precioListaPct', label: '% Precio de Lista' },
    { key: 'precioEfectivoPct', label: '% Precio en Efectivo' },
    { key: 'licitacionesPct', label: '% Licitaciones' },
    { key: 'insumosRepuestosPct', label: '% Insumos y Repuestos' },
    { key: 'equiposPct', label: '% Equipos' },
    { key: 'promocionesPct', label: '% Promociones' },
];

// Los campos numéricos se editan como STRING de porcentaje ("5" = 5%) — se convierten a
// fracción (0.05) recién al guardar. '' = heredar del nivel siguiente (solo válido en
// categoría/unidad, no en global).
interface PricingFieldsDraft {
    transportePct: string;
    precioListaPct: string;
    precioEfectivoPct: string;
    licitacionesPct: string;
    insumosRepuestosPct: string;
    equiposPct: string;
    promocionesPct: string;
    promocionesActiva: boolean;
}

const emptyDraft = (): PricingFieldsDraft => ({
    transportePct: '', precioListaPct: '', precioEfectivoPct: '', licitacionesPct: '',
    insumosRepuestosPct: '', equiposPct: '', promocionesPct: '', promocionesActiva: false,
});

const settingToDraft = (s: PricingSetting | undefined): PricingFieldsDraft => ({
    transportePct: s?.transportePct != null ? String(s.transportePct * 100) : '',
    precioListaPct: s?.precioListaPct != null ? String(s.precioListaPct * 100) : '',
    precioEfectivoPct: s?.precioEfectivoPct != null ? String(s.precioEfectivoPct * 100) : '',
    licitacionesPct: s?.licitacionesPct != null ? String(s.licitacionesPct * 100) : '',
    insumosRepuestosPct: s?.insumosRepuestosPct != null ? String(s.insumosRepuestosPct * 100) : '',
    equiposPct: s?.equiposPct != null ? String(s.equiposPct * 100) : '',
    promocionesPct: s?.promocionesPct != null ? String(s.promocionesPct * 100) : '',
    promocionesActiva: s?.promocionesActiva ?? false,
});

// undefined = campo no tocado (hereda) — solo se usa para categoría/unidad, donde un
// campo vacío significa "no sobrescribir esto". Para global, un campo vacío se manda
// como 0 (la fila global siempre debe quedar completa).
const draftToPartial = (d: PricingFieldsDraft, forceComplete: boolean) => {
    const pct = (v: string) => {
        if (v.trim() === '') return forceComplete ? 0 : null;
        const n = Number(v) / 100;
        return isNaN(n) ? (forceComplete ? 0 : null) : n;
    };
    return {
        transportePct: pct(d.transportePct),
        precioListaPct: pct(d.precioListaPct),
        precioEfectivoPct: pct(d.precioEfectivoPct),
        licitacionesPct: pct(d.licitacionesPct),
        insumosRepuestosPct: pct(d.insumosRepuestosPct),
        equiposPct: pct(d.equiposPct),
        promocionesPct: pct(d.promocionesPct),
        promocionesActiva: d.promocionesActiva,
    };
};

function PricingFieldsEditor({ draft, onChange, helperText }: { draft: PricingFieldsDraft; onChange: (d: PricingFieldsDraft) => void; helperText?: string }) {
    return (
        <div className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                {PCT_FIELDS.map(f => (
                    <div key={f.key} className="space-y-1">
                        <label className="text-[9px] uppercase font-bold text-slate-500 block tracking-wider">{f.label}</label>
                        <div className="relative">
                            <input
                                type="number"
                                step="0.01"
                                value={draft[f.key] as string}
                                onChange={(e) => onChange({ ...draft, [f.key]: e.target.value })}
                                placeholder={helperText ? '(heredar)' : '0'}
                                className="w-full px-2 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-xs font-mono-tabular focus:outline-none focus:ring-1 focus:ring-indigo-500 pr-5"
                            />
                            <span className="absolute right-2 top-1.5 text-[10px] text-slate-500">%</span>
                        </div>
                    </div>
                ))}
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                    type="checkbox"
                    checked={draft.promocionesActiva}
                    onChange={(e) => onChange({ ...draft, promocionesActiva: e.target.checked })}
                    className="rounded border-slate-700"
                />
                Promociones activas
            </label>
            {helperText && <p className="text-[10px] text-slate-500">{helperText}</p>}
        </div>
    );
}

export default function CatalogoPage() {
    const {
        partsCatalog, addPartCatalogItemAction, bulkUpdatePartsCatalogAction, dollarSettings, updateDollarSettingsAction,
        pricingSettings, addPricingSettingAction,
    } = useManagement();

    // Panel de cotización de dólar (Etapa 3)
    const [manualRateInput, setManualRateInput] = useState(String(dollarSettings.manualStockRate || ''));
    const [isFetchingDolar, setIsFetchingDolar] = useState(false);
    const manualRateDirty = manualRateInput.trim() !== '' && Number(manualRateInput) !== dollarSettings.manualStockRate;

    React.useEffect(() => {
        if (!manualRateDirty) setManualRateInput(String(dollarSettings.manualStockRate || ''));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dollarSettings.manualStockRate]);

    const handleRefreshDolar = async () => {
        setIsFetchingDolar(true);
        try { await fetch('/api/dolar'); } catch (e) { /* dollarSettings.lastFetchStatus refleja el estado real en el próximo poll */ }
        finally { setIsFetchingDolar(false); }
    };

    const handleSaveManualRate = () => {
        const rate = Number(manualRateInput);
        if (!manualRateInput.trim() || isNaN(rate) || rate <= 0) {
            alert('Ingresá un dólar manual válido (mayor a 0).');
            return;
        }
        updateDollarSettingsAction({ ...dollarSettings, manualStockRate: rate });

        // costoUnitario es un caché en ARS — todo ítem con costoBase en USD queda desactualizado
        // en cuanto cambia el dólar manual, así que se recalcula en cascada acá mismo (no hace
        // falta editar ítem por ítem para que stats.ts/PartsPicker vean el costo correcto).
        const affected = partsCatalog.filter(c => c.moneda === 'USD' && c.costoBase != null);
        if (affected.length > 0) {
            bulkUpdatePartsCatalogAction(affected.map(c => ({ ...c, costoUnitario: (c.costoBase as number) * rate })));
            alert(`Dólar para stock actualizado a $${rate.toLocaleString('es-AR')}. Se recalculó el costo de ${affected.length} ítem${affected.length === 1 ? '' : 's'} en USD.`);
        }
    };

    const fmtRate = (n: number | null | undefined) => n != null ? n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—';

    // --- Panel de parámetros globales ---
    const globalSetting = pricingSettings.find(p => p.scope === 'global');
    const [showParamsPanel, setShowParamsPanel] = useState(false);
    const [paramsDraft, setParamsDraft] = useState<PricingFieldsDraft | null>(null);
    const activeParamsDraft = paramsDraft ?? settingToDraft(globalSetting);

    const handleSaveGlobalParams = () => {
        const partial = draftToPartial(activeParamsDraft, true);
        addPricingSettingAction({
            id: 'pricing-global',
            scope: 'global',
            scopeKey: null,
            ...partial,
        } as PricingSetting, globalSetting ? 'update' : 'create');
        setParamsDraft(null);
        alert('Parámetros globales guardados.');
    };

    // --- Overrides por categoría (tipoProducto) ---
    const [showCategoriaOverrides, setShowCategoriaOverrides] = useState(false);
    const [selectedCategoria, setSelectedCategoria] = useState<TipoProducto | ''>('');
    const [categoriaDraft, setCategoriaDraft] = useState<PricingFieldsDraft | null>(null);

    const categoriaOverrideId = (tipo: TipoProducto) => `pricing-categoria-${tipo}`;
    const existingCategoriaOverride = selectedCategoria
        ? pricingSettings.find(p => p.scope === 'categoria' && p.scopeKey === selectedCategoria)
        : undefined;
    const activeCategoriaDraft = categoriaDraft ?? settingToDraft(existingCategoriaOverride);

    const handleSelectCategoria = (tipo: string) => {
        setSelectedCategoria(tipo as TipoProducto | '');
        setCategoriaDraft(null);
    };

    const handleSaveCategoriaOverride = () => {
        if (!selectedCategoria) return;
        const partial = draftToPartial(activeCategoriaDraft, false);
        addPricingSettingAction({
            id: categoriaOverrideId(selectedCategoria),
            scope: 'categoria',
            scopeKey: selectedCategoria,
            ...partial,
        } as PricingSetting, existingCategoriaOverride ? 'update' : 'create');
        setCategoriaDraft(null);
        alert(`Override guardado para "${selectedCategoria}".`);
    };

    const handleClearCategoriaOverride = () => {
        if (!selectedCategoria || !existingCategoriaOverride) return;
        if (!confirm(`¿Borrar el override de "${selectedCategoria}"? Vuelve a heredar de global.`)) return;
        addPricingSettingAction(existingCategoriaOverride, 'delete');
        setCategoriaDraft(null);
    };

    // --- Formulario de ítem (extendido) ---
    const [isCatalogFormOpen, setIsCatalogFormOpen] = useState(false);
    const [editingCatalogItem, setEditingCatalogItem] = useState<PartCatalogItem | null>(null);
    const [catalogNombre, setCatalogNombre] = useState('');
    const [catalogCategoria, setCatalogCategoria] = useState<'Insumo' | 'Repuesto'>('Insumo');
    const [catalogUnidad, setCatalogUnidad] = useState('Unidad');
    const [catalogCosto, setCatalogCosto] = useState('0');
    const [catalogStockActual, setCatalogStockActual] = useState('0');
    const [catalogStockMinimo, setCatalogStockMinimo] = useState('0');
    const [catalogRendimiento, setCatalogRendimiento] = useState('');
    const [catalogCodigo, setCatalogCodigo] = useState('');
    const [catalogDescripcion, setCatalogDescripcion] = useState('');
    const [catalogTipoProducto, setCatalogTipoProducto] = useState<TipoProducto | ''>('');
    const [catalogSubcategoria, setCatalogSubcategoria] = useState('');
    const [catalogMarca, setCatalogMarca] = useState('');
    const [catalogModelo, setCatalogModelo] = useState('');
    const [catalogProveedor, setCatalogProveedor] = useState('');
    const [catalogMoneda, setCatalogMoneda] = useState<'ARS' | 'USD'>('ARS');
    const [catalogCostoBase, setCatalogCostoBase] = useState('');
    const [unidadDraft, setUnidadDraft] = useState<PricingFieldsDraft | null>(null);

    const existingUnidadOverride = editingCatalogItem
        ? pricingSettings.find(p => p.scope === 'unidad' && p.scopeKey === editingCatalogItem.id)
        : undefined;
    const activeUnidadDraft = unidadDraft ?? settingToDraft(existingUnidadOverride);

    const [searchCatalogQuery, setSearchCatalogQuery] = useState('');
    const [filterTipoProducto, setFilterTipoProducto] = useState('');
    const [filterCategoria, setFilterCategoria] = useState('');
    const [filterActivo, setFilterActivo] = useState('');
    const [filterUnidad, setFilterUnidad] = useState('');

    // --- Selección múltiple + acciones en lote (Etapa 6) ---
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const toggleSelectOne = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const toggleSelectAllFiltered = () => {
        setSelectedIds(prev => {
            const allSelected = filteredCatalog.length > 0 && filteredCatalog.every(c => prev.has(c.id));
            const next = new Set(prev);
            filteredCatalog.forEach(c => allSelected ? next.delete(c.id) : next.add(c.id));
            return next;
        });
    };

    const handleBulkSetActive = (active: boolean) => {
        const targets = partsCatalog.filter(c => selectedIds.has(c.id));
        if (targets.length === 0) return;
        bulkUpdatePartsCatalogAction(targets.map(c => ({ ...c, activo: active })));
        setSelectedIds(new Set());
    };

    const handleOpenCreateCatalogItem = () => {
        setEditingCatalogItem(null);
        setCatalogNombre('');
        setCatalogCategoria('Insumo');
        setCatalogUnidad('Unidad');
        setCatalogCosto('0');
        setCatalogStockActual('0');
        setCatalogStockMinimo('0');
        setCatalogRendimiento('');
        setCatalogCodigo('');
        setCatalogDescripcion('');
        setCatalogTipoProducto('');
        setCatalogSubcategoria('');
        setCatalogMarca('');
        setCatalogModelo('');
        setCatalogProveedor('');
        setCatalogMoneda('ARS');
        setCatalogCostoBase('');
        setUnidadDraft(null);
        setIsCatalogFormOpen(true);
    };

    const handleOpenEditCatalogItem = (item: PartCatalogItem) => {
        setEditingCatalogItem(item);
        setCatalogNombre(item.nombre);
        setCatalogCategoria(item.categoria);
        setCatalogUnidad(item.unidad);
        setCatalogCosto(String(item.costoUnitario));
        setCatalogStockActual(String(item.stockActual));
        setCatalogStockMinimo(String(item.stockMinimo));
        setCatalogRendimiento(item.rendimientoCopias != null ? String(item.rendimientoCopias) : '');
        setCatalogCodigo(item.codigo || '');
        setCatalogDescripcion(item.descripcion || '');
        setCatalogTipoProducto(item.tipoProducto || '');
        setCatalogSubcategoria(item.subcategoria || '');
        setCatalogMarca(item.marca || '');
        setCatalogModelo(item.modelo || '');
        setCatalogProveedor(item.proveedor || '');
        setCatalogMoneda((item.moneda as 'ARS' | 'USD') || 'ARS');
        setCatalogCostoBase(item.costoBase != null ? String(item.costoBase) : '');
        setUnidadDraft(null);
        setIsCatalogFormOpen(true);
    };

    const handleSaveCatalogItem = () => {
        if (!catalogNombre.trim()) {
            alert('El nombre del ítem es obligatorio.');
            return;
        }
        const itemId = editingCatalogItem?.id || `part-${crypto.randomUUID()}`;
        const costoBaseNum = catalogCostoBase.trim() === '' ? null : Number(catalogCostoBase);
        // costoUnitario (el campo que ya leen stats.ts/PartsPicker) se recalcula como
        // caché en ARS a partir de costoBase+moneda+dólar manual, si hay costoBase
        // cargado — si no, se respeta lo que el usuario haya puesto a mano (compatibilidad
        // con ítems viejos que nunca tuvieron costoBase).
        const costoUnitario = costoBaseNum != null
            ? (catalogMoneda === 'USD' ? costoBaseNum * (dollarSettings.manualStockRate || 0) : costoBaseNum)
            : (Number(catalogCosto) || 0);

        const item: PartCatalogItem = {
            id: itemId,
            nombre: catalogNombre.trim(),
            categoria: catalogCategoria,
            unidad: catalogUnidad.trim() || 'Unidad',
            costoUnitario,
            stockActual: Number(catalogStockActual) || 0,
            stockMinimo: Number(catalogStockMinimo) || 0,
            rendimientoCopias: catalogRendimiento.trim() === '' ? null : (parseInt(catalogRendimiento, 10) || 0),
            activo: editingCatalogItem?.activo ?? true,
            createdAt: editingCatalogItem?.createdAt,
            codigo: catalogCodigo.trim() || null,
            descripcion: catalogDescripcion.trim() || null,
            tipoProducto: catalogTipoProducto || null,
            subcategoria: catalogSubcategoria.trim() || null,
            marca: catalogMarca.trim() || null,
            modelo: catalogModelo.trim() || null,
            proveedor: catalogProveedor.trim() || null,
            moneda: catalogMoneda,
            costoBase: costoBaseNum,
        };
        addPartCatalogItemAction(item, editingCatalogItem ? 'update' : 'create');

        // Override a nivel unidad — solo tiene sentido editando (ya hay un id estable).
        if (editingCatalogItem) {
            const hasAnyValue = Object.entries(activeUnidadDraft).some(([k, v]) => k === 'promocionesActiva' ? false : v !== '');
            const partial = draftToPartial(activeUnidadDraft, false);
            if (hasAnyValue || activeUnidadDraft.promocionesActiva) {
                addPricingSettingAction({
                    id: `pricing-unidad-${itemId}`,
                    scope: 'unidad',
                    scopeKey: itemId,
                    ...partial,
                } as PricingSetting, existingUnidadOverride ? 'update' : 'create');
            } else if (existingUnidadOverride) {
                addPricingSettingAction(existingUnidadOverride, 'delete');
            }
        }

        setIsCatalogFormOpen(false);
    };

    const handleToggleCatalogActive = (item: PartCatalogItem) => {
        addPartCatalogItemAction({ ...item, activo: item.activo === false }, 'update');
    };

    const handleDeleteCatalogItem = (item: PartCatalogItem) => {
        if (!confirm(`¿Eliminar "${item.nombre}" del catálogo? Los tickets que ya lo usaron conservan su registro.`)) return;
        addPartCatalogItemAction(item, 'delete');
        const ov = pricingSettings.find(p => p.scope === 'unidad' && p.scopeKey === item.id);
        if (ov) addPricingSettingAction(ov, 'delete');
    };

    const unidadOptions = useMemo(() => {
        const set = new Set(partsCatalog.map(c => c.unidad).filter(Boolean));
        return [...set].sort();
    }, [partsCatalog]);

    const filteredCatalog = useMemo(() => {
        const q = searchCatalogQuery.toLowerCase();
        return partsCatalog.filter(c => {
            const matchesSearch = !q ||
                c.nombre.toLowerCase().includes(q) ||
                (c.codigo || '').toLowerCase().includes(q) ||
                (c.marca || '').toLowerCase().includes(q) ||
                (c.descripcion || '').toLowerCase().includes(q);
            const matchesTipo = !filterTipoProducto || c.tipoProducto === filterTipoProducto;
            const matchesCategoria = !filterCategoria || c.categoria === filterCategoria;
            const matchesUnidad = !filterUnidad || c.unidad === filterUnidad;
            const matchesActivo = !filterActivo || (filterActivo === 'activo' ? c.activo !== false : c.activo === false);
            return matchesSearch && matchesTipo && matchesCategoria && matchesUnidad && matchesActivo;
        });
    }, [partsCatalog, searchCatalogQuery, filterTipoProducto, filterCategoria, filterUnidad, filterActivo]);

    // Precios calculados por ítem (solo para los que tienen costoBase real — sin eso no
    // hay nada que calcular, se muestra "s/d" en vez de un $0 engañoso).
    const computedByItem = useMemo(() => {
        const map = new Map<string, ReturnType<typeof calculateCatalogItemPrices> & { origenPromocion: string | null }>();
        const dolarUsado = dollarSettings.manualStockRate || 0;
        for (const item of filteredCatalog) {
            if (item.costoBase == null) continue;
            // Un ítem en USD sin dólar manual configurado no tiene nada real que calcular
            // todavía — mostrar "$0,00" sería engañoso (parece un precio real, no lo es).
            if (item.moneda === 'USD' && dolarUsado <= 0) continue;
            const resolved = resolvePricingConfig(item, pricingSettings);
            const prices = calculateCatalogItemPrices(item, resolved, dolarUsado);
            map.set(item.id, { ...prices, origenPromocion: prices.precioPromocion != null ? resolved.promocionesPct.source : null });
        }
        return map;
    }, [filteredCatalog, pricingSettings, dollarSettings.manualStockRate]);

    const origenLabel: Record<string, string> = { global: 'Global', categoria: 'Categoría', unidad: 'Unidad' };

    return (
        <div className="space-y-6 animate-fade-in relative text-slate-100">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 border-b border-slate-850 pb-4">
                <div>
                    <h2 className="text-base font-semibold text-slate-100 uppercase tracking-wider">Catálogo / Stock</h2>
                    <p className="text-[10px] text-slate-400">Insumos, repuestos y equipos — precios calculados con parámetros configurables en 3 niveles (global, categoría, unidad).</p>
                </div>
            </div>

            {/* Panel de cotización de dólar */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Card className="border-slate-850">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <span className="text-[10px] uppercase font-bold text-slate-500 block tracking-wider">Dólar Oficial (venta)</span>
                            <span className="text-lg font-extrabold text-slate-200 font-mono-tabular">$ {fmtRate(dollarSettings.lastOficialVenta)}</span>
                        </div>
                        <DollarSign size={20} className="text-slate-600" />
                    </CardContent>
                </Card>
                <Card className="border-slate-850">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <span className="text-[10px] uppercase font-bold text-slate-500 block tracking-wider">Dólar Blue (venta)</span>
                            <span className="text-lg font-extrabold text-slate-200 font-mono-tabular">$ {fmtRate(dollarSettings.lastBlueVenta)}</span>
                        </div>
                        <DollarSign size={20} className="text-slate-600" />
                    </CardContent>
                </Card>
                <Card className="border-emerald-650/30 bg-emerald-950/10">
                    <CardContent className="p-4">
                        <span className="text-[10px] uppercase font-bold text-emerald-500 block tracking-wider mb-1.5">Dólar para Stock (manual)</span>
                        <div className="flex items-center gap-2">
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={manualRateInput}
                                onChange={(e) => setManualRateInput(e.target.value)}
                                placeholder="0.00"
                                className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-sm font-mono-tabular focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            />
                            {manualRateDirty && (
                                <Button variant="primary" size="sm" onClick={handleSaveManualRate}>Guardar</Button>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
            <div className="flex items-center justify-between -mt-3">
                <button
                    onClick={handleRefreshDolar}
                    disabled={isFetchingDolar}
                    className="flex items-center gap-1.5 text-[10px] text-slate-500 hover:text-slate-300 disabled:opacity-50"
                >
                    <RefreshCw size={11} className={isFetchingDolar ? 'animate-spin' : ''} />
                    {isFetchingDolar ? 'Actualizando cotización...' : 'Actualizar cotización de referencia'}
                </button>
                <span className="text-[10px] text-slate-550">
                    {dollarSettings.lastFetchStatus === 'error'
                        ? <span className="text-amber-500">Sin actualización — no se pudo consultar la cotización</span>
                        : dollarSettings.lastFetchedAt
                            ? `Última consulta: ${new Date(dollarSettings.lastFetchedAt).toLocaleString('es-AR')}`
                            : 'Todavía no se consultó la cotización de referencia'}
                </span>
            </div>

            {(!dollarSettings.manualStockRate || dollarSettings.manualStockRate <= 0) && (
                <div className="px-4 py-2.5 bg-amber-950/20 border border-amber-900/30 rounded-xl text-[11px] text-amber-400">
                    Falta configurar el <strong>dólar para stock</strong> (arriba) — los ítems con costo en USD no muestran precios calculados hasta que lo cargues.
                </div>
            )}

            {/* Panel de parámetros globales */}
            <Card className="border-slate-850">
                <button
                    onClick={() => setShowParamsPanel(v => !v)}
                    className="w-full p-4 flex items-center justify-between text-left"
                >
                    <div className="flex items-center gap-2">
                        <Settings size={15} className="text-indigo-400" />
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-200">Parámetros de Cálculo (Global)</span>
                    </div>
                    {showParamsPanel ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />}
                </button>
                {showParamsPanel && (
                    <CardContent className="pt-0 pb-4 space-y-3">
                        <PricingFieldsEditor draft={activeParamsDraft} onChange={setParamsDraft} />
                        <Button variant="primary" size="sm" onClick={handleSaveGlobalParams}>Guardar Parámetros Globales</Button>
                    </CardContent>
                )}
            </Card>

            {/* Overrides por categoría */}
            <Card className="border-slate-850">
                <button
                    onClick={() => setShowCategoriaOverrides(v => !v)}
                    className="w-full p-4 flex items-center justify-between text-left"
                >
                    <div className="flex items-center gap-2">
                        <Tag size={15} className="text-indigo-400" />
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-200">Overrides por Categoría</span>
                    </div>
                    {showCategoriaOverrides ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />}
                </button>
                {showCategoriaOverrides && (
                    <CardContent className="pt-0 pb-4 space-y-3">
                        <Select
                            label="Categoría a configurar"
                            value={selectedCategoria}
                            onChange={(e) => handleSelectCategoria(e.target.value)}
                            options={[{ value: '', label: '-- Seleccionar categoría --' }, ...TIPO_PRODUCTO_VALUES.map(t => ({ value: t, label: t }))]}
                        />
                        {selectedCategoria && (
                            <>
                                <PricingFieldsEditor
                                    draft={activeCategoriaDraft}
                                    onChange={setCategoriaDraft}
                                    helperText="Un campo vacío hereda el valor global — no hace falta completar todos."
                                />
                                <div className="flex gap-2">
                                    <Button variant="primary" size="sm" onClick={handleSaveCategoriaOverride}>Guardar Override</Button>
                                    {existingCategoriaOverride && (
                                        <Button variant="ghost" size="sm" onClick={handleClearCategoriaOverride}>Borrar Override</Button>
                                    )}
                                </div>
                            </>
                        )}
                    </CardContent>
                )}
            </Card>

            {/* Filtros */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                <div className="md:col-span-2">
                    <Input
                        placeholder="Buscar por nombre, código, marca o descripción..."
                        value={searchCatalogQuery}
                        onChange={(e) => setSearchCatalogQuery(e.target.value)}
                    />
                </div>
                <Select
                    value={filterTipoProducto}
                    onChange={(e) => setFilterTipoProducto(e.target.value)}
                    options={[{ value: '', label: 'Categoría: Todas' }, ...TIPO_PRODUCTO_VALUES.map(t => ({ value: t, label: t }))]}
                />
                <Select
                    value={filterCategoria}
                    onChange={(e) => setFilterCategoria(e.target.value)}
                    options={[{ value: '', label: 'Tipo: Todos' }, { value: 'Insumo', label: 'Insumo' }, { value: 'Repuesto', label: 'Repuesto' }]}
                />
                <Select
                    value={filterActivo}
                    onChange={(e) => setFilterActivo(e.target.value)}
                    options={[{ value: '', label: 'Estado: Todos' }, { value: 'activo', label: 'Solo Activos' }, { value: 'inactivo', label: 'Solo Inactivos' }]}
                />
            </div>
            <div className="flex flex-col md:flex-row justify-between gap-3">
                <div className="w-full md:w-56">
                    <Select
                        value={filterUnidad}
                        onChange={(e) => setFilterUnidad(e.target.value)}
                        options={[{ value: '', label: 'Unidad: Todas' }, ...unidadOptions.map(u => ({ value: u, label: u }))]}
                    />
                </div>
                <Button variant="primary" size="sm" onClick={handleOpenCreateCatalogItem}>
                    <Plus size={14} className="mr-1" /> Nuevo Ítem
                </Button>
            </div>

            {selectedIds.size > 0 && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 bg-indigo-950/20 border border-indigo-900/30 rounded-xl">
                    <span className="text-[11px] text-indigo-300 font-semibold">{selectedIds.size} seleccionado{selectedIds.size === 1 ? '' : 's'}</span>
                    <Button variant="secondary" size="sm" onClick={() => handleBulkSetActive(true)}>Activar</Button>
                    <Button variant="secondary" size="sm" onClick={() => handleBulkSetActive(false)}>Desactivar</Button>
                    <button onClick={() => setSelectedIds(new Set())} className="text-[11px] text-slate-500 hover:text-slate-300 ml-auto cursor-pointer">
                        Cancelar selección
                    </button>
                </div>
            )}

            <Card>
                <CardContent className="p-0">
                    <TableContainer>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHeaderCell className="w-8">
                                        <input
                                            type="checkbox"
                                            className="rounded border-slate-700"
                                            checked={filteredCatalog.length > 0 && filteredCatalog.every(c => selectedIds.has(c.id))}
                                            onChange={toggleSelectAllFiltered}
                                        />
                                    </TableHeaderCell>
                                    <TableHeaderCell>Nombre</TableHeaderCell>
                                    <TableHeaderCell>Categoría</TableHeaderCell>
                                    <TableHeaderCell>Marca</TableHeaderCell>
                                    <TableHeaderCell>Costo</TableHeaderCell>
                                    <TableHeaderCell>Precio Lista</TableHeaderCell>
                                    <TableHeaderCell>Precio Final</TableHeaderCell>
                                    <TableHeaderCell>Stock</TableHeaderCell>
                                    <TableHeaderCell>Estado</TableHeaderCell>
                                    <TableHeaderCell>Acciones</TableHeaderCell>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredCatalog.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={10} className="text-center text-slate-500 py-6">
                                            {partsCatalog.length === 0
                                                ? 'Todavía no cargaste insumos ni repuestos. Usá "Nuevo Ítem" para empezar.'
                                                : 'Sin resultados para la búsqueda/filtros.'}
                                        </TableCell>
                                    </TableRow>
                                )}
                                {filteredCatalog.map(item => {
                                    const lowStock = item.stockActual <= item.stockMinimo;
                                    const computed = computedByItem.get(item.id);
                                    return (
                                        <TableRow key={item.id}>
                                            <TableCell>
                                                <input
                                                    type="checkbox"
                                                    className="rounded border-slate-700"
                                                    checked={selectedIds.has(item.id)}
                                                    onChange={() => toggleSelectOne(item.id)}
                                                />
                                            </TableCell>
                                            <TableCell className="font-semibold text-slate-100">
                                                {item.nombre}
                                                {item.codigo && <span className="block text-[10px] text-slate-500 font-mono-tabular">Cód: {item.codigo}</span>}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col gap-1">
                                                    {item.tipoProducto && <Badge variant="info" className="text-[9px] w-fit">{item.tipoProducto}</Badge>}
                                                    <Badge variant={item.categoria === 'Repuesto' ? 'secondary' : 'success'} className="text-[9px] w-fit">{item.categoria}</Badge>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-xs text-slate-300">{item.marca || '—'}</TableCell>
                                            <TableCell className="text-xs">
                                                {item.costoBase != null
                                                    ? formatCurrency(item.costoBase, item.moneda === 'USD' ? 'USD' : 'ARS')
                                                    : formatCurrency(item.costoUnitario)}
                                            </TableCell>
                                            <TableCell className="text-xs">{computed ? formatCurrency(computed.precioLista) : <span className="text-slate-500 italic">s/d</span>}</TableCell>
                                            <TableCell className="text-xs">
                                                {computed ? (
                                                    <div className="flex flex-col gap-0.5">
                                                        <span className={computed.precioPromocion != null ? 'font-bold text-emerald-400' : 'text-slate-200'}>
                                                            {formatCurrency(computed.precioFinal)}
                                                        </span>
                                                        {computed.origenPromocion && (
                                                            <Badge variant="success" className="text-[8px] w-fit">Promo · {origenLabel[computed.origenPromocion]}</Badge>
                                                        )}
                                                    </div>
                                                ) : <span className="text-slate-500 italic">s/d</span>}
                                            </TableCell>
                                            <TableCell>
                                                <span className={lowStock ? 'text-red-400 font-bold' : 'text-slate-300'}>
                                                    {item.stockActual}
                                                </span>
                                                <span className="text-slate-500"> / mín. {item.stockMinimo}</span>
                                                {lowStock && <Badge variant="danger" className="ml-2">Stock Bajo</Badge>}
                                            </TableCell>
                                            <TableCell>
                                                <button onClick={() => handleToggleCatalogActive(item)} className="cursor-pointer">
                                                    <Badge variant={item.activo === false ? 'secondary' : 'success'}>
                                                        {item.activo === false ? 'Inactivo' : 'Activo'}
                                                    </Badge>
                                                </button>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex gap-2">
                                                    <button onClick={() => handleOpenEditCatalogItem(item)} className="text-slate-400 hover:text-slate-100 cursor-pointer">
                                                        <Edit size={14} />
                                                    </button>
                                                    <button onClick={() => handleDeleteCatalogItem(item)} className="text-slate-400 hover:text-red-400 cursor-pointer">
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </CardContent>
            </Card>

            {isCatalogFormOpen && (
                <Modal
                    isOpen={isCatalogFormOpen}
                    onClose={() => setIsCatalogFormOpen(false)}
                    title={editingCatalogItem ? 'Editar Ítem del Catálogo' : 'Nuevo Ítem del Catálogo'}
                    footer={
                        <>
                            <Button variant="ghost" size="sm" onClick={() => setIsCatalogFormOpen(false)}>Cancelar</Button>
                            <Button variant="primary" size="sm" onClick={handleSaveCatalogItem}>Guardar</Button>
                        </>
                    }
                >
                    <div className="space-y-3">
                        <Input
                            label="Nombre *"
                            value={catalogNombre}
                            onChange={(e) => setCatalogNombre(e.target.value)}
                            placeholder="Ej: Tóner HP 26A"
                        />
                        <div className="grid grid-cols-2 gap-3">
                            <Input label="Código" value={catalogCodigo} onChange={(e) => setCatalogCodigo(e.target.value)} placeholder="Opcional" />
                            <Input label="Marca" value={catalogMarca} onChange={(e) => setCatalogMarca(e.target.value)} placeholder="Opcional" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <Input label="Modelo" value={catalogModelo} onChange={(e) => setCatalogModelo(e.target.value)} placeholder="Opcional" />
                            <Input label="Proveedor" value={catalogProveedor} onChange={(e) => setCatalogProveedor(e.target.value)} placeholder="Opcional" />
                        </div>
                        <Input label="Descripción" value={catalogDescripcion} onChange={(e) => setCatalogDescripcion(e.target.value)} placeholder="Opcional" />

                        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-850">
                            <Select
                                label="Categoría (legado, usa Ventas/Tickets)"
                                value={catalogCategoria}
                                onChange={(e) => setCatalogCategoria(e.target.value as 'Insumo' | 'Repuesto')}
                                options={[{ value: 'Insumo', label: 'Insumo' }, { value: 'Repuesto', label: 'Repuesto' }]}
                            />
                            <Select
                                label="Tipo de Producto"
                                value={catalogTipoProducto}
                                onChange={(e) => setCatalogTipoProducto(e.target.value as TipoProducto | '')}
                                options={[{ value: '', label: '-- Sin clasificar --' }, ...TIPO_PRODUCTO_VALUES.map(t => ({ value: t, label: t }))]}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <Input label="Unidad" value={catalogUnidad} onChange={(e) => setCatalogUnidad(e.target.value)} placeholder="Unidad, Litro, Kit..." />
                            <Input label="Subcategoría / Calidad" value={catalogSubcategoria} onChange={(e) => setCatalogSubcategoria(e.target.value)} placeholder="Original, Alternativo, Usada..." />
                        </div>

                        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-850">
                            <Select
                                label="Moneda del Costo"
                                value={catalogMoneda}
                                onChange={(e) => setCatalogMoneda(e.target.value as 'ARS' | 'USD')}
                                options={[{ value: 'ARS', label: 'ARS' }, { value: 'USD', label: 'USD' }]}
                            />
                            <Input
                                label={`Costo Base (${catalogMoneda})`}
                                type="number" min="0" step="0.01"
                                value={catalogCostoBase}
                                onChange={(e) => setCatalogCostoBase(e.target.value)}
                                placeholder="Opcional — alimenta el cálculo de precios"
                            />
                        </div>
                        {catalogCostoBase.trim() === '' && (
                            <Input
                                label="Costo Unitario ($, manual)"
                                type="number" min="0" step="0.01"
                                value={catalogCosto}
                                onChange={(e) => setCatalogCosto(e.target.value)}
                            />
                        )}

                        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-850">
                            <Input
                                label="Stock Actual"
                                type="number" min="0"
                                value={catalogStockActual}
                                onChange={(e) => setCatalogStockActual(e.target.value)}
                            />
                            <Input
                                label="Stock Mínimo"
                                type="number" min="0"
                                value={catalogStockMinimo}
                                onChange={(e) => setCatalogStockMinimo(e.target.value)}
                            />
                        </div>
                        <p className="text-[10px] text-slate-500">
                            El stock se actualiza manualmente — no se descuenta solo al usar el repuesto en un ticket.
                        </p>
                        <Input
                            label="Rendimiento (copias)"
                            type="number" min="1" step="1"
                            placeholder="Opcional — solo para tóner, módulo de imagen o fusor"
                            value={catalogRendimiento}
                            onChange={(e) => setCatalogRendimiento(e.target.value)}
                        />
                        <p className="text-[10px] text-slate-500">
                            Cuántas copias rinde esta unidad. Cargalo si este ítem es un consumible que se pueda asignar a una máquina en Máquinas (tóner/módulo de imagen/fusor) — así Estadísticas calcula el costo de insumos real por copia. Dejalo vacío para repuestos genéricos donde no aplica.
                        </p>

                        {editingCatalogItem && (
                            <div className="pt-2 border-t border-slate-850 space-y-2">
                                <span className="text-[10px] uppercase font-bold text-indigo-400 tracking-wider block">Override de precios para esta unidad</span>
                                <PricingFieldsEditor
                                    draft={activeUnidadDraft}
                                    onChange={setUnidadDraft}
                                    helperText="Un campo vacío hereda de la categoría o global — no hace falta completar todos."
                                />
                            </div>
                        )}
                    </div>
                </Modal>
            )}
        </div>
    );
}
