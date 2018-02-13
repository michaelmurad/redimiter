import { NextFunction, Response } from "express";
import { RedisOptions, Redis as RedisClient } from "ioredis";
// import { promisify } from "util";

export default (
  rateId: string,
  redis: RedisClient,
  rateLimit: number,
  expireMilisecs: number,
  res: Response,
  next: NextFunction
) => {
  const request = "r";

  function errorFunc(err) {
    res.status(500).send(err);
    return res.end();
  }

  return redis.llen(rateId, (err, score) => {
    if (err) {
      console.log("err");
      return errorFunc(err);
    }
    if (score >= rateLimit) {
      return res.status(403).send({
        error: "You are doing this too much, try again in a few minutes"
      });
    }
    if (!score) {
      return redis
        .multi()
        .rpush(rateId, request)
        .pexpire(rateId, expireMilisecs)
        .exec((execErr, _) => {
          if (execErr) {
            console.log("execErr");
            return errorFunc(execErr);
          }
          return next();
        });
    }
    return redis.rpushx(rateId, request, (rpushErr, _) => {
      if (rpushErr) {
        console.log("rpushErr");
        return errorFunc(rpushErr);
      }
      return next();
    });
  });
  // .then(score => {
  //   // if there is no value then incr it and set expire
  //   if (score === null) {
  //     return redis
  //       .multi()
  //       .incr(rateId)
  //       .pexpire(rateId, expireMilisecs)
  //       .exec((err, _) => {
  //         if (err) {
  //           res.status(500).send(err);
  //           return res.end();
  //         }
  //         return next();
  //       });
  //   }
  //   // this will block the action
  //   if (parseInt(score, 10) >= rateLimit) {
  //     res.status(403).send({
  //       error: "You are doing this too much, try again in a few minutes"
  //     });
  //     return res.end();
  //   }
  //   // if the value isn't out of limit then allow action & increment value
  //   return incrAsync(rateId).then(() => next());
  // })
  // .catch(err => {
  //   res.status(500).send(err);
  //   return res.end();
  // });
};
