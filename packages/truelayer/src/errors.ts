import type { TrueLayerErrorCode, TrueLayerErrorResponse } from "./types.ts";

export class TrueLayerError extends Error {
  readonly code: TrueLayerErrorCode;
  readonly description: string | undefined;

  constructor(code: TrueLayerErrorCode, description?: string) {
    super(description ?? code);
    this.name = "TrueLayerError";
    this.code = code;
    this.description = description;
  }

  static fromResponse(response: TrueLayerErrorResponse): TrueLayerError {
    return new TrueLayerError(response.error as TrueLayerErrorCode, response.error_description);
  }
}
