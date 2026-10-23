import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { Animated, AppState, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import Navigation from './src/navigation';
import { runtime } from './src/runtime';
import { removeFiles } from './src/files';
import { resumeQueue } from './src/services/transcriber';
import { checkModel } from './src/services/whisperModel';
import { actions, flush, hydrate } from './src/store';
import { useTheme } from './src/theme';
import ErrorBoundary from './src/ui/ErrorBoundary';
import Hosts from './src/ui/Hosts';
import Icon from './src/ui/Icon';

SplashScreen.preventAutoHideAsync().catch(() => {});

async function boot() {
  try {
    await hydrate();
    // автоочистка «Недавно удалённых» старше 30 дней
    const { chatIds, noteIds } = actions.expired();
    if (chatIds.length || noteIds.length) removeFiles(actions.purge(chatIds, noteIds));
  } catch (e) {
    console.error('boot', e);
  }
  checkModel()
    .then(resumeQueue)
    .catch(() => {});
}

function Splash({ onDone }: { onDone: () => void }) {
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.timing(opacity, { toValue: 0, duration: 350, delay: 450, useNativeDriver: true }).start(onDone);
  }, [opacity, onDone]);
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: '#3390EC', alignItems: 'center', justifyContent: 'center', opacity }]}>
      <View style={{ width: 120, height: 120, borderRadius: 28, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="bubble" size={64} color="#3390EC" />
      </View>
      <Text style={{ color: '#fff', fontSize: 36, fontWeight: '700', marginTop: 18, letterSpacing: 0.5 }}>Listik</Text>
      <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 15, marginTop: 4 }}>заметки как сообщения</Text>
    </Animated.View>
  );
}

function Root() {
  const t = useTheme();
  const [ready, setReady] = useState(false);
  const [splash, setSplash] = useState(true);

  useEffect(() => {
    boot().finally(() => {
      setReady(true);
      runtime.set((r) => ({ ...r, ready: true }));
      SplashScreen.hideAsync().catch(() => {});
    });
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') flush();
    });
    return () => sub.remove();
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: ready ? t.bg : '#3390EC' }}>
      <StatusBar style={splash ? 'light' : t.dark ? 'light' : 'dark'} />
      {ready ? (
        <ErrorBoundary>
          <Navigation />
          <Hosts />
        </ErrorBoundary>
      ) : null}
      {splash ? <Splash onDone={() => setSplash(false)} /> : null}
    </View>
  );
}

export default function App() {
  return (
    <ErrorBoundary title="Listik не смог запуститься">
      <SafeAreaProvider>
        <Root />
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
