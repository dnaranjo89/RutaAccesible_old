
var AccesibleMap = {};

// Setup accesible marker
AccesibleMap.accesible_icon = L.icon({
        iconUrl: 'images/accesible_marker.png',
        iconSize:     [38, 38], // size of the icon
        iconAnchor:   [22, 22], // point of the icon which will correspond to marker's location
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
    $("#show-accessible-parkings").change(function() {
        AccesibleMap.show_accessible_parkings(this.checked);
    });

    $("#calculate-route").click(function(){
        if (AccesibleMap.allow_geolocation){
            AccesibleMap.add_origen_current_loc();
        }
        AccesibleMap.draw_complete_route();
    });
};

AccesibleMap.test_route = function(){
    var origen = L.latLng(39.474346, -6.375368);
    var parking = L.latLng(39.473684, -6.377592);
    var destination = L.latLng(39.473949, -6.378597);
    var avoid_stairs = true;
    AccesibleMap.draw_complete_route(origen, parking, destination, avoid_stairs);
};

AccesibleMap.routes_markers = [];
AccesibleMap.routes_lines = [];

AccesibleMap.draw_complete_route = function (){
    // Remove previous routes
    AccesibleMap.routes_markers.map(function(marker){
        AccesibleMap.mapa.removeLayer(marker);
    });
    AccesibleMap.routes_lines.map(function(line){
        AccesibleMap.mapa.removeControl(line);
    });

    // Draw route
    var $origen = $('#route-from');
    var origen = [$origen.attr('data-lat'), $origen.attr('data-lng')];
    var parking = null;
    var $destination = $('#route-to');
    var destination = [$destination.attr('data-lat'), $destination.attr('data-lng')];
    var step_penalty = $('#avoid-steps').is(":checked");

    var callback_get_parking = function(data){
        var plazas = [];
        for (i=0; i<data.results.bindings.length; i++) {
            plazas.push([data.results.bindings[i].geo_lat_plaza.value, data.results.bindings[i].geo_long_plaza.value]);
        }
        console.log(plazas);
        var best_parking = plazas[0];
        console.log("origen:"+origen);
        console.log("destino:"+destination);
        AccesibleMap.routes_markers = [];
        AccesibleMap.routes_markers.push(AccesibleMap.add_marker(best_parking,"Parking", "parking"));
        AccesibleMap.routes_lines.push(AccesibleMap.calculate_route_pedestrian(best_parking, destination, step_penalty).addTo(AccesibleMap.mapa));
        AccesibleMap.routes_lines.push(AccesibleMap.calculate_route_auto(origen, best_parking).addTo(AccesibleMap.mapa));
    };

    var parkings = AccesibleMap.get_closest_parking(destination, callback_get_parking);
    console.log(destination);
    console.log(parkings);

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
                '<a href="#" class="btn btn-default btn-xs" onclick="AccesibleMap.add_destination_and_calc_route(' + attr + ');">Ir Aqui</a>'+
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
    AccesibleMap.show_current_location(true);
    navigator.geolocation.getCurrentPosition(function(current_pos){
        var $origen = $('#route-from');
        $origen.attr("data-lat", current_pos[0]);
        $origen.attr("data-lng", current_pos[1]);
    });
    $('#route-from').val("Posición actual");
};

AccesibleMap.add_destination_and_calc_route = function(title, destination){
    // Switch to route frame
    $('#frame-search').toggleClass('hidden', true);
    $('#frame-route').toggleClass('hidden', false);

    // Update destination field
    var $destination = $('#route-to');
    $destination.val(title);
    $destination.attr("data-lat", destination[0]);
    $destination.attr("data-lng", destination[1]);

    if (AccesibleMap.allow_geolocation){
        AccesibleMap.add_origen_current_loc();
        AccesibleMap.draw_complete_route();
    }
};

AccesibleMap.current_location_markers = [];

AccesibleMap.show_current_location = function (enable_location){
    if (enable_location){
        function onLocationFound(e) {
            var radius = e.accuracy / 2;
            AccesibleMap.current_location_markers.push({
                marker: L.marker(e.latlng).addTo(AccesibleMap.mapa).bindPopup("<div class='text-center'>Estás aquí<br> (precisión " + radius + " metros)</div>").openPopup(),
                circle: L.circle(e.latlng, radius).addTo(AccesibleMap.mapa)
            });
            var $origen = $('#route-from');
            $origen.attr("data-lng", e.latlng.lng);
            $origen.attr("data-lat", e.latlng.lat);
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
    AccesibleMap.allow_geolocation = enable_location;
};

AccesibleMap.markers_parking = [];

AccesibleMap.show_accessible_parkings = function (show_parkings){
    if (show_parkings){
        var callback_show_parkings = function(data){
            var plazas = [];
            for (i=0; i<data.results.bindings.length; i++) {
                plazas.push([data.results.bindings[i].geo_lat.value, data.results.bindings[i].geo_long.value]);
                var location = [data.results.bindings[i].geo_lat.value, data.results.bindings[i].geo_long.value];
                AccesibleMap.markers_parking.push(AccesibleMap.add_marker(location, "parking","parking"));
            }
          };
        AccesibleMap.get_all_parkings(callback_show_parkings);
    }else{
        // Clean previous parkings
        AccesibleMap.markers_parking.map(function(marker){
            AccesibleMap.mapa.removeLayer(marker);
        });
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


/**
 *  Opendata Queries
 */

AccesibleMap.get_closest_parking = function (location, callback_get_parking){
    var pk = "select ?uri ?geo_lat_plaza ?geo_long_plaza ?distancia {" +
            "{select ?uri ?geo_lat_plaza ?geo_long_plaza ((bif:st_distance(bif:st_point(" +
            "\"" + location[0] + "\"^^xsd:decimal," +
            "\"" + location[1] + "\"^^xsd:decimal),bif:st_point(?geo_lat_plaza,?geo_long_plaza))) AS ?distancia) where{" +
            "?uri a om:PlazaMovilidadReducida ." +
            "?uri geo:lat ?geo_lat_plaza ." +
            "?uri geo:long ?geo_long_plaza ." +
            "}order by asc (?distancia) } FILTER (?distancia < 1) }limit 3";

    var plazas = [];

    var graphQuerySPARQL="";
    var preQuerySPARQL ="http://opendata.caceres.es/sparql";

    $.ajax({
    data: {"default-graph-uri":graphQuerySPARQL, query:pk, format: 'json'},
    url: preQuerySPARQL,
    cache:false
    }).done(callback_get_parking);
};


AccesibleMap.get_all_parkings = function(callback_parkings) {

  var query=   "select ?URI ?geo_lat ?geo_long where{" +
            "?URI a om:PlazaMovilidadReducida." +
            "?URI om:situadoEnVia ?om_situadoEnVia." +
            "?URI geo:lat ?geo_lat." +
            "?URI geo:long ?geo_long." +
            "}";

  var plazas = [];

  var graphQuerySPARQL="";
  var preQuerySPARQL ="http://opendata.caceres.es/sparql";

  $.ajax({
    data: {"default-graph-uri":graphQuerySPARQL, query:query, format: 'json'},
    url: preQuerySPARQL,
    cache:false
  }).done(callback_parkings);

  return (plazas);

};