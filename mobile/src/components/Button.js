import { useRef } from 'react';
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text } from 'react-native';
import { colors } from '../theme/colors';

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  size = 'default',
  fullWidth = false,
}) {
  const scale = useRef(new Animated.Value(1)).current;

  function handlePressIn() {
    Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, speed: 40 }).start();
  }
  function handlePressOut() {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30 }).start();
  }

  const isSecondary = variant === 'secondary';
  const isDanger    = variant === 'danger';
  const isAccent    = variant === 'accent';

  return (
    <Animated.View style={[
      { transform: [{ scale }], opacity: disabled ? 0.6 : 1 },
      fullWidth && styles.wrapperFullWidth,
    ]}>
      <Pressable
        accessibilityRole="button"
        disabled={disabled || loading}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[
          styles.button,
          size === 'compact' && styles.compact,
          size === 'small' && styles.small,
          fullWidth && styles.fullWidth,
          isSecondary && styles.secondary,
          isDanger    && styles.danger,
          isAccent    && styles.accent,
        ]}
      >
        {loading ? (
          <ActivityIndicator color={isSecondary ? colors.green : colors.surface} />
        ) : (
          <Text style={[
            styles.text,
            size === 'compact' && styles.compactText,
            size === 'small' && styles.smallText,
            isSecondary && styles.secondaryText,
            isDanger    && styles.text,
            isAccent    && styles.accentText,
          ]}>
            {title}
          </Text>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    backgroundColor: colors.green,
  },
  wrapperFullWidth: {
    alignSelf: 'stretch',
  },
  compact: {
    minHeight: 40,
    borderRadius: 10,
    paddingHorizontal: 14,
  },
  small: {
    minHeight: 36,
    borderRadius: 9,
    paddingHorizontal: 12,
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
  secondary: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.green,
  },
  danger: {
    backgroundColor: colors.danger,
  },
  accent: {
    backgroundColor: colors.amber,
  },
  text: {
    color: colors.surface,
    fontWeight: '700',
    fontSize: 15,
    letterSpacing: 0,
  },
  compactText: {
    fontSize: 14,
  },
  smallText: {
    fontSize: 13,
  },
  secondaryText: {
    color: colors.green,
  },
  accentText: {
    color: colors.surface,
  },
});
