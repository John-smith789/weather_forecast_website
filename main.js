// Open-Meteo API Helper Functions

// Map WMO Weather Codes to FontAwesome icons and descriptions
function getWeatherInfo(code) {
    const weatherMap = {
        0: { desc: "Clear sky", icon: "fa-sun" },
        1: { desc: "Mainly clear", icon: "fa-cloud-sun" },
        2: { desc: "Partly cloudy", icon: "fa-cloud-sun" },
        3: { desc: "Overcast", icon: "fa-cloud" },
        45: { desc: "Foggy", icon: "fa-smog" },
        48: { desc: "Rime fog", icon: "fa-smog" },
        51: { desc: "Light drizzle", icon: "fa-cloud-rain" },
        53: { desc: "Moderate drizzle", icon: "fa-cloud-rain" },
        55: { desc: "Dense drizzle", icon: "fa-cloud-showers-heavy" },
        61: { desc: "Slight rain", icon: "fa-cloud-rain" },
        63: { desc: "Moderate rain", icon: "fa-cloud-rain" },
        65: { desc: "Heavy rain", icon: "fa-cloud-showers-heavy" },
        80: { desc: "Slight rain showers", icon: "fa-cloud-sun-rain" },
        81: { desc: "Moderate rain showers", icon: "fa-cloud-showers-heavy" },
        82: { desc: "Violent rain showers", icon: "fa-cloud-showers-water" },
        95: { desc: "Thunderstorm", icon: "fa-bolt" },
        96: { desc: "Thunderstorm with hail", icon: "fa-bolt" }
    };
    return weatherMap[code] || { desc: "Unknown", icon: "fa-cloud" };
}

// Format Date / Day
function formatDate(dateStr) {
    const date = new Date(dateStr);
    const dayName = date.toLocaleDateString("en-US", { weekday: "short" });
    const monthDay = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return { dayName, monthDay };
}

// -------------------------------------------------------------
// 1. Myanmar City Autocomplete & Search Engine
// -------------------------------------------------------------
function setupSearchEngine(onSelectCallback) {
    const searchInput = document.getElementById("search");
    if (!searchInput) return;

    const searchBox = searchInput.parentElement;
    const searchBtn = searchBox.querySelector("button");
    
    // Create dynamic dropdown container
    let dropdown = document.createElement("ul");
    dropdown.className = "search-dropdown";
    dropdown.style.display = "none";
    searchBox.appendChild(dropdown);

    let debounceTimer;

    // Search helper with sanitized query input
    async function searchMyanmarCities(query) {
        // Strip out regions or state names after commas (e.g. "Yangon, Yangon" -> "Yangon")
        const cleanQuery = query.split(',')[0].trim();
        if (!cleanQuery) return [];

        try {
            const res = await fetch(
                `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cleanQuery)}&count=10&language=en&format=json`
            );
            const data = await res.json();
            // Filter explicitly for Myanmar locations (country_code: "MM")
            return (data.results || []).filter((item) => item.country_code === "MM");
        } catch (err) {
            console.error("Geocoding fetch error:", err);
            return [];
        }
    }

    // A. Live Autocomplete on Typing
    searchInput.addEventListener("input", (e) => {
        const query = e.target.value.trim();
        clearTimeout(debounceTimer);

        if (query.length === 0) {
            dropdown.innerHTML = "";
            dropdown.style.display = "none";
            return;
        }

        debounceTimer = setTimeout(async () => {
            const myanmarCities = await searchMyanmarCities(query);
            dropdown.innerHTML = "";

            if (myanmarCities.length === 0) {
                const li = document.createElement("li");
                li.textContent = "No Myanmar location found";
                dropdown.appendChild(li);
            } else {
                myanmarCities.forEach((city) => {
                    const li = document.createElement("li");
                    const region = city.admin1 ? `, ${city.admin1}` : "";
                    li.innerHTML = `<strong>${city.name}</strong><span class="admin-region">${region}</span>`;
                    
                    li.addEventListener("click", () => {
                        searchInput.value = `${city.name}${region}`;
                        dropdown.style.display = "none";
                        dropdown.innerHTML = "";
                        // Trigger weather render directly with selected city object
                        onSelectCallback(city);
                    });
                    dropdown.appendChild(li);
                });
            }
            dropdown.style.display = "block";
        }, 300);
    });

    // B. Direct Search Execution (Triggers on Search Button Click or Enter Key)
    async function executeDirectSearch() {
        const rawQuery = searchInput.value.trim();
        if (!rawQuery) return;

        dropdown.style.display = "none";
        const cities = await searchMyanmarCities(rawQuery);

        if (cities.length > 0) {
            const topMatch = cities[0];
            const region = topMatch.admin1 ? `, ${topMatch.admin1}` : "";
            searchInput.value = `${topMatch.name}${region}`;
            onSelectCallback(topMatch);
        } else {
            alert("No Myanmar location found matching: " + rawQuery);
        }
    }

    // Trigger on Search Button Click
    if (searchBtn) {
        searchBtn.addEventListener("click", (e) => {
            e.preventDefault();
            executeDirectSearch();
        });
    }

    // Trigger on Pressing Enter
    searchInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            executeDirectSearch();
        }
    });

    // Close dropdown on click outside
    document.addEventListener("click", (e) => {
        if (!searchBox.contains(e.target)) {
            dropdown.style.display = "none";
        }
    });
}

