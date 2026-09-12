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

type Expediente = {
  id: string;
  numero_expediente: string;
  caratula: string;
  cliente_apellido: string;
  estado: string;
  fecha_vencimiento: string | null;
};

const ESTADOS = ['En inicio', 'En prueba', 'Para alegar', 'Sentencia', 'Archivado'];

export default function ExpedienteDetalleScreen({ route }: any) {
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
        <ActivityIndicator size="large" />
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
  container: { flex: 1, padding: 24, paddingTop: 32 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  caratula: { fontSize: 20, fontWeight: 'bold', marginBottom: 24 },
  fila: { marginBottom: 18, borderBottomWidth: 1, borderBottomColor: '#eee', paddingBottom: 12 },
  label: { fontSize: 12, color: '#888', marginBottom: 4, textTransform: 'uppercase' },
  valor: { fontSize: 16 },
  selectBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  chevron: { color: '#999' },
  badge: {
    color: '#0066cc',
    fontWeight: '600',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBox: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    width: '85%',
  },
  modalTitulo: { fontSize: 16, fontWeight: 'bold', marginBottom: 12 },
  opcion: { paddingVertical: 12, paddingHorizontal: 8, borderRadius: 8 },
  opcionSeleccionada: { backgroundColor: '#e6f0ff' },
  opcionTexto: { fontSize: 15 },
  opcionTextoSeleccionado: { fontSize: 15, color: '#0066cc', fontWeight: '600' },
  botonesModal: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 16,
    gap: 20,
  },
  cancelar: { color: '#999', fontSize: 15 },
  guardar: { color: '#0066cc', fontWeight: '600', fontSize: 15 },
});