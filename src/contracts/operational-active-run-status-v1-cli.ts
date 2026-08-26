#!/usr/bin/env node

import {
  canonicalJsonStringify,
  hashCanonicalJson,
} from "../product-compiler/canonical-json.js";
import { SETFARM_OPERATIONAL_ACTIVE_RUN_STATUSES_V1 } from "./operational-active-run-status-v1.js";

const argv = process.argv.slice(2);
if (argv.length !== 1 || argv[0] !== "--json") {
  throw new Error("OPERATIONAL_ACTIVE_RUN_STATUS_JSON_FLAG_REQUIRED");
}

const contract = {
  schema: "setfarm.operational-active-run-status.v1" as const,
  statuses: SETFARM_OPERATIONAL_ACTIVE_RUN_STATUSES_V1,
};
const document = {
  ...contract,
  contractHash: hashCanonicalJson(contract),
};

process.stdout.write(`${canonicalJsonStringify(document)}\n`);
