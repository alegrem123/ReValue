import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api } from '../api/client';
import { AnnuncioCard } from '../components/AnnuncioCard';
import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import { colors } from '../theme/colors';

export function MyAnnunciScreen({ onOpenAnnuncio, refreshKey }) {
  const [annunci, setAnnunci] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadAnnunci = useCallback(async () => {
    setError('');
    setLoading(true);
    const response = await api.get('/api/annunci/me');
    setLoading(false);

    if (!response.ok) {
      setError(response.error || 'Impossibile caricare i tuoi annunci.');
      return;
    }
    setAnnunci(Array.isArray(response.data) ? response.data : []);
  }, []);

  useEffect(() => {
    loadAnnunci();
  }, [loadAnnunci, refreshKey]);

  async function deleteAnnuncio(id) {
    const response = await api.delete(`/api/annunci/${encodeURIComponent(id)}`);
    if (!response.ok) {
      Alert.alert('Eliminazione non riuscita', response.error || 'Riprova piu tardi.');
      return;
    }
    await loadAnnunci();
  }

  function confirmDelete(annuncio) {
    Alert.alert('Elimina annuncio', `Vuoi eliminare "${annuncio.titolo || 'annuncio'}"?`, [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Elimina', style: 'destructive', onPress: () => deleteAnnuncio(annuncio._id) },
    ]);
  }

  return (
    <Screen title="I miei annunci" subtitle="Controlla gli annunci pubblicati e rimuovi quelli non piu disponibili." scroll={false}>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadAnnunci} />}
      >
        {loading && annunci.length === 0 ? <ActivityIndicator color={colors.green} /> : null}
        {!loading && annunci.length === 0 && !error ? (
          <Text style={styles.empty}>Non hai ancora pubblicato annunci.</Text>
        ) : null}
        {annunci.map((annuncio) => (
          <AnnuncioCard
            key={annuncio._id}
            annuncio={annuncio}
            onPress={() => onOpenAnnuncio(annuncio._id)}
            actions={
              <View style={styles.actions}>
                <Button title="Apri" variant="secondary" onPress={() => onOpenAnnuncio(annuncio._id)} />
                <Button title="Elimina" variant="danger" onPress={() => confirmDelete(annuncio)} />
              </View>
            }
          />
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 12,
    paddingBottom: 112,
  },
  actions: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
  },
  error: {
    color: colors.danger,
    fontWeight: '700',
  },
  empty: {
    color: colors.muted,
    textAlign: 'center',
    marginTop: 24,
  },
});
