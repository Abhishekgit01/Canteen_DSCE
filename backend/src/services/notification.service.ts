type NotificationPayload = Record<string, unknown>;

interface PushMessage {
  to: string;
  title: string;
  body: string;
  data?: NotificationPayload;
  sound?: 'default' | null;
  badge?: number;
  categoryId?: string;
}

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

export function isExpoPushToken(token: string | null | undefined) {
  if (!token) {
    return false;
  }

  return token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken[');
}

async function postPushMessage(payload: PushMessage | PushMessage[]) {
  const response = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const result = (await response.json().catch(() => null)) as
    | {
        data?: unknown;
        errors?: Array<{ message?: string }>;
      }
    | null;
  const firstError =
    Array.isArray(result?.errors) && result.errors[0]?.message ? result.errors[0].message : '';

  if (!response.ok) {
    throw new Error(
      `Expo push request failed with ${response.status}${firstError ? `: ${firstError}` : ''}`,
    );
  }

  return result;
}

export async function sendPushNotification(
  token: string,
  title: string,
  body: string,
  data?: NotificationPayload,
): Promise<void> {
  if (!isExpoPushToken(token)) {
    console.warn('Invalid Expo push token:', token);
    return;
  }

  const message: PushMessage = {
    to: token,
    title,
    body,
    sound: 'default',
    data: data ?? {},
  };

  try {
    const result = await postPushMessage(message);
    const pushData = result?.data as { status?: string; message?: string } | undefined;

    if (pushData?.status === 'error') {
      console.error('Push notification error:', pushData.message);
    }
  } catch (error) {
    console.error('Push notification failed:', error instanceof Error ? error.message : error);
  }
}

export async function sendBulkPushNotification(
  tokens: string[],
  title: string,
  body: string,
  data?: NotificationPayload,
): Promise<void> {
  const validTokens = tokens.filter((token) => isExpoPushToken(token));

  if (validTokens.length === 0) {
    return;
  }

  const batches: string[][] = [];
  for (let index = 0; index < validTokens.length; index += 100) {
    batches.push(validTokens.slice(index, index + 100));
  }

  await Promise.all(
    batches.map(async (batch) => {
      const messages: PushMessage[] = batch.map((token) => ({
        to: token,
        title,
        body,
        sound: 'default',
        data: data ?? {},
      }));

      try {
        const result = await postPushMessage(messages);
        const pushData = result?.data as Array<{ status?: string; message?: string }> | undefined;
        const errors = Array.isArray(pushData)
          ? pushData.filter((entry) => entry.status === 'error')
          : [];

        if (errors.length > 0) {
          console.error('Batch push notification errors:', errors);
        }
      } catch (error) {
        console.error('Batch push failed:', error instanceof Error ? error.message : error);
      }
    }),
  );
}

export const NotificationTemplates = {
  orderPaid: (orderId: string) => ({
    title: 'Payment Confirmed',
    body: 'Your order is being prepared. We will notify you when it is ready.',
    data: { screen: 'Orders', orderId, type: 'order_paid' },
  }),

  orderReady: (items: string[], orderId: string) => ({
    title: 'Your Order is Ready',
    body: `${items.slice(0, 2).join(', ')}${items.length > 2 ? ` +${items.length - 2} more` : ''} is ready for pickup.`,
    data: { screen: 'Orders', orderId, type: 'order_ready' },
  }),

  orderFulfilled: (orderId: string) => ({
    title: 'Enjoy your meal',
    body: 'Order collected. How was it? Rate your meal when you are ready.',
    data: { screen: 'RateOrder', orderId, type: 'order_fulfilled', showRating: true },
  }),

  rushHourWarning: (endTime: string, college: string) => ({
    title: 'Beat the rush',
    body: `${college} canteen rush hour ends at ${endTime}. Order now for faster service.`,
    data: { screen: 'Main', tab: 'Home', type: 'rush_warning' },
  }),

  dailySpecial: (itemName: string, price: number, college: string) => ({
    title: `Today's Special at ${college}`,
    body: `${itemName} is live for just Rs.${price}. Available while it lasts.`,
    data: { screen: 'Main', tab: 'Home', type: 'daily_special' },
  }),

  itemRestocked: (itemName: string) => ({
    title: 'Back in stock',
    body: `${itemName} is available again. Order before it runs out.`,
    data: { screen: 'Main', tab: 'Home', type: 'restock' },
  }),

  orderFailed: (orderId: string) => ({
    title: 'Payment failed',
    body: 'Your payment could not be processed. Please try again.',
    data: { screen: 'Cart', orderId, type: 'order_failed' },
  }),

  rateReminder: (orderId: string) => ({
    title: 'How was your meal?',
    body: 'Take a few seconds to rate your food. Your feedback helps the canteen improve.',
    data: { screen: 'RateOrder', orderId, type: 'rate_reminder' },
  }),
};
