export type SetfarmProtocolMode = "legacy" | "shadow";

export type SetfarmProtocol = Readonly<{
  mode: SetfarmProtocolMode;
}>;

export type ProtocolErrorCode =
  | "PROTOCOL_INVALID_MODE"
  | "PROTOCOL_NOT_IMPLEMENTED";

export class ProtocolConfigurationError extends Error {
  readonly code: ProtocolErrorCode;
  readonly value: string;

  constructor(code: ProtocolErrorCode, value: string, message: string) {
    super(message);
    this.name = "ProtocolConfigurationError";
    this.code = code;
    this.value = value;
  }
}

export function parseSetfarmProtocol(value: string | undefined): SetfarmProtocol {
  if (value === undefined || value === "legacy") {
    return Object.freeze({ mode: "legacy" });
  }
  if (value === "shadow") {
    return Object.freeze({ mode: "shadow" });
  }
  if (value === "v3") {
    throw new ProtocolConfigurationError(
      "PROTOCOL_NOT_IMPLEMENTED",
      value,
      "SETFARM_PROTOCOL=v3 is not implemented or authorized",
    );
  }
  throw new ProtocolConfigurationError(
    "PROTOCOL_INVALID_MODE",
    value,
    `Unsupported SETFARM_PROTOCOL value: ${JSON.stringify(value)}`,
  );
}

export function readSetfarmProtocol(
  env: NodeJS.ProcessEnv = process.env,
): SetfarmProtocol {
  return parseSetfarmProtocol(env.SETFARM_PROTOCOL);
}
