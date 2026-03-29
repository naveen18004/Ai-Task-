# Offline AI Model Implementation Plan

The objective is to make task generation (converting raw text/voice into structured tasks) smarter, more accurate, and capable of working completely offline within your existing React Native (Expo) application.

## Approaches Discussed

### Approach 1: On-Device Small LLM (Recommended for Maximum "Smartness" & Accuracy)
We integrate a very small, quantized Large Language Model (e.g., a lightweight 0.5B or 1B parameter model) directly into the app using a library like `llama.rn` (Llama.cpp for React Native) or `react-native-webrtc`/WASM.
* **Pros:** Highly accurate. Understands complex natural language just like Gemini/Groq. Can be prompted to output exact JSON. Works entirely offline.
* **Cons:** Increases the app size significantly (by roughly 300MB to 800MB depending on the model). Requires changing from Expo Go to custom Expo Dev Builds (`expo run:android` / `expo run:ios`) because it needs native C++ code.

### Approach 2: Custom Text Classification / NER Model (Recommended for Speed & Small App Size)
We train a targeted NLP (Natural Language Processing) model using Python (e.g., using spaCy or TensorFlow) specifically to detect "Tasks", "Deadlines", and "Action Items" from text. We then convert this model to TensorFlow Lite (.tflite) or ONNX and run it in the app.
* **Pros:** Extremely fast and battery-friendly. Very small impact on app size (only 10-30MB). Works entirely offline.
* **Cons:** Less flexible than an LLM. It won't "understand" general conversation, it will ONLY do what it's trained to do (extract tasks). Requires us to create a training dataset manually first.

---

## Proposed Changes (Assuming Approach 1 - On-Device LLM is chosen)

### 1. Model Selection & Conversion
- Download a lightweight, smart model optimized for mobile (e.g., `Qwen2.5-0.5B-Instruct-GGUF` or `Llama-3.2-1B-Instruct`).
- Place the model file (`.gguf`) inside the app assets to be bundled.

### 2. React Native Native Dependencies
#### `llama.rn` Integration
- Add `llama.rn` for running the GGUF model via React Native bindings.
- Add `expo-file-system` code to load the model file from assets to the device's local file system.

### 3. Application Logic
#### Task Parsing Logic
- Update the component that currently calls the Gemini/Groq APIs.
- Create a new utility function `parseTaskOffline(text)` that sends the text to the local LLM with a strict prompt to return your exact Task JSON structure.
- Add a fallback system: Try offline model first -> fallback to Cloud if confidence is low (or just use offline exclusively).

## Verification Plan

### Automated Tests
- We will mock the `llama.rn` responses in a Jest test to ensure the JSON parsing correctly handles the local model's output formatting.

### Manual Verification
1. Disconnect the device/emulator from the internet (Airplane Mode).
2. Input complex voice or clipboard text (e.g., "Remind me to call John tomorrow morning about the AI project").
3. Verify that a task is accurately created with the correct title ("Call John about AI project") and deadline ("Tomorrow morning").
4. Verify that the app does not crash under memory constraints.
