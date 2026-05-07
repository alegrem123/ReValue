import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { getStoredUser, getToken } from './src/api/client';
import { AnnuncioDetailScreen } from './src/screens/AnnuncioDetailScreen';
import { AuthScreen } from './src/screens/AuthScreen';
import { CatalogScreen } from './src/screens/CatalogScreen';
import { CreateAnnuncioScreen } from './src/screens/CreateAnnuncioScreen';
import { MyAnnunciScreen } from './src/screens/MyAnnunciScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { colors } from './src/theme/colors';

const tabs = [
  { key: 'catalog', label: 'Catalogo' },
  { key: 'create', label: 'Crea' },
  { key: 'mine', label: 'Miei' },
  { key: 'profile', label: 'Profilo' },
];

export default function App() {
  const [booting, setBooting] = useState(true);
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState('catalog');
  const [detailId, setDetailId] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    async function boot() {
      const [token, storedUser] = await Promise.all([getToken(), getStoredUser()]);
      if (token) setUser(storedUser || { nome: 'Utente' });
      setBooting(false);
    }
    boot();
  }, []);

  function handleCreated() {
    setRefreshKey((current) => current + 1);
    setTab('mine');
  }

  function renderContent() {
    if (!user) {
      return <AuthScreen onAuthenticated={setUser} />;
    }

    if (detailId) {
      return <AnnuncioDetailScreen id={detailId} onBack={() => setDetailId(null)} />;
    }

    if (tab === 'create') {
      return <CreateAnnuncioScreen onCreated={handleCreated} />;
    }

    if (tab === 'mine') {
      return (
        <MyAnnunciScreen
          refreshKey={refreshKey}
          onOpenAnnuncio={(id) => setDetailId(id)}
        />
      );
    }

    if (tab === 'profile') {
      return (
        <ProfileScreen
          user={user}
          onLogout={() => {
            setUser(null);
            setTab('catalog');
            setDetailId(null);
          }}
        />
      );
    }

    return (
      <CatalogScreen
        refreshKey={refreshKey}
        onOpenAnnuncio={(id) => setDetailId(id)}
      />
    );
  }

  if (booting) {
    return (
      <SafeAreaView style={styles.boot}>
        <StatusBar style="light" />
        <ActivityIndicator color={colors.surface} />
        <Text style={styles.bootText}>RE-VALUE</Text>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.app}>
      <StatusBar style="dark" />
      <View style={styles.content}>{renderContent()}</View>
      {user && !detailId ? (
        <SafeAreaView style={styles.navSafe}>
          <View style={styles.nav}>
            {tabs.map((item) => {
              const active = item.key === tab;
              return (
                <Pressable
                  key={item.key}
                  onPress={() => setTab(item.key)}
                  style={[styles.navItem, active && styles.navItemActive]}
                >
                  <Text style={[styles.navText, active && styles.navTextActive]}>{item.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </SafeAreaView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  app: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
  },
  boot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    backgroundColor: colors.green,
  },
  bootText: {
    color: colors.surface,
    fontSize: 28,
    fontWeight: '900',
  },
  navSafe: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  nav: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 10,
    paddingTop: 10,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    borderRadius: 8,
  },
  navItemActive: {
    backgroundColor: '#E7F3E8',
  },
  navText: {
    color: colors.muted,
    fontWeight: '800',
  },
  navTextActive: {
    color: colors.greenDark,
  },
});
