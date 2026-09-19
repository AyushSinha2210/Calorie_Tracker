package com.foodcal.app

import android.app.Application
import com.foodcal.app.di.AppContainer

class FoodCalApplication : Application() {

    lateinit var container: AppContainer
        private set

    override fun onCreate() {
        super.onCreate()
        container = AppContainer(this)
        // Ensure Firebase is initialized eagerly
        container.firebaseApp
    }
}
