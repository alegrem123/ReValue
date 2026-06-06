import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { api } from '../api/client';
import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import { colors } from '../theme/colors';

export function PremiScreen({ onBack }) {
  const [premi, setPremi]       = useState([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  // Modal riscatto
  const [selected, setSelected] = useState(null); // { _id, titolo, costoCrediti }
  const [saldo, setSaldo]       = useState(null);
  const [loadingSaldo, setLoadingSaldo] = useState(false);
  const [riscattoLoading, setRiscattoLoading] = useState(false);
  const [codice, setCodice]     = useState('');   // dopo riscatto
  const [riscattoError, setRiscattoError] = useState('');

  const loadPremi = useCallback(async () => {
    setError('');
    setLoading(true);
    const res = await api.get('/api/v1/premi');
    setLoading(false);
    if (!res.ok) { setError(res.error || 'Impossibile caricare i premi.'); return; }
    setPremi(res.data?.coupon ?? []);
  }, []);

  useEffect(() => { loadPremi(); }, [loadPremi]);

  async function apriModal(coupon) {
    setSelected(coupon);
    setCodice('');
    setRiscattoError('');
    setLoadingSaldo(true);
    const res = await api.get('/api/v1/wallet/saldo');
    setLoadingSaldo(false);
    setSaldo(res.ok ? (res.data?.bilancio ?? 0) : null);
  }

  function chiudiModal() {
    setSelected(null);
    setCodice('');
    setRiscattoError('');
    if (codice) loadPremi(); // aggiorna stock dopo riscatto
  }

  async function confermaRiscatto() {
    if (!selected) return;
    setRiscattoLoading(true);
    setRiscattoError('');
    const res = await api.post(`/api/v1/premi/${selected._id}/riscatta`, {});
    setRiscattoLoading(false);
    if (!res.ok) {
      // OCL #17: saldo insufficiente o stock esaurito → 409
      setRiscattoError(res.error || 'Impossibile riscattare il coupon.');
      return;
    }
    const univoco = res.data?.riscatto?.codiceUnivoco ?? res.data?.codiceUnivoco ?? '';
    setCodice(univoco);
  }

  return (
    <Screen
      title="Premi"
      subtitle="Usa i tuoi crediti per riscattare coupon dai partner."
      variant="gradient"
      right={onBack ? <Button title="Chiudi" variant="secondary" size="compact" onPress={onBack} /> : null}
    >
      {error ? (
        <View style={styles.notice}>
          <Text style={styles.errorText}>{error}</Text>
          <Button title="Riprova" variant="secondary" size="compact" onPress={loadPremi} />
        </View>
      ) : null}

      <ScrollView
        contentContainerStyle={styles.grid}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadPremi} />}
      >
        {loading && premi.length === 0 ? (
          <ActivityIndicator color={colors.green} style={{ marginTop: 32 }} />
        ) : null}
        {!loading && premi.length === 0 && !error ? (
          <Text style={styles.empty}>Nessun premio disponibile.</Text>
        ) : null}
        {premi.map((c) => (
          <CouponCard key={c._id} coupon={c} onRiscatta={() => apriModal(c)} />
        ))}
      </ScrollView>

      {/* ── Modale riscatto ── */}
      <Modal visible={!!selected} animationType="slide" transparent onRequestClose={chiudiModal}>
        <Pressable style={styles.backdrop} onPress={codice ? chiudiModal : undefined} />
        <View style={styles.sheet}>
          {codice ? (
            /* Stato successo */
            <>
              <Text style={styles.sheetTitle}>Coupon riscattato</Text>
              <Text style={styles.sheetSub}>Mostra questo codice al partner.</Text>
              <View style={styles.codeBox}>
                <Text style={styles.codeText}>{codice}</Text>
              </View>
              <Text style={styles.hint}>Copialo e conservalo!</Text>
              <Button title="Chiudi" onPress={chiudiModal} fullWidth />
            </>
          ) : (
            /* Stato conferma */
            <>
              <Text style={styles.sheetTitle}>Conferma riscatto</Text>
              <Text style={styles.sheetSub}>{selected?.titolo}</Text>

              <View style={styles.infoRow}>
                <InfoChip label="Costo" value={`${selected?.costoCrediti ?? 0} cr.`} />
                <InfoChip
                  label="Saldo"
                  value={loadingSaldo ? '…' : saldo !== null ? `${saldo} cr.` : '—'}
                />
              </View>

              {riscattoError ? (
                <Text style={styles.errorText}>{riscattoError}</Text>
              ) : null}

              <View style={styles.actions}>
                <Button title="Annulla" variant="secondary" size="compact" onPress={chiudiModal} />
                <Button
                  title="Conferma"
                  onPress={confermaRiscatto}
                  loading={riscattoLoading}
                  disabled={riscattoLoading}
                  size="compact"
                />
              </View>
            </>
          )}
        </View>
      </Modal>
    </Screen>
  );
}

function CouponCard({ coupon, onRiscatta }) {
  const esaurito = coupon.stock === 0;
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{coupon.titolo}</Text>
        <View style={styles.costoBadge}>
          <Text style={styles.costoText}>{coupon.costoCrediti} cr.</Text>
        </View>
      </View>
      <Text style={styles.partner}>{coupon.partner}</Text>
      <Text style={styles.descrizione} numberOfLines={3}>{coupon.descrizione}</Text>
      {coupon.stock > 0 ? (
        <Text style={styles.stock}>{coupon.stock} rimasti</Text>
      ) : (
        <Text style={[styles.stock, { color: colors.danger }]}>Esauriti</Text>
      )}
      <Button
        title={esaurito ? 'Esaurito' : 'Riscatta'}
        onPress={onRiscatta}
        disabled={esaurito}
        variant={esaurito ? 'secondary' : 'primary'}
        size="compact"
      />
    </View>
  );
}

function InfoChip({ label, value }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipLabel}>{label}</Text>
      <Text style={styles.chipValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    gap: 12,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  cardTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  costoBadge: {
    backgroundColor: colors.amber,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  costoText: {
    color: '#1a1a1a',
    fontWeight: '800',
    fontSize: 13,
  },
  partner: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600',
  },
  descrizione: {
    color: colors.text,
    lineHeight: 20,
    fontSize: 14,
  },
  stock: {
    color: colors.green,
    fontSize: 12,
    fontWeight: '700',
  },
  notice: {
    gap: 8,
  },
  empty: {
    textAlign: 'center',
    color: colors.muted,
    marginTop: 32,
  },
  errorText: {
    color: colors.danger,
    fontWeight: '700',
  },

  // Modal
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    gap: 14,
    minHeight: 300,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
  },
  sheetSub: {
    color: colors.muted,
    fontSize: 15,
  },
  infoRow: {
    flexDirection: 'row',
    gap: 12,
  },
  chip: {
    flex: 1,
    backgroundColor: colors.greenXLight,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    gap: 4,
  },
  chipLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  chipValue: {
    color: colors.greenDark,
    fontSize: 18,
    fontWeight: '900',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  codeBox: {
    backgroundColor: colors.greenXLight,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.green,
    borderStyle: 'dashed',
    padding: 20,
    alignItems: 'center',
  },
  codeText: {
    fontFamily: 'monospace',
    fontSize: 18,
    fontWeight: '700',
    color: colors.greenDark,
    letterSpacing: 2,
  },
  hint: {
    textAlign: 'center',
    color: colors.muted,
    fontSize: 13,
  },
});
