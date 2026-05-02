package app.eodin.internal

import org.junit.Assert.assertThrows
import org.junit.Test

class EndpointValidatorTest {
    // ---- Accepted ----

    @Test
    fun `https passes`() {
        EndpointValidator.validate("https://api.eodin.app/api/v1")
        EndpointValidator.validate("https://api-staging.eodin.app/api/v1")
        EndpointValidator.validate("https://api.eodin.app:443/api/v1")
    }

    @Test
    fun `http loopback passes`() {
        EndpointValidator.validate("http://localhost:3005/api/v1")
        EndpointValidator.validate("http://127.0.0.1:3005/api/v1")
    }

    @Test
    fun `10_0_2_2 passes in debug build`() {
        // BuildConfig stub has DEBUG = true; in Gradle release build it would
        // be regenerated to false and this would throw — but unit tests run
        // against the debug stub, so we only verify the debug branch here.
        EndpointValidator.validate("http://10.0.2.2:3005/api/v1")
    }

    @Test
    fun `case-insensitive scheme`() {
        EndpointValidator.validate("HTTPS://api.eodin.app/api/v1")
        EndpointValidator.validate("Http://localhost:3005/api/v1")
    }

    @Test
    fun `whitespace trimmed`() {
        EndpointValidator.validate("  https://api.eodin.app/api/v1  ")
    }

    // ---- Rejected ----

    @Test
    fun `plain http on non-loopback throws`() {
        assertThrows(IllegalArgumentException::class.java) {
            EndpointValidator.validate("http://api.eodin.app/api/v1")
        }
        assertThrows(IllegalArgumentException::class.java) {
            EndpointValidator.validate("http://attacker.example.com/collect")
        }
    }

    @Test
    fun `empty throws`() {
        assertThrows(IllegalArgumentException::class.java) {
            EndpointValidator.validate("")
        }
        assertThrows(IllegalArgumentException::class.java) {
            EndpointValidator.validate("   ")
        }
    }

    @Test
    fun `non-URL throws`() {
        assertThrows(IllegalArgumentException::class.java) {
            EndpointValidator.validate("not-a-url")
        }
        assertThrows(IllegalArgumentException::class.java) {
            EndpointValidator.validate("https://")
        }
    }

    @Test
    fun `unsupported scheme throws`() {
        assertThrows(IllegalArgumentException::class.java) {
            EndpointValidator.validate("ftp://api.eodin.app")
        }
        assertThrows(IllegalArgumentException::class.java) {
            EndpointValidator.validate("ws://api.eodin.app")
        }
        assertThrows(IllegalArgumentException::class.java) {
            EndpointValidator.validate("file:///etc/passwd")
        }
    }

    @Test
    fun `confusable host passes — host whitelist deferred to open-issues 4_6`() {
        EndpointValidator.validate("https://api.eodin.app.attacker.com")
    }
}
