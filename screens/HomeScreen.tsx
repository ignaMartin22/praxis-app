import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Switch,
} from 'react-native';
import { supabase } from '../supabase';
import { useAuth } from '../context/AuthContext';

type Expediente = {
  id: string;
  numero_expediente: string;
  caratula: string;
  cliente_apellido: string;
  estado: string;
  fecha_vencimiento: string | null;
};

const ESTADOS = ['En inicio', 'En prueba', 'Para alegar', 'Sentencia', 'Archivado'];

export default function HomeScreen({ navigation }: any) {
  const { tenantId } = useAuth();
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

    fetchExpedientes();

    const channel = supabase
      .channel('expedientes-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'expedientes', filter: `tenant_id=eq.${tenantId}` },
        () => fetchExpedientes()
      )
      .subscribe();

    const unsubscribeFocus = navigation.addListener('focus', fetchExpedientes);

    return () => {
      supabase.removeChannel(channel);
      unsubscribeFocus();
    };
  }, [tenantId]);

  async function fetchExpedientes() {
    const { data, error } = await supabase
      .from('expedientes')
      .select('*')
      .order('creado_el', { ascending: false });

    if (!error && data) setExpedientes(data as Expediente[]);
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
    <View style={styles.container}>
      <Text style={styles.title}>Mis expedientes</Text>

      <View style={styles.filaBusqueda}>
        <TextInput
          style={styles.buscador}
          placeholder="Buscar por apellido o carátula..."
          value={busqueda}
          onChangeText={setBusqueda}
        />
        <TouchableOpacity style={styles.botonFiltro} onPress={abrirModalFiltro}>
          <Text style={styles.iconoFiltro}>⚙︎</Text>
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
          <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate('ExpedienteDetalle', { expedienteId: item.id })}
          >
            <Text style={styles.caratula}>{item.caratula}</Text>
            <Text>Expte. {item.numero_expediente} — {item.cliente_apellido}</Text>
            <Text style={styles.estado}>{item.estado}</Text>
          </TouchableOpacity>
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
            {ESTADOS.map((e) => {
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, paddingTop: 60 },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 16 },
  filaBusqueda: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  buscador: { flex: 1, borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10 },
  botonFiltro: {
    width: 42,
    height: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ccc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconoFiltro: { fontSize: 18 },
  puntoActivo: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#0066cc',
  },
  empty: { textAlign: 'center', color: '#999', marginTop: 24 },
  card: { backgroundColor: '#f4f4f4', borderRadius: 8, padding: 12, marginBottom: 10 },
  caratula: { fontWeight: 'bold' },
  estado: { color: '#0066cc', marginTop: 4, fontSize: 12 },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 32,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#0066cc',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
  },
  fabText: { color: 'white', fontSize: 28, lineHeight: 30 },
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
    maxHeight: '80%',
  },
  modalTitulo: { fontSize: 16, fontWeight: 'bold', marginBottom: 12 },
  subtitulo: { fontSize: 12, color: '#888', textTransform: 'uppercase', marginBottom: 6, marginTop: 4 },
  opcion: { paddingVertical: 10, paddingHorizontal: 8, borderRadius: 8 },
  opcionSeleccionada: { backgroundColor: '#e6f0ff' },
  opcionTexto: { fontSize: 15 },
  opcionTextoSeleccionado: { fontSize: 15, color: '#0066cc', fontWeight: '600' },
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
  color: '#333',
},
  botonesModal: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 20,
    gap: 20,
  },
  cancelar: { color: '#999', fontSize: 15 },
  guardar: { color: '#0066cc', fontWeight: '600', fontSize: 15 },
});