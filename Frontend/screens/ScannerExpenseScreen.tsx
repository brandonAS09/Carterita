import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
  Modal,
  Pressable,
  Switch,
  Linking,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import {
  AlertCircle,
  Camera,
  CameraOff,
  ChevronLeft,
  Images,
  PenLine,
  RotateCcw,
  ScanLine,
  Settings,
} from 'lucide-react-native';
import ReceiptOcr from '../modules/receipt-ocr';
import { COLORS, SIZES } from '../src/theme/theme';
import { authService } from '../src/services/authService';
import { budgetService, Presupuesto } from '../src/services/budgetService';
import { transactionService, Categoria } from '../src/services/transactionService';
import { isTicketDateUsable, parseReceipt, ParsedReceipt } from '../src/utils/receiptParser';
import { parseDateKey, toLocalDateKey } from '../src/utils/dateUtils';
import ExpenseReviewForm, { ExpenseReviewValues } from '../src/components/ExpenseReviewForm';

/**
 * F04 - Registro de Gasto por Escáner.
 * Flujo: choose → cámara o galería → processing → review (o no-text) → guardar.
 */
type Phase = 'checking' | 'needs-dev-build' | 'permission-denied' | 'choose' | 'processing' | 'no-text' | 'review';

const MSG_NO_TEXT = 'No pudimos leer texto en la imagen. Intenta con más luz y encuadrando solo el ticket.';
const DEFAULT_CONCEPTO = 'Gasto por ticket';
const EMPTY_RECEIPT: ParsedReceipt = {
  total: null,
  candidatos: [],
  comercio: null,
  fecha: null,
  categoria: null,
  confianza: 'baja',
};
const PICKER_OPTIONS: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: true, quality: 1 };

const formatTicketDate = (key: string) =>
  parseDateKey(key).toLocaleDateString('es-MX', { day: 'numeric', month: 'long' });

