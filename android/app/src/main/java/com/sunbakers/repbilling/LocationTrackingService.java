package com.sunbakers.repbilling;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.Bundle;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;

import androidx.annotation.NonNull;
import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationCompat;

import org.json.JSONObject;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class LocationTrackingService extends Service implements LocationListener {
    public static final String PREFS_NAME = "SunBakersBgLocationPrefs";
    public static final String KEY_ENABLED = "tracking_enabled";
    public static final String KEY_USER_ID = "user_id";
    public static final String KEY_LORRY_ID = "lorry_id";
    public static final String KEY_API_URL = "api_url";
    public static final String KEY_PENDING_JSON = "pending_location_json";

    private static final String CHANNEL_ID = "sunbakers_live_tracking";
    private static final int NOTIFICATION_ID = 7001;
    private static final long MIN_TIME_MS = 20000L; // 20 seconds
    private static final float MIN_DISTANCE_M = 15f; // 15 meters

    private LocationManager locationManager;
    private PowerManager.WakeLock wakeLock;
    private ExecutorService networkExecutor;
    private long lastSentTimeMs = 0L;

    @Override
    public void onCreate() {
        super.onCreate();
        networkExecutor = Executors.newSingleThreadExecutor();
        locationManager = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
        createNotificationChannel();

        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        if (pm != null) {
            wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "SunBakers::LocationWakeLock");
            wakeLock.setReferenceCounted(false);
            wakeLock.acquire(12 * 60 * 60 * 1000L); // up to 12h shift
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        if (intent != null && intent.hasExtra(KEY_USER_ID)) {
            prefs.edit()
                .putBoolean(KEY_ENABLED, true)
                .putString(KEY_USER_ID, intent.getStringExtra(KEY_USER_ID))
                .putString(KEY_LORRY_ID, intent.getStringExtra(KEY_LORRY_ID))
                .putString(KEY_API_URL, intent.getStringExtra(KEY_API_URL))
                .apply();
        }

        if (!prefs.getBoolean(KEY_ENABLED, false)) {
            stopSelf();
            return START_NOT_STICKY;
        }

        Notification notification = buildNotification();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }

        startLocationUpdates();
        return START_STICKY;
    }

    private void startLocationUpdates() {
        if (locationManager == null) return;
        boolean hasFine = ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
        boolean hasCoarse = ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
        if (!hasFine && !hasCoarse) {
            return;
        }

        try {
            locationManager.removeUpdates(this);
        } catch (Exception ignored) {}

        try {
            if (locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                locationManager.requestLocationUpdates(
                    LocationManager.GPS_PROVIDER,
                    MIN_TIME_MS,
                    MIN_DISTANCE_M,
                    this,
                    Looper.getMainLooper()
                );
                Location lastGps = locationManager.getLastKnownLocation(LocationManager.GPS_PROVIDER);
                if (lastGps != null) {
                    sendLocationToServer(lastGps);
                }
            }
        } catch (Exception ignored) {}

        try {
            if (locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
                locationManager.requestLocationUpdates(
                    LocationManager.NETWORK_PROVIDER,
                    MIN_TIME_MS,
                    MIN_DISTANCE_M,
                    this,
                    Looper.getMainLooper()
                );
                Location lastNet = locationManager.getLastKnownLocation(LocationManager.NETWORK_PROVIDER);
                if (lastNet != null) {
                    sendLocationToServer(lastNet);
                }
            }
        } catch (Exception ignored) {}
    }

    @Override
    public void onLocationChanged(@NonNull Location location) {
        long now = System.currentTimeMillis();
        if (now - lastSentTimeMs < 10000L) {
            return; // Throttle to max once every 10s
        }
        lastSentTimeMs = now;
        sendLocationToServer(location);
    }

    @Override
    public void onStatusChanged(String provider, int status, Bundle extras) {}

    @Override
    public void onProviderEnabled(@NonNull String provider) {}

    @Override
    public void onProviderDisabled(@NonNull String provider) {}

    private void sendLocationToServer(Location location) {
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        String userId = prefs.getString(KEY_USER_ID, null);
        String lorryId = prefs.getString(KEY_LORRY_ID, null);
        String apiUrl = prefs.getString(KEY_API_URL, null);

        if (userId == null || userId.isEmpty() || apiUrl == null || apiUrl.isEmpty()) {
            return;
        }

        String endpoint = apiUrl.endsWith("/") ? apiUrl + "rep-locations" : apiUrl + "/rep-locations";

        networkExecutor.execute(() -> {
            try {
                SimpleDateFormat iso = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US);
                iso.setTimeZone(TimeZone.getTimeZone("UTC"));

                JSONObject body = new JSONObject();
                body.put("userId", userId);
                if (lorryId != null && !lorryId.isEmpty()) {
                    body.put("lorryId", lorryId);
                }
                body.put("latitude", location.getLatitude());
                body.put("longitude", location.getLongitude());
                body.put("accuracy", location.hasAccuracy() ? location.getAccuracy() : JSONObject.NULL);
                body.put("speed", location.hasSpeed() ? location.getSpeed() : JSONObject.NULL);
                body.put("recordedAt", iso.format(new Date(location.getTime())));

                String jsonStr = body.toString();
                if (!postJson(endpoint, jsonStr)) {
                    prefs.edit().putString(KEY_PENDING_JSON, jsonStr).apply();
                } else {
                    // Flush any previously cached location if needed
                    prefs.edit().remove(KEY_PENDING_JSON).apply();
                }
            } catch (Exception ignored) {}
        });
    }

    private boolean postJson(String endpoint, String jsonBody) {
        HttpURLConnection conn = null;
        try {
            URL url = new URL(endpoint);
            conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setConnectTimeout(8000);
            conn.setReadTimeout(8000);
            conn.setDoOutput(true);
            conn.setRequestProperty("Content-Type", "application/json");
            byte[] input = jsonBody.getBytes(StandardCharsets.UTF_8);
            try (OutputStream os = conn.getOutputStream()) {
                os.write(input, 0, input.length);
            }
            int code = conn.getResponseCode();
            return code >= 200 && code < 300;
        } catch (Exception e) {
            return false;
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Sun Bakers Live Route Tracking",
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Keeps rep GPS location synced even when screen is off");
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    private Notification buildNotification() {
        Intent openIntent = new Intent(this, MainActivity.class);
        openIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        int flags = Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
            ? PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            : PendingIntent.FLAG_UPDATE_CURRENT;
        PendingIntent pendingIntent = PendingIntent.getActivity(this, 0, openIntent, flags);

        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Sun Bakers Rep Tracking")
            .setContentText("Live fleet GPS active in background")
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build();
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        // Keep service running even if user swipes the app away from Recents
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        if (prefs.getBoolean(KEY_ENABLED, false)) {
            Intent restartIntent = new Intent(getApplicationContext(), LocationTrackingService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                getApplicationContext().startForegroundService(restartIntent);
            } else {
                getApplicationContext().startService(restartIntent);
            }
        }
        super.onTaskRemoved(rootIntent);
    }

    @Override
    public void onDestroy() {
        try {
            if (locationManager != null) {
                locationManager.removeUpdates(this);
            }
        } catch (Exception ignored) {}
        try {
            if (wakeLock != null && wakeLock.isHeld()) {
                wakeLock.release();
            }
        } catch (Exception ignored) {}
        if (networkExecutor != null) {
            networkExecutor.shutdownNow();
        }
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}

