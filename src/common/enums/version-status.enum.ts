/**
 * Represents the review status for a specific plugin version.
 */
export enum VersionStatus {
  /** Initial state after submission. */
  SUBMITTED = 'SUBMITTED',

  /** In queue for admin review. */
  PENDING_REVIEW = 'PENDING_REVIEW',

  /** Approved and available in store. */
  PUBLISHED = 'PUBLISHED',

  /** Rejected by admin. */
  REJECTED = 'REJECTED',

  /** Flagged for security violations. */
  FLAGGED = 'FLAGGED',
}

/**
 * Possible review decisions for admin actions.
 */
export enum ReviewDecision {
  /** Approve and publish the plugin version. */
  PUBLISH = 'PUBLISH',

  /** Reject the plugin version. */
  REJECT = 'REJECT',
}
