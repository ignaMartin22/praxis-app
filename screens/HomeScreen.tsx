import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, TextInput, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { supabase } from '../supabase';
import { useAuth } from '../context/AuthContext';

type Expediente = {
  id: string;
  numero_expediente: string;
  caratula: string;
  cliente_apellido: string;
  estado: string;
};

export default function HomeScreen({ navigation }: any) {
  const { tenantId } = useAuth();
  const [expedientes, setExpedientes] = useState<Expediente[]>([]);
  const [busqueda, setBusqueda] = useState('');

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

    // Refresca también cada vez que volvés a esta pantalla
    // (ej: al volver de crear un expediente), por si el realtime falló.
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

  // Filtro en el cliente: para el volumen de un abogado independiente (decenas/
  // pocos cientos de expedientes) esto es suficiente y no necesita ir al servidor.
  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return expedientes;
    return expedientes.filter(
      (e) =>
        e.cliente_apellido.toLowerCase().includes(q) ||
        e.caratula.toLowerCase().includes(q)
    );
  }, [busqueda, expedientes]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Mis expedientes</Text>

      <TextInput
        style={styles.buscador}
        placeholder="Buscar por apellido o carátula..."
        value={busqueda}
        onChangeText={setBusqueda}
      />

      <FlatList
        data={filtrados}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingTop: 8, paddingBottom: 80 }}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {busqueda ? 'Sin resultados' : 'Todavía no cargaste expedientes'}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, paddingTop: 60 },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 16 },
  buscador: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10, marginBottom: 8 },
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
});