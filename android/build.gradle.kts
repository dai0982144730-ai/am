/*
 * Mọi plugin Kotlin và Android khai MỘT chỗ ở đây, để chúng cùng nằm trong một
 * classloader và nhìn thấy nhau (khai rời từng module sẽ lỗi "BaseVariant not found").
 * Plugin Android chỉ khai khi máy có Android SDK, giống settings.gradle.kts.
 */
buildscript {
    val coAndroid = run {
        val sdk = System.getenv("ANDROID_HOME") ?: System.getenv("ANDROID_SDK_ROOT")
        val local = java.io.File(rootDir, "local.properties")
        (sdk != null && java.io.File(sdk).isDirectory) ||
            (local.exists() && local.readText().contains("sdk.dir"))
    }
    repositories {
        mavenCentral()
        gradlePluginPortal()
        if (coAndroid) google()
    }
    dependencies {
        classpath("org.jetbrains.kotlin:kotlin-gradle-plugin:2.0.21")
        classpath("org.jetbrains.kotlin:kotlin-serialization:2.0.21")
        classpath("org.jetbrains.kotlin:compose-compiler-gradle-plugin:2.0.21")
        if (coAndroid) classpath("com.android.tools.build:gradle:8.7.3")
    }
}
