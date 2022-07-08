# Version catalogs toml

Project using version catalogs in a toml file (gradle/libs.versions.toml)

[Gradle docs: version catalogs](https://docs.gradle.org/current/userguide/platforms.html)

The following dep-tree was generated using the command: `./gradlew dependencies`

```s
+--- org.mockito:mockito-core:4.5.1
|    +--- net.bytebuddy:byte-buddy:1.12.9
|    +--- net.bytebuddy:byte-buddy-agent:1.12.9
|    \--- org.objenesis:objenesis:3.2
+--- org.mockito:mockito-inline:4.5.1
|    \--- org.mockito:mockito-core:4.5.1 (*)
\--- org.junit.jupiter:junit-jupiter:5.8.2
     +--- org.junit:junit-bom:5.8.2
     |    +--- org.junit.jupiter:junit-jupiter:5.8.2 (c)
     |    +--- org.junit.jupiter:junit-jupiter-api:5.8.2 (c)
     |    +--- org.junit.jupiter:junit-jupiter-engine:5.8.2 (c)
     |    +--- org.junit.jupiter:junit-jupiter-params:5.8.2 (c)
     |    +--- org.junit.platform:junit-platform-commons:1.8.2 (c)
     |    \--- org.junit.platform:junit-platform-engine:1.8.2 (c)
     +--- org.junit.jupiter:junit-jupiter-api:5.8.2
     |    +--- org.junit:junit-bom:5.8.2 (*)
     |    +--- org.opentest4j:opentest4j:1.2.0
     |    \--- org.junit.platform:junit-platform-commons:1.8.2
     |         \--- org.junit:junit-bom:5.8.2 (*)
     +--- org.junit.jupiter:junit-jupiter-params:5.8.2
     |    +--- org.junit:junit-bom:5.8.2 (*)
     |    \--- org.junit.jupiter:junit-jupiter-api:5.8.2 (*)
     \--- org.junit.jupiter:junit-jupiter-engine:5.8.2
          +--- org.junit:junit-bom:5.8.2 (*)
          +--- org.junit.platform:junit-platform-engine:1.8.2
          |    +--- org.junit:junit-bom:5.8.2 (*)
          |    +--- org.opentest4j:opentest4j:1.2.0
          |    \--- org.junit.platform:junit-platform-commons:1.8.2 (*)
          \--- org.junit.jupiter:junit-jupiter-api:5.8.2 (*)
```

Resolved dep-graph: [dep-graph.json](./dep-graph.json)
