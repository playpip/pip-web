Pod::Spec.new do |s|
  s.name           = 'PipSpeaker'
  s.version        = '1.0.0'
  s.summary        = 'Keeps call-mode audio on the loudspeaker'
  s.description    = 'Keeps the web view on the loudspeaker while the camera or mic is on at a table.'
  s.license        = 'UNLICENSED'
  s.author         = 'Pip'
  s.homepage       = 'https://playpip.io'
  s.platforms      = {
    :ios => '16.4'
  }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = "**/*.{h,m,swift}"
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
