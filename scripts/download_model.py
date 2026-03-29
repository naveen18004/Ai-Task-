import urllib.request
import os

model_url = "https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf?download=true"
assets_dir = "./assets/models"
model_path = os.path.join(assets_dir, "qwen2.5-0.5b-instruct.gguf")

if not os.path.exists(assets_dir):
    os.makedirs(assets_dir)

print(f"Downloading Qwen 2.5 0.5B Instruct model (approx 350MB)...")
print(f"URL: {model_url}")
print(f"Saving to: {model_path}")

try:
    urllib.request.urlretrieve(model_url, model_path)
    print("Download complete!")
except Exception as e:
    print(f"Error downloading model: {e}")
