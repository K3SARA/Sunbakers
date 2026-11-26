package com.sunbakers.repbilling;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

@CapacitorPlugin(
    name = "BackgroundLocation",
    permissions = {
        @Permission(strings = { Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION }, alias = "location"),
        @Permission(strings = { Manifest.permission.ACCESS_BACKGROUND_LOCATION }, alias = "backgroundLocation"),
        @Permission(strings = { Manifest.permission.POST_NOTIFICATIONS }, alias = "notifications")
    }
)
public class BackgroundLocationPlugin extends Plugin {
    private PluginCall pendingStartCall;

    @PluginMethod
    public void start(PluginCall call) {
        String userId = call.getString("userId");
        String lorryId = call.getString("lorryId", "");
        String apiUrl = call.getString("apiUrl");

        if (userId == null || userId.isEmpty() || apiUrl == null || apiUrl.isEmpty()) {
            call.reject("userId and apiUrl are required");
            return;
        }

        boolean hasFine = ContextCompat.checkSelfPermission(getContext(), Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
        if (!hasFine) {
            pendingStartCall = call;
            requestPermissionForAlias("location", call, "onLocationPermissionResult");
            return;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(getContext(), Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            pendingStartCall = call;
            requestPermissionForAlias("notifications", call, "onNotificationsPermissionResult");
            return;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q &&
            ContextCompat.checkSelfPermission(getContext(), Manifest.permission.ACCESS_BACKGROUND_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            pendingStartCall = call;
            requestPermissionForAlias("backgroundLocation", call, "onBackgroundPermissionResult");
            return;
        }

        launchService(call, userId, lorryId, apiUrl);
    }

    @PermissionCallback
    private void onLocationPermissionResult(PluginCall call) {
        if (ContextCompat.checkSelfPermission(getContext(), Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED) {
            start(call);
        } else {
            call.reject("Location permission denied");
        }
    }

    @PermissionCallback
    private void onNotificationsPermissionResult(PluginCall call) {
        // Proceed even if notification permission is denied; foreground service still runs
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q &&
            ContextCompat.checkSelfPermission(getContext(), Manifest.permission.ACCESS_BACKGROUND_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            requestPermissionForAlias("backgroundLocation", call, "onBackgroundPermissionResult");
            return;
        }
        String userId = call.getString("userId");
        String lorryId = call.getString("lorryId", "");
        String apiUrl = call.getString("apiUrl");
        launchService(call, userId, lorryId, apiUrl);
    }

    @PermissionCallback
    private void onBackgroundPermissionResult(PluginCall call) {
        String userId = call.getString("userId");
        String lorryId = call.getString("lorryId", "");
        String apiUrl = call.getString("apiUrl");
        // Launch foreground service even if user only granted "While using app" (still works with screen off as foreground service!)
        launchService(call, userId, lorryId, apiUrl);
    }

    private void launchService(PluginCall call, String userId, String lorryId, String apiUrl) {
        Context ctx = getContext();
        Intent intent = new Intent(ctx, LocationTrackingService.class);
        intent.putExtra(LocationTrackingService.KEY_USER_ID, userId);
        intent.putExtra(LocationTrackingService.KEY_LORRY_ID, lorryId);
        intent.putExtra(LocationTrackingService.KEY_API_URL, apiUrl);
        ContextCompat.startForegroundService(ctx, intent);

        JSObject ret = new JSObject();
        ret.put("started", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void stop(PluginCall call) {
        Context ctx = getContext();
        SharedPreferences prefs = ctx.getSharedPreferences(LocationTrackingService.PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit().putBoolean(LocationTrackingService.KEY_ENABLED, false).apply();
        ctx.stopService(new Intent(ctx, LocationTrackingService.class));

        JSObject ret = new JSObject();
        ret.put("stopped", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void isRunning(PluginCall call) {
        SharedPreferences prefs = getContext().getSharedPreferences(LocationTrackingService.PREFS_NAME, Context.MODE_PRIVATE);
        JSObject ret = new JSObject();
        ret.put("running", prefs.getBoolean(LocationTrackingService.KEY_ENABLED, false));
        call.resolve(ret);
    }
}

