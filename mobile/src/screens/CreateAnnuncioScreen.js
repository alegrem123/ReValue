import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { api } from '../api/client';
import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import { TextField } from '../components/TextField';
import { colors } from '../theme/colors';

const initialForm = {
  titolo: '',
  descrizione: '',
  categoria: '',
  materiale: '',
  dimensioni: 'medio',
  dataScadenza: '',
  paese: 'Italia',
  regione: '',
  provincia: '',
  comune: '',
  via: '',
  latitudine: '',
  longitudine: '',
  latitudineComune: '',
  longitudineComune: '',
};

const CATEGORIE = ['Mobili', 'Elettrodomestici', 'Elettronica', 'Abbigliamento', 'Libri', 'Giocattoli', 'Attrezzi', 'Altro'];
const MATERIALI = ['Legno', 'Metallo', 'Plastica', 'Vetro', 'Tessuto', 'Carta', 'Misto'];
const DIMENSIONI = ['piccolo', 'medio', 'grande', 'molto grande'];
const PAESI = ['Italia'];
const REGIONI = ['Trentino-Alto Adige', 'Veneto', 'Lombardia', 'Emilia-Romagna'];
const PROVINCE = ['Trento', 'Bolzano', 'Verona', 'Brescia'];
const COMUNI = ['Trento', 'Rovereto', 'Pergine Valsugana', 'Riva del Garda', 'Arco'];

