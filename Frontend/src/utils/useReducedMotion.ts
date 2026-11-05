import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/** true si el dispositivo pide reducir el movimiento: las animaciones pasan a cambios directos. */
export const useReducedMotion = (): boolean => {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let isMounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (isMounted) setReduceMotion(enabled);
      })
      .catch(() => {});
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      isMounted = false;
      subscription.remove();
    };
  }, []);

  return reduceMotion;
};
