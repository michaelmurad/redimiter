export const rateError: Error = {
  name: "Error",
  message: "You are doing this too much, try again in a little bit"
};

export const overdriveRateErr: Error = {
  name: "Error",
  message: "You are doing this WAY too much, try again much later"
};

// CONSTRUCTOR ERRORS
export const constrErr: Error = {
  name: "Error",
  message: "You need to add a redis client"
};

// RATE_LIMITER ERRORS
export const rLPathErr: string = "rateLimiter({ path }) must be a string";

export const rLLimitErr: Error = {
  name: "Error",
  message: "rateLimiter({ limit }) must be a positive int"
};
export const rLExpErr: Error = {
  name: "Error",
  message: "rateLimiter({ expire }) must be a positive int"
};

// RATE_LIMITER_PROMISE ERRORS
export const rLPUsernameErr: Error = {
  name: "Error",
  message: "there is no username, please set options.username"
};
export const rLPActionErr: Error = {
  name: "Error",
  message: "there is no action, please set options.action"
};

export const rLPLimitErr: Error = {
  name: "Error",
  message: "rateLimiterPromise({ limit }) must be a positive int"
};
export const rLPExpErr: Error = {
  name: "Error",
  message: "rateLimiterPromise({ expire }) must be a positive int"
};

export function errorFunc(res, err) {
  res.status(500).send(err);
  return res.end();
}
