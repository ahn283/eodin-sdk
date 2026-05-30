// Standalone Gradle settings so the library module can be built/tested in CI
// (and locally) without a host app. Consuming apps include this module through
// their own settings.gradle, in which case this file is ignored.
pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
    // build.gradle.kts applies these plugins without a version — supply them here.
    plugins {
        id("com.android.library") version "8.2.1"
        id("org.jetbrains.kotlin.android") version "1.9.10"
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.PREFER_SETTINGS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "eodin-sdk-android"
