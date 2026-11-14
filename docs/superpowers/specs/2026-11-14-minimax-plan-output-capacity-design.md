# MiniMax PLAN Output Capacity

The current playable-game run reached MiniMax PLAN but produced no accepted
plan. The original SDK records for claims 1 and 2 each ended at 8192 output
tokens with all three completion reasons `length`. The strict report decoder
correctly rejected these incomplete reports. This is a Setfarm provider-profile
capacity issue, not evidence of a generated-game defect or provider outage.

The existing genuine MiniMax PLAN `plan-report-v1` profile will allocate 16384
output tokens per request. One policy-owned selector supplies both the SDK
model configuration and parent broker limits, preventing a configuration that
asks for output the broker refuses. The selected facade still derives the
profile from an authenticated PLAN claim; the pure policy selector grants no
runtime authority and accepts no arbitrary budget value.

Normal MiniMax coding, Kimi, and omitted profiles retain 8192. The aggregate
524288 reservation budget, 128 request ceiling, byte limits, attempt/request/
idle deadlines, adaptive low-effort thinking, sandbox, custody and strict
completion decoder remain unchanged. Reserving 16384 per request means that
the same aggregate budget admits at most 32 full reservations instead of 64.

MiniMax documents that thinking counts toward `max_tokens` and that this model
always thinks. The API supports this allocation; no provider probe is needed.
Sources: [Anthropic API compatibility](https://platform.minimax.io/docs/api-reference/text-anthropic-api)
and [Create Message](https://platform.minimax.io/docs/api-reference/text-chat-anthropic).
No reasoning-versus-visible-output split is inferred from the actual records.

Focused regressions must catch SDK/broker allocation drift, protect unchanged
defaults and other limits, and exercise the real worker reconstruction and
tampered-material refusal. A passing regression does not qualify the game or
the full workflow. A reviewed clean build and a new native game run are needed
to observe the fix; existing run evidence remains intact.
