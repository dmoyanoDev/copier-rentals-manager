'use client';

import React, { useState } from 'react';
import { useManagement } from '@/lib/context';
import { TableContainer, Table, TableHeader, TableRow, TableHeaderCell, TableBody, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { formatCurrency } from '@/lib/utils';
import { Plus, Trash2, Edit } from 'lucide-react';

export default function AbonosPage() {
    const { abonos, setAbonos } = useManagement();
    const [searchQuery, setSearchQuery] = useState('');
    
    // Modal states
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingAbono, setEditingAbono] = useState<any>(null);

    // Form inputs
    const [name, setName] = useState('');
    const [price, setPrice] = useState('0');
    const [limit, setLimit] = useState('2000');
    const [excessPrice, setExcessPrice] = useState('15.5');

    const handleOpenForm = (abono: any = null) => {
        if (abono) {
            setEditingAbono(abono);
            setName(abono.name);
            setPrice(String(abono.price));
            setLimit(String(abono.limit));
            setExcessPrice(String(abono.excessPrice));
        } else {
            setEditingAbono(null);
            setName('');
            setPrice('0');
            setLimit('2000');
            setExcessPrice('15.5');
        }
        setIsFormOpen(true);
    };

    const handleSaveAbono = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;

        const abonoData = {
            id: editingAbono ? editingAbono.id : 'abono-' + Date.now(),
            name,
            price: parseFloat(price) || 0,
            limit: parseInt(limit) || 0,
            excessPrice: parseFloat(excessPrice) || 0
        };

        if (editingAbono) {
            setAbonos(prev => prev.map(a => a.id === editingAbono.id ? abonoData : a));
        } else {
            setAbonos(prev => [...prev, abonoData]);
        }

        setIsFormOpen(false);
    };

    const handleDeleteAbono = (id: string) => {
        if (confirm('¿Está seguro de que desea eliminar este plan de abono?')) {
            setAbonos(prev => prev.filter(a => a.id !== id));
        }
    };

    const filteredAbonos = abonos.filter(a => 
        a.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="relative w-full max-w-sm">
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Buscar plan..."
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-xs text-slate-100 placeholder-slate-500 outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                </div>
                <Button variant="primary" size="sm" onClick={() => handleOpenForm()}>
                    <Plus size={16} className="mr-1.5" /> Crear Plan
                </Button>
            </div>

            <TableContainer>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHeaderCell>ID Plan</TableHeaderCell>
                            <TableHeaderCell>Nombre del Plan</TableHeaderCell>
                            <TableHeaderCell>Abono Base Mensual</TableHeaderCell>
                            <TableHeaderCell>Copias Incluidas</TableHeaderCell>
                            <TableHeaderCell>Precio por Copia Excedente</TableHeaderCell>
                            <TableHeaderCell className="text-right">Acción</TableHeaderCell>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredAbonos.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-8 text-slate-400 text-xs">
                                    No se encontraron planes registrados.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredAbonos.map(a => (
                                <TableRow key={a.id}>
                                    <TableCell className="text-xs font-mono-tabular font-bold text-slate-400">{a.id}</TableCell>
                                    <TableCell className="font-bold text-slate-100">{a.name}</TableCell>
                                    <TableCell className="font-mono-tabular text-xs text-slate-300">{formatCurrency(a.price)}</TableCell>
                                    <TableCell className="font-mono-tabular text-xs text-slate-300">{a.limit.toLocaleString('es-AR')} copias</TableCell>
                                    <TableCell className="font-mono-tabular text-xs font-semibold text-slate-300">{formatCurrency(a.excessPrice)}</TableCell>
                                    <TableCell className="text-right space-x-1.5">
                                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handleOpenForm(a)}>
                                            <Edit size={14} className="text-slate-400 hover:text-slate-200" />
                                        </Button>
                                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handleDeleteAbono(a.id)}>
                                            <Trash2 size={14} className="text-red-400 hover:text-red-200" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </TableContainer>

            {/* Modal: Formulario Plan/Abono */}
            <Modal
                isOpen={isFormOpen}
                onClose={() => setIsFormOpen(false)}
                title={editingAbono ? 'Editar Plan de Abono' : 'Crear Plan de Abono'}
                footer={
                    <>
                        <Button variant="ghost" size="sm" onClick={() => setIsFormOpen(false)}>
                            Cancelar
                        </Button>
                        <Button variant="primary" size="sm" onClick={handleSaveAbono}>
                            Guardar
                        </Button>
                    </>
                }
            >
                <form className="space-y-4" onSubmit={handleSaveAbono}>
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
                </form>
            </Modal>
        </div>
    );
}
