import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Switch,
  Image,
  Alert,
  Platform,
  Linking,
  KeyboardAvoidingView,
} from 'react-native';
import { supabase } from '../supabase';
import { useAuth } from '../context/AuthContext';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, radius, shadow, spacing } from '../theme';
import SwipeableActionRow from '../components/SwipeableActionRow';
import { nombreCanalUnico } from '../services/realtime';
import { fetchExpedientes, archivarExpediente, ESTADOS_ACTIVOS } from '../services/expedientes';
import type { Expediente } from '../services/expedientes';
import { derivarVencimiento, VENCIMIENTO_LABELS } from '../services/vencimiento';
import type { EstadoVencimiento } from '../services/vencimiento';
import { useOnline } from '../services/useConnectividad';
import { getIsOnline } from '../services/connectividad';
import { guardarExpedientes, leerExpedientes } from '../services/cache';
import { useEstadoPush } from '../services/push';
import type { HomeProps } from '../types/navigation';

const VENCIMIENTO_COLOR: Record<Exclude<EstadoVencimiento, null>, string> = {
  vencido: colors.danger,
  hoy: colors.goldBright,
  manana: colors.gold,
  proximo: colors.muted,
};

function renderChipVencimiento(fecha: string | null) {
  const vencimiento = derivarVencimiento(fecha);
  if (!vencimiento) return null;
  return (
    <View style={[styles.chip, { borderColor: VENCIMIENTO_COLOR[vencimiento] }]}>
      <Text style={[styles.chipTexto, { color: VENCIMIENTO_COLOR[vencimiento] }]}>
        {VENCIMIENTO_LABELS[vencimiento]}
      </Text>
    </View>
  );
}

