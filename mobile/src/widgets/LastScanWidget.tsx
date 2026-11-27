import { HStack, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { containerBackground, font, foregroundStyle, lineLimit, padding } from '@expo/ui/swift-ui/modifiers';
import { createWidget } from 'expo-widgets';

export type LastScanProps = {
  name: string;
  verdict: string;
  price: string;
  color: string;
};

// Widget code runs in an isolated runtime: no hooks, no imports of app code, and no outside variables.
const LastScanWidget = (props: LastScanProps) => {
  'widget';
  return (
    <VStack alignment="leading" spacing={4} modifiers={[padding({ all: 4 }), containerBackground('#1a1033', 'widget')]}>
      <Text modifiers={[font({ size: 11, weight: 'bold' }), foregroundStyle('#f472b6')]}>SWIFTSCAN</Text>
      <Text modifiers={[font({ size: 15, weight: 'semibold' }), foregroundStyle('#ffffff'), lineLimit(2)]}>{props.name}</Text>
      <Spacer />
      <HStack spacing={6}>
        <Text modifiers={[font({ size: 12, weight: 'bold' }), foregroundStyle(props.color)]}>{props.verdict}</Text>
        <Spacer />
        <Text modifiers={[font({ size: 14, weight: 'bold' }), foregroundStyle('#ffffff')]}>{props.price}</Text>
      </HStack>
    </VStack>
  );
};

export default createWidget('LastScanWidget', LastScanWidget, {
  name: 'Scan an item',
  verdict: 'Tap to start',
  price: '',
  color: '#f472b6',
});
