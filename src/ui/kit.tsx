// Общие элементы в стиле iOS: сгруппированные списки, переключатели, шапки, шторки.
import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, Switch, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { haptic } from '../haptics';
import { useTheme } from '../theme';
import Icon, { type IconName } from './Icon';

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
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => [{ backgroundColor: pressed ? t.line : 'transparent' }]}>
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
      onPress={() => {
        haptic.select();
        onPress();
      }}
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
    <Pressable onPress={onPress} disabled={disabled} hitSlop={10} style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1, flexDirection: 'row', alignItems: 'center' })}>
      {icon ? <Icon name={icon} size={22} color={c} /> : null}
      {title ? <Text style={{ color: c, fontSize: 17, fontWeight: bold ? '600' : '400' }}>{title}</Text> : null}
    </Pressable>
  );
}

/** Нижняя шторка с «ручкой» */
export function Sheet({ visible, onClose, children }: { visible: boolean; onClose: () => void; children: ReactNode }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: t.overlay }} onPress={onClose} />
      <View style={{ backgroundColor: t.dark ? '#1C1C1E' : '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingBottom: insets.bottom + 12 }}>
        <View style={{ width: 36, height: 5, borderRadius: 3, backgroundColor: t.dark ? '#48484A' : '#D1D1D6', alignSelf: 'center', marginTop: 8, marginBottom: 12 }} />
        {children}
      </View>
    </Modal>
  );
}

export function PrimaryButton({ title, onPress, style }: { title: string; onPress: () => void; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [{ backgroundColor: t.accent, borderRadius: 12, paddingVertical: 14, alignItems: 'center', opacity: pressed ? 0.8 : 1 }, style]}
    >
      <Text style={{ color: '#fff', fontSize: 17, fontWeight: '600' }}>{title}</Text>
    </Pressable>
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
