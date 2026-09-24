import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Clipboard, Share, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import {
  Avatar,
  BottomSheet,
  Button,
  Card,
  Divider,
  EmptyState,
  ErrorState,
  Input,
  ListRow,
  Row,
  Screen,
  SectionHeader,
  Skeleton,
  StatusBadge,
  useToast,
} from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { friendlyError, reportError } from '@/lib/errors';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/ui';

type Mate = { id: string; name: string };
type Manage = null | { step: 'menu' } | { step: 'switch' | 'create'; value: string } | { step: 'confirm'; kind: 'switch' | 'create'; value: string } | { step: 'ready'; name: string; code: string };

export default function TeamScreen() {
  const router = useRouter();
  const toast = useToast();
  const { member, reload } = useSession();
  const me = member!;
  const [mates, setMates] = useState<Mate[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [manage, setManage] = useState<Manage>(null);
  const [blockers, setBlockers] = useState<{ text: string; go: () => void }[]>([]);
  const [busy, setBusy] = useState(false);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('members').select('id, name').eq('team_id', me.team_id).order('name');
    if (error) {
      reportError('team.load', error);
      return setLoadError(friendlyError(error).message);
    }
    setLoadError(null);
    setMates((data ?? []) as Mate[]);
  }, [me.team_id]);

  // members aren't in the realtime publication: refresh on focus and pull-to-refresh.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const invite = () => Share.share({ message: `Join "${me.teams.name}" on PassTheBill with code ${me.teams.code}` });
  const copy = (code: string, inSheet = false) => {
    Clipboard.setString(code);
    if (inSheet) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else toast.show('Copied');
  };

  async function openManage() {
    setSheetError(null);
    setManage({ step: 'menu' });
    // Client-side view of the server guard: open orders I created, or an unconfirmed review total.
    const [orders, cycle] = await Promise.all([
      supabase.from('orders').select('id, title').eq('created_by', me.id).eq('status', 'open'),
      supabase.from('billing_cycles').select('id').eq('status', 'open').maybeSingle(),
    ]);
    const list: { text: string; go: () => void }[] = (orders.data ?? []).map((o) => ({
      text: `Close your open lunch${o.title ? ` at ${o.title}` : ''}`,
      go: () => {
        setManage(null);
        router.push({ pathname: '/order/[id]', params: { id: o.id } });
      },
    }));
    if (cycle.data) {
      const { data: row } = await supabase
        .from('billing_cycle_member_totals')
        .select('grand_total, confirmed_at')
        .eq('cycle_id', cycle.data.id)
        .eq('member_id', me.id)
        .maybeSingle();
      if (row && Number(row.grand_total) > 0 && !row.confirmed_at) {
        list.push({
          text: 'Confirm your review total',
          go: () => {
            setManage(null);
            router.navigate('/totals');
          },
        });
      }
    }
    setBlockers(list);
  }

  async function submit(kind: 'switch' | 'create', value: string) {
    setBusy(true);
    const { data, error } =
      kind === 'switch'
        ? await supabase.rpc('join_team', { p_code: value, p_member_name: me.name })
        : await supabase.rpc('create_team', { p_team_name: value, p_member_name: me.name });
    setBusy(false);
    if (error) {
      reportError('team.manage', error);
      return setSheetError(friendlyError(error).message);
    }
    const team = data as { name: string; code: string };
    if (kind === 'create') return setManage({ step: 'ready', name: team.name, code: team.code });
    setManage(null);
    await reload();
    toast.show(`You’re now in ${team.name}`);
  }

  const step = manage?.step;
  const sorted = mates ? [...mates].sort((a, b) => (a.id === me.id ? -1 : b.id === me.id ? 1 : a.name.localeCompare(b.name))) : null;

  return (
    <Screen onRefresh={load} refreshing={false}>
      <ThemedText type="screenTitle">Your Team</ThemedText>

      <Card>
        <Row style={{ justifyContent: 'flex-start' }}>
          <ThemedText style={{ fontSize: 28 }}>👥</ThemedText>
          <View style={{ flexShrink: 1 }}>
            <ThemedText type="sectionTitle">{mates ? `${mates.length} ${mates.length === 1 ? 'person' : 'people'}` : ' '}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
              {me.teams.name}
            </ThemedText>
          </View>
        </Row>
      </Card>

      <Card tone="mint">
        <ThemedText type="caption" themeColor="primaryText">
          Team code
        </ThemedText>
        <ThemedText type="teamCode" selectable accessibilityLabel={`Team code ${me.teams.code.split('').join(' ')}`}>
          {me.teams.code}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Share this code with someone joining the team.
        </ThemedText>
        <Button title="Copy" icon="copy" variant="secondary" onPress={() => copy(me.teams.code)} />
      </Card>
      <Button title="Invite someone" icon="invite" variant="secondary" onPress={invite} />

      <SectionHeader title="Members" />
      {loadError ? (
        <ErrorState message={loadError} onRetry={load} />
      ) : !sorted ? (
        <>
          <Skeleton.Row />
          <Skeleton.Row />
        </>
      ) : sorted.length === 0 ? (
        <EmptyState icon="people" title="No team members" text="Invite someone to get started." action={{ label: 'Invite someone', onPress: invite }} />
      ) : (
        <Card style={{ gap: 0, paddingVertical: Spacing.xs }}>
          {sorted.map((m, i) => (
            <View key={m.id}>
              {i > 0 && <Divider />}
              <ListRow leading={<Avatar name={m.name} />} title={m.name} trailing={m.id === me.id ? <StatusBadge status="open" label="You" /> : undefined} />
            </View>
          ))}
        </Card>
      )}

      <Button title="Manage team" variant="ghost" icon="settings" onPress={openManage} />

      <BottomSheet
        visible={!!manage}
        onClose={() => setManage(null)}
        onBack={
          step === 'switch' || step === 'create' || step === 'confirm'
            ? () => {
                setSheetError(null);
                setManage(manage?.step === 'confirm' ? { step: manage.kind, value: manage.value } : { step: 'menu' });
              }
            : undefined
        }
        title={
          step === 'switch' ? 'Switch team' : step === 'create' ? 'Start a new team' : step === 'confirm' ? 'Are you sure?' : step === 'ready' ? 'Team ready' : 'Manage team'
        }
        dismissible={!busy && step !== 'ready'}
        error={sheetError}
        footer={
          manage?.step === 'switch' || manage?.step === 'create' ? (
            <Button
              title="Continue"
              disabled={!manage.value.trim()}
              onPress={() => setManage({ step: 'confirm', kind: manage.step as 'switch' | 'create', value: manage.step === 'switch' ? manage.value.trim().toUpperCase() : manage.value.trim() })}
            />
          ) : manage?.step === 'confirm' ? (
            <Button title={manage.kind === 'switch' ? 'Switch team' : 'Start team'} loading={busy} onPress={() => submit(manage.kind, manage.value)} />
          ) : manage?.step === 'ready' ? (
            <Button
              title="Continue"
              onPress={async () => {
                setManage(null);
                await reload();
              }}
            />
          ) : undefined
        }>
        {step === 'menu' &&
          (blockers.length ? (
            <>
              <ThemedText type="body">Before you switch or start a team:</ThemedText>
              {blockers.map((b) => (
                <ListRow key={b.text} title={b.text} chevron onPress={b.go} />
              ))}
            </>
          ) : (
            <>
              <ListRow title="Switch team" subtitle="Join another team with its code" chevron onPress={() => setManage({ step: 'switch', value: '' })} />
              <ListRow title="Start a new team" subtitle="You’ll leave this team" chevron onPress={() => setManage({ step: 'create', value: '' })} />
            </>
          ))}
        {manage?.step === 'switch' && (
          <Input
            label="Team code"
            value={manage.value}
            onChangeText={(v) => setManage({ step: 'switch', value: v })}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={6}
            autoFocus
            placeholder="ABC123"
          />
        )}
        {manage?.step === 'create' && (
          <Input label="Team name" value={manage.value} onChangeText={(v) => setManage({ step: 'create', value: v })} maxLength={60} autoFocus />
        )}
        {manage?.step === 'confirm' && (
          <ThemedText type="body">
            {manage.kind === 'switch'
              ? `Leave ${me.teams.name} and join team ${manage.value}?`
              : `Leave ${me.teams.name} and start ${manage.value}?`}
          </ThemedText>
        )}
        {manage?.step === 'ready' && (
          <>
            <ThemedText type="sectionTitle">{manage.name} is ready</ThemedText>
            <ThemedText type="teamCode">{manage.code}</ThemedText>
            <Row>
              <Button title={copied ? 'Copied ✓' : 'Copy'} variant="secondary" onPress={() => copy(manage.code, true)} style={{ flex: 1 }} />
              <Button
                title="Share"
                variant="secondary"
                onPress={() => Share.share({ message: `Join "${manage.name}" on PassTheBill with code ${manage.code}` })}
                style={{ flex: 1 }}
              />
            </Row>
          </>
        )}
      </BottomSheet>
    </Screen>
  );
}
