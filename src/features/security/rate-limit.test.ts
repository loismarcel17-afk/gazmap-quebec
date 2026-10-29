import { describe, expect, it } from "vitest";
import { clientAddress, createRateLimiter } from "./rate-limit";

function clock(start = 0) {
  let time = start;
  return { now: () => time, advance: (ms: number) => (time += ms) };
}

describe("createRateLimiter", () => {
  it("allows up to the limit per window, then says when to retry", () => {
    const time = clock();
    const limiter = createRateLimiter({ limit: 3, windowMs: 60_000, now: time.now });
    expect([1, 2, 3].map(() => limiter.check("a").allowed)).toEqual([true, true, true]);
    time.advance(20_000);
    expect(limiter.check("a")).toEqual({ allowed: false, retryAfterS: 40 });
  });

  it("starts a new window once the previous one is over", () => {
    const time = clock();
    const limiter = createRateLimiter({ limit: 1, windowMs: 60_000, now: time.now });
    expect(limiter.check("a").allowed).toBe(true);
    expect(limiter.check("a").allowed).toBe(false);
    time.advance(60_000);
    expect(limiter.check("a").allowed).toBe(true);
  });

  it("counts each address separately", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 60_000, now: clock().now });
    expect(limiter.check("a").allowed).toBe(true);
    expect(limiter.check("b").allowed).toBe(true);
    expect(limiter.check("a").allowed).toBe(false);
  });

  it("keeps memory bounded when many addresses come at once", () => {
    const time = clock();
    const limiter = createRateLimiter({ limit: 1, windowMs: 60_000, maxKeys: 100, now: time.now });
    for (let i = 0; i < 1_000; i++) limiter.check(`ip-${i}`);
    // The newest addresses are still counted…
    expect(limiter.check("ip-999").allowed).toBe(false);
    // …the oldest were forgotten to make room.
    expect(limiter.check("ip-0").allowed).toBe(true);
  });
});

describe("clientAddress", () => {
  it("takes the client from x-forwarded-for, then x-real-ip", () => {
    expect(clientAddress(new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }))).toBe("203.0.113.7");
    expect(clientAddress(new Headers({ "x-real-ip": "203.0.113.8" }))).toBe("203.0.113.8");
    expect(clientAddress(new Headers())).toBe("unknown");
  });
});