export function CreateAnnuncioScreen({ onCreated }) {
  const [form, setForm] = useState(initialForm);
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(false);

  function setField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function pickPhotos() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permesso necessario', 'Abilita l accesso alle foto per aggiungere immagini.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsMultipleSelection: true,
      base64: true,
      quality: 0.7,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      selectionLimit: 5,
    });

    if (result.canceled) return;

    const selected = result.assets
      .slice(0, 5)
      .map((asset) => `data:${asset.mimeType || 'image/jpeg'};base64,${asset.base64}`);
    setPhotos(selected);
  }

  async function useCurrentLocation() {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permesso necessario', 'Abilita la posizione per compilare le coordinate.');
      return;
    }

    const position = await Location.getCurrentPositionAsync({});
    const address = await Location.reverseGeocodeAsync(position.coords).catch(() => []);
    const first = address?.[0] || {};
    const city = first.city || first.district || first.subregion || '';
    const street = [first.street, first.streetNumber].filter(Boolean).join(' ');
    setForm((current) => ({
      ...current,
      latitudine: position.coords.latitude.toFixed(6),
      longitudine: position.coords.longitude.toFixed(6),
      latitudineComune: current.latitudineComune || position.coords.latitude.toFixed(6),
      longitudineComune: current.longitudineComune || position.coords.longitude.toFixed(6),
      paese: first.country || current.paese,
      regione: first.region || current.regione,
      provincia: first.subregion || current.provincia,
      comune: city || current.comune,
      via: street || current.via,
    }));
  }

  async function ensureGeocoded() {
    if (form.latitudine && form.longitudine && form.latitudineComune && form.longitudineComune) return form;

    const cityQuery = [form.comune, form.provincia, form.regione, form.paese].filter(Boolean).join(', ');
    const fullQuery = [form.via, cityQuery].filter(Boolean).join(', ');

    const [cityResults, exactResults] = await Promise.all([
      form.latitudineComune && form.longitudineComune ? Promise.resolve([]) : Location.geocodeAsync(cityQuery).catch(() => []),
      form.latitudine && form.longitudine ? Promise.resolve([]) : Location.geocodeAsync(fullQuery).catch(() => []),
    ]);

    const city = cityResults?.[0];
    const exact = exactResults?.[0] || city;
    if (!exact) return null;

    const nextForm = {
      ...form,
      latitudine: form.latitudine || exact.latitude.toFixed(6),
      longitudine: form.longitudine || exact.longitude.toFixed(6),
      latitudineComune: form.latitudineComune || (city || exact).latitude.toFixed(6),
      longitudineComune: form.longitudineComune || (city || exact).longitude.toFixed(6),
    };
    setForm(nextForm);

    return nextForm;
  }

  function buildPayload(source = form) {
    return {
      titolo: source.titolo.trim(),
      dataScadenza: new Date(source.dataScadenza).toISOString(),
      latitudine: source.latitudine ? Number(source.latitudine) : undefined,
      longitudine: source.longitudine ? Number(source.longitudine) : undefined,
      indirizzo: {
        paese: source.paese.trim(),
        regione: source.regione.trim(),
        provincia: source.provincia.trim(),
        comune: source.comune.trim(),
        via: source.via.trim(),
        latitudineComune: source.latitudineComune ? Number(source.latitudineComune) : undefined,
        longitudineComune: source.longitudineComune ? Number(source.longitudineComune) : undefined,
      },
      oggetto: {
        categoria: source.categoria.trim(),
        descrizione: source.descrizione.trim(),
        dimensioni: source.dimensioni,
        materiale: source.materiale.trim(),
        foto: photos,
      },
    };
  }

  async function submit() {
    if (!form.titolo || !form.descrizione || !form.categoria || !form.dataScadenza || !form.comune || !form.via) {
      Alert.alert('Campi mancanti', 'Titolo, descrizione, categoria, scadenza, comune e via sono obbligatori.');
      return;
    }

    const parsedDate = new Date(form.dataScadenza);
    if (Number.isNaN(parsedDate.getTime())) {
      Alert.alert('Data non valida', 'Inserisci una data di scadenza valida.');
      return;
    }
    if (parsedDate <= new Date()) {
      Alert.alert('Data non valida', 'La scadenza deve essere nel futuro.');
      return;
    }

    setLoading(true);
    const geocodedForm = await ensureGeocoded();
    if (!geocodedForm) {
      setLoading(false);
      Alert.alert('Indirizzo non trovato', 'Controlla comune e via oppure usa la posizione attuale.');
      return;
    }

    const response = await api.post('/api/v1/annunci', buildPayload(geocodedForm));
    setLoading(false);

    if (!response.ok) {
      Alert.alert('Pubblicazione non riuscita', response.error || 'Controlla i dati inseriti.');
      return;
    }

    setForm(initialForm);
    setPhotos([]);
    Alert.alert('Annuncio pubblicato', 'Il tuo annuncio e ora disponibile nel catalogo.');
    onCreated?.();
  }

  return (
    <Screen title="Nuovo annuncio" subtitle="Pubblica un oggetto da recuperare.">
      <TextField label="Titolo" value={form.titolo} onChangeText={(value) => setField('titolo', value)} />
      <TextField
        label="Descrizione"
        value={form.descrizione}
        multiline
        onChangeText={(value) => setField('descrizione', value)}
      />
      <TextField label="Categoria" value={form.categoria} onChangeText={(value) => setField('categoria', value)} />
      <PresetChips items={CATEGORIE} selected={form.categoria} onSelect={(value) => setField('categoria', value)} />
      <TextField label="Materiale" value={form.materiale} onChangeText={(value) => setField('materiale', value)} />
      <PresetChips items={MATERIALI} selected={form.materiale} onSelect={(value) => setField('materiale', value)} />
      <TextField
        label="Dimensione"
        value={form.dimensioni}
        placeholder="piccolo, medio, grande, molto grande"
        onChangeText={(value) => setField('dimensioni', value)}
      />
      <PresetChips items={DIMENSIONI} selected={form.dimensioni} onSelect={(value) => setField('dimensioni', value)} />
      <TextField
        label="Scadenza"
        value={form.dataScadenza}
        placeholder="2026-06-30T18:00"
        autoCapitalize="none"
        onChangeText={(value) => setField('dataScadenza', value)}
      />
      <TextField label="Stato / paese" value={form.paese} onChangeText={(value) => setField('paese', value)} />
      <PresetChips items={PAESI} selected={form.paese} onSelect={(value) => setField('paese', value)} />
      <TextField label="Regione" value={form.regione} onChangeText={(value) => setField('regione', value)} />
      <PresetChips items={REGIONI} selected={form.regione} onSelect={(value) => setField('regione', value)} />
      <TextField label="Provincia" value={form.provincia} onChangeText={(value) => setField('provincia', value)} />
      <PresetChips items={PROVINCE} selected={form.provincia} onSelect={(value) => setField('provincia', value)} />
      <TextField label="Comune / città" value={form.comune} onChangeText={(value) => setField('comune', value)} />
      <PresetChips items={COMUNI} selected={form.comune} onSelect={(value) => setField('comune', value)} />
      <TextField label="Via" value={form.via} onChangeText={(value) => setField('via', value)} />
      <Button title="Usa posizione attuale" variant="secondary" onPress={useCurrentLocation} />
      <Button title={`Seleziona foto (${photos.length}/5)`} variant="secondary" onPress={pickPhotos} />
      <View style={styles.photos}>
        {photos.map((photo, index) => (
          <Pressable key={`${photo.slice(0, 24)}-${index}`} onPress={() => setPhotos(photos.filter((_, i) => i !== index))}>
            <Image source={{ uri: photo }} style={styles.photo} />
          </Pressable>
        ))}
      </View>
      <Button title="Pubblica annuncio" onPress={submit} loading={loading} />
    </Screen>
  );
}

function PresetChips({ items, selected, onSelect }) {
  return (
    <View style={styles.chips}>
      {items.map((item) => {
        const active = item.toLowerCase() === String(selected || '').toLowerCase();
        return (
          <Pressable
            key={item}
            onPress={() => onSelect(item)}
            style={[styles.chip, active && styles.chipActive]}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{item}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  half: {
    flex: 1,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: -8,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.surface,
  },
  chipActive: {
    borderColor: colors.green,
    backgroundColor: colors.green,
  },
  chipText: {
    color: colors.muted,
    fontWeight: '700',
    fontSize: 12,
  },
  chipTextActive: {
    color: colors.surface,
  },
  photos: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  photo: {
    width: 76,
    height: 76,
    borderRadius: 8,
    backgroundColor: colors.border,
  },
});
