import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from './screens/LoginScreen';
import MenuScreen from './screens/MenuScreen';
import BudgetSetupScreen from './screens/BudgetSetupScreen';
import AddExpenseScreen from './screens/AddExpenseScreen';
import { initDatabase } from './src/database/initDb';
import { authService } from './src/services/authService';
import { budgetService } from './src/services/budgetService';
import { COLORS } from './src/theme/theme';

const Stack = createNativeStackNavigator();

export default function App() {
  const [initialRoute, setInitialRoute] = useState<string | null>(null);

  useEffect(() => {
    bootstrapApp();
  }, []);

  const bootstrapApp = async () => {
    try {
      // 1. Inicializar SQLite
      await initDatabase();

      // 2. Verificar si hay sesión activa
      const session = await authService.getActiveSession();
      if (session) {
        // 3. Verificar si ya configuró su presupuesto inicial
        const budget = await budgetService.getBudgetByUserId(session.id);
        if (budget) {
          setInitialRoute('Menu');
        } else {
          setInitialRoute('BudgetSetup');
        }
      } else {
        setInitialRoute('Login');
      }
    } catch (error) {
      console.error('Error durante el arranque:', error);
      setInitialRoute('Login');
    }
  };

  if (!initialRoute) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={COLORS.secondary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName={initialRoute} screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="BudgetSetup" component={BudgetSetupScreen} />
        <Stack.Screen name="Menu" component={MenuScreen} />
        <Stack.Screen name="AddExpense" component={AddExpenseScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}