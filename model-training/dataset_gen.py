import random
import json
import re

# Define entities for synthetic data generation
TASKS = ["Buy", "Prepare", "Submit", "Meet", "Call", "Clean", "Study", "Review", "Visit", "Attend", "Organize", "Email", "Draft", "Schedule", "Check", "Fix", "Update", "Book"]
ITEMS = ["milk", "report", "project", "client", "John", "kitchen", "Math", "notes", "dentist", "proposal", "contract", "Sarah", "car", "flights", "tickets", "codebase", "bug", "meeting", "presentation"]
DATES = ["tomorrow", "at 5pm", "next Monday", "today", "on Friday", "at 10:00", "tonight", "this weekend", "in 2 hours", "at 2:30 PM", "next week", "02.03.2026", "March 5th"]
LOCATIONS = ["in Starbucks", "at home", "in the office", "at campus", "in room 302", "online", "via Zoom", "at the library", "in the conference room", "at the gym", "downtown"]

# Noise/Fragmented simulation for OCR fallback
NOISE = ["Battery 5%", "12:34 PM", "---", "####", "[X]", "Copy Link", "Share", "...", "Error 404", "User 123", "Search", "Menu"]

def generate_synthetic_data(count=5000):
    dataset = []
    for _ in range(count):
        # Case 1: Standard clean task
        if random.random() > 0.2:
            task = random.choice(TASKS)
            item = random.choice(ITEMS)
            date = random.choice(DATES)
            loc = random.choice(LOCATIONS)
            
            sentence_parts = [task, item]
            if random.random() > 0.3: sentence_parts.append(date)
            if random.random() > 0.5: sentence_parts.append(loc)
            
            # Randomly add noise
            if random.random() > 0.8:
                sentence_parts.insert(random.randint(0, len(sentence_parts)), random.choice(NOISE))

            sentence = " ".join(sentence_parts)
            dataset.append({
                "text": sentence,
                "entities": {
                    "task": task,
                    "item": item,
                    "date": date if date in sentence else None,
                    "location": loc if loc in sentence else None
                }
            })
        else:
            # Case 2: No task (Negative example/Noise)
            noise_text = " ".join(random.sample(NOISE, 2)) + " " + random.choice(["Random fact about AI", "Just a normal day", "Hello world"])
            dataset.append({
                "text": noise_text,
                "entities": {
                    "task": "none",
                    "item": None,
                    "date": None,
                    "location": None
                }
            })
    return dataset

if __name__ == "__main__":
    data = generate_synthetic_data(5000)
    output_path = r"e:\CEG\sem 4\Project\training_data.json"
    with open(output_path, "w") as f:
        json.dump(data, f, indent=2)
    print(f"Generated {len(data)} training examples.")
