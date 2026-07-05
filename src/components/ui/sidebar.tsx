'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useManagement } from '@/lib/context';
import { cn } from '@/lib/utils';

export const Sidebar: React.FC = () => {
    const pathname = usePathname();
    const { currentUser, setCurrentUser, users } = useManagement();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const menuItems = [
        {
            label: 'Panel de Control',
            href: '/',
            icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
            )
        },
        {
            label: 'Alquileres',
            href: '/alquileres',
            icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
            )
        },
        {
            label: 'Lecturas y Facturas',
            href: '/lecturas',
            icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            )
        },
        {
            label: 'Historial',
            href: '/historial',
            icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            )
        },
        {
            label: 'Clientes',
            href: '/clientes',
            icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
            )
        },
        {
            label: 'Máquinas',
            href: '/maquinas',
            icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                </svg>
            )
        },
        {
            label: 'Abonos (Planes)',
            href: '/abonos',
            icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" strokeWidth={2} />
                    <line x1="16" y1="2" x2="16" y2="6" strokeWidth={2} />
                    <line x1="8" y1="2" x2="8" y2="6" strokeWidth={2} />
                    <line x1="3" y1="10" x2="21" y2="10" strokeWidth={2} />
                </svg>
            )
        },
        {
            label: 'Presupuestos',
            href: '/presupuestos',
            icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
            )
        },
        {
            label: 'Área Técnica',
            href: '/tecnica',
            icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
            )
        },
        {
            label: 'Usuarios',
            href: '/usuarios',
            icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
            )
        },
        {
            label: 'Datos y Respaldo',
            href: '/respaldo',
            icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2 2v-4" />
                    <polyline points="17 8 12 3 7 8" strokeWidth={2} />
                    <line x1="12" y1="3" x2="12" y2="15" strokeWidth={2} />
                </svg>
            )
        }
    ];

    const cycleUser = () => {
        const currentIdx = users.findIndex(u => u.id === currentUser?.id);
        const nextIdx = (currentIdx + 1) % users.length;
        setCurrentUser(users[nextIdx]);
    };

    return (
        <>
            {/* Desktop Sidebar (md breakpoint and up: width 768px+) */}
            <aside className="hidden md:flex flex-col w-64 bg-slate-900 text-slate-300 border-r border-slate-800 h-screen fixed left-0 top-0 z-40">
                <div className="h-16 flex items-center gap-3 px-6 border-b border-slate-800">
                    <div className="w-8 h-8 bg-indigo-650 rounded flex items-center justify-center font-extrabold text-white text-sm shadow-md">
                        M&S
                    </div>
                    <div>
                        <span className="font-bold text-white tracking-wide block text-xs">M&S Tecnología Digital</span>
                        <span className="text-[9px] text-slate-500 font-medium block">CopyRent Manager</span>
                    </div>
                </div>

                <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
                    {menuItems.map(item => {
                        const active = pathname === item.href;
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={cn(
                                    "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-150",
                                    active
                                        ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10"
                                        : "hover:bg-slate-800/60 hover:text-slate-100 text-slate-400"
                                )}
                            >
                                {item.icon}
                                <span>{item.label}</span>
                            </Link>
                        );
                    })}
                </nav>

                {/* Desktop User profile */}
                <div className="p-4 border-t border-slate-800 bg-slate-950/40">
                    <button
                        onClick={cycleUser}
                        className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-800/40 transition-colors text-left group"
                    >
                        <div className="w-9 h-9 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center font-bold text-sm border border-indigo-500/20 group-hover:scale-105 transition-transform">
                            {currentUser?.fullname ? currentUser.fullname.split(' ').map(n => n[0]).join('') : 'U'}
                        </div>
                        <div className="flex-1 min-w-0">
                            <span className="block text-xs font-semibold text-slate-200 truncate leading-none">
                                {currentUser?.fullname}
                            </span>
                            <span className="block text-[10px] text-slate-500 mt-1 capitalize">
                                Rol: {currentUser?.role}
                            </span>
                        </div>
                        <svg className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                        </svg>
                    </button>
                </div>
            </aside>

            {/* Mobile Bottom Bar (screens < 768px: iPhone, Z Fold folded) */}
            <aside className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-slate-900 border-t border-slate-800 z-40 flex items-center justify-around px-2 shadow-2xl">
                {/* 1. Panel de Control */}
                <Link
                    href="/"
                    className={cn(
                        "flex flex-col items-center justify-center gap-1 py-1.5 px-3 rounded-xl transition-all",
                        pathname === '/' ? "text-indigo-400 bg-indigo-950/30 font-semibold" : "text-slate-400"
                    )}
                >
                    <div className="w-5 h-5">
                        {menuItems[0].icon}
                    </div>
                    <span className="text-[9px] font-medium tracking-tight">Inicio</span>
                </Link>

                {/* 2. Área Técnica */}
                <Link
                    href="/tecnica"
                    className={cn(
                        "flex flex-col items-center justify-center gap-1 py-1.5 px-3 rounded-xl transition-all",
                        pathname === '/tecnica' ? "text-indigo-400 bg-indigo-950/30 font-semibold" : "text-slate-400"
                    )}
                >
                    <div className="w-5 h-5">
                        {menuItems[8].icon}
                    </div>
                    <span className="text-[9px] font-medium tracking-tight">Técnica</span>
                </Link>

                {/* 3. Alquileres */}
                <Link
                    href="/alquileres"
                    className={cn(
                        "flex flex-col items-center justify-center gap-1 py-1.5 px-3 rounded-xl transition-all",
                        pathname === '/alquileres' ? "text-indigo-400 bg-indigo-950/30 font-semibold" : "text-slate-400"
                    )}
                >
                    <div className="w-5 h-5">
                        {menuItems[1].icon}
                    </div>
                    <span className="text-[9px] font-medium tracking-tight">Alquileres</span>
                </Link>

                {/* 4. Menú Más (Abre el Drawer) */}
                <button
                    onClick={() => setIsMobileMenuOpen(true)}
                    className="flex flex-col items-center justify-center gap-1 py-1.5 px-3 text-slate-400"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                    <span className="text-[9px] font-medium tracking-tight">Menú</span>
                </button>
            </aside>

            {/* Mobile Glassmorphic Drawer Menu overlay */}
            {isMobileMenuOpen && (
                <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/90 backdrop-blur-md animate-fade-in md:hidden">
                    {/* Drawer Header */}
                    <div className="h-16 flex items-center justify-between px-6 border-b border-slate-850">
                        <div className="flex items-center gap-2">
                            <div className="w-7 h-7 bg-indigo-650 rounded flex items-center justify-center font-extrabold text-white text-xs">
                                M&S
                            </div>
                            <span className="font-bold text-white text-xs">Navegación</span>
                        </div>
                        <button 
                            className="text-slate-400 hover:text-white p-2"
                            onClick={() => setIsMobileMenuOpen(false)}
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* Drawer List */}
                    <div className="flex-1 overflow-y-auto px-6 py-6 space-y-2">
                        {menuItems.map(item => {
                            const active = pathname === item.href;
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    onClick={() => setIsMobileMenuOpen(false)}
                                    className={cn(
                                        "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-150",
                                        active
                                            ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10"
                                            : "hover:bg-slate-800/60 hover:text-slate-100 text-slate-400"
                                    )}
                                >
                                    {item.icon}
                                    <span>{item.label}</span>
                                </Link>
                            );
                        })}
                    </div>

                    {/* Drawer User profile */}
                    <div className="p-6 border-t border-slate-850 bg-slate-950/40 mb-16">
                        <button
                            onClick={() => {
                                cycleUser();
                                setIsMobileMenuOpen(false);
                            }}
                            className="w-full flex items-center gap-3 p-3 rounded-xl bg-slate-900 border border-slate-800 text-left"
                        >
                            <div className="w-8 h-8 rounded bg-indigo-650 text-white font-bold text-xs flex items-center justify-center">
                                {currentUser?.fullname ? currentUser.fullname.split(' ').map(n => n[0]).join('') : 'U'}
                            </div>
                            <div className="flex-1 min-w-0">
                                <span className="block text-xs font-semibold text-slate-200 truncate">
                                    {currentUser?.fullname}
                                </span>
                                <span className="block text-[9px] text-slate-500 mt-0.5 capitalize">
                                    Cambiar Operario (Rol: {currentUser?.role})
                                </span>
                            </div>
                            <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                            </svg>
                        </button>
                    </div>
                </div>
            )}
        </>
    );
};
export default Sidebar;
