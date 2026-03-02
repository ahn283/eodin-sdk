package app.eodin.capacitor

import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import app.eodin.deeplink.EodinDeeplink

@CapacitorPlugin(name = "EodinDeeplink")
class EodinCapacitorDeeplinkPlugin : Plugin() {

    @PluginMethod
    fun configure(call: PluginCall) {
        val apiEndpoint = call.getString("apiEndpoint")
        val service = call.getString("service")

        if (apiEndpoint == null || service == null) {
            call.reject("apiEndpoint and service are required")
            return
        }

        EodinDeeplink.configure(
            context = context,
            apiEndpoint = apiEndpoint,
            service = service
        )
        call.resolve()
    }

    @PluginMethod
    fun checkDeferredParams(call: PluginCall) {
        EodinDeeplink.checkDeferredParams { result ->
            result.fold(
                onSuccess = { params ->
                    val data = JSObject().apply {
                        put("path", params.path)
                        put("resourceId", params.resourceId)
                        put("hasParams", params.hasParams)
                        params.metadata?.let { meta ->
                            val metaObj = JSObject()
                            meta.forEach { (key, value) -> metaObj.put(key, value) }
                            put("metadata", metaObj)
                        }
                    }
                    call.resolve(data)
                },
                onFailure = { error ->
                    call.reject(error.message ?: "Unknown error")
                }
            )
        }
    }

    @PluginMethod
    fun isReady(call: PluginCall) {
        val data = JSObject()
        data.put("ready", EodinDeeplink.isReady)
        call.resolve(data)
    }
}
