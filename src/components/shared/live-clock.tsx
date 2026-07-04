'use client';

import React, { useState, useEffect } from 'react';

const LiveClock: React.FC = () => {
    const [timeStr, setTimeStr] = useState('');

    useEffect(() => {
        const updateClock = () => {
            const now = new Date();
            const options: Intl.DateTimeFormatOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
            const dateStr = now.toLocaleDateString('es-AR', options);
            const timeVal = now.toLocaleTimeString('es-AR');
            const formattedDate = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);
            setTimeStr(`${formattedDate} - ${timeVal}`);
        };

        updateClock();
        const interval = setInterval(updateClock, 1000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="text-xs font-semibold text-indigo-500 dark:text-indigo-400 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-lg whitespace-nowrap shadow-sm">
            {timeStr}
        </div>
    );
};

export default LiveClock;
