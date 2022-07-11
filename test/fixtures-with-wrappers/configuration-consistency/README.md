# Configuration Consistency

Project using version resolution consistency ([see configurations section in build.gradle](./build.gradle))

Groovy version is managed depending on configurations section in the build.gradle file -> when configuration is respected groovy comes out at version 3.0.1, when it's not respected, it's 3.0.2 (managed from testRuntime scope)

[Gradle docs: resolution consistency](https://docs.gradle.org/7.0/userguide/resolution_strategy_tuning.html#resolution_consistency)

The following dep-tree was generated using the command: `./gradlew dependencies`

```s
+--- org.codehaus.groovy:groovy:3.0.1
+--- com.google.guava:guava:30.1.1-jre
|    +--- com.google.guava:failureaccess:1.0.1
|    +--- com.google.guava:listenablefuture:9999.0-empty-to-avoid-conflict-with-guava
|    +--- com.google.code.findbugs:jsr305:3.0.2
|    +--- org.checkerframework:checker-qual:3.8.0
|    +--- com.google.errorprone:error_prone_annotations:2.5.1
|    \--- com.google.j2objc:j2objc-annotations:1.3
\--- org.codehaus.groovy:groovy:{strictly 3.0.1} -> 3.0.1 (c)
```

Resolved dep-graph: [dep-graph.json](./dep-graph.json)
