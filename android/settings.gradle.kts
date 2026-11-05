/*
 * Dự án app Android của Am.
 *
 * Hai module:
 *   :core  Kotlin thuần: gọi cổng API trợ lý, đọc dữ liệu. Build và kiểm thử được
 *          ở bất kỳ máy nào có JDK 17+, kể cả máy không có Android SDK.
 *   :app   Giao diện Android (Jetpack Compose). Chỉ được đưa vào khi máy có
 *          Android SDK (biến ANDROID_HOME, hoặc local.properties có sdk.dir).
 *
 * Tách như vậy để phần logic kiểm được ngay trong phiên đám mây (không tải được
 * Android SDK), còn phần giao diện build trên GitHub Actions.
 */

fun coAndroidSdk(rootDir: java.io.File): Boolean {
    val sdk = System.getenv("ANDROID_HOME") ?: System.getenv("ANDROID_SDK_ROOT")
    if (sdk != null && java.io.File(sdk).isDirectory) return true
    val local = java.io.File(rootDir, "local.properties")
    return local.exists() && local.readText().contains("sdk.dir")
}

pluginManagement {
    repositories {
        gradlePluginPortal()
        mavenCentral()
        // Kho Google chỉ cần cho Android Gradle Plugin và AndroidX
        val sdk = System.getenv("ANDROID_HOME") ?: System.getenv("ANDROID_SDK_ROOT")
        val local = java.io.File(settings.rootDir, "local.properties")
        if ((sdk != null && java.io.File(sdk).isDirectory) ||
            (local.exists() && local.readText().contains("sdk.dir"))
        ) {
            google()
        }
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        mavenCentral()
        if (coAndroidSdk(rootDir)) google()
    }
}

rootProject.name = "am-android"
include(":core")
if (coAndroidSdk(rootDir)) include(":app")
