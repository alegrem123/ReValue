import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api } from '../api/client';
import { AnnuncioCard } from '../components/AnnuncioCard';
import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import { colors } from '../theme/colors';

export function CatalogScreen({ onOpenAnnuncio, refreshKey }) {
  const [annunci, setAnnunci] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadAnnunci = useCallback(async () => {
    setError('');
    setLoading(true);
    const response = await api.get('/api/annunci?limit=50');
    setLoading(false);

    if (!response.ok) {
      setError(response.error || 'Impossibile caricare il catalogo.');
      return;
    }

    setAnnunci(response.data?.data || []);
  }, []);

  useEffect(() => {
    loadAnnunci();
  }, [loadAnnunci, refreshKey]);

  return (
    <Screen
      title="Catalogo"
      subtitle="Sfoglia gli annunci disponibili e apri il dettaglio per prenotare."
      scroll={false}
    >
      {error ? (
        <View style={styles.notice}>
          <Text style={styles.error}>{error}</Text>
          <Button title="Riprova" onPress={loadAnnunci} variant="secondary" />
        </View>
      ) : null}
      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadAnnunci} />}
      >
        {loading && annunci.length === 0 ? <ActivityIndicator color={colors.green} /> : null}
        {!loading && annunci.length === 0 && !error ? (
          <Text style={styles.empty}>Nessun annuncio disponibile.</Text>
        ) : null}
        {annunci.map((annuncio) => (
          <AnnuncioCard
            key={annuncio._id}
            annuncio={annuncio}
            onPress={() => onOpenAnnuncio(annuncio._id)}
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
  notice: {
    gap: 10,
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
