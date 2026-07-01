import { browserGameZeroInteractionIssues, checkBrowserGameStaticContracts } from './browser-game-canvas.mjs';

const STATIC_CONTRACT_CHECKS = [
  checkBrowserGameStaticContracts,
];

const INTERACTION_CHECKS = [
  browserGameZeroInteractionIssues,
];

export function checkStackStaticContracts(repo) {
  return STATIC_CONTRACT_CHECKS.flatMap((check) => check(repo));
}

export function stackZeroInteractionIssues(repo, interactionCount) {
  return INTERACTION_CHECKS.flatMap((check) => check(repo, interactionCount));
}
