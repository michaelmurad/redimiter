import { NextFunction, Response } from "express";
import { RedisOptions, Redis as RedisClient } from "ioredis";
import { promisify } from "util";

const nonOverdrive = (
  rateId: string,
  redis: RedisClient,
  rateLimit: number,
  expireMilisecs: number,
  increaseByInc: number,
  res: Response,
  next: NextFunction
) => {
  const getAsync = promisify(redis.get).bind(redis);
  const psetexAsync = promisify(redis.psetex).bind(redis);
  return getAsync(rateId)
    .then(score => {
      const rateScore: number = parseInt(score, 10) || 1;
      // otherwise this will block the action for a short time and still increment the value
      // and reset the expire time
      if (rateScore > rateLimit) {
        res.status(403).send({
          error: "You are doing this too much, try again in a few minutes"
        });
        return res.end();
      }
      // if the value isn't out of limit then allow action,
      // increment value, and reset expiration time
      return psetexAsync(
        rateId,
        expireMilisecs,
        increaseByInc + rateScore
      ).then(() => next());
    })
    .catch(err => {
      res.status(500).send(err);
      return res.end();
    });
};

export default nonOverdrive;
