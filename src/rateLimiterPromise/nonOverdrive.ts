import { NextFunction, Response } from "express";
import { RedisOptions, Redis as RedisClient } from "ioredis";
// import { promisify } from "util";
import { rateError } from "../errors";

export default (
  rateId: string,
  redis: RedisClient,
  rateLimit: number,
  expireMilisecs: number,
  reject: Function,
  resolve: Function
) => {
  const request = "r";

  return redis.llen(rateId, (err, score) => {
    if (err) {
      console.log("err");
      return reject(err);
    }
    if (score >= rateLimit) {
      return reject(rateError);
    }
    if (!score) {
      return redis
        .multi()
        .rpush(rateId, request)
        .pexpire(rateId, expireMilisecs)
        .exec((execErr, _) => {
          if (execErr) {
            console.log("execErr");
            return reject(execErr);
          }
          return resolve(true);
        });
    }
    return redis.rpushx(rateId, request, (rpushErr, _) => {
      if (rpushErr) {
        console.log("rpushErr");
        return reject(rpushErr);
      }
      return resolve(true);
    });
  });
};
