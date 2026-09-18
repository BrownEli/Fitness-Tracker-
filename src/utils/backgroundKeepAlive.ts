/**
 * Background Keep-Alive Helper
 * Keeps the browser process and Geolocation API active on mobile devices (Android Chrome, iOS Safari)
 * while the phone screen is locked or the phone is in a pocket by establishing an active background media session.
 */

class BackgroundKeepAliveService {
  private audioCtx: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  private oscillator: OscillatorNode | null = null;
  private audioEl: HTMLAudioElement | null = null;
  private isEngaged = false;

  public start(activityTitle = 'Outdoor Cardio Tracking') {
    if (this.isEngaged) return;
    this.isEngaged = true;

    try {
      // 1. Silent HTML5 audio element loop
      // 1-second silent WAV data URI
      const silentWav =
        'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
      if (!this.audioEl) {
        this.audioEl = new Audio(silentWav);
        this.audioEl.loop = true;
        this.audioEl.volume = 0.001;
      }
      this.audioEl.play().catch(() => {
        // May require user gesture, which handleStartActivity provides
      });

      // 2. Web Audio API near-inaudible carrier
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass && !this.audioCtx) {
        this.audioCtx = new AudioCtxClass();
        if (this.audioCtx.state === 'suspended') {
          this.audioCtx.resume().catch(() => {});
        }
        this.oscillator = this.audioCtx.createOscillator();
        this.gainNode = this.audioCtx.createGain();
        // Inaudible frequency and microscopic gain
        this.oscillator.frequency.value = 440;
        this.gainNode.gain.setValueAtTime(0.00001, this.audioCtx.currentTime);
        this.oscillator.connect(this.gainNode);
        this.gainNode.connect(this.audioCtx.destination);
        this.oscillator.start();
      }

      // 3. MediaSession metadata to register active workout playback on OS lock screen
      if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: activityTitle,
          artist: 'GPS Live Tracking',
          album: 'Continuous Workout Session'
        });
        navigator.mediaSession.playbackState = 'playing';
      }
    } catch (e) {
      console.warn('Background keep-alive init warning:', e);
    }
  }

  public stop() {
    this.isEngaged = false;

    try {
      if (this.oscillator) {
        this.oscillator.stop();
        this.oscillator.disconnect();
        this.oscillator = null;
      }
      if (this.gainNode) {
        this.gainNode.disconnect();
        this.gainNode = null;
      }
      if (this.audioCtx) {
        this.audioCtx.close().catch(() => {});
        this.audioCtx = null;
      }
      if (this.audioEl) {
        this.audioEl.pause();
        this.audioEl.currentTime = 0;
        this.audioEl = null;
      }
      if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'none';
      }
    } catch {}
  }
}

export const backgroundKeepAlive = new BackgroundKeepAliveService();
