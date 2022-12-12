/*global WildRydes _config*/

var WildRydes = window.WildRydes || {};
WildRydes.map = WildRydes.map || {};
let map;

(function rideScopeWrapper($) {
    var authToken;
    WildRydes.authToken.then(function setAuthToken(token) {
        if (token) {
            authToken = token;
        } else {
            window.location.href = '/signin.html';
        }
    }).catch(function handleTokenError(error) {
        alert(error);
        window.location.href = '/signin.html';
    });

    //  requestUnicorn
    //      make the POST request to the server
    function requestUnicorn(pickupLocation) {
        $.ajax({
            method: 'POST',
            url: _config.api.invokeUrl + '/ride',
            headers: {
                Authorization: authToken
            },
            data: JSON.stringify({
                PickupLocation: {
                    Latitude: pickupLocation.latitude,
                    Longitude: pickupLocation.longitude
                }
            }),
            contentType: 'application/json',
            success: result => completeRequest(result, pickupLocation),
            error: function ajaxError(jqXHR, textStatus, errorThrown) {
                console.error('Error requesting ride: ', textStatus, ', Details: ', errorThrown);
                console.error('Response: ', jqXHR.responseText);
                alert('An error occurred when requesting your unicorn:\n' + jqXHR.responseText);
            }
        });
    }

    //  completeRequest
    //      a Unicorn has been dispatched to your location
    function completeRequest(result, pickupLocation) {
        var unicorn;
        var pronoun;

        console.log('Response received from API: ', result);
        unicorn = result.Unicorn;
        pronoun = unicorn.Gender === 'Male' ? 'his' : 'her';
        displayUpdate(unicorn.Name + ', your ' + unicorn.Color + ' unicorn, is on ' + pronoun + ' way.', unicorn.Color);

        console.log(pickupLocation);
        //  get the local weather.
        let searchText = document.getElementById('search').value;
        if (searchText.length === 0)
            getWeather(pickupLocation, unicorn)
        animateArrival(function animateCallback() {
            displayUpdate(unicorn.Name + ' has arrived. Giddy up!', unicorn.Color);
            WildRydes.map.unsetLocation();

            $('#request').prop('disabled', 'disabled');
            $('#request').text('Set Pickup');
        });
    }

    // Register click handler for #request button
    $(function onDocReady() {
        $('#request').click(handleRequestClick);

        WildRydes.authToken.then(function updateAuthMessage(token) {
            if (token) {
                displayUpdate('You are authenticated. Click to see your <a href="#authTokenModal" data-toggle="modal">auth token</a>.');
                $('.authToken').text(token);
            }
        });

        if (!_config.api.invokeUrl) {
            $('#noApiMessage').show();
        }

        window.navigator.geolocation
            .getCurrentPosition(setLocation);

        //  put the map behind the updates list
        document.getElementById("map").style.zIndex = "10";

        function setLocation(loc) {
            map = L.map('map').setView([loc.coords.latitude, loc.coords.longitude], 13);
            L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19,
                attribution: '© OpenStreetMap'
            }).addTo(map);

            WildRydes.map.center = {latitude: loc.coords.latitude, longitude: loc.coords.longitude};
            let b = map.getBounds();        //  TODO moved
            WildRydes.map.extent = {minLat: b._northEast.lat, minLng: b._northEast.lng,
                maxLat: b._southWest.lat, maxLng: b._southWest.lng};

            WildRydes.marker  = L.marker([loc.coords.latitude, loc.coords.longitude]).addTo(map);
            var myIcon = L.icon({
                iconUrl: 'images/unicorn-icon.png',
                iconSize: [25, 25],
                iconAnchor: [22, 24],
                shadowSize: [25, 25],
                shadowAnchor: [22, 24]
            });
            WildRydes.unicorn = L.marker([loc.coords.latitude, loc.coords.longitude], {icon: myIcon}).addTo(map);
            // WildRydes.marker.bindPopup("<b>Hello world!</b><br>I am a popup.").openPopup();

            // var popup = L.popup();
            map.on('click', onMapClick);

            function onMapClick(e) {            //  TODO move to esri.js
                WildRydes.map.selectedPoint = {longitude: e.latlng.lng, latitude: e.latlng.lat};
                if (WildRydes.marker)       WildRydes.marker.remove();
                handlePickupChanged();

                WildRydes.marker  = L.marker([e.latlng.lat, e.latlng.lng]).addTo(map);

                // popup
                //     .setLatLng(e.latlng)
                //     .setContent("You clicked the map at " + e.latlng.toString())
                //     .openOn(map);
            }
        }
    });

    //  handlePickupChanged
    //      enable the Pickup button and set text to Request Unicorn
    function handlePickupChanged() {
        var requestButton = $('#request');
        requestButton.text('Request Unicorn');
        requestButton.prop('disabled', false);
    }

    //  handleRequestClick
    //      get current request location and POST request to server
    function handleRequestClick(event) {
        var pickupLocation =  WildRydes.map.selectedPoint;

        event.preventDefault();
        requestUnicorn(pickupLocation);
    }

    //  animateArrival
    //      animate the Unicorn's arrival to the user's pickup location
    function animateArrival(callback) {
        var dest = WildRydes.map.selectedPoint;
        var origin = {};

        if (dest.latitude > WildRydes.map.center.latitude) {
            origin.latitude = WildRydes.map.extent.minLat;
        } else {
            origin.latitude = WildRydes.map.extent.maxLat;
        }

        if (dest.longitude > WildRydes.map.center.longitude) {
            origin.longitude = WildRydes.map.extent.minLng;
        } else {
            origin.longitude = WildRydes.map.extent.maxLng;
        }

        WildRydes.map.animate(origin, dest, callback);
    }


}(jQuery));

