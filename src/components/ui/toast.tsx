'use client';

import React, { useEffect, useState, useRef } from 'react';
import { CheckCircle, XCircle, RefreshCw, WifiOff, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'syncing' | 'offline';

export interface ToastMessage {
    id: string;
    type: ToastType;
    title: string;
    detail?: string;
    duration?: number;
}

interface ToastItemProps {
    toast: ToastMessage;
    onDismiss: (id: string) => void;
}

const COLORS: Record<ToastType, { bg: string; border: string; icon: string; title: string }> = {
    success: { bg: 'rgba(16,185,129,0.13)', border: 'rgba(16,185,129,0.5)', icon: '#10b981', title: '#d1fae5' },
    error:   { bg: 'rgba(239,68,68,0.13)',  border: 'rgba(239,68,68,0.5)',  icon: '#ef4444', title: '#fee2e2' },
    syncing: { bg: 'rgba(99,102,241,0.13)', border: 'rgba(99,102,241,0.4)', icon: '#818cf8', title: '#e0e7ff' },
    offline: { bg: 'rgba(234,179,8,0.13)',  border: 'rgba(234,179,8,0.45)', icon: '#eab308', title: '#fef9c3' },
};

function ToastItem({ toast, onDismiss }: ToastItemProps) {
    const [visible, setVisible] = useState(false);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const colors = COLORS[toast.type];

    useEffect(() => {
        const enterTimer = setTimeout(() => setVisible(true), 10);
        const duration = toast.duration ?? (toast.type === 'syncing' ? 3000 : toast.type === 'error' ? 6000 : 4000);
        if (duration > 0) {
            timerRef.current = setTimeout(() => {
                setVisible(false);
                setTimeout(() => onDismiss(toast.id), 350);
            }, duration);
        }
        return () => {
            clearTimeout(enterTimer);
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [toast.id, toast.type, toast.duration, onDismiss]);

    const Icon = () => {
        if (toast.type === 'success') return <CheckCircle size={18} />;
        if (toast.type === 'error')   return <XCircle size={18} />;
        if (toast.type === 'offline') return <WifiOff size={18} />;
        return <RefreshCw size={16} style={{ animation: 'toast-spin 1s linear infinite' }} />;
    };

    return (
        <div
            role="status"
            aria-live="polite"
            style={{
                display: 'flex', alignItems: 'flex-start', gap: '10px',
                padding: '12px 14px', borderRadius: '10px',
                background: colors.bg, border: `1px solid ${colors.border}`,
                backdropFilter: 'blur(12px)',
                boxShadow: '0 4px 24px rgba(0,0,0,0.35)',
                minWidth: '280px', maxWidth: '360px',
                transform: visible ? 'translateX(0) scale(1)' : 'translateX(110%) scale(0.95)',
                opacity: visible ? 1 : 0,
                transition: 'transform 0.32s cubic-bezier(0.34,1.56,0.64,1), opacity 0.3s ease',
            }}
        >
            <span style={{ color: colors.icon, flexShrink: 0, marginTop: '1px' }}><Icon /></span>
            <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontWeight: 600, fontSize: '13px', color: colors.title, lineHeight: '1.35' }}>
                    {toast.title}
                </p>
                {toast.detail && (
                    <p style={{ margin: '3px 0 0', fontSize: '11.5px', color: 'rgba(255,255,255,0.55)', lineHeight: '1.4', wordBreak: 'break-word' }}>
                        {toast.detail}
                    </p>
                )}
            </div>
            <button
                aria-label="Cerrar"
                onClick={() => { setVisible(false); setTimeout(() => onDismiss(toast.id), 350); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', padding: 0, flexShrink: 0 }}
            >
                <X size={13} />
            </button>
        </div>
    );
}

let _setGlobalToasts: React.Dispatch<React.SetStateAction<ToastMessage[]>> | null = null;

export function showToast(msg: Omit<ToastMessage, 'id'>) {
    if (!_setGlobalToasts) return;
    const id = 'toast-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
    _setGlobalToasts(prev => [...prev.slice(-4), { ...msg, id }]);
}

export function showSaveSuccess(detail?: string) {
    showToast({ type: 'success', title: 'Guardado en la base de datos', detail });
}

export function showSaveError(detail?: string) {
    showToast({ type: 'error', title: 'Error al guardar', detail: detail || 'No se pudo sincronizar el cambio.' });
}

export function showOffline() {
    showToast({ type: 'offline', title: 'Sin conexion', detail: 'Los cambios se guardaran cuando vuelva la conexion.' });
}

export function ToastContainer() {
    const [toasts, setToasts] = useState<ToastMessage[]>([]);

    useEffect(() => {
        _setGlobalToasts = setToasts;
        return () => { _setGlobalToasts = null; };
    }, []);

    const dismiss = React.useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    if (toasts.length === 0) return null;

    return (
        <>
            <style>{`
                @keyframes toast-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
            <div
                aria-label="Notificaciones"
                style={{
                    position: 'fixed', bottom: '20px', right: '20px',
                    zIndex: 99999, display: 'flex', flexDirection: 'column',
                    gap: '10px', alignItems: 'flex-end', pointerEvents: 'none',
                }}
            >
                {toasts.map(t => (
                    <div key={t.id} style={{ pointerEvents: 'all' }}>
                        <ToastItem toast={t} onDismiss={dismiss} />
                    </div>
                ))}
            </div>
        </>
    );
}
