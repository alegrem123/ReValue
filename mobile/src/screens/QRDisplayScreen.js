import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import { api } from '../api/client';
import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import { colors } from '../theme/colors';

// QR generato come immagine via API pubblica — no dipendenze extra
function qrImageUri(codice) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(codice)}&color=1B5E20`;
}

function useCountdown(scadenzaISO) {
  const [label, setLabel] = useState('');

  useEffect(() => {
    if (!scadenzaISO) return;
    const tick = () => {
      const diff = new Date(scadenzaISO).getTime() - Date.now();
      if (diff <= 0) { setLabel('QR scaduto'); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setLabel(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [scadenzaISO]);

  return label;
}

export function QRDisplayScreen({ prenotazioneId, onBack }) {
  const [codice, setCodice]     = useState(null);
  const [scadenza, setScadenza] = useState(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const countdown = useCountdown(scadenza);

  async function genera() {
    setLoading(true);
    setError('');
    setCodice(null);
    const res = await api.post('/api/qr/genera', { prenotazioneId });
    setLoading(false);
    if (!res.ok) { setError(res.error || 'Impossibile generare il QR.'); return; }
    setCodice(res.data.codice);
    setScadenza(res.data.scadenza);
  }

  useEffect(() => { genera(); }, [prenotazioneId]);

  return (
    <Screen
      title="QR Code scambio"
      subtitle="Mostra questo codice all'acquirente per certificare il ritiro."
      right={<Button title="Indietro" variant="secondary" onPress={onBack} />}
    >
      {loading ? <ActivityIndicator color={colors.green} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {codice ? (
        <View style={styles.center}>
          <View style={styles.qrWrapper}>
            <Image
              source={{ uri: qrImageUri(codice) }}
              style={styles.qrImage}
              resizeMode="contain"
            />
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>Scadenza QR</Text>
            <Text style={[styles.countdown, countdown === 'QR scaduto' && styles.expired]}>
              {countdown}
            </Text>
          </View>

          <Button title="Rigenera QR" variant="secondary" onPress={genera} loading={loading} />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    gap: 20,
  },
  qrWrapper: {
    padding: 16,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: colors.green,
  },
  qrImage: {
    width: 260,
    height: 260,
  },
  infoCard: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    alignItems: 'center',
    gap: 4,
  },
  infoLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  countdown: {
    fontSize: 28,
    fontWeight: '900',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  expired: {
    color: colors.danger,
  },
  error: {
    color: colors.danger,
    fontWeight: '700',
  },
});
