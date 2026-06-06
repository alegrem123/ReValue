import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useState } from 'react';
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
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

const CATEGORIE = [
  'Arredo e mobili',
  'Bagno e sanitari',
  'Biciclette e mobilita',
  'Cancelleria',
  'Cucina e casalinghi',
  'Decorazioni',
  'Edilizia leggera',
  'Elettrodomestici',
  'Elettronica',
  'Ferramenta',
  'Giardino e outdoor',
  'Giocattoli',
  'Illuminazione',
  'Infanzia',
  'Libri e manuali',
  'Materiale scolastico',
  'Musica e strumenti',
  'Ricambi auto e moto',
  'Sport e tempo libero',
  'Tessili e biancheria',
  'Utensili e attrezzi',
  'Vasi e contenitori',
  'Altro',
];
const MATERIALI = [
  'Legno',
  'Legno massello',
  'Truciolare',
  'MDF',
  'Metallo',
  'Acciaio',
  'Alluminio',
  'Ferro',
  'Plastica',
  'PVC',
  'Vetro',
  'Ceramica',
  'Tessuto',
  'Cotone',
  'Lana',
  'Pelle',
  'Carta',
  'Cartone',
  'Gomma',
  'Rame',
  'Ottone',
  'Misto',
];
const DIMENSIONI = [
  { label: 'Piccolo', value: 'piccolo' },
  { label: 'Medio', value: 'medio' },
  { label: 'Grande', value: 'grande' },
  { label: 'Molto grande', value: 'molto grande' },
];
const PAESI = ['Italia', 'San Marino', 'Citta del Vaticano', 'Svizzera', 'Austria', 'Francia', 'Slovenia', 'Croazia', 'Germania'];
const REGIONI = [
  'Abruzzo',
  'Basilicata',
  'Calabria',
  'Campania',
  'Emilia-Romagna',
  'Friuli-Venezia Giulia',
  'Lazio',
  'Liguria',
  'Lombardia',
  'Marche',
  'Molise',
  'Piemonte',
  'Puglia',
  'Sardegna',
  'Sicilia',
  'Toscana',
  'Trentino-Alto Adige/Südtirol',
  'Umbria',
  "Valle d'Aosta/Vallée d'Aoste",
  'Veneto',
];
const PROVINCE = ['Trento', 'Bolzano/Bozen', 'Verona', 'Brescia'];
const COMUNI = ['Trento', 'Rovereto', 'Pergine Valsugana', 'Riva del Garda', 'Arco'];

function dateToInputValue(date) {
  return date.toISOString().slice(0, 10);
}

function formatDisplayDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

function tomorrow() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(12, 0, 0, 0);
  return date;
}

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
      Alert.alert('Permesso necessario', 'Abilita la posizione per compilare automaticamente l indirizzo.');
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
    Alert.alert('Annuncio pubblicato', 'Il tuo annuncio è ora disponibile nel catalogo.');
    onCreated?.();
  }

  return (
    <Screen title="Nuovo annuncio" subtitle="Pubblica un oggetto e rendilo prenotabile dalla community.">
      <TextField label="Titolo" value={form.titolo} onChangeText={(value) => setField('titolo', value)} />
      <TextField
        label="Descrizione"
        value={form.descrizione}
        multiline
        onChangeText={(value) => setField('descrizione', value)}
      />
      <DropdownField
        label="Categoria"
        placeholder="Seleziona categoria"
        options={CATEGORIE}
        value={form.categoria}
        onSelect={(value) => setField('categoria', value)}
      />
      <DropdownField
        label="Materiale"
        placeholder="Seleziona materiale"
        options={MATERIALI}
        value={form.materiale}
        onSelect={(value) => setField('materiale', value)}
      />
      <DropdownField
        label="Dimensione"
        options={DIMENSIONI}
        value={form.dimensioni}
        onSelect={(value) => setField('dimensioni', value)}
      />
      <DateField
        label="Scadenza"
        value={form.dataScadenza}
        onSelect={(value) => setField('dataScadenza', value)}
      />
      <DropdownField
        label="Stato / paese"
        options={PAESI}
        value={form.paese}
        onSelect={(value) => setField('paese', value)}
      />
      <DropdownField
        label="Regione"
        placeholder="Seleziona regione"
        options={REGIONI}
        value={form.regione}
        onSelect={(value) => setField('regione', value)}
      />
      <DropdownField
        label="Provincia"
        placeholder="Seleziona provincia"
        options={PROVINCE}
        value={form.provincia}
        onSelect={(value) => setField('provincia', value)}
      />
      <DropdownField
        label="Comune / città"
        placeholder="Seleziona comune"
        options={COMUNI}
        value={form.comune}
        onSelect={(value) => setField('comune', value)}
      />
      <TextField label="Via" value={form.via} onChangeText={(value) => setField('via', value)} />
      <Button title="Usa posizione attuale" variant="secondary" size="compact" fullWidth onPress={useCurrentLocation} />
      <Button title={`Seleziona foto (${photos.length}/5)`} variant="secondary" size="compact" fullWidth onPress={pickPhotos} />
      <View style={styles.photos}>
        {photos.map((photo, index) => (
          <Pressable key={`${photo.slice(0, 24)}-${index}`} onPress={() => setPhotos(photos.filter((_, i) => i !== index))}>
            <Image source={{ uri: photo }} style={styles.photo} />
          </Pressable>
        ))}
      </View>
      <Button title="Pubblica annuncio" onPress={submit} loading={loading} fullWidth />
    </Screen>
  );
}

