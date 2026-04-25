import { supabase } from '@/integrations/supabase/client';

const VAPID_PUBLIC_KEY =
  'BBDxk8X1l2d_m991pK1ikX7MfkCcSpBy3_K393EjGnUMfMu1m6f8qMkNVz42caBtCN_hoQkNyiD3M3slhvfcjlc';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) output[i] = rawData.charCodeAt(i);
  return output;
}

function arrayBufferToBase64(buffer: ArrayBuffer | null): string {
  if (!buffer) return '';
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return window.btoa(binary);
}

export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushSupported()) return null;
  try {
    const reg = await navigator.serviceWorker.register('/sw.js');
    return reg;
  } catch (e) {
    console.error('SW registration failed', e);
    return null;
  }
}

export async function subscribeUserToPush(userId: string): Promise<boolean> {
  if (!isPushSupported()) return false;
  const reg = await navigator.serviceWorker.ready;

  let subscription = await reg.pushManager.getSubscription();
  if (!subscription) {
    subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
    });
  }

  const json = subscription.toJSON();
  const endpoint = json.endpoint || subscription.endpoint;
  const p256dh = json.keys?.p256dh || arrayBufferToBase64(subscription.getKey('p256dh'));
  const auth = json.keys?.auth || arrayBufferToBase64(subscription.getKey('auth'));

  if (!endpoint || !p256dh || !auth) return false;

  const { error } = await supabase
    .from('push_subscriptions')
    .upsert(
      { user_id: userId, endpoint, p256dh, auth, updated_at: new Date().toISOString() },
      { onConflict: 'endpoint' }
    );

  if (error) {
    console.error('Failed to save push subscription', error);
    return false;
  }
  return true;
}

export async function requestAndSubscribe(userId: string): Promise<NotificationPermission> {
  if (!isPushSupported()) return 'denied';
  let permission = Notification.permission;
  if (permission === 'default') permission = await Notification.requestPermission();
  if (permission === 'granted') await subscribeUserToPush(userId);
  return permission;
}

export async function unsubscribeFromPush(userId: string): Promise<void> {
  if (!isPushSupported()) return;
  const reg = await navigator.serviceWorker.ready;
  const subscription = await reg.pushManager.getSubscription();
  if (subscription) {
    await supabase.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint).eq('user_id', userId);
    await subscription.unsubscribe();
  }
}
