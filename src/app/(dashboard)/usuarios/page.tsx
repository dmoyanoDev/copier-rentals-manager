'use client';

import React, { useState, useEffect } from 'react';
import { TableContainer, Table, TableHeader, TableRow, TableHeaderCell, TableBody, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Modal } from '@/components/ui/modal';
import { Plus, Edit, ShieldAlert, Check, X, Shield, RefreshCw } from 'lucide-react';
import { getUsers, createUser, updateUser, ApiUser } from '@/lib/api/users';
import { logger } from '@/lib/logger';

export default function UsersPage() {
  const [usersList, setUsersList] = useState<ApiUser[]>([]);
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [apiError, setApiError] = useState<string | null>(null);

  // Modal states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<ApiUser | null>(null);

  // Form inputs
  const [username, setUsername] = useState('');
  const [fullname, setFullname] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'administrativo' | 'tecnico' | 'master'>('tecnico');
  const [isActive, setIsActive] = useState<boolean>(true);
  const [formError, setFormError] = useState<string | null>(null);

  async function checkAuthAndFetchUsers() {
    try {
      setIsLoading(true);
      setApiError(null);

      // 1. Verificar si es el usuario master
      const meRes = await fetch('/api/auth/me');
      const meData = await meRes.json();
      
      if (!meRes.ok || !meData.authenticated || !meData.user?.permissions?.isMaster) {
        setIsAuthorized(false);
        setIsLoading(false);
        return;
      }

      setIsAuthorized(true);

      // 2. Fetch users list
      const data = await getUsers();
      setUsersList(data);
    } catch (err: any) {
      logger.error('Error al inicializar la pantalla de usuarios:', err);
      setApiError(err.message || 'Error de red al intentar conectar.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    checkAuthAndFetchUsers();
  }, []);

  const handleOpenForm = (user: ApiUser | null = null) => {
    setFormError(null);
    if (user) {
      setEditingUser(user);
      setUsername(user.username);
      setFullname(user.fullname);
      setEmail(user.email);
      setPhone(user.phone || '');
      setPassword('');
      setRole(user.role as any);
      setIsActive(user.active === 1);
    } else {
      setEditingUser(null);
      setUsername('');
      setFullname('');
      setEmail('');
      setPhone('');
      setPassword('');
      setRole('tecnico');
      setIsActive(true);
    }
    setIsFormOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!username.trim() || !fullname.trim() || !email.trim()) {
      setFormError('Por favor complete todos los campos obligatorios.');
      return;
    }

    if (!editingUser && !password) {
      setFormError('La contraseña es requerida para nuevos usuarios.');
      return;
    }

    const payload: any = {
      username: username.trim(),
      fullname: fullname.trim(),
      email: email.trim(),
      phone: phone.trim() || null,
      role,
      active: isActive ? 1 : 0,
    };

    if (password) {
      payload.password = password;
    }

    try {
      if (editingUser) {
        await updateUser(editingUser.id, payload);
      } else {
        await createUser(payload);
      }

      // Refresh list
      const data = await getUsers();
      setUsersList(data);
      setIsFormOpen(false);
    } catch (err: any) {
      setFormError(err.message || 'Error al guardar el usuario.');
    }
  };

  const handleToggleActive = async (user: ApiUser) => {
    if (user.username === 'dmoyano') {
      alert('El usuario maestro dmoyano no puede ser desactivado.');
      return;
    }

    const nextActive = user.active === 1 ? 0 : 1;
    const confirmMsg = nextActive === 0 
      ? `¿Está seguro de que desea desactivar al usuario ${user.fullname}? Ya no podrá iniciar sesión.`
      : `¿Desea reactivar al usuario ${user.fullname}?`;

    if (!confirm(confirmMsg)) return;

    try {
      await updateUser(user.id, { active: nextActive });
      setUsersList(prev => prev.map(u => u.id === user.id ? { ...u, active: nextActive } : u));
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-400 text-xs font-semibold animate-pulse">Validando credenciales de seguridad...</p>
      </div>
    );
  }

  if (isAuthorized === false) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center max-w-lg mx-auto space-y-4 animate-fade-in">
        <div className="p-4 bg-red-950/40 border border-red-900 rounded-full text-red-500">
          <ShieldAlert size={48} />
        </div>
        <h2 className="text-xl font-bold text-slate-100">Acceso Restringido</h2>
        <p className="text-xs text-slate-400 leading-relaxed">
          Esta sección está protegida bajo estándares estrictos de seguridad multi-rol. 
          Solo el **Usuario Maestro (dmoyano)** posee los privilegios necesarios para listar, crear o modificar cuentas administrativas.
        </p>
      </div>
    );
  }

  if (apiError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center max-w-lg mx-auto space-y-6 animate-fade-in">
        <div className="p-4 bg-red-950/40 border border-red-900 rounded-full text-red-500">
          <ShieldAlert size={48} />
        </div>
        <h2 className="text-xl font-bold text-slate-100">Error al Cargar Usuarios</h2>
        <p className="text-xs text-slate-400 leading-relaxed">
          ⚠️ {apiError}
        </p>
        <Button variant="primary" size="sm" onClick={checkAuthAndFetchUsers} className="flex items-center gap-1.5 font-semibold">
          <RefreshCw size={14} /> Reintentar Conexión
        </Button>
      </div>
    );
  }

  const filteredUsers = usersList.filter(u =>
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
              <TableHeaderCell>Estado</TableHeaderCell>
              <TableHeaderCell>Rol Asignado</TableHeaderCell>
              <TableHeaderCell className="text-right">Acción</TableHeaderCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-slate-400 text-xs">
                  No se encontraron usuarios registrados.
                </TableCell>
              </TableRow>
            ) : (
              filteredUsers.map(u => (
                <TableRow key={u.id}>
                  <TableCell className="font-mono text-xs font-bold text-slate-350 flex items-center gap-1.5">
                    {u.username === 'dmoyano' && <Shield size={12} className="text-emerald-500" />}
                    {u.username}
                  </TableCell>
                  <TableCell className="font-bold text-slate-100">{u.fullname}</TableCell>
                  <TableCell className="text-xs text-slate-400">{u.email}</TableCell>
                  <TableCell className="text-xs text-slate-300">{u.phone || 'Sin Celular'}</TableCell>
                  <TableCell className="text-xs">
                    <button
                      onClick={() => handleToggleActive(u)}
                      disabled={u.username === 'dmoyano'}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors ${
                        u.active === 1
                          ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                          : 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                      } ${u.username === 'dmoyano' ? 'cursor-not-allowed opacity-90' : ''}`}
                    >
                      {u.active === 1 ? (
                        <>
                          <Check size={10} /> Activo
                        </>
                      ) : (
                        <>
                          <X size={10} /> Inactivo
                        </>
                      )}
                    </button>
                  </TableCell>
                  <TableCell className="text-xs">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      u.role === 'master' 
                        ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' 
                        : u.role === 'tecnico' 
                        ? 'bg-amber-500/10 text-amber-400' 
                        : 'bg-indigo-500/10 text-indigo-400'
                    }`}>
                      {u.role.toUpperCase()}
                    </span>
                  </TableCell>
                  <TableCell className="text-right space-x-1.5">
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handleOpenForm(u)}>
                      <Edit size={14} className="text-slate-400 hover:text-slate-200" />
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
        title={editingUser ? `Editar Usuario: ${username}` : 'Nuevo Usuario'}
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
          
          <Input
            label={editingUser ? 'Nueva Contraseña (Dejar vacío para no cambiar)' : 'Contraseña *'}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mínimo 8 caracteres, 1 mayúscula, 1 número y 1 especial"
            required={!editingUser}
          />

          <Select
            label="Rol Asignado"
            value={role}
            onChange={(e) => setRole(e.target.value as any)}
            disabled={editingUser?.username === 'dmoyano'}
            options={[
              { value: 'tecnico', label: 'Técnico / Operario de Campo' },
              { value: 'administrativo', label: 'Administrativo / Facturación' }
            ]}
          />

          {editingUser && editingUser.username !== 'dmoyano' && (
            <div className="flex items-center space-x-2 pt-2">
              <input
                type="checkbox"
                id="formIsActive"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="w-4 h-4 rounded border-slate-800 bg-slate-900 text-emerald-500 focus:ring-emerald-500"
              />
              <label htmlFor="formIsActive" className="text-xs font-semibold text-slate-200 cursor-pointer">
                Cuenta de Usuario Activa
              </label>
            </div>
          )}

          {formError && (
            <div className="p-3 bg-red-950/60 border border-red-800 text-red-300 text-xs font-semibold rounded-lg">
              ⚠️ {formError}
            </div>
          )}
        </form>
      </Modal>
    </div>
  );
}
