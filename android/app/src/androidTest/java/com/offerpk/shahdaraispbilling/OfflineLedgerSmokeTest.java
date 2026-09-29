package com.offerpk.shahdaraispbilling;

import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebView;

import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;

import org.junit.Test;
import org.junit.runner.RunWith;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;

@RunWith(AndroidJUnit4.class)
public class OfflineLedgerSmokeTest {
    @Test
    public void bundledAppLoadsOfflineWithExactSeedAndEmptyLedger() throws Exception {
        CountDownLatch loaded = new CountDownLatch(1);
        AtomicReference<String> result = new AtomicReference<>("");
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            scenario.onActivity(activity -> {
                WebView webView = findWebView((ViewGroup) activity.getWindow().getDecorView());
                assertNotNull("Capacitor WebView should be present", webView);
                webView.post(new PageCheck(webView, loaded, result));
            });
            assertTrue("Bundled page should render while network is disabled", loaded.await(35, TimeUnit.SECONDS));
            assertTrue("The app title should load: " + result.get(), result.get().contains("Shahdara ISP Billing"));
            assertTrue("The supplied 74 customers should render: " + result.get(), result.get().contains("\"customerCount\":74"));
            assertTrue("The fresh ledger should be empty: " + result.get(), result.get().contains("\"ledgerEmpty\":true"));
        }
    }

    private static WebView findWebView(View view) {
        if (view instanceof WebView) return (WebView) view;
        if (view instanceof ViewGroup) {
            ViewGroup group = (ViewGroup) view;
            for (int index = 0; index < group.getChildCount(); index++) {
                WebView found = findWebView(group.getChildAt(index));
                if (found != null) return found;
            }
        }
        return null;
    }

    private static final class PageCheck implements Runnable {
        private final WebView webView;
        private final CountDownLatch loaded;
        private final AtomicReference<String> result;
        private final long deadline = System.currentTimeMillis() + 30000;

        private PageCheck(WebView webView, CountDownLatch loaded, AtomicReference<String> result) {
            this.webView = webView;
            this.loaded = loaded;
            this.result = result;
        }

        @Override public void run() {
            webView.evaluateJavascript(
                "JSON.stringify({title:document.title,customerCount:document.querySelectorAll('#customerList .customer-select').length,ledgerEmpty:!!document.querySelector('#welcomeState')&&!document.querySelector('#welcomeState').hidden&&document.querySelector('#welcomeState').textContent.includes('No mohallas, bills, payments, or payment history have been recorded.')})",
                value -> {
                    result.set(value == null ? "null" : value);
                    if (value != null && value.contains("\"customerCount\":74") && value.contains("\"ledgerEmpty\":true")) {
                        loaded.countDown();
                    } else if (System.currentTimeMillis() >= deadline) {
                        loaded.countDown();
                    } else {
                        webView.postDelayed(this, 300);
                    }
                }
            );
        }
    }
}
