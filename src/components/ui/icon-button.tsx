import { Pressable } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

import { pressedStyle } from './button';
import { Icon, type IconName } from './icon';

type Props = { icon: IconName; label: string; onPress?: () => void; disabled?: boolean; primary?: boolean; size?: number };

/** Visual size defaults to 40; the touch target is always at least 44x44 via hitSlop. */
export function IconButton({ icon, label, onPress, disabled, primary, size = 40 }: Props) {
  const theme = useTheme();
  const slop = Math.max(0, Math.ceil((44 - size) / 2));
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      hitSlop={slop}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: primary ? theme.primary : theme.backgroundSelected,
        },
        disabled && { opacity: 0.35 },
        pressed && pressedStyle,
      ]}>
      <Icon name={icon} size={Math.round(size * 0.45)} color={primary ? 'onPrimary' : 'text'} />
    </Pressable>
  );
}
