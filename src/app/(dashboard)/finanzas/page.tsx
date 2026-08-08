'use client';

import React, { useState } from 'react';
import { useManagement } from '@/lib/context';
import { Card, CardContent } from '@/components/ui/card';
import { TableContainer, Table, TableHeader, TableRow, TableHeaderCell, TableBody, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Modal } from '@/components/ui/modal';
import { Badge } from '@/components/ui/badge';
import { GastoGeneral, GASTO_CATEGORIAS, Venta, VentaTipo, VentaOrigen, VENTA_TIPOS, Machine } from '@/domain/types';
import { formatCurrency } from '@/lib/utils';
import { Plus, Edit, Trash2 } from 'lucide-react';

const TABS = [
    { key: 'gastos', label: 'Gastos Generales' },
    { key: 'ventas', label: 'Ventas' },
] as const;

export default function FinanzasPage() {
    const {
        gastosGenerales, addGastoGeneralAction,
        ventas, addVentaAction,
        machines, updateMachineAction,
        rentals, updateRentalAction,
        clients, partsCatalog,
        currentUser,
    } = useManagement();
    const [currentTab, setCurrentTab] = useState<typeof TABS[number]['key']>('gastos');

    // ---------------- Gastos Generales ----------------
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingGasto, setEditingGasto] = useState<GastoGeneral | null>(null);
    const [categoria, setCategoria] = useState<typeof GASTO_CATEGORIAS[number]>('Otros');
    const [monto, setMonto] = useState('');
    const [fecha, setFecha] = useState('');
    const [descripcion, setDescripcion] = useState('');
    const [searchQuery, setSearchQuery] = useState('');

    const handleOpenCreate = () => {
        setEditingGasto(null);
        setCategoria('Otros');
        setMonto('');
        setFecha(new Date().toISOString().split('T')[0]);
        setDescripcion('');
        setIsFormOpen(true);
    };

    const handleOpenEdit = (gasto: GastoGeneral) => {
        setEditingGasto(gasto);
        setCategoria(gasto.categoria);
        setMonto(String(gasto.monto));
        setFecha(gasto.fecha);
        setDescripcion(gasto.descripcion || '');
        setIsFormOpen(true);
    };

    const handleSave = () => {
        if (!fecha) {
            alert('La fecha es obligatoria.');
            return;
        }
        const parsedMonto = parseFloat(monto);
        if (isNaN(parsedMonto) || parsedMonto <= 0) {
            alert('Ingresá un monto válido mayor a cero.');
            return;
        }
        const gasto: GastoGeneral = {
            id: editingGasto?.id || `gasto-${crypto.randomUUID()}`,
            categoria,
            monto: parsedMonto,
            fecha,
            descripcion: descripcion.trim() || null,
            createdAt: editingGasto?.createdAt,
        };
        addGastoGeneralAction(gasto, editingGasto ? 'update' : 'create');
        setIsFormOpen(false);
    };

    const handleDelete = (gasto: GastoGeneral) => {
        if (!confirm(`¿Eliminar el gasto de ${gasto.categoria} por ${formatCurrency(gasto.monto)} del ${gasto.fecha}?`)) return;
        addGastoGeneralAction(gasto, 'delete');
    };

    const filteredGastos = gastosGenerales
        .filter(g =>
            g.categoria.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (g.descripcion || '').toLowerCase().includes(searchQuery.toLowerCase())
        )
        .sort((a, b) => b.fecha.localeCompare(a.fecha));

    const totalFiltrado = filteredGastos.reduce((acc, g) => acc + g.monto, 0);

    // ---------------- Ventas ----------------
    const [isVentaFormOpen, setIsVentaFormOpen] = useState(false);
    const [editingVenta, setEditingVenta] = useState<Venta | null>(null);
    const [ventaTipo, setVentaTipo] = useState<VentaTipo>('Insumo');
    const [ventaOrigen, setVentaOrigen] = useState<VentaOrigen>('externo');
    const [ventaMachineId, setVentaMachineId] = useState('');
    const [ventaCatalogId, setVentaCatalogId] = useState('');
    const [ventaDescripcion, setVentaDescripcion] = useState('');
    const [ventaClientId, setVentaClientId] = useState('');
    const [ventaClientNameSnapshot, setVentaClientNameSnapshot] = useState('');
    const [ventaCantidad, setVentaCantidad] = useState('1');
    const [ventaPrecioVenta, setVentaPrecioVenta] = useState('');
    const [ventaCostoVenta, setVentaCostoVenta] = useState('');
    const [ventaFecha, setVentaFecha] = useState('');
    const [ventaNotas, setVentaNotas] = useState('');
    const [ventaSearchQuery, setVentaSearchQuery] = useState('');

    // Mismo patrón que finalizeActiveRental en /maquinas (no compartido como helper porque
    // vive en un componente de página distinto) — cierra el contrato activo del equipo
    // vendido, si tiene uno, dejando registro de por qué en el historial del alquiler.
    const finalizeActiveRentalForSale = (machineId: string) => {
        const activeRental = rentals.find(r => r.machineId === machineId && r.status === 'activo');
        if (!activeRental) return;
        const nowStr = new Date().toISOString();
        updateRentalAction({
            ...activeRental,
            status: 'finalizado',
            endDate: nowStr.split('T')[0],
            history: [...(activeRental.history || []), {
                date: nowStr.split('T')[0],
                time: nowStr.split('T')[1].substring(0, 5),
                action: 'Contrato finalizado: equipo vendido',
                user: currentUser?.fullname || 'Administrativo'
            }]
        });
    };

    const sellableMachines = machines.filter(m => m.status !== 'Vendida');
    const catalogOptionsForTipo = partsCatalog.filter(p => p.categoria === ventaTipo && p.activo !== false);

    const ventaReferenceLabel = (venta: Venta): string => {
        if (venta.tipo === 'Equipo' && venta.origen === 'flota') {
            const mach = machines.find(m => m.id === venta.machineId);
            return mach ? `${mach.brand} ${mach.model} (S/N ${mach.serial})` : 'Equipo (referencia eliminada)';
        }
        if (venta.tipo === 'Equipo') return venta.descripcion || 'Equipo (externo)';
        const item = partsCatalog.find(p => p.id === venta.catalogId);
        return item ? item.nombre : 'Ítem de catálogo (eliminado)';
    };

    const handleOpenCreateVenta = () => {
        setEditingVenta(null);
        setVentaTipo('Insumo');
        setVentaOrigen('externo');
        setVentaMachineId('');
        setVentaCatalogId('');
        setVentaDescripcion('');
        setVentaClientId('');
        setVentaClientNameSnapshot('');
        setVentaCantidad('1');
        setVentaPrecioVenta('');
        setVentaCostoVenta('');
        setVentaFecha(new Date().toISOString().split('T')[0]);
        setVentaNotas('');
        setIsVentaFormOpen(true);
    };

    const handleOpenEditVenta = (venta: Venta) => {
        setEditingVenta(venta);
        setVentaTipo(venta.tipo);
        setVentaOrigen(venta.origen);
        setVentaMachineId(venta.machineId || '');
        setVentaCatalogId(venta.catalogId || '');
        setVentaDescripcion(venta.descripcion || '');
        setVentaClientId(venta.clientId || '');
        setVentaClientNameSnapshot(venta.clientNameSnapshot || '');
        setVentaCantidad(String(venta.cantidad));
        setVentaPrecioVenta(String(venta.precioVenta));
        setVentaCostoVenta(String(venta.costoVenta));
        setVentaFecha(venta.fecha);
        setVentaNotas(venta.notas || '');
        setIsVentaFormOpen(true);
    };

    const handleTipoChange = (tipo: VentaTipo) => {
        setVentaTipo(tipo);
        setVentaMachineId('');
        setVentaCatalogId('');
        setVentaDescripcion('');
        setVentaCostoVenta('');
        setVentaOrigen(tipo === 'Equipo' && sellableMachines.length > 0 ? 'flota' : 'externo');
    };

    // Autocompletado de una sola vez al elegir el ítem del catálogo — no se vuelve a
    // recalcular si después cambia la cantidad, para no pisar un costo editado a mano
    // (mismo criterio que "sugerencia inicial, después queda en manos del usuario").
    const handleCatalogSelect = (catalogId: string) => {
        setVentaCatalogId(catalogId);
        const item = partsCatalog.find(p => p.id === catalogId);
        if (item) {
            const qty = parseFloat(ventaCantidad) || 1;
            setVentaCostoVenta(String(Math.round(item.costoUnitario * qty * 100) / 100));
        }
    };

    const handleSaveVenta = () => {
        if (!ventaFecha) { alert('La fecha es obligatoria.'); return; }
        const cantidad = parseFloat(ventaCantidad);
        if (isNaN(cantidad) || cantidad <= 0) { alert('Ingresá una cantidad válida mayor a cero.'); return; }
        const precioVenta = parseFloat(ventaPrecioVenta);
        if (isNaN(precioVenta) || precioVenta <= 0) { alert('Ingresá un precio de venta válido mayor a cero.'); return; }
        const costoVenta = parseFloat(ventaCostoVenta);
        if (isNaN(costoVenta) || costoVenta < 0) { alert('Ingresá un costo de venta válido (puede ser 0 si se desconoce).'); return; }

        if (ventaTipo === 'Equipo' && ventaOrigen === 'flota' && !ventaMachineId) {
            alert('Seleccioná el equipo de la flota que se vendió.'); return;
        }
        if (ventaTipo === 'Equipo' && ventaOrigen === 'externo' && !ventaDescripcion.trim()) {
            alert('Ingresá una descripción del equipo vendido.'); return;
        }
        if ((ventaTipo === 'Insumo' || ventaTipo === 'Repuesto') && !ventaCatalogId) {
            alert('Seleccioná el ítem del catálogo que se vendió.'); return;
        }

        const selectedClient = clients.find(c => c.id === ventaClientId);
        const clientNameSnapshot = selectedClient ? selectedClient.name : (ventaClientNameSnapshot.trim() || null);

        const venta: Venta = {
            id: editingVenta?.id || `venta-${crypto.randomUUID()}`,
            tipo: ventaTipo,
            origen: ventaOrigen,
            machineId: ventaTipo === 'Equipo' && ventaOrigen === 'flota' ? ventaMachineId : null,
            catalogId: (ventaTipo === 'Insumo' || ventaTipo === 'Repuesto') ? ventaCatalogId : null,
            descripcion: ventaTipo === 'Equipo' && ventaOrigen === 'externo' ? ventaDescripcion.trim() : null,
            clientId: ventaClientId || null,
            clientNameSnapshot,
            cantidad,
            precioVenta,
            costoVenta,
            fecha: ventaFecha,
            notas: ventaNotas.trim() || null,
            createdAt: editingVenta?.createdAt,
        };

        addVentaAction(venta, editingVenta ? 'update' : 'create');

        // Efecto colateral SOLO al crear una venta nueva de equipo de flota: marcar la
        // máquina como Vendida y cerrar cualquier alquiler activo — mismo patrón que la
        // baja lógica de handleDeleteMachine en /maquinas. No se repite al editar (p.ej.
        // corregir el precio de una venta ya cargada) para no reprocesar un cierre de
        // contrato que ya ocurrió la primera vez.
        if (!editingVenta && venta.tipo === 'Equipo' && venta.origen === 'flota' && venta.machineId) {
            const mach = machines.find(m => m.id === venta.machineId);
            if (mach) {
                updateMachineAction({ ...mach, status: 'Vendida' as Machine['status'], clientId: null, abonoId: null }, 'update');
                finalizeActiveRentalForSale(venta.machineId);
            }
        }

        setIsVentaFormOpen(false);
    };

    const handleDeleteVenta = (venta: Venta) => {
        const revierteMaquina = venta.tipo === 'Equipo' && venta.origen === 'flota' && !!venta.machineId;
        const msg = revierteMaquina
            ? '¿Eliminar esta venta? El equipo asociado volverá a estado "Disponible".'
            : `¿Eliminar esta venta de ${venta.tipo.toLowerCase()} por ${formatCurrency(venta.precioVenta)}?`;
        if (!confirm(msg)) return;
        addVentaAction(venta, 'delete');
        if (revierteMaquina) {
            const mach = machines.find(m => m.id === venta.machineId);
            if (mach && mach.status === 'Vendida') {
                updateMachineAction({ ...mach, status: 'Disponible' as Machine['status'], clientId: null, abonoId: null }, 'update');
            }
        }
    };

    const filteredVentas = ventas
        .filter(v => {
            const q = ventaSearchQuery.toLowerCase();
            return ventaReferenceLabel(v).toLowerCase().includes(q) ||
                (v.clientNameSnapshot || '').toLowerCase().includes(q) ||
                v.tipo.toLowerCase().includes(q);
        })
        .sort((a, b) => b.fecha.localeCompare(a.fecha));

    const totalVentasMonto = filteredVentas.reduce((acc, v) => acc + v.precioVenta, 0);
    const totalVentasMargen = filteredVentas.reduce((acc, v) => acc + (v.precioVenta - v.costoVenta), 0);

    return (
        <div className="space-y-6 animate-fade-in relative text-slate-100">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 border-b border-slate-850 pb-4">
                <div>
                    <h2 className="text-base font-semibold text-slate-100 uppercase tracking-wider">Finanzas</h2>
                    <p className="text-[10px] text-slate-400">Gastos generales y ventas del negocio — ambos alimentan el Resultado del Negocio en Estadísticas.</p>
                </div>
                <div className="flex bg-slate-950 p-1.5 rounded-xl border border-slate-850 gap-1.5 text-xs">
                    {TABS.map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setCurrentTab(tab.key)}
                            className={`px-3 py-1.5 rounded-lg font-semibold transition-all shrink-0 ${
                                currentTab === tab.key ? 'bg-indigo-650 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {currentTab === 'gastos' && (
                <div className="space-y-4">
                    <div className="flex flex-col md:flex-row justify-between gap-3">
                        <div className="w-full md:w-72">
                            <Input
                                placeholder="Buscar por categoría o descripción..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <Button variant="primary" size="sm" onClick={handleOpenCreate}>
                            <Plus size={14} className="mr-1" /> Nuevo Gasto
                        </Button>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-1 gap-4 max-w-xs">
                        <Card className="p-4">
                            <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Total (según filtro)</p>
                            <p className="text-xl font-bold text-slate-100 mt-1">{formatCurrency(totalFiltrado)}</p>
                        </Card>
                    </div>

                    <Card>
                        <CardContent className="p-0">
                            <TableContainer>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHeaderCell>Fecha</TableHeaderCell>
                                            <TableHeaderCell>Categoría</TableHeaderCell>
                                            <TableHeaderCell>Descripción</TableHeaderCell>
                                            <TableHeaderCell>Monto</TableHeaderCell>
                                            <TableHeaderCell>Acciones</TableHeaderCell>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredGastos.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={5} className="text-center text-slate-500 py-6">
                                                    {gastosGenerales.length === 0
                                                        ? 'Todavía no cargaste gastos generales. Usá "Nuevo Gasto" para empezar.'
                                                        : 'Sin resultados para la búsqueda.'}
                                                </TableCell>
                                            </TableRow>
                                        )}
                                        {filteredGastos.map(gasto => (
                                            <TableRow key={gasto.id}>
                                                <TableCell>{gasto.fecha}</TableCell>
                                                <TableCell><Badge variant="secondary">{gasto.categoria}</Badge></TableCell>
                                                <TableCell className="text-slate-400">{gasto.descripcion || '—'}</TableCell>
                                                <TableCell className="font-semibold text-slate-100">{formatCurrency(gasto.monto)}</TableCell>
                                                <TableCell>
                                                    <div className="flex gap-2">
                                                        <button onClick={() => handleOpenEdit(gasto)} className="text-slate-400 hover:text-slate-100 cursor-pointer">
                                                            <Edit size={14} />
                                                        </button>
                                                        <button onClick={() => handleDelete(gasto)} className="text-slate-400 hover:text-red-400 cursor-pointer">
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </CardContent>
                    </Card>
                </div>
            )}

            {currentTab === 'ventas' && (
                <div className="space-y-4">
                    <div className="flex flex-col md:flex-row justify-between gap-3">
                        <div className="w-full md:w-72">
                            <Input
                                placeholder="Buscar por tipo, referencia o cliente..."
                                value={ventaSearchQuery}
                                onChange={(e) => setVentaSearchQuery(e.target.value)}
                            />
                        </div>
                        <Button variant="primary" size="sm" onClick={handleOpenCreateVenta}>
                            <Plus size={14} className="mr-1" /> Nueva Venta
                        </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-4 max-w-md">
                        <Card className="p-4">
                            <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Total Facturado (según filtro)</p>
                            <p className="text-xl font-bold text-slate-100 mt-1">{formatCurrency(totalVentasMonto)}</p>
                        </Card>
                        <Card className="p-4">
                            <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Margen Total (según filtro)</p>
                            <p className={`text-xl font-bold mt-1 ${totalVentasMargen >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatCurrency(totalVentasMargen)}</p>
                        </Card>
                    </div>

                    <Card>
                        <CardContent className="p-0">
                            <TableContainer>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHeaderCell>Fecha</TableHeaderCell>
                                            <TableHeaderCell>Tipo</TableHeaderCell>
                                            <TableHeaderCell>Referencia</TableHeaderCell>
                                            <TableHeaderCell>Cliente</TableHeaderCell>
                                            <TableHeaderCell>Cant.</TableHeaderCell>
                                            <TableHeaderCell>Precio Venta</TableHeaderCell>
                                            <TableHeaderCell>Costo</TableHeaderCell>
                                            <TableHeaderCell>Margen</TableHeaderCell>
                                            <TableHeaderCell>Acciones</TableHeaderCell>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredVentas.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={9} className="text-center text-slate-500 py-6">
                                                    {ventas.length === 0
                                                        ? 'Todavía no cargaste ventas. Usá "Nueva Venta" para empezar.'
                                                        : 'Sin resultados para la búsqueda.'}
                                                </TableCell>
                                            </TableRow>
                                        )}
                                        {filteredVentas.map(venta => {
                                            const margen = venta.precioVenta - venta.costoVenta;
                                            return (
                                                <TableRow key={venta.id}>
                                                    <TableCell>{venta.fecha}</TableCell>
                                                    <TableCell><Badge variant="secondary">{venta.tipo}</Badge></TableCell>
                                                    <TableCell className="text-slate-300">{ventaReferenceLabel(venta)}</TableCell>
                                                    <TableCell className="text-slate-400">{venta.clientNameSnapshot || '—'}</TableCell>
                                                    <TableCell>{venta.cantidad}</TableCell>
                                                    <TableCell className="font-semibold text-slate-100">{formatCurrency(venta.precioVenta)}</TableCell>
                                                    <TableCell className="text-slate-400">{formatCurrency(venta.costoVenta)}</TableCell>
                                                    <TableCell className={margen >= 0 ? 'text-emerald-400 font-semibold' : 'text-red-400 font-semibold'}>{formatCurrency(margen)}</TableCell>
                                                    <TableCell>
                                                        <div className="flex gap-2">
                                                            <button onClick={() => handleOpenEditVenta(venta)} className="text-slate-400 hover:text-slate-100 cursor-pointer">
                                                                <Edit size={14} />
                                                            </button>
                                                            <button onClick={() => handleDeleteVenta(venta)} className="text-slate-400 hover:text-red-400 cursor-pointer">
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
                </div>
            )}

            {isFormOpen && (
                <Modal
                    isOpen={isFormOpen}
                    onClose={() => setIsFormOpen(false)}
                    title={editingGasto ? 'Editar Gasto' : 'Nuevo Gasto General'}
                    footer={
                        <>
                            <Button variant="ghost" size="sm" onClick={() => setIsFormOpen(false)}>Cancelar</Button>
                            <Button variant="primary" size="sm" onClick={handleSave}>Guardar</Button>
                        </>
                    }
                >
                    <div className="space-y-3">
                        <Select
                            label="Categoría"
                            value={categoria}
                            onChange={(e) => setCategoria(e.target.value as typeof GASTO_CATEGORIAS[number])}
                            options={GASTO_CATEGORIAS.map(c => ({ value: c, label: c }))}
                        />
                        <Input
                            label="Monto ($) *"
                            type="number"
                            min="0"
                            step="0.01"
                            value={monto}
                            onChange={(e) => setMonto(e.target.value)}
                            placeholder="0.00"
                        />
                        <Input
                            label="Fecha *"
                            type="date"
                            value={fecha}
                            onChange={(e) => setFecha(e.target.value)}
                        />
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Descripción</label>
                            <textarea
                                value={descripcion}
                                onChange={(e) => setDescripcion(e.target.value)}
                                rows={2}
                                placeholder="Opcional"
                                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-slate-900"
                            />
                        </div>
                    </div>
                </Modal>
            )}

            {isVentaFormOpen && (
                <Modal
                    isOpen={isVentaFormOpen}
                    onClose={() => setIsVentaFormOpen(false)}
                    title={editingVenta ? 'Editar Venta' : 'Nueva Venta'}
                    footer={
                        <>
                            <Button variant="ghost" size="sm" onClick={() => setIsVentaFormOpen(false)}>Cancelar</Button>
                            <Button variant="primary" size="sm" onClick={handleSaveVenta}>Guardar</Button>
                        </>
                    }
                >
                    <div className="space-y-3">
                        <Select
                            label="Tipo *"
                            value={ventaTipo}
                            onChange={(e) => handleTipoChange(e.target.value as VentaTipo)}
                            disabled={!!editingVenta}
                            options={VENTA_TIPOS.map(t => ({ value: t, label: t }))}
                        />

                        {ventaTipo === 'Equipo' && (
                            <Select
                                label="Origen *"
                                value={ventaOrigen}
                                onChange={(e) => { setVentaOrigen(e.target.value as VentaOrigen); setVentaMachineId(''); setVentaDescripcion(''); }}
                                disabled={!!editingVenta}
                                options={[
                                    { value: 'flota', label: 'Equipo de la flota de alquiler' },
                                    { value: 'externo', label: 'Equipo externo (reventa directa)' },
                                ]}
                            />
                        )}

                        {ventaTipo === 'Equipo' && ventaOrigen === 'flota' && (
                            <Select
                                label="Equipo de Flota *"
                                value={ventaMachineId}
                                onChange={(e) => setVentaMachineId(e.target.value)}
                                disabled={!!editingVenta}
                                options={
                                    editingVenta
                                        ? [{ value: ventaMachineId, label: ventaReferenceLabel(editingVenta) }]
                                        : [{ value: '', label: 'Seleccionar equipo...' }, ...sellableMachines.map(m => ({ value: m.id, label: `${m.brand} ${m.model} (S/N ${m.serial})` }))]
                                }
                            />
                        )}
                        {ventaTipo === 'Equipo' && ventaOrigen === 'flota' && !editingVenta && (
                            <p className="text-[10px] text-amber-400 -mt-2">Al guardar, el equipo pasa a estado &quot;Vendida&quot; y se cierra cualquier alquiler activo que tenga.</p>
                        )}

                        {ventaTipo === 'Equipo' && ventaOrigen === 'externo' && (
                            <Input
                                label="Descripción del Equipo *"
                                value={ventaDescripcion}
                                onChange={(e) => setVentaDescripcion(e.target.value)}
                                disabled={!!editingVenta}
                                placeholder="Ej: Impresora HP LaserJet, S/N 12345"
                            />
                        )}

                        {(ventaTipo === 'Insumo' || ventaTipo === 'Repuesto') && (
                            <Select
                                label={`${ventaTipo} del Catálogo *`}
                                value={ventaCatalogId}
                                onChange={(e) => handleCatalogSelect(e.target.value)}
                                disabled={!!editingVenta}
                                options={
                                    editingVenta
                                        ? [{ value: ventaCatalogId, label: ventaReferenceLabel(editingVenta) }]
                                        : [{ value: '', label: 'Seleccionar ítem...' }, ...catalogOptionsForTipo.map(p => ({ value: p.id, label: `${p.nombre} (costo unit. ${formatCurrency(p.costoUnitario)})` }))]
                                }
                            />
                        )}

                        <Select
                            label="Cliente"
                            value={ventaClientId}
                            onChange={(e) => setVentaClientId(e.target.value)}
                            options={[{ value: '', label: 'Sin cliente registrado' }, ...clients.map(c => ({ value: c.id, label: c.name }))]}
                        />
                        {!ventaClientId && (
                            <Input
                                label="Nombre del Comprador"
                                value={ventaClientNameSnapshot}
                                onChange={(e) => setVentaClientNameSnapshot(e.target.value)}
                                placeholder="Opcional, si no es un cliente registrado"
                            />
                        )}

                        <div className="grid grid-cols-2 gap-3">
                            <Input
                                label="Cantidad *"
                                type="number"
                                min="0"
                                step="0.01"
                                value={ventaCantidad}
                                onChange={(e) => setVentaCantidad(e.target.value)}
                            />
                            <Input
                                label="Fecha *"
                                type="date"
                                value={ventaFecha}
                                onChange={(e) => setVentaFecha(e.target.value)}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <Input
                                label="Precio de Venta ($) *"
                                type="number"
                                min="0"
                                step="0.01"
                                value={ventaPrecioVenta}
                                onChange={(e) => setVentaPrecioVenta(e.target.value)}
                                placeholder="Total cobrado"
                            />
                            <Input
                                label="Costo de Venta ($) *"
                                type="number"
                                min="0"
                                step="0.01"
                                value={ventaCostoVenta}
                                onChange={(e) => setVentaCostoVenta(e.target.value)}
                                placeholder="0 si se desconoce"
                            />
                        </div>
                        <p className="text-[10px] text-slate-500 -mt-2">Precio y costo son el total de la línea (no por unidad) — el margen (precio − costo) se suma al Resultado del Negocio en Estadísticas.</p>

                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Notas</label>
                            <textarea
                                value={ventaNotas}
                                onChange={(e) => setVentaNotas(e.target.value)}
                                rows={2}
                                placeholder="Opcional"
                                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-slate-900"
                            />
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
}
