const axios = require('axios');
const logger = require('../utils/logger');
const { cache } = require('../config/cache');

class WeatherService {
  constructor() {
    this.apiKey = process.env.WEATHER_API_KEY;
    this.baseUrl = 'https://api.openweathermap.org/data/2.5';
  }

  // Get current weather for location
  async getCurrentWeather(lat, lng) {
    try {
      // Check cache first (5 minutes TTL)
      const cacheKey = `weather_${lat}_${lng}`;
      const cachedWeather = await cache.get(cacheKey);
      
      if (cachedWeather) {
        logger.debug(`Weather cache hit for: ${lat}, ${lng}`);
        return cachedWeather;
      }

      // If no API key, return simulated data
      if (!this.apiKey) {
        logger.warn('Weather API key not configured, returning simulated data');
        return this.getSimulatedWeather(lat, lng);
      }

      const response = await axios.get(`${this.baseUrl}/weather`, {
        params: {
          lat,
          lon: lng,
          appid: this.apiKey,
          units: 'metric'
        }
      });

      const weather = {
        temperature: response.data.main.temp,
        feelsLike: response.data.main.feels_like,
        condition: response.data.weather[0].main.toLowerCase(),
        description: response.data.weather[0].description,
        humidity: response.data.main.humidity,
        windSpeed: response.data.wind.speed,
        cloudiness: response.data.clouds.all,
        visibility: response.data.visibility / 1000, // Convert to km
        rain: response.data.rain?.['1h'] || 0,
        isMonsoon: this.checkMonsoonCondition(response.data),
        advisory: this.getWeatherAdvisory(response.data)
      };

      // Cache for 5 minutes
      await cache.set(cacheKey, weather, 300);

      return weather;
    } catch (error) {
      logger.error('Error fetching current weather:', error.message);
      return this.getSimulatedWeather(lat, lng);
    }
  }

  // Get weather forecast (5 days)
  async getWeatherForecast(lat, lng) {
    try {
      const cacheKey = `forecast_${lat}_${lng}`;
      const cachedForecast = await cache.get(cacheKey);
      
      if (cachedForecast) {
        logger.debug(`Forecast cache hit for: ${lat}, ${lng}`);
        return cachedForecast;
      }

      if (!this.apiKey) {
        logger.warn('Weather API key not configured, returning simulated forecast');
        return this.getSimulatedForecast(lat, lng);
      }

      const response = await axios.get(`${this.baseUrl}/forecast`, {
        params: {
          lat,
          lon: lng,
          appid: this.apiKey,
          units: 'metric'
        }
      });

      const forecast = response.data.list.map(item => ({
        date: new Date(item.dt * 1000),
        temperature: item.main.temp,
        condition: item.weather[0].main.toLowerCase(),
        description: item.weather[0].description,
        humidity: item.main.humidity,
        windSpeed: item.wind.speed,
        rain: item.rain?.['3h'] || 0,
        pop: item.pop * 100 // Probability of precipitation
      }));

      // Group by day
      const dailyForecast = this.groupForecastByDay(forecast);

      // Cache for 1 hour
      await cache.set(cacheKey, dailyForecast, 3600);

      return dailyForecast;
    } catch (error) {
      logger.error('Error fetching weather forecast:', error.message);
      return this.getSimulatedForecast(lat, lng);
    }
  }

  // Check monsoon conditions
  checkMonsoonCondition(weatherData) {
    const rainAmount = weatherData.rain?.['1h'] || 0;
    const windSpeed = weatherData.wind?.speed || 0;
    const humidity = weatherData.main?.humidity || 0;

    // Consider it monsoon if heavy rain, high humidity, and strong winds
    return rainAmount > 5 || (rainAmount > 2 && humidity > 80 && windSpeed > 20);
  }

  // Get weather advisory for travel
  getWeatherAdvisory(weatherData) {
    const condition = weatherData.weather[0].main.toLowerCase();
    const rainAmount = weatherData.rain?.['1h'] || 0;
    const windSpeed = weatherData.wind?.speed || 0;
    const visibility = weatherData.visibility / 1000;

    const advisories = [];

    // Rain advisories
    if (rainAmount > 10) {
      advisories.push({
        level: 'critical',
        type: 'rain',
        message: 'Heavy rain warning! Avoid travel if possible.',
        icon: '🌧️⚠️'
      });
    } else if (rainAmount > 5) {
      advisories.push({
        level: 'high',
        type: 'rain',
        message: 'Moderate to heavy rain. Exercise caution while traveling.',
        icon: '🌧️'
      });
    } else if (rainAmount > 2) {
      advisories.push({
        level: 'medium',
        type: 'rain',
        message: 'Light rain expected. Carry an umbrella.',
        icon: '☔'
      });
    }

    // Wind advisories
    if (windSpeed > 25) {
      advisories.push({
        level: 'high',
        type: 'wind',
        message: 'Strong winds. Be cautious near coastal areas.',
        icon: '💨'
      });
    }

    // Visibility advisories
    if (visibility < 2) {
      advisories.push({
        level: 'high',
        type: 'visibility',
        message: 'Poor visibility. Drive carefully.',
        icon: '🌫️'
      });
    }

    // Temperature advisories
    const temp = weatherData.main.temp;
    if (temp > 35) {
      advisories.push({
        level: 'medium',
        type: 'heat',
        message: 'Very hot weather. Stay hydrated and avoid midday sun.',
        icon: '☀️🔥'
      });
    }

    // Good conditions
    if (advisories.length === 0 && condition === 'clear') {
      advisories.push({
        level: 'low',
        type: 'good',
        message: 'Perfect weather for exploring!',
        icon: '☀️'
      });
    }

    return advisories;
  }

