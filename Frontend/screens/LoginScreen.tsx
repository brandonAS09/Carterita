import React, { useEffect, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Mail, Lock, User as UserIcon, Eye, EyeOff } from 'lucide-react-native';
import { useTheme, useThemedStyles } from '../src/theme/ThemeProvider';
import { MIN_TOUCH, RADIUS, SPACING, ThemeColors, TYPOGRAPHY } from '../src/theme/theme';
import { authService } from '../src/services/authService';
import { budgetService } from '../src/services/budgetService';
import HeroHeader from '../src/components/ui/HeroHeader';
import Button from '../src/components/ui/Button';
import TextField from '../src/components/ui/TextField';
import { Banner } from '../src/components/ui/Form';
import { Logo } from '../src/components/ui/HomeBlocks';

export default function LoginScreen({ navigation }: any) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  // Escenario 10: con el teclado abierto la cabecera se reduce para que el formulario siga visible
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  useEffect(() => {
    const subscriptions = [
      Keyboard.addListener('keyboardDidShow', () => setIsKeyboardOpen(true)),
      Keyboard.addListener('keyboardDidHide', () => setIsKeyboardOpen(false)),
    ];
    return () => subscriptions.forEach((subscription) => subscription.remove());
  }, []);
  const [isLoginMode, setIsLoginMode] = useState(true);

  // Campos de formulario
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Estados de interacción (Touched para validación onBlur)
  const [touched, setTouched] = useState({
    nombre: false,
    email: false,
    password: false,
  });

  // Estados de control
  const [isLoading, setIsLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  // Validaciones
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const isEmailValid = emailRegex.test(email.trim());
  const isPasswordValid = password.length >= 6;
  const isNombreValid = isLoginMode || nombre.trim().length >= 2;

  // Botón habilitado solo si todos los campos requeridos son válidos
  const isFormValid = isEmailValid && isPasswordValid && isNombreValid;

  const handleBlur = (field: 'nombre' | 'email' | 'password') => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const handleToggleMode = (mode: boolean) => {
    setIsLoginMode(mode);
    setServerError(null);
    setTouched({ nombre: false, email: false, password: false });
  };

  const handleSubmit = async () => {
    if (!isFormValid || isLoading) return;

    setIsLoading(true);
    setServerError(null);

    try {
      let user;
      if (isLoginMode) {
        user = await authService.login(email, password);
      } else {
        user = await authService.register(nombre, email, password);
      }

      // Validar si el usuario ya tiene configurado su presupuesto inicial
      const budget = await budgetService.getBudgetByUserId(user.id);
      if (budget) {
        navigation.replace('Menu');
      } else {
        navigation.replace('BudgetSetup');
      }
    } catch (error: any) {
      setServerError(error.message || 'Ocurrió un error inesperado.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <HeroHeader variant="full" collapsed={isKeyboardOpen}>
          <View style={styles.heroContent}>
            <Logo size={isKeyboardOpen ? 'small' : 'large'} />
            {!isKeyboardOpen && (
              <Text style={styles.heroSubtitle}>
                {isLoginMode ? 'Inicia sesión para gestionar tus finanzas' : 'Crea tu cuenta para comenzar a ahorrar'}
              </Text>
            )}
          </View>
        </HeroHeader>

        <View style={styles.body}>
          {/* Selector de Modo (Login / Registro) */}
          <View style={styles.tabs} accessibilityRole="radiogroup">
            {[
              { mode: true, label: 'Iniciar Sesión' },
              { mode: false, label: 'Registrarse' },
            ].map(({ mode, label }) => {
              const isSelected = isLoginMode === mode;
              return (
                <Pressable
                  key={label}
                  style={[styles.tab, isSelected && { backgroundColor: colors.primary }]}
                  onPress={() => handleToggleMode(mode)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                >
                  <Text style={[styles.tabText, isSelected && { color: colors.onPrimary }]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>

          {/* Banner de Error (Caso Negativo) */}
          {serverError && <Banner tone="error" message={serverError} />}

          {/* Campo Nombre (Solo en Registro) */}
          {!isLoginMode && (
            <TextField
              label="Nombre completo"
              leftIcon={UserIcon}
              placeholder="Tu nombre"
              value={nombre}
              onChangeText={(val) => {
                setNombre(val);
                if (serverError) setServerError(null);
              }}
              onBlur={() => handleBlur('nombre')}
              autoCapitalize="words"
              error={touched.nombre && !isNombreValid ? 'El nombre debe tener al menos 2 caracteres.' : null}
              containerStyle={styles.field}
            />
          )}

          <TextField
            label="Correo electrónico"
            leftIcon={Mail}
            placeholder="ejemplo@correo.com"
            value={email}
            onChangeText={(val) => {
              setEmail(val);
              if (serverError) setServerError(null);
            }}
            onBlur={() => handleBlur('email')}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            error={touched.email && !isEmailValid ? 'Ingresa un correo electrónico válido.' : null}
            containerStyle={styles.field}
          />

          <TextField
            label="Contraseña"
            leftIcon={Lock}
            placeholder="Mínimo 6 caracteres"
            value={password}
            onChangeText={(val) => {
              setPassword(val);
              if (serverError) setServerError(null);
            }}
            onBlur={() => handleBlur('password')}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            error={touched.password && !isPasswordValid ? 'La contraseña debe tener al menos 6 caracteres.' : null}
            containerStyle={styles.field}
            rightAccessory={
              <Pressable
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeButton}
                accessibilityRole="button"
                accessibilityLabel={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {showPassword ? (
                  <EyeOff color={colors.textSecondary} size={20} />
                ) : (
                  <Eye color={colors.textSecondary} size={20} />
                )}
              </Pressable>
            }
          />

          {/* Criterio de Aceptación: deshabilitado si incompleto, indicador de carga al enviar */}
          <Button
            label={isLoginMode ? 'Iniciar Sesión' : 'Crear Cuenta'}
            onPress={handleSubmit}
            disabled={!isFormValid}
            loading={isLoading}
            style={styles.submit}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    scrollContent: { flexGrow: 1, paddingBottom: SPACING.xl },
    heroContent: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.xs },
    heroSubtitle: { ...TYPOGRAPHY.body2, color: colors.onHeroSecondary, textAlign: 'center' },
    body: { paddingHorizontal: SPACING.md },
    tabs: {
      flexDirection: 'row',
      backgroundColor: colors.surfaceVariant,
      borderRadius: RADIUS.pill,
      padding: 4,
      marginBottom: SPACING.md,
    },
    tab: {
      flex: 1,
      minHeight: MIN_TOUCH - 8,
      borderRadius: RADIUS.pill,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 4,
    },
    tabText: { ...TYPOGRAPHY.body2Strong, color: colors.text, textAlign: 'center' },
    field: { marginBottom: SPACING.sm },
    eyeButton: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center', marginRight: -SPACING.sm },
    submit: { marginTop: SPACING.xs },
  });
