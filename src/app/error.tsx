'use client';

import { useEffect } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error('Error global de aplicación:', error);
    }, [error]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6">
            <div className="max-w-md w-full text-center space-y-6">
                <div className="mx-auto w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                    <AlertCircle className="w-8 h-8 text-red-400" />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-white mb-2">
                        Algo salió mal
                    </h2>
                    <p className="text-sm text-slate-400 leading-relaxed">
                        Ocurrió un error inesperado en la aplicación.
                        {error.digest && (
                            <span className="block mt-1 text-xs text-slate-500 font-mono">
                                Código: {error.digest}
                            </span>
                        )}
                    </p>
                </div>
                <button
                    onClick={reset}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors shadow-lg shadow-indigo-900/30"
                >
                    <RefreshCw className="w-4 h-4" />
                    Reintentar
                </button>
                <p className="text-xs text-slate-500">
                    Si el problema persiste, recargá la página o contactá a soporte.
                </p>
            </div>
        </div>
    );
}
