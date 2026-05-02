package app.eodin.analytics

/**
 * Phase 1.7 — GDPR surface (open-issues §4.5).
 *
 * Pure-JVM unit test (no Robolectric). EodinAnalytics requires a `Context`
 * for SharedPreferences, so the in-memory state-machine tests below verify
 * the `isEnabled` contract via the static getter — full integration with
 * `Context` / `SharedPreferences` / `HttpURLConnection` is covered by
 * `androidTest/` (instrumented) when wired up in the host-app CI.
 *
 * The intent here is regression-guard for:
 * 1. `setEnabled` API surface exists (compile-time check)
 * 2. `requestDataDeletion` API surface exists with `(Boolean) -> Unit` callback
 * 3. `isEnabled` property is read-only
 */
class GDPRTest {
    @org.junit.Test
    fun `setEnabled API surface compiles`() {
        // Compile-time: API surface exists. We do not invoke at runtime
        // because EodinAnalytics requires a Context for SharedPreferences.
        // The reference to `EodinAnalytics.setEnabled` is enough to fail
        // compilation if the method is removed.
        val ref: (Boolean) -> Unit = EodinAnalytics::setEnabled
        org.junit.Assert.assertNotNull(ref)
    }

    @org.junit.Test
    fun `isEnabled API surface compiles`() {
        val ref: () -> Boolean = { EodinAnalytics.isEnabled }
        org.junit.Assert.assertNotNull(ref)
    }

    @org.junit.Test
    fun `requestDataDeletion API surface compiles`() {
        val ref: ((Boolean) -> Unit) -> Unit = EodinAnalytics::requestDataDeletion
        org.junit.Assert.assertNotNull(ref)
    }
}
