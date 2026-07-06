'use client';

import React from 'react';
import { useManagement } from '@/lib/context';
import { Cloud, CloudOff, RefreshCw } from 'lucide-react';

const PageHeaderActions: React.FC = () => {
    const { currentMonth, setCurrentMonth, isSyncing, syncError, lastSyncTime, syncFromDatabase } = useManagement();

    return (
        <div className="flex items-center gap-3">
            {/* Cloud Database Sync Status Indicator */}
            <button
                onClick={() => syncFromDatabase()}
                disabled={isSyncing}
                title={syncError ? syncError : lastSyncTime ? `Sincronizado: ${lastSyncTime.toLocaleTimeString('es-AR')}` : 'Sincronizar ahora'}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-850 bg-slate-900/10 hover:bg-slate-900/20 dark:bg-slate-950 dark:hover:bg-slate-900/60 transition-all text-[11px] font-semibold text-slate-400 select-none cursor-pointer"
            >
                {isSyncing ? (
                    <>
                        <RefreshCw size={12} className="animate-spin text-indigo-400" />
                        <span>Sincronizando...</span>
                    </>
                ) : syncError ? (
                    <>
                        <CloudOff size={12} className="text-amber-500 animate-pulse" />
                        <span className="text-amber-500">Sin Conexión</span>
                    </>
                ) : (
                    <>
                        <Cloud size={12} className="text-emerald-500" />
                        <span className="text-slate-300">Sincronizado</span>
                    </>
                )}
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
        </div>
    );
};

export default PageHeaderActions;
