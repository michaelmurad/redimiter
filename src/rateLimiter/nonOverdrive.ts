import { NextFunction, Response } from "express";
import { RedisOptions, Redis as RedisClient } from "ioredis";
import { promisify } from "util";

export default (
  rateId: string,
  redis: RedisClient,
  rateLimit: number,
  expireMilisecs: number,
  res: Response,
  next: NextFunction
) => {
  const getAsync = promisify(redis.get).bind(redis);
  const psetexAsync = promisify(redis.psetex).bind(redis);
  const execAsync = promisify(redis.exec).bind(redis);
  const incrAsync = promisify(redis.incr).bind(redis);
  return getAsync(rateId)
    .then(score => {
      // this will block the action
      if (score !== null && parseInt(score, 10) >= rateLimit) {
        res.status(403).send({
          error: "You are doing this too much, try again in a few minutes"
        });
        return res.end();
      }
      // if there is no value then incr it and set expire
      if (score === null) {
        return redis
          .multi()
          .incr(rateId)
          .pexpire(rateId, expireMilisecs)
          .exec((err, _) => {
            if (err) {
              res.status(500).send(err);
              return res.end();
            }
            return next();
          });
      }
      // if the value isn't out of limit then allow action & increment value
      return incrAsync(rateId).then(() => next());
    })
    .catch(err => {
      res.status(500).send(err);
      return res.end();
    });
};
