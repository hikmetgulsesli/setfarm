import path from "node:path";

const PRIVATE_CLUSTER_ERROR = "FINDING_OWNER_TEST_PRIVATE_CLUSTER_UNVERIFIED";

function refuse() {
  throw new Error(PRIVATE_CLUSTER_ERROR);
}

export function isOwnerBackedFindingSourceV1(source) {
  if (typeof source !== "string") refuse();
  return source.includes("../execution-attempts/test-database.js")
    || source.includes("../execution-attempts/test-database.ts");
}

export function verifyFindingPrivateClusterTargetV1(adminUrl, expectedDataDirectory) {
  if (typeof adminUrl !== "string" || typeof expectedDataDirectory !== "string") refuse();
  if (!/^\/tmp\/setfarm-task6a-pg\.[A-Za-z0-9]+\/data$/.test(expectedDataDirectory)) refuse();
  let parsed;
  try {
    parsed = new URL(adminUrl);
  } catch {
    refuse();
  }
  if (
    parsed.protocol !== "postgresql:"
    || parsed.hostname !== "127.0.0.1"
    || parsed.pathname !== "/postgres"
    || parsed.search !== ""
    || parsed.hash !== ""
    || !/^[1-9][0-9]{3,4}$/.test(parsed.port)
    || parsed.port === "5432"
  ) refuse();
  return parsed.port;
}

export function verifyFindingPrivateClusterIdentityV1(adminUrl, expectedDataDirectory, observed) {
  const expectedPort = verifyFindingPrivateClusterTargetV1(adminUrl, expectedDataDirectory);
  if (
    observed === null
    || typeof observed !== "object"
    || observed.data_directory !== expectedDataDirectory
    || observed.port !== expectedPort
    || typeof observed.socket_directories !== "string"
    || !observed.socket_directories.split(",").map((value) => value.trim())
      .includes(path.dirname(expectedDataDirectory))
  ) refuse();
}
