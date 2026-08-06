import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold
} from "@expo-google-fonts/inter";
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
  JetBrainsMono_800ExtraBold_Italic
} from "@expo-google-fonts/jetbrains-mono";

/**
 * V4 font set (design-tokens.json -> $fontSources):
 * Inter 400/500/600/700 + JetBrains Mono 400/500/800 ExtraBold Italic.
 * No synthetic bold or italic; the ExtraBold italic is a real file.
 */
export const fonts = {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
  JetBrainsMono_800ExtraBold_Italic
} as const;

export type FontName = keyof typeof fonts;

/**
 * The registered fontFamily names (the object keys of `fonts`).
 * TextStyle.fontFamily must reference these exact strings.
 */
export const fontFamily = {
  Inter_400Regular: "Inter_400Regular",
  Inter_500Medium: "Inter_500Medium",
  Inter_600SemiBold: "Inter_600SemiBold",
  Inter_700Bold: "Inter_700Bold",
  JetBrainsMono_400Regular: "JetBrainsMono_400Regular",
  JetBrainsMono_500Medium: "JetBrainsMono_500Medium",
  JetBrainsMono_800ExtraBold_Italic: "JetBrainsMono_800ExtraBold_Italic"
} as const satisfies { [Name in FontName]: Name };
