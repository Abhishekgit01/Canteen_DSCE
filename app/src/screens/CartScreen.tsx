import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Switch,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { menuApi, orderApi, pickupSettingsApi, rushHoursApi } from '../api';
import AppIcon from '../components/AppIcon';
import FoodCard from '../components/FoodCard';
import PickupTimePanel from '../components/PickupTimePanel';
import { DEFAULT_COLLEGE, getCanteenName, normalizeCollege } from '../constants/colleges';
import { useAuthStore } from '../stores/authStore';
import { useCanteenStore } from '../stores/canteenStore';
import { useCartStore } from '../stores/cartStore';
import { MainTabNavigationProp, MenuItem } from '../types';
import { palette, shadows } from '../theme';
import { getMenuItemId } from '../utils/menu';
import {
  formatPickupTime,
  getDefaultPickupTime,
} from '../utils/pickupTime';

function getErrorMessage(error: any) {
  return error?.response?.data?.error || 'Could not create your order. Please try again.';
}

export default function CartScreen() {
  const navigation = useNavigation<MainTabNavigationProp<'Cart'>>();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const userCollege = user?.college;
  const resolvedCollege = normalizeCollege(userCollege) || DEFAULT_COLLEGE;
  const { items, addItem, updateChefNote, updateQuantity, setScheduledTime, total } =
    useCartStore();
  const pickupSettings = useCanteenStore(
    (state) => state.pickupSettingsByCollege[resolvedCollege] || null,
  );
  const rushHourStatus = useCanteenStore(
    (state) => state.rushStatusByCollege[resolvedCollege] || null,
  );
  const setPickupSettings = useCanteenStore((state) => state.setPickupSettings);
  const setRushStatus = useCanteenStore((state) => state.setRushStatus);
  const [suggestedItems, setSuggestedItems] = useState<MenuItem[]>([]);
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});
  const [selectedPickupTime, setSelectedPickupTime] = useState(
    items[0]?.scheduledTime || getDefaultPickupTime(new Date(), userCollege),
  );

  const [isPreOrder, setIsPreOrder] = useState(false);
  const [scheduledFor, setScheduledFor] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [preOrderNote, setPreOrderNote] = useState('');

  useEffect(() => {
    if (pickupSettings && rushHourStatus) {
      return;
    }

    let cancelled = false;

    const loadRuntime = async () => {
      const [pickupResult, rushResult] = await Promise.allSettled([
        pickupSettingsApi.getSettings(userCollege),
        rushHoursApi.getStatus(userCollege),
      ]);

      if (cancelled) {
        return;
      }

      if (pickupResult.status === 'fulfilled') {
        setPickupSettings(pickupResult.value.data);
      }

      if (rushResult.status === 'fulfilled') {
        setRushStatus(userCollege, rushResult.value.data);
      }
    };

    void loadRuntime();

    return () => {
      cancelled = true;
    };
  }, [pickupSettings, rushHourStatus, setPickupSettings, setRushStatus, userCollege]);

  useEffect(() => {
    const loadSuggestions = async () => {
      try {
        const response = await menuApi.getMenu({ college: userCollege });
        const cartItemIds = new Set(items.map((item) => item.menuItem.id));
        setSuggestedItems(response.data.filter((item: MenuItem) => !cartItemIds.has(item.id)).slice(0, 6));
      } catch (error) {
        console.error('Failed to load suggestions:', error);
      }
    };

    void loadSuggestions();
  }, [items, userCollege]);

  useEffect(() => {
    const currentPickupTime = items[0]?.scheduledTime || getDefaultPickupTime(new Date(), userCollege);
    setSelectedPickupTime(currentPickupTime);
  }, [items, userCollege]);

  useEffect(() => {
    setExpandedNotes((current) => {
      const next: Record<string, boolean> = {};

      items.forEach((item) => {
        next[item.menuItem.id] = current[item.menuItem.id] || Boolean(item.chefNote);
      });

      return next;
    });
  }, [items]);

  const subtotal = total();
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const canteenName = getCanteenName(user?.college);
  const estimatedMinutes = useMemo(() => {
    if (!pickupSettings) {
      return null;
    }

    let minutes =
      pickupSettings.basePickupMinutes + pickupSettings.perItemExtra * totalItems;

    if (rushHourStatus?.isRushHour) {
      minutes += pickupSettings.rushHourExtra;
    }

    return Math.min(minutes, pickupSettings.maxPickupMinutes);
  }, [pickupSettings, rushHourStatus?.isRushHour, totalItems]);
  const estimatedPickupAt = estimatedMinutes
    ? new Date(Date.now() + estimatedMinutes * 60 * 1000)
    : null;

  const handleCreateOrder = async () => {
    if (items.length === 0 || isCreatingOrder) {
      return;
    }

    if (isPreOrder && !scheduledFor) {
      setErrorMessage('Please completely select a date and time for your pre-order.');
      return;
    }

    setIsCreatingOrder(true);
    setErrorMessage('');

    try {
      const orderItems = items
        .map((item) => ({
          menuItemId: getMenuItemId(item.menuItem),
          quantity: item.quantity,
          tempPreference: item.tempPreference,
          chefNote: item.chefNote,
        }))
        .filter((item) => item.menuItemId && item.quantity > 0);

      if (orderItems.length !== items.length) {
        setErrorMessage('Some cart items were outdated. Please add them again and retry checkout.');
        setIsCreatingOrder(false);
        return;
      }

      const response = await orderApi.createOrder({
        items: orderItems,
        scheduledTime: selectedPickupTime,
        scheduledFor: isPreOrder && scheduledFor ? scheduledFor.toISOString() : undefined,
        preOrderNote: isPreOrder ? preOrderNote : undefined,
      });

      navigation.navigate('Payment', response.data);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsCreatingOrder(false);
    }
  };

  const handleAddSuggestedItem = async (item: MenuItem) => {
    const existingItem = items.find((entry) => entry.menuItem.id === item.id);
    const nextQuantity = (existingItem?.quantity || 0) + 1;

    await addItem({
      menuItem: item,
      quantity: nextQuantity,
      tempPreference: existingItem?.tempPreference || item.tempOptions[0] || 'normal',
      scheduledTime:
        existingItem?.scheduledTime ||
        selectedPickupTime ||
        getDefaultPickupTime(new Date(), userCollege),
      chefNote: existingItem?.chefNote || '',
    });
  };

  const handlePickupTimeChange = async (time: string) => {
    setSelectedPickupTime(time);
    await setScheduledTime(time);
  };

  const handleChefNoteToggle = async (menuItemId: string, hasChefNote: boolean) => {
    if (hasChefNote) {
      await updateChefNote(menuItemId, '');
      setExpandedNotes((current) => ({ ...current, [menuItemId]: false }));
      return;
    }

    setExpandedNotes((current) => ({
      ...current,
      [menuItemId]: !current[menuItemId],
    }));
  };

  if (items.length === 0) {
    return (
      <View style={styles.screen}>
        <StatusBar style="dark" />
        <View style={[styles.emptyWrap, { paddingTop: insets.top + 40 }]}>
          <View style={styles.emptyIcon}>
            <AppIcon name="shopping-bag" size={30} color={palette.brand} />
          </View>
          <Text style={styles.emptyTitle}>Your cart is waiting</Text>
          <Text style={styles.emptyText}>
            Add a few favourites from the canteen menu and we&apos;ll bring checkout to life.
          </Text>
          <TouchableOpacity
            activeOpacity={0.92}
            style={styles.emptyButton}
            onPress={() => navigation.navigate('Home')}
          >
            <Text style={styles.emptyButtonText}>Browse Menu</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 12, paddingBottom: 120 + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Checkout</Text>
            <Text style={styles.headerSubtitle}>{canteenName} · {totalItems} items</Text>
          </View>
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>Fast pickup</Text>
          </View>
        </View>

        {!isPreOrder && (
          <View style={styles.card}>
            <PickupTimePanel
              value={selectedPickupTime}
              onChange={handlePickupTimeChange}
              contextLabel="Selected for the whole order"
              college={userCollege}
            />
          </View>
        )}

        {pickupSettings && !isPreOrder ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Pickup Estimate</Text>
            <View style={styles.estimateRow}>
              <View style={styles.estimateIcon}>
                <AppIcon name="clock" size={18} color={palette.accent} />
              </View>
              <View style={styles.estimateCopy}>
                <Text style={styles.estimateTitle}>
                  {`Ready in about ${estimatedMinutes || 15} minutes`}
                </Text>
                <Text style={styles.estimateText}>
                  {estimatedPickupAt
                    ? `Approx. pickup around ${estimatedPickupAt.toLocaleTimeString([], {
                        hour: 'numeric',
                        minute: '2-digit',
                      })}`
                    : 'Pickup estimate will appear here.'}
                </Text>
                {rushHourStatus?.isRushHour ? (
                  <Text style={styles.estimateRushText}>
                    Includes +{pickupSettings.rushHourExtra} min for the current rush hour.
                  </Text>
                ) : null}
              </View>
            </View>
          </View>
        ) : null}

        <View style={styles.card}>
          <View style={styles.preOrderRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>Pre-Order Options</Text>
              <Text style={styles.sectionHint}>Schedule your meal in advance.</Text>
            </View>
            <Switch
              value={isPreOrder}
              onValueChange={setIsPreOrder}
              trackColor={{ false: palette.line, true: palette.surfaceMuted }}
              thumbColor={isPreOrder ? palette.brand : palette.surface}
            />
          </View>

          {isPreOrder && (
            <View style={styles.preOrderControls}>
              <View style={styles.dateTimePickerRow}>
                <TouchableOpacity style={styles.dateTimeButton} onPress={() => setShowDatePicker(true)}>
                  <AppIcon name="calendar" size={16} color={palette.brand} />
                  <Text style={styles.dateTimeButtonText}>
                    {scheduledFor ? scheduledFor.toLocaleDateString() : 'Select Date'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.dateTimeButton} onPress={() => setShowTimePicker(true)}>
                  <AppIcon name="clock" size={16} color={palette.brand} />
                  <Text style={styles.dateTimeButtonText}>
                    {scheduledFor ? scheduledFor.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'Select Time'}
                  </Text>
                </TouchableOpacity>
              </View>

              {showDatePicker && (
                <DateTimePicker
                  value={scheduledFor || new Date()}
                  mode="date"
                  display="default"
                  minimumDate={new Date()}
                  onChange={(event, date) => {
                    setShowDatePicker(false);
                    if (date && event.type === 'set') {
                      const newDate = scheduledFor ? new Date(scheduledFor) : new Date();
                      newDate.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
                      setScheduledFor(newDate);
                    }
                  }}
                />
              )}

              {showTimePicker && (
                <DateTimePicker
                  value={scheduledFor || new Date()}
                  mode="time"
                  display="default"
                  onChange={(event, date) => {
                    setShowTimePicker(false);
                    if (date && event.type === 'set') {
                      const newDate = scheduledFor ? new Date(scheduledFor) : new Date();
                      newDate.setHours(date.getHours(), date.getMinutes());
                      setScheduledFor(newDate);
                    }
                  }}
                />
              )}

              <Text style={[styles.noteLabel, { marginTop: 8 }]}>Pre-order Note</Text>
              <TextInput
                style={styles.noteInput}
                value={preOrderNote}
                onChangeText={setPreOrderNote}
                placeholder="Any special instructions for later?"
                placeholderTextColor={palette.subtle}
                multiline
                maxLength={200}
              />
            </View>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Your Order</Text>
          <Text style={styles.sectionHint}>
            Tap any item below to add a note for the chef before checkout.
          </Text>
          <View style={styles.cardStack}>
            {items.map((item) => {
              const hasChefNote = Boolean(item.chefNote);
              const showChefNote = expandedNotes[item.menuItem.id] || hasChefNote;
              const noteToggleLabel = hasChefNote
                ? 'Remove chef note'
                : showChefNote
                  ? 'Hide note'
                  : 'Add note to chef';

              return (
                <View key={item.menuItem.id} style={styles.orderItemCard}>
                  <View style={styles.orderRow}>
                    <Image source={{ uri: item.menuItem.imageUrl }} style={styles.itemImage} />

                    <View style={styles.orderInfo}>
                      <Text style={styles.itemName} numberOfLines={1}>
                        {item.menuItem.name}
                      </Text>
                      <Text style={styles.itemMeta}>
                        {item.tempPreference.charAt(0).toUpperCase() + item.tempPreference.slice(1)}{' '}
                        · Pickup {formatPickupTime(item.scheduledTime)}
                      </Text>
                      <Text style={styles.itemPrice}>₹{item.menuItem.price}</Text>
                    </View>

                    <View style={styles.stepperWrap}>
                      <View style={styles.inlineStepper}>
                        <TouchableOpacity
                          activeOpacity={0.9}
                          style={styles.inlineStepperButton}
                          onPress={() => updateQuantity(item.menuItem.id, item.quantity - 1)}
                        >
                          <AppIcon name="minus" size={14} color={palette.surface} />
                        </TouchableOpacity>
                        <Text style={styles.inlineStepperValue}>{item.quantity}</Text>
                        <TouchableOpacity
                          activeOpacity={0.9}
                          style={styles.inlineStepperButton}
                          onPress={() => updateQuantity(item.menuItem.id, item.quantity + 1)}
                        >
                          <AppIcon name="plus" size={14} color={palette.surface} />
                        </TouchableOpacity>
                      </View>
                      <Text style={styles.lineTotal}>₹{item.menuItem.price * item.quantity}</Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    activeOpacity={0.85}
                    style={styles.noteToggle}
                    onPress={() => void handleChefNoteToggle(item.menuItem.id, hasChefNote)}
                  >
                    <Text style={styles.noteToggleText}>{noteToggleLabel}</Text>
                  </TouchableOpacity>

                  {showChefNote ? (
                    <View style={styles.noteCard}>
                      <Text style={styles.noteLabel}>Chef note</Text>
                      <TextInput
                        style={styles.noteInput}
                        value={item.chefNote}
                        onChangeText={(text) => void updateChefNote(item.menuItem.id, text)}
                        placeholder="Less spicy, extra crispy, or pack separately..."
                        placeholderTextColor={palette.subtle}
                        multiline
                        maxLength={200}
                      />
                      <Text style={styles.noteCounter}>{item.chefNote.length}/200</Text>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        </View>

        {suggestedItems.length > 0 ? (
          <View style={styles.suggestionsSection}>
            <View style={styles.suggestionsHeader}>
              <Text style={styles.sectionTitle}>Add more items</Text>
              <Text style={styles.ghostLink}>Fresh picks</Text>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestionList}>
              {suggestedItems.map((item) => (
                <FoodCard
                  key={item.id}
                  item={item}
                  compact
                  onPress={() => navigation.navigate('ItemDetail', { item })}
                  onAdd={() => void handleAddSuggestedItem(item)}
                />
              ))}
            </ScrollView>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Payment on Next Step</Text>
          <View style={styles.paymentModeList}>
            <View style={styles.paymentModeRow}>
              <View style={[styles.paymentIconWrap, { backgroundColor: '#FCECD8' }]}>
                <AppIcon name="wallet-outline" size={18} color={palette.brand} />
              </View>
              <View style={styles.paymentTextWrap}>
                <Text style={styles.paymentLabel}>Google Pay / PhonePe</Text>
                <Text style={styles.paymentHint}>Open your preferred UPI app with the order amount ready</Text>
              </View>
            </View>

            <View style={styles.paymentModeRow}>
              <View style={[styles.paymentIconWrap, { backgroundColor: '#F2E8FF' }]}>
                <AppIcon name="cellphone-nfc" size={18} color="#7C3AED" />
              </View>
              <View style={styles.paymentTextWrap}>
                <Text style={styles.paymentLabel}>Canteen UPI</Text>
                <Text style={styles.paymentHint}>The backend fills the payee, amount, and order reference for you</Text>
              </View>
            </View>

            <View style={styles.paymentModeRow}>
              <View style={[styles.paymentIconWrap, { backgroundColor: '#E7F0FF' }]}>
                <AppIcon name="credit-card-outline" size={18} color={palette.info} />
              </View>
              <View style={styles.paymentTextWrap}>
                <Text style={styles.paymentLabel}>Secure Checkout</Text>
                <Text style={styles.paymentHint}>The payment screen will automatically match the backend mode</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Bill Summary</Text>

          <View style={styles.billRow}>
            <Text style={styles.billLabel}>Subtotal</Text>
            <Text style={styles.billValue}>₹{subtotal.toFixed(2)}</Text>
          </View>

          <View style={styles.billDivider} />

          <View style={styles.billRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>₹{subtotal.toFixed(2)}</Text>
          </View>

          <View style={styles.savingsBanner}>
            <View style={styles.savingsIcon}>
              <AppIcon name="shield-check-outline" size={16} color={palette.accent} />
            </View>
            <Text style={styles.savingsText}>
              The app decides the payment flow after the order is created, so checkout always matches the backend mode.
            </Text>
          </View>
        </View>

        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: 18 + insets.bottom }]}>
        <TouchableOpacity
          activeOpacity={0.92}
          style={[
            styles.checkoutButton,
            (items.length === 0 || isCreatingOrder) && styles.checkoutButtonDisabled,
          ]}
          disabled={items.length === 0 || isCreatingOrder}
          onPress={handleCreateOrder}
        >
          {isCreatingOrder ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={palette.surface} />
              <Text style={styles.checkoutButtonText}>Creating order...</Text>
            </View>
          ) : (
            <View style={styles.checkoutRow}>
              <Text style={styles.checkoutButtonText}>Continue to Payment</Text>
              <AppIcon name="chevron-right" size={18} color={palette.surface} />
            </View>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.surfaceMuted,
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 14,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  headerTitle: {
    color: palette.ink,
    fontSize: 28,
    fontWeight: '800',
  },
  headerSubtitle: {
    color: palette.muted,
    fontSize: 13,
    marginTop: 4,
  },
  headerBadge: {
    backgroundColor: palette.warningSoft,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  headerBadgeText: {
    color: palette.accent,
    fontSize: 12,
    fontWeight: '700',
  },
  card: {
    backgroundColor: palette.surface,
    borderRadius: 24,
    padding: 16,
    gap: 14,
    ...shadows.card,
  },
  sectionTitle: {
    color: palette.ink,
    fontSize: 18,
    fontWeight: '800',
  },
  sectionHint: {
    color: palette.muted,
    fontSize: 13,
    lineHeight: 19,
  },
  preOrderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  preOrderControls: {
    marginTop: 6,
    gap: 12,
  },
  dateTimePickerRow: {
    flexDirection: 'row',
    gap: 12,
  },
  dateTimeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    backgroundColor: palette.surfaceMuted,
    borderRadius: 14,
  },
  dateTimeButtonText: {
    color: palette.ink,
    fontSize: 14,
    fontWeight: '700',
  },
  cardStack: {
    gap: 14,
  },
  orderItemCard: {
    gap: 10,
  },
  orderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  itemImage: {
    width: 72,
    height: 72,
    borderRadius: 18,
    backgroundColor: palette.surfaceMuted,
  },
  orderInfo: {
    flex: 1,
    gap: 4,
  },
  itemName: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: '700',
  },
  itemMeta: {
    color: palette.muted,
    fontSize: 12,
  },
  itemPrice: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: '800',
  },
  stepperWrap: {
    alignItems: 'flex-end',
    gap: 8,
  },
  inlineStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.accent,
    borderRadius: 12,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  inlineStepperButton: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineStepperValue: {
    color: palette.surface,
    minWidth: 20,
    textAlign: 'center',
    fontWeight: '800',
  },
  lineTotal: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  estimateRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  estimateIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: palette.warningSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  estimateCopy: {
    flex: 1,
    gap: 4,
  },
  estimateTitle: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: '800',
  },
  estimateText: {
    color: palette.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  estimateRushText: {
    color: palette.accent,
    fontSize: 12,
    fontWeight: '700',
  },
  noteToggle: {
    alignSelf: 'flex-start',
  },
  noteToggleText: {
    color: palette.accent,
    fontSize: 12,
    fontWeight: '800',
  },
  noteCard: {
    backgroundColor: palette.surfaceMuted,
    borderRadius: 16,
    padding: 12,
    gap: 8,
  },
  noteLabel: {
    color: palette.ink,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  noteInput: {
    minHeight: 76,
    borderRadius: 14,
    backgroundColor: palette.surface,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: palette.ink,
    fontSize: 14,
    lineHeight: 20,
    textAlignVertical: 'top',
  },
  noteCounter: {
    alignSelf: 'flex-end',
    color: palette.muted,
    fontSize: 11,
    fontWeight: '600',
  },
  suggestionsSection: {
    gap: 12,
  },
  suggestionsHeader: {
    paddingHorizontal: 2,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ghostLink: {
    color: palette.accent,
    fontSize: 12,
    fontWeight: '700',
  },
  suggestionList: {
    gap: 12,
    paddingRight: 6,
  },
  paymentModeList: {
    gap: 12,
  },
  paymentModeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  paymentIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentTextWrap: {
    flex: 1,
    gap: 2,
  },
  paymentLabel: {
    color: palette.ink,
    fontSize: 14,
    fontWeight: '700',
  },
  paymentHint: {
    color: palette.muted,
    fontSize: 12,
    lineHeight: 17,
  },
  billRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  billLabel: {
    color: palette.muted,
    fontSize: 14,
  },
  billValue: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: '700',
  },
  billDivider: {
    height: 1,
    backgroundColor: palette.line,
  },
  totalLabel: {
    color: palette.ink,
    fontSize: 18,
    fontWeight: '800',
  },
  totalValue: {
    color: palette.ink,
    fontSize: 20,
    fontWeight: '900',
  },
  savingsBanner: {
    marginTop: 2,
    backgroundColor: palette.warningSoft,
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  savingsIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  savingsText: {
    flex: 1,
    color: '#A45A17',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
  },
  errorText: {
    color: palette.danger,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(250,248,245,0.96)',
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  checkoutButton: {
    backgroundColor: palette.accent,
    borderRadius: 22,
    paddingVertical: 16,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.floating,
  },
  checkoutButtonDisabled: {
    opacity: 0.65,
  },
  checkoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  checkoutButtonText: {
    color: palette.surface,
    fontSize: 16,
    fontWeight: '800',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    backgroundColor: palette.background,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: palette.warningSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    color: palette.ink,
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
  },
  emptyText: {
    color: palette.muted,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 24,
  },
  emptyButton: {
    backgroundColor: palette.brand,
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 18,
  },
  emptyButtonText: {
    color: palette.surface,
    fontSize: 15,
    fontWeight: '800',
  },
});
