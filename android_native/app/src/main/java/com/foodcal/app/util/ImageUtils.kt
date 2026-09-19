package com.foodcal.app.util

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.util.Base64
import java.io.ByteArrayOutputStream
import kotlin.math.min

object ImageUtils {
    /**
     * Reads an image Uri from the gallery picker, crops to a center square,
     * scales to 160x160 px, and encodes it as a JPEG data-URL string.
     * This exact format is 100% interoperable with the Web frontend (`users/{uid}.profileImage`).
     */
    fun processProfileImageUri(context: Context, uri: Uri, targetSize: Int = 160): String? {
        return try {
            val inputStream = context.contentResolver.openInputStream(uri) ?: return null
            val original = BitmapFactory.decodeStream(inputStream) ?: return null
            inputStream.close()

            // Center square crop
            val minSide = min(original.width, original.height)
            val cropX = (original.width - minSide) / 2
            val cropY = (original.height - minSide) / 2
            val cropped = Bitmap.createBitmap(original, cropX, cropY, minSide, minSide)

            // Scale to target size
            val scaled = Bitmap.createScaledBitmap(cropped, targetSize, targetSize, true)

            // Compress to JPEG (80% quality)
            val baos = ByteArrayOutputStream()
            scaled.compress(Bitmap.CompressFormat.JPEG, 80, baos)
            val bytes = baos.toByteArray()

            val base64 = Base64.encodeToString(bytes, Base64.NO_WRAP)
            "data:image/jpeg;base64,$base64"
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    /**
     * Decodes a base64 data-URL (e.g. "data:image/jpeg;base64,....") or raw base64 string
     * into an Android [Bitmap]. Returns null if invalid or corrupted.
     */
    fun decodeDataUriToBitmap(dataUri: String?): Bitmap? {
        if (dataUri.isNullOrBlank()) return null
        return try {
            val base64Part = if (dataUri.contains(",")) {
                dataUri.substringAfter(",")
            } else {
                dataUri
            }
            val decodedBytes = Base64.decode(base64Part, Base64.DEFAULT)
            BitmapFactory.decodeByteArray(decodedBytes, 0, decodedBytes.size)
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }
}

