import React, { useState } from 'react';
import { View, Text, TextInput, Button, Alert, StyleSheet, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { supabase } from '../supabase';
import { useAuth } from '../context/AuthContext';

export default function CrearExpedienteScreen({ navigation }: any) {
  const { tenantId } = useAuth();
  const [numero, setNumero] = useState('');
  const [caratula, setCaratula] = useState('');
  const [cliente, setCliente] = useState('');
  const [fechaVencimiento, setFechaVencimiento] = useState<Date | null>(null);
  const [mostrarPicker, setMostrarPicker] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleCrear() {
    if (!numero || !caratula || !cliente) {
      Alert.alert('Faltan datos', 'Completá número, carátula y cliente');
      return;
    }
    setLoading(true);

    const { error } = await supabase.from('expedientes').insert({
      numero_expediente: numero,
      caratula,
      cliente_apellido: cliente,
      estado: 'En inicio',
      tenant_id: tenantId,
      // toISOString().split('T')[0] da el formato YYYY-MM-DD que espera una columna "date"
      fecha_vencimiento: fechaVencimiento ? fechaVencimiento.toISOString().split('T')[0] : null,
    });

    setLoading(false);

    if (error) {
      Alert.alert('Error al crear expediente', error.message);
      return;
    }

    navigation.goBack();
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Nuevo expediente</Text>
      <TextInput
        style={styles.input}
        placeholder="Número de expediente"
        value={numero}
        onChangeText={setNumero}
      />
      <TextInput
        style={styles.input}
        placeholder="Carátula"
        value={caratula}
        onChangeText={setCaratula}
      />
      <TextInput
        style={styles.input}
        placeholder="Cliente (apellido)"
        value={cliente}
        onChangeText={setCliente}
      />

      <Text
        style={styles.input}
        onPress={() => setMostrarPicker(true)}
      >
        {fechaVencimiento
          ? `Vencimiento: ${fechaVencimiento.toLocaleDateString('es-AR')}`
          : 'Tocá para elegir fecha de vencimiento (opcional)'}
      </Text>

      {mostrarPicker && (
        <DateTimePicker
          value={fechaVencimiento ?? new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={(event, selectedDate) => {
            setMostrarPicker(Platform.OS === 'ios'); // en iOS el picker queda inline, en Android se cierra solo
            if (selectedDate) setFechaVencimiento(selectedDate);
          }}
        />
      )}

      <Button title={loading ? 'Guardando...' : 'Guardar expediente'} onPress={handleCrear} disabled={loading} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, paddingTop: 60 },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 24 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginBottom: 12 },
});