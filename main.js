const cities = [
    "Yangon", "Mandalay", "Naypyidaw", "Bagan", "Magway", "Mawlamyine",
    "Pathein", "Bago", "Pyay", "Taungoo", "Monywa", "Sagaing", "Kalay",
    "Myitkyina", "Putao", "Taunggyi", "Lashio", "Tachileik", "Loikaw",
    "Hakha", "Falam", "Sittwe", "Thandwe", "Dawei", "Myeik", "Kawthaung",
    "Hpa-An", "Myawaddy", "Kyaikto", "Pyin Oo Lwin", "Meiktila", "Pakokku"
];

const DEFAULT_CITY = { name: "Yangon", latitude: 16.8409, longitude: 96.1735 };
const SELECTED_CITY_KEY = "selectedWeatherCity";
const DEFAULT_CITY_KEY = "defaultWeatherCity";
const input = document.getElementById("cityInput");
const dropdown = document.getElementById("dropdown");
const searchBtn = document.getElementById("search");
const defaultBtn = document.getElementById("default");
const sendMessage = document.getElementById("contact-form");

function weatherIcon(code) {
    if ([0, 1].includes(code)) return "fa-sun";
    if ([2, 3, 45, 48].includes(code)) return "fa-cloud";
    if ([51, 53, 55, 56, 57, 61, 63, 65, 80, 81, 82].includes(code)) return "fa-cloud-rain";
    if ([71, 73, 75, 77, 85, 86].includes(code)) return "fa-snowflake";
    return "fa-cloud-bolt";
}

function getSavedCity(){
    try{
        return JSON.parse(sessionStorage.getItem(SELECTED_CITY_KEY));
    }
    catch{
        return null;
    }
}

function saveCity(city){
    sessionStorage.setItem(SELECTED_CITY_KEY, JSON.stringify(city));
}

function getDefaultCity() {
    try {
        return JSON.parse(localStorage.getItem(DEFAULT_CITY_KEY));
    } catch {
        return null;
    }
}

