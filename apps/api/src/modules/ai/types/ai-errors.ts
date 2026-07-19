export class AiServiceUnavailableError extends Error {
  readonly code = "AI_SERVICE_UNAVAILABLE";

  constructor(message = "The AI service is unavailable.") {
    super(message);
    this.name = "AiServiceUnavailableError";
  }
}

export class AiServiceTimeoutError extends Error {
  readonly code = "AI_SERVICE_TIMEOUT";

  constructor(message = "The AI service request timed out.") {
    super(message);
    this.name = "AiServiceTimeoutError";
  }
}
