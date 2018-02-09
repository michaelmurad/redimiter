import { RedisOptions, Redis as RedisClient } from "ioredis";

export interface Req {
  headers: Object;
  connection: {
    remoteAddress: string;
  };
  ip: string;
}

export interface Res {
  status: Function;
  send: Function;
  end: Function;
}
/**
 * @typedef {object} RateClass A class that has a constructor that takes a redis client and then has several rate limiting methods
 * @property {function} constructor Creates a new instance of RedisRateLimiter
 * @property {function} rateLimiter An express middleware limiter that uses a client's ip address
 */
export default class Redimiter {
  public redisClient: RedisClient;
  public expireMilisecs: number;
  public increaseByInc: number;
  public url: string;
  /**
   *
   * @param redisClient Takes a Redis client as an arg
   */
  constructor(redisClient: RedisClient) {
    if (redisClient) {
      this.redisClient = redisClient;
    } else {
      console.error("You need to add a redis client");
    }
  }
  /**
   * @param {string} url Redis key that will be appended to the ip that will store client request rate. REQUIRED
   * @param {number} [expireMilisecs = 10000] Miliseconds in which the rate limiter will expire after last client request: DEFAULT 10000
   * @param {number} [rateLimit = 10] the limit of requests allowed within the expireMilisecs timeframe. DEFAULT 10
   * @param {number} [increaseByInc = 1] the rate at which the client requests are increased. DEFAULT 1
   * @return {function}
   */
  public rateLimiter = (
    /** Redis key that will be appended to the ip that will store client request rate. REQUIRED */
    url: string,
    /** Miliseconds in which the rate limiter will expire after last client request: DEFAULT 10000 */
    expireMilisecs = 10000,
    /** the limit of requests allowed within the expireMilisecs timeframe. DEFAULT 10 */
    rateLimit = 10,
    /** the rate at which the client requests are increased. DEFAULT 1 */
    increaseByInc = 1
  ) => (req: Req, res: Res, next: Function): Function => {
    if (!url) {
      console.error(
        "you need to add a string parameter to your rateLimiter('url') arg. It will be 'url' until then"
      );
    }
    const key = url || "url";
    const redis: RedisClient = this.redisClient;
    const ip = req.ip;
    if (!ip) {
      res.status(500).send("No ip address");
      return res.end();
    }
    const rateId: string = ip + key;
    console.log(rateId);
    console.log("ip: ", ip);

    // rateId will be the key and its value will be the score we use to compare rateLimit
    // first check to see if value is already out of limit
    return redis
      .get(rateId)
      .then(score => {
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
                error:
                  "You are doing this WAY too much, try again in a few hours"
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
  public resolverRateLimiter: Function = (
    expireMilisecs: number,
    increaseByInc: number,
    rateLimit: number,
    username: string,
    query: string
  ): Promise<null> =>
    new Promise((resolve, reject) => {
      const redis: RedisClient = this.redisClient;
      const rateId: string = username + query;
      console.log(rateId);
      if (!username) {
        reject("there is no user");
      }
      if (!query) {
        reject("there is no query");
      }
      redis
        .get(rateId)
        .then(score => {
          const rateScore = parseInt(score, 10) || 1;
          if (rateScore > rateLimit * 10) {
            redis
              .psetex(rateId, expireMilisecs * 1000, rateScore)
              .then(() => reject("You are doing this way tooo much"))
              .catch(err => reject(err));
          }
          if (rateScore > rateLimit) {
            redis
              .psetex(rateId, expireMilisecs, increaseByInc + rateScore)
              .then(() =>
                reject(
                  "You are doing this way too much, please wait a few minutes."
                )
              )
              .catch(err => err);
          }

          redis
            .psetex(rateId, expireMilisecs, increaseByInc + rateScore)
            .then(() => resolve())
            .catch(err => reject(err));
        })
        .catch(err => reject(err));
    });
}