export default function ScannerExpenseScreen({ navigation }: any) {
  const [phase, setPhase] = useState<Phase>('checking');
  const [userId, setUserId] = useState<number | null>(null);
  const [budget, setBudget] = useState<Presupuesto | null>(null);
  const [categorias, setCategorias] = useState<Categoria[]>([]);

  const [notice, setNotice] = useState<string | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [isPhotoOpen, setIsPhotoOpen] = useState(false);
  const [receipt, setReceipt] = useState<ParsedReceipt>(EMPTY_RECEIPT);
  const [useTicketDate, setUseTicketDate] = useState(true);

  useEffect(() => {
    const init = async () => {
      if (!ReceiptOcr) {
        setPhase('needs-dev-build');
        return;
      }
      try {
        const session = await authService.getActiveSession();
        if (!session) {
          navigation.replace('Login');
          return;
        }
        setUserId(session.id);
        const [b, cats] = await Promise.all([
          budgetService.getBudgetByUserId(session.id),
          transactionService.getAllCategories(),
        ]);
        setBudget(b);
        setCategorias(cats);
      } catch {
        setNotice('No se pudieron cargar tus datos. Intenta de nuevo.');
      }
      setPhase('choose');
    };
    init();
  }, [navigation]);

  // ─────────────────────────────────────────────
  // Captura y lectura
  // ─────────────────────────────────────────────
  const processImage = async (uri: string) => {
    setPhotoUri(uri);
    setPhase('processing');
    try {
      const { lines } = await ReceiptOcr!.recognizeText(uri);
      if (!lines.length) {
        setReceipt(EMPTY_RECEIPT);
        setPhase('no-text'); // Escenario 7
        return;
      }
      setReceipt(parseReceipt(lines, toLocalDateKey()));
      setUseTicketDate(true);
      setPhase('review');
    } catch (error) {
      console.error('Error al leer el ticket:', error);
      setReceipt(EMPTY_RECEIPT);
      setPhase('no-text');
    }
  };

  const handlePickerResult = (result: ImagePicker.ImagePickerResult) => {
    if (result.canceled) {
      navigation.goBack(); // Escenario 8
      return;
    }
    processImage(result.assets[0].uri);
  };

  const openPicker = async (launch: () => Promise<ImagePicker.ImagePickerResult>) => {
    setNotice(null);
    try {
      handlePickerResult(await launch());
    } catch (error) {
      console.error('Error al obtener la imagen:', error);
      setNotice('No se pudo obtener la imagen. Intenta de nuevo.');
      setPhase('choose');
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      setPhase('permission-denied'); // Escenario 2
      return;
    }
    openPicker(() => ImagePicker.launchCameraAsync(PICKER_OPTIONS));
  };

  const pickFromGallery = () => openPicker(() => ImagePicker.launchImageLibraryAsync(PICKER_OPTIONS));

  const goManual = () => navigation.replace('AddExpense');

  // ─────────────────────────────────────────────
  // Guardado
  // ─────────────────────────────────────────────
  const ticketDate =
    budget && isTicketDateUsable(receipt.fecha, toLocalDateKey(), budget.fecha_inicio) ? receipt.fecha : null;

  const handleSave = async ({ monto, concepto, categoriaId }: ExpenseReviewValues) => {
    await transactionService.addTransaction(
      userId!,
      monto,
      concepto,
      categoriaId,
      'OCR',
      useTicketDate && ticketDate ? ticketDate : undefined
    );
    navigation.goBack(); // el Dashboard se actualiza al recibir foco
  };

  // ─────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────
  const galleryButton = (
    <TouchableOpacity style={styles.secondaryButton} onPress={pickFromGallery} activeOpacity={0.8}>
      <Images color={COLORS.secondary} size={18} />
      <Text style={styles.secondaryButtonText}>Elegir de la galería</Text>
    </TouchableOpacity>
  );

  const manualButton = (
    <TouchableOpacity style={styles.secondaryButton} onPress={goManual} activeOpacity={0.8}>
      <PenLine color={COLORS.secondary} size={18} />
      <Text style={styles.secondaryButtonText}>Registrar manualmente</Text>
    </TouchableOpacity>
  );

  const photoThumbnail = photoUri && (
    <TouchableOpacity
      style={styles.photoCard}
      onPress={() => setIsPhotoOpen(true)}
      activeOpacity={0.8}
      accessibilityRole="imagebutton"
      accessibilityLabel="Ampliar la foto del ticket"
    >
      <Image source={{ uri: photoUri }} style={styles.photo} />
      <View style={styles.photoText}>
        <Text style={styles.photoTitle}>
          {receipt.total !== null ? 'Revisa lo que leímos' : 'No encontramos el total con certeza'}
        </Text>
        <Text style={styles.photoHint}>Toca la foto para ampliarla</Text>
      </View>
    </TouchableOpacity>
  );

  const renderContent = () => {
    switch (phase) {
      case 'checking':
        return (
          <View style={styles.centerBlock}>
            <ActivityIndicator size="large" color={COLORS.secondary} />
          </View>
        );

      case 'needs-dev-build':
        return (
          <View style={styles.centerBlock}>
            <View style={styles.blockIcon}>
              <CameraOff color={COLORS.error} size={36} />
            </View>
            <Text style={styles.title}>Escáner no disponible</Text>
            <Text style={styles.message}>
              El escáner necesita la versión de desarrollo de Carterita. No está disponible en Expo Go.
            </Text>
            <View style={styles.actions}>{manualButton}</View>
          </View>
        );

      case 'permission-denied':
        return (
          <View style={styles.centerBlock}>
            <View style={styles.blockIcon}>
              <CameraOff color={COLORS.error} size={36} />
            </View>
            <Text style={styles.title}>Permiso de cámara</Text>
            <Text style={styles.message}>
              Necesitamos la cámara para fotografiar tus tickets. También puedes elegir una foto que ya tengas.
            </Text>
            <View style={styles.actions}>
              {galleryButton}
              <TouchableOpacity style={styles.primaryButton} onPress={() => Linking.openSettings()} activeOpacity={0.8}>
                <Settings color={COLORS.background} size={18} />
                <Text style={styles.primaryButtonText}>Abrir ajustes</Text>
              </TouchableOpacity>
              {manualButton}
            </View>
          </View>
        );

      case 'processing':
        return (
          <View style={styles.centerBlock}>
            <ActivityIndicator size="large" color={COLORS.secondary} />
            <Text style={styles.title}>Leyendo tu ticket…</Text>
          </View>
        );

      case 'no-text':
        return (
          <View style={styles.centerBlock}>
            <View style={styles.warningCard}>
              <AlertCircle color={COLORS.error} size={20} />
              <Text style={styles.warningText}>{MSG_NO_TEXT}</Text>
            </View>
            <View style={styles.actions}>
              <TouchableOpacity style={styles.primaryButton} onPress={takePhoto} activeOpacity={0.8}>
                <RotateCcw color={COLORS.background} size={18} />
                <Text style={styles.primaryButtonText}>Tomar otra foto</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryButton} onPress={() => setPhase('review')} activeOpacity={0.8}>
                <Text style={styles.secondaryButtonText}>Continuar sin datos</Text>
              </TouchableOpacity>
            </View>
          </View>
        );

      case 'review':
        return (
          <ExpenseReviewForm
            initial={{
              monto: receipt.total,
              moneda: budget?.moneda ?? 'MXN',
              concepto: receipt.comercio ?? receipt.categoria ?? DEFAULT_CONCEPTO,
              categoria: receipt.categoria,
            }}
            budget={budget}
            categorias={categorias}
            userId={userId}
            suggestions={receipt.total === null ? receipt.candidatos : []}
            header={photoThumbnail}
            extra={
              ticketDate && (
                <View style={styles.dateCard}>
                  <Text style={styles.dateText}>Registrar con la fecha del ticket ({formatTicketDate(ticketDate)})</Text>
                  <Switch
                    value={useTicketDate}
                    onValueChange={setUseTicketDate}
                    trackColor={{ false: COLORS.disabledBg, true: COLORS.primary }}
                    thumbColor={useTicketDate ? COLORS.secondary : COLORS.textSecondary}
                  />
                </View>
              )
            }
            footer={(isSaving) => (
              <TouchableOpacity
                style={[styles.secondaryButton, styles.footerButton]}
                onPress={takePhoto}
                activeOpacity={0.8}
                disabled={isSaving}
              >
                <RotateCcw color={COLORS.secondary} size={18} />
                <Text style={styles.secondaryButtonText}>Tomar otra foto</Text>
              </TouchableOpacity>
            )}
            onSave={handleSave}
          />
        );

      default: // choose
        return (
          <View style={styles.centerBlock}>
            <View style={styles.blockIcon}>
              <ScanLine color={COLORS.secondary} size={36} />
            </View>
            <Text style={styles.title}>Escanea tu ticket</Text>
            <Text style={styles.message}>
              Busca buena luz y recorta la foto para que solo se vea el ticket. La lectura se hace en tu teléfono.
            </Text>
            {notice && (
              <View style={styles.warningCard}>
                <AlertCircle color={COLORS.error} size={20} />
                <Text style={styles.warningText}>{notice}</Text>
              </View>
            )}
            <View style={styles.actions}>
              <TouchableOpacity style={styles.primaryButton} onPress={takePhoto} activeOpacity={0.8}>
                <Camera color={COLORS.background} size={18} />
                <Text style={styles.primaryButtonText}>Tomar foto</Text>
              </TouchableOpacity>
              {galleryButton}
            </View>
          </View>
        );
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={styles.navBar}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} activeOpacity={0.8}>
            <ChevronLeft color={COLORS.text} size={24} />
          </TouchableOpacity>
          <Text style={styles.navTitle}>{phase === 'review' ? 'Confirmar Gasto' : 'Escanear Ticket'}</Text>
          <View style={{ width: 40 }} />
        </View>
        {renderContent()}
      </KeyboardAvoidingView>

      {photoUri && (
        <Modal visible={isPhotoOpen} transparent animationType="fade" onRequestClose={() => setIsPhotoOpen(false)}>
          <Pressable
            style={styles.photoModal}
            onPress={() => setIsPhotoOpen(false)}
            accessibilityLabel="Cerrar la foto del ticket"
          >
            <Image source={{ uri: photoUri }} style={styles.photoLarge} resizeMode="contain" />
          </Pressable>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SIZES.spacing.md,
    paddingVertical: SIZES.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.primary,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: SIZES.radius.button,
    backgroundColor: COLORS.tertiary,
    borderWidth: 1,
    borderColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navTitle: { color: COLORS.text, fontSize: SIZES.body1, fontWeight: '700', letterSpacing: 0.3 },
  centerBlock: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SIZES.spacing.lg,
    gap: SIZES.spacing.sm,
  },
  blockIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.tertiary,
    borderWidth: 1,
    borderColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: { color: COLORS.text, fontSize: SIZES.h2 - 4, fontWeight: 'bold', textAlign: 'center' },
  message: { color: COLORS.textSecondary, fontSize: SIZES.body2, textAlign: 'center', lineHeight: 20 },
  actions: { alignSelf: 'stretch', gap: SIZES.spacing.sm, marginTop: SIZES.spacing.md },
  warningCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SIZES.spacing.xs,
    backgroundColor: 'rgba(207, 102, 121, 0.15)',
    borderWidth: 1,
    borderColor: COLORS.error,
    borderRadius: SIZES.radius.button,
    padding: SIZES.spacing.sm,
  },
  warningText: { color: COLORS.error, fontSize: SIZES.body2, flex: 1, lineHeight: 20 },
  primaryButton: {
    flexDirection: 'row',
    gap: SIZES.spacing.xs,
    backgroundColor: COLORS.secondary,
    borderRadius: SIZES.radius.button,
    minHeight: 52,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButtonText: { color: COLORS.background, fontSize: SIZES.body1, fontWeight: 'bold' },
  secondaryButton: {
    flexDirection: 'row',
    gap: SIZES.spacing.xs,
    borderWidth: 2,
    borderColor: COLORS.secondary,
    borderRadius: SIZES.radius.button,
    minHeight: 52,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryButtonText: { color: COLORS.secondary, fontSize: SIZES.body1, fontWeight: '600' },
  footerButton: { marginTop: SIZES.spacing.sm },
  photoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.spacing.sm,
    backgroundColor: 'rgba(19, 92, 58, 0.25)',
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: SIZES.radius.card,
    padding: SIZES.spacing.sm,
    marginBottom: SIZES.spacing.md,
  },
  photo: { width: 64, height: 84, borderRadius: SIZES.radius.button, backgroundColor: COLORS.background },
  photoText: { flex: 1 },
  photoTitle: { color: COLORS.text, fontSize: SIZES.body2, fontWeight: '600' },
  photoHint: { color: COLORS.textSecondary, fontSize: 12, marginTop: 4 },
  photoModal: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SIZES.spacing.md,
  },
  photoLarge: { width: '100%', height: '100%' },
  dateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.spacing.sm,
    backgroundColor: COLORS.tertiary,
    borderRadius: SIZES.radius.card,
    padding: SIZES.spacing.md,
    marginBottom: SIZES.spacing.md,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  dateText: { color: COLORS.text, fontSize: SIZES.body2, flex: 1, lineHeight: 20 },
});
