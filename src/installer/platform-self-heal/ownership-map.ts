export interface OwnershipEntry {
  area: string;
  ownedPaths: string[];
  categorySuite: string[];
}

export const PLATFORM_SELF_HEAL_OWNERSHIP: Record<string, OwnershipEntry> = {
  smoke_contract_gap: {
    area: "smoke",
    ownedPaths: ["scripts/smoke-test.mjs", "tests/smoke-test-static-rules.test.ts"],
    categorySuite: [
      "node --import tsx --test tests/smoke-test-static-rules.test.ts",
      "node --import tsx --test tests/platform-invariants/smoke-invariants.test.ts",
    ],
  },
  qa_contract_gap: {
    area: "qa",
    ownedPaths: ["src/installer/steps/09-qa-test/**", "tests/steps/09-qa-test.test.ts"],
    categorySuite: ["node --import tsx --test tests/steps/09-qa-test.test.ts"],
  },
  final_test_contract_gap: {
    area: "final-test",
    ownedPaths: ["src/installer/steps/10-final-test/**", "tests/steps/10-final-test.test.ts"],
    categorySuite: ["node --import tsx --test tests/steps/10-final-test.test.ts"],
  },
  design_import_gap: {
    area: "design-import",
    ownedPaths: [
      "scripts/stitch-to-jsx.mjs",
      "scripts/generated-screen-validator.mjs",
      "tests/stitch-to-jsx.test.ts",
      "tests/generated-screen-validator.test.ts",
    ],
    categorySuite: [
      "node --import tsx --test tests/stitch-to-jsx.test.ts tests/generated-screen-validator.test.ts",
      "node --import tsx --test tests/platform-invariants/design-import-invariants.test.ts",
    ],
  },
  mc_projects_visibility_bug: {
    area: "mc",
    ownedPaths: [
      "${MISSION_CONTROL_SOURCE_ROOTS}/src/pages/Projects.tsx",
      "${MISSION_CONTROL_SOURCE_ROOTS}/src/components/projects/**",
    ],
    categorySuite: [],
  },
};

export function ownershipForCategory(category: string): OwnershipEntry | undefined {
  return PLATFORM_SELF_HEAL_OWNERSHIP[category];
}
