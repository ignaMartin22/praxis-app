import React, { useState } from 'react';
import { View, TextInput, Text, Alert, StyleSheet, TouchableOpacity, ActivityIndicator, Image, ScrollView, Platform, KeyboardAvoidingView } from 'react-native';
import { supabase } from '../supabase';
import { mensajeErrorAuth } from '../services/authErrors';
import { colors, radius, spacing } from '../theme';
import type { RegisterProps } from '../types/navigation';

export default function RegisterScreen({ navigation }: RegisterProps) {
  const [nombreEstudio, setNombreEstudio] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleRegister() {
    setLoading(true);

    // Paso 1: crear el usuario en Supabase Auth
    const { data, error } = await supabase.auth.signUp({ email, password });

    if (error || !data.user) {
      Alert.alert('Error al registrarse', mensajeErrorAuth(error));
      setLoading(false);
      return;
    }

    // Paso 2: crear el tenant (estudio) asociado a ese usuario
    const { error: tenantError } = await supabase
      .from('tenants')
      .insert({ nombre_estudio: nombreEstudio, owner_user_id: data.user.id });

    if (tenantError) {
      Alert.alert('Usuario creado, pero falló el estudio', 'No se pudo crear tu estudio. Intentá de nuevo.');
    } else {
      Alert.alert('Listo', 'Revisá tu email para confirmar la cuenta');
    }
    setLoading(false);
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Image source={require('../assets/Praxis_Logo.png')} style={styles.logo} />
      <Text style={styles.eyebrow}>PRAXISAPP</Text>
      <Text style={styles.title}>Crear tu cuenta</Text>
      <Text style={styles.description}>Centralizá la gestión de tus expedientes con claridad y privacidad.</Text>
      <View style={styles.form}>
      <Text style={styles.label}>NOMBRE DEL ESTUDIO - ABOGADO</Text>
      <TextInput
        style={styles.input}
        placeholder="Ej. Estudio González"
        placeholderTextColor={colors.muted}
        value={nombreEstudio}
        onChangeText={setNombreEstudio}
      />
      <TextInput
        style={styles.input}
        placeholder="nombre@estudio.com"
        placeholderTextColor={colors.muted}
        autoCapitalize="none"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Contraseña"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <TouchableOpacity style={[styles.primaryButton, loading && styles.disabled]} onPress={handleRegister} disabled={loading}>
        {loading ? <ActivityIndicator color={colors.navy} /> : <Text style={styles.primaryButtonText}>Crear cuenta</Text>}
      </TouchableOpacity>
      <Text onPress={() => navigation.navigate('Login')} style={styles.link}>
        Ya tengo cuenta <Text style={styles.linkAccent}>Ingresar</Text>
      </Text>
      </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.navy, padding: spacing.lg },
  scrollContent: { flexGrow: 1, justifyContent: 'center', paddingVertical: spacing.lg },
  logo: { width: 64, height: 64, borderRadius: 18, marginBottom: spacing.lg },
  eyebrow: { color: colors.gold, fontSize: 12, fontWeight: '700', letterSpacing: 2.8, marginBottom: spacing.md },
  title: { color: colors.ivory, fontSize: 32, fontWeight: '700', letterSpacing: -0.6 },
  description: { color: colors.mist, fontSize: 15, lineHeight: 22, marginTop: spacing.sm, marginBottom: spacing.xl },
  form: { backgroundColor: colors.navyElevated, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.lg },
  label: { color: colors.muted, fontSize: 11, letterSpacing: 1.1, fontWeight: '700', marginBottom: spacing.sm },
  input: { color: colors.ivory, backgroundColor: colors.navyInput, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14, height: 50, marginBottom: spacing.md },
  primaryButton: { height: 52, justifyContent: 'center', alignItems: 'center', borderRadius: radius.md, backgroundColor: colors.gold, marginTop: spacing.sm },
  primaryButtonText: { color: colors.navy, fontSize: 16, fontWeight: '700' }, disabled: { opacity: 0.6 },
  link: { marginTop: spacing.lg, color: colors.mist, textAlign: 'center', fontSize: 14 }, linkAccent: { color: colors.goldBright, fontWeight: '600' },
});
