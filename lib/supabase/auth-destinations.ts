const loginPages = {
  "/partner": "/partner/login",
  "/account": "/login",
  "/registry/review": "/registry/login",
} as const;

export type AuthDestination = keyof typeof loginPages;

export function isAuthDestination(value: string | null): value is AuthDestination {
  return value !== null && Object.hasOwn(loginPages, value);
}

export function loginPageFor(destination: AuthDestination) {
  return loginPages[destination];
}
