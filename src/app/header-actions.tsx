'use client';

import React from 'react';
import { useManagement } from '@/lib/context';
import { Cloud, CloudOff, RefreshCw, RotateCcw } from 'lucide-react';

const PageHeaderActions: React.FC = () => {
    const { currentMonth, setCurrentMonth, isSyncing, syncError, lastSyncTime, syncFromDatabase, syncQueue, resetSyncAction } = useManagement();

    const pendingCount = syncQueue?.filter((i: any) => i.status === 'pending' || i.status === 'failed').length || 0;
    const syncingCount = syncQueue?.filter((i: any) => i.status === 'syncing').length || 0;

    return (
        <div className="flex items-center gap-3">
            {/* Cloud Database Sync Status Indicator */}
            <button
                onClick={() => syncFromDatabase(null, true)}
                disabled={isSyncing || syncingCount > 0}
                title={
                    isSyncing || syncingCount > 0
                        ? `Sincronizando base de datos Turso... (${syncingCount} cambios en proceso)` 
                        : pendingCount > 0
                        ? `Tienes ${pendingCount} cambio(s) guardado(s) localmente pendientes de sincronizar con el servidor.`
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

            {/* Manual Sync Queue Reset Option */}
            {pendingCount > 0 && (
                <button
                    onClick={async () => {
                        if (window.confirm("¿Deseas restablecer la base de datos local y descargar la información limpia de la nube? Se descartarán los cambios locales no sincronizados de este dispositivo.")) {
                            await resetSyncAction();
                        }
                    }}
                    disabled={isSyncing}
                    title="Descartar cambios locales pendientes y descargar datos frescos de la nube"
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-red-200 dark:border-red-900/40 bg-red-500/10 hover:bg-red-500/25 transition-all text-[11px] font-semibold text-red-400 select-none cursor-pointer"
                >
                    <RotateCcw size={12} />
                    <span>Restablecer</span>
                </button>
            )}

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
        </div>
    );
};

export default PageHeaderActions;
