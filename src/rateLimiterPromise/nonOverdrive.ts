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
  // gets the list score
  return redis.llen(rateId, (err, score) => {
    if (err) {
      return reject(err);
    }
    // rate limiter kicks into action
    if (score >= limit) {
      return reject(rateError);
    }
    // if there is no score it creates one and sets expire
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
    // if it exists and is below the limit it ill add an item
    // and increase the score
    return redis.rpushx(rateId, request, (rpushErr, _) => {
      if (rpushErr) {
        return reject(rpushErr);
      }
      return resolve(true);
    });
  });
};
