/**
 * Fetches the daily weather forecast from Open-Meteo and determines if
 * a weather alert should be generated for a specific future date and location.
 */

// Open-Meteo WMO Weather interpretation codes
// https://open-meteo.com/en/docs
const isBadWeather = (code: number) => {
    // 50-69 Drizzle/Rain
    // 70-79 Snow
    // 80-82 Rain showers
    // 85-86 Snow showers
    // 95-99 Thunderstorm
    return code >= 50;
};

/**
 * Returns a weather condition string based on the WMO code.
 */
const getConditionString = (code: number) => {
    if (code >= 95) return "Thunderstorm";
    if (code >= 85) return "Snow Showers";
    if (code >= 80) return "Rain Showers";
    if (code >= 70) return "Snow";
    if (code >= 50) return "Rain";
    if (code >= 45) return "Fog";
    if (code >= 1) return "Cloudy";
    return "Clear";
};

export const getWeatherForTask = async (latitude: number, longitude: number, taskDateISO: string): Promise<{ condition: string, temp: number } | undefined> => {
    try {
        const inputDate = new Date(taskDateISO);
        const today = new Date();
        // Check if date is strictly in the future.
        // We only care about forecasting for the upcoming 7-14 days which open-meteo supports for free.

        // Strip time component for fair comparison
        today.setHours(0, 0, 0, 0);
        let compareDate = new Date(inputDate);
        compareDate.setHours(0, 0, 0, 0);

        if (compareDate < today) {
            return undefined; // Do not fetch in the past
        }

        // Calculate difference in days
        const diffTime = Math.abs(compareDate.getTime() - today.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        // Open-Meteo default daily forecast is usually up to 7-14 days. We'll grab 14.
        if (diffDays > 14) {
            return undefined; // Too far in the future
        }

        const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=weathercode,temperature_2m_max,precipitation_probability_max&timezone=auto&forecast_days=16`;
        const response = await fetch(url);

        if (!response.ok) {
            console.error("Open-Meteo request failed", await response.text());
            return undefined;
        }

        const data = await response.json();
        const daily = data.daily;

        if (!daily || !daily.time) return undefined;

        // Try to find the exact date in the daily array
        // open-meteo daily.time is formatted as "YYYY-MM-DD"
        const formattedTargetDate = compareDate.toISOString().split('T')[0];
        const dateIndex = daily.time.indexOf(formattedTargetDate);

        if (dateIndex !== -1) {
            const weatherCode = daily.weathercode[dateIndex];
            const maxTemp = daily.temperature_2m_max[dateIndex];
            const precipProb = daily.precipitation_probability_max[dateIndex];

            // If it's a "bad" weather code or precipitation probability > 50%
            if (isBadWeather(weatherCode) || precipProb > 50) {
                return {
                    condition: getConditionString(weatherCode),
                    temp: Math.round(maxTemp)
                };
            } else if (maxTemp > 35) { // Unusually Hot (assuming °C by default in standard api, but can be configured to F, using F is > 95)
                // Let's assume default is Celsius, but open-meteo lets us ask for Fahrenheit.
                // We didn't pass temperature_unit=fahrenheit, so it's Celsius. 35C = 95F.
                return {
                    condition: "Extreme Heat",
                    temp: Math.round(maxTemp)
                }
            }
        }
    } catch (err) {
        console.error("Failed fetching weather data", err);
    }

    return undefined;
};
