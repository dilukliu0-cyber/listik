// Анимации в духе iOS: пружины, появление шторок, нажатия с масштабом.
// Всё считается на UI-потоке через Reanimated.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Platform, Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming, type SharedValue } from 'react-native-reanimated';

import { haptic } from '../haptics';

export const SPRING = { damping: 22, stiffness: 260, mass: 0.9 } as const;
export const SPRING_SOFT = { damping: 18, stiffness: 180, mass: 1 } as const;
export const SPRING_BOUNCY = { damping: 14, stiffness: 320, mass: 0.8 } as const;
export const EASE_OUT = Easing.bezier(0.25, 0.1, 0.25, 1);

/**
 * Показ/скрытие окна с анимацией выхода.
 * mounted — держать ли Modal; progress 0→1 — фаза появления.
 * onHidden вызывается, когда окно полностью убрано с экрана (iOS: после onDismiss у Modal),
 * только после этого можно открывать системные пикеры — иначе iOS не покажет их и экран зависнет.
 */
export function usePresence(visible: boolean, opts: { inMs?: number; outMs?: number; spring?: boolean } = {}) {
  const { outMs = 200 } = opts;
  const [mounted, setMounted] = useState(visible);
  const progress = useSharedValue(0);
  const waiters = useRef<(() => void)[]>([]);
  const fallback = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = () => {
    if (fallback.current) clearTimeout(fallback.current);
    fallback.current = null;
    const list = waiters.current;
    waiters.current = [];
    list.forEach((f) => f());
  };

  const unmount = () => {
    setMounted(false);
    // onDismiss у Modal есть только на iOS; на всякий случай — запасной таймер
    fallback.current = setTimeout(flush, Platform.OS === 'ios' ? 700 : 0);
  };

  useEffect(() => {
    if (visible) {
      setMounted(true);
      progress.value = opts.spring === false ? withTiming(1, { duration: opts.inMs ?? 260, easing: EASE_OUT }) : withSpring(1, SPRING);
    } else if (mounted) {
      progress.value = withTiming(0, { duration: outMs, easing: EASE_OUT }, (done) => {
        if (done) runOnJS(unmount)();
      });
    } else {
      flush();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(() => () => flush(), []);

  /** Выполнить, когда окно полностью исчезнет */
  const afterHidden = (f: () => void) => {
    waiters.current.push(f);
  };

  return { mounted, progress, onDismiss: flush, afterHidden };
}

/** Фон-затемнение, привязанный к progress */
export function useFadeStyle(progress: SharedValue<number>) {
  return useAnimatedStyle(() => ({ opacity: Math.min(1, Math.max(0, progress.value)) }));
}

type PressScaleProps = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
  scaleTo?: number;
  feedback?: 'light' | 'select' | 'none';
};

const APressable = Animated.createAnimatedComponent(Pressable);

/** Кнопка с лёгким сжатием при нажатии и вибро-откликом */
export function PressScale({ style, children, scaleTo = 0.92, feedback = 'light', onPressIn, onPressOut, onPress, ...rest }: PressScaleProps) {
  const s = useSharedValue(1);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <APressable
      {...rest}
      onPressIn={(e) => {
        s.value = withTiming(scaleTo, { duration: 90 });
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        s.value = withSpring(1, SPRING_BOUNCY);
        onPressOut?.(e);
      }}
      onPress={(e) => {
        if (feedback === 'light') haptic.light();
        else if (feedback === 'select') haptic.select();
        onPress?.(e);
      }}
      style={[style, a]}
    >
      {children}
    </APressable>
  );
}

export const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
