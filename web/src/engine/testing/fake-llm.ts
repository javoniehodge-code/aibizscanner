import type { LlmClient, LlmRequest, LlmResponse } from "../llm";
import type { JsonValue, Usage } from "../types";

/**
 * Test double for LlmClient: answers from recorded responses, so processing tests run in CI with no API cost.
 * `respond` gets the exact request and returns the model's text (or throws to simulate a provider error).
 */
export class FakeLlmClient implements LlmClient {
  readonly requests: LlmRequest[] = [];
  constructor(
    private readonly respond: (request: LlmRequest) => string,
    private readonly usage: Usage = { tokensIn: 100, tokensOut: 20, searchCalls: 0, requests: 1 },
  ) {}
  async complete(request: LlmRequest): Promise<LlmResponse> {
    this.requests.push(request);
    const text = this.respond(request);
    return { text, raw: { fake: true, text } as JsonValue, usage: this.usage, requestId: `fake-${this.requests.length}`, servedModel: request.model };
  }
}
