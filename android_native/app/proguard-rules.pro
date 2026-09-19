# Kotlinx Serialization
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.SerializationKt
-keepclassmembers class * {
    @kotlinx.serialization.SerialName <fields>;
}
-keep class kotlinx.serialization.** { *; }

# FoodCal Models and Remote DTOs
-keep class com.foodcal.app.data.model.** { *; }
-keep class com.foodcal.app.data.remote.** { *; }

# Retrofit
-keepattributes Signature, Exceptions
-keepclasseswithmembers class * {
    @retrofit2.http.* <methods>;
}

# Firebase & Play Services
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }
