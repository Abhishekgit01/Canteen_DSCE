import { GoogleSignin, isErrorWithCode, isSuccessResponse, statusCodes } from '@react-native-google-signin/google-signin';

let googleConfigured = false;

export type GoogleNativeCredential = {
  accessToken?: string;
  idToken?: string;
  email: string;
  name: string;
  picture?: string | null;
};

export function ensureGoogleConfigured() {
  if (googleConfigured) {
    return;
  }

  GoogleSignin.configure();
  googleConfigured = true;
}

export async function signInWithGoogleNative(): Promise<GoogleNativeCredential | null> {
  ensureGoogleConfigured();
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

  const response = await GoogleSignin.signIn();
  if (!isSuccessResponse(response)) {
    return null;
  }

  const tokens = await GoogleSignin.getTokens();

  return {
    accessToken: tokens.accessToken,
    idToken: response.data.idToken || tokens.idToken || undefined,
    email: response.data.user.email,
    name: response.data.user.name || response.data.user.email,
    picture: response.data.user.photo,
  };
}

export function getGoogleSignInErrorMessage(error: unknown) {
  if (isErrorWithCode(error)) {
    if (error.code === statusCodes.SIGN_IN_CANCELLED) {
      return '';
    }

    if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      return 'Google Play Services is missing or outdated on this device.';
    }

    if (error.code === statusCodes.IN_PROGRESS) {
      return 'Google sign in is already running.';
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return 'Google sign in failed. Try again.';
}