//  these functions below here are my utility functions
//      to present messages to users
//      and to particularly add some 'sizzle' to the application

//  displayUpdate
//      nice utility method to show message to user
function displayUpdate(text, color='green') {
    $('#updates').prepend($(`<li style="background-color:${color}">${text}</li>`));
}

//  convert degrees into english directions
//  North is 11.25 degrees on both sides of 0/360 degrees.
//  We add 11.25 to push all directions 11.25 degrees clockwise
//  Then we mod the degrees with 360 to force all results between 0 and 359
//  finally we can divide by 22.5 because we have 16 (360 / 16 equals 22.5) different wind directions
function windDirection(degrees, long) {
    let direction;
    if (long)
        direction =["North",  "North by North East", "North East",  "East by North East",
            "East",    "East by South East", "South East", "South by South East",
            "South",  "South by South West", "South West",  "West by South West",
            "West",    "West by North West", "North West", "North by North West",
            "North"];
    else
        direction = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW", "N"];

    degrees = Math.round(degrees + 11.25) % 360;
    let index = Math.floor(degrees / 22.5);
    return direction[index];
}


function getWeather(loc, unicorn) {
    let url = `https://api.openweathermap.org/data/2.5/onecall?lat=${loc.latitude}&lon=${loc.longitude}&exclude=minutely,hourly&appid=a099a51a6362902523bbf6495a0818aa`;
    fetch(url)
        .then(response => response.json())  //  wait for the response and convert it to JSON
        .then(weather => {                  //  with the resulting JSON data do something

            //  If the city was entered extract weather based on that API else use the LatLon API result format
            let wx = latLonToWeather(weather);
            let innerHTML = '';
            let msg;
            //  We have converted the Lon Lat API (onecall) and City API (forecast) requests to the same format
            //  let's build a nice card for each day of the weather data
            //  this is a GREAT opportunity to Reactify this code. But for now I will keep it simple
            innerHTML += `<h4>Date: ${wx.daily[0].date}</h4>
                        <h5>Temp: Low ${wx.daily[0].min}&deg; / High: ${wx.daily[0].max}&deg;</h5>
                        <p>Forecast: <img src='https://openweathermap.org/img/wn/${wx.daily[0].icon}@2x.png' alt=""> ${wx.daily[0].description}</p>
                        <p>Chance of rain at ${wx.daily[0].pop}%</p>
                        <p>Wind at ${wx.daily[0].wind_speed} mph out of the ${wx.daily[0].windDirection}</p>
                        <p>Sunrise: ${wx.daily[0].sunrise} / Sunset: ${wx.daily[0].sunset}</p>`;
            displayUpdate(innerHTML, unicorn.Color);

            msg =  `Temp is ${KtoF(weather.current.temp)} degrees,
                        Wind at ${weather.current.wind_speed} miles per hour, 
                        out of the ${windDirection(weather.current.wind_deg, true)}`;
            // `${niceDate(weather.current.dt, weather.timezone_offset)}
            // ${niceTime(weather.current.dt, weather.timezone_offset)}
            // Temp is ${KtoF(weather.current.temp)} degrees,
            // Wind at ${weather.current.wind_speed} miles per hour, out of the ${windDirection(weather.current.wind_deg, true)} ,
            // Sunset will be at ${niceTime(weather.current.sunset, weather.timezone_offset)}`
            console.log(msg);
            speak(`Temp is ${KtoF(weather.current.temp)} degrees`);
        });
}

function speak(msg) {
    let speech = new SpeechSynthesisUtterance();
    speech.lang = "en-US";
    speech.text = msg;      //  TODO msg;
    speech.volume = speech.rate = speech.pitch = 1;
    window.speechSynthesis.speak(speech);
}

function latLonToWeather(data) {
    let wx = {};
    wx.daily = data.daily.map(d => ({
        date:           niceDate(d.dt,data.timezone_offset),
        min:            KtoF(d.temp.min),
        max:            KtoF(d.temp.max),
        sunrise:        niceTime(d.sunrise, data.timezone_offset),
        sunset:         niceTime(d.sunset,  data.timezone_offset),
        icon:           d.weather[0].icon,
        description:    d.weather[0].description,
        wind_speed:     d.wind_speed.toFixed(0),
        windDirection:  windDirection(d.wind_deg, true),
        pop:            (d.pop * 100).toFixed(0),
        feels_like:     KtoF(d.feels_like.day),
        dewPoint:       d.dew_point,
        humidity:       d.humidity,
    }));
    wx.city = "";
    wx.lat  = data.lat;
    wx.lon  = data.lon;
    return wx;
}

//  strip out just the MM/DD/YYY from the date
//  convert from UNIX date time and take the time zone offset into consideration
function niceDate(date, offset) {
    let day = new Date(date * 1000 + offset);
    day = day.toLocaleString();
    return day.substring(0, 10);
}

//  Strip out just the HH:MM:SS AM/PM from the date
function niceTime(dateTime, offset) {
    let day = new Date(dateTime * 1000 + offset).toLocaleString();
    let hour = day.indexOf(' ') + 1;
    let time = day.substring(hour);
    time = time.substring(0, time.lastIndexOf(':')) + time.substring(time.length-3)
    return time;
}

//  Convert Kelvin to Fahrenheit
function KtoF(temp) {
    temp -= 273;
    temp = temp * 9 / 5 + 32;
    return temp.toFixed(0);
}