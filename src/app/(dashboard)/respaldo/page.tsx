'use client';

import React, { useRef } from 'react';
import { useManagement } from '@/lib/context';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, Upload, ShieldCheck } from 'lucide-react';

export default function RespaldoPage() {
    const { clients, setClients, machines, setMachines, readings, setReadings, tickets, setTickets, abonos, setAbonos, users, setUsers } = useManagement();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleExportData = () => {
        try {
            const dataToExport = {
                clients,
                machines,
                readings,
                tickets,
                abonos,
                users,
                exportDate: new Date().toISOString(),
                version: '2.0.0'
            };

            const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
                JSON.stringify(dataToExport, null, 2)
            )}`;
            
            const downloadAnchor = document.createElement('a');
            downloadAnchor.setAttribute('href', jsonString);
            downloadAnchor.setAttribute('download', `ms_backup_${new Date().toISOString().split('T')[0]}.json`);
            document.body.appendChild(downloadAnchor);
            downloadAnchor.click();
            downloadAnchor.remove();
        } catch (e) {
            console.error('Error al exportar datos:', e);
            alert('Ocurrió un error al exportar la copia de seguridad.');
        }
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleImportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const parsed = JSON.parse(event.target?.result as string);
                
                // Basic validation
                if (!parsed.clients || !parsed.machines || !parsed.readings) {
                    alert('El archivo no parece ser una copia de seguridad válida de M&S Tecnología Digital (faltan tablas clave).');
                    return;
                }

                if (confirm('Se van a sobrescribir los datos actuales con los del archivo de respaldo. ¿Deseas continuar?')) {
                    setClients(parsed.clients || []);
                    setMachines(parsed.machines || []);
                    setReadings(parsed.readings || []);
                    setTickets(parsed.tickets || []);
                    if (parsed.abonos) setAbonos(parsed.abonos);
                    if (parsed.users) setUsers(parsed.users);

                    alert('¡Copia de seguridad importada con éxito!');
                }
            } catch (err) {
                console.error(err);
                alert('Error al procesar el archivo JSON. Verifique que el formato sea correcto.');
            }
        };
        reader.readAsText(file);
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex justify-between items-center">
                <h2 className="text-base font-semibold text-slate-100">Datos y Copias de Seguridad</h2>
            </div>

            <Card className="max-w-md mx-auto border-slate-800">
                <CardContent className="p-8 space-y-6 text-center">
                    <ShieldCheck className="w-12 h-12 text-emerald-500 mx-auto" />
                    <div className="space-y-2">
                        <h3 className="font-bold text-sm text-slate-200">Respaldar / Restaurar Base de Datos</h3>
                        <p className="text-xs text-slate-400">Descarga o sube un archivo JSON con todos los datos comerciales (clientes, equipos, abonos, lecturas históricas y órdenes de servicio).</p>
                    </div>
                    
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleImportFileChange} 
                        accept=".json" 
                        className="hidden" 
                    />

                    <div className="flex flex-col gap-3">
                        <Button variant="primary" size="md" className="w-full" onClick={handleExportData}>
                            <Download size={16} className="mr-2" /> Descargar Respaldo (.json)
                        </Button>
                        <Button variant="secondary" size="md" className="w-full" onClick={handleImportClick}>
                            <Upload size={16} className="mr-2" /> Importar Copia de Seguridad
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
