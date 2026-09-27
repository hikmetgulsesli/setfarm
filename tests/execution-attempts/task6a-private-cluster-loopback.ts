/** Keep the verified loopback family when deriving private-cluster login URLs. */
export function requireTask6aPrivateLoopbackHostname(adminUrl: URL): string {
  const hostname = adminUrl.hostname;
  const normalized = hostname === "[::1]" ? "::1" : hostname;
  if (!["127.0.0.1", "localhost", "::1"].includes(normalized)) {
    throw new Error("TASK6A_PRIVATE_CLUSTER_HOST_INVALID");
  }
  return hostname;
}
