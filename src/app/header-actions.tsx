'use client';

import React, { useState } from 'react';
import { useManagement } from '@/lib/context';
import { Cloud, CloudOff, RefreshCw, RotateCcw } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import type { SyncQueueItem, SyncEntityType, SyncOperation } from '@/domain/types';

const ENTITY_LABELS: Record<SyncEntityType, string> = {
    clients: 'Cliente',
    machines: 'Máquina',
    readings: 'Lectura',
    tickets: 'Ticket',
    abonos: 'Plan/Abono',
    users: 'Usuario',
    rentals: 'Alquiler',
    budgets: 'Presupuesto',
    gestiones: 'Gestión de Cobranza',
    payments: 'Pago',
    cobranzaConfig: 'Config. de Cobranza',
    machinePresets: 'Equipo Preset',
    templates: 'Plantilla de Texto',
    partsCatalog: 'Insumo/Repuesto',
    gastosGenerales: 'Gasto General',
    ventas: 'Venta',
    oficinas: 'Oficina',
    pricingSettings: 'Configuración de Precios',
    dollarSettings: 'Configuración de Dólar',
};

const OPERATION_LABELS: Record<SyncOperation, string> = {
    create: 'Crear',
    update: 'Editar',
    delete: 'Eliminar',
};

// Best-effort human label from whatever the payload happens to carry —
// queue items span 13 different entity shapes, so this is deliberately
// forgiving rather than exhaustive per-entity.
const describeItem = (item: SyncQueueItem): string => {
    const p: any = item.payload || {};
    if (p.name) return p.name;
    if (p.clientNameSnapshot) return p.clientNameSnapshot;
    if (p.clientName) return p.clientName;
    if (p.fullname) return p.fullname;
    if (p.username) return p.username;
    if (p.nombreComercial) return p.nombreComercial;
    if (p.marca || p.modelo) return `${p.marca || ''} ${p.modelo || ''}`.trim();
    if (p.nombre) return p.nombre;
    if (p.brand || p.model) return `${p.brand || ''} ${p.model || ''}${p.serial ? ` (S/N: ${p.serial})` : ''}`.trim();
    if (p.receiptNumber) return p.receiptNumber;
    if (p.numero) return p.numero;
    if (p.month) return `Período ${p.month}`;
    return item.entityId;
};

const PendingItemsList: React.FC<{ items: SyncQueueItem[] }> = ({ items }) => (
    <div className="space-y-2">
        {items.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-3 p-2.5 bg-slate-950/50 border border-slate-800 rounded-lg text-xs">
                <div className="min-w-0">
                    <div className="font-semibold text-slate-200 truncate">
                        {ENTITY_LABELS[item.entityType] || item.entityType} · {OPERATION_LABELS[item.operation] || item.operation}
                    </div>
                    <div className="text-slate-450 truncate">{describeItem(item)}</div>
                </div>
                {item.status === 'failed' ? (
                    <span className="shrink-0 px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/10 text-red-400 border border-red-500/20">
                        Error ({item.retryCount} intento{item.retryCount === 1 ? '' : 's'})
                    </span>
                ) : (
                    <span className="shrink-0 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        Pendiente
                    </span>
                )}
            </div>
        ))}
    </div>
);

