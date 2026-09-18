import { useState } from 'react';
import { Alert, Modal, Platform, Pressable, ScrollView, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Avatar, Button, Card, Input, Row, Segmented, styles } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';

type FeedbackType = 'bug' | 'suggestion';

export default function SettingsScreen() {
  const { member, themePref, setThemePref, reload } = useSession();
  const theme = useTheme();
  const me = member!;

  const [editNameOpen, setEditNameOpen] = useState(false);
  const [name, setName] = useState(me.name);
  const [savingName, setSavingName] = useState(false);

  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackType, setFeedbackType] = useState<FeedbackType>('bug');
  const [feedback, setFeedback] = useState('');
  const [savingFeedback, setSavingFeedback] = useState(false);

  const signOut = () =>
    Alert.alert('Sign out?', 'You can sign back in with Google any time.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => supabase.auth.signOut() },
    ]);

  function openEditName() {
    setName(me.name);
    setEditNameOpen(true);
  }

  async function saveName() {
    const nextName = name.trim();

    if (!nextName) return Alert.alert('Name required', 'Please enter your name.');
    if (nextName.length > 60) return Alert.alert('Name too long', 'Please keep your name under 60 characters.');

    setSavingName(true);
    const { error } = await supabase.from('members').update({ name: nextName }).eq('id', me.id);

    if (error) {
      setSavingName(false);
      return Alert.alert('Could not update name', error.message);
    }

    await reload();
    setSavingName(false);
    setEditNameOpen(false);
  }

  function openFeedback() {
    setFeedbackType('bug');
    setFeedback('');
    setFeedbackOpen(true);
  }

  async function saveFeedback() {
    const message = feedback.trim();

    if (!message) return Alert.alert('Message required', 'Please tell us what happened or what you would like to see.');
    if (message.length > 2000) return Alert.alert('Message too long', 'Please keep your feedback under 2000 characters.');

    setSavingFeedback(true);
    const { error } = await supabase.from('feedback').insert({
      user_id: me.id,
      team_id: me.team_id,
      type: feedbackType,
      message,
      platform: Platform.OS,
    });

    setSavingFeedback(false);

    if (error) return Alert.alert('Could not send feedback', error.message);

    setFeedbackOpen(false);
    setFeedback('');
    Alert.alert('Thanks!', 'Your feedback has been sent.');
  }

  return (
    <>
      <ScrollView contentContainerStyle={styles.screen} contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled">
        <Card>
          <Row style={{ justifyContent: 'flex-start' }}>
            <Avatar name={me.name} size={56} />
            <View style={{ flex: 1, gap: 3 }}>
              <ThemedText type="smallBold" style={{ fontSize: 18 }} numberOfLines={1}>
                {me.name}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                {me.teams.name} · code {me.teams.code}
              </ThemedText>
            </View>
            <Button title="Edit" icon="edit" variant="secondary" small onPress={openEditName} />
          </Row>
        </Card>

        {Platform.OS !== 'web' && (
          <>
            <ThemedText type="label" themeColor="textSecondary" style={styles.section}>
              Appearance
            </ThemedText>
            <Card>
              <Segmented
                value={themePref}
                onChange={setThemePref}
                options={[
                  { value: 'system', label: 'Auto', icon: 'phone' },
                  { value: 'light', label: 'Light', icon: 'sun' },
                  { value: 'dark', label: 'Dark', icon: 'moon' },
                ]}
              />
              <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 13 }}>
                {themePref === 'system' ? 'Auto matches your phone.' : `The app always uses the ${themePref} theme.`}
              </ThemedText>
            </Card>
          </>
        )}

        <ThemedText type="label" themeColor="textSecondary" style={styles.section}>
          Help & feedback
        </ThemedText>
        <Card>
          <View style={{ gap: 4, flex: 1 }}>
            <ThemedText type="smallBold" style={{ fontSize: 17 }}>
              Something to report?
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Report a bug or suggest an improvement for PassTheBill.
            </ThemedText>
          </View>
          <Button title="Send feedback" icon="info" variant="secondary" onPress={openFeedback} />
        </Card>

        <ThemedText type="label" themeColor="textSecondary" style={styles.section}>
          Account
        </ThemedText>
        <Button title="Sign out" icon="signOut" variant="danger" onPress={signOut} />
      </ScrollView>

      <Modal visible={editNameOpen} transparent animationType="slide" onRequestClose={() => !savingName && setEditNameOpen(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' }}>
          <View style={{ backgroundColor: theme.backgroundElement, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 32, gap: 16 }}>
            <ThemedText type="subtitle">Edit your name</ThemedText>
            <Input
              label="Name"
              value={name}
              onChangeText={setName}
              autoFocus
              maxLength={60}
              placeholder="Your name"
              returnKeyType="done"
              onSubmitEditing={saveName}
            />
            <Button title="Save name" icon="check" onPress={saveName} disabled={savingName} />
            <Button title="Cancel" variant="secondary" onPress={() => setEditNameOpen(false)} disabled={savingName} />
          </View>
        </View>
      </Modal>

      <Modal visible={feedbackOpen} transparent animationType="slide" onRequestClose={() => !savingFeedback && setFeedbackOpen(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' }}>
          <View style={{ backgroundColor: theme.backgroundElement, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 32, gap: 16 }}>
            <View style={{ gap: 4 }}>
              <ThemedText type="subtitle">Feedback</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Tell us about a problem or something you would like changed.
              </ThemedText>
            </View>

            <View style={{ gap: 8 }}>
              <ThemedText type="smallBold" style={{ fontSize: 14 }}>
                Type
              </ThemedText>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {(['bug', 'suggestion'] as FeedbackType[]).map((type) => {
                  const selected = feedbackType === type;
                  return (
                    <Pressable
                      key={type}
                      onPress={() => setFeedbackType(type)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      style={{
                        flex: 1,
                        minHeight: 48,
                        borderRadius: 14,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: selected ? theme.primary : theme.backgroundSelected,
                        borderWidth: 1,
                        borderColor: selected ? theme.primary : theme.border,
                      }}
                    >
                      <ThemedText type="smallBold" themeColor={selected ? 'onPrimary' : 'text'}>
                        {type === 'bug' ? 'Bug report' : 'Suggestion'}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <Input
              label={feedbackType === 'bug' ? 'What went wrong?' : 'What should we improve?'}
              value={feedback}
              onChangeText={setFeedback}
              multiline
              numberOfLines={5}
              maxLength={2000}
              textAlignVertical="top"
              placeholder={feedbackType === 'bug' ? 'Describe the problem and what you were doing when it happened.' : 'Tell us about the change or feature you would like.'}
              style={{ minHeight: 130 }}
            />

            <Button title={savingFeedback ? 'Sending...' : 'Send feedback'} icon="check" onPress={saveFeedback} disabled={savingFeedback} />
            <Button title="Cancel" variant="secondary" onPress={() => setFeedbackOpen(false)} disabled={savingFeedback} />
          </View>
        </View>
      </Modal>
    </>
  );
}
