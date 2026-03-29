import json
import re
from collections import Counter, defaultdict

def tokenize(text):
    return re.findall(r'\w+', text.lower())

def train_model(dataset_path, output_path):
    with open(dataset_path, 'r') as f:
        data = json.load(f)

    # We'll build a simple Naive Bayes-like classifier for Intent
    # and a frequency-based dictionary for Entities.
    
    intent_word_counts = defaultdict(Counter)
    intent_counts = Counter()
    
    # Entity patterns (simple dictionary based for this scratch model)
    entity_map = {
        "task": Counter(),
        "item": Counter(),
        "date": Counter(),
        "location": Counter()
    }

    for entry in data:
        text = entry['text']
        entities = entry['entities']
        
        # In our synthetic data, 'task' verb acts as the intent indicator
        intent = entities.get('task', 'task').lower()
        intent_counts[intent] += 1
        
        tokens = tokenize(text)
        for token in tokens:
            intent_word_counts[intent][token] += 1
            
        # Map entities
        for key in entity_map:
            val = entities.get(key)
            if val:
                entity_map[key][val.lower()] += 1

    # Convert counts to a "model" structure
    model = {
        "intents": list(intent_counts.keys()),
        "intent_probs": {intent: count / sum(intent_counts.values()) for intent, count in intent_counts.items()},
        "word_probs": {},
        "entities": {
            key: [item for item, count in counter.most_common(50)]
            for key, counter in entity_map.items()
        }
    }

    # Calculate word probabilities per intent
    all_words = set()
    for counts in intent_word_counts.values():
        all_words.update(counts.keys())

    for intent in model["intents"]:
        total_words = sum(intent_word_counts[intent].values())
        model["word_probs"][intent] = {
            word: (intent_word_counts[intent][word] + 1) / (total_words + len(all_words))
            for word in all_words if intent_word_counts[intent][word] > 0
        }
    
    # Save the model
    with open(output_path, 'w') as f:
        json.dump(model, f, indent=2)
    
    print(f"Model trained on {len(data)} examples and saved to {output_path}")

if __name__ == "__main__":
    train_model(r"e:\CEG\sem 4\Project\training_data.json", r"e:\CEG\sem 4\Project\assets\custom_model.json")
