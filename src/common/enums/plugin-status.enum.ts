/**
 * Represents the lifecycle status of a plugin in the marketplace.
 * Plugins flow through these states during the submission and review process.
 */
export enum PluginStatus {
  /** Initial state after developer submission. */
  SUBMITTED = 'SUBMITTED',

  /** Plugin is in the review queue awaiting admin security vetting. */
  PENDING_REVIEW = 'PENDING_REVIEW',

  /** Plugin has passed security review and is visible in the public marketplace. */
  PUBLISHED = 'PUBLISHED',

  /** Plugin was rejected during review due to security or policy violations. */
  REJECTED = 'REJECTED',
}
