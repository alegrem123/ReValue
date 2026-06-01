import { StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from '../theme/colors';

export function TextField({ label, multiline = false, style, ...props }) {
  return (
    <View style={[styles.wrap, style]}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor="#8A948E"
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        style={[styles.input, multiline && styles.multiline]}
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 6,
  },
  label: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 14,
  },
  input: {
    minHeight: 48,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    color: colors.text,
    fontSize: 15,
  },
  multiline: {
    minHeight: 104,
    paddingTop: 12,
  },
});
