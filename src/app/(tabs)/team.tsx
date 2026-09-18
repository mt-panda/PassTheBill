import { useState } from 'react';
import { Alert, ScrollView, Share, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Avatar, Button, Card, Input, Row, Segmented, styles } from '@/components/ui';
import { Fonts } from '@/constants/theme';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';

export default function TeamScreen() {
  const { member, reload } = useSession();
  const me = member!;
  const [mode, setMode] = useState<'join' | 'create'>('join');
  const [code, setCode] = useState('');
  const [teamName, setTeamName] = useState('');
  const [busy, setBusy] = useState(false);

  const share = () => Share.share({ message: `Join "${me.teams.name}" on PassTheBill with code ${me.teams.code}` });

  async function submit() {
    setBusy(true);
    try {
      const { error } =
        mode === 'join'
          ? await supabase.rpc('join_team', { p_code: code, p_member_name: me.name })
          : await supabase.rpc('create_team', { p_team_name: teamName, p_member_name: me.name });
      if (error) throw error;
      setCode('');
      setTeamName('');
      await reload();
      Alert.alert(mode === 'join' ? 'Team switched' : 'Team created');
    } catch (e) {
      Alert.alert('Could not update team', (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const joining = mode === 'join';
  const disabled = busy || !(joining ? code : teamName).trim();

  return (
    <ScrollView contentContainerStyle={styles.screen} contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled">
      <Card>
        <Row style={{ justifyContent: 'flex-start' }}>
          <Avatar name={me.name} size={56} />
          <View style={{ flexShrink: 1, gap: 2 }}>
            <ThemedText type="smallBold" style={{ fontSize: 18 }} numberOfLines={1}>
              {me.teams.name}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
              {me.name}
            </ThemedText>
          </View>
        </Row>
      </Card>

      <ThemedText type="label" themeColor="textSecondary" style={styles.section}>
        Invite your team
      </ThemedText>
      <Card>
        <Row>
          <View style={{ gap: 4, flexShrink: 1 }}>
            <ThemedText selectable style={{ fontFamily: Fonts.mono, fontSize: 24, lineHeight: 30, fontWeight: '700', letterSpacing: 3 }}>
              {me.teams.code}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Teammates enter this code to join and claim their food.
            </ThemedText>
          </View>
          <Button title="Share" icon="share" variant="secondary" small onPress={share} />
        </Row>
      </Card>

      <ThemedText type="label" themeColor="textSecondary" style={styles.section}>
        Switch team
      </ThemedText>
      <Segmented
        value={mode}
        onChange={setMode}
        options={[
          { value: 'join', label: 'Team code', icon: 'people' },
          { value: 'create', label: 'New team', icon: 'add' },
        ]}
      />
      <Card>
        {joining ? (
          <Input
            label="Team code"
            placeholder="e.g. A1B2C3"
            value={code}
            onChangeText={setCode}
            autoCapitalize="characters"
            autoCorrect={false}
          />
        ) : (
          <Input label="Team name" placeholder="e.g. Design Team" value={teamName} onChangeText={setTeamName} />
        )}
        <Button
          title={busy ? 'Please wait...' : joining ? 'Switch team' : 'Start new team'}
          icon={joining ? 'forward' : 'add'}
          disabled={disabled}
          onPress={submit}
        />
      </Card>
    </ScrollView>
  );
}
