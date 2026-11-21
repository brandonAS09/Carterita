import React, { useCallback, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { ChevronRight, KeyRound, Plus, Users } from 'lucide-react-native';
import { useTheme, useThemedStyles } from '../src/theme/ThemeProvider';
import { MIN_TOUCH, RADIUS, SPACING, ThemeColors, TYPOGRAPHY } from '../src/theme/theme';
import { groupService, GrupoResumen } from '../src/services/groupService';
import { mensajeDeError } from '../src/api/client';
import HeroHeader from '../src/components/ui/HeroHeader';
import Button from '../src/components/ui/Button';
import Card from '../src/components/ui/Card';
import TextField from '../src/components/ui/TextField';
import { Banner } from '../src/components/ui/Form';
import { EmptyState, ErrorState, Skeleton } from '../src/components/ui/States';

type Dialogo = 'crear' | 'unirse' | null;

/** S8-01: lista de grupos, crear uno y unirse con código. */
export default function GroupsScreen({ navigation }: any) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [grupos, setGrupos] = useState<GrupoResumen[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [dialogo, setDialogo] = useState<Dialogo>(null);
  const [texto, setTexto] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setIsRefreshing(true);
    setLoadError(null);
    try {
      setGrupos(await groupService.getGroups());
    } catch (error) {
      setLoadError(mensajeDeError(error, 'No pudimos cargar tus grupos.'));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const abrir = (tipo: Dialogo) => {
    setTexto('');
    setDialogError(null);
    setDialogo(tipo);
  };

  const valido = dialogo === 'crear' ? texto.trim().length >= 2 : /^[A-Za-z0-9]{6}$/.test(texto.trim());

  const confirmar = async () => {
    if (!valido || isSaving) return;
    setIsSaving(true);
    setDialogError(null);
    try {
      const grupo = dialogo === 'crear' ? await groupService.createGroup(texto) : await groupService.joinGroup(texto);
      setDialogo(null);
      navigation.navigate('GroupDetail', { grupoId: grupo.id, nombre: grupo.nombre });
    } catch (error) {
      // El formulario conserva lo escrito para reintentar (S7-07)
      setDialogError(mensajeDeError(error));
    } finally {
      setIsSaving(false);
    }
  };

  const renderBody = () => {
    if (isLoading) return [1, 2].map((i) => <Skeleton key={i} width="100%" height={84} style={styles.skeleton} />);
    if (loadError) return <ErrorState message={loadError} onRetry={() => load()} />;
    if (grupos.length === 0) {
      return (
        <EmptyState
          icon={Users}
          title="Ahorra en equipo"
          message="Crea un grupo con tu pareja, familia o roomies para ahorrar juntos y ver los gastos que comparten. Tu presupuesto personal sigue siendo privado."
        >
          <Button label="Crear grupo" icon={Plus} onPress={() => abrir('crear')} style={styles.fullButton} />
          <Button label="Unirme con código" icon={KeyRound} variant="secondary" onPress={() => abrir('unirse')} style={styles.fullButton} />
        </EmptyState>
      );
    }
    return (
      <>
        {grupos.map((grupo) => (
          <Pressable
            key={grupo.id}
            onPress={() => navigation.navigate('GroupDetail', { grupoId: grupo.id, nombre: grupo.nombre })}
            accessibilityRole="button"
            accessibilityLabel={`${grupo.nombre}, ${grupo.miembros} miembros${grupo.rol === 'Admin' ? ', eres administrador' : ''}`}
          >
            <Card style={styles.groupCard}>
              <View style={styles.groupIcon}>
                <Users color={colors.primary} size={22} />
              </View>
              <View style={styles.flex}>
                <Text style={styles.groupName}>{grupo.nombre}</Text>
                <Text style={styles.groupMeta}>
                  {grupo.miembros} {grupo.miembros === 1 ? 'miembro' : 'miembros'} · {grupo.metas}{' '}
                  {grupo.metas === 1 ? 'meta' : 'metas'}
                  {grupo.rol === 'Admin' ? ' · Administrador' : ''}
                </Text>
              </View>
              <ChevronRight color={colors.textSecondary} size={20} />
            </Card>
          </Pressable>
        ))}
        <View style={styles.actions}>
          <Button label="Crear grupo" icon={Plus} variant="secondary" onPress={() => abrir('crear')} />
          <Button label="Unirme con código" icon={KeyRound} variant="text" onPress={() => abrir('unirse')} />
        </View>
      </>
    );
  };

  return (
    <View style={styles.screen}>
      <HeroHeader title="Grupos" />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => load(true)}
            tintColor={colors.primary}
            colors={[colors.primary]}
            progressBackgroundColor={colors.surface}
          />
        }
      >
        {renderBody()}
      </ScrollView>

      <Modal visible={dialogo !== null} transparent animationType="fade" onRequestClose={() => setDialogo(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.overlay}>
          <View style={styles.dialog} accessibilityViewIsModal>
            <Text style={styles.dialogTitle} accessibilityRole="header">
              {dialogo === 'crear' ? 'Nuevo grupo' : 'Unirme a un grupo'}
            </Text>
            <Text style={styles.dialogMessage}>
              {dialogo === 'crear'
                ? 'Ponle un nombre que todos reconozcan, como "Viaje a Oaxaca" o "Casa".'
                : 'Escribe el código de 6 caracteres que te compartió el administrador del grupo.'}
            </Text>
            {dialogError && <Banner tone="error" message={dialogError} />}
            <TextField
              label={dialogo === 'crear' ? 'Nombre del grupo' : 'Código'}
              value={texto}
              onChangeText={(t) => setTexto(dialogo === 'unirse' ? t.toUpperCase().slice(0, 6) : t)}
              autoFocus
              autoCapitalize={dialogo === 'unirse' ? 'characters' : 'sentences'}
              autoCorrect={false}
              maxLength={dialogo === 'crear' ? 40 : 6}
              onSubmitEditing={confirmar}
            />
            <View style={styles.dialogActions}>
              <Button
                label={dialogo === 'crear' ? 'Crear grupo' : 'Unirme'}
                disabled={!valido}
                loading={isSaving}
                onPress={confirmar}
              />
              <Button label="Cancelar" variant="text" onPress={() => setDialogo(null)} />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    content: { padding: SPACING.md, paddingBottom: SPACING.xl },
    skeleton: { borderRadius: RADIUS.lg, marginBottom: SPACING.sm },
    flex: { flex: 1 },
    fullButton: { alignSelf: 'stretch', marginTop: SPACING.xs },
    groupCard: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.sm, minHeight: MIN_TOUCH },
    groupIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.surfaceVariant,
      alignItems: 'center',
      justifyContent: 'center',
    },
    groupName: { ...TYPOGRAPHY.body1Strong, color: colors.text },
    groupMeta: { ...TYPOGRAPHY.caption, color: colors.textSecondary, marginTop: 2 },
    actions: { gap: SPACING.xs, marginTop: SPACING.sm },
    overlay: { flex: 1, backgroundColor: colors.scrim, justifyContent: 'center', padding: SPACING.md },
    dialog: { backgroundColor: colors.surface, borderRadius: RADIUS.xl, padding: SPACING.lg, gap: SPACING.sm },
    dialogTitle: { ...TYPOGRAPHY.h3, color: colors.text },
    dialogMessage: { ...TYPOGRAPHY.body2, color: colors.textSecondary },
    dialogActions: { gap: SPACING.xs, marginTop: SPACING.xs },
  });
