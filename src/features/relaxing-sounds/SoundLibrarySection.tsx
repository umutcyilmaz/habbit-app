import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppText } from '../../shared/components/v4/AppText';
import { libraryStyles as s } from '../library/libraryTheme';
import { SoundScene } from './SoundScene';
import { sounds } from './sounds';
export function SoundLibrarySection() {
  const router = useRouter();
  return <View><View style={s.sectionHeader}><AppText style={s.section}>Rahatlatıcı sesler</AppText><AppText style={s.muted}>4 ses</AppText></View>
    <View style={s.group}>{sounds.map((sound, index) => <Pressable key={sound.id} testID={`library.sound.${sound.id}`} accessibilityRole="button" accessibilityLabel={`${sound.title}, ${sound.subtitle}`} onPress={() => router.push({ pathname: '/bloom/library/sound', params: { id: sound.id } })} style={({pressed}) => [s.row, index > 0 && s.rowBorder, pressed && s.pressed]}>
      <View style={{ width: 62, height: 62, borderRadius: 15, overflow: 'hidden' }}><SoundScene id={sound.id} /></View>
      <View style={{flex:1}}><AppText style={s.rowTitle}>{sound.title}</AppText><AppText style={s.rowMeta}>{sound.subtitle}</AppText></View><AppText style={s.muted}>›</AppText>
    </Pressable>)}</View>
  </View>;
}
