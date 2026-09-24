import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Alert,
} from 'react-native';
import { supabase } from '../supabase';
import { useAuth } from '../context/AuthContext';
import { colors, radius, spacing } from '../theme';
import SwipeableActionRow from '../components/SwipeableActionRow';
import { nombreCanalUnico } from '../services/realtime';
import { fetchExpedientes, restaurarExpediente, ESTADOS_ACTIVOS } from '../services/expedientes';
import type { Expediente } from '../services/expedientes';
import type { ExpedientesArchivadosProps } from '../types/navigation';

export default function ExpedientesArchivadosScreen({ navigation }: ExpedientesArchivadosProps) {
  const { tenantId } = useAuth();
  const [expedientes, setExpedientes] = useState<Expediente[]>([]);
  const [busqueda, setBusqueda] = useState('');

  const [modalVisible, setModalVisible] = useState(false);
  const [expedienteSeleccionado, setExpedienteSeleccionado] = useState<Expediente | null>(null);
  const [estadoElegido, setEstadoElegido] = useState(ESTADOS_ACTIVOS[0]);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!tenantId) return;

    fetchLista();

    const channel = supabase
      .channel(nombreCanalUnico('expedientes-archivados-changes'))
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'expedientes', filter: `tenant_id=eq.${tenantId}` },
        () => fetchLista()
      )
      .subscribe();

    const unsubscribeFocus = navigation.addListener('focus', fetchLista);

    return () => {
      supabase.removeChannel(channel);
      unsubscribeFocus();
    };
  }, [tenantId]);

  async function fetchLista() {
    const { data } = await fetchExpedientes({ archivados: true });
    if (data) setExpedientes(data);
  }

  function abrirModalRestaurar(expediente: Expediente) {
    setExpedienteSeleccionado(expediente);
    setEstadoElegido(ESTADOS_ACTIVOS[0]);
    setModalVisible(true);
  }

  async function confirmarRestaurar() {
    if (!expedienteSeleccionado) return;
    setGuardando(true);

    const { error } = await restaurarExpediente(expedienteSeleccionado.id, estadoElegido);

    setGuardando(false);

    if (error) {
      Alert.alert('Error', 'No se pudo restaurar el expediente. Intentá de nuevo.');
      return;
    }

    setModalVisible(false);
    setExpedienteSeleccionado(null);
    setExpedientes((prev) => prev.filter((e) => e.id !== expedienteSeleccionado.id));
  }

  const filtrados = expedientes.filter((e) => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return true;
    return e.cliente_apellido.toLowerCase().includes(q) || e.caratula.toLowerCase().includes(q);
  });

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.buscador}
        placeholder="Buscar por apellido o carátula..."
        value={busqueda}
        onChangeText={setBusqueda}
        placeholderTextColor={colors.muted}
      />

      <FlatList
        data={filtrados}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingTop: 8, paddingBottom: 80 }}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {busqueda ? 'Sin resultados' : 'No hay expedientes archivados'}
          </Text>
        }
        renderItem={({ item }) => (
          <SwipeableActionRow
            actionLabel="Restaurar"
            actionColor={colors.success}
            onPress={() => navigation.navigate('ExpedienteDetalle', { expedienteId: item.id })}
            onAction={() => abrirModalRestaurar(item)}
          >
            <View>
              <Text style={styles.caratula}>{item.caratula}</Text>
            </View>
            <Text style={styles.expediente_nombre}>Expte. {item.numero_expediente} — {item.cliente_apellido}</Text>
            <Text style={styles.estado}>{item.estado}</Text>
          </SwipeableActionRow>
        )}
      />

      {/* Modal: restaurar */}
      <Modal visible={modalVisible} transparent animationType="fade">
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
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelar}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={confirmarRestaurar} disabled={guardando}>
                <Text style={styles.guardar}>{guardando ? 'Restaurando...' : 'Restaurar'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.navy, paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  buscador: {
    color: colors.ivory,
    backgroundColor: colors.navyInput,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    height: 46,
    marginBottom: spacing.sm,
  },
  empty: { textAlign: 'center', color: colors.muted, marginTop: spacing.xl },
  caratula: { color: colors.ivory, fontSize: 16, fontWeight: '600', flex: 1, paddingRight: spacing.sm },
  expediente_nombre: { color: colors.muted, fontSize: 14, fontWeight: '600', flex: 1, paddingRight: spacing.sm },
  estado: { color: colors.goldBright, marginTop: spacing.sm, fontSize: 12, fontWeight: '600' },
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
  modalTitulo: { color: colors.ivory, fontSize: 18, fontWeight: '600', marginBottom: 8 },
  modalDescripcion: { color: colors.mist, fontSize: 14, marginBottom: 12 },
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