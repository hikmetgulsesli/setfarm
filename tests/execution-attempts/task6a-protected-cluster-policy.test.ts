import assert from "node:assert/strict";
import { test } from "node:test";
import { assertProtectedClusterPolicyV1 } from "./task6a-protected-cluster-policy.js";

const home = "/private/tmp/setfarm-task6a-protected-pg.Unit123";
const safe = Object.freeze({
  home, port: 55437,
  config: `data_directory='${home}/data'\nhba_file='${home}/pg_hba.conf'\nident_file='${home}/pg_ident.conf'\nlisten_addresses=''\nport=55437\nunix_socket_directories='${home}/socket'\nunix_socket_permissions=0777\nunix_socket_group=''\nshared_buffers='16MB'\nmax_connections=10\n`,
  hba: "local all task6a_admin peer map=task6a_fixture\nlocal all task6a_runtime peer map=task6a_fixture\nlocal all all reject\nlocal replication all reject\nhost all all 0.0.0.0/0 reject\nhost all all ::0/0 reject\nhost replication all 0.0.0.0/0 reject\nhost replication all ::0/0 reject\n",
  ident: "task6a_fixture _postgres task6a_admin\ntask6a_fixture _www task6a_runtime\n",
});

test("protected cluster launch policy refuses trust before privileged fixture startup", () => {
  assert.throws(() => assertProtectedClusterPolicyV1({ ...safe,
    hba: "local all all trust\n" }), /TASK6A_PROTECTED_CLUSTER_POLICY_REFUSAL/);
});

test("protected cluster launch policy admits only the private peer identity boundary", () => {
  assert.doesNotThrow(() => assertProtectedClusterPolicyV1(safe));
  const unsafe = [
    { ...safe, ident: "task6a_fixture _www task6a_admin\n" },
    { ...safe, hba: safe.hba.replace("task6a_admin peer", "task6a_admin trust") },
    { ...safe, config: safe.config.replace("listen_addresses=''", "listen_addresses='*'") },
    { ...safe, config: safe.config.replace("port=55437", "port=5432"), port: 5432 },
    { ...safe, config: safe.config.replace(`${home}/socket`, "/private/tmp") },
    { ...safe, config: safe.config + "include='/tmp/override.conf'\n" },
    { ...safe, config: safe.config + "listen_addresses='*'\n" },
    { ...safe, home: "/opt/homebrew/var/postgresql@17" },
    { ...safe, port: Number.NaN },
  ];
  for (const input of unsafe) {
    assert.throws(() => assertProtectedClusterPolicyV1(input), /TASK6A_PROTECTED_CLUSTER_POLICY_REFUSAL/);
  }
});
