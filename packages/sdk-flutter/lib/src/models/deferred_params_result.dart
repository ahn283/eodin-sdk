/// Result of deferred parameters check
class DeferredParamsResult {
  /// The deep link path to navigate to
  final String? path;

  /// The resource ID from the URL
  final String? resourceId;

  /// Additional metadata
  final Map<String, dynamic>? metadata;

  /// Creates a new [DeferredParamsResult]
  const DeferredParamsResult({
    this.path,
    this.resourceId,
    this.metadata,
  });

  /// Whether this result contains deferred parameters
  bool get hasParams => path != null || resourceId != null;

  /// Creates a [DeferredParamsResult] from JSON
  factory DeferredParamsResult.fromJson(Map<String, dynamic> json) {
    return DeferredParamsResult(
      path: json['path'] as String?,
      resourceId: json['resourceId'] as String?,
      metadata: json['metadata'] as Map<String, dynamic>?,
    );
  }

  /// Converts this result to JSON
  Map<String, dynamic> toJson() {
    return {
      'path': path,
      'resourceId': resourceId,
      'metadata': metadata,
    };
  }

  @override
  String toString() {
    return 'DeferredParamsResult(path: $path, resourceId: $resourceId, metadata: $metadata)';
  }
}
