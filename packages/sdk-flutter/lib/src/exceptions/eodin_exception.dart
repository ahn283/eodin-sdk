/// Base exception for Eodin SDK errors
class EodinException implements Exception {
  /// Error message
  final String message;

  /// Creates a new [EodinException]
  const EodinException(this.message);

  @override
  String toString() => 'EodinException: $message';
}

/// Exception thrown when SDK is not configured
class NotConfiguredException extends EodinException {
  /// Creates a new [NotConfiguredException]
  const NotConfiguredException()
      : super('EodinDeeplink is not configured. Call configure() first.');
}

/// Exception thrown when no deferred parameters are found
class NoParamsFoundException extends EodinException {
  /// Creates a new [NoParamsFoundException]
  const NoParamsFoundException()
      : super('No deferred parameters found for this device.');
}

/// Exception thrown when a network error occurs
class NetworkException extends EodinException {
  /// The underlying error
  final dynamic error;

  /// Creates a new [NetworkException]
  const NetworkException(this.error) : super('Network error occurred');

  @override
  String toString() => 'NetworkException: $message ($error)';
}

/// Exception thrown when the API returns an error
class ApiException extends EodinException {
  /// HTTP status code
  final int statusCode;

  /// Creates a new [ApiException]
  const ApiException(this.statusCode, String message) : super(message);

  @override
  String toString() => 'ApiException [$statusCode]: $message';
}
