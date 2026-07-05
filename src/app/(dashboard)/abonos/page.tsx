'use client';

import React, { useState } from 'react';
import { useManagement } from '@/lib/context';
import { TableContainer, Table, TableHeader, TableRow, TableHeaderCell, TableBody, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Modal } from '@/components/ui/modal';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';
import { Plus, Trash2, Edit, FileText, CheckCircle, ShieldAlert, Sparkles } from 'lucide-react';
import { Abono } from '@/lib/mockData';

export default function AbonosPage() {
    const { abonos, setAbonos, machines, clients } = useManagement();
    const [searchQuery, setSearchQuery] = useState('');
    const [filterActive, setFilterActive] = useState('');
    
    // Modal states
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [editingAbono, setEditingAbono] = useState<Abono | null>(null);
    const [selectedAbono, setSelectedAbono] = useState<Abono | null>(null);
    const [formError, setFormError] = useState('');

    // Form inputs
    const [name, setName] = useState('');
    const [price, setPrice] = useState('0');
    const [limit, setLimit] = useState('2000');
    const [excessPrice, setExcessPrice] = useState('15.5');
    const [isActive, setIsActive] = useState(true);

    const handleOpenForm = (abono: Abono | null = null) => {
        setFormError('');
        if (abono) {
            setEditingAbono(abono);
            setName(abono.name);
            setPrice(String(abono.price));
            setLimit(String(abono.limit));
            setExcessPrice(String(abono.excessPrice));
            setIsActive(abono.active !== false);
        } else {
            setEditingAbono(null);
            setName('');
            setPrice('0');
            setLimit('2000');
            setExcessPrice('15.5');
            setIsActive(true);
        }
        setIsFormOpen(true);
    };

    const handleSaveAbono = (e: React.FormEvent) => {
        e.preventDefault();
        setFormError('');

        if (!name.trim()) {
            setFormError('El nombre del plan es obligatorio.');
            return;
        }

        // Duplicate Check
        const cleanName = name.trim().toLowerCase();
        const duplicate = abonos.find(a => 
            a.name.trim().toLowerCase() === cleanName && 
            (!editingAbono || a.id !== editingAbono.id)
        );

        if (duplicate) {
            setFormError(`El nombre de plan "${name}" ya existe.`);
            return;
        }

        const abonoData: Abono = {
            id: editingAbono ? editingAbono.id : 'abono-' + Date.now(),
            name,
            price: parseFloat(price) || 0,
            limit: parseInt(limit, 10) || 0,
            excessPrice: parseFloat(excessPrice) || 0,
            active: isActive
        };

        if (editingAbono) {
            setAbonos(prev => prev.map(a => a.id === editingAbono.id ? abonoData : a));
        } else {
            setAbonos(prev => [...prev, abonoData]);
        }

        setIsFormOpen(false);
    };

    const handleDeleteAbono = (id: string) => {
        const activeRentals = machines.filter(m => m.abonoId === id).length;
        if (activeRentals > 0) {
            alert(`No se puede eliminar el plan porque hay ${activeRentals} máquina(s) usándolo actualmente. Considere desactivarlo para evitar nuevos alquileres.`);
            return;
        }

        if (confirm('¿Está seguro de que desea eliminar este plan de abono del catálogo?')) {
            setAbonos(prev => prev.filter(a => a.id !== id));
        }
    };

    const handleOpenDetail = (abono: Abono) => {
        setSelectedAbono(abono);
        setIsDetailOpen(true);
    };

    const filteredAbonos = abonos.filter(a => {
        const matchesSearch = a.name.toLowerCase().includes(searchQuery.toLowerCase());
        const isPlanActive = a.active !== false;
        
        let matchesStatus = true;
        if (filterActive === 'active') {
            matchesStatus = isPlanActive;
        } else if (filterActive === 'inactive') {
            matchesStatus = !isPlanActive;
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
                        placeholder="Buscar plan de abono por nombre..."
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-xs text-slate-100 placeholder-slate-500 outline-none focus:ring-1 focus:ring-indigo-500"
                    />

                    {/* Status filter */}
                    <select
                        value={filterActive}
                        onChange={(e) => setFilterActive(e.target.value)}
                        className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-300 text-xs focus:outline-none"
                    >
                        <option value="">Estado: Todos</option>
                        <option value="active">Solo Activos</option>
                        <option value="inactive">Solo Inactivos</option>
                    </select>
                </div>
                <Button variant="primary" size="sm" onClick={() => handleOpenForm()}>
                    <Plus size={16} className="mr-1.5" /> Crear Plan
                </Button>
            </div>

            {/* List Table */}
            <TableContainer>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHeaderCell>ID Plan</TableHeaderCell>
                            <TableHeaderCell>Nombre del Plan</TableHeaderCell>
                            <TableHeaderCell>Abono Base Mensual</TableHeaderCell>
                            <TableHeaderCell>Copias Incluidas</TableHeaderCell>
                            <TableHeaderCell>Copia Excedente</TableHeaderCell>
                            <TableHeaderCell>Alquileres Activos</TableHeaderCell>
                            <TableHeaderCell>Estado</TableHeaderCell>
                            <TableHeaderCell className="text-right">Acciones</TableHeaderCell>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredAbonos.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={8} className="text-center py-10 text-slate-500 text-xs italic">
                                    No se encontraron planes de abonos registrados.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredAbonos.map(a => {
                                const activeRentals = machines.filter(m => m.abonoId === a.id).length;
                                const isPlanActive = a.active !== false;

                                return (
                                    <TableRow key={a.id} className="hover:bg-slate-900/40">
                                        <TableCell className="text-xs font-mono-tabular font-bold text-slate-550">{a.id}</TableCell>
                                        <TableCell className="font-bold text-slate-100">{a.name}</TableCell>
                                        <TableCell className="font-mono-tabular text-xs text-slate-300">{formatCurrency(a.price)}</TableCell>
                                        <TableCell className="font-mono-tabular text-xs text-slate-300">{a.limit.toLocaleString('es-AR')} copias</TableCell>
                                        <TableCell className="font-mono-tabular text-xs font-semibold text-slate-300">{formatCurrency(a.excessPrice)}</TableCell>
                                        <TableCell className="text-xs font-semibold text-slate-350 font-mono-tabular">
                                            {activeRentals > 0 ? `${activeRentals} máquina(s)` : <span className="text-slate-500 italic">Sin uso</span>}
                                        </TableCell>
                                        <TableCell className="text-xs">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                                                isPlanActive ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                                            }`}>
                                                {isPlanActive ? 'VIGENTE' : 'DESACTIVADO'}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-1.5">
                                                <button 
                                                    title="Ficha del Abono"
                                                    onClick={() => handleOpenDetail(a)}
                                                    className="p-1.5 bg-slate-900 border border-slate-800 rounded-lg hover:bg-slate-850 transition-colors"
                                                >
                                                    <FileText size={13} className="text-indigo-400" />
                                                </button>
                                                <button 
                                                    title="Editar Plan"
                                                    onClick={() => handleOpenForm(a)}
                                                    className="p-1.5 bg-slate-900 border border-slate-800 rounded-lg hover:bg-slate-850 transition-colors"
                                                >
                                                    <Edit size={13} className="text-slate-400" />
                                                </button>
                                                <button 
                                                    title="Eliminar Plan"
                                                    onClick={() => handleDeleteAbono(a.id)}
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

            {/* Modal: Formulario Plan */}
            <Modal
                isOpen={isFormOpen}
                onClose={() => setIsFormOpen(false)}
                title={editingAbono ? 'Editar Plan de Abono' : 'Crear Plan de Abono'}
                footer={
                    <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setIsFormOpen(false)}>
                            Cancelar
                        </Button>
                        <Button variant="primary" size="sm" onClick={handleSaveAbono}>
                            Guardar Plan
                        </Button>
                    </div>
                }
            >
                <form className="space-y-4 animate-fade-in" onSubmit={handleSaveAbono}>
                    <Input
                        label="Nombre del Plan *"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        placeholder="Ej: Plan Básico 2000"
                    />
                    <Input
                        label="Precio de Abono Base ($) *"
                        type="number"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        required
                    />
                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            label="Copias Incluidas *"
                            type="number"
                            value={limit}
                            onChange={(e) => setLimit(e.target.value)}
                            required
                        />
                        <Input
                            label="Precio por Copia Excedente ($) *"
                            type="number"
                            value={excessPrice}
                            onChange={(e) => setExcessPrice(e.target.value)}
                            required
                        />
                    </div>
                    
                    <Select
                        label="Estado de Comercialización"
                        value={isActive ? 'true' : 'false'}
                        onChange={(e) => setIsActive(e.target.value === 'true')}
                        options={[
                            { value: 'true', label: 'VIGENTE (Disponible para nuevos contratos)' },
                            { value: 'false', label: 'DESACTIVADO (Solo para contratos históricos)' }
                        ]}
                    />

                    {formError && (
                        <p className="text-red-500 text-[10px] font-bold mt-1 bg-red-500/10 p-2.5 rounded-lg border border-red-500/20">{formError}</p>
                    )}
                </form>
            </Modal>

            {/* Modal: Ficha Detallada de Abono */}
            <Modal
                isOpen={isDetailOpen}
                onClose={() => setIsDetailOpen(false)}
                title="Ficha del Plan de Abono"
                footer={
                    <Button variant="secondary" size="sm" onClick={() => setIsDetailOpen(false)}>
                        Cerrar Ficha
                    </Button>
                }
            >
                {selectedAbono && (
                    <div className="space-y-5">
                        
                        {/* Header */}
                        <div className="border-b border-slate-850 pb-4 flex justify-between items-center">
                            <div>
                                <h4 className="text-base font-extrabold text-slate-100">{selectedAbono.name}</h4>
                                <span className="text-xs text-slate-400 block mt-1">ID: {selectedAbono.id}</span>
                            </div>
                            <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase ${
                                selectedAbono.active !== false ? 'bg-emerald-500/10 text-emerald-455' : 'bg-red-500/10 text-red-455'
                            }`}>
                                {selectedAbono.active !== false ? 'VIGENTE' : 'DESACTIVADO'}
                            </span>
                        </div>

                        {/* Detalle Variables */}
                        <div className="p-4 bg-slate-955 rounded-xl border border-slate-850 text-xs space-y-2 font-medium">
                            <span className="text-slate-550 font-bold block text-[9px] uppercase tracking-wider mb-2">Parámetros de Liquidación</span>
                            <div className="flex justify-between items-center text-slate-300">
                                <span>Abono Base Mensual:</span>
                                <span className="font-bold text-slate-205 font-mono-tabular">{formatCurrency(selectedAbono.price)}</span>
                            </div>
                            <div className="flex justify-between items-center text-slate-350">
                                <span>Copias Incluidas:</span>
                                <span className="font-bold text-slate-205 font-mono-tabular">{selectedAbono.limit.toLocaleString('es-AR')} copias</span>
                            </div>
                            <div className="flex justify-between items-center text-slate-350">
                                <span>Valor Copia Excedente:</span>
                                <span className="font-bold text-indigo-400 font-mono-tabular">{formatCurrency(selectedAbono.excessPrice)}</span>
                            </div>
                        </div>

                        {/* Equipos bajo el plan */}
                        <div className="space-y-3 pt-3 border-t border-slate-850">
                            <span className="text-slate-500 font-bold block text-xs">CLIENTES Y EQUIPOS VINCULADOS</span>
                            
                            {machines.filter(m => m.abonoId === selectedAbono.id).length === 0 ? (
                                <p className="text-xs text-slate-550 italic py-2">Ningún equipo tiene contratado este plan en la actualidad.</p>
                            ) : (
                                <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                                    {machines.filter(m => m.abonoId === selectedAbono.id).map(m => {
                                        const cl = clients.find(c => c.id === m.clientId);
                                        return (
                                            <div key={m.id} className="p-3 bg-slate-950/50 border border-slate-850 rounded-xl text-xs flex justify-between items-center">
                                                <div>
                                                    <span className="font-bold text-slate-205 block">{cl ? cl.name : 'Cliente N/A'}</span>
                                                    <span className="text-[10px] text-slate-500 block">Copiadora: {m.brand} {m.model} (S/N: {m.serial})</span>
                                                </div>
                                                <Badge variant="secondary">{m.status}</Badge>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                    </div>
                )}
            </Modal>
        </div>
    );
}
