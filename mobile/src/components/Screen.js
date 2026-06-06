import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';

/**
 * variant="plain"    — header bianco, sfondo cream (default)
 * variant="gradient" — header gradiente verde (come page-hero web)
 */
export function Screen({ title, subtitle, children, scroll = true, right, variant = 'plain', contentStyle }) {
  const isGradient = variant === 'gradient';

  const header = (
    <View style={isGradient ? styles.gradientHeader : styles.plainHeader}>
      <View style={styles.headerInner}>
        <View style={styles.headerText}>
          <Text style={isGradient ? styles.gradientTitle : styles.title}>{title}</Text>
          {subtitle ? (
            <Text style={isGradient ? styles.gradientSubtitle : styles.subtitle}>{subtitle}</Text>
          ) : null}
        </View>
        {right}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      {header}
      {scroll ? (
        <ScrollView contentContainerStyle={[styles.content, contentStyle]}>{children}</ScrollView>
      ) : (
        <View style={[styles.content, styles.fill, contentStyle]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  fill: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 96,
    gap: 16,
  },

  // Header condiviso
  headerInner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerText: {
    flex: 1,
  },

  // Plain
  plainHeader: {
    padding: 20,
    paddingBottom: 12,
    backgroundColor: colors.cream,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: 0,
  },
  subtitle: {
    marginTop: 4,
    color: colors.muted,
    lineHeight: 20,
    fontSize: 14,
  },

  // Gradient
  gradientHeader: {
    padding: 24,
    paddingBottom: 20,
    backgroundColor: colors.green,
  },
  gradientTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0,
  },
  gradientSubtitle: {
    marginTop: 4,
    color: 'rgba(255,255,255,0.82)',
    lineHeight: 20,
    fontSize: 14,
  },
});
