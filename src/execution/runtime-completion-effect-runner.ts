import { hashCanonicalJson } from "../product-compiler/canonical-json.js";
import {
  createRuntimeCompletionEffectRepository,
  type RuntimeCompletionEffect,
} from "./runtime-completion-effect-repository.js";
import {
  RuntimeCompletionEffectInputV1Schema,
  type RuntimeCompletionEffectInputV1,
} from "./schemas/runtime-completion-plan-v1.js";

type EffectRepository = Pick<
  ReturnType<typeof createRuntimeCompletionEffectRepository>,
  | "listForRequest"
  | "claimNext"
  | "heartbeat"
  | "assertLease"
  | "releaseForRetry"
  | "quarantine"
  | "settle"
>;

export type RuntimeCompletionEffectResolution = Readonly<{
  resolution: "applied" | "reconciled";
  result: Record<string, unknown>;
  evidence: Record<string, unknown>;
}>;

export type RuntimeCompletionEffectExecutionContext = Readonly<{
  effect: RuntimeCompletionEffect;
  input: RuntimeCompletionEffectInputV1;
  assertLease: () => Promise<void>;
}>;

export type RuntimeCompletionEffectHandler = Readonly<{
  reconcile: (
    context: RuntimeCompletionEffectExecutionContext,
  ) => Promise<RuntimeCompletionEffectResolution | undefined>;
  apply: (
    context: RuntimeCompletionEffectExecutionContext,
  ) => Promise<RuntimeCompletionEffectResolution>;
}>;

function compactDiagnostic(error: unknown): string {
  return String((error as Error)?.message ?? error ?? "unknown effect error")
    .replace(/\s+/g, " ")
    .slice(0, 4_000);
}

export function validateRuntimeCompletionEffectInput(
  effect: RuntimeCompletionEffect,
): RuntimeCompletionEffectInputV1 {
  const input = RuntimeCompletionEffectInputV1Schema.parse(effect.payload);
  if (hashCanonicalJson(input) !== effect.inputHash) {
    throw new Error("RUNTIME_COMPLETION_EFFECT_INPUT_HASH_MISMATCH");
  }
  if (hashCanonicalJson(input.plan) !== input.planHash) {
    throw new Error("RUNTIME_COMPLETION_EFFECT_PLAN_HASH_MISMATCH");
  }
  if (input.plan.requestId !== effect.requestId) {
    throw new Error("RUNTIME_COMPLETION_EFFECT_REQUEST_ID_MISMATCH");
  }
  const spec = input.plan.effects.find((candidate) => candidate.effectKey === effect.effectKey);
  if (
    !spec
    || spec.ordinal !== effect.ordinal
    || spec.effectType !== effect.effectType
    || spec.mandatory !== effect.mandatory
    || hashCanonicalJson(spec.payload) !== hashCanonicalJson(input.effect)
  ) {
    throw new Error("RUNTIME_COMPLETION_EFFECT_MANIFEST_MISMATCH");
  }
  return input;
}

async function withEffectHeartbeat<T>(input: Readonly<{
  repository: EffectRepository;
  effect: RuntimeCompletionEffect;
  ownerInstanceId: string;
  leaseToken: string;
  heartbeatIntervalMs: number;
  operation: () => Promise<T>;
}>): Promise<T> {
  let stopped = false;
  let timer: NodeJS.Timeout | undefined;
  let heartbeatPromise = Promise.resolve();
  let leaseError: Error | undefined;
  const schedule = () => {
    timer = setTimeout(() => {
      heartbeatPromise = (async () => {
        try {
          const retained = await input.repository.heartbeat({
            requestId: input.effect.requestId,
            effectKey: input.effect.effectKey,
            ownerInstanceId: input.ownerInstanceId,
            leaseToken: input.leaseToken,
          });
          if (!retained) leaseError = new Error("RUNTIME_COMPLETION_EFFECT_HEARTBEAT_LEASE_LOST");
        } catch (error) {
          leaseError = new Error(`RUNTIME_COMPLETION_EFFECT_HEARTBEAT_FAILED:${compactDiagnostic(error)}`);
        }
        if (!stopped && !leaseError) schedule();
      })();
    }, input.heartbeatIntervalMs);
    timer.unref?.();
  };
  schedule();
  try {
    const result = await input.operation();
    if (leaseError) throw leaseError;
    return result;
  } finally {
    stopped = true;
    if (timer) clearTimeout(timer);
    await heartbeatPromise;
  }
}

