import AVFoundation
import ExpoModulesCore

// The table's sound out loud while the camera or mic is on.
//
// When a page in the web view starts the camera or mic, WebKit puts the app's
// audio into call mode (the play-and-record category), and iOS sends call
// audio to the earpiece. Pip is not a phone call: the cues and the other
// seats' voices belong on the loudspeaker, as FaceTime puts them on a video
// call. So whenever the route changes, if call audio has landed on the
// earpiece, it is moved to the speaker. Headphones, AirPods and car audio are
// left alone: the override is only ever applied over the earpiece.
public class PipSpeakerModule: Module {
  private var observer: NSObjectProtocol?

  public func definition() -> ModuleDefinition {
    Name("PipSpeaker")

    OnCreate {
      self.observer = NotificationCenter.default.addObserver(
        forName: AVAudioSession.routeChangeNotification,
        object: nil,
        queue: .main
      ) { _ in
        PipSpeakerModule.preferSpeaker()
      }
      PipSpeakerModule.preferSpeaker()
    }

    OnDestroy {
      if let observer = self.observer {
        NotificationCenter.default.removeObserver(observer)
      }
    }

    // Called once from App.tsx so the module is created at launch.
    Function("start") {}
  }

  private static func preferSpeaker() {
    let session = AVAudioSession.sharedInstance()
    guard session.category == .playAndRecord else { return }
    let onEarpiece = session.currentRoute.outputs.contains { $0.portType == .builtInReceiver }
    guard onEarpiece else { return }
    // Changes the route, which notifies again; by then it is the speaker, so
    // this does not repeat.
    try? session.overrideOutputAudioPort(.speaker)
  }
}
