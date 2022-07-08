# Custom Configuration

This project's directory contains a directory ./extraLibs with jar files with 3 direct dependencies. Maven Central is not included in repositories section so the local jar files are used.

([see configurations section in build.gradle](./build.gradle))

The following dep-tree was generated using the command: `gradle dependencies`

```s
extraLibs
+--- org.mockito:mockito-core:4.6.1
+--- org.scala-lang:scala-library:2.13.8
\--- org.slf4j:slf4j-api:+ -> 1.7.36
```

The following dep-tree was generated using the command: `snyk test --print-deps`

```s
extraLibs-proj @ unspecified
   ├─ org.mockito:mockito-core @ 4.6.1
   ├─ org.scala-lang:scala-library @ 2.13.8
   └─ org.slf4j:slf4j-api @ 1.7.36
```

Resolved dep-graph: [dep-graph.json](./dep-graph.json)