export async function runRuntimeCompletionEffectLedger(input: Readonly<{
  requestId: string;
  ownerInstanceId: string;
  repository: EffectRepository;
  handler: RuntimeCompletionEffectHandler;
  maxAttempts?: number;
  heartbeatIntervalMs?: number;
}>): Promise<Record<string, unknown>> {
  const maxAttempts = Math.max(1, Math.min(10, Math.trunc(input.maxAttempts ?? 3)));
  const heartbeatIntervalMs = Math.max(100, Math.trunc(input.heartbeatIntervalMs ?? 15_000));

  for (;;) {
    const effect = await input.repository.claimNext({
      requestId: input.requestId,
      ownerInstanceId: input.ownerInstanceId,
    });
    if (!effect) break;
    if (!effect.leaseToken) throw new Error("RUNTIME_COMPLETION_EFFECT_LEASE_TOKEN_MISSING");
    const leaseToken = effect.leaseToken;
    const assertLease = async () => {
      await input.repository.assertLease({
        requestId: effect.requestId,
        effectKey: effect.effectKey,
        ownerInstanceId: input.ownerInstanceId,
        leaseToken,
      });
    };

    try {
      const effectInput = validateRuntimeCompletionEffectInput(effect);
      const context = { effect, input: effectInput, assertLease };
      const resolution = await withEffectHeartbeat({
        repository: input.repository,
        effect,
        ownerInstanceId: input.ownerInstanceId,
        leaseToken,
        heartbeatIntervalMs,
        operation: async () => {
          const reconciled = await input.handler.reconcile(context);
          if (reconciled) return reconciled;
          await assertLease();
          return input.handler.apply(context);
        },
      });
      const settled = await input.repository.settle({
        requestId: effect.requestId,
        effectKey: effect.effectKey,
        ownerInstanceId: input.ownerInstanceId,
        leaseToken,
        resolution: resolution.resolution,
        result: resolution.result,
        evidence: resolution.evidence,
      });
      if (
        settled.requestId !== effect.requestId
        || settled.effectKey !== effect.effectKey
        || settled.state !== resolution.resolution
        || hashCanonicalJson(settled.result) !== hashCanonicalJson(resolution.result)
        || hashCanonicalJson(settled.evidence) !== hashCanonicalJson(resolution.evidence)
      ) {
        throw new Error("RUNTIME_COMPLETION_EFFECT_SETTLEMENT_MISMATCH");
      }
    } catch (error) {
      const diagnostic = compactDiagnostic(error);
      if (effect.attemptCount >= maxAttempts) {
        await input.repository.quarantine({
          requestId: effect.requestId,
          effectKey: effect.effectKey,
          ownerInstanceId: input.ownerInstanceId,
          leaseToken,
          diagnostic,
          evidence: {
            schema: "setfarm.runtime-completion-effect-failure.v1",
            attemptCount: effect.attemptCount,
          },
        });
        throw new Error(`RUNTIME_COMPLETION_EFFECT_ATTEMPTS_EXHAUSTED:${effect.effectKey}:${diagnostic}`);
      }
      await input.repository.releaseForRetry({
        requestId: effect.requestId,
        effectKey: effect.effectKey,
        ownerInstanceId: input.ownerInstanceId,
        leaseToken,
        diagnostic,
      });
    }
  }

  const effects = await input.repository.listForRequest(input.requestId);
  const quarantined = effects.find((effect) => effect.mandatory && effect.state === "quarantined");
  if (quarantined) {
    throw new Error(`RUNTIME_COMPLETION_EFFECT_QUARANTINED:${quarantined.effectKey}`);
  }
  const pending = effects.filter(
    (effect) => effect.mandatory && !["applied", "reconciled"].includes(effect.state),
  );
  if (pending.length > 0) {
    throw new Error(`RUNTIME_COMPLETION_EFFECT_LEDGER_INCOMPLETE:${pending.map((effect) => effect.effectKey).join(",")}`);
  }
  const settled = effects.filter((effect) => ["applied", "reconciled"].includes(effect.state));
  return {
    advanced: settled.some((effect) => effect.result.advanced === true),
    runCompleted: settled.some((effect) => effect.result.runCompleted === true),
    effectCount: settled.length,
    effectKeys: settled.map((effect) => effect.effectKey),
  };
}
