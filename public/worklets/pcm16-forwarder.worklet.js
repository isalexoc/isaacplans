/**
 * Live objection listener — call tab audio to PCM signed 16-bit, mono, for ElevenLabs Scribe.
 *
 * WHY PLAIN JS IN public/
 * `audioWorklet.addModule()` takes a URL and fetches it at runtime; webpack never sees it. A .ts
 * file under lib/ would be compiled into the page bundle and there would be nothing at a URL to
 * fetch, and `import` inside a worklet module is unsupported in Chrome. Same-origin out of public/
 * rather than a blob: URL, so there is nothing to whitelist if a CSP is ever added to this app.
 * The `?v=` cache-buster lives in hooks/use-live-objection-listener.ts — bump it when you edit
 * this file, or the CDN will keep serving the copy already in the browser's HTTP cache.
 *
 * WHY AudioWorklet AND NOT ScriptProcessorNode
 * ScriptProcessorNode runs its callback on the MAIN thread — the same thread that renders
 * PortableText and runs the answer dialog's focus trap. The audio callback would be starved at
 * exactly the moment this feature does its job. AudioWorklet runs on the audio rendering thread at
 * real-time priority, keeps rendering while the tab is hidden (Isaac will be looking at the call
 * tab, not this one), and is not deprecated.
 *
 * WHAT IS DELIBERATELY ABSENT: any resampling, and any stereo downmix. The node is created with
 * channelCount:1 / channelCountMode:"explicit", so Web Audio has already downmixed the tab's
 * stereo capture before process() is called. And the sample rate is not converted — whatever rate
 * the AudioContext gives us is declared to ElevenLabs, whose audio_format enum covers every rate
 * Chrome will hand back. A hand-rolled sinc resampler here would be worse than both.
 */
class Pcm16Forwarder extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const opts = (options && options.processorOptions) || {};
    // 2048 samples is 128 ms at 16 kHz, inside the "0.1 - 1 second" chunk window ElevenLabs
    // documents. Smaller frames are almost pure WebSocket header; larger ones add latency to a
    // popup that is only useful if it beats the agent's own reaction time.
    this.frameSamples = opts.frameSamples || 2048;
    this.frame = new Int16Array(this.frameSamples);
    this.n = 0;
    this.peak = 0;
    this.stopped = false;
    this.port.onmessage = (event) => {
      if (event.data && event.data.type === "stop") this.stopped = true;
    };
  }

  process(inputs) {
    if (this.stopped) return false;

    const channel = inputs[0] && inputs[0][0];
    // A muted or momentarily-ended track delivers an empty input. Stay alive: display capture goes
    // briefly quiet during Chrome's "share this tab instead" surface switch and then comes back.
    if (!channel || channel.length === 0) return true;

    for (let i = 0; i < channel.length; i += 1) {
      const sample = channel[i] > 1 ? 1 : channel[i] < -1 ? -1 : channel[i];
      const magnitude = sample < 0 ? -sample : sample;
      if (magnitude > this.peak) this.peak = magnitude;

      this.frame[this.n] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      this.n += 1;

      if (this.n === this.frameSamples) {
        // A fresh copy every frame: the previous buffer was transferred away and is detached.
        // 4 KB of garbage every 128 ms is nothing, and it buys a zero-copy handoff.
        const out = new Int16Array(this.frame);
        const peak = this.peak;
        this.n = 0;
        this.peak = 0;
        this.port.postMessage({ pcm: out.buffer, peak: peak }, [out.buffer]);
      }
    }

    return true;
  }
}

registerProcessor("pcm16-forwarder", Pcm16Forwarder);
