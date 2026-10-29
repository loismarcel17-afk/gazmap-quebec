// French voice through the browser's speechSynthesis (offline on most phones:
// the text never leaves the device).

export function speechSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/** Québec French if the device has it, else any French voice, else null (browser default). */
export function pickFrenchVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const lang = (voice: SpeechSynthesisVoice) => voice.lang.toLowerCase().replace("_", "-");
  return (
    voices.find((voice) => lang(voice) === "fr-ca") ?? voices.find((voice) => lang(voice).startsWith("fr")) ?? null
  );
}

export function speak(text: string): void {
  if (!speechSupported()) return;
  const synth = window.speechSynthesis;
  // A new instruction replaces one still being spoken: the latest is what matters.
  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  // Voices load asynchronously: pick at speaking time, not once at startup.
  const voice = pickFrenchVoice(synth.getVoices());
  if (voice) utterance.voice = voice;
  utterance.lang = voice?.lang ?? "fr-CA";
  utterance.rate = 1;
  synth.speak(utterance);
}

export function stopSpeaking(): void {
  if (speechSupported()) window.speechSynthesis.cancel();
}
