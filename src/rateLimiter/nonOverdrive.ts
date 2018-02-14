import { NextFunction, Response } from "express";
import { RedisOptions, Redis as RedisClient } from "ioredis";
// import { promisify } from "util";
import { rateError } from "../errors";

export default (
  rateId: string,
  redis: RedisClient,
  limit: number,
  expire: number,
  res: Response,
  next: NextFunction
) => {
  const request = "r";

  function errorFunc(err) {
    res.status(500).send(err);
    return res.end();
  }

  return redis.llen(rateId, (err, score) => {
    if (err) {
      return errorFunc(err);
    }
    if (score >= limit) {
      return res.status(403).send(rateError);
    }
    if (!score) {
      return redis
        .multi()
        .rpush(rateId, request)
        .pexpire(rateId, expire)
        .exec((execErr, _) => {
          if (execErr) {
            return errorFunc(execErr);
          }
          return next();
        });
    }
    return redis.rpushx(rateId, request, (rpushErr, _) => {
      if (rpushErr) {
        return errorFunc(rpushErr);
      }
      return next();
    });
  });
};
