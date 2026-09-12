import React, { useState } from 'react';
import { View, TextInput, Button, Text, Alert, StyleSheet } from 'react-native';
import { supabase } from '../supabase';

export default function RegisterScreen({ navigation }: any) {
  const [nombreEstudio, setNombreEstudio] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleRegister() {
    setLoading(true);

    // Paso 1: crear el usuario en Supabase Auth
    const { data, error } = await supabase.auth.signUp({ email, password });

    if (error || !data.user) {
      Alert.alert('Error al registrarse', error?.message ?? 'Intentá de nuevo');
      setLoading(false);
      return;
    }

    // Paso 2: crear el tenant (estudio) asociado a ese usuario
    const { error: tenantError } = await supabase
      .from('tenants')
      .insert({ nombre_estudio: nombreEstudio, owner_user_id: data.user.id });

    if (tenantError) {
      Alert.alert('Usuario creado, pero falló el estudio', tenantError.message);
    } else {
      Alert.alert('Listo', 'Revisá tu email para confirmar la cuenta');
    }
    setLoading(false);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Crear cuenta</Text>
      <TextInput
        style={styles.input}
        placeholder="Nombre del estudio"
        value={nombreEstudio}
        onChangeText={setNombreEstudio}
      />
      <TextInput
        style={styles.input}
        placeholder="Email"
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
      <Button title={loading ? 'Creando...' : 'Registrarme'} onPress={handleRegister} disabled={loading} />
      <Text onPress={() => navigation.navigate('Login')} style={styles.link}>
        Ya tengo cuenta
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 24 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginBottom: 12 },
  link: { marginTop: 16, color: '#0066cc', textAlign: 'center' },
});