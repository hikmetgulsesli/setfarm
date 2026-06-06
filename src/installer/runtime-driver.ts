export type RuntimeKind = "browser" | "emulator" | "simulator" | "process" | "none";
export type InteractionAction = "click" | "fill" | "press" | "wait" | "navigate" | "snapshot";

export interface StoryRuntimeContext {
  runId: string;
  runNumber?: number | null;
  storyId: string;
  workdir: string;
  host?: string;
  preferredPort?: number | null;
}

export interface RuntimeSession {
  kind: RuntimeKind;
  sessionId: string;
  workdir: string;
  host: string;
  port: number | null;
  url: string | null;
  startedAt: string;
}

export interface InteractionRequest {
  id?: string;
  action: InteractionAction;
  target?: string;
  value?: string;
  waitCondition?: "load" | "network_idle" | "dom_idle" | "timeout";
  timeoutMs?: number;
}

export interface InteractionResult {
  id: string;
  action: InteractionAction;
  status: "pass" | "fail" | "skipped";
  startedAt: string;
  completedAt: string;
  detail?: string;
}

export interface CapturedRuntimeState {
  capturedAt: string;
  screenshotPath?: string;
  domSnapshotPath?: string;
  accessibilitySnapshotPath?: string;
  stateBridge?: Record<string, unknown> | null;
}

export interface RuntimeDriver {
  start(context: StoryRuntimeContext): Promise<RuntimeSession>;
  waitReady(session: RuntimeSession): Promise<void>;
  interact(session: RuntimeSession, action: InteractionRequest): Promise<InteractionResult>;
  captureState(session: RuntimeSession): Promise<CapturedRuntimeState>;
  stop(session: RuntimeSession): Promise<void>;
}
