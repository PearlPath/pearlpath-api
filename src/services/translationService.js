const logger = require('../utils/logger');

class TranslationService {
  constructor() {
    this.supportedLanguages = ['en', 'si', 'ta'];
    this.defaultLanguage = 'en';
  }

  // Translate text (placeholder for future integration with translation API)
  async translateText(text, fromLang, toLang) {
    try {
      if (fromLang === toLang) {
        return text;
      }

      // This would typically integrate with Google Translate or similar service
      // For now, returning the original text with a note
      logger.info(`Translation requested: ${fromLang} -> ${toLang}: ${text.substring(0, 50)}...`);
      
      return text; // Placeholder - would return translated text
    } catch (error) {
      logger.error('Error translating text:', error);
      return text; // Return original text if translation fails
    }
  }

  // Translate object properties
  async translateObject(obj, fromLang, toLang, properties = []) {
    try {
      if (fromLang === toLang) {
        return obj;
      }

      const translated = { ...obj };
      
      for (const prop of properties) {
        if (obj[prop]) {
          translated[prop] = await this.translateText(obj[prop], fromLang, toLang);
        }
      }

      return translated;
    } catch (error) {
      logger.error('Error translating object:', error);
      return obj;
    }
  }

  // Get language name in native script
  getLanguageName(langCode) {
    const languages = {
      'en': 'English',
      'si': 'සිංහල',
      'ta': 'தமிழ்'
    };
    
    return languages[langCode] || languages[this.defaultLanguage];
  }

  // Detect language from text (placeholder)
  async detectLanguage(text) {
    try {
      // This would typically use a language detection service
      // For now, returning a simple heuristic
      if (/[\u0D80-\u0DFF]/.test(text)) {
        return 'si'; // Sinhala
      } else if (/[\u0B80-\u0BFF]/.test(text)) {
        return 'ta'; // Tamil
      } else {
        return 'en'; // English (default)
      }
    } catch (error) {
      logger.error('Error detecting language:', error);
      return this.defaultLanguage;
    }
  }

  // Get supported languages
  getSupportedLanguages() {
    return this.supportedLanguages.map(lang => ({
      code: lang,
      name: this.getLanguageName(lang)
    }));
  }

  // Validate language code
  isValidLanguage(langCode) {
    return this.supportedLanguages.includes(langCode);
  }

  // Get default language
  getDefaultLanguage() {
    return this.defaultLanguage;
  }

  // Translate common phrases
  async translatePhrase(phraseKey, lang, params = {}) {
    try {
      const phrases = {
        'welcome': {
          'en': 'Welcome to PearlPath',
          'si': 'පර්ල්පාත් වෙත සාදරයෙන් පිළිගනිමු',
          'ta': 'பேர்ல்பாத்துக்கு வரவேற்கிறோம்'
        },
        'booking_confirmed': {
          'en': 'Your booking has been confirmed',
          'si': 'ඔබේ වෙන්කරවීම තහවුරු කර ඇත',
          'ta': 'உங்கள் முன்பதிவு உறுதிப்படுத்தப்பட்டது'
        },
        'guide_nearby': {
          'en': 'Guides near you',
          'si': 'ඔබට ආසන්නයේ ගයිඩ්වරු',
          'ta': 'உங்களுக்கு அருகில் வழிகாட்டிகள்'
        },
        'driver_available': {
          'en': 'Drivers available',
          'si': 'ලබා ගත හැකි රියදුරන්',
          'ta': 'கிடைக்கும் ஓட்டுநர்கள்'
        },
        'poi_nearby': {
          'en': 'Places near you',
          'si': 'ඔබට ආසන්නයේ ස්ථාන',
          'ta': 'உங்களுக்கு அருகில் உள்ள இடங்கள்'
        }
      };

      const phrase = phrases[phraseKey]?.[lang] || phrases[phraseKey]?.[this.defaultLanguage] || phraseKey;
      
      // Replace parameters in the phrase
      let translatedPhrase = phrase;
      for (const [key, value] of Object.entries(params)) {
        translatedPhrase = translatedPhrase.replace(`{${key}}`, value);
      }

      return translatedPhrase;
    } catch (error) {
      logger.error('Error translating phrase:', error);
      return phraseKey;
    }
  }

  // Get localized date format
  getDateFormat(lang) {
    const formats = {
      'en': 'MM/DD/YYYY',
      'si': 'DD/MM/YYYY',
      'ta': 'DD/MM/YYYY'
    };
    
    return formats[lang] || formats[this.defaultLanguage];
  }

  // Get localized time format
  getTimeFormat(lang) {
    const formats = {
      'en': '12h',
      'si': '12h',
      'ta': '12h'
    };
    
    return formats[lang] || formats[this.defaultLanguage];
  }

  // Get localized currency format
  getCurrencyFormat(lang) {
    const formats = {
      'en': 'LKR {amount}',
      'si': 'රු. {amount}',
      'ta': 'ரூ. {amount}'
    };
    
    return formats[lang] || formats[this.defaultLanguage];
  }

  // Format currency for display
  formatCurrency(amount, lang) {
    const format = this.getCurrencyFormat(lang);
    return format.replace('{amount}', amount.toLocaleString());
  }
}

module.exports = new TranslationService();
