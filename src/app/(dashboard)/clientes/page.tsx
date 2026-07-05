'use client';

import React, { useState } from 'react';
import { useManagement } from '@/lib/context';
import { Card, CardContent } from '@/components/ui/card';
import { TableContainer, Table, TableHeader, TableRow, TableHeaderCell, TableBody, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Modal } from '@/components/ui/modal';
import { formatCurrency, formatPeriod } from '@/lib/utils';
import { Plus, Trash2, Edit, FileText, CheckCircle, AlertTriangle, ShieldCheck, Landmark } from 'lucide-react';
import { Client } from '@/lib/mockData';

export default function ClientsPage() {
    const { clients, setClients, machines, readings, abonos } = useManagement();
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState('');

    // Modal states
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [editingClient, setEditingClient] = useState<Client | null>(null);
    const [selectedClient, setSelectedClient] = useState<Client | null>(null);
    const [detailTab, setDetailTab] = useState<'machines' | 'invoices'>('machines');

    // Form inputs
    const [name, setName] = useState('');
    const [cuit, setCuit] = useState('');
    const [taxCategory, setTaxCategory] = useState<'Responsable Inscripto' | 'Monotributista' | 'Exento'>('Responsable Inscripto');
    const [address, setAddress] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [debt, setDebt] = useState('0');
    const [isActive, setIsActive] = useState(true);
    const [formError, setFormError] = useState('');

    const handleOpenForm = (client: Client | null = null) => {
        setFormError('');
        if (client) {
            setEditingClient(client);
            setName(client.name);
            setCuit(client.cuit);
            setTaxCategory(client.taxCategory || 'Responsable Inscripto');
            setAddress(client.address || '');
            setPhone(client.phone || '');
            setEmail(client.email || '');
            setDebt(String(client.debt || 0));
            setIsActive(client.active !== false);
        } else {
            setEditingClient(null);
            setName('');
            setCuit('');
            setTaxCategory('Responsable Inscripto');
            setAddress('');
            setPhone('');
            setEmail('');
            setDebt('0');
            setIsActive(true);
        }
        setIsFormOpen(true);
    };

    const handleSaveClient = (e: React.FormEvent) => {
        e.preventDefault();
        setFormError('');

        if (!name.trim()) {
            setFormError('El nombre o razón social es obligatorio.');
            return;
        }
        if (!cuit.trim()) {
            setFormError('El CUIT es obligatorio.');
            return;
        }

        // CUIT Duplicate Check
        const cleanCuit = cuit.replace(/-/g, '').trim();
        const duplicate = clients.find(c => 
            c.cuit.replace(/-/g, '').trim() === cleanCuit && 
            (!editingClient || c.id !== editingClient.id)
        );

        if (duplicate) {
            setFormError(`El CUIT ${cuit} ya se encuentra asignado al cliente "${duplicate.name}".`);
            return;
        }

        const clientData: Client = {
            id: editingClient ? editingClient.id : 'client-' + Date.now(),
            name,
            cuit,
            taxCategory,
            address,
            phone,
            email,
            debt: parseFloat(debt) || 0,
            active: isActive
        };

        if (editingClient) {
            setClients(prev => prev.map(c => c.id === editingClient.id ? clientData : c));
        } else {
            setClients(prev => [...prev, clientData]);
        }

        setIsFormOpen(false);
    };

    const handleDeleteClient = (id: string) => {
        const clientMachines = machines.filter(m => m.clientId === id);
        if (clientMachines.length > 0) {
            alert(`No es posible eliminar el cliente porque tiene ${clientMachines.length} máquina(s) asignada(s). Por favor desasigne los equipos primero.`);
            return;
        }

        if (confirm('¿Está seguro de que desea eliminar este cliente del sistema?')) {
            setClients(prev => prev.filter(c => c.id !== id));
        }
    };

    const handleOpenDetail = (client: Client) => {
        setSelectedClient(client);
        setDetailTab('machines');
        setIsDetailOpen(true);
    };

    const filteredClients = clients.filter(c => {
        const q = searchQuery.toLowerCase();
        const matchesSearch = c.name.toLowerCase().includes(q) || c.cuit.includes(q) || c.address.toLowerCase().includes(q);
        
        // Status filter
        const isClientActive = c.active !== false;
        let matchesStatus = true;
        if (filterStatus === 'active') {
            matchesStatus = isClientActive;
        } else if (filterStatus === 'inactive') {
            matchesStatus = !isClientActive;
        } else if (filterStatus === 'debt') {
            matchesStatus = (c.debt || 0) > 0;
        }

        return matchesSearch && matchesStatus;
    });

    return (
        <div className="space-y-6 animate-fade-in text-slate-100 pb-12">
            
            {/* Action Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex flex-1 gap-3 max-w-lg">
                    {/* Búsqueda */}
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Buscar cliente por nombre, CUIT, dirección..."
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-xs text-slate-100 placeholder-slate-500 outline-none focus:ring-1 focus:ring-indigo-500"
                    />

                    {/* Status filter */}
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-300 text-xs focus:outline-none"
                    >
                        <option value="">Estado: Todos</option>
                        <option value="active">Solo Activos</option>
                        <option value="inactive">Solo Inactivos</option>
                        <option value="debt">Solo con Deuda</option>
                    </select>
                </div>

                <Button variant="primary" size="sm" onClick={() => handleOpenForm()}>
                    <Plus size={16} className="mr-1.5" /> Nuevo Cliente
                </Button>
            </div>

            {/* List Table */}
            <TableContainer>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHeaderCell>Cliente</TableHeaderCell>
                            <TableHeaderCell>CUIT</TableHeaderCell>
                            <TableHeaderCell>Categoría Fiscal</TableHeaderCell>
                            <TableHeaderCell>Dirección</TableHeaderCell>
                            <TableHeaderCell>Alquileres Activos</TableHeaderCell>
                            <TableHeaderCell>Deuda Acumulada</TableHeaderCell>
                            <TableHeaderCell>Estado</TableHeaderCell>
                            <TableHeaderCell className="text-right">Acciones</TableHeaderCell>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredClients.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={8} className="text-center py-10 text-slate-500 text-xs italic">
                                    No se encontraron clientes registrados.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredClients.map(c => {
                                const activeRentals = machines.filter(m => m.clientId === c.id).length;
                                const isClientActive = c.active !== false;

                                return (
                                    <TableRow key={c.id} className="hover:bg-slate-900/40">
                                        <TableCell className="font-bold text-slate-100">{c.name}</TableCell>
                                        <TableCell className="font-mono-tabular text-xs text-slate-350">{c.cuit}</TableCell>
                                        <TableCell className="text-xs text-slate-350">{c.taxCategory}</TableCell>
                                        <TableCell className="text-xs text-slate-400 max-w-[200px] truncate">{c.address || '-'}</TableCell>
                                        <TableCell className="text-xs font-semibold text-slate-300 font-mono-tabular">
                                            {activeRentals > 0 ? `${activeRentals} máquina(s)` : <span className="text-slate-500 italic">Ninguna</span>}
                                        </TableCell>
                                        <TableCell className="font-mono-tabular text-xs">
                                            <span className={(c.debt || 0) > 0 ? "text-red-500 font-extrabold" : "text-emerald-500 font-semibold"}>
                                                {(c.debt || 0) > 0 ? formatCurrency(c.debt) : 'Sin Deuda'}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-xs">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                                                isClientActive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                                            }`}>
                                                {isClientActive ? 'ACTIVO' : 'INACTIVO'}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-1.5">
                                                <button 
                                                    title="Ficha del Cliente"
                                                    onClick={() => handleOpenDetail(c)}
                                                    className="p-1.5 bg-slate-900 border border-slate-800 rounded-lg hover:bg-slate-850 transition-colors"
                                                >
                                                    <FileText size={13} className="text-indigo-400" />
                                                </button>
                                                <button 
                                                    title="Editar Cliente"
                                                    onClick={() => handleOpenForm(c)}
                                                    className="p-1.5 bg-slate-900 border border-slate-800 rounded-lg hover:bg-slate-850 transition-colors"
                                                >
                                                    <Edit size={13} className="text-slate-400" />
                                                </button>
                                                <button 
                                                    title="Eliminar Cliente"
                                                    onClick={() => handleDeleteClient(c.id)}
                                                    className="p-1.5 bg-red-955/20 border border-red-900/30 rounded-lg hover:bg-red-900/20 transition-colors"
                                                >
                                                    <Trash2 size={13} className="text-red-400" />
                                                </button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </TableContainer>

            {/* Modal: Formulario Cliente */}
            <Modal
                isOpen={isFormOpen}
                onClose={() => setIsFormOpen(false)}
                title={editingClient ? 'Editar Cliente' : 'Agregar Cliente'}
                footer={
                    <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setIsFormOpen(false)}>
                            Cancelar
                        </Button>
                        <Button variant="primary" size="sm" onClick={handleSaveClient}>
                            Guardar Cliente
                        </Button>
                    </div>
                }
            >
                <form className="space-y-4" onSubmit={handleSaveClient}>
                    <Input
                        label="Nombre / Razón Social *"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        placeholder="Ej: Imprenta Rápida S.A."
                    />
                    <Input
                        label="CUIT / CUIL *"
                        value={cuit}
                        onChange={(e) => setCuit(e.target.value)}
                        required
                        placeholder="Ej: 30-12345678-9"
                    />
                    <Select
                        label="Categoría Fiscal"
                        value={taxCategory}
                        onChange={(e) => setTaxCategory(e.target.value as any)}
                        options={[
                            { value: 'Responsable Inscripto', label: 'Responsable Inscripto' },
                            { value: 'Monotributista', label: 'Monotributista' },
                            { value: 'Exento', label: 'Exento' }
                        ]}
                    />
                    <Input
                        label="Dirección de Instalación"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        placeholder="Ej: Av. Rivadavia 4500, CABA"
                    />
                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            label="Teléfono de Contacto"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="Ej: 11 5555-1234"
                        />
                        <Input
                            label="Email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="Ej: contacto@empresa.com"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            label="Deuda Inicial ($)"
                            type="number"
                            value={debt}
                            onChange={(e) => setDebt(e.target.value)}
                            placeholder="0"
                        />
                        <Select
                            label="Estado Operativo"
                            value={isActive ? 'true' : 'false'}
                            onChange={(e) => setIsActive(e.target.value === 'true')}
                            options={[
                                { value: 'true', label: 'ACTIVO' },
                                { value: 'false', label: 'INACTIVO' }
                            ]}
                        />
                    </div>

                    {formError && (
                        <p className="text-red-500 text-[10px] font-bold mt-1 bg-red-500/10 p-2.5 rounded-lg border border-red-500/20">{formError}</p>
                    )}
                </form>
            </Modal>

            {/* Modal: Detalle de Cliente / Ficha Completa */}
            <Modal
                isOpen={isDetailOpen}
                onClose={() => setIsDetailOpen(false)}
                title="Ficha del Cliente"
                footer={
                    <Button variant="secondary" size="sm" onClick={() => setIsDetailOpen(false)}>
                        Cerrar Ficha
                    </Button>
                }
            >
                {selectedClient && (
                    <div className="space-y-6 max-h-[75vh] overflow-y-auto pr-2">
                        
                        {/* Header Ficha */}
                        <div className="border-b border-slate-800 pb-4 flex justify-between items-start">
                            <div>
                                <h4 className="text-base font-bold text-slate-100">{selectedClient.name}</h4>
                                <p className="text-xs text-slate-400 mt-1">CUIT: {selectedClient.cuit} | Categoría: {selectedClient.taxCategory}</p>
                            </div>
                            <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase ${
                                selectedClient.active !== false ? 'bg-emerald-500/10 text-emerald-455' : 'bg-red-500/10 text-red-455'
                            }`}>
                                {selectedClient.active !== false ? 'ACTIVO' : 'INACTIVO'}
                            </span>
                        </div>

                        {/* Detalle Datos */}
                        <div className="grid grid-cols-2 gap-4 text-xs">
                            <div>
                                <span className="text-slate-500 font-bold block">CONTACTO</span>
                                <span className="text-slate-300 block mt-1">{selectedClient.phone || 'Sin teléfono'}</span>
                                <span className="text-slate-400 block">{selectedClient.email || 'Sin correo electrónico'}</span>
                            </div>
                            <div>
                                <span className="text-slate-500 font-bold block">DIRECCIÓN</span>
                                <span className="text-slate-300 block mt-1">{selectedClient.address || 'Sin dirección registrada'}</span>
                            </div>
                        </div>

                        {/* Tabs Nav */}
                        <div className="flex gap-2 border-b border-slate-800 pb-1 pt-2">
                            <button
                                onClick={() => setDetailTab('machines')}
                                className={`px-3 py-1 text-xs font-semibold rounded-t-lg transition-all ${
                                    detailTab === 'machines' 
                                        ? 'border-b-2 border-indigo-500 text-indigo-400 font-bold' 
                                        : 'text-slate-500'
                                }`}
                            >
                                Máquinas Alquiladas
                            </button>
                            <button
                                onClick={() => setDetailTab('invoices')}
                                className={`px-3 py-1 text-xs font-semibold rounded-t-lg transition-all ${
                                    detailTab === 'invoices' 
                                        ? 'border-b-2 border-indigo-500 text-indigo-400 font-bold' 
                                        : 'text-slate-500'
                                }`}
                            >
                                Historial de Facturas
                            </button>
                        </div>

                        {/* TAB 1: MÁQUINAS */}
                        {detailTab === 'machines' && (
                            <div className="space-y-2">
                                {machines.filter(m => m.clientId === selectedClient.id).length === 0 ? (
                                    <p className="text-xs text-slate-500 italic py-4">Sin copiadoras asignadas.</p>
                                ) : (
                                    machines.filter(m => m.clientId === selectedClient.id).map(m => {
                                        const ab = abonos.find(a => a.id === m.abonoId);
                                        return (
                                            <div key={m.id} className="p-3 bg-slate-950/50 border border-slate-850 rounded-xl text-xs flex justify-between items-center">
                                                <div>
                                                    <span className="font-bold text-slate-205 block">{m.brand} {m.model}</span>
                                                    <span className="text-[10px] text-slate-500 block">S/N: {m.serial} | Tipo: {m.type}</span>
                                                    <span className="text-[10px] text-indigo-400 font-medium mt-1 block">Plan: {ab ? ab.name : 'Abono no asignado'}</span>
                                                </div>
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                                    m.status === 'Disponible' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-indigo-500/10 text-indigo-400'
                                                }`}>
                                                    {m.status.toUpperCase()}
                                                </span>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        )}

                        {/* TAB 2: HISTORIAL FACTURACIÓN */}
                        {detailTab === 'invoices' && (
                            <div className="space-y-3">
                                {readings.filter(r => {
                                    const mach = machines.find(m => m.id === r.machineId);
                                    return mach && mach.clientId === selectedClient.id;
                                }).length === 0 ? (
                                    <p className="text-xs text-slate-500 italic py-4">Sin facturas liquidadas registradas.</p>
                                ) : (
                                    <div className="space-y-2">
                                        {readings.filter(r => {
                                            const mach = machines.find(m => m.id === r.machineId);
                                            return mach && mach.clientId === selectedClient.id;
                                        }).sort((a,b) => b.month.localeCompare(a.month)).map(r => {
                                            const mach = machines.find(m => m.id === r.machineId);
                                            return (
                                                <div key={r.id} className="p-3 bg-slate-955 border border-slate-850 rounded-xl text-xs flex justify-between items-center">
                                                    <div>
                                                        <span className="font-bold text-slate-200 block">{formatPeriod(r.month)}</span>
                                                        <span className="text-[10px] text-slate-500 block">
                                                            {mach ? `${mach.brand} ${mach.model}` : 'Equipo N/A'} (Lectura: {r.initial.toLocaleString()} a {r.final.toLocaleString()})
                                                        </span>
                                                        {r.readingComment && <span className="text-[9px] text-slate-400 block mt-0.5">{r.readingComment}</span>}
                                                    </div>
                                                    <div className="text-right space-y-1">
                                                        <span className="font-bold text-slate-200 block font-mono-tabular">{formatCurrency(r.totalAmount)}</span>
                                                        <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase ${
                                                            r.status === 'paid' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                                                        }`}>
                                                            {r.status === 'paid' ? 'PAGADO' : 'PENDIENTE'}
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}

                    </div>
                )}
            </Modal>
        </div>
    );
}
