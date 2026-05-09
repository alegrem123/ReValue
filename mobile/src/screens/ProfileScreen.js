import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { api, clearSession } from '../api/client';
import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import { colors } from '../theme/colors';

export function ProfileScreen({ user, onLogout }) {
  const [balance, setBalance] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadWallet = useCallback(async () => {
    setLoading(true);
    setError('');

    const [saldoRes, storicoRes] = await Promise.all([
      api.get('/api/wallet/saldo'),
      api.get('/api/wallet/storico?limit=5'),
    ]);

    setLoading(false);
    if (!saldoRes.ok) {
      setError(saldoRes.error || 'Impossibile caricare il wallet.');
      return;
    }

    setBalance(saldoRes.data?.bilancio ?? saldoRes.data?.saldo ?? saldoRes.data?.crediti ?? 0);
    setTransactions(storicoRes.ok ? storicoRes.data?.data || storicoRes.data || [] : []);
  }, []);

  useEffect(() => {
    loadWallet();
  }, [loadWallet]);

  async function logout() {
    await clearSession();
    onLogout();
  }

  return (
    <Screen
      title="Profilo"
      subtitle={`${user?.nome || 'Utente'} ${user?.cognome || ''}`.trim()}
      right={<Button title="Esci" variant="secondary" onPress={logout} />}
    >
      <View style={styles.wallet}>
        <Text style={styles.walletLabel}>Saldo crediti</Text>
        {loading ? (
          <ActivityIndicator color={colors.surface} />
        ) : (
          <Text style={styles.balance}>{balance ?? 0}</Text>
        )}
        <Text style={styles.walletLabel}>crediti RE-VALUE</Text>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Account</Text>
        <Info label="Email" value={user?.email} />
        <Info label="Ruolo" value={user?.ruolo || 'user'} />
        <Info label="Citta" value={user?.citta || 'Non indicata'} />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Ultime transazioni</Text>
        {transactions.length === 0 ? (
          <Text style={styles.muted}>Nessuna transazione recente.</Text>
        ) : (
          transactions.map((item) => (
            <View key={item._id || item.id || `${item.tipo}-${item.createdAt}`} style={styles.transaction}>
              <Text style={styles.transactionTitle}>{item.tipo || 'Movimento'}</Text>
              <Text style={styles.muted}>{item.ammontare ?? 0} crediti</Text>
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
  info: {
    gap: 3,
  },
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
  error: {
    color: colors.danger,
    fontWeight: '700',
  },
});
