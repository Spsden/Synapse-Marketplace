/**
 * Review lifecycle for MCP registry submissions made by developers.
 */
export enum McpRegistrySubmissionStatus {
  /** Initial state after a developer submits a server definition. */
  SUBMITTED = 'SUBMITTED',

  /** Explicitly marked as under human review. */
  PENDING_REVIEW = 'PENDING_REVIEW',

  /** Approved and merged into the published registry. */
  APPROVED = 'APPROVED',

  /** Rejected during review. */
  REJECTED = 'REJECTED',
}

/**
 * Whether a submission proposes a new registry entry or an update to an existing one.
 */
export enum McpRegistryChangeType {
  NEW = 'NEW',
  UPDATE = 'UPDATE',
}

/**
 * Admin review decisions for MCP registry submissions.
 */
export enum McpRegistryReviewDecision {
  PUBLISH = 'PUBLISH',
  REJECT = 'REJECT',
}
