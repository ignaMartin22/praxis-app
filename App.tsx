import React, { useState } from 'react';
import { View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';
import HomeScreen from './screens/HomeScreen';
import CrearExpedienteScreen from './screens/CrearExpedienteScreen';
import ExpedienteDetalleScreen from './screens/ExpedienteDetalleScreen';
import ExpedientesArchivadosScreen from './screens/ExpedientesArchivadosScreen';
import { colors } from './theme';
import type { RootStackParamList } from './types/navigation';
import SideDrawer from './components/SideDrawer';

const Stack = createNativeStackNavigator<RootStackParamList>();

function RootNavigator() {
  const { session, loading } = useAuth();
  const [drawerVisible, setDrawerVisible] = useState(false);

  if (loading) return null; // podríamos poner un spinner acá

  return (
    <View style={{ flex: 1 }}>
      <Stack.Navigator screenOptions={{
      headerShown: false,
      contentStyle: { backgroundColor: colors.navy },
      headerStyle: { backgroundColor: colors.navy },
      headerTintColor: colors.ivory,
      headerTitleStyle: { fontWeight: '600' },
      headerShadowVisible: false,
    }}>
      {session ? (
  <>
    <Stack.Screen name="Home" component={HomeScreen} />
    <Stack.Screen name="CrearExpediente" component={CrearExpedienteScreen} options={{ headerShown: true, title: 'Nuevo expediente' }} />
  <Stack.Screen name="ExpedienteDetalle" component={ExpedienteDetalleScreen} options={{ headerShown: true, title: 'Expediente' }} />
  <Stack.Screen name="ExpedientesArchivados" component={ExpedientesArchivadosScreen} options={{ headerShown: true, title: 'Expedientes archivados' }} />
  </>
      ) : (
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
        </>
      )}
      </Stack.Navigator>
      {session && <SideDrawer visible={drawerVisible} onOpen={() => setDrawerVisible(true)} onClose={() => setDrawerVisible(false)} />}
    </View>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <NavigationContainer>
        <RootNavigator />
      </NavigationContainer>
    </AuthProvider>
  );
}
