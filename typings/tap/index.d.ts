// There's still no official type definition
// See https://github.com/tapjs/node-tap/issues/237

// Note that arguments to tap functions are pretty crazy: e.g. you can omit some in the middle.
// Here, most "standard" cases are defined.

declare module 'tap' {

  // Enforce using async tests only, for consistency
  function test(name: string, options: {timeout: number}, asyncfn: (t: Test) => Promise<void>): void;
  function test(name: string, fn: (t: Test) => Promise<void>): void;

  // There are no official type definitions for TAP :(
  // https://github.com/tapjs/node-tap/issues/237

  export interface Test {

    // Subtests
    test(name: string, options: {timeout: number}, fn: (t: Test) => void): void;
    test(name: string, fn: (t: Test) => void): void;

    teardown(fn: () => void): void;

    // Intentionally not including plan. You should use async tests.
    // plan(n: number): void;

    fail(message: string): void;

    // Assertions, see https://node-tap.org/docs/api/asserts/
    ok(value: any, message?: string): void;
    notOk(value: any, message?: string): void;
    equal<T>(actual: T, expected: T, message?: string): void;
    equals<T>(actual: T, expected: T, message?: string): void;
    same<T>(actual: T, expected: T, message: string): void;
    deepEqual<T>(actual: T, expected: T, message?: string): void;
    match(actual: string | undefined, expected: string | RegExp, message: string): void;
    rejects<T>(p: Promise<T>, matcher?: RegExp, message?: string): void;
  }
}