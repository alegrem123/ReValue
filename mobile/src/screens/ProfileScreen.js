import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { api, clearSession, getUserId } from '../api/client';
import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import { colors } from '../theme/colors';

const TIPI_SEGNALAZIONE = ['descrizione', 'inappropriato', 'altro'];

export function ProfileScreen({ user, onLogout, onOpenNotifiche }) {
  const [balance, setBalance]           = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState('');

  // Recensioni
  const [recensioni, setRecensioni]     = useState(null); // { totale, positive, negative, recenti }
  const [loadingRec, setLoadingRec]     = useState(false);

  // Modal segnala
  const [segnalaOpen, setSegnalaOpen]   = useState(false);
  const [segnalaTipo, setSegnalaTipo]   = useState('descrizione');
  const [segnalaMotivo, setSegnalaMotivo] = useState('');
  const [segnalaLoading, setSegnalaLoading] = useState(false);
  const [segnalaError, setSegnalaError] = useState('');
  const [segnalaDone, setSegnalaDone]   = useState(false);

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

  async function inviaSegnalazione() {
    if (!segnalaMotivo.trim()) { setSegnalaError('Il motivo è obbligatorio.'); return; }
    setSegnalaLoading(true);
    setSegnalaError('');
    const userId = await getUserId();
    const res = await api.post('/api/v1/segnalazioni', {
      segnalato: userId, // placeholder — in produzione sarà l'ID dell'utente segnalato
      tipo: segnalaTipo,
      motivo: segnalaMotivo.trim(),
    });
    setSegnalaLoading(false);
    if (!res.ok) { setSegnalaError(res.error || 'Errore invio segnalazione.'); return; }
    setSegnalaDone(true);
  }

  function chiudiSegnala() {
    setSegnalaOpen(false);
    setSegnalaMotivo('');
    setSegnalaTipo('descrizione');
    setSegnalaError('');
    setSegnalaDone(false);
  }

  const totPos = recensioni?.positive ?? recensioni?.recensioni?.filter((r) => r.positiva).length ?? 0;
  const totNeg = recensioni?.negative ?? recensioni?.recensioni?.filter((r) => !r.positiva).length ?? 0;
  const recenti = recensioni?.recenti ?? recensioni?.recensioni ?? [];

  return (
    <Screen
      title="Profilo"
      subtitle={`${user?.nome || 'Utente'} ${user?.cognome || ''}`.trim()}
      right={
        <View style={styles.headerActions}>
          {onOpenNotifiche ? (
            <Button title="🔔" variant="secondary" onPress={onOpenNotifiche} />
          ) : null}
          <Button title="Esci" variant="secondary" onPress={logout} />
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
                <Text style={styles.recCountLabel}>👍 Positive</Text>
              </View>
              <View style={[styles.recCount, { backgroundColor: colors.dangerLight }]}>
                <Text style={[styles.recCountNum, { color: colors.danger }]}>{totNeg}</Text>
                <Text style={styles.recCountLabel}>👎 Negative</Text>
              </View>
            </View>
            {recenti.length === 0 ? (
              <Text style={styles.muted}>Nessuna recensione ricevuta.</Text>
            ) : (
              recenti.slice(0, 3).map((r, i) => (
                <View key={r._id || i} style={styles.recRow}>
                  <Text style={styles.recIcon}>{r.positiva ? '👍' : '👎'}</Text>
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
              <Text style={styles.transactionTitle}>{item.tipo || 'Movimento'}</Text>
              <Text style={styles.muted}>{item.ammontare ?? 0} crediti</Text>
            </View>
          ))
        )}
      </View>

      {/* ── Modal segnalazione ── */}
      <Modal visible={segnalaOpen} animationType="slide" transparent onRequestClose={chiudiSegnala}>
        <Pressable style={styles.backdrop} onPress={chiudiSegnala} />
        <View style={styles.sheet}>
          {segnalaDone ? (
            <>
              <Text style={styles.sheetTitle}>✓ Segnalazione inviata</Text>
              <Text style={styles.muted}>Grazie. Il team esaminerà la segnalazione.</Text>
              <Button title="Chiudi" onPress={chiudiSegnala} />
            </>
          ) : (
            <>
              <Text style={styles.sheetTitle}>Segnala utente</Text>

              <Text style={styles.fieldLabel}>Tipo</Text>
              <View style={styles.tipiRow}>
                {TIPI_SEGNALAZIONE.map((t) => (
                  <Pressable
                    key={t}
                    style={[styles.tipoPill, segnalaTipo === t && styles.tipoPillActive]}
                    onPress={() => setSegnalaTipo(t)}
                  >
                    <Text style={[styles.tipoPillText, segnalaTipo === t && styles.tipoPillTextActive]}>
                      {t}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Motivo *</Text>
              <TextInput
                style={styles.textarea}
                placeholder="Descrivi il problema..."
                placeholderTextColor={colors.muted}
                multiline
                numberOfLines={4}
                value={segnalaMotivo}
                onChangeText={setSegnalaMotivo}
              />

              {segnalaError ? <Text style={styles.errorText}>{segnalaError}</Text> : null}

              <View style={styles.actions}>
                <Button title="Annulla" variant="secondary" onPress={chiudiSegnala} />
                <Button
                  title="Invia"
                  onPress={inviaSegnalazione}
                  loading={segnalaLoading}
                  disabled={segnalaLoading}
                />
              </View>
            </>
          )}
        </View>
      </Modal>
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

function fmtDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });
}

const styles = StyleSheet.create({
  wallet: {
    gap: 8,
    borderRadius: 8,
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
    borderRadius: 8,
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
    borderRadius: 8,
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
    fontSize: 18,
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
    borderRadius: 8,
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
  dangerLight: colors.dangerLight,
});
