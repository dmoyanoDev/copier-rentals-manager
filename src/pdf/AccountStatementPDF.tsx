import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import { BRANDING } from '@/config/branding';
import type { LocalClient } from '@/lib/context';
import type { ClientMovement } from '@/lib/utils';

const formatCurrency = (val: number) => {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2
  }).format(val);
};

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: '#1e293b',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingBottom: 15,
    marginBottom: 20,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    width: 40,
    height: 40,
    marginRight: 10,
  },
  companyName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  companySubtitle: {
    fontSize: 8,
    color: '#64748b',
    marginTop: 2,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  docTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#1e3a8a',
  },
  docInfo: {
    fontSize: 8,
    color: '#475569',
    marginTop: 2,
  },
  grid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  col: {
    width: '48%',
  },
  sectionTitle: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#64748b',
    textTransform: 'uppercase',
    borderBottomWidth: 1,
    borderBottomColor: '#cbd5e1',
    paddingBottom: 3,
    marginBottom: 6,
  },
  textRow: {
    marginBottom: 2,
  },
  summaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 6,
    padding: 10,
    marginBottom: 14,
  },
  summaryItem: {
    width: '23%',
  },
  summaryLabel: {
    fontSize: 7,
    color: '#64748b',
    textTransform: 'uppercase',
    fontWeight: 'bold',
    marginBottom: 2,
  },
  summaryValue: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  table: {
    width: '100%',
    marginBottom: 12,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderBottomWidth: 1,
    borderBottomColor: '#cbd5e1',
    padding: 5,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    padding: 5,
  },
  th: {
    fontWeight: 'bold',
    fontSize: 7.5,
  },
  td: {
    fontSize: 7.5,
  },
  statusBanner: {
    fontSize: 8,
    fontWeight: 'bold',
    backgroundColor: '#f1f5f9',
    borderLeftWidth: 3,
    borderLeftColor: '#4f46e5',
    padding: 8,
    marginBottom: 14,
  },
  adminPanel: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    padding: 10,
    borderRadius: 6,
    marginBottom: 14,
  },
  signatures: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 35,
  },
  signatureLine: {
    borderTopWidth: 1,
    borderTopColor: '#475569',
    width: 180,
    textAlign: 'center',
    paddingTop: 4,
    fontSize: 8,
  },
});

interface Props {
  client: LocalClient;
  movements: ClientMovement[];
  summary: {
    saldo: number;
    vencido: number;
    noVencido: number;
    countPending: number;
    score: number;
    riskLevel: string;
    avgPayDays: number;
    maxMora: number;
  };
  version: 'comercial' | 'interna';
}

