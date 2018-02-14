import { RedisOptions, Redis as RedisClient } from "ioredis";
import { NextFunction, Request, Response } from "express";
import { nonOverdrive, overDrive } from "./rateLimiter";
import { nonOverdrivePromise, overdrivePromise } from "./rateLimiterPromise";

export interface RateLimiterOptions {
  /** Redis key that will be appended to the ip that will store client request rate.*/
  path: string;
  /** Miliseconds in which the rate limiter will expire after last client request: DEFAULT 10000 */
  expire: number;
  /** the limit of requests allowed within the expire timeframe. DEFAULT 10 */
  limit: number;
  /** Allows further rate limiting if client keeps sending requests. DEFAULT false */
  overdrive: boolean;
}
export interface RateLimiterPromiseOptions {
  /** Redis key that will be appended to the ip that will store client request rate.*/
  username: string;
  /** Redis key that will be appended to the ip that will store client request rate.*/
  action: string;
  /** Miliseconds in which the rate limiter will expire after last client request: DEFAULT 10000 */
  expire: number;
  /** the limit of requests allowed within the expire timeframe. DEFAULT 10 */
  limit: number;
  /** Allows further rate limiting if client keeps sending requests. DEFAULT false */
  overdrive: boolean;
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
      expire: 1000,
      limit: 10,
      overdrive: false
    }
  ): Function =>
    // {/** Redis key that will be appended to the ip that will store client request rate.*/
    //   path: string = Math.round(new Date().getTime() / 1000).toString(),
    //   /** Miliseconds in which the rate limiter will expire after last client request: DEFAULT 10000 */
    //   expire = 1000,
    //   /** the limit of requests allowed within the expire timeframe. DEFAULT 10 */
    //   limit = 10,
    //   /** the rate at which the client requests are increased. DEFAULT 1 */
    //   increaseByInc = 1,
    //   /** Allows further rate limiting if client keeps sending requests. DEFAULT false */
    //   overdrive = false}
    (req: Request, res, next: NextFunction): Function => {
      const path =
        options.path || Math.round(new Date().getTime() / 1000).toString();
      const expire = options.expire || 1000;
      const limit = options.limit || 10;
      const overdrive = options.overdrive;
      let key: string = path;
      if (typeof path !== "string") {
        console.error(
          "you need to add a string parameter to your rateLimiter('url') arg."
        );
        key = key.toString();
      }
      if (typeof expire !== "number" || typeof limit !== "number") {
        throw new Error("arg must be a number");
      }
      const redis: RedisClient = this.redisClient;
      const ip = req.ip;
      if (!ip) {
        res.status(500).send("No ip address");
        return res.end();
      }
      const rateId: string = `${ip}:${key}`;
      // rateId will be the key and its value will be the score we use to compare limit
      // first check to see if value is already out of limit
      if (!overdrive) {
        return nonOverdrive(rateId, redis, limit, expire, res, next);
      }
      return overDrive(rateId, redis, limit, expire, res, next);
    };
  public rateLimiterPromise: Function = (
    options: RateLimiterPromiseOptions
  ): Promise<null> =>
    new Promise((resolve, reject) => {
      const redis: RedisClient = this.redisClient;
      const username = options.username;
      const action = options.action;
      const expire = options.expire || 1000;
      const limit = options.limit || 10;
      if (!username) {
        reject({ error: "there is no username, please set options.username" });
      }
      if (!action) {
        reject({ error: "there is no action, please set options.action" });
      }
      const rateId: string = `${username}:${action}`;
      console.log(rateId);
      if (!options.overdrive) {
        return nonOverdrivePromise(
          rateId,
          redis,
          limit,
          expire,
          reject,
          resolve
        );
      }
      return overdrivePromise(rateId, redis, limit, expire, reject, resolve);
    });
}
