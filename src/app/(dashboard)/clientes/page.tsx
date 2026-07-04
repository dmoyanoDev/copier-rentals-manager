'use client';

import React, { useState } from 'react';
import { useManagement } from '@/lib/context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TableContainer, Table, TableHeader, TableRow, TableHeaderCell, TableBody, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Modal } from '@/components/ui/modal';
import { formatCurrency } from '@/lib/utils';
import { Plus, Trash2, Edit, FileText, User } from 'lucide-react';

export default function ClientsPage() {
    const { clients, setClients, machines } = useManagement();
    const [searchQuery, setSearchQuery] = useState('');
    
    // Modal states
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [editingClient, setEditingClient] = useState<any>(null);
    const [selectedClient, setSelectedClient] = useState<any>(null);

    // Form inputs
    const [name, setName] = useState('');
    const [cuit, setCuit] = useState('');
    const [taxCategory, setTaxCategory] = useState<'Responsable Inscripto' | 'Monotributista' | 'Exento'>('Responsable Inscripto');
    const [address, setAddress] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [debt, setDebt] = useState('0');

    const handleOpenForm = (client: any = null) => {
        if (client) {
            setEditingClient(client);
            setName(client.name);
            setCuit(client.cuit);
            setTaxCategory(client.taxCategory || 'Responsable Inscripto');
            setAddress(client.address || '');
            setPhone(client.phone || '');
            setEmail(client.email || '');
            setDebt(String(client.debt || 0));
        } else {
            setEditingClient(null);
            setName('');
            setCuit('');
            setTaxCategory('Responsable Inscripto');
            setAddress('');
            setPhone('');
            setEmail('');
            setDebt('0');
        }
        setIsFormOpen(true);
    };

    const handleSaveClient = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;

        const clientData = {
            id: editingClient ? editingClient.id : 'client-' + Date.now(),
            name,
            cuit,
            taxCategory,
            address,
            phone,
            email,
            debt: parseFloat(debt) || 0
        };

        if (editingClient) {
            setClients(prev => prev.map(c => c.id === editingClient.id ? clientData : c));
        } else {
            setClients(prev => [...prev, clientData]);
        }

        setIsFormOpen(false);
    };

    const handleDeleteClient = (id: string) => {
        if (confirm('¿Está seguro de que desea eliminar este cliente?')) {
            setClients(prev => prev.filter(c => c.id !== id));
        }
    };

    const handleOpenDetail = (client: any) => {
        setSelectedClient(client);
        setIsDetailOpen(true);
    };

    const filteredClients = clients.filter(c => 
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.cuit.includes(searchQuery)
    );

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="relative w-full max-w-sm">
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Buscar por cliente o CUIT..."
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-xs text-slate-100 placeholder-slate-500 outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                </div>
                <Button variant="primary" size="sm" onClick={() => handleOpenForm()}>
                    <Plus size={16} className="mr-1.5" /> Nuevo Cliente
                </Button>
            </div>

            <TableContainer>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHeaderCell>Cliente</TableHeaderCell>
                            <TableHeaderCell>CUIT</TableHeaderCell>
                            <TableHeaderCell>Categoría Fiscal</TableHeaderCell>
                            <TableHeaderCell>Dirección</TableHeaderCell>
                            <TableHeaderCell>Contacto</TableHeaderCell>
                            <TableHeaderCell>Deuda Pendiente</TableHeaderCell>
                            <TableHeaderCell className="text-right">Acción</TableHeaderCell>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredClients.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center py-8 text-slate-400 text-xs">
                                    No se encontraron clientes registrados.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredClients.map(c => {
                                return (
                                    <TableRow key={c.id}>
                                        <TableCell className="font-bold text-slate-100">{c.name}</TableCell>
                                        <TableCell className="font-mono-tabular text-xs text-slate-300">{c.cuit}</TableCell>
                                        <TableCell className="text-xs text-slate-300">{c.taxCategory}</TableCell>
                                        <TableCell className="text-xs text-slate-400 max-w-[200px] truncate">{c.address}</TableCell>
                                        <TableCell className="text-xs text-slate-300">
                                            <span className="block font-semibold">{c.phone || 'N/A'}</span>
                                            <span className="text-slate-400 text-[10px] block">{c.email || 'N/A'}</span>
                                        </TableCell>
                                        <TableCell className="font-mono-tabular text-xs">
                                            <span className={(c.debt || 0) > 0 ? "text-red-500 font-extrabold" : "text-emerald-500 font-semibold"}>
                                                {(c.debt || 0) > 0 ? formatCurrency(c.debt) : 'Sin Deuda'}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right space-x-1.5">
                                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handleOpenDetail(c)}>
                                                <FileText size={14} className="text-slate-400 hover:text-slate-200" />
                                            </Button>
                                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handleOpenForm(c)}>
                                                <Edit size={14} className="text-slate-400 hover:text-slate-200" />
                                            </Button>
                                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handleDeleteClient(c.id)}>
                                                <Trash2 size={14} className="text-red-400 hover:text-red-200" />
                                            </Button>
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
                    <>
                        <Button variant="ghost" size="sm" onClick={() => setIsFormOpen(false)}>
                            Cancelar
                        </Button>
                        <Button variant="primary" size="sm" onClick={handleSaveClient}>
                            Guardar
                        </Button>
                    </>
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
                        label="CUIT / CUIL"
                        value={cuit}
                        onChange={(e) => setCuit(e.target.value)}
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
                    <Input
                        label="Deuda Inicial ($)"
                        type="number"
                        value={debt}
                        onChange={(e) => setDebt(e.target.value)}
                        placeholder="0"
                    />
                </form>
            </Modal>

            {/* Modal: Detalle de Cliente / Expediente */}
            <Modal
                isOpen={isDetailOpen}
                onClose={() => setIsDetailOpen(false)}
                title="Expediente del Cliente"
                footer={
                    <Button variant="secondary" size="sm" onClick={() => setIsDetailOpen(false)}>
                        Cerrar
                    </Button>
                }
            >
                {selectedClient && (
                    <div className="space-y-6">
                        <div className="border-b border-slate-800 pb-4">
                            <h4 className="text-base font-bold text-slate-100">{selectedClient.name}</h4>
                            <p className="text-xs text-slate-400 mt-1">CUIT: {selectedClient.cuit || 'N/A'} | {selectedClient.taxCategory}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-xs">
                            <div>
                                <span className="text-slate-500 font-bold block">CONTACTO</span>
                                <span className="text-slate-300 block mt-1">{selectedClient.phone || 'N/A'}</span>
                                <span className="text-slate-400 block">{selectedClient.email || 'N/A'}</span>
                            </div>
                            <div>
                                <span className="text-slate-500 font-bold block">DIRECCIÓN</span>
                                <span className="text-slate-300 block mt-1">{selectedClient.address || 'Sin dirección registrada'}</span>
                            </div>
                        </div>
                        <div className="border-t border-slate-800 pt-4">
                            <span className="text-slate-500 font-bold block text-xs mb-3">EQUIPOS ASIGNADOS</span>
                            {machines.filter(m => m.clientId === selectedClient.id).length === 0 ? (
                                <p className="text-xs text-slate-400">Sin equipos alquilados en este momento.</p>
                            ) : (
                                <div className="space-y-2">
                                    {machines.filter(m => m.clientId === selectedClient.id).map(m => (
                                        <div key={m.id} className="p-3 bg-slate-950/40 border border-slate-800 rounded-lg text-xs flex justify-between items-center">
                                            <div>
                                                <span className="font-bold text-slate-200 block">{m.brand} {m.model}</span>
                                                <span className="text-[10px] text-slate-500">Serie: {m.serial} | {m.type}</span>
                                            </div>
                                            <span className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 font-semibold text-[10px]">
                                                {m.status}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
}
