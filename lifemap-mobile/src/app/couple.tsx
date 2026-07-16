import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, Share, Text, View } from 'react-native';

import {
  addBucketItem,
  createSpace,
  deleteBucketItem,
  joinSpace,
  setMapSharing,
  toggleBucketItem,
  useBucketList,
  useMySpace,
  useShareTarget,
} from '@/features/couple/useSharedSpace';
import { auth } from '@/shared/lib/firebase';
import type { BucketListItem, SharedSpace } from '@/shared/types/domain';
import { Button, Glass, Input, Screen } from '@/shared/ui';

export default function CoupleScreen() {
  const { space } = useMySpace();

  return (
    <Screen>
      <View className="flex-row items-center justify-between pb-4 pt-2">
        <Text className="text-2xl font-bold text-white">Shared space</Text>
        <Button title="✕ Close" variant="ghost" size="sm" onPress={() => router.back()} />
      </View>
      {space ? <SpaceView space={space} /> : <NoSpaceView />}
    </Screen>
  );
}

// ─── No space yet ─────────────────────────────────────────────────────────────

function NoSpaceView() {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<null | 'create' | 'join'>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (kind: 'create' | 'join', fn: () => Promise<void>) => {
    setBusy(kind);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <View className="gap-6 pt-4">
      <Text className="text-sm leading-5 text-white/55">
        Share a map, memories and a travel bucket list with your partner. Create a
        space and send them the code — or enter theirs to join.
      </Text>

      <Glass>
        <View className="gap-3 p-4">
          <Text className="text-base font-semibold text-white">Create a space</Text>
          <Input placeholder="Name it (e.g. “Sarah & Me”)" value={name} onChangeText={setName} />
          <Button
            title="Create shared space"
            loading={busy === 'create'}
            onPress={() => run('create', () => createSpace(name))}
          />
        </View>
      </Glass>

      <Glass>
        <View className="gap-3 p-4">
          <Text className="text-base font-semibold text-white">Join with a code</Text>
          <Input
            placeholder="6-character code"
            value={code}
            onChangeText={setCode}
            autoCapitalize="characters"
            autoCorrect={false}
          />
          <Button
            title="Join space"
            variant="ghost"
            loading={busy === 'join'}
            disabled={code.trim().length < 6}
            onPress={() => run('join', () => joinSpace(code))}
          />
        </View>
      </Glass>

      {error ? <Text className="text-sm text-red-400">{error}</Text> : null}
    </View>
  );
}

// ─── In a space ───────────────────────────────────────────────────────────────

function SpaceView({ space }: { space: SharedSpace }) {
  const { data: items = [] } = useBucketList(space.id);
  const [title, setTitle] = useState('');
  const myUid = auth.currentUser?.uid;

  const authorLabel = (uid: string) => {
    if (uid === myUid) return 'You';
    return space.memberNames?.[uid] ?? 'Partner';
  };

  return (
    <FlatList
      data={items}
      keyExtractor={(i) => i.id}
      contentContainerClassName="gap-3 pb-12"
      ListHeaderComponent={
        <View className="gap-4 pb-2">
          <Glass>
            <View className="gap-2 p-4">
              <Text className="text-lg font-semibold text-white">{space.name}</Text>
              <Text className="text-xs text-white/50">
                {space.memberIds.length} {space.memberIds.length === 1 ? 'member' : 'members'}
                {space.memberIds.length === 1 ? ' · waiting for your partner' : ''}
              </Text>
              {space.inviteCode ? (
                <Pressable
                  onPress={() =>
                    Share.share({
                      message: `Join our LifeMap space with code ${space.inviteCode}`,
                    })
                  }
                  className="mt-1 flex-row items-center justify-between rounded-xl bg-white/5 px-4 py-3"
                >
                  <View>
                    <Text className="text-[11px] uppercase tracking-wider text-white/40">
                      Invite code
                    </Text>
                    <Text className="text-xl font-bold tracking-[4px] text-horizon-300">
                      {space.inviteCode}
                    </Text>
                  </View>
                  <Text className="text-sm text-horizon-300">Share ↗</Text>
                </Pressable>
              ) : null}
            </View>
          </Glass>

          <ShareMapToggle spaceId={space.id} />

          <Text className="pt-2 text-xs font-semibold uppercase tracking-widest text-white/40">
            Bucket list
          </Text>
          <Glass>
            <View className="flex-row items-center gap-2 p-3">
              <View className="flex-1">
                <Input
                  placeholder="Add a place or plan…"
                  value={title}
                  onChangeText={setTitle}
                />
              </View>
              <Button
                title="Add"
                size="sm"
                disabled={!title.trim()}
                onPress={() => {
                  addBucketItem(space.id, title);
                  setTitle('');
                }}
              />
            </View>
          </Glass>
        </View>
      }
      renderItem={({ item }) => (
        <BucketRow
          item={item}
          author={authorLabel(item.createdBy)}
          mine={item.createdBy === myUid}
        />
      )}
      ListEmptyComponent={
        <Text className="px-2 pt-4 text-center text-sm text-white/40">
          Nothing on your list yet. Add somewhere you both want to go.
        </Text>
      }
    />
  );
}

function ShareMapToggle({ spaceId }: { spaceId: string }) {
  const shareTarget = useShareTarget();
  const on = shareTarget === spaceId;
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    setBusy(true);
    try {
      await setMapSharing(spaceId, !on);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Glass>
      <Pressable onPress={toggle} disabled={busy} className="flex-row items-center gap-3 p-4">
        <Text className="text-2xl">🗺️</Text>
        <View className="flex-1">
          <Text className="text-base font-semibold text-white">Share my map</Text>
          <Text className="text-xs text-white/45">
            {busy
              ? 'Updating…'
              : on
                ? 'Your places & memories show on your partner’s map'
                : 'Keep your places & memories private'}
          </Text>
        </View>
        <View
          className={`h-7 w-12 justify-center rounded-full px-0.5 ${
            on ? 'bg-horizon-500' : 'bg-white/15'
          }`}
        >
          <View className={`h-6 w-6 rounded-full bg-white ${on ? 'self-end' : 'self-start'}`} />
        </View>
      </Pressable>
    </Glass>
  );
}

function BucketRow({
  item,
  author,
  mine,
}: {
  item: BucketListItem;
  author: string;
  mine: boolean;
}) {
  return (
    <Pressable
      onPress={() => toggleBucketItem(item.id, !item.done)}
      onLongPress={() => deleteBucketItem(item.id)}
    >
      <Glass>
        <View className="flex-row items-center gap-3 p-4">
          <View
            className={`h-6 w-6 items-center justify-center rounded-full border-2 ${
              item.done ? 'border-visited bg-visited' : 'border-white/25'
            }`}
          >
            {item.done ? <Text className="text-xs text-white">✓</Text> : null}
          </View>
          <View className="flex-1 gap-0.5">
            <Text
              className={`text-base ${
                item.done ? 'text-white/40 line-through' : 'text-white'
              }`}
            >
              {item.title}
            </Text>
            {/* Attribution chip — who added this. */}
            <View className="flex-row">
              <View
                className={`rounded-pill px-2 py-0.5 ${
                  mine ? 'bg-horizon-500/25' : 'bg-white/10'
                }`}
              >
                <Text
                  className={`text-[10px] font-medium ${
                    mine ? 'text-horizon-300' : 'text-white/55'
                  }`}
                >
                  {mine ? '● ' : '○ '}
                  {author}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </Glass>
    </Pressable>
  );
}
