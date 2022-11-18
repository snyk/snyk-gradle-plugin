# Basic with Deps

Simple project with a failing dependency. Even if there is one dependency that fails to resolve the others should still be resolved.

The following dep-tree was generated using the command: `./gradlew dependencies`

```s
\--- axis:axis:badVersion-7.7 FAILED
\--- com.google.guava:guava:30.1.1-jre
     +--- com.google.guava:failureaccess:1.0.1
     +--- com.google.guava:listenablefuture:9999.0-empty-to-avoid-conflict-with-guava
     +--- com.google.code.findbugs:jsr305:3.0.2
     +--- org.checkerframework:checker-qual:3.8.0
     +--- com.google.errorprone:error_prone_annotations:2.5.1
     \--- com.google.j2objc:j2objc-annotations:1.3
```
