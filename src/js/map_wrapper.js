
var AccesibleMap = {};

// Setup accesible marker
AccesibleMap.accesible_icon = L.icon({
        iconUrl: '/simplegeo/images/accesible_marker.png',
        //shadowUrl: 'leaf-shadow.png',

        iconSize:     [38, 38], // size of the icon
        //shadowSize:   [50, 64], // size of the shadow
        iconAnchor:   [22, 94], // point of the icon which will correspond to marker's location
        //shadowAnchor: [4, 62],  // the same for the shadow
        popupAnchor:  [-3, -76] // point from which the popup should open relative to the iconAnchor
    });

AccesibleMap.search_markers = [];

AccesibleMap.setup = function(){
    var mapa = L.map('map', { zoomControl: false });
    L.tileLayer('https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.png?access_token={accessToken}', {
        attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a>',
        maxZoom: 20,
        id: 'dnaranjo89.97a21b99',
        accessToken: 'pk.eyJ1IjoiZG5hcmFuam84OSIsImEiOiJjaWc1Z2p4ZTc0MW0ydWttM3Mxem44cmVlIn0.qYwIDUVfbIQ2x2a9IQgg-g'
    }).addTo(mapa);
    mapa.setView([39.472499, -6.376273], 15);
    new L.Control.Zoom({ position: 'bottomright' }).addTo(mapa);
    AccesibleMap.mapa = mapa;

    $("#search-btn").click(function(){
        var input_query = $("#search-input").val();
        AccesibleMap.search(input_query);
    });

    $("#current-loc-icon").click(function(){
        AccesibleMap.add_origen_current_loc();
    });
    $("#show-current-pos").change(function() {
        AccesibleMap.show_current_location(this.checked);
    });
};

AccesibleMap.test_route = function(){
    var origen = L.latLng(39.474346, -6.375368);
    var parking = L.latLng(39.473684, -6.377592);
    var destination = L.latLng(39.473949, -6.378597);
    var avoid_stairs = true;
    AccesibleMap.draw_complete_route(origen, parking, destination, avoid_stairs);
};

AccesibleMap.draw_complete_route = function (origen, parking, destination, step_penalty){
    AccesibleMap.calculate_route_auto(origen, parking).addTo(AccesibleMap.mapa);
    AccesibleMap.calculate_route_pedestrian(parking, destination, step_penalty).addTo(AccesibleMap.mapa);
};

AccesibleMap.search = function(query){
    // Clean previous results
    AccesibleMap.search_markers.map(function(marker){
        AccesibleMap.mapa.removeLayer(marker);
    });

    var num_results = 1;
    var url = "https://search.mapzen.com/v1/search?api_key=search-AU6x3Ho&text=" + query + "&boundary.country=ES&size=" + num_results;
    $.get(url).done(function(response){
        response.features.map(function(location){
            var cords = location.geometry.coordinates;
            var pos =  [cords[1], cords[0]];
            var title = location.properties.label;
            var attr = "'" + title + "',[" + pos + "]";
            var html_title = location.properties.label +
                '<div class="text-center">' +
                '<a href="#" class="btn btn-default btn-xs" onclick="AccesibleMap.add_destination(' + attr + ');">Ir Aqui</a>'+
                '</>';
            var marker = AccesibleMap.add_marker(pos, html_title);
            marker.openPopup();
            AccesibleMap.search_markers.push(marker);
        });
    }).fail(function(){
        console.log("Couldn't find location: " + url);
    });
};

AccesibleMap.add_origen_current_loc = function(){
    var current_location = null;
    $('#route-from').val("Posición actual");
};

AccesibleMap.add_destination = function(title, destination){
    // Switch to route frame
    $('#frame-search').toggleClass('hidden', true);
    $('#frame-route').toggleClass('hidden', false);
    // Update fields
    $('#route-from').val("Posición actual");
    $('#route-to').val(title);

    // Draw route
    var origen = AccesibleMap.get_current_location();
    var parking = null;
    var step_penalty = true;
    AccesibleMap.draw_complete_route(origen, parking, destination, step_penalty);
};

AccesibleMap.get_current_location = function(){
    // TODO renturn current location
    return null;
};

AccesibleMap.current_location_markers = [];

AccesibleMap.show_current_location = function (show_location){
    if (show_location){
        function onLocationFound(e) {
            var radius = e.accuracy / 2;
            AccesibleMap.current_location_markers.push({
                marker: L.marker(e.latlng).addTo(AccesibleMap.mapa).bindPopup("You are within " + radius + " meters from this point").openPopup(),
                circle: L.circle(e.latlng, radius).addTo(AccesibleMap.mapa)
            });
        }
        function onLocationError(e) {
            alert(e.message);
        }

        AccesibleMap.mapa.on('locationfound', onLocationFound);
        AccesibleMap.mapa.on('locationerror', onLocationError);
        AccesibleMap.mapa.locate({setView: true, maxZoom: 16});
    }else{
        // Clean previous current locations
        AccesibleMap.current_location_markers.map(function(marker){
            AccesibleMap.mapa.removeLayer(marker.marker);
            AccesibleMap.mapa.removeLayer(marker.circle);
        });

        AccesibleMap.mapa.removeLayer(AccesibleMap.current_location_marker['marker']);
        AccesibleMap.mapa.removeLayer(AccesibleMap.current_location_marker['circle']);
    }
};

/**
 * Internal functions
 */

AccesibleMap.add_marker = function(location, title, type){
    var options = {
        "title": title,
    };
    if (type == "parking"){
        options['icon'] = AccesibleMap.accesible_icon;
    }
    return L.marker(location, options).addTo(AccesibleMap.mapa)
        .bindPopup(title);
};

AccesibleMap.calculate_route_auto = function(origen, destination){
    var waypoints = [origen, destination];
    var costing_options = {};
    var mode = "auto";
    return AccesibleMap.calculate_route(waypoints, mode, costing_options);
};

AccesibleMap.calculate_route_pedestrian = function(origen, destination, avoid_stairs){
    var waypoints = [origen, destination];
    var step_penalty = avoid_stairs ? 99999 : 0;
    var costing_options = {"pedestrian": {"step_penalty": step_penalty }};
    var mode = "pedestrian";
    return AccesibleMap.calculate_route(waypoints, mode, costing_options);
};

AccesibleMap.calculate_route = function (waypoints, mode, costing_options){
    var styles = [
            {color: 'white',opacity: 0.8, weight: 12},
            {color: '#2676C6', opacity: 1, weight: 6}
        ];
    styles[1].color = (mode == "pedestrian") ? '#76c626' : '#2676C6';

    var options = {
        parking_route: mode,
        waypoints: waypoints,
        lineOptions: {
            styles: styles
        },
        router: L.Routing.valhalla('valhalla-dWJ_XBA', mode, costing_options),
        formatter: new L.Routing.Valhalla.Formatter(),
        summaryTemplate:'<div class="start">{name}</div><div class="info {transitmode}">{distance}, {time}</div>',
        routeWhileDragging: false
    };

    return L.Routing.control(options);
};