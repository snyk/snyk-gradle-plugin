import org.gradle.api.JavaVersion
import org.jetbrains.kotlin.gradle.tasks.KotlinCompile

plugins {
    val kotlinVersion = if (JavaVersion.current().toString() >= "17") "1.8.10" else "1.3.21"
    kotlin("jvm") version kotlinVersion
    kotlin("plugin.spring") version kotlinVersion
    kotlin("plugin.jpa") version kotlinVersion
}

version = "1.0.0-SNAPSHOT"

tasks.withType<KotlinCompile> {
    doFirst {
        if (JavaVersion.current().isJava8Compatible()) {
            kotlinOptions.jvmTarget = "1.8"
        } else {
            kotlinOptions.jvmTarget = "17"
        }
        kotlinOptions.freeCompilerArgs = listOf("-Xjsr305=strict")
    }
}


tasks.withType<Test> {
    useJUnitPlatform()
}

repositories {
    mavenCentral()
}

dependencies {
    implementation("org.jetbrains.kotlin:kotlin-stdlib-jdk8")
    testImplementation("org.jetbrains.kotlin:kotlin-reflect") {
        exclude(module = "junit")
    }
}
