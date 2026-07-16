import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';

import { useImportReel, useReels } from '@/features/reels/useReels';
import type { Reel, ReelStatus } from '@/shared/types/domain';
import { Button, EmptyState, Glass, Input, Screen } from '@/shared/ui';

const STATUS_BADGE: Record<ReelStatus, { label: string; className: string }> = {
  pending: { label: 'Queued', className: 'bg-white/10 text-white/60' },
  extracting: { label: 'Extracting…', className: 'bg-horizon-500/25 text-horizon-300' },
  needs_review: { label: 'Review places', className: 'bg-planned/25 text-planned' },
  ready: { label: 'On your map', className: 'bg-visited/25 text-visited' },
  failed: { label: 'Failed', className: 'bg-red-500/20 text-red-400' },
};

const PLATFORM_ICON: Record<string, string> = {
  instagram: '📷',
  tiktok: '🎵',
  youtube: '▶️',
  unknown: '🔗',
};

export default function ReelsScreen() {
  const { data: reels = [], isLoading } = useReels();
  const importReel = useImportReel();
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    setError(null);
    importReel.mutate(url, {
      onSuccess: () => setUrl(''),
      onError: (err) => setError(err instanceof Error ? err.message : 'Import failed.'),
    });
  };

  return (
    <Screen>
      <View className="gap-4 pb-4 pt-2">
        <Text className="text-3xl font-bold text-white">Reel to Reality</Text>
        <Glass>
          <View className="gap-3 p-4">
            <Input
              placeholder="Paste an Instagram, TikTok or YouTube link"
              value={url}
              onChangeText={setUrl}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              error={error}
            />
            <Button
              title="Extract places with AI"
              onPress={submit}
              loading={importReel.isPending}
              disabled={!url.trim()}
            />
          </View>
        </Glass>
      </View>

      <FlatList
        data={reels}
        keyExtractor={(r) => r.id}
        contentContainerClassName="gap-3 pb-32"
        renderItem={({ item }) => <ReelCard reel={item} />}
        ListEmptyComponent={
          isLoading ? null : (
            <EmptyState
              emoji="🎬"
              title="No reels yet"
              body="Paste a travel reel above and AI will pull out every hotel, restaurant and beach onto your map."
            />
          )
        }
      />
    </Screen>
  );
}

function ReelCard({ reel }: { reel: Reel }) {
  const badge = STATUS_BADGE[reel.status];
  const tappable = reel.status === 'needs_review' || reel.status === 'failed';

  return (
    <Pressable
      disabled={!tappable}
      onPress={() => router.push({ pathname: '/reel/[id]', params: { id: reel.id } })}
    >
      <Glass>
        <View className="flex-row items-center gap-3 p-4">
          {reel.thumbnailUrl ? (
            <Image
              source={{ uri: reel.thumbnailUrl }}
              style={{ width: 56, height: 56, borderRadius: 12 }}
              contentFit="cover"
            />
          ) : (
            <View className="h-14 w-14 items-center justify-center rounded-xl bg-white/10">
              <Text className="text-2xl">{PLATFORM_ICON[reel.platform]}</Text>
            </View>
          )}
          <View className="flex-1 gap-1">
            <Text className="text-sm font-semibold text-white" numberOfLines={1}>
              {reel.title ?? reel.url}
            </Text>
            <Text className="text-xs text-white/40" numberOfLines={1}>
              {reel.authorHandle ?? reel.platform}
              {reel.placeIds?.length ? ` · ${reel.placeIds.length} places` : ''}
            </Text>
          </View>
          <Text
            className={`overflow-hidden rounded-pill px-2.5 py-1 text-[11px] font-semibold ${badge.className}`}
          >
            {badge.label}
          </Text>
        </View>
      </Glass>
    </Pressable>
  );
}