export const AccountStatementPDF = ({ client, movements, summary, version }: Props) => {
  const statusObservation = summary.vencido > 0
    ? 'DEUDOR CON SALDO VENCIDO EXIGIBLE'
    : (summary.saldo > 0 ? 'SALDO ACTIVO SIN VENCIMIENTO' : 'CUENTA CORRIENTE SANEADA - AL DÍA');

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Image
              src={typeof window !== 'undefined' ? `${window.location.origin}/logo.png` : '/logo.png'}
              style={styles.logo}
            />
            <View>
              <Text style={styles.companyName}>{BRANDING.commercialName}</Text>
              <Text style={styles.companySubtitle}>{BRANDING.tagline}</Text>
              <Text style={{ fontSize: 7, color: '#64748b', marginTop: 1 }}>CUIT: {BRANDING.cuit} | CP: {BRANDING.postalCode}</Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.docTitle}>ESTADO DE CUENTA {version === 'interna' ? 'INTERNO' : 'COMERCIAL'}</Text>
            <Text style={styles.docInfo}>Generado: {new Date().toLocaleDateString('es-AR')} {new Date().toLocaleTimeString('es-AR')}</Text>
          </View>
        </View>

        {/* Client info */}
        <View style={styles.grid}>
          <View style={styles.col}>
            <Text style={styles.sectionTitle}>DATOS DEL CLIENTE</Text>
            <Text style={[styles.textRow, { fontWeight: 'bold' }]}>{client.name}</Text>
            <Text style={styles.textRow}>CUIT: {client.cuit}</Text>
            <Text style={styles.textRow}>Categoría Fiscal: {client.taxCategory}</Text>
          </View>
          <View style={styles.col}>
            <Text style={styles.sectionTitle}>CONTACTO</Text>
            <Text style={styles.textRow}>Dirección: {client.address || 'Sin especificar'}</Text>
            <Text style={styles.textRow}>Teléfono: {client.phone || 'N/A'}</Text>
            <Text style={styles.textRow}>Email: {client.email || 'N/A'}</Text>
          </View>
        </View>

        {/* Financial summary */}
        <View style={styles.summaryGrid}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Saldo Total</Text>
            <Text style={styles.summaryValue}>{formatCurrency(summary.saldo)}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryLabel, { color: '#ef4444' }]}>Vencido</Text>
            <Text style={[styles.summaryValue, { color: '#ef4444' }]}>{formatCurrency(summary.vencido)}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryLabel, { color: '#3b82f6' }]}>A Vencer</Text>
            <Text style={[styles.summaryValue, { color: '#3b82f6' }]}>{formatCurrency(summary.noVencido)}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Documentos</Text>
            <Text style={styles.summaryValue}>{summary.countPending} impagos</Text>
          </View>
        </View>

        {version === 'interna' && (
          <View style={styles.adminPanel}>
            <Text style={[styles.sectionTitle, { color: '#4f46e5' }]}>INFORMACIÓN EXCLUSIVA DE ADMINISTRACIÓN</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
              <Text style={{ fontSize: 8 }}>Score de Cobrabilidad: <Text style={{ fontWeight: 'bold' }}>{summary.score} / 100</Text> ({summary.riskLevel})</Text>
              <Text style={{ fontSize: 8 }}>Promedio Días de Pago: <Text style={{ fontWeight: 'bold' }}>{summary.avgPayDays} días</Text></Text>
              <Text style={{ fontSize: 8 }}>Mora Máxima: <Text style={{ fontWeight: 'bold' }}>{summary.maxMora} días</Text></Text>
            </View>
            <Text style={{ fontSize: 8 }}>Notas Internas Comerciales:</Text>
            <Text style={{ fontSize: 8, color: '#475569', fontStyle: 'italic', marginTop: 2 }}>
              &quot;{client.cobranzaNotas || 'Sin notas comerciales internas'}&quot;
            </Text>
          </View>
        )}

        <View style={styles.statusBanner}>
          <Text>Situación Financiera: {statusObservation} (Mora Máxima: {summary.maxMora} días)</Text>
        </View>

        {/* Movements table */}
        <Text style={{ fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 6, color: '#1e293b' }}>
          Detalle de Cuenta Corriente
        </Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.th, { width: '12%' }]}>Fecha</Text>
            <Text style={[styles.th, { width: '10%' }]}>Tipo</Text>
            <Text style={[styles.th, { width: '30%' }]}>Concepto</Text>
            <Text style={[styles.th, { width: '16%', textAlign: 'right' }]}>Original</Text>
            <Text style={[styles.th, { width: '16%', textAlign: 'right' }]}>Cobrado</Text>
            <Text style={[styles.th, { width: '16%', textAlign: 'right' }]}>Pendiente</Text>
          </View>
          {movements.map((m, index) => (
            <View key={m.id || index} style={styles.tableRow}>
              <Text style={[styles.td, { width: '12%' }]}>{m.date}</Text>
              <Text style={[styles.td, { width: '10%' }]}>{m.type}</Text>
              <Text style={[styles.td, { width: '30%' }]}>{m.concept}</Text>
              <Text style={[styles.td, { width: '16%', textAlign: 'right' }]}>{formatCurrency(m.original)}</Text>
              <Text style={[styles.td, { width: '16%', textAlign: 'right' }]}>{formatCurrency(m.paid)}</Text>
              <Text style={[styles.td, { width: '16%', textAlign: 'right', fontWeight: 'bold', color: m.pending > 0 ? '#ef4444' : '#10b981' }]}>
                {formatCurrency(m.pending)}
              </Text>
            </View>
          ))}
        </View>

        {/* Signatures */}
        <View style={styles.signatures}>
          <Text style={styles.signatureLine}>Firma y Aclaración {BRANDING.commercialName}</Text>
          <Text style={styles.signatureLine}>Firma y Aclaración Cliente</Text>
        </View>

        <View style={{ position: 'absolute', bottom: 15, left: 30, right: 30, borderTopWidth: 0.5, borderTopColor: '#e2e8f0', paddingTop: 4, alignItems: 'center' }}>
          <Text style={{ fontSize: 7, color: '#94a3b8' }}>
            {BRANDING.legalName} — {BRANDING.address}, CP {BRANDING.postalCode}, {BRANDING.city} — Tel: {BRANDING.phones}
          </Text>
        </View>
      </Page>
    </Document>
  );
};
