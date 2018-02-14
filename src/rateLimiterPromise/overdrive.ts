import { RedisOptions, Redis as RedisClient } from "ioredis";
import { NextFunction, Response } from "express";
import { promisify } from "util";
import { rateError, overdriveRateErr } from "../errors";

export default (
  rateId: string,
  redis: RedisClient,
  limit: number,
  expire: number,
  reject: Function,
  resolve: Function
) => {
  const request = "r";
  // this will get the score (number of requests by rateId)
  return redis.llen(rateId, (err, score) => {
    if (err) {
      return reject(err);
    }
    console.log("get result: ", score);
    // if the score is over 10x the limit it will simply block it
    if (score > limit * 10) {
      console.log("blocked");
      return reject(overdriveRateErr);
    }
    // if the value is 10x the limit
    // this will block the action for 1000x the expire time
    if (score === limit * 10) {
      console.log("ratelimit * 10");
      return redis
        .multi()
        .rpushx(rateId, request)
        .pexpire(rateId, expire * 1000)
        .exec((execErr, _) => {
          if (execErr) {
            console.log("execErr");
            return reject(execErr);
          }
          return reject(overdriveRateErr);
        });
    }
    // otherwise this will block the action and still incr score
    if (score >= limit) {
      console.log("regular block");
      return redis.rpushx(rateId, request, (rpushErr, _) => {
        if (rpushErr) {
          console.log("rpushErr");
          return reject(rpushErr);
        }
        return reject(rateError);
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
