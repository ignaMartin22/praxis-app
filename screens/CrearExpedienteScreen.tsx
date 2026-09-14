import React, { useState } from 'react';
import { View, Text, TextInput, Alert, StyleSheet, Platform, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { supabase } from '../supabase';
import { useAuth } from '../context/AuthContext';
import { colors, radius, spacing } from '../theme';
import type { CrearExpedienteProps } from '../types/navigation';

export default function CrearExpedienteScreen({ navigation }: CrearExpedienteProps) {
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
      <ScrollView
        contentContainerStyle={styles.formContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.eyebrow}>NUEVO REGISTRO</Text>
        <Text style={styles.title}>Crear expediente</Text>
        <Text style={styles.description}>Completá la información esencial para comenzar el seguimiento.</Text>
        <Text style={styles.label}>IDENTIFICACIÓN</Text>
        <TextInput
          style={styles.input}
          placeholder="Número de expediente"
          value={numero}
          onChangeText={setNumero}
          placeholderTextColor={colors.muted}
        />
        <TextInput
          style={styles.input}
          placeholder="Carátula"
          value={caratula}
          onChangeText={setCaratula}
          placeholderTextColor={colors.muted}
        />
        <TextInput
          style={styles.input}
          placeholder="Cliente (apellido)"
          value={cliente}
          onChangeText={setCliente}
          placeholderTextColor={colors.muted}
        />

        <Text
          style={[styles.input, styles.dateInput]}
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
              setMostrarPicker(false);
              if (selectedDate) setFechaVencimiento(selectedDate);
            }}
          />
        )}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={[styles.primaryButton, loading && styles.disabled]} onPress={handleCrear} disabled={loading}>
          {loading ? <ActivityIndicator color={colors.navy} /> : <Text style={styles.primaryButtonText}>Guardar expediente</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.navy },
  formContent: { padding: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.lg },
  eyebrow: { color: colors.gold, fontSize: 11, fontWeight: '700', letterSpacing: 2, marginBottom: spacing.sm },
  title: { color: colors.ivory, fontSize: 28, fontWeight: '700' },
  description: { color: colors.mist, fontSize: 14, lineHeight: 21, marginTop: spacing.sm, marginBottom: spacing.xl },
  label: { color: colors.muted, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: spacing.sm },
  input: { color: colors.ivory, backgroundColor: colors.navyElevated, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14, height: 52, marginBottom: spacing.md, fontSize: 15 },
  dateInput: { color: colors.mist, paddingTop: 15 },
  footer: { backgroundColor: colors.navy, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.lg },
  primaryButton: { height: 52, backgroundColor: colors.gold, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { color: colors.navy, fontSize: 16, fontWeight: '700' }, disabled: { opacity: 0.6 },
});
