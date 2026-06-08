import { useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';

const PLACEHOLDER = 'https://via.placeholder.com/640x420/EDE8DF/6B7280?text=RE-VALUE';

export function formatDate(value) {
  if (!value) return 'N/D';
  return new Intl.DateTimeFormat('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value));
}

function formatPublicLocation(annuncio) {
  const parts = [
    annuncio.indirizzo?.comune,
    annuncio.indirizzo?.provincia,
  ].filter(Boolean);
  if (parts.length > 0) return parts.join(', ');
  if (annuncio.posizioneApprossimata) return 'Area approssimativa';
  return 'Posizione non indicata';
}

function statoBadgeStyle(stato) {
  const map = {
    disponibile: { bg: colors.statoDisponibile,  tx: colors.statoDisponibileTx },
    prenotato:   { bg: colors.statoPrenotato,    tx: colors.statoPrenotatoTx   },
    scambiato:   { bg: colors.statoScambiato,    tx: colors.statoScambiatoTx   },
    ritirato:    { bg: colors.statoScambiato,    tx: colors.statoScambiatoTx   },
    scaduto:     { bg: colors.statoScaduto,      tx: colors.statoScadutoTx     },
    sospeso:     { bg: colors.statoSospeso,      tx: colors.statoSospesoTx     },
  };
  return map[(stato || '').toLowerCase()] || map.disponibile;
}

const CREDIT_TIER_A = { acqMin: 10, acqMax: 100 };
const CREDIT_TIER_B = { acqMin: 6, acqMax: 60 };
const CREDIT_TIER_C = { acqMin: 3, acqMax: 30 };

const CATEGORY_TIER = {
  'Elettronica': CREDIT_TIER_A,
  'Elettrodomestici': CREDIT_TIER_A,
  'Arredo e mobili': CREDIT_TIER_A,
  'Biciclette e mobilita': CREDIT_TIER_A,
  'Ricambi auto e moto': CREDIT_TIER_A,
  'Utensili e attrezzi': CREDIT_TIER_A,
  'Cucina e casalinghi': CREDIT_TIER_B,
  'Sport e tempo libero': CREDIT_TIER_B,
  'Musica e strumenti': CREDIT_TIER_B,
  'Ferramenta': CREDIT_TIER_B,
  'Giardino e outdoor': CREDIT_TIER_B,
  'Edilizia leggera': CREDIT_TIER_B,
  'Bagno e sanitari': CREDIT_TIER_B,
  'Illuminazione': CREDIT_TIER_B,
  'Libri e manuali': CREDIT_TIER_C,
  'Cancelleria': CREDIT_TIER_C,
  'Decorazioni': CREDIT_TIER_C,
  'Giocattoli': CREDIT_TIER_C,
  'Infanzia': CREDIT_TIER_C,
  'Materiale scolastico': CREDIT_TIER_C,
  'Tessili e biancheria': CREDIT_TIER_C,
  'Vasi e contenitori': CREDIT_TIER_C,
  'Altro': CREDIT_TIER_C,
};

const MAX_CREDIT_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

export function calculateEstimatedCredits(annuncio) {
  const explicit = annuncio?.creditiRichiesti ?? annuncio?.crediti;
  if (explicit != null && !Number.isNaN(Number(explicit))) return Math.round(Number(explicit));

  const tier = CATEGORY_TIER[annuncio?.oggetto?.categoria || annuncio?.categoria] || CREDIT_TIER_C;
  if (!annuncio?.dataScadenza) return tier.acqMin;

  const deadline = new Date(annuncio.dataScadenza).getTime();
  if (!Number.isFinite(deadline)) return tier.acqMin;

  const remaining = Math.max(0, deadline - Date.now());
  const ratio = 1 - Math.min(1, remaining / MAX_CREDIT_WINDOW_MS);
  return Math.round(tier.acqMin + (tier.acqMax - tier.acqMin) * ratio);
}

export function AnnuncioCard({ annuncio, onPress, actions }) {
  const scale     = useRef(new Animated.Value(1)).current;
  const imgScale  = useRef(new Animated.Value(1)).current;

  function handlePressIn() {
    Animated.parallel([
      Animated.spring(scale,    { toValue: 0.97, useNativeDriver: true, speed: 40 }),
      Animated.spring(imgScale, { toValue: 1.04, useNativeDriver: true, speed: 30 }),
    ]).start();
  }
  function handlePressOut() {
    Animated.parallel([
      Animated.spring(scale,    { toValue: 1, useNativeDriver: true, speed: 25 }),
      Animated.spring(imgScale, { toValue: 1, useNativeDriver: true, speed: 20 }),
    ]).start();
  }

  const foto = annuncio.oggetto?.foto?.[0] || PLACEHOLDER;
  const stato = annuncio.stato || 'disponibile';
  const badgeStyle = statoBadgeStyle(stato);
  const crediti = calculateEstimatedCredits(annuncio);

  return (
    <Animated.View style={[styles.cardWrap, { transform: [{ scale }] }]}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={styles.card}
      >
        <View style={styles.imgWrapper}>
          <Animated.Image
            source={{ uri: foto }}
            style={[styles.image, { transform: [{ scale: imgScale }] }]}
          />
        </View>
        <View style={styles.body}>
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={2}>
              {annuncio.titolo || 'Annuncio senza titolo'}
            </Text>
            <View style={[styles.badge, { backgroundColor: badgeStyle.bg }]}>
              <Text style={[styles.badgeText, { color: badgeStyle.tx }]}>{stato}</Text>
            </View>
          </View>
          <Text style={styles.meta}>
            {annuncio.oggetto?.categoria || 'Categoria non indicata'}
          </Text>
          <Text style={styles.location} numberOfLines={1}>
            {formatPublicLocation(annuncio)}
          </Text>
          <View style={styles.footer}>
            <Text style={styles.meta}>
              Scade: {formatDate(annuncio.dataScadenza)}
            </Text>
            <View style={styles.creditsPill}>
              <Text style={styles.creditsValue}>{crediti}</Text>
              <Text style={styles.creditsLabel}>crediti</Text>
            </View>
          </View>
          {actions ? <View style={styles.actions}>{actions}</View> : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  cardWrap: {
    borderRadius: 16,
    // Shadow iOS
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    // Shadow Android
    elevation: 3,
    backgroundColor: colors.surface,
  },
  card: {
    overflow: 'hidden',
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  imgWrapper: {
    overflow: 'hidden',
    height: 200,
    width: '100%',
    backgroundColor: colors.sand,
  },
  image: {
    height: '100%',
    width: '100%',
  },
  body: {
    padding: 14,
    gap: 6,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  title: {
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: 0,
  },
  badge: {
    borderRadius: 50,
    paddingHorizontal: 9,
    paddingVertical: 3,
    flexShrink: 0,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  meta: {
    color: colors.muted,
    fontSize: 13,
  },
  location: {
    color: colors.greenDark,
    fontSize: 13,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  creditsPill: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: colors.greenXLight,
    borderWidth: 1,
    borderColor: colors.greenLight,
    flexShrink: 0,
  },
  creditsValue: {
    color: colors.greenDark,
    fontWeight: '800',
    fontSize: 16,
  },
  creditsLabel: {
    color: colors.greenDark,
    fontWeight: '700',
    fontSize: 11,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
});
