import Link from 'next/link';
import { Home, FileQuestion } from 'lucide-react';

export default function NotFound() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6">
            <div className="max-w-md w-full text-center space-y-6">
                <div className="mx-auto w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                    <FileQuestion className="w-8 h-8 text-indigo-400" />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-white mb-2">
                        Página no encontrada
                    </h2>
                    <p className="text-sm text-slate-400 leading-relaxed">
                        El recurso o la pantalla que estás intentando buscar no existe o fue movida.
                    </p>
                </div>
                <Link
                    href="/"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors shadow-lg shadow-indigo-900/30"
                >
                    <Home className="w-4 h-4" />
                    Volver al Inicio
                </Link>
            </div>
        </div>
    );
}
