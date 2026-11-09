export interface ReminderChannelInput {
  emailAvailable: boolean;
  emailEnabled: boolean;
  pushAvailable: boolean;
  /** Push devices that are not switched off after repeated failures. */
  activePushDevices: number;
  /** Other destinations (ntfy, webhooks) that are on and not auto-disabled. */
  activeDestinations: number;
}

export type ReminderChannel =
  | { kind: 'email' }
  | { kind: 'push'; count: number }
  | { kind: 'destinations'; count: number };

/**
 * Which channels will really receive a reminder right now. Email counts only
 * if the server can send it and the person left it on; push only if the
 * server is configured and at least one device still works.
 */
export function activeReminderChannels(input: ReminderChannelInput): ReminderChannel[] {
  const channels: ReminderChannel[] = [];
  if (input.emailAvailable && input.emailEnabled) channels.push({ kind: 'email' });
  if (input.pushAvailable && input.activePushDevices > 0) {
    channels.push({ kind: 'push', count: input.activePushDevices });
  }
  if (input.activeDestinations > 0) {
    channels.push({ kind: 'destinations', count: input.activeDestinations });
  }
  return channels;
}
