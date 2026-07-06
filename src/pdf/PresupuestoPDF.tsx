import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import { Budget } from '@/domain/budget/types';
import { BRANDING } from '@/config/branding';

// Helper to format currency
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
  titleContainer: {},
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
  section: {
    marginBottom: 12,
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
  introText: {
    fontStyle: 'italic',
    fontSize: 9,
    lineHeight: 1.3,
    color: '#334155',
    marginBottom: 12,
  },
  table: {
    width: '100%',
    marginBottom: 12,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
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
    fontSize: 8,
  },
  td: {
    fontSize: 8,
  },
  summaryBlock: {
    alignItems: 'flex-end',
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: 180,
    marginBottom: 2,
  },
  summaryTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: 180,
    borderTopWidth: 1,
    borderTopColor: '#0f172a',
    paddingTop: 3,
    marginTop: 2,
    fontWeight: 'bold',
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

export const PresupuestoPDF = ({ budget }: { budget: Budget }) => {
  const client = budget.clientSnapshot;

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
            <View style={styles.titleContainer}>
              <Text style={styles.companyName}>{BRANDING.commercialName}</Text>
              <Text style={styles.companySubtitle}>{BRANDING.tagline}</Text>
              <Text style={{ fontSize: 7, color: '#64748b', marginTop: 1 }}>CUIT: {BRANDING.cuit} | CP: {BRANDING.postalCode}</Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.docTitle}>PROPUESTA COMERCIAL</Text>
            <Text style={styles.docInfo}>Fecha: {budget.fecha}</Text>
            <Text style={styles.docInfo}>Número: {budget.numero}</Text>
          </View>
        </View>

        {/* Client & Installation Info */}
        <View style={styles.grid}>
          <View style={styles.col}>
            <Text style={styles.sectionTitle}>PROPUESTO PARA</Text>
            <Text style={[styles.textRow, { fontWeight: 'bold' }]}>{client.nombreRazonSocial}</Text>
            {client.cuitCuil && <Text style={styles.textRow}>CUIT: {client.cuitCuil}</Text>}
            {client.domicilio && <Text style={styles.textRow}>Dirección: {client.domicilio}</Text>}
          </View>
          <View style={styles.col}>
            <Text style={styles.sectionTitle}>INSTALACIÓN Y CONTACTO</Text>
            {client.telefono && <Text style={styles.textRow}>Teléfono: {client.telefono}</Text>}
            {client.email && <Text style={styles.textRow}>Email: {client.email}</Text>}
            {client.contacto && <Text style={styles.textRow}>Contacto: {client.contacto}</Text>}
          </View>
        </View>

        {/* Intro text */}
        {budget.introText && (
          <Text style={styles.introText}>{budget.introText}</Text>
        )}

        {/* Rental Machines Block */}
        {budget.machines && budget.machines.length > 0 && (
          <View style={{ marginBottom: 12 }}>
            <Text style={styles.sectionTitle}>Equipos y Abonos Propuestos (Alquiler)</Text>
            {budget.machines.map((m, index) => (
              <View key={index} style={{ border: '1px solid #e2e8f0', borderRadius: 6, padding: 6, marginBottom: 6 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: 3, marginBottom: 3 }}>
                  <Text style={{ fontWeight: 'bold' }}>{m.machineBrand} {m.machineModel} ({m.cantidad} Unidad/es)</Text>
                  <Text style={{ fontWeight: 'bold' }}>{formatCurrency(m.abonoBase)} / base</Text>
                </View>
                <Text style={{ fontSize: 7.5, color: '#64748b', marginBottom: 3 }}>{m.technicalSummary}</Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', fontSize: 7.5 }}>
                  <View style={{ width: '55%' }}>
                    <Text>{m.editableSpecsText}</Text>
                  </View>
                  <View style={{ width: '40%', borderLeft: '1px solid #e2e8f0', paddingLeft: 6 }}>
                    <Text style={{ fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 2 }}>{m.planNombre}</Text>
                    <Text>Copias libres: {m.copiasIncluidas.toLocaleString('es-AR')}</Text>
                    <Text>Copia excedente: {formatCurrency(m.copiaExcedente)}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* General Items Block */}
        {budget.items && budget.items.length > 0 && (
          <View style={{ marginBottom: 12 }}>
            <Text style={styles.sectionTitle}>Conceptos Detallados (Venta, Insumos, Repuestos y Servicios)</Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.th, { width: '45%' }]}>Descripción / Detalle</Text>
                <Text style={[styles.th, { width: '15%', textAlign: 'center' }]}>Categoría</Text>
                <Text style={[styles.th, { width: '10%', textAlign: 'center' }]}>Cant.</Text>
                <Text style={[styles.th, { width: '15%', textAlign: 'right' }]}>Precio Unit.</Text>
                <Text style={[styles.th, { width: '15%', textAlign: 'right' }]}>Subtotal</Text>
              </View>
              {budget.items.map((item, index) => (
                <View key={index} style={styles.tableRow}>
                  <View style={{ width: '45%' }}>
                    <Text style={[styles.td, { fontWeight: 'bold' }]}>{item.descripcion}</Text>
                    {item.metadata && (() => {
                      try {
                        const meta = JSON.parse(item.metadata);
                        if (meta.observaciones) {
                          return <Text style={{ fontSize: 6.5, color: '#64748b', marginTop: 1 }}>Obs: {meta.observaciones}</Text>;
                        }
                      } catch(e) {}
                      return null;
                    })()}
                  </View>
                  <Text style={[styles.td, { width: '15%', textAlign: 'center' }]}>{item.categoria}</Text>
                  <Text style={[styles.td, { width: '10%', textAlign: 'center' }]}>{item.cantidad}</Text>
                  <Text style={[styles.td, { width: '15%', textAlign: 'right' }]}>{formatCurrency(item.precioUnitario)}</Text>
                  <Text style={[styles.td, { width: '15%', textAlign: 'right' }]}>{formatCurrency(item.subtotal)}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Financial Breakdown */}
        <View style={styles.summaryBlock}>
          <View style={styles.summaryRow}>
            <Text>Subtotal:</Text>
            <Text>{formatCurrency(budget.subtotal)}</Text>
          </View>
          {budget.discountAmount > 0 && (
            <View style={styles.summaryRow}>
              <Text>Descuento:</Text>
              <Text>-{formatCurrency(budget.discountAmount)}</Text>
            </View>
          )}
          {budget.ivaMode === 'ADD_21' && (
            <View style={styles.summaryRow}>
              <Text>IVA (21%):</Text>
              <Text>{formatCurrency(budget.ivaAmount)}</Text>
            </View>
          )}
          <View style={styles.summaryTotal}>
            <Text style={{ fontWeight: 'bold' }}>Total General:</Text>
            <Text style={{ fontWeight: 'bold' }}>{formatCurrency(budget.total)}</Text>
          </View>
          <Text style={{ fontSize: 7, color: '#64748b', marginTop: 1 }}>
            {budget.ivaMode === 'INCLUDED' && '* Los precios indicados incluyen IVA.'}
            {budget.ivaMode === 'PLUS_IVA' && '* Los precios indicados no incluyen IVA (Precios + IVA).'}
            {budget.ivaMode === 'EXEMPT' && '* Operación exenta de IVA.'}
          </Text>
        </View>

        {/* Terms and Conditions */}
        <View style={styles.grid}>
          <View style={styles.col}>
            <Text style={styles.sectionTitle}>Condiciones Comerciales</Text>
            <Text style={styles.textRow}>Validez de la oferta: <Text style={{ fontWeight: 'bold' }}>{budget.validezOferta}</Text></Text>
            {budget.tipo === 'alquiler' && (
              <>
                <Text style={styles.textRow}>Plazo mínimo: <Text style={{ fontWeight: 'bold' }}>{budget.plazoMinimoContrato}</Text></Text>
                <Text style={styles.textRow}>Ajuste de precio: <Text style={{ fontWeight: 'bold' }}>{budget.ajustePrecios}</Text></Text>
              </>
            )}
            {budget.conditionsText && (
              <Text style={{ fontSize: 7, color: '#475569', marginTop: 2 }}>{budget.conditionsText}</Text>
            )}
          </View>
          <View style={styles.col}>
            <Text style={styles.sectionTitle}>Servicios y Soporte Incluidos</Text>
            {budget.includesText && (
              <Text style={{ fontSize: 7, color: '#334155', lineHeight: 1.25 }}>{budget.includesText}</Text>
            )}
          </View>
        </View>

        {budget.requirementsText && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Requisitos de Contratación</Text>
            <Text style={{ fontSize: 7, color: '#475569', lineHeight: 1.25 }}>{budget.requirementsText}</Text>
          </View>
        )}

        {/* Signatures */}
        <View style={styles.signatures}>
          <Text style={styles.signatureLine}>Firma y Aclaración {BRANDING.commercialName}</Text>
          <Text style={styles.signatureLine}>Firma y Aclaración Cliente</Text>
        </View>

        {/* Footer info */}
        <View style={{ position: 'absolute', bottom: 15, left: 30, right: 30, borderTopWidth: 0.5, borderTopColor: '#e2e8f0', paddingTop: 4, alignItems: 'center' }}>
          <Text style={{ fontSize: 7, color: '#94a3b8' }}>{budget.footerText || `${BRANDING.legalName} — ${BRANDING.address}, CP ${BRANDING.postalCode}, ${BRANDING.city} — Tel: ${BRANDING.phones}`}</Text>
        </View>
      </Page>
    </Document>
  );
};
