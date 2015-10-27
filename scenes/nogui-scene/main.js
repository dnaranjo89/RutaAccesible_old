/*jslint browser: true*/
/*global Tangram, gui */

/*

Hello source-viewers!

We're glad you're interested in how Tangram can be used to make amazing maps!

This demo is meant to show off various visual styles, but it has a really complex setup - we had to jump through a lot of hoops to implement the style-switcher and rebuild the dat.gui interface on the fly, which are things you would probably never have to do in a real-world use case.

So instead of rummaging through this rather confusing example, we recommend you check out our documentation, which is chock-full of specific, targeted demos highlighting all of the nifty features of the Tangram library:

https://github.com/tangrams/tangram/wiki/

Enjoy!
- The Mapzen Tangram team

*/

(function () {
    'use strict';

    var tile_sources = {
        'mapzen': {
            type: 'MVT',
            url: '//vector.mapzen.com/osm/all/{z}/{x}/{y}.mvt?api_key=vector-tiles-HqUVidw'
        },
    },
    default_tile_source = 'mapzen',
    scene_url = 'scene.yaml',
    osm_debug = false,
    locations = {
        'London': [51.508, -0.105, 15],
        'New York': [40.70531887544228, -74.00976419448853, 16],
        'Seattle': [47.609722, -122.333056, 15]
    }, rS, url_hash, map_start_location, url_ui, url_style;


    getValuesFromUrl();

    // default source, can be overriden by URL
    var
        map = L.map('map', {
            maxZoom: 20,
            trackResize: true,
            inertia: false,
            keyboard: false,
            wheelDebounceTime: 20,
            zoomControl: false
        }),

        layer = Tangram.leafletLayer({
            scene: scene_url,
            preUpdate: preUpdate,
            postUpdate: postUpdate,
            // highDensityDisplay: false,
            logLevel: 'debug',
            attribution: '<a href="https://mapzen.com/tangram" target="_blank">Tangram</a> | &copy; OSM contributors | <a href="https://mapzen.com/" target="_blank">Mapzen</a>'
        });

    layer.scene.subscribe({
        loadScene: function (config) {
        }
    });


    /***** GUI/debug controls *****/

    /*** URL parsing ***/

    // URL hash pattern is one of:
    // #[source]
    // #[lat],[lng],[zoom]
    // #[source],[lat],[lng],[zoom]
    // #[source],[location name]
    function getValuesFromUrl() {

        url_hash = window.location.hash.slice(1, window.location.hash.length).split(',');

        // Get tile source from URL
        if (url_hash.length >= 1 && tile_sources[url_hash[0]] != null) {
            default_tile_source = url_hash[0];
        }

        // Get location from URL
        map_start_location = locations['New York'];

        if (url_hash.length === 3) {
            map_start_location = url_hash.slice(0, 3);
        }
        if (url_hash.length > 3) {
            map_start_location = url_hash.slice(1, 4);
        }
        else if (url_hash.length === 2) {
            map_start_location = locations[url_hash[1]];
        }

        if (url_hash.length > 4) {
            url_ui = url_hash.slice(4);

            // Style on URL?
            url_style;
            if (url_ui) {
                var re = new RegExp(/(?:style|mode)=(\w+)/);
                url_ui.forEach(function(u) {
                    var match = u.match(re);
                    url_style = (match && match.length > 1 && match[1]);
                });
            }
        }

    }

    // Put current state on URL
    var update_url_throttle = 100;
    var update_url_timeout = null;
    function updateURL() {
        clearTimeout(update_url_timeout);
        update_url_timeout = setTimeout(function() {
            var center = map.getCenter();
            var url_options = [default_tile_source, center.lat, center.lng, map.getZoom()];

            if (rS) {
                url_options.push('rstats');
            }

            if (style_options && style_options.effect != '') {
                url_options.push('style=' + style_options.effect);
            }

            window.location.hash = url_options.join(',');
        }, update_url_throttle);
    }

    /*** Map ***/

    window.layer = layer;
    window.map = map;
    var scene = layer.scene;
    window.scene = scene;

    // Update URL hash on move
    map.attributionControl.setPrefix('');
    map.setView(map_start_location.slice(0, 2), map_start_location[2]);
    map.on('moveend', updateURL);

    // Take a screenshot and save file
    function screenshot() {
        // Adapted from: https://gist.github.com/unconed/4370822
        var image = scene.canvas.toDataURL('image/png').slice(22); // slice strips host/mimetype/etc.
        var data = atob(image); // convert base64 to binary without UTF-8 mangling
        var buf = new Uint8Array(data.length);
        for (var i = 0; i < data.length; ++i) {
            buf[i] = data.charCodeAt(i);
        }
        var blob = new Blob([buf], { type: 'image/png' });
        saveAs(blob, 'tangram-' + (+new Date()) + '.png'); // uses FileSaver.js: https://github.com/eligrey/FileSaver.js/
    }

    // Render/GL stats: http://spite.github.io/rstats/
    // Activate with 'rstats' anywhere in options list in URL
    if (url_ui && url_ui.indexOf('rstats') >= 0) {
        var glS = new glStats();
        glS.fractions = []; // turn this off till we need it

        rS = new rStats({
            values: {
                frame: { caption: 'Total frame time (ms)', over: 5 },
                raf: { caption: 'Time since last rAF (ms)' },
                fps: { caption: 'Framerate (FPS)', below: 30 },
                rendertiles: { caption: 'Rendered tiles' },
                features: { caption: '# of geo features' },
                glbuffers: { caption: 'GL buffers (MB)' }
            },
            CSSPath : 'lib/',
            plugins: [glS]
        });

        // Move it to the bottom-left so it doesn't obscure zoom controls
        var rSDOM = document.querySelector('.rs-base');
        rSDOM.style.bottom = '0px';
        rSDOM.style.top = 'inherit';
    }


    // For easier debugging access

    // GUI options for rendering style/effects
    var style_options = {
        effect: url_style || '',
        options: {
            'None': '',
            'Water animation': 'water',
            'Elevator': 'elevator',
            'Pop-up': 'popup',
            'Halftone': 'halftone',
            'Windows': 'windows',
            'Environment Map': 'envmap',
            'Rainbow': 'rainbow'
        },
        saveInitial: function() {
            this.initial = { config: JSON.stringify(scene.config) };
        },
        setup: function (style) {
            // Restore initial state
            scene.config = JSON.parse(this.initial.config);

            // Remove existing style-specific controls
            gui.removeFolder(this.folder);

            // Style-specific settings
            if (style != '') {
                if (this.settings[style] != null) {
                    var settings = this.settings[style] || {};

                    // Change projection if specified
                    if (settings.camera) {
                        scene.setActiveCamera(settings.camera);
                    }

                    // Style-specific setup function
                    if (settings.setup) {
                        settings.uniforms = function() {
                            return scene.styles[style] && scene.styles[style].shaders.uniforms;
                        };
                        settings.state = {}; // dat.gui needs a single object to old state

                        this.folder = style[0].toUpperCase() + style.slice(1); // capitalize first letter
                        settings.folder = gui.addFolder(this.folder);
                        settings.folder.open();

                        settings.setup(style);

                        if (settings.folder.__controllers.length === 0) {
                            gui.removeFolder(this.folder);
                        }
                    }
                }
            }

            // Recompile/rebuild
            scene.updateConfig({ rebuild: true });
            updateURL();

            // Force-update dat.gui
            for (var i in gui.__controllers) {
                gui.__controllers[i].updateDisplay();
            }
        },
        scaleColor: function (c, factor) { // convenience for converting between uniforms (0-1) and DAT colors (0-255)
            if ((typeof c == 'string' || c instanceof String) && c[0].charAt(0) == "#") {
                // convert from hex to rgb
                var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(c);
                c = result ? [
                    parseInt(result[1], 16),
                    parseInt(result[2], 16),
                    parseInt(result[3], 16)
                ] : null;
            }
            return [c[0] * factor, c[1] * factor, c[2] * factor];
        }
    };

    // Pre-render hook
    var zoom_step = 0.03;
    function preUpdate (will_render) {
        // Input
    }

    // Post-render hook
    function postUpdate () {
    }

    /***** Render loop *****/
    window.addEventListener('load', function () {
        // Scene initialized
        layer.on('init', function() {

        });
        layer.addTo(map);

    });


}());
