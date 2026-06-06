import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Callout, Marker } from 'react-native-maps';
import { api } from '../api/client';
import { AnnuncioCard, calculateEstimatedCredits } from '../components/AnnuncioCard';
import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import { colors } from '../theme/colors';

const CATEGORIE = ['Mobili', 'Elettrodomestici', 'Elettronica', 'Abbigliamento', 'Libri', 'Giocattoli', 'Attrezzi', 'Altro'];
const DEFAULT_REGION = {
  latitude: 46.0667,
  longitude: 11.1211,
  latitudeDelta: 0.18,
  longitudeDelta: 0.18,
};

function publicCoordinate(annuncio, key) {
  const approxKey = key === 'latitude' ? 'latitudineComune' : 'longitudineComune';
  const exactKey = key === 'latitude' ? 'latitudine' : 'longitudine';
  const value =
    annuncio.indirizzo?.[approxKey] ??
    annuncio[exactKey];
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function locationLabel(annuncio) {
  return [annuncio.indirizzo?.comune, annuncio.indirizzo?.provincia].filter(Boolean).join(', ') || 'Area approssimativa';
}

function mapMarkers(annunci) {
  return annunci
    .map((annuncio) => ({
      annuncio,
      latitude: publicCoordinate(annuncio, 'latitude'),
      longitude: publicCoordinate(annuncio, 'longitude'),
    }))
    .filter((item) => item.latitude != null && item.longitude != null);
}

function regionForMarkers(markers) {
  if (markers.length === 0) return DEFAULT_REGION;

  const latitudes = markers.map((m) => m.latitude);
  const longitudes = markers.map((m) => m.longitude);
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minLng = Math.min(...longitudes);
  const maxLng = Math.max(...longitudes);

  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max(0.04, (maxLat - minLat) * 1.8 || 0.08),
    longitudeDelta: Math.max(0.04, (maxLng - minLng) * 1.8 || 0.08),
  };
}

