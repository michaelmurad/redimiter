import { NextFunction, Response } from "express";
import { RedisOptions, Redis as RedisClient } from "ioredis";
// import { promisify } from "util";
import { rateError } from "../errors";

export default (
  rateId: string,
  redis: RedisClient,
  rateLimit: number,
  expireMilisecs: number,
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
      console.log("err");
      return errorFunc(err);
    }
    if (score >= rateLimit) {
      return res.status(403).send(rateError);
    }
    if (!score) {
      return redis
        .multi()
        .rpush(rateId, request)
        .pexpire(rateId, expireMilisecs)
        .exec((execErr, _) => {
          if (execErr) {
            console.log("execErr");
            return errorFunc(execErr);
          }
          return next();
        });
    }
    return redis.rpushx(rateId, request, (rpushErr, _) => {
      if (rpushErr) {
        console.log("rpushErr");
        return errorFunc(rpushErr);
      }
      return next();
    });
  });
};
