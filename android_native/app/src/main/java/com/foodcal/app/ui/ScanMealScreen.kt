package com.foodcal.app.ui

import android.Manifest
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.provider.Settings
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageCapture
import androidx.camera.core.ImageCaptureException
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.FlashOff
import androidx.compose.material.icons.filled.FlashOn
import androidx.compose.material.icons.filled.FlipCameraAndroid
import androidx.compose.material.icons.filled.PhotoLibrary
import androidx.compose.material.icons.filled.Remove
import androidx.compose.material.icons.outlined.AutoAwesome
import androidx.compose.material.icons.outlined.Check
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.LocalLifecycleOwner
import coil.compose.AsyncImage
import com.foodcal.app.data.model.CANONICAL_MEAL_TYPES
import com.foodcal.app.data.model.FoodLogEntry
import com.foodcal.app.data.model.NutritionItem
import com.foodcal.app.data.model.ScanMealResponse
import com.foodcal.app.data.model.detectMealType
import kotlinx.coroutines.delay
import java.io.File
import java.io.FileOutputStream
import java.io.InputStream
import java.time.LocalDate

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ScanMealScreen(
    viewModel: MainViewModel,
    onClose: () -> Unit,
    onMealSaved: () -> Unit
) {
    BackHandler { onClose() }

    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current

    var hasCameraPermission by remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED
        )
    }

    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        hasCameraPermission = granted
    }

    LaunchedEffect(Unit) {
        if (!hasCameraPermission) {
            permissionLauncher.launch(Manifest.permission.CAMERA)
        }
    }

    var cameraProvider by remember { mutableStateOf<ProcessCameraProvider?>(null) }
    var imageCapture by remember { mutableStateOf<ImageCapture?>(null) }
    var previewViewInstance by remember { mutableStateOf<PreviewView?>(null) }
    var lensFacing by remember { mutableStateOf(CameraSelector.LENS_FACING_BACK) }
    var flashEnabled by remember { mutableStateOf(false) }

    var capturedFile by remember { mutableStateOf<File?>(null) }
    var isScanning by remember { mutableStateOf(false) }
    var scanError by remember { mutableStateOf<String?>(null) }
    var scanResult by remember { mutableStateOf<ScanMealResponse?>(null) }
    var showColdStartNotice by remember { mutableStateOf(false) }

    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    // Render cold-start helper: show helpful message after 8s of waiting
    LaunchedEffect(isScanning) {
        if (isScanning) {
            showColdStartNotice = false
            delay(8000)
            showColdStartNotice = true
        } else {
            showColdStartNotice = false
        }
    }

    // Toggle flash via imageCapture directly without rebinding camera
    LaunchedEffect(flashEnabled, imageCapture) {
        imageCapture?.flashMode = if (flashEnabled) ImageCapture.FLASH_MODE_ON else ImageCapture.FLASH_MODE_OFF
    }

    // Bind camera only when lensFacing or previewViewInstance changes
    LaunchedEffect(cameraProvider, previewViewInstance, lensFacing) {
        val provider = cameraProvider ?: return@LaunchedEffect
        val previewView = previewViewInstance ?: return@LaunchedEffect
        bindCamera(provider, previewView, lensFacing, lifecycleOwner) { capture ->
            imageCapture = capture
        }
    }

    DisposableEffect(Unit) {
        onDispose {
            cameraProvider?.unbindAll()
        }
    }

    val galleryLauncher = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri: Uri? ->
        if (uri != null) {
            val file = copyUriToTempFile(context, uri)
            if (file != null) {
                capturedFile = file
                startScan(viewModel, file, onScanning = { isScanning = true }, onSuccess = {
                    isScanning = false
                    scanResult = it
                }, onError = {
                    isScanning = false
                    scanError = it
                })
            }
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black)
    ) {
        if (hasCameraPermission) {
            // Camera Preview View
            AndroidView(
                modifier = Modifier.fillMaxSize(),
                factory = { ctx ->
                    val pv = PreviewView(ctx)
                    previewViewInstance = pv
                    val future = ProcessCameraProvider.getInstance(ctx)
                    future.addListener({
                        cameraProvider = future.get()
                    }, ContextCompat.getMainExecutor(ctx))
                    pv
                },
                update = {}
            )
        } else {
            // Permission request view
            val activity = context as? Activity
            val shouldShowRationale = activity?.let {
                ActivityCompat.shouldShowRequestPermissionRationale(it, Manifest.permission.CAMERA)
            } ?: false

            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(32.dp),
                verticalArrangement = Arrangement.Center,
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text(
                    "Camera Access Needed",
                    style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold),
                    color = Color.White
                )
                Spacer(modifier = Modifier.height(10.dp))
                Text(
                    "To instantly scan your food with AI, FoodCal needs permission to use your camera.",
                    color = ColorDarkMuted,
                    textAlign = TextAlign.Center
                )
                Spacer(modifier = Modifier.height(20.dp))
                if (shouldShowRationale || !hasCameraPermission) {
                    Button(
                        onClick = { permissionLauncher.launch(Manifest.permission.CAMERA) },
                        colors = ButtonDefaults.buttonColors(containerColor = ColorBrandEmerald)
                    ) {
                        Text("Grant Camera Permission", color = Color(0xFF042F1A), fontWeight = FontWeight.Bold)
                    }
                } else {
                    Button(
                        onClick = {
                            val intent = Intent(
                                Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                                Uri.fromParts("package", context.packageName, null)
                            )
                            context.startActivity(intent)
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = ColorBrandEmerald)
                    ) {
                        Text("Open Settings", color = Color(0xFF042F1A), fontWeight = FontWeight.Bold)
                    }
                }
            }
        }

        // Viewfinder Frame Outline (Adaptive with BoxWithConstraints)
        BoxWithConstraints(
            modifier = Modifier.fillMaxSize(),
            contentAlignment = Alignment.Center
        ) {
            val frameSize = minOf(maxWidth * 0.78f, maxHeight * 0.58f, 320.dp)
            Box(
                modifier = Modifier
                    .size(frameSize)
                    .clip(RoundedCornerShape(32.dp))
                    .border(2.dp, Color.White.copy(alpha = 0.5f), RoundedCornerShape(32.dp))
            )
        }

        // Top Actions (Close, Flash, Flip)
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .statusBarsPadding()
                .padding(horizontal = 16.dp, vertical = 10.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            IconButton(
                onClick = onClose,
                modifier = Modifier
                    .clip(CircleShape)
                    .background(Color.Black.copy(alpha = 0.5f))
            ) {
                Icon(Icons.Default.Close, contentDescription = "Close", tint = Color.White)
            }

            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                IconButton(
                    onClick = { flashEnabled = !flashEnabled },
                    modifier = Modifier
                        .clip(CircleShape)
                        .background(Color.Black.copy(alpha = 0.5f))
                ) {
                    Icon(
                        if (flashEnabled) Icons.Default.FlashOn else Icons.Default.FlashOff,
                        contentDescription = "Flash",
                        tint = if (flashEnabled) ColorBrandLime else Color.White
                    )
                }

                IconButton(
                    onClick = {
                        lensFacing = if (lensFacing == CameraSelector.LENS_FACING_BACK)
                            CameraSelector.LENS_FACING_FRONT
                        else
                            CameraSelector.LENS_FACING_BACK
                    },
                    modifier = Modifier
                        .clip(CircleShape)
                        .background(Color.Black.copy(alpha = 0.5f))
                ) {
                    Icon(Icons.Default.FlipCameraAndroid, contentDescription = "Flip Camera", tint = Color.White)
                }
            }
        }

        // Bottom Controls Bar
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .align(Alignment.BottomCenter)
                .background(Color.Black.copy(alpha = 0.6f))
                .navigationBarsPadding()
                .padding(vertical = 24.dp, horizontal = 40.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Gallery Picker
            IconButton(
                onClick = { galleryLauncher.launch("image/*") },
                modifier = Modifier
                    .size(52.dp)
                    .clip(CircleShape)
                    .background(ColorDarkSurface)
            ) {
                Icon(Icons.Default.PhotoLibrary, contentDescription = "Select from gallery", tint = Color.White)
            }

            // Capture Shutter Button
            Box(
                modifier = Modifier
                    .size(80.dp)
                    .clip(CircleShape)
                    .border(4.dp, Color.White, CircleShape)
                    .padding(6.dp)
                    .clip(CircleShape)
                    .background(ColorBrandEmerald)
                    .clickable {
                        val capture = imageCapture ?: return@clickable
                        val photoFile = File.createTempFile("meal_capture_", ".jpg", context.cacheDir)
                        val outputOptions = ImageCapture.OutputFileOptions.Builder(photoFile).build()

                        capture.takePicture(
                            outputOptions,
                            ContextCompat.getMainExecutor(context),
                            object : ImageCapture.OnImageSavedCallback {
                                override fun onImageSaved(output: ImageCapture.OutputFileResults) {
                                    capturedFile = photoFile
                                    startScan(viewModel, photoFile, onScanning = { isScanning = true }, onSuccess = {
                                        isScanning = false
                                        scanResult = it
                                    }, onError = {
                                        isScanning = false
                                        scanError = it
                                    })
                                }

                                override fun onError(exc: ImageCaptureException) {
                                    scanError = "Failed to take photo: ${exc.message}"
                                }
                            }
                        )
                    },
                contentAlignment = Alignment.Center
            ) {
                Icon(Icons.Outlined.AutoAwesome, contentDescription = "Scan", tint = Color(0xFF042F1A), modifier = Modifier.size(32.dp))
            }

            // Placeholder to keep shutter centered
            Spacer(modifier = Modifier.size(52.dp))
        }

        // Scanning Overlay (Laser animation & loader)
        if (isScanning && capturedFile != null) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Color.Black.copy(alpha = 0.85f))
            ) {
                // Show captured photo preview
                AsyncImage(
                    model = capturedFile,
                    contentDescription = "Meal scanning",
                    modifier = Modifier.fillMaxSize(),
                    contentScale = ContentScale.Crop
                )

                // Laser scan sweep
                ScanLaserOverlay(modifier = Modifier.fillMaxSize())

                // Scanning card
                Column(
                    modifier = Modifier
                        .align(Alignment.BottomCenter)
                        .navigationBarsPadding()
                        .padding(bottom = 40.dp, start = 20.dp, end = 20.dp)
                        .clip(RoundedCornerShape(20.dp))
                        .background(ColorDarkSurface.copy(alpha = 0.95f))
                        .border(1.dp, ColorBrandEmerald, RoundedCornerShape(20.dp))
                        .padding(horizontal = 24.dp, vertical = 18.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    CircularProgressIndicator(color = ColorBrandLime, modifier = Modifier.size(28.dp), strokeWidth = 3.dp)
                    Text(
                        "Analyzing meal with Gemini AI...",
                        style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                        color = Color.White
                    )
                    Text(
                        if (showColdStartNotice)
                            "Waking up the server... Free tier initial response can take up to 60s."
                        else
                            "Identifying food items, calories, macros & health score",
                        style = MaterialTheme.typography.bodySmall,
                        color = if (showColdStartNotice) ColorBrandLime else ColorDarkMuted,
                        textAlign = TextAlign.Center
                    )
                }
            }
        }

        // Error Dialog
        if (scanError != null) {
            Box(
                modifier = Modifier
                    .align(Alignment.Center)
                    .padding(32.dp)
                    .clip(RoundedCornerShape(20.dp))
                    .background(ColorDarkSurface)
                    .border(1.dp, Color(0xFFEF4444), RoundedCornerShape(20.dp))
                    .padding(24.dp)
            ) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Text(
                        "Scan Error",
                        style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                        color = Color(0xFFEF4444)
                    )
                    Text(
                        scanError ?: "Unable to analyze photo. Please try again or log manually.",
                        color = ColorDarkMuted,
                        textAlign = TextAlign.Center
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        Button(
                            onClick = {
                                scanError = null
                                capturedFile?.let {
                                    startScan(viewModel, it, onScanning = { isScanning = true }, onSuccess = { res ->
                                        isScanning = false
                                        scanResult = res
                                    }, onError = { err ->
                                        isScanning = false
                                        scanError = err
                                    })
                                }
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = ColorBrandEmerald)
                        ) {
                            Text("Retry", color = Color(0xFF042F1A), fontWeight = FontWeight.Bold)
                        }
                        TextButton(onClick = { scanError = null; capturedFile = null }) {
                            Text("Cancel", color = ColorDarkMuted)
                        }
                    }
                }
            }
        }

        // Result Bottom Sheet
        if (scanResult != null) {
            ModalBottomSheet(
                onDismissRequest = { scanResult = null; capturedFile = null },
                sheetState = sheetState,
                containerColor = ColorDarkSurface,
                dragHandle = null
            ) {
                SaveScannedMealSheet(
                    initialResult = scanResult!!,
                    onSave = { entry ->
                        scanResult = null
                        capturedFile = null
                        onMealSaved()
                        viewModel.saveFoodLog(entry)
                    },
                    onCancel = {
                        scanResult = null
                        capturedFile = null
                    }
                )
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun SaveScannedMealSheet(
    initialResult: ScanMealResponse,
    onSave: (FoodLogEntry) -> Unit,
    onCancel: () -> Unit
) {
    var mealName by remember { mutableStateOf(initialResult.mealName) }
    var mealType by remember { mutableStateOf(detectMealType()) }
    var selectedDate by remember { mutableStateOf(LocalDate.now().toString()) }
    var isSaving by remember { mutableStateOf(false) }

    // Editable items
    val items = remember {
        mutableStateListOf<EditableNutritionItem>().apply {
            addAll(initialResult.items.map {
                EditableNutritionItem(
                    baseName = it.name,
                    baseGrams = if (it.grams > 0) it.grams else 100,
                    currentGrams = if (it.grams > 0) it.grams else 100,
                    baseCalories = it.calories,
                    baseProtein = it.protein,
                    baseCarbs = it.carbs,
                    baseFat = it.fat
                )
            })
        }
    }

    // Totals dynamically calculated from items
    val totalCalories = if (items.isNotEmpty()) items.sumOf { it.scaledCalories } else initialResult.totalCalories
    val totalProtein = if (items.isNotEmpty()) items.sumOf { it.scaledProtein } else initialResult.totalProtein
    val totalCarbs = if (items.isNotEmpty()) items.sumOf { it.scaledCarbs } else initialResult.totalCarbs
    val totalFat = if (items.isNotEmpty()) items.sumOf { it.scaledFat } else initialResult.totalFat

    val scrollState = rememberScrollState()

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(20.dp)
            .verticalScroll(scrollState),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                "Meal Analysis",
                style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold),
                color = Color.White
            )
            HealthScoreBadge(score = initialResult.healthScore)
        }

        if (initialResult.tip.isNotBlank()) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp))
                    .background(ColorDarkSurface2)
                    .padding(12.dp)
            ) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Icon(Icons.Outlined.AutoAwesome, contentDescription = null, tint = ColorBrandLime, modifier = Modifier.size(18.dp))
                    Text(initialResult.tip, style = MaterialTheme.typography.bodySmall, color = ColorDarkText)
                }
            }
        }

        // Meal Name
        OutlinedTextField(
            value = mealName,
            onValueChange = { mealName = it },
            label = { Text("Meal Name") },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
            colors = scanTextFieldColors()
        )

        // Meal Type Selector with FlowRow
        Text("Meal Type", color = ColorDarkMuted, style = MaterialTheme.typography.labelMedium)
        FlowRow(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            CANONICAL_MEAL_TYPES.forEach { type ->
                FilterChip(
                    selected = mealType == type,
                    onClick = { mealType = type },
                    label = { Text(type) },
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = ColorBrandEmerald,
                        selectedLabelColor = Color(0xFF042F1A),
                        containerColor = ColorDarkSurface2,
                        labelColor = Color.White
                    )
                )
            }
        }

        // Macro Totals Display
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(16.dp))
                .background(ColorDarkSurface2)
                .padding(16.dp),
            horizontalArrangement = Arrangement.SpaceAround
        ) {
            MacroCol("Calories", "$totalCalories kcal", ColorMacroCal)
            MacroCol("Protein", "${totalProtein.toInt()}g", ColorMacroProtein)
            MacroCol("Carbs", "${totalCarbs.toInt()}g", ColorMacroCarbs)
            MacroCol("Fat", "${totalFat.toInt()}g", ColorMacroFat)
        }

        // Breakdown items with editable grams
        Text("Detected Items (Portions scale macros)", style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold), color = Color.White)

        items.forEachIndexed { index, item ->
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(14.dp))
                    .background(ColorDarkSurface2)
                    .padding(12.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(item.baseName, fontWeight = FontWeight.Bold, color = Color.White)
                    Text(
                        "${item.scaledCalories} kcal • P:${item.scaledProtein.toInt()}g C:${item.scaledCarbs.toInt()}g F:${item.scaledFat.toInt()}g",
                        style = MaterialTheme.typography.bodySmall,
                        color = ColorDarkMuted
                    )
                }

                // Grams stepper
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    IconButton(
                        onClick = {
                            if (item.currentGrams > 20) {
                                items[index] = item.copy(currentGrams = item.currentGrams - 20)
                            }
                        },
                        modifier = Modifier
                            .size(32.dp)
                            .clip(CircleShape)
                            .background(ColorDarkBorder)
                    ) {
                        Icon(Icons.Default.Remove, contentDescription = "Decrease", tint = Color.White, modifier = Modifier.size(16.dp))
                    }

                    Text("${item.currentGrams}g", fontWeight = FontWeight.Bold, color = Color.White)

                    IconButton(
                        onClick = {
                            items[index] = item.copy(currentGrams = item.currentGrams + 20)
                        },
                        modifier = Modifier
                            .size(32.dp)
                            .clip(CircleShape)
                            .background(ColorDarkBorder)
                    ) {
                        Icon(Icons.Default.Add, contentDescription = "Increase", tint = Color.White, modifier = Modifier.size(16.dp))
                    }
                }
            }
        }

        // Action Buttons
        Button(
            onClick = {
                if (isSaving) return@Button
                isSaving = true
                val nutritionItems = items.map {
                    NutritionItem(
                        name = it.baseName,
                        quantity = "${it.currentGrams}g",
                        grams = it.currentGrams,
                        calories = it.scaledCalories,
                        protein = it.scaledProtein,
                        carbs = it.scaledCarbs,
                        fat = it.scaledFat
                    )
                }

                val entry = FoodLogEntry(
                    itemName = mealName.ifBlank { "Scanned Meal" },
                    quantity = "1 meal",
                    calories = totalCalories,
                    protein = totalProtein,
                    carbs = totalCarbs,
                    fat = totalFat,
                    healthScore = initialResult.healthScore,
                    source = "scan",
                    mealType = mealType,
                    date = selectedDate,
                    items = nutritionItems
                )
                onSave(entry)
            },
            enabled = !isSaving,
            modifier = Modifier
                .fillMaxWidth()
                .height(50.dp),
            shape = RoundedCornerShape(14.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = ColorBrandEmerald,
                contentColor = Color(0xFF042F1A)
            )
        ) {
            Icon(Icons.Outlined.Check, contentDescription = null)
            Spacer(modifier = Modifier.width(8.dp))
            Text("Save to Food Log", fontWeight = FontWeight.Bold, fontSize = 16.sp)
        }

        TextButton(
            onClick = onCancel,
            modifier = Modifier.fillMaxWidth()
        ) {
            Text("Cancel", color = ColorDarkMuted)
        }

        Spacer(modifier = Modifier.height(20.dp))
    }
}

