export const rateError = {
  name: "Error",
  message: "You are doing this too much, try again in a little bit"
};

export const overdriveRateErr = {
  name: "Error",
  message: "You are doing this WAY too much, try again much later"
};

// CONSTRUCTOR ERRORS
export const constrErr: Error = new Error("You need to add a redis client");

// RATE_LIMITER ERRORS
export const rLPathErr: Error = new Error(
  "rateLimiter({ path }) must be a string"
);

export const rLLimitErr: Error = new Error(
  "rateLimiter({ limit }) must be a positive int"
);

export const rLExpErr: Error = new Error(
  "rateLimiter({ expire }) must be a positive int"
);

// RATE_LIMITER_PROMISE ERRORS
export const rLPUsernameErr: Error = new Error(
  "there is no username, please set options.username"
);

export const rLPActionErr: Error = new Error(
  "there is no action, please set options.action"
);

export const rLPLimitErr: Error = new Error(
  "rateLimiterPromise({ limit }) must be a positive int"
);

export const rLPExpErr: Error = new Error(
  "rateLimiterPromise({ expire }) must be a positive int"
);

export function errorFunc(res, err) {
  res.status(500).send(err);
  return res.end();
}
