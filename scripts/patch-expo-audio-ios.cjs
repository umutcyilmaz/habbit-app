// SDK 54 / expo-audio 1.1.1: native gapless queue looping and explicit resume.
// Fail closed on dependency upgrades; re-review the native implementation first.
const fs = require('node:fs');
const path = require('node:path');
const root = process.argv[2] ? path.resolve(process.argv[2]) : path.dirname(require.resolve('expo-audio/package.json'));
if (require(path.join(root, 'package.json')).version !== '1.1.1') throw new Error('Review Bloom audio patch before upgrading expo-audio');
function edit(file, replacements) {
  const p = path.join(root, 'ios', file);
  let s = fs.readFileSync(p, 'utf8');
  if (s.includes('// Bloom audio patch v1')) return;
  for (const [source, to] of replacements) {
    const from = typeof source === 'function' ? source(s) : source;
    if (!s.includes(from)) throw new Error(`Audio patch context missing: ${file}`);
    s = s.replace(from, to);
  }
  fs.writeFileSync(p, '// Bloom audio patch v1\n' + s);
}
edit('AudioUtils.swift', [
  ['return AVPlayer(playerItem: item)', 'return AVQueuePlayer(playerItem: item)'],
  ['return AVPlayer()', 'return AVQueuePlayer()']
]);
edit('AudioPlayer.swift', [
  ['var isLooping = false', `private var audioLooper: AVPlayerLooper?
  var isLooping = false {
    didSet {
      if isLooping { configureGaplessLoop() }
      else { audioLooper?.disableLooping(); audioLooper = nil }
    }
  }

  private func configureGaplessLoop() {
    guard isLooping, audioLooper == nil, let queue = ref as? AVQueuePlayer,
      let item = queue.currentItem, item.status == .readyToPlay else { return }
    queue.removeAllItems()
    audioLooper = AVPlayerLooper(player: queue, templateItem: item)
  }`],
  ['if status == .readyToPlay {', 'if status == .readyToPlay {\n          self.configureGaplessLoop()'],
  ['private func addPlaybackEndNotification() {', 'private func addPlaybackEndNotification() {\n    if isLooping && ref is AVQueuePlayer { return }'],
  ['ref.replaceCurrentItem(with: AudioUtils.createAVPlayerItem(from: source))', 'audioLooper?.disableLooping()\n    audioLooper = nil\n    ref.replaceCurrentItem(with: AudioUtils.createAVPlayerItem(from: source))'],
  ['public override func sharedObjectWillRelease() {', 'public override func sharedObjectWillRelease() {\n    audioLooper?.disableLooping()\n    audioLooper = nil\n    (ref as? AVQueuePlayer)?.removeAllItems()']
]);
edit('AudioModule.swift', [
  ['resumeAllPlayers()', '// Bloom: user explicitly resumes after foregrounding.'],
  [s => s.match(/  private func handleInterruptionEnded\(with options:[\s\S]*?\n  }/)[0], `  private func handleInterruptionEnded(with options: AVAudioSession.InterruptionOptions) {
    // Explicit resume: leave the session inactive until the next user play.
    interruptedPlayers.removeAll()
    playerVolumes.removeAll()
  }`],
  ['player.ref.pause()\n        if !player.keepAudioSessionActive', 'player.wasPlaying = false\n        self.interruptedPlayers.remove(player.id)\n        player.ref.pause()\n        if !player.keepAudioSessionActive']
]);
for (const [file, expected] of Object.entries({"AudioUtils.swift": "0995d165d38582921885d6b06f1ccdb2decd777bf1c1c8715252190f5a247048", "AudioPlayer.swift": "7417db6dea0d6f7c4011d08206a9749d2469055c5b4b37e26c4afa6e1dc7dfa1", "AudioModule.swift": "be9b25a69591881b367ea3bb16446c57452cdf79815173743d02a1d66bbee65f"})) {
  const actual = require('node:crypto').createHash('sha256').update(fs.readFileSync(path.join(root, 'ios', file))).digest('hex');
  if (actual !== expected) throw new Error(`Patched expo-audio file differs: ${file}`);
}
console.log('Bloom iOS audio patch verified (expo-audio 1.1.1).');
