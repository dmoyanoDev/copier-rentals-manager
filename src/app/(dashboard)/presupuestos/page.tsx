'use client';

import React, { useState, useEffect } from 'react';
import { useManagement } from '@/lib/context';
import { TableContainer, Table, TableHeader, TableRow, TableHeaderCell, TableBody, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Modal } from '@/components/ui/modal';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { formatCurrency, formatPeriod } from '@/lib/utils';
import { calculateBudget } from '@/domain/budget/calculations';
import { 
    Plus, Trash2, Edit, Eye, X, Printer, Download, Mail, Send, Copy, 
    FileText, User, Wrench, Shield, Check, Smartphone, CheckSquare, Settings
} from 'lucide-react';
import { Budget, BudgetClientSnapshot, BudgetItem, BudgetMachineConfig, BudgetTemplate, MachinePreset, TaxMode, DiscountType } from '@/domain/budget/types';

export default function PresupuestosPage() {
    const { 
        clients, 
        setClients, 
        machines,
        abonos,
        budgets, 
        setBudgets, 
        templates, 
        setTemplates, 
        machinePresets, 
        setMachinePresets,
        currentUser
    } = useManagement();

    const [activeTab, setActiveTab] = useState<'list' | 'create' | 'presets' | 'templates'>('list');
    const [selectedBudget, setSelectedBudget] = useState<Budget | null>(null);

    // PDF generation and share states
    const [pdfStatus, setPdfStatus] = useState<'none' | 'generating' | 'generated' | 'sending' | 'sent' | 'error'>('none');
    const [pdfFeedbackMsg, setPdfFeedbackMsg] = useState('');

    // ==========================================
    // 1. STATE FOR BUDGET FORM
    // ==========================================
    const [formBudgetId, setFormBudgetId] = useState<string | null>(null);
    const [numero, setNumero] = useState('');
    const [fecha, setFecha] = useState('');
    const [tipo, setTipo] = useState<'alquiler' | 'insumo' | 'repuesto' | 'servicio_tecnico' | 'mixto'>('alquiler');
    const [selectedTemplateId, setSelectedTemplateId] = useState('');
    const [clientId, setClientId] = useState('');
    const [isNewClient, setIsNewClient] = useState(false);
    const [saveNewClient, setSaveNewClient] = useState(false);
    const [isNoState, setIsNoState] = useState(true); // For non-state clients requirements flag
    
    // Client snapshot details
    const [clientName, setClientName] = useState('');
    const [clientDocumento, setClientDocumento] = useState('');
    const [clientCuit, setClientCuit] = useState('');
    const [clientPhone, setClientPhone] = useState('');
    const [clientEmail, setClientEmail] = useState('');
    const [clientAddress, setClientAddress] = useState('');
    const [clientLocalidad, setClientLocalidad] = useState('');
    const [clientProvincia, setClientProvincia] = useState('');
    const [clientContacto, setClientContacto] = useState('');

    // Items list (for non-rentals or mixed)
    const [items, setItems] = useState<BudgetItem[]>([]);
    
    // Machines list (for rentals)
    const [formMachines, setFormMachines] = useState<BudgetMachineConfig[]>([]);

    // Additional commercial specs
    const [validezOferta, setValidezOferta] = useState('15 Días');
    const [plazoContrato, setPlazoContrato] = useState('12 Meses');
    const [ajustePrecios, setAjustePrecios] = useState('Trimestral según IPC');
    const [observaciones, setObservaciones] = useState('');

    // Text overrides
    const [introText, setIntroText] = useState('');
    const [includesText, setIncludesText] = useState('');
    const [excludesText, setExcludesText] = useState('');
    const [requirementsText, setRequirementsText] = useState('');
    const [conditionsText, setConditionsText] = useState('');
    const [footerText, setFooterText] = useState('M&S Tecnología Digital - Provisión de Soluciones de Copiado e Impresión Corporativa.');
    const [isTextDirty, setIsTextDirty] = useState(false);

    // Tax and discount
    const [ivaMode, setIvaMode] = useState<TaxMode>('ADD_21');
    const [discountType, setDiscountType] = useState<DiscountType>('NONE');
    const [discountValue, setDiscountValue] = useState('0');

    // Mail and WhatsApp modals
    const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
    const [isWhatsappModalOpen, setIsWhatsappModalOpen] = useState(false);
    const [shareMessage, setShareMessage] = useState('');
    const [shareEmail, setShareEmail] = useState('');
    const [shareSubject, setShareSubject] = useState('');
    const [sharePhone, setSharePhone] = useState('');

    // Preset / Template editing states
    const [isPresetModalOpen, setIsPresetModalOpen] = useState(false);
    const [editingPreset, setEditingPreset] = useState<MachinePreset | null>(null);
    const [presetMarca, setPresetMarca] = useState('');
    const [presetModelo, setPresetModelo] = useState('');
    const [presetNombre, setPresetNombre] = useState('');
    const [presetTipo, setPresetTipo] = useState('B&N');
    const [presetPpm, setPresetPpm] = useState('40');
    const [presetSpecs, setPresetSpecs] = useState('');
    const [presetNotes, setPresetNotes] = useState('');

    const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<BudgetTemplate | null>(null);
    const [tempNombre, setTempNombre] = useState('');
    const [tempTipo, setTempTipo] = useState<'alquiler' | 'insumo' | 'repuesto' | 'servicio_tecnico' | 'mixto'>('alquiler');
    const [tempIntro, setTempIntro] = useState('');
    const [tempConditions, setTempConditions] = useState('');
    const [tempIncludes, setTempIncludes] = useState('');
    const [tempExcludes, setTempExcludes] = useState('');
    const [tempReqs, setTempReqs] = useState('');

    // ==========================================
    // 2. EFFECTS & HELPERS
    // ==========================================
    
    // Auto-generate budget number initially
    useEffect(() => {
        if (activeTab === 'create' && !formBudgetId) {
            setNumero('PRE-' + (1000 + budgets.length + 1));
            setFecha(new Date().toISOString().split('T')[0]);
            handleClientSelect('');
        }
    }, [activeTab, budgets, formBudgetId]);

    // Handle selection of a client
    const handleClientSelect = (id: string) => {
        setClientId(id);
        if (id === 'new') {
            setIsNewClient(true);
            setClientName('');
            setClientDocumento('');
            setClientCuit('');
            setClientPhone('');
            setClientEmail('');
            setClientAddress('');
            setClientLocalidad('');
            setClientProvincia('');
            setClientContacto('');
        } else if (id) {
            setIsNewClient(false);
            const cl = clients.find(c => c.id === id);
            if (cl) {
                setClientName(cl.name);
                setClientCuit(cl.cuit || '');
                setClientPhone(cl.phone || '');
                setClientEmail(cl.email || '');
                setClientAddress(cl.address || '');
                setClientDocumento('');
                setClientLocalidad('');
                setClientProvincia('');
                setClientContacto('');
            }
        } else {
            setIsNewClient(false);
            setClientName('');
            setClientDocumento('');
            setClientCuit('');
            setClientPhone('');
            setClientEmail('');
            setClientAddress('');
            setClientLocalidad('');
            setClientProvincia('');
            setClientContacto('');
        }
    };

    // Handle change of budget type (auto-loads template and defaults)
    const handleTypeChange = (newType: typeof tipo) => {
        if (isTextDirty) {
            const confirmChange = window.confirm(
                '¿Desea cambiar el tipo de presupuesto? Se sobrescribirán y perderán las descripciones que redactó manualmente.'
            );
            if (!confirmChange) return;
        }

        setTipo(newType);
        
        // Find matching template
        const matched = templates.find(t => t.tipo === newType && t.activo);
        if (matched) {
            applyTemplate(matched, true);
        } else {
            // Fallback clear
            setIntroText('');
            setConditionsText('');
            setIncludesText('');
            setExcludesText('');
            setRequirementsText('');
            setIvaMode('ADD_21');
            setIsTextDirty(false);
        }
    };

    const applyTemplate = (temp: BudgetTemplate, force = false) => {
        if (!force && isTextDirty) {
            const confirmChange = window.confirm(
                '¿Desea cambiar la plantilla de texto? Se sobrescribirán y perderán las descripciones que redactó manualmente.'
            );
            if (!confirmChange) return;
        }

        setSelectedTemplateId(temp.id);
        setIntroText(temp.defaultIntroText);
        setConditionsText(temp.defaultConditionsText);
        setIncludesText(temp.defaultIncludesText);
        setExcludesText(temp.defaultExcludesText);
        setIvaMode(temp.defaultTaxMode);
        
        if (isNoState) {
            setRequirementsText(temp.defaultRequirementsText);
        } else {
            setRequirementsText('');
        }
        setIsTextDirty(false);
    };

    // Trigger requirements toggle based on non-state client flag
    const handleNoStateToggle = (checked: boolean) => {
        setIsNoState(checked);
        const temp = templates.find(t => t.id === selectedTemplateId);
        if (temp) {
            if (checked) {
                setRequirementsText(temp.defaultRequirementsText);
            } else {
                setRequirementsText('');
            }
        }
    };

    // Add machinery preset to the list
    const handleAddMachinePreset = (presetId: string) => {
        const p = machinePresets.find(pr => pr.id === presetId);
        if (!p) return;

        const newFormMachine: BudgetMachineConfig = {
            machinePresetId: p.id,
            machineName: p.nombreComercial,
            machineBrand: p.marca,
            machineModel: p.modelo,
            technicalSummary: p.technicalSummary,
            editableSpecsText: `Velocidad: ${p.ppm} ppm\nFunciones: ${p.funciones}\nDoble Faz: ${p.duplex ? 'Sí' : 'No'}\nADF: ${p.adf ? 'Sí' : 'No'}\nConectividad: ${p.conectividad}\nMemoria: ${p.memoria}`,
            planNombre: 'Abono Estándar',
            copiasIncluidas: 2000,
            abonoBase: 45000,
            copiaExcedente: 15.50,
            cantidad: 1,
            subtotal: 45000
        };

        setFormMachines(prev => [...prev, newFormMachine]);
    };

    // Add actual physical inventory machine to the list
    const handleAddPhysicalMachine = (machineId: string) => {
        const m = machines.find(mac => mac.id === machineId);
        if (!m) return;

        // Lookup abono if assigned to machine
        const abono = abonos.find(a => a.id === m.abonoId);

        const newFormMachine: BudgetMachineConfig = {
            machinePresetId: m.id,
            machineName: `${m.brand} ${m.model}`,
            machineBrand: m.brand,
            machineModel: m.model,
            technicalSummary: `Equipo físico del inventario. Nro de Serie: ${m.serial}. Tipo: ${m.type}. Contador actual: ${m.currentCounter.toLocaleString('es-AR')} copias.`,
            editableSpecsText: `Número de Serie: ${m.serial}\nTipo: ${m.type}\nContador Inicial: ${m.currentCounter} copias\nIntervalo Preventivo: ${m.preventiveInterval} copias`,
            planNombre: abono ? abono.name : 'Abono Estándar',
            copiasIncluidas: abono ? abono.limit : 2000,
            abonoBase: abono ? abono.price : 45000,
            copiaExcedente: abono ? abono.excessPrice : 15.50,
            cantidad: 1,
            subtotal: abono ? abono.price : 45000
        };

        setFormMachines(prev => [...prev, newFormMachine]);
    };

    // Update specs of a machine
    const handleUpdateMachineSpec = (index: number, key: keyof BudgetMachineConfig, value: any) => {
        setFormMachines(prev => prev.map((m, idx) => {
            if (idx === index) {
                const updated = { ...m, [key]: value };
                if (key === 'abonoBase' || key === 'cantidad') {
                    const price = key === 'abonoBase' ? parseFloat(value) || 0 : m.abonoBase;
                    const qty = key === 'cantidad' ? parseInt(value) || 0 : m.cantidad;
                    updated.subtotal = price * qty;
                }
                return updated;
            }
            return m;
        }));
    };

    const handleRemoveMachine = (index: number) => {
        setFormMachines(prev => prev.filter((_, idx) => idx !== index));
    };

    // Add simple item line
    const handleAddSimpleItem = () => {
        const newItem: BudgetItem = {
            id: 'item-' + Date.now() + Math.random(),
            categoria: tipo === 'repuesto' ? 'REPUESTO' : (tipo === 'servicio_tecnico' ? 'SERVICIO' : 'INSUMO'),
            descripcion: '',
            cantidad: 1,
            precioUnitario: 0,
            subtotal: 0
        };
        setItems(prev => [...prev, newItem]);
    };

    const handleUpdateSimpleItem = (id: string, key: keyof BudgetItem, value: any) => {
        setItems(prev => prev.map(item => {
            if (item.id === id) {
                const updated = { ...item, [key]: value };
                if (key === 'precioUnitario' || key === 'cantidad') {
                    const price = key === 'precioUnitario' ? parseFloat(value) || 0 : item.precioUnitario;
                    const qty = key === 'cantidad' ? parseInt(value) || 0 : item.cantidad;
                    updated.subtotal = price * qty;
                }
                return updated;
            }
            return item;
        }));
    };

    const handleRemoveSimpleItem = (id: string) => {
        setItems(prev => prev.filter(item => item.id !== id));
    };

    // Financial calculations
    const financialResults = calculateBudget({
        items,
        machines: formMachines,
        discountType,
        discountValue: parseFloat(discountValue) || 0,
        ivaMode
    });

    // Save Budget
    const handleSaveBudget = (statusOverride: 'borrador' | 'emitido' = 'borrador') => {
        if (!clientName.trim()) {
            alert('Por favor, ingresa el nombre de un destinatario/cliente.');
            return;
        }

        if (tipo === 'alquiler' && formMachines.length === 0) {
            alert('Un presupuesto de alquiler debe incluir al menos un equipo y abono.');
            return;
        }

        if (tipo !== 'alquiler' && items.length === 0) {
            alert('Por favor, agrega al menos un ítem al presupuesto.');
            return;
        }

        // Save new client to master database if requested
        if (isNewClient && saveNewClient) {
            const newClientData = {
                id: 'client-' + Date.now(),
                name: clientName,
                cuit: clientCuit,
                phone: clientPhone,
                email: clientEmail,
                address: clientAddress,
                taxCategory: 'Responsable Inscripto' as any,
                debt: 0
            };
            setClients(prev => [...prev, newClientData]);
        }

        const newBudget: Budget = {
            id: formBudgetId || 'budget-' + Date.now(),
            numero,
            fecha,
            estado: statusOverride,
            tipo,
            templateId: selectedTemplateId || undefined,
            clientId: clientId === 'new' ? undefined : (clientId || undefined),
            isNewClient,
            saveNewClient,
            ivaMode,
            moneda: 'ARS',
            subtotal: financialResults.subtotalRaw,
            discountType,
            discountValue: parseFloat(discountValue) || 0,
            discountAmount: financialResults.discountAmount,
            ivaAmount: financialResults.ivaAmount,
            total: financialResults.total,
            validezOferta,
            plazoMinimoContrato: plazoContrato,
            ajustePrecios,
            observaciones: observaciones || undefined,
            introText,
            includesText,
            excludesText,
            requirementsText,
            conditionsText,
            footerText,
            clientSnapshot: {
                nombreRazonSocial: clientName,
                documento: clientDocumento || undefined,
                cuitCuil: clientCuit || undefined,
                telefono: clientPhone,
                email: clientEmail,
                domicilio: clientAddress,
                localidad: clientLocalidad || undefined,
                provincia: clientProvincia || undefined,
                contacto: clientContacto || undefined
            },
            items,
            machines: formMachines,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            issuedAt: statusOverride === 'emitido' ? new Date().toISOString() : undefined,
            sendLogs: []
        };

        if (formBudgetId) {
            setBudgets(prev => prev.map(b => b.id === formBudgetId ? newBudget : b));
        } else {
            setBudgets(prev => [...prev, newBudget]);
        }

        alert(statusOverride === 'emitido' ? '¡Presupuesto Emitido con Éxito!' : 'Borrador Guardado.');
        setActiveTab('list');
        setSelectedBudget(newBudget);
        setFormBudgetId(null);
    };

    // Load budget for editing
    const handleEditBudget = (b: Budget, e: React.MouseEvent) => {
        e.stopPropagation();
        setFormBudgetId(b.id);
        setNumero(b.numero);
        setFecha(b.fecha);
        setTipo(b.tipo);
        setSelectedTemplateId(b.templateId || '');
        setClientId(b.clientId || (b.isNewClient ? 'new' : ''));
        setIsNewClient(b.isNewClient);
        setSaveNewClient(b.saveNewClient);
        
        setClientName(b.clientSnapshot.nombreRazonSocial);
        setClientDocumento(b.clientSnapshot.documento || '');
        setClientCuit(b.clientSnapshot.cuitCuil || '');
        setClientPhone(b.clientSnapshot.telefono);
        setClientEmail(b.clientSnapshot.email);
        setClientAddress(b.clientSnapshot.domicilio);
        setClientLocalidad(b.clientSnapshot.localidad || '');
        setClientProvincia(b.clientSnapshot.provincia || '');
        setClientContacto(b.clientSnapshot.contacto || '');

        setItems(b.items);
        setFormMachines(b.machines);

        setValidezOferta(b.validezOferta);
        setPlazoContrato(b.plazoMinimoContrato);
        setAjustePrecios(b.ajustePrecios);
        setObservaciones(b.observaciones || '');

        setIntroText(b.introText);
        setIncludesText(b.includesText);
        setExcludesText(b.excludesText);
        setRequirementsText(b.requirementsText);
        setConditionsText(b.conditionsText);
        setFooterText(b.footerText);

        setIvaMode(b.ivaMode);
        setDiscountType(b.discountType);
        setDiscountValue(String(b.discountValue));
        setIsTextDirty(false);

        setActiveTab('create');
    };

    // Duplicate budget
    const handleDuplicateBudget = (b: Budget, e: React.MouseEvent) => {
        e.stopPropagation();
        const duplicated: Budget = {
            ...b,
            id: 'budget-' + Date.now(),
            numero: 'PRE-' + (1000 + budgets.length + 1),
            fecha: new Date().toISOString().split('T')[0],
            estado: 'borrador',
            sendLogs: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            issuedAt: undefined
        };
        setBudgets(prev => [...prev, duplicated]);
        alert(`¡Presupuesto clonado como Borrador bajo el Nro ${duplicated.numero}!`);
    };

    const handleDeleteBudget = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (confirm('¿Está seguro de que desea eliminar este presupuesto?')) {
            setBudgets(prev => prev.filter(b => b.id !== id));
            if (selectedBudget?.id === id) {
                setSelectedBudget(null);
            }
        }
    };

    // Share channels logging
    const logSendEvent = (canal: 'email' | 'whatsapp', destinatario: string) => {
        if (!selectedBudget) return;
        const log = {
            id: 'log-' + Date.now(),
            presupuestoId: selectedBudget.id,
            fecha: new Date().toLocaleDateString('es-AR') + ' ' + new Date().toLocaleTimeString('es-AR').slice(0, 5),
            canal,
            destinatario,
            mensaje: shareMessage,
            exitoso: true
        };

        const updatedBudget = {
            ...selectedBudget,
            estado: 'enviado' as const,
            sendLogs: [...(selectedBudget.sendLogs || []), log]
        };

        setBudgets(prev => prev.map(b => b.id === selectedBudget.id ? updatedBudget : b));
        setSelectedBudget(updatedBudget);
    };

    // PDF Generation Utility
    // PDF Generation Utility using `@react-pdf/renderer` in the browser
    const generatePdfData = async (b: Budget) => {
        setPdfStatus('generating');
        setPdfFeedbackMsg('Generando archivo PDF profesional con React-PDF...');
        
        try {
            const { pdf } = await import('@react-pdf/renderer');
            const { PresupuestoPDF } = await import('@/pdf/PresupuestoPDF');
            
            const docElement = React.createElement(PresupuestoPDF, { budget: b });
            const pdfInstance = pdf(docElement as any);
            const pdfBlob = await pdfInstance.toBlob();
            
            // Convertir blob a base64
            const reader = new FileReader();
            const base64Promise = new Promise<string>((resolve) => {
                reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
            });
            reader.readAsDataURL(pdfBlob);
            const base64 = await base64Promise;
            
            const filename = `Presupuesto-${b.numero}-${b.clientSnapshot.nombreRazonSocial.replace(/\s+/g, '_')}.pdf`;
            
            setPdfStatus('generated');
            setPdfFeedbackMsg('¡PDF Generado con éxito!');
            return { blob: pdfBlob, base64, filename };
        } catch (err: any) {
            console.error('Error al generar PDF:', err);
            setPdfStatus('error');
            setPdfFeedbackMsg('Error: No se pudo compilar el PDF comercial. Detalle: ' + (err?.message || err));
            throw err;
        }
    };

    // Download PDF Button
    const handleDownloadPdfDirectly = async () => {
        if (!selectedBudget) return;
        try {
            const { blob, filename } = await generatePdfData(selectedBudget);
            
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            
            setPdfFeedbackMsg(`Presupuesto descargado como: ${filename}`);
        } catch (err) {
            // Error handling inside generatePdfData
        }
    };

    // Share options: WhatsApp and Email
    const handleShareWithChannel = async (channel: 'email' | 'whatsapp') => {
        if (!selectedBudget) return;
        
        try {
            const { base64, filename } = await generatePdfData(selectedBudget);
            
            if (channel === 'whatsapp') {
                setPdfStatus('sending');
                setPdfFeedbackMsg('Subiendo archivo temporal...');
                
                const res = await fetch('/api/share-pdf', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ pdfBase64: base64, filename })
                });
                
                if (!res.ok) throw new Error('Error al almacenar temporalmente el PDF.');
                const data = await res.json();
                
                const publicPdfUrl = `${window.location.origin}${data.url}`;
                const msg = `Estimado/a ${selectedBudget.clientSnapshot.nombreRazonSocial},\n\nLe enviamos la propuesta comercial correspondiente para el servicio de ${selectedBudget.tipo.replace('_', ' ')}: ${selectedBudget.numero}.\n\nPodés ver/descargar el presupuesto en formato PDF desde este enlace:\n${publicPdfUrl}`;
                
                setShareMessage(msg);
                setSharePhone(selectedBudget.clientSnapshot.telefono || '');
                setIsWhatsappModalOpen(true);
                
                setPdfStatus('sent');
                setPdfFeedbackMsg('Enlace de PDF listo para enviar por WhatsApp.');
            } else if (channel === 'email') {
                setShareEmail(selectedBudget.clientSnapshot.email || '');
                setShareSubject(`Presupuesto N° ${selectedBudget.numero} - M&S`);
                setShareMessage(`Estimado/a ${selectedBudget.clientSnapshot.nombreRazonSocial},\n\nLe enviamos adjunto el presupuesto correspondiente para el servicio de ${selectedBudget.tipo.replace('_', ' ')}: ${selectedBudget.numero}.\n\nQuedamos a su disposición.`);
                
                (window as any).tempPdfData = { base64, filename };
                setIsEmailModalOpen(true);
                
                setPdfStatus('none');
                setPdfFeedbackMsg('Presupuesto adjuntado. Complete los datos para enviar el correo.');
            }
        } catch (err: any) {
            console.error(err);
            setPdfStatus('error');
            setPdfFeedbackMsg('Error al compartir: ' + err.message);
        }
    };

    const handleSendEmail = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedBudget) return;
        
        const tempPdf = (window as any).tempPdfData;
        if (!tempPdf) {
            alert('Error: No se encontró el archivo adjunto. Intente de nuevo.');
            return;
        }

        setPdfStatus('sending');
        setPdfFeedbackMsg('Enviando correo real con PDF adjunto...');

        try {
            const res = await fetch('/api/send-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to: shareEmail,
                    clienteNombre: selectedBudget.clientSnapshot.nombreRazonSocial,
                    numeroPresupuesto: selectedBudget.numero,
                    presupuestoId: selectedBudget.id,
                    pdfBase64: tempPdf.base64
                })
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || 'Error al enviar el correo.');
            }
            const data = await res.json();
            
            logSendEvent('email', shareEmail);
            
            // Actualizar localmente el estado del presupuesto a "enviado"
            const updatedBudget = {
                ...selectedBudget,
                estado: 'enviado' as const
            };
            setBudgets(prev => prev.map(b => b.id === selectedBudget.id ? updatedBudget : b));
            setSelectedBudget(updatedBudget);
            
            setIsEmailModalOpen(false);
            setPdfStatus('sent');
            
            if (data.simulated) {
                alert('¡Correo SIMULADO enviado con éxito! Revisa la consola (Configura YAHOO_APP_PASSWORD en .env para envíos reales).');
            } else {
                alert('¡Correo enviado con éxito real a través de SMTP de Yahoo!');
            }
        } catch (err: any) {
            console.error(err);
            setPdfStatus('error');
            setPdfFeedbackMsg('Error al enviar: ' + err.message);
            alert('No se pudo enviar el correo: ' + err.message);
        }
    };

    const handleSendWhatsapp = (e: React.FormEvent) => {
        e.preventDefault();
        logSendEvent('whatsapp', sharePhone);
        setIsWhatsappModalOpen(false);
        
        const cleanPhone = sharePhone.replace(/[^0-9]/g, '');
        const encodedText = encodeURIComponent(shareMessage);
        window.open(`https://wa.me/${cleanPhone}?text=${encodedText}`, '_blank');
        
        setPdfStatus('sent');
        setPdfFeedbackMsg('Mensaje de WhatsApp enviado.');
    };

    // ==========================================
    // 3. CATALOGS PRESETS / TEMPLATES LOGIC
    // ==========================================
    const handleOpenPresetForm = (p: MachinePreset | null = null) => {
        if (p) {
            setEditingPreset(p);
            setPresetMarca(p.marca);
            setPresetModelo(p.modelo);
            setPresetNombre(p.nombreComercial);
            setPresetTipo(p.tipo);
            setPresetPpm(String(p.ppm));
            setPresetSpecs(p.technicalSummary);
            setPresetNotes(p.commercialNotes);
        } else {
            setEditingPreset(null);
            setPresetMarca('');
            setPresetModelo('');
            setPresetNombre('');
            setPresetTipo('B&N');
            setPresetPpm('40');
            setPresetSpecs('');
            setPresetNotes('');
        }
        setIsPresetModalOpen(true);
    };

    const handleSavePreset = (e: React.FormEvent) => {
        e.preventDefault();
        if (!presetMarca || !presetModelo) return;

        const newPreset: MachinePreset = {
            id: editingPreset ? editingPreset.id : 'preset-' + Date.now(),
            marca: presetMarca,
            modelo: presetModelo,
            nombreComercial: presetNombre || `${presetMarca} ${presetModelo}`,
            tipo: presetTipo,
            ppm: parseInt(presetPpm) || 40,
            funciones: 'Impresión, copia, escaneo',
            duplex: true,
            escaner: true,
            adf: true,
            conectividad: 'Ethernet Gigabit + USB',
            papel: 'A4, Carta',
            pantalla: 'LCD táctil',
            memoria: '512 MB',
            capacidadPapel: 'Bandeja de 250 hojas',
            technicalSummary: presetSpecs,
            commercialNotes: presetNotes,
            activo: true
        };

        if (editingPreset) {
            setMachinePresets(prev => prev.map(p => p.id === editingPreset.id ? newPreset : p));
        } else {
            setMachinePresets(prev => [...prev, newPreset]);
        }
        setIsPresetModalOpen(false);
    };

    const handleDeletePreset = (id: string) => {
        if (confirm('¿Está seguro de que desea eliminar este equipo preconfigurado?')) {
            setMachinePresets(prev => prev.filter(p => p.id !== id));
        }
    };

    const handleOpenTemplateForm = (t: BudgetTemplate | null = null) => {
        if (t) {
            setEditingTemplate(t);
            setTempNombre(t.nombre);
            setTempTipo(t.tipo);
            setTempIntro(t.defaultIntroText);
            setTempConditions(t.defaultConditionsText);
            setTempIncludes(t.defaultIncludesText);
            setTempExcludes(t.defaultExcludesText);
            setTempReqs(t.defaultRequirementsText);
        } else {
            setEditingTemplate(null);
            setTempNombre('');
            setTempTipo('alquiler');
            setTempIntro('');
            setTempConditions('');
            setTempIncludes('');
            setTempExcludes('');
            setTempReqs('');
        }
        setIsTemplateModalOpen(true);
    };

    const handleSaveTemplate = (e: React.FormEvent) => {
        e.preventDefault();
        if (!tempNombre || !tempIntro) return;

        const newTemp: BudgetTemplate = {
            id: editingTemplate ? editingTemplate.id : 'temp-' + Date.now(),
            nombre: tempNombre,
            tipo: tempTipo,
            defaultIntroText: tempIntro,
            defaultConditionsText: tempConditions,
            defaultIncludesText: tempIncludes,
            defaultExcludesText: tempExcludes,
            defaultRequirementsText: tempReqs,
            defaultTaxMode: 'ADD_21',
            activo: true
        };

        if (editingTemplate) {
            setTemplates(prev => prev.map(t => t.id === editingTemplate.id ? newTemp : t));
        } else {
            setTemplates(prev => [...prev, newTemp]);
        }
        setIsTemplateModalOpen(false);
    };

    const handleDeleteTemplate = (id: string) => {
        if (confirm('¿Está seguro de que desea eliminar esta plantilla de texto?')) {
            setTemplates(prev => prev.filter(t => t.id !== id));
        }
    };

    return (
        <div className="space-y-6 animate-fade-in relative print:p-0">
            {/* Header Tabs */}
            <div className="flex flex-wrap justify-between items-center border-b border-slate-800 pb-3 gap-4 print:hidden">
                <div className="flex gap-2">
                    <Button variant={activeTab === 'list' ? 'primary' : 'secondary'} size="sm" onClick={() => setActiveTab('list')}>
                        <FileText size={15} className="mr-1.5" /> Presupuestos ({budgets.length})
                    </Button>
                    <Button variant={activeTab === 'create' ? 'primary' : 'secondary'} size="sm" onClick={() => { setFormBudgetId(null); setActiveTab('create'); }}>
                        <Plus size={15} className="mr-1.5" /> Nuevo Presupuesto
                    </Button>
                    <Button variant={activeTab === 'presets' ? 'primary' : 'secondary'} size="sm" onClick={() => setActiveTab('presets')}>
                        <Settings size={15} className="mr-1.5" /> Equipos Preset ({machinePresets.length})
                    </Button>
                    <Button variant={activeTab === 'templates' ? 'primary' : 'secondary'} size="sm" onClick={() => setActiveTab('templates')}>
                        <Settings size={15} className="mr-1.5" /> Plantillas de Texto ({templates.length})
                    </Button>
                </div>
            </div>

            {/* TAB 1: LIST OF BUDGETS */}
            {activeTab === 'list' && (
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start print:hidden">
                    {/* Left List */}
                    <div className={selectedBudget ? "xl:col-span-1 space-y-4" : "xl:col-span-3 space-y-4"}>
                        <TableContainer>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHeaderCell>Fecha</TableHeaderCell>
                                        <TableHeaderCell>Número</TableHeaderCell>
                                        <TableHeaderCell>Destinatario</TableHeaderCell>
                                        <TableHeaderCell>Tipo</TableHeaderCell>
                                        <TableHeaderCell>Total</TableHeaderCell>
                                        <TableHeaderCell>Estado</TableHeaderCell>
                                        <TableHeaderCell className="text-right">Acción</TableHeaderCell>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {budgets.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={7} className="text-center py-8 text-slate-400 text-xs">
                                                No hay propuestas comerciales emitidas.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        budgets.map(b => (
                                            <TableRow key={b.id} className="cursor-pointer" onClick={() => setSelectedBudget(b)}>
                                                <TableCell className="text-xs text-slate-350">{b.fecha.split('-').reverse().join('/')}</TableCell>
                                                <TableCell className="font-mono-tabular text-xs font-bold text-slate-200">{b.numero}</TableCell>
                                                <TableCell className="font-bold text-slate-100">{b.clientSnapshot.nombreRazonSocial}</TableCell>
                                                <TableCell className="text-xs text-slate-300 uppercase">{b.tipo.replace('_', ' ')}</TableCell>
                                                <TableCell className="font-mono-tabular text-xs text-slate-105 font-extrabold">{formatCurrency(b.total)}</TableCell>
                                                <TableCell className="text-xs">
                                                    <Badge variant={
                                                        b.estado === 'emitido' ? 'success' :
                                                        b.estado === 'enviado' ? 'info' : 'secondary'
                                                    }>
                                                        {b.estado}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right space-x-1" onClick={e => e.stopPropagation()}>
                                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setSelectedBudget(b)}>
                                                        <Eye size={14} className="text-slate-400" />
                                                    </Button>
                                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={(e) => handleEditBudget(b, e)}>
                                                        <Edit size={14} className="text-slate-400" />
                                                    </Button>
                                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={(e) => handleDuplicateBudget(b, e)} title="Duplicar como Borrador">
                                                        <Copy size={14} className="text-slate-400" />
                                                    </Button>
                                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={(e) => handleDeleteBudget(b.id, e)}>
                                                        <Trash2 size={14} className="text-red-400" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </div>

                    {/* Right Document Preview Drawer */}
                    {selectedBudget && (
                        <div className="xl:col-span-2">
                            <Card className="border-indigo-600/30 shadow-lg animate-fade-in">
                                <div className="p-4 bg-slate-900 text-white flex items-center justify-between rounded-t-2xl">
                                    <div>
                                        <h3 className="font-bold text-sm">Propuesta Comercial {selectedBudget.numero}</h3>
                                        <span className="text-[10px] text-slate-400">Estado: {selectedBudget.estado.toUpperCase()}</span>
                                    </div>
                                    <div className="flex gap-1.5 items-center flex-wrap">
                                        {pdfStatus === 'generating' ? (
                                            <span className="text-[10px] text-slate-400 animate-pulse">Generando PDF...</span>
                                        ) : pdfStatus === 'sending' ? (
                                            <span className="text-[10px] text-slate-400 animate-pulse">Enviando...</span>
                                        ) : null}
                                        <Button variant="secondary" size="sm" onClick={handleDownloadPdfDirectly} disabled={pdfStatus === 'generating'}>
                                            <Download size={13} className="mr-1" /> Descargar PDF
                                        </Button>
                                        <Button variant="primary" size="sm" onClick={() => handleShareWithChannel('email')} disabled={pdfStatus === 'generating'}>
                                            <Mail size={13} className="mr-1" /> Enviar por Email
                                        </Button>
                                        <Button variant="primary" size="sm" className="bg-emerald-600 hover:bg-emerald-500 text-white" onClick={() => handleShareWithChannel('whatsapp')} disabled={pdfStatus === 'generating'}>
                                            <Send size={13} className="mr-1" /> Enviar por WhatsApp
                                        </Button>
                                        <Button variant="success" size="sm" onClick={() => window.print()}>
                                            <Printer size={13} className="mr-1" /> Imprimir
                                        </Button>
                                        <button className="text-slate-400 hover:text-white p-1 ml-2" onClick={() => { setSelectedBudget(null); setPdfStatus('none'); setPdfFeedbackMsg(''); }}>
                                            <X size={20} />
                                        </button>
                                    </div>
                                </div>
                                {pdfFeedbackMsg && (
                                    <div className={`px-5 py-2 text-xs font-semibold ${
                                        pdfStatus === 'error' ? 'bg-red-950/60 text-red-400 border-b border-red-900/50' : 'bg-indigo-950/60 text-indigo-400 border-b border-indigo-900/50'
                                    }`}>
                                        {pdfStatus === 'generating' ? '⏳ ' : pdfStatus === 'error' ? '❌ ' : '✅ '}
                                        {pdfFeedbackMsg}
                                    </div>
                                )}
                                <CardContent className="p-8 space-y-6 text-xs text-slate-300 bg-slate-950">
                                    <div className="flex justify-between items-center border-b border-slate-800 pb-4">
                                        <div className="flex items-center gap-3">
                                            <img src="/logo.png" alt="Logo M&S" className="h-10 w-auto object-contain bg-white p-1 rounded" />
                                            <div>
                                                <h1 className="text-base font-extrabold text-indigo-400 uppercase">M&S Tecnología Digital</h1>
                                                <p className="text-[10px] text-slate-500">Alquiler de Copiadoras y Equipamiento de Oficina</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <h2 className="font-bold text-slate-100">PROPUESTA DE SERVICIO</h2>
                                            <p className="text-[10px] text-slate-400">Fecha: {selectedBudget.fecha.split('-').reverse().join('/')}</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <span className="text-[9px] uppercase font-bold text-slate-500 block">Propuesto Para</span>
                                            <span className="font-bold text-slate-200 block mt-0.5">{selectedBudget.clientSnapshot.nombreRazonSocial}</span>
                                            {selectedBudget.clientSnapshot.cuitCuil && <span className="text-[10px] text-slate-400 block mt-0.5">CUIT: {selectedBudget.clientSnapshot.cuitCuil}</span>}
                                        </div>
                                        <div>
                                            <span className="text-[9px] uppercase font-bold text-slate-500 block">Instalación y Contacto</span>
                                            <span className="text-slate-350 block mt-0.5">{selectedBudget.clientSnapshot.domicilio}</span>
                                            <span className="text-slate-400 block">{selectedBudget.clientSnapshot.telefono} | {selectedBudget.clientSnapshot.email}</span>
                                        </div>
                                    </div>

                                    {selectedBudget.introText && (
                                        <p className="text-slate-300 italic border-l-2 border-indigo-600 pl-3 leading-relaxed">{selectedBudget.introText}</p>
                                    )}

                                    {/* Rental Machines Block */}
                                    {selectedBudget.tipo === 'alquiler' && selectedBudget.machines.length > 0 && (
                                        <div className="space-y-4">
                                            <h4 className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Equipos y Abonos Propuestos</h4>
                                            {selectedBudget.machines.map((m, i) => (
                                                <div key={i} className="p-4 bg-slate-900/50 border border-slate-800 rounded-xl space-y-3">
                                                    <div className="flex justify-between border-b border-slate-800 pb-2">
                                                        <span className="font-bold text-slate-200 text-xs">{m.machineBrand} {m.machineModel} ({m.cantidad} Unidad/es)</span>
                                                        <span className="text-indigo-400 font-bold font-mono-tabular">{formatCurrency(m.abonoBase)} / base</span>
                                                    </div>
                                                    <p className="text-[10px] text-slate-400">{m.technicalSummary}</p>
                                                    <div className="grid grid-cols-2 gap-4 text-[10px] pt-1">
                                                        <div>
                                                            <span className="font-bold text-slate-500 block uppercase">Especificaciones del Contrato</span>
                                                            <pre className="font-sans text-slate-350 whitespace-pre-wrap mt-0.5">{m.editableSpecsText}</pre>
                                                        </div>
                                                        <div className="border-l border-slate-800 pl-4 space-y-1">
                                                            <span className="font-bold text-slate-500 block uppercase">Plan: {m.planNombre}</span>
                                                            <div className="flex justify-between text-slate-400">
                                                                <span>Copias libres:</span>
                                                                <span className="font-bold">{m.copiasIncluidas.toLocaleString('es-AR')}</span>
                                                            </div>
                                                            <div className="flex justify-between text-slate-450">
                                                                <span>Copia excedente:</span>
                                                                <span className="font-bold font-mono-tabular">{formatCurrency(m.copiaExcedente)}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Simple items table */}
                                    {selectedBudget.tipo !== 'alquiler' && selectedBudget.items.length > 0 && (
                                        <TableContainer>
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHeaderCell>Descripción / Detalle</TableHeaderCell>
                                                        <TableHeaderCell>Cantidad</TableHeaderCell>
                                                        <TableHeaderCell>Precio Unitario</TableHeaderCell>
                                                        <TableHeaderCell className="text-right">Subtotal</TableHeaderCell>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {selectedBudget.items.map((item, i) => (
                                                        <TableRow key={i}>
                                                            <TableCell className="font-bold text-slate-200">{item.descripcion}</TableCell>
                                                            <TableCell className="font-mono-tabular text-slate-300">{item.cantidad}</TableCell>
                                                            <TableCell className="font-mono-tabular text-slate-300">{formatCurrency(item.precioUnitario)}</TableCell>
                                                            <TableCell className="font-mono-tabular text-right text-slate-200">{formatCurrency(item.subtotal)}</TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </TableContainer>
                                    )}

                                    {/* Financial Breakdown */}
                                    <div className="border-t border-slate-800 pt-4 flex flex-col items-end space-y-1 text-xs">
                                        <div className="flex justify-between w-64 text-slate-400">
                                            <span>Subtotal:</span>
                                            <span className="font-mono-tabular">{formatCurrency(selectedBudget.subtotal)}</span>
                                        </div>
                                        {selectedBudget.discountAmount > 0 && (
                                            <div className="flex justify-between w-64 text-red-400">
                                                <span>Descuento ({selectedBudget.discountType === 'PERCENT' ? `${selectedBudget.discountValue}%` : 'fijo'}):</span>
                                                <span className="font-mono-tabular">-{formatCurrency(selectedBudget.discountAmount)}</span>
                                            </div>
                                        )}
                                        {selectedBudget.ivaMode === 'ADD_21' && (
                                            <div className="flex justify-between w-64 text-slate-400 border-t border-slate-900 pt-1">
                                                <span>IVA (21%):</span>
                                                <span className="font-mono-tabular">{formatCurrency(selectedBudget.ivaAmount)}</span>
                                            </div>
                                        )}
                                        <div className="flex justify-between w-64 font-extrabold text-sm text-indigo-400 border-t border-slate-800 pt-2">
                                            <span>Total Comercial:</span>
                                            <span className="font-mono-tabular">{formatCurrency(selectedBudget.total)}</span>
                                        </div>
                                        
                                        {/* Tax mode legend */}
                                        <span className="text-[10px] text-slate-500 italic mt-1.5 block">
                                            {selectedBudget.ivaMode === 'INCLUDED' && 'Los precios indicados incluyen IVA.'}
                                            {selectedBudget.ivaMode === 'PLUS_IVA' && 'Los precios indicados no incluyen IVA (Precios + IVA).'}
                                            {selectedBudget.ivaMode === 'EXEMPT' && 'Operación exenta de IVA.'}
                                        </span>
                                    </div>

                                    {/* Commercial Terms block */}
                                    <div className="border-t border-slate-850 pt-4 grid grid-cols-2 gap-4 text-[10px] text-slate-400">
                                        <div className="space-y-1.5">
                                            <span className="font-bold text-slate-300 block uppercase text-[8px] tracking-wider">Condiciones Comerciales</span>
                                            <p>Validez de la oferta: <strong>{selectedBudget.validezOferta}</strong></p>
                                            {selectedBudget.tipo === 'alquiler' && (
                                                <>
                                                    <p>Plazo mínimo: <strong>{selectedBudget.plazoMinimoContrato}</strong></p>
                                                    <p>Ajuste: <strong>{selectedBudget.ajustePrecios}</strong></p>
                                                </>
                                            )}
                                            {selectedBudget.conditionsText && (
                                                <p className="text-[9px] text-slate-500 pt-1 leading-normal">{selectedBudget.conditionsText}</p>
                                            )}
                                        </div>
                                        <div className="space-y-1.5">
                                            <span className="font-bold text-slate-300 block uppercase text-[8px] tracking-wider">Servicios y Soporte Incluidos</span>
                                            {selectedBudget.includesText && (
                                                <p className="text-[9px] text-slate-450 leading-relaxed">{selectedBudget.includesText}</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Requirements for non-state client */}
                                    {selectedBudget.requirementsText && (
                                        <div className="border-t border-slate-900 pt-4 text-[9px] text-slate-500">
                                            <span className="font-bold text-slate-400 block uppercase text-[8px] tracking-wider mb-1">Requisitos de Contratación (Clientes Nuevos)</span>
                                            <p className="leading-relaxed">{selectedBudget.requirementsText}</p>
                                        </div>
                                    )}

                                    {/* Send logs timeline */}
                                    {selectedBudget.sendLogs && selectedBudget.sendLogs.length > 0 && (
                                        <div className="border-t border-slate-900 pt-4 text-[9px] text-slate-500 print:hidden">
                                            <span className="font-bold text-slate-400 block uppercase text-[8px] tracking-wider mb-1.5">Historial de Envíos</span>
                                            <div className="space-y-1 pl-1">
                                                {selectedBudget.sendLogs.map((log) => (
                                                    <div key={log.id} className="flex justify-between">
                                                        <span>📲 Enviado por {log.canal.toUpperCase()} a {log.destinatario}</span>
                                                        <span className="font-mono">{log.fecha}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <div className="text-center pt-8 text-[9px] text-slate-600 border-t border-slate-900 leading-normal">
                                        {selectedBudget.footerText}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    )}
                </div>
            )}

            {/* TAB 2: BUDGET CREATOR */}
            {activeTab === 'create' && (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start print:hidden">
                    {/* Left Column: Form Editor */}
                    <Card className="border-slate-800">
                        <div className="p-5 border-b border-slate-850 flex justify-between items-center">
                            <h3 className="font-bold text-sm text-slate-100">{formBudgetId ? 'Editar Propuesta Comercial' : 'Generar Propuesta Comercial'}</h3>
                            <span className="font-mono text-xs text-indigo-400">{numero}</span>
                        </div>
                        <CardContent className="p-5 space-y-6 text-xs text-slate-300">
                            {/* Section 1: Client Select */}
                            <div className="space-y-4">
                                <h4 className="font-bold text-indigo-400 border-b border-slate-850 pb-1.5 uppercase text-[9px] tracking-wider">1. Datos del Cliente / Destinatario</h4>
                                <Select
                                    label="Seleccionar Cliente"
                                    value={clientId}
                                    onChange={(e) => handleClientSelect(e.target.value)}
                                    options={[
                                        { value: '', label: 'Seleccionar...' },
                                        { value: 'new', label: '➕ Cliente Nuevo / Manual' },
                                        ...clients.map(c => ({ value: c.id, label: c.name }))
                                    ]}
                                />

                                {clientId && (
                                    <div className="grid grid-cols-2 gap-4 animate-fade-in pt-1">
                                        <Input
                                            label="Nombre / Razón Social *"
                                            value={clientName}
                                            onChange={(e) => setClientName(e.target.value)}
                                            required
                                        />
                                        <Input
                                            label="CUIT / CUIL"
                                            value={clientCuit}
                                            onChange={(e) => setClientCuit(e.target.value)}
                                        />
                                        <Input
                                            label="Teléfono de Contacto"
                                            value={clientPhone}
                                            onChange={(e) => setClientPhone(e.target.value)}
                                        />
                                        <Input
                                            label="Email"
                                            type="email"
                                            value={clientEmail}
                                            onChange={(e) => setClientEmail(e.target.value)}
                                        />
                                        <div className="col-span-2">
                                            <Input
                                                label="Domicilio de Instalación / Envío"
                                                value={clientAddress}
                                                onChange={(e) => setClientAddress(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                )}

                                {isNewClient && (
                                    <div className="flex items-center space-x-2 pt-2 animate-fade-in">
                                        <input
                                            type="checkbox"
                                            id="saveNewClient"
                                            checked={saveNewClient}
                                            onChange={(e) => setSaveNewClient(e.target.checked)}
                                            className="h-4 w-4 rounded border-slate-800 bg-slate-950 text-emerald-600 focus:ring-emerald-500"
                                        />
                                        <label htmlFor="saveNewClient" className="text-xs text-slate-350">
                                            Guardar este nuevo cliente en el catálogo maestro al emitir
                                        </label>
                                    </div>
                                )}
                            </div>

                            {/* Section 2: Type and Template */}
                            <div className="space-y-4">
                                <h4 className="font-bold text-indigo-400 border-b border-slate-850 pb-1.5 uppercase text-[9px] tracking-wider">2. Tipo de Propuesta y Plantilla</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <Select
                                        label="Tipo de Presupuesto"
                                        value={tipo}
                                        onChange={(e) => handleTypeChange(e.target.value as any)}
                                        options={[
                                            { value: 'alquiler', label: 'Alquiler de Copiadoras' },
                                            { value: 'insumo', label: 'Insumos / Consumibles' },
                                            { value: 'repuesto', label: 'Venta de Repuestos' },
                                            { value: 'servicio_tecnico', label: 'Servicio Técnico Especializado' },
                                            { value: 'mixto', label: 'Mixto (Combinado)' }
                                        ]}
                                    />
                                    <Select
                                        label="Plantilla de Texto"
                                        value={selectedTemplateId}
                                        onChange={(e) => {
                                            if (e.target.value === '') {
                                                if (isTextDirty) {
                                                    const confirmChange = window.confirm(
                                                        '¿Desea limpiar los textos? Se perderán las descripciones que redactó manualmente.'
                                                    );
                                                    if (!confirmChange) return;
                                                }
                                                setSelectedTemplateId('');
                                                setIntroText('');
                                                setConditionsText('');
                                                setIncludesText('');
                                                setExcludesText('');
                                                setRequirementsText('');
                                                setIsTextDirty(false);
                                            } else {
                                                const t = templates.find(temp => temp.id === e.target.value);
                                                if (t) applyTemplate(t);
                                            }
                                        }}
                                        options={[
                                            { value: '', label: 'Ninguna / Vacía' },
                                            ...templates.map(t => ({ value: t.id, label: t.nombre }))
                                        ]}
                                    />
                                </div>
                                <div className="flex items-center space-x-2 pt-2">
                                    <input
                                        type="checkbox"
                                        id="isNoState"
                                        checked={isNoState}
                                        onChange={(e) => handleNoStateToggle(e.target.checked)}
                                        className="h-4 w-4 rounded border-slate-800 bg-slate-950 text-emerald-600 focus:ring-emerald-500"
                                    />
                                    <label htmlFor="isNoState" className="text-xs text-slate-350">
                                        Cliente nuevo no estatal (Activa bloque de requisitos mínimos)
                                    </label>
                                </div>
                            </div>

                            {/* Section 3: Equipment and items selection */}
                            <div className="space-y-4">
                                <h4 className="font-bold text-indigo-400 border-b border-slate-850 pb-1.5 uppercase text-[9px] tracking-wider">3. Configuración de Equipos / Ítems</h4>
                                
                                {tipo === 'alquiler' ? (
                                    <div className="space-y-4">
                                        <div className="flex flex-col gap-3 bg-slate-900 p-4 rounded-xl space-y-1">
                                            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                                                <span className="font-semibold text-slate-200">Agregar Preset Comercial:</span>
                                                <div className="flex gap-1.5 flex-wrap">
                                                    {machinePresets.map(p => (
                                                        <Button key={p.id} type="button" variant="secondary" size="sm" onClick={() => handleAddMachinePreset(p.id)}>
                                                            + {p.modelo}
                                                        </Button>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="border-t border-slate-800 pt-2 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                                                <span className="font-semibold text-slate-200">O Asignar Equipo Físico de Inventario:</span>
                                                <div className="w-full sm:max-w-[240px]">
                                                    <select
                                                        onChange={(e) => {
                                                            if (e.target.value) {
                                                                handleAddPhysicalMachine(e.target.value);
                                                                e.target.value = ''; // Reset select value
                                                            }
                                                        }}
                                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2 py-1.5 text-slate-300 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                                    >
                                                        <option value="">-- Seleccionar Equipo Físico --</option>
                                                        {machines.map(m => (
                                                            <option key={m.id} value={m.id}>
                                                                {m.brand} {m.model} (S/N: {m.serial}) - {m.status}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>
                                        </div>

                                        {formMachines.length === 0 ? (
                                            <p className="text-[10px] text-slate-500 italic text-center py-4 bg-slate-950 border border-slate-900 border-dashed rounded-xl">No has agregado equipos. Usa los botones superiores para precargar presets comerciales.</p>
                                        ) : (
                                            <div className="space-y-4">
                                                {formMachines.map((m, idx) => (
                                                    <div key={idx} className="p-4 border border-slate-800 bg-slate-950 rounded-xl space-y-3 relative">
                                                        <button 
                                                            type="button"
                                                            className="absolute top-3 right-3 text-red-400 hover:text-red-300"
                                                            onClick={() => handleRemoveMachine(idx)}
                                                        >
                                                            <X size={16} />
                                                        </button>
                                                        
                                                        <div className="grid grid-cols-2 gap-3 pr-6">
                                                            <Input
                                                                label="Nombre Comercial"
                                                                value={m.machineName}
                                                                onChange={(e) => handleUpdateMachineSpec(idx, 'machineName', e.target.value)}
                                                            />
                                                            <Input
                                                                label="Abono Base ($)"
                                                                type="number"
                                                                value={String(m.abonoBase)}
                                                                onChange={(e) => handleUpdateMachineSpec(idx, 'abonoBase', e.target.value)}
                                                            />
                                                            <Input
                                                                label="Copias Libres"
                                                                type="number"
                                                                value={String(m.copiasIncluidas)}
                                                                onChange={(e) => handleUpdateMachineSpec(idx, 'copiasIncluidas', e.target.value)}
                                                            />
                                                            <Input
                                                                label="Copia Excedente ($)"
                                                                type="number"
                                                                value={String(m.copiaExcedente)}
                                                                onChange={(e) => handleUpdateMachineSpec(idx, 'copiaExcedente', e.target.value)}
                                                            />
                                                            <div className="col-span-2">
                                                                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Especificaciones Técnicas (Editable)</label>
                                                                <textarea
                                                                    value={m.editableSpecsText}
                                                                    onChange={(e) => handleUpdateMachineSpec(idx, 'editableSpecsText', e.target.value)}
                                                                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 h-20 resize-none"
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center bg-slate-900 p-3 rounded-xl">
                                            <span className="font-semibold text-slate-200">Detalle de Repuestos / Servicios</span>
                                            <Button variant="secondary" size="sm" onClick={handleAddSimpleItem}>
                                                + Agregar Línea
                                            </Button>
                                        </div>

                                        {items.length === 0 ? (
                                            <p className="text-[10px] text-slate-500 italic text-center py-4 bg-slate-950 border border-slate-900 border-dashed rounded-xl">No has agregado ítems. Haz clic en "Agregar Línea".</p>
                                        ) : (
                                            <div className="space-y-3">
                                                {items.map((item, idx) => (
                                                    <div key={item.id} className="grid grid-cols-6 gap-2 bg-slate-950 p-3 rounded-xl border border-slate-800 items-end">
                                                        <div className="col-span-3">
                                                            <Input
                                                                label="Descripción"
                                                                value={item.descripcion}
                                                                onChange={(e) => handleUpdateSimpleItem(item.id, 'descripcion', e.target.value)}
                                                                placeholder="Ej: Tóner TN-3449 Ricoh"
                                                            />
                                                        </div>
                                                        <div className="col-span-1">
                                                            <Input
                                                                label="Cantidad"
                                                                type="number"
                                                                value={String(item.cantidad)}
                                                                onChange={(e) => handleUpdateSimpleItem(item.id, 'cantidad', e.target.value)}
                                                            />
                                                        </div>
                                                        <div className="col-span-1">
                                                            <Input
                                                                label="Unitario ($)"
                                                                type="number"
                                                                value={String(item.precioUnitario)}
                                                                onChange={(e) => handleUpdateSimpleItem(item.id, 'precioUnitario', e.target.value)}
                                                            />
                                                        </div>
                                                        <div className="col-span-1 flex justify-end pb-1.5">
                                                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handleRemoveSimpleItem(item.id)}>
                                                                <Trash2 size={15} className="text-red-400" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Section 4: Text Blocks overrides */}
                            <div className="space-y-4">
                                <h4 className="font-bold text-indigo-400 border-b border-slate-850 pb-1.5 uppercase text-[9px] tracking-wider">4. Bloques de Textos y Clausulado</h4>
                                <div className="space-y-3">
                                    <div>
                                        <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Introducción / Carta Presentación</label>
                                        <textarea
                                            value={introText}
                                            onChange={(e) => { setIntroText(e.target.value); setIsTextDirty(true); }}
                                            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 h-16 resize-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Servicios Incluidos</label>
                                        <textarea
                                            value={includesText}
                                            onChange={(e) => { setIncludesText(e.target.value); setIsTextDirty(true); }}
                                            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 h-16 resize-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Cargos Excluidos</label>
                                        <textarea
                                            value={excludesText}
                                            onChange={(e) => { setExcludesText(e.target.value); setIsTextDirty(true); }}
                                            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 h-16 resize-none"
                                        />
                                    </div>
                                    {requirementsText && (
                                        <div>
                                            <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Requisitos de Aprobación</label>
                                            <textarea
                                                value={requirementsText}
                                                onChange={(e) => { setRequirementsText(e.target.value); setIsTextDirty(true); }}
                                                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 h-16 resize-none"
                                            />
                                        </div>
                                    )}
                                    <div>
                                        <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Condiciones Comerciales de Firma</label>
                                        <textarea
                                            value={conditionsText}
                                            onChange={(e) => { setConditionsText(e.target.value); setIsTextDirty(true); }}
                                            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 h-16 resize-none"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Section 5: Totals, Discounts and Taxes */}
                            <div className="space-y-4">
                                <h4 className="font-bold text-indigo-400 border-b border-slate-850 pb-1.5 uppercase text-[9px] tracking-wider">5. Configuración de IVA y Descuentos</h4>
                                <div className="grid grid-cols-3 gap-4">
                                    <Select
                                        label="Modo de IVA"
                                        value={ivaMode}
                                        onChange={(e) => setIvaMode(e.target.value as any)}
                                        options={[
                                            { value: 'ADD_21', label: 'Sumar IVA 21% al final' },
                                            { value: 'INCLUDED', label: 'Precios con IVA Incluido' },
                                            { value: 'PLUS_IVA', label: 'Leyenda Comercial (+ IVA)' },
                                            { value: 'EXEMPT', label: 'Exento' }
                                        ]}
                                    />
                                    <Select
                                        label="Tipo Descuento"
                                        value={discountType}
                                        onChange={(e) => {
                                            setDiscountType(e.target.value as any);
                                            setDiscountValue('0');
                                        }}
                                        options={[
                                            { value: 'NONE', label: 'Sin Descuento' },
                                            { value: 'PERCENT', label: 'Porcentaje (%)' },
                                            { value: 'FIXED', label: 'Importe Fijo ($)' }
                                        ]}
                                    />
                                    {discountType !== 'NONE' && (
                                        <Input
                                            label="Valor Descuento"
                                            type="number"
                                            value={discountValue}
                                            onChange={(e) => setDiscountValue(e.target.value)}
                                        />
                                    )}
                                </div>

                                <div className="border-t border-slate-800 pt-4 flex justify-between items-center text-sm">
                                    <div className="space-x-2">
                                        <Button variant="ghost" size="md" onClick={() => setActiveTab('list')}>
                                            Cancelar
                                        </Button>
                                        <Button variant="secondary" size="md" onClick={() => handleSaveBudget('borrador')}>
                                            Guardar Borrador
                                        </Button>
                                    </div>
                                    <Button variant="primary" size="md" onClick={() => handleSaveBudget('emitido')}>
                                        Emitir Propuesta
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Right Column: Live Proposal Preview */}
                    <div className="sticky top-24 space-y-4">
                        <div className="flex justify-between items-center">
                            <h4 className="font-bold text-slate-100 uppercase tracking-wider text-[10px]">Vista Previa en Tiempo Real</h4>
                            <span className="text-[10px] text-slate-500 italic">Actualización automática</span>
                        </div>
                        
                        <Card className="border-indigo-650/20 shadow-xl bg-slate-950">
                            <CardContent className="p-8 space-y-6 text-xs text-slate-300">
                                <div className="flex justify-between border-b border-slate-850 pb-4">
                                    <div>
                                        <h1 className="text-sm font-extrabold text-indigo-400 uppercase">M&S Tecnología Digital</h1>
                                        <p className="text-[9px] text-slate-500">CopyRent - Soluciones de Impresión</p>
                                    </div>
                                    <div className="text-right">
                                        <h2 className="font-bold text-slate-200">PROPUESTA DE SERVICIO</h2>
                                        <p className="text-[9px] text-slate-400">Fecha: {fecha.split('-').reverse().join('/')}</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 border-b border-slate-850 pb-4">
                                    <div>
                                        <span className="text-[9px] uppercase font-bold text-slate-500 block">Cliente Destinatario</span>
                                        <span className="font-bold text-slate-200 block mt-0.5">{clientName || <span className="text-slate-500 italic">[Nombre del Cliente]</span>}</span>
                                        {clientCuit && <span className="text-[10px] text-slate-400 block mt-0.5">CUIT: {clientCuit}</span>}
                                    </div>
                                    <div>
                                        <span className="text-[9px] uppercase font-bold text-slate-500 block">Ubicación y Contacto</span>
                                        <span className="text-slate-350 block mt-0.5">{clientAddress || <span className="text-slate-500 italic">[Dirección]</span>}</span>
                                        <span className="text-slate-400 block">{clientPhone} | {clientEmail}</span>
                                    </div>
                                </div>

                                {introText && (
                                    <p className="text-slate-300 italic border-l-2 border-indigo-600 pl-3 leading-relaxed">{introText}</p>
                                )}

                                {/* Rental machines block */}
                                {tipo === 'alquiler' && formMachines.length > 0 && (
                                    <div className="space-y-4">
                                        <h4 className="text-[9px] font-extrabold uppercase text-slate-400 tracking-wider">Equipos y Abonos Propuestos</h4>
                                        {formMachines.map((m, i) => (
                                            <div key={i} className="p-4 bg-slate-900/40 border border-slate-800 rounded-xl space-y-2">
                                                <div className="flex justify-between border-b border-slate-800 pb-1.5">
                                                    <span className="font-bold text-slate-200">{m.machineBrand} {m.machineModel} ({m.cantidad} Unidad/es)</span>
                                                    <span className="text-indigo-400 font-bold font-mono-tabular">{formatCurrency(m.abonoBase)} / base</span>
                                                </div>
                                                <p className="text-[10px] text-slate-400">{m.technicalSummary}</p>
                                                <div className="grid grid-cols-2 gap-4 text-[10px] pt-1">
                                                    <div>
                                                        <pre className="font-sans text-slate-350 whitespace-pre-wrap">{m.editableSpecsText}</pre>
                                                    </div>
                                                    <div className="border-l border-slate-800 pl-4 space-y-1">
                                                        <span className="font-bold text-slate-300 block uppercase text-[9px]">{m.planNombre}</span>
                                                        <div className="flex justify-between text-slate-400">
                                                            <span>Copias libres:</span>
                                                            <span className="font-bold">{m.copiasIncluidas.toLocaleString('es-AR')}</span>
                                                        </div>
                                                        <div className="flex justify-between text-slate-450">
                                                            <span>Copia excedente:</span>
                                                            <span className="font-bold font-mono-tabular">{formatCurrency(m.copiaExcedente)}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Simple items table */}
                                {tipo !== 'alquiler' && items.length > 0 && (
                                    <TableContainer>
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHeaderCell>Descripción / Detalle</TableHeaderCell>
                                                    <TableHeaderCell>Cantidad</TableHeaderCell>
                                                    <TableHeaderCell>Precio Unitario</TableHeaderCell>
                                                    <TableHeaderCell className="text-right">Subtotal</TableHeaderCell>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {items.map((item, i) => (
                                                    <TableRow key={i}>
                                                        <TableCell className="font-bold text-slate-200">{item.descripcion || <span className="text-slate-500 italic">[Descripción]</span>}</TableCell>
                                                        <TableCell className="font-mono-tabular text-slate-300">{item.cantidad}</TableCell>
                                                        <TableCell className="font-mono-tabular text-slate-300">{formatCurrency(item.precioUnitario)}</TableCell>
                                                        <TableCell className="font-mono-tabular text-right text-slate-200">{formatCurrency(item.subtotal)}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </TableContainer>
                                )}

                                {/* Financials Summary */}
                                <div className="border-t border-slate-800 pt-4 flex flex-col items-end space-y-1 text-xs">
                                    <div className="flex justify-between w-64 text-slate-400">
                                        <span>Subtotal:</span>
                                        <span className="font-mono-tabular">{formatCurrency(financialResults.subtotalRaw)}</span>
                                    </div>
                                    {financialResults.discountAmount > 0 && (
                                        <div className="flex justify-between w-64 text-red-400">
                                            <span>Descuento:</span>
                                            <span className="font-mono-tabular">-{formatCurrency(financialResults.discountAmount)}</span>
                                        </div>
                                    )}
                                    {ivaMode === 'ADD_21' && (
                                        <div className="flex justify-between w-64 text-slate-400 border-t border-slate-900 pt-1">
                                            <span>IVA (21%):</span>
                                            <span className="font-mono-tabular">{formatCurrency(financialResults.ivaAmount)}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between w-64 font-extrabold text-sm text-indigo-400 border-t border-slate-800 pt-2">
                                        <span>Total Comercial:</span>
                                        <span className="font-mono-tabular">{formatCurrency(financialResults.total)}</span>
                                    </div>
                                    
                                    <span className="text-[9px] text-slate-500 italic mt-1 block">
                                        {ivaMode === 'INCLUDED' && 'Los precios indicados incluyen IVA.'}
                                        {ivaMode === 'PLUS_IVA' && 'Los precios indicados no incluyen IVA (Precios + IVA).'}
                                        {ivaMode === 'EXEMPT' && 'Operación exenta de IVA.'}
                                    </span>
                                </div>

                                <div className="border-t border-slate-850 pt-4 grid grid-cols-2 gap-4 text-[10px] text-slate-400">
                                    <div className="space-y-1">
                                        <span className="font-bold text-slate-350 block uppercase text-[8px] tracking-wider">Cláusulas</span>
                                        <p>Validez oferta: <strong>{validezOferta}</strong></p>
                                        {tipo === 'alquiler' && <p>Plazo contrato: <strong>{plazoContrato}</strong></p>}
                                        {conditionsText && <p className="text-[9px] text-slate-550 mt-1.5 leading-normal">{conditionsText}</p>}
                                    </div>
                                    <div className="space-y-1">
                                        <span className="font-bold text-slate-350 block uppercase text-[8px] tracking-wider">Soporte Incluido</span>
                                        {includesText && <p className="text-[9px] text-slate-450 leading-relaxed">{includesText}</p>}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            )}

            {/* TAB 3: MACHINE PRESETS CATALOG */}
            {activeTab === 'presets' && (
                <div className="space-y-4 print:hidden">
                    <div className="flex justify-between items-center">
                        <h3 className="font-bold text-sm text-slate-100">Catálogo de Equipos Preconfigurados (Presets)</h3>
                        <Button variant="primary" size="sm" onClick={() => handleOpenPresetForm()}>
                            <Plus size={16} className="mr-1.5" /> Registrar Preset
                        </Button>
                    </div>

                    <TableContainer>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHeaderCell>Equipo / Modelo</TableHeaderCell>
                                    <TableHeaderCell>Tipo</TableHeaderCell>
                                    <TableHeaderCell>PPM</TableHeaderCell>
                                    <TableHeaderCell>Resumen Técnico Comercial</TableHeaderCell>
                                    <TableHeaderCell className="text-right">Acciones</TableHeaderCell>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {machinePresets.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-8 text-slate-400 text-xs">
                                            No hay equipos presets en el catálogo.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    machinePresets.map(p => (
                                        <TableRow key={p.id}>
                                            <TableCell className="font-bold text-slate-100">{p.nombreComercial}</TableCell>
                                            <TableCell className="text-xs text-slate-350">{p.tipo}</TableCell>
                                            <TableCell className="text-xs font-mono-tabular text-slate-300">{p.ppm} ppm</TableCell>
                                            <TableCell className="text-xs text-slate-400 max-w-sm truncate">{p.technicalSummary}</TableCell>
                                            <TableCell className="text-right space-x-1">
                                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handleOpenPresetForm(p)}>
                                                    <Edit size={14} className="text-slate-450 hover:text-slate-200" />
                                                </Button>
                                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handleDeletePreset(p.id)}>
                                                    <Trash2 size={14} className="text-red-400 hover:text-red-350" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </div>
            )}

            {/* TAB 4: TEMPLATES CATALOG */}
            {activeTab === 'templates' && (
                <div className="space-y-4 print:hidden">
                    <div className="flex justify-between items-center">
                        <h3 className="font-bold text-sm text-slate-100">Catálogo de Plantillas de Textos Comerciales</h3>
                        <Button variant="primary" size="sm" onClick={() => handleOpenTemplateForm()}>
                            <Plus size={16} className="mr-1.5" /> Nueva Plantilla
                        </Button>
                    </div>

                    <TableContainer>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHeaderCell>Nombre</TableHeaderCell>
                                    <TableHeaderCell>Tipo de Propuesta</TableHeaderCell>
                                    <TableHeaderCell>Texto de Introducción</TableHeaderCell>
                                    <TableHeaderCell className="text-right">Acciones</TableHeaderCell>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {templates.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center py-8 text-slate-400 text-xs">
                                            No hay plantillas de texto en el catálogo.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    templates.map(t => (
                                        <TableRow key={t.id}>
                                            <TableCell className="font-bold text-slate-100">{t.nombre}</TableCell>
                                            <TableCell className="text-xs text-indigo-400 uppercase font-bold">{t.tipo.replace('_', ' ')}</TableCell>
                                            <TableCell className="text-xs text-slate-450 max-w-sm truncate">{t.defaultIntroText}</TableCell>
                                            <TableCell className="text-right space-x-1">
                                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handleOpenTemplateForm(t)}>
                                                    <Edit size={14} className="text-slate-450 hover:text-slate-200" />
                                                </Button>
                                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handleDeleteTemplate(t.id)}>
                                                    <Trash2 size={14} className="text-red-400 hover:text-red-350" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </div>
            )}

            {/* PRINT-ONLY ACTUAL LAYOUT OF PROPOSAL */}
            {selectedBudget && (
                <div id="print-only-budget" className="hidden print:block print:w-full print:p-0 print:m-0 print:bg-white print:text-black">
                    <div className="space-y-6">
                        <div className="flex justify-between items-center border-b pb-4">
                            <div className="flex items-center gap-3">
                                <img src="/logo.png" alt="Logo M&S" className="h-12 w-auto object-contain" />
                                <div>
                                    <h1 className="text-lg font-bold">M&S Tecnología Digital</h1>
                                    <p className="text-[10px] text-slate-500">Servicios de Impresión Corporativa y Alquileres</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <h2 className="text-sm font-bold">PROPUESTA DE SERVICIO</h2>
                                <p className="text-[10px]">Fecha: {selectedBudget.fecha.split('-').reverse().join('/')}</p>
                                <p className="text-[10px] font-bold">Número: {selectedBudget.numero}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <span className="text-[9px] uppercase font-bold text-slate-500 block">PROPUESTO PARA</span>
                                <span className="font-bold block text-sm mt-0.5">{selectedBudget.clientSnapshot.nombreRazonSocial}</span>
                                {selectedBudget.clientSnapshot.cuitCuil && <span className="text-[10px] block mt-0.5">CUIT: {selectedBudget.clientSnapshot.cuitCuil}</span>}
                            </div>
                            <div>
                                <span className="text-[9px] uppercase font-bold text-slate-500 block">INSTALACIÓN Y CONTACTO</span>
                                <span className="block mt-0.5">{selectedBudget.clientSnapshot.domicilio}</span>
                                <span className="block">{selectedBudget.clientSnapshot.telefono} | {selectedBudget.clientSnapshot.email}</span>
                            </div>
                        </div>

                        {selectedBudget.introText && (
                            <p className="italic border-l-2 border-slate-400 pl-3 leading-relaxed">{selectedBudget.introText}</p>
                        )}

                        {/* Rental Machines Block */}
                        {selectedBudget.tipo === 'alquiler' && selectedBudget.machines.length > 0 && (
                            <div className="space-y-4">
                                <h4 className="text-[9px] font-bold uppercase text-slate-500 tracking-wider">Equipos y Abonos Propuestos</h4>
                                {selectedBudget.machines.map((m, i) => (
                                    <div key={i} className="p-4 border rounded-xl space-y-2">
                                        <div className="flex justify-between border-b pb-1.5">
                                            <span className="font-bold">{m.machineBrand} {m.machineModel} ({m.cantidad} Unidad/es)</span>
                                            <span className="font-bold font-mono-tabular">{formatCurrency(m.abonoBase)} / base</span>
                                        </div>
                                        <p className="text-[10px]">{m.technicalSummary}</p>
                                        <div className="grid grid-cols-2 gap-4 text-[10px] pt-1">
                                            <div>
                                                <pre className="font-sans whitespace-pre-wrap">{m.editableSpecsText}</pre>
                                            </div>
                                            <div className="border-l pl-4 space-y-1">
                                                <span className="font-bold block uppercase text-[9px]">{m.planNombre}</span>
                                                <div className="flex justify-between">
                                                    <span>Copias libres:</span>
                                                    <span className="font-bold">{m.copiasIncluidas.toLocaleString('es-AR')}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span>Copia excedente:</span>
                                                    <span className="font-bold font-mono-tabular">{formatCurrency(m.copiaExcedente)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Simple items table */}
                        {selectedBudget.tipo !== 'alquiler' && selectedBudget.items.length > 0 && (
                            <TableContainer className="border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHeaderCell>Descripción / Detalle</TableHeaderCell>
                                            <TableHeaderCell>Cantidad</TableHeaderCell>
                                            <TableHeaderCell>Precio Unitario</TableHeaderCell>
                                            <TableHeaderCell className="text-right">Subtotal</TableHeaderCell>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {selectedBudget.items.map((item, i) => (
                                            <TableRow key={i}>
                                                <TableCell className="font-bold">{item.descripcion}</TableCell>
                                                <TableCell className="font-mono-tabular">{item.cantidad}</TableCell>
                                                <TableCell className="font-mono-tabular">{formatCurrency(item.precioUnitario)}</TableCell>
                                                <TableCell className="font-mono-tabular text-right">{formatCurrency(item.subtotal)}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        )}

                        {/* Financial Breakdown */}
                        <div className="pt-4 flex flex-col items-end space-y-1 text-xs">
                            <div className="flex justify-between w-64">
                                <span>Subtotal:</span>
                                <span className="font-mono-tabular">{formatCurrency(selectedBudget.subtotal)}</span>
                            </div>
                            {selectedBudget.discountAmount > 0 && (
                                <div className="flex justify-between w-64 text-red-650">
                                    <span>Descuento:</span>
                                    <span className="font-mono-tabular">-{formatCurrency(selectedBudget.discountAmount)}</span>
                                </div>
                            )}
                            {selectedBudget.ivaMode === 'ADD_21' && (
                                <div className="flex justify-between w-64 border-t pt-1">
                                    <span>IVA (21%):</span>
                                    <span className="font-mono-tabular">{formatCurrency(selectedBudget.ivaAmount)}</span>
                                </div>
                            )}
                            <div className="flex justify-between w-64 font-bold text-sm border-t pt-2">
                                <span>Total General:</span>
                                <span className="font-mono-tabular">{formatCurrency(selectedBudget.total)}</span>
                            </div>
                            
                            <span className="text-[9px] text-slate-500 italic mt-1 block">
                                {selectedBudget.ivaMode === 'INCLUDED' && 'Los precios indicados incluyen IVA.'}
                                {selectedBudget.ivaMode === 'PLUS_IVA' && 'Los precios indicados no incluyen IVA (Precios + IVA).'}
                                {selectedBudget.ivaMode === 'EXEMPT' && 'Operación exenta de IVA.'}
                            </span>
                        </div>

                        {/* Commercial Terms block */}
                        <div className="border-t pt-4 grid grid-cols-2 gap-4 text-[10px]">
                            <div className="space-y-1">
                                <span className="font-bold block uppercase text-[8px] tracking-wider">Condiciones Comerciales</span>
                                <p>Validez de la oferta: <strong>{selectedBudget.validezOferta}</strong></p>
                                {selectedBudget.tipo === 'alquiler' && (
                                    <>
                                        <p>Plazo mínimo de contrato: <strong>{selectedBudget.plazoMinimoContrato}</strong></p>
                                        <p>Ajuste de precio: <strong>{selectedBudget.ajustePrecios}</strong></p>
                                    </>
                                )}
                                {selectedBudget.conditionsText && (
                                    <p className="text-[9px] text-slate-550 pt-1.5 leading-normal">{selectedBudget.conditionsText}</p>
                                )}
                            </div>
                            <div className="space-y-1">
                                <span className="font-bold block uppercase text-[8px] tracking-wider">Servicios y Soporte Incluidos</span>
                                {selectedBudget.includesText && (
                                    <p className="text-[9px] leading-relaxed">{selectedBudget.includesText}</p>
                                )}
                            </div>
                        </div>

                        {/* Requirements for non-state client */}
                        {selectedBudget.requirementsText && (
                            <div className="border-t pt-4 text-[9px] text-slate-500">
                                <span className="font-bold block uppercase text-[8px] tracking-wider mb-1">Requisitos de Contratación</span>
                                <p className="leading-relaxed">{selectedBudget.requirementsText}</p>
                            </div>
                        )}

                        <div className="flex justify-between pt-16 text-[10px]">
                            <div className="border-t w-52 text-center pt-2">Firma y Aclaración M&S</div>
                            <div className="border-t w-52 text-center pt-2">Firma y Aclaración Cliente</div>
                        </div>

                        <div className="text-center pt-12 text-[9px] text-slate-400 border-t">
                            {selectedBudget.footerText}
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Share Email */}
            <Modal
                isOpen={isEmailModalOpen}
                onClose={() => setIsEmailModalOpen(false)}
                title="Compartir Propuesta por Email"
                footer={
                    <>
                        <Button variant="ghost" size="sm" onClick={() => setIsEmailModalOpen(false)}>
                            Cancelar
                        </Button>
                        <Button variant="primary" size="sm" onClick={handleSendEmail}>
                            Enviar Email
                        </Button>
                    </>
                }
            >
                <form className="space-y-4 text-xs" onSubmit={handleSendEmail}>
                    <Input
                        label="Correo del Destinatario *"
                        type="email"
                        value={shareEmail}
                        onChange={(e) => setShareEmail(e.target.value)}
                        required
                    />
                    <Input
                        label="Asunto *"
                        value={shareSubject}
                        onChange={(e) => setShareSubject(e.target.value)}
                        required
                    />
                    <div>
                        <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Mensaje Adjunto</label>
                        <textarea
                            value={shareMessage}
                            onChange={(e) => setShareMessage(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 h-24 resize-none"
                            required
                        />
                    </div>
                    <span className="text-[10px] text-slate-500 italic block">ℹ️ Se adjuntará automáticamente una versión digital de la propuesta en formato PDF.</span>
                </form>
            </Modal>

            {/* Modal: Share WhatsApp */}
            <Modal
                isOpen={isWhatsappModalOpen}
                onClose={() => setIsWhatsappModalOpen(false)}
                title="Enviar Enlace de WhatsApp"
                footer={
                    <>
                        <Button variant="ghost" size="sm" onClick={() => setIsWhatsappModalOpen(false)}>
                            Cancelar
                        </Button>
                        <Button variant="primary" size="sm" className="bg-emerald-600 hover:bg-emerald-555 text-white" onClick={handleSendWhatsapp}>
                            Continuar a WhatsApp
                        </Button>
                    </>
                }
            >
                <form className="space-y-4 text-xs" onSubmit={handleSendWhatsapp}>
                    <Input
                        label="Número de WhatsApp (Con código de área, ej: 5491155551234) *"
                        value={sharePhone}
                        onChange={(e) => setSharePhone(e.target.value)}
                        required
                    />
                    <div>
                        <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Mensaje Editable</label>
                        <textarea
                            value={shareMessage}
                            onChange={(e) => setShareMessage(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 h-32 resize-none"
                            required
                        />
                    </div>
                </form>
            </Modal>

            {/* Modal: Preset Form (Catalog) */}
            <Modal
                isOpen={isPresetModalOpen}
                onClose={() => setIsPresetModalOpen(false)}
                title={editingPreset ? 'Editar Preset de Máquina' : 'Registrar Nuevo Preset de Máquina'}
                footer={
                    <>
                        <Button variant="ghost" size="sm" onClick={() => setIsPresetModalOpen(false)}>
                            Cancelar
                        </Button>
                        <Button variant="primary" size="sm" onClick={handleSavePreset}>
                            Guardar Preset
                        </Button>
                    </>
                }
            >
                <form className="space-y-4 text-xs" onSubmit={handleSavePreset}>
                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            label="Marca *"
                            value={presetMarca}
                            onChange={(e) => setPresetMarca(e.target.value)}
                            required
                            placeholder="HP, Brother, Ricoh"
                        />
                        <Input
                            label="Modelo *"
                            value={presetModelo}
                            onChange={(e) => setPresetModelo(e.target.value)}
                            required
                            placeholder="Ej: IM 430F"
                        />
                    </div>
                    <Input
                        label="Nombre Comercial"
                        value={presetNombre}
                        onChange={(e) => setPresetNombre(e.target.value)}
                        placeholder="Ej: Ricoh IM 430F Corporativo"
                    />
                    <div className="grid grid-cols-2 gap-4">
                        <Select
                            label="Tipo de Copiado"
                            value={presetTipo}
                            onChange={(e) => setPresetTipo(e.target.value)}
                            options={[
                                { value: 'Monocromática (B&N)', label: 'Monocromática (B&N)' },
                                { value: 'Color', label: 'Color' }
                            ]}
                        />
                        <Input
                            label="Velocidad (PPM) *"
                            type="number"
                            value={presetPpm}
                            onChange={(e) => setPresetPpm(e.target.value)}
                            required
                        />
                    </div>
                    <div>
                        <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Especificaciones Técnicas resumidas *</label>
                        <textarea
                            value={presetSpecs}
                            onChange={(e) => setPresetSpecs(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 h-20 resize-none"
                            required
                            placeholder="Resolución, duplex, capacidad de papel..."
                        />
                    </div>
                    <div>
                        <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Notas Comerciales</label>
                        <textarea
                            value={presetNotes}
                            onChange={(e) => setPresetNotes(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 h-16 resize-none"
                            placeholder="Recomendaciones comerciales..."
                        />
                    </div>
                </form>
            </Modal>

            {/* Modal: Template Form (Catalog) */}
            <Modal
                isOpen={isTemplateModalOpen}
                onClose={() => setIsTemplateModalOpen(false)}
                title={editingTemplate ? 'Editar Plantilla de Textos' : 'Nueva Plantilla de Textos'}
                footer={
                    <>
                        <Button variant="ghost" size="sm" onClick={() => setIsTemplateModalOpen(false)}>
                            Cancelar
                        </Button>
                        <Button variant="primary" size="sm" onClick={handleSaveTemplate}>
                            Guardar Plantilla
                        </Button>
                    </>
                }
            >
                <form className="space-y-4 text-xs" onSubmit={handleSaveTemplate}>
                    <Input
                        label="Nombre de la Plantilla *"
                        value={tempNombre}
                        onChange={(e) => setTempNombre(e.target.value)}
                        required
                        placeholder="Ej: Alquiler Corporativo"
                    />
                    <Select
                        label="Tipo de Propuesta Asociado"
                        value={tempTipo}
                        onChange={(e) => setTempTipo(e.target.value as any)}
                        options={[
                            { value: 'alquiler', label: 'Alquiler de Copiadoras' },
                            { value: 'insumo', label: 'Insumos / Consumibles' },
                            { value: 'repuesto', label: 'Venta de Repuestos' },
                            { value: 'servicio_tecnico', label: 'Servicio Técnico' },
                            { value: 'mixto', label: 'Mixto' }
                        ]}
                    />
                    <div>
                        <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Texto Introductorio de Propuesta *</label>
                        <textarea
                            value={tempIntro}
                            onChange={(e) => setTempIntro(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 h-16 resize-none"
                            required
                        />
                    </div>
                    <div>
                        <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Cláusulas / Condiciones de Vencimiento</label>
                        <textarea
                            value={tempConditions}
                            onChange={(e) => setTempConditions(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 h-16 resize-none"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Servicios Incluidos por defecto</label>
                        <textarea
                            value={tempIncludes}
                            onChange={(e) => setTempIncludes(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 h-16 resize-none"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Conceptos Excluidos por defecto</label>
                        <textarea
                            value={tempExcludes}
                            onChange={(e) => setTempExcludes(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 h-16 resize-none"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Requisitos de Contratación mínimos</label>
                        <textarea
                            value={tempReqs}
                            onChange={(e) => setTempReqs(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 h-16 resize-none"
                        />
                    </div>
                </form>
            </Modal>
        </div>
    );
}
