// Общие элементы в стиле iOS: сгруппированные списки, переключатели, шапки, шторки.
import { useEffect, useRef, type ReactNode } from 'react';
import { Modal, PanResponder, Pressable, StyleSheet, Switch, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { haptic } from '../haptics';
import { useTheme } from '../theme';
import Icon, { type IconName } from './Icon';
import { PressScale, SPRING, usePresence } from './motion';

export function Group({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  return <View style={[{ backgroundColor: t.card, borderRadius: 12, marginHorizontal: 16, marginBottom: 22, overflow: 'hidden' }, style]}>{children}</View>;
}

export function Caption({ children, top }: { children: ReactNode; top?: boolean }) {
  const t = useTheme();
  return (
    <Text style={{ color: t.sub, fontSize: top ? 13 : 13, marginHorizontal: 32, marginTop: top ? 0 : -14, marginBottom: top ? 7 : 22, textTransform: top ? 'uppercase' : 'none' }}>
      {children}
    </Text>
  );
}

type RowProps = {
  icon?: IconName;
  iconBg?: string;
  title: string;
  subtitle?: string;
  value?: string;
  chevron?: boolean;
  last?: boolean;
  onPress?: () => void;
  color?: string;
  center?: boolean;
  right?: ReactNode;
  left?: ReactNode;
};

export function Row({ icon, iconBg, title, subtitle, value, chevron, last, onPress, color, center, right, left }: RowProps) {
  const t = useTheme();
  return (
    <Pressable
      onPress={
        onPress
          ? () => {
              haptic.select();
              onPress();
            }
          : undefined
      }
      disabled={!onPress}
      unstable_pressDelay={40}
      style={({ pressed }) => [{ backgroundColor: pressed ? t.line : 'transparent' }]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 16, minHeight: 46 }}>
        {left}
        {icon ? (
          <View style={{ width: 30, height: 30, borderRadius: 7, backgroundColor: iconBg ?? t.accent, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
            <Icon name={icon} size={17} color="#fff" />
          </View>
        ) : null}
        <View
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 10,
            paddingRight: 16,
            borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
            borderBottomColor: t.line,
            minHeight: 46,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text style={{ color: color ?? t.text, fontSize: 17, textAlign: center ? 'center' : 'left' }}>{title}</Text>
            {subtitle ? <Text style={{ color: t.sub, fontSize: 13, marginTop: 2 }}>{subtitle}</Text> : null}
          </View>
          {value ? <Text style={{ color: t.sub, fontSize: 17, marginLeft: 8 }}>{value}</Text> : null}
          {right}
          {chevron ? <Icon name="chevron" size={14} color={t.chevron} style={{ marginLeft: 8 }} /> : null}
        </View>
      </View>
    </Pressable>
  );
}

export function ToggleRow(props: Omit<RowProps, 'right' | 'onPress' | 'value'> & { value: boolean; onChange: (v: boolean) => void }) {
  const t = useTheme();
  const { value, onChange, ...rest } = props;
  return (
    <Row
      {...rest}
      value={undefined}
      right={
        <Switch
          value={value}
          onValueChange={(v) => {
            haptic.select();
            onChange(v);
          }}
          trackColor={{ true: t.green, false: t.line }}
        />
      }
    />
  );
}

export function CheckRow({ title, subtitle, checked, onPress, last, right }: { title: string; subtitle?: string; checked: boolean; onPress: () => void; last?: boolean; right?: ReactNode }) {
  const t = useTheme();
  return (
    <Row
      title={title}
      subtitle={subtitle}
      last={last}
      onPress={onPress}
      right={right ?? (checked ? <Icon name="check" size={18} color={t.accent} /> : null)}
    />
  );
}

/** Шапка вкладок: «Изм.» — заголовок — кнопка справа */
export function TabHeader({ title, left, right }: { title: string; left?: ReactNode; right?: ReactNode }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ paddingTop: insets.top, backgroundColor: t.bg }}>
      <View style={{ height: 44, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 }}>
        <View style={{ flex: 1, alignItems: 'flex-start' }}>{left}</View>
        <Text style={{ color: t.text, fontSize: 17, fontWeight: '600' }}>{title}</Text>
        <View style={{ flex: 1, alignItems: 'flex-end' }}>{right}</View>
      </View>
    </View>
  );
}

