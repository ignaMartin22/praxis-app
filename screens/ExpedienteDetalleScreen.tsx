import React, { useEffect, useState, useRef } from 'react';
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
  TextInput,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { MaterialIcons } from '@expo/vector-icons';
import { supabase } from '../supabase';
import { useAuth } from '../context/AuthContext';
import { colors, radius, spacing } from '../theme';
import type { ExpedienteDetalleProps } from '../types/navigation';
import type { ExpedientePdf } from '../types/database';
import { archivarExpediente, restaurarExpediente, cambiarEstadoExpediente, eliminarExpedienteDefinitivo, ESTADOS_ACTIVOS } from '../services/expedientes';
import type { Expediente } from '../services/expedientes';
import {
  MAX_PDFS_POR_EXPEDIENTE,
  listarPdfs,
  subirDocumento,
  eliminarPdf,
  obtenerUrlFirmada,
} from '../services/expedientePdfs';
import { derivarVencimiento, VENCIMIENTO_LABELS } from '../services/vencimiento';
import type { EstadoVencimiento } from '../services/vencimiento';
import { useOnline } from '../services/useConnectividad';
import { getIsOnline } from '../services/connectividad';
import { guardarExpediente, leerExpediente, guardarPdfs, leerPdfs } from '../services/cache';

const VENCIMIENTO_COLOR: Record<Exclude<EstadoVencimiento, null>, string> = {
  vencido: colors.danger,
  hoy: colors.goldBright,
  manana: colors.gold,
  proximo: colors.muted,
};

