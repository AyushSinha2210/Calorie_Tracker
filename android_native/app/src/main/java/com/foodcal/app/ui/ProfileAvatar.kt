package com.foodcal.app.ui

import android.graphics.Bitmap
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.foodcal.app.util.ImageUtils

/**
 * Universal Profile Avatar Composable that reliably handles:
 * 1. Base64 data-URIs ("data:image/jpeg;base64,...") decoded into Bitmaps
 * 2. Remote HTTP/HTTPS & Content URLs via Coil AsyncImage
 * 3. Initial character or default Person icon fallback
 */
@Composable
fun ProfileAvatar(
    imageSource: String?,
    displayName: String?,
    modifier: Modifier = Modifier,
    iconSize: Dp = 24.dp
) {
    val cleanSource = imageSource?.trim().orEmpty()
    val decodedBitmap: Bitmap? = remember(cleanSource) {
        if (cleanSource.startsWith("data:image/") || (cleanSource.length > 100 && !cleanSource.startsWith("http"))) {
            ImageUtils.decodeDataUriToBitmap(cleanSource)
        } else {
            null
        }
    }

    Box(
        modifier = modifier
            .clip(CircleShape)
            .background(ColorDarkSurface2),
        contentAlignment = Alignment.Center
    ) {
        when {
            decodedBitmap != null -> {
                Image(
                    bitmap = decodedBitmap.asImageBitmap(),
                    contentDescription = "Profile Photo",
                    modifier = Modifier
                        .fillMaxSize()
                        .clip(CircleShape),
                    contentScale = ContentScale.Crop
                )
            }
            cleanSource.startsWith("http://") || cleanSource.startsWith("https://") || cleanSource.startsWith("content://") -> {
                AsyncImage(
                    model = cleanSource,
                    contentDescription = "Profile Photo",
                    modifier = Modifier
                        .fillMaxSize()
                        .clip(CircleShape),
                    contentScale = ContentScale.Crop
                )
            }
            else -> {
                val initial = displayName?.trim()?.take(1)?.uppercase().orEmpty()
                if (initial.isNotBlank()) {
                    Text(
                        text = initial,
                        style = MaterialTheme.typography.titleLarge.copy(
                            fontWeight = FontWeight.Bold,
                            fontSize = (iconSize.value * 0.75).sp
                        ),
                        color = ColorBrandEmerald
                    )
                } else {
                    Icon(
                        Icons.Default.Person,
                        contentDescription = "Profile",
                        tint = ColorBrandEmerald,
                        modifier = Modifier.size(iconSize)
                    )
                }
            }
        }
    }
}