const PageHeaderActions: React.FC = () => {
    const { currentMonth, setCurrentMonth, isSyncing, syncError, lastSyncTime, syncFromDatabase, syncQueue, resetSyncAction } = useManagement();
    const [showPendingModal, setShowPendingModal] = useState(false);
    const [showResetModal, setShowResetModal] = useState(false);
    const [isResetting, setIsResetting] = useState(false);

    const pendingItems = (syncQueue?.filter((i: any) => i.status === 'pending' || i.status === 'failed') || []) as SyncQueueItem[];
    const pendingCount = pendingItems.length;
    const syncingCount = syncQueue?.filter((i: any) => i.status === 'syncing').length || 0;

    const handleConfirmReset = async () => {
        setIsResetting(true);
        try {
            await resetSyncAction();
        } finally {
            setIsResetting(false);
            setShowResetModal(false);
        }
    };

    return (
        <div className="flex items-center gap-3">
            {/* Cloud Database Sync Status Indicator */}
            <button
                onClick={() => pendingCount > 0 ? setShowPendingModal(true) : syncFromDatabase(null, true)}
                disabled={isSyncing || syncingCount > 0}
                title={
                    isSyncing || syncingCount > 0
                        ? `Sincronizando base de datos Turso... (${syncingCount} cambios en proceso)`
                        : pendingCount > 0
                        ? `Tienes ${pendingCount} cambio(s) guardado(s) localmente pendientes de sincronizar. Click para ver cuáles.`
                        : syncError === 'UNAUTHORIZED'
                        ? 'Tu sesión ha expirado por seguridad. Por favor, vuelve a iniciar sesión.'
                        : syncError === 'DB_ERROR'
                        ? 'No se pudo conectar al servidor de base de datos Turso en la nube.'
                        : syncError === 'OFFLINE'
                        ? `Sin conexión a Internet. Trabajando offline.${lastSyncTime ? ` Última sincronización: ${lastSyncTime.toLocaleTimeString('es-AR')}` : ''}`
                        : lastSyncTime
                        ? `Última sincronización: ${lastSyncTime.toLocaleDateString('es-AR')} ${lastSyncTime.toLocaleTimeString('es-AR')}`
                        : 'Sincronizar ahora con la nube'
                }
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-850 bg-slate-900/10 hover:bg-slate-900/20 dark:bg-slate-950 dark:hover:bg-slate-900/60 transition-all text-[11px] font-semibold text-slate-400 select-none cursor-pointer"
            >
                {isSyncing || syncingCount > 0 ? (
                    <>
                        <RefreshCw size={12} className="animate-spin text-indigo-400" />
                        <span>Sincronizando{syncingCount > 0 ? ` (${syncingCount})` : ''}...</span>
                    </>
                ) : pendingCount > 0 ? (
                    <>
                        <CloudOff size={12} className="text-amber-500 animate-pulse" />
                        <span className="text-amber-400">Pendiente ({pendingCount})</span>
                    </>
                ) : syncError === 'UNAUTHORIZED' ? (
                    <>
                        <CloudOff size={12} className="text-red-500 animate-pulse" />
                        <span className="text-red-400">Sesión Expirada</span>
                    </>
                ) : syncError === 'DB_ERROR' ? (
                    <>
                        <CloudOff size={12} className="text-red-500 animate-pulse" />
                        <span className="text-red-400">Error de Base de Datos</span>
                    </>
                ) : syncError === 'OFFLINE' ? (
                    <>
                        <CloudOff size={12} className="text-amber-500 animate-pulse" />
                        <span className="text-amber-500">Sin Conexión</span>
                    </>
                ) : lastSyncTime ? (
                    <>
                        <Cloud size={12} className="text-emerald-500" />
                        <span className="text-emerald-400">Sincronizado con la nube</span>
                    </>
                ) : (
                    <>
                        <CloudOff size={12} className="text-slate-500" />
                        <span className="text-slate-400">Mostrando copia local</span>
                    </>
                )}
            </button>

            {/* Full resync — always available, not just when there's something pending to
                discard. Antes esto solo aparecía con pendingCount > 0, así que si el único
                problema de un dispositivo era del lado de la DESCARGA (su copia local quedó
                vieja, pero no tenía nada propio atascado para subir), no había ningún botón
                para pedirle una copia fresca — el único recurso terminaba siendo borrar el
                caché del navegador a mano. */}
            <button
                onClick={() => setShowResetModal(true)}
                disabled={isSyncing}
                title={pendingCount > 0 ? 'Ver qué se va a descartar y traer una copia fresca de la nube' : 'Forzar una copia fresca y completa de todos los datos desde la nube'}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border transition-all text-[11px] font-semibold select-none cursor-pointer ${
                    pendingCount > 0
                        ? 'border-red-200 dark:border-red-900/40 bg-red-500/10 hover:bg-red-500/25 text-red-400'
                        : 'border-slate-200 dark:border-slate-850 bg-slate-900/10 hover:bg-slate-900/20 dark:bg-slate-950 dark:hover:bg-slate-900/60 text-slate-400'
                }`}
            >
                <RotateCcw size={12} />
                <span>{pendingCount > 0 ? 'Restablecer' : 'Forzar Sincronización'}</span>
            </button>

            <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 shadow-sm text-xs">
                <span className="font-semibold text-slate-500 dark:text-slate-400">Mes de gestión:</span>
                <input
                    type="month"
                    value={currentMonth}
                    onChange={(e) => setCurrentMonth(e.target.value)}
                    className="bg-transparent text-slate-800 dark:text-slate-100 font-bold border-none outline-none focus:ring-0 cursor-pointer"
                    style={{ colorScheme: 'dark' }}
                />
            </div>

            {/* What's pending — informational only */}
            <Modal
                isOpen={showPendingModal}
                onClose={() => setShowPendingModal(false)}
                title={`Cambios Pendientes de Sincronizar (${pendingCount})`}
                footer={
                    <>
                        <Button variant="ghost" size="sm" onClick={() => setShowPendingModal(false)}>Cerrar</Button>
                        <Button
                            variant="primary"
                            size="sm"
                            onClick={() => { syncFromDatabase(null, true); setShowPendingModal(false); }}
                        >
                            Reintentar Ahora
                        </Button>
                    </>
                }
            >
                <div className="space-y-3">
                    <p className="text-xs text-slate-400">
                        Estos cambios se guardaron en este dispositivo pero todavía no llegaron a la nube.
                        Si hay conexión, se reintentan solos automáticamente cada pocos segundos.
                    </p>
                    {pendingCount === 0 ? (
                        <p className="text-xs text-slate-500 italic">No hay cambios pendientes.</p>
                    ) : (
                        <PendingItemsList items={pendingItems} />
                    )}
                </div>
            </Modal>

            {/* Full resync — explain before doing anything, copy adapts to whether there's
                anything local that would actually get discarded. */}
            <Modal
                isOpen={showResetModal}
                onClose={() => !isResetting && setShowResetModal(false)}
                title={pendingCount > 0 ? 'Restablecer Base de Datos Local' : 'Forzar Sincronización Completa'}
                footer={
                    <>
                        <Button variant="ghost" size="sm" onClick={() => setShowResetModal(false)} disabled={isResetting}>Cancelar</Button>
                        <Button variant={pendingCount > 0 ? 'danger' : 'primary'} size="sm" onClick={handleConfirmReset} disabled={isResetting}>
                            {isResetting ? 'Sincronizando...' : pendingCount > 0 ? 'Sí, Restablecer' : 'Sí, Traer Copia Fresca'}
                        </Button>
                    </>
                }
            >
                {pendingCount > 0 ? (
                    <div className="space-y-3">
                        <p className="text-xs text-slate-300">Esta acción va a hacer dos cosas, en este orden:</p>
                        <ol className="text-xs text-slate-300 space-y-1.5 list-decimal list-inside">
                            <li><span className="font-semibold text-red-400">Descartar</span> los {pendingCount} cambio(s) locales de abajo — no se van a volver a intentar guardar.</li>
                            <li><span className="font-semibold text-emerald-400">Descargar</span> una copia fresca y completa de todos los datos desde la nube, reemplazando lo que este dispositivo tenía guardado localmente.</li>
                        </ol>
                        <p className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg p-2.5">
                            Usá esto solo si sabés que estos cambios ya no son necesarios (por ejemplo, se cargaron con datos de prueba, o la información ya se guardó desde otro dispositivo). Esta acción no se puede deshacer.
                        </p>
                        <div>
                            <p className="text-[10px] uppercase font-bold text-slate-500 mb-1.5">Se va a descartar:</p>
                            <PendingItemsList items={pendingItems} />
                        </div>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <p className="text-xs text-slate-300">
                            Va a descargar una copia fresca y completa de todos los datos desde la nube, reemplazando lo que este dispositivo tiene guardado localmente.
                        </p>
                        <p className="text-xs text-slate-400 bg-slate-950/40 border border-slate-800 rounded-lg p-2.5">
                            Usalo si sospechás que esta pantalla no está reflejando un cambio reciente hecho desde otro dispositivo. No tenés cambios propios pendientes de guardar, así que no se pierde nada.
                        </p>
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default PageHeaderActions;
