// Строка со свайпами как в iOS: влево — действия справа, вправо — действие слева.
import { useRef, type ReactNode } from 'react';
import { Animated, PanResponder, Pressable, Text, View } from 'react-native';

import { haptic } from '../haptics';
import Icon, { type IconName } from './Icon';

export type SwipeAction = { label: string; icon: IconName; color: string; onPress: () => void };

const W = 76;
let openRow: { close: () => void } | null = null;

export function closeOpenRow() {
  openRow?.close();
  openRow = null;
}

type Props = { children: ReactNode; left?: SwipeAction[]; right?: SwipeAction[]; enabled?: boolean };

export default function SwipeRow({ children, left = [], right = [], enabled = true }: Props) {
  const x = useRef(new Animated.Value(0)).current;
  const offset = useRef(0);
  const passed = useRef(false);
  const self = useRef({ close: () => snap(0) }).current;
  const conf = useRef({ left, right, enabled });
  conf.current = { left, right, enabled };

  function snap(to: number) {
    offset.current = to;
    Animated.spring(x, { toValue: to, useNativeDriver: true, bounciness: 0, speed: 18 }).start();
    if (to !== 0) {
      if (openRow && openRow !== self) openRow.close();
      openRow = self;
    } else if (openRow === self) openRow = null;
  }

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => conf.current.enabled && Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.6,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        passed.current = false;
        x.stopAnimation();
      },
      onPanResponderMove: (_, g) => {
        const leftW = conf.current.left.length * W;
        const rightW = conf.current.right.length * W;
        let v = offset.current + g.dx;
        if (v > 0 && !leftW) v = 0;
        if (v < 0 && !rightW) v = 0;
        if (v > leftW) v = leftW + (v - leftW) * 0.5;
        if (v < -rightW) v = -rightW + (v + rightW) * 0.5;
        x.setValue(v);
        const full = v > leftW + 70 || v < -rightW - 90;
        if (full !== passed.current) {
          passed.current = full;
          if (full) haptic.light();
        }
      },
      onPanResponderRelease: (_, g) => {
        const leftW = conf.current.left.length * W;
        const rightW = conf.current.right.length * W;
        const v = offset.current + g.dx;
        if (passed.current) {
          // длинный свайп — сразу первое действие
          const a = v > 0 ? conf.current.left[0] : conf.current.right[0];
          snap(0);
          a?.onPress();
          return;
        }
        if (v > leftW / 2 && leftW) snap(leftW);
        else if (v < -rightW / 2 && rightW) snap(-rightW);
        else snap(0);
      },
      onPanResponderTerminate: () => snap(0),
    }),
  ).current;

  const renderActions = (list: SwipeAction[], side: 'left' | 'right') => (
    <View style={{ position: 'absolute', top: 0, bottom: 0, [side]: 0, flexDirection: 'row' }}>
      {list.map((a) => (
        <Pressable
          key={a.label}
          onPress={() => {
            snap(0);
            haptic.light();
            a.onPress();
          }}
          style={{ width: W, backgroundColor: a.color, alignItems: 'center', justifyContent: 'center' }}
        >
          <Icon name={a.icon} size={24} color="#fff" />
          <Text style={{ color: '#fff', fontSize: 13, marginTop: 4 }}>{a.label}</Text>
        </Pressable>
      ))}
    </View>
  );

  return (
    <View style={{ overflow: 'hidden' }}>
      {left.length ? renderActions(left, 'left') : null}
      {right.length ? renderActions(right, 'right') : null}
      <Animated.View style={{ transform: [{ translateX: x }] }} {...pan.panHandlers}>
        {children}
      </Animated.View>
    </View>
  );
}
