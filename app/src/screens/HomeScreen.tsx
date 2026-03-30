import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Dimensions,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useNavigation } from '@react-navigation/native';
import { menuApi } from '../api';
import { MainTabNavigationProp, MenuItem } from '../types';
import { useAuthStore } from '../stores/authStore';

const { width } = Dimensions.get('window');

const categories = [
  { name: 'All', icon: '🍽️' },
  { name: 'meals', icon: '🍛' },
  { name: 'snacks', icon: '🍟' },
  { name: 'beverages', icon: '☕' },
  { name: 'desserts', icon: '🍰' },
];

export default function HomeScreen() {
  const navigation = useNavigation<MainTabNavigationProp<'Home'>>();
  const { user } = useAuthStore();
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMenu();
  }, []);

  const fetchMenu = async () => {
    try {
      const response = await menuApi.getMenu();
      setMenuItems(response.data);
    } catch (error) {
      console.error('Failed to fetch menu:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = selectedCategory === 'All'
    ? menuItems
    : menuItems.filter(item => item.category === selectedCategory);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const renderItem = ({ item }: { item: MenuItem }) => (
    <TouchableOpacity
      style={styles.foodCard}
      onPress={() => navigation.navigate('ItemDetail', { item })}
    >
      <Image source={{ uri: item.imageUrl }} style={styles.foodImage} />
      <View style={styles.foodInfo}>
        <Text style={styles.foodName} numberOfLines={2}>{item.name}</Text>
        <Text style={styles.foodCalories}>{item.calories} cal</Text>
        <View style={styles.foodFooter}>
          <Text style={styles.foodPrice}>₹{item.price}</Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => navigation.navigate('ItemDetail', { item })}
          >
            <Text style={styles.addButtonText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{getGreeting()},</Text>
          <Text style={styles.name}>{user?.name || 'Student'}</Text>
        </View>
        <View style={styles.logoContainer}>
          <Text style={styles.logoText}>DSCE</Text>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoryScroll}
        contentContainerStyle={styles.categoryContainer}
      >
        {categories.map((cat) => (
          <TouchableOpacity
            key={cat.name}
            style={[styles.categoryChip, selectedCategory === cat.name && styles.activeChip]}
            onPress={() => setSelectedCategory(cat.name)}
          >
            <Text style={styles.categoryIcon}>{cat.icon}</Text>
            <Text style={[styles.categoryText, selectedCategory === cat.name && styles.activeCategoryText]}>
              {cat.name === 'All' ? cat.name : cat.name.charAt(0).toUpperCase() + cat.name.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <FlashList
        data={filteredItems}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        numColumns={2}
        contentContainerStyle={styles.listContainer}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0f1e',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 60,
  },
  greeting: {
    fontSize: 14,
    color: '#8892a4',
  },
  name: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
  },
  logoContainer: {
    backgroundColor: '#f97316',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  logoText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  categoryScroll: {
    maxHeight: 60,
  },
  categoryContainer: {
    paddingHorizontal: 16,
    gap: 8,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141929',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  activeChip: {
    backgroundColor: '#f97316',
  },
  categoryIcon: {
    fontSize: 16,
  },
  categoryText: {
    color: '#8892a4',
    fontWeight: '600',
  },
  activeCategoryText: {
    color: '#ffffff',
  },
  listContainer: {
    padding: 8,
  },
  foodCard: {
    flex: 1,
    backgroundColor: '#141929',
    borderRadius: 16,
    margin: 8,
    overflow: 'hidden',
  },
  foodImage: {
    width: '100%',
    height: 120,
    backgroundColor: '#1a2035',
  },
  foodInfo: {
    padding: 12,
  },
  foodName: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
    marginBottom: 4,
  },
  foodCalories: {
    color: '#8892a4',
    fontSize: 12,
    marginBottom: 8,
  },
  foodFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  foodPrice: {
    color: '#f97316',
    fontWeight: '700',
    fontSize: 16,
  },
  addButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f97316',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 24,
  },
});
