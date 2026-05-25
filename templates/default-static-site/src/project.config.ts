export const projectConfig = {
  name: 'hello-shipnow',
  type: 'landing',
  title: 'Hello ShipNow',
  prompt: 'A polished static site starter for ShipNow generated projects.',
} as const;

export type ProjectConfig = typeof projectConfig;

