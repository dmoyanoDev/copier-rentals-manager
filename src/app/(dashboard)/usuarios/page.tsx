'use client';

import React, { useState } from 'react';
import { useManagement } from '@/lib/context';
import { TableContainer, Table, TableHeader, TableRow, TableHeaderCell, TableBody, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Modal } from '@/components/ui/modal';
import { Plus, Trash2, Edit } from 'lucide-react';

export default function UsersPage() {
    const { users, setUsers } = useManagement();
    const [searchQuery, setSearchQuery] = useState('');
    
    // Modal states
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<any>(null);

    // Form inputs
    const [username, setUsername] = useState('');
    const [fullname, setFullname] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [role, setRole] = useState<'administrativo' | 'tecnico'>('tecnico');

    const handleOpenForm = (user: any = null) => {
        if (user) {
            setEditingUser(user);
            setUsername(user.username);
            setFullname(user.fullname);
            setEmail(user.email);
            setPhone(user.phone || '');
            setRole(user.role || 'tecnico');
        } else {
            setEditingUser(null);
            setUsername('');
            setFullname('');
            setEmail('');
            setPhone('');
            setRole('tecnico');
        }
        setIsFormOpen(true);
    };

    const handleSaveUser = (e: React.FormEvent) => {
        e.preventDefault();
        if (!username.trim() || !fullname.trim() || !email.trim()) return;

        const userData = {
            id: editingUser ? editingUser.id : 'user-' + Date.now(),
            username: username.toLowerCase().trim(),
            fullname,
            email,
            phone,
            role
        };

        if (editingUser) {
            setUsers(prev => prev.map(u => u.id === editingUser.id ? userData : u));
        } else {
            setUsers(prev => [...prev, userData]);
        }

        setIsFormOpen(false);
    };

    const handleDeleteUser = (id: string) => {
        if (confirm('¿Está seguro de que desea eliminar este usuario/operario?')) {
            setUsers(prev => prev.filter(u => u.id !== id));
        }
    };

    const filteredUsers = users.filter(u => 
        u.fullname.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.username.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="relative w-full max-w-sm">
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Buscar usuario o nombre..."
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-xs text-slate-100 placeholder-slate-500 outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                </div>
                <Button variant="primary" size="sm" onClick={() => handleOpenForm()}>
                    <Plus size={16} className="mr-1.5" /> Nuevo Usuario
                </Button>
            </div>

            <TableContainer>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHeaderCell>Usuario</TableHeaderCell>
                            <TableHeaderCell>Nombre Completo</TableHeaderCell>
                            <TableHeaderCell>Email</TableHeaderCell>
                            <TableHeaderCell>Celular / Teléfono</TableHeaderCell>
                            <TableHeaderCell>Rol Asignado</TableHeaderCell>
                            <TableHeaderCell className="text-right">Acción</TableHeaderCell>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredUsers.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-8 text-slate-400 text-xs">
                                    No se encontraron usuarios registrados.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredUsers.map(u => (
                                <TableRow key={u.id}>
                                    <TableCell className="font-mono-tabular text-xs font-bold text-slate-350">{u.username}</TableCell>
                                    <TableCell className="font-bold text-slate-100">{u.fullname}</TableCell>
                                    <TableCell className="text-xs text-slate-400">{u.email}</TableCell>
                                    <TableCell className="text-xs text-slate-300">{u.phone || 'Sin Celular'}</TableCell>
                                    <TableCell className="text-xs">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                            u.role === 'tecnico' ? 'bg-amber-500/10 text-amber-400' : 'bg-indigo-550/10 text-indigo-400'
                                        }`}>
                                            {(u.role || 'administrativo').toUpperCase()}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-right space-x-1.5">
                                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handleOpenForm(u)}>
                                            <Edit size={14} className="text-slate-400 hover:text-slate-200" />
                                        </Button>
                                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handleDeleteUser(u.id)}>
                                            <Trash2 size={14} className="text-red-400 hover:text-red-200" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </TableContainer>

            {/* Modal: Formulario Usuario */}
            <Modal
                isOpen={isFormOpen}
                onClose={() => setIsFormOpen(false)}
                title={editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}
                footer={
                    <>
                        <Button variant="ghost" size="sm" onClick={() => setIsFormOpen(false)}>
                            Cancelar
                        </Button>
                        <Button variant="primary" size="sm" onClick={handleSaveUser}>
                            Guardar
                        </Button>
                    </>
                }
            >
                <form className="space-y-4" onSubmit={handleSaveUser}>
                    <Input
                        label="Nombre de Usuario *"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                        placeholder="Ej: jgomez"
                        disabled={editingUser !== null}
                    />
                    <Input
                        label="Nombre Completo *"
                        value={fullname}
                        onChange={(e) => setFullname(e.target.value)}
                        required
                        placeholder="Ej: Juan Gómez"
                    />
                    <Input
                        label="Email *"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        placeholder="Ej: jgomez@empresa.com"
                    />
                    <Input
                        label="Celular / Teléfono"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="Ej: 11-5432-8765"
                    />
                    <Select
                        label="Rol Asignado"
                        value={role}
                        onChange={(e) => setRole(e.target.value as any)}
                        options={[
                            { value: 'tecnico', label: 'Técnico / Operario de Campo' },
                            { value: 'administrativo', label: 'Administrativo / Facturación' }
                        ]}
                    />
                </form>
            </Modal>
        </div>
    );
}
