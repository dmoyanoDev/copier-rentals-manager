'use client';

import React, { useState } from 'react';
import { useManagement } from '@/lib/context';
import { Card, CardContent } from '@/components/ui/card';
import { TableContainer, Table, TableHeader, TableRow, TableHeaderCell, TableBody, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Modal } from '@/components/ui/modal';
import { 
    formatCurrency, 
    formatPeriod, 
    playSystemSound, 
    getClientMovementsHelper, 
    getClientFinancialSummaryHelper, 
    getSystemAlerts, 
    SystemAlert 
} from '@/lib/utils';
import { 
    Plus, Trash2, Edit, FileText, CheckCircle, AlertTriangle, ShieldCheck, 
    Landmark, Mail, Share2, Printer, Download, Search, Filter, Send, 
    MessageSquare, AlertCircle, TrendingUp, Calendar, CheckSquare, Square, 
    Volume2, VolumeX, Settings, History, Phone, CreditCard, ChevronRight, Bell,
    Info, FileSpreadsheet, Eye, UserCheck, MoreVertical
} from 'lucide-react';
import { Client } from '@/lib/mockData';
import { LocalClient } from '@/lib/context';
import { BRANDING } from '@/config/branding';

// Custom Badge component local to this file to prevent variant typing conflicts
const LocalBadge = ({ variant, children, className = '' }: { variant: 'success' | 'warning' | 'danger' | 'info' | 'secondary', children: React.ReactNode, className?: string }) => {
    const base = 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border';
    const styles = {
        success: 'bg-emerald-955/20 text-emerald-400 border-emerald-900/50',
        warning: 'bg-amber-955/20 text-amber-400 border-amber-900/50',
        danger: 'bg-red-955/20 text-red-400 border-red-900/30',
        info: 'bg-blue-955/20 text-blue-400 border-blue-900/50',
        secondary: 'bg-slate-900 border-slate-800 text-slate-400'
    };
    return (
        <span className={`${base} ${styles[variant]} ${className}`}>
            {children}
        </span>
    );
};

