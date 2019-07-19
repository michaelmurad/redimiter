import { Redis as RedisClient } from "ioredis";

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
    // if there is no score it creates a list, adds an item and sets expire
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
    // if list exists and its item count is below the limit,
    // it will add an itemand increase the score
    return redis.rpushx(rateId, request, (rpushErr, _) => {
      if (rpushErr) {
        return reject(rpushErr);
      }
      return resolve(true);
    });
  });
};
