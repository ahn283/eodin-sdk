import Capacitor

@objc(EodinCapacitorAnalyticsPlugin)
public class EodinCapacitorAnalyticsPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "EodinCapacitorAnalyticsPlugin"
    public let jsName = "EodinAnalytics"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "configure", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "track", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "identify", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clearIdentity", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setAttribution", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "flush", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "startSession", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "endSession", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestTrackingAuthorization", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getATTStatus", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getStatus", returnType: CAPPluginReturnPromise),
        // GDPR (Phase 1.7 — open-issues §4.5)
        CAPPluginMethod(name: "setEnabled", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "isEnabled", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestDataDeletion", returnType: CAPPluginReturnPromise),
    ]

    @objc func configure(_ call: CAPPluginCall) {
        guard let apiEndpoint = call.getString("apiEndpoint"),
              let apiKey = call.getString("apiKey"),
              let appId = call.getString("appId") else {
            call.reject("apiEndpoint, apiKey, and appId are required")
            return
        }

        EodinAnalytics.configure(
            apiEndpoint: apiEndpoint,
            apiKey: apiKey,
            appId: appId,
            debug: call.getBool("debug") ?? false,
            offlineMode: call.getBool("offlineMode") ?? true
        )
        call.resolve()
    }

    @objc func track(_ call: CAPPluginCall) {
        guard let eventName = call.getString("eventName") else {
            call.reject("eventName is required")
            return
        }
        let properties = call.getObject("properties") as? [String: Any]
        EodinAnalytics.track(eventName, properties: properties)
        call.resolve()
    }

    @objc func identify(_ call: CAPPluginCall) {
        guard let userId = call.getString("userId") else {
            call.reject("userId is required")
            return
        }
        EodinAnalytics.identify(userId)
        call.resolve()
    }

    @objc func clearIdentity(_ call: CAPPluginCall) {
        EodinAnalytics.clearIdentity()
        call.resolve()
    }

    @objc func setAttribution(_ call: CAPPluginCall) {
        let attribution = Attribution(
            source: call.getString("source"),
            campaignId: call.getString("campaignId"),
            adsetId: call.getString("adsetId"),
            adId: call.getString("adId"),
            clickId: call.getString("clickId"),
            clickIdType: call.getString("clickIdType"),
            utmSource: call.getString("utmSource"),
            utmMedium: call.getString("utmMedium"),
            utmCampaign: call.getString("utmCampaign"),
            utmContent: call.getString("utmContent"),
            utmTerm: call.getString("utmTerm")
        )
        EodinAnalytics.setAttribution(attribution)
        call.resolve()
    }

    @objc func flush(_ call: CAPPluginCall) {
        EodinAnalytics.flush()
        call.resolve()
    }

    @objc func startSession(_ call: CAPPluginCall) {
        EodinAnalytics.startSession()
        call.resolve()
    }

    @objc func endSession(_ call: CAPPluginCall) {
        EodinAnalytics.endSession()
        call.resolve()
    }

    @objc func requestTrackingAuthorization(_ call: CAPPluginCall) {
        EodinAnalytics.requestTrackingAuthorization { status in
            call.resolve(["status": status.rawValue])
        }
    }

    @objc func getATTStatus(_ call: CAPPluginCall) {
        call.resolve(["status": EodinAnalytics.attStatus.rawValue])
    }

    @objc func getStatus(_ call: CAPPluginCall) {
        call.resolve([
            "isConfigured": EodinAnalytics.isConfigured,
            "deviceId": EodinAnalytics.deviceId as Any,
            "userId": EodinAnalytics.userId as Any,
            "sessionId": EodinAnalytics.sessionId as Any,
            "isOnline": EodinAnalytics.isOnline,
            "queueSize": EodinAnalytics.queueSize,
            "attStatus": EodinAnalytics.attStatus.rawValue
        ])
    }

    // MARK: - GDPR (Phase 1.7 — open-issues §4.5)

    @objc func setEnabled(_ call: CAPPluginCall) {
        guard let enabled = call.getBool("enabled") else {
            call.reject("enabled (bool) is required")
            return
        }
        EodinAnalytics.setEnabled(enabled)
        call.resolve()
    }

    @objc func isEnabled(_ call: CAPPluginCall) {
        call.resolve(["enabled": EodinAnalytics.isEnabled])
    }

    @objc func requestDataDeletion(_ call: CAPPluginCall) {
        EodinAnalytics.requestDataDeletion { success in
            call.resolve(["success": success])
        }
    }
}
