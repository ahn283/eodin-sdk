import Capacitor

@objc(EodinCapacitorDeeplinkPlugin)
public class EodinCapacitorDeeplinkPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "EodinCapacitorDeeplinkPlugin"
    public let jsName = "EodinDeeplink"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "configure", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "checkDeferredParams", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "isReady", returnType: CAPPluginReturnPromise),
    ]

    @objc func configure(_ call: CAPPluginCall) {
        guard let apiEndpoint = call.getString("apiEndpoint"),
              let service = call.getString("service") else {
            call.reject("apiEndpoint and service are required")
            return
        }

        EodinDeeplink.configure(apiEndpoint: apiEndpoint, service: service)
        call.resolve()
    }

    @objc func checkDeferredParams(_ call: CAPPluginCall) {
        EodinDeeplink.checkDeferredParams { result in
            switch result {
            case .success(let params):
                var data: [String: Any] = [
                    "hasParams": params.hasParams
                ]
                data["path"] = params.path ?? NSNull()
                data["resourceId"] = params.resourceId ?? NSNull()
                data["metadata"] = params.metadata ?? NSNull()
                call.resolve(data)
            case .failure(let error):
                call.reject(error.localizedDescription)
            }
        }
    }

    @objc func isReady(_ call: CAPPluginCall) {
        call.resolve(["ready": EodinDeeplink.isReady])
    }
}
