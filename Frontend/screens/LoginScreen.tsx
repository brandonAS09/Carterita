import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar
} from 'react-native';
import { Mail, Lock, User as UserIcon, AlertCircle, Eye, EyeOff, Wallet } from 'lucide-react-native';
import { COLORS, SIZES } from '../src/theme/theme';
import { authService } from '../src/services/authService';

export default function LoginScreen({ navigation }: any) {
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
      if (isLoginMode) {
        await authService.login(email, password);
      } else {
        await authService.register(nombre, email, password);
      }
      // Navegación al Dashboard/Menú al autenticarse exitosamente
      navigation.replace('Menu');
    } catch (error: any) {
      setServerError(error.message || 'Ocurrió un error inesperado.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardContainer}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Encabezado / Logo */}
          <View style={styles.header}>
            <View style={styles.logoIconContainer}>
              <Wallet color={COLORS.secondary} size={36} />
            </View>
            <Text style={styles.appTitle}>Carterita</Text>
            <Text style={styles.appSubtitle}>
              {isLoginMode ? 'Inicia sesión para gestionar tus finanzas' : 'Crea tu cuenta para comenzar a ahorrar'}
            </Text>
          </View>

          {/* Selector de Modo (Login / Registro) */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tabButton, isLoginMode && styles.activeTabButton]}
              onPress={() => handleToggleMode(true)}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabText, isLoginMode && styles.activeTabText]}>
                Iniciar Sesión
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabButton, !isLoginMode && styles.activeTabButton]}
              onPress={() => handleToggleMode(false)}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabText, !isLoginMode && styles.activeTabText]}>
                Registrarse
              </Text>
            </TouchableOpacity>
          </View>

          {/* Banner de Error (Caso Negativo) */}
          {serverError && (
            <View style={styles.errorBanner}>
              <AlertCircle color={COLORS.error} size={20} />
              <Text style={styles.errorBannerText}>{serverError}</Text>
            </View>
          )}

          {/* Formulario */}
          <View style={styles.formContainer}>
            {/* Campo Nombre (Solo en Registro) */}
            {!isLoginMode && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Nombre completo</Text>
                <View
                  style={[
                    styles.inputWrapper,
                    touched.nombre && !isNombreValid && styles.inputWrapperError,
                  ]}
                >
                  <UserIcon color={COLORS.textSecondary} size={20} />
                  <TextInput
                    style={styles.textInput}
                    placeholder="Tu nombre"
                    placeholderTextColor={COLORS.textSecondary}
                    value={nombre}
                    onChangeText={(val) => {
                      setNombre(val);
                      if (serverError) setServerError(null);
                    }}
                    onBlur={() => handleBlur('nombre')}
                    autoCapitalize="words"
                  />
                </View>
                {touched.nombre && !isNombreValid && (
                  <Text style={styles.fieldErrorText}>El nombre debe tener al menos 2 caracteres.</Text>
                )}
              </View>
            )}

            {/* Campo Email */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Correo electrónico</Text>
              <View
                style={[
                  styles.inputWrapper,
                  touched.email && !isEmailValid && styles.inputWrapperError,
                ]}
              >
                <Mail color={COLORS.textSecondary} size={20} />
                <TextInput
                  style={styles.textInput}
                  placeholder="ejemplo@correo.com"
                  placeholderTextColor={COLORS.textSecondary}
                  value={email}
                  onChangeText={(val) => {
                    setEmail(val);
                    if (serverError) setServerError(null);
                  }}
                  onBlur={() => handleBlur('email')}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
              {touched.email && !isEmailValid && (
                <Text style={styles.fieldErrorText}>Ingresa un correo electrónico válido.</Text>
              )}
            </View>

            {/* Campo Contraseña */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Contraseña</Text>
              <View
                style={[
                  styles.inputWrapper,
                  touched.password && !isPasswordValid && styles.inputWrapperError,
                ]}
              >
                <Lock color={COLORS.textSecondary} size={20} />
                <TextInput
                  style={styles.textInput}
                  placeholder="Mínimo 6 caracteres"
                  placeholderTextColor={COLORS.textSecondary}
                  value={password}
                  onChangeText={(val) => {
                    setPassword(val);
                    if (serverError) setServerError(null);
                  }}
                  onBlur={() => handleBlur('password')}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  {showPassword ? (
                    <EyeOff color={COLORS.textSecondary} size={20} />
                  ) : (
                    <Eye color={COLORS.textSecondary} size={20} />
                  )}
                </TouchableOpacity>
              </View>
              {touched.password && !isPasswordValid && (
                <Text style={styles.fieldErrorText}>
                  La contraseña debe tener al menos 6 caracteres.
                </Text>
              )}
            </View>

            {/* Botón Principal (Criterio de Aceptación: Deshabilitado si incompleto / Spinner en carga) */}
            <TouchableOpacity
              style={[
                styles.submitButton,
                !isFormValid && styles.submitButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={!isFormValid || isLoading}
              activeOpacity={0.8}
            >
              {isLoading ? (
                <ActivityIndicator color={COLORS.background} size="small" />
              ) : (
                <Text
                  style={[
                    styles.submitButtonText,
                    !isFormValid && styles.submitButtonTextDisabled,
                  ]}
                >
                  {isLoginMode ? 'Iniciar Sesión' : 'Crear Cuenta'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: SIZES.spacing.lg,
    paddingVertical: SIZES.spacing.xl,
  },
  header: {
    alignItems: 'center',
    marginBottom: SIZES.spacing.lg,
  },
  logoIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.tertiary,
    borderWidth: 1,
    borderColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SIZES.spacing.sm,
  },
  appTitle: {
    color: COLORS.text,
    fontSize: SIZES.h1,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  appSubtitle: {
    color: COLORS.textSecondary,
    fontSize: SIZES.body2,
    textAlign: 'center',
    marginTop: SIZES.spacing.xs,
    paddingHorizontal: SIZES.spacing.md,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.tertiary,
    borderRadius: SIZES.radius.button,
    padding: 4,
    marginBottom: SIZES.spacing.lg,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: SIZES.radius.button - 2,
  },
  activeTabButton: {
    backgroundColor: COLORS.primary,
  },
  tabText: {
    color: COLORS.textSecondary,
    fontSize: SIZES.body2,
    fontWeight: '600',
  },
  activeTabText: {
    color: COLORS.text,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(207, 102, 121, 0.15)',
    borderWidth: 1,
    borderColor: COLORS.error,
    borderRadius: SIZES.radius.button,
    padding: SIZES.spacing.sm,
    marginBottom: SIZES.spacing.md,
    gap: SIZES.spacing.xs,
  },
  errorBannerText: {
    color: COLORS.error,
    fontSize: SIZES.body2,
    flex: 1,
  },
  formContainer: {
    backgroundColor: COLORS.tertiary,
    borderRadius: SIZES.radius.card,
    padding: SIZES.spacing.lg,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  inputGroup: {
    marginBottom: SIZES.spacing.md,
  },
  inputLabel: {
    color: COLORS.text,
    fontSize: SIZES.body2,
    fontWeight: '500',
    marginBottom: SIZES.spacing.xs,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: SIZES.radius.button,
    borderWidth: 1,
    borderColor: COLORS.primary,
    paddingHorizontal: SIZES.spacing.md,
    height: 48,
    gap: SIZES.spacing.xs,
  },
  inputWrapperError: {
    borderColor: COLORS.error,
  },
  textInput: {
    flex: 1,
    color: COLORS.text,
    fontSize: SIZES.body1,
    height: '100%',
  },
  fieldErrorText: {
    color: COLORS.error,
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
  submitButton: {
    backgroundColor: COLORS.secondary,
    borderRadius: SIZES.radius.button,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SIZES.spacing.sm,
  },
  submitButtonDisabled: {
    backgroundColor: COLORS.disabledBg,
  },
  submitButtonText: {
    color: COLORS.background,
    fontSize: SIZES.body1,
    fontWeight: 'bold',
  },
  submitButtonTextDisabled: {
    color: COLORS.disabledText,
  },
});