@Composable
private fun MacroCol(label: String, value: String, color: Color) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(label, style = MaterialTheme.typography.labelSmall, color = ColorDarkMuted)
        Spacer(modifier = Modifier.height(4.dp))
        Text(value, fontWeight = FontWeight.Bold, color = color, style = MaterialTheme.typography.bodyMedium)
    }
}

private data class EditableNutritionItem(
    val baseName: String,
    val baseGrams: Int,
    val currentGrams: Int,
    val baseCalories: Int,
    val baseProtein: Double,
    val baseCarbs: Double,
    val baseFat: Double
) {
    private val factor: Double
        get() = if (baseGrams > 0) currentGrams.toDouble() / baseGrams.toDouble() else 1.0

    val scaledCalories: Int get() = (baseCalories * factor).toInt()
    val scaledProtein: Double get() = (baseProtein * factor)
    val scaledCarbs: Double get() = (baseCarbs * factor)
    val scaledFat: Double get() = (baseFat * factor)
}

private fun startScan(
    viewModel: MainViewModel,
    file: File,
    onScanning: () -> Unit,
    onSuccess: (ScanMealResponse) -> Unit,
    onError: (String) -> Unit
) {
    onScanning()
    viewModel.scanMeal(file) { result ->
        result.fold(
            onSuccess = { onSuccess(it) },
            onFailure = { err ->
                val msg = when {
                    err is java.net.SocketTimeoutException -> "Connection timed out. Server might be waking up, please retry."
                    err is java.net.UnknownHostException -> "No internet connection. Please verify your network."
                    err.localizedMessage?.contains("429") == true -> "AI quota limit reached for today. Try again shortly."
                    err.localizedMessage?.contains("413") == true -> "Image file too large. Try taking photo with lower resolution."
                    else -> err.localizedMessage ?: "Failed to scan meal"
                }
                onError(msg)
            }
        )
    }
}

