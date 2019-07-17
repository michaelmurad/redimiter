import { Redis as RedisClient } from "ioredis";
import { NextFunction, Response } from "express";
import { rateError, overdriveRateErr, errorFunc } from "../errors";

export default (
  rateId: string,
  redis: RedisClient,
  limit: number,
  expire: number,
  res: Response,
  next: NextFunction
) => {
  const request = "r";
  // this will get the score (number of requests by rateId)
  return redis.llen(rateId, (err, score) => {
    if (err) {
      return errorFunc(res, err);
    }
    // if the score is over 10x the limit it will simply block it
    if (score > limit * 10) {
      res.status(403).send(overdriveRateErr);
      return res.end();
    }
    // if the value is 10x the limit
    // this will block the action for 1000x the expire time
    if (score === limit * 10) {
      return redis
        .multi()
        .rpushx(rateId, request)
        .pexpire(rateId, expire * 1000)
        .exec((execErr, _) => {
          if (execErr) {
            return errorFunc(res, execErr);
          }
          res.status(403).send(overdriveRateErr);
          return res.end();
        });
    }
    // otherwise this will block the action and still incr score
    if (score >= limit) {
      return redis.rpushx(rateId, request, (rpushErr, _) => {
        if (rpushErr) {
          return errorFunc(res, rpushErr);
        }
        res.status(403).send(rateError);
        return res.end();
      });
    }
    // allow action and incr score
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
    return redis.rpushx(rateId, request, (rpushErr, _) => {
      if (rpushErr) {
        return errorFunc(res, rpushErr);
      }
      return next();
    });
  });
};
