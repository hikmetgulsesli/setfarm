# Kimi coding worker thinking default

The existing Setfarm production objective is blocked by a demonstrated model compatibility defect. An already scheduled supervisor request from run `194755e8-d077-43bf-8f90-6d91b285fa90` returned HTTP 400 on 2026-11-08: K3.1 Pro rejects disabled thinking. The owned observation captured `thinking.type=disabled`, `max_tokens=8192`, and the provider's explicit error. The observer closed and verified the same live process and public listeners.

Set the Kimi coding material's `agents.defaults.thinkingDefault` to `low`. The installed OpenClaw resolver honors this explicit default before model heuristics; its Anthropic adapter turns low into enabled thinking with a 2048-token budget. This fits the existing 8192-token request ceiling. This shared material supplies supervisor and implementation workers.

Use the existing material builder, rather than rewriting provider requests or changing argv/profile reconstruction. Keep MiniMax and the readonly control material unchanged. Preserve all model identities, endpoints, credentials, permissions, evidence gates, request/token/time limits and workflow authority. No generated project patch or manual workflow completion is authorized by this fix.

Validation consists of a failing regression against the real material builder, real reconstruction/tamper rejection, focused existing policy/worker tests, TypeScript checks, independent review, and a clean build. Delivery uses the existing sole writer, reviewed PR and normal rollout gates. A unit/build pass does not establish live supervisor completion.

Official model contract: https://www.kimi.com/code/docs/en/kimi-code/models.html#effort-mapping . The documentation and actual response agree that K3.1 Pro rejects disabled thinking. A configured SDK low level is not by itself proof of the provider's effective effort mapping.
