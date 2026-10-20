import {
  CallHandler,
  ExecutionContext,
  HttpStatus,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { HTTP_CODE_METADATA } from "@nestjs/common/constants";
import { Reflector } from "@nestjs/core";
import { Request, Response } from "express";
import { from, Observable, of, throwError } from "rxjs";
import { catchError, map, mergeMap } from "rxjs/operators";
import { IdempotencyService } from "./idempotency.service";

/**
 * Stripe-style idempotency for POST: a retried request carrying the same
 * Idempotency-Key replays the stored response instead of creating twice —
 * essential on flaky 2G/3G links where the client never saw the first reply.
 *
 *   same key + same request   → stored response, header Idempotent-Replayed
 *   same key + other request  → 422 idempotency_key_reused
 *   same key, first still running → 409 idempotency_key_in_use
 *
 * Failed requests are not stored, so the client can retry them.
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(
    private readonly idempotency: IdempotencyService,
    private readonly reflector: Reflector,
  ) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest<Request>();
    const res = ctx.switchToHttp().getResponse<Response>();
    const key = req.headers["idempotency-key"];
    const client = req.publicApi?.client;
    if (req.method !== "POST" || typeof key !== "string" || !client) {
      return next.handle();
    }

    const status =
      this.reflector.get<number>(HTTP_CODE_METADATA, ctx.getHandler()) ??
      HttpStatus.CREATED;
    const fingerprint = this.idempotency.fingerprint(
      req.method,
      req.originalUrl ?? req.url,
      req.body,
    );

    return from(this.idempotency.begin(client.apiKeyId, key, fingerprint)).pipe(
      mergeMap((outcome) => {
        if (outcome.kind === "replay") {
          res.status(outcome.status);
          res.setHeader("Idempotent-Replayed", "true");
          return of(outcome.body);
        }
        // Store before replying so an immediate retry gets the replay.
        return next.handle().pipe(
          mergeMap((body) =>
            from(
              this.idempotency.complete(outcome.recordId, status, body),
            ).pipe(map(() => body)),
          ),
          catchError((err) => {
            void this.idempotency.release(outcome.recordId);
            return throwError(() => err);
          }),
        );
      }),
    );
  }
}
