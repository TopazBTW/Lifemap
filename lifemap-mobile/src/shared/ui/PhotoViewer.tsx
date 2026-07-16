import { Image } from 'expo-image';
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

/**
 * Fullscreen, swipeable photo viewer. `index` null = closed. Tap anywhere or
 * the ✕ to dismiss; swipe horizontally between photos.
 */
export function PhotoViewer({
  photos,
  index,
  onClose,
}: {
  photos: string[];
  index: number | null;
  onClose: () => void;
}) {
  const { width, height } = useWindowDimensions();
  if (index === null) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          contentOffset={{ x: index * width, y: 0 }}
        >
          {photos.map((uri, i) => (
            <Pressable
              key={i}
              onPress={onClose}
              style={{ width, height, justifyContent: 'center' }}
            >
              <Image
                source={{ uri }}
                style={{ width, height }}
                contentFit="contain"
              />
            </Pressable>
          ))}
        </ScrollView>
        <Pressable
          onPress={onClose}
          hitSlop={12}
          style={{ position: 'absolute', top: 56, right: 22 }}
        >
          <Text style={{ color: '#fff', fontSize: 30 }}>✕</Text>
        </Pressable>
      </View>
    </Modal>
  );
}
