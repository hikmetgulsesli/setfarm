export type ProtectedClusterPolicyV1 = Readonly<{
  home: string;
  port: number;
  config: string;
  hba: string;
  ident: string;
}>;

// Test-only policy; the real fixture calls it before ownership/server effects.
export function assertProtectedClusterPolicyV1(policy: ProtectedClusterPolicyV1): void {
  const refuse = (): never => { throw new Error("TASK6A_PROTECTED_CLUSTER_POLICY_REFUSAL"); };
  if (!/^\/private\/tmp\/setfarm-task6a-protected-pg\.[A-Za-z0-9]+$/.test(policy.home)
    || !Number.isSafeInteger(policy.port) || policy.port < 55_000 || policy.port >= 59_000) refuse();
  const lines = (text: string): string[] => text.trim().split("\n")
    .map((line) => line.trim().replace(/\s+/g, " "));
  const exactLines = (actual: string, expected: readonly string[]): void => {
    const parsed = lines(actual);
    if (parsed.length !== expected.length || parsed.some((line, index) => line !== expected[index])) refuse();
  };
  exactLines(policy.hba, [
    "local all task6a_admin peer map=task6a_fixture",
    "local all task6a_runtime peer map=task6a_fixture",
    "local all all reject", "local replication all reject",
    "host all all 0.0.0.0/0 reject", "host all all ::0/0 reject",
    "host replication all 0.0.0.0/0 reject", "host replication all ::0/0 reject",
  ]);
  exactLines(policy.ident, [
    "task6a_fixture _postgres task6a_admin", "task6a_fixture _www task6a_runtime",
  ]);
  const expected = new Map([
    ["data_directory", `'${policy.home}/data'`],
    ["hba_file", `'${policy.home}/pg_hba.conf'`],
    ["ident_file", `'${policy.home}/pg_ident.conf'`],
    ["listen_addresses", "''"], ["port", String(policy.port)],
    ["unix_socket_directories", `'${policy.home}/socket'`],
    ["unix_socket_permissions", "0777"], ["unix_socket_group", "''"],
    ["shared_buffers", "'16MB'"], ["max_connections", "10"],
  ]);
  const seen = new Set<string>();
  for (const line of lines(policy.config)) {
    const match = /^([a-z_]+)=(.*)$/.exec(line);
    if (!match || seen.has(match[1]) || expected.get(match[1]) !== match[2]) refuse();
    seen.add(match![1]);
  }
  if (seen.size !== expected.size) refuse();
}
