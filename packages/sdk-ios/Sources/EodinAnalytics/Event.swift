import Foundation

/// Represents an analytics event
public struct AnalyticsEvent: Codable {
    /// Unique event ID (UUID)
    public let eventId: String

    /// Event name (e.g., 'app_open', 'subscribe_start')
    public let eventName: String

    /// App ID (e.g., 'fridgify', 'arden')
    public let appId: String

    /// Device ID (UUID)
    public let deviceId: String

    /// User ID (optional)
    public let userId: String?

    /// Session ID (UUID)
    public let sessionId: String?

    /// Event timestamp (ISO 8601)
    public let timestamp: Date

    /// Attribution data
    public let attribution: Attribution?

    /// Device information
    public let device: DeviceInfo?

    /// Custom properties
    public let properties: [String: AnyCodable]?

    public init(
        eventId: String = UUID().uuidString,
        eventName: String,
        appId: String,
        deviceId: String,
        userId: String? = nil,
        sessionId: String? = nil,
        timestamp: Date = Date(),
        attribution: Attribution? = nil,
        device: DeviceInfo? = nil,
        properties: [String: Any]? = nil
    ) {
        self.eventId = eventId
        self.eventName = eventName
        self.appId = appId
        self.deviceId = deviceId
        self.userId = userId
        self.sessionId = sessionId
        self.timestamp = timestamp
        self.attribution = attribution
        self.device = device
        self.properties = properties?.mapValues { AnyCodable($0) }
    }

    enum CodingKeys: String, CodingKey {
        case eventId = "event_id"
        case eventName = "event_name"
        case appId = "app_id"
        case deviceId = "device_id"
        case userId = "user_id"
        case sessionId = "session_id"
        case timestamp
        case attribution
        case device
        case properties
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(eventId, forKey: .eventId)
        try container.encode(eventName, forKey: .eventName)
        try container.encode(appId, forKey: .appId)
        try container.encode(deviceId, forKey: .deviceId)
        try container.encodeIfPresent(userId, forKey: .userId)
        try container.encodeIfPresent(sessionId, forKey: .sessionId)

        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        try container.encode(formatter.string(from: timestamp), forKey: .timestamp)

        try container.encodeIfPresent(attribution, forKey: .attribution)
        try container.encodeIfPresent(device, forKey: .device)
        try container.encodeIfPresent(properties, forKey: .properties)
    }
}

/// Attribution data from advertising platforms
public struct Attribution: Codable {
    /// Attribution source
    public let source: String?

    /// Campaign ID
    public let campaignId: String?

    /// Ad set ID
    public let adsetId: String?

    /// Ad ID
    public let adId: String?

    /// Click ID (fbclid, gclid, ttclid, li_fat_id)
    public let clickId: String?

    /// Click ID type
    public let clickIdType: String?

    /// UTM parameters
    public let utmSource: String?
    public let utmMedium: String?
    public let utmCampaign: String?
    public let utmContent: String?
    public let utmTerm: String?

    public init(
        source: String? = nil,
        campaignId: String? = nil,
        adsetId: String? = nil,
        adId: String? = nil,
        clickId: String? = nil,
        clickIdType: String? = nil,
        utmSource: String? = nil,
        utmMedium: String? = nil,
        utmCampaign: String? = nil,
        utmContent: String? = nil,
        utmTerm: String? = nil
    ) {
        self.source = source
        self.campaignId = campaignId
        self.adsetId = adsetId
        self.adId = adId
        self.clickId = clickId
        self.clickIdType = clickIdType
        self.utmSource = utmSource
        self.utmMedium = utmMedium
        self.utmCampaign = utmCampaign
        self.utmContent = utmContent
        self.utmTerm = utmTerm
    }

    /// Whether this attribution has any data
    public var hasData: Bool {
        return source != nil || campaignId != nil || clickId != nil ||
               utmSource != nil || utmCampaign != nil
    }

    enum CodingKeys: String, CodingKey {
        case source
        case campaignId = "campaign_id"
        case adsetId = "adset_id"
        case adId = "ad_id"
        case clickId = "click_id"
        case clickIdType = "click_id_type"
        case utmSource = "utm_source"
        case utmMedium = "utm_medium"
        case utmCampaign = "utm_campaign"
        case utmContent = "utm_content"
        case utmTerm = "utm_term"
    }
}

/// Device information
public struct DeviceInfo: Codable {
    /// Operating system
    public let os: String?

    /// OS version
    public let osVersion: String?

    /// Device model
    public let model: String?

    /// Device locale
    public let locale: String?

    /// ATT status (iOS)
    public let attStatus: String?

    /// IDFA (iOS, when authorized)
    public let idfa: String?

    public init(
        os: String? = nil,
        osVersion: String? = nil,
        model: String? = nil,
        locale: String? = nil,
        attStatus: String? = nil,
        idfa: String? = nil
    ) {
        self.os = os
        self.osVersion = osVersion
        self.model = model
        self.locale = locale
        self.attStatus = attStatus
        self.idfa = idfa
    }

    enum CodingKeys: String, CodingKey {
        case os
        case osVersion = "os_version"
        case model
        case locale
        case attStatus = "att_status"
        case idfa
    }
}

/// Type-erased wrapper for encoding any value
public struct AnyCodable: Codable {
    public let value: Any

    public init(_ value: Any) {
        self.value = value
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()

        if let bool = try? container.decode(Bool.self) {
            value = bool
        } else if let int = try? container.decode(Int.self) {
            value = int
        } else if let double = try? container.decode(Double.self) {
            value = double
        } else if let string = try? container.decode(String.self) {
            value = string
        } else if let array = try? container.decode([AnyCodable].self) {
            value = array.map { $0.value }
        } else if let dict = try? container.decode([String: AnyCodable].self) {
            value = dict.mapValues { $0.value }
        } else {
            value = NSNull()
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()

        switch value {
        case let bool as Bool:
            try container.encode(bool)
        case let int as Int:
            try container.encode(int)
        case let double as Double:
            try container.encode(double)
        case let string as String:
            try container.encode(string)
        case let array as [Any]:
            try container.encode(array.map { AnyCodable($0) })
        case let dict as [String: Any]:
            try container.encode(dict.mapValues { AnyCodable($0) })
        default:
            try container.encodeNil()
        }
    }
}