function normalizeOption(option) {
  if (typeof option === 'string') return { label: option, value: option };
  return option;
}

function DropdownField({ label, placeholder = 'Seleziona', options, value, onSelect }) {
  const [open, setOpen] = useState(false);
  const normalized = options.map(normalizeOption);
  const selected = normalized.find((option) => option.value === value);

  return (
    <View style={styles.dropdownWrap}>
      <Text style={styles.dropdownLabel}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.dropdownButton, pressed && styles.dropdownButtonPressed]}
      >
        <Text style={[styles.dropdownValue, !selected && styles.dropdownPlaceholder]}>
          {selected?.label || placeholder}
        </Text>
        <Ionicons name="chevron-down" size={18} color={colors.muted} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.dropdownBackdrop} onPress={() => setOpen(false)} />
        <View style={styles.dropdownSheet}>
          <View style={styles.dropdownSheetHeader}>
            <Text style={styles.dropdownSheetTitle}>{label}</Text>
            <Pressable accessibilityRole="button" onPress={() => setOpen(false)} style={styles.dropdownClose}>
              <Ionicons name="close" size={20} color={colors.text} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.dropdownOptions}>
            {normalized.map((option) => {
              const active = option.value === value;
              return (
                <Pressable
                  key={option.value}
                  accessibilityRole="button"
                  onPress={() => {
                    onSelect(option.value);
                    setOpen(false);
                  }}
                  style={({ pressed }) => [
                    styles.dropdownOption,
                    active && styles.dropdownOptionActive,
                    pressed && styles.dropdownOptionPressed,
                  ]}
                >
                  <Text style={[styles.dropdownOptionText, active && styles.dropdownOptionTextActive]}>
                    {option.label}
                  </Text>
                  {active ? <Ionicons name="checkmark" size={18} color={colors.green} /> : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

function DateField({ label, value, onSelect }) {
  const [open, setOpen] = useState(false);
  const minDate = tomorrow();
  const currentDate = value && !Number.isNaN(new Date(value).getTime())
    ? new Date(value)
    : minDate;

  return (
    <View style={styles.dropdownWrap}>
      <Text style={styles.dropdownLabel}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.dropdownButton, pressed && styles.dropdownButtonPressed]}
      >
        <Text style={[styles.dropdownValue, !value && styles.dropdownPlaceholder]}>
          {formatDisplayDate(value) || 'Seleziona scadenza'}
        </Text>
        <Ionicons name="calendar-outline" size={18} color={colors.muted} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.dropdownBackdrop} onPress={() => setOpen(false)} />
        <View style={styles.dateSheet}>
          <View style={styles.dropdownSheetHeader}>
            <Text style={styles.dropdownSheetTitle}>{label}</Text>
            <Pressable accessibilityRole="button" onPress={() => setOpen(false)} style={styles.dropdownClose}>
              <Ionicons name="close" size={20} color={colors.text} />
            </Pressable>
          </View>
          <DateTimePicker
            value={currentDate}
            mode="date"
            display="inline"
            minimumDate={minDate}
            locale="it-IT"
            onChange={(event, selectedDate) => {
              if (event.type === 'dismissed') {
                setOpen(false);
                return;
              }
              if (selectedDate) {
                onSelect(dateToInputValue(selectedDate));
              }
            }}
          />
          <Button title="Conferma data" size="compact" fullWidth onPress={() => setOpen(false)} />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  dropdownWrap: {
    gap: 6,
  },
  dropdownLabel: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 14,
  },
  dropdownButton: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  dropdownButtonPressed: {
    opacity: 0.78,
  },
  dropdownValue: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
  },
  dropdownPlaceholder: {
    color: colors.muted,
  },
  dropdownBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.32)',
  },
  dropdownSheet: {
    maxHeight: '70%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 26,
  },
  dateSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 26,
    gap: 12,
  },
  dropdownSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dropdownSheetTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  dropdownClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.greenXLight,
  },
  dropdownOptions: {
    paddingTop: 8,
  },
  dropdownOption: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 10,
  },
  dropdownOptionActive: {
    backgroundColor: colors.greenXLight,
  },
  dropdownOptionPressed: {
    opacity: 0.72,
  },
  dropdownOptionText: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
  },
  dropdownOptionTextActive: {
    color: colors.greenDark,
    fontWeight: '800',
  },
  photos: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  photo: {
    width: 76,
    height: 76,
    borderRadius: 12,
    backgroundColor: colors.border,
  },
});
