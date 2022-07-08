# Using a lock file

[Gradle docs: locking dependency versions](https://docs.gradle.org/current/userguide/dependency_locking.html)

The following dep-tree was generated using the command: `./gradlew dependencies`

```s
runtimeClasspath - Runtime classpath of source set 'main'.
+--- org.codehaus.groovy:groovy:[3.0.0,3.0.4) -> 3.0.3
+--- com.google.guava:guava:+ -> 31.1-jre
|    +--- com.google.guava:failureaccess:1.0.1
|    +--- com.google.guava:listenablefuture:9999.0-empty-to-avoid-conflict-with-guava
|    +--- com.google.code.findbugs:jsr305:3.0.2
|    +--- org.checkerframework:checker-qual:3.12.0
|    +--- com.google.errorprone:error_prone_annotations:2.11.0
|    \--- com.google.j2objc:j2objc-annotations:1.3
+--- com.google.guava:guava:{strictly 31.1-jre} -> 31.1-jre (c)
+--- org.codehaus.groovy:groovy:{strictly 3.0.3} -> 3.0.3 (c)
+--- com.google.guava:failureaccess:{strictly 1.0.1} -> 1.0.1 (c)
+--- com.google.guava:listenablefuture:{strictly 9999.0-empty-to-avoid-conflict-with-guava} -> 9999.0-empty-to-avoid-conflict-with-guava (c)
+--- com.google.code.findbugs:jsr305:{strictly 3.0.2} -> 3.0.2 (c)
+--- org.checkerframework:checker-qual:{strictly 3.12.0} -> 3.12.0 (c)
+--- com.google.errorprone:error_prone_annotations:{strictly 2.11.0} -> 2.11.0 (c)
\--- com.google.j2objc:j2objc-annotations:{strictly 1.3} -> 1.3 (c)
```

Resolved dep-graph: [dep-graph.json](./dep-graph.json)
