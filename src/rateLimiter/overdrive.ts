import { RedisOptions, Redis as RedisClient } from "ioredis";
import { NextFunction, Response } from "express";
import { promisify } from "util";

const overdrive = (
  rateId: string,
  redis: RedisClient,
  rateLimit: number,
  expireMilisecs: number,
  increaseByInc: number,
  res: Response,
  next: Function
) => {
  const getAsync = promisify(redis.get).bind(redis);
  // return redis.options["socket_nodelay"] === undefined ? redis.get(rateId) : getAsync(rateId)
  return redis
    .getAsync(rateId)
    .then((score: string) => {
      const rateScore: number = parseInt(score, 10) || 1;
      console.log("get result: ", rateScore);
      // if the value is x amount greater than the limit
      // this will block the action for quite some time and also stop increasing the value
      // and reset the expire time
      if (rateScore > rateLimit * 10) {
        return redis
          .psetex(rateId, expireMilisecs * 1000, rateScore)
          .then(() => {
            res.status(403).send({
              error: "You are doing this WAY too much, try again in a few hours"
            });
            return res.end();
          });
      }
      // otherwise this will block the action for a short time and still increment the value
      // and reset the expire time
      if (rateScore > rateLimit) {
        return redis
          .psetex(rateId, expireMilisecs, increaseByInc + rateScore)
          .then(() => {
            res.status(403).send({
              error: "You are doing this too much, try again in a few minutes"
            });
            return res.end();
          });
      }
      // if the value isn't out of limit then allow action,
      // increment value, and reset expiration time
      return redis
        .psetex(rateId, expireMilisecs, increaseByInc + rateScore)
        .then(() => next());
    })
    .catch(err => {
      res.status(500).send(err);
      return res.end();
    });
};

export default overdrive;
