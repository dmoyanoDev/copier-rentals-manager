import React from 'react';
import { ManagementProvider } from "@/lib/context";
import Sidebar from "@/components/ui/sidebar";
import LiveClock from "@/components/shared/live-clock";
import PageHeaderActions from "../header-actions";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ManagementProvider>
      <div className="min-h-screen flex flex-col md:flex-row">
        {/* Responsive Sidebar component */}
        <Sidebar />

        {/* Main Content Workspace */}
        <div className="flex-1 flex flex-col min-w-0 md:pl-20 xl:pl-64 pb-16 md:pb-0">
          {/* Main Topbar Header */}
          <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-6 py-5 border-b border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/40 backdrop-blur-md sticky top-0 z-30">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white" id="page-title">
                Panel de Control
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1" id="page-subtitle">
                Información y rendimiento general de alquileres
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 md:self-end">
              {/* Real-time Clock widget */}
              <LiveClock />
              {/* Dynamic month selector */}
              <PageHeaderActions />
            </div>
          </header>

          {/* Main workspace container */}
          <main className="flex-1 p-6 max-w-[1600px] w-full mx-auto">
            {children}
          </main>
        </div>
      </div>
    </ManagementProvider>
  );
}
