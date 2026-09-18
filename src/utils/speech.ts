export function speakEnglish(text: string, onEnd?: () => void) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    console.warn('Speech synthesis not supported on this browser.');
    return;
  }

  // Cancel any ongoing speech
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  utterance.rate = 0.9; // Slightly slower for language learners
  utterance.pitch = 1.0;

  // Try to pick a natural English voice if available
  const voices = window.speechSynthesis.getVoices();
  const naturalVoice = voices.find(
    (v) => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Daniel'))
  ) || voices.find((v) => v.lang.startsWith('en'));

  if (naturalVoice) {
    utterance.voice = naturalVoice;
  }

  if (onEnd) {
    utterance.onend = onEnd;
    utterance.onerror = onEnd;
  }

  window.speechSynthesis.speak(utterance);
}

/**
 * Plays high-quality native human audio from Free Dictionary API if available,
 * otherwise falls back smoothly to browser speech synthesis.
 */
export function playAudioOrSpeak(text: string, audioUrl?: string, onEnd?: () => void) {
  if (audioUrl && audioUrl.trim()) {
    try {
      const fixedUrl = audioUrl.startsWith('//') ? `https:${audioUrl}` : audioUrl;
      const audio = new Audio(fixedUrl);
      audio.onended = () => onEnd?.();
      audio.onerror = () => {
        // Fallback to speech synthesis if audio link fails (e.g. 404 or CORS)
        speakEnglish(text, onEnd);
      };
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          speakEnglish(text, onEnd);
        });
      }
      return;
    } catch {
      speakEnglish(text, onEnd);
      return;
    }
  }

  speakEnglish(text, onEnd);
}
