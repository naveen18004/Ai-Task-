import * as Contacts from 'expo-contacts';
import { Alert, Linking, Platform } from 'react-native';

/**
 * Autonomous Action Engine
 * Takes inferred NLP contact identities and semantic payloads and constructs secure native hardware execution hooks.
 */
export const handleAIAgentAction = async (intent: string, contact: string = '', payload: string = '') => {
    try {
        let rawContact = contact ? contact.trim() : '';

        // If contact looks like a natural name (contains letters), request OS resolution
        if (rawContact && !/^[0-9+\-\s()\/.]+$/.test(rawContact)) {
            const { status } = await Contacts.requestPermissionsAsync();
            if (status === 'granted') {
                // Background mathematical search against physical address book
                const { data } = await Contacts.getContactsAsync({
                    name: rawContact,
                    fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Emails],
                });

                if (data.length > 0) {
                    const firstMatch = data[0];
                    if (intent === 'email' && firstMatch.emails && firstMatch.emails.length > 0) {
                        rawContact = firstMatch.emails[0].email || rawContact;
                    } else if ((intent === 'sms' || intent === 'call') && firstMatch.phoneNumbers && firstMatch.phoneNumbers.length > 0) {
                        rawContact = firstMatch.phoneNumbers[0].number || rawContact;
                    }
                } else {
                    Alert.alert("Contact Not Found", `The AI couldn't find '${rawContact}' in your device's address book. You will have to type the number manually!`);
                    rawContact = ''; // Reset to empty so it still opens the draft
                }
            } else {
                Alert.alert("Permission", "Please allow Contacts permission to enable Autonomous AI name resolution.");
                rawContact = '';
            }
        }

        if (intent === 'email') {
            const subject = encodeURIComponent('Task Assistant');
            const body = encodeURIComponent(payload);
            const emailTo = rawContact.includes('@') ? rawContact : ''; // Protect targeting

            const url = `mailto:${emailTo}?subject=${subject}&body=${body}`;
            const canOpen = await Linking.canOpenURL(url);

            if (canOpen) await Linking.openURL(url);
            else Alert.alert("Agent Blocked", "Mail app is not available on this device.");

        } else if (intent === 'sms') {
            const body = encodeURIComponent(payload);
            const separator = Platform.OS === 'ios' ? '&' : '?';

            // Clean up the target number (strip dashes if any from the Contacts output)
            const finalNum = rawContact.replace(/[^0-9+]/g, '');

            const url = `sms:${finalNum}${separator}body=${body}`;
            const canOpen = await Linking.canOpenURL(url);

            if (canOpen) await Linking.openURL(url);
            else Alert.alert("Agent Blocked", "Messages app is not available on this device.");
        }
    } catch (error) {
        console.warn("AI Agent Execution Failed", error);
        Alert.alert("Execution Error", "The AI Action Agent failed to interface with OS software.");
    }
};