  // Group forecast by day
  groupForecastByDay(forecast) {
    const grouped = {};

    forecast.forEach(item => {
      const date = item.date.toISOString().split('T')[0];
      
      if (!grouped[date]) {
        grouped[date] = {
          date,
          items: [],
          avgTemp: 0,
          maxTemp: -Infinity,
          minTemp: Infinity,
          conditions: [],
          totalRain: 0,
          avgHumidity: 0,
          avgWindSpeed: 0
        };
      }

      grouped[date].items.push(item);
      grouped[date].maxTemp = Math.max(grouped[date].maxTemp, item.temperature);
      grouped[date].minTemp = Math.min(grouped[date].minTemp, item.temperature);
      grouped[date].conditions.push(item.condition);
      grouped[date].totalRain += item.rain;
    });

    // Calculate averages
    return Object.values(grouped).map(day => {
      const itemCount = day.items.length;
      
      return {
        date: day.date,
        avgTemp: Math.round(day.items.reduce((sum, i) => sum + i.temperature, 0) / itemCount),
        maxTemp: Math.round(day.maxTemp),
        minTemp: Math.round(day.minTemp),
        condition: this.getMostCommonCondition(day.conditions),
        totalRain: Math.round(day.totalRain * 10) / 10,
        avgHumidity: Math.round(day.items.reduce((sum, i) => sum + i.humidity, 0) / itemCount),
        avgWindSpeed: Math.round(day.items.reduce((sum, i) => sum + i.windSpeed, 0) / itemCount),
        isMonsoonRisk: day.totalRain > 10 || day.avgHumidity > 85
      };
    }).slice(0, 5); // Return 5 days
  }

  // Get most common condition
  getMostCommonCondition(conditions) {
    const counts = {};
    let maxCount = 0;
    let mostCommon = conditions[0];

    conditions.forEach(condition => {
      counts[condition] = (counts[condition] || 0) + 1;
      if (counts[condition] > maxCount) {
        maxCount = counts[condition];
        mostCommon = condition;
      }
    });

    return mostCommon;
  }

  // Get monsoon season info for Sri Lanka
  getMonsoonSeasonInfo() {
    const now = new Date();
    const month = now.getMonth() + 1; // 1-12

    // Southwest Monsoon (Yala): May to September
    if (month >= 5 && month <= 9) {
      return {
        season: 'Southwest Monsoon (Yala)',
        period: 'May - September',
        affectedRegions: ['Western Coast', 'Southern Coast', 'Central Highlands'],
        description: 'Heavy rainfall expected in western and southern regions',
        travelTips: [
          'Best time to visit the east coast',
          'Expect rain in Colombo, Galle, and hill country',
          'Book indoor activities in advance',
          'Carry rain gear at all times'
        ]
      };
    }
    
    // Northeast Monsoon (Maha): October to January
    if (month >= 10 || month <= 1) {
      return {
        season: 'Northeast Monsoon (Maha)',
        period: 'October - January',
        affectedRegions: ['Northern Region', 'Eastern Coast', 'Central Region'],
        description: 'Heavy rainfall expected in northern and eastern regions',
        travelTips: [
          'Best time to visit the west and south coasts',
          'Expect rain in Jaffna, Trincomalee',
          'Great weather in Colombo and Galle',
          'Hill country may be cool and misty'
        ]
      };
    }

    // Inter-monsoon periods
    return {
      season: 'Inter-Monsoon Period',
      period: month >= 2 && month <= 4 ? 'February - April' : 'October',
      affectedRegions: ['Variable'],
      description: 'Transitional weather with occasional thunderstorms',
      travelTips: [
        'Generally good weather across the island',
        'Occasional afternoon thunderstorms',
        'Best time for all-island travel',
        'Morning and evenings are pleasant'
      ]
    };
  }

  // Simulated weather for development/testing
  getSimulatedWeather(lat, lng) {
    const hour = new Date().getHours();
    const isDay = hour >= 6 && hour <= 18;
    
    return {
      temperature: 28 + Math.random() * 4,
      feelsLike: 30 + Math.random() * 3,
      condition: isDay ? 'clear' : 'partly_cloudy',
      description: isDay ? 'Sunny with some clouds' : 'Partly cloudy',
      humidity: 70 + Math.random() * 15,
      windSpeed: 10 + Math.random() * 10,
      cloudiness: 30 + Math.random() * 20,
      visibility: 8 + Math.random() * 2,
      rain: 0,
      isMonsoon: false,
      advisory: [{
        level: 'low',
        type: 'good',
        message: 'Perfect weather for exploring!',
        icon: '☀️'
      }],
      simulated: true
    };
  }

