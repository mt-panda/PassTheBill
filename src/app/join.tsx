import { useEffect, useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LogoMark } from '@/components/splash';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, Input, Segmented, styles } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';

export default function JoinScreen() {
  const { reload } = useSession();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<'join' | 'create'>('join');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [teamName, setTeamName] = useState('');
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setEmail(user?.email ?? '');
      setName((n) => n || user?.user_metadata.full_name || user?.user_metadata.name || '');
    });
  }, []);

  async function submit(fn: 'join_team' | 'create_team') {
    if (!name.trim()) return Alert.alert('Enter your name first');
    setBusy(true);
    try {
      const { error } =
        fn === 'join_team'
          ? await supabase.rpc(fn, { p_code: code, p_member_name: name })
          : await supabase.rpc(fn, { p_team_name: teamName, p_member_name: name });
      if (error) throw error;
      await reload();
    } catch (e) {
      Alert.alert('Could not continue', (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const joining = mode === 'join';

  return (
    <ScrollView
      contentContainerStyle={[styles.screen, { paddingTop: insets.top + 32, maxWidth: 520 }]}
      keyboardShouldPersistTaps="handled">
      <View style={{ gap: 12, marginBottom: 12 }}>
        <LogoMark tile={theme.primary} ink={theme.onPrimary} />
        <ThemedText type="subtitle" style={{ fontSize: 32, lineHeight: 38 }}>
          PassTheBill
        </ThemedText>
        <ThemedText themeColor="textSecondary">
          Split team lunch orders in seconds. Everyone taps what they ate, and the app works out who owes what.
        </ThemedText>
      </View>

      <ThemedText type="label" themeColor="textSecondary" style={styles.section}>
        Step 1 · About you
      </ThemedText>
      <Card>
        <Input
          label="Your name"
          placeholder="e.g. Ali Khan"
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
          hint="This is how your teammates will see you."
        />
      </Card>

      <ThemedText type="label" themeColor="textSecondary" style={styles.section}>
        Step 2 · Your team
      </ThemedText>
      <Segmented
        value={mode}
        onChange={setMode}
        options={[
          { value: 'join', label: 'I have a code' },
          { value: 'create', label: 'Start a new team' },
        ]}
      />

      <Card>
        {joining ? (
          <Input
            key="code"
            label="Team code"
            placeholder="e.g. A1B2C3"
            value={code}
            onChangeText={setCode}
            autoCapitalize="characters"
            autoCorrect={false}
            hint="Ask a teammate — it's shown at the top of their orders screen."
          />
        ) : (
          <Input
            key="team"
            label="Team name"
            placeholder="e.g. Design Team"
            value={teamName}
            onChangeText={setTeamName}
            hint="You'll get a code to share with your team."
          />
        )}
        <Button
          title={busy ? 'Please wait…' : joining ? 'Join team' : 'Create team'}
          icon={joining ? 'forward' : 'add'}
          disabled={busy || !(joining ? code : teamName).trim()}
          onPress={() => submit(joining ? 'join_team' : 'create_team')}
        />
      </Card>

      <Button
        title={email ? `Not ${email}? Switch account` : 'Switch account'}
        variant="ghost"
        small
        onPress={() => supabase.auth.signOut()}
      />
    </ScrollView>
  );
}
