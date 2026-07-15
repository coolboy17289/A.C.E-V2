import type { Request, Response, NextFunction, RequestHandler } from 'express';

/** Wraps an async handler so thrown errors reach the Express error middleware. */
export function ah(handler: (req: Request, res: Response) => Promise<unknown> | unknown): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(handler(req, res)).catch(next);
  };
}