export function CatalogScreen({ onOpenAnnuncio, refreshKey }) {
  const [annunci, setAnnunci] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [categoria, setCategoria] = useState('');
  const [viewMode, setViewMode] = useState('list');

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
      contentStyle={styles.screenContent}
      right={
        <View style={styles.modeToggle}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Mostra lista annunci"
            onPress={() => setViewMode('list')}
            style={[styles.modeButton, viewMode === 'list' && styles.modeButtonActive]}
          >
            <Ionicons name="list" size={18} color={viewMode === 'list' ? colors.surface : colors.greenDark} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Mostra mappa annunci"
            onPress={() => setViewMode('map')}
            style={[styles.modeButton, viewMode === 'map' && styles.modeButtonActive]}
          >
            <Ionicons name="map" size={18} color={viewMode === 'map' ? colors.surface : colors.greenDark} />
          </Pressable>
        </View>
      }
    >
      <View style={styles.filterPanel}>
        <View style={styles.filterRow}>
          <TextInput
            style={styles.filterInput}
            placeholder="Cerca categoria"
            placeholderTextColor={colors.muted}
            value={categoria}
            onChangeText={setCategoria}
            onSubmitEditing={applyFilter}
            returnKeyType="search"
          />
          <Button title="Cerca" variant="primary" size="compact" onPress={applyFilter} />
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          {CATEGORIE.map((item) => {
            const active = categoria.toLowerCase() === item.toLowerCase();
            return (
              <Pressable
                key={item}
                onPress={() => {
                  setCategoria(item);
                  loadAnnunci(item);
                }}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{item}</Text>
              </Pressable>
            );
          })}
          {categoria ? (
            <Pressable onPress={clearFilter} style={[styles.chip, styles.clearChip]}>
              <Text style={[styles.chipText, styles.clearChipText]}>Pulisci</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      </View>

      {error ? (
        <View style={styles.notice}>
          <Text style={styles.error}>{error}</Text>
          <Button title="Riprova" onPress={() => loadAnnunci(categoria)} variant="secondary" size="compact" />
        </View>
      ) : null}
      {viewMode === 'map' ? (
        <CatalogMap annunci={annunci} loading={loading} error={error} onOpenAnnuncio={onOpenAnnuncio} />
      ) : (
        <ScrollView
          style={styles.listScroll}
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
      )}
    </Screen>
  );
}

function CatalogMap({ annunci, loading, error, onOpenAnnuncio }) {
  const markers = mapMarkers(annunci);

  if (loading && annunci.length === 0) {
    return (
      <View style={styles.mapEmpty}>
        <ActivityIndicator color={colors.green} />
      </View>
    );
  }

  if (!error && markers.length === 0) {
    return (
      <View style={styles.mapEmpty}>
        <Text style={styles.empty}>Nessun annuncio geolocalizzato disponibile.</Text>
      </View>
    );
  }

  return (
    <View style={styles.mapShell}>
      <MapView
        style={styles.map}
        initialRegion={regionForMarkers(markers)}
      >
        {markers.map(({ annuncio, latitude, longitude }) => (
          <Marker
            key={annuncio._id}
            coordinate={{ latitude, longitude }}
            pinColor={colors.green}
            title={annuncio.titolo || 'Annuncio'}
            description={locationLabel(annuncio)}
          >
            <Callout onPress={() => onOpenAnnuncio(annuncio._id)}>
              <View style={styles.callout}>
                <Text style={styles.calloutTitle}>{annuncio.titolo || 'Annuncio senza titolo'}</Text>
                <Text style={styles.calloutMeta}>{annuncio.oggetto?.categoria || 'Categoria non indicata'}</Text>
                <Text style={styles.calloutLocation}>{locationLabel(annuncio)}</Text>
                <Text style={styles.calloutCredits}>{calculateEstimatedCredits(annuncio)} crediti stimati</Text>
                <Text style={styles.calloutAction}>Apri dettaglio</Text>
              </View>
            </Callout>
          </Marker>
        ))}
      </MapView>
      <View style={styles.mapLegend}>
        <Text style={styles.mapLegendText}>Le posizioni sono approssimate come nel catalogo web.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    paddingBottom: 0,
  },
  modeToggle: {
    flexDirection: 'row',
    gap: 6,
    padding: 4,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  modeButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.greenXLight,
  },
  modeButtonActive: {
    backgroundColor: colors.green,
  },
  filterPanel: {
    gap: 8,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginBottom: 4,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  filterInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  chips: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 8,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.surface,
    minHeight: 34,
    justifyContent: 'center',
  },
  chipActive: {
    borderColor: colors.green,
    backgroundColor: colors.green,
  },
  clearChip: {
    borderColor: colors.green,
    backgroundColor: colors.greenXLight,
  },
  chipText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  chipTextActive: {
    color: colors.surface,
  },
  clearChipText: {
    color: colors.greenDark,
  },
  list: {
    gap: 12,
    paddingBottom: 16,
  },
  listScroll: {
    flex: 1,
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
  mapShell: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  map: {
    flex: 1,
    minHeight: 420,
  },
  mapEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  mapLegend: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  mapLegendText: {
    color: colors.muted,
    fontSize: 12,
    textAlign: 'center',
  },
  callout: {
    width: 220,
    gap: 4,
  },
  calloutTitle: {
    color: colors.text,
    fontWeight: '800',
    fontSize: 15,
  },
  calloutMeta: {
    color: colors.muted,
    fontSize: 12,
  },
  calloutLocation: {
    color: colors.greenDark,
    fontSize: 12,
    fontWeight: '700',
  },
  calloutCredits: {
    alignSelf: 'flex-start',
    marginTop: 4,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    overflow: 'hidden',
    backgroundColor: colors.greenXLight,
    color: colors.greenDark,
    fontSize: 12,
    fontWeight: '800',
  },
  calloutAction: {
    marginTop: 6,
    color: colors.green,
    fontWeight: '800',
    fontSize: 12,
  },
});
