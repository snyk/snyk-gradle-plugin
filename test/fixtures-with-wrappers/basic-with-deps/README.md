# Basic with Deps

Simple project with a single dependency

The following dep-tree was generated using the command: `./gradlew dependencies`

```s
\--- com.google.guava:guava:30.1.1-jre
     +--- com.google.guava:failureaccess:1.0.1
     +--- com.google.guava:listenablefuture:9999.0-empty-to-avoid-conflict-with-guava
     +--- com.google.code.findbugs:jsr305:3.0.2
     +--- org.checkerframework:checker-qual:3.8.0
     +--- com.google.errorprone:error_prone_annotations:2.5.1
     \--- com.google.j2objc:j2objc-annotations:1.3
```

Resolved dep-graph: [dep-graph.json](./dep-graph.json)
