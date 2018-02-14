import { NextFunction, Response } from "express";
import { RedisOptions, Redis as RedisClient } from "ioredis";
// import { promisify } from "util";
import { rateError } from "../errors";

export default (
  rateId: string,
  redis: RedisClient,
  limit: number,
  expire: number,
  reject: Function,
  resolve: Function
) => {
  const request = "r";

  return redis.llen(rateId, (err, score) => {
    if (err) {
      return reject(err);
    }
    if (score >= limit) {
      return reject(rateError);
    }
    if (!score) {
      return redis
        .multi()
        .rpush(rateId, request)
        .pexpire(rateId, expire)
        .exec((execErr, _) => {
          if (execErr) {
            return reject(execErr);
          }
          return resolve(true);
        });
    }
    return redis.rpushx(rateId, request, (rpushErr, _) => {
      if (rpushErr) {
        return reject(rpushErr);
      }
      return resolve(true);
    });
  });
};
