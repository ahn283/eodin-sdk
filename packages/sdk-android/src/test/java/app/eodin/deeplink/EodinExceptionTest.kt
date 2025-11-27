package app.eodin.deeplink

import org.junit.Assert.*
import org.junit.Test
import java.io.IOException

class EodinExceptionTest {

    @Test
    fun `NotConfigured exception has correct message`() {
        val exception = EodinException.NotConfigured()

        assertTrue(exception.message!!.contains("not configured"))
        assertTrue(exception.message!!.contains("configure()"))
    }

    @Test
    fun `NetworkError exception includes cause message`() {
        val cause = IOException("Connection refused")
        val exception = EodinException.NetworkError(cause)

        assertTrue(exception.message!!.contains("Network error"))
        assertTrue(exception.message!!.contains("Connection refused"))
        assertEquals(cause, exception.cause)
    }

    @Test
    fun `InvalidResponse exception has correct message`() {
        val exception = EodinException.InvalidResponse()

        assertTrue(exception.message!!.contains("Invalid response"))
    }

    @Test
    fun `NoParamsFound exception has correct message`() {
        val exception = EodinException.NoParamsFound()

        assertTrue(exception.message!!.contains("No deferred parameters"))
    }

    @Test
    fun `ServerError exception includes code and message`() {
        val exception = EodinException.ServerError(500, "Internal server error")

        assertTrue(exception.message!!.contains("500"))
        assertTrue(exception.message!!.contains("Internal server error"))
        assertEquals(500, exception.code)
        assertEquals("Internal server error", exception.serverMessage)
    }

    @Test
    fun `ServerError exception handles null message`() {
        val exception = EodinException.ServerError(503, null)

        assertTrue(exception.message!!.contains("503"))
        assertTrue(exception.message!!.contains("Unknown error"))
        assertNull(exception.serverMessage)
    }

    @Test
    fun `exceptions are instances of Exception`() {
        assertTrue(EodinException.NotConfigured() is Exception)
        assertTrue(EodinException.NetworkError(Exception()) is Exception)
        assertTrue(EodinException.InvalidResponse() is Exception)
        assertTrue(EodinException.NoParamsFound() is Exception)
        assertTrue(EodinException.ServerError(500, null) is Exception)
    }
}
