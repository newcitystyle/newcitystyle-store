plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}
android {
    namespace = "store.newcitystyle.universalpro"
    compileSdk = 35
    defaultConfig {
        applicationId = "store.newcitystyle.universalpro"
        minSdk = 26
        targetSdk = 35
        versionCode = 23
        versionName = "2.3.0-native-command-center"
    }
    // Signing material is supplied only through encrypted GitHub Actions secrets.
    // No private keys, signing passwords or release certificates enter Git history.
    signingConfigs {
        create("ncsRelease") {
            val signingPath = System.getenv("NCS_ANDROID_RELEASE_KEYSTORE")
            if (!signingPath.isNullOrBlank()) {
                storeFile = file(signingPath)
                storePassword = System.getenv("NCS_ANDROID_RELEASE_STORE_PASSWORD")
                keyAlias = System.getenv("NCS_ANDROID_RELEASE_KEY_ALIAS")
                keyPassword = System.getenv("NCS_ANDROID_RELEASE_KEY_PASSWORD")
            }
        }
    }
    buildTypes {
        debug { applicationIdSuffix = ".syncpreview" }
        release {
            isMinifyEnabled = false
            if (!System.getenv("NCS_ANDROID_RELEASE_KEYSTORE").isNullOrBlank()) {
                signingConfig = signingConfigs.getByName("ncsRelease")
            }
        }
    }
    compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
    kotlinOptions { jvmTarget = "17" }
    buildFeatures { compose = true }
}
dependencies {
    implementation(platform("androidx.compose:compose-bom:2024.10.01"))
    implementation("androidx.activity:activity-compose:1.9.3")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")
    implementation("androidx.compose.foundation:foundation")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("io.coil-kt:coil-compose:2.7.0")
    debugImplementation("androidx.compose.ui:ui-tooling")
}
