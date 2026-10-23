import { Component, type ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

type Props = { children: ReactNode; title?: string };
type State = { error: Error | null };

/** Ловит ошибки рендера: вместо падения приложения показывает текст ошибки. */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('Listik error:', error);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <View style={{ flex: 1, backgroundColor: '#fff', paddingTop: 80, paddingHorizontal: 20 }}>
        <Text style={{ fontSize: 20, fontWeight: '600', color: '#000' }}>{this.props.title ?? 'Что-то пошло не так'}</Text>
        <Text style={{ color: '#8E8E93', marginTop: 6 }}>Данные не потеряны. Текст ошибки:</Text>
        <ScrollView style={{ marginTop: 12, maxHeight: 360, backgroundColor: '#F2F2F7', borderRadius: 12, padding: 12 }}>
          <Text selectable style={{ fontFamily: 'Menlo', fontSize: 12, color: '#E5533D' }}>
            {String(error?.message ?? error)}
            {'\n\n'}
            {String(error?.stack ?? '').slice(0, 2000)}
          </Text>
        </ScrollView>
        <Pressable
          onPress={() => this.setState({ error: null })}
          style={{ marginTop: 16, backgroundColor: '#3390EC', borderRadius: 12, padding: 14, alignItems: 'center' }}
        >
          <Text style={{ color: '#fff', fontWeight: '600', fontSize: 16 }}>Попробовать снова</Text>
        </Pressable>
      </View>
    );
  }
}
