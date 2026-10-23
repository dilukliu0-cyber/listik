import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import Reanimated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { duration } from '../../format';
import { haptic } from '../../haptics';
import { useRuntime } from '../../runtime';
import { togglePlay, usePlayback } from '../../services/player';
import { transcribe } from '../../services/transcriber';
import { actions, type Note } from '../../store';
import { isDarkColor, type Theme } from '../../theme';
import Icon from '../../ui/Icon';
import { PressScale } from '../../ui/motion';

type Props = {
  note: Note;
  t: Theme;
  accent: string; // цвет кнопки и волны
  sub: string;
  textColor: string;
  fontSize: number;
  onEditTranscript?: () => void;
  compact?: boolean;
};

const BARS = 36;

function resample(wave: number[], n: number) {
  if (!wave.length) return Array.from({ length: n }, (_, i) => 0.15 + 0.1 * Math.abs(Math.sin(i * 1.7)));
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = Math.floor((i * wave.length) / n);
    const b = Math.max(a + 1, Math.floor(((i + 1) * wave.length) / n));
    let m = 0;
    for (let j = a; j < b && j < wave.length; j++) m = Math.max(m, wave[j]);
    out.push(m);
  }
  return out;
}

export function Waveform({ wave, progress, color, bars = BARS }: { wave: number[]; progress: number; color: string; bars?: number }) {
  const data = resample(wave, bars);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', height: 24, gap: 1.5 }}>
      {data.map((v, i) => (
        <View
          key={i}
          style={{
            width: 2.5,
            borderRadius: 1.25,
            height: 3 + Math.round(v * 19),
            backgroundColor: color,
            opacity: i / bars < progress ? 1 : 0.4,
          }}
        />
      ))}
    </View>
  );
}

export function TranscribeButton({ note, color }: { note: Note; color: string }) {
  const v = note.voice!;
  const busy = v.status === 'queued' || v.status === 'running';
  if (busy) return <ActivityIndicator size="small" color={color} style={{ marginLeft: 6 }} />;
  const expanded = !!v.expanded && v.status === 'done';
  return (
    <PressScale
      hitSlop={8}
      feedback="none"
      scaleTo={0.85}
      onPress={() => {
        haptic.light();
        if (v.status === 'done') actions.updateVoice(note.id, { expanded: !v.expanded });
        else {
          actions.updateVoice(note.id, { expanded: true });
          transcribe(note.id);
        }
      }}
      style={{ borderWidth: 1.2, borderColor: color, borderRadius: 7, paddingHorizontal: 5, paddingVertical: 1, marginLeft: 6 }}
    >
      <Text style={{ color, fontSize: 12, fontWeight: '700' }}>{expanded ? 'A↑' : '→A'}</Text>
    </PressScale>
  );
}

export default function VoiceContent({ note, t, accent, sub, textColor, fontSize, onEditTranscript, compact }: Props) {
  const v = note.voice!;
  const play = usePlayback(note.id);
  const progressPct = useRuntime((r) => r.progress[note.id]);
  const busy = v.status === 'queued' || v.status === 'running';
  const pos = play.noteId ? play.position / (play.duration || v.duration || 1) : 0;
  const shown = play.noteId && play.position > 0 ? play.position : v.duration;

  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <PressScale
          feedback="none"
          scaleTo={0.88}
          onPress={() => {
            haptic.light();
            togglePlay(note.id, v.uri, v.duration);
          }}
          style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: accent, alignItems: 'center', justifyContent: 'center', marginRight: 9 }}
        >
          <Icon name={play.playing ? 'pause' : 'play'} size={18} color={compact || isDarkColor(accent) ? '#fff' : t.out} />
        </PressScale>
        <View style={{ flex: compact ? 1 : undefined }}>
          <Waveform wave={v.wave} progress={pos} color={accent} bars={compact ? 28 : BARS} />
          <Text style={{ color: sub, fontSize: 12, marginTop: 2 }}>{duration(shown)}</Text>
        </View>
        <TranscribeButton note={note} color={accent} />
      </View>

      {busy ? (
        <Text style={{ color: sub, fontSize: 13, marginTop: 5 }}>
          {v.status === 'queued' ? 'в очереди на расшифровку…' : `расшифровываю…${progressPct ? ` ${progressPct}%` : ''}`}
        </Text>
      ) : v.status === 'error' && v.expanded ? (
        <Text style={{ color: t.danger, fontSize: 13, marginTop: 5 }}>Не удалось расшифровать: {v.error}. Нажмите →A, чтобы повторить.</Text>
      ) : v.status === 'done' && !v.expanded && v.transcript !== undefined && !compact ? (
        <Text style={{ color: sub, fontSize: 13, marginTop: 5 }}>готово, нажми →A</Text>
      ) : null}

      {v.status !== 'none' && v.expanded && v.transcript !== undefined && !busy ? (
        <Reanimated.View entering={FadeIn.duration(240).delay(60)} exiting={FadeOut.duration(140)}>
          <Pressable onPress={onEditTranscript} disabled={!onEditTranscript}>
            <View style={{ marginTop: 6, paddingTop: 6, borderTopWidth: 0.5, borderTopColor: compact ? t.line : t.quoteLine }}>
              <Text style={{ color: v.transcript ? textColor : sub, fontSize, lineHeight: fontSize * 1.3 }}>
                {v.transcript || 'Речь не распознана'}
              </Text>
            </View>
          </Pressable>
        </Reanimated.View>
      ) : null}
    </View>
  );
}
