export const sounds = [
  { id: 'ocean', title: 'Okyanus', subtitle: 'Ay ışığında yavaş dalgalar', description: 'Dalgalar dürtüyle birlikte yükselir ve yatışır. Nefesini dalgaların ritmine bırak.', source: require('./assets/ocean.wav') },
  { id: 'rain', title: 'Cam üstünde yağmur', subtitle: 'Gece, şehir ışıkları', description: 'Pencereye vuran yağmurun düzenli sesi zihni yavaşlatır, uykuya geçişi kolaylaştırır.', source: require('./assets/rain.wav') },
  { id: 'fire', title: 'Şömine', subtitle: 'Sıcak, sabit bir çıtırtı', description: 'Odunların çıtırtısı ve alevin hafif uğultusu. Gece için sakin bir arka plan.', source: require('./assets/fire.wav') },
  { id: 'forest', title: 'Orman gecesi', subtitle: 'Cırcır böcekleri ve rüzgâr', description: 'Ağaçların arasında hafif rüzgâr ve uzaktan gelen böcek sesleri.', source: require('./assets/forest.wav') }
] as const;
export type SoundId = typeof sounds[number]['id'];
export function findSound(id: unknown) { return sounds.find(sound => sound.id === id); }
export const soundDurations = [600, 1200, 1800, 0] as const;
export function formatSoundTime(seconds: number) {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}
