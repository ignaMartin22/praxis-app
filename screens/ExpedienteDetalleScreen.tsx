import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Modal,
  ScrollView,
  Linking,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { supabase } from '../supabase';
import { useAuth } from '../context/AuthContext';
import { colors, radius, spacing } from '../theme';
import type { ExpedienteDetalleProps } from '../types/navigation';
import type { ExpedientePdf } from '../types/database';
import {
  MAX_PDFS_POR_EXPEDIENTE,
  listarPdfs,
  subirDocumento,
  eliminarPdf,
  obtenerUrlFirmada,
} from '../services/expedientePdfs';

type Expediente = {
  id: string;
  numero_expediente: string;
  caratula: string;
  cliente_apellido: string;
  estado: string;
  fecha_vencimiento: string | null;
};

const ESTADOS = ['En inicio', 'En prueba', 'Para alegar', 'Sentencia', 'Archivado'];

export default function ExpedienteDetalleScreen({ route }: ExpedienteDetalleProps) {
  const { expedienteId } = route.params;
  const { tenantId } = useAuth();
  const [expediente, setExpediente] = useState<Expediente | null>(null);
  const [loading, setLoading] = useState(true);

  const [pdfs, setPdfs] = useState<ExpedientePdf[]>([]);
  const [pdfsLoading, setPdfsLoading] = useState(true);
  const [subiendoPdf, setSubiendoPdf] = useState(false);

  // Modal de estado (esto queda igual, funciona bien)
  const [modalEstadoVisible, setModalEstadoVisible] = useState(false);
  const [estadoElegido, setEstadoElegido] = useState('');
  const [guardandoEstado, setGuardandoEstado] = useState(false);

  useEffect(() => {
    fetchExpediente();
    fetchPdfs();
  }, [expedienteId]);

  async function fetchExpediente() {
    setLoading(true);
    const { data, error } = await supabase
      .from('expedientes')
      .select('*')
      .eq('id', expedienteId)
      .single();

    if (!error && data) setExpediente(data as Expediente);
    setLoading(false);
  }

  async function fetchPdfs() {
    setPdfsLoading(true);
    const resultado = await listarPdfs(expedienteId);
    setPdfsLoading(false);
    if (resultado.error) {
      Alert.alert('Atención', resultado.error);
      return;
    }
    setPdfs(resultado.data ?? []);
  }

  function abrirModalEstado() {
    if (!expediente) return;
    setEstadoElegido(expediente.estado);
    setModalEstadoVisible(true);
  }

  async function confirmarEstado() {
    if (!expediente) return;
    setGuardandoEstado(true);

    const { error } = await supabase
      .from('expedientes')
      .update({ estado: estadoElegido })
      .eq('id', expedienteId);

    setGuardandoEstado(false);

    if (error) {
      Alert.alert('Error', 'No se pudo actualizar el estado. Intentá de nuevo.');
      return;
    }

    setExpediente({ ...expediente, estado: estadoElegido });
    setModalEstadoVisible(false);
  }

  async function agregarPdf() {
    if (!tenantId) {
      Alert.alert('Sesión', 'Tu sesión no es válida. Volvé a iniciar sesión.');
      return;
    }
    if (pdfs.length >= MAX_PDFS_POR_EXPEDIENTE) {
      Alert.alert('Límite', `Máximo ${MAX_PDFS_POR_EXPEDIENTE} PDFs por expediente.`);
      return;
    }

    try {
      const resultado = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (resultado.canceled || !resultado.assets?.length) return;

      const archivo = resultado.assets[0];
      setSubiendoPdf(true);
      const res = await subirDocumento(expedienteId, tenantId, {
        uri: archivo.uri,
        name: archivo.name,
        mimeType: archivo.mimeType,
        size: archivo.size,
      }, 'pdf');
      setSubiendoPdf(false);

      if (res.error) {
        Alert.alert('No se pudo agregar', res.error);
        return;
      }
      if (res.data) setPdfs((prev) => [...prev, res.data as ExpedientePdf]);
    } catch {
      setSubiendoPdf(false);
      Alert.alert('Error', 'No se pudo seleccionar el archivo.');
    }
  }

  async function abrirPdf(pdf: ExpedientePdf) {
    const url = await obtenerUrlFirmada(pdf);
    if (!url) {
      Alert.alert('Error', 'No se pudo abrir el documento.');
      return;
    }
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Error', 'No se pudo abrir el documento en este dispositivo.');
    }
  }

  function confirmarEliminar(pdf: ExpedientePdf) {
    Alert.alert(
      'Eliminar documento',
      `¿Eliminar "${pdf.nombre_original}"? Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            const res = await eliminarPdf(pdf);
            if (res.error) {
              Alert.alert('Error', res.error);
              return;
            }
            setPdfs((prev) => prev.filter((p) => p.id !== pdf.id));
          },
        },
      ]
    );
  }

  function formatearTamano(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function formatFecha(fecha: string | null) {
    if (!fecha) return 'Sin fecha';
    const [anio, mes, dia] = fecha.slice(0, 10).split('-');
    return `${dia}/${mes}/${anio}`;
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.gold} />
      </View>
    );
  }

  if (!expediente) {
    return (
      <View style={styles.center}>
        <Text>No se encontró el expediente</Text>
      </View>
    );
  }

  const pdfAlCompleto = pdfs.length >= MAX_PDFS_POR_EXPEDIENTE;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.caratula}>{expediente.caratula}</Text>

      <View style={styles.fila}>
        <Text style={styles.label}>Número de expediente</Text>
        <Text style={styles.valor}>{expediente.numero_expediente}</Text>
      </View>

      <View style={styles.fila}>
        <Text style={styles.label}>Cliente</Text>
        <Text style={styles.valor}>{expediente.cliente_apellido}</Text>
      </View>

      <View style={styles.fila}>
        <Text style={styles.label}>Estado</Text>
        <TouchableOpacity style={styles.selectBox} onPress={abrirModalEstado}>
          <Text style={styles.badge}>{expediente.estado}</Text>
          <Text style={styles.chevron}>▾</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.fila}>
        <Text style={styles.label}>Vencimiento</Text>
        <Text style={styles.valor}>{formatFecha(expediente.fecha_vencimiento)}</Text>
      </View>

      <View style={styles.docsHeader}>
        <Text style={styles.sectionTitle}>DOCUMENTOS (PDF)</Text>
        <Text style={styles.docsCounter}>{pdfs.length} / {MAX_PDFS_POR_EXPEDIENTE}</Text>
      </View>

      {pdfsLoading ? (
        <View style={styles.docsEmpty}>
          <ActivityIndicator color={colors.gold} />
        </View>
      ) : pdfs.length === 0 ? (
        <View style={styles.docsEmpty}>
          <Text style={styles.docsEmptyText}>Todavía no hay documentos adjuntos.</Text>
        </View>
      ) : (
        pdfs.map((pdf) => (
          <View key={pdf.id} style={styles.pdfItem}>
            <TouchableOpacity style={styles.pdfTouch} onPress={() => abrirPdf(pdf)}>
              <Text style={styles.pdfBadge}>PDF</Text>
              <View style={styles.pdfInfo}>
                <Text style={styles.pdfNombre} numberOfLines={1}>{pdf.nombre_original}</Text>
                <Text style={styles.pdfMeta}>{formatearTamano(pdf.tamano_bytes)} · {formatFecha(pdf.creado_el)}</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.pdfDelete} onPress={() => confirmarEliminar(pdf)}>
              <Text style={styles.pdfDeleteText}>Eliminar</Text>
            </TouchableOpacity>
          </View>
        ))
      )}

      <TouchableOpacity
        style={[styles.addPdfButton, (pdfAlCompleto || subiendoPdf) && styles.addPdfDisabled]}
        onPress={agregarPdf}
        disabled={pdfAlCompleto || subiendoPdf}
      >
        {subiendoPdf ? (
          <ActivityIndicator color={colors.navy} />
        ) : (
          <Text style={styles.addPdfButtonText}>
            {pdfAlCompleto ? 'Límite alcanzado (5/5)' : '+ Agregar PDF'}
          </Text>
        )}
      </TouchableOpacity>

      {/* Modal: elegir estado */}
      <Modal visible={modalEstadoVisible} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitulo}>Cambiar estado</Text>
            {ESTADOS.map((e) => (
              <TouchableOpacity
                key={e}
                style={[styles.opcion, estadoElegido === e && styles.opcionSeleccionada]}
                onPress={() => setEstadoElegido(e)}
              >
                <Text style={estadoElegido === e ? styles.opcionTextoSeleccionado : styles.opcionTexto}>
                  {e}
                </Text>
              </TouchableOpacity>
            ))}
            <View style={styles.botonesModal}>
              <TouchableOpacity onPress={() => setModalEstadoVisible(false)}>
                <Text style={styles.cancelar}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={confirmarEstado} disabled={guardandoEstado}>
                <Text style={styles.guardar}>{guardandoEstado ? 'Guardando...' : 'Guardar'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.navy },
  content: { padding: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.xxl },
  center: { flex: 1, backgroundColor: colors.navy, justifyContent: 'center', alignItems: 'center' },
  caratula: { color: colors.ivory, fontSize: 25, fontWeight: '700', lineHeight: 32, marginBottom: spacing.xl },
  fila: { backgroundColor: colors.navyElevated, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.borderSoft, borderRadius: radius.md, padding: spacing.md },
  label: { fontSize: 11, color: colors.muted, fontWeight: '700', letterSpacing: 1, marginBottom: 6, textTransform: 'uppercase' },
  valor: { color: colors.ivory, fontSize: 16 },
  selectBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.navyInput,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  chevron: { color: colors.gold },
  badge: {
    color: colors.goldBright,
    fontWeight: '600',
  },
  docsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  sectionTitle: { color: colors.muted, fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  docsCounter: { color: colors.goldBright, fontSize: 12, fontWeight: '600' },
  docsEmpty: { backgroundColor: colors.navyElevated, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderSoft, padding: spacing.lg, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  docsEmptyText: { color: colors.muted, fontSize: 14 },
  pdfItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.navyElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  pdfTouch: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  pdfBadge: {
    color: colors.navy,
    backgroundColor: colors.gold,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    borderRadius: radius.sm,
    paddingHorizontal: 7,
    paddingVertical: 3,
    marginRight: spacing.md,
    overflow: 'hidden',
  },
  pdfInfo: { flex: 1, paddingRight: spacing.sm },
  pdfNombre: { color: colors.ivory, fontSize: 15, fontWeight: '600' },
  pdfMeta: { color: colors.muted, fontSize: 12, marginTop: 3 },
  pdfDelete: { paddingHorizontal: 8, paddingVertical: 8 },
  pdfDeleteText: { color: colors.danger, fontSize: 13, fontWeight: '600' },
  addPdfButton: {
    height: 50,
    borderRadius: radius.md,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  addPdfDisabled: { opacity: 0.55 },
  addPdfButtonText: { color: colors.navy, fontSize: 15, fontWeight: '700' },
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBox: {
    backgroundColor: colors.navyElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    width: '85%',
  },
  modalTitulo: { color: colors.ivory, fontSize: 18, fontWeight: '600', marginBottom: 12 },
  opcion: { paddingVertical: 12, paddingHorizontal: 8, borderRadius: radius.sm },
  opcionSeleccionada: { backgroundColor: colors.navySoft },
  opcionTexto: { color: colors.mist, fontSize: 15 },
  opcionTextoSeleccionado: { fontSize: 15, color: colors.goldBright, fontWeight: '600' },
  botonesModal: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 16,
    gap: 20,
  },
  cancelar: { color: colors.muted, fontSize: 15 },
  guardar: { color: colors.goldBright, fontWeight: '600', fontSize: 15 },
});