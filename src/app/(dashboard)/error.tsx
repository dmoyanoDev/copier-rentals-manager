'use client';

import { useEffect } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

export default function DashboardError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error('Error en sección del Dashboard:', error);
    }, [error]);

    return (
        <div className="flex-1 flex items-center justify-center p-6 bg-slate-50 dark:bg-slate-950/20 rounded-3xl border border-slate-100 dark:border-slate-900 min-h-[400px]">
            <div className="max-w-md w-full text-center space-y-4">
                <div className="mx-auto w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                    <AlertCircle className="w-6 h-6 text-amber-500" />
                </div>
                <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                        Error al cargar la sección
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Hubo un problema al cargar los datos de esta vista. Por favor, reintente.
                    </p>
                </div>
                <button
                    onClick={reset}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-750 text-white dark:text-slate-200 text-xs font-semibold transition-colors shadow-sm"
                >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Reintentar cargar sección
                </button>
            </div>
        </div>
    );
}