// -------------------------------------------------------------
// 2. Open-Meteo Weather Data Fetcher (Asia/Yangon Timezone)
// -------------------------------------------------------------
async function fetchWeatherData(lat, lon) {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,surface_pressure,wind_speed_10m&hourly=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=Asia%2FYangon`;
    const response = await fetch(url);
    if (!response.ok) throw new Error("Failed to fetch weather data");
    return await response.json();
}

// -------------------------------------------------------------
// 3. Update Home Page (`home.html`)
// -------------------------------------------------------------
async function updateHomePage(city) {
    try {
        const weather = await fetchWeatherData(city.latitude, city.longitude);
        const current = weather.current;
        const weatherInfo = getWeatherInfo(current.weather_code);

        const card = document.querySelector(".weather-card");
        if (!card) return;

        // Temperature & Condition
        card.querySelector(".weather-card-detail h1").textContent = `${Math.round(current.temperature_2m)}°C`;
        card.querySelector(".weather-card-detail p").textContent = weatherInfo.desc;
        card.querySelector(".weather-card-detail p:last-child").innerHTML = `<i class="fa-solid fa-location-dot"></i> ${city.name}, Myanmar`;
        
        // Icon
        const iconElem = card.querySelector(".weather-icon");
        if (iconElem) {
            iconElem.className = `fa-solid ${weatherInfo.icon} weather-icon`;
        }

        // Details Grid
        const details = card.querySelectorAll(".weather-condition .detail h3");
        if (details.length >= 3) {
            details[0].textContent = `${current.relative_humidity_2m}%`;
            details[1].textContent = `${Math.round(current.wind_speed_10m)} km/h`;
            details[2].textContent = `${Math.round(current.apparent_temperature)}°C`;
        }
    } catch (err) {
        console.error("Home page update error:", err);
    }
}

// -------------------------------------------------------------
// 4. Update Forecast Page (`forecast.html`)
// -------------------------------------------------------------
async function updateForecastPage(city) {
    try {
        const weather = await fetchWeatherData(city.latitude, city.longitude);
        const current = weather.current;
        const daily = weather.daily;
        const hourly = weather.hourly;
        const weatherInfo = getWeatherInfo(current.weather_code);

        // A. Update Main Result Card
        const searchResult = document.querySelector(".search-result");
        if (searchResult) {
            const detailH3s = searchResult.querySelectorAll(".search-detail h3");
            if (detailH3s.length >= 2) {
                detailH3s[1].textContent = `${city.name}, Myanmar`;
            }
            searchResult.querySelector(".search-detail h1").textContent = `${Math.round(current.temperature_2m)}°C`;
            searchResult.querySelector(".search-detail p").textContent = weatherInfo.desc;

            const mainIcon = searchResult.querySelector("> i");
            if (mainIcon) {
                mainIcon.className = `fa-solid ${weatherInfo.icon}`;
            }

            const metrics = searchResult.querySelectorAll(".metric-value");
            if (metrics.length >= 4) {
                metrics[0].textContent = `${current.relative_humidity_2m}%`;
                metrics[1].textContent = `${Math.round(current.wind_speed_10m)} km/h`;
                metrics[2].textContent = `${Math.round(current.surface_pressure)} hPa`;
                metrics[3].textContent = `${Math.round(current.apparent_temperature)}°C`;
            }
        }

        // B. Update 7-Day Forecast Grid
        const sevenDayContainer = document.querySelector(".seven-day-forecast");
        if (sevenDayContainer && daily) {
            sevenDayContainer.innerHTML = "";
            
            for (let i = 0; i < daily.time.length; i++) {
                const dayDate = formatDate(daily.time[i]);
                const dayInfo = getWeatherInfo(daily.weather_code[i]);
                const maxTemp = Math.round(daily.temperature_2m_max[i]);
                const minTemp = Math.round(daily.temperature_2m_min[i]);

                const cardHTML = `
                    <div class="seven-day-detail">
                        <h3>${i === 0 ? "Today" : dayDate.dayName}</h3>
                        <p>${dayDate.monthDay}</p>
                        <i class="fa-solid ${dayInfo.icon}"></i>
                        <h2>${maxTemp}°C</h2>
                        <p>${minTemp}°C</p>
                    </div>
                `;
                sevenDayContainer.insertAdjacentHTML("beforeend", cardHTML);
            }
        }

        // C. Update Hourly Forecast Grid
        const hourlyContainer = document.querySelector(".hourly-forecast");
        if (hourlyContainer && hourly) {
            hourlyContainer.innerHTML = "";

            const now = new Date();
            let startIndex = 0;

            for (let i = 0; i < hourly.time.length; i++) {
                const itemTime = new Date(hourly.time[i]);
                if (itemTime >= now) {
                    startIndex = i;
                    break;
                }
            }

            for (let i = startIndex; i < startIndex + 8 && i < hourly.time.length; i++) {
                const timeObj = new Date(hourly.time[i]);
                const timeStr = (i === startIndex) 
                    ? "Now" 
                    : timeObj.toLocaleTimeString([], { hour: 'numeric', hour12: true });
                
                const hourInfo = getWeatherInfo(hourly.weather_code[i]);
                const temp = Math.round(hourly.temperature_2m[i]);

                const hourlyHTML = `
                    <div class="hourly-detail">
                        <h3>${timeStr}</h3>
                        <i class="fa-solid ${hourInfo.icon}"></i>
                        <h3>${temp}°C</h3>
                    </div>
                `;
                hourlyContainer.insertAdjacentHTML("beforeend", hourlyHTML);
            }
        }

    } catch (err) {
        console.error("Forecast page update error:", err);
    }
}

// -------------------------------------------------------------
// 5. Page Initialization
// -------------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
    // Default location: Yangon
    const defaultCity = {
        name: "Yangon",
        latitude: 16.8053,
        longitude: 96.1557
    };

    if (document.querySelector(".weather-card")) {
        setupSearchEngine((selectedCity) => updateHomePage(selectedCity));
        updateHomePage(defaultCity);
    } else if (document.querySelector(".seven-day-forecast")) {
        setupSearchEngine((selectedCity) => updateForecastPage(selectedCity));
        updateForecastPage(defaultCity);
    }
});


// Toggle Function for Light / Dark Mode
function Toggle() {
    const isDark = document.documentElement.classList.toggle("dark");
    const icon = document.getElementById("theme-icon");

    if (isDark) {
        localStorage.setItem("theme", "dark");
        if (icon) icon.classList.replace("fa-moon", "fa-sun");
    } else {
        localStorage.setItem("theme", "light");
        if (icon) icon.classList.replace("fa-sun", "fa-moon");
    }
}

// Sync the icon state once the document finishes loading
document.addEventListener("DOMContentLoaded", () => {
    const icon = document.getElementById("theme-icon");
    if (icon && localStorage.getItem("theme") === "dark") {
        icon.classList.replace("fa-moon", "fa-sun");
    }
});