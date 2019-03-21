![Snyk logo](https://snyk.io/style/asset/logo/snyk-print.svg)

***

Snyk helps you find, fix and monitor for known vulnerabilities in your dependencies, both on an ad hoc basis and as part of your CI (Build) system.

## Snyk Gradle CLI Plugin

This plugin provides dependency metadata for Gradle projects that use `gradle` and have a `build.gradle` file.

Supported Snyk command line arguments:

* `--gradle-sub-project=foo` return dependencies for a specific subproject (by default, return only the
  dependencies for the top-level project)

Additional command line arguments to Gradle can be provided after `--`, for example:

* `-- --configuration=foo` only fetch dependencies for a certain configuration (by default, merged deps for
  all the configurations are returned).

## Under the hood

See `lib/init.gradle` for the Groovy script injected in Gradle builds to gather and resolve the dependencies.

## Developer notes

Minimum supported version of Node.js is 4.

It does not support ts-node (required to run tests from `.ts` files), so we have to run `.js` tests from `./dist` 
for now.
