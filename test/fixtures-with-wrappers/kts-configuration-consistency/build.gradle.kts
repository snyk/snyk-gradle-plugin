import org.jetbrains.kotlin.gradle.tasks.KotlinCompile

version = "1.0.0-SNAPSHOT"

plugins {
	val kotlinVersion = "1.3.21"
	id("org.jetbrains.kotlin.jvm") version kotlinVersion
	id("org.jetbrains.kotlin.plugin.spring") version kotlinVersion
	id("org.jetbrains.kotlin.plugin.jpa") version kotlinVersion
}


repositories {
	mavenCentral()
}

dependencies {
	compile("org.jetbrains.kotlin:kotlin-stdlib-jdk8")
	testCompile("org.jetbrains.kotlin:kotlin-reflect") {
		exclude(module = "junit")
	}
}

configurations {
  runtimeClasspath.get().shouldResolveConsistentlyWith(compileClasspath.get())
}