async function findCity(name) {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1&language=en&format=json`;
    const response = await fetch(url);
    if (!response.ok) throw new Error("City search failed");
    const location = (await response.json()).results?.[0];
    if (!location) throw new Error("City not found");
    return { name: location.name, latitude: location.latitude, longitude: location.longitude };
}

async function getWeather(city) {
    const params = new URLSearchParams({
        latitude: city.latitude,
        longitude: city.longitude,
        current: "temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,pressure_msl",
        hourly: "temperature_2m,weather_code",
        daily: "weather_code,temperature_2m_max,temperature_2m_min",
        timezone: "Asia/Yangon",
        forecast_days: "7"
    });
    const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
    if (!response.ok) throw new Error("Weather request failed");
    return response.json();
}

function setText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
}

function weatherDescription(code) {
    if (code === 0) return "Clear sky";
    if ([1, 2, 3].includes(code)) return "Partly cloudy";
    if ([45, 48].includes(code)) return "Foggy";
    if ([51, 53, 55, 56, 57].includes(code)) return "Drizzle";
    if ([61, 63, 65, 80, 81, 82].includes(code)) return "Rainy";
    if ([71, 73, 75, 77, 85, 86].includes(code)) return "Snowy";
    return "Thunderstorm";
}

function formatMyanmarHour(time) {
    // Open-Meteo returns this timestamp already in Asia/Yangon because of the timezone parameter.
    const hour = Number(time.slice(11, 13));
    const period = hour >= 12 ? "PM" : "AM";
    return `${hour % 12 || 12} ${period}`;
}

function renderCurrent(city, weather) {
    const current = weather.current;
    setText("temp", `${Math.round(current.temperature_2m)} °C`);
    setText("city-name", `${city.name}, Myanmar`);
    setText("humidity", `${current.relative_humidity_2m}%`);
    setText("wind-speed", `${Math.round(current.wind_speed_10m)} km/h`);
    setText("feels-like", `${Math.round(current.apparent_temperature)} °C`);
    setText("pressure", `${Math.round(current.pressure_msl)} hPa`);

    const condition = document.getElementById("condition") || document.querySelector(".search-detail p");
    if (condition) condition.textContent = weatherDescription(current.weather_code);

    const icon = document.querySelector(".weather-icon, .search-result > i");
    if (icon) {
        const extraClass = icon.classList.contains("weather-icon") ? " weather-icon" : "";
        icon.className = `fa-solid ${weatherIcon(current.weather_code)}${extraClass}`;
    }

    const image = document.getElementById("image");
    if (image) {
        image.src = `Style/images/${city.name.toLowerCase()}.png`;
        image.alt = city.name;
    }
}

function renderForecast(weather) {
    const dailyContainer = document.querySelector(".seven-day-forecast");
    if (dailyContainer && weather.daily) {
        dailyContainer.innerHTML = weather.daily.time.map((date, index) => {
            // Noon UTC prevents the displayed Myanmar date from shifting on browsers in other timezones.
            const localDate = new Date(`${date}T12:00:00Z`);
            const dateOptions = { timeZone: "Asia/Yangon" };
            const day = localDate.toLocaleDateString(undefined, { weekday: "short", ...dateOptions });
            const displayDate = localDate.toLocaleDateString(undefined, { month: "short", day: "numeric", ...dateOptions });
            return `<div class="seven-day-detail"><h3>${day}</h3><p>${displayDate}</p><i class="fa-solid ${weatherIcon(weather.daily.weather_code[index])}"></i><h2>${Math.round(weather.daily.temperature_2m_max[index])}°C</h2><p>${Math.round(weather.daily.temperature_2m_min[index])}°C</p></div>`;
        }).join("");
    }

    const hourlyContainer = document.querySelector(".hourly-forecast");
    if (hourlyContainer && weather.hourly) {
        const nextHourIndex = weather.hourly.time.findIndex(time => time > weather.current.time);
        const startIndex = nextHourIndex > 0 ? nextHourIndex - 1 : 0;
        const hours = weather.hourly.time.slice(startIndex, startIndex + 8);

        hourlyContainer.innerHTML = hours.map((time, index) => {
            const weatherIndex = startIndex + index;
            const label = index === 0 ? "Now" : formatMyanmarHour(time);
            return `<div class="hourly-detail"><h3>${label}</h3><i class="fa-solid ${weatherIcon(weather.hourly.weather_code[weatherIndex])}"></i><h3>${Math.round(weather.hourly.temperature_2m[weatherIndex])}°C</h3></div>`;
        }).join("");
    }
}

async function displayCity(city, saveSelection = false) {
    try {
        const weather = await getWeather(city);
        if (saveSelection) saveCity(city);
        renderCurrent(city, weather);
        renderForecast(weather);
    } catch (error) {
        console.error(error);
    }
}

async function updatePopularCities() {
    const popularCities = [
        { name: "Yangon", id: "popular-yangon" },
        { name: "Mandalay", id: "popular-mandalay" },
        { name: "Naypyidaw", id: "popular-naypyidaw" },
        { name: "Pyin Oo Lwin", id: "popular-pyinoolwin" }
    ];

    await Promise.all(popularCities.map(async ({ name, id }) => {
        try {
            const city = await findCity(name);
            const weather = await getWeather(city);
            const card = document.getElementById(id);
            if (!card) return;
            card.querySelector(".city-detail p").textContent = weatherDescription(weather.current.weather_code);
            card.querySelector(".city-detail h1").textContent = `${Math.round(weather.current.temperature_2m)} °C`;
        } catch (error) {
            // Keep placeholder values if a live request is temporarily unavailable.
            console.error(`Could not update ${name}:`, error);
        }
    }));
}

async function searchCity() {
    const name = input.value.trim();
    if (!name) return;
    try {
        const city = await findCity(name);
        input.value = city.name;
        dropdown.style.display = "none";
        await displayCity(city, true);
    } catch (error) {
        console.error(error);
        alert("City not found. Please try another city.");
    }
}

if(input){
    input.addEventListener("input", () => {
        const text = input.value.trim().toLowerCase();
        dropdown.innerHTML = "";
        if (!text) {
            dropdown.style.display = "none";
            return;
        }

        cities.filter(city => city.toLowerCase().startsWith(text)).forEach(city => {
            const option = document.createElement("div");
            option.textContent = city;
            option.addEventListener("click", () => {
                input.value = city;
                dropdown.style.display = "none";
            });
            dropdown.appendChild(option);
        });
        dropdown.style.display = dropdown.children.length ? "block" : "none";
    });    
}

if(searchBtn){
    searchBtn.addEventListener("click", searchCity);
    input.addEventListener("keydown", event => {
        if (event.key === "Enter") searchCity();
    });    
}


if (defaultBtn) {
    defaultBtn.addEventListener("click", async () => {
        const cityName = input.value.trim();
        if (!cityName) return;

        try {
            // Save the city in the input as the website's default city.
            const city = await findCity(cityName);
            localStorage.setItem(DEFAULT_CITY_KEY, JSON.stringify(city));
            input.value = city.name;
            await displayCity(city);

        } catch (error) {
            console.error(error);
            alert("Search for a valid city before setting it as the default.");
        }
    });
}

document.addEventListener("DOMContentLoaded", () => {
    // Yangon is used until the visitor chooses a different default city.
    displayCity(getSavedCity()|| getDefaultCity() || DEFAULT_CITY);
    if (document.querySelector(".popular-city")) updatePopularCities();
});

function Toggle() {
    const isDark = document.documentElement.classList.toggle("dark");
    const icon = document.getElementById("theme-icon");
    localStorage.setItem("theme", isDark ? "dark" : "light");
    if (icon) icon.className = `fa-solid ${isDark ? "fa-sun" : "fa-moon"}`;
}

document.addEventListener("DOMContentLoaded", () => {
    const icon = document.getElementById("theme-icon");
    if (icon && localStorage.getItem("theme") === "dark") icon.className = "fa-solid fa-sun";
});

// //Send message to the programmer
// if(sendMessage){
//     sendMessage.addEventListener("submit", function (e){
//         e.preventDefault();

//         const name = document.getElementsByName("name").value;
//         const email = document.getElementsByName("email").value;
//         const subject = document.getElementById("subject").value;
//         const message = document.getElementById("message").value;

//         const body = 
//         `Name: ${name}%0D%0A` +
//         `Email: ${email}%0D%0A%0D%0A` +
//         `Message:%0D%0A${encodeURIComponent(message)}`;

//         window.location.href = `mailto:jamextermux606@gmail.com?subject=${encodeURIComponent(subject)}&body=${body}`;
//     });    
// }



