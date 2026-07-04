'use client';

import React from 'react';
import { useManagement } from '@/lib/context';

const PageHeaderActions: React.FC = () => {
    const { currentMonth, setCurrentMonth } = useManagement();

    return (
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
    );
};

export default PageHeaderActions;
