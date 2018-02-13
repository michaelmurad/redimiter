import { RedisOptions, Redis as RedisClient } from "ioredis";
import { NextFunction, Response } from "express";
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

  return getAsync(rateId)
    .then((score: string) => {
      const rateScore: number = parseInt(score, 10) || 1;
      console.log("get result: ", rateScore);
      // if the calue is over 10x the value it will simply block it
      if (rateScore > rateLimit * 10) {
        return res.status(403).send({
          error: "You are doing this WAY too much, try again much later"
        });
      }
      // if the value is 10x the limit
      // this will block the action for 1000x the expire time
      if (rateScore === rateLimit * 10) {
        return psetexAsync(rateId, expireMilisecs * 1000, rateScore + 1).then(
          () => {
            res.status(403).send({
              error: "You are doing this WAY too much, try again much later"
            });
            return res.end();
          }
        );
      }
      // otherwise this will block the action for a short time and still increment the value
      // and reset the expire time
      if (rateScore > rateLimit) {
        return psetexAsync(rateId, expireMilisecs, 1 + rateScore).then(() => {
          res.status(403).send({
            error: "You are doing this too much, try again in a little bit"
          });
          return res.end();
        });
      }
      // if the value isn't out of limit then allow action,
      // increment value, and reset expiration time
      return psetexAsync(rateId, expireMilisecs, 1 + rateScore).then(() =>
        next()
      );
    })
    .catch(err => {
      res.status(500).send(err);
      return res.end();
    });
};
