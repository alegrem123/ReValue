import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api, clearSession, getUserId } from '../api/client';
import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import { colors } from '../theme/colors';


export function ProfileScreen({ user, onLogout, onOpenNotifiche, onOpenMyAnnunci, onOpenPremi }) {
  const [balance, setBalance]           = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState('');

  // Recensioni
  const [recensioni, setRecensioni]     = useState(null); // { totale, positive, negative, recenti }
  const [loadingRec, setLoadingRec]     = useState(false);

  const loadWallet = useCallback(async () => {
    setLoading(true);
    setError('');
    const [saldoRes, storicoRes] = await Promise.all([
      api.get('/api/v1/wallet/saldo'),
      api.get('/api/v1/wallet/storico?limit=5'),
    ]);
    setLoading(false);
    if (!saldoRes.ok) { setError(saldoRes.error || 'Impossibile caricare il wallet.'); return; }
    setBalance(saldoRes.data?.bilancio ?? saldoRes.data?.saldo ?? 0);
    setTransactions(storicoRes.ok ? storicoRes.data?.data || storicoRes.data || [] : []);
  }, []);

  const loadRecensioni = useCallback(async () => {
    const userId = await getUserId();
    if (!userId) return;
    setLoadingRec(true);
    const res = await api.get(`/api/v1/users/${userId}/recensioni?limit=3`);
    setLoadingRec(false);
    if (!res.ok) return;
    setRecensioni(res.data);
  }, []);

  useEffect(() => {
    loadWallet();
    loadRecensioni();
  }, [loadWallet, loadRecensioni]);

  async function logout() {
    await clearSession();
    onLogout();
  }


  const totPos = recensioni?.riepilogo?.positive ?? recensioni?.positive ?? recensioni?.recensioni?.filter((r) => r.positiva).length ?? 0;
  const totNeg = recensioni?.riepilogo?.negative ?? recensioni?.negative ?? recensioni?.recensioni?.filter((r) => !r.positiva).length ?? 0;
  const recenti = recensioni?.data ?? recensioni?.recenti ?? recensioni?.recensioni ?? [];

  return (
    <Screen
      title="Profilo"
      subtitle={`${user?.nome || 'Utente'} ${user?.cognome || ''}`.trim()}
      right={
        <View style={styles.headerActions}>
          {onOpenNotifiche ? (
            <Button title="Notifiche" variant="secondary" size="compact" onPress={onOpenNotifiche} />
          ) : null}
          <Button title="Esci" variant="secondary" size="compact" onPress={logout} />
        </View>
      }
    >
      {/* ── Wallet ── */}
      <View style={styles.wallet}>
        <Text style={styles.walletLabel}>Saldo crediti</Text>
        {loading ? (
          <ActivityIndicator color={colors.surface} />
        ) : (
          <Text style={styles.balance}>{balance ?? 0}</Text>
        )}
        <Text style={styles.walletLabel}>crediti RE-VALUE</Text>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Area personale</Text>
        <View style={styles.quickGrid}>
          <QuickAction title="I miei annunci" subtitle="Gestisci oggetti pubblicati" onPress={onOpenMyAnnunci} />
          <QuickAction title="Premi" subtitle="Riscatta coupon con i crediti" onPress={onOpenPremi} />
          <QuickAction title="Notifiche" subtitle="Aggiornamenti su scambi e messaggi" onPress={onOpenNotifiche} />
        </View>
      </View>

      {/* ── Account ── */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Account</Text>
        <Info label="Email"  value={user?.email} />
        <Info label="Ruolo"  value={user?.ruolo || 'user'} />
        <Info label="Città"  value={user?.citta || 'Non indicata'} />
      </View>

      {/* ── Recensioni ricevute ── */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Recensioni ricevute</Text>
        {loadingRec ? (
          <ActivityIndicator color={colors.green} />
        ) : (
          <>
            <View style={styles.recCountRow}>
              <View style={[styles.recCount, { backgroundColor: colors.greenXLight }]}>
                <Text style={[styles.recCountNum, { color: colors.green }]}>{totPos}</Text>
                <Text style={styles.recCountLabel}>Positive</Text>
              </View>
              <View style={[styles.recCount, { backgroundColor: colors.dangerLight }]}>
                <Text style={[styles.recCountNum, { color: colors.danger }]}>{totNeg}</Text>
                <Text style={styles.recCountLabel}>Negative</Text>
              </View>
            </View>
            {recenti.length === 0 ? (
              <Text style={styles.muted}>Nessuna recensione ricevuta.</Text>
            ) : (
              recenti.slice(0, 3).map((r, i) => (
                <View key={r._id || i} style={styles.recRow}>
                  <Text style={[styles.recIcon, { color: r.positiva ? colors.green : colors.danger }]}>
                    {r.positiva ? '+' : '-'}
                  </Text>
                  <View style={{ flex: 1 }}>
                    {r.testo ? <Text style={styles.recTesto}>{r.testo}</Text> : null}
                    <Text style={styles.recData}>{fmtDate(r.data || r.createdAt)}</Text>
                  </View>
                </View>
              ))
            )}
          </>
        )}
      </View>

      {/* ── Ultime transazioni ── */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Ultime transazioni</Text>
        {transactions.length === 0 ? (
          <Text style={styles.muted}>Nessuna transazione recente.</Text>
        ) : (
          transactions.map((item) => (
            <View key={item._id || `${item.tipo}-${item.createdAt}`} style={styles.transaction}>
              <Text style={styles.transactionTitle}>{item.motivo || item.tipo || 'Movimento wallet'}</Text>
              <Text style={[styles.muted, (item.ammontare ?? 0) >= 0 ? styles.amountPositive : styles.amountNegative]}>
                {(item.ammontare ?? 0) >= 0 ? '+' : ''}{item.ammontare ?? 0} crediti
              </Text>
            </View>
          ))
        )}
      </View>

    </Screen>
  );
}

function Info({ label, value }) {
  return (
    <View style={styles.info}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value || 'Non disponibile'}</Text>
    </View>
  );
}

function QuickAction({ title, subtitle, onPress }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.quickAction, pressed && styles.quickActionPressed]}
    >
      <View style={styles.quickActionText}>
        <Text style={styles.quickActionTitle}>{title}</Text>
        <Text style={styles.quickActionSubtitle}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </Pressable>
  );
}

function fmtDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });
}

const styles = StyleSheet.create({
  wallet: {
    gap: 8,
    borderRadius: 16,
    backgroundColor: colors.green,
    padding: 18,
  },
  walletLabel: {
    color: '#EAF5EC',
    fontWeight: '700',
  },
  balance: {
    color: colors.surface,
    fontSize: 46,
    fontWeight: '900',
  },
  card: {
    gap: 12,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  info: { gap: 3 },
  infoLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  infoValue: {
    color: colors.text,
  },
  transaction: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 10,
  },
  transactionTitle: {
    color: colors.text,
    fontWeight: '700',
  },
  muted: {
    color: colors.muted,
  },
  errorText: {
    color: colors.danger,
    fontWeight: '700',
  },

  // Recensioni
  recCountRow: {
    flexDirection: 'row',
    gap: 10,
  },
  recCount: {
    flex: 1,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    gap: 4,
  },
  recCountNum: {
    fontSize: 28,
    fontWeight: '900',
  },
  recCountLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  recRow: {
    flexDirection: 'row',
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 10,
  },
  recIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '900',
  },
  recTesto: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  recData: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 2,
  },

  // Modal segnala
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
    minHeight: 360,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
  },
  fieldLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  tipiRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  tipoPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  tipoPillActive: {
    borderColor: colors.green,
    backgroundColor: colors.greenXLight,
  },
  tipoPillText: {
    color: colors.muted,
    fontWeight: '700',
    fontSize: 13,
  },
  tipoPillTextActive: {
    color: colors.greenDark,
  },
  textarea: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    minHeight: 100,
    textAlignVertical: 'top',
    color: colors.text,
    fontSize: 14,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  quickGrid: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  quickAction: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 10,
  },
  quickActionPressed: {
    opacity: 0.72,
  },
  quickActionText: {
    flex: 1,
    gap: 2,
  },
  quickActionTitle: {
    color: colors.text,
    fontWeight: '800',
    fontSize: 15,
  },
  quickActionSubtitle: {
    color: colors.muted,
    fontSize: 12,
  },
  amountPositive: {
    color: colors.green,
    fontWeight: '800',
  },
  amountNegative: {
    color: colors.danger,
    fontWeight: '800',
  },
  dangerLight: colors.dangerLight,
});
