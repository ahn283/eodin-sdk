import 'package:uuid/uuid.dart';

/// Represents an analytics event
class AnalyticsEvent {
  /// Creates a new [AnalyticsEvent]
  AnalyticsEvent({
    String? eventId,
    required this.eventName,
    required this.appId,
    required this.deviceId,
    this.userId,
    this.sessionId,
    DateTime? timestamp,
    this.attribution,
    this.device,
    this.properties,
  })  : eventId = eventId ?? const Uuid().v4(),
        timestamp = timestamp ?? DateTime.now();

  /// Unique event ID (UUID v4)
  final String eventId;

  /// Event name (e.g., 'app_open', 'subscribe_start')
  final String eventName;

  /// App ID (e.g., 'fridgify', 'arden')
  final String appId;

  /// Device ID (hashed identifier)
  final String deviceId;

  /// User ID (optional, set via identify())
  final String? userId;

  /// Session ID (UUID v4, auto-generated per session)
  final String? sessionId;

  /// Event timestamp (ISO 8601)
  final DateTime timestamp;

  /// Attribution data (from deferred params)
  final Attribution? attribution;

  /// Device information
  final DeviceInfo? device;

  /// Custom properties
  final Map<String, dynamic>? properties;

  /// Converts this event to JSON for API transmission
  Map<String, dynamic> toJson() {
    return {
      'event_id': eventId,
      'event_name': eventName,
      'app_id': appId,
      'device_id': deviceId,
      'user_id': userId,
      'session_id': sessionId,
      'timestamp': timestamp.toUtc().toIso8601String(),
      if (attribution != null) 'attribution': attribution!.toJson(),
      if (device != null) 'device': device!.toJson(),
      if (properties != null && properties!.isNotEmpty) 'properties': properties,
    };
  }

  @override
  String toString() {
    return 'AnalyticsEvent(eventId: $eventId, eventName: $eventName, appId: $appId)';
  }
}

/// Attribution data from advertising platforms
class Attribution {
  /// Creates a new [Attribution]
  const Attribution({
    this.source,
    this.campaignId,
    this.adsetId,
    this.adId,
    this.clickId,
    this.clickIdType,
    this.utmSource,
    this.utmMedium,
    this.utmCampaign,
    this.utmContent,
    this.utmTerm,
  });

  /// Creates an [Attribution] from JSON
  factory Attribution.fromJson(Map<String, dynamic> json) {
    return Attribution(
      source: json['source'] as String?,
      campaignId: json['campaign_id'] as String? ?? json['campaignId'] as String?,
      adsetId: json['adset_id'] as String? ?? json['adsetId'] as String?,
      adId: json['ad_id'] as String? ?? json['adId'] as String?,
      clickId: json['click_id'] as String? ?? json['clickId'] as String?,
      clickIdType: json['click_id_type'] as String? ?? json['clickIdType'] as String?,
      utmSource: json['utm_source'] as String? ?? json['utmSource'] as String?,
      utmMedium: json['utm_medium'] as String? ?? json['utmMedium'] as String?,
      utmCampaign: json['utm_campaign'] as String? ?? json['utmCampaign'] as String?,
      utmContent: json['utm_content'] as String? ?? json['utmContent'] as String?,
      utmTerm: json['utm_term'] as String? ?? json['utmTerm'] as String?,
    );
  }

  /// Attribution source (meta, google, tiktok, linkedin, organic)
  final String? source;

  /// Campaign ID from ad platform
  final String? campaignId;

  /// Ad set ID
  final String? adsetId;

  /// Ad ID
  final String? adId;

  /// Click ID (fbclid, gclid, ttclid, li_fat_id)
  final String? clickId;

  /// Click ID type
  final String? clickIdType;

  /// UTM parameters
  final String? utmSource;
  final String? utmMedium;
  final String? utmCampaign;
  final String? utmContent;
  final String? utmTerm;

  /// Whether this attribution has any data
  bool get hasData =>
      source != null ||
      campaignId != null ||
      clickId != null ||
      utmSource != null ||
      utmCampaign != null;

  /// Converts this attribution to JSON
  Map<String, dynamic> toJson() {
    return {
      if (source != null) 'source': source,
      if (campaignId != null) 'campaign_id': campaignId,
      if (adsetId != null) 'adset_id': adsetId,
      if (adId != null) 'ad_id': adId,
      if (clickId != null) 'click_id': clickId,
      if (clickIdType != null) 'click_id_type': clickIdType,
      if (utmSource != null) 'utm_source': utmSource,
      if (utmMedium != null) 'utm_medium': utmMedium,
      if (utmCampaign != null) 'utm_campaign': utmCampaign,
      if (utmContent != null) 'utm_content': utmContent,
      if (utmTerm != null) 'utm_term': utmTerm,
    };
  }

  @override
  String toString() {
    return 'Attribution(source: $source, campaignId: $campaignId, clickId: $clickId)';
  }
}

/// Device information
class DeviceInfo {
  /// Creates a new [DeviceInfo]
  const DeviceInfo({
    this.os,
    this.osVersion,
    this.model,
    this.locale,
    this.attStatus,
    this.idfa,
  });

  /// Operating system (ios, android)
  final String? os;

  /// OS version
  final String? osVersion;

  /// Device model
  final String? model;

  /// Device locale
  final String? locale;

  /// ATT status (iOS only)
  final String? attStatus;

  /// IDFA (iOS only, when authorized)
  final String? idfa;

  /// Converts this device info to JSON
  Map<String, dynamic> toJson() {
    return {
      if (os != null) 'os': os,
      if (osVersion != null) 'os_version': osVersion,
      if (model != null) 'model': model,
      if (locale != null) 'locale': locale,
      if (attStatus != null) 'att_status': attStatus,
      if (idfa != null) 'idfa': idfa,
    };
  }

  @override
  String toString() {
    return 'DeviceInfo(os: $os, osVersion: $osVersion, model: $model)';
  }
}
