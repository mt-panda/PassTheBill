import { useState } from 'react';
import { Alert, Button, ScrollView } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card, Input, styles } from '@/components/ui';
import { useSession } from '@/lib/session';
import { currentUserId, supabase } from '@/lib/supabase';

export default function JoinScreen() {
  const { reload } = useSession();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [teamName, setTeamName] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(fn: 'join_team' | 'create_team') {
    if (!name.trim()) return Alert.alert('Enter your name first');
    setBusy(true);
    try {
      await currentUserId();
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

  return (
    <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
      <ThemedText type="subtitle">Who are you?</ThemedText>
      <Input placeholder="Your name" value={name} onChangeText={setName} autoCapitalize="words" />

      <Card>
        <ThemedText type="smallBold">Join your team</ThemedText>
        <Input placeholder="Team code, e.g. A1B2C3" value={code} onChangeText={setCode} autoCapitalize="characters" />
        <Button title="Join" disabled={busy || !code.trim()} onPress={() => submit('join_team')} />
      </Card>

      <Card>
        <ThemedText type="smallBold">Or start a new team</ThemedText>
        <Input placeholder="Team name" value={teamName} onChangeText={setTeamName} />
        <Button title="Create team" disabled={busy || !teamName.trim()} onPress={() => submit('create_team')} />
      </Card>
    </ScrollView>
  );
}