private fun bindCamera(
    provider: ProcessCameraProvider,
    previewView: PreviewView,
    lensFacing: Int,
    lifecycleOwner: androidx.lifecycle.LifecycleOwner,
    onCaptureReady: (ImageCapture) -> Unit
) {
    try {
        provider.unbindAll()
        val selector = CameraSelector.Builder().requireLensFacing(lensFacing).build()
        val preview = Preview.Builder().build().also {
            it.surfaceProvider = previewView.surfaceProvider
        }
        val capture = ImageCapture.Builder().build()
        onCaptureReady(capture)
        provider.bindToLifecycle(lifecycleOwner, selector, preview, capture)
    } catch (_: Exception) {
    }
}

private fun copyUriToTempFile(context: Context, uri: Uri): File? {
    return try {
        val inputStream: InputStream? = context.contentResolver.openInputStream(uri)
        val tempFile = File.createTempFile("gallery_upload_", ".jpg", context.cacheDir)
        val outputStream = FileOutputStream(tempFile)
        inputStream?.copyTo(outputStream)
        outputStream.close()
        inputStream?.close()
        tempFile
    } catch (_: Exception) {
        null
    }
}

@Composable
private fun scanTextFieldColors() = OutlinedTextFieldDefaults.colors(
    focusedBorderColor = ColorBrandEmerald,
    unfocusedBorderColor = ColorDarkBorder,
    focusedLabelColor = ColorBrandEmerald,
    unfocusedLabelColor = ColorDarkMuted,
    focusedTextColor = Color.White,
    unfocusedTextColor = Color.White,
    cursorColor = ColorBrandEmerald
)
