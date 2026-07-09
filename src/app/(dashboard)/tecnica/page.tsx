'use client';

import React, { useState, useEffect } from 'react';
import { useManagement } from '@/lib/context';
import { Card, CardContent } from '@/components/ui/card';
import { TableContainer, Table, TableHeader, TableRow, TableHeaderCell, TableBody, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Modal } from '@/components/ui/modal';
import { Ticket, User } from '@/lib/mockData';
import { autoAssignTech } from '@/domain/ticket/assignment';
import { 
    Plus, PlusCircle, Edit, User as UserIcon, Calendar, Settings, AlertTriangle, 
    Search, Filter, Shield, Wrench, X, Clock, DollarSign, Activity, 
    CheckCircle, HelpCircle, Check, ArrowRight, Phone, Mail, MapPin, 
    Users, Bell, History, CheckSquare, Eye, RefreshCw, BarChart2, Star, Award
} from 'lucide-react';

export default function TechnicalPage() {
    const { tickets, setTickets, currentUser, users, setUsers, clients, machines, setMachines, updateTicketAction, updateUserAction } = useManagement();
    const isTech = currentUser?.role === 'tecnico';

    // Core Navigation Tabs: 'bitacora' | 'tecnicos' | 'config' | 'historial_envios' | 'metricas'
    const [currentTab, setCurrentTab] = useState<'bitacora' | 'mantenimiento' | 'tecnicos' | 'config' | 'historial_envios' | 'metricas'>('bitacora');
    
    // Selected states
    const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
    const [selectedTech, setSelectedTech] = useState<User | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    
    // Notification log audit logs state
    const [notificationLogs, setNotificationLogs] = useState<any[]>([]);
    const [isLoadingLogs, setIsLoadingLogs] = useState(false);
    const [viewedLogMsg, setViewedLogMsg] = useState<string | null>(null);

    // Notification config state
    const [configWhatsappEnabled, setConfigWhatsappEnabled] = useState(true);
    const [configEmailEnabled, setConfigEmailEnabled] = useState(true);
    const [configEvents, setConfigEvents] = useState<Record<string, boolean>>({});
    const [configTemplates, setConfigTemplates] = useState<Record<string, string>>({});
    const [isSavingConfig, setIsSavingConfig] = useState(false);

    // Simulation/Cron states
    const [isSimulatingCron, setIsSimulatingCron] = useState(false);

    // Filter states for tickets bitacora
    const [searchQuery, setSearchQuery] = useState('');
    const [filterTech, setFilterTech] = useState('');
    const [filterPriority, setFilterPriority] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [filterSla, setFilterSla] = useState(''); 
    const [activeKpiTab, setActiveKpiTab] = useState<string>('todos');

    // Filter states for technicians
    const [searchTechQuery, setSearchTechQuery] = useState('');
    const [filterTechActive, setFilterTechActive] = useState('');
    const [filterTechZone, setFilterTechZone] = useState('');
    const [filterTechSpecialty, setFilterTechSpecialty] = useState('');

    // Filter states for notifications history
    const [searchLogQuery, setSearchLogQuery] = useState('');
    const [filterLogChannel, setFilterLogChannel] = useState('');
    const [filterLogStatus, setFilterLogStatus] = useState('');

    // Edit Form temporary states (for ticket detail drawer)
    const [editStatus, setEditStatus] = useState<Ticket['status']>('nuevo');
    const [editDiagnostic, setEditDiagnostic] = useState('');
    const [editActionTaken, setEditActionTaken] = useState('');
    const [editPartsUsed, setEditPartsUsed] = useState('');
    const [editPartsNeeded, setEditPartsNeeded] = useState('');
    const [editAssignedTechId, setEditAssignedTechId] = useState('');
    const [editTechnicalCost, setEditTechnicalCost] = useState('0');
    const [editObservations, setEditObservations] = useState('');
    const [editMachineStatus, setEditMachineStatus] = useState<string>('');
    const [autoAssignExplanation, setAutoAssignExplanation] = useState<string | null>(null);

    // Creation Form states
    const [newClientType, setNewClientType] = useState<'existente' | 'externo'>('existente');
    const [newClientId, setNewClientId] = useState('');
    const [newClientName, setNewClientName] = useState('');
    const [newClientAddress, setNewClientAddress] = useState('');
    const [newClientPhone, setNewClientPhone] = useState('');
    const [newClientEmail, setNewClientEmail] = useState('');
    const [newClientContact, setNewClientContact] = useState('');
    const [newMachineDesc, setNewMachineDesc] = useState('');
    const [newSerialNumber, setNewSerialNumber] = useState('');
    const [newMachineId, setNewMachineId] = useState('');
    const [newCategory, setNewCategory] = useState('Servicio');
    const [newPriority, setNewPriority] = useState<'baja' | 'media' | 'alta' | 'urgente'>('media');
    const [newDescription, setNewDescription] = useState('');
    const [newAssignedTechId, setNewAssignedTechId] = useState('');
    const [shouldAutoAssignOnCreate, setShouldAutoAssignOnCreate] = useState(false);
    const clientMachines = machines.filter(m => m.clientId === newClientId);

    // Technician Form modal states
    const [isTechFormOpen, setIsTechFormOpen] = useState(false);
    const [editingTech, setEditingTech] = useState<User | null>(null);
    const [formTechFullname, setFormTechFullname] = useState('');
    const [formTechUsername, setFormTechUsername] = useState('');
    const [formTechEmail, setFormTechEmail] = useState('');
    const [formTechPhone, setFormTechPhone] = useState('');
    const [formTechWhatsapp, setFormTechWhatsapp] = useState('');
    const [formTechZone, setFormTechZone] = useState('');
    const [formTechSpecialty, setFormTechSpecialty] = useState('');
    const [formTechAvailability, setFormTechAvailability] = useState<'Disponible' | 'No disponible' | 'Licencia'>('Disponible');
    const [formTechActive, setFormTechActive] = useState(true);
    const [formTechWorkHours, setFormTechWorkHours] = useState('08:00 a 17:00 hs');
    const [formTechInternalNotes, setFormTechInternalNotes] = useState('');

    // Load URL ticket query on startup
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            const ticketId = params.get('ticketId');
            if (ticketId) {
                const t = tickets.find(x => x.id === ticketId);
                if (t) handleOpenDetail(t);
            }
        }
    }, [tickets]);

    // Fetch settings and logs
    useEffect(() => {
        fetchSettings();
        fetchLogs();
    }, []);

    const fetchSettings = async () => {
        try {
            const res = await fetch('/api/tickets/settings');
            const data = await res.json();
            setConfigWhatsappEnabled(data.whatsappEnabled);
            setConfigEmailEnabled(data.emailEnabled);
            setConfigEvents(data.eventsConfig || {});
            setConfigTemplates(data.templatesConfig || {});
        } catch (e) {
            console.error('Error fetching settings:', e);
        }
    };

    const fetchLogs = async () => {
        setIsLoadingLogs(true);
        try {
            const res = await fetch('/api/tickets/history');
            const data = await res.json();
            if (res.ok && Array.isArray(data)) {
                setNotificationLogs(data);
            } else {
                setNotificationLogs([]);
            }
        } catch (e) {
            console.error('Error fetching logs:', e);
            setNotificationLogs([]);
        } finally {
            setIsLoadingLogs(false);
        }
    };

    const saveSettings = async () => {
        setIsSavingConfig(true);
        try {
            const res = await fetch('/api/tickets/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    whatsappEnabled: configWhatsappEnabled,
                    emailEnabled: configEmailEnabled,
                    eventsConfig: configEvents,
                    templatesConfig: configTemplates
                })
            });
            if (res.ok) {
                alert('¡Configuración de notificaciones guardada de forma segura!');
            }
        } catch (e) {
            console.error('Error saving settings:', e);
            alert('Error al guardar la configuración.');
        } finally {
            setIsSavingConfig(false);
        }
    };

    // Simulated Cron trigger
    const handleRunSlaCron = async () => {
        setIsSimulatingCron(true);
        try {
            const response = await fetch('/api/tickets/cron', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tickets, users }),
            });
            const data = await response.json();
            if (data.success) {
                setTickets(data.tickets);
                fetchLogs();
                if (data.logs.length > 0) {
                    alert(`¡Cron de automatización ejecutado!\n\nAcciones realizadas:\n${data.logs.join('\n')}`);
                } else {
                    alert('Cron de automatización ejecutado: Todos los tickets están al día y sin novedades.');
                }
            }
        } catch (e) {
            console.error('Error running SLA cron:', e);
            alert('Error al simular la ejecución del Cron.');
        } finally {
            setIsSimulatingCron(false);
        }
    };

    // Client-side auto assign trigger inside ticket Drawer
    const handleTriggerAutoAssign = () => {
        if (!selectedTicket) return;
        const activeTicketsList = tickets.filter(t => t.id !== selectedTicket.id);
        const result = autoAssignTech(selectedTicket, users, activeTicketsList);
        
        if (result.techId) {
            const tech = users.find(u => u.id === result.techId);
            setEditAssignedTechId(result.techId);
            setEditStatus('asignado');
            setAutoAssignExplanation(result.reason);
            setTimeout(() => setAutoAssignExplanation(null), 8000); // clear banner after 8s
        } else {
            alert(`No se pudo autoasignar: ${result.reason}`);
        }
    };

    // Helper to calculate metrics per technician
    const getTechMetrics = (techId: string) => {
        const techTickets = tickets.filter(t => t.assignedTechId === techId);
        const totalAssigned = techTickets.length;
        const resolvedTickets = techTickets.filter(t => ['resuelto', 'cerrado'].includes(t.status));
        const resolvedCount = resolvedTickets.length;

        let slaCompliantCount = 0;
        let totalResolutionTimeMs = 0;
        let totalResponseTimeMs = 0;

        resolvedTickets.forEach(t => {
            // SLA Compliance check
            if (t.resolvedAt && t.slaDate) {
                const isCompliant = new Date(t.resolvedAt) <= new Date(t.slaDate);
                if (isCompliant) slaCompliantCount++;
            }

            // Resolution time
            const created = t.createdAt || (new Date(t.date + 'T' + t.time).getTime());
            if (t.resolvedAt && !isNaN(created)) {
                totalResolutionTimeMs += (t.resolvedAt - created);
            }
        });

        // Response time (from created to transition out of 'nuevo' state in history logs)
        techTickets.forEach(t => {
            const created = t.createdAt || (new Date(t.date + 'T' + t.time).getTime());
            if (t.history && t.history.length > 1 && !isNaN(created)) {
                const assignedEvent = t.history.find(h => 
                    h.action.includes('Cambio de estado') || 
                    h.action.includes('Asignado') || 
                    h.action.includes('Reasignado')
                );
                if (assignedEvent) {
                    const assignedTime = new Date(assignedEvent.date + 'T' + assignedEvent.time).getTime();
                    if (!isNaN(assignedTime) && assignedTime >= created) {
                        totalResponseTimeMs += (assignedTime - created);
                    }
                }
            }
        });

        const complianceRate = resolvedCount > 0 ? Math.round((slaCompliantCount / resolvedCount) * 100) : 100;
        const avgResolutionHours = resolvedCount > 0 ? Math.round((totalResolutionTimeMs / (1000 * 60 * 60 * resolvedCount)) * 10) / 10 : 0;
        const avgResponseMinutes = techTickets.length > 0 ? Math.round(totalResponseTimeMs / (1000 * 60 * techTickets.length)) : 0;

        return {
            totalAssigned,
            resolvedCount,
            complianceRate,
            avgResolutionHours,
            avgResponseMinutes
        };
    };

    // Calculate dynamic SLA dates
    const calculateSlaDate = (priority: 'baja' | 'media' | 'alta' | 'urgente'): Date => {
        const now = new Date();
        if (priority === 'urgente' || priority === 'alta') {
            now.setHours(now.getHours() + 4);
        } else if (priority === 'media') {
            now.setDate(now.getDate() + 1);
        } else {
            now.setDate(now.getDate() + 2);
        }
        return now;
    };

    // Parse SLA limit remaining time
    const getSlaStatus = (slaDateStr: string, status: string) => {
        if (status === 'resuelto' || status === 'cerrado') {
            return { text: 'Cumplido', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', status: 'ok' };
        }
        const now = new Date();
        const sla = new Date(slaDateStr);
        if (isNaN(sla.getTime())) {
            return { text: 'Sin definir', color: 'text-slate-400 bg-slate-900 border-slate-800', status: 'ok' };
        }

        const diffMs = sla.getTime() - now.getTime();
        if (diffMs < 0) {
            return { text: 'VENCIDO', color: 'text-red-500 bg-red-500/10 border-red-500/20 font-extrabold animate-pulse', status: 'vencido', overdue: true };
        }
        const diffHours = diffMs / (1000 * 60 * 60);
        if (diffHours < 4) {
            return { text: 'Por vencer (<4h)', color: 'text-amber-500 bg-amber-500/10 border-amber-500/20 font-bold', status: 'por_vencer', warning: true };
        }
        return { 
            text: `Vence: ${sla.toLocaleDateString('es-AR')} ${sla.toLocaleTimeString('es-AR').slice(0, 5)}`, 
            color: 'text-slate-400 bg-slate-900 border-slate-800', 
            status: 'ok' 
        };
    };

    // Client-side call to Next.js API route to post notification
    const notifyTech = async (event: string, ticket: Ticket, tech: User) => {
        try {
            const response = await fetch('/api/tickets/notify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ event, ticket, tech }),
            });
            const data = await response.json();
            fetchLogs();
            return data.result?.logAction || `Notificación enviada por evento: ${event}`;
        } catch (e) {
            console.error('Error dispatching notify API:', e);
            return `Aviso técnico fallido para el evento: ${event}`;
        }
    };

    // Trigger manual resend from frontend
    const handleManualResendNotification = async (event: string) => {
        if (!selectedTicket) return;
        const tech = users.find(u => u.id === selectedTicket.assignedTechId);
        if (!tech) {
            alert('¡Atención! Asigne un técnico al ticket para poder reenviar la alerta.');
            return;
        }

        const logMsg = await notifyTech(event, selectedTicket, tech);
        const updatedHistory = [...(selectedTicket.history || []), {
            date: new Date().toISOString().split('T')[0],
            time: new Date().toLocaleTimeString('es-AR').slice(0, 5),
            action: `[Reenvío Manual] ${logMsg}`,
            user: currentUser?.fullname || 'Administración'
        }];

        const updated: Ticket = {
            ...selectedTicket,
            history: updatedHistory
        };

        updateTicketAction(updated);
        setSelectedTicket(updated);
        alert('¡Alerta de aviso reenviada exitosamente!');
    };

    // Trigger manual direct WhatsApp Web dispatch from frontend
    const handleWhatsAppDirect = (event: string) => {
        if (!selectedTicket) return;
        const tech = users.find(u => u.id === selectedTicket.assignedTechId);
        if (!tech) {
            alert('¡Atención! Asigne un técnico al ticket para poder enviar la alerta.');
            return;
        }
        if (!tech.whatsapp) {
            alert('¡Atención! El técnico asignado no tiene un número de WhatsApp registrado.');
            return;
        }

        // Clean WhatsApp number
        const cleanWhatsapp = tech.whatsapp.replace(/\D/g, '');
        if (!cleanWhatsapp) {
            alert('¡Atención! El número de WhatsApp registrado no es válido.');
            return;
        }

        // Variables replacement Map
        const variables: Record<string, string> = {
            ticket: selectedTicket.id.replace('ticket-', ''),
            evento: event.toUpperCase().replace('_', ' '),
            cliente: selectedTicket.clientName,
            direccion: selectedTicket.clientAddress || 'No especificada',
            equipo: selectedTicket.machineDesc,
            serie: selectedTicket.serialNumber || 'Sin Nro Serie',
            falla: selectedTicket.description,
            prioridad: selectedTicket.priority.toUpperCase(),
            tecnico: tech.fullname,
            sla: selectedTicket.slaDate ? new Date(selectedTicket.slaDate).toLocaleString('es-AR') : 'Sin definir',
            enlace: `${window.location.origin}/tecnica?ticketId=${selectedTicket.id}`
        };

        // Fallback to default template if configuration is empty
        const templateText = configTemplates.whatsapp || `*M&S TECNOLOGÍA DIGITAL - ÁREA TÉCNICA*\n\nHola *{tecnico}*, se ha registrado una actualización para el Ticket *TCK-{ticket}*.\n\n*Detalles del Servicio:*\n• *Evento:* {evento}\n• *Cliente:* {cliente}\n• *Dirección:* {direccion}\n• *Equipo:* {equipo} (S/N: {serie})\n• *Falla:* {falla}\n• *Prioridad:* {prioridad}\n• *Fecha Límite SLA:* {sla}\n\nPor favor, ingresa al panel para gestionarlo:\n{enlace}`;

        let output = templateText;
        for (const [k, v] of Object.entries(variables)) {
            output = output.replace(new RegExp(`{${k}}`, 'g'), v);
        }

        // Open API link
        const whatsappUrl = `https://api.whatsapp.com/send?phone=${cleanWhatsapp}&text=${encodeURIComponent(output)}`;
        window.open(whatsappUrl, '_blank');
        
        // Log locally to history
        const updatedHistory = [...(selectedTicket.history || []), {
            date: new Date().toISOString().split('T')[0],
            time: new Date().toLocaleTimeString('es-AR').slice(0, 5),
            action: `[WhatsApp Web] Notificación abierta para el evento: ${event.toUpperCase()}`,
            user: currentUser?.fullname || 'Administración'
        }];

        const updated: Ticket = {
            ...selectedTicket,
            history: updatedHistory
        };

        updateTicketAction(updated);
        setSelectedTicket(updated);
    };

    // Detail drawer open
    const handleOpenDetail = (t: Ticket) => {
        setSelectedTicket(t);
        setEditStatus(t.status);
        setEditDiagnostic(t.diagnostic || '');
        setEditActionTaken(t.actionTaken || '');
        setEditPartsUsed(t.partsUsed || '');
        setEditPartsNeeded(t.partsNeeded || '');
        setEditAssignedTechId(t.assignedTechId || '');
        setEditTechnicalCost(String(t.technicalCost || 0));
        setEditObservations(t.observations || '');
        
        const machine = machines.find(m => m.id === t.machineId);
        setEditMachineStatus(machine ? machine.status : '');

        setAutoAssignExplanation(null);
    };

    // Save ticket details inside Drawer
    const handleSaveTicketDetails = async () => {
        if (!selectedTicket) return;

        // 1. VALIDACIÓN OBLIGATORIA: Si no es nuevo, requiere técnico
        if (editStatus !== 'nuevo' && !editAssignedTechId) {
            alert('¡Atención! Para actualizar el ticket a un estado diferente de "Nuevo" (Triage inicial), debe asignar obligatoriamente un técnico responsable.');
            return;
        }

        const currentTech = users.find(u => u.id === editAssignedTechId);
        const originalTech = users.find(u => u.id === selectedTicket.assignedTechId);
        
        let newHistory = [...(selectedTicket.history || [])];
        let notificationPromise: Promise<string> | null = null;

        // A. Cambio de estado
        if (selectedTicket.status !== editStatus) {
            newHistory.push({
                date: new Date().toISOString().split('T')[0],
                time: new Date().toLocaleTimeString('es-AR').slice(0, 5),
                action: `Cambio de estado a: ${editStatus.toUpperCase()}`,
                user: currentUser?.fullname || 'Sistema'
            });

            if (editStatus === 'esperando-repuesto' && currentTech) {
                notificationPromise = notifyTech('esperando_repuesto', selectedTicket, currentTech);
            } else if (editStatus === 'resuelto' && currentTech) {
                notificationPromise = notifyTech('resuelto', selectedTicket, currentTech);
            } else if (editStatus === 'cerrado' && currentTech) {
                notificationPromise = notifyTech('cerrado', selectedTicket, currentTech);
            }
        }

        // B. Reasignación / Asignación
        if (selectedTicket.assignedTechId !== editAssignedTechId && editAssignedTechId) {
            const actionText = originalTech 
                ? `Reasignado de ${originalTech.fullname} a ${currentTech?.fullname}`
                : `Asignado al técnico ${currentTech?.fullname}`;
            
            newHistory.push({
                date: new Date().toISOString().split('T')[0],
                time: new Date().toLocaleTimeString('es-AR').slice(0, 5),
                action: actionText,
                user: currentUser?.fullname || 'Sistema'
            });

            if (currentTech) {
                const eventType = originalTech ? 'reasignado' : 'asignado';
                notificationPromise = notifyTech(eventType, selectedTicket, currentTech);
            }
        }

        // C. Sincronización del estado operativo de la máquina
        let machineUpdate: { id: string; status: any } | undefined = undefined;
        if (selectedTicket.machineId && editMachineStatus) {
            const mach = machines.find(m => m.id === selectedTicket.machineId);
            if (mach && mach.status !== editMachineStatus) {
                machineUpdate = { id: selectedTicket.machineId, status: editMachineStatus as any };
                newHistory.push({
                    date: new Date().toISOString().split('T')[0],
                    time: new Date().toLocaleTimeString('es-AR').slice(0, 5),
                    action: `Estado de la máquina cambiado a: ${editMachineStatus.toUpperCase()}`,
                    user: currentUser?.fullname || 'Sistema'
                });
            }
        }

        const isResolvedState = editStatus === 'resuelto';
        const isClosedState = editStatus === 'cerrado';

        const updated: Ticket = {
            ...selectedTicket,
            status: editStatus,
            diagnostic: editDiagnostic,
            actionTaken: editActionTaken,
            partsUsed: editPartsUsed,
            partsNeeded: editPartsNeeded,
            assignedTechId: editAssignedTechId || null,
            technicalCost: Number(editTechnicalCost) || 0,
            observations: editObservations,
            history: newHistory,
            resolvedAt: isResolvedState ? Date.now() : selectedTicket.resolvedAt,
            closedAt: isClosedState ? Date.now() : selectedTicket.closedAt
        };

        if (notificationPromise) {
            const logActionText = await notificationPromise;
            updated.history?.push({
                date: new Date().toISOString().split('T')[0],
                time: new Date().toLocaleTimeString('es-AR').slice(0, 5),
                action: logActionText,
                user: 'Sistema'
            });
        }

        // Use context action
        updateTicketAction(updated, machineUpdate);
        setSelectedTicket(updated);
        alert('¡Ficha del ticket técnico guardada correctamente!');
    };

    // Open create ticket form modal
    const handleOpenCreate = () => {
        setNewClientType('existente');
        setNewClientId('');
        setNewClientName('');
        setNewClientAddress('');
        setNewClientPhone('');
        setNewClientEmail('');
        setNewClientContact('');
        setNewMachineId('');
        setNewMachineDesc('');
        setNewSerialNumber('');
        setNewCategory('Servicio');
        setNewPriority('media');
        setNewDescription('');
        setNewAssignedTechId('');
        setShouldAutoAssignOnCreate(false);
        setIsCreating(true);
    };

    // Create support ticket
    const handleCreateTicket = async (e: React.FormEvent) => {
        e.preventDefault();
        
        let clientNameVal = '';
        let clientAddressVal = '';
        let clientPhoneVal = '';
        let clientEmailVal = '';
        let clientContactVal = '';
        let machineDescVal = '';
        let serialVal = '';

        if (newClientType === 'existente') {
            const client = clients.find(c => c.id === newClientId);
            const machine = machines.find(m => m.id === newMachineId);

            if (!client || !machine) {
                alert('Selecciona un cliente y un equipo del sistema.');
                return;
            }
            clientNameVal = client.name;
            clientAddressVal = client.address;
            clientPhoneVal = client.phone || '';
            clientEmailVal = client.email || '';
            clientContactVal = client.name;
            machineDescVal = `${machine.brand} ${machine.model}`;
            serialVal = machine.serial;
        } else {
            if (!newClientName || !newMachineDesc) {
                alert('Escribe el Nombre del Cliente y el Modelo de la Máquina.');
                return;
            }
            clientNameVal = newClientName;
            clientAddressVal = newClientAddress;
            clientPhoneVal = newClientPhone;
            clientEmailVal = newClientEmail;
            clientContactVal = newClientContact;
            machineDescVal = newMachineDesc;
            serialVal = newSerialNumber;
        }

        const computedSla = calculateSlaDate(newPriority);

        let finalTechId = newAssignedTechId || null;
        let creationHistoryLog = 'Ticket registrado e ingresado al sistema.';

        // Si se seleccionó autoasignación automática en la creación
        if (shouldAutoAssignOnCreate) {
            const dummyTicket: Ticket = {
                id: 'dummy',
                machineId: null,
                clientId: null,
                clientName: clientNameVal,
                clientAddress: clientAddressVal,
                machineDesc: machineDescVal,
                category: newCategory,
                priority: newPriority,
                status: 'nuevo',
                description: newDescription,
                serialNumber: serialVal,
                clientType: newClientType,
                date: '',
                time: '',
                diagnostic: '',
                actionTaken: '',
                partsNeeded: '',
                partsUsed: '',
                internalNotes: '',
                assignedTechId: null,
                slaDate: ''
            };
            const result = autoAssignTech(dummyTicket, users, tickets);
            if (result.techId) {
                finalTechId = result.techId;
                const tech = users.find(u => u.id === result.techId);
                creationHistoryLog += ` Autoasignado inteligentemente a: ${tech?.fullname}. Motivo: ${result.reason}.`;
            }
        }

        const initialTicket: Ticket = {
            id: 'ticket-' + Date.now(),
            machineId: newClientType === 'existente' ? newMachineId : null,
            clientId: newClientType === 'existente' ? newClientId : null,
            clientName: clientNameVal,
            clientAddress: clientAddressVal,
            clientPhone: clientPhoneVal,
            clientEmail: clientEmailVal,
            clientContact: clientContactVal,
            machineDesc: machineDescVal,
            serialNumber: serialVal,
            clientType: newClientType,
            date: new Date().toISOString().split('T')[0],
            time: new Date().toLocaleTimeString('es-AR').slice(0, 5),
            priority: newPriority,
            status: finalTechId ? 'asignado' : 'nuevo',
            category: newCategory,
            description: newDescription,
            diagnostic: '',
            actionTaken: '',
            partsNeeded: '',
            partsUsed: '',
            internalNotes: '',
            assignedTechId: finalTechId,
            slaDate: computedSla.toISOString(),
            createdAt: Date.now(),
            history: [
                {
                    date: new Date().toISOString().split('T')[0],
                    time: new Date().toLocaleTimeString('es-AR').slice(0, 5),
                    action: creationHistoryLog,
                    user: currentUser?.fullname || 'Sistema'
                }
            ]
        };

        const assignedTech = users.find(u => u.id === finalTechId);
        if (assignedTech) {
            const logText = await notifyTech('creado', initialTicket, assignedTech);
            initialTicket.history?.push({
                date: new Date().toISOString().split('T')[0],
                time: new Date().toLocaleTimeString('es-AR').slice(0, 5),
                action: logText,
                user: 'Sistema'
            });
        }

        // Use context action (adds to state, saves localStorage, and schedules sync item)
        updateTicketAction(initialTicket);
        setIsCreating(false);
        handleOpenDetail(initialTicket);
    };

    // Open Technician creation form
    const handleOpenCreateTech = () => {
        setEditingTech(null);
        setFormTechFullname('');
        setFormTechUsername('');
        setFormTechEmail('');
        setFormTechPhone('');
        setFormTechWhatsapp('');
        setFormTechZone('');
        setFormTechSpecialty('');
        setFormTechAvailability('Disponible');
        setFormTechActive(true);
        setFormTechWorkHours('08:00 a 17:00 hs');
        setFormTechInternalNotes('');
        setIsTechFormOpen(true);
    };

    // Open Technician edit form
    const handleOpenEditTech = (tech: User) => {
        setEditingTech(tech);
        setFormTechFullname(tech.fullname);
        setFormTechUsername(tech.username);
        setFormTechEmail(tech.email);
        setFormTechPhone(tech.phone || '');
        setFormTechWhatsapp(tech.whatsapp || '');
        setFormTechZone(tech.zone || '');
        setFormTechSpecialty(tech.specialty || '');
        setFormTechAvailability(tech.availability || 'Disponible');
        setFormTechActive(tech.active !== false);
        setFormTechWorkHours(tech.workHours || '08:00 a 17:00 hs');
        setFormTechInternalNotes(tech.internalNotes || '');
        setIsTechFormOpen(true);
    };

    // Save Technician (Create or Edit)
    const handleSaveTech = (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!formTechFullname || !formTechEmail || !formTechUsername) {
            alert('Por favor completa los campos obligatorios: Nombre, Usuario y Email.');
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formTechEmail)) {
            alert('Por favor ingresa un correo electrónico con formato válido.');
            return;
        }

        if (editingTech) {
            const updated = {
                ...editingTech,
                fullname: formTechFullname,
                username: formTechUsername,
                email: formTechEmail,
                phone: formTechPhone,
                whatsapp: formTechWhatsapp,
                zone: formTechZone,
                specialty: formTechSpecialty,
                availability: formTechAvailability,
                active: formTechActive,
                workHours: formTechWorkHours,
                internalNotes: formTechInternalNotes
            };
            updateUserAction(updated, 'update');
            alert('¡Perfil del técnico actualizado con éxito!');
        } else {
            const newTech: User = {
                id: 'user-tech-' + Date.now(),
                fullname: formTechFullname,
                username: formTechUsername,
                email: formTechEmail,
                role: 'tecnico',
                phone: formTechPhone,
                whatsapp: formTechWhatsapp,
                zone: formTechZone,
                specialty: formTechSpecialty,
                availability: formTechAvailability,
                active: formTechActive,
                workHours: formTechWorkHours,
                internalNotes: formTechInternalNotes
            };
            updateUserAction(newTech, 'create');
            alert('¡Nuevo técnico registrado en el sistema!');
        }
        setIsTechFormOpen(false);
    };

    // Logical delete of technician
    const handleDeleteTech = (tech: User) => {
        if (confirm(`¿Estás seguro de que deseas dar de baja al técnico ${tech.fullname}? No se borrará del sistema pero se marcará como Inactivo.`)) {
            const updated = {
                ...tech,
                active: false
            };
            updateUserAction(updated, 'update');
        }
    };

    // KPIs Calculations
    const totalCount = tickets.length;
    const newCount = tickets.filter(t => t.status === 'nuevo').length;
    const activeCount = tickets.filter(t => ['asignado', 'en-camino', 'en-proceso'].includes(t.status)).length;
    const partsWaitCount = tickets.filter(t => t.status === 'esperando-repuesto').length;
    const resolvedCount = tickets.filter(t => ['resuelto', 'cerrado'].includes(t.status)).length;
    const criticalCount = tickets.filter(t => {
        const slaState = getSlaStatus(t.slaDate, t.status);
        return slaState.status === 'vencido' || slaState.status === 'por_vencer';
    }).length;

    // Filter tickets
    const filteredTickets = tickets.filter(t => {
        const query = searchQuery.toLowerCase();
        const matchesQuery = 
            t.clientName.toLowerCase().includes(query) ||
            t.machineDesc.toLowerCase().includes(query) ||
            (t.serialNumber && t.serialNumber.toLowerCase().includes(query)) ||
            t.id.toLowerCase().includes(query);

        const matchesTech = !filterTech || t.assignedTechId === filterTech;
        const matchesPriority = !filterPriority || t.priority === filterPriority;
        const matchesStatus = !filterStatus || t.status === filterStatus;

        const slaState = getSlaStatus(t.slaDate, t.status);
        const matchesSla = !filterSla || slaState.status === filterSla;

        let matchesTab = true;
        if (activeKpiTab === 'nuevos') matchesTab = t.status === 'nuevo';
        else if (activeKpiTab === 'activos') matchesTab = ['asignado', 'en-camino', 'en-proceso'].includes(t.status);
        else if (activeKpiTab === 'esperando') matchesTab = t.status === 'esperando-repuesto';
        else if (activeKpiTab === 'resueltos') matchesTab = ['resuelto', 'cerrado'].includes(t.status);
        else if (activeKpiTab === 'criticos') matchesTab = slaState.status === 'vencido' || slaState.status === 'por_vencer';

        return matchesQuery && matchesTech && matchesPriority && matchesStatus && matchesSla && matchesTab;
    });

    // Filter technicians
    const filteredTechs = users.filter(u => {
        if (u.role !== 'tecnico') return false;

        const query = searchTechQuery.toLowerCase();
        const matchesQuery = 
            u.fullname.toLowerCase().includes(query) || 
            (u.zone && u.zone.toLowerCase().includes(query)) ||
            (u.specialty && u.specialty.toLowerCase().includes(query));

        const matchesActive = !filterTechActive || 
            (filterTechActive === 'activo' ? u.active !== false : u.active === false);

        const matchesZone = !filterTechZone || (u.zone && u.zone.toLowerCase().includes(filterTechZone.toLowerCase()));
        const matchesSpecialty = !filterTechSpecialty || (u.specialty && u.specialty.toLowerCase().includes(filterTechSpecialty.toLowerCase()));

        return matchesQuery && matchesActive && matchesZone && matchesSpecialty;
    });

    // Filter notification history logs
    const filteredLogs = notificationLogs.filter(log => {
        const query = searchLogQuery.toLowerCase();
        const matchesQuery = 
            log.ticketId.toLowerCase().includes(query) ||
            log.recipient.toLowerCase().includes(query) ||
            log.event.toLowerCase().includes(query);

        const matchesChannel = !filterLogChannel || log.channel === filterLogChannel;
        const matchesStatus = !filterLogStatus || log.status === filterLogStatus;

        return matchesQuery && matchesChannel && matchesStatus;
    });

    // Global performance indicators for metrics tab
    const resolvedGlobal = tickets.filter(t => ['resuelto', 'cerrado'].includes(t.status));
    let globalSlaCompliant = 0;
    let globalTotalTimeMs = 0;
    
    resolvedGlobal.forEach(t => {
        if (t.resolvedAt && t.slaDate && new Date(t.resolvedAt) <= new Date(t.slaDate)) {
            globalSlaCompliant++;
        }
        const created = t.createdAt || (new Date(t.date + 'T' + t.time).getTime());
        if (t.resolvedAt && !isNaN(created)) {
            globalTotalTimeMs += (t.resolvedAt - created);
        }
    });

    const globalSlaRate = resolvedGlobal.length > 0 ? Math.round((globalSlaCompliant / resolvedGlobal.length) * 100) : 100;
    const globalAvgResolutionHours = resolvedGlobal.length > 0 ? Math.round((globalTotalTimeMs / (1000 * 60 * 60 * resolvedGlobal.length)) * 10) / 10 : 0;

    // Find star technician
    const techsList = users.filter(u => u.role === 'tecnico' && u.active !== false);
    let starTechName = 'Sin datos';
    let bestCompliance = -1;

    techsList.forEach(t => {
        const stats = getTechMetrics(t.id);
        if (stats.resolvedCount > 0 && stats.complianceRate > bestCompliance) {
            bestCompliance = stats.complianceRate;
            starTechName = t.fullname;
        }
    });

    const getTechWarningInfo = (techId: string | null) => {
        if (!techId) return null;
        const tech = users.find(u => u.id === techId);
        if (!tech) return null;

        const hasEmail = !!tech.email;
        const hasWhatsapp = !!tech.whatsapp;

        if (!hasEmail && !hasWhatsapp) {
            return { type: 'critical', text: '🚨 El técnico no tiene email ni WhatsApp configurados. No recibirá notificaciones.' };
        }
        if (!hasEmail) {
            return { type: 'warning', text: '⚠️ Sin email registrado. Recibirá solo WhatsApp (si el canal está habilitado).' };
        }
        if (!hasWhatsapp) {
            return { type: 'warning', text: '⚠️ Sin WhatsApp registrado. Recibirá solo Email (si el canal está habilitado).' };
        }
        return { type: 'ok', text: '✓ Canales de notificaciones de WhatsApp e Email listos.' };
    };

    const techWarn = getTechWarningInfo(editAssignedTechId);

    return (
        <div className="space-y-6 animate-fade-in relative text-slate-100">
            {/* Header section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 border-b border-slate-850 pb-4">
                <div>
                    <h2 className="text-base font-semibold text-slate-100 uppercase tracking-wider">Módulo de Asistencia Técnica</h2>
                    <p className="text-[10px] text-slate-400">Seguimiento de incidentes, SLAs automáticos, técnicos y notificaciones.</p>
                </div>
                {/* Tab Navigation header */}
                <div className="flex bg-slate-950 p-1.5 rounded-xl border border-slate-850 gap-1.5 text-xs overflow-x-auto max-w-full">
                    <button 
                        onClick={() => setCurrentTab('bitacora')}
                        className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 shrink-0 ${
                            currentTab === 'bitacora' ? 'bg-indigo-650 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
                        }`}
                    >
                        <CheckSquare size={13} /> Bitácora
                    </button>
                    <button 
                        onClick={() => setCurrentTab('mantenimiento')}
                        className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 shrink-0 ${
                            currentTab === 'mantenimiento' ? 'bg-indigo-650 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
                        }`}
                    >
                        <Wrench size={13} className="text-amber-500" /> Preventivos
                    </button>
                    <button 
                        onClick={() => setCurrentTab('tecnicos')}
                        className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 shrink-0 ${
                            currentTab === 'tecnicos' ? 'bg-indigo-650 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
                        }`}
                    >
                        <Users size={13} /> Técnicos
                    </button>
                    <button 
                        onClick={() => setCurrentTab('config')}
                        className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 shrink-0 ${
                            currentTab === 'config' ? 'bg-indigo-650 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
                        }`}
                    >
                        <Bell size={13} /> Canales y Plantillas
                    </button>
                    <button 
                        onClick={() => setCurrentTab('historial_envios')}
                        className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 shrink-0 ${
                            currentTab === 'historial_envios' ? 'bg-indigo-650 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
                        }`}
                    >
                        <History size={13} /> Auditoría Notificaciones
                    </button>
                    <button 
                        onClick={() => setCurrentTab('metricas')}
                        className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 shrink-0 ${
                            currentTab === 'metricas' ? 'bg-indigo-650 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
                        }`}
                    >
                        <Activity size={13} /> Desempeño / Métricas
                    </button>
                </div>
            </div>

            {/* ========================================================================= */}
            {/* TABS 1: TICKETS BITÁCORA */}
            {/* ========================================================================= */}
            {currentTab === 'bitacora' && (
                <div className="space-y-6 animate-fade-in">
                    {/* KPIs grid */}
                    <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 pt-1">
                        <button 
                            onClick={() => setActiveKpiTab('todos')}
                            className={`p-3 rounded-xl border text-left transition-all relative ${
                                activeKpiTab === 'todos' 
                                    ? 'bg-slate-900 border-indigo-500/50 shadow-lg shadow-indigo-950/20' 
                                    : 'bg-slate-950 border-slate-850/60 hover:bg-slate-900/60'
                            }`}
                        >
                            <span className="block text-[9px] uppercase font-bold text-slate-450">Total Tickets</span>
                            <span className="block text-lg font-extrabold text-slate-100 mt-1">{totalCount}</span>
                        </button>
                        <button 
                            onClick={() => setActiveKpiTab('nuevos')}
                            className={`p-3 rounded-xl border text-left transition-all ${
                                activeKpiTab === 'nuevos' 
                                    ? 'bg-slate-900 border-violet-500/50 shadow-lg shadow-violet-950/20' 
                                    : 'bg-slate-950 border-slate-850/60 hover:bg-slate-900/60'
                            }`}
                        >
                            <span className="block text-[9px] uppercase font-bold text-slate-450">Nuevos (Triage)</span>
                            <span className="block text-lg font-extrabold text-violet-400 mt-1">{newCount}</span>
                        </button>
                        <button 
                            onClick={() => setActiveKpiTab('activos')}
                            className={`p-3 rounded-xl border text-left transition-all ${
                                activeKpiTab === 'activos' 
                                    ? 'bg-slate-900 border-amber-500/50 shadow-lg shadow-amber-950/20' 
                                    : 'bg-slate-950 border-slate-850/60 hover:bg-slate-900/60'
                            }`}
                        >
                            <span className="block text-[9px] uppercase font-bold text-slate-450">Activos / En Viaje</span>
                            <span className="block text-lg font-extrabold text-amber-400 mt-1">{activeCount}</span>
                        </button>
                        <button 
                            onClick={() => setActiveKpiTab('esperando')}
                            className={`p-3 rounded-xl border text-left transition-all ${
                                activeKpiTab === 'esperando' 
                                    ? 'bg-slate-900 border-orange-500/50 shadow-lg shadow-orange-950/20' 
                                    : 'bg-slate-950 border-slate-850/60 hover:bg-slate-900/60'
                            }`}
                        >
                            <span className="block text-[9px] uppercase font-bold text-slate-450">Esperando Repuesto</span>
                            <span className="block text-lg font-extrabold text-orange-455 mt-1">{partsWaitCount}</span>
                        </button>
                        <button 
                            onClick={() => setActiveKpiTab('resueltos')}
                            className={`p-3 rounded-xl border text-left transition-all ${
                                activeKpiTab === 'resueltos' 
                                    ? 'bg-slate-900 border-emerald-500/50 shadow-lg shadow-emerald-950/20' 
                                    : 'bg-slate-950 border-slate-850/60 hover:bg-slate-900/60'
                            }`}
                        >
                            <span className="block text-[9px] uppercase font-bold text-slate-450">Resueltos / Cerrados</span>
                            <span className="block text-lg font-extrabold text-emerald-450 mt-1">{resolvedCount}</span>
                        </button>
                        <button 
                            onClick={() => setActiveKpiTab('criticos')}
                            className={`p-3 rounded-xl border text-left transition-all ${
                                activeKpiTab === 'criticos' 
                                    ? 'bg-slate-900 border-red-500/50 shadow-lg shadow-red-950/20' 
                                    : 'bg-slate-950 border-slate-850/60 hover:bg-slate-900/60'
                            }`}
                        >
                            <span className="block text-[9px] uppercase font-bold text-slate-450 flex items-center gap-1">
                                SLA Críticos {criticalCount > 0 && <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />}
                            </span>
                            <span className="block text-lg font-extrabold text-red-500 mt-1">{criticalCount}</span>
                        </button>
                    </div>

                    {/* Filter toolbar */}
                    <div className="p-4 bg-slate-955 border border-slate-850/60 rounded-xl space-y-3">
                        <div className="flex justify-between items-center text-xs font-semibold text-slate-400">
                            <div className="flex items-center gap-2">
                                <Filter size={14} /> Filtros de Asistencia
                            </div>
                            <div className="flex gap-2">
                                <Button 
                                    variant="secondary" 
                                    size="sm" 
                                    onClick={handleRunSlaCron} 
                                    disabled={isSimulatingCron}
                                    className="flex items-center gap-1 bg-slate-900 border-slate-800"
                                >
                                    <RefreshCw size={12} className={isSimulatingCron ? 'animate-spin' : ''} /> 
                                    🚀 Correr Cron SLA y Escalamiento
                                </Button>
                                <Button variant="primary" size="sm" onClick={handleOpenCreate}>
                                    <Plus size={14} className="mr-1" /> Nuevo Ticket
                                </Button>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
                            <div className="relative">
                                <span className="absolute inset-y-0 left-3 flex items-center text-slate-500">
                                    <Search size={14} />
                                </span>
                                <input
                                    type="text"
                                    placeholder="Buscar cliente, modelo, serie..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                />
                            </div>
                            <select
                                value={filterTech}
                                onChange={(e) => setFilterTech(e.target.value)}
                                className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-slate-350 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            >
                                <option value="">Técnico Responsable: Todos</option>
                                {users.filter(u => u.role === 'tecnico').map(u => (
                                    <option key={u.id} value={u.id}>{u.fullname}</option>
                                ))}
                            </select>
                            <select
                                value={filterPriority}
                                onChange={(e) => setFilterPriority(e.target.value)}
                                className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-slate-350 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            >
                                <option value="">Prioridad: Todas</option>
                                <option value="baja">Baja</option>
                                <option value="media">Media</option>
                                <option value="alta">Alta</option>
                                <option value="urgente">Urgente</option>
                            </select>
                            <select
                                value={filterStatus}
                                onChange={(e) => setFilterStatus(e.target.value)}
                                className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-slate-355 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            >
                                <option value="">Estado: Todos</option>
                                <option value="nuevo">Nuevo</option>
                                <option value="asignado">Asignado</option>
                                <option value="en-camino">En Camino</option>
                                <option value="en-proceso">En Proceso</option>
                                <option value="esperando-repuesto">Esperando Repuesto</option>
                                <option value="resuelto">Resuelto</option>
                                <option value="cerrado">Cerrado</option>
                            </select>
                            <select
                                value={filterSla}
                                onChange={(e) => setFilterSla(e.target.value)}
                                className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-slate-355 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            >
                                <option value="">Estado SLA: Todos</option>
                                <option value="vencido">Vencido</option>
                                <option value="por_vencer">Por vencer (menor a 4h)</option>
                                <option value="ok">A tiempo / Cumplido</option>
                            </select>
                        </div>
                    </div>

                    {/* Table View */}
                    <TableContainer>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHeaderCell>ID / Prioridad</TableHeaderCell>
                                    <TableHeaderCell>Cliente</TableHeaderCell>
                                    <TableHeaderCell>Equipo / Serie</TableHeaderCell>
                                    <TableHeaderCell>Categoría / Falla</TableHeaderCell>
                                    <TableHeaderCell>Técnico</TableHeaderCell>
                                    <TableHeaderCell>Fecha Límite (SLA)</TableHeaderCell>
                                    <TableHeaderCell>Estado</TableHeaderCell>
                                    <TableHeaderCell className="text-right">Acción</TableHeaderCell>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredTickets.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="text-center py-12 text-slate-500 text-xs italic">
                                            No se encontraron tickets con los filtros actuales.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredTickets.map(t => {
                                        const tech = users.find(u => u.id === t.assignedTechId);
                                        const sla = getSlaStatus(t.slaDate, t.status);

                                        return (
                                            <TableRow key={t.id} className="hover:bg-slate-900/45 cursor-pointer transition-colors" onClick={() => handleOpenDetail(t)}>
                                                <TableCell className="text-xs">
                                                    <span className="block font-mono text-[10px] text-slate-500 mb-1">
                                                        TCK-{t.id.replace('ticket-', '')}
                                                    </span>
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-extrabold tracking-wider ${
                                                        t.priority === 'urgente' ? 'bg-red-650 text-white animate-pulse' :
                                                        t.priority === 'alta' ? 'bg-red-500/10 text-red-500' :
                                                        t.priority === 'media' ? 'bg-amber-500/10 text-amber-500' :
                                                        'bg-emerald-500/10 text-emerald-500'
                                                    }`}>
                                                        {t.priority.toUpperCase()}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="font-bold text-slate-100 max-w-[160px] truncate">
                                                    {t.clientName}
                                                </TableCell>
                                                <TableCell className="text-xs text-slate-350">
                                                    <strong>{t.machineDesc}</strong>
                                                    <span className="block text-slate-500 text-[10px] font-mono mt-0.5">{t.serialNumber || 'Sin Nro Serie'}</span>
                                                </TableCell>
                                                <TableCell className="text-xs text-slate-350 max-w-[180px] truncate">
                                                    <span className="font-bold text-indigo-400 block text-[10px]">{t.category}</span>
                                                    <span className="text-slate-400 block mt-0.5">{t.description}</span>
                                                </TableCell>
                                                <TableCell className="text-xs">
                                                    {tech ? (
                                                        <div className="flex items-center gap-1.5">
                                                            <div className="w-5 h-5 rounded-full bg-slate-800 text-[9px] font-bold text-indigo-455 flex items-center justify-center border border-slate-700">
                                                                {(tech.fullname || '').split(' ').map(n => n[0] || '').join('')}
                                                            </div>
                                                            <span className="text-slate-350 font-semibold">{tech.fullname}</span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-slate-550 italic">Sin asignar</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-xs">
                                                    <span className={`px-2 py-0.5 rounded-xl border text-[9px] font-semibold ${sla.color}`}>
                                                        {sla.text}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-xs">
                                                    <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase ${
                                                        t.status === 'nuevo' ? 'bg-indigo-950/60 text-indigo-400 border border-indigo-900/50' :
                                                        t.status === 'asignado' ? 'bg-blue-950/60 text-blue-405 border border-blue-900/50' :
                                                        t.status === 'en-camino' ? 'bg-cyan-955/60 text-cyan-405 border border-cyan-900/50' :
                                                        t.status === 'en-proceso' ? 'bg-amber-955/60 text-amber-405 border border-amber-900/50' :
                                                        t.status === 'esperando-repuesto' ? 'bg-orange-955/60 text-orange-405 border border-orange-900/50' :
                                                        t.status === 'resuelto' ? 'bg-emerald-955/60 text-emerald-450 border border-emerald-900/50' :
                                                        'bg-slate-900 text-slate-550 border border-slate-800'
                                                    }`}>
                                                        {t.status.replace('-', ' ')}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Button variant="secondary" size="sm" onClick={(e) => { e.stopPropagation(); handleOpenDetail(t); }}>
                                                        Detalles →
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </div>
            )}

            {/* ========================================================================= */}
            {/* TABS: MANTENIMIENTO PREVENTIVO */}
            {/* ========================================================================= */}
            {currentTab === 'mantenimiento' && (
                <div className="space-y-6 animate-fade-in">
                    {/* Metrics grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Card className="bg-slate-950 border border-slate-850 p-4 space-y-1">
                            <span className="text-[10px] text-slate-450 uppercase font-extrabold tracking-wider block">Preventivos Vencidos</span>
                            <span className="text-2xl font-extrabold text-red-500 block">
                                {machines.filter(m => (m.currentCounter || 0) - (m.lastServiceCounter || 0) >= (m.preventiveInterval || 15000)).length} equipos
                            </span>
                            <p className="text-[9px] text-slate-500 mt-1">Superaron el intervalo recomendado de copias sin service.</p>
                        </Card>
                        <Card className="bg-slate-950 border border-slate-850 p-4 space-y-1">
                            <span className="text-[10px] text-slate-450 uppercase font-extrabold tracking-wider block">Próximos a Vencer</span>
                            <span className="text-2xl font-extrabold text-amber-500 block">
                                {machines.filter(m => {
                                    const diff = (m.currentCounter || 0) - (m.lastServiceCounter || 0);
                                    const limit = m.preventiveInterval || 15000;
                                    return diff >= limit * 0.8 && diff < limit;
                                }).length} equipos
                            </span>
                            <p className="text-[9px] text-slate-500 mt-1">Se encuentran dentro del 80% al 99% del límite de copias.</p>
                        </Card>
                        <Card className="bg-slate-950 border border-slate-850 p-4 space-y-1">
                            <span className="text-[10px] text-slate-455 uppercase font-extrabold tracking-wider block">Estado de Mantenimiento</span>
                            <span className="text-2xl font-extrabold text-emerald-450 block">
                                {Math.round((machines.filter(m => ((m.currentCounter || 0) - (m.lastServiceCounter || 0)) < (m.preventiveInterval || 15000)).length / Math.max(1, machines.length)) * 100)}%
                            </span>
                            <p className="text-[9px] text-slate-500 mt-1">Porcentaje de flota operativa dentro del rango preventivo seguro.</p>
                        </Card>
                    </div>

                    {/* Table of preventative actions */}
                    <TableContainer>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHeaderCell>Equipo / Modelo</TableHeaderCell>
                                    <TableHeaderCell>Número de Serie</TableHeaderCell>
                                    <TableHeaderCell>Cliente / Ubicación</TableHeaderCell>
                                    <TableHeaderCell>Contador Actual</TableHeaderCell>
                                    <TableHeaderCell>Último Service</TableHeaderCell>
                                    <TableHeaderCell>Copias desde Service / Límite</TableHeaderCell>
                                    <TableHeaderCell>Alerta</TableHeaderCell>
                                    <TableHeaderCell className="text-right">Acciones</TableHeaderCell>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {machines.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="text-center py-12 text-slate-500 italic">
                                            No hay copiadoras registradas en el sistema.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    machines.map(m => {
                                        const cl = clients.find(c => c.id === m.clientId);
                                        const current = m.currentCounter || 0;
                                        const last = m.lastServiceCounter || 0;
                                        const limit = m.preventiveInterval || 15000;
                                        const diff = current - last;
                                        const isOverdue = diff >= limit;
                                        const isWarning = diff >= limit * 0.8 && diff < limit;

                                        let statusBadge = <span className="px-2 py-0.5 rounded text-[8px] font-extrabold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">NORMAL</span>;
                                        if (isOverdue) {
                                            statusBadge = <span className="px-2 py-0.5 rounded text-[8px] font-extrabold uppercase bg-red-500/10 text-red-500 border border-red-500/20 animate-pulse">VENCIDO</span>;
                                        } else if (isWarning) {
                                            statusBadge = <span className="px-2 py-0.5 rounded text-[8px] font-extrabold uppercase bg-amber-500/10 text-amber-500 border border-amber-500/20">ALERTA</span>;
                                        }

                                        // Quick trigger functions
                                        const triggerReset = () => {
                                            if (confirm(`¿Confirmas el registro del servicio preventivo de la máquina S/N ${m.serial}? Se actualizará el contador de último service a ${current.toLocaleString()}.`)) {
                                                setMachines(prev => prev.map(item => item.id === m.id ? { ...item, lastServiceCounter: current } : item));
                                                alert('¡Mantenimiento preventivo registrado exitosamente!');
                                            }
                                        };

                                        const triggerCreatePreventiveTicket = async () => {
                                            const computedSla = calculateSlaDate('media');
                                            const newTicket: Ticket = {
                                                id: 'ticket-' + Date.now(),
                                                machineId: m.id,
                                                clientId: m.clientId,
                                                clientName: cl ? cl.name : 'Stock Disponible',
                                                clientAddress: cl ? cl.address : 'Depósito',
                                                machineDesc: `${m.brand} ${m.model}`,
                                                serialNumber: m.serial,
                                                clientType: cl ? 'existente' : 'externo',
                                                date: new Date().toISOString().split('T')[0],
                                                time: new Date().toLocaleTimeString('es-AR').slice(0, 5),
                                                priority: 'media',
                                                status: 'nuevo',
                                                category: 'Servicio',
                                                description: `Mantenimiento preventivo programado requerido. Copias acumuladas desde último service: ${diff.toLocaleString('es-AR')}.`,
                                                diagnostic: '',
                                                actionTaken: '',
                                                partsNeeded: '',
                                                partsUsed: '',
                                                internalNotes: '',
                                                assignedTechId: null,
                                                slaDate: computedSla.toISOString(),
                                                createdAt: Date.now(),
                                                history: [
                                                    {
                                                        date: new Date().toISOString().split('T')[0],
                                                        time: new Date().toLocaleTimeString('es-AR').slice(0, 5),
                                                        action: 'Ticket de servicio preventivo autogenerado por límite de copias',
                                                        user: currentUser?.fullname || 'Sistema'
                                                    }
                                                ]
                                            };

                                            updateTicketAction(newTicket);
                                            alert('¡Orden de trabajo técnico para mantenimiento preventivo creada con éxito!');
                                        };

                                        return (
                                            <TableRow key={m.id} className="hover:bg-slate-900/40">
                                                <TableCell className="font-bold text-slate-100">{m.brand} {m.model}</TableCell>
                                                <TableCell className="font-mono text-xs text-slate-350">{m.serial}</TableCell>
                                                <TableCell className="text-xs text-slate-350">{cl ? cl.name : <span className="text-slate-550 italic">Stock en Taller</span>}</TableCell>
                                                <TableCell className="font-mono-tabular text-xs text-slate-300">{current.toLocaleString('es-AR')}</TableCell>
                                                <TableCell className="font-mono-tabular text-xs text-slate-400">{last.toLocaleString('es-AR')}</TableCell>
                                                <TableCell className="text-xs font-mono-tabular">
                                                    <div className="space-y-1">
                                                        <span className={isOverdue ? "text-red-500 font-extrabold" : (isWarning ? "text-amber-500 font-bold" : "text-slate-400")}>
                                                            {diff.toLocaleString('es-AR')} / {limit.toLocaleString('es-AR')}
                                                        </span>
                                                        <div className="w-full max-w-[120px] bg-slate-900 rounded-full h-1">
                                                            <div className={`h-1 rounded-full ${
                                                                isOverdue ? 'bg-red-500' : (isWarning ? 'bg-amber-500' : 'bg-emerald-500')
                                                            }`} style={{ width: `${Math.min(100, (diff / limit) * 100)}%` }} />
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-xs">{statusBadge}</TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex justify-end gap-1.5">
                                                        <Button 
                                                            variant="secondary" 
                                                            size="sm" 
                                                            onClick={triggerReset}
                                                            title="Registrar Mantenimiento (Reiniciar contador)"
                                                            className="flex items-center gap-1 bg-slate-900 border-slate-800"
                                                        >
                                                            <Check size={12} className="text-emerald-500" /> Registrar Service
                                                        </Button>
                                                        {isOverdue && (
                                                            <button 
                                                                onClick={triggerCreatePreventiveTicket}
                                                                title="Crear Ticket Preventivo"
                                                                className="px-2.5 py-1 bg-indigo-650 hover:bg-indigo-600 text-white rounded-xl text-[10px] font-bold transition-all flex items-center gap-1"
                                                            >
                                                                <PlusCircle size={11} /> Abrir Ticket
                                                            </button>
                                                        )}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </div>
            )}

            {/* ========================================================================= */}
            {/* TABS 2: PERSONAL TÉCNICO */}
            {/* ========================================================================= */}
            {currentTab === 'tecnicos' && (
                <div className="space-y-4 animate-fade-in">
                    {/* Filter / Search tech */}
                    <div className="p-4 bg-slate-950 border border-slate-850/60 rounded-xl space-y-3">
                        <div className="flex justify-between items-center text-xs font-semibold text-slate-400">
                            <div className="flex items-center gap-2">
                                <Filter size={14} /> Filtros de Técnicos
                            </div>
                            <Button variant="primary" size="sm" onClick={handleOpenCreateTech}>
                                <Plus size={14} className="mr-1" /> Registrar Técnico
                            </Button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                            <div className="relative">
                                <span className="absolute inset-y-0 left-3 flex items-center text-slate-500">
                                    <Search size={14} />
                                </span>
                                <input
                                    type="text"
                                    placeholder="Buscar por nombre, zona, marca..."
                                    value={searchTechQuery}
                                    onChange={(e) => setSearchTechQuery(e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                />
                            </div>
                            <select
                                value={filterTechActive}
                                onChange={(e) => setFilterTechActive(e.target.value)}
                                className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-slate-350 text-xs focus:outline-none"
                            >
                                <option value="">Estado: Todos</option>
                                <option value="activo">Activos</option>
                                <option value="inactivo">Inactivos</option>
                            </select>
                            <input
                                type="text"
                                placeholder="Filtrar por Zona..."
                                value={filterTechZone}
                                onChange={(e) => setFilterTechZone(e.target.value)}
                                className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-slate-355 text-xs focus:outline-none"
                            />
                            <input
                                type="text"
                                placeholder="Filtrar por Especialidad..."
                                value={filterTechSpecialty}
                                onChange={(e) => setFilterTechSpecialty(e.target.value)}
                                className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-slate-355 text-xs focus:outline-none"
                            />
                        </div>
                    </div>

                    {/* Technicians List Table */}
                    <TableContainer>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHeaderCell>Nombre y Apellido</TableHeaderCell>
                                    <TableHeaderCell>Usuario / Email</TableHeaderCell>
                                    <TableHeaderCell>WhatsApp / Tel</TableHeaderCell>
                                    <TableHeaderCell>Zona de Cobertura</TableHeaderCell>
                                    <TableHeaderCell>Especialidad / Marcas</TableHeaderCell>
                                    <TableHeaderCell>Estado / Disponibilidad</TableHeaderCell>
                                    <TableHeaderCell className="text-right">Acciones</TableHeaderCell>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredTechs.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center py-12 text-slate-500 text-xs italic">
                                            No hay personal técnico registrado con los filtros aplicados.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredTechs.map(tech => {
                                        return (
                                            <TableRow key={tech.id} className="hover:bg-slate-900/40">
                                                <TableCell className="font-bold text-slate-100">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-6 h-6 rounded-full bg-slate-800 text-[10px] font-bold text-indigo-400 flex items-center justify-center border border-slate-700">
                                                            {(tech.fullname || '').split(' ').map(n => n[0] || '').join('')}
                                                        </div>
                                                        <div>
                                                            <span className="block">{tech.fullname}</span>
                                                            <span className="block text-[9px] text-slate-505 font-mono mt-0.5">ID: {tech.id}</span>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-xs text-slate-350">
                                                    <span className="block font-bold text-[10px] text-slate-400">@{tech.username}</span>
                                                    <span className="block text-[10px] text-indigo-400">{tech.email}</span>
                                                </TableCell>
                                                <TableCell className="text-xs text-slate-355 font-mono">
                                                    <span className="block text-emerald-505 font-bold">{tech.whatsapp || 'Sin WhatsApp'}</span>
                                                    <span className="block text-slate-500 text-[10px]">{tech.phone || 'Sin Fijo'}</span>
                                                </TableCell>
                                                <TableCell className="text-xs text-slate-350 max-w-[150px] truncate">
                                                    {tech.zone || 'No asignada'}
                                                </TableCell>
                                                <TableCell className="text-xs text-slate-355 max-w-[155px] truncate font-semibold">
                                                    {tech.specialty || 'Servicio General'}
                                                </TableCell>
                                                <TableCell className="text-xs">
                                                    <div className="space-y-1">
                                                        <span className={`inline-flex px-2 py-0.5 rounded text-[9px] font-extrabold uppercase ${
                                                            tech.active !== false ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                                                        }`}>
                                                            {tech.active !== false ? 'Activo' : 'Inactivo'}
                                                        </span>
                                                        <span className={`block text-[9px] font-semibold text-slate-450 ${
                                                            tech.availability === 'Disponible' ? 'text-indigo-455' : 'text-slate-500'
                                                        }`}>
                                                            ● {tech.availability || 'Disponible'}
                                                        </span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex justify-end gap-1.5">
                                                        <Button 
                                                            variant="secondary" 
                                                            size="sm" 
                                                            onClick={() => setSelectedTech(tech)}
                                                        >
                                                            Ficha
                                                        </Button>
                                                        <Button 
                                                            variant="secondary" 
                                                            size="sm" 
                                                            onClick={() => handleOpenEditTech(tech)}
                                                        >
                                                            Editar
                                                        </Button>
                                                        {tech.active !== false && (
                                                            <button 
                                                                onClick={() => handleDeleteTech(tech)}
                                                                className="px-2 py-1 bg-red-955/20 text-red-400 border border-red-900/30 rounded-xl text-[10px] font-bold hover:bg-red-900/20 transition-all"
                                                            >
                                                                Baja
                                                            </button>
                                                        )}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </div>
            )}

            {/* ========================================================================= */}
            {/* TABS 3: CONFIGURACIÓN DE AVISOS */}
            {/* ========================================================================= */}
            {currentTab === 'config' && (
                <div className="space-y-6 animate-fade-in max-w-3xl">
                    <Card className="bg-slate-955 border border-slate-855">
                        <CardContent className="p-5 space-y-6 text-xs text-slate-350">
                            <div>
                                <h3 className="font-bold text-slate-100 text-sm">Habilitación de Canales de Alerta</h3>
                                <p className="text-[10px] text-slate-450">Define qué redes de despacho estarán activas en todo el sistema técnico.</p>
                                
                                <div className="grid grid-cols-2 gap-4 mt-3">
                                    <label className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
                                        configEmailEnabled ? 'bg-slate-900 border-indigo-500 text-slate-100' : 'bg-slate-955 border-slate-855 text-slate-500'
                                    }`}>
                                        <input 
                                            type="checkbox" 
                                            checked={configEmailEnabled} 
                                            onChange={(e) => setConfigEmailEnabled(e.target.checked)}
                                            className="w-4 h-4 accent-indigo-500 rounded" 
                                        />
                                        <div>
                                            <span className="font-bold block">Canal Correo Electrónico</span>
                                            <span className="text-[9px] text-slate-400 block mt-0.5">SMTP Yahoo configurado por servidor</span>
                                        </div>
                                    </label>

                                    <label className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
                                        configWhatsappEnabled ? 'bg-slate-900 border-indigo-500 text-slate-100' : 'bg-slate-955 border-slate-855 text-slate-500'
                                    }`}>
                                        <input 
                                            type="checkbox" 
                                            checked={configWhatsappEnabled} 
                                            onChange={(e) => setConfigWhatsappEnabled(e.target.checked)}
                                            className="w-4 h-4 accent-indigo-500 rounded" 
                                        />
                                        <div>
                                            <span className="font-bold block">Canal WhatsApp (Twilio/API)</span>
                                            <span className="text-[9px] text-slate-400 block mt-0.5">Envío directo de plantillas por consola</span>
                                        </div>
                                    </label>
                                </div>
                            </div>

                            {/* Event triggers configuration checkboxes */}
                            <div className="border-t border-slate-855 pt-4">
                                <h3 className="font-bold text-slate-100 text-sm">Eventos que Disparan Alertas</h3>
                                <p className="text-[10px] text-slate-455">Enciende o apaga el despacho automático al técnico según el estado del ticket.</p>
                                
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                                    {[
                                        { key: 'creado', label: 'Ticket Creado' },
                                        { key: 'asignado', label: 'Ticket Asignado' },
                                        { key: 'reasignado', label: 'Técnico Reasignado' },
                                        { key: 'sla_por_vencer', label: 'SLA por Vencer (menor a 4h)' },
                                        { key: 'sla_vencido', label: 'SLA Vencido' },
                                        { key: 'esperando_repuesto', label: 'Esperando Repuesto' },
                                        { key: 'resuelto', label: 'Ticket Resuelto' },
                                        { key: 'cerrado', label: 'Ticket Cerrado' },
                                    ].map(ev => (
                                        <label key={ev.key} className="flex items-center gap-2 p-2 bg-slate-900 border border-slate-855/60 rounded-xl cursor-pointer hover:bg-slate-900">
                                            <input 
                                                type="checkbox" 
                                                checked={configEvents[ev.key] !== false} 
                                                onChange={(e) => setConfigEvents(prev => ({ ...prev, [ev.key]: e.target.checked }))}
                                                className="w-3.5 h-3.5 accent-indigo-500 rounded"
                                            />
                                            <span className="font-medium text-[10px] text-slate-200">{ev.label}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* Custom message templates configurations */}
                            <div className="border-t border-slate-855 pt-4 space-y-4">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <h3 className="font-bold text-slate-100 text-sm">Edición de Plantillas de Mensajes</h3>
                                        <p className="text-[10px] text-slate-450">Define los textos globales con variables dinámicas.</p>
                                    </div>
                                    <span className="text-[9px] bg-indigo-950 text-indigo-400 px-2 py-0.5 rounded font-extrabold">Soporta HTML en Email</span>
                                </div>

                                <div className="space-y-3">
                                    <div className="space-y-1">
                                        <label className="text-[10px] uppercase font-bold text-slate-505">Plantilla Base WhatsApp / Texto Plano</label>
                                        <textarea
                                            value={configTemplates.whatsapp || ''}
                                            onChange={(e) => setConfigTemplates(prev => ({ ...prev, whatsapp: e.target.value }))}
                                            className="w-full bg-slate-900 border border-slate-850 rounded-xl p-3 text-slate-200 font-mono text-[10px] h-32 resize-y focus:border-indigo-500"
                                            placeholder="Escribe la plantilla de WhatsApp..."
                                        />
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-[10px] uppercase font-bold text-slate-505">Plantilla Base Email (Cuerpo HTML)</label>
                                        <textarea
                                            value={configTemplates.email || ''}
                                            onChange={(e) => setConfigTemplates(prev => ({ ...prev, email: e.target.value }))}
                                            className="w-full bg-slate-900 border border-slate-855 rounded-xl p-3 text-slate-200 font-mono text-[10px] h-48 resize-y focus:border-indigo-500"
                                            placeholder="Escribe la plantilla HTML de Correo..."
                                        />
                                    </div>
                                </div>

                                {/* Cheat sheet variables mapping */}
                                <div className="p-3 bg-slate-900 border border-slate-850 rounded-xl">
                                    <span className="text-[9px] font-extrabold text-indigo-400 block mb-1">Variables dinámicas de reemplazo disponibles:</span>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[9px] text-slate-400 font-mono">
                                        <div><strong>{"{ticket}"}</strong>: Nro de Ticket</div>
                                        <div><strong>{"{evento}"}</strong>: Nombre Evento</div>
                                        <div><strong>{"{cliente}"}</strong>: Nombre Cliente</div>
                                        <div><strong>{"{direccion}"}</strong>: Dirección</div>
                                        <div><strong>{"{equipo}"}</strong>: Marca y Modelo</div>
                                        <div><strong>{"{serie}"}</strong>: Nro Serie</div>
                                        <div><strong>{"{falla}"}</strong>: Falla descrita</div>
                                        <div><strong>{"{prioridad}"}</strong>: Prioridad</div>
                                        <div><strong>{"{tecnico}"}</strong>: Nombre Técnico</div>
                                        <div><strong>{"{sla}"}</strong>: Límite SLA</div>
                                        <div><strong>{"{enlace}"}</strong>: Enlace al ticket</div>
                                    </div>
                                </div>
                            </div>

                            <Button 
                                variant="primary" 
                                size="md" 
                                className="w-full" 
                                onClick={saveSettings}
                                disabled={isSavingConfig}
                            >
                                {isSavingConfig ? 'Guardando...' : 'Guardar Configuración en la Base de Datos'}
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* ========================================================================= */}
            {/* TABS 4: HISTORIAL DE NOTIFICACIONES */}
            {/* ========================================================================= */}
            {currentTab === 'historial_envios' && (
                <div className="space-y-4 animate-fade-in">
                    {/* Log Filter toolbar */}
                    <div className="p-4 bg-slate-950 border border-slate-850/60 rounded-xl space-y-3">
                        <div className="flex justify-between items-center text-xs font-semibold text-slate-450">
                            <div className="flex items-center gap-2">
                                <History size={14} /> Auditoría e Historial General de Alertas
                            </div>
                            <Button variant="secondary" size="sm" onClick={fetchLogs} className="flex items-center gap-1">
                                <RefreshCw size={12} className={isLoadingLogs ? 'animate-spin' : ''} /> Recargar Historial
                            </Button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                            <div className="relative">
                                <span className="absolute inset-y-0 left-3 flex items-center text-slate-500">
                                    <Search size={14} />
                                </span>
                                <input
                                    type="text"
                                    placeholder="Buscar por nro ticket, receptor, evento..."
                                    value={searchLogQuery}
                                    onChange={(e) => setSearchLogQuery(e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-slate-200 text-xs focus:outline-none"
                                />
                            </div>
                            <select
                                value={filterLogChannel}
                                onChange={(e) => setFilterLogChannel(e.target.value)}
                                className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-slate-355 text-xs focus:outline-none"
                            >
                                <option value="">Canal: Todos</option>
                                <option value="email">Email</option>
                                <option value="whatsapp">WhatsApp</option>
                            </select>
                            <select
                                value={filterLogStatus}
                                onChange={(e) => setFilterLogStatus(e.target.value)}
                                className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-slate-355 text-xs focus:outline-none"
                            >
                                <option value="">Estado Envío: Todos</option>
                                <option value="enviado">Enviado</option>
                                <option value="error">Error / Fallido</option>
                                <option value="pendiente">Pendiente</option>
                            </select>
                        </div>
                    </div>

                    {/* Logs Audit Table */}
                    <TableContainer>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHeaderCell>Fecha y Hora</TableHeaderCell>
                                    <TableHeaderCell>Ticket ID</TableHeaderCell>
                                    <TableHeaderCell>Técnico</TableHeaderCell>
                                    <TableHeaderCell>Canal</TableHeaderCell>
                                    <TableHeaderCell>Receptor</TableHeaderCell>
                                    <TableHeaderCell>Evento Gatillo</TableHeaderCell>
                                    <TableHeaderCell>Estado</TableHeaderCell>
                                    <TableHeaderCell className="text-right">Mensaje</TableHeaderCell>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoadingLogs ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="text-center py-12 text-slate-400 text-xs italic">
                                            Cargando auditoría histórica de notificaciones...
                                        </TableCell>
                                    </TableRow>
                                ) : filteredLogs.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="text-center py-12 text-slate-500 text-xs italic">
                                            No hay registros de notificaciones con los filtros actuales.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredLogs.map(log => {
                                        const tech = users.find(u => u.id === log.techId);
                                        const techName = tech ? tech.fullname : `ID: ${log.techId}`;

                                        return (
                                            <TableRow key={log.id} className="hover:bg-slate-900/40">
                                                <TableCell className="font-mono text-xs text-slate-400">
                                                    {new Date(log.createdAt).toLocaleString('es-AR')}
                                                </TableCell>
                                                <TableCell className="font-mono font-bold text-[10px] text-indigo-400">
                                                    TCK-{log.ticketId.replace('ticket-', '')}
                                                </TableCell>
                                                <TableCell className="text-xs text-slate-300 font-medium">
                                                    {techName}
                                                </TableCell>
                                                <TableCell className="text-xs">
                                                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                                                        log.channel === 'email' ? 'bg-indigo-950/60 text-indigo-400' : 'bg-emerald-950/60 text-emerald-455'
                                                    }`}>
                                                        {log.channel}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-xs text-slate-355 max-w-[140px] truncate font-mono">
                                                    {log.recipient}
                                                </TableCell>
                                                <TableCell className="text-xs text-slate-300 capitalize font-bold">
                                                    {log.event.replace('_', ' ')}
                                                </TableCell>
                                                <TableCell className="text-xs">
                                                    <div className="space-y-1">
                                                        <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase ${
                                                            log.status === 'enviado' ? 'bg-emerald-500/10 text-emerald-455' : 
                                                            log.status === 'error' ? 'bg-red-500/10 text-red-455' : 'bg-slate-800 text-slate-400'
                                                        }`}>
                                                            {log.status}
                                                        </span>
                                                        {log.errorDetail && (
                                                            <span className="block text-[8px] text-red-400 max-w-[120px] truncate">{log.errorDetail}</span>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Button 
                                                        variant="secondary" 
                                                        size="sm" 
                                                        onClick={() => setViewedLogMsg(log.message)}
                                                    >
                                                        Ver Cuerpo
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </div>
            )}

            {/* ========================================================================= */}
            {/* TABS 5: METRICAS Y DESEMPEÑO */}
            {/* ========================================================================= */}
            {currentTab === 'metricas' && (
                <div className="space-y-6 animate-fade-in">
                    {/* Performance Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <Card className="bg-slate-950 border border-slate-850 p-4 space-y-1">
                            <span className="text-[10px] text-slate-450 uppercase font-extrabold tracking-wider block">Cumplimiento SLA General</span>
                            <div className="flex items-baseline gap-2 mt-1">
                                <span className="text-2xl font-extrabold text-slate-100">{globalSlaRate}%</span>
                                <span className="text-[10px] text-emerald-450 font-bold">✓ Objetivo: 90%</span>
                            </div>
                            <div className="w-full bg-slate-900 rounded-full h-1.5 mt-2">
                                <div className="bg-indigo-550 h-1.5 rounded-full" style={{ width: `${globalSlaRate}%` }} />
                            </div>
                        </Card>

                        <Card className="bg-slate-950 border border-slate-850 p-4 space-y-1">
                            <span className="text-[10px] text-slate-450 uppercase font-extrabold tracking-wider block">Tiempo Medio de Resolución</span>
                            <div className="flex items-baseline gap-2 mt-1">
                                <span className="text-2xl font-extrabold text-slate-100">{globalAvgResolutionHours} hs</span>
                                <span className="text-[10px] text-slate-500 font-medium">Promedio del equipo</span>
                            </div>
                            <p className="text-[9px] text-slate-450 mt-2">Desde la emisión del ticket hasta el cierre.</p>
                        </Card>

                        <Card className="bg-slate-950 border border-slate-850 p-4 space-y-1">
                            <span className="text-[10px] text-slate-450 uppercase font-extrabold tracking-wider block">Técnico Destacado</span>
                            <div className="flex items-center gap-2 mt-2">
                                <Award size={18} className="text-amber-500" />
                                <div>
                                    <span className="block font-bold text-slate-205">{starTechName}</span>
                                    <span className="block text-[9px] text-emerald-400 font-bold">{bestCompliance > -1 ? `${bestCompliance}% cumplimiento SLA` : 'Desempeño óptimo'}</span>
                                </div>
                            </div>
                        </Card>

                        <Card className="bg-slate-950 border border-slate-850 p-4 space-y-1">
                            <span className="text-[10px] text-slate-455 uppercase font-extrabold tracking-wider block">Tickets Cerrados en el Mes</span>
                            <div className="flex items-baseline gap-2 mt-1">
                                <span className="text-2xl font-extrabold text-slate-100">{resolvedGlobal.length}</span>
                                <span className="text-[10px] text-slate-500">Correctivos y repuestos</span>
                            </div>
                            <p className="text-[9px] text-slate-450 mt-2">Equipos operativos al 100%.</p>
                        </Card>
                    </div>

                    {/* Detailed metrics table */}
                    <TableContainer>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHeaderCell>Técnico Responsable</TableHeaderCell>
                                    <TableHeaderCell>Tickets Asignados</TableHeaderCell>
                                    <TableHeaderCell>Resueltos con Éxito</TableHeaderCell>
                                    <TableHeaderCell>Tasa Cumplimiento SLA</TableHeaderCell>
                                    <TableHeaderCell>Tiempo Medio de Respuesta</TableHeaderCell>
                                    <TableHeaderCell>Tiempo Medio de Resolución</TableHeaderCell>
                                    <TableHeaderCell>Desempeño / Calificación</TableHeaderCell>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {techsList.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center py-12 text-slate-500 italic">
                                            No hay personal técnico activo para calcular métricas.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    techsList.map(tech => {
                                        const stats = getTechMetrics(tech.id);
                                        const rating = 
                                            stats.complianceRate >= 95 ? 'Excelente (Platino)' :
                                            stats.complianceRate >= 85 ? 'Muy Bueno (Oro)' :
                                            stats.complianceRate >= 70 ? 'Satisfactorio (Plata)' :
                                            'Requiere Atención (Crítico)';

                                        return (
                                            <TableRow key={tech.id} className="hover:bg-slate-900/40">
                                                <TableCell className="font-bold text-slate-100">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-5 h-5 rounded-full bg-slate-800 text-[9px] font-bold text-indigo-400 flex items-center justify-center">
                                                            {(tech.fullname || '').split(' ').map(n => n[0] || '').join('')}
                                                        </div>
                                                        <span>{tech.fullname}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="font-semibold text-slate-300">{stats.totalAssigned}</TableCell>
                                                <TableCell className="font-semibold text-slate-300">{stats.resolvedCount}</TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <span className={`font-bold ${
                                                            stats.complianceRate >= 90 ? 'text-emerald-450' : 
                                                            stats.complianceRate >= 75 ? 'text-amber-500' : 'text-red-500'
                                                        }`}>{stats.complianceRate}%</span>
                                                        <div className="w-16 bg-slate-900 rounded-full h-1 shrink-0">
                                                            <div className={`h-1 rounded-full ${
                                                                stats.complianceRate >= 90 ? 'bg-emerald-500' : 
                                                                stats.complianceRate >= 75 ? 'bg-amber-500' : 'bg-red-500'
                                                            }`} style={{ width: `${stats.complianceRate}%` }} />
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="font-mono text-slate-350">{stats.avgResponseMinutes} minutos</TableCell>
                                                <TableCell className="font-mono text-slate-350">{stats.avgResolutionHours} horas</TableCell>
                                                <TableCell>
                                                    <span className={`inline-flex px-2 py-0.5 rounded text-[9px] font-extrabold uppercase ${
                                                        stats.complianceRate >= 90 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-900/20' :
                                                        stats.complianceRate >= 75 ? 'bg-amber-500/10 text-amber-400 border border-amber-900/20' :
                                                        'bg-red-500/10 text-red-450 border border-red-900/20'
                                                    }`}>
                                                        {rating}
                                                    </span>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </div>
            )}

            {/* ========================================================================= */}
            {/* TICKET DETAILS DRAWER */}
            {/* ========================================================================= */}
            {selectedTicket && (
                <div className="fixed inset-0 z-50 flex justify-end bg-slate-955/70 backdrop-blur-xs animate-fade-in print:hidden">
                    <div className="absolute inset-0" onClick={() => setSelectedTicket(null)} />
                    <div className="relative max-w-md w-full bg-slate-900 border-l border-slate-800 shadow-2xl h-full flex flex-col z-10 animate-slide-in">
                        {/* Drawer Header */}
                        <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-950/40">
                            <div>
                                <span className="text-[10px] font-mono text-indigo-400 font-extrabold uppercase tracking-wider">Ficha Técnica</span>
                                <h3 className="font-bold text-sm text-slate-100 mt-0.5">Ticket TCK-{selectedTicket.id.replace('ticket-', '')}</h3>
                            </div>
                            <button className="text-slate-400 hover:text-white p-1" onClick={() => setSelectedTicket(null)}>
                                <X size={20} />
                            </button>
                        </div>

                        {/* Drawer Content */}
                        <div className="flex-1 overflow-y-auto p-5 space-y-6 text-xs text-slate-300">
                            {autoAssignExplanation && (
                                <div className="p-3 bg-indigo-950/70 border border-indigo-900 text-indigo-350 text-[10px] rounded-xl font-semibold leading-relaxed animate-fade-in">
                                    ⚡ {autoAssignExplanation}
                                </div>
                            )}

                            {techWarn && (
                                <div className={`p-3 rounded-xl border text-[10px] font-semibold leading-relaxed ${
                                    techWarn.type === 'critical' ? 'bg-red-500/10 border-red-500/20 text-red-400' :
                                    techWarn.type === 'warning' ? 'bg-amber-500/10 border-amber-500/20 text-amber-450' :
                                    'bg-indigo-950/40 border-indigo-900/50 text-indigo-400'
                                }`}>
                                    {techWarn.text}
                                </div>
                            )}

                            {/* Actions toolbar */}
                            <div className="grid grid-cols-2 gap-2">
                                <button 
                                    onClick={() => handleManualResendNotification('asignado')}
                                    className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-[10px] font-bold hover:bg-slate-900 transition-all text-center cursor-pointer"
                                >
                                    Enviar Email Asignación
                                </button>
                                <button 
                                    onClick={() => handleWhatsAppDirect('asignado')}
                                    className="px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-[10px] font-bold hover:bg-emerald-500/20 transition-all text-center flex items-center justify-center gap-1 cursor-pointer"
                                >
                                    Enviar WA Asignación
                                </button>
                                <button 
                                    onClick={() => handleManualResendNotification('resuelto')}
                                    className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-[10px] font-bold hover:bg-slate-900 transition-all text-center cursor-pointer"
                                >
                                    Enviar Email Resuelto
                                </button>
                                <button 
                                    onClick={() => handleWhatsAppDirect('resuelto')}
                                    className="px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-[10px] font-bold hover:bg-emerald-500/20 transition-all text-center flex items-center justify-center gap-1 cursor-pointer"
                                >
                                    Enviar WA Resuelto
                                </button>
                            </div>

                            {/* Priority and Category block */}
                            <div className="grid grid-cols-2 gap-4 bg-slate-955/40 p-4 rounded-xl border border-slate-850/60">
                                <div>
                                    <span className="text-[9px] uppercase font-bold text-slate-505 block">Prioridad</span>
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-extrabold mt-1 uppercase ${
                                        selectedTicket.priority === 'urgente' ? 'bg-red-650 text-white animate-pulse' :
                                        selectedTicket.priority === 'alta' ? 'bg-red-500/10 text-red-500' :
                                        selectedTicket.priority === 'media' ? 'bg-amber-500/10 text-amber-500' :
                                        'bg-emerald-500/10 text-emerald-500'
                                    }`}>
                                        {selectedTicket.priority}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-[9px] uppercase font-bold text-slate-505 block">Categoría</span>
                                    <span className="font-bold text-slate-200 mt-1 block capitalize">{selectedTicket.category}</span>
                                </div>
                            </div>

                            {/* Client & Contact information */}
                            <div className="space-y-3">
                                <h4 className="font-bold text-indigo-400 border-b border-slate-850 pb-1.5 uppercase text-[9px] tracking-wider">Datos del Cliente</h4>
                                <div className="space-y-2 bg-slate-955/20 p-3 rounded-xl border border-slate-850/30">
                                    <div className="flex items-start gap-2">
                                        <UserIcon size={14} className="text-slate-500 mt-0.5 shrink-0" />
                                        <div>
                                            <span className="font-bold text-slate-200 block">{selectedTicket.clientName}</span>
                                            {selectedTicket.clientContact && <span className="text-[10px] text-slate-400 block mt-0.5">Atención: {selectedTicket.clientContact}</span>}
                                        </div>
                                    </div>
                                    {selectedTicket.clientAddress && (
                                        <div className="flex items-start gap-2 text-[10px]">
                                            <MapPin size={14} className="text-slate-500 mt-0.5 shrink-0" />
                                            <span>{selectedTicket.clientAddress}</span>
                                        </div>
                                    )}
                                    <div className="flex gap-4 pt-1.5 border-t border-slate-850/50 mt-1.5 text-[10px]">
                                        {selectedTicket.clientPhone && (
                                            <a 
                                                href={`https://wa.me/${selectedTicket.clientPhone.replace(/[^0-9]/g, '')}`} 
                                                target="_blank" 
                                                rel="noreferrer"
                                                className="flex items-center gap-1.5 text-emerald-500 hover:underline"
                                            >
                                                <Phone size={12} /> WhatsApp/Tel
                                            </a>
                                        )}
                                        {selectedTicket.clientEmail && (
                                            <a href={`mailto:${selectedTicket.clientEmail}`} className="flex items-center gap-1.5 text-indigo-400 hover:underline">
                                                <Mail size={12} /> Enviar Mail
                                            </a>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Machine Equipment description */}
                            <div className="space-y-3">
                                <h4 className="font-bold text-indigo-400 border-b border-slate-855 pb-1.5 uppercase text-[9px] tracking-wider">Equipo Relacionado</h4>
                                <div className="bg-slate-955/20 p-3 rounded-xl border border-slate-855/30 space-y-1">
                                    <span className="font-bold text-slate-200 block text-xs">{selectedTicket.machineDesc}</span>
                                    <span className="text-[10px] text-slate-450 block font-mono">Nro Serie: {selectedTicket.serialNumber || 'Sin número registrado'}</span>
                                </div>
                            </div>

                            {/* Ticket Description */}
                            <div className="space-y-2">
                                <span className="text-[9px] uppercase font-bold text-slate-505 block">Falla Reportada / Solicitud</span>
                                <p className="p-3 bg-slate-900 border border-slate-850 rounded-xl leading-relaxed text-slate-250 font-medium">
                                    {selectedTicket.description}
                                </p>
                            </div>

                            {/* Quick Update Settings */}
                            <div className="space-y-4 pt-2 border-t border-slate-800">
                                <div className="flex justify-between items-center border-b border-slate-850 pb-1.5">
                                    <h4 className="font-bold text-indigo-400 uppercase text-[9px] tracking-wider">Formulario de Resolución</h4>
                                    <button 
                                        onClick={handleTriggerAutoAssign}
                                        className="text-[9px] bg-indigo-650 hover:bg-indigo-600 text-white font-extrabold px-2.5 py-1 rounded-lg flex items-center gap-1 transition-all"
                                    >
                                        ⚡ Autoasignar
                                    </button>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Estado</label>
                                        <select
                                            value={editStatus}
                                            onChange={(e) => setEditStatus(e.target.value as Ticket['status'])}
                                            className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-1.5 text-slate-200 text-xs focus:outline-none"
                                        >
                                            <option value="nuevo">Nuevo</option>
                                            <option value="asignado">Asignado</option>
                                            <option value="en-camino">En Camino</option>
                                            <option value="en-proceso">En Proceso</option>
                                            <option value="esperando-repuesto">Esperando Repuesto</option>
                                            <option value="resuelto">Resuelto</option>
                                            <option value="cerrado">Cerrado</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Técnico Asignado</label>
                                        <select
                                            disabled={isTech}
                                            value={editAssignedTechId}
                                            onChange={(e) => setEditAssignedTechId(e.target.value)}
                                            className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-1.5 text-slate-200 text-xs focus:outline-none disabled:opacity-50"
                                        >
                                            <option value="">Sin Asignar</option>
                                            {users.filter(u => u.role === 'tecnico' && u.active !== false).map(t => (
                                                <option key={t.id} value={t.id}>{t.fullname}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {selectedTicket.machineId && (
                                    <div className="space-y-1">
                                        <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Estado Físico / Inventario de la Copiadora</label>
                                        <select
                                            value={editMachineStatus}
                                            onChange={(e) => setEditMachineStatus(e.target.value)}
                                            className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-1.5 text-slate-200 text-xs focus:outline-none"
                                        >
                                            <option value="Disponible">Disponible en Stock (Sin Alquiler)</option>
                                            <option value="Alquilada">Operativa / Alquilada (En Cliente)</option>
                                            <option value="En Taller">En Servicio Técnico / Taller</option>
                                            <option value="Alerta Técnica">En Revisión / Falla en Campo</option>
                                            <option value="Inactiva">Fuera de Servicio / Scrap</option>
                                        </select>
                                    </div>
                                )}

                                <div className="space-y-1">
                                    <label className="text-[10px] uppercase font-bold text-slate-505 block">Diagnóstico de Falla</label>
                                    <textarea
                                        value={editDiagnostic}
                                        onChange={(e) => setEditDiagnostic(e.target.value)}
                                        placeholder="Detalla el problema técnico encontrado..."
                                        className="w-full bg-slate-955 border border-slate-855 rounded-xl px-3 py-2 text-slate-200 text-xs h-16 resize-none outline-none focus:border-indigo-500/50"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] uppercase font-bold text-slate-505 block">Acción Realizada</label>
                                    <textarea
                                        value={editActionTaken}
                                        onChange={(e) => setEditActionTaken(e.target.value)}
                                        placeholder="Detalles sobre el trabajo correctivo..."
                                        className="w-full bg-slate-955 border border-slate-855 rounded-xl px-3 py-2 text-slate-200 text-xs h-16 resize-none outline-none focus:border-indigo-500/50"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <label className="text-[10px] uppercase font-bold text-slate-505 block">Repuestos Necesarios</label>
                                        <input
                                            type="text"
                                            value={editPartsNeeded}
                                            onChange={(e) => setEditPartsNeeded(e.target.value)}
                                            placeholder="Pieza a comprar"
                                            className="w-full bg-slate-955 border border-slate-855 rounded-xl px-3 py-1.5 text-slate-200 text-xs outline-none"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] uppercase font-bold text-slate-505 block">Repuestos Utilizados</label>
                                        <input
                                            type="text"
                                            value={editPartsUsed}
                                            onChange={(e) => setEditPartsUsed(e.target.value)}
                                            placeholder="Repuestos instalados"
                                            className="w-full bg-slate-955 border border-slate-855 rounded-xl px-3 py-1.5 text-slate-200 text-xs outline-none"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <label className="text-[10px] uppercase font-bold text-slate-505 block">Costo de Mano de Obra ($)</label>
                                        <input
                                            type="number"
                                            value={editTechnicalCost}
                                            onChange={(e) => setEditTechnicalCost(e.target.value)}
                                            className="w-full bg-slate-955 border border-slate-855 rounded-xl px-3 py-1.5 text-slate-200 text-xs outline-none"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] uppercase font-bold text-slate-505 block">Fecha Límite SLA</label>
                                        <input
                                            type="text"
                                            disabled
                                            value={selectedTicket.slaDate ? new Date(selectedTicket.slaDate).toLocaleString('es-AR') : 'No asignada'}
                                            className="w-full bg-slate-955 border border-slate-855 rounded-xl px-3 py-1.5 text-slate-500 text-xs outline-none disabled:opacity-50"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] uppercase font-bold text-slate-505 block">Observaciones del Servicio</label>
                                    <textarea
                                        value={editObservations}
                                        onChange={(e) => setEditObservations(e.target.value)}
                                        placeholder="Comentarios del servicio técnico..."
                                        className="w-full bg-slate-955 border border-slate-855 rounded-xl px-3 py-2 text-slate-200 text-xs h-16 resize-none outline-none"
                                    />
                                </div>

                                <Button variant="primary" size="md" className="w-full" onClick={handleSaveTicketDetails}>
                                    Actualizar y Notificar Cambios
                                </Button>
                            </div>

                            {/* Chronological History Timeline */}
                            <div className="space-y-3 pt-4 border-t border-slate-800">
                                <h4 className="font-bold text-indigo-400 border-b border-slate-850 pb-1.5 uppercase text-[9px] tracking-wider">Historial de Auditoría</h4>
                                <div className="space-y-3 pl-2 border-l border-slate-850 mt-2">
                                    {selectedTicket.history && selectedTicket.history.map((h, i) => (
                                        <div key={i} className="relative pl-4 space-y-0.5">
                                            <div className="absolute -left-[14.5px] top-1 w-2.5 h-2.5 rounded-full bg-slate-800 border-2 border-indigo-500" />
                                            <div className="flex justify-between items-center text-[9px] text-slate-500">
                                                <span>📅 {h.date} - {h.time}</span>
                                                <span className="font-bold text-slate-400">{h.user}</span>
                                            </div>
                                            <p className="text-[10px] text-slate-300 font-medium">{h.action}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* TECHNICIAN DETAIL CARD DRAWER */}
            {/* ========================================================================= */}
            {selectedTech && (
                <div className="fixed inset-0 z-50 flex justify-end bg-slate-955/70 backdrop-blur-xs animate-fade-in print:hidden">
                    <div className="absolute inset-0" onClick={() => setSelectedTech(null)} />
                    <div className="relative max-w-md w-full bg-slate-900 border-l border-slate-800 shadow-2xl h-full flex flex-col z-10 animate-slide-in">
                        {/* Drawer Header */}
                        <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-950/40">
                            <div>
                                <span className="text-[10px] font-mono text-indigo-400 font-extrabold uppercase tracking-wider">Ficha del Personal</span>
                                <h3 className="font-bold text-sm text-slate-100 mt-0.5">{selectedTech.fullname}</h3>
                            </div>
                            <button className="text-slate-400 hover:text-white p-1" onClick={() => setSelectedTech(null)}>
                                <X size={20} />
                            </button>
                        </div>

                        {/* Drawer Content */}
                        <div className="flex-1 overflow-y-auto p-5 space-y-6 text-xs text-slate-300">
                            {/* Contact card */}
                            <div className="bg-slate-955/40 p-4 rounded-xl border border-slate-850/60 space-y-2">
                                <div className="flex items-center gap-1.5 text-slate-200">
                                    <Phone size={14} className="text-slate-500" /> 
                                    <strong>Teléfono:</strong> <span className="font-mono">{selectedTech.phone || 'No registrado'}</span>
                                </div>
                                <div className="flex items-center gap-1.5 text-slate-200">
                                    <Phone size={14} className="text-emerald-505" /> 
                                    <strong>WhatsApp:</strong> <span className="font-mono text-emerald-455">{selectedTech.whatsapp || 'No registrado'}</span>
                                </div>
                                <div className="flex items-center gap-1.5 text-slate-200">
                                    <Mail size={14} className="text-indigo-400" /> 
                                    <strong>Email:</strong> <span className="font-mono">{selectedTech.email}</span>
                                </div>
                                <div className="flex items-center gap-1.5 text-slate-200">
                                    <Clock size={14} className="text-slate-500" /> 
                                    <strong>Horario Laboral:</strong> <span>{selectedTech.workHours || 'No configurado'}</span>
                                </div>
                            </div>

                            {/* Zone and Brands Specialty */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-3 bg-slate-955/20 border border-slate-850/30 rounded-xl space-y-1">
                                    <span className="text-[9px] uppercase font-bold text-slate-505 block">Zona de Cobertura</span>
                                    <span className="font-bold text-slate-250 block">{selectedTech.zone || 'General'}</span>
                                </div>
                                <div className="p-3 bg-slate-955/20 border border-slate-850/30 rounded-xl space-y-1">
                                    <span className="text-[9px] uppercase font-bold text-slate-505 block">Especialidad / Marcas</span>
                                    <span className="font-bold text-slate-250 block">{selectedTech.specialty || 'General / Multimarca'}</span>
                                </div>
                            </div>

                            {/* Internal notes */}
                            <div className="space-y-1.5">
                                <span className="text-[9px] uppercase font-bold text-slate-505 block">Observaciones y Notas Internas</span>
                                <p className="p-3 bg-slate-900 border border-slate-850 rounded-xl leading-relaxed text-slate-400 italic">
                                    {selectedTech.internalNotes || 'Sin notas adicionales.'}
                                </p>
                            </div>

                            {/* List of active tickets assigned to this technician */}
                            <div className="space-y-3 pt-4 border-t border-slate-800">
                                <h4 className="font-bold text-indigo-400 border-b border-slate-850 pb-1.5 uppercase text-[9px] tracking-wider">Tickets Activos Asignados</h4>
                                <div className="space-y-2">
                                    {tickets.filter(t => t.assignedTechId === selectedTech.id && t.status !== 'cerrado' && t.status !== 'resuelto').length === 0 ? (
                                        <p className="text-[10px] text-slate-500 italic py-2">Este técnico no tiene ningún ticket activo asignado en este momento.</p>
                                    ) : (
                                        tickets.filter(t => t.assignedTechId === selectedTech.id && t.status !== 'cerrado' && t.status !== 'resuelto').map(t => (
                                            <div 
                                                key={t.id} 
                                                className="p-3 bg-slate-955/30 border border-slate-855 rounded-xl flex justify-between items-center cursor-pointer hover:bg-slate-950/60"
                                                onClick={() => { setSelectedTech(null); handleOpenDetail(t); }}
                                            >
                                                <div>
                                                    <span className="block font-mono text-[9px] text-slate-505">TCK-{t.id.replace('ticket-', '')}</span>
                                                    <span className="block font-bold text-slate-200 mt-0.5">{t.clientName}</span>
                                                    <span className="block text-[10px] text-slate-450 mt-0.5">{t.machineDesc}</span>
                                                </div>
                                                <span className={`px-2 py-0.5 rounded text-[8px] font-extrabold uppercase ${
                                                    t.priority === 'urgente' ? 'bg-red-650 text-white font-extrabold animate-pulse' :
                                                    t.priority === 'alta' ? 'bg-red-500/10 text-red-500' : 'bg-slate-800 text-slate-400'
                                                }`}>
                                                    {t.status.replace('-', ' ')}
                                                </span>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* AUDIT LOG MESSAGE VIEWER POPUP MODAL */}
            {/* ========================================================================= */}
            {viewedLogMsg && (
                <div className="fixed inset-0 bg-slate-955/80 z-50 flex items-center justify-center p-4">
                    <Card className="w-full max-w-lg border-slate-800 bg-slate-900">
                        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                            <h3 className="font-bold text-xs text-slate-100">Cuerpo del Mensaje Despachado</h3>
                            <button className="text-slate-400 hover:text-white" onClick={() => setViewedLogMsg(null)}>
                                <X size={18} />
                            </button>
                        </div>
                        <CardContent className="p-4">
                            {viewedLogMsg.includes('<div') || viewedLogMsg.includes('<table') ? (
                                <div 
                                    className="bg-white p-4 rounded-xl overflow-auto max-h-96 border border-slate-700" 
                                    dangerouslySetInnerHTML={{ __html: viewedLogMsg }} 
                                />
                            ) : (
                                <pre className="w-full bg-slate-950 p-4 rounded-xl text-slate-300 font-mono text-[10px] whitespace-pre-wrap max-h-96 overflow-auto border border-slate-800">
                                    {viewedLogMsg}
                                </pre>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* ========================================================================= */}
            {/* TECHNICIAN CREATE/EDIT MODAL FORM */}
            {/* ========================================================================= */}
            <Modal
                isOpen={isTechFormOpen}
                onClose={() => setIsTechFormOpen(false)}
                title={editingTech ? 'Editar Ficha del Técnico' : 'Registrar Nuevo Técnico'}
                footer={
                    <>
                        <Button variant="ghost" size="sm" onClick={() => setIsTechFormOpen(false)}>
                            Cancelar
                        </Button>
                        <Button variant="primary" size="sm" onClick={handleSaveTech}>
                            {editingTech ? 'Guardar Cambios' : 'Registrar'}
                        </Button>
                    </>
                }
            >
                <form className="space-y-4" onSubmit={handleSaveTech}>
                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            label="Nombre y Apellido *"
                            value={formTechFullname}
                            onChange={(e) => setFormTechFullname(e.target.value)}
                            placeholder="Ej: Marcelo Gómez"
                        />
                        <Input
                            label="Usuario de Acceso *"
                            value={formTechUsername}
                            onChange={(e) => setFormTechUsername(e.target.value)}
                            placeholder="Ej: mgomez"
                        />
                    </div>

                    <Input
                        label="Correo Electrónico (Notificaciones) *"
                        type="email"
                        value={formTechEmail}
                        onChange={(e) => setFormTechEmail(e.target.value)}
                        placeholder="Ej: mgomez@mstecnologia.com.ar"
                    />

                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            label="Teléfono de Contacto"
                            value={formTechPhone}
                            onChange={(e) => setFormTechPhone(e.target.value)}
                            placeholder="Ej: 381-4523190"
                        />
                        <Input
                            label="Número de WhatsApp (Sin +)*"
                            value={formTechWhatsapp}
                            onChange={(e) => setFormTechWhatsapp(e.target.value)}
                            placeholder="Ej: 5493814523190"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            label="Zona o Localidad de Cobertura"
                            value={formTechZone}
                            onChange={(e) => setFormTechZone(e.target.value)}
                            placeholder="Ej: Tucumán (Yerba Buena)"
                        />
                        <Input
                            label="Especialidad / Marcas"
                            value={formTechSpecialty}
                            onChange={(e) => setFormTechSpecialty(e.target.value)}
                            placeholder="Ej: Ricoh Color, HP, Brother"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <Select
                            label="Disponibilidad Actual"
                            value={formTechAvailability}
                            onChange={(e) => setFormTechAvailability(e.target.value as any)}
                            options={[
                                { value: 'Disponible', label: 'Disponible' },
                                { value: 'No disponible', label: 'No disponible' },
                                { value: 'Licencia', label: 'Licencia / Vacaciones' }
                            ]}
                        />
                        <Input
                            label="Horario Laboral"
                            value={formTechWorkHours}
                            onChange={(e) => setFormTechWorkHours(e.target.value)}
                            placeholder="Ej: 08:00 a 17:00 hs"
                        />
                    </div>

                    <div className="flex items-center gap-2 pt-2">
                        <input 
                            type="checkbox" 
                            checked={formTechActive} 
                            onChange={(e) => setFormTechActive(e.target.checked)}
                            className="w-4 h-4 accent-indigo-500 rounded" 
                            id="formTechActive"
                        />
                        <label htmlFor="formTechActive" className="text-xs font-bold text-slate-355 cursor-pointer">
                            Marcar técnico como Activo / Disponible para asignación
                        </label>
                    </div>

                    <Input
                        label="Observaciones y Notas Internas"
                        value={formTechInternalNotes}
                        onChange={(e) => setFormTechInternalNotes(e.target.value)}
                        placeholder="Ej: Especialista en unidades fusoras..."
                    />
                </form>
            </Modal>

            {/* CREATION SUPPORT TICKET MODAL */}
            <Modal
                isOpen={isCreating}
                onClose={() => setIsCreating(false)}
                title="Registrar Nuevo Ticket Técnico"
                footer={
                    <>
                        <Button variant="ghost" size="sm" onClick={() => setIsCreating(false)}>
                            Cancelar
                        </Button>
                        <Button variant="primary" size="sm" onClick={handleCreateTicket}>
                            Registrar Asistencia
                        </Button>
                    </>
                }
            >
                <form className="space-y-4" onSubmit={handleCreateTicket}>
                    <div className="grid grid-cols-2 gap-4">
                        <label className={`flex items-center justify-center p-3 rounded-xl border cursor-pointer transition-all ${
                            newClientType === 'existente' 
                                ? 'bg-slate-900 border-indigo-500 text-slate-100 font-bold' 
                                : 'bg-slate-955 border-slate-855 hover:bg-slate-900/50 text-slate-400'
                        }`}>
                            <input 
                                type="radio" 
                                name="clientType" 
                                checked={newClientType === 'existente'} 
                                onChange={() => setNewClientType('existente')} 
                                className="hidden" 
                            />
                            <span>Cliente Existente</span>
                        </label>
                        <label className={`flex items-center justify-center p-3 rounded-xl border cursor-pointer transition-all ${
                            newClientType === 'externo' 
                                ? 'bg-slate-900 border-indigo-500 text-slate-100 font-bold' 
                                : 'bg-slate-955 border-slate-855 hover:bg-slate-900/50 text-slate-400'
                        }`}>
                            <input 
                                type="radio" 
                                name="clientType" 
                                checked={newClientType === 'externo'} 
                                onChange={() => setNewClientType('externo')} 
                                className="hidden" 
                            />
                            <span>Cliente Manual / Externo</span>
                        </label>
                    </div>

                    {newClientType === 'existente' ? (
                        <>
                            <Select
                                label="Cliente *"
                                value={newClientId}
                                onChange={(e) => {
                                    setNewClientId(e.target.value);
                                    setNewMachineId('');
                                }}
                                options={[
                                    { value: '', label: 'Seleccionar Cliente...' },
                                    ...clients.map(c => ({ value: c.id, label: c.name }))
                                ]}
                            />

                            {newClientId && (
                                <Select
                                    label="Equipo en Alquiler *"
                                    value={newMachineId}
                                    onChange={(e) => setNewMachineId(e.target.value)}
                                    options={[
                                        { value: '', label: 'Seleccionar Copiadora...' },
                                        ...clientMachines.map(m => ({ value: m.id, label: `${m.brand} ${m.model} (S/N: ${m.serial})` }))
                                    ]}
                                />
                            )}
                        </>
                    ) : (
                        <div className="space-y-3 animate-fade-in border border-slate-855 p-3 rounded-xl bg-slate-950/20">
                            <span className="text-[10px] text-slate-550 block uppercase font-bold mb-1">Datos de Contacto del Cliente Técnico</span>
                            <Input
                                label="Nombre / Razón Social del Cliente *"
                                value={newClientName}
                                onChange={(e) => setNewClientName(e.target.value)}
                            />
                            <div className="grid grid-cols-2 gap-3">
                                <Input
                                    label="Dirección Completa"
                                    value={newClientAddress}
                                    onChange={(e) => setNewClientAddress(e.target.value)}
                                />
                                <Input
                                    label="Contacto Responsable"
                                    value={newClientContact}
                                    onChange={(e) => setNewClientContact(e.target.value)}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <Input
                                    label="Teléfono / WhatsApp"
                                    value={newClientPhone}
                                    onChange={(e) => setNewClientPhone(e.target.value)}
                                    placeholder="Ej: 381-4567890"
                                />
                                <Input
                                    label="Email"
                                    type="email"
                                    value={newClientEmail}
                                    onChange={(e) => setNewClientEmail(e.target.value)}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3 border-t border-slate-855 pt-3 mt-1">
                                <Input
                                    label="Modelo del Equipo *"
                                    value={newMachineDesc}
                                    onChange={(e) => setNewMachineDesc(e.target.value)}
                                    placeholder="Ej: Ricoh IM 430"
                                />
                                <Input
                                    label="Número de Serie / Interno"
                                    value={newSerialNumber}
                                    onChange={(e) => setNewSerialNumber(e.target.value)}
                                    placeholder="Ej: S/N: W8912345"
                                />
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <Select
                            label="Categoría *"
                            value={newCategory}
                            onChange={(e) => setNewCategory(e.target.value)}
                            options={[
                                { value: 'Servicio', label: 'Servicio / Falla Técnica' },
                                { value: 'Repuesto', label: 'Repuesto' },
                                { value: 'Insumo', label: 'Insumo / Tóner' }
                            ]}
                        />
                        <Select
                            label="Prioridad *"
                            value={newPriority}
                            onChange={(e) => setNewPriority(e.target.value as any)}
                            options={[
                                { value: 'baja', label: 'Baja (SLA 48h)' },
                                { value: 'media', label: 'Media (SLA 24h)' },
                                { value: 'alta', label: 'Alta (SLA 4h)' },
                                { value: 'urgente', label: 'Urgente (SLA 4h)' }
                            ]}
                        />
                    </div>

                    <Input
                        label="Descripción del Problema *"
                        value={newDescription}
                        onChange={(e) => setNewDescription(e.target.value)}
                        placeholder="Ej: El papel se traba en el fusor / Código de error SC340..."
                    />

                    <div className="grid grid-cols-2 gap-4 pt-1.5">
                        <Select
                            label="Asignar Técnico Responsable"
                            disabled={shouldAutoAssignOnCreate}
                            value={newAssignedTechId}
                            onChange={(e) => setNewAssignedTechId(e.target.value)}
                            options={[
                                { value: '', label: 'Sin Asignar (Pendiente Triage)' },
                                ...users.filter(u => u.role === 'tecnico' && u.active !== false).map(t => ({ value: t.id, label: t.fullname }))
                            ]}
                        />
                        <div className="flex flex-col justify-end pb-2">
                            <label className="flex items-center gap-2 p-2 bg-slate-900 border border-slate-850 rounded-xl cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    checked={shouldAutoAssignOnCreate} 
                                    onChange={(e) => {
                                        setShouldAutoAssignOnCreate(e.target.checked);
                                        if (e.target.checked) setNewAssignedTechId('');
                                    }}
                                    className="w-3.5 h-3.5 accent-indigo-500 rounded"
                                />
                                <span className="text-[10px] font-bold text-slate-205">Autoasignar por algoritmo</span>
                            </label>
                        </div>
                    </div>

                    <p className="text-[10px] text-slate-500 italic">
                        * El Límite de Resolución (SLA) se calculará automáticamente en función de la prioridad elegida al emitir el ticket.
                    </p>
                </form>
            </Modal>
        </div>
    );
}
