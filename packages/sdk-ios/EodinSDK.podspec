Pod::Spec.new do |s|
  s.name         = 'EodinSDK'
  s.version      = '2.0.0-beta.2'
  s.summary      = 'Eodin SDK for iOS - Deferred Deep Links and Analytics'
  s.homepage     = 'https://github.com/ahn283/eodin-sdk'
  s.license      = 'MIT'
  s.author       = 'EODIN Team'
  s.source       = { git: 'https://github.com/ahn283/eodin-sdk.git', tag: "v#{s.version}" }
  s.ios.deployment_target = '13.0'
  s.swift_version = '5.9'

  s.subspec 'Deeplink' do |sp|
    sp.source_files = 'Sources/EodinDeeplink/**/*.swift'
    sp.dependency 'EodinSDK/Analytics'
  end

  s.subspec 'Analytics' do |sp|
    sp.source_files = 'Sources/EodinAnalytics/**/*.swift'
    sp.weak_frameworks = 'AppTrackingTransparency', 'AdSupport'
  end
end
