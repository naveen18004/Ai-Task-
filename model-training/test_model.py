import json
import re
import math

def tokenize(text):
    return re.findall(r'\w+', text.lower())

class ModelTester:
    def __init__(self, model_path):
        with open(model_path, 'r') as f:
            self.model = json.load(f)

    def classify_intent(self, text):
        tokens = tokenize(text)
        best_intent = 'task'
        max_prob = -float('inf')

        for intent in self.model['intents']:
            # P(Intent)
            score = math.log(self.model['intent_probs'][intent])
            
            # P(Word | Intent)
            for token in tokens:
                if intent in self.model['word_probs'] and token in self.model['word_probs'][intent]:
                    score += math.log(self.model['word_probs'][intent][token])
                else:
                    # Laplace smoothing factor
                    score += math.log(1 / (1000 + len(self.model['word_probs'].get(intent, {}))))

            if score > max_prob:
                max_prob = score
                best_intent = intent
        
        return best_intent

    def extract_entities(self, text):
        found = {}
        for key, items in self.model['entities'].items():
            for item in items:
                if item.lower() in text.lower():
                    found[key] = item
                    break
        return found

    def test_case(self, name, text):
        intent = self.classify_intent(text)
        entities = self.extract_entities(text)
        print(f"--- TEST: {name} ---")
        print(f"Input:  \"{text}\"")
        print(f"Intent: {intent}")
        print(f"Entity: {entities}")
        print("-" * 20)

if __name__ == "__main__":
    tester = ModelTester(r"e:\CEG\sem 4\Project\assets\custom_model.json")
    
    # Use Case 1: Standard Voice
    tester.test_case("Voice Transcript", "Remind me to buy milk tomorrow at Starbucks")
    
    # Use Case 2: OCR with Noise
    tester.test_case("OCR Fragment", "Battery 5% --- Meeting client in 2 hours")
    
    # Use Case 3: Clipboard
    tester.test_case("Clipboard", "Submit the final project report on Friday")
    
    # Use Case 4: Negative Case (Pure Noise)
    tester.test_case("Noise Only", "Battery 5% Search Menu Error 404")
    
    # Use Case 5: Complex NER
    tester.test_case("Specific NER", "Call Sarah at the gym tonight")

    # --- NEW EXTENDED CASES ---
    
    # Use Case 6: Professional Email Intent
    tester.test_case("Email Intent", "Draft an email to the codebase team about the new bug")
    
    # Use Case 7: Scheduling / Meeting
    tester.test_case("Schedule Meeting", "Schedule a presentation review with the client at the office next week")
    
    # Use Case 8: Educational Submission
    tester.test_case("Education Intent", "Prepare the Math notes for the final exam today")
    
    # Use Case 9: Travel / Booking
    tester.test_case("Booking Intent", "Book flights and tickets for the conference room downtown")
    
    # Use Case 10: Health / Appointment
    tester.test_case("Checkup Intent", "Check with the dentist at the campus clinic on Friday")

    # Use Case 11: Real-world mixed noise (WhatsApp/Chat)
    tester.test_case("Chat Clip", "12:35 PM - Sarah: Hey, fix the bug in the project tonight please")

    # Use Case 12: Action without date
    tester.test_case("No Date", "Clean the kitchen and visit the library")
    
    # Use Case 13: Mixed Case & Punctuation
    tester.test_case("Mixed Formatting", "!!! ATTEND the MEETING with JOHN tomorrow !!!")
