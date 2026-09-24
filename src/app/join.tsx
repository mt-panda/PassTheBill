import { useEffect, useState } from 'react';
import { Clipboard, Share, View } from 'react-native';

import { LogoMark } from '@/components/splash';
import { ThemedText } from '@/components/themed-text';
import { BottomSheet, Button, Card, Input, Row, Screen } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { friendlyError, reportError } from '@/lib/errors';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/ui';

export default function JoinScreen() {
  const { reload } = useSession();
  const theme = useTheme();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [prefilling, setPrefilling] = useState(true);
  const [code, setCode] = useState('');
  const [teamName, setTeamName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [ready, setReady] = useState<{ name: string; code: string } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setEmail(user?.email ?? '');
      setName((n) => n || user?.user_metadata.full_name || user?.user_metadata.name || '');
      setPrefilling(false);
    });
  }, []);

  async function submit() {
    if (!name.trim()) return setError('Enter your name first.');
    setBusy(true);
    setError(null);
    const { data, error: e } = creating
      ? await supabase.rpc('create_team', { p_team_name: teamName, p_member_name: name })
      : await supabase.rpc('join_team', { p_code: code, p_member_name: name });
    if (e) {
      setBusy(false);
      reportError('join', e);
      return setError(friendlyError(e).message);
    }
    if (creating) {
      // reload() would set the member and unmount this screen (and the sheet) — wait for Continue.
      setBusy(false);
      const t = data as { name: string; code: string };
      return setReady({ name: t.name, code: t.code });
    }
    await reload();
  }

  const value = creating ? teamName : code;

  return (
    <Screen keyboard contentStyle={{ maxWidth: 520 }}>
      <View style={{ gap: Spacing.md, marginTop: Spacing.xl }}>
        <LogoMark tile={theme.primary} ink={theme.onPrimary} />
        <ThemedText type="screenTitle">{creating ? 'Start a new team' : 'Join a team'}</ThemedText>
      </View>

      <Card>
        <Input
          label="Your name"
          placeholder={prefilling ? 'Loading…' : 'e.g. Ali Khan'}
          value={name}
          onChangeText={(v) => { setName(v); setError(null); }}
          autoCapitalize="words"
          maxLength={60}
          hint="This is how your teammates will see you."
        />
        {creating ? (
          <Input key="team" label="Team name" placeholder="e.g. Design Team" value={teamName} onChangeText={(v) => { setTeamName(v); setError(null); }} maxLength={60} />
        ) : (
          <Input
            key="code"
            label="Enter your team code"
            placeholder="ABC123"
            value={code}
            onChangeText={(v) => { setCode(v); setError(null); }}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={6}
            inputStyle={{ fontSize: 22, letterSpacing: 3 }}
            hint="Ask a teammate. It’s on their Team tab."
          />
        )}
        {error && (
          <ThemedText type="small" themeColor="danger" accessibilityLiveRegion="polite">
            {error}
          </ThemedText>
        )}
        <Button title={creating ? 'Create team' : 'Join team'} loading={busy} disabled={!value.trim()} onPress={submit} />
      </Card>

      <Button
        title={creating ? 'I have a team code' : 'or Start a new team'}
        variant="ghost"
        onPress={() => {
          setError(null);
          setCreating((c) => !c);
        }}
      />
      <Button title={email ? `Not ${email}? Switch account` : 'Switch account'} variant="ghost" size="sm" onPress={() => supabase.auth.signOut()} />

      <BottomSheet
        visible={!!ready}
        onClose={() => {}}
        dismissible={false}
        title="Your team is ready"
        footer={<Button title="Continue" onPress={() => void reload()} />}>
        {ready && (
          <>
            <ThemedText type="sectionTitle">{ready.name}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Share this code so teammates can join.
            </ThemedText>
            <ThemedText type="teamCode">{ready.code}</ThemedText>
            <Row>
              <Button
                title={copied ? 'Copied ✓' : 'Copy'}
                variant="secondary"
                onPress={() => {
                  Clipboard.setString(ready.code);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                style={{ flex: 1 }}
              />
              <Button
                title="Share"
                variant="secondary"
                onPress={() => Share.share({ message: `Join "${ready.name}" on PassTheBill with code ${ready.code}` })}
                style={{ flex: 1 }}
              />
            </Row>
          </>
        )}
      </BottomSheet>
    </Screen>
  );
}
