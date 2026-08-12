import {
  executeHttpInvocationEvidenceRunnerLeaseInternalV2,
} from "../invocation-evidence-runner-execution-v2.js";
import {
  type DurableEvidenceExecutionResultV2,
} from "../schemas/evidence-runner-v2.js";

/**
 * Verified-release HTTP evidence entrypoint.
 *
 * The only accepted field is an authentic activated execution lease. This
 * module cannot issue or promote one and therefore remains operationally
 * unavailable until the release/Registry/publication authority join exists.
 */
export async function runEvidenceAdapterV2(
  input: unknown,
): Promise<DurableEvidenceExecutionResultV2> {
  return executeHttpInvocationEvidenceRunnerLeaseInternalV2(input);
}
