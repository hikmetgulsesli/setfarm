import { canonicalJsonStringify } from "../product-compiler/canonical-json.js";
import { parseTask6aPostgresSocketTransportV1, type Task6aPostgresSocketTransportV1 }
  from "./task6a-postgres-socket-transport-v1.js";
import { holdTask6aRootOwnedJsonFileV1 } from "./task6a-root-owned-json-file-v1.js";

const DESCRIPTOR_PATH = "/Library/Application Support/Setfarm/authority/platform-postgres-endpoint-v1.json";
const SOCKET_DIRECTORY = "/Library/Application Support/Setfarm/PostgreSQL/run";
export type Task6aProtectedPostgresDescriptorV1 = Readonly<{
  schema: "setfarm.protected-postgres-endpoint.v1";
  transport: Task6aPostgresSocketTransportV1;
  schemaOwner: "setfarm_owner";
  serverOsUid: number;
  runtimeOsGid: number;
}>;
const identity = (value: unknown): value is number => typeof value === "number"
  && Number.isSafeInteger(value) && value > 0 && value <= 4294967294;

// Parser returns data only, never authenticates its origin or actual role/grants.
export function parseTask6aProtectedPostgresDescriptorV1(bytes: Buffer): Task6aProtectedPostgresDescriptorV1 {
  try {
    if (!Buffer.isBuffer(bytes) || bytes.length < 1 || bytes.length > 16384) throw Error();
    const value: unknown = JSON.parse(bytes.toString("utf8"));
    if (!value || typeof value !== "object" || Array.isArray(value)) throw Error();
    const input = value as Record<string, unknown>;
    const fields = ["schema", "transport", "schemaOwner", "serverOsUid", "runtimeOsGid"];
    if (Object.keys(input).length !== fields.length || fields.some(key => !Object.hasOwn(input, key))
      || !Buffer.from(canonicalJsonStringify(input) + "\n").equals(bytes)
      || input.schema !== "setfarm.protected-postgres-endpoint.v1" || input.schemaOwner !== "setfarm_owner"
      || !identity(input.serverOsUid) || !identity(input.runtimeOsGid)) throw Error();
    const transport = parseTask6aPostgresSocketTransportV1(input.transport);
    if (transport.socketDirectory !== SOCKET_DIRECTORY || transport.database !== "setfarm"
      || transport.user !== "setfarm_runtime" || transport.osUid === input.serverOsUid) throw Error();
    return Object.freeze({ schema: "setfarm.protected-postgres-endpoint.v1", transport,
      schemaOwner: "setfarm_owner", serverOsUid: input.serverOsUid, runtimeOsGid: input.runtimeOsGid });
  } catch { throw new Error("TASK6A_PROTECTED_POSTGRES_DESCRIPTOR_INVALID"); }
}

// Authenticates ONLY the held descriptor source and current process identity.
// No socket/server/grant/schema/deployment/owner/admission/readiness assertion.
export function holdTask6aProtectedPostgresDescriptorV1() {
  const refuse = (): never => { throw new Error("TASK6A_PROTECTED_POSTGRES_DESCRIPTOR_REFUSED"); };
  if (arguments.length !== 0 || process.platform !== "darwin") refuse();
  let file: ReturnType<typeof holdTask6aRootOwnedJsonFileV1> | undefined;
  let closed = false, invalid = false;
  const close = () => {
    if (closed) return;
    closed = true;
    try { file?.close(); } catch { invalid = true; refuse(); }
  };
  try {
    file = holdTask6aRootOwnedJsonFileV1(DESCRIPTOR_PATH);
    const descriptor = parseTask6aProtectedPostgresDescriptorV1(file.read());
    const checkIdentity = () => {
      if (process.getuid?.() !== descriptor.transport.osUid || process.geteuid?.() !== descriptor.transport.osUid
        || process.getgid?.() !== descriptor.runtimeOsGid || process.getegid?.() !== descriptor.runtimeOsGid) refuse();
    };
    const recheck = () => {
      try {
        if (closed || invalid) refuse();
        checkIdentity(); file!.recheck(); checkIdentity();
      } catch { invalid = true; close(); refuse(); }
    };
    recheck();
    return Object.freeze({ read: () => { recheck(); return descriptor; }, recheck, close });
  } catch { invalid = true; close(); refuse(); }
}
