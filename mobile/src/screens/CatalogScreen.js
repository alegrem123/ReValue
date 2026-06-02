import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { api } from '../api/client';
import { AnnuncioCard } from '../components/AnnuncioCard';
import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import { colors } from '../theme/colors';

export function CatalogScreen({ onOpenAnnuncio, refreshKey }) {
  const [annunci, setAnnunci] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [categoria, setCategoria] = useState('');

  const loadAnnunci = useCallback(async (cat) => {
    setError('');
    setLoading(true);
    const query = cat ? `/api/v1/annunci?limit=50&categoria=${encodeURIComponent(cat)}` : '/api/v1/annunci?limit=50';
    const response = await api.get(query);
    setLoading(false);

    if (!response.ok) {
      setError(response.error || 'Impossibile caricare il catalogo.');
      return;
    }

    setAnnunci(response.data?.data || []);
  }, []);

  useEffect(() => {
    loadAnnunci(categoria);
  }, [loadAnnunci, refreshKey]);

  function applyFilter() {
    loadAnnunci(categoria);
  }

  function clearFilter() {
    setCategoria('');
    loadAnnunci('');
  }

  return (
    <Screen
      title="Catalogo"
      subtitle="Sfoglia gli annunci disponibili e apri il dettaglio per prenotare."
      scroll={false}
    >
      <View style={styles.filterRow}>
        <TextInput
          style={styles.filterInput}
          placeholder="Filtra per categoria…"
          placeholderTextColor={colors.muted}
          value={categoria}
          onChangeText={setCategoria}
          onSubmitEditing={applyFilter}
          returnKeyType="search"
        />
        <Button title="Cerca" variant="primary" onPress={applyFilter} />
        {categoria ? <Button title="✕" variant="secondary" onPress={clearFilter} /> : null}
      </View>

      {error ? (
        <View style={styles.notice}>
          <Text style={styles.error}>{error}</Text>
          <Button title="Riprova" onPress={() => loadAnnunci(categoria)} variant="secondary" />
        </View>
      ) : null}
      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => loadAnnunci(categoria)} />}
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
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    marginBottom: 4,
  },
  filterInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.surface,
  },
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
