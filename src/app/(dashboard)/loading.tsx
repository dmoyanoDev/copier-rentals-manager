import React from 'react';
import { Loader2 } from 'lucide-react';

export default function DashboardLoading() {
    return (
        <div className="flex-1 flex flex-col items-center justify-center p-12 min-h-[400px] space-y-4">
            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 animate-pulse">
                Cargando datos del panel de gestión...
            </p>
        </div>
    );
}
