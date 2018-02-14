import { RedisOptions, Redis as RedisClient } from "ioredis";
import { NextFunction, Request, Response } from "express";
import { nonOverdrive, overdrive } from "./rateLimiter";
import { nonOverdrivePromise, overdrivePromise } from "./rateLimiterPromise";

export interface RateLimiterOptions {
  /** Redis key that will be appended to the ip that will store client request rate.*/
  path: string;
  /** Miliseconds in which the rate limiter will expire after last client request: DEFAULT 10000 */
  expireMilisecs: number;
  /** the limit of requests allowed within the expireMilisecs timeframe. DEFAULT 10 */
  rateLimit: number;
  /** Allows further rate limiting if client keeps sending requests. DEFAULT false */
  overDrive: boolean;
}
export interface RateLimiterPromiseOptions {
  /** Redis key that will be appended to the ip that will store client request rate.*/
  username: string;
  /** Redis key that will be appended to the ip that will store client request rate.*/
  action: string;
  /** Miliseconds in which the rate limiter will expire after last client request: DEFAULT 10000 */
  expireMilisecs: number;
  /** the limit of requests allowed within the expireMilisecs timeframe. DEFAULT 10 */
  rateLimit: number;
  /** Allows further rate limiting if client keeps sending requests. DEFAULT false */
  overDrive: boolean;
}

/**
 * @typedef {object} RateClass A class that has a constructor that takes a redis client and then has several rate limiting methods
 * @property {function} constructor Creates a new instance of RedisRateLimiter
 * @property {function} rateLimiter An express middleware rate limiter that uses a client's ip address
 */
export default class Redimiter {
  public redisClient: RedisClient;
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

  public rateLimiter = (
    options: RateLimiterOptions = {
      path: Math.round(new Date().getTime() / 1000).toString(),
      expireMilisecs: 1000,
      rateLimit: 10,
      overDrive: false
    }
  ): Function =>
    // {/** Redis key that will be appended to the ip that will store client request rate.*/
    //   path: string = Math.round(new Date().getTime() / 1000).toString(),
    //   /** Miliseconds in which the rate limiter will expire after last client request: DEFAULT 10000 */
    //   expireMilisecs = 1000,
    //   /** the limit of requests allowed within the expireMilisecs timeframe. DEFAULT 10 */
    //   rateLimit = 10,
    //   /** the rate at which the client requests are increased. DEFAULT 1 */
    //   increaseByInc = 1,
    //   /** Allows further rate limiting if client keeps sending requests. DEFAULT false */
    //   overDrive = false}
    (req: Request, res, next: NextFunction): Function => {
      const path =
        options.path || Math.round(new Date().getTime() / 1000).toString();
      const expireMilisecs = options.expireMilisecs || 1000;
      const rateLimit = options.rateLimit || 10;
      const overDrive = options.overDrive;
      let key: string = path;
      if (typeof path !== "string") {
        console.error(
          "you need to add a string parameter to your rateLimiter('url') arg."
        );
        key = key.toString();
      }
      if (typeof expireMilisecs !== "number" || typeof rateLimit !== "number") {
        throw new Error("arg must be a number");
      }
      const redis: RedisClient = this.redisClient;
      const ip = req.ip;
      if (!ip) {
        res.status(500).send("No ip address");
        return res.end();
      }
      const rateId: string = `${ip}:${key}`;
      // rateId will be the key and its value will be the score we use to compare rateLimit
      // first check to see if value is already out of limit
      if (!overDrive) {
        return nonOverdrive(
          rateId,
          redis,
          rateLimit,
          expireMilisecs,
          res,
          next
        );
      }
      return overdrive(rateId, redis, rateLimit, expireMilisecs, res, next);
    };
  public rateLimiterPromise: Function = (
    options: RateLimiterPromiseOptions
  ): Promise<null> =>
    new Promise((resolve, reject) => {
      const redis: RedisClient = this.redisClient;
      const username = options.username;
      const action = options.action;
      const expireMilisecs = options.expireMilisecs || 1000;
      const rateLimit = options.rateLimit || 10;
      if (!username) {
        reject({ error: "there is no username, please set options.username" });
      }
      if (!action) {
        reject({ error: "there is no action, please set options.action" });
      }
      const rateId: string = `${username}:${action}`;
      console.log(rateId);
      if (!options.overDrive) {
        return nonOverdrivePromise(
          rateId,
          redis,
          rateLimit,
          expireMilisecs,
          reject,
          resolve
        );
      }
      return overdrivePromise(
        rateId,
        redis,
        rateLimit,
        expireMilisecs,
        reject,
        resolve
      );
    });
}
