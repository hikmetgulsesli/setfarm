export class V3DeployPublicationPendingError extends Error {
  readonly code = "V3_DEPLOY_PUBLICATION_RECONCILIATION_PENDING";
  readonly runId: string;
  readonly receiptHash: string;
  readonly cause: unknown;

  constructor(input: Readonly<{
    runId: string;
    receiptHash: string;
    cause: unknown;
  }>) {
    super(`${input.runId}/${input.receiptHash} publication outcome requires canonical reconciliation`);
    this.name = "V3DeployPublicationPendingError";
    this.runId = input.runId;
    this.receiptHash = input.receiptHash;
    this.cause = input.cause;
  }
}
