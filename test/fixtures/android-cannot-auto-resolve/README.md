# android-cannot-auto-resolve
An Android application where dependencies cannot be automatically resolved in merged configurations.

Includes flavor dimensions.

The project should be testable with the newer versions of Snyk CLI with

    snyk test --all-sub-projects --configuration-attributes=buildtype:release,usage:java-runtime,myflavor:local

In order to build this project, you would need Android SDK (and configured `ANDROID_HOME` variable).

Run `npm run test-manual` to test locally.