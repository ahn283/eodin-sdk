plugins {
    id("com.android.library")
    id("org.jetbrains.kotlin.android")
    id("maven-publish")
}

android {
    // v2.0.0: namespace was 'app.eodin.deeplink' but the module also contains
    // analytics (app.eodin.analytics.*). Promoted to 'app.eodin' to match
    // the unified SDK scope.
    namespace = "app.eodin"
    compileSdk = 34

    defaultConfig {
        minSdk = 21

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        consumerProguardFiles("consumer-rules.pro")
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_1_8
        targetCompatibility = JavaVersion.VERSION_1_8
    }

    kotlinOptions {
        jvmTarget = "1.8"
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.12.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3")

    testImplementation("junit:junit:4.13.2")
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.7.3")
    testImplementation("io.mockk:mockk:1.13.8")

    androidTestImplementation("androidx.test.ext:junit:1.1.5")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.5.1")
}

publishing {
    publications {
        register<MavenPublication>("release") {
            // v2.0.0: artifactId was 'deeplink-sdk' but module is unified SDK.
            // Renamed to 'eodin-sdk' to match Flutter (eodin_sdk) and
            // npm (@eodin/capacitor) naming conventions.
            groupId = "app.eodin"
            artifactId = "eodin-sdk"
            version = "2.0.0-beta.1"

            afterEvaluate {
                from(components["release"])
            }
        }
    }
}
