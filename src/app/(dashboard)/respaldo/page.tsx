'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useManagement } from '@/lib/context';
import { Card, CardContent } from '@/components/ui/card';
import { TableContainer, Table, TableHeader, TableRow, TableHeaderCell, TableBody, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { 
    Download, Upload, ShieldCheck, Database, FileSpreadsheet, 
    Trash2, AlertTriangle, Play, CheckCircle2, History, Filter, 
    Search, RefreshCw, AlertCircle, Wrench, RefreshCcw
} from 'lucide-react';
import { getAuditLogsAction, addAuditLogAction } from '@/app/actions/audit';
import { diagnoseDataAction, logCleanupOperationAction, DiagnosedIssue } from '@/app/actions/cleanup';

export default function RespaldoPage() {
    const { 
        clients, setClients, 
        machines, setMachines, 
        readings, setReadings, 
        tickets, setTickets, 
        abonos, setAbonos, 
        users, setUsers, 
        rentals, setRentals,
        currentUser 
    } = useManagement();

    // Sub-tab Navigation
    const [currentSubTab, setCurrentSubTab] = useState<'exportar' | 'importar' | 'backup' | 'limpieza' | 'auditoria'>('exportar');

    // -------------------------------------------------------------
    // EXPORT TAB STATE
    // -------------------------------------------------------------
    const [exportModule, setExportModule] = useState<'clientes' | 'maquinas' | 'alquileres' | 'abonos' | 'lecturas' | 'tickets'>('clientes');
    const [exportFormat, setExportFormat] = useState<'csv' | 'json'>('csv');
    const [exportStatusFilter, setExportStatusFilter] = useState('');
    const [isExporting, setIsExporting] = useState(false);

    // -------------------------------------------------------------
    // IMPORT TAB STATE
    // -------------------------------------------------------------
    const [importModule, setImportModule] = useState<'clientes' | 'maquinas' | 'lecturas'>('clientes');
    const [importPreview, setImportPreview] = useState<any[]>([]);
    const [importStats, setImportStats] = useState<any>(null);
    const [importErrors, setImportErrors] = useState<string[]>([]);
    const [importDuplicates, setImportDuplicates] = useState<any[]>([]);
    const [isImporting, setIsImporting] = useState(false);
    const importFileInputRef = useRef<HTMLInputElement>(null);

    // -------------------------------------------------------------
    // BACKUP & RESTORE STATE
    // -------------------------------------------------------------
    const [backupHistory, setBackupHistory] = useState<any[]>([]);
    const [isBackingUp, setIsBackingUp] = useState(false);
    const [isRestoring, setIsRestoring] = useState(false);
    const [restoreConfirmText, setRestoreConfirmText] = useState('');
    const restoreFileInputRef = useRef<HTMLInputElement>(null);

    // -------------------------------------------------------------
    // CLEANUP TAB STATE
    // -------------------------------------------------------------
    const [diagnosedIssues, setDiagnosedIssues] = useState<DiagnosedIssue[]>([]);
    const [selectedIssues, setSelectedIssues] = useState<string[]>([]);
    const [isDiagnosing, setIsDiagnosing] = useState(false);
    const [isCleaning, setIsCleaning] = useState(false);

    // -------------------------------------------------------------
    // AUDIT LOG STATE
    // -------------------------------------------------------------
    const [auditLogs, setAuditLogs] = useState<any[]>([]);
    const [auditSearchQuery, setAuditSearchQuery] = useState('');
    const [auditModuleFilter, setAuditModuleFilter] = useState('');
    const [auditActionFilter, setAuditActionFilter] = useState('');
    const [isLoadingAudit, setIsLoadingAudit] = useState(false);

    // Load Audit Logs and Backups history
    const loadAuditLogs = async () => {
        setIsLoadingAudit(true);
        const res = await getAuditLogsAction();
        if (res.success && res.logs) {
            setAuditLogs(res.logs);
            // Filter logs for backups
            const backups = res.logs.filter((l: any) => l.module === 'datos' && (l.action === 'backup' || l.action === 'restauracion'));
            setBackupHistory(backups);
        }
        setIsLoadingAudit(false);
    };

    useEffect(() => {
        loadAuditLogs();
    }, [currentSubTab]);

    // -------------------------------------------------------------
    // 1. EXPORTATION HANDLER
    // -------------------------------------------------------------
    const handleExport = async () => {
        setIsExporting(true);
        try {
            // Pick corresponding dataset from state
            let targetData: any[] = [];
            if (exportModule === 'clientes') {
                targetData = clients;
            } else if (exportModule === 'maquinas') {
                targetData = machines;
            } else if (exportModule === 'alquileres') {
                targetData = rentals;
            } else if (exportModule === 'abonos') {
                targetData = abonos;
            } else if (exportModule === 'lecturas') {
                targetData = readings;
            } else if (exportModule === 'tickets') {
                targetData = tickets;
            }

            // Apply filters if selected
            if (exportStatusFilter) {
                if (exportModule === 'clientes') {
                    const isActive = exportStatusFilter === 'activo';
                    targetData = targetData.filter(c => isActive ? c.active !== false : c.active === false);
                } else if (exportModule === 'maquinas') {
                    targetData = targetData.filter(m => m.status === exportStatusFilter);
                } else if (exportModule === 'alquileres') {
                    targetData = targetData.filter(r => r.status === exportStatusFilter);
                } else if (exportModule === 'lecturas') {
                    targetData = targetData.filter(rd => rd.status === exportStatusFilter);
                } else if (exportModule === 'tickets') {
                    targetData = targetData.filter(t => t.status === exportStatusFilter);
                }
            }

            const response = await fetch(`/api/export?user=${encodeURIComponent(currentUser?.fullname || 'Administrativo')}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    module: exportModule,
                    format: exportFormat,
                    data: targetData
                })
            });

            if (!response.ok) {
                throw new Error('La respuesta del servidor no fue satisfactoria.');
            }

            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = `export_${exportModule}_${new Date().toISOString().split('T')[0]}.${exportFormat}`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(downloadUrl);

            alert('¡Exportación descargada correctamente!');
        } catch (error: any) {
            console.error(error);
            alert('Error al intentar exportar los datos: ' + error.message);
        } finally {
            setIsExporting(false);
        }
    };

    // -------------------------------------------------------------
    // 2. CSV IMPORT HANDLERS
    // -------------------------------------------------------------
    const handleImportFileSelect = () => {
        importFileInputRef.current?.click();
    };

    const handleImportFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsImporting(true);
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const csvText = event.target?.result as string;
                
                const response = await fetch('/api/import', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        module: importModule,
                        csvText,
                        existingData: { clients, machines, readings }
                    })
                });

                const res = await response.json();
                if (!response.ok) {
                    throw new Error(res.error || 'Error al procesar el archivo CSV.');
                }

                setImportPreview(res.preview || []);
                setImportStats(res.stats || null);
                setImportErrors(res.errors || []);
                setImportDuplicates(res.duplicates || []);
            } catch (err: any) {
                console.error(err);
                alert(err.message || 'Error al validar el CSV.');
                setImportPreview([]);
                setImportStats(null);
                setImportErrors([]);
                setImportDuplicates([]);
            } finally {
                setIsImporting(false);
                if (importFileInputRef.current) importFileInputRef.current.value = '';
            }
        };
        reader.readAsText(file);
    };

    const confirmImport = async () => {
        if (!importPreview.length || isImporting) return;

        const validItems = importPreview.filter(item => item.isValid);
        if (validItems.length === 0) {
            alert('No hay registros válidos para importar en el CSV.');
            return;
        }

        const confirmMsg = importDuplicates.length > 0 
            ? `Se importarán ${validItems.length} registros válidos. Hay duplicados detectados. ¿Desea sobrescribir o ignorar duplicados? Presione Aceptar para unir los datos.`
            : `¿Confirmas la importación de ${validItems.length} registros válidos en el sistema?`;

        if (confirm(confirmMsg)) {
            setIsImporting(true);
            try {
                if (importModule === 'clientes') {
                    setClients(prev => {
                        const filtered = prev.filter(c => !validItems.some(v => v.cuit === c.cuit));
                        const cleanedValids = validItems.map(({ isValid, errors, isDuplicate, ...rest }) => rest);
                        return [...filtered, ...cleanedValids];
                    });
                } else if (importModule === 'maquinas') {
                    setMachines(prev => {
                        const filtered = prev.filter(m => !validItems.some(v => v.serial === m.serial));
                        const cleanedValids = validItems.map(({ isValid, errors, isDuplicate, ...rest }) => rest);
                        return [...filtered, ...cleanedValids];
                    });
                } else if (importModule === 'lecturas') {
                    setReadings(prev => {
                        const filtered = prev.filter(r => !validItems.some(v => v.machineId === r.machineId && v.month === r.month));
                        const cleanedValids = validItems.map(({ isValid, errors, isDuplicate, ...rest }) => rest);
                        return [...filtered, ...cleanedValids];
                    });
                }

                // Log audit action
                await addAuditLogAction({
                    module: 'datos',
                    action: 'importar',
                    details: `Importación CSV para "${importModule.toUpperCase()}" ejecutada exitosamente. Total registros insertados: ${validItems.length}.`,
                    user: currentUser?.fullname || 'Administrativo'
                });

                alert('¡Datos importados y sincronizados correctamente!');
                setImportPreview([]);
                setImportStats(null);
                setImportErrors([]);
                setImportDuplicates([]);
            } catch (err: any) {
                alert('Ocurrió un error al persistir los datos: ' + err.message);
            } finally {
                setIsImporting(false);
            }
        }
    };

    const cancelImportPreview = () => {
        setImportPreview([]);
        setImportStats(null);
        setImportErrors([]);
        setImportDuplicates([]);
    };

    // -------------------------------------------------------------
    // 3. TURSO DATABASE BACKUP & RESTORE
    // -------------------------------------------------------------
    const handleTursoBackup = async () => {
        setIsBackingUp(true);
        try {
            const userFullname = currentUser?.fullname || 'Administrativo';
            const response = await fetch(`/api/backup?user=${encodeURIComponent(userFullname)}`);
            if (!response.ok) {
                throw new Error('Error de comunicación con el Route Handler de backup.');
            }

            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = `turso_backup_${new Date().toISOString().split('T')[0]}_${Date.now()}.json`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(downloadUrl);

            await loadAuditLogs();
            alert('¡Snapshot de base de datos Turso descargado exitosamente!');
        } catch (err: any) {
            console.error(err);
            alert('Ocurrió un error al generar el backup de Turso: ' + err.message);
        } finally {
            setIsBackingUp(false);
        }
    };

    const handleRestoreFileSelect = () => {
        restoreFileInputRef.current?.click();
    };

    const handleRestoreFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const parsed = JSON.parse(event.target?.result as string);
                
                // Confirm dialogs
                if (!parsed.clients || !parsed.machines || !parsed.plans || !parsed.users) {
                    alert('El archivo no parece ser un snapshot válido de base de datos Turso (faltan tablas críticas).');
                    return;
                }

                const warningConfirm = confirm(
                    '⚠️ ¡ATENCIÓN CRÍTICA! Restaurar la base de datos reemplazará permanentemente TODOS los registros actuales (Clientes, Máquinas, Alquileres, Abonos, Lecturas, Tickets y Configuraciones) en la nube de Turso y en tu almacenamiento local. ¿Estás absolutamente seguro de continuar?'
                );

                if (!warningConfirm) return;

                const codeWord = prompt('Para proceder, escribe la palabra "RESTAURAR" en mayúsculas:');
                if (codeWord !== 'RESTAURAR') {
                    alert('Operación cancelada. El código de confirmación no coincide.');
                    return;
                }

                setIsRestoring(true);
                const userFullname = currentUser?.fullname || 'Administrativo';
                const response = await fetch(`/api/backup?user=${encodeURIComponent(userFullname)}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(parsed)
                });

                const res = await response.json();
                if (!response.ok) {
                    throw new Error(res.error || 'Error al restaurar la base de datos Turso.');
                }

                // Sincronizar estado local en React (que luego se autoguarda a localStorage)
                setClients(parsed.clients || []);
                setMachines(parsed.machines || []);
                setReadings(parsed.readings || []);
                setTickets(parsed.tickets || []);
                setAbonos(parsed.plans || parsed.abonos || []);
                setUsers(parsed.users || []);
                if (parsed.rentals) setRentals(parsed.rentals);

                await loadAuditLogs();
                alert('¡Felicidades! La restauración transaccional de Turso y el estado local se completó correctamente.');
            } catch (err: any) {
                console.error(err);
                alert('Error al restaurar la copia de seguridad: ' + err.message);
            } finally {
                setIsRestoring(false);
                if (restoreFileInputRef.current) restoreFileInputRef.current.value = '';
            }
        };
        reader.readAsText(file);
    };

    // -------------------------------------------------------------
    // 4. DIAGNOSIS & CLEANUP HANDLERS
    // -------------------------------------------------------------
    const handleRunDiagnosis = async () => {
        setIsDiagnosing(true);
        try {
            const res = await diagnoseDataAction({
                clients,
                machines,
                readings,
                tickets,
                rentals,
                abonos
            });

            if (res.success && res.issues) {
                setDiagnosedIssues(res.issues);
                setSelectedIssues(res.issues.map(iss => iss.id)); // Select all by default
                alert(`Diagnóstico completado. Se encontraron ${res.issues.length} inconsistencias en el sistema.`);
            } else {
                alert('No se pudo completar el diagnóstico técnico.');
            }
        } catch (err: any) {
            alert('Error en diagnóstico: ' + err.message);
        } finally {
            setIsDiagnosing(false);
        }
    };

    const handleToggleIssueSelect = (id: string) => {
        setSelectedIssues(prev => 
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const handleExecuteCleanup = async () => {
        if (selectedIssues.length === 0) {
            alert('No has seleccionado ninguna anomalía para limpiar.');
            return;
        }

        if (confirm(`¿Estás seguro de que deseas corregir o eliminar los ${selectedIssues.length} registros inconsistentes seleccionados?`)) {
            setIsCleaning(true);
            try {
                const issuesToClean = diagnosedIssues.filter(iss => selectedIssues.includes(iss.id));
                
                let cleanedClients = [...clients];
                let cleanedMachines = [...machines];
                let cleanedReadings = [...readings];
                let cleanedRentals = [...rentals];
                let cleanedTickets = [...tickets];

                // Iterate and apply cleanups
                issuesToClean.forEach(issue => {
                    if (issue.category === 'cliente') {
                        if (issue.type === 'incompleto') {
                            // Auto-repair: set empty fields
                            cleanedClients = cleanedClients.map(c => 
                                c.id === issue.itemId 
                                    ? { ...c, name: c.name || `Cliente Reconstruido ${c.id.substring(c.id.length - 4)}`, cuit: c.cuit || '00-00000000-0' } 
                                    : c
                            );
                        } else {
                            // Delete
                            cleanedClients = cleanedClients.filter(c => c.id !== issue.itemId);
                        }
                    } else if (issue.category === 'maquina') {
                        if (issue.type === 'incompleto') {
                            cleanedMachines = cleanedMachines.map(m => 
                                m.id === issue.itemId 
                                    ? { ...m, brand: m.brand || 'Ricoh', model: m.model || 'Equipo Genérico', serial: m.serial || `SER-${Date.now().toString().substring(8)}` }
                                    : m
                            );
                        } else {
                            // Detach invalid client/abono
                            cleanedMachines = cleanedMachines.map(m => 
                                m.id === issue.itemId 
                                    ? { ...m, clientId: null, abonoId: null, status: 'Disponible' as any }
                                    : m
                            );
                        }
                    } else if (issue.category === 'alquiler') {
                        // Delete invalid contract
                        cleanedRentals = cleanedRentals.filter(r => r.id !== issue.itemId);
                    } else if (issue.category === 'lectura') {
                        // Remove orphan reading
                        cleanedReadings = cleanedReadings.filter(rd => rd.id !== issue.itemId);
                    } else if (issue.category === 'ticket') {
                        // Delete orphan ticket
                        cleanedTickets = cleanedTickets.filter(t => t.id !== issue.itemId);
                    }
                });

                // Update React states
                setClients(cleanedClients);
                setMachines(cleanedMachines);
                setReadings(cleanedReadings);
                setRentals(cleanedRentals);
                setTickets(cleanedTickets);

                // Add audit logging using Server Action
                const logDetails = `Herramienta de limpieza ejecutada. Total anomalías reparadas/eliminadas: ${issuesToClean.length}.`;
                await logCleanupOperationAction(logDetails, currentUser?.fullname || 'Administrativo');

                alert('¡Limpieza ejecutada exitosamente! Tus datos han sido restaurados a un estado consistente.');
                setDiagnosedIssues([]);
                setSelectedIssues([]);
                await loadAuditLogs();
            } catch (err: any) {
                alert('Error al ejecutar la limpieza: ' + err.message);
            } finally {
                setIsCleaning(false);
            }
        }
    };

    // -------------------------------------------------------------
    // AUDIT LOG FILTERING
    // -------------------------------------------------------------
    const filteredAuditLogs = auditLogs.filter(log => {
        const query = auditSearchQuery.toLowerCase();
        const matchesQuery = 
            log.details.toLowerCase().includes(query) ||
            log.user.toLowerCase().includes(query) ||
            log.module.toLowerCase().includes(query) ||
            log.action.toLowerCase().includes(query);

        const matchesModule = !auditModuleFilter || log.module === auditModuleFilter;
        const matchesAction = !auditActionFilter || log.action === auditActionFilter;

        return matchesQuery && matchesModule && matchesAction;
    });

    return (
        <div className="space-y-6 animate-fade-in relative text-slate-100 pb-12">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 border-b border-slate-850 pb-4">
                <div>
                    <h2 className="text-base font-semibold text-slate-100 uppercase tracking-wider">Consola de Datos y Respaldo</h2>
                    <p className="text-[10px] text-slate-400">Exporta tablas en CSV/JSON, importa de forma segura y gestiona respaldos de base de datos Turso.</p>
                </div>
                {/* Navigation tabs */}
                <div className="flex bg-slate-950 p-1.5 rounded-xl border border-slate-850 gap-1.5 text-xs overflow-x-auto max-w-full">
                    <button 
                        onClick={() => setCurrentSubTab('exportar')}
                        className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 shrink-0 ${
                            currentSubTab === 'exportar' ? 'bg-indigo-650 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
                        }`}
                    >
                        <Download size={13} /> Exportar
                    </button>
                    <button 
                        onClick={() => setCurrentSubTab('importar')}
                        className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 shrink-0 ${
                            currentSubTab === 'importar' ? 'bg-indigo-650 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
                        }`}
                    >
                        <Upload size={13} /> Importar CSV
                    </button>
                    <button 
                        onClick={() => setCurrentSubTab('backup')}
                        className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 shrink-0 ${
                            currentSubTab === 'backup' ? 'bg-indigo-650 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
                        }`}
                    >
                        <Database size={13} className="text-emerald-500" /> Backup Turso
                    </button>
                    <button 
                        onClick={() => setCurrentSubTab('limpieza')}
                        className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 shrink-0 ${
                            currentSubTab === 'limpieza' ? 'bg-indigo-650 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
                        }`}
                    >
                        <Wrench size={13} className="text-amber-500" /> Diagnóstico y Limpieza
                    </button>
                    <button 
                        onClick={() => setCurrentSubTab('auditoria')}
                        className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 shrink-0 ${
                            currentSubTab === 'auditoria' ? 'bg-indigo-650 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
                        }`}
                    >
                        <History size={13} /> Auditoría
                    </button>
                </div>
            </div>

            {/* ========================================================================= */}
            {/* SUB-TAB: EXPORTAR */}
            {/* ========================================================================= */}
            {currentSubTab === 'exportar' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start animate-fade-in">
                    <Card className="lg:col-span-1 border-slate-850 bg-slate-950/40">
                        <div className="p-5 border-b border-slate-850">
                            <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                                <Download size={16} className="text-indigo-400" /> Configuración de Exportación
                            </h3>
                        </div>
                        <CardContent className="p-5 space-y-4">
                            <div className="space-y-1">
                                <label className="text-[10px] uppercase font-bold text-slate-500 block">Módulo del Sistema</label>
                                <select 
                                    value={exportModule} 
                                    onChange={(e) => { setExportModule(e.target.value as any); setExportStatusFilter(''); }}
                                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-205 text-xs focus:outline-none"
                                >
                                    <option value="clientes">Clientes</option>
                                    <option value="maquinas">Máquinas / Copiadoras</option>
                                    <option value="alquileres">Alquileres (Contratos)</option>
                                    <option value="abonos">Abonos (Planes)</option>
                                    <option value="lecturas">Lecturas y Facturación</option>
                                    <option value="tickets">Tickets de Soporte Técnico</option>
                                </select>
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] uppercase font-bold text-slate-500 block">Formato de Archivo</label>
                                <div className="grid grid-cols-2 gap-3 pt-1">
                                    <button 
                                        type="button"
                                        onClick={() => setExportFormat('csv')}
                                        className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                                            exportFormat === 'csv' ? 'bg-indigo-650/10 border-indigo-500/40 text-indigo-400' : 'bg-slate-900 border-slate-800 hover:bg-slate-850 text-slate-400'
                                        }`}
                                    >
                                        <FileSpreadsheet size={14} /> Planilla CSV
                                    </button>
                                    <button 
                                        type="button"
                                        onClick={() => setExportFormat('json')}
                                        className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                                            exportFormat === 'json' ? 'bg-indigo-650/10 border-indigo-500/40 text-indigo-400' : 'bg-slate-900 border-slate-800 hover:bg-slate-850 text-slate-400'
                                        }`}
                                    >
                                        <Database size={14} /> Objeto JSON
                                    </button>
                                </div>
                            </div>

                            {/* Conditional filter options */}
                            <div className="space-y-1">
                                <label className="text-[10px] uppercase font-bold text-slate-505 block">Filtros de Estado</label>
                                <select
                                    value={exportStatusFilter}
                                    onChange={(e) => setExportStatusFilter(e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-205 text-xs focus:outline-none"
                                >
                                    <option value="">Exportar todo (Sin filtros)</option>
                                    {exportModule === 'clientes' && (
                                        <>
                                            <option value="activo">Solo Clientes Activos</option>
                                            <option value="inactivo">Solo Clientes de Baja Lógica</option>
                                        </>
                                    )}
                                    {exportModule === 'maquinas' && (
                                        <>
                                            <option value="Disponible">Estado: Disponible</option>
                                            <option value="Alquilada">Estado: Alquilada</option>
                                            <option value="En Taller">Estado: En Taller</option>
                                            <option value="Alerta Técnica">Estado: Alerta Técnica</option>
                                        </>
                                    )}
                                    {exportModule === 'alquileres' && (
                                        <>
                                            <option value="activo">Contratos Activos</option>
                                            <option value="pausado">Contratos Pausados</option>
                                            <option value="finalizado">Contratos Finalizados</option>
                                            <option value="vencido">Contratos Vencidos</option>
                                        </>
                                    )}
                                    {exportModule === 'lecturas' && (
                                        <>
                                            <option value="pending">Estado Pago: Pendiente</option>
                                            <option value="paid">Estado Pago: Pagado</option>
                                        </>
                                    )}
                                    {exportModule === 'tickets' && (
                                        <>
                                            <option value="nuevo">Nuevo</option>
                                            <option value="asignado">Asignado</option>
                                            <option value="en-proceso">En Proceso</option>
                                            <option value="resuelto">Resuelto</option>
                                            <option value="cerrado">Cerrado</option>
                                        </>
                                    )}
                                </select>
                            </div>

                            <Button 
                                variant="primary" 
                                size="md" 
                                className="w-full font-bold shadow-md shadow-indigo-900/10"
                                onClick={handleExport}
                                disabled={isExporting}
                            >
                                <Download size={14} className="mr-2" /> 
                                {isExporting ? 'Generando archivo...' : 'Exportar y Descargar'}
                            </Button>
                        </CardContent>
                    </Card>

                    <div className="lg:col-span-2 space-y-4">
                        <div className="p-5 bg-slate-950/40 border border-slate-850 rounded-xl space-y-3">
                            <h4 className="font-bold text-xs text-indigo-400 uppercase tracking-wider">Notas Técnicas sobre la Exportación</h4>
                            <ul className="text-[10px] text-slate-400 space-y-2 list-disc pl-4 leading-relaxed">
                                <li><strong>Compatibilidad de Excel (BOM)</strong>: La exportación en CSV incorpora la marca de orden de bytes (BOM) UTF-8, garantizando que los acentos y caracteres especiales se dibujen correctamente al abrir el archivo en Microsoft Excel.</li>
                                <li><strong>Trazabilidad en Log</strong>: Cada exportación ejecutada escribe de manera automática una entrada en la bitácora de auditoría histórica, registrando qué módulo y cuántas filas de datos fueron procesadas.</li>
                                <li><strong>Streaming Server-Side</strong>: Los datos reactivos de la aplicación se transmiten de forma comprimida al Route Handler del servidor para estructurar el archivo de forma robusta e impedir bloqueos en el navegador del cliente.</li>
                            </ul>
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* SUB-TAB: IMPORTAR */}
            {/* ========================================================================= */}
            {currentSubTab === 'importar' && (
                <div className="space-y-6 animate-fade-in">
                    {/* Setup Card */}
                    {importPreview.length === 0 ? (
                        <Card className="max-w-md mx-auto border-slate-850 bg-slate-950/40">
                            <div className="p-5 border-b border-slate-850 text-center">
                                <Upload className="w-10 h-10 text-indigo-500 mx-auto mb-2" />
                                <h3 className="font-bold text-sm text-slate-100">Importación de Datos desde CSV</h3>
                                <p className="text-[10px] text-slate-400 mt-1">Sube planillas de clientes, inventario de copiadoras o lecturas mensuales.</p>
                            </div>
                            <CardContent className="p-5 space-y-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] uppercase font-bold text-slate-550 block">Módulo de Destino</label>
                                    <select
                                        value={importModule}
                                        onChange={(e) => setImportModule(e.target.value as any)}
                                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-205 text-xs focus:outline-none"
                                    >
                                        <option value="clientes">Clientes</option>
                                        <option value="maquinas">Copiadoras (Inventario)</option>
                                        <option value="lecturas">Lecturas Mensuales de Copias</option>
                                    </select>
                                </div>

                                <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl text-[10px] text-slate-400 space-y-1.5">
                                    <span className="font-bold block text-slate-300">Columnas Requeridas en el CSV:</span>
                                    {importModule === 'clientes' && (
                                        <code className="block text-indigo-400 bg-slate-955 p-1 rounded font-mono">Nombre, CUIT, Categoria_Iva, Direccion, Telefono, Email, Notas</code>
                                    )}
                                    {importModule === 'maquinas' && (
                                        <code className="block text-indigo-400 bg-slate-955 p-1 rounded font-mono">Marca, Modelo, Serie, Tipo, Estado, Contador, Intervalo_Preventivo, Aplica_Iva</code>
                                    )}
                                    {importModule === 'lecturas' && (
                                        <code className="block text-indigo-400 bg-slate-955 p-1 rounded font-mono">Serie_Copiadora, Mes (AAAA-MM), Inicial, Final, Comentario</code>
                                    )}
                                </div>

                                <input 
                                    type="file" 
                                    ref={importFileInputRef}
                                    onChange={handleImportFileChange}
                                    accept=".csv"
                                    className="hidden"
                                />

                                <Button 
                                    variant="primary" 
                                    size="md" 
                                    className="w-full font-bold"
                                    onClick={handleImportFileSelect}
                                    disabled={isImporting}
                                >
                                    {isImporting ? 'Validando archivo...' : 'Seleccionar Archivo CSV y Validar'}
                                </Button>
                            </CardContent>
                        </Card>
                    ) : (
                        // Import preview state
                        <div className="space-y-6 animate-fade-in">
                            {/* Summary panel */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <Card className="p-4 bg-slate-950 border border-slate-850/60 flex flex-col justify-between">
                                    <span className="text-[10px] text-slate-400 uppercase font-extrabold tracking-wider block">Registros del CSV</span>
                                    <span className="text-xl font-extrabold text-slate-100 block mt-1">{importStats?.total} filas</span>
                                </Card>
                                <Card className="p-4 bg-slate-950 border border-slate-850/60 flex flex-col justify-between">
                                    <span className="text-[10px] text-slate-400 uppercase font-extrabold tracking-wider block">Válidos para Importar</span>
                                    <span className="text-xl font-extrabold text-emerald-400 block mt-1">{importStats?.ready} listos</span>
                                </Card>
                                <Card className="p-4 bg-slate-950 border border-slate-850/60 flex flex-col justify-between">
                                    <span className="text-[10px] text-slate-400 uppercase font-extrabold tracking-wider block">Con Error de Formato</span>
                                    <span className={`text-xl font-extrabold block mt-1 ${importStats?.errors > 0 ? 'text-red-500 animate-pulse' : 'text-slate-400'}`}>
                                        {importStats?.errors} errores
                                    </span>
                                </Card>
                                <Card className="p-4 bg-slate-950 border border-slate-850/60 flex flex-col justify-between">
                                    <span className="text-[10px] text-slate-400 uppercase font-extrabold tracking-wider block">Duplicados Existentes</span>
                                    <span className={`text-xl font-extrabold block mt-1 ${importStats?.duplicates > 0 ? 'text-amber-500 font-bold' : 'text-slate-450'}`}>
                                        {importStats?.duplicates} duplicados
                                    </span>
                                </Card>
                            </div>

                            {/* Warnings/Errors details */}
                            {importErrors.length > 0 && (
                                <div className="p-3.5 bg-red-550/10 border border-red-500/20 rounded-xl space-y-1.5 text-xs text-red-400 font-medium">
                                    <span className="font-extrabold flex items-center gap-1.5"><AlertCircle size={15} /> Anomalías Críticas de Validación en el Archivo:</span>
                                    <ul className="text-[10px] space-y-1 pl-4 list-disc text-red-350">
                                        {importErrors.slice(0, 5).map((err, i) => <li key={i}>{err}</li>)}
                                        {importErrors.length > 5 && <li>Y {importErrors.length - 5} errores más abajo...</li>}
                                    </ul>
                                </div>
                            )}

                            {importDuplicates.length > 0 && (
                                <div className="p-3.5 bg-amber-550/10 border border-amber-500/20 rounded-xl space-y-1.5 text-xs text-amber-500 font-medium">
                                    <span className="font-extrabold flex items-center gap-1.5"><AlertTriangle size={15} /> Registros Duplicados en Sistema (Se sobrescribirán al importar):</span>
                                    <ul className="text-[10px] space-y-1 pl-4 list-disc text-amber-450">
                                        {importDuplicates.slice(0, 5).map((dup, i) => <li key={i}>Línea {dup.line}: {dup.label}</li>)}
                                        {importDuplicates.length > 5 && <li>Y {importDuplicates.length - 5} duplicados más...</li>}
                                    </ul>
                                </div>
                            )}

                            {/* Preview Grid */}
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <h4 className="font-bold text-xs uppercase text-slate-400 flex items-center gap-1.5">Previsualización del Archivo CSV</h4>
                                    <div className="flex gap-2">
                                        <Button variant="secondary" size="sm" onClick={cancelImportPreview}>
                                            Cancelar
                                        </Button>
                                        <Button variant="primary" size="sm" onClick={confirmImport} disabled={importStats?.ready === 0}>
                                            Confirmar e Importar {importStats?.ready} Registros
                                        </Button>
                                    </div>
                                </div>

                                <TableContainer>
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHeaderCell>Estado</TableHeaderCell>
                                                {importModule === 'clientes' && (
                                                    <>
                                                        <TableHeaderCell>Cliente / Razón Social</TableHeaderCell>
                                                        <TableHeaderCell>CUIT</TableHeaderCell>
                                                        <TableHeaderCell>IVA</TableHeaderCell>
                                                        <TableHeaderCell>Email / Teléfono</TableHeaderCell>
                                                    </>
                                                )}
                                                {importModule === 'maquinas' && (
                                                    <>
                                                        <TableHeaderCell>Copiadora / Marca</TableHeaderCell>
                                                        <TableHeaderCell>Modelo</TableHeaderCell>
                                                        <TableHeaderCell>Serie</TableHeaderCell>
                                                        <TableHeaderCell>Contador</TableHeaderCell>
                                                    </>
                                                )}
                                                {importModule === 'lecturas' && (
                                                    <>
                                                        <TableHeaderCell>Serie Copiadora</TableHeaderCell>
                                                        <TableHeaderCell>Mes</TableHeaderCell>
                                                        <TableHeaderCell>Lectura Inicial</TableHeaderCell>
                                                        <TableHeaderCell>Lectura Final</TableHeaderCell>
                                                    </>
                                                )}
                                                <TableHeaderCell>Diagnóstico</TableHeaderCell>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {importPreview.map((item, idx) => (
                                                <TableRow key={item.id || idx} className="hover:bg-slate-900/40">
                                                    <TableCell>
                                                        {item.isValid ? (
                                                            <span className="px-2 py-0.5 rounded text-[8px] font-extrabold uppercase bg-emerald-500/10 text-emerald-450 border border-emerald-500/20">Válido</span>
                                                        ) : (
                                                            <span className="px-2 py-0.5 rounded text-[8px] font-extrabold uppercase bg-red-500/10 text-red-500 border border-red-500/20">Inválido</span>
                                                        )}
                                                    </TableCell>
                                                    {importModule === 'clientes' && (
                                                        <>
                                                            <TableCell className="font-bold text-slate-100">{item.name}</TableCell>
                                                            <TableCell className="font-mono text-xs text-slate-350">{item.cuit}</TableCell>
                                                            <TableCell className="text-xs text-slate-350">{item.taxCategory}</TableCell>
                                                            <TableCell className="text-xs text-slate-400">{item.email || item.phone || '-'}</TableCell>
                                                        </>
                                                    )}
                                                    {importModule === 'maquinas' && (
                                                        <>
                                                            <TableCell className="font-bold text-slate-100">{item.brand}</TableCell>
                                                            <TableCell className="text-xs text-slate-350">{item.model}</TableCell>
                                                            <TableCell className="font-mono text-xs text-slate-350">{item.serial}</TableCell>
                                                            <TableCell className="font-mono-tabular text-xs text-slate-300">{(item.currentCounter || 0).toLocaleString()}</TableCell>
                                                        </>
                                                    )}
                                                    {importModule === 'lecturas' && (
                                                        <>
                                                            <TableCell className="font-mono text-xs text-slate-350">{item.machineSerial}</TableCell>
                                                            <TableCell className="text-xs text-slate-350">{item.month}</TableCell>
                                                            <TableCell className="font-mono-tabular text-xs text-slate-350">{(item.initial || 0).toLocaleString()}</TableCell>
                                                            <TableCell className="font-mono-tabular text-xs text-slate-300">{(item.final || 0).toLocaleString()}</TableCell>
                                                        </>
                                                    )}
                                                    <TableCell className="text-xs max-w-[200px] truncate">
                                                        {item.isValid ? (
                                                            item.isDuplicate ? (
                                                                <span className="text-amber-500 font-semibold block text-[10px]">Sobrescribe duplicado</span>
                                                            ) : (
                                                                <span className="text-emerald-500 block text-[10px]">Listo para insertar</span>
                                                            )
                                                        ) : (
                                                            <span className="text-red-400 font-semibold block text-[10px] leading-tight">
                                                                {item.errors?.join(', ')}
                                                            </span>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ========================================================================= */}
            {/* SUB-TAB: BACKUP & RESTAURACIÓN DE TURSO */}
            {/* ========================================================================= */}
            {currentSubTab === 'backup' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start animate-fade-in">
                    
                    {/* Backup trigger */}
                    <div className="space-y-6 lg:col-span-1">
                        <Card className="border-slate-850 bg-slate-950/40">
                            <div className="p-5 border-b border-slate-850">
                                <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                                    <Database size={16} className="text-emerald-500" /> Respaldar Turso Cloud
                                </h3>
                            </div>
                            <CardContent className="p-5 space-y-4">
                                <p className="text-[10px] text-slate-400 leading-relaxed">
                                    Genera un archivo JSON de respaldo que captura de forma transaccional toda la base de datos de Turso en la nube, incluyendo configuraciones internas y logs.
                                </p>
                                <Button 
                                    variant="primary" 
                                    size="md" 
                                    className="w-full font-bold bg-emerald-650 hover:bg-emerald-600 border-none shadow-md shadow-emerald-950/20"
                                    onClick={handleTursoBackup}
                                    disabled={isBackingUp}
                                >
                                    <Download size={14} className="mr-2" />
                                    {isBackingUp ? 'Generando backup...' : 'Descargar Snapshot Turso (.json)'}
                                </Button>
                            </CardContent>
                        </Card>

                        {/* Database Restore */}
                        <Card className="border-red-950/40 bg-red-955/5">
                            <div className="p-5 border-b border-red-950/30">
                                <h3 className="font-bold text-sm text-red-400 flex items-center gap-2">
                                    <RefreshCcw size={16} className="text-red-400" /> Restaurar Base de Datos
                                </h3>
                            </div>
                            <CardContent className="p-5 space-y-4">
                                <p className="text-[10px] text-red-350/80 leading-relaxed">
                                    Sube un archivo de respaldo JSON generado previamente para restaurar transaccionalmente todas las tablas de la base de datos Turso. 
                                    <strong className="block text-red-400 font-extrabold mt-1">⚠️ ¡ATENCIÓN! Reemplazará todos los datos actuales.</strong>
                                </p>
                                <input 
                                    type="file" 
                                    ref={restoreFileInputRef}
                                    onChange={handleRestoreFileChange}
                                    accept=".json"
                                    className="hidden"
                                />
                                <Button 
                                    variant="primary" 
                                    size="md" 
                                    className="w-full font-bold bg-red-650 hover:bg-red-600 border-none"
                                    onClick={handleRestoreFileSelect}
                                    disabled={isRestoring}
                                >
                                    <Upload size={14} className="mr-2" />
                                    {isRestoring ? 'Restaurando base...' : 'Cargar Backup y Restaurar'}
                                </Button>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Backups logs history */}
                    <div className="lg:col-span-2 space-y-4">
                        <Card className="border-slate-850 bg-slate-950/40">
                            <div className="p-5 border-b border-slate-850">
                                <h4 className="font-bold text-xs uppercase text-slate-300 flex items-center gap-1.5">Historial de Backups y Restauraciones</h4>
                            </div>
                            <CardContent className="p-0">
                                <TableContainer>
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHeaderCell>Fecha y Hora</TableHeaderCell>
                                                <TableHeaderCell>Operación</TableHeaderCell>
                                                <TableHeaderCell>Usuario</TableHeaderCell>
                                                <TableHeaderCell>Detalle del Evento</TableHeaderCell>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {backupHistory.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={4} className="text-center py-8 text-slate-500 italic">
                                                        No hay registro de copias de seguridad en esta base de datos.
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                backupHistory.slice(0, 10).map((log, idx) => (
                                                    <TableRow key={log.id || idx} className="hover:bg-slate-900/40">
                                                        <TableCell className="font-mono text-xs text-slate-350">
                                                            {new Date(log.createdAt).toLocaleString('es-AR')}
                                                        </TableCell>
                                                        <TableCell>
                                                            <span className={`px-2 py-0.5 rounded text-[8px] font-extrabold uppercase ${
                                                                log.action === 'backup' ? 'bg-emerald-500/10 text-emerald-450 border border-emerald-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'
                                                            }`}>
                                                                {log.action}
                                                            </span>
                                                        </TableCell>
                                                        <TableCell className="text-xs text-slate-300 font-semibold">{log.user}</TableCell>
                                                        <TableCell className="text-xs text-slate-400 font-mono text-[10px] max-w-[240px] truncate" title={log.details}>
                                                            {log.details}
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            )}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* SUB-TAB: LIMPIEZA Y DIAGNÓSTICO */}
            {/* ========================================================================= */}
            {currentSubTab === 'limpieza' && (
                <div className="space-y-6 animate-fade-in">
                    {/* Header info */}
                    <div className="p-4 bg-slate-950/40 border border-slate-850 rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                        <div className="space-y-1">
                            <h3 className="font-bold text-xs text-indigo-400 uppercase tracking-wider">Escaneo de Integridad Referencial</h3>
                            <p className="text-[10px] text-slate-400">Inspecciona y repara relaciones rotas, contadores inconsistentes o campos huérfanos.</p>
                        </div>
                        <Button 
                            variant="primary" 
                            size="sm" 
                            className="bg-indigo-650 hover:bg-indigo-600 font-bold"
                            onClick={handleRunDiagnosis}
                            disabled={isDiagnosing}
                        >
                            <Play size={13} className="mr-1.5" /> 
                            {isDiagnosing ? 'Escaneando...' : 'Iniciar Escaneo de Datos'}
                        </Button>
                    </div>

                    {diagnosedIssues.length > 0 ? (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center text-xs text-slate-400 font-semibold">
                                <span>Seleccionados: {selectedIssues.length} / {diagnosedIssues.length} anomalías</span>
                                <Button 
                                    variant="secondary" 
                                    size="sm" 
                                    className="bg-red-550/10 hover:bg-red-500/10 text-red-500 border border-red-500/20"
                                    onClick={handleExecuteCleanup}
                                    disabled={isCleaning || selectedIssues.length === 0}
                                >
                                    <Trash2 size={13} className="mr-1.5" />
                                    {isCleaning ? 'Limpiando...' : 'Eliminar / Reparar Anomalías'}
                                </Button>
                            </div>

                            <TableContainer>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHeaderCell className="w-12 text-center">
                                                <input 
                                                    type="checkbox"
                                                    checked={selectedIssues.length === diagnosedIssues.length}
                                                    onChange={() => {
                                                        if (selectedIssues.length === diagnosedIssues.length) {
                                                            setSelectedIssues([]);
                                                        } else {
                                                            setSelectedIssues(diagnosedIssues.map(iss => iss.id));
                                                        }
                                                    }}
                                                />
                                            </TableHeaderCell>
                                            <TableHeaderCell>Categoría</TableHeaderCell>
                                            <TableHeaderCell>Origen</TableHeaderCell>
                                            <TableHeaderCell>Falla / Inconsistencia Detectada</TableHeaderCell>
                                            <TableHeaderCell>Clasificación</TableHeaderCell>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {diagnosedIssues.map((issue) => (
                                            <TableRow key={issue.id} className="hover:bg-slate-900/40">
                                                <TableCell className="text-center">
                                                    <input 
                                                        type="checkbox"
                                                        checked={selectedIssues.includes(issue.id)}
                                                        onChange={() => handleToggleIssueSelect(issue.id)}
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <span className={`px-2 py-0.5 rounded text-[8px] font-extrabold uppercase ${
                                                        issue.category === 'cliente' ? 'bg-indigo-500/10 text-indigo-400' :
                                                        issue.category === 'maquina' ? 'bg-emerald-500/10 text-emerald-400' :
                                                        issue.category === 'alquiler' ? 'bg-blue-500/10 text-blue-400' :
                                                        issue.category === 'lectura' ? 'bg-amber-500/10 text-amber-500' : 'bg-red-500/10 text-red-500'
                                                    }`}>
                                                        {issue.category}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="font-bold text-slate-100 text-xs">{issue.itemLabel}</TableCell>
                                                <TableCell className="text-xs text-slate-350">{issue.description}</TableCell>
                                                <TableCell>
                                                    <span className={`px-2 py-0.5 rounded text-[8px] font-extrabold uppercase ${
                                                        issue.type === 'huérfano' ? 'bg-red-550/10 text-red-400 border border-red-500/10' :
                                                        issue.type === 'inconsistente' ? 'bg-amber-500/10 text-amber-450 border border-amber-500/10' : 'bg-blue-500/10 text-blue-450'
                                                    }`}>
                                                        {issue.type}
                                                    </span>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </div>
                    ) : (
                        <div className="p-12 text-center text-slate-500 italic text-xs bg-slate-950/20 border border-slate-850 rounded-xl">
                            Presiona el botón superior para realizar un diagnóstico completo sobre las colecciones y base de datos.
                        </div>
                    )}
                </div>
            )}

            {/* ========================================================================= */}
            {/* SUB-TAB: AUDITORÍA */}
            {/* ========================================================================= */}
            {currentSubTab === 'auditoria' && (
                <div className="space-y-6 animate-fade-in">
                    {/* Filters Toolbar */}
                    <div className="p-4 bg-slate-955 border border-slate-850/60 rounded-xl space-y-3">
                        <div className="flex justify-between items-center text-xs font-semibold text-slate-400">
                            <div className="flex items-center gap-2">
                                <Filter size={14} /> Filtros de Auditoría
                            </div>
                            <Button 
                                variant="secondary" 
                                size="sm" 
                                onClick={loadAuditLogs}
                                disabled={isLoadingAudit}
                                className="flex items-center gap-1 bg-slate-900 border-slate-850"
                            >
                                <RefreshCw size={12} className={isLoadingAudit ? 'animate-spin' : ''} />
                                Recargar logs
                            </Button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                            <div className="relative">
                                <span className="absolute inset-y-0 left-3 flex items-center text-slate-500">
                                    <Search size={14} />
                                </span>
                                <input
                                    type="text"
                                    placeholder="Buscar detalles o usuario..."
                                    value={auditSearchQuery}
                                    onChange={(e) => setAuditSearchQuery(e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-slate-200 text-xs focus:outline-none"
                                />
                            </div>
                            
                            <select
                                value={auditModuleFilter}
                                onChange={(e) => setAuditModuleFilter(e.target.value)}
                                className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-slate-350 text-xs focus:outline-none"
                            >
                                <option value="">Módulo: Todos</option>
                                <option value="clientes">Clientes</option>
                                <option value="maquinas">Máquinas</option>
                                <option value="alquileres">Alquileres</option>
                                <option value="abonos">Abonos</option>
                                <option value="lecturas">Lecturas</option>
                                <option value="tickets">Tickets</option>
                                <option value="datos">Datos y Respaldo</option>
                            </select>

                            <select
                                value={auditActionFilter}
                                onChange={(e) => setAuditActionFilter(e.target.value)}
                                className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-slate-350 text-xs focus:outline-none"
                            >
                                <option value="">Acción: Todas</option>
                                <option value="crear">Crear</option>
                                <option value="editar">Editar</option>
                                <option value="eliminar">Eliminar</option>
                                <option value="importar">Importar</option>
                                <option value="exportar">Exportar</option>
                                <option value="backup">Backup</option>
                                <option value="limpieza">Limpieza</option>
                                <option value="restauracion">Restauración</option>
                            </select>
                        </div>
                    </div>

                    {/* Logs Grid */}
                    <TableContainer>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHeaderCell>Fecha y Hora</TableHeaderCell>
                                    <TableHeaderCell>Módulo</TableHeaderCell>
                                    <TableHeaderCell>Acción</TableHeaderCell>
                                    <TableHeaderCell>Usuario</TableHeaderCell>
                                    <TableHeaderCell>Detalle de la Operación</TableHeaderCell>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredAuditLogs.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-12 text-slate-500 italic">
                                            No hay registros de auditoría que coincidan con los filtros seleccionados.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredAuditLogs.map((log, idx) => (
                                        <TableRow key={log.id || idx} className="hover:bg-slate-900/40">
                                            <TableCell className="font-mono text-xs text-slate-350">
                                                {new Date(log.createdAt).toLocaleString('es-AR')}
                                            </TableCell>
                                            <TableCell>
                                                <span className="px-2 py-0.5 rounded text-[8px] font-extrabold uppercase bg-slate-900 text-indigo-400 border border-indigo-900/10">
                                                    {log.module}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                <span className={`px-2 py-0.5 rounded text-[8px] font-extrabold uppercase ${
                                                    ['crear', 'importar'].includes(log.action) ? 'bg-emerald-500/10 text-emerald-450 border border-emerald-500/20' :
                                                    log.action === 'eliminar' ? 'bg-red-500/10 text-red-400 border border-red-500/25' :
                                                    log.action === 'backup' ? 'bg-blue-500/10 text-blue-450 border border-blue-500/25' : 'bg-slate-900 text-slate-400 border border-slate-800'
                                                }`}>
                                                    {log.action}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-xs text-slate-300 font-semibold">{log.user}</TableCell>
                                            <TableCell className="text-xs text-slate-300 font-mono text-[10px]">{log.details}</TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </div>
            )}
        </div>
    );
}
