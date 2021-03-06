import { NextFunction, Response } from "express";
import { Redis as RedisClient } from "ioredis";
import { rateError, errorFunc } from "../errors";

export default (
  rateId: string,
  redis: RedisClient,
  limit: number,
  expire: number,
  res: Response,
  next: NextFunction
) => {
  const request = "r";
  // gets the list score
  return redis.llen(rateId, (err, score) => {
    if (err) {
      return errorFunc(res, err);
    }
    // rate limiter kicks into action
    if (score >= limit) {
      return res.status(403).send(rateError);
    }
    // if there is no score it creates a list, adds an item and sets expire
    if (!score) {
      return redis
        .multi()
        .rpush(rateId, request)
        .pexpire(rateId, expire)
        .exec((execErr, _) => {
          if (execErr) {
            return errorFunc(res, execErr);
          }
          return next();
        });
    }
    // if list exists and its item count is below the limit,
    // it will add an itemand increase the score
    return redis.rpushx(rateId, request, (rpushErr, _) => {
      if (rpushErr) {
        return errorFunc(res, rpushErr);
      }
      return next();
    });
  });
};
