
var AccesibleMap = {};

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


AccesibleMap.setup = function(){
    var mapa = L.map('map', { zoomControl: false });
    L.tileLayer('https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.png?access_token={accessToken}', {
        attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a>',
        maxZoom: 20,
        id: 'dnaranjo89.97a21b99',
        accessToken: 'pk.eyJ1IjoiZG5hcmFuam84OSIsImEiOiJjaWc1Z2p4ZTc0MW0ydWttM3Mxem44cmVlIn0.qYwIDUVfbIQ2x2a9IQgg-g'
    }).addTo(mapa);
    mapa.setView([39.472499, -6.376273], 15);
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