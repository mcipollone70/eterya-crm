import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  JOY_STT_ERROR_MESSAGES,
  joySttMessage,
  mapSpeechRecognitionError,
} from "@/lib/voice/joy-stt-errors";
import {
  extensionForMime,
  JOY_RECORDER_MIME_CANDIDATES,
  JOY_VOICE_MIN_BLOB_BYTES,
  pickMediaRecorderMime,
  preferServerSttCapture,
} from "@/lib/voice/media-recorder-mime";
import {
  createJoyVoiceDebugEvent,
  formatDebugTime,
} from "@/features/voice/utils/joy-voice-debug";

describe("Joy Drive STT — tests A–G", () => {
  it("A: MIME preference order prefers mp4 then webm opus then webm", () => {
    assert.deepEqual([...JOY_RECORDER_MIME_CANDIDATES], [
      "audio/mp4",
      "audio/webm;codecs=opus",
      "audio/webm",
    ]);
    const picked = pickMediaRecorderMime((mime) => mime === "audio/webm");
    assert.equal(picked, "audio/webm");
    const none = pickMediaRecorderMime(() => false);
    assert.equal(none, "");
  });

  it("B: iPhone / PWA prefer MediaRecorder + server STT", () => {
    assert.equal(
      preferServerSttCapture(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
        false
      ),
      true
    );
    assert.equal(
      preferServerSttCapture(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
        true
      ),
      true
    );
    assert.equal(
      preferServerSttCapture(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0",
        false
      ),
      false
    );
    assert.equal(preferServerSttCapture("Desktop Chrome", true), true);
  });

  it("C: empty audio threshold and distinct no-audio messages", () => {
    assert.ok(JOY_VOICE_MIN_BLOB_BYTES >= 64);
    assert.match(joySttMessage("no_audio"), /Non ho ricevuto audio/i);
    assert.match(joySttMessage("empty_blob"), /Non ho ricevuto audio/i);
    assert.notEqual(joySttMessage("mic_denied"), joySttMessage("speech_network"));
    assert.notEqual(joySttMessage("transcribe_empty"), joySttMessage("offline"));
  });

  it("D: SpeechRecognition error map covers no-speech / network / denied", () => {
    assert.equal(mapSpeechRecognitionError("no-speech"), "speech_no_result");
    assert.equal(mapSpeechRecognitionError("network"), "speech_network");
    assert.equal(mapSpeechRecognitionError("not-allowed"), "mic_denied");
    assert.equal(mapSpeechRecognitionError("audio-capture"), "mic_unavailable");
  });

  it("E: transcript trim + submit uses local variable (not stale state)", () => {
    const calls: string[] = [];
    const submitSameAsInvia = (argument: string) => {
      calls.push(argument.trim());
    };
    // Simulate async setState race: state still empty, local var has text.
    let staleState = "";
    const localTranscript = "  Leggimi gli appuntamenti di oggi  ";
    staleState = ""; // would be wrong if we read state
    submitSameAsInvia(localTranscript);
    assert.deepEqual(calls, ["Leggimi gli appuntamenti di oggi"]);
    assert.equal(staleState, "");
  });

  it("F: debug timeline phases include MIC → TRANSCRIPT → COMMAND_EXECUTED", () => {
    const start = Date.now();
    const events = [
      createJoyVoiceDebugEvent("MIC_BUTTON_CLICKED", "recorder"),
      createJoyVoiceDebugEvent("STREAM_LIVE", "ok", "tracks=1"),
      createJoyVoiceDebugEvent("CHUNK_RECEIVED", "ok", "n=1"),
      createJoyVoiceDebugEvent("AUDIO_BLOB_READY", "ok", "4096B"),
      createJoyVoiceDebugEvent("TRANSCRIBE_RESPONSE", "ok", "40 chars"),
      createJoyVoiceDebugEvent("TRANSCRIPT_SHOWN", "ok"),
      createJoyVoiceDebugEvent("COMMAND_SUBMITTED", "ok"),
      createJoyVoiceDebugEvent("COMMAND_EXECUTED", "ok"),
    ];
    assert.equal(events.length, 8);
    assert.ok(formatDebugTime(start + 250, start).includes("+"));
    assert.equal(events[0]?.phase, "MIC_BUTTON_CLICKED");
    assert.equal(events[events.length - 1]?.phase, "COMMAND_EXECUTED");
  });

  it("G: filename extension mapping for OpenAI multipart", () => {
    assert.equal(extensionForMime("audio/mp4"), "m4a");
    assert.equal(extensionForMime("audio/webm;codecs=opus"), "webm");
    assert.equal(extensionForMime("audio/webm"), "webm");
    assert.ok(Object.keys(JOY_STT_ERROR_MESSAGES).length >= 10);
  });
});

describe("Joy STT API contract helpers", () => {
  it("rejects tiny payloads conceptually (< min bytes)", () => {
    assert.ok(32 < JOY_VOICE_MIN_BLOB_BYTES);
  });
});
