import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { api } from '../api/client';
import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import { colors } from '../theme/colors';

export function SwapSuccessScreen({ crediti, prenotazioneId, onDone }) {
  const [reviewState, setReviewState] = useState('idle'); // idle | composing | sending | done
  const [positiva, setPositiva]       = useState(null);   // true | false
  const [testo, setTesto]             = useState('');
  const [reviewError, setReviewError] = useState('');

  async function inviaRecensione() {
    if (positiva === null) return;
    setReviewState('sending');
    setReviewError('');
    const res = await api.post('/api/v1/recensioni', {
      prenotazioneId,
      positiva,
      testo: testo.trim() || undefined,
    });
    if (!res.ok) {
      setReviewError(res.error || 'Errore invio recensione.');
      setReviewState('composing');
      return;
    }
    setReviewState('done');
  }

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

      {/* ── Sezione recensione (solo se abbiamo prenotazioneId) ── */}
      {prenotazioneId ? (
        reviewState === 'done' ? (
          <View style={styles.reviewDone}>
            <Text style={styles.reviewDoneText}>✓ Recensione inviata!</Text>
          </View>
        ) : (
          <View style={styles.reviewBox}>
            <Text style={styles.reviewTitle}>Lascia una recensione</Text>
            <Text style={styles.reviewSub}>Come è andata con il donatore?</Text>

            <View style={styles.ratingRow}>
              <Button
                title="👍 Positiva"
                variant={positiva === true ? 'primary' : 'secondary'}
                onPress={() => { setPositiva(true); setReviewState('composing'); }}
              />
              <Button
                title="👎 Negativa"
                variant={positiva === false ? 'danger' : 'secondary'}
                onPress={() => { setPositiva(false); setReviewState('composing'); }}
              />
            </View>

            {reviewState === 'composing' ? (
              <>
                <TextInput
                  style={styles.textarea}
                  placeholder="Commento opzionale..."
                  placeholderTextColor={colors.muted}
                  multiline
                  numberOfLines={3}
                  value={testo}
                  onChangeText={setTesto}
                />
                {reviewError ? <Text style={styles.errorText}>{reviewError}</Text> : null}
                <Button
                  title="Invia recensione"
                  onPress={inviaRecensione}
                  loading={reviewState === 'sending'}
                  disabled={reviewState === 'sending'}
                />
              </>
            ) : null}
          </View>
        )
      ) : null}

      <Button title="Torna alle prenotazioni" onPress={onDone} variant="secondary" />
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
  reviewBox: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 12,
  },
  reviewTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  reviewSub: {
    color: colors.muted,
    fontSize: 14,
  },
  ratingRow: {
    flexDirection: 'row',
    gap: 10,
  },
  textarea: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    minHeight: 80,
    textAlignVertical: 'top',
    color: colors.text,
    fontSize: 14,
  },
  reviewDone: {
    backgroundColor: colors.greenXLight,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  reviewDoneText: {
    color: colors.greenDark,
    fontWeight: '800',
    fontSize: 16,
  },
  errorText: {
    color: colors.danger,
    fontWeight: '700',
    fontSize: 13,
  },
});
