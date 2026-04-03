// Repro: merged Gradle configurations can yield multiple ResolvedDependency trees for the same
// coordinates; init.gradle must pop currentChain after recursion so transitive org.objenesis is not
// dropped when mockito-core is expanded from an incomplete tree first.
//
// Java 17 matches Spring Boot 4 baseline and snyk-gradle-plugin CI (new-versions matrix JDK 17).

plugins {
    java
    application
    id("org.springframework.boot") version "4.0.4"
}

group = "com.snyk.gradle.repro"
version = "0.0.1-SNAPSHOT"

java {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
}

repositories {
    mavenCentral()
}

dependencies {
    implementation(platform(org.springframework.boot.gradle.plugin.SpringBootPlugin.BOM_COORDINATES))

    implementation("org.springframework.boot:spring-boot-starter")
    implementation("org.springframework.boot:spring-boot-starter-web")
    implementation("org.springframework.boot:spring-boot-starter-actuator")

    implementation("com.fasterxml.jackson.module:jackson-module-kotlin:2.+")
    implementation("io.micrometer:micrometer-core:1.+")

    testImplementation(platform(org.springframework.boot.gradle.plugin.SpringBootPlugin.BOM_COORDINATES))
    testImplementation("org.springframework.boot:spring-boot-starter-test")
    testImplementation("org.junit.jupiter:junit-jupiter")
    testImplementation("org.testcontainers:junit-jupiter:1.+")
    // Pin for stable dep-graph assertions (brings org.objenesis:objenesis:3.3).
    testImplementation("org.mockito:mockito-junit-jupiter:5.23.0")
}

application {
    mainClass.set("com.snyk.test.ModernApplication")
}

tasks.test {
    useJUnitPlatform()
}