  // Simulated forecast for development/testing
  getSimulatedForecast(lat, lng) {
    const forecast = [];
    const baseTemp = 28;

    for (let i = 0; i < 5; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);

      forecast.push({
        date: date.toISOString().split('T')[0],
        avgTemp: Math.round(baseTemp + Math.random() * 4),
        maxTemp: Math.round(baseTemp + 3 + Math.random() * 3),
        minTemp: Math.round(baseTemp - 2 + Math.random() * 2),
        condition: i % 2 === 0 ? 'clear' : 'partly_cloudy',
        totalRain: Math.random() > 0.7 ? Math.random() * 5 : 0,
        avgHumidity: Math.round(70 + Math.random() * 15),
        avgWindSpeed: Math.round(10 + Math.random() * 10),
        isMonsoonRisk: false
      });
    }

    return forecast;
  }

  // Journey planning with weather integration
  async planJourneyWithWeather(origin, destination, departureDate) {
    try {
      const departureTime = new Date(departureDate);
      const today = new Date();
      const daysUntilDeparture = Math.ceil((departureTime - today) / (1000 * 60 * 60 * 24));

      // Get weather forecast for destination
      const forecast = await this.getWeatherForecast(destination.lat, destination.lng);
      
      // Find forecast for departure date
      const departureDateStr = departureTime.toISOString().split('T')[0];
      const weatherOnDay = forecast.find(f => f.date === departureDateStr);

      // Get monsoon info
      const monsoonInfo = this.getMonsoonSeasonInfo();

      // Generate travel recommendations
      const recommendations = [];

      if (weatherOnDay) {
        if (weatherOnDay.isMonsoonRisk) {
          recommendations.push({
            type: 'warning',
            message: 'Heavy rain expected on your travel date. Consider rescheduling or plan indoor activities.',
            priority: 'high'
          });
        } else if (weatherOnDay.totalRain > 5) {
          recommendations.push({
            type: 'caution',
            message: 'Moderate rain expected. Pack rain gear and plan flexible itinerary.',
            priority: 'medium'
          });
        } else {
          recommendations.push({
            type: 'success',
            message: 'Good weather expected for your journey!',
            priority: 'low'
          });
        }
      }

      // Add monsoon-specific recommendations
      if (monsoonInfo.season.includes('Monsoon')) {
        recommendations.push({
          type: 'info',
          message: `${monsoonInfo.season} is active. ${monsoonInfo.description}`,
          priority: 'medium',
          tips: monsoonInfo.travelTips
        });
      }

      return {
        journey: {
          origin,
          destination,
          departureDate: departureTime,
          daysUntilDeparture
        },
        weather: {
          current: daysUntilDeparture === 0 ? await this.getCurrentWeather(destination.lat, destination.lng) : null,
          forecast: weatherOnDay,
          fullForecast: forecast
        },
        monsoon: monsoonInfo,
        recommendations,
        bestTimeToTravel: this.determineBestTimeToTravel(forecast),
        packingList: this.generatePackingList(weatherOnDay, monsoonInfo)
      };
    } catch (error) {
      logger.error('Error planning journey with weather:', error);
      throw error;
    }
  }

  // Determine best time to travel based on forecast
  determineBestTimeToTravel(forecast) {
    const goodDays = forecast.filter(day => 
      !day.isMonsoonRisk && day.totalRain < 5 && day.avgTemp < 33
    );

    if (goodDays.length > 0) {
      return {
        available: true,
        bestDates: goodDays.map(d => d.date),
        reason: 'Pleasant weather with minimal rain expected'
      };
    }

    return {
      available: false,
      bestDates: [],
      reason: 'All upcoming days show challenging weather conditions'
    };
  }

  // Generate packing list based on weather
  generatePackingList(weather, monsoonInfo) {
    const packingList = {
      essentials: ['Passport', 'Travel documents', 'Medications', 'Sunscreen', 'Insect repellent'],
      weatherSpecific: []
    };

    if (weather?.isMonsoonRisk || monsoonInfo.season.includes('Monsoon')) {
      packingList.weatherSpecific.push(
        'Waterproof jacket',
        'Umbrella',
        'Waterproof bags for electronics',
        'Quick-dry clothes',
        'Extra pair of shoes',
        'Waterproof phone case'
      );
    }

    if (weather?.avgTemp > 30) {
      packingList.weatherSpecific.push(
        'Light, breathable clothing',
        'Hat or cap',
        'Sunglasses',
        'Electrolyte drinks'
      );
    }

    return packingList;
  }
}

module.exports = new WeatherService();
