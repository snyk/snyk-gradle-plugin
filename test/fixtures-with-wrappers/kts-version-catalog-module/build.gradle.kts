plugins {
    `version-catalog`
    `maven-publish`
}

group = "snyk.fixtures.versionCatalog"
version = "1.0"

repositories {
    mavenLocal()
}

catalog {
    versionCatalog {
        version("kotlin", "1.9.10")
        version("jvm", "17")

        plugin("kotlin-lang", "org.jetbrains.kotlin.jvm").versionRef("kotlin")
        plugin("kotlin-kapt", "org.jetbrains.kotlin.kapt").versionRef("kotlin")
        plugin("kotlin-allopen", "org.jetbrains.kotlin.plugin.allopen").versionRef("kotlin")

        library("kotlin-reflect", "org.jetbrains.kotlin", "kotlin-reflect").versionRef("kotlin")
        library("kotlin-stdlib", "org.jetbrains.kotlin", "kotlin-stdlib-jdk8").versionRef("kotlin")
        library("kotlinlogging", "io.github.microutils:kotlin-logging-jvm:2.1.23")
        library("logback", "ch.qos.logback:logback-classic:1.2.11")
    }
}

publishing {
    publications {
        create<MavenPublication>("maven") {
            from(components["versionCatalog"])
        }
    }
}