export default function ExpedienteDetalleScreen({ route, navigation }: ExpedienteDetalleProps) {
  const { expedienteId } = route.params;
  const { tenantId } = useAuth();
  const online = useOnline();
  const onlineRef = useRef(online);
  const [expediente, setExpediente] = useState<Expediente | null>(null);
  const [loading, setLoading] = useState(true);

  const [pdfs, setPdfs] = useState<ExpedientePdf[]>([]);
  const [pdfsLoading, setPdfsLoading] = useState(true);
  const [subiendoPdf, setSubiendoPdf] = useState(false);

  // Modal de estado (esto queda igual, funciona bien)
  const [modalEstadoVisible, setModalEstadoVisible] = useState(false);
  const [estadoElegido, setEstadoElegido] = useState('');
  const [guardandoEstado, setGuardandoEstado] = useState(false);

  // Modal de restauración
  const [modalRestaurarVisible, setModalRestaurarVisible] = useState(false);
  const [guardandoRestaurar, setGuardandoRestaurar] = useState(false);

  // Modal de borrado definitivo (solo expedientes archivados)
  const [modalEliminarVisible, setModalEliminarVisible] = useState(false);
  const [textoConfirmacion, setTextoConfirmacion] = useState('');
  const [eliminando, setEliminando] = useState(false);

  useEffect(() => {
    fetchExpediente();
    fetchPdfs();
  }, [expedienteId]);

  // Al volver la conexión se refresca lo consultado (RF-28)
  useEffect(() => {
    if (online && !onlineRef.current) {
      fetchExpediente();
      fetchPdfs();
    }
    onlineRef.current = online;
  }, [online]);

  async function fetchExpediente() {
    setLoading(true);
    const { data, error } = await supabase
      .from('expedientes')
      .select('*')
      .eq('id', expedienteId)
      .single();

    if (!error && data) {
      const e = data as Expediente;
      setExpediente(e);
      if (tenantId) void guardarExpediente(tenantId, e);
      setLoading(false);
      return;
    }

    // Sin red: servimos desde la caché local (RF-26)
    if (!getIsOnline() && tenantId) {
      const cache = await leerExpediente(expedienteId);
      if (cache) {
        setExpediente(cache);
        setLoading(false);
        return;
      }
    }

    setLoading(false);
  }

  async function fetchPdfs() {
    setPdfsLoading(true);
    const resultado = await listarPdfs(expedienteId);
    setPdfsLoading(false);
    if (resultado.error) {
      // Sin red: servimos la lista desde la caché local (RF-26)
      if (!getIsOnline()) {
        const cache = await leerPdfs(expedienteId);
        if (cache) setPdfs(cache);
        return;
      }
      Alert.alert('Atención', resultado.error);
      return;
    }
    setPdfs(resultado.data ?? []);
    if (resultado.data) void guardarPdfs(expedienteId, resultado.data);
  }

  function abrirModalEstado() {
    if (!expediente) return;
    if (expediente.estado === 'Archivado') {
      abrirModalRestaurar();
      return;
    }
    setEstadoElegido(expediente.estado);
    setModalEstadoVisible(true);
  }

  async function confirmarEstado() {
    if (!expediente) return;
    setGuardandoEstado(true);

    const { error } = await cambiarEstadoExpediente(expedienteId, estadoElegido);

    setGuardandoEstado(false);

    if (error) {
      Alert.alert('Error', error);
      return;
    }

    const actualizado = { ...expediente, estado: estadoElegido };
    setExpediente(actualizado);
    if (tenantId) void guardarExpediente(tenantId, actualizado);
    setModalEstadoVisible(false);
  }

  const archivado = expediente?.estado === 'Archivado';

  function abrirModalRestaurar() {
    setEstadoElegido(ESTADOS_ACTIVOS[0]);
    setModalRestaurarVisible(true);
  }

  async function confirmarRestaurar() {
    if (!expediente) return;
    setGuardandoRestaurar(true);

    const { error } = await restaurarExpediente(expedienteId, estadoElegido);

    setGuardandoRestaurar(false);

    if (error) {
      Alert.alert('Error', error);
      return;
    }

    const actualizado = { ...expediente, estado: estadoElegido };
    setExpediente(actualizado);
    if (tenantId) void guardarExpediente(tenantId, actualizado);
    setModalRestaurarVisible(false);
  }

  function confirmarArchivar() {
    if (!expediente) return;
    Alert.alert(
      'Archivar expediente',
      `¿Archivar "${expediente.caratula}"? Podés restaurarlo desde "Expedientes archivados".`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Archivar',
          style: 'destructive',
          onPress: async () => {
            const { error } = await archivarExpediente(expedienteId);
            if (error) {
              Alert.alert('Error', error);
              return;
            }
            navigation.goBack();
          },
        },
      ]
    );
  }

  function abrirModalEliminar() {
    if (!expediente) return;
    Alert.alert(
      'Eliminar definitivamente',
      `Se van a borrar "${expediente.caratula}" y todos sus documentos. Esta acción es irreversible.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Continuar',
          style: 'destructive',
          onPress: () => {
            setTextoConfirmacion('');
            setModalEliminarVisible(true);
          },
        },
      ]
    );
  }

  async function confirmarEliminacion() {
    if (!expediente) return;
    setEliminando(true);

    const { error } = await eliminarExpedienteDefinitivo(expediente.id);

    setEliminando(false);

    if (error) {
      Alert.alert('Error', error);
      return;
    }

    setModalEliminarVisible(false);
    setTextoConfirmacion('');
    navigation.goBack();
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
      if (res.data) {
        const pdf = res.data as ExpedientePdf;
        setPdfs((prev) => [...prev, pdf]);
        void guardarPdfs(expedienteId, [...pdfs, pdf]);
      }
    } catch {
      setSubiendoPdf(false);
      Alert.alert('Error', 'No se pudo seleccionar el archivo.');
    }
  }

  async function abrirPdf(pdf: ExpedientePdf) {
    if (!getIsOnline()) {
      Alert.alert('Sin conexión', 'Necesitás conexión a internet para abrir un documento.');
      return;
    }
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
  const estadoVencimiento = derivarVencimiento(expediente.fecha_vencimiento);

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
          <MaterialIcons name="keyboard-arrow-down" size={22} color={colors.gold} />
        </TouchableOpacity>
      </View>

      <View style={styles.fila}>
        <Text style={styles.label}>Vencimiento</Text>
        {estadoVencimiento ? (
          <View style={styles.filaValor}>
            <Text style={styles.valor}>{formatFecha(expediente.fecha_vencimiento)}</Text>
            <View style={[styles.chip, { borderColor: VENCIMIENTO_COLOR[estadoVencimiento] }]}>
              <Text style={[styles.chipTexto, { color: VENCIMIENTO_COLOR[estadoVencimiento] }]}>
                {VENCIMIENTO_LABELS[estadoVencimiento]}
              </Text>
            </View>
          </View>
        ) : (
          <Text style={styles.valor}>{formatFecha(expediente.fecha_vencimiento)}</Text>
        )}
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

      {archivado ? (
        <>
          <TouchableOpacity style={styles.restaurarButton} onPress={abrirModalRestaurar}>
            <Text style={styles.restaurarButtonText}>Restaurar expediente</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.eliminarButton} onPress={abrirModalEliminar}>
            <Text style={styles.eliminarButtonText}>Eliminar definitivamente</Text>
          </TouchableOpacity>
        </>
      ) : (
        <TouchableOpacity style={styles.archivarButton} onPress={confirmarArchivar}>
          <Text style={styles.archivarButtonText}>Archivar expediente</Text>
        </TouchableOpacity>
      )}

      {/* Modal: elegir estado */}
      <Modal visible={modalEstadoVisible} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitulo}>Cambiar estado</Text>
            {ESTADOS_ACTIVOS.map((e) => (
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

      {/* Modal: restaurar expediente */}
      <Modal visible={modalRestaurarVisible} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitulo}>Restaurar expediente</Text>
            <Text style={styles.modalDescripcion}>Elegí el estado al que querés que vuelva.</Text>
            {ESTADOS_ACTIVOS.map((e) => (
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
              <TouchableOpacity onPress={() => setModalRestaurarVisible(false)}>
                <Text style={styles.cancelar}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={confirmarRestaurar} disabled={guardandoRestaurar}>
                <Text style={styles.guardar}>{guardandoRestaurar ? 'Restaurando...' : 'Restaurar'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal: eliminar definitivamente */}
      <Modal visible={modalEliminarVisible} transparent animationType="fade">
        <KeyboardAvoidingView
          style={styles.overlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalBox}>
            <Text style={styles.modalTitulo}>Eliminar definitivamente</Text>
            <Text style={styles.modalDescripcion}>
              Esta acción borra el expediente y todos sus documentos. Escribí "ELIMINAR" para confirmar.
            </Text>
            <TextInput
              style={styles.inputConfirmacion}
              placeholder="ELIMINAR"
              placeholderTextColor={colors.muted}
              autoCapitalize="characters"
              autoCorrect={false}
              value={textoConfirmacion}
              onChangeText={setTextoConfirmacion}
            />
            <View style={styles.botonesModal}>
              <TouchableOpacity onPress={() => setModalEliminarVisible(false)}>
                <Text style={styles.cancelar}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={confirmarEliminacion}
                disabled={textoConfirmacion.trim().toUpperCase() !== 'ELIMINAR' || eliminando}
              >
                <Text
                  style={[
                    styles.eliminarTexto,
                    (textoConfirmacion.trim().toUpperCase() !== 'ELIMINAR' || eliminando) && styles.eliminarTextoDisabled,
                  ]}
                >
                  {eliminando ? 'Eliminando...' : 'Eliminar definitivamente'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
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
  filaValor: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  chip: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  chipTexto: { fontSize: 11, fontWeight: '700' },
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
  archivarButton: {
    height: 50,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
  },
  archivarButtonText: { color: colors.danger, fontSize: 15, fontWeight: '700' },
  restaurarButton: {
    height: 50,
    borderRadius: radius.md,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
  },
  restaurarButtonText: { color: colors.navy, fontSize: 15, fontWeight: '700' },
  eliminarButton: {
    height: 50,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
  },
  eliminarButtonText: { color: colors.danger, fontSize: 15, fontWeight: '700' },
  inputConfirmacion: {
    color: colors.ivory,
    backgroundColor: colors.navyInput,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    height: 48,
    marginTop: spacing.md,
    fontSize: 15,
  },
  eliminarTexto: { color: colors.danger, fontWeight: '600', fontSize: 15 },
  eliminarTextoDisabled: { opacity: 0.4 },
  modalDescripcion: { color: colors.mist, fontSize: 14, marginBottom: 12 },
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