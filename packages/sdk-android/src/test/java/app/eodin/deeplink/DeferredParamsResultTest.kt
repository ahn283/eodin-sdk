package app.eodin.deeplink

import org.junit.Assert.*
import org.junit.Test

class DeferredParamsResultTest {

    @Test
    fun `hasParams returns true when path is not null`() {
        val result = DeferredParamsResult(
            path = "product/12345",
            resourceId = "product-12345",
            metadata = mapOf("source" to "campaign")
        )

        assertTrue(result.hasParams)
        assertEquals("product/12345", result.path)
        assertEquals("product-12345", result.resourceId)
        assertNotNull(result.metadata)
    }

    @Test
    fun `hasParams returns false when path is null`() {
        val result = DeferredParamsResult(
            path = null,
            resourceId = null,
            metadata = null
        )

        assertFalse(result.hasParams)
    }

    @Test
    fun `hasParams returns false with resourceId but no path`() {
        val result = DeferredParamsResult(
            path = null,
            resourceId = "product-12345",
            metadata = null
        )

        assertFalse(result.hasParams)
    }

    @Test
    fun `data class equality works correctly`() {
        val result1 = DeferredParamsResult(
            path = "product/12345",
            resourceId = "product-12345",
            metadata = null
        )

        val result2 = DeferredParamsResult(
            path = "product/12345",
            resourceId = "product-12345",
            metadata = null
        )

        assertEquals(result1, result2)
        assertEquals(result1.hashCode(), result2.hashCode())
    }
}
