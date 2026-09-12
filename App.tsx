import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';
import HomeScreen from './screens/HomeScreen';
import CrearExpedienteScreen from './screens/CrearExpedienteScreen';
import ExpedienteDetalleScreen from './screens/ExpedienteDetalleScreen';

const Stack = createNativeStackNavigator();

function RootNavigator() {
  const { session, loading } = useAuth();

  if (loading) return null; // podríamos poner un spinner acá

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {session ? (
  <>
    <Stack.Screen name="Home" component={HomeScreen} />
    <Stack.Screen name="CrearExpediente" component={CrearExpedienteScreen} options={{ headerShown: true, title: 'Nuevo expediente' }} />
  <Stack.Screen name="ExpedienteDetalle" component={ExpedienteDetalleScreen} options={{ headerShown: true, title: 'Detalle del expediente' }} />
  </>
      ) : (
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
        </>
      )}
    </Stack.Navigator>
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