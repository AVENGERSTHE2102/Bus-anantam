import { Preferences } from '@capacitor/preferences';
import { isNativeApp } from './native';

const QUEUE_KEY = 'bus-tracker-pending-location-pings';
const MAX_QUEUE_SIZE = 500;

export type QueuedLocationPing = {
  tripId: string;
  lat: number;
  lng: number;
  speed: number;
  heading: number;
  capturedAt: string;
};

async function readQueue(): Promise<QueuedLocationPing[]> {
  if (!isNativeApp()) return [];
  const { value } = await Preferences.get({ key: QUEUE_KEY });
  try { return value ? JSON.parse(value) : []; } catch { return []; }
}

export async function enqueueLocationPing(ping: QueuedLocationPing): Promise<void> {
  if (!isNativeApp()) return;
  const queue = await readQueue();
  queue.push(ping);
  await Preferences.set({ key: QUEUE_KEY, value: JSON.stringify(queue.slice(-MAX_QUEUE_SIZE)) });
}

export async function drainLocationPings(send: (ping: QueuedLocationPing) => void): Promise<void> {
  if (!isNativeApp()) return;
  const queue = await readQueue();
  if (!queue.length) return;
  // Clear first so a reconnect loop cannot resend the same history forever.
  await Preferences.remove({ key: QUEUE_KEY });
  queue.forEach(send);
}
