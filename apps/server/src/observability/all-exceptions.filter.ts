import { type ArgumentsHost, Catch, HttpException } from "@nestjs/common";
import { BaseExceptionFilter } from "@nestjs/core";
import { rootLogger } from "./logging.config";
import { reportError } from "./sentry";

/**
 * Global catch-all for the non-oRPC HTTP edges (OAuth callback, liveness,
 * anything mounted straight on Nest). oRPC procedures never reach this
 * filter — the @orpc/nest adapter serialises its own (typed) errors and the
 * ORPCModule onError interceptor logs them.
 *
 * Unexpected throwables are logged through the redacting logger (normalised
 * `err` shape — no cause/response payloads, org policy: no PII/secrets) and
 * reported to Sentry; the response stays Nest's generic 500 body, so no
 * internal detail leaks to clients. HttpExceptions pass through untouched.
 */
@Catch()
export class AllExceptionsFilter extends BaseExceptionFilter {
  override catch(exception: unknown, host: ArgumentsHost) {
    if (!(exception instanceof HttpException)) {
      rootLogger.error({ err: exception }, "unhandled exception");
      reportError(exception);
    }
    super.catch(exception, host);
  }
}
