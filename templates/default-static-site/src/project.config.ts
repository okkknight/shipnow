export const projectConfig = {
  projectId: 'proj_hello1234567',
  displayName: 'hello-shipnow',
  publicHandle: 'hello-shipnow',
  type: 'landing',
  title: 'Hello ShipNow',
  prompt: 'A polished static site starter for ShipNow generated projects.',
} as const;

export type ProjectConfig = typeof projectConfig;
