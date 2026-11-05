import * as Haptics from 'expo-haptics';

/** Vibración ligera al guardar un gasto o lograr una meta. Si el dispositivo no vibra, no pasa nada. */
export const notifySuccess = (): void => {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
};
