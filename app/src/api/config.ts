import { NativeModules, Platform } from 'react-native';

const normalizeOrigin = (value?: string | null): string | null => {
  if (!value) {
    return null;
  }

  return value.replace(/\/api\/?$/, '').replace(/\/$/, '');
};

const getExpoDevHost = (): string | null => {
  const possibleScriptUrl = NativeModules.SourceCode?.scriptURL;

  if (!possibleScriptUrl) {
    return null;
  }

  try {
    return new URL(possibleScriptUrl).hostname;
  } catch {
    const match = possibleScriptUrl.match(/^[a-z]+:\/\/([^/:]+)/i);
    return match?.[1] || null;
  }
};

const getDefaultApiOrigin = (): string | null => {
  if (!__DEV__) {
    return null;
  }

  const expoHost = getExpoDevHost();
  if (expoHost) {
    return `http://${expoHost}:4000`;
  }

  return Platform.OS === 'android' ? 'http://10.0.2.2:4000' : 'http://127.0.0.1:4000';
};

const configuredOrigin = normalizeOrigin(process.env.EXPO_PUBLIC_API_URL);
const configuredPaymentOrigin = normalizeOrigin(process.env.EXPO_PUBLIC_PAYMENT_API_URL);
const inferredOrigin = getDefaultApiOrigin();

export const API_CONFIG_ERROR =
  configuredOrigin || inferredOrigin
    ? null
    : 'This build is missing EXPO_PUBLIC_API_URL. Point it to your public backend URL and rebuild the app.';

export const API_ORIGIN = configuredOrigin || inferredOrigin || 'https://invalid.localhost';
export const PAYMENT_API_ORIGIN = configuredPaymentOrigin || API_ORIGIN;
export const API_BASE = `${API_ORIGIN}/api`;
export const PAYMENT_API_BASE = PAYMENT_API_ORIGIN;
