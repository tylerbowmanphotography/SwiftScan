import MaskedViewBase from '@react-native-masked-view/masked-view';
import type { ComponentType, ReactElement, ReactNode } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Text, type TextStyle, type StyleProp } from 'react-native';

// The library's class typings predate React 19's JSX types.
const MaskedView = MaskedViewBase as unknown as ComponentType<{ maskElement: ReactElement; children?: ReactNode }>;

/** Pink-to-mint gradient text, same as the website's .ss-gradient-text. */
export function GradientText({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return (
    <MaskedView maskElement={<Text style={style}>{children}</Text>}>
      <LinearGradient colors={['#f9a8d4', '#6ee7b7']} start={{ x: 0, y: 0.3 }} end={{ x: 1, y: 0.7 }}>
        <Text style={[style, { opacity: 0 }]}>{children}</Text>
      </LinearGradient>
    </MaskedView>
  );
}
