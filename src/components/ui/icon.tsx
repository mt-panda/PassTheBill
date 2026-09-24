import { SymbolView, type AndroidSymbol, type SFSymbol } from 'expo-symbols';
import { PixelRatio, Platform, View } from 'react-native';

import type { ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const sym = (ios: SFSymbol, android: AndroidSymbol) => ({ ios, android, web: android });

export const icons = {
  add: sym('plus', 'add'),
  remove: sym('minus', 'remove'),
  close: sym('xmark', 'close'),
  share: sym('square.and.arrow.up', 'share'),
  chart: sym('chart.bar.fill', 'bar_chart'),
  back: sym('chevron.left', 'chevron_left'),
  forward: sym('chevron.right', 'chevron_right'),
  edit: sym('pencil', 'edit'),
  delete: sym('trash', 'delete'),
  food: sym('fork.knife', 'restaurant'),
  check: sym('checkmark', 'check'),
  lock: sym('lock.fill', 'lock'),
  people: sym('person.2.fill', 'group'),
  info: sym('info.circle', 'info'),
  money: sym('banknote', 'payments'),
  signOut: sym('rectangle.portrait.and.arrow.right', 'logout'),
  sun: sym('sun.max.fill', 'light_mode'),
  moon: sym('moon.fill', 'dark_mode'),
  phone: sym('iphone', 'smartphone'),
  tap: sym('hand.tap.fill', 'touch_app'),
  receipt: sym('doc.text.fill', 'receipt_long'),
  home: sym('house.fill', 'home'),
  settings: sym('gearshape.fill', 'settings'),
  person: sym('person.fill', 'person'),
  delivery: sym('bicycle', 'delivery_dining'),
  bell: sym('bell.fill', 'notifications'),
  dev: sym('hammer.fill', 'build'),
  copy: sym('doc.on.doc', 'content_copy'),
  invite: sym('person.badge.plus', 'person_add'),
  spending: sym('creditcard', 'payments'),
  orders: sym('fork.knife', 'restaurant'),
  team: sym('person.3.fill', 'group'),
  search: sym('magnifyingglass', 'search'),
  calendar: sym('calendar', 'calendar_today'),
  history: sym('clock.arrow.circlepath', 'history'),
  more: sym('ellipsis', 'more_horiz'),
  checkCircle: sym('checkmark.circle.fill', 'check_circle'),
};

export type IconName = keyof typeof icons;

type IconProps = { name: IconName; size?: number; color?: ThemeColor | (string & {}) };

/** Android SymbolView is a <Text fontSize={size}> in a size×size box: the text grows with the system font scale, the box does not. */
const glyphSize = (size: number, os: string = Platform.OS, fontScale: number = PixelRatio.getFontScale()) =>
  os === 'android' ? size / fontScale : size;

/** One icon family (expo-symbols). */
export function Icon({ name, size = 20, color }: IconProps) {
  const theme = useTheme();
  const tint = color === undefined ? theme.text : color in theme ? theme[color as ThemeColor] : color;
  return (
    <View
      testID={`icon-${name}`}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <SymbolView name={icons[name]} size={glyphSize(size)} style={{ width: size, height: size }} tintColor={tint} />
    </View>
  );
}