export default function HomeScreen({ navigation }: HomeProps) {
  const { tenantId } = useAuth();
  const online = useOnline();
  const onlineRef = useRef(online);
  const estadoPush = useEstadoPush();
  const [expedientes, setExpedientes] = useState<Expediente[]>([]);
  const [busqueda, setBusqueda] = useState('');

  // Filtros ya aplicados (los que realmente afectan la lista)
  const [estadosFiltro, setEstadosFiltro] = useState<string[]>([]); // vacío = todos
  const [ordenarPorVencimiento, setOrdenarPorVencimiento] = useState(false);

  // Filtros "en borrador" dentro del modal, se confirman recién al Aplicar
  const [modalVisible, setModalVisible] = useState(false);
  const [estadosBorrador, setEstadosBorrador] = useState<string[]>([]);
  const [ordenBorrador, setOrdenBorrador] = useState(false);

  useEffect(() => {
    if (!tenantId) return;

    cargarExpedientes();

    const channel = supabase
      .channel(nombreCanalUnico('expedientes-changes'))
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'expedientes', filter: `tenant_id=eq.${tenantId}` },
        () => cargarExpedientes()
      )
      .subscribe();

    const unsubscribeFocus = navigation.addListener('focus', cargarExpedientes);

    return () => {
      supabase.removeChannel(channel);
      unsubscribeFocus();
    };
  }, [tenantId]);

  async function cargarExpedientes() {
    const { data } = await fetchExpedientes({ archivados: false });
    if (data) {
      setExpedientes(data);
      if (tenantId) void guardarExpedientes(tenantId, data);
      return;
    }
    // Sin red: servimos desde la caché local (RF-26)
    if (!getIsOnline() && tenantId) {
      const cache = await leerExpedientes(tenantId);
      if (cache) setExpedientes(cache.filter((e) => e.estado !== 'Archivado'));
    }
  }

  // Al volver la conexión se refresca lo consultado (RF-28)
  useEffect(() => {
    if (online && !onlineRef.current) cargarExpedientes();
    onlineRef.current = online;
  }, [online]);

  function confirmarArchivar(expediente: Expediente) {
    Alert.alert(
      'Archivar expediente',
      `¿Archivar "${expediente.caratula}"? Podés restaurarlo desde "Expedientes archivados".`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Archivar',
          style: 'destructive',
          onPress: async () => {
            const { error } = await archivarExpediente(expediente.id);
            if (error) {
              Alert.alert('Error', error);
              return;
            }
            setExpedientes((prev) => prev.filter((e) => e.id !== expediente.id));
          },
        },
      ]
    );
  }

  function abrirModalFiltro() {
    // El borrador arranca desde lo que ya está aplicado
    setEstadosBorrador(estadosFiltro);
    setOrdenBorrador(ordenarPorVencimiento);
    setModalVisible(true);
  }

  function toggleEstadoBorrador(estado: string) {
    setEstadosBorrador((prev) =>
      prev.includes(estado) ? prev.filter((e) => e !== estado) : [...prev, estado]
    );
  }

  function aplicarFiltros() {
    setEstadosFiltro(estadosBorrador);
    setOrdenarPorVencimiento(ordenBorrador);
    setModalVisible(false);
  }

  function limpiarFiltros() {
    setEstadosBorrador([]);
    setOrdenBorrador(false);
  }

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    let resultado = expedientes;

    if (q) {
      resultado = resultado.filter(
        (e) =>
          e.cliente_apellido.toLowerCase().includes(q) ||
          e.caratula.toLowerCase().includes(q)
      );
    }

    if (estadosFiltro.length > 0) {
      resultado = resultado.filter((e) => estadosFiltro.includes(e.estado));
    }

    if (ordenarPorVencimiento) {
      // Los sin fecha (null) van al final, sea cual sea el filtro
      resultado = [...resultado].sort((a, b) => {
        if (!a.fecha_vencimiento) return 1;
        if (!b.fecha_vencimiento) return -1;
        return a.fecha_vencimiento.localeCompare(b.fecha_vencimiento);
      });
    }

    return resultado;
  }, [busqueda, expedientes, estadosFiltro, ordenarPorVencimiento]);

  const hayFiltrosActivos = estadosFiltro.length > 0 || ordenarPorVencimiento;

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <View>
           <Text style={styles.title}>Expedientes</Text>
        </View>
        <Image source={require('../assets/Praxis_Logo.png')} style={styles.logo} />
      </View>
      <Text style={styles.subtitle}>Tu práctica, organizada y al día.</Text>

      {estadoPush === 'denegado' && (
        <View style={styles.bannerPush}>
          <Text style={styles.bannerPushTexto}>
            Activá las notificaciones para no perderte los vencimientos de tus expedientes.
          </Text>
          <TouchableOpacity onPress={() => Linking.openSettings()} style={styles.bannerPushBoton}>
            <Text style={styles.bannerPushAccion}>Activar</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.filaBusqueda}>
        <TextInput
          style={styles.buscador}
          placeholder="Buscar por apellido o carátula..."
          value={busqueda}
          onChangeText={setBusqueda}
          placeholderTextColor={colors.muted}
        />
        <TouchableOpacity style={styles.botonFiltro} onPress={abrirModalFiltro}>
          <MaterialCommunityIcons name="tune-variant" size={20} color={colors.gold} />
          {hayFiltrosActivos && <View style={styles.puntoActivo} />}
        </TouchableOpacity>
      </View>

      <FlatList
        data={filtrados}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingTop: 8, paddingBottom: 80 }}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {busqueda || hayFiltrosActivos ? 'Sin resultados' : 'Todavía no cargaste expedientes'}
          </Text>
        }
        renderItem={({ item }) => (
          <SwipeableActionRow
            actionLabel="Archivar"
            actionColor={colors.danger}
            onPress={() => navigation.navigate('ExpedienteDetalle', { expedienteId: item.id })}
            onAction={() => confirmarArchivar(item)}
          >
            <Text style={styles.caratula}>{item.caratula}</Text>
            <Text style={styles.expediente_nombre}>Expte. {item.numero_expediente} — {item.cliente_apellido}</Text>
            <View style={styles.filaMeta}>
              <Text style={styles.estado}>{item.estado}</Text>
              {renderChipVencimiento(item.fecha_vencimiento)}
            </View>
          </SwipeableActionRow>
        )}
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('CrearExpediente')}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* Modal de filtros */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitulo}>Filtrar expedientes</Text>

            <Text style={styles.subtitulo}>Estado</Text>
            {ESTADOS_ACTIVOS.map((e) => {
              const activo = estadosBorrador.includes(e);
              return (
                <TouchableOpacity
                  key={e}
                  style={[styles.opcion, activo && styles.opcionSeleccionada]}
                  onPress={() => toggleEstadoBorrador(e)}
                >
                  <Text style={activo ? styles.opcionTextoSeleccionado : styles.opcionTexto}>
                    {activo ? '✓  ' : ''}{e}
                  </Text>
                </TouchableOpacity>
              );
            })}

            <View style={styles.filaOrden}>
              <Text style={styles.textoOrden}>Ordenar por vencimiento próximo</Text>
              <Switch value={ordenBorrador} onValueChange={setOrdenBorrador} />
            </View>

            <View style={styles.botonesModal}>
              <TouchableOpacity onPress={limpiarFiltros}>
                <Text style={styles.cancelar}>Limpiar</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelar}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={aplicarFiltros}>
                <Text style={styles.guardar}>Aplicar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.navy, paddingHorizontal: spacing.lg, paddingTop: 58 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  eyebrow: { color: colors.gold, fontSize: 11, fontWeight: '700', letterSpacing: 2.4, marginBottom: spacing.xs },
  logo: { width: 44, height: 44, borderRadius: 12 },
  title: { color: colors.ivory, fontSize: 30, fontWeight: '700', letterSpacing: -0.5 },
  subtitle: { color: colors.mist, fontSize: 14, marginTop: spacing.sm, marginBottom: spacing.lg },
  bannerPush: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    backgroundColor: colors.navyElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  bannerPushTexto: { color: colors.mist, fontSize: 13, flex: 1, lineHeight: 18 },
  bannerPushBoton: { borderWidth: 1, borderColor: colors.gold, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 6 },
  bannerPushAccion: { color: colors.goldBright, fontSize: 13, fontWeight: '700' },
  filaBusqueda: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  buscador: { flex: 1, color: colors.ivory, backgroundColor: colors.navyInput, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14, height: 46 },
  botonFiltro: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.navyElevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  puntoActivo: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.gold,
  },
  empty: { textAlign: 'center', color: colors.muted, marginTop: spacing.xl },
  card: { backgroundColor: colors.navyElevated, borderWidth: 1, borderColor: colors.borderSoft, borderRadius: radius.md, padding: spacing.md },
  caratula: { color: colors.ivory, fontSize: 16, fontWeight: '600', flex: 1, paddingRight: spacing.sm },
  expediente_nombre: {color: colors.muted, fontSize: 14, fontWeight: '600', flex: 1, paddingRight: spacing.sm },
  estado: { color: colors.goldBright, marginTop: spacing.sm, fontSize: 12, fontWeight: '600' },
  filaMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  chip: {
    marginTop: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  chipTexto: { fontSize: 11, fontWeight: '700' },
  cardTop: { flexDirection: 'row', alignItems: 'center' }, cardArrow: { color: colors.gold, fontSize: 25, lineHeight: 22 }, meta: { color: colors.mist, fontSize: 12, marginTop: spacing.sm },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 32,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.gold,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadow,
  },
  fabText: { color: colors.navy, fontSize: 26, lineHeight: 30 },
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBox: {
    backgroundColor: colors.navyElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 20,
    width: '85%',
    maxHeight: '80%',
  },
  modalTitulo: { color: colors.ivory, fontSize: 18, fontWeight: '600', marginBottom: 12 },
  subtitulo: { fontSize: 12, color: colors.muted, textTransform: 'uppercase', marginBottom: 6, marginTop: 4 },
  opcion: { paddingVertical: 10, paddingHorizontal: 8, borderRadius: radius.sm },
  opcionSeleccionada: { backgroundColor: colors.navySoft },
  opcionTexto: { color: colors.mist, fontSize: 15 },
  opcionTextoSeleccionado: { fontSize: 15, color: colors.goldBright, fontWeight: '600' },
  // En StyleSheet, reemplazá filaOrden y agregá textoOrden:
filaOrden: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginTop: 16,
  gap: 12,
},
textoOrden: {
  flex: 1,
  flexShrink: 1,
  fontSize: 13,
  color: colors.mist,
},
  botonesModal: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 20,
    gap: 20,
  },
  cancelar: { color: colors.muted, fontSize: 15 },
  guardar: { color: colors.goldBright, fontWeight: '600', fontSize: 15 },
});
