![Snyk logo](https://snyk.io/style/asset/logo/snyk-print.svg)

---

Snyk helps you find, fix and monitor for known vulnerabilities in your dependencies, both on an ad hoc basis and as part of your CI (Build) system.

| :information_source: This repository is only a plugin to be used with the Snyk CLI tool. To use this plugin to test and fix vulnerabilities in your project, install the Snyk CLI tool first. Head over to [snyk.io](https://github.com/snyk/snyk) to get started. |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |

# Snyk Gradle CLI Plugin

This plugin provides dependency metadata for Gradle projects that use `gradle` and have a `build.gradle` file.

# Documentation

Please refer to the [Snyk for Java](https://docs.snyk.io/products/snyk-open-source/language-and-package-manager-support/snyk-for-java-gradle-maven) documentation

# Support

❌ Not supported
❓ No issues expected but not regularly tested
✅ Supported and verified with tests

## Supported OS

| OS      | Supported |
| ------- | --------- |
| Windows | ✅        |
| Linux   | ✅        |
| OSX     | ️✅        |

## Supported Node versions

| Node | Supported |
| ---- | --------- |
| 20   | ✅        |
| 22   | ✅        |
| 24   | ✅        |


## Supported Gradle versions

| Gradle | Supported |
| ------ | --------- |
| 4      | ✅        |
| 5      | ✅        |
| 6      | ✅        |
| 7      | ✅        |
| 8      | ✅        |
| 9      | ✅        |

# Supported Snyk command line arguments:

- `--gradle-sub-project=foo` return dependencies for a specific subproject (by default, return only the
  dependencies for the top-level project)

Additional command line arguments:

- `--all-sub-projects` for "multi project" configurations, test all sub-projects.

- `--configuration-matching=<string>` Resolve dependencies using only configuration(s) that match the provided Java regular expression, e.g. '^releaseRuntimeClasspath$'.

- `--configuration-attributes=<string>` Select certain values of configuration attributes to resolve the dependencies. E.g.: 'buildtype:release,usage:java-runtime'

## Under the hood

Two Groovy scripts are injected into Gradle builds to gather and resolve the dependencies. Which one is used is decided from `gradle -v`:

| Gradle  | script               | configuration cache      | Isolated Projects | parallel execution |
| ------- | -------------------- | ------------------------ | ----------------- | ------------------ |
| 4 - 8.0 | `lib/init.gradle`    | forced off               | not supported     | forced off         |
| 8.1+    | `lib/init-cc.gradle` | left as the build has it | supported on 8.8+ | left as the build has it |

On 8.1 and above the plugin no longer passes `--no-configuration-cache`. It does not enable the configuration cache either. Whatever the build is already configured to do is what runs. This matters beyond the cache itself: Isolated Projects is built on the configuration cache and cannot run without one, so forcing the cache off used to fail those builds outright, before any dependency was resolved.

It also stops passing `-Dorg.gradle.parallel=` there. That flag existed because `init.gradle` emits from a task action that walks every project, which a parallel build can race into producing more than one result line. `init-cc.gradle` cannot: each project reports itself into a shared build service holding thread-safe state, and a single close emits exactly one line however many projects reported concurrently. Builds that are configured for parallel execution get it.

Below 8.1 the behaviour is unchanged: both flags are still passed.