export default function ClientsPage() {
    const { 
        clients, setClients, machines, readings, setReadings, abonos, rentals,
        gestiones, setGestiones, cobranzaConfig, setCobranzaConfig
    } = useManagement();
    
    // Tabs setup
    const [activeTab, setActiveTab] = useState<'list' | 'accounts' | 'config'>('list');

    // Traditional list states
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState('');

    // Modal states
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [editingClient, setEditingClient] = useState<LocalClient | null>(null);
    const [selectedClient, setSelectedClient] = useState<LocalClient | null>(null);
    const [detailTab, setDetailTab] = useState<'machines' | 'invoices'>('machines');

    // State of Account detailed view states
    const [isAccountOpen, setIsAccountOpen] = useState(false);
    const [accountClient, setAccountClient] = useState<LocalClient | null>(null);
    const [accountFilter, setAccountFilter] = useState<'all' | 'pending' | 'overdue' | 'paid'>('all');
    
    // Monthly period filters
    const [filterStartMonth, setFilterStartMonth] = useState('');
    const [filterEndMonth, setFilterEndMonth] = useState('');

    // Contextual actions dropdown menus states for mobile/tablet responsive layout
    const [activeActionMenuId, setActiveActionMenuId] = useState<string | null>(null);
    const [activeAccMenuId, setActiveAccMenuId] = useState<string | null>(null);
    
    // PDF Versioning selector
    const [pdfVersion, setPdfVersion] = useState<'comercial' | 'interna'>('comercial');

    const [accountSortKey, setAccountSortKey] = useState<'date' | 'dueDate' | 'pending' | 'original'>('date');
    const [accountSortOrder, setAccountSortOrder] = useState<'asc' | 'desc'>('desc');
    const [accountDebtTypeFilter, setAccountDebtTypeFilter] = useState<'all' | 'vencida' | 'no-vencida'>('all');
    
    // Four tabs in account statement detailed modal
    const [accountModalTab, setAccountModalTab] = useState<'movements' | 'history' | 'payments' | 'notes'>('movements');

    // Email/Whatsapp Modals
    const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
    const [emailTarget, setEmailTarget] = useState<LocalClient | null>(null);
    const [emailTo, setEmailTo] = useState('');
    const [emailSubject, setEmailSubject] = useState('');
    const [emailBody, setEmailBody] = useState('');
    const [emailTemplateType, setEmailTemplateType] = useState<'preventivo' | 'vencido' | 'segundo' | 'pago'>('preventivo');
    
    const [isWhatsappModalOpen, setIsWhatsappModalOpen] = useState(false);
    const [whatsappTarget, setWhatsappTarget] = useState<LocalClient | null>(null);
    const [whatsappPhone, setWhatsappPhone] = useState('');
    const [whatsappText, setWhatsappText] = useState('');
    const [whatsappTemplateType, setWhatsappTemplateType] = useState<'preventivo' | 'vencido' | 'segundo' | 'pago'>('preventivo');

    // Accounts General View Filters
    const [accSearchQuery, setAccSearchQuery] = useState('');
    const [accFilterDebt, setAccFilterDebt] = useState<'all' | 'debtors' | 'overdue' | 'nodebt' | 'active'>('all');
    const [accMinMora, setAccMinMora] = useState('');
    
    // Bulk selections
    const [selectedBulkIds, setSelectedBulkIds] = useState<string[]>([]);

    // Form inputs (ABM)
    const [name, setName] = useState('');
    const [cuit, setCuit] = useState('');
    const [taxCategory, setTaxCategory] = useState<'Responsable Inscripto' | 'Monotributista' | 'Exento'>('Responsable Inscripto');
    const [address, setAddress] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [debt, setDebt] = useState('0');
    const [isActive, setIsActive] = useState(true);
    const [formError, setFormError] = useState('');

    // Internal notes temp field
    const [tempInternalNotes, setTempInternalNotes] = useState('');

    // New Gestion Form inside Account modal
    const [isNewGestionOpen, setIsNewGestionOpen] = useState(false);
    const [newGestionType, setNewGestionType] = useState<'WhatsApp' | 'Email' | 'Llamado' | 'Pago registrado' | 'Promesa de pago'>('WhatsApp');
    const [newGestionChannel, setNewGestionChannel] = useState('');
    const [newGestionResult, setNewGestionResult] = useState('');
    const [newGestionObs, setNewGestionObs] = useState('');

    // Dynamic Alerts
    const alerts = getSystemAlerts(clients, readings, machines, gestiones || [], cobranzaConfig);

    // ==========================================
    // ACCOUNTING HELPERS USING CENTRALISED UTILS
    // ==========================================
    const getClientFinancialSummary = (client: LocalClient) => {
        return getClientFinancialSummaryHelper(client, readings, machines);
    };

    const getClientMovements = (client: LocalClient) => {
        return getClientMovementsHelper(client, readings, machines);
    };

    // Traditional filter handler
    const filteredClients = clients.filter(c => {
        const q = searchQuery.toLowerCase();
        const matchesSearch = c.name.toLowerCase().includes(q) || c.cuit.includes(q) || c.address?.toLowerCase().includes(q);
        
        const isClientActive = c.active !== false;
        let matchesStatus = true;
        if (filterStatus === 'active') {
            matchesStatus = isClientActive;
        } else if (filterStatus === 'inactive') {
            matchesStatus = !isClientActive;
        } else if (filterStatus === 'debt') {
            matchesStatus = getClientFinancialSummary(c).saldo > 0;
        }

        return matchesSearch && matchesStatus;
    });

    // Accounts tab filter handler
    const accountsData = clients.map(c => ({
        client: c,
        summary: getClientFinancialSummary(c)
    })).filter(item => {
        const q = accSearchQuery.toLowerCase();
        const matchesSearch = item.client.name.toLowerCase().includes(q) || item.client.cuit.includes(q);
        
        let matchesFilter = true;
        if (accFilterDebt === 'debtors') {
            matchesFilter = item.summary.saldo > 0;
        } else if (accFilterDebt === 'overdue') {
            matchesFilter = item.summary.vencido > 0;
        } else if (accFilterDebt === 'nodebt') {
            matchesFilter = item.summary.saldo === 0;
        } else if (accFilterDebt === 'active') {
            matchesFilter = item.client.active !== false;
        }

        let matchesMora = true;
        if (accMinMora) {
            matchesMora = item.summary.maxMora >= parseInt(accMinMora, 10);
        }

        return matchesSearch && matchesFilter && matchesMora;
    });

    // ==========================================
    // NOTIFICATIONS WITH EDITABLE TEMPLATES
    // ==========================================
    const loadEmailTemplate = (client: LocalClient, type: 'preventivo' | 'vencido' | 'segundo' | 'pago') => {
        const summary = getClientFinancialSummary(client);
        let rawTemplate = '';
        if (type === 'preventivo') {
            rawTemplate = cobranzaConfig.plantillaPreventivoEmail;
        } else if (type === 'vencido') {
            rawTemplate = cobranzaConfig.plantillaDeudaVencidaEmail;
        } else if (type === 'segundo') {
            rawTemplate = cobranzaConfig.plantillaSegundoAvisoEmail;
        } else {
            rawTemplate = cobranzaConfig.plantillaPagoRecibidoEmail;
        }

        return rawTemplate
            .replace(/{monto_saldo}/g, formatCurrency(summary.saldo))
            .replace(/{monto_vencido}/g, formatCurrency(summary.vencido))
            .replace(/{monto_pago}/g, formatCurrency(summary.saldo)); // fallback payment placeholder
    };

    const handleEmailTemplateChange = (type: 'preventivo' | 'vencido' | 'segundo' | 'pago') => {
        setEmailTemplateType(type);
        if (emailTarget) {
            setEmailBody(loadEmailTemplate(emailTarget, type));
        }
    };

    const openEmail = (client: LocalClient) => {
        setEmailTarget(client);
        setEmailTo(client.email || 'administracion@cliente.com');
        setEmailSubject(`Estado de Cuenta – ${client.name} – ${new Date().toLocaleDateString('es-AR')}`);
        setEmailTemplateType('preventivo');
        setEmailBody(loadEmailTemplate(client, 'preventivo'));
        setIsEmailModalOpen(true);
    };

    const sendEmail = () => {
        const mailto = `mailto:${emailTo}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
        window.open(mailto, '_blank');
        
        if (emailTarget) {
            registerCobranzaGestion(emailTarget.id, 'Email', 'Correo enviado', `Enviado recordatorio tipo: ${emailTemplateType.toUpperCase()}`);
            playSystemSound('recordatorio', cobranzaConfig);
        }
        
        setIsEmailModalOpen(false);
    };

    const loadWhatsappTemplate = (client: LocalClient, type: 'preventivo' | 'vencido' | 'segundo' | 'pago') => {
        const summary = getClientFinancialSummary(client);
        let rawTemplate = '';
        if (type === 'preventivo') {
            rawTemplate = cobranzaConfig.plantillaPreventivoWhatsapp;
        } else if (type === 'vencido') {
            rawTemplate = cobranzaConfig.plantillaDeudaVencidaWhatsapp;
        } else if (type === 'segundo') {
            rawTemplate = cobranzaConfig.plantillaSegundoAvisoWhatsapp;
        } else {
            rawTemplate = cobranzaConfig.plantillaPagoRecibidoWhatsapp;
        }

        return rawTemplate
            .replace(/{monto_saldo}/g, formatCurrency(summary.saldo))
            .replace(/{monto_vencido}/g, formatCurrency(summary.vencido))
            .replace(/{monto_pago}/g, formatCurrency(summary.saldo))
            .replace(/{cant_impagos}/g, String(summary.countPending));
    };

    const handleWhatsappTemplateChange = (type: 'preventivo' | 'vencido' | 'segundo' | 'pago') => {
        setWhatsappTemplateType(type);
        if (whatsappTarget) {
            setWhatsappText(loadWhatsappTemplate(whatsappTarget, type));
        }
    };

    const openWhatsapp = (client: LocalClient) => {
        setWhatsappTarget(client);
        setWhatsappPhone(client.phone ? client.phone.replace(/[^0-9]/g, '') : '');
        setWhatsappTemplateType('preventivo');
        setWhatsappText(loadWhatsappTemplate(client, 'preventivo'));
        setIsWhatsappModalOpen(true);
    };

    const sendWhatsapp = () => {
        const waLink = `https://api.whatsapp.com/send?phone=${whatsappPhone}&text=${encodeURIComponent(whatsappText)}`;
        window.open(waLink, '_blank');
        
        if (whatsappTarget) {
            registerCobranzaGestion(whatsappTarget.id, 'WhatsApp', 'WhatsApp enviado', `Notificado recordatorio tipo: ${whatsappTemplateType.toUpperCase()}`);
            playSystemSound('recordatorio', cobranzaConfig);
        }
        
        setIsWhatsappModalOpen(false);
    };

    // Register quick actions suggested
    const registerCobranzaGestion = (
        clientId: string, 
        type: 'WhatsApp' | 'Email' | 'Llamado' | 'Pago registrado' | 'Promesa de pago' | 'Regularización' | 'Auditoría',
        result: string,
        observations: string
    ) => {
        const newGestion = {
            id: `g-${Date.now()}`,
            clientId,
            date: todayStr,
            type,
            user: 'Administrador',
            channel: type === 'WhatsApp' ? 'WhatsApp Web' : type === 'Email' ? 'Email Client' : 'Sistema',
            result,
            observations
        };
        setGestiones(prev => [newGestion, ...(prev || [])]);
    };

    const handleQuickAction = (client: LocalClient, type: 'whatsapp' | 'email' | 'promesa' | 'llamado') => {
        if (type === 'whatsapp') {
            openWhatsapp(client);
        } else if (type === 'email') {
            openEmail(client);
        } else if (type === 'llamado') {
            registerCobranzaGestion(client.id, 'Llamado', 'Conversación realizada', 'Contacto telefónico para regularización.');
            playSystemSound('recordatorio', cobranzaConfig);
            alert(`Llamado telefónico registrado en el historial de ${client.name}.`);
        } else if (type === 'promesa') {
            setAccountClient(client);
            setNewGestionType('Promesa de pago');
            setNewGestionChannel('Teléfono');
            setNewGestionResult('Promesa agendada');
            setNewGestionObs('Se compromete a transferir saldo pendiente.');
            setAccountModalTab('history');
            setIsNewGestionOpen(true);
            setIsAccountOpen(true);
        }
    };

    // Register dynamic collection payments
    const handleCollectInvoice = (client: LocalClient, movement: any) => {
        const readingId = movement.id.replace('fact-', '').replace('rec-', '');
        
        setReadings(prev => prev.map(r => r.id === readingId ? { ...r, status: 'paid' } : r));

        const updatedReadings = readings.map(r => r.id === readingId ? { ...r, status: 'paid' as const } : r);
        const nextSummary = getClientFinancialSummaryHelper(client, updatedReadings, machines);

        if (nextSummary.saldo === 0) {
            registerCobranzaGestion(client.id, 'Regularización', 'Regularizado', `Pago de factura ${movement.number} cancelando deuda total.`);
            playSystemSound('regularizado', cobranzaConfig);
            alert(`Cobro registrado con éxito. ¡Cuenta regularizada para ${client.name}!`);
        } else {
            registerCobranzaGestion(client.id, 'Pago registrado', 'Cobrado parcial', `Pago registrado de factura ${movement.number}.`);
            playSystemSound('pago', cobranzaConfig);
            alert(`Cobro registrado para factura ${movement.number}.`);
        }

        setIsAccountOpen(false);
        setTimeout(() => {
            openAccountView(client);
        }, 100);
    };

    // Save customized configurations
    const handleSaveConfig = (e: React.FormEvent) => {
        e.preventDefault();
        alert('Configuraciones de automatización y sonidos guardadas con éxito localmente.');
        playSystemSound('recordatorio', cobranzaConfig);
    };

    // Save internal comments
    const handleSaveInternalNotes = () => {
        if (!accountClient) return;
        setClients(prev => prev.map(c => c.id === accountClient.id ? { ...c, cobranzaNotas: tempInternalNotes } : c));
        
        // Update local object
        setAccountClient(prev => prev ? { ...prev, cobranzaNotas: tempInternalNotes } : null);

        registerCobranzaGestion(accountClient.id, 'Auditoría', 'Notas actualizadas', 'Se actualizaron las notas internas de cobranza.');
        playSystemSound('recordatorio', cobranzaConfig);
        alert('Notas internas comerciales guardadas con éxito.');
    };

    // ==========================================
    // EXPORT INDIVIDUAL PDF WITH TWO VERSIONS AND COMMERCIAL BRANDING
    // ==========================================
    const printClientAccount = (client: LocalClient, version: 'comercial' | 'interna') => {
        const movements = getClientMovements(client);
        const summary = getClientFinancialSummary(client);
        
        // Audit log
        registerCobranzaGestion(
            client.id, 
            'Auditoría', 
            'Reporte generado', 
            `Se exportó el Estado de Cuenta en versión ${version.toUpperCase()} para conciliación.`
        );

        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        // Apply period filters to print layout too if configured
        const filteredMovements = movements.filter(m => {
            if (filterStartMonth && m.period && m.period !== 'Saldo Inicial' && m.period < filterStartMonth) return false;
            if (filterEndMonth && m.period && m.period !== 'Saldo Inicial' && m.period > filterEndMonth) return false;
            return true;
        });

        const rows = filteredMovements.map(m => `
            <tr>
                <td style="padding: 6px; border: 1px solid #cbd5e1; font-size: 11px;">${m.date}</td>
                <td style="padding: 6px; border: 1px solid #cbd5e1; font-size: 11px;">${m.type}</td>
                <td style="padding: 6px; border: 1px solid #cbd5e1; font-size: 11px; font-family: monospace;">${m.number}</td>
                <td style="padding: 6px; border: 1px solid #cbd5e1; font-size: 11px;">${m.concept}</td>
                <td style="padding: 6px; border: 1px solid #cbd5e1; font-size: 11px; text-align: right;">${formatCurrency(m.original)}</td>
                <td style="padding: 6px; border: 1px solid #cbd5e1; font-size: 11px; text-align: right;">${formatCurrency(m.paid)}</td>
                <td style="padding: 6px; border: 1px solid #cbd5e1; font-size: 11px; text-align: right; font-weight: bold; color: ${m.pending > 0 ? '#ef4444' : '#10b981'};">${formatCurrency(m.pending)}</td>
                <td style="padding: 6px; border: 1px solid #cbd5e1; font-size: 11px;">${m.dueDate || '-'}</td>
                <td style="padding: 6px; border: 1px solid #cbd5e1; font-size: 11px; text-align: center;">
                    <span style="padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: bold; background-color: ${
                        m.status === 'Pagado' ? '#ecfdf5' : (m.status === 'Vencido' ? '#fef2f2' : '#fef3c7')
                    }; color: ${
                        m.status === 'Pagado' ? '#047857' : (m.status === 'Vencido' ? '#b91c1c' : '#b45309')
                    };">${m.status}</span>
                </td>
            </tr>
        `).join('');

        const gestionesLogs = (gestiones || []).filter(g => g.clientId === client.id).map(g => `
            <div style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-size: 10.5px;">
                <strong>${g.date} - ${g.type}</strong> [Canal: ${g.channel} | Resultado: ${g.result}]<br/>
                <span style="color: #475569; italic font-style: italic;">"${g.observations}"</span> <span style="font-size: 9px; color: #94a3b8;">(Por: ${g.user})</span>
            </div>
        `).join('');

        const statusObservation = summary.vencido > 0 
            ? "🔴 DEUDOR CON SALDO VENCIDO EXIGIBLE" 
            : (summary.saldo > 0 ? "🟡 SALDO ACTIVO SIN VENCIMIENTO" : "🟢 CUENTA CORRIENTE SANEADA - AL DÍA");

        const riskBadgeColor = summary.riskColor === 'red' ? '#ef4444' : (summary.riskColor === 'yellow' ? '#f59e0b' : '#10b981');

        printWindow.document.write(`
            <html>
                <head>
                    <title>Estado de Cuenta - ${client.name} (${version.toUpperCase()})</title>
                    <style>
                        body { font-family: Arial, sans-serif; color: #334155; padding: 25px; line-height: 1.4; }
                        .header-box { display: flex; justify-content: space-between; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; }
                        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                        th { background-color: #f1f5f9; text-align: left; padding: 8px; border: 1px solid #cbd5e1; font-size: 11px; font-weight: bold; }
                        .summary-grid { display: grid; grid-template-cols: repeat(4, 1fr); gap: 15px; margin-top: 15px; background: #f8fafc; border: 1px solid #cbd5e1; padding: 15px; border-radius: 8px; }
                        .admin-panel { margin-top: 20px; border: 1px solid #e2e8f0; background-color: #f8fafc; padding: 15px; border-radius: 8px; }
                        .footer-signature { margin-top: 40px; display: flex; justify-content: space-between; font-size: 11px; color: #64748b; }
                    </style>
                </head>
                <body>
                    <!-- Commercial Identity Header -->
                    <div class="header-box">
                        <div>
                            <h2 style="margin: 0; color: #4f46e5; font-size: 22px;">${BRANDING.legalName}</h2>
                            <span style="font-size: 11px; color: #64748b;">CUIT: ${BRANDING.cuit} | Dirección: ${BRANDING.address}, ${BRANDING.city}</span><br/>
                            <span style="font-size: 11px; color: #64748b;">Contacto: ${BRANDING.email} | Tel: ${BRANDING.phones}</span>
                        </div>
                        <div style="text-align: right;">
                            <h3 style="margin: 0; font-size: 14px; text-transform: uppercase;">Estado de Cuenta ${version === 'interna' ? 'Interno' : 'Comercial'}</h3>
                            <span style="font-size: 10px; color: #64748b;">Generado: ${new Date().toLocaleDateString('es-AR')} ${new Date().toLocaleTimeString('es-AR')}</span>
                        </div>
                    </div>

                    <div style="margin-top: 20px; font-size: 12px; display: grid; grid-template-cols: 1fr 1fr; gap: 20px;">
                        <div>
                            <strong>DATOS DEL CLIENTE:</strong><br/>
                            <span style="font-size: 13px; font-weight: bold; color: #1e293b;">${client.name}</span><br/>
                            CUIT: ${client.cuit}<br/>
                            Categoría Fiscal: ${client.taxCategory}
                        </div>
                        <div style="text-align: right;">
                            Dirección: ${client.address || 'Sin especificar'}<br/>
                            Teléfono: ${client.phone || 'N/A'}<br/>
                            Email: ${client.email || 'N/A'}
                        </div>
                    </div>

                    <!-- Financial indicators -->
                    <div class="summary-grid">
                        <div>
                            <span style="color: #64748b; font-size: 10px; text-transform: uppercase; font-weight: bold;">Saldo Total</span><br/>
                            <strong style="font-size: 16px; color: #1e293b;">${formatCurrency(summary.saldo)}</strong>
                        </div>
                        <div>
                            <span style="color: #64748b; font-size: 10px; text-transform: uppercase; font-weight: bold; color: #ef4444;">Vencido</span><br/>
                            <strong style="font-size: 16px; color: #ef4444;">${formatCurrency(summary.vencido)}</strong>
                        </div>
                        <div>
                            <span style="color: #64748b; font-size: 10px; text-transform: uppercase; font-weight: bold; color: #3b82f6;">A Vencer</span><br/>
                            <strong style="font-size: 16px; color: #3b82f6;">${formatCurrency(summary.noVencido)}</strong>
                        </div>
                        <div>
                            <span style="color: #64748b; font-size: 10px; text-transform: uppercase; font-weight: bold;">Documentos</span><br/>
                            <strong style="font-size: 16px; color: #1e293b;">${summary.countPending} impagos</strong>
                        </div>
                    </div>

                    ${version === 'interna' ? `
                    <!-- Audit and Internal Information panel -->
                    <div class="admin-panel">
                        <h4 style="margin: 0 0 10px 0; font-size: 12px; text-transform: uppercase; color: #4f46e5; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px;">INFORMACIÓN EXCLUSIVA DE ADMINISTRACIÓN</h4>
                        <div style="display: grid; grid-template-cols: repeat(3, 1fr); gap: 15px; font-size: 11px;">
                            <div>
                                <strong>Score de Cobrabilidad:</strong> <span style="font-weight: bold; color: ${riskBadgeColor}">${summary.score} / 100</span> (${summary.riskLevel})
                            </div>
                            <div>
                                <strong>Promedio Días de Pago:</strong> <span>${summary.avgPayDays} días</span>
                            </div>
                            <div>
                                <strong>Mora Máxima Registrada:</strong> <span>${summary.maxMora} días</span>
                            </div>
                        </div>
                        <div style="margin-top: 10px; font-size: 11px;">
                            <strong>Notas Internas Comerciales:</strong><br/>
                            <p style="margin: 4px 0 0 0; color: #475569; font-style: italic;">"${client.cobranzaNotas || 'Sin notas comerciales internas'}"</p>
                        </div>
                    </div>
                    ` : ''}

                    <div style="margin-top: 15px; font-size: 11px; font-weight: bold; background-color: #f1f5f9; padding: 10px 15px; border-radius: 6px; border-left: 4px solid #4f46e5;">
                        Situación Financiera: ${statusObservation} (Mora Máxima: ${summary.maxMora} días)
                    </div>

                    <h4 style="margin-bottom: 8px; margin-top: 25px; font-size: 13px; text-transform: uppercase; color: #1e293b;">Detalle de Cuenta Corriente</h4>
                    <table>
                        <thead>
                            <tr>
                                <th>Fecha</th>
                                <th>Tipo</th>
                                <th>Comprobante</th>
                                <th>Período / Detalle</th>
                                <th style="text-align: right;">Importe Orig.</th>
                                <th style="text-align: right;">Cobrado</th>
                                <th style="text-align: right;">Pendiente</th>
                                <th>Vencimiento</th>
                                <th style="text-align: center;">Estado</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rows}
                        </tbody>
                    </table>

                    ${version === 'interna' && gestionesLogs ? `
                    <h4 style="margin-bottom: 8px; margin-top: 30px; font-size: 13px; text-transform: uppercase; color: #1e293b; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px;">Historial de gestiones de cobro</h4>
                    <div style="border: 1px solid #cbd5e1; border-radius: 6px; background-color: #fafafa; padding: 8px;">
                        ${gestionesLogs}
                    </div>
                    ` : ''}

                    <!-- Commercial Signature Footer -->
                    <div class="footer-signature">
                        <div>
                            <span>Generado por: ${BRANDING.commercialName} - Administración</span><br/>
                            <span>Usuario Emisor: Administrador</span>
                        </div>
                        <div style="text-align: right; margin-top: 20px;">
                            <div style="border-top: 1px solid #64748b; width: 180px; padding-top: 4px; text-align: center;">
                                Firma Autorizada y Sello
                            </div>
                        </div>
                    </div>

                    <script>
                        window.onload = function() { window.print(); }
                    </script>
                </body>
            </html>
        `);
        printWindow.document.close();
    };

    const downloadExcelClient = (client: LocalClient) => {
        const movements = getClientMovements(client);
        const summary = getClientFinancialSummary(client);

        // Audit log CSV export
        registerCobranzaGestion(
            client.id, 
            'Auditoría', 
            'Reporte generado', 
            'Se exportó el Estado de Cuenta consolidado en formato CSV/Excel.'
        );

        let csv = '\uFEFF'; // BOM UTF-8
        csv += `ESTADO DE CUENTA CORRIENTE - ${client.name}\n`;
        csv += `Fecha Emisión:;${new Date().toLocaleDateString('es-AR')}\n`;
        csv += `CUIT:;${client.cuit}\n`;
        csv += `Condición Fiscal:;${client.taxCategory}\n\n`;

        csv += `RESUMEN FINANCIERO\n`;
        csv += `Saldo Total:;${summary.saldo}\n`;
        csv += `Deuda Vencida:;${summary.vencido}\n`;
        csv += `Deuda A Vencer:;${summary.noVencido}\n`;
        csv += `Comprobantes Pendientes:;${summary.countPending}\n`;
        csv += `Promedio Dias Pago:;${summary.avgPayDays}\n`;
        csv += `Score Cobrabilidad:;${summary.score}\n`;
        csv += `Último Pago:;${summary.lastPayment}\n\n`;

        csv += `DETALLE DE COMPROBANTES\n`;
        csv += `Fecha;Tipo;Comprobante;Concepto;Importe Original;Cobrado;Saldo Pendiente;Vencimiento;Atraso (días);Estado;Notas\n`;

        movements.forEach(m => {
            csv += `${m.date};${m.type};${m.number};${m.concept};${m.original};${m.paid};${m.pending};${m.dueDate || '-'};${m.daysOverdue};${m.status};${m.notes || ''}\n`;
        });

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.setAttribute('download', `EstadoCuenta_${client.name.replace(/ /g, '_')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // ==========================================
    // EXPORT CONSOLIDATED REPORT
    // ==========================================
    const printConsolidatedReport = () => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        const debtors = clients.map(c => ({
            client: c,
            summary: getClientFinancialSummary(c)
        })).filter(item => item.summary.saldo > 0);

        const rows = debtors.map(item => `
            <tr>
                <td style="padding: 6px; border: 1px solid #cbd5e1; font-size: 11px; font-weight: bold;">${item.client.name}</td>
                <td style="padding: 6px; border: 1px solid #cbd5e1; font-size: 11px; font-family: monospace;">${item.client.cuit}</td>
                <td style="padding: 6px; border: 1px solid #cbd5e1; font-size: 11px; text-align: right; font-weight: bold;">${formatCurrency(item.summary.saldo)}</td>
                <td style="padding: 6px; border: 1px solid #cbd5e1; font-size: 11px; text-align: right; color: #ef4444; font-weight: bold;">${formatCurrency(item.summary.vencido)}</td>
                <td style="padding: 6px; border: 1px solid #cbd5e1; font-size: 11px; text-align: center;">${item.summary.countPending}</td>
                <td style="padding: 6px; border: 1px solid #cbd5e1; font-size: 11px; text-align: center;">${item.summary.maxMora} d.</td>
                <td style="padding: 6px; border: 1px solid #cbd5e1; font-size: 11px; text-align: center; color: #4f46e5; font-weight: bold;">${item.summary.score}/100</td>
                <td style="padding: 6px; border: 1px solid #cbd5e1; font-size: 11px;">${item.summary.lastPayment}</td>
            </tr>
        `).join('');

        const totalSaldo = debtors.reduce((acc, item) => acc + item.summary.saldo, 0);
        const totalVencido = debtors.reduce((acc, item) => acc + item.summary.vencido, 0);

        printWindow.document.write(`
            <html>
                <head>
                    <title>Reporte Consolidado de Deudores</title>
                    <style>
                        body { font-family: Arial, sans-serif; color: #334155; padding: 25px; }
                        .header-box { display: flex; justify-content: space-between; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; }
                        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                        th { background-color: #f1f5f9; text-align: left; padding: 8px; border: 1px solid #cbd5e1; font-size: 11px; font-weight: bold; }
                        .summary-grid { display: flex; gap: 30px; margin-top: 15px; background: #f8fafc; border: 1px solid #cbd5e1; padding: 15px; border-radius: 8px; }
                    </style>
                </head>
                <body>
                    <div class="header-box">
                        <div>
                            <h2 style="margin: 0; color: #4f46e5; font-size: 22px;">${BRANDING.legalName}</h2>
                            <span style="font-size: 11px; color: #64748b;">Reporte Gerencial de Deudores Consolidado</span>
                        </div>
                        <div style="text-align: right;">
                            <h3 style="margin: 0; font-size: 14px; text-transform: uppercase;">Consolidado de Deudas y Scores</h3>
                            <span style="font-size: 10px; color: #64748b;">Fecha: ${new Date().toLocaleDateString('es-AR')}</span>
                        </div>
                    </div>

                    <div class="summary-grid">
                        <div>
                            <span style="color: #64748b; font-size: 10px; text-transform: uppercase; font-weight: bold;">Deuda Cartera Total:</span><br/>
                            <strong style="font-size: 16px; color: #1e293b;">${formatCurrency(totalSaldo)}</strong>
                        </div>
                        <div>
                            <span style="color: #64748b; font-size: 10px; text-transform: uppercase; font-weight: bold; color: #ef4444;">Total Vencido Exigible:</span><br/>
                            <strong style="font-size: 16px; color: #ef4444;">${formatCurrency(totalVencido)}</strong>
                        </div>
                        <div>
                            <span style="color: #64748b; font-size: 10px; text-transform: uppercase; font-weight: bold;">Clientes en Mora:</span><br/>
                            <strong style="font-size: 16px; color: #1e293b;">${debtors.length} deudores</strong>
                        </div>
                    </div>

                    <h4 style="margin-bottom: 8px; margin-top: 25px; font-size: 13px; text-transform: uppercase; color: #1e293b;">Detalle de Clientes Deudores</h4>
                    <table>
                        <thead>
                            <tr>
                                <th>Cliente</th>
                                <th>CUIT</th>
                                <th style="text-align: right;">Deuda Total</th>
                                <th style="text-align: right;">Deuda Vencida</th>
                                <th style="text-align: center;">Facturas impagas</th>
                                <th style="text-align: center;">Mora Máxima</th>
                                <th style="text-align: center;">Score</th>
                                <th>Último Pago</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rows}
                        </tbody>
                    </table>

                    <script>
                        window.onload = function() { window.print(); }
                    </script>
                </body>
            </html>
        `);
        printWindow.document.close();
    };

    // ==========================================
    // ACTIONS MOCK MASIVAS / SELECTION
    // ==========================================
    const toggleSelectBulk = (id: string) => {
        setSelectedBulkIds(prev => 
            prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
        );
    };

    const toggleSelectAllBulk = () => {
        if (selectedBulkIds.length === accountsData.length) {
            setSelectedBulkIds([]);
        } else {
            setSelectedBulkIds(accountsData.map(item => item.client.id));
        }
    };

    const triggerBulkEmail = () => {
        if (selectedBulkIds.length === 0) return;
        alert(`Recordatorio masivo enviado por correo a los ${selectedBulkIds.length} clientes seleccionados con éxito.`);
        setSelectedBulkIds([]);
    };

    const triggerBulkExcel = () => {
        if (selectedBulkIds.length === 0) return;
        
        let csv = '\uFEFF';
        csv += `REPORTE CONSOLIDADO MASIVO DE CUENTAS CORRIENTES\n`;
        csv += `Generado:;${new Date().toLocaleDateString('es-AR')}\n\n`;
        csv += `Cliente;CUIT;Condicion Fiscal;Saldo Total;Deuda Vencida;Mora Maxima (Dias);Score;Comprobantes Impagos\n`;
        
        selectedBulkIds.forEach(id => {
            const cl = clients.find(c => c.id === id);
            if (cl) {
                const s = getClientFinancialSummary(cl);
                csv += `${cl.name};${cl.cuit};${cl.taxCategory};${s.saldo};${s.vencido};${s.maxMora};${s.score};${s.countPending}\n`;
            }
        });

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.setAttribute('download', 'ConsolidadoCuentasCorrientes.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setSelectedBulkIds([]);
    };

    // ==========================================
    // ACCOUNTING STATE SAVER AND VIEWERS
    // ==========================================
    const openAccountView = (client: LocalClient) => {
        setAccountClient(client);
        setAccountFilter('all');
        setFilterStartMonth('');
        setFilterEndMonth('');
        setAccountDebtTypeFilter('all');
        setAccountModalTab('movements');
        setTempInternalNotes(client.cobranzaNotas || '');
        setIsAccountOpen(true);
    };

    // Build filtered ledger list for specific customer
    const getFilteredMovements = () => {
        if (!accountClient) return [];
        let list = getClientMovements(accountClient);

        if (accountFilter === 'pending') {
            list = list.filter(m => m.pending > 0);
        } else if (accountFilter === 'overdue') {
            list = list.filter(m => m.status === 'Vencido');
        } else if (accountFilter === 'paid') {
            list = list.filter(m => m.pending === 0 && m.type === 'Factura');
        }

        // Period monthly filters
        if (filterStartMonth) {
            list = list.filter(m => {
                if (m.period === 'Saldo Inicial') return true; // keep initial debt
                return m.period >= filterStartMonth;
            });
        }
        if (filterEndMonth) {
            list = list.filter(m => {
                if (m.period === 'Saldo Inicial') return true;
                return m.period <= filterEndMonth;
            });
        }

        if (accountDebtTypeFilter === 'vencida') {
            list = list.filter(m => m.status === 'Vencido');
        } else if (accountDebtTypeFilter === 'no-vencida') {
            list = list.filter(m => m.status === 'Pendiente');
        }

        list.sort((a, b) => {
            let valA = a[accountSortKey];
            let valB = b[accountSortKey];
            
            if (accountSortKey === 'pending' || accountSortKey === 'original') {
                valA = Number(valA) || 0;
                valB = Number(valB) || 0;
            } else {
                valA = String(valA || '');
                valB = String(valB || '');
            }

            if (valA < valB) return accountSortOrder === 'asc' ? -1 : 1;
            if (valA > valB) return accountSortOrder === 'asc' ? 1 : -1;
            return 0;
        });

        return list;
    };

    const toggleAccountSort = (key: 'date' | 'dueDate' | 'pending' | 'original') => {
        if (accountSortKey === key) {
            setAccountSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setAccountSortKey(key);
            setAccountSortOrder('desc');
        }
    };

    const handleOpenForm = (client: LocalClient | null = null) => {
        setFormError('');
        if (client) {
            setEditingClient(client);
            setName(client.name);
            setCuit(client.cuit);
            setTaxCategory(client.taxCategory || 'Responsable Inscripto');
            setAddress(client.address || '');
            setPhone(client.phone || '');
            setEmail(client.email || '');
            setDebt(String(client.debt || 0));
            setIsActive(client.active !== false);
        } else {
            setEditingClient(null);
            setName('');
            setCuit('');
            setTaxCategory('Responsable Inscripto');
            setAddress('');
            setPhone('');
            setEmail('');
            setDebt('0');
            setIsActive(true);
        }
        setIsFormOpen(true);
    };

    const handleOpenDetail = (client: LocalClient) => {
        setSelectedClient(client);
        setDetailTab('machines');
        setIsDetailOpen(true);
    };

    const handleSaveClientForm = (e: React.FormEvent) => {
        e.preventDefault();
        setFormError('');

        if (!name.trim()) {
            setFormError('El nombre o razón social es obligatorio.');
            return;
        }
        if (!cuit.trim()) {
            setFormError('El CUIT es obligatorio.');
            return;
        }

        const cleanCuit = cuit.replace(/-/g, '').trim();
        const duplicate = clients.find(c => 
            c.cuit.replace(/-/g, '').trim() === cleanCuit && 
            (!editingClient || c.id !== editingClient.id)
        );

        if (duplicate) {
            setFormError(`El CUIT ${cuit} ya se encuentra asignado al cliente "${duplicate.name}".`);
            return;
        }

        const clientData: LocalClient = {
            id: editingClient ? editingClient.id : 'client-' + Date.now(),
            name,
            cuit,
            taxCategory,
            address,
            phone,
            email,
            debt: parseFloat(debt) || 0,
            active: isActive,
            cobranzaNotas: editingClient ? editingClient.cobranzaNotas : ''
        };

        if (editingClient) {
            setClients(prev => prev.map(c => c.id === editingClient.id ? clientData : c));
        } else {
            setClients(prev => [...prev, clientData]);
        }

        setIsFormOpen(false);
    };

    const handleDeleteClient = (id: string) => {
        const clientMachines = machines.filter(m => m.clientId === id);
        if (clientMachines.length > 0) {
            alert(`No es posible eliminar el cliente porque tiene ${clientMachines.length} máquina(s) asignada(s). Por favor desasigne los equipos primero.`);
            return;
        }

        if (confirm('¿Está seguro de que desea eliminar este cliente del sistema?')) {
            setClients(prev => prev.filter(c => c.id !== id));
        }
    };

    const handleRegisterGestionSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!accountClient) return;

        registerCobranzaGestion(accountClient.id, newGestionType, newGestionResult || 'Registrado', newGestionObs);
        
        playSystemSound('recordatorio', cobranzaConfig);
        
        setIsNewGestionOpen(false);
        setNewGestionObs('');
        setNewGestionResult('');
        alert('Gestión de cobranza registrada con éxito.');
    };

    const todayStr = '2026-07-05';

    return (
        <div className="space-y-6 animate-fade-in text-slate-100 pb-12">
            
            {/* Top Alerts Panel */}
            {alerts.length > 0 && activeTab !== 'config' && (
                <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-4 space-y-3">
                    <div className="flex items-center gap-2 text-xs font-bold text-amber-500 uppercase tracking-wider">
                        <Bell size={14} className="animate-pulse" />
                        <span>Notificaciones Críticas de Cobranza ({alerts.length})</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[140px] overflow-y-auto">
                        {alerts.slice(0, 4).map(alert => (
                            <div key={alert.id} className="p-2.5 bg-slate-955/40 rounded-xl border border-slate-850 text-xs flex justify-between items-center hover:bg-slate-900/20">
                                <div>
                                    <span className="font-extrabold text-slate-105 block">{alert.clientName}</span>
                                    <p className="text-[11px] text-slate-400 mt-0.5">{alert.descripcion}</p>
                                </div>
                                <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    onClick={() => {
                                        const cl = clients.find(c => c.id === alert.clientId);
                                        if (cl) openAccountView(cl);
                                    }}
                                    className="text-indigo-400 text-[10px] h-7 hover:bg-indigo-950/20"
                                >
                                    Gestionar
                                </Button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Nav Main Tabs */}
            <div className="flex flex-wrap md:flex-nowrap gap-1 border-b border-slate-800 pb-1">
                <button
                    onClick={() => setActiveTab('list')}
                    className={`flex-1 md:flex-none text-center justify-center px-4 py-2.5 text-xs font-bold uppercase tracking-wider rounded-t-xl transition-all ${
                        activeTab === 'list' 
                            ? 'bg-slate-900 border-t-2 border-indigo-500 text-indigo-400 font-extrabold' 
                            : 'text-slate-500 hover:text-slate-400'
                    }`}
                >
                    Listado de Clientes
                </button>
                <button
                    onClick={() => setActiveTab('accounts')}
                    className={`flex-1 md:flex-none text-center justify-center px-4 py-2.5 text-xs font-bold uppercase tracking-wider rounded-t-xl transition-all flex items-center gap-1.5 ${
                        activeTab === 'accounts' 
                            ? 'bg-slate-900 border-t-2 border-indigo-500 text-indigo-400 font-extrabold' 
                            : 'text-slate-500 hover:text-slate-400'
                    }`}
                >
                    <Landmark size={13} /> Cuentas Corrientes
                </button>
                <button
                    onClick={() => setActiveTab('config')}
                    className={`flex-1 md:flex-none text-center justify-center px-4 py-2.5 text-xs font-bold uppercase tracking-wider rounded-t-xl transition-all flex items-center gap-1.5 ${
                        activeTab === 'config' 
                            ? 'bg-slate-900 border-t-2 border-indigo-500 text-indigo-400 font-extrabold' 
                            : 'text-slate-500 hover:text-slate-400'
                    }`}
                >
                    <Settings size={13} /> Automatización y Alertas
                </button>
            </div>

            {activeTab === 'list' && (
                <div className="space-y-6">
                    {/* Action Bar */}
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-slate-900/20 p-4 rounded-2xl border border-slate-800/80">
                        <div className="flex flex-col sm:flex-row flex-1 gap-2 w-full lg:max-w-xl">
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Buscar cliente por nombre, CUIT, dirección..."
                                className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3.5 py-2 text-xs text-slate-105 placeholder-slate-550 outline-none focus:ring-1 focus:ring-indigo-500"
                            />

                            <select
                                value={filterStatus}
                                onChange={(e) => setFilterStatus(e.target.value)}
                                className="w-full sm:w-44 bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-slate-300 text-xs focus:outline-none"
                            >
                                <option value="">Todos los estados</option>
                                <option value="active">Solo Activos</option>
                                <option value="inactive">Solo Inactivos</option>
                                <option value="debt">Solo con Deuda</option>
                            </select>
                        </div>

                        <Button variant="primary" size="sm" onClick={() => handleOpenForm()} className="w-full lg:w-auto shrink-0 justify-center">
                            <Plus size={15} className="mr-1.5" /> Nuevo Cliente
                        </Button>
                    </div>

                    {/* List Table */}
                    <TableContainer>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHeaderCell>Cliente</TableHeaderCell>
                                    <TableHeaderCell>CUIT</TableHeaderCell>
                                    <TableHeaderCell>Categoría Fiscal</TableHeaderCell>
                                    <TableHeaderCell>Dirección</TableHeaderCell>
                                    <TableHeaderCell>Alquileres Activos</TableHeaderCell>
                                    <TableHeaderCell>Deuda Acumulada</TableHeaderCell>
                                    <TableHeaderCell>Estado Operativo</TableHeaderCell>
                                    <TableHeaderCell className="text-right">Acciones</TableHeaderCell>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredClients.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="text-center py-10 text-slate-500 text-xs italic">
                                            No se encontraron clientes registrados.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredClients.map(c => {
                                        const activeRentals = rentals.filter(r => r.clientId === c.id && r.status === 'activo').length;
                                        const isClientActive = c.active !== false;
                                        const fin = getClientFinancialSummary(c);

                                        return (
                                            <TableRow key={c.id} className="hover:bg-slate-900/40">
                                                <TableCell className="font-bold text-slate-100">{c.name}</TableCell>
                                                <TableCell className="font-mono-tabular text-xs text-slate-350">{c.cuit}</TableCell>
                                                <TableCell className="text-xs text-slate-355">{c.taxCategory}</TableCell>
                                                <TableCell className="text-xs text-slate-400 max-w-[200px] truncate">{c.address || '-'}</TableCell>
                                                <TableCell className="text-xs font-semibold text-slate-300 font-mono-tabular">
                                                    {activeRentals > 0 ? `${activeRentals} plan(es)` : <span className="text-slate-500 italic">Ninguno</span>}
                                                </TableCell>
                                                <TableCell className="font-mono-tabular text-xs">
                                                    <span className={fin.saldo > 0 ? "text-red-500 font-extrabold" : "text-emerald-500 font-semibold"}>
                                                        {fin.saldo > 0 ? formatCurrency(fin.saldo) : 'Sin Deuda'}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-xs">
                                                    <LocalBadge variant={isClientActive ? 'success' : 'danger'}>
                                                        {isClientActive ? 'ACTIVO' : 'INACTIVO'}
                                                    </LocalBadge>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="relative flex justify-end">
                                                        {/* Desktop buttons (visible on xl screens and up) */}
                                                        <div className="hidden xl:flex justify-end gap-1.5">
                                                            <button 
                                                                title="Estado de Cuenta Contable"
                                                                onClick={() => openAccountView(c)}
                                                                className="p-1.5 bg-slate-900 border border-slate-800 rounded-lg hover:bg-slate-850 transition-colors"
                                                            >
                                                                <Landmark size={13} className="text-emerald-450" />
                                                            </button>
                                                            <button 
                                                                title="Ficha del Cliente"
                                                                onClick={() => handleOpenDetail(c)}
                                                                className="p-1.5 bg-slate-900 border border-slate-800 rounded-lg hover:bg-slate-850 transition-colors"
                                                            >
                                                                <FileText size={13} className="text-indigo-400" />
                                                            </button>
                                                            <button 
                                                                title="Editar Cliente"
                                                                onClick={() => handleOpenForm(c)}
                                                                className="p-1.5 bg-slate-900 border border-slate-800 rounded-lg hover:bg-slate-850 transition-colors"
                                                            >
                                                                <Edit size={13} className="text-slate-400" />
                                                            </button>
                                                            <button 
                                                                title="Eliminar Cliente"
                                                                onClick={() => handleDeleteClient(c.id)}
                                                                className="p-1.5 bg-red-955/20 border border-red-900/30 rounded-lg hover:bg-red-900/20 transition-colors"
                                                            >
                                                                <Trash2 size={13} className="text-red-400" />
                                                            </button>
                                                        </div>

                                                        {/* Mobile/Tablet dropdown menu button */}
                                                        <div className="xl:hidden relative">
                                                            <button
                                                                onClick={() => setActiveActionMenuId(activeActionMenuId === c.id ? null : c.id)}
                                                                className="p-1.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-400 hover:bg-slate-850 transition-colors"
                                                                title="Acciones"
                                                            >
                                                                <MoreVertical size={14} />
                                                            </button>
                                                            {activeActionMenuId === c.id && (
                                                                <>
                                                                    <div className="fixed inset-0 z-10" onClick={() => setActiveActionMenuId(null)}></div>
                                                                    <div className="absolute right-0 mt-1 w-44 bg-slate-950 border border-slate-850 rounded-xl shadow-2xl z-20 p-1 flex flex-col text-xs text-left animate-fade-in">
                                                                        <button
                                                                            onClick={() => { openAccountView(c); setActiveActionMenuId(null); }}
                                                                            className="w-full px-3 py-2 hover:bg-slate-900 rounded-lg flex items-center gap-2 text-emerald-450"
                                                                        >
                                                                            <Landmark size={13} /> Cta. Corriente
                                                                        </button>
                                                                        <button
                                                                            onClick={() => { handleOpenDetail(c); setActiveActionMenuId(null); }}
                                                                            className="w-full px-3 py-2 hover:bg-slate-900 rounded-lg flex items-center gap-2 text-indigo-400"
                                                                        >
                                                                            <FileText size={13} /> Ficha Cliente
                                                                        </button>
                                                                        <button
                                                                            onClick={() => { handleOpenForm(c); setActiveActionMenuId(null); }}
                                                                            className="w-full px-3 py-2 hover:bg-slate-900 rounded-lg flex items-center gap-2 text-slate-300"
                                                                        >
                                                                            <Edit size={13} /> Editar Cliente
                                                                        </button>
                                                                        <button
                                                                            onClick={() => { handleDeleteClient(c.id); setActiveActionMenuId(null); }}
                                                                            className="w-full px-3 py-2 hover:bg-slate-900 rounded-lg flex items-center gap-2 text-red-400 hover:bg-red-950/20"
                                                                        >
                                                                            <Trash2 size={13} /> Eliminar Cliente
                                                                        </button>
                                                                    </div>
                                                                </>
                                                            )}
                                                        </div>
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

            {activeTab === 'accounts' && (
                <div className="space-y-6">
                    {/* General Accounts Filter Bar */}
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-slate-900/40 p-4 rounded-2xl border border-slate-800">
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 w-full lg:max-w-2xl">
                            <div className="relative w-full">
                                <Search size={14} className="absolute left-3 top-3 text-slate-500" />
                                <input
                                    type="text"
                                    value={accSearchQuery}
                                    onChange={(e) => setAccSearchQuery(e.target.value)}
                                    placeholder="Buscar por cliente o CUIT..."
                                    className="w-full bg-slate-955 border border-slate-850 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-105 placeholder-slate-505 outline-none focus:ring-1 focus:ring-indigo-500"
                                />
                            </div>

                            <select
                                value={accFilterDebt}
                                onChange={(e) => setAccFilterDebt(e.target.value as any)}
                                className="w-full bg-slate-955 border border-slate-850 rounded-xl px-3 py-2 text-slate-300 text-xs focus:outline-none"
                            >
                                <option value="all">Filtro Deuda: Todos</option>
                                <option value="debtors">Clientes Deudores (Saldo &gt; 0)</option>
                                <option value="overdue">Con Deuda Vencida en Mora</option>
                                <option value="nodebt">Sin Deuda (Saldo al Día)</option>
                                <option value="active">Clientes Operativos Activos</option>
                            </select>

                            <input
                                type="number"
                                value={accMinMora}
                                onChange={(e) => setAccMinMora(e.target.value)}
                                placeholder="Mora Mínima (días)..."
                                className="w-full bg-slate-955 border border-slate-850 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                        </div>

                        <div className="flex gap-2 w-full lg:w-auto justify-end shrink-0">
                            <Button variant="secondary" size="sm" onClick={printConsolidatedReport} className="flex items-center gap-1 w-full lg:w-auto justify-center">
                                <Printer size={14} /> Reporte Consolidado
                            </Button>
                        </div>
                    </div>

                    {/* Bulk Actions Console */}
                    {selectedBulkIds.length > 0 && (
                        <div className="bg-indigo-950/20 border border-indigo-900/50 p-4 rounded-xl flex flex-col md:flex-row gap-3 items-center justify-between animate-fade-in text-xs">
                            <span className="font-semibold text-indigo-300 text-center md:text-left">
                                {selectedBulkIds.length} clientes seleccionados para acciones masivas
                            </span>
                            <div className="flex flex-wrap gap-2 w-full md:w-auto justify-center md:justify-end">
                                <Button variant="ghost" size="sm" onClick={() => setSelectedBulkIds([])} className="text-slate-400 flex-1 md:flex-none">
                                    Desmarcar todos
                                </Button>
                                <Button variant="secondary" size="sm" onClick={triggerBulkExcel} className="flex items-center gap-1 flex-1 md:flex-none justify-center">
                                    <Download size={13} /> Exportar Excel
                                </Button>
                                <Button variant="primary" size="sm" onClick={triggerBulkEmail} className="flex items-center gap-1 flex-1 md:flex-none justify-center">
                                    <Send size={13} /> Enviar Recordatorios
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Accounts Table List */}
                    <TableContainer>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHeaderCell className="w-8">
                                        <button onClick={toggleSelectAllBulk} className="text-slate-400">
                                            {selectedBulkIds.length === accountsData.length && accountsData.length > 0 ? (
                                                <CheckSquare size={15} className="text-indigo-400" />
                                            ) : (
                                                <Square size={15} />
                                            )}
                                        </button>
                                    </TableHeaderCell>
                                    <TableHeaderCell>Cliente</TableHeaderCell>
                                    <TableHeaderCell>CUIT</TableHeaderCell>
                                    <TableHeaderCell>Saldo Total</TableHeaderCell>
                                    <TableHeaderCell>Deuda Vencida</TableHeaderCell>
                                    <TableHeaderCell>A Vencer</TableHeaderCell>
                                    <TableHeaderCell className="text-center">Score</TableHeaderCell>
                                    <TableHeaderCell className="text-center font-bold">Riesgo Cobro</TableHeaderCell>
                                    <TableHeaderCell className="text-right">Acciones</TableHeaderCell>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {accountsData.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={9} className="text-center py-10 text-slate-500 text-xs italic">
                                            No se encontraron balances que coincidan con los filtros.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    accountsData.map(item => {
                                        const c = item.client;
                                        const s = item.summary;
                                        const isSelected = selectedBulkIds.includes(c.id);

                                        return (
                                            <TableRow key={c.id} className={`hover:bg-slate-900/40 ${isSelected ? 'bg-indigo-950/10' : ''}`}>
                                                <TableCell className="w-8">
                                                    <button onClick={() => toggleSelectBulk(c.id)} className="text-slate-400">
                                                        {isSelected ? (
                                                            <CheckSquare size={15} className="text-indigo-400" />
                                                        ) : (
                                                            <Square size={15} />
                                                        )}
                                                    </button>
                                                </TableCell>
                                                <TableCell className="font-bold text-slate-100">{c.name}</TableCell>
                                                <TableCell className="font-mono-tabular text-xs text-slate-350">{c.cuit}</TableCell>
                                                <TableCell className="font-mono-tabular text-xs text-slate-205 font-bold">
                                                    {formatCurrency(s.saldo)}
                                                </TableCell>
                                                <TableCell className="font-mono-tabular text-xs text-red-400 font-bold">
                                                    {s.vencido > 0 ? formatCurrency(s.vencido) : '-'}
                                                </TableCell>
                                                <TableCell className="font-mono-tabular text-xs text-blue-400 font-medium">
                                                    {s.noVencido > 0 ? formatCurrency(s.noVencido) : '-'}
                                                </TableCell>
                                                <TableCell className="text-center text-xs font-mono font-bold text-indigo-400">
                                                    {s.score}/100
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <LocalBadge variant={
                                                        s.score >= 80 ? 'success' : (s.score >= 50 ? 'warning' : 'danger')
                                                    }>
                                                        {s.riskLevel}
                                                    </LocalBadge>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="relative flex justify-end">
                                                        {/* Desktop buttons (visible on xl screens and up) */}
                                                        <div className="hidden xl:flex justify-end gap-1">
                                                            <button 
                                                                title="Ver Estado de Cuenta"
                                                                onClick={() => openAccountView(c)}
                                                                className="p-1.5 bg-slate-900 border border-slate-800 rounded-lg hover:bg-slate-850 transition-colors"
                                                            >
                                                                <Landmark size={13} className="text-emerald-455" />
                                                            </button>
                                                            <button 
                                                                title="Descargar Reporte PDF"
                                                                onClick={() => printClientAccount(c, 'comercial')}
                                                                className="p-1.5 bg-slate-900 border border-slate-800 rounded-lg hover:bg-slate-850 transition-colors"
                                                            >
                                                                <Printer size={13} className="text-slate-400" />
                                                            </button>
                                                            <button 
                                                                title="Exportar CSV"
                                                                onClick={() => downloadExcelClient(c)}
                                                                className="p-1.5 bg-slate-900 border border-slate-800 rounded-lg hover:bg-slate-855 transition-colors"
                                                            >
                                                                <Download size={13} className="text-slate-400" />
                                                            </button>
                                                            <button 
                                                                title="Enviar por Email"
                                                                onClick={() => openEmail(c)}
                                                                className="p-1.5 bg-slate-900 border border-slate-800 rounded-lg hover:bg-slate-850 transition-colors"
                                                            >
                                                                <Mail size={13} className="text-slate-400" />
                                                            </button>
                                                            <button 
                                                                title="Notificar por WhatsApp"
                                                                onClick={() => openWhatsapp(c)}
                                                                className="p-1.5 bg-slate-900 border border-slate-800 rounded-lg hover:bg-slate-850 transition-colors"
                                                            >
                                                                <MessageSquare size={13} className="text-emerald-455" />
                                                            </button>
                                                        </div>

                                                        {/* Mobile/Tablet actions dropdown */}
                                                        <div className="xl:hidden relative">
                                                            <button
                                                                onClick={() => setActiveAccMenuId(activeAccMenuId === c.id ? null : c.id)}
                                                                className="p-1.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-400 hover:bg-slate-850 transition-colors"
                                                                title="Acciones"
                                                            >
                                                                <MoreVertical size={14} />
                                                            </button>
                                                            {activeAccMenuId === c.id && (
                                                                <>
                                                                    <div className="fixed inset-0 z-10" onClick={() => setActiveAccMenuId(null)}></div>
                                                                    <div className="absolute right-0 mt-1 w-44 bg-slate-950 border border-slate-850 rounded-xl shadow-2xl z-20 p-1 flex flex-col text-xs text-left animate-fade-in">
                                                                        <button
                                                                            onClick={() => { openAccountView(c); setActiveAccMenuId(null); }}
                                                                            className="w-full px-3 py-2 hover:bg-slate-900 rounded-lg flex items-center gap-2 text-emerald-455"
                                                                        >
                                                                            <Landmark size={13} /> Consultar Cta. Cte.
                                                                        </button>
                                                                        <button
                                                                            onClick={() => { printClientAccount(c, 'comercial'); setActiveAccMenuId(null); }}
                                                                            className="w-full px-3 py-2 hover:bg-slate-900 rounded-lg flex items-center gap-2 text-slate-300"
                                                                        >
                                                                            <Printer size={13} /> Descargar PDF
                                                                        </button>
                                                                        <button
                                                                            onClick={() => { downloadExcelClient(c); setActiveAccMenuId(null); }}
                                                                            className="w-full px-3 py-2 hover:bg-slate-900 rounded-lg flex items-center gap-2 text-slate-350"
                                                                        >
                                                                            <Download size={13} /> Exportar CSV
                                                                        </button>
                                                                        <button
                                                                            onClick={() => { openEmail(c); setActiveAccMenuId(null); }}
                                                                            className="w-full px-3 py-2 hover:bg-slate-900 rounded-lg flex items-center gap-2 text-slate-300"
                                                                        >
                                                                            <Mail size={13} /> Enviar por Email
                                                                        </button>
                                                                        <button
                                                                            onClick={() => { openWhatsapp(c); setActiveAccMenuId(null); }}
                                                                            className="w-full px-3 py-2 hover:bg-slate-900 rounded-lg flex items-center gap-2 text-emerald-450"
                                                                        >
                                                                            <MessageSquare size={13} /> Enviar WhatsApp
                                                                        </button>
                                                                    </div>
                                                                </>
                                                            )}
                                                        </div>
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

            {activeTab === 'config' && (
                <Card className="border border-slate-800 bg-slate-900/20">
                    <div className="p-5 border-b border-slate-800 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Settings className="text-indigo-400" size={16} />
                            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-105">Parámetros de Automatización de Cobranzas</h2>
                        </div>
                    </div>
                    <CardContent className="p-5">
                        <form onSubmit={handleSaveConfig} className="space-y-6 text-xs max-w-3xl">
                            
                            {/* Sound Panel Config */}
                            <div className="p-4 bg-slate-950/40 rounded-xl border border-slate-850 space-y-4">
                                <span className="text-[10px] uppercase font-bold text-indigo-400 block tracking-wider">Configuración de Audio y Feedback</span>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <span className="font-semibold text-slate-200 block">Efectos de Sonido del Sistema</span>
                                        <span className="text-[10.5px] text-slate-500">Reproducir tonos discretos al cobrar facturas, registrar promesas de pago o regularizar cuentas.</span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setCobranzaConfig(prev => ({ ...prev, sonidosActivos: !prev.sonidosActivos }))}
                                        className={`p-2 rounded-xl border transition-colors ${
                                            cobranzaConfig.sonidosActivos 
                                                ? 'bg-indigo-950/40 border-indigo-500/30 text-indigo-400' 
                                                : 'bg-slate-900 border-slate-800 text-slate-500'
                                        }`}
                                    >
                                        {cobranzaConfig.sonidosActivos ? <Volume2 size={16} /> : <VolumeX size={16} />}
                                    </button>
                                </div>
                                {cobranzaConfig.sonidosActivos && (
                                    <div className="space-y-1.5">
                                        <div className="flex justify-between text-[11px] text-slate-400">
                                            <span>Volumen de Sonidos</span>
                                            <span>{cobranzaConfig.volumenSonidos}%</span>
                                        </div>
                                        <input
                                            type="range"
                                            min="0"
                                            max="100"
                                            value={cobranzaConfig.volumenSonidos}
                                            onChange={(e) => setCobranzaConfig(prev => ({ ...prev, volumenSonidos: parseInt(e.target.value, 10) }))}
                                            className="w-full accent-indigo-500"
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Automation Config parameters */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10.5px] text-slate-455 uppercase font-bold">Días para aviso preventivo</label>
                                    <input
                                        type="number"
                                        value={cobranzaConfig.diasAvisoVencimiento}
                                        onChange={(e) => setCobranzaConfig(prev => ({ ...prev, diasAvisoVencimiento: parseInt(e.target.value, 10) || 0 }))}
                                        className="w-full bg-slate-955 border border-slate-850 rounded-xl px-3 py-2 text-slate-105"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10.5px] text-slate-455 uppercase font-bold">Monto mínimo para Alerta Prioritaria</label>
                                    <input
                                        type="number"
                                        value={cobranzaConfig.montoMinimoAlerta}
                                        onChange={(e) => setCobranzaConfig(prev => ({ ...prev, montoMinimoAlerta: parseInt(e.target.value, 10) || 0 }))}
                                        className="w-full bg-slate-955 border border-slate-850 rounded-xl px-3 py-2 text-slate-105"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10.5px] text-slate-455 uppercase font-bold">Días para Alerta Crítica</label>
                                    <input
                                        type="number"
                                        value={cobranzaConfig.diasMoraCritica}
                                        onChange={(e) => setCobranzaConfig(prev => ({ ...prev, diasMoraCritica: parseInt(e.target.value, 10) || 0 }))}
                                        className="w-full bg-slate-955 border border-slate-850 rounded-xl px-3 py-2 text-slate-105"
                                    />
                                </div>
                            </div>

                            {/* Multiple Editable Templates Configuration */}
                            <div className="space-y-4 border-t border-slate-800 pt-4">
                                <h3 className="font-bold text-slate-200 text-xs uppercase tracking-wider">Diseño de Plantillas Editables</h3>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Preventivo templates */}
                                    <div className="bg-slate-955/40 p-4 border border-slate-850 rounded-xl space-y-2">
                                        <span className="font-bold text-indigo-400">1. Aviso Preventivo</span>
                                        <textarea
                                            value={cobranzaConfig.plantillaPreventivoWhatsapp}
                                            onChange={(e) => setCobranzaConfig(prev => ({ ...prev, plantillaPreventivoWhatsapp: e.target.value }))}
                                            rows={2}
                                            placeholder="WhatsApp Preventivo..."
                                            className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs"
                                        />
                                        <textarea
                                            value={cobranzaConfig.plantillaPreventivoEmail}
                                            onChange={(e) => setCobranzaConfig(prev => ({ ...prev, plantillaPreventivoEmail: e.target.value }))}
                                            rows={3}
                                            placeholder="Email Preventivo..."
                                            className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs"
                                        />
                                    </div>

                                    {/* Vencido templates */}
                                    <div className="bg-slate-955/40 p-4 border border-slate-850 rounded-xl space-y-2">
                                        <span className="font-bold text-red-400">2. Deuda Vencida</span>
                                        <textarea
                                            value={cobranzaConfig.plantillaDeudaVencidaWhatsapp}
                                            onChange={(e) => setCobranzaConfig(prev => ({ ...prev, plantillaDeudaVencidaWhatsapp: e.target.value }))}
                                            rows={2}
                                            placeholder="WhatsApp Deuda..."
                                            className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs"
                                        />
                                        <textarea
                                            value={cobranzaConfig.plantillaDeudaVencidaEmail}
                                            onChange={(e) => setCobranzaConfig(prev => ({ ...prev, plantillaDeudaVencidaEmail: e.target.value }))}
                                            rows={3}
                                            placeholder="Email Deuda..."
                                            className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs"
                                        />
                                    </div>

                                    {/* Segundo aviso templates */}
                                    <div className="bg-slate-955/40 p-4 border border-slate-850 rounded-xl space-y-2">
                                        <span className="font-bold text-amber-400">3. Segundo Aviso</span>
                                        <textarea
                                            value={cobranzaConfig.plantillaSegundoAvisoWhatsapp}
                                            onChange={(e) => setCobranzaConfig(prev => ({ ...prev, plantillaSegundoAvisoWhatsapp: e.target.value }))}
                                            rows={2}
                                            placeholder="WhatsApp Reclamación..."
                                            className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs"
                                        />
                                        <textarea
                                            value={cobranzaConfig.plantillaSegundoAvisoEmail}
                                            onChange={(e) => setCobranzaConfig(prev => ({ ...prev, plantillaSegundoAvisoEmail: e.target.value }))}
                                            rows={3}
                                            placeholder="Email Reclamación..."
                                            className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs"
                                        />
                                    </div>

                                    {/* Pago recibido templates */}
                                    <div className="bg-slate-955/40 p-4 border border-slate-850 rounded-xl space-y-2">
                                        <span className="font-bold text-emerald-400">4. Confirmación de Pago</span>
                                        <textarea
                                            value={cobranzaConfig.plantillaPagoRecibidoWhatsapp}
                                            onChange={(e) => setCobranzaConfig(prev => ({ ...prev, plantillaPagoRecibidoWhatsapp: e.target.value }))}
                                            rows={2}
                                            placeholder="WhatsApp Confirmación..."
                                            className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs"
                                        />
                                        <textarea
                                            value={cobranzaConfig.plantillaPagoRecibidoEmail}
                                            onChange={(e) => setCobranzaConfig(prev => ({ ...prev, plantillaPagoRecibidoEmail: e.target.value }))}
                                            rows={3}
                                            placeholder="Email Confirmación..."
                                            className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs"
                                        />
                                    </div>
                                </div>
                            </div>

                            <Button type="submit" variant="primary" size="sm" className="flex items-center gap-1">
                                <CheckCircle size={14} /> Guardar Parámetros
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            )}

            {/* Modal: Formulario Cliente */}
            <Modal
                isOpen={isFormOpen}
                onClose={() => setIsFormOpen(false)}
                title={editingClient ? 'Editar Cliente' : 'Agregar Cliente'}
                footer={
                    <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setIsFormOpen(false)}>
                            Cancelar
                        </Button>
                        <Button variant="primary" size="sm" onClick={handleSaveClientForm}>
                            Guardar Cliente
                        </Button>
                    </div>
                }
            >
                <form className="space-y-4" onSubmit={handleSaveClientForm}>
                    <Input
                        label="Nombre / Razón Social *"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        placeholder="Ej: Imprenta Rápida S.A."
                    />
                    <Input
                        label="CUIT / CUIL *"
                        value={cuit}
                        onChange={(e) => setCuit(e.target.value)}
                        required
                        placeholder="Ej: 30-12345678-9"
                    />
                    <Select
                        label="Categoría Fiscal"
                        value={taxCategory}
                        onChange={(e) => setTaxCategory(e.target.value as any)}
                        options={[
                            { value: 'Responsable Inscripto', label: 'Responsable Inscripto' },
                            { value: 'Monotributista', label: 'Monotributista' },
                            { value: 'Exento', label: 'Exento' }
                        ]}
                    />
                    <Input
                        label="Dirección de Instalación"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        placeholder="Ej: Av. Rivadavia 4500, CABA"
                    />
                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            label="Teléfono de Contacto"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="Ej: 11 5555-1234"
                        />
                        <Input
                            label="Email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="Ej: contacto@empresa.com"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            label="Deuda Inicial ($)"
                            type="number"
                            value={debt}
                            onChange={(e) => setDebt(e.target.value)}
                            placeholder="0"
                        />
                        <Select
                            label="Estado Operativo"
                            value={isActive ? 'true' : 'false'}
                            onChange={(e) => setIsActive(e.target.value === 'true')}
                            options={[
                                { value: 'true', label: 'ACTIVO' },
                                { value: 'false', label: 'INACTIVO' }
                            ]}
                        />
                    </div>

                    {formError && (
                        <p className="text-red-500 text-[10px] font-bold mt-1 bg-red-500/10 p-2.5 rounded-lg border border-red-500/20">{formError}</p>
                    )}
                </form>
            </Modal>

            {/* Modal: Detalle de Cliente / Ficha Completa */}
            <Modal
                isOpen={isDetailOpen}
                onClose={() => setIsDetailOpen(false)}
                title="Ficha del Cliente"
                footer={
                    <div className="flex flex-col sm:flex-row gap-2 justify-between w-full">
                        {selectedClient && (
                            <Button 
                                variant="primary" 
                                size="sm" 
                                onClick={() => {
                                    setIsDetailOpen(false);
                                    openAccountView(selectedClient);
                                }}
                                className="flex items-center gap-1 w-full sm:w-auto justify-center"
                            >
                                <Landmark size={13} /> Ver Estado de Cuenta
                            </Button>
                        )}
                        <Button variant="secondary" size="sm" onClick={() => setIsDetailOpen(false)} className="w-full sm:w-auto mt-2 sm:mt-0 justify-center">
                            Cerrar Ficha
                        </Button>
                    </div>
                }
            >
                {selectedClient && (
                    <div className="space-y-6 max-h-[75vh] overflow-y-auto pr-2">
                        
                        {/* Header Ficha */}
                        <div className="border-b border-slate-800 pb-4 flex justify-between items-start">
                            <div>
                                <h4 className="text-base font-bold text-slate-100">{selectedClient.name}</h4>
                                <p className="text-xs text-slate-400 mt-1">CUIT: {selectedClient.cuit} | Categoría: {selectedClient.taxCategory}</p>
                            </div>
                            <LocalBadge variant={selectedClient.active !== false ? 'success' : 'danger'}>
                                {selectedClient.active !== false ? 'ACTIVO' : 'INACTIVO'}
                            </LocalBadge>
                        </div>

                        {/* Detalle Datos */}
                        <div className="grid grid-cols-2 gap-4 text-xs">
                            <div>
                                <span className="text-slate-500 font-bold block">CONTACTO</span>
                                <span className="text-slate-300 block mt-1">{selectedClient.phone || 'Sin teléfono'}</span>
                                <span className="text-slate-400 block">{selectedClient.email || 'Sin correo electrónico'}</span>
                            </div>
                            <div>
                                <span className="text-slate-550 font-bold block">DIRECCIÓN</span>
                                <span className="text-slate-300 block mt-1">{selectedClient.address || 'Sin dirección registrada'}</span>
                            </div>
                        </div>

                        {/* Tabs Nav */}
                        <div className="flex gap-2 border-b border-slate-800 pb-1 pt-2">
                            <button
                                onClick={() => setDetailTab('machines')}
                                className={`px-3 py-1 text-xs font-semibold rounded-t-lg transition-all ${
                                    detailTab === 'machines' 
                                        ? 'border-b-2 border-indigo-500 text-indigo-400 font-bold' 
                                        : 'text-slate-500'
                                }`}
                            >
                                Máquinas Alquiladas
                            </button>
                            <button
                                onClick={() => setDetailTab('invoices')}
                                className={`px-3 py-1 text-xs font-semibold rounded-t-lg transition-all ${
                                    detailTab === 'invoices' 
                                        ? 'border-b-2 border-indigo-500 text-indigo-400 font-bold' 
                                        : 'text-slate-500'
                                }`}
                            >
                                Historial de Facturas
                            </button>
                        </div>

                        {/* TAB 1: MÁQUINAS */}
                        {detailTab === 'machines' && (
                            <div className="space-y-2">
                                {rentals.filter(r => r.clientId === selectedClient.id).length === 0 ? (
                                    <p className="text-xs text-slate-500 italic py-4">Sin alquileres registrados.</p>
                                ) : (
                                    rentals.filter(r => r.clientId === selectedClient.id).map(r => {
                                        const m = machines.find(mach => mach.id === r.machineId);
                                        const ab = abonos.find(a => a.id === r.abonoId);
                                        return (
                                            <div key={r.id} className="p-3 bg-slate-955 border border-slate-850 rounded-xl text-xs flex justify-between items-center">
                                                <div>
                                                    <span className="font-bold text-slate-205 block">{m ? `${m.brand} ${m.model}` : 'Equipo de Alquiler'}</span>
                                                    <span className="text-[10px] text-slate-500 block">
                                                        S/N: {m ? m.serial : 'N/A'} | Inicio: {r.startDate} {r.endDate ? `| Fin: ${r.endDate}` : ''}
                                                    </span>
                                                    <span className="text-[10px] text-indigo-400 font-medium mt-1 block">Plan: {ab ? ab.name : 'Abono no asignado'}</span>
                                                </div>
                                                <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase ${
                                                    r.status === 'activo' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-500/10 text-slate-400 border border-slate-800'
                                                }`}>
                                                    {r.status}
                                                </span>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        )}

                        {/* TAB 2: HISTORIAL FACTURACIÓN */}
                        {detailTab === 'invoices' && (
                            <div className="space-y-3">
                                {readings.filter(r => {
                                    const mach = machines.find(m => m.id === r.machineId);
                                    return mach && mach.clientId === selectedClient.id;
                                }).length === 0 ? (
                                    <p className="text-xs text-slate-500 italic py-4">Sin facturas liquidadas registradas.</p>
                                ) : (
                                    <div className="space-y-2">
                                        {readings.filter(r => {
                                            const mach = machines.find(m => m.id === r.machineId);
                                            return mach && mach.clientId === selectedClient.id;
                                        }).sort((a,b) => b.month.localeCompare(a.month)).map(r => {
                                            const mach = machines.find(m => m.id === r.machineId);
                                            return (
                                                <div key={r.id} className="p-3 bg-slate-955 border border-slate-850 rounded-xl text-xs flex justify-between items-center">
                                                    <div>
                                                        <span className="font-bold text-slate-200 block">{formatPeriod(r.month)}</span>
                                                        <span className="text-[10px] text-slate-500 block">
                                                            {mach ? `${mach.brand} ${mach.model}` : 'Equipo N/A'} (Lectura: {r.initial.toLocaleString()} a {r.final.toLocaleString()})
                                                        </span>
                                                    </div>
                                                    <div className="text-right space-y-1">
                                                        <span className="font-bold text-slate-200 block font-mono-tabular">{formatCurrency(r.totalAmount)}</span>
                                                        <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase ${
                                                            r.status === 'paid' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                                                        }`}>
                                                            {r.status === 'paid' ? 'PAGADO' : 'PENDIENTE'}
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}

                    </div>
                )}
            </Modal>

            {/* Modal: ESTADO DE CUENTA DETALLADO */}
            <Modal
                isOpen={isAccountOpen}
                onClose={() => setIsAccountOpen(false)}
                title="Consola de Cuenta Corriente Individual"
                footer={
                    <div className="flex flex-col sm:flex-row gap-3 justify-between items-center w-full border-t border-slate-800 pt-3 mt-1">
                        {/* Selector for double PDF versions */}
                        <div className="flex items-center justify-between sm:justify-start gap-2 text-xs w-full sm:w-auto">
                            <span className="text-slate-400">Versión:</span>
                            <select
                                value={pdfVersion}
                                onChange={(e) => setPdfVersion(e.target.value as any)}
                                className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-indigo-400 font-bold"
                            >
                                <option value="comercial">Cliente (Comercial)</option>
                                <option value="interna">Interna (Auditoría)</option>
                            </select>
                        </div>
                        <div className="flex gap-2 w-full sm:w-auto justify-end">
                            {accountClient && (
                                <>
                                    <Button variant="secondary" size="sm" onClick={() => printClientAccount(accountClient, pdfVersion)} className="flex items-center gap-1 text-[11px] h-8 flex-1 sm:flex-initial justify-center">
                                        <Printer size={13} /> PDF
                                    </Button>
                                    <Button variant="secondary" size="sm" onClick={() => downloadExcelClient(accountClient)} className="flex items-center gap-1 text-[11px] h-8 flex-1 sm:flex-initial justify-center">
                                        <Download size={13} /> CSV
                                    </Button>
                                </>
                            )}
                            <Button variant="ghost" size="sm" onClick={() => setIsAccountOpen(false)} className="h-8 flex-1 sm:flex-initial justify-center">
                                Cerrar
                            </Button>
                        </div>
                    </div>
                }
            >
                {accountClient && (() => {
                    const s = getClientFinancialSummary(accountClient);
                    const list = getFilteredMovements();
                    const clientGestiones = (gestiones || []).filter(g => g.clientId === accountClient.id);
                    const paymentHistory = list.filter(m => m.type === 'Recibo');

                    // Calculate period subtotals
                    const subtotalFacturado = list.reduce((acc, m) => (m.type === 'Factura' || m.type === 'Ajuste') ? acc + m.original : acc, 0);
                    const subtotalCobrado = list.reduce((acc, m) => (m.type === 'Factura' || m.type === 'Ajuste') ? acc + m.paid : acc, 0);
                    const subtotalSaldoNeto = list.reduce((acc, m) => (m.type === 'Factura' || m.type === 'Ajuste') ? acc + m.pending : acc, 0);

                    return (
                        <div className="space-y-4 max-h-[72vh] overflow-y-auto pr-1 text-slate-105">
                            
                            {/* Modal Header KPI and Risk Score Card */}
                            <div className="bg-slate-955/40 p-4 border border-slate-850 rounded-2xl flex flex-wrap gap-4 justify-between items-center">
                                <div>
                                    <h4 className="text-sm font-bold text-slate-100">{accountClient.name}</h4>
                                    <span className="text-[10px] text-slate-500">CUIT: {accountClient.cuit} | Condición: {accountClient.taxCategory}</span>
                                </div>
                                <div className="flex flex-wrap gap-4 items-center">
                                    <div className="text-right">
                                        <span className="text-[9px] uppercase font-bold text-slate-500 block font-bold">Score Cobros</span>
                                        <span className="text-sm font-extrabold text-indigo-400 font-mono">{s.score}/100</span>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-[9px] uppercase font-bold text-slate-500 block font-bold">Riesgo Financiero</span>
                                        <LocalBadge variant={
                                            s.score >= 80 ? 'success' : (s.score >= 50 ? 'warning' : 'danger')
                                        }>
                                            {s.riskLevel}
                                        </LocalBadge>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-[9px] uppercase font-bold text-slate-500 block font-bold">Promedio de Pago</span>
                                        <span className="text-xs font-bold text-slate-202">{s.avgPayDays} días</span>
                                    </div>
                                </div>
                            </div>

                            {/* Modal Internal Tabs */}
                            <div className="flex flex-wrap gap-1 border-b border-slate-800 pb-1">
                                <button
                                    onClick={() => setAccountModalTab('movements')}
                                    className={`flex-1 sm:flex-none text-center justify-center px-3 py-1.5 text-xs font-semibold rounded-t-lg transition-all ${
                                        accountModalTab === 'movements' 
                                            ? 'border-b-2 border-indigo-500 text-indigo-400 font-bold' 
                                            : 'text-slate-500 hover:text-slate-400'
                                    }`}
                                >
                                    Movimientos y Ledger
                                </button>
                                <button
                                    onClick={() => setAccountModalTab('history')}
                                    className={`flex-1 sm:flex-none text-center justify-center px-3 py-1.5 text-xs font-semibold rounded-t-lg transition-all flex items-center gap-1.5 ${
                                        accountModalTab === 'history' 
                                            ? 'border-b-2 border-indigo-500 text-indigo-400 font-bold' 
                                            : 'text-slate-500 hover:text-slate-400'
                                    }`}
                                >
                                    <History size={12} /> Seguimiento y Gestiones ({clientGestiones.length})
                                </button>
                                <button
                                    onClick={() => setAccountModalTab('payments')}
                                    className={`flex-1 sm:flex-none text-center justify-center px-3 py-1.5 text-xs font-semibold rounded-t-lg transition-all flex items-center gap-1.5 ${
                                        accountModalTab === 'payments' 
                                            ? 'border-b-2 border-indigo-500 text-indigo-400 font-bold' 
                                            : 'text-slate-500 hover:text-slate-400'
                                    }`}
                                >
                                    <CreditCard size={12} /> Historial Pagos ({paymentHistory.length})
                                </button>
                                <button
                                    onClick={() => setAccountModalTab('notes')}
                                    className={`flex-1 sm:flex-none text-center justify-center px-3 py-1.5 text-xs font-semibold rounded-t-lg transition-all flex items-center gap-1.5 ${
                                        accountModalTab === 'notes' 
                                            ? 'border-b-2 border-indigo-500 text-indigo-400 font-bold' 
                                            : 'text-slate-500 hover:text-slate-400'
                                    }`}
                                >
                                    <FileText size={12} /> Notas Internas
                                </button>
                            </div>

                            {/* TAB 1: MOVIMIENTOS Y LEDGER */}
                            {accountModalTab === 'movements' && (
                                <div className="space-y-4">
                                    {/* Balance summary indicators */}
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        <div className="bg-slate-955 p-3 rounded-xl border border-slate-850">
                                            <span className="text-[10px] uppercase font-bold text-slate-550 block">Saldo General</span>
                                            <span className="text-base font-extrabold text-slate-100 block mt-1 font-mono-tabular">
                                                {formatCurrency(s.saldo)}
                                            </span>
                                        </div>
                                        <div className="bg-slate-955 p-3 rounded-xl border border-slate-850">
                                            <span className="text-[10px] uppercase font-bold text-red-400 block">Deuda Vencida Mora</span>
                                            <span className="text-base font-extrabold text-red-400 block mt-1 font-mono-tabular">
                                                {formatCurrency(s.vencido)}
                                            </span>
                                        </div>
                                        <div className="bg-slate-955 p-3 rounded-xl border border-slate-850">
                                            <span className="text-[10px] uppercase font-bold text-blue-400 block">A Vencer Plazo</span>
                                            <span className="text-base font-extrabold text-blue-400 block mt-1 font-mono-tabular">
                                                {formatCurrency(s.noVencido)}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Action sugerida quick action block */}
                                    {s.saldo > 0 && (
                                        <div className="bg-amber-955/15 border border-amber-900/35 p-3 rounded-xl flex flex-col sm:flex-row gap-3 items-center justify-between">
                                            <div className="flex items-center gap-1.5 text-amber-400 font-bold text-xs">
                                                <TrendingUp size={13} />
                                                <span>Acción Sugerida de Cobro</span>
                                            </div>
                                            <div className="flex flex-wrap gap-1.5 justify-center sm:justify-end text-[10px] w-full sm:w-auto">
                                                <Button variant="secondary" size="sm" onClick={() => handleQuickAction(accountClient, 'whatsapp')} className="h-6 px-2 flex-1 sm:flex-none">
                                                    WhatsApp
                                                </Button>
                                                <Button variant="secondary" size="sm" onClick={() => handleQuickAction(accountClient, 'email')} className="h-6 px-2 flex-1 sm:flex-none">
                                                    Email
                                                </Button>
                                                <Button variant="secondary" size="sm" onClick={() => handleQuickAction(accountClient, 'llamado')} className="h-6 px-2 flex-1 sm:flex-none">
                                                    Registrar Llamada
                                                </Button>
                                                <Button variant="secondary" size="sm" onClick={() => handleQuickAction(accountClient, 'promesa')} className="h-6 px-2 flex-1 sm:flex-none">
                                                    Promesa Pago
                                                </Button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Filters Bar inside Modal */}
                                    <div className="flex flex-col md:flex-row gap-3 items-start md:items-center justify-between border-t border-slate-850 pt-3 text-xs">
                                        <div className="flex flex-wrap gap-1.5 items-center w-full md:w-auto">
                                            <button
                                                onClick={() => setAccountFilter('all')}
                                                className={`flex-1 md:flex-none px-2.5 py-1 rounded-lg border font-semibold ${
                                                    accountFilter === 'all' ? 'bg-indigo-650 text-white font-bold' : 'bg-slate-900 border-slate-800 text-slate-400'
                                                }`}
                                            >
                                                Todos
                                            </button>
                                            <button
                                                onClick={() => setAccountFilter('pending')}
                                                className={`flex-1 md:flex-none px-2.5 py-1 rounded-lg border font-semibold ${
                                                    accountFilter === 'pending' ? 'bg-indigo-650 text-white font-bold' : 'bg-slate-900 border-slate-800 text-slate-400'
                                                }`}
                                            >
                                                Pendientes
                                            </button>
                                            <button
                                                onClick={() => setAccountFilter('overdue')}
                                                className={`flex-1 md:flex-none px-2.5 py-1 rounded-lg border font-semibold ${
                                                    accountFilter === 'overdue' ? 'bg-indigo-655 text-white font-bold' : 'bg-slate-900 border-slate-800 text-slate-400'
                                                }`}
                                            >
                                                Vencidos
                                            </button>
                                        </div>

                                        {/* Monthly periods filter */}
                                        <div className="flex flex-wrap gap-2 items-center text-[11px] w-full md:w-auto justify-between md:justify-end">
                                            <span className="text-slate-500 font-bold">RANGO MESES:</span>
                                            <div className="flex items-center gap-1">
                                                <input
                                                    type="month"
                                                    value={filterStartMonth}
                                                    onChange={(e) => setFilterStartMonth(e.target.value)}
                                                    className="bg-slate-900 border border-slate-800 rounded px-1.5 py-0.5 text-xs text-slate-205 focus:outline-none"
                                                    title="Mes Inicio"
                                                />
                                                <span className="text-slate-650">a</span>
                                                <input
                                                    type="month"
                                                    value={filterEndMonth}
                                                    onChange={(e) => setFilterEndMonth(e.target.value)}
                                                    className="bg-slate-900 border border-slate-800 rounded px-1.5 py-0.5 text-xs text-slate-205 focus:outline-none"
                                                    title="Mes Fin"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Ledger movements list */}
                                    <div className="border border-slate-855 rounded-xl overflow-hidden">
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left text-xs divide-y divide-slate-855 min-w-[850px]">
                                                <thead className="bg-slate-900/60 font-bold text-slate-400 uppercase tracking-wider text-[9px]">
                                                    <tr>
                                                        <th className="px-4 py-2.5 cursor-pointer" onClick={() => toggleAccountSort('date')}>
                                                            Fecha {accountSortKey === 'date' ? (accountSortOrder === 'asc' ? '▲' : '▼') : ''}
                                                        </th>
                                                    <th className="px-4 py-2.5">Tipo</th>
                                                    <th className="px-4 py-2.5">Número</th>
                                                    <th className="px-4 py-2.5">Detalle / Concepto</th>
                                                    <th className="px-4 py-2.5 text-right cursor-pointer" onClick={() => toggleAccountSort('original')}>
                                                        Importe {accountSortKey === 'original' ? (accountSortOrder === 'asc' ? '▲' : '▼') : ''}
                                                    </th>
                                                    <th className="px-4 py-2.5 text-right cursor-pointer" onClick={() => toggleAccountSort('pending')}>
                                                        Pendiente {accountSortKey === 'pending' ? (accountSortOrder === 'asc' ? '▲' : '▼') : ''}
                                                    </th>
                                                    <th className="px-4 py-2.5">Vto.</th>
                                                    <th className="px-4 py-2.5 text-center">Estado</th>
                                                    <th className="px-4 py-2.5 text-right">Acción</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-855 bg-slate-950/20">
                                                {list.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={9} className="text-center py-6 text-slate-500 italic">
                                                            No se registran comprobantes en el rango seleccionado.
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    list.map((m, idx) => (
                                                        <tr key={m.id || idx} className="hover:bg-slate-900/20">
                                                            <td className="px-4 py-2.5 font-mono-tabular">{m.date}</td>
                                                            <td className="px-4 py-2.5 font-bold">{m.type}</td>
                                                            <td className="px-4 py-2.5 font-mono-tabular text-slate-405">{m.number}</td>
                                                            <td className="px-4 py-2.5">
                                                                <span className="block font-semibold text-slate-200">{m.concept}</span>
                                                            </td>
                                                            <td className="px-4 py-2.5 text-right font-mono-tabular">{formatCurrency(m.original)}</td>
                                                            <td className="px-4 py-2.5 text-right font-mono-tabular font-bold text-slate-100">
                                                                {m.pending > 0 ? formatCurrency(m.pending) : '-'}
                                                            </td>
                                                            <td className="px-4 py-2.5 font-mono-tabular text-slate-400">
                                                                {m.dueDate || '-'}
                                                                {m.pending > 0 && m.daysOverdue > 0 && (
                                                                    <span className="block text-[10px] text-red-400 font-bold">({m.daysOverdue} d. atraso)</span>
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-2.5 text-center">
                                                                <LocalBadge variant={
                                                                    m.status === 'Pagado' ? 'success' : 
                                                                    (m.status === 'Vencido' ? 'danger' : 'warning')
                                                                }>
                                                                    {m.status}
                                                                </LocalBadge>
                                                            </td>
                                                            <td className="px-4 py-2.5 text-right">
                                                                {m.pending > 0 && (m.type === 'Factura' || m.type === 'Ajuste') && (
                                                                    <Button 
                                                                        variant="ghost" 
                                                                        size="sm" 
                                                                        onClick={() => handleCollectInvoice(accountClient, m)}
                                                                        className="text-emerald-450 hover:bg-emerald-950/20 h-6 px-1.5 text-[10.5px]"
                                                                    >
                                                                        Registrar Cobro
                                                                    </Button>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                            
                                            {/* Subtotales del Período */}
                                            {list.length > 0 && (
                                                <tfoot className="bg-slate-900/40 border-t-2 border-slate-800 font-bold text-slate-300">
                                                    <tr>
                                                        <td colSpan={4} className="px-4 py-2 text-right text-[10px] uppercase tracking-wider">Subtotales del Período:</td>
                                                        <td className="px-4 py-2 text-right font-mono text-slate-205">{formatCurrency(subtotalFacturado)}</td>
                                                        <td className="px-4 py-2 text-right font-mono text-red-400">{formatCurrency(subtotalSaldoNeto)}</td>
                                                        <td colSpan={3} className="px-4 py-2 text-left text-[10px] text-slate-500 italic">
                                                            Cobrado en Período: {formatCurrency(subtotalCobrado)}
                                                        </td>
                                                    </tr>
                                                </tfoot>
                                            )}
                                        </table>
                                    </div>
                                </div>
                                </div>
                            )}

                            {/* TAB 2: HISTORIAL DE GESTIONES */}
                            {accountModalTab === 'history' && (
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center">
                                        <span className="font-bold text-slate-350">Acciones de Cobranza Registradas</span>
                                        <Button variant="primary" size="sm" onClick={() => setIsNewGestionOpen(true)} className="flex items-center gap-1 h-7 text-xs">
                                            <Plus size={13} /> Nueva Gestión
                                        </Button>
                                    </div>

                                    {/* Register Gestion Sub-Form */}
                                    {isNewGestionOpen && (
                                        <form onSubmit={handleRegisterGestionSubmit} className="bg-slate-955/50 p-4 border border-slate-850 rounded-xl space-y-3 animate-fade-in text-xs">
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                                <div className="space-y-1">
                                                    <label className="text-[10px] uppercase font-bold text-slate-500 block">Tipo Acción</label>
                                                    <select
                                                        value={newGestionType}
                                                        onChange={(e) => setNewGestionType(e.target.value as any)}
                                                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-slate-200"
                                                    >
                                                        <option value="WhatsApp">WhatsApp</option>
                                                        <option value="Email">Email</option>
                                                        <option value="Llamado">Llamado telefónico</option>
                                                        <option value="Promesa de pago">Promesa de pago</option>
                                                        <option value="Pago registrado">Pago registrado</option>
                                                    </select>
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[10px] uppercase font-bold text-slate-500 block">Canal / Medio</label>
                                                    <input
                                                        type="text"
                                                        value={newGestionChannel}
                                                        onChange={(e) => setNewGestionChannel(e.target.value)}
                                                        placeholder="Celular, Oficina..."
                                                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-slate-200"
                                                        required
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[10px] uppercase font-bold text-slate-500 block">Resultado</label>
                                                    <input
                                                        type="text"
                                                        value={newGestionResult}
                                                        onChange={(e) => setNewGestionResult(e.target.value)}
                                                        placeholder="Compromiso, Enviado..."
                                                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-slate-200"
                                                        required
                                                    />
                                                </div>
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[10px] uppercase font-bold text-slate-500 block">Observaciones</label>
                                                <textarea
                                                    value={newGestionObs}
                                                    onChange={(e) => setNewGestionObs(e.target.value)}
                                                    rows={2}
                                                    placeholder="Comentarios adicionales..."
                                                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-slate-200"
                                                    required
                                                />
                                            </div>
                                            <div className="flex gap-2 justify-end pt-1">
                                                <Button type="button" variant="ghost" size="sm" onClick={() => setIsNewGestionOpen(false)}>
                                                    Cancelar
                                                </Button>
                                                <Button type="submit" variant="primary" size="sm">
                                                    Registrar Acción
                                                </Button>
                                            </div>
                                        </form>
                                    )}

                                    {/* History list */}
                                    <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
                                        {clientGestiones.length === 0 ? (
                                            <p className="text-center py-6 text-slate-500 italic text-xs">
                                                No hay logs de gestiones de cobro asociados.
                                            </p>
                                        ) : (
                                            clientGestiones.map(g => (
                                                <div key={g.id} className="p-3 bg-slate-950/40 border border-slate-850 rounded-xl text-xs space-y-1 hover:bg-slate-900/20">
                                                    <div className="flex justify-between items-center font-bold">
                                                        <span className="text-indigo-400">{g.type}</span>
                                                        <span className="text-[10px] text-slate-500">{g.date}</span>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-400">
                                                        <span>Medio: {g.channel}</span>
                                                        <span>Resultado: {g.result}</span>
                                                    </div>
                                                    <p className="text-[11px] text-slate-300 mt-1">"{g.observations}"</p>
                                                    <span className="text-[9px] text-slate-550 block text-right">Por: {g.user}</span>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* TAB 3: HISTORIAL DE PAGOS RECIBIDOS (RECIBOS) */}
                            {accountModalTab === 'payments' && (
                                <div className="space-y-4">
                                    <span className="font-bold text-slate-350 block">Registro de Pagos e Ingresos Acreditados</span>
                                    <div className="border border-slate-855 rounded-xl overflow-hidden">
                                        <table className="w-full text-left text-xs divide-y divide-slate-855">
                                            <thead className="bg-slate-900/60 font-bold text-slate-400 uppercase tracking-wider text-[9px]">
                                                <tr>
                                                    <th className="px-4 py-2.5">Fecha</th>
                                                    <th className="px-4 py-2.5">Comprobante Recibo</th>
                                                    <th className="px-4 py-2.5">Concepto Liquidado</th>
                                                    <th className="px-4 py-2.5 text-right">Importe Cobrado</th>
                                                    <th className="px-4 py-2.5">Medio de Pago</th>
                                                    <th className="px-4 py-2.5">Estado</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-855 bg-slate-950/20">
                                                {paymentHistory.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={6} className="text-center py-6 text-slate-500 italic">
                                                            No se registran ingresos o recibos cobrados para este cliente.
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    paymentHistory.map((p, idx) => (
                                                        <tr key={p.id || idx} className="hover:bg-slate-900/20">
                                                            <td className="px-4 py-2.5 font-mono-tabular">{p.date}</td>
                                                            <td className="px-4 py-2.5 font-mono-tabular text-emerald-400 font-bold">{p.number}</td>
                                                            <td className="px-4 py-2.5 text-slate-300">{p.concept}</td>
                                                            <td className="px-4 py-2.5 text-right font-mono-tabular font-bold text-emerald-450">{formatCurrency(p.original)}</td>
                                                            <td className="px-4 py-2.5 text-slate-400">{p.notes || 'Transferencia Bancaria'}</td>
                                                            <td className="px-4 py-2.5">
                                                                <LocalBadge variant="success">Acreditado</LocalBadge>
                                                            </td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* TAB 4: NOTAS INTERNAS */}
                            {accountModalTab === 'notes' && (
                                <div className="space-y-4">
                                    <div className="space-y-1.5">
                                        <label className="text-xs uppercase font-bold text-slate-400 block">Observaciones y Acuerdos Comerciales Internos</label>
                                        <textarea
                                            value={tempInternalNotes}
                                            onChange={(e) => setTempInternalNotes(e.target.value)}
                                            rows={5}
                                            placeholder="Registrar promesas de pago excepcionales, convenios comerciales, particularidades del cliente, etc. Solo visible para usuarios administrativos."
                                            className="w-full bg-slate-955 border border-slate-850 rounded-xl p-3 text-xs text-slate-205 outline-none focus:ring-1 focus:ring-indigo-500"
                                        />
                                        <span className="text-[10px] text-slate-550 block italic">Estas notas se incluirán únicamente en el Estado de Cuenta versión Interna de Administración.</span>
                                    </div>
                                    <Button variant="primary" size="sm" onClick={handleSaveInternalNotes} className="flex items-center gap-1 h-8">
                                        <CheckCircle size={14} /> Guardar Notas Internas
                                    </Button>
                                </div>
                            )}

                        </div>
                    );
                })()}
            </Modal>

            {/* Modal: ENVIAR EMAIL */}
            <Modal
                isOpen={isEmailModalOpen}
                onClose={() => setIsEmailModalOpen(false)}
                title="Redactar Correo de Cobranza"
                footer={
                    <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setIsEmailModalOpen(false)}>
                            Cancelar
                        </Button>
                        <Button variant="primary" size="sm" onClick={sendEmail} className="flex items-center gap-1">
                            <Send size={13} /> Lanzar Correo
                        </Button>
                    </div>
                }
            >
                {emailTarget && (
                    <div className="space-y-4 text-xs text-slate-350">
                        {/* Template selector */}
                        <div className="space-y-1">
                            <label className="text-[10px] uppercase font-bold text-slate-400 block font-bold">Seleccionar Plantilla</label>
                            <select
                                value={emailTemplateType}
                                onChange={(e) => handleEmailTemplateChange(e.target.value as any)}
                                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-slate-200"
                            >
                                <option value="preventivo">Aviso Preventivo</option>
                                <option value="vencido">Deuda Vencida</option>
                                <option value="segundo">Segundo Aviso (Mora)</option>
                                <option value="pago">Confirmación Pago Recibido</option>
                            </select>
                        </div>

                        <Input
                            label="Para *"
                            value={emailTo}
                            onChange={(e) => setEmailTo(e.target.value)}
                            required
                        />
                        <Input
                            label="Asunto *"
                            value={emailSubject}
                            onChange={(e) => setEmailSubject(e.target.value)}
                            required
                        />
                        <div className="space-y-1">
                            <label className="text-[10px] uppercase font-bold text-slate-500 block font-bold">Cuerpo del Correo</label>
                            <textarea
                                value={emailBody}
                                onChange={(e) => setEmailBody(e.target.value)}
                                rows={6}
                                className="w-full bg-slate-955 border border-slate-850 rounded-xl px-3 py-2 text-xs text-slate-205 outline-none"
                            />
                        </div>
                        <div className="p-3 bg-slate-955 border border-slate-850 rounded-xl flex justify-between items-center">
                            <span className="font-semibold text-slate-300 font-bold">📄 Adjunto generado automáticamente:</span>
                            <LocalBadge variant="info">EstadoCuenta_${emailTarget.name.replace(/ /g, '_')}.pdf</LocalBadge>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Modal: ENVIAR WHATSAPP */}
            <Modal
                isOpen={isWhatsappModalOpen}
                onClose={() => setIsWhatsappModalOpen(false)}
                title="Enviar Notificación por WhatsApp"
                footer={
                    <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setIsWhatsappModalOpen(false)}>
                            Cancelar
                        </Button>
                        <Button variant="primary" size="sm" onClick={sendWhatsapp} className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-500 border-emerald-700">
                            <MessageSquare size={13} /> Abrir WhatsApp
                        </Button>
                    </div>
                }
            >
                {whatsappTarget && (
                    <div className="space-y-4 text-xs text-slate-355">
                        {/* Template selector */}
                        <div className="space-y-1">
                            <label className="text-[10px] uppercase font-bold text-slate-400 block font-bold">Seleccionar Plantilla WhatsApp</label>
                            <select
                                value={whatsappTemplateType}
                                onChange={(e) => handleWhatsappTemplateChange(e.target.value as any)}
                                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-slate-200"
                            >
                                <option value="preventivo">Aviso Preventivo</option>
                                <option value="vencido">Deuda Vencida</option>
                                <option value="segundo">Segundo Aviso (Mora)</option>
                                <option value="pago">Confirmación Pago Recibido</option>
                            </select>
                        </div>

                        <Input
                            label="Número de Teléfono *"
                            value={whatsappPhone}
                            onChange={(e) => setWhatsappPhone(e.target.value)}
                            required
                            placeholder="Ej: 5491155551234"
                        />
                        <div className="space-y-1">
                            <label className="text-[10px] uppercase font-bold text-slate-500 block font-bold">Mensaje Pre-cargado *</label>
                            <textarea
                                value={whatsappText}
                                onChange={(e) => setWhatsappText(e.target.value)}
                                rows={5}
                                className="w-full bg-slate-955 border border-slate-850 rounded-xl px-3.5 py-2 text-xs text-slate-205 outline-none"
                            />
                        </div>
                    </div>
                )}
            </Modal>

        </div>
    );
}
