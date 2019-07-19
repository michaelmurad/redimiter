import { Redis as RedisClient } from "ioredis";
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
    // if the score is over 10x the limit it will simply block it
    if (score > limit * 10) {
      return reject(overdriveRateErr);
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
            return reject(execErr);
          }
          return reject(overdriveRateErr);
        });
    }
    // otherwise this will block the action and still incr score
    if (score >= limit) {
      return redis.rpushx(rateId, request, (rpushErr, _) => {
        if (rpushErr) {
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
