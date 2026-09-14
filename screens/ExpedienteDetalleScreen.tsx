import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Modal,
} from 'react-native';
import { supabase } from '../supabase';
import { colors, radius, spacing } from '../theme';
import type { ExpedienteDetalleProps } from '../types/navigation';

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
  const [expediente, setExpediente] = useState<Expediente | null>(null);
  const [loading, setLoading] = useState(true);

  // Modal de estado (esto queda igual, funciona bien)
  const [modalEstadoVisible, setModalEstadoVisible] = useState(false);
  const [estadoElegido, setEstadoElegido] = useState('');
  const [guardandoEstado, setGuardandoEstado] = useState(false);

  useEffect(() => {
    fetchExpediente();
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
      Alert.alert('Error', 'No se pudo actualizar el estado: ' + error.message);
      return;
    }

    setExpediente({ ...expediente, estado: estadoElegido });
    setModalEstadoVisible(false);
  }

  function formatFecha(fecha: string | null) {
    if (!fecha) return 'Sin fecha de vencimiento';
    const [anio, mes, dia] = fecha.split('-');
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

  return (
    <View style={styles.container}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.navy, padding: spacing.lg, paddingTop: spacing.xl },
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
