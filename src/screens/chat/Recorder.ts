// Настройки записи: WAV 16 кГц моно — подходит и для Apple, и для Whisper.
import { AudioQuality, IOSOutputFormat, type RecordingOptions } from 'expo-audio';

export const REC_OPTIONS: RecordingOptions = {
  extension: '.wav',
  sampleRate: 16000,
  numberOfChannels: 1,
  bitRate: 256000,
  isMeteringEnabled: true,
  android: { extension: '.m4a', outputFormat: 'mpeg4', audioEncoder: 'aac', sampleRate: 16000 },
  ios: {
    extension: '.wav',
    outputFormat: IOSOutputFormat.LINEARPCM,
    audioQuality: AudioQuality.HIGH,
    sampleRate: 16000,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: { mimeType: 'audio/webm' },
};

/** dB (-160..0) → 0..1 */
export function level(db: number | undefined): number {
  if (db === undefined || !isFinite(db)) return 0;
  return Math.max(0, Math.min(1, (db + 50) / 50));
}

export function compressWave(samples: number[], n = 48): number[] {
  if (!samples.length) return [];
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = Math.floor((i * samples.length) / n);
    const b = Math.max(a + 1, Math.floor(((i + 1) * samples.length) / n));
    let m = 0;
    for (let j = a; j < b && j < samples.length; j++) m = Math.max(m, samples[j]);
    out.push(Math.round(m * 100) / 100);
  }
  return out;
}
