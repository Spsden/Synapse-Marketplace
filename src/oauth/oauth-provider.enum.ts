/**
 * Supported OAuth providers for plugin authentication.
 */
export enum OAuthProvider {
  NOTION = 'notion',
  GOOGLE = 'google',
  GITHUB = 'github',
  SLACK = 'slack',
  MICROSOFT = 'microsoft',
  DISCORD = 'discord',
  LINEAR = 'linear',
  FIGMA = 'figma',
  SALESFORCE = 'salesforce',
  DROPBOX = 'dropbox',
  STRIPE = 'stripe',
}

/**
 * Check if a provider is supported.
 */
export function isProviderSupported(provider: string): boolean {
  return Object.values(OAuthProvider).includes(provider as OAuthProvider);
}