export function HeaderButton({ title, icon, onPress, bold, color, disabled }: { title?: string; icon?: IconName; onPress: () => void; bold?: boolean; color?: string; disabled?: boolean }) {
  const t = useTheme();
  const c = disabled ? t.sub : (color ?? t.accent);
  return (
    <Pressable
      onPress={() => {
        haptic.select();
        onPress();
      }}
      disabled={disabled}
      hitSlop={10}
      style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1, flexDirection: 'row', alignItems: 'center' })}
    >
      {icon ? <Icon name={icon} size={22} color={c} /> : null}
      {title ? <Text style={{ color: c, fontSize: 17, fontWeight: bold ? '600' : '400' }}>{title}</Text> : null}
    </Pressable>
  );
}

/**
 * Нижняя шторка с «ручкой»: выезжает снизу на пружине, фон затемняется, тянется вниз для закрытия.
 * onHidden — шторка полностью убрана (можно открывать камеру/галерею/файлы).
 */
export function Sheet({ visible, onClose, onHidden, children }: { visible: boolean; onClose: () => void; onHidden?: () => void; children: ReactNode }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { mounted, progress, onDismiss, afterHidden } = usePresence(visible);
  const h = useSharedValue(420);
  const drag = useSharedValue(0);
  const wasVisible = useRef(visible);
  const hiddenRef = useRef(onHidden);
  hiddenRef.current = onHidden;
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!visible && wasVisible.current) afterHidden(() => hiddenRef.current?.());
    if (visible) drag.value = 0;
    wasVisible.current = visible;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => {
        drag.value = Math.max(0, g.dy);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 90 || g.vy > 0.8) closeRef.current();
        else drag.value = withSpring(0, SPRING);
      },
      onPanResponderTerminate: () => {
        drag.value = withSpring(0, SPRING);
      },
    }),
  ).current;

  const backdrop = useAnimatedStyle(() => ({ opacity: Math.min(1, Math.max(0, progress.value)) }));
  const panel = useAnimatedStyle(() => ({ transform: [{ translateY: (1 - progress.value) * h.value + drag.value }] }));

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose} onDismiss={onDismiss} statusBarTranslucent>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: t.overlay }, backdrop]}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
      </Animated.View>
      <View style={{ flex: 1 }} pointerEvents="box-none" />
      <Animated.View
        {...pan.panHandlers}
        onLayout={(e) => {
          h.value = e.nativeEvent.layout.height + 40;
        }}
        style={[{ backgroundColor: t.dark ? '#1C1C1E' : '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingBottom: insets.bottom + 12 }, panel]}
      >
        <View style={{ width: 36, height: 5, borderRadius: 3, backgroundColor: t.dark ? '#48484A' : '#D1D1D6', alignSelf: 'center', marginTop: 8, marginBottom: 12 }} />
        {children}
      </Animated.View>
    </Modal>
  );
}

export function PrimaryButton({ title, onPress, style }: { title: string; onPress: () => void; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  return (
    <PressScale onPress={onPress} scaleTo={0.97} style={[{ backgroundColor: t.accent, borderRadius: 12, paddingVertical: 14, alignItems: 'center' }, style]}>
      <Text style={{ color: '#fff', fontSize: 17, fontWeight: '600' }}>{title}</Text>
    </PressScale>
  );
}

export function ProgressBar({ value, color }: { value: number; color?: string }) {
  const t = useTheme();
  return (
    <View style={{ height: 4, backgroundColor: t.line, borderRadius: 2, overflow: 'hidden' }}>
      <View style={{ width: `${Math.max(0, Math.min(100, value))}%`, height: 4, backgroundColor: color ?? t.accent }} />
    </View>
  );
}
