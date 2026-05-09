import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import { colors } from '../theme/colors';

export function SwapSuccessScreen({ crediti, onDone }) {
  return (
    <Screen title="Scambio completato!">
      <View style={styles.hero}>
        <Text style={styles.icon}>✓</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Crediti accreditati</Text>
        <Text style={styles.credits}>+{crediti ?? 0}</Text>
        <Text style={styles.sublabel}>crediti RE-VALUE</Text>
      </View>

      <Text style={styles.body}>
        Il ritiro è stato certificato. Grazie per aver contribuito all'economia circolare!
      </Text>

      <Button title="Torna alle prenotazioni" onPress={onDone} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.green,
    alignSelf: 'center',
  },
  icon: {
    color: '#fff',
    fontSize: 48,
    fontWeight: '900',
    lineHeight: 56,
  },
  card: {
    backgroundColor: colors.green,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    gap: 6,
  },
  label: {
    color: '#EAF5EC',
    fontWeight: '700',
    fontSize: 13,
  },
  credits: {
    color: colors.accent,
    fontSize: 56,
    fontWeight: '900',
  },
  sublabel: {
    color: '#EAF5EC',
    fontWeight: '700',
    fontSize: 13,
  },
  body: {
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 22,
  },
});
