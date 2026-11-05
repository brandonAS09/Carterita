Pod::Spec.new do |s|
  s.name           = 'ReceiptOcr'
  s.version        = '1.0.0'
  s.summary        = 'Reconocimiento de texto local para tickets'
  s.description    = 'Reconocimiento de texto local para tickets con Apple Vision'
  s.author         = 'Carterita'
  s.homepage       = 'https://github.com/brandonAS09/Carterita'
  s.license        = { :type => 'UNLICENSED' }
  s.platforms      = { :ios => '15.1' }
  s.source         = { :git => '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = '**/*.{h,m,mm,swift}'
end
