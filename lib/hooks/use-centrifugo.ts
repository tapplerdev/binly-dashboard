/**
 * Thin hook that reads the singleton Centrifugo connection from CentrifugoProvider.
 * The provider lives in the dashboard layout and manages ONE WebSocket connection
 * for the entire app session.
 *
 * Usage:
 *   const { subscribe, isConnected, status } = useCentrifugo();
 *
 * subscribe(channel, handler) returns an unsubscribe function.
 * Multiple callers can subscribe to the same channel — all receive every event (fan-out).
 */
export { useCentrifugoContext as useCentrifugo } from '@/lib/providers/centrifugo-provider';
export type { CentrifugoStatus } from '@/lib/providers/centrifugo-provider';
