import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
  Modal,
  Switch,
  Linking,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Camera, CameraOff, Images, PenLine, RotateCcw, ScanLine, Settings, type LucideIcon } from 'lucide-react-native';
import ReceiptOcr from '../modules/receipt-ocr';
import { useTheme, useThemedStyles } from '../src/theme/ThemeProvider';
import { RADIUS, SPACING, ThemeColors, TYPOGRAPHY } from '../src/theme/theme';
import { authService } from '../src/services/authService';
import { budgetService, Presupuesto } from '../src/services/budgetService';
import { transactionService, Categoria } from '../src/services/transactionService';
import { isTicketDateUsable, parseReceipt, ParsedReceipt } from '../src/utils/receiptParser';
import { parseDateKey, toLocalDateKey } from '../src/utils/dateUtils';
import ExpenseReviewForm, { ExpenseReviewValues } from '../src/components/ExpenseReviewForm';
import HeroHeader from '../src/components/ui/HeroHeader';
import Button from '../src/components/ui/Button';
import Card from '../src/components/ui/Card';
import { Banner } from '../src/components/ui/Form';

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
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
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
  const galleryButton = <Button label="Elegir de la galería" variant="secondary" icon={Images} onPress={pickFromGallery} />;
  const manualButton = <Button label="Registrar manualmente" variant="secondary" icon={PenLine} onPress={goManual} />;

  const renderBlock = (Icon: LucideIcon, iconColor: string, title: string, message: string, actions: React.ReactNode) => (
    <View style={styles.centerBlock}>
      <View style={styles.blockIcon}>
        <Icon color={iconColor} size={36} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {notice && <Banner tone="error" message={notice} />}
      <View style={styles.actions}>{actions}</View>
    </View>
  );

  const photoThumbnail = photoUri && (
    <Pressable
      style={styles.photoCard}
      onPress={() => setIsPhotoOpen(true)}
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
    </Pressable>
  );

  const renderContent = () => {
    switch (phase) {
      case 'checking':
        return (
          <View style={styles.centerBlock}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        );

      case 'needs-dev-build':
        return renderBlock(
          CameraOff,
          colors.error,
          'Escáner no disponible',
          'El escáner necesita la versión de desarrollo de Carterita. No está disponible en Expo Go.',
          manualButton
        );

      case 'permission-denied':
        return renderBlock(
          CameraOff,
          colors.error,
          'Permiso de cámara',
          'Necesitamos la cámara para fotografiar tus tickets. También puedes elegir una foto que ya tengas.',
          <>
            <Button label="Abrir ajustes" icon={Settings} onPress={() => Linking.openSettings()} />
            {galleryButton}
            {manualButton}
          </>
        );

      case 'processing':
        return (
          <View style={styles.centerBlock} accessibilityLiveRegion="polite">
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.title}>Leyendo tu ticket…</Text>
          </View>
        );

      case 'no-text':
        return (
          <View style={styles.centerBlock}>
            <Banner tone="error" message={MSG_NO_TEXT} />
            <View style={styles.actions}>
              <Button label="Tomar otra foto" icon={RotateCcw} onPress={takePhoto} />
              <Button label="Continuar sin datos" variant="secondary" onPress={() => setPhase('review')} />
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
                <Card style={styles.dateCard}>
                  <Text style={styles.dateText}>Registrar con la fecha del ticket ({formatTicketDate(ticketDate)})</Text>
                  <Switch
                    value={useTicketDate}
                    onValueChange={setUseTicketDate}
                    accessibilityLabel="Registrar con la fecha del ticket"
                    trackColor={{ false: colors.surfaceVariant, true: colors.primary }}
                    thumbColor={useTicketDate ? colors.onPrimary : colors.border}
                  />
                </Card>
              )
            }
            footer={(isSaving) => (
              <Button
                label="Tomar otra foto"
                variant="secondary"
                icon={RotateCcw}
                onPress={takePhoto}
                disabled={isSaving}
                style={styles.footerButton}
              />
            )}
            onSave={handleSave}
          />
        );

      default: // choose
        return renderBlock(
          ScanLine,
          colors.primary,
          'Escanea tu ticket',
          'Busca buena luz y recorta la foto para que solo se vea el ticket. La lectura se hace en tu teléfono.',
          <>
            <Button label="Tomar foto" icon={Camera} onPress={takePhoto} />
            {galleryButton}
          </>
        );
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.screen}>
      <HeroHeader title={phase === 'review' ? 'Confirmar Gasto' : 'Escanear Ticket'} onBack={() => navigation.goBack()} />
      {renderContent()}

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
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    centerBlock: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: SPACING.md, gap: SPACING.sm },
    blockIcon: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: colors.surfaceVariant,
      justifyContent: 'center',
      alignItems: 'center',
    },
    title: { ...TYPOGRAPHY.h3, color: colors.text, textAlign: 'center' },
    message: { ...TYPOGRAPHY.body2, color: colors.textSecondary, textAlign: 'center' },
    actions: { alignSelf: 'stretch', gap: SPACING.sm, marginTop: SPACING.xs },
    footerButton: { marginTop: SPACING.sm },
    photoCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      backgroundColor: colors.surfaceVariant,
      borderRadius: RADIUS.lg,
      padding: SPACING.sm,
      marginBottom: SPACING.sm,
    },
    photo: { width: 64, height: 84, borderRadius: RADIUS.sm, backgroundColor: colors.surface },
    photoText: { flex: 1 },
    photoTitle: { ...TYPOGRAPHY.body2Strong, color: colors.text },
    photoHint: { ...TYPOGRAPHY.caption, color: colors.textSecondary, marginTop: 4 },
    photoModal: { flex: 1, backgroundColor: colors.scrim, justifyContent: 'center', alignItems: 'center', padding: SPACING.md },
    photoLarge: { width: '100%', height: '100%' },
    dateCard: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.sm },
    dateText: { ...TYPOGRAPHY.body2, color: colors.text, flex: 1 },
  });
