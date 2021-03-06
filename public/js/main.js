/******************************************************************************
 * Copyright (c) Dworek 2016. All rights reserved.                            *
 *                                                                            *
 * @author Tim Visee                                                          *
 * @website http://timvisee.com/                                              *
 *                                                                            *
 * Open Source != No Copyright                                                *
 *                                                                            *
 * Permission is hereby granted, free of charge, to any person obtaining a    *
 * copy of this software and associated documentation files (the "Software"), *
 * to deal in the Software without restriction, including without limitation  *
 * the rights to use, copy, modify, merge, publish, distribute, sublicense,   *
 * and/or sell copies of the Software, and to permit persons to whom the      *
 * Software is furnished to do so, subject to the following conditions:       *
 *                                                                            *
 * The above copyright notice and this permission notice shall be included    *
 * in all copies or substantial portions of the Software.                     *
 *                                                                            *
 * You should have received a copy of The MIT License (MIT) along with this   *
 * program. If not, see <http://opensource.org/licenses/MIT/>.                *
 ******************************************************************************/

// Native droid instance
var nativeDroid = null;

/**
 * Packet types.
 * @type {Object}
 */
const PacketType = {
    AUTH_REQUEST: 1,
    AUTH_RESPONSE: 2,
    GAME_STAGE_CHANGE: 3,
    GAME_STAGE_CHANGED: 5,
    MESSAGE_RESPONSE: 4,
    BROADCAST_MESSAGE_REQUEST: 6,
    BROADCAST_MESSAGE: 7,
    BROADCAST_RESOLVE_ALL: 8,
    BROADCAST_RESOLVE: 9,
    LOCATION_UPDATE: 10,
    GAME_INFO: 11,
    GAME_INFO_REQUEST: 12,
    GAME_LOCATIONS_UPDATE: 13,
    GAME_LOCATIONS_REQUEST: 27,
    GAME_DATA_REQUEST: 14,
    GAME_DATA: 15,
    FACTORY_BUILD_REQUEST: 16,
    FACTORY_BUILD_RESPONSE: 17,
    FACTORY_DATA_REQUEST: 18,
    FACTORY_DATA: 19,
    FACTORY_DEFENCE_BUY: 20,
    FACTORY_LEVEL_BUY: 21,
    FACTORY_DEPOSIT: 22,
    FACTORY_WITHDRAW: 23,
    SHOP_SELL_IN: 24,
    SHOP_BUY_OUT: 25,
    PLAYER_STRENGTH_BUY: 26,
    FACTORY_ATTACK: 28,
    FACTORY_BUILD: 29,
    FACTORY_CAPTURED: 30,
    FACTORY_DESTROYED: 31,
    PING_BUY: 32,
    APP_STATUS_REQUEST: 33,
    APP_STATUS_UPDATE: 34,
    APP_LANG_OBJECT_UPDATE: 35,
    APP_LANG_OBJECT_REQUEST: 36,
    GAME_LANG_OBJECT_UPDATE: 37,
    GAME_LANG_OBJECT_REQUEST: 38,
    SPECIAL_CUSTOM_ACTION_EXECUTE: 39,
    FACTORY_DESTROY: 40
};

/**
 * GEO states.
 * @type {{UNKNOWN: number, WORKING: number, NOT_WORKING: number, NO_PERMISSION: number, TIMEOUT: number}}
 */
const GeoStates = {
    UNKNOWN: 0,
    WORKING: 1,
    UNKNOWN_POSITION: 2,
    NOT_WORKING: 3,
    NO_PERMISSION: 4,
    TIMEOUT: 5
};

/**
 * Regular configuration for the game.
 * @type {Object}
 */
const Config = {
    location: {
        /**
         * Time in milliseconds for the location watcher fallback to kick in.
         */
        fallbackTime: 10 * 1000
    }
};

/**
 * Name configuration for the game.
 * @type {Object} */
const NameConfig = {
    app: {
        name: 'Dworek'
    },
    currency: {
        name: 'dollar',
        names: 'dollars',
        sign: '$'
    },
    factory: {
        name: 'factory',
        names: 'factories'
    },
    shop: {
        name: 'shop',
        names: 'shops'
    },
    in: {
        name: 'ingredient',
        names: 'ingredients'
    },
    out: {
        name: 'product',
        names: 'products'
    }
};

/**
 * Access object properties by a key in string format, separated by dots.
 *
 * @param {Object} o The object to access fields in.
 * @param {string} s Key as a string.
 *
 * @return {*} Accessed value.
 */
Object.byString = function(o, s) {
    // Convert the indices to properties
    s = s.replace(/\[(\w+)\]/g, '.$1');

    // Strip leading dots (cleanup), and get it's parts
    var a = s.replace(/^\./, '').split('.');

    // Loop through each part to access the object's property, recursively
    for (var i = 0, n = a.length; i < n; ++i) {
        // Get the object value for the current key
        var k = a[i];

        // Make sure the selected value is inside the object, return if it's not
        if (k in o)
            o = o[k];
        else
            return undefined;
    }

    // Return the selected value
    return o;
};

// Define the Date#now function if it isn't available
if(!Date.now)
    Date.now = function() {
        return new Date().getTime();
    };

/**
 * Default real time packet room type.
 * @type {string}
 */
const PACKET_ROOM_DEFAULT = 'default';

/**torm
 * Dworek client application.
 * @type {Object}
 */
var Dworek = {
    /**
     * State section.
     */
    state: {
            /**
             * True if the user authenticated over the real time server, false if not.
             * @type {boolean}
             */
            loggedIn: false,

            /**
             * Active user.
             * @type {string|null}
             */
            user: null,

            /**
             * ID of the currently active game.
             * @type {string|null}
             */
            activeGame: null,

            /**
             * Stage the active game is in.
             *
             * @type {Number|null} Game stage, or null if it's unknown.
             */
            activeGameStage: null,

            /**
             * The roles the user has in the active game.
             *
             * @type {UserRoles|null} Object with the user type, or null if it's unknown.
             */
            activeGameRoles: null,

            /**
             * Object defining a users role.
             *
             * @typedef {Object} UserRoles
             * @param {boolean} player True if the user is a player, false if not.
             * @param {boolean} spectator True if the user is a spectator, false if not.
             * @param {boolean} special True if the user is a special player, false if not.
             * @param {boolean} requested True if the user requested to join the game, flase if not.
             */

            /**
             * ID of the game that was last viewed by the user.
             * @type {string|null}
             */
            lastViewedGame: null,

            /**
             * Active GEO location watcher.
             * @type {Number|null}
             */
            geoWatcher: null,

            /**
             * Geo watcher fallback interval handle.
             * @type {Number|null}
             */
            geoWatcherFallback: null,

            /**
             * Last known GEO location state.
             * Defined by GeoStates enum.
             * @type {Number}
             */
            geoState: GeoStates.UNKNOWN,

            /**
             * The processed player position.
             * Or null if the position isn't valid anymore.
             * @type {*|null}
             */
            geoPlayerPosition: null,

            /**
             * The time the client was last connected at.
             * @type {Number} Time as timestamp, or -1 if unspecified.
             */
            lastConnected: -1,

            /**
             * Last known reconnection attempt count.
             * @type {Number} Last known reconnection attempt count.
             */
            lastReconnectAttempt: 0,

            /**
             * Define whether to use animations.
             * Disabled animations should make the application much more responsive on slow devices.
             */
            animate: true
        },

        /**
         * Start the client.
         */
        start: function() {
            // Start Sentry error monitoring
            this.startSentryMonitoring();

            // Start native droid
            this.startNativeDroid();

            // Connect to the real time server
            this.realtime.connect();

            // Apply the current animation state
            applyAnimationState();
        },

        /**
         * Start Sentry error monitoring on the web appliation.
         */
        startSentryMonitoring: function() {
            // Show a status message
            console.log('Starting error monitoring with Sentry...');

			// Start error monitoring with Sentry
			// TODO: Make this configurable
			// TODO: Don't hardcode the DSN (url)
			Raven.config('https://4343f576e97b4c41ba6264fbab90ab73@sentry.io/172946').install();

            // TODO: Supply some user (session) context
		},

        /**
         * Start NativeDroid and related modules.
         */
        startNativeDroid: function() {
            // Initialize NativeDroid, and store it's instance
            //noinspection ES6ModulesDependencies,NodeModulesDependencies
            nativeDroid = $.nd2();

            // Build
            nativeDroid.build();

            // Build NativeDroid on page initialization
            $(document).bind("pageinit", function() {
                // Make sure the native droid instance is available
                if(nativeDroid === null)
                    return;

                // Build the page
                nativeDroid.build();
            });
        },

        /**
         * Game worker sub-system.
         */
        gameWorker: {
            /**
             * Number of the game update request timer handle, or null if none.
             * @type {Number|null}
             */
            gameUpdateRequestTimer: null,

            /**
             * Defines whether the game worker is active, and whether the user is playing the game.
             */
            active: false,

            /**
             * Update the current game worker state based on the active game and known game info.
             */
            update: function() {
                // Determine whether we're playing
                const playing = Dworek.state.activeGameStage == 1 && Dworek.realtime._connected;

                // Define whether the game worker is active
                this.active = playing;

            // Start/stop the timer to update the game info
            if(playing && this.gameUpdateRequestTimer == null) {
                // Start the interval
                this.gameUpdateRequestTimer = setInterval(requestGameInfo, 5 * 60 * 1000);

                // Show a status message
                console.log('Started game info update timer');

            } else if(!playing && this.gameUpdateRequestTimer != null) {
                // Clear the interval and reset the variable
                clearInterval(this.gameUpdateRequestTimer);
                this.gameUpdateRequestTimer = null;

                // Show a status message
                console.log('Stopped game info update timer');
            }

            // TODO: Make sure geo location is supported

            // Determine whether to send locations to the server
            const sendLocationUpdates = playing && (Dworek.state.activeGameRoles.player || Dworek.state.activeGameRoles.special);

            // Start the GEO location watcher if it needs to be started
            if(sendLocationUpdates && Dworek.state.geoWatcher == null) {
                // Show a status message
                console.log('Starting GPS watcher...');

                // Start the geo watcher fallback interval
                Dworek.state.geoWatcherFallback = setInterval(doLocationFallback, Config.location.fallbackTime);

                // Make sure the user has given permission
                hasRequiredPermissions(function(err, permission) {
                    // Show errors
                    if(err !== null)
                        showError(err);

                    // Show the permission checkup dialog if we don't have permission
                    if(!permission) {
                        showPermissionCheckupDialog();
                        return;
                    }

                    // Start the position watcher
                    Dworek.state.geoWatcher = navigator.geolocation.watchPosition(function(position) {
                        // Process the success callback
                        processLocationSuccess(position, true, true);

                        // Clear the current geo watcher fallback
                        if(Dworek.state.geoWatcherFallback != null) {
                            clearInterval(Dworek.state.geoWatcherFallback);
                            Dworek.state.geoWatcherFallback = null;
                        }

                        // Start the geo watcher fallback interval
                        Dworek.state.geoWatcherFallback = setInterval(doLocationFallback, Config.location.fallbackTime);

                    }, function(error) {
                        // Process the error callback
                        processLocationError(error, false);

                    }, {
                        enableHighAccuracy: true,
                        timeout: 30 * 1000,
                        maximumAge: 15 * 1000
                    });
                });

            } else if(!sendLocationUpdates && Dworek.state.geoWatcher !== null) {
                // Show a status message
                console.log('Stopping GPS watcher...');

                // Clear the watch
                navigator.geolocation.clearWatch(Dworek.state.geoWatcher);
                Dworek.state.geoWatcher = null;

                // Clear the current geo watcher fallback
                if(Dworek.state.geoWatcherFallback != null) {
                    clearInterval(Dworek.state.geoWatcherFallback);
                    Dworek.state.geoWatcherFallback = null;
                }
            }

            // Update the status labels
            updateStatusLabels();
        }
    },

    /**
     * Real time section.
     */
    realtime: {
        /**
         * Real time socket connection.
         */
        _socket: null,

        /**
         * Create a flag to define whether the user is connected.
         */
        _connected: false,

        /**
         * Defines whether we're permanently disconnected.
         * Possibly because we were disconnected for too long.
         * This flag shouldn't be set to true again unless the page is fully refreshed.
         */
        _disconnected: false,

        /**
         * Define whether this is the users first connection.
         */
        _firstConnection: true,

        /**
         * Connect to the real time server.
         */
        connect: function() {
            // Create a socket instance
            this._socket = io.connect({
                path: '/realtime'
            });

            // Register the event handlers
            this.registerCoreHandlers();

            // Start the authentication timer
            Dworek.realtime.startAuthentication(false, true);

            // Pass received packets to the packet processor
            this._socket.on(PACKET_ROOM_DEFAULT, function(packet) {
                Dworek.realtime.packetProcessor.receivePacket(packet, self._socket);
            });
        },

        /**
         * Register all core handlers for the real time server.
         * These handlers track the connection state of the real time socket.
         */
        registerCoreHandlers: function() {
            // Store this instance
            const self = this;

            // Handle connection events
            this._socket.on('connect', function() {
                // Set the connection state
                self._connected = true;

                // Show a notification if this isn't the first time the user disconnected
                if(!self._firstConnection)
                    showNotification('Successfully reconnected!', {
                        vibrate: true
                    });

                // Start the authentication process
                self.startAuthentication(true, false);

                // Request the application language update if this is the first
                // connection
                if(self._firstConnection) {
                    // Show a status message
                    console.log('Requesting language object for the global application');

                    // Request
                    Dworek.realtime.packetProcessor.sendPacket(PacketType.APP_LANG_OBJECT_REQUEST, {});

                    // Check whether we're on a game page
                    if(Dworek.utils.isGamePage()) {
                        // Get the ID of the current active game
                        var gameId = Dworek.utils.getGameId();

                        // Request the language object for the game if it isn't available yet
                        // on the client
                        requestGameLangObjectIfNotAvailable(gameId);
                    }
                }

                // Check whether the user was disconnected for a long time
                if(Dworek.state.lastConnected >= 0) {
                    // Invalidate all other pages after 10 seconds
                    if((Date.now() - Dworek.state.lastConnected) > 10 * 1000)
                        Dworek.utils.flushPages(undefined, false);

                    // Show a refresh notification after two minutes
                    if((Date.now() - Dworek.state.lastConnected) > 2 * 60 * 1000)
                        showDisconnectedTooLongDialog();
                }

                // Reset reconnection attempt counter
                Dworek.state.lastReconnectAttempt = 0;

                // Update the game worker
                Dworek.gameWorker.update();
            });

            // Handle connection errors
            this._socket.on('connect_error', function() {
                // Set the connection state
                self._connected = false;

                // De-authenticate
                self._deauthenticate();

                // Show a notification if the last known reconnection attempt count is acceptable
                const attemptCount = Dworek.state.lastReconnectAttempt;
                if(attemptCount <= 5 || attemptCount % 10 == 0)
                    showNotification('Failed to connect' + (attemptCount > 1 ? ' (attempt ' + attemptCount + ')' : ''));
            });

            // Handle connection timeouts
            this._socket.on('connect_timeout', function() {
                // Set the connection state
                self._connected = false;

                // De-authenticate
                self._deauthenticate();

                // Show a notification
                showNotification('The connection timed out');
            });

            // Handle reconnection attempts
            this._socket.on('reconnect_attempt', function(attemptCount) {
                // Show a notification
                if(attemptCount <= 5 || attemptCount % 10 == 0)
                    showNotification('Trying to reconnect...' + (attemptCount > 1 ? ' (attempt ' + attemptCount + ')' : ''));

                // Store the last known reconnection attempt count
                Dworek.state.lastReconnectAttempt = attemptCount;
            });

            // Handle reconnection failures
            this._socket.on('reconnect_failed', function() {
                // Set the connection state
                self._connected = false;

                // De-authenticate
                self._deauthenticate();

                // Show a notification
                showNotification('Failed to reconnect');
            });

            // Handle disconnects
            this._socket.on('disconnect', function() {
                // Set the connection state, and reset the first connection flag
                self._connected = false;
                self._firstConnection = false;

                // De-authenticate
                self._deauthenticate();

                // Reset the current app status
                appStatus = null;

                // Show a notification regarding the disconnect
                showNotification('You\'ve lost connection...', {
                    vibrate: true,
                    vibrationPattern: [1000]
                });

                // Set the last connected state
                Dworek.state.lastConnected = Date.now();

                // Create a timer, to show the disconnected for too long if still disconnected after 3 minutes
                setTimeout(function() {
                    // Make sure we're disconnected, then show the dialog
                    if(!Dworek.realtime._connected)
                        showDisconnectedTooLongDialog();
                }, 3 * 60 * 1000);

                // Update the game worker
                Dworek.gameWorker.update();
            });
        },

        /**
         * Start the authentication process for the current user.
         *
         * @param {boolean=true} now True to immediately authenticate.
         * @param {boolean=true} timer True to start the authentication timer.
         */
        startAuthentication: function(now, timer) {
            // Authenticate each 5 minutes
            if(timer === undefined || !!timer)
                setInterval(this._authenticate, 5 * 60 * 1000);

            // Authenticate now
            if(now === undefined || !!now)
                this._authenticate();
        },

        /**
         * Send an authentication request.
         * @private
         */
        _authenticate: function() {
            // Show a console message
            console.log('Requesting authentication through real time server...');

            // Create the package object
            var packetObject = {
                session: Dworek.utils.getCookie('session_token')
            };

            // Emit the package
            Dworek.realtime.packetProcessor.sendPacket(PacketType.AUTH_REQUEST, packetObject);
        },

        /**
         * De-authenticate.
         * @private
         */
        _deauthenticate: function() {
            // Reset some authentication related flags
            Dworek.state.loggedIn = false;
            Dworek.state.user = null;
        },

        /**
         * Packet processor.
         */
        packetProcessor: {
            /**
             * Registered handlers.
             */
            _handlers: {},

            /**
             * Process a received raw packet.
             *
             * @param {Object} rawPacket Raw packet object.
             * @param socket SocketIO socket.
             */
            receivePacket: function(rawPacket, socket) {
                // Do not process packets when disconnected
                if(Dworek.realtime._disconnected) {
                    // Show a status message, and return
                    console.log('Ignoring received packet because we we were disconnected for too long.');
                    return;
                }

                // Make sure we received an object
                if(!(typeof rawPacket === 'object')) {
                    console.log('Received malformed packet, packet data isn\'t an object, ignoring');
                    return;
                }

                // Make sure a packet type is given
                if(!rawPacket.hasOwnProperty('type')) {
                    console.log('Received malformed packet, packet type not specified, ignoring');
                    return;
                }

                // Get the packet type
                const packetType = rawPacket.type;

                // Invoke the handlers for this packet type
                this.invokeHandlers(packetType, rawPacket, socket);
            },

            /**
             * Send a packet object to the given
             *
             * @param {Number} packetType Packet type value.
             * @param {Object} packet Packet object to send.
             * @param socket SocketIO socket to send the packet over.
             */
            sendPacket: function(packetType, packet, socket) {
                // Do not send packets when disconnected
                if(Dworek.realtime._disconnected) {
                    // Show a status message, and return
                    console.log('Not sending packet because we we were disconnected for too long.');
                    return;
                }

                // Make sure we're connected
                if(!Dworek.realtime._connected) {
                    console.log('Unable to send packet to server, not connected');
                    return;
                }

                // Use the default socket if not specified
                if(socket == undefined)
                    socket = Dworek.realtime._socket;

                // Put the packet type in the packet object
                packet.type = packetType;

                // Send the packet over the socket
                socket.emit(PACKET_ROOM_DEFAULT, packet);
            },

            /**
             * Register a handler.
             *
             * @param {Number} packetType Packet type.
             * @param {function} handler Handler function.
             */
            registerHandler: function(packetType, handler) {
                // Array of handlers for this packet type
                var handlers = [];

                // Get the current array of handlers if defined
                if(this._handlers.hasOwnProperty(packetType.toString()))
                    handlers = this._handlers[packetType.toString()];

                // Add the handler
                handlers.push(handler);

                // Put the array of handlers back into the handlers map
                this._handlers[packetType.toString()] = handlers;
            },

            /**
             * Get the handler functions for the given packet type.
             *
             * @param {Number} packetType Packet type.
             */
            getHandlers: function(packetType) {
                // Return an empty array if nothing is defined for this packet type
                if(!this._handlers.hasOwnProperty(packetType.toString()))
                    return [];

                // Get and return the handlers
                return this._handlers[packetType.toString()];
            },

            /**
             * Invoke the handlers for the given packet type.
             *
             * @param {Number} packetType Packet type.
             * @param {Object} packet Packet object.
             * @param socket SocketIO socket.
             */
            invokeHandlers: function(packetType, packet, socket) {
                // Get the handlers for this packet type
                const handlers = this.getHandlers(packetType);

                // Loop through the handlers
                handlers.forEach(function(handler) {
                    handler(packet, socket);
                });
            }
        }
    },

    /**
     * Utility functions.
     */
    utils: {
        /**
         * Determine whether we're on a game page.
         *
         * @return {boolean} True if we're on a game related page, false if not.
         */
        isGamePage: function() {
            return this.getGameId() != null;
        },

        /**
         * Determine whether we're on a status page.
         *
         * @return {boolean} True if we're on the status page.
         */
        isStatusPage: function() {
            return document.location.pathname.trim().toLowerCase().lastIndexOf('/status', 0) === 0;
        },


        /**
         * Get the game ID of the game pages we're currently on.
         *
         * @return {string|null} Game ID or null if we're not on a game page.
         */
        getGameId: function() {
            // Create a regular expression to fetch the game ID from the URL
            const result = document.location.pathname.trim().match(/^\/game\/([a-f0-9]{24})(\/.*)?$/);

            // Make sure any result was found
            if(result === null || result.length < 2)
                return null;

            // Get and return the game ID
            return result[1].toLowerCase();
        },

        /**
         * Determine whether we're on a factory page.
         *
         * @return {boolean} True if we're on a factory related page, false if not.
         */
        isFactoryPage: function() {
            return this.getFactoryId() != null;
        },

        /**
         * Get the factory ID of the factory pages we're currently on.
         *
         * @return {string|null} Factory ID or null if we're not on a game page.
         */
        getFactoryId: function() {
            // Create a regular expression to fetch the factory ID from the URL
            const result = document.location.pathname.trim().match(/^\/game\/([a-f0-9]{24})\/factory\/([a-f0-9]{24})(\/.*)?$/);

            // Make sure any result was found
            if(result === null || result.length < 2)
                return null;

            // Get and return the factory ID
            return result[2].toLowerCase();
        },

        /**
         * Flush all pages that match the URL matcher.
         *
         * @param {RegExp|undefined} [urlMatcher] A regex to flush pages that have a matching URL, undefined to flush all.
         * @param {boolean} [reloadCurrent=false] True to reload the current page, false if not.
         */
        flushPages: function(urlMatcher, reloadCurrent) {
            if(reloadCurrent) {
                document.location.reload();
                return;
            }

            // Get all hidden/cached pages
            const pages = $('div[data-role=page]:hidden');

            // Loop through the list of pages
            pages.each(function() {
                // Match the URL, continue if it doesn't match
                if(urlMatcher !== undefined && $(this).data('url').toString().trim().match(urlMatcher) === null)
                    return;

                // Flush the page
                $(this).remove();
            });
        },

        /**
         * Reload the current page.
         */
        reloadPage: function() {
            // Force reload the application if we're in crazy Chrome
            if(this.isChrome(true)) {
                document.location.reload();
                return;
            }

            // Reload the current page
            this.navigateToPage(document.location.href, true, false, 'fade');
        },

        /**
         * Navigate to the given URL path.
         *
         * @param {string} url Url with a prefixed slash.
         */
        navigateToPath: function(url) {
            // Flush the cache for all other pages
            this.flushPages(undefined, true);

            // Determine the target URL
            const targetUrl = document.location.protocol + '//' + document.location.host + url;

            // Set the location of the user
            window.location = targetUrl;

            // Show an error dialog for Chrome users
            if(Dworek.utils.isChrome(true)) {
                // Add the refresh meta to the page
                $('body').append('<meta http-equiv="refresh" content="0; url=' + targetUrl + '">');

                // Show a dialog after half a second
                setTimeout(function() {
                    // Show the dialog
                    showDialog({
                        title: 'Whoops',
                        message: 'Dworek has detected that Chrome is having problems getting you to the proper page.<br><br>' +
                        'Please click the link below to reload the application, and work around this problem.<br><br>' +
                        '<meta http-equiv="refresh" content="0; url=' + targetUrl + '">' +
                        '<div align="center"><a href="' + targetUrl + '" data-ajax="false">!@#$&* Google Chrome</a></div>'
                    });
                }, 2000);
            }
        },

        /**
         * Navigate to the given page.
         *
         * @param page Page URL to navigate to.
         * @param reload True to force reload the page if it's already cached.
         * @param [changeHash=true] True to change the hash, false if not.
         * @param [transition] Page transition.
         */
        navigateToPage: function(page, reload, changeHash, transition) {
            // Create the options object
            var options = {
                allowSamePageTransition: true,
                reloadPage: reload,
                reload: reload,
                transition: transition !== undefined ? transition : 'slide',
                changeHash: changeHash !== undefined ? changeHash : true
            };

            // Navigate to the page, wait a little to execute it after other page changing requests
            setTimeout(function() {
                $.mobile.changePage(page, options);
            }, Dworek.utils.isChrome(true) ? 500 : 10);
        },

        /**
         * Get a cookie value.
         * @param {string} cookieName Cookie name.
         * @return {string}
         */
        getCookie: function(cookieName) {
            // Determine the cookie selector, and get an array of cookies
            var selector = cookieName + "=";
            var cookies = document.cookie.split(';');

            // Loop through the list of cookies, find the requested cookie and return it's value
            for(var i = 0; i <cookies.length; i++) {
                var cookie = cookies[i];
                while(cookie.charAt(0) == ' ')
                    cookie = cookie.substring(1);
                if(cookie.indexOf(selector) == 0)
                    return cookie.substring(selector.length,cookie.length);
            }

            // No cookie found, return an empty string
            return '';
        },

        /*
         * Determine whether the current browser is Google's Crappy Chrome.
         *
         * @param {boolean} [ios=true] True to also return true if this is Chrome on iOS, false if not.
         */
        isChrome: function(ios) {
            // Parse the parameter
            if(ios == undefined)
                ios = true;

            // Prepare some things
            //noinspection JSUnresolvedVariable,JSCheckFunctionSignatures,JSCheckFunctionSignatures
            var isChromium = window.chrome,
                winNav = window.navigator,
                vendorName = winNav.vendor,
                isOpera = winNav.userAgent.indexOf("OPR") > -1,
                isIEedge = winNav.userAgent.indexOf("Edge") > -1,
                isIOSChrome = winNav.userAgent.match("CriOS");

            // Determine whether we're on iOS Chrome
            if(isIOSChrome)
                return ios;

            // Determine whether this is Chrome, return the result
            return (isChromium != undefined && isOpera == false && isIEedge == false);
        }
    }
};

/**
 * Check whether we're running Firefox.
 *
 * @return {boolean} True if Firefox, false if not.
 */
function isFirefox() {
    return navigator.userAgent.toLowerCase().indexOf('firefox') > -1;
}

/**
 * Get the current Firefox version.
 *
 * @return {string} Firefox version.
 */
function getFirefoxVersion() {
    // Get the user agent
    var agent = navigator.userAgent;

    // Get the offset the Firefox identifier is at
    var offset = verOffset = agent.indexOf('Firefox');

    // Return -1 if the version wasn't found
    if(offset < 0)
        return -1;

    // Get the version string
    return agent.substring(verOffset + 'Firefox'.length + 1);
}

/**
 * Get the major Firefox version this browser has.
 *
 * @return {int} Major version.
 */
function getFirefoxVersionMajor() {
    // Get the full version
    const ver = getFirefoxVersion();

    // Return if it's -1
    if(ver < 0)
        return -1;

    // Parse and return the version
    return parseInt(ver.split('.')[0]);
}

/**
 * Check whether we're running Android.
 *
 * @return {boolean} True if Android, false if not.
 */
function isAndroid() {
    return navigator.userAgent.toLowerCase().indexOf('android') > -1;
}

/**
 * Check whether we're running Fennec.
 *
 * @return {boolean} True if Fennec, false if not.
 */
function isFennec() {
    return navigator.userAgent.toLowerCase().indexOf('fennec') > -1;
}

/**
 * The language object for the global appliation.
 * @type {Object}
 */
var langAppObject = null;

/**
 * The language objects for each game.
 * Each key of this object is the ID of the game, in lowercase.
 * The value holds the actual game language object.
 * @type {Object}
 */
var langGameObjects = {};

/**
 * Get the language object for the given game.
 *
 * @param {string} gameId ID of the game.
 * @return {Object|undefined} Language object for the game,
 * or null if there isn't any.
 */
function getGameLangObject(gameId) {
    // Parse the game ID
    gameId = gameId.trim().toLowerCase();

    // Make sure there's something to return
    if(!hasGameLangObject(gameId))
        return undefined;

    // Return
    return langGameObjects[gameId];
}

/**
 * Set the language object for the given game.
 *
 * @param {string} gameId ID of the game.
 * @param {Object} gameLangObject The game language object.
 */
function setGameLangObject(gameId, gameLangObject) {
    // Parse the game ID
    gameId = gameId.trim().toLowerCase();

    // Set the language object
    langGameObjects[gameId] = gameLangObject;
}

/**
 * Check whether we've the language object for the given game.
 *
 * @param {string} gameId ID of the game.
 * @return {bool} True if we have the language object, false if not.
 */
function hasGameLangObject(gameId) {
    // Parse the game ID
    gameId = gameId.trim().toLowerCase();

    // Check and return the result
    return langGameObjects.hasOwnProperty(gameId);
}

/**
 * Request the language object for the given game from the server.
 * It might take a while before the language is received for the given game.
 *
 * @param {stirng} gameId The ID of the game to request the language
 * object for.
 */
function requestGameLangObject(gameId) {
    // Make sure we're connected
    if(!Dworek.realtime._connected)
        return;

    // Show a status message
    console.log('Requesting language object for the game: ' + gameId);

    // Request the language data
    Dworek.realtime.packetProcessor.sendPacket(PacketType.GAME_LANG_OBJECT_REQUEST, {
        game: gameId
    });
}

/**
 * Request the langauge object for the given game, if it isn't currently 
 * available on the client.
 * It might take a while before the language is received for the given game.
 *
 * @param {stirng} gameId The ID of the game to request the language
 * object for.
 */
function requestGameLangObjectIfNotAvailable(gameId) {
    // Check whether the data exists, request it if not
    if(!hasGameLangObject(gameId))
        requestGameLangObject(gameId);
}

/**
 * Default render name config options object.
 *
 * @type {RenderNameConfigOptions}
 */
const RENDER_NAME_CONFIG_OPTIONS_DEFAULTS = {
    encapsulate: true,
    capitalizeFirst: false,
    game: null
};

/**
 * Render the text/name for the given node/key in the current language.
 * This encapsulates the text in a span element, to allow dynamic langauge
 * updates on the page.
 * The result string with the text and span element is returned as a string.
 *
 * If no known text is found for the given node, the node itself is returned,
 * encapsulated between curly brackets.
 *
 * @param {string} node The node or key for the languages text.
 * @param {RenderNameConfigOptions|undefined|null} [options] Options object.
 *
 * @return {string} The text value.
 */
function renderNameConfig(node, options) {
    // Set the options to their defaults if unset
    if(options === undefined || options === null)
        options = {};

    // Merge the options
    options = merge(merge({}, RENDER_NAME_CONFIG_OPTIONS_DEFAULTS), options);

    // Trim the node string
    node = node.trim();

    // Define a variable for the language value
    var text = undefined;

    // Get the game language object if there is any
    if(options.game !== null && options.game !== undefined && hasGameLangObject(options.game)) {
        // Get the game lang object
        const gameLangObject = getGameLangObject(options.game);

        // Get the string if the language object is valid
        if(gameLangObject !== null && gameLangObject !== undefined)
            text = Object.byString(gameLangObject, node);
    }

    // Use the global language object if no language value has been found yet
    if(text === undefined || langAppObject === null)
        text = Object.byString(langAppObject, node);

    // Capitalize the first character if set
    if(text !== undefined && options.capitalizeFirst && text.length > 0)
        text = capitalizeFirst(text);

    // Set the text to the node itself if it's still undefined,
    // because the node was invalid
    if(text === undefined || text.length === 0)
        text = '{' + node + '}';

    // Encapsulate
    if(options.encapsulate) {
        // Build the span class
        var spanClass = 'lang lang-node-' + node.replace('.', '-');

        // Append the game ID
        if(options.game !== null && options.game !== undefined && options.game.trim().length > 0)
            spanClass += ' lang-game-' + options.game.trim().toLowerCase();

        // Set whether to capitalize the first character
        if(options.capitalizeFirst)
            spanClass += ' lang-capitalize-first';

        // Encapsulate in the span tag
        text = '<span class="' + spanClass + '">' + text + '</span>';
    }

    // Return the text
    return text;
}

// Alias for renderNameConfig
const __ = renderNameConfig;

/**
 * This function will dynamically update every language value loaded on the
 * client. This function is called when a new language update has been
 * received for the global application, or a game.
 *
 * @param {string|boolean} gameId Game ID constraint. The game ID of an ID to
 * update the values for it. True to update all game language related values,
 * false to update no game related language values.
 */
function updateNameConfigs(gameId) {
    // Build the find selector
    var findSelector = 'span.lang';

    // Append the game constraint if set
    if(gameId !== null && gameId !== undefined) {
        if(gameId === false)
            findSelector += '[class!*=\'lang-game-\']';
        else if(gameId !== null && gameId !== undefined && gameId !== true && gameId !== false)
            findSelector += '.lang-game-' + gameId.trim().toLowerCase();
    }

    // Find the elements
    $(document).find(findSelector).each(function() {
        // Check whether to capitalize the first letter
        const capitalizeFirst = $(this).hasClass('lang-capitalize-first');

        // Get the node and the game ID if it has any
        var node = null;
        var gameId = null;
        $.each($(this).attr('class').split(' '), function() {
            // Return early if the game ID was found
            if(node !== null && gameId !== null)
                return;

            // Check whether this class entry starts with a node identifier
            if(this.substring(0, 'lang-node-'.length) === 'lang-node-')
                node = this.substring('lang-node-'.length).replace('-', '.');

            // Check whether this class entry starts with a game identifier
            if(this.substring(0, 'lang-game-'.length) === 'lang-game-')
                gameId = this.substring('lang-game-'.length).trim().toLowerCase();
        });

        // Return if no node was found
        if(node === null) {
            console.log('Skipping dynamic language value update, original language node not found');
            return;
        }

        // Build the name config options object
        var nameConfigOptions = {
            capitalizeFirst: capitalizeFirst,
            encapsulate: false
        };

        // Set the game property
        if(gameId !== false && gameId !== true && gameId !== undefined && gameId !== null)
            nameConfigOptions.game = gameId;

        // Get the language text
        var newText = renderNameConfig(node, nameConfigOptions);

        // Update the element content if it changed
        if($(this).text() !== newText)
            $(this).text(newText);
    });
}

/**
 * An object to define name config rendering properties.
 *
 * @typedef {Object} RenderNameConfigOptions
 * 
 * @param {string} [game] ID of the game to render this language value for.
 * @param {boolean} [encapsulate=true] True to encapsulate the value in a span
 * element, false to keep it clean.
 * @param {boolean=false} [capitalizeFirst] Capitalize the first letter of the
 * text.
 */

// Register the global language object update handler
Dworek.realtime.packetProcessor.registerHandler(PacketType.APP_LANG_OBJECT_UPDATE, function(packet) {
	// Make sure the required fields are available
    if(!packet.hasOwnProperty('langObject')) {
		throw new Error('Received malformed packet, missing language object in global language update packet');
		return;
	}

    // Set the language object
    langAppObject = packet.langObject;

    // Dynamically update all language values on the loaded page
    updateNameConfigs(true);
});

// Register the game language object update handler
Dworek.realtime.packetProcessor.registerHandler(PacketType.GAME_LANG_OBJECT_UPDATE, function(packet) {
	// Make sure the required fields are available
    if(!packet.hasOwnProperty('game') || !packet.hasOwnProperty('langObject')) {
		throw new Error('Received malformed packet, missing game ID or language object in game language update packet');
		return;
	}

    // Get the game language object
    var gameId = packet.game;
    var gameLangObject = packet.langObject;

    // Make sure the game ID isn't empty
    if(gameId === undefined || gameId === null || gameId.trim().length === 0) {
		throw new Error('Received malformed packet, invalid game ID in game language update packet');
		return;
	}

    // Set the game language object
    setGameLangObject(gameId, gameLangObject);

    // Dynamically update all game language values on the loaded page
    updateNameConfigs(gameId);
});

// Wait for initialization
$(function() {
    // Start Dworek
	// TODO: Should this be changed to Dworek.state.start() ?
    Dworek.start();
});

/**
 * Apply the current animation configuration to all objects on the page.
 */
function applyAnimationState() {
    // Set map options when the map is loaded
    if(map != null) {
        map.options.fadeAnimation = Dworek.state.animate;
        map.options.zoomAnimation = Dworek.state.animate;
        map.options.markerZoomAnimation = Dworek.state.animate;
        map.options.inertia = Dworek.state.animate;
    }

    // Set the jQuery animation properties (untested)
    jQuery.fx.off = !Dworek.state.animate;
}

// Register an authentication response packet handler
Dworek.realtime.packetProcessor.registerHandler(PacketType.AUTH_RESPONSE, function(packet) {
    // Set the logged in state
    Dworek.state.loggedIn = !!packet.loggedIn;

    // Show an error notification if we failed to authenticate
    if(packet.hasOwnProperty('valid') && !packet.valid) {
        showNotification('Failed to authenticate', {
            action: {
                text: 'Login',
                action: function() {
                    Dworek.utils.navigateToPath('/login');
                    return false;
                }
            },
            ttl: 1000 * 60
        });

    } else {
        // Show a console message, we authenticated successfully through the real time server
        console.log('Successfully authenticated through real time server. (logged in: ' + (packet.loggedIn ? 'yes' : 'no') + ')');

        // Store the authenticated user
        Dworek.state.user = packet.user;

        // Update the active game page
        updateActiveGame();

        // Make sure the user has given permission if logged in
        if(packet.loggedIn)
            hasRequiredPermissions(function(err, permission) {
                // Show errors
                if(err !== null)
                    console.log('Required permission check error: ' + err);

                // Show the permission checkup dialog if we don't have permission
                if(!permission)
                    showPermissionCheckupDialog();
            });
    }

    // Request new game data
    requestGameData();
    requestFactoryData();
});

// Register game stage change handler
Dworek.realtime.packetProcessor.registerHandler(PacketType.GAME_STAGE_CHANGED, function(packet) {
    // Make sure the packet contains the required properties
    if(!packet.hasOwnProperty('game') || !packet.hasOwnProperty('gameName') || !packet.hasOwnProperty('stage') || !packet.hasOwnProperty('joined'))
        return;

    // Get the packet data
    const gameId = packet.game;
    const gameName = packet.gameName;
    const stage = packet.stage;
    const isJoined = packet.joined;

    // TODO: Invalidate game related page cache!

    // Invalidate game pages if the player didn't join this game
    if(!isJoined) {
        // Check whether the user is currently on the page of this game
        if(gameId == Dworek.utils.getGameId()) {
            showNotification('This game has been changed.', {
                action: {
                    text: 'Refresh'
                }
            }, function() {
                Dworek.utils.navigateToPath('/game/' + gameId);
                return false;
            });
        }

        // We're done, return
        return;
    }

    // Define the title, message and actions to show to the user
    var title = 'Game changed';
    var message = 'The stage of the game <b>' + gameName + '</b> has changed.';
    var actions = [];

    // Determine the title
    if(stage == 1)
        title = 'Game started';
    else if(stage == 2)
        title = 'Game finished';

    // Determine whether this game, or a different game has been started
    if(Dworek.utils.getGameId() == gameId) {
        // Build a message to show to the user
        if(stage == 1)
            message = 'The game has been started.';
        else if(stage == 2)
            message = 'The game has been finished.';

        // Create the dialog actions
        actions.push({
            text: 'Refresh',
            type: 'primary'
        });

    } else {
        // Build a message to show to the user
        if(stage == 1)
            message = 'The game <b>' + gameName + '</b> has been started.<br><br>You\'ve joined this game.';
        else if(stage == 2)
            message = 'The game <b>' + gameName + '</b> has been finished.<br><br>You\'ve joined this game.';

        // Create the dialog actions
        actions.push({
            text: 'View game',
            type: 'primary'
        });
        actions.push({
            text: 'Close',
            value: false
        });
    }

    // Show a dialog and notify the user about the state change
    showDialog({
        title: title,
        message: message,
        actions: actions

    }, function(result) {
        // Go back if the result equals false (because the close button was pressed)
        if(result === false)
            return;

        // Move to the games page
        Dworek.utils.navigateToPath('/game/' + gameId);
    });

    // Update the active game stage, and request a game info update
    Dworek.state.activeGameStage = stage;
    requestGameInfo(gameId);
});

// Register an message response handler
Dworek.realtime.packetProcessor.registerHandler(PacketType.MESSAGE_RESPONSE, function(packet) {
    // Make sure a message has been set
    if(!packet.hasOwnProperty('message'))
        return;

    // Get all properties
    const message = packet.message;
    const error = packet.hasOwnProperty('error') ? !!packet.error : false;
    const dialog = packet.hasOwnProperty('dialog') && !!packet.dialog;
    const toast = packet.hasOwnProperty('toast') && !!packet.toast;
    const ttl = packet.hasOwnProperty('ttl') ? parseInt(packet.ttl) : undefined;
    const shouldVibrate = packet.hasOwnProperty('vibrate') ? packet.vibrate : false;

    // Show a dialog
    if(dialog) {
        // Show a dialog
        showDialog({
            title: error ? 'Error' : 'Message',
            message: message,
            actions: [
                {
                    text: 'Close'
                }
            ]
        });
    }

    // Show a toast notification
    if(toast || (!dialog && !toast)) {
        // Create the notification object
        var notificationObject = {
            action: {
                text: 'Close'
            }
        };

        // Set the TTL
        if(ttl !== undefined)
            notificationObject.ttl = ttl;

        // Show a toast notification
        showNotification(message, notificationObject);
    }

    // Vibrate if requested
    if(shouldVibrate)
        vibrate();
});

// Handle factory build packets
Dworek.realtime.packetProcessor.registerHandler(PacketType.FACTORY_BUILD, function(packet) {
    // Get all properties
    const factoryId = packet.factory;
    const factoryName = packet.factoryName;
    const isSelf = packet.self;
    const userName = packet.userName;

    // TODO: Get the correct game ID for this factory, instead of using getGameId()
    var gameId = Dworek.utils.getGameId();

    // Create a function to navigate to the factory
    const navigateToFactory = function() {
        Dworek.utils.navigateToPage('/game/' + gameId + '/factory/' + factoryId, false, true, 'flip');
    };

    // Show a message if it's the user itself
    if(isSelf) {
        // Show a dialog
        showDialog({
            title: __('factory.name', { capitalizeFirst: true, game: gameId }) + ' built',
            message: 'The ' + __('factory.name', { game: gameId }) + ' <b>' + factoryName + '</b> has successfully been built!',
            actions: [
                {
                    text: 'View ' + __('factory.name', { game: gameId }),
                    state: 'primary',
                    action: navigateToFactory
                },
                {
                    text: 'Close'
                }
            ]
        });
        return;
    }

    // Show a notification
    showNotification('<b>' + userName + '</b> built a factory', {
        action: {
            text: 'View',
            action: navigateToFactory
        },
        vibrate: true
    });
});

// Handle factory capture packets
Dworek.realtime.packetProcessor.registerHandler(PacketType.FACTORY_CAPTURED, function(packet) {
    // Get all properties
    const factoryId = packet.factory;
    const factoryName = packet.factoryName;
    const isSelf = packet.self;
    const userName = packet.userName;
    const teamName = packet.teamName;
    const isAlly = packet.ally;
    const isEnemy = packet.enemy;

    // TODO: Get the correct game ID for this factory, instead of using getGameId()
    var gameId = Dworek.utils.getGameId();

    // Create a function to navigate to the factory
    const navigateToFactory = function() {
        Dworek.utils.navigateToPage('/game/' + gameId + '/factory/' + factoryId, false, true, 'flip');
    };

    // Show a message if it's the user itself
    if(isSelf) {
        // Show a dialog
        showDialog({
            title: __('factory.name', { capitalizeFirst: true, game: gameId }) + ' captured',
            message: 'You\'ve successfully captured the <b>' + factoryName + '</b> ' + __('factory.name', { game: gameId }) + '!',
            actions: [
                {
                    text: 'Close'
                }
            ]
        });
        return;
    }

    // Show a message to allies
    if(isAlly) {
        if(Dworek.utils.isFactoryPage() && Dworek.utils.getFactoryId() == factoryId) {
            // Show a dialog
            showDialog({
                title: __('factory.name', { capitalizeFirst: true, game: gameId }) + ' captured',
                message: '<b>' + userName + '</b> captured this ' + __('factory.name', { game: gameId }) + ' and it is now owned by our team.',
                actions: [
                    {
                        text: 'Close'
                    }
                ]
            });

        } else {
            // Show a notification
            showNotification('<b>' + userName + '</b> captured an enemy ' + __('factory.name', { game: gameId }), {
                action: {
                    text: 'View',
                    action: navigateToFactory
                },
                vibrate: true
            });
        }
        return;
    }

    // Show a message to enemies
    if(isEnemy) {
        if(Dworek.utils.isFactoryPage() && Dworek.utils.getFactoryId() == factoryId) {
            // Show a dialog
            showDialog({
                title: __('factory.name', { capitalizeFirst: true, game: gameId }) + ' taken over',
                message: 'This ' + __('factory.name', { game: gameId }) + ' has been captured by <b>' + userName + '</b> in the <b>' + teamName + '</b> team.',
                actions: [
                    {
                        text: 'Close'
                    }
                ]
            });

        } else {
            // Show a notification
            showNotification('<b>' + userName + '</b> took over one of our ' + __('factory.name', { game: gameId }) + 's', {
                action: {
                    text: 'View',
                    action: navigateToFactory
                },
                vibrate: true
            });
        }
        return;
    }

    // Show a global message
    if(Dworek.utils.isFactoryPage() && Dworek.utils.getFactoryId() == factoryId) {
        // Show a dialog
        showDialog({
            title: __('factory.name', { capitalizeFirst: true, game: gameId }) + ' captured',
            message: 'This ' + __('factory.name', { game: gameId }) + ' has been captured by <b>' + userName + '</b> in the <b>' + teamName + '</b> team.',
            actions: [
                {
                    text: 'Close'
                }
            ]
        });

    } else {
        // Show a notification
        showNotification('A ' + __('factory.name', { game: gameId }) + 'has been captured by <b>' + userName + '</b>', {
            action: {
                text: 'View',
                action: navigateToFactory
            }
        });
    }
});

// Handle factory destroy packets
Dworek.realtime.packetProcessor.registerHandler(PacketType.FACTORY_DESTROYED, function(packet) {
    // Get all properties
    const factoryId = packet.factory;
    const isBroadcast = packet.broadcast;
    const factoryName = packet.factoryName;
    const isSelf = packet.self;
    const userName = packet.userName;
    const teamName = packet.teamName;
    const isAlly = packet.ally;
    const isEnemy = packet.enemy;

    // Get the game ID
    //  TODO: Get the correct game ID instead of the ID of the current page
    var gameId = Dworek.utils.getGameId();

    // Function to navigate to the game overview
    const navigateToGameOverview = function() {
        Dworek.utils.navigateToPage('/game/' + gameId, false, true, 'flip');
    };

    // Show specific messages when this is a broadcast
    if(isBroadcast) {
        // Show a message if it's the user itself
        if(isSelf) {
            // Show a dialog
            showDialog({
                title: __('factory.name', { capitalizeFirst: true, game: gameId }) + ' destroyed',
                message: 'You\'ve successfully destroyed the <b>' + factoryName + '</b> ' + __('factory.name', { game: gameId }) + '!',
                actions: [
                    {
                        text: 'Game overview',
                        state: 'primary'
                    }
                ]
            }, navigateToGameOverview);
            return;
        }

        // Show a message to allies
        if(isAlly) {
            if(Dworek.utils.isFactoryPage() && Dworek.utils.getFactoryId() == factoryId) {
                // Show a dialog
                showDialog({
                    title: __('factory.name', { capitalizeFirst: true, game: gameId }) + ' destroyed',
                    message: '<b>' + userName + '</b> destroyed this ' + __('factory.name', { game: gameId }) + ' and it is now owned by our team.',
                    actions: [
                        {
                            text: 'Game overview',
                            state: 'primary'
                        }
                    ]
                }, navigateToGameOverview);

            } else {
                // Show a notification
                showNotification('<b>' + userName + '</b> destroyed an enemy ' + __('factory.name', { game: gameId }), {
                    vibrate: true
                });
            }
            return;
        }

        // Show a message to enemies
        if(isEnemy) {
            if(Dworek.utils.isFactoryPage() && Dworek.utils.getFactoryId() == factoryId) {
                // Show a dialog
                showDialog({
                    title: __('factory.name', { capitalizeFirst: true, game: gameId }) + ' destroyed',
                    message: 'This ' + __('factory.name', { game: gameId }) + ' has been destroyed by <b>' + userName + '</b> in the <b>' + teamName + '</b> team.',
                    actions: [
                        {
                            text: 'Game overview',
                            state: 'primary'
                        }
                    ]
                }, navigateToGameOverview);

            } else {
                // Show a notification
                showNotification('<b>' + userName + '</b> destroyed one of our ' + __('factory.name', { game: gameId }) + 's', {
                    vibrate: true
                });
            }
            return;
        }
    }

    // Show a global message
    if(Dworek.utils.isFactoryPage() && Dworek.utils.getFactoryId() == factoryId) {
        // Define the message
        var message = 'This ' + __('factory.name', { game: gameId }) + ' has been destroyed';

        // Add some user info
        if(userName !== undefined && userName !== null) {
            message += 'by <b>' + userName + '</b>';

            // Add some team info
            if(teamName !== undefined && teamName !== null)
               message += ' in the <b>' + teamName + '</b> team';
        }

        message += '.';

        // Show a dialog
        showDialog({
            title: __('factory.name', { capitalizeFirst: true, game: gameId }) + ' destroyed',
            message: message,
            actions: [
                {
                    text: 'Game overview',
                    state: 'primary'
                }
            ]
        }, navigateToGameOverview);

    } else if(isBroadcast) {
        // Show a notification
        showNotification('A ' + __('factory.name', { game: gameId }) + ' has been destroyed by <b>' + userName + '</b>');
    }
});

/**
 * Queue of broadcasts that need to be shown to the user.
 * @type {Array}
 */
var broadcastQueue = [];

/**
 * Show the next queued broadcast.
 */
function showNextBroadcast() {
    // Make sure there's any broadcast to show
    if(broadcastQueue.length == 0)
        return;

    // Get the broadcast to show
    const broadcast = broadcastQueue[0];

    // Determine the message
    var dialogMessage = broadcast.message + '<br><hr><i>This broadcast was send by the host of the <b>' + broadcast.gameName + '</b> game.</i>';
    if(Dworek.utils.getGameId() == broadcast.game)
        dialogMessage = broadcast.message + '<br><hr><i>This broadcast was send by the host of this game.</i>';

    // Define the actions for the dialog
    var actions = [];

    // Create a function to show the dialog
    const _showDialog = function() {
        showDialog({
            title: 'Broadcast',
            message: dialogMessage,
            actions: actions
        }, function(value) {
            // Remove the broadcast from the broadcast queue
            var removeIndex = -1;
            broadcastQueue.forEach(function(queuedBroadcast, i) {
                if(queuedBroadcast.token == broadcast.token)
                    removeIndex = i;
            });
            if(removeIndex >= 0)
                broadcastQueue.splice(removeIndex, 1);

            // Don't show the postponed notification if the broadcast was resolved, or if the game is viewed
            if(value === false)
                return;

            // Show the postponed notification
            showNotification('Broadcast postponed', {
                action: {
                    text: 'View',
                    action: function() {
                        setTimeout(function() {
                            _showDialog();
                        }, 500);
                    }
                }
            })
        });

        // Vibrate
        vibrate([500, 250, 1000]);
    };

    // Add a 'view game' action if we're currently not viewing the game
    if(Dworek.utils.getGameId() != broadcast.game)
        actions.push({
            text: 'View game',
            value: false,
            action: function() {
                Dworek.utils.navigateToPath('/game/' + broadcast.game);
            }
        });

    // Add the mark as read button
    actions.push({
        text: 'Mark as read',
        value: false,
        icon: 'zmdi zmdi-check',
        state: 'primary',
        action: function() {
            // Send a broadcast resolve packet
            Dworek.realtime.packetProcessor.sendPacket(PacketType.BROADCAST_RESOLVE, {
                token: broadcast.token
            });
        }
    });

    // Add the postpone button
    actions.push({
        text: 'Postpone',
        icon: 'zmdi zmdi-time-restore'
    });

    // Show the dialog
    _showDialog();
}

// Broadcast
Dworek.realtime.packetProcessor.registerHandler(PacketType.BROADCAST_MESSAGE, function(packet) {
    // Make sure a message has been set
    if(!packet.hasOwnProperty('token') && !packet.hasOwnProperty('message'))
        return;

    // Determine whether a broadcast with this token is already queued, and replace it in that case
    var alreadyQueued = false;
    broadcastQueue.forEach(function(entry, i) {
        if(entry.token == packet.token) {
            broadcastQueue[i] = entry;
            alreadyQueued = true;
        }
    });

    // Add the broadcast to the queue if it wasn't queued yet
    if(!alreadyQueued)
        broadcastQueue.push(packet);

    // Show the next queued broadcast if no dialog is shown
    if(!isDialogVisible())
        showNextBroadcast();
});

// Update the game info
Dworek.realtime.packetProcessor.registerHandler(PacketType.GAME_INFO, function(packet) {
    // Make sure the packet contains the required properties
    if(!packet.hasOwnProperty('game') || !packet.hasOwnProperty('stage') || !packet.hasOwnProperty('roles'))
        return;

    // Get the packet data
    const gameId = packet.game;
    const stage = packet.stage;
    const roles = packet.roles;

    // TODO: Invalidate game related page cache!

    // Make sure the game ID equals our currently active game, ignore this packet if that's not the case
    if(Dworek.state.activeGame != gameId || Dworek.state.activeGame == null)
        return;

    // Determine the roles changed
    var rolesChanged = Dworek.state.activeGameRoles == null;
    if(!rolesChanged) {
        rolesChanged = Dworek.state.activeGameRoles.player != roles.player ||
            Dworek.state.activeGameRoles.spectator != roles.spectator ||
            Dworek.state.activeGameRoles.special != roles.special ||
            Dworek.state.activeGameRoles.requested != roles.requested;
    }

    // Update the game stage and roles for the user
    Dworek.state.activeGameStage = stage;
    Dworek.state.activeGameRoles = {
        player: roles.player,
        spectator: roles.spectator,
        special: roles.special,
        requested: roles.requested
    };

    // Update the game worker
    Dworek.gameWorker.update();

    // Set the player/everyone following mode if the user roles changed and the user is a player/spectator
    if(rolesChanged) {
        // Focus on points of interest
        setFollowInterests(true, {
            showNotification: false
        });

        // Set the following mode
        if(roles.spectator)
            setFollowEverything(true, {
                showNotification: false
            });
        else if(roles.player)
            setFollowPlayer(true, {
                showNotification: false
            });

        // Focus the map
        focusMap(true);
    }
});

// Game location updates
Dworek.realtime.packetProcessor.registerHandler(PacketType.GAME_LOCATIONS_UPDATE, function(packet) {
    // Make sure a message has been set
    if(!packet.hasOwnProperty('game'))
        return;

    // Make sure the map data is for the current game
    if(Dworek.utils.getGameId() != packet.game) {
        console.log('Received location data for inactive game, ignoring...');
        return;
    }

    // Check whether this packet contains specific data
    const hasUsers = packet.hasOwnProperty('users');
    const hasFactories = packet.hasOwnProperty('factories');

    // Show a notification
    console.log('Received location data (users: ' + (hasUsers ? packet.users.length : 0) + ', factories: ' + (hasFactories ? packet.factories.length : 0) + ')');

    // Update the users locations
    if(hasUsers)
        updatePlayerMarkers(packet.users);

    // Update the factory locations
    if(hasFactories)
        updateFactoryMarkers(packet.factories);

    // Focus on everything if enabled, also focus on everything if we should focus on the player, but no player is available
    if(getFollowPlayer() || getFollowEverything() || (getFollowPlayer() && playerMarker == null))
        focusMap(true);
});

// Update the active game and status labels when a new page is being shown
$(document).bind("pageshow", function() {
    // Update the active game
    updateActiveGame();

    // Check whether we're on a game page
    if(Dworek.utils.isGamePage()) {
        // Get the ID of the current active game
        var gameId = Dworek.utils.getGameId();

        // Request the language object for the game if it isn't available yet
        // on the client
        requestGameLangObjectIfNotAvailable(gameId);
    }
});

/**
 * Show a dialog that we're disconnected for too long.
 */
function showDisconnectedTooLongDialog() {
    // Set the disconnected flag
    Dworek.realtime._disconnected = true;

    // Show the dialog
    //noinspection JSCheckFunctionSignatures
    showDialog({
        title: 'Disconnected',
        message: 'You ' + (Dworek.realtime._connected ? 'we\'re' : 'are') + ' disconnected for too long.<br><br>' +
        'Please refresh the application to make sure everything is up-to-date.',
        actions: [{
            text: 'Refresh',
            state: 'primary',
            icon: 'zmdi zmdi-refresh'
        }]
    }, function() {
        // Redirect a user to a game page if he's on a game related page
        if(Dworek.utils.isGamePage())
            Dworek.utils.navigateToPath('/game/' + Dworek.utils.getGameId());

        else
            // Redirect the user
            Dworek.utils.navigateToPath(getActivePage().data('url'));
    });
}

/**
 * Update the active game.
 * This will ask the user to change the active game, or will change it automatically if the user doens't have an active game.
 */
function updateActiveGame() {
    // Return if we're not logged in
    if(!Dworek.state.loggedIn)
        return;

    // Request new game info if the same game is still active
    if(Dworek.state.activeGame != null && (Dworek.state.activeGame == Dworek.utils.getGameId() || !Dworek.utils.isGamePage()))
        requestGameInfo();

    // Return if we're not on a game page
    if(!Dworek.utils.isGamePage()) {
        Dworek.utils.lastViewedGame = null;
        return;
    }

    // Get the ID of the game page
    const gameId = Dworek.utils.getGameId();

    // Return if the last viewed game is this game
    if(Dworek.state.lastViewedGame == gameId)
        return;

    // Check whether this game is different than the active game
    if(Dworek.state.activeGame != gameId) {
        // Automatically select this as active game if we don't have an active game now
        if(Dworek.state.activeGame === null) {
            // Set the active game
            setActiveGame(gameId);

        } else {
            // Ask the user whether to select this as active game
            showDialog({
                title: 'Change active game',
                message: 'You may only have one active game to play at a time.<br /><br />Would you like to change your active game to this game now?',
                actions: [
                    {
                        text: 'Activate this game',
                        value: true,
                        state: 'primary',
                        icon: 'zmdi zmdi-swap',
                        action: function() {
                            // Set the active game
                            setActiveGame(gameId);
                        }
                    },
                    {
                        text: 'View current game',
                        value: true,
                        icon: 'zmdi zmdi-long-arrow-return',
                        action: function() {
                            // Navigate to the game page
                            Dworek.utils.navigateToPath('/game/' + Dworek.state.activeGame);
                        }
                    },
                    {
                        text: 'Ignore'
                    }
                ]

            }, function() {
                // Show a notification to switch to the active game
                showNotification('Switch to your active game', {
                    action: {
                        text: 'Switch',
                        action: function() {
                            $.mobile.navigate('/game/' + Dworek.state.activeGame, {
                                transition: 'flow'
                            });
                        }
                    }
                });
            });
        }
    }

    // Update the status labels
    updateStatusLabels();

    // Update the last viewed game
    Dworek.state.lastViewedGame = gameId;
}

/**
 * Set the active game of this user.
 *
 * @param gameId Game ID.
 */
function setActiveGame(gameId) {
    // Show a notification if the active game is changing
    if(Dworek.state.activeGame != gameId) {
        // Show a notification
        showNotification('This is now your active game');

        // TODO: Send packet to server to change the user's active game

        // Reset the game stage and user type
        Dworek.state.activeGameStage = null;
        Dworek.state.activeGameRoles = null;
    }

    // Send a request to the server for the latest game info
    requestGameInfo(gameId);

    // Set the active game ID
    Dworek.state.activeGame = gameId;
}

/**
 * Request the latest game info from the server.
 * The game info is fetched and handled asynchronously.
 *
 * @param {string} [gameId] ID of the game to request the info for.
 * The currently active game will be used if no game ID is given.
 */
function requestGameInfo(gameId) {
    // Parse the game ID
    if(gameId == undefined)
        gameId = Dworek.state.activeGame;

    // Skip the request if the game ID is invalid
    if(gameId == undefined)
        return;

    // Send a game info update request
    Dworek.realtime.packetProcessor.sendPacket(PacketType.GAME_INFO_REQUEST, {
        game: gameId
    });
}

/**
 * Get the active jQuery mobile page.
 *
 * @return DOM element of the current page.
 */
function getActivePage() {
    return $.mobile.pageContainer.pagecontainer('getActivePage');
}

/**
 * Unique ID counter, used for generateUniqueId function.
 * @type {number}
 */
var uniqueIdCounter = 0;

/**
 * Generate an unique ID.
 *
 * @param {string} [prefix] Optional ID prefix.
 * @return {string} Unique ID.
 */
function generateUniqueId(prefix) {
    // Create an unique ID
    var id = 'uid-' + ++uniqueIdCounter;

    // Prefix and return
    return prefix != undefined ? prefix + id : id;
}

/**
 * Queue of dialogs to show.
 *
 * @type {Array} Array of objects (options, callback).
 */
var dialogQueue = [];

/**
 * Show a dialog box.
 *
 * @param {Object} options Dialog box configuration.
 * @param {String} [options.title] Dialog box title.
 * @param {String} [options.message] Dialog box message.
 * @param {Array} [options.actions=[]] Array of actions.
 * @param {String} [options.actions.text] Action/button name.
 * @param {String} [options.actions.state='normal'] Action/button visual state, can be normal, primary or warning.
 * @param {String} [options.actions.value=] Value returned through the callback when this action is invoked.
 * @param {String} [options.actions.icon=] Icon classes to show an icon.
 * @param {function} [options.actions.action=] Function to be called when the action is invoked.
 * @param {showDialogCallback} [callback] Called when an action is invoked, or when the popup is closed. First argument will be the action value, or undefined.
 */
function showDialog(options, callback) {
    // Queue the dialog if a dialog is already being shown
    if(isDialogVisible()) {
        dialogQueue.push({options: options, callback: callback});
        return;
    }

    // Create a defaults object
    const defaults = {
        title: 'Popup',
        message: '',
        actions: [{
            text: 'Close'
        }]
    };

    // Merge the options
    options = merge(defaults, options);

    // Get the active page, generate an unique popup and button list ID
    const activePage = getActivePage();
    const popupId = generateUniqueId('popup-');
    const buttonListId = generateUniqueId('button-list-');

    // Create a flag to determine whether we called back
    var calledBack = false;

    // Set up the native notifications
    var nativeNotification = null;
    hasNotificationPermission(function(err, permission) {
        // Show errors
        if(err !== null)
            console.error('Notification permission check error: ' + err);

        // Return if we don't have permission or if we already called back
        if(!permission || calledBack || !isFirefox())
            return;

        // Build and show the native notification
        nativeNotification = new Notification('Dworek', {
            body: 'Popup: ' + options.title
        });
    });

    // Build the HTML for the popup
    var popupHtml =
        '<div id="' + popupId + '" data-role="popup">' +
        '    <div data-role="header">' +
        '        <a href="#" class="ui-btn ui-btn-left wow fadeIn" data-rel="back" data-direction="reverse" data-wow-delay="0.4s">' +
        '            <i class="zmdi zmdi-close"></i>' +
        '        </a>' +
        '        <h1 class="nd-title wow fadeIn">' + options.title + '</h1>' +
        '    </div>' +
        '    <div data-role="content" class="ui-content" role="main">' +
        '        <p>' + options.message + '</p>' +
        '        <br />' +
        '        <div id="' + buttonListId + '" class="button-list"></div>' +
        '    </div>' +
        '</div>';

    // Append the popup HTML to the active page
    activePage.append(popupHtml);

    // Get the popup and button list DOM element
    const popupElement = activePage.find('#' + popupId);
    const buttonListElement = $('#' + buttonListId);

    // Set the popup width before it's shown
    popupElement.on('popupbeforeposition', function() {
        popupElement.css('width', Math.min($(window).width() - 15 * 2, 430));
    });

    // Destroy the popup when it's closed
    popupElement.on('popupafterclose', function() {
        // Destroy the popup element
        popupElement.remove();

        // Call back, if we didn't do that yet
        if(!calledBack) {
            if(callback !== undefined)
                callback();
            if(nativeNotification !== null)
                nativeNotification.close();
            calledBack = true;
        }

        // Show any queued dialog
        if(dialogQueue.length > 0) {
            // Get the dialog data
            const dialogData = dialogQueue[0];

            // Shift the dialog queue
            dialogQueue.shift();

            // Call the show dialog function
            showDialog(dialogData.options, dialogData.callback);

        } else
            // No dialog to show anymore, show the next queued broadcast if there is any
            showNextBroadcast();
    });

    // Build and open the popup
    popupElement.popup();
    popupElement.popup('open', {
        transition: Dworek.state.animate ? 'pop' : 'none',
        shadow: true,
        positionTo: 'window'
    }).trigger('create');

    // Loop through all the actions
    options.actions.forEach(function(action) {
        // Create the button defaults
        const buttonDefaults = {
            text: 'Button',
            value: undefined,
            state: 'normal'
        };

        // Merge the action with the defaults
        action = merge(buttonDefaults, action);

        // Create the button
        var button = $('<a>', {
            html: action.text
        }).buttonMarkup({
            inline: false,
            shadow: false
        });

        // Set the button text
        if(action.icon != undefined)
            button.html('<i class="' + action.icon + '"></i>&nbsp;&nbsp;' + button.html());

        // Add a button state
        if(action.state == 'primary')
            button.addClass('clr-primary');
        else if(action.state == 'warning')
            button.addClass('clr-warning');

        // Bind the click event to the button
        button.bind('click', function(event) {
            // Prevent the default action
            event.preventDefault();

            // Close the popup
            popupElement.popup('close');

            // Call the button action if any is set
            if(typeof action.action === 'function')
                action.action();

            // Call back if we didn't call back yet
            if(!calledBack) {
                if(callback !== undefined)
                    callback(action.value);
                if(nativeNotification !== null)
                    nativeNotification.close();
                calledBack = true;
            }
        });

        // Append the button to the popup
        button.appendTo(buttonListElement);
    });

    // Rebuild native droid
    nativeDroid.build(true);
}

/**
 * Called when a dialog action is invoked, or when the dialog is closed.
 * This call back is only called once per dialog.
 * If the dialog is closed without implicitly invoking a specified action
 * (for example, when the user closes it using the dedicated dialog close button)
 * undefined is returned as value.
 *
 * @callback showDialogCallback
 * @param {*} Value of the invoked action. The value will be undefined if no action was explicitly invoked,
 * or if the action doesn't have a value assigned.
 */

/**
 * Determine whether there's any dialog shown on the page.
 */
function isDialogVisible() {
    return getActivePage().find('.ui-popup-container').not('.ui-popup-hidden').length > 0;
}

/**
 * Show a notification as configured.
 * This function can be used to show in-page toast, or native notifications.
 *
 * @param {string} message Message to show in the notification.
 * @param {Object} [options] Notification options object.
 * @param {boolean} [options.toast=true] True to show an in-page toast notification, false if not.
 * @param {boolean} [options.native=false] True to show a native notification if supported, false if not.
 * @param {boolean} [options.vibrate=false] True to vibrate the user's device if supported, false if not.
 * @param {Array} [options.vibrationPattern=[500, 250, 500]] Array with vibration pattern timings in milliseconds.
 * @param {Number} [options.ttl=6000] Notification time to live in milliseconds, if supported.
 * @param {Array} [options.actions] Array of actions to show on the notification, if supported.
 * @param {String} [options.actions.text] Action name.
 * @param {function} [options.actions.action=] Action function.
 */
// TODO: Make vibrations configurable
// TODO: Implement native notifications
// TODO: Make action buttons configurable
// TODO: Add option to show an error notification (which has a red background or something)
function showNotification(message, options) {
    // Default options
    var defaultOptions = {
        toast: true,
        native: false,
        vibrate: false,
        vibrationPattern: [500, 250, 500],
        ttl: 6000
    };

    // Set the default options parameter
    if(options === undefined)
        options = {};

    // Merge the options with the default options
    options = merge(defaultOptions, options);

    // Parse the vibration pattern option if set
    if(!Array.isArray(options.vibrationPattern))
        options.vibrationPattern = [options.vibrationPattern];

    // Print the message to the console
    console.log(message);

    // Show a toast notification
    if(options.toast) {
        // Create an array of actions to show on the notification
        var notificationAction = {
            title: "Close",
            fn: function() {},
            color: 'lime'
        };

        // Parse the actions if set, use a default action if not
        if(options.action !== undefined)
            // Create an action object, and add it to the array
            notificationAction = {
                title: options.action.text,
                fn: options.action.action || function() {},
                color: 'lime'
            };

        // Show the toast notification
        new $.nd2Toast({
            message: message,
            action: notificationAction,
            ttl: options.ttl
        });
    }

    // Vibrate the phone
    if(options.vibrate)
        vibrate(options.vibrationPattern);
}

/**
 * Vibrate.
 * @param {Array} [pattern] Vibration pattern. Array of values, alternating vibration time, and pause time in milliseconds.
 */
function vibrate(pattern) {
    // Make sure we have vibration support
    if(!("vibrate" in navigator))
        return;

    // Parse the pattern
    if(pattern === null || pattern === undefined)
        pattern = [500, 250, 500];

    // Vibrate
    window.navigator.vibrate(pattern);
}

/**
 * Determine whether the client has support for native notifications.
 * The client asks for permission if it's supported, but no permission has been granted yet.
 *
 * @param {hasNativeNotificationSupportCallback} [callback] Called back with the result, or when an error occurred Called back with the result.
 */
function hasNativeNotificationSupport(callback) {
    // Make sure the native API is available
    if (!('Notification' in window)) {
        if(typeof callback === 'function')
            callback(false);
        return;
    }

    // Supported if permissions are granted
    if (Notification.permission === 'granted') {
        if(typeof callback === 'function')
            callback(true);
        return;
    }

    // Not supported if the user explicitly clicked deny
    if (Notification.permission === 'denied') {
        if(typeof callback === 'function')
            callback(false);
        return;
    }

//    // Ask the user for permission
//    Notification.requestPermission(function(permission) {
//        if(typeof callback === 'function')
//            callback(permission === 'granted');
//    });
}

/**
 * Called back with the result.
 *
 * @callback hasNativeNotificationSupportCallback
 * @param {boolean} True if native notifications are supported, and can be used. False if not.
 */

///**
// * Show a native notification to the user.
// * Currently only supported by a selected number of browsers.
// *
// * @param {string} message Message to show.
// * @param {boolean} [fallback=true] True to fallback to in-page notifications if native notifications don't work.
// */
//function showNativeNotification(message, fallback) {
//    // Make sure the notifications are supported, and that the user granted permission
//    hasNativeNotificationSupport(function(result) {
//        // Make sure notifications are supported
//        if(result) {
//            // Show the actual notification, and return
//            new Notification(message);
//            return;
//        }
//
//        // Return if no fallback notification should be used
//        if(fallback !== undefined && !fallback)
//            return;
//
//        // Show a fallback notification
//        showNotification(message, {
//            title: 'Message'
//        });
//    });
//}

// Nickname randomization
$(document).bind("pageinit", function() {
    // Get the elements
    const nicknameField = $('#field-nickname');
    const nicknameRandomizeButton = $('.nickname-random-btn');

    /**
     * Set the nickname field to a random nickname.
     */
    function setRandomNickname() {
        if(Dworek.state.animate) {
            const animationClass = 'animated';
            const animationTypeClass = 'bounceInLeft';

            // Remove animation classes from previous times
            if(nicknameField.hasClass(animationTypeClass))
                nicknameField.removeClass(animationTypeClass);

            // Animate the text field and set a random nickname next tick
            setTimeout(function() {
                nicknameField.addClass(animationClass + ' ' + animationTypeClass);
                nicknameField.val(getRandomNickname());
            }, 1);
        } else {
            nicknameField.val(getRandomNickname());
        }
    }

    // Check whether we should randomize on page creation
    if(nicknameField.data('randomize'))
        setRandomNickname();

    // Randomize the nickname on random button click
    nicknameRandomizeButton.click(function(e) {
        // Prevent the default action
        e.preventDefault();

        // Put a random nickname in the field
        setRandomNickname();
    });
});

// User role modification
$(document).bind("pageinit", function() {
    // Get the elements
    const buttonChangeRoles = $('.action-change-user-roles');
    const popup = $('#popupChangeUserRole');
    const checkboxNamePrefix = 'checkbox-user-';
    const checkboxSelector = 'input[type=checkbox][name^=' + checkboxNamePrefix + ']';
    const checkboxSelectedSelector = checkboxSelector + ':checked';
    const checkboxSelectorUser = function(userId) {
        return 'input[type=checkbox][name=' + checkboxNamePrefix + userId.trim() + ']';
    };
    const popupTeamSelector = 'select[name=field-team]';
    const popupSpecialSelector = 'select[name=field-special]';
    const popupSpectatorSelector = 'select[name=field-spectator]';
    const userListSelector = '.user-list';

    // Handle button click events
    buttonChangeRoles.click(function(e) {
        // Prevent the default click operation
        e.preventDefault();

        // Find the user checkboxes on the page that is currently active
        const checkboxes = getActivePage().find(checkboxSelectedSelector);

        // Show a warning if no user is selected
        if(checkboxes.length === 0) {
            showNotification('Please select the users to change', {
                toast: true,
                native: false,
                vibrate: true,
                vibrationPattern: 50
            });
            return;
        }

        // Create a list of user IDs
        var userIds = [];

        // Loop through all checkboxes and put the user ID in the list
        checkboxes.each(function() {
            userIds.push($(this).attr('name').replace(checkboxNamePrefix, '').trim());
        });

        // Open the user dialog
        popup.popup('open', {
            transition: 'pop'
        });

        // Find the apply button of the popup
        const applyButton = popup.find('.action-apply');

        // Unbind the previous click event, and bind a new one
        applyButton.unbind('click');
        applyButton.click(function(e) {
            // Prevent the default action
            e.preventDefault();

            // Get the team, special and spectator fields
            const teamField = popup.find(popupTeamSelector);
            const specialField = popup.find(popupSpecialSelector);
            const spectatorField = popup.find(popupSpectatorSelector);

            // Get the game
            const gameId = Dworek.utils.getGameId();

            // Get the team selector value
            const teamValue = teamField.val();

            // Determine whether the users will be special players and/or spectators
            const special = specialField.val() == 'true';
            const spectator = spectatorField.val() == 'true';

            // Create an role change object to send to the server
            const updateObject = {
                game: gameId,
                users: userIds,
                role: {
                    team: teamValue,
                    special: special,
                    spectator: spectator
                }
            };

            // Disable all checkboxes for the selected users
            checkboxes.each(function() {
                $(this).parent().addClass('ui-disabled');
            });

            // Disable the change roles button
            buttonChangeRoles.addClass('ui-disabled');

            // Callback on error
            const onError = function(message) {
                // Define the error message
                if(typeof message !== 'string')
                    message = 'Failed to change user roles';
                const errorMessage = 'Error: ' + message;

                // Show an error notification
                showNotification(errorMessage, {
                    toast: true,
                    native: false,
                    vibrate: true
                });

                // Revert the checkbox states
                userIds.forEach(function(userId) {
                    // Find it's checkbox
                    const checkbox = getActivePage().find(checkboxSelectorUser(userId));

                    // Enable the checkbox
                    checkbox.parent().removeClass('ui-disabled');
                });

                // Enable the change roles button
                buttonChangeRoles.removeClass('ui-disabled');
            };

            // Do an request to change the user roles
            $.ajax({
                type: "POST",
                url: '/ajax/user/changeRoles',
                data: {
                    data: JSON.stringify(updateObject)
                },
                dataType: 'json',
                success: function(data) {
                    // Show an error message if any kind of error occurred
                    if(data.status != 'ok' || data.hasOwnProperty('error')) {
                        onError(typeof data.error.message === 'string' ? data.error.message : undefined);
                        return;
                    }

                    // Get the list of updated users
                    const updatedUsers = data.updatedUsers;
                    const updatedUsersCount = updatedUsers.length;

                    // Show an error notification
                    showNotification('Changed roles for ' + updatedUsersCount + ' user' + (updatedUsersCount != 1 ? 's' : ''), {
                        toast: true,
                        native: false,
                        vibrate: true,
                        vibrationPattern: 50
                    });

                    // Loop through the list of updated users and remove their checkboxes
                    updatedUsers.forEach(function(userId) {
                        // Find it's checkbox
                        const checkbox = getActivePage().find(checkboxSelectorUser(userId));

                        // Remove the parent checkbox from the page
                        checkbox.parent().remove();
                    });

                    // Loop through the original list of user IDs
                    userIds.forEach(function(userId) {
                        // Check whether this user ID hasn't been covered
                        if(updatedUsers.indexOf(userId) !== -1)
                            return;

                        // Find it's checkbox
                        const checkbox = getActivePage().find(checkboxSelectorUser(userId));

                        // Enable the checkbox
                        checkbox.parent().removeClass('ui-disabled');
                    });

                    // Enable the change roles button
                    buttonChangeRoles.removeClass('ui-disabled');

                    // Count the number of users that is left in the list
                    const usersLeft = getActivePage().find(checkboxSelector).length;

                    // Show a information label if the list is empty
                    if(usersLeft === 0)
                        getActivePage().find(userListSelector).append('<p class="wow fadeInUp no-users">' +
                            '    <i>No users here...</i>' +
                            '</p>');

                    // Flush the other game pages
                    Dworek.utils.flushPages(new RegExp('^\\/game\\/' + Dworek.utils.getGameId()), false);
                },
                error: onError
            });

            // Close the popup
            popup.popup('close');
        });
    });
});

// Team creation
$(document).bind("pageinit", function() {
    // Get the elements
    const buttonCreateTeam = $('.action-create-team');
    const popup = $('#popupCreateTeam');
    const popupTeamNameField = 'input[name=field-team-name]';
    const teamListSelector = '.team-list';
    const noTeamLabelSelector = '.no-teams';

    // Handle button click events
    buttonCreateTeam.click(function(e) {
        // Prevent the default click operation
        e.preventDefault();

        // Open the team creation dialog
        popup.popup('open', {
            transition: 'pop'
        });

        // Find the create button of the popup
        const createButton = popup.find('.action-create');

        // Unbind the previous click event, and bind a new one
        createButton.unbind('click');
        createButton.click(function(e) {
            // Prevent the default action
            e.preventDefault();

            // Get the team name
            const teamField = popup.find(popupTeamNameField);

            // Get the game ID
            const gameId = Dworek.utils.getGameId();

            // Get the team selector value
            const teamName = teamField.val();

            // Create an object to send to the server
            const createObject = {
                game: gameId,
                teamName: teamName
            };

            // Disable the create team button
            buttonCreateTeam.addClass('ui-disabled');

            // Callback on error
            const onError = function(message) {
                // Define the error message
                if(typeof message !== 'string')
                    message = 'Failed to create team';
                const error = 'Error: ' + message;

                // Show an error notification
                showNotification(error, {
                    toast: true,
                    native: false,
                    vibrate: true
                });

                // Enable the create team button
                buttonCreateTeam.removeClass('ui-disabled');
            };

            // Do an request to create the team
            $.ajax({
                type: "POST",
                url: '/ajax/team/createTeam',
                data: {
                    data: JSON.stringify(createObject)
                },
                dataType: 'json',
                success: function(data) {
                    // Show an error message if any kind of error occurred
                    if(data.status != 'ok' || data.hasOwnProperty('error')) {
                        onError(typeof data.error.message === 'string' ? data.error.message : undefined);
                        return;
                    }

                    // Show an error notification
                    showNotification('Team created successfully!', {
                        toast: true,
                        native: false,
                        vibrate: true,
                        vibrationPattern: 50
                    });

                    // Get the ID of the created team
                    var teamId = data.team;

                    // Append the team to the team list
                    // TODO: Append team ID here
                    getActivePage().find(teamListSelector).append('<div class="wow fadeInUp">' +
                        '    <input type="checkbox" name="checkbox-team-' + teamId + '" id="checkbox-team-' + teamId + '">' +
                        '    <label for="checkbox-team-' + teamId + '">' + teamName + '</label>' +
                        '</div>');

                    // Remove the no teams label if it exists
                    getActivePage().find(noTeamLabelSelector).remove();

                    // Trigger page creation, to properly style the new checkbox
                    getActivePage().trigger('create');

                    // Enable the create team button
                    buttonCreateTeam.removeClass('ui-disabled');

                    // Flush the other game pages
                    Dworek.utils.flushPages(new RegExp('^\\/game\\/' + Dworek.utils.getGameId()), false);
                },
                error: onError
            });

            // Close the popup
            popup.popup('close');
        });
    });
});

// Team deletion
$(document).bind("pageinit", function() {
    // Get the elements
    const buttonDeleteSelected = $('.action-delete-selected');
    const checkboxNamePrefix = 'checkbox-team-';
    const checkboxSelector = 'input[type=checkbox][name^=' + checkboxNamePrefix + ']';
    const checkboxSelectedSelector = checkboxSelector + ':checked';
    const checkboxSelectorUser = function(userId) {
        return 'input[type=checkbox][name=' + checkboxNamePrefix + userId.trim() + ']';
    };
    const teamListSelector = '.team-list';

    // Handle button click events
    buttonDeleteSelected.click(function(e) {
        // Prevent the default click operation
        e.preventDefault();

        // Find the user checkboxes on the page that is currently active
        const checkboxes = getActivePage().find(checkboxSelectedSelector);

        // Show a warning if no user is selected
        if(checkboxes.length == 0) {
            showNotification('Please select the teams to delete', {
                toast: true,
                native: false,
                vibrate: true,
                vibrationPattern: 50
            });
            return;
        }

        // Create a list of team IDs
        var teamIds = [];

        // Loop through all checkboxes and put the team ID in the list
        checkboxes.each(function() {
            teamIds.push($(this).attr('name').replace(checkboxNamePrefix, '').trim());
        });

        // Define the delete action
        const deleteAction = function() {
            // Get the game field, and the current game ID
            const gameId = Dworek.utils.getGameId();

            // Create an team delete object to send to the server
            const updateObject = {
                game: gameId,
                teams: teamIds
            };

            // Disable all checkboxes for the selected teams
            checkboxes.each(function() {
                $(this).parent().addClass('ui-disabled');
            });

            // Disable the delete selected button
            buttonDeleteSelected.addClass('ui-disabled');

            // Callback on error
            const onError = function(message) {
                // Define the error message
                if(typeof message !== 'string')
                    message = 'Failed to delete teams';
                const error = 'Error: ' + message;

                // Show an error notification
                showNotification(error, {
                    toast: true,
                    native: false,
                    vibrate: true
                });

                // Revert the checkbox states
                teamIds.forEach(function(teamId) {
                    // Find it's checkbox
                    const checkbox = getActivePage().find(checkboxSelectorUser(teamId));

                    // Enable the checkbox
                    checkbox.parent().removeClass('ui-disabled');
                });

                // Enable the delete selected button
                buttonDeleteSelected.removeClass('ui-disabled');
            };

            // Do an request to change the user roles
            $.ajax({
                type: "POST",
                url: '/ajax/team/deleteTeam',
                data: {
                    data: JSON.stringify(updateObject)
                },
                dataType: 'json',
                success: function(data) {
                    // Show an error message if any kind of error occurred
                    if(data.status != 'ok' || data.hasOwnProperty('error')) {
                        onError(typeof data.error.message === 'string' ? data.error.message : undefined);
                        return;
                    }

                    // Get the list of updated teams
                    const deletedTeams = data.deletedTeams;
                    const deletedTeamCount = deletedTeams.length;

                    // Show an error notification
                    showNotification('Deleted ' + deletedTeamCount + ' team' + (deletedTeamCount != 1 ? 's' : ''), {
                        toast: true,
                        native: false,
                        vibrate: true,
                        vibrationPattern: 50
                    });

                    // Loop through the list of deleted teams and remove their checkboxes
                    deletedTeams.forEach(function(teamId) {
                        // Find it's checkbox
                        const checkbox = getActivePage().find(checkboxSelectorUser(teamId));

                        // Remove the parent checkbox from the page
                        checkbox.parent().remove();
                    });

                    // Loop through the original list of team IDs
                    teamIds.forEach(function(teamId) {
                        // Check whether this team ID hasn't been covered
                        if(deletedTeams.indexOf(teamId) !== -1)
                            return;

                        // Find it's checkbox
                        const checkbox = getActivePage().find(checkboxSelectorUser(teamId));

                        // Enable the checkbox
                        checkbox.parent().removeClass('ui-disabled');
                    });

                    // Enable the delete selected button
                    buttonDeleteSelected.removeClass('ui-disabled');

                    // Count the number of teams that is left in the list
                    const teamsLeft = getActivePage().find(checkboxSelector).length;

                    // Show a information label if the list is empty
                    if(teamsLeft === 0)
                        getActivePage().find(teamListSelector).append('<p class="wow fadeInUp no-teams">' +
                            '    <i>No teams here...</i>' +
                            '</p>');

                    // Flush the other game pages
                    Dworek.utils.flushPages(new RegExp('^\\/game\\/' + Dworek.utils.getGameId()), false);
                },
                error: onError
            });
        };

        // Show the dialog box
        showDialog({
            title: 'Delete team',
            message: 'Are you sure you want to delete the selected teams?',
            actions: [
                {
                    text: 'Delete',
                    icon: 'zmdi zmdi-delete',
                    state: 'warning',
                    action: deleteAction
                },
                {
                    text: 'Cancel'
                }
            ]
        });
    });
});

// Game state buttons
$(document).bind("pagecreate", function() {
    // Find the game state buttons
    const startGameButton = $('.action-game-start');
    const stopGameButton = $('.action-game-stop');
    const resumeGameButton = $('.action-game-resume');

    // Define the start action
    const gameStartAction = function() {
        // Set the active game of the user to the current if the user is on a game page
        if(Dworek.utils.isGamePage())
            setActiveGame(Dworek.utils.getGameId());

        // Send a game starting packet to the server
        Dworek.realtime.packetProcessor.sendPacket(PacketType.GAME_STAGE_CHANGE, {
            game: Dworek.utils.getGameId(),
            stage: 1
        });
    };

    // Define the stop action
    const gameStopAction = function() {
        // Send a game stopping packet to the server
        Dworek.realtime.packetProcessor.sendPacket(PacketType.GAME_STAGE_CHANGE, {
            game: Dworek.utils.getGameId(),
            stage: 2
        });
    };

    // Define the resume action
    const gameResumeAction = function() {
        // Set the active game of the user to the current if the user is on a game page
        if(Dworek.utils.isGamePage())
            setActiveGame(Dworek.utils.getGameId());

        // Send a game starting packet to the server
        Dworek.realtime.packetProcessor.sendPacket(PacketType.GAME_STAGE_CHANGE, {
            game: Dworek.utils.getGameId(),
            stage: 1
        });
    };

    // Bind a game start button
    startGameButton.unbind('click');
    startGameButton.click(function(e) {
        // Prevent the default action
        e.preventDefault();

        // Show a dialog, and ask whether the user is sure
        showDialog({
            title: 'Start game',
            message: 'Are you sure you want to start the game?',
            actions: [
                {
                    text: 'Start game',
                    icon: 'zmdi zmdi-play',
                    state: 'primary',
                    action: gameStartAction
                },
                {
                    text: 'Cancel'
                }
            ]
        });
    });

    // Bind a game stop button
    stopGameButton.unbind('click');
    stopGameButton.click(function(e) {
        // Prevent the default action
        e.preventDefault();

        // Show a dialog, and ask whether the user is sure
        showDialog({
            title: 'Finish game',
            message: 'Are you sure you want to stop and finish this game?',
            actions: [
                {
                    text: 'Finish game',
                    icon: 'zmdi zmdi-stop',
                    state: 'warning',
                    action: gameStopAction
                },
                {
                    text: 'Cancel'
                }
            ]
        });
    });

    // Bind a game resume button
    resumeGameButton.unbind('click');
    resumeGameButton.click(function(e) {
        // Prevent the default action
        e.preventDefault();

        // Show a dialog, and ask whether the user is sure
        showDialog({
            title: 'Resume game',
            message: 'Are you sure you want to resume the game from the current state?',
            actions: [
                {
                    text: 'Resume game',
                    icon: 'zmdi zmdi-fast-forward',
                    state: 'primary',
                    action: gameResumeAction
                },
                {
                    text: 'Cancel'
                }
            ]
        });
    });
});

// Broadcast button
$(document).bind("pagecreate", function() {
    // Find the broadcast button
    const broadcastButton = $('.action-broadcast');

    broadcastButton.unbind('click');
    broadcastButton.click(function(event) {
        // Prevent the event
        event.preventDefault();

        // Get a random ID for the message field
        const fieldId = generateUniqueId('field');

        // Show a dialog, and ask whether the user is sure
        showDialog({
            title: 'Broadcast message',
            message: 'Enter a message to broadcast to all users in this game:<br><br>' +
            '<label for="' + fieldId + '">Message</label>' +
            '<input type="text" name="' + fieldId + '" id="' + fieldId + '" value="" data-clear-btn="true" />',
            actions: [
                {
                    text: 'Broadcast message',
                    icon: 'zmdi zmdi-mail-send',
                    state: 'primary',
                    action: function() {
                        // Get the input field
                        const messageField = $('#' + fieldId);

                        // Get the message
                        const message = messageField.val();

                        // Make sure any message is entered
                        if(message.trim().length <= 0) {
                            // Show an error dialog to the user
                            showDialog({
                                title: 'Invalid message',
                                message: 'The message you\'ve entered to broadcast is invalid.',
                                actions: [{
                                        text: 'Close'
                                }]
                            });
                            return;
                        }

                        // Send a packet to the server with the broadcast
                        Dworek.realtime.packetProcessor.sendPacket(PacketType.BROADCAST_MESSAGE_REQUEST, {
                            message: message,
                            game: Dworek.utils.getGameId()
                        });
                    }
                },
                {
                    text: 'Cancel'
                }
            ]
        });
    });
});

/**
 * Check whether the given value is a JavaScript object.
 * Arrays and functions are not considered objects.
 *
 * @param {*} value The value to check.
 * @return {boolean} True if the value is an object, false if not.
 */
// TODO: Move this function to some utilities file
function isObject(value) {
    // Return false if the value is an array
    if(Array.isArray(value))
        return false;

    // Get the value type
    const type = typeof value;

    // Compare the types and return the result
    return !!value && type == 'object';
}

/**
 * Merge an object recursively.
 * Object b overwrites a.
 *
 * @param {Object} a Object A.
 * @param {Object} b Object B, being put onto A.
 * @param {boolean} [recursive=true] True to merge recursively, false to merge flat objects.
 * @return {*} Merged object.
 */
// TODO: Move this function to some utilities section
function merge(a, b, recursive) {
    // Set the default value for the recursive param
    if(recursive === undefined)
        recursive = true;

    // Make sure both objects are given
    if(isObject(a) && isObject(b)) {
        // Loop through all the keys
        for(var key in b) {
            // Make sure B owns the property
            if(!b.hasOwnProperty(key))
                continue;

            // Check whether we should merge two objects recursively, or whether we should merge flag
            if(recursive && isObject(a[key]) && isObject(b[key]))
                a[key] = merge(a[key], b[key], true);
            else
                a[key] = b[key];
        }
    }

    // Return the object
    return a;
}

// Show a device status popup
$(document).bind("pageinit", function() {
    // Find the device status button
    const deviceStatusButton = $('.action-device-status');

    // Bind a click event
    deviceStatusButton.unbind('click');
    deviceStatusButton.click(function(e) {
        // Create the status dialog body
        var statusBody = '<div align="center" class="table-list">' +
            '<table>' +
            '    <tr>' +
            '        <td class="left"><i class="zmdi zmdi-play zmdi-hc-fw"></i> Game</td><td class="status-game-label">Unknown</td>' +
            '    </tr>' +
            '    <tr>' +
            '        <td class="left"><i class="zmdi zmdi-network zmdi-hc-fw"></i> Network</td><td class="status-network-label">Unknown</td>' +
            '    </tr>' +
            '    <tr>' +
            '        <td class="left"><i class="zmdi zmdi-gps-dot zmdi-hc-fw"></i> GPS<br>&nbsp;</td><td class="status-gps-label">Unknown</td>' +
            '    </tr>' +
            '    <tr>' +
            '        <td class="left"><i class="zmdi zmdi-battery zmdi-hc-fw"></i> Battery</td><td class="status-battery-label">Unknown</td>' +
            '    </tr>' +
            '</table>' +
            '</div>';

        // Show a dialog, and ask whether the user is sure
        showDialog({
            title: 'Device status',
            message: statusBody,
            actions: [
                {
                    text: 'Test GPS',
                    action: testGps
                },
                {
                    text: 'Reload application',
                    action: function() {
                        location.reload();
                    }
                },
                {
                    text: 'Close'
                }
            ]
        });

        updateStatusLabels();
    });
});

/**
 * Battery promise instance.
 * @type {Object|null}
 */
var batteryInstance = null;

/**
 * Update all status labels.
 */
function updateStatusLabels() {
    // Check whether we're playing
    var playing = Dworek.gameWorker.active;

    // Make sure the user roles are fetched
    if(Dworek.state.activeGameRoles != null)
        playing = playing & (Dworek.state.activeGameRoles.player || Dworek.state.activeGameRoles.special);
    else
        playing = false;

    // Get the icon and labels
    const statusIcon = $('.status-icon');
    const gameStatusLabel = $('.status-game-label');
    const networkStatusLabel = $('.status-network-label');
    const gpsStatusLabel = $('.status-gps-label');
    const batteryStatusLabel = $('.status-battery-label');

    // Determine whether the user is connected
    const isOnline = !!navigator.onLine;
    const isConnected = Dworek.realtime._connected;

    // Determine whether the user's device has GPS support
    const hasGps = "geolocation" in navigator;

    // Determine whether the user has battery support and get the battery level
    const hasBattery = typeof navigator.getBattery === 'function';
    var batteryLevel = -1;

    // Get the battery instance if available
    if(hasBattery && batteryInstance === null)
        navigator.getBattery().then(function(battery) {
            // Set the battery instance
            batteryInstance = battery;

            // Add an event listener for level change
            battery.addEventListener('levelchange', function() {
                // Update the status labels
                updateStatusLabels();
            });

            // Update the status labels
            updateStatusLabels();
        });
    else if(batteryInstance !== null)
        batteryLevel = Math.round(batteryInstance.level * 100);

    // Set the network status label
    if(!isConnected && !isOnline)
        networkStatusLabel.html('<span style="color: red;">Not online</span>');
    else if(!isConnected)
        networkStatusLabel.html('<span style="color: red;">Online, not connected</span>');
    else
        networkStatusLabel.html('Connected');

    // Set the GPS status label
    if(!hasGps)
        gpsStatusLabel.html('<span style="color: red;">Not supported</span>');
    else if(Dworek.state.geoState == GeoStates.UNKNOWN)
        gpsStatusLabel.html('Supported<br>' + (Dworek.state.geoWatcher !== null ? 'Active' : 'Not active'));
    else if(Dworek.state.geoState == GeoStates.WORKING)
        gpsStatusLabel.html('Working<br>' + (Dworek.state.geoWatcher !== null ? 'Active' : 'Not active'));
    else if(Dworek.state.geoState == GeoStates.NO_PERMISSION)
        gpsStatusLabel.html('<span style="color: red;">No permission<br>' + (Dworek.state.geoWatcher !== null ? 'Active' : 'Not active') + '</span>');
    else if(Dworek.state.geoState == GeoStates.TIMEOUT)
        gpsStatusLabel.html('<span style="color: red;">Timed out<br>' + (Dworek.state.geoWatcher !== null ? 'Active' : 'Not active') + '</span>');
    else if(Dworek.state.geoState == GeoStates.NOT_WORKING)
        gpsStatusLabel.html('<span style="color: red;">Not working<br>' + (Dworek.state.geoWatcher !== null ? 'Active' : 'Not active') + '</span>');
    else if(Dworek.state.geoState == GeoStates.UNKNOWN_POSITION)
        gpsStatusLabel.html('<span style="color: red;">Unknown position<br>' + (Dworek.state.geoWatcher !== null ? 'Active' : 'Not active') + '</span>');

    // Battery the GPS status label
    if(!hasBattery)
        batteryStatusLabel.html('<i>Not supported</i>');
    else if(batteryLevel < 0)
        batteryStatusLabel.html('<i>Unknown</i>');
    else if(batteryLevel <= 10)
        batteryStatusLabel.html('<span style="color: red;">' + batteryLevel + '%</span>');
    else
        batteryStatusLabel.html(batteryLevel + '%');

    // Determine whether there is an error
    var error = !isConnected || !isOnline || !hasGps
        || (Dworek.state.geoState != GeoStates.UNKNOWN && Dworek.state.geoState != GeoStates.WORKING);

    // Set the game status label
    if(error)
        gameStatusLabel.html('<span style="color: red;">Device not functional</span>');
    else
        gameStatusLabel.html(playing ? 'Playing' : 'Ready to play');

    // Update the error state
    error = error || (hasBattery && batteryLevel >= 0 && batteryLevel <= 10);

    // Determine whether to animate the status icon
    const iconAnimate = Dworek.state.animate && playing;
    const iconAnimateDuration = !error ? 10 : 1.5;

    // Set the animation state of the icon
    if(iconAnimate) {
        // Add the animated class
        statusIcon.addClass('animated flash');

        // Update the animation speed
        statusIcon.css({
            animationDuration: iconAnimateDuration + 's'
        });

    } else
        statusIcon.removeClass('animated flash');

    // Set the status icon color
    if(error)
        statusIcon.addClass('mdc-text-red-700');
    else
        statusIcon.removeClass('mdc-text-red-700');

    // Remove the current icons
    statusIcon.removeClass('zmdi-check');
    statusIcon.removeClass('zmdi-play');
    statusIcon.removeClass('zmdi-network-alert');
    statusIcon.removeClass('zmdi-network-off');
    statusIcon.removeClass('zmdi-gps');
    statusIcon.removeClass('zmdi-gps-off');
    statusIcon.removeClass('zmdi-battery-alert');

    // Set the new icon
    if(!isConnected && !isOnline)
        statusIcon.addClass('zmdi-network-off');
    else if(!isConnected)
        statusIcon.addClass('zmdi-network-alert');
    else if(hasBattery && batteryLevel >= 0 && batteryLevel <= 10)
        statusIcon.addClass('zmdi-battery-alert');
    else if(!hasGps || Dworek.state.geoState == GeoStates.NOT_WORKING || Dworek.state.geoState == GeoStates.NO_PERMISSION)
        statusIcon.addClass('zmdi-gps-off');
    else if(playing && (Dworek.state.geoState == GeoStates.UNKNOWN_POSITION || Dworek.state.geoState == GeoStates.TIMEOUT))
        statusIcon.addClass('zmdi-gps');
    else if(playing)
        statusIcon.addClass('zmdi-play');
    else
        statusIcon.addClass('zmdi-check');
}

// Update the status label when the online status changes
$(document).on('offline online', function() {
    updateStatusLabels();
});

/**
 * Test the GPS functionality on this device.
 */
function testGps() {
    // Make sure the user has given permission
    hasRequiredPermissions(function(err, permission) {
        // Show errors
        if(err !== null)
            showError(err);

        // Show the permission checkup dialog if we don't have permission
        if(!permission) {
            showPermissionCheckupDialog();
            return;
        }

        // Show a notification
        showNotification('Testing GPS...');

        // Get the current GPS location
        navigator.geolocation.getCurrentPosition(function(position) {
            // Process the location success callback, don't show an notification
            processLocationSuccess(position, false, true);

            // Show a notification regarding the GPS
            showNotification('Your GPS is working');

        }, function(error) {
            // Process the location error callback
            processLocationError(error, true);

        }, {
            enableHighAccuracy: true
        });
    });
}

/**
 * Process a location success callback.
 *
 * @param {*} position Position object.
 * @param {boolean} [notification=true] True to show a notification if the GPS state has changed,
 * false to show no notification.
 * @param {boolean} [alsoUpdateLocal=true] True to update the location, but only send it to the server.
 * @return {boolean} True if a notification is shown, false if not.
 */
function processLocationSuccess(position, notification, alsoUpdateLocal) {
    // Process the showNotification and update parameter
    if(notification == undefined)
        notification = true;
    if(alsoUpdateLocal == undefined)
        alsoUpdateLocal = true;

    // Set the GPS status
    const gpsStateChanged = false;
    if(alsoUpdateLocal)
        setGpsState(GeoStates.WORKING);

    // Show a GPS success notification if it started working again
    if(notification && gpsStateChanged)
        showNotification('Your location is available', {
            vibrate: true
        });

    // Update the location if a game is active and we have the proper roles
    if(Dworek.state.activeGame !== null && Dworek.state.activeGameStage == 1 && Dworek.state.activeGameRoles.player) {
        // Send a location update to the server if we've an active game
        Dworek.realtime.packetProcessor.sendPacket(PacketType.LOCATION_UPDATE, {
            game: Dworek.state.activeGame,
            location: {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                altitude: position.coords.altitude,
                accuracy: position.coords.accuracy,
                altitudeAccuracy: position.coords.altitudeAccuracy,
            }
        });
    }

    // Update the player position
    if(alsoUpdateLocal && position !== null && position !== undefined)
        updatePlayerPosition(position);

    // Return true if the GPS state changed
    return gpsStateChanged;
}

/**
 * Process a location error callback.
 *
 * @param {*} error Error object.
 * @param {boolean} showErrorDialog True to show an error dialog regarding the error, false to show a simple notification.
 * @return {boolean} True if a notification is shown, false if not.
 */
function processLocationError(error, showErrorDialog) {
    // Determine whether the GPS state changed, and create a GPS state variable
    var gpsState = GeoStates.UNKNOWN;

    // Set GPS states depending on the error
    if(error.code == error.PERMISSION_DENIED)
        gpsState = GeoStates.NO_PERMISSION;
    else if(error.code == error.POSITION_UNAVAILABLE)
        gpsState = GeoStates.UNKNOWN_POSITION;
    else if(error.code == error.TIMEOUT)
        gpsState = GeoStates.TIMEOUT;
    else if(error.code == error.UNKNOWN_ERROR)
        gpsState = GeoStates.NOT_WORKING;

    // Set the GPS state
    const gpsStateChanged = setGpsState(gpsState);

    // Create a variable that contains the return value
    var returnValue = false;

    // Show an error if the showDialogError parameter is set to true
    if(showErrorDialog) {
        // Define the message to show to the user
        var dialogMessage = 'We were unable to determine your location.<br><br>' +
            'Please make sure the location functionality and GPS is enabled on your device.<br><br>' +
            'It might take a while for your device to determine your location. ' +
            'Please keep testing your GPS until your location is found.';


        // Handle the permission denied error
        if(error.code == error.PERMISSION_DENIED)
            dialogMessage = __('app.name') + ' doesn\'t have permission to use your device\'s location.<br><br>' +
                'Please allow this application to use your location and test your GPS again.';

        // Handle the position unavailable error
        else if(error.code == error.POSITION_UNAVAILABLE)
            dialogMessage = 'The location of your device is currently unknown.<br><br>' +
                'It might take a while for your device to determine your location.' +
                'Please test your GPS again until your location is found.<br><br>' +
                'Note: Your device\'s location service and GPS must be enabled.';

        // Handle the timeout error
        else if(error.code == error.TIMEOUT)
            dialogMessage = 'The location of your device couldn\'t be found in time.<br><br>' +
                'You device might temporarily be having trouble determining your location using satellite,' +
                'this problem usually resolves itself after a while.<br><br>' +
                'Please keep testing your GPS until your location is found.<br><br>' +
                'Note: Your device\'s location service and GPS must be enabled.';

        // Show a dialog
        showDialog({
            title: 'GPS error',
            message: dialogMessage,
            actions: [
                {
                    text: 'Test GPS again',
                    state: 'primary',
                    action: testGps
                },
                {
                    text: 'Ignore'
                }
            ]
        });

        // Set the return value
        returnValue = true;

    } else if(gpsStateChanged) {
        // Define the notification message
        var notificationMessage = 'Your location is unknown';

        // Handle the permission denied error
        if(error.code == error.PERMISSION_DENIED)
            notificationMessage = 'No permission for your location';

        // Handle the position unavailable error
        else if(error.code == error.POSITION_UNAVAILABLE)
            notificationMessage = 'Your location is unknown';

        // Handle the timeout error
        else if(error.code == error.TIMEOUT)
            notificationMessage = 'Your location timed out';

        // Show a notification
        showNotification('Error: ' + notificationMessage, {
            action: {
                text: 'Test GPS',
                action: testGps
            },
            vibrate: true,
            ttl: 8000
        });

        // Set the return value
        returnValue = true;
    }

    // Reset the last location if the error isn't a timeout
    if(error.code != error.TIMEOUT)
        Dworek.state.geoPlayerPosition = null;

    // Update the player marker
    updatePlayerMarker();

    // Return the return value
    return returnValue;
}

/**
 * Function to use as geo watcher fallback.
 */
function doLocationFallback() {
    // Make sure we've any known last location
    if(Dworek.state.geoPlayerPosition == null)
        return;

    // Process the last known location, don't update locally
    processLocationSuccess(Dworek.state.geoPlayerPosition, false, false);

    // Get the current position
    navigator.geolocation.getCurrentPosition(function(position) {
        // Process the success callback
        processLocationSuccess(position, true, true);

    }, function(error) {
        // Show an error message
        console.error('Failed to fetch position in location watcher fallback (ignoring): ' + error.message);

    }, {
        enableHighAccuracy: true,
        timeout: 10 * 1000,
        maximumAge: 10 * 1000
    });
}

/**
 * Set the GPS state.
 *
 * @param state GPS state.
 * @return {boolean} True if the GPS state has changed, false if not.
 */
function setGpsState(state) {
    // Make sure the state changes
    if(Dworek.state.geoState === state)
        return false;

    // Set the state
    Dworek.state.geoState = state;

    // Update the status labels
    updateStatusLabels();

    // Return true since we've changed the status
    return true;
}

/**
 * Map instance.
 */
var map = null;

/**
 * Current player marker instance.
 */
var playerMarker = null;

/**
 * Other players' instances.
 */
var playersMarkers = [];

/**
 * Visible factory markers.
 */
var factoryMarkers = [];

/**
 * Button to toggle to follow the current player.
 */
var mapFollowPlayerButton = null;

/**
 * Button to toggle to follow the points of interest.
 */
var mapFollowInterestsButton = null;

/**
 * Button to toggle to follow everything.
 */
var mapFollowEverythingButton = null;

/**
 * True to follow the points of interest.
 */
var followInterests = false;

/**
 * True to follow the player, when it moves.
 */
var followPlayer = false;

/**
 * True to follow everything when any markers move.
 */
var followEverything = false;

/**
 * Check whether to follow the points of interest.
 *
 * @return {boolean} True to follow the points of interest, false if not.
 */
function getFollowInterests() {
    return followInterests;
}

/**
 * Set whether to follow the points of interest.
 *
 * @param {boolean} state True to follow the points of interest, false if not.
 * @param {Object} [options] Options object.
 * @param {boolean} [options.showNotification=true] True to show a notification, false if not.
 */
function setFollowInterests(state, options) {
    // Create a defaults object
    const defaultOptions = {
        showNotification: true
    };

    // Parse the options variable
    if(options === undefined)
        options = {};

    // Merge the options object with the defaults
    options = merge(defaultOptions, options, true);

    // Get the old state
    const oldState = followInterests;

    // Set whether to follow points of interest
    followInterests = state;

    // Set the button state depending on the follow points of interest state
    if(mapFollowInterestsButton !== null)
        mapFollowInterestsButton.state(state ? 'follow-interests' : 'no-follow-interests');

    // Show a notification if the state changed
    if(options.showNotification && state !== oldState)
        showNotification((state ? 'Focus' : 'Don\'t focus') + ' on interests');
}

/**
 * Check whether to follow the player.
 *
 * @return {boolean} True to follow the player, false if not.
 */
function getFollowPlayer() {
    return followPlayer;
}

/**
 * Set whether to follow the player.
 *
 * @param {boolean} state True to follow the player, false if not.
 * @param {Object} [options] Options object.
 * @param {boolean} [options.showNotification=true] True to show a notification, false if not.
 */
function setFollowPlayer(state, options) {
    // Create a defaults object
    const defaultOptions = {
        showNotification: true
    };

    // Parse the options variable
    if(options === undefined)
        options = {};

    // Merge the options object with the defaults
    options = merge(defaultOptions, options, true);

    // Get the old state
    const oldState = followPlayer;

    // Set whether to follow players
    followPlayer = state;

    // Stop following everything
    if(state)
        // Stop following everything
        setFollowEverything(false, {
            showNotification: false
        });

    // Set the button state depending on the follow player state
    if(mapFollowPlayerButton !== null)
        mapFollowPlayerButton.state(state ? 'follow-player' : 'no-follow-player');

    // Show a notification if the state changed
    if(options.showNotification && state !== oldState)
        showNotification((state ? 'Now' : 'Stopped') + ' following you');
}

/**
 * Check whether to follow everything.
 *
 * @return {boolean} True to follow everything, false if not.
 */
function getFollowEverything() {
    return followEverything;
}

/**
 * Set whether to follow everything.
 *
 * @param {boolean} state True to follow everything, false if not.
 * @param {Object} [options] Options object.
 * @param {boolean} [options.showNotification=true] True to show a notification, false if not.
 */
function setFollowEverything(state, options) {
    // Create a defaults object
    const defaultOptions = {
        showNotification: true
    };

    // Parse the options variable
    if(options === undefined)
        options = {};

    // Merge the options object with the defaults
    options = merge(defaultOptions, options, true);

    // Get the old state
    const oldState = followEverything;

    // Set whether to follow everything
    followEverything = state;

    // Stop following the player
    if(state)
        // Stop following the player
        setFollowPlayer(false, {
            showNotification: false
        });

    // Set the button state depending on the follow everything state
    if(mapFollowEverythingButton !== null)
        mapFollowEverythingButton.state(state ? 'follow-everything' : 'no-follow-everything');

    // Show a notification if the state changed
    if(options.showNotification && state !== oldState)
        showNotification((state ? 'Now' : 'Stopped') + ' following everything');
}

/**
 * Focus on the map, with the currently selected focussing method.
 *
 * @param {boolean} zoom True to allow zooming to focus, false to keep the current zoom level.
 */
function focusMap(zoom) {
    if(getFollowInterests())
        focusInterests();
    else if(getFollowPlayer())
        focusPlayer(zoom);
    else if(getFollowEverything())
        focusEverything(zoom);
}

/**
 * Focus on the points of interest (on the map) if there are any.
 * Focus on everything instead if there's no points of interest.
 */
function focusInterests() {
    // Make sure the map is created
    if(map === null)
        return;

    // Count the player and factory markers
    const playerMarkerCount = playersMarkers.length;
    const factoryMarkerCount = factoryMarkers.length;

    // Create an array of things to fit
    var fitters = [];
    var interestsPositions = [];

    // TODO: Don't fit ranges that are too large
    // TODO: Only focus on one hotstop
    // TODO: Focus on factories that are close to the hotspot

    // Define the maximum size a range circle may have to include it in the fit box
    const maxRangeCircleRadius = 25;

    // Define the maximum distance of a factory to any player to include it
    const maxFactoryDistance = 100;

    // Define the maximum distance markers may be from the player when the player is followed
    const maxDistanceFromPlayer = 100;

    // Get the player position if known
    const hasPlayer = playerMarker !== null;
    var playerPos = null;

    // Add the player marker
    if(hasPlayer) {
        // Add the player to follow when player or everything following is enabled
        if(getFollowPlayer() || getFollowEverything()) {
            // Add the player marker to the list of fitters
            if(playerMarker.rangeCircle !== undefined && playerMarker.rangeCircle !== null && playerMarker.rangeCircle.getRadius() <= maxRangeCircleRadius)
                fitters.push(playerMarker.rangeCircle);
            else
                fitters.push(playerMarker);

            // Add the position of the player
            interestsPositions.push(playerMarker.getLatLng());
        }

        // Store the player position
        playerPos = playerMarker.getLatLng();
    }

    // Add the player markers
    playersMarkers.forEach(function(marker) {
        // Get the position of the player, and make sure it's valid
        const pos = marker.getLatLng();
        if(pos === null || pos === undefined)
            return;

        // Determine whether this player is in range
        var inRange = true;
        if(hasPlayer && getFollowPlayer())
            // The player must be in range of the player in player following mode
            inRange = playerPos.distanceTo(pos) <= maxDistanceFromPlayer;

        // Skip this factory if it's not in range
        if(!inRange)
            return;

        // Add the marker itself, or it's range circle if it's in bound to the fitters
        if(marker.hasOwnProperty('rangeCircle') && marker.rangeCircle !== undefined && marker.rangeCircle !== null && marker.rangeCircle.getRadius() <= maxRangeCircleRadius)
            fitters.push(marker.rangeCircle);
        else
            fitters.push(marker);

        // Add the position of the player
        interestsPositions.push(marker.getLatLng());
    });

    // Add the factory markers
    factoryMarkers.forEach(function(marker) {
        // Get the position of the factory, and make sure it's valid
        const pos = marker.getLatLng();
        if(pos === null || pos === undefined)
            return;

        // Determine whether this factory is in range
        var inRange = false;
        if(hasPlayer && getFollowPlayer())
            // The factory must be in range of the player in player following mode
            inRange = playerPos.distanceTo(pos) <= maxDistanceFromPlayer;

        else {
            // Make sure the factory is in range of any of the interesting positions
            interestsPositions.forEach(function(interestsPos) {
                // Skip if we're already in range
                if(inRange)
                    return;

                // Determine if this factory is in range with this position
                inRange = pos.distanceTo(interestsPos) <= maxFactoryDistance;
            });
        }

        // Skip this factory if it's not in range
        if(!inRange)
            return;

        // Add the factory to the list of fitters
        if(marker.hasOwnProperty('rangeCircle') && marker.rangeCircle !== undefined && marker.rangeCircle !== null && marker.rangeCircle.getRadius() <= maxRangeCircleRadius)
            fitters.push(marker.rangeCircle);
        else
            fitters.push(marker);
    });

    // Make sure we have any fitters, if not, focus everything instead
    if(fitters.length === 0) {
        focusEverything();
        return;
    }

    // Fly to the bounds
    map.fitBounds(
        L.featureGroup(fitters).getBounds(),
        {
            paddingTopLeft: [15, 45],
            paddingBottomRight: [15, 15],
            animate: Dworek.state.animate
        }
    );
}

/**
 * Focus on the player (on the map) if the player location is known.
 *
 * @param {boolean} [zoom=false] True to zoom in to the player, false to keep the current zoom level.
 */
function focusPlayer(zoom) {
    // Parse the zoom parameter
    if(zoom === undefined)
        zoom = false;

    // Make sure the map is created
    if(map === null)
        return;

    // Make sure a player marker is available, focus on points of interest if not
    if(playerMarker === null) {
        focusInterests();
        return;
    }

    // Get the player location
    const playerLocation = playerMarker.getLatLng();

    // Focus on the player marker and/or zoom depending on the zoom parameter
    if(!Dworek.state.animate || zoom)
        map.setView(playerLocation, 18, {animate: Dworek.state.animate});
    else
        map.panTo(playerLocation);
}

/**
 * Focus on the map and fit all relevant things.
 */
function focusEverything() {
    // Make sure the map isn't null
    if(map == null)
        return;

    // Create an array of things to fit
    var fitters = [];

    // Define the maximum size a range circle may have to include it in the fit box
    const maxRangeCircleRadius = 20;

    // Add the player marker
    if(playerMarker !== null) {
        if(playerMarker.rangeCircle !== undefined && playerMarker.rangeCircle !== null && playerMarker.rangeCircle.getRadius() <= maxRangeCircleRadius)
            fitters.push(playerMarker.rangeCircle);
        else
            fitters.push(playerMarker);
    }

    // Add the player marker
    playersMarkers.forEach(function(marker) {
        if(marker.hasOwnProperty('rangeCircle') && marker.rangeCircle !== undefined && marker.rangeCircle !== null && marker.rangeCircle.getRadius() <= maxRangeCircleRadius)
            fitters.push(marker.rangeCircle);
        else
            fitters.push(marker);
    });

    // Add the factory markers
    factoryMarkers.forEach(function(marker) {
        // Add the factory to the list of fitters
        if(marker.hasOwnProperty('rangeCircle') && marker.rangeCircle !== undefined && marker.rangeCircle !== null && marker.rangeCircle.getRadius() <= maxRangeCircleRadius)
            fitters.push(marker.rangeCircle);
        else
            fitters.push(marker);
    });

    // Make sure we have any fitters
    if(fitters.length === 0)
        return;

    // Fly to the bounds
    map.fitBounds(
        L.featureGroup(fitters).getBounds(),
        {
            paddingTopLeft: [15, 45],
            paddingBottomRight: [15, 15],
            animate: Dworek.state.animate
        }
    );
}

// Update the map size when a page is shown
$(document).bind('pageshow', function() {
    // Make sure we're on a game page
    if(!Dworek.utils.isGamePage())
        return;

    // Get the map container
    var mapContainer = getActivePage().find("#map-container");

    // Make sure a map container is found on the page
    if(mapContainer.length <= 0)
        return;

    // Update the map size
    updateMapSize(true, true);

    // Focus the map
    focusMap(true);
});

/**
 * Initialize the map container if available.
 *
 * This will properly re-initialize the map element if the map has decayed.
 *
 * @param {element|undefined} [element] The element to look inside of to find
 *                                      the map. If none is given, the page
 *                                      that is currently active is used.
 */
function initMap(element) {
    // Use the page that is currently active when no element is given
    if(element === undefined || element === null)
        element = getActivePage();

    // TODO: Only initialize/update if the map tab is shown (if the page has tabs)

    // Get the map container
    var mapContainer = element.find('#map-container');

    // Check whether there's a map container on the new page
    if(mapContainer.length > 0) {
        // Make sure any map is available inside the container
        if(mapContainer.find("#map div.leaflet-map-pane").length <= 0) {
            // Reset the map instance, to cause it to be created again
            console.log('Destroying the old map container...');
            $('#map').html('');
            $('#map-container').empty();
            map = null;

            // Reset the existing markers
            playerMarker = null;
            playersMarkers = [];
            factoryMarkers = [];

            // Build the new map container
            console.log('Building the new map container...');
            element.find('#map-container').append('<div id="map"></div>');
        }

        // Request the map data
        requestMapData(undefined, false);

        // Update the map size
        updateMapSize(true, true);

        // Use the last known player location when possible
        var latlng = [52.0705, 4.3007];
        if(Dworek.state.geoPlayerPosition !== null)
            latlng = [Dworek.state.geoPlayerPosition.coords.latitude, Dworek.state.geoPlayerPosition.coords.longitude];

        // Create a map if none has been created yet
        if(map === null) {
            // Show a status message
            console.log('Initializing the map.');

            // Build the map options
            var mapOptions = {};

            // Add animation options when animations are disabled
            if(!Dworek.state.animate) {
                mapOptions.fadeAnimation = false;
                mapOptions.zoomAnimation = false;
                mapOptions.makerZoomAnimation = false;
                mapOptions.inertia = false;
            }

            // Create the map
            map = L.map('map', mapOptions).setView(latlng, 18);

            // Set up the tile layers
            L.tileLayer('https://api.mapbox.com/styles/v1/timvisee/cirawmn8f001ch4m27llnb45d/tiles/256/{z}/{x}/{y}?access_token=pk.eyJ1IjoidGltdmlzZWUiLCJhIjoiY2lyZXY5cDhzMDAxM2lsbTNicGViaTZkYyJ9.RqbUkoWLWeh_WZoyoxxt-Q', {
                attribution: 'Hosted by <a href="https://timvisee.com/" target="_blank">timvisee.com</a>'
            }).addTo(map);

            // Revert the view or stop following if the map is dragged by the user
            map.on('dragend', function(e) {
                // Revert the view if the user dragged the map less than 150 pixels, stop following otherwise
                if(e.distance <= 150) {
                    // Focus the map
                    focusMap(false);

                } else {
                    // Stop following
                    setFollowInterests(false);
                    setFollowPlayer(false);
                    setFollowEverything(false);
                }
            });

            // Set the map follow points of interests button
            mapFollowInterestsButton = L.easyButton({
                states: [{
                    stateName: 'no-follow-interests',
                    icon:      'zmdi zmdi-star-outline',
                    title:     'Focus on points of interest',
                    onClick: function(button, map) {
                        // Set whether to follow the points of interest
                        setFollowInterests(true);
                        focusMap(true);

                        // Set the button state
                        button.state('follow-interests');
                    }
                }, {
                    stateName: 'follow-interests',
                    icon:      'zmdi zmdi-star',
                    title:     'Don\'t focus on points of interest',
                    onClick: function(button, map) {
                        // Set whether to follow the points of interest
                        setFollowInterests(false);
                        focusMap(true);

                        // Set the button state
                        button.state('no-follow-interests');
                    }
                }]
            });

            // Set the button state depending on the follow points of interest state
            mapFollowInterestsButton.state(getFollowInterests() ? 'follow-interests' : 'no-follow-interests');

            // Set the map follow player button
            mapFollowPlayerButton = L.easyButton({
                states: [{
                    stateName: 'no-follow-player',
                    icon:      'zmdi zmdi-account-o',
                    title:     'Start following yourself on the map',
                    onClick: function(button, map) {
                        // Set whether to follow the player
                        setFollowPlayer(true);
                        focusMap(true);

                        // Set the button state
                        button.state('follow-player');
                    }
                }, {
                    stateName: 'follow-player',
                    icon:      'zmdi zmdi-account',
                    title:     'Stop following yourself on the map',
                    onClick: function(button, map) {
                        // Set whether to follow the player
                        setFollowPlayer(false);
                        focusMap(true);

                        // Set the button state
                        button.state('no-follow-player');
                    }
                }]
            });

            // Set the button state depending on the follow player state
            mapFollowPlayerButton.state(getFollowPlayer() ? 'follow-player' : 'no-follow-player');

            // Set the map follow everything button
            mapFollowEverythingButton = L.easyButton({
                states: [{
                    stateName: 'no-follow-everything',
                    icon:      'zmdi zmdi-accounts-outline',
                    title:     'Start following everything',
                    onClick: function(button, map) {
                        // Set whether to follow everything
                        setFollowEverything(true);
                        focusMap(true);

                        // Set the button state
                        button.state('follow-everything');
                    }
                }, {
                    stateName: 'follow-everything',
                    icon:      'zmdi zmdi-accounts',
                    title:     'Stop following everything',
                    onClick: function(button, map) {
                        // Set whether to follow everything
                        setFollowEverything(false);
                        focusMap(true);

                        // Set the button state
                        button.state('no-follow-everything');
                    }
                }]
            });

            // Set the button state depending on the follow everything state
            mapFollowEverythingButton.state(getFollowEverything() ? 'follow-everything' : 'no-follow-everything');

            // Add the follow buttons to the map in a bar
            L.easyBar([mapFollowInterestsButton]).addTo(map);
            L.easyBar([mapFollowPlayerButton, mapFollowEverythingButton]).addTo(map);

            // Add a refresh button
            L.easyButton('<i class="zmdi zmdi-refresh"></i>', function() {
                // Request map data
                requestMapData();

            }).addTo(map);

            // Force update the last player position if it's known
            if(Dworek.state.geoPlayerPosition != null)
                updatePlayerPosition(Dworek.state.geoPlayerPosition);
        }

        // Invalidate the map size, because the container size might be changed
        map.invalidateSize();

        // Request the map data to update the map after two seconds
        setTimeout(function() {
            requestMapData(undefined, false);
        }, 1500);
    }
}

/**
 * Update the map size.
 *
 * @param {boolean} invalidateSize True to invalidate the map size inside it's container, false to skip this.
 * @param {boolean} updateDiv True to update the map container size based on the page size, false to skip this.
 */
function updateMapSize(invalidateSize, updateDiv) {
    // Update the map container size
    if(updateDiv)
        $('#map').height($(window).height() - getActivePage().find('.ui-header').height());

    // Make sure we've a map we know about
    if(map == null)
        return;

    // Invalidate the map size inside the container
    if(invalidateSize)
        map.invalidateSize(true);
}

// Initialize/update the map when a page is shown
$(document).bind('pageshow', function(event) {
    initMap();
});

// Initialize/update the map when a tab is shown
$(document).bind('tab-switch', function(event, data) {
    initMap(data.to);
});

// Invalidate the map size each second
setTimeout(function() {
    updateMapSize(true, false);
}, 1000);

// Update the map size when the window is resized
$(window).resize(function() {
    updateMapSize(true, true);
});

/**
 * Refresh the location data for the map.
 *
 * @param {string} [game] ID of the game to request the location data for, or null to use the current game.
 * @param {boolean} [notify=true] True to notify, false if not.
 */
function requestMapData(game, notify) {
    // Parse the game parameter
    if(game == undefined)
        game = Dworek.state.activeGame;
    if(notify == undefined)
        notify = true;

    // Don't request if we aren't authenticated yet
    if(!Dworek.state.loggedIn)
        return;

    // Make sure the game isn't null
    if(game == null)
        return;

    // Show a status message
    if(notify)
        showNotification('Refreshing map...');

    // Request the map data
    Dworek.realtime.packetProcessor.sendPacket(PacketType.GAME_LOCATIONS_REQUEST, {
        game: game
    });
}

/**
 * Update the last known player position.
 * @param position Player position or undefined.
 */
function updatePlayerPosition(position) {
    // Return if the user doesn't have the right roles
    if(Dworek.state.activeGameRoles == null || !(Dworek.state.activeGameRoles.player || Dworek.state.activeGameRoles.special) || position === null || position === undefined)
        return;

    // Set the last known location
    Dworek.state.geoPlayerPosition = position;

    // Update the player marker
    updatePlayerMarker();
}

/**
 * Update the player marker.
 */
function updatePlayerMarker() {
    // Return if the user doesn't have the right roles
    if(Dworek.state.activeGameRoles === null || !(Dworek.state.activeGameRoles.player || Dworek.state.activeGameRoles.special))
        return;

    // Set the last known location
    const position = Dworek.state.geoPlayerPosition;

    // Update the player markers if the map is created
    if(map !== null) {
        // Create a player marker if we don't have one yet
        if(playerMarker === null) {
            // Make sure a player position is known
            if(position === null)
                return;

            // Create the player marker
            playerMarker = L.marker([position.coords.latitude, position.coords.longitude], {
                icon: L.spriteIcon('blue')
            });

            // Show a popup when the user clicks on the marker
            playerMarker.on('click', function() {
                showDialog({
                    title: 'You',
                    message: 'This marker shows your current location.<br><br>' +
                    'The position of your marker is updated as soon as your device detects you\'ve moved.<br><br>' +
                    'The blue circle around you shows how accurate your position is.',
                    actions: [
                        {
                            text: 'Test GPS',
                            action: function() {
                                testGps();
                            }
                        },
                        {
                            text: 'Close'
                        }
                    ]
                })
            });

            // Bind a popup to the marker
            playerMarker.bindPopup('<b>You!</b>');
            playerMarker.on('mouseover', function (e) {
                this.openPopup();
            });
            playerMarker.on('mouseout', function (e) {
                this.closePopup();
            });

            // Create a player range circle
            playerMarker.rangeCircle = L.circle([position.coords.latitude, position.coords.longitude], position.coords.accuracy);
            playerMarker.rangeCircle.setStyle({
                opacity: 0.4
            });

            // Add the marker and circle to the map
            playerMarker.addTo(map);
            playerMarker.rangeCircle.addTo(map);

            // Focus the map
            focusMap(true);

            return;

        } else {
            // Update the position if it's known
            if(position !== null) {
                // Update the position and range
                playerMarker.setLatLng([position.coords.latitude, position.coords.longitude]);
                playerMarker.rangeCircle.setLatLng([position.coords.latitude, position.coords.longitude]);
                playerMarker.rangeCircle.setRadius(Dworek.state.geoPlayerPosition.coords.accuracy);

                // Set the marker opacity
                playerMarker.setOpacity(1);
            } else {
                // Set the marker opacity
                playerMarker.setOpacity(0.3);
            }
        }
    }

    // Focus the map
    focusMap(false);
}

/**
 * Update the markers for other visible users.
 *
 * @param users Users data.
 */
function updatePlayerMarkers(users) {
    // Make sure the map is loaded
    if(map == null)
        return;

    // Return if the user doesn't have the right roles
    if(Dworek.state.activeGameRoles == null || !(Dworek.state.activeGameRoles.player || Dworek.state.activeGameRoles.special || Dworek.state.activeGameRoles.spectator))
        return;

    // Determine whether to fit all users in the map after updating
    var focusMarkers = playersMarkers.length == 0;

    // Loop through the users
    users.forEach(function(user) {
        // Get the user position
        const pos = [user.location.latitude, user.location.longitude];

        // Find the correct marker for the user
        var marker = null;
        playersMarkers.forEach(function(entry) {
            // Skip the loop if we found the marker
            if(marker != null)
                return;

            // Check if this is the correct marker
            if(entry.state.user == user.user)
                marker = entry;
        });

        // Update or create a new marker
        if(marker == null) {
            // Create the marker
            marker = L.marker(pos, {
                icon: !user.shop.isShop ? L.spriteIcon('green') : L.spriteIcon('purple')
            });

            // Bind a popup to the marker
            marker.bindPopup('<b>' + (!user.shop.isShop ? 'Player' : __('shop.name', { capitalizeFirst: true, game: Dworek.utils.getGameId() })) + '</b><br />' + user.userName);
            marker.on('mouseover', function (e) {
                this.openPopup();
            });
            marker.on('mouseout', function (e) {
                this.closePopup();
            });

            // Store the marker state
            marker.state = {
                user: user.user,
                isShop: user.shop.isShop
            };

            // Add the marker to the map
            marker.addTo(map);

            // Add the marker to the markers list
            playersMarkers.push(marker);

        } else
            // Update the position
            marker.setLatLng(pos);

        // Add a range circle if the user is a shop
        if(user.shop.isShop) {
            // Create the range circle if the marker doesn't have one yet
            if(!marker.hasOwnProperty('rangeCircle') || marker.rangeCircle == null) {
                // Create a range circle
                marker.rangeCircle = L.circle(pos, user.shop.range);
                marker.rangeCircle.addTo(map);

            } else {
                // Update the position and radius of the range circle
                marker.rangeCircle.setLatLng(pos);
                marker.rangeCircle.setRadius(user.shop.range);
            }

            // Set the range circle style
            marker.rangeCircle.setStyle({
                opacity: user.shop.inRange ? 1 : 0.4,
                dashArray: user.shop.inRange ? '' : '5,5',
                color: 'purple'
            });

            // Update the icon and popup
            if(!marker.state.isShop) {
                marker.bindPopup('<b>' + __('shop.name', { capitalizeFirst: true, game: Dworek.utils.getGameId() }) + '</b><br />' + user.userName);
                marker.setIcon(L.spriteIcon('purple'));
                marker.state.isShop = true;
            }

        } else if(marker.hasOwnProperty('rangeCircle') && marker.rangeCircle != null) {
            // Remove the map circle from the map, and remove it from the marker
            map.removeLayer(marker.rangeCircle);
            marker.rangeCircle = null;

            // Update the icon and popup
            if(marker.state.isShop) {
                marker.bindPopup('<b>Player</b><br />' + user.userName);
                marker.setIcon(L.spriteIcon('green'));
                marker.state.isShop = false;
            }
        }

        // Show a popup when the user clicks on the marker
        marker.off('click');
        marker.on('click', function() {
            // Create the dialog body
            var dialogBody = '<div align="center" class="table-list">' +
                '<table>' +
                '    <tr>' +
                '        <td class="left"><i class="zmdi zmdi-account zmdi-hc-fw"></i> Player</td><td>' + user.userName + '</td>' +
                '    </tr>' +
                '    <tr>' +
                '        <td class="left"><i class="zmdi zmdi-star zmdi-hc-fw"></i> Ally</td><td>' + (user.ally ? '<span style="color: green;">Yes</span>' : '<span style="color: red;">No</span>') + '</td>' +
                '    </tr>' +
                '    <tr>' +
                '        <td class="left"><i class="zmdi zmdi-shopping-cart zmdi-hc-fw"></i> ' + __('shop.names', { capitalizeFirst: true, game: Dworek.utils.getGameId() }) + '</td><td>' + (user.shop.isShop ? 'Yes' : 'No') + '</td>' +
                '    </tr>';

            // Add a range part if the user is a shop
            if(user.shop.isShop) {
                dialogBody +=
                    '    <tr>' +
                    '        <td class="left"><i class="zmdi zmdi-dot-circle zmdi-hc-fw"></i> In range</td><td>' + (user.shop.inRange ? '<span style="color: green;">Yes</span>' : '<span style="color: red;">No</span>') + '</td>' +
                    '    </tr>';
            }

            // Append the bottom
            dialogBody +=
                '</table>' +
                '</div>';

            // Create a list of actions
            var actions = [];

            // Add a buy and sell action if user is a shop that's in range
            if(user.shop.isShop && user.shop.inRange) {
                // Buy button
                actions.push({
                    text: 'Buy ' + __('in.names', { game: Dworek.utils.getGameId() }),
                    icon: 'zmdi zmdi-arrow-left',
                    action: function() {
                        // Show the buy dialog
                        showShopBuyDialog(user.shop.token);
                    }
                });

                // Sell button
                actions.push({
                    text: 'Sell ' + __('out.names', { game: Dworek.utils.getGameId() }),
                    icon: 'zmdi zmdi-arrow-right',
                    action: function() {
                        // Show the sell dialog
                        showShopSellDialog(user.shop.token);
                    }
                });
            }

            // Add the close button
            actions.push({
                text: 'Close'
            });

            // Show a dialog
            showDialog({
                title: 'Other player',
                message: dialogBody,
                actions: actions
            });
        });
    });

    // Create an array of marker indices to remove
    var toRemove = [];

    // Loop through all markers and make sure it's user is in the user list
    playersMarkers.forEach(function(entry, i) {
        // Determine whether the user exists
        var exists = false;

        // Loop through the list of users and check whether the user exists
        users.forEach(function(user) {
            // Skip if it exists
            if(exists)
                return;

            // Check whether this is the user
            if(user.user == entry.state.user)
                exists = true;
        });

        // Add the index if the user doens't exist
        if(!exists)
            toRemove.push(i);
    });

    // Remove the markers at the given indices
    for(var i = toRemove.length - 1; i >= 0; i--) {
        // Get the marker to remove
        const removeMarker = playersMarkers[toRemove[i]];

        // Remove the range circle if it has any
        if(removeMarker.hasOwnProperty('rangeCircle') && removeMarker.rangeCircle != null)
            map.removeLayer(removeMarker.rangeCircle);

        // Remove the marker
        map.removeLayer(playersMarkers[toRemove[i]]);

        // Remove the entry from the array
        playersMarkers.splice(toRemove[i], 1);
    }

    // Make sure we still want to fit
    if(focusMarkers && playersMarkers.length == 0)
        focusMarkers = false;

    // Focus the map
    if(focusMarkers)
        focusMap(true);
}

/**
 * Update the markers for visible factories.
 *
 * @param factories Factories data.
 */
function updateFactoryMarkers(factories) {
    // Make sure the map is loaded
    if(map == null)
        return;

    // Return if the user doesn't have the right roles
    if(Dworek.state.activeGameRoles == null || !(Dworek.state.activeGameRoles.player || Dworek.state.activeGameRoles.special || Dworek.state.activeGameRoles.spectator))
        return;

    // Loop through the factories
    factories.forEach(function(factory) {
        // Get the factory position
        const pos = [factory.location.latitude, factory.location.longitude];

        // Find the correct marker for the user
        var marker = null;
        factoryMarkers.forEach(function(entry) {
            // Skip the loop if we found the marker
            if(marker != null)
                return;

            // Check if this is the correct marker
            if(entry.factory.factory == factory.factory)
                marker = entry;
        });

        // Update or create a new marker
        if(marker == null) {
            // Create the marker
            marker = L.marker(pos, {
                icon: L.spriteIcon(factory.ally ? 'orange' : 'red')
            });

            // Bind a popup to the marker
            marker.bindPopup('<b>' + __('factory.name', { capitalizeFirst: true, game: Dworek.utils.getGameId() }) + '</b><br />' + factory.name);
            marker.on('mouseover', function (e) {
                this.openPopup();
            });
            marker.on('mouseout', function (e) {
                this.closePopup();
            });

            // Create a range circle
            marker.rangeCircle = L.circle(pos, factory.range);
            marker.rangeCircle.setStyle({
                opacity: factory.inRange ? 1 : 0.4,
                dashArray: factory.inRange ? '' : '5,5',
                color: factory.ally ? 'darkorange' : 'red'
            });

            // Add the marker and range circle to the map
            marker.addTo(map);
            marker.rangeCircle.addTo(map);

            // Put the factory data in the marker
            marker.factory = {
                factory: factory.factory,
                ally: factory.ally
            };

            // Add the marker to the markers list
            factoryMarkers.push(marker);

        } else {
            // Update the position and range
            marker.setLatLng(pos);
            marker.rangeCircle.setLatLng(pos);
            marker.rangeCircle.setRadius(factory.range);

            // Set the factory style
            marker.rangeCircle.setStyle({
                opacity: factory.inRange ? 1 : 0.4,
                dashArray: factory.inRange ? '' : '5,5'
            });

            // Update the factory sprite and color if the ally state changed
            if(marker.factory.ally != factory.ally) {
                // Update the marker sprite
                marker.setIcon(L.spriteIcon(factory.ally ? 'orange' : 'red'));

                // Update the range circle color
                marker.rangeCircle.setStyle({
                    color: factory.ally ? 'darkorange' : 'red'
                });

                // Update the factory ally state
                marker.factory.ally = factory.ally;
            }
        }

        // Rebind the popup to show when the user clicks on the marker
        marker.off('click');
        marker.on('click', function() {
            // Create the dialog body
            const dialogBody = '<div align="center" class="table-list">' +
                '<table>' +
                '    <tr>' +
                '        <td class="left"><i class="zmdi zmdi-tag-more zmdi-hc-fw"></i> Name</td><td>' + factory.name + '</td>' +
                '    </tr>' +
                '    <tr>' +
                '        <td class="left"><i class="zmdi zmdi-star zmdi-hc-fw"></i> Ally</td><td>' + (factory.ally ? '<span style="color: green;">Yes</span>' : '<span style="color: red;">No</span>') + '</td>' +
                '    </tr>' +
                '    <tr>' +
                '        <td class="left"><i class="zmdi zmdi-dot-circle zmdi-hc-fw"></i> In range</td><td>' + (factory.inRange ? '<span style="color: green;">Yes</span>' : '<span style="color: red;">No</span>') + '</td>' +
                '    </tr>' +
                '</table>' +
                '</div>';

            // Show a dialog
            showDialog({
                title: __('factory.name', { capitalizeFirst: true, game: Dworek.utils.getGameId() }),
                message: dialogBody,
                actions: [
                    {
                        text: 'View ' + __('factory.name', { game: Dworek.utils.getGameId() }),
                        state: 'primary',
                        action: function() {
                            Dworek.utils.navigateToPage('/game/' + Dworek.utils.getGameId() + '/factory/' + factory.factory, true, true, 'flip');
                        }
                    }, {
                        text: 'Close'
                    }
                ]
            })
        });
    });

    // Create an array of marker indices to remove
    var toRemove = [];

    // Loop through all markers and make sure it's user is in the user list
    factoryMarkers.forEach(function(entry, i) {
        // Determine whether the user exists
        var exists = false;

        // Loop through the list of factory and check whether the factory exists
        factories.forEach(function(factory) {
            // Skip if it exists
            if(exists)
                return;

            // Check whether this is the factory
            if(factory.factory == entry.factory.factory)
                exists = true;
        });

        // Add the index if the user doesn't exist
        if(!exists)
            toRemove.push(i);
    });

    // Remove the markers at the given indices
    for(var i = toRemove.length - 1; i >= 0; i--) {
        // Get the marker to remove
        const removeMarker = factoryMarkers[toRemove[i]];

        // Remove the range circle and then the marker itself
        map.removeLayer(removeMarker.rangeCircle);
        map.removeLayer(removeMarker);

        // Remove the entry from the array
        factoryMarkers.splice(toRemove[i], 1);
    }
}

// Build NativeDroid on page initialization
$(document).bind("pageinit", bindFactoryBuildButton);

/**
 * Bind the factory create button.
 */
function bindFactoryBuildButton() {
    // Get the factory building button
    const buildFactoryButton = $('.action-factory-build');

    // Bind the click event
    buildFactoryButton.unbind('click');
    buildFactoryButton.click(function(event) {
        // Cancel the default event
        event.preventDefault();

        // Show the factory building dialog
        buildFactory();
    });
}

/**
 * Upper case the first character in a string.
 * @param {string} str String to uppercase the first character of.
 * @return {string} Processed string.
 */
function capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Build a factory at the current location of the user.
 */
function buildFactory() {
    // Make sure a game is active
    if(Dworek.state.activeGame == null) {
        showNotification('You must be in an active game build a ' + __('factory.name', { game: Dworek.utils.getGameId() }));
        return;
    }

    // Make sure the user has the proper roles to build a lab
    if(!Dworek.state.activeGameRoles.player) {
        showNotification('You don\'t have permission to build');
        return;
    }

    // Get a new unique ID
    const fieldId = generateUniqueId('field-factory-name');

    // Build the dialog message
    var dialogMessage = 'Enter a name for the ' + __('factory.name', { game: Dworek.utils.getGameId() }) + ':<br><br>' +
        '<label for="' + fieldId + '">' + __('factory.name', { capitalizeFirst: true, game: Dworek.utils.getGameId() }) + ' name</label>' +
        '<input type="text" name="' + fieldId + '" id="' + fieldId + '" value="" data-clear-btn="true" />' +
        '<br><br>' +
        'Building this ' + __('factory.name', { game: Dworek.utils.getGameId() }) + ' will cost you <b class="game-factory-cost">?</b>.';

    // Create a variable for the factory name
    var nameField = null;

    // Get the game ID
    var gameId = Dworek.utils.getGameId();

    // Show a dialog message
    showDialog({
        title: 'Build ' + __('factory.name', { game: Dworek.utils.getGameId() }),
        message: dialogMessage,
        actions: [
            {
                text: 'Build ' + __('factory.name', { capitalizeFirst: true, game: Dworek.utils.getGameId() }),
                state: 'primary',
                action: function() {
                    // Send a factory creation request
                    Dworek.realtime.packetProcessor.sendPacket(PacketType.FACTORY_BUILD_REQUEST, {
                        game: gameId,
                        name: nameField.val()
                    });

                    // Show a notification
                    showNotification('Building ' + __('factory.name', { game: gameId }) + '...');
                }
            },
            {
                text: 'Cancel'
            }
        ]
    });

    // Select the field
    nameField = getActivePage().find('#' + fieldId);

    // Update the game data visuals
    updateGameDataVisuals();
}

/**
 * Object containing the game data of all loaded games.
 * @type {Object}
 */
var gameData = {};

/**
 * Check whether we've any data for the given game ID.
 * The ID of the active game will be used if no game ID is given
 *
 * @param {string} [game] Game ID.
 */
function hasGameData(game) {
    // Parse the game parameter
    if(game == undefined)
        game = Dworek.state.activeGame;

    // Make sure the game ID is valid
    if(game == null)
        return false;

    // Check whether we've game data
    return gameData.hasOwnProperty(game);
}

/**
 * Get the game data of the given game.
 * The ID of the active game will be used if no ID is given.
 *
 * @param {string} [game] ID of the game.
 * @return {Object|null} Object with game data or null if no game data is available.
 */
function getGameData(game) {
    // Parse the game parameter
    if(game == undefined)
        game = Dworek.state.activeGame;

    // Return null if we don't have any game data
    if(!hasGameData(game))
        return null;

    // Get the game data
    return gameData[game];
}

/**
 * Request the game data for the given game.
 *
 * @param {string} [game] ID of the game.
 */
function requestGameData(game) {
    // Parse the game parameter
    if(game == undefined)
        game = Dworek.state.activeGame;

    // Don't request if we aren't authenticated yet
    if(!Dworek.state.loggedIn)
        return;

    // Make sure the game isn't null
    if(game == null)
        return;

    // Show a status message
    console.log('Requesting game data...');

    // Request the game data
    Dworek.realtime.packetProcessor.sendPacket(PacketType.GAME_DATA_REQUEST, {
        game: game
    });
}

/**
 * Get the data for the shop with the given token in a game.
 * The ID of the active game will be used if no ID is given.
 *
 * @param {string|undefined} [game] ID of the game or undefined to use the current game.
 * @param {string} shopToken Token of the shop to get the data for.
 * @return {Object|null} Object with shop data, or null if not available.
 */
function getShopData(game, shopToken) {
    // Get the game data for this shop and make sure it is available
    const data = getGameData(game);
    if(data == null)
        return null;

    // Define a variable to put the shop in
    var foundShop = null;

    // Loop through the list of shops
    data.shops.forEach(function(shop) {
        // Skip if we found the shop
        if(foundShop != null)
            return;

        // Make sure the shop isn't undefined
        if(shop == undefined)
            return;

        // Compare the shop token, mark it as found if they equal
        if(shop.token == shopToken)
            foundShop = shop;
    });

    // Return the found shop, if any is found
    return foundShop;
}

// Update the game info
Dworek.realtime.packetProcessor.registerHandler(PacketType.GAME_DATA, function(packet) {
    // Make sure the packet contains the required properties
    if(!packet.hasOwnProperty('game') || !packet.hasOwnProperty('data'))
        return;

    // Set the game data
    gameData[packet.game] = packet.data;

    // Update the game data visuals
    updateGameDataVisuals();
});

// Update the game data visuals when initializing a page
$(document).bind("pageshow", function() {
    updateGameDataVisuals();
});

function cardAnimationSlideIn(element) {
    if(Dworek.state.animate)
        // Animate
        element.addClass('animated bounceInDown').hide().slideDown();
    else
        // Just show
        element.show();
}

function cardAnimationSlideOut(element) {
    if(Dworek.state.animate)
        // Animate
        element.removeClass('animated bounceInLeft').addClass('animated fadeOutRight').delay(500).slideUp(function() {
            $(this).remove();
        });
    else
        // Just hide
        element.remove();

}

/**
 * Update all visual things that depend on the game data.
 */
function updateGameDataVisuals() {
    // Make sure we're on a game page
    if(!Dworek.utils.isGamePage())
        return;

    // Get the game ID of the active page, and make sure it's valid
    const gameId = Dworek.utils.getGameId();
    if(gameId == null)
        return;

    // Make sure we've any game data for this game, request new data and return if we don't have anything
    if(!hasGameData(gameId)) {
        requestGameData(gameId);
        return;
    }

    // Get the game data
    var data = getGameData(gameId);

    // Get the active page
    const activePage = getActivePage();

    // Get the game actions list
    const gameActionsList = activePage.find('.game-actions-list');

    // Check whether we found a game actions list
    if(gameActionsList.length > 0) {
        // Remove the game data loading label
        gameActionsList.find('.game-data-load-label').remove();

        // Count the number of cards
        var cardCount = 0;

        // Determine whether anything is changed
        var changed = false;

        // Determine whether we should show the factory build button
        const showFactoryBuild = data.hasOwnProperty('factory') && data.factory.hasOwnProperty('canBuild') && data.factory.canBuild;
        if(showFactoryBuild)
            cardCount++;

        // Determine whether to show the special actions card
        const showSpecialActions = (data.hasOwnProperty('roles') && data.roles.hasOwnProperty('special') && data.roles.special) ||
            (data.hasOwnProperty('user') && data.user.hasOwnProperty('isAdmin') && data.user.isAdmin);
        if(showSpecialActions)
            cardCount++;

        // Get the factory build and special action card element if available
        var factoryBuildCardElement = gameActionsList.find('.card-factory-build');
        var specialActionsCardElement = gameActionsList.find('.card-special-actions');

        // Create the factory build card if it isn't available
        if(showFactoryBuild && factoryBuildCardElement.length == 0) {
            gameActionsList.prepend('<div class="nd2-card wow card-factory-build">' +
                '    <div class="card-title has-supporting-text">' +
                '        <h3 class="card-primary-title">Build a ' + __('factory.name', { game: gameId }) + '</h3>' +
                '    </div>' +
                '    <div class="card-supporting-text has-action has-title">' +
                '        <p>Build a ' + __('factory.name', { game: gameId }) + ' at your current location to expand your fleet and start producing more ' + __('out.name', { game: gameId }) + '.</p>' +
                '    </div>' +
                '    <div class="card-action">' +
                '        <div class="row between-xs">' +
                '            <div class="col-xs-12">' +
                '                <div class="box">' +
                '                    <a href="#" class="ui-btn waves-effect waves-button action-factory-build">' +
                '                        <i class="zmdi zmdi-pin"></i>&nbsp;' +
                '                        Build ' + __('factory.name', { game: gameId }) + '&nbsp;&nbsp;(<span class="game-factory-cost">?</span>)' +
                '                    </a>' +
                '                </div>' +
                '            </div>' +
                '        </div>' +
                '    </div>' +
                '</div>');
            bindFactoryBuildButton();
            changed = true;
            cardAnimationSlideIn(gameActionsList.find('.card-factory-build'));

        } else if(!showFactoryBuild && factoryBuildCardElement.length > 0) {
            cardAnimationSlideOut(factoryBuildCardElement);
            changed = true;
        }

        // Create the special actions card if it isn't available
        if(showSpecialActions && specialActionsCardElement.length == 0) {
            gameActionsList.prepend('<div class="nd2-card wow card-special-actions">' +
                '    <div class="card-title has-supporting-text">' +
                '        <h3 class="card-primary-title">Special actions</h3>' +
                '    </div>' +
                '    <div class="card-supporting-text has-action has-title">' +
                '        <p>Execute special actions to affect the inventory of players.</p>' +
                '    </div>' +
                '    <div class="card-action">' +
                '        <div class="row between-xs">' +
                '            <div class="col-xs-12">' +
                '                <div class="box">' +
                '                    <a href="/game/' + Dworek.utils.getGameId() + '/special" class="ui-btn waves-effect waves-button">' +
                '                        <i class="zmdi zmdi-flare"></i>&nbsp;' +
                '                        Predefined Actions' +
                '                    </a>' +
                '                    <a href="/game/' + Dworek.utils.getGameId() + '/special/custom" class="ui-btn waves-effect waves-button">' +
                '                        <i class="zmdi zmdi-edit"></i>&nbsp;' +
                '                        Custom Action' +
                '                    </a>' +
                '                </div>' +
                '            </div>' +
                '        </div>' +
                '    </div>' +
                '</div>');
            changed = true;
            cardAnimationSlideIn(gameActionsList.find('.card-special-actions'));

        } else if(!showFactoryBuild && factoryBuildCardElement.length > 0) {
            cardAnimationSlideOut(specialActionsCardElement);
            changed = true;
        }

        // Create an array with the factory IDs that are shown
        var factoryIds = [];

        // Define the factory card selector prefix
        const factoryCardSelector = 'card-factory';

        // Loop through the list of factories
        cardCount += data.factories.length;
        data.factories.forEach(function(factory) {
            // Add the factory ID to the array
            factoryIds.push(factory.id);

            // Determine the card selector for this factory´s card and get the elements for it
            var factoryCardElement = gameActionsList.find('.' + factoryCardSelector + '[data-factory-id=\'' + factory.id + '\']');

            // Skip this run if it already exists
            if(factoryCardElement.length > 0)
                return;

            // Create a new card for this factory
            gameActionsList.prepend('<div class="nd2-card wow ' + factoryCardSelector + '" data-factory-id="' + factory.id + '">' +
                '    <div class="card-title has-supporting-text">' +
                '        <h3 class="card-primary-title">' + factory.name + '</h3>' +
                '    </div>' +
                '    <div class="card-action">' +
                '        <div class="row between-xs">' +
                '            <div class="col-xs-12">' +
                '                <div class="box">' +
                '                    <a href="/game/' + gameId + '/factory/' + factory.id + '" class="ui-btn waves-effect waves-button">' +
                '                        <i class="zmdi zmdi-zoom-in"></i>&nbsp;' +
                '                        View ' + __('factory.name', { game: gameId }) + '' +
                '                    </a>' +
                '                </div>' +
                '            </div>' +
                '        </div>' +
                '    </div>' +
                '</div>');
            changed = true;

            // Slide out animation
            cardAnimationSlideIn(gameActionsList.find('.' + factoryCardSelector + '[data-factory-id=\'' + factory.id + '\']'));
        });

        // Find all factory cards, and loop through them
        const factoryCards = gameActionsList.find('.' + factoryCardSelector);
        factoryCards.each(function() {
            // Get the factory ID
            const factoryId = $(this).data('factory-id');

            // Delete the card if it's not in the factory IDs array
            if(jQuery.inArray(factoryId, factoryIds) == -1)
                cardAnimationSlideOut($(this));
        });

        // Create an array with the shop tokens that are shown
        var shopTokens = [];

        // Define the shop card selector prefix
        const shopCardSelector = 'card-shop';

        // Loop through the list of shops
        cardCount += data.shops.length;
        data.shops.forEach(function(shop) {
            // Add the shop ID to the array
            shopTokens.push(shop.token);

            // Determine the card selector for this shop´s card and get the elements for it
            var shopCardElement = gameActionsList.find('.' + shopCardSelector + '[data-shop-token=\'' + shop.token + '\']');

            // Skip this run if it already exists
            if(shopCardElement.length > 0)
                return;

            // Create an unique ID for the buy and sell button
            const buyButtonId = generateUniqueId('button-buy-');
            const sellButtonId = generateUniqueId('button-sell-');

            // Create a new card for this shop
            gameActionsList.prepend('<div class="nd2-card wow ' + shopCardSelector + '" data-shop-token="' + shop.token + '">' +
                '    <div class="card-title has-supporting-text">' +
                '        <h3 class="card-primary-title">' + (shop.ally ? 'Allied' : 'Enemy') + ' ' + __('shop.name', { game: gameId }) + '</h3>' +
                '    </div>' +
                '    <div class="card-supporting-text has-action has-title">' +
                '        <p>This ' + __('shop.name', { game: gameId }) + ' is currently dealing high quality goods near your location.</p>' +
                '        <table class="table-list ui-responsive">' +
                '            <tr>' +
                '                <td>Selling</td>' +
                '                <td><span style="color: gray;">~</span> ' + formatMoney(shop.inSellPrice, true) + ' <span style="color: gray;">/ 1 ' + __('in.name', { game: gameId }) + '</span></td>' +
                '            </tr>' +
                '            <tr>' +
                '                <td>Buying</td>' +
                '                <td><span style="color: gray;">~</span> ' + formatMoney(shop.outBuyPrice, true) + ' <span style="color: gray;">/ 1 ' + __('out.name', { game: gameId }) + '</span></td>' +
                '            </tr>' +
                '        </table>' +
                '        <p>' +
                (shop.ally ?
                    'Allied ' + __('shop.names', { game: gameId }) + ' are really expensive! Buy and sell an enemy ' + __('shop.name', { game: gameId }) + ' to make a lot more money.' :
                    'Enemy ' + __('shop.names', { game: gameId }) + ' are a lot cheaper than allied ' + __('shop.names', { game: gameId }) + '.'
                ) +
                '        </p>' +
                '    </div>' +
                '    <div class="card-action">' +
                '        <div class="row between-xs">' +
                '            <div class="col-xs-12">' +
                '                <div class="box">' +
                '                    <a href="#" id="' + buyButtonId + '" class="ui-btn waves-effect waves-button">' +
                '                        <i class="zmdi zmdi-arrow-left"></i>&nbsp;' +
                '                        Buy ' + __('in.names', { game: gameId }) + '' +
                '                    </a>' +
                '                    <a href="#" id= "' + sellButtonId + '" class="ui-btn waves-effect waves-button">' +
                '                        <i class="zmdi zmdi-arrow-right"></i>&nbsp;' +
                '                        Sell ' + __('out.names', { game: gameId }) + '' +
                '                    </a>' +
                '                </div>' +
                '            </div>' +
                '        </div>' +
                '    </div>' +
                '</div>');
            changed = true;

            // Select the buttons elements
            const buyButtonElement = gameActionsList.find('#' + buyButtonId);
            const sellButtonElement = gameActionsList.find('#' + sellButtonId);

            // Show the buy dialog for the shop when clicking the buy button
            buyButtonElement.click(function() {
                // Show the buy dialog for the shop
                showShopBuyDialog(shop.token);
            });

            // Show the sell dialog for the shop when clicking the sell button
            sellButtonElement.click(function() {
                // Show the sell dialog for the shop
                showShopSellDialog(shop.token);
            });

            // Slide out animation
            cardAnimationSlideIn(gameActionsList.find('.' + shopCardSelector + '[data-shop-token=\'' + shop.token + '\']'));
        });

        // Find all shop cards, and loop through them
        const shopCards = gameActionsList.find('.' + shopCardSelector);
        shopCards.each(function() {
            // Get the shop ID
            const shopToken = $(this).data('shop-token');

            // Delete the card if it's not in the shop tokens array
            if(jQuery.inArray(shopToken, shopTokens) == -1)
                cardAnimationSlideOut($(this));
        });

        // Show a label if no card is shown
        if(cardCount == 0)
            gameActionsList.html('<div align="center" class="game-data-load-label">' +
                '    <i>No actions available...</i>' +
                '</div>');

        // Trigger the create event on the game actions list
        if(changed)
            gameActionsList.trigger('create');
    }

    // Check whether we have any factory data
    if(data.hasOwnProperty('factory')) {
        // Update the factory cost label
        if(data.factory.hasOwnProperty('cost'))
            $('.game-factory-cost').html(data.factory.cost != 0 ? formatMoney(data.factory.cost, true) : 'Free');
    }

    if(data.hasOwnProperty('balance')) {
        if(data.balance.hasOwnProperty('money'))
            activePage.find('.game-balance-money').html(formatMoney(data.balance.money, false));
        if(data.balance.hasOwnProperty('in'))
            activePage.find('.game-balance-in').html(formatGoods(data.balance.in));
        if(data.balance.hasOwnProperty('out'))
            activePage.find('.game-balance-out').html(formatGoods(data.balance.out));
    }

    // Check whether strength data is being sent
    if(data.hasOwnProperty('strength')) {
        // Make sure the current strength value is included
        if(data.strength.hasOwnProperty('value'))
            activePage.find('.game-player-strength').html(data.strength.value);

        // Get the upgrade button list element, and clear it
        const upgradeButtonList = activePage.find('.card-player-strength').find('.upgrade-button-list');
        upgradeButtonList.empty();

        // Check whether there are any strength upgrades
        if(!data.strength.hasOwnProperty('upgrades')) {
            upgradeButtonList.html('<div align="center"><i>No upgrades available...<br><br></i></div>');

        } else {
            // Loop through the list of upgrades
            data.strength.upgrades.forEach(function(upgrade, i) {
                // Get an unique button ID
                var buttonId = generateUniqueId('button-upgrade-');

                // Append a button
                upgradeButtonList.append('<a id="' + buttonId + '" class="ui-btn waves-effect waves-button" href="#" data-transition="slide" data-rel="popup">' +
                    '    <i class="zmdi zmdi-plus"></i>&nbsp;' +
                    '    ' + upgrade.name + '&nbsp;&nbsp;<span style="color: gray;">(' + formatMoney(upgrade.cost, true) + ' / +' + upgrade.strength + ')</span>' +
                    '</a>');

                // Get the button
                var button = upgradeButtonList.find('#' + buttonId);

                // Bind a click action
                button.click(function() {
                    showDialog({
                        title: 'Strength upgrade',
                        message: 'Are you sure you want to buy this upgrade for <b>' + formatMoney(upgrade.cost, true) + '</b>?<br><br>' +
                        'This will improve your players defence.',
                        actions: [
                            {
                                text: 'Buy upgrade',
                                state: 'primary',
                                action: function() {
                                    // Send an upgrade packet
                                    Dworek.realtime.packetProcessor.sendPacket(PacketType.PLAYER_STRENGTH_BUY, {
                                        game: Dworek.utils.getGameId(),
                                        index: i,
                                        cost: upgrade.cost,
                                        strength: upgrade.strength
                                    });

                                    // Show a notification
                                    showNotification('Buying upgrade...');
                                }
                            },
                            {
                                text: 'Cancel'
                            }
                        ]
                    })
                });
            });
        }

        // Trigger a create on the list
        upgradeButtonList.trigger('create');
    }

    // Check whether ping data is being sent
    if(data.hasOwnProperty('pings')) {
        // Get the pings button list element, and clear it
        const pingsButtonList = activePage.find('.card-pings').find('.ping-button-list');
        pingsButtonList.empty();

        // Make sure there are any pings
        if(data.pings.length <= 0) {
            pingsButtonList.html('<div align="center"><i>No pings available...<br><br></i></div>');

        } else {
            // Loop through the list of pings
            data.pings.forEach(function(ping, i) {
                // Get an unique button ID
                var buttonId = generateUniqueId('button-ping-');

                // Append a button
                pingsButtonList.append('<a id="' + buttonId + '" class="ui-btn waves-effect waves-button" href="#" data-transition="slide" data-rel="popup">' +
                    '    <i class="zmdi zmdi-portable-wifi-changes"></i>&nbsp;' +
                    '    ' + ping.name + '&nbsp;&nbsp;<span style="color: gray;">(' + formatMoney(ping.cost, true) + ' / ' + (ping.range >= 0 ? ping.range : '&#8734;') + ' m)</span>' +
                    '</a>');

                // Get the button
                var button = pingsButtonList.find('#' + buttonId);

                // Bind a click action
                button.click(function() {
                    // Show the ping dialog
                    showDialog({
                        title: ping.name,
                        message: 'Are you sure you want to execute this ping for <b>' + formatMoney(ping.cost, true) + '</b>?<br><br>' +
                        '<table class="table-list ui-responsive">' +
                        '<tr><td>Max range</td><td> ' + (ping.range >= 0 ? ping.range + ' meters' : '<i>Infinite</i>') + '</td></tr>' +
                        '<tr><td>Max discoveries</td><td>' + (ping.max > 0 ? ping.max + ' ' + (ping.max != 1 ? __('factory.names', { game: gameId }) : __('factory.name', { game: gameId })) : '<i>Infinite</i>') + '</td></tr>' +
                        '</table><br>' +
                        __('factory.names', { capitalizeFirst: true, game: gameId }) + ' that have been found, will appear on your map for just ' + Math.round(ping.duration / 1000) + ' seconds.<br><br>' +
                        'The ping will be consumed immediately after executing.',
                        actions: [
                            {
                                text: 'Execute ping',
                                state: 'primary',
                                action: function() {
                                    // Get the amount of money the user currently has
                                    var moneyCurrent = 0;
                                    if(hasGameData()) {
                                        const gameData = getGameData();
                                        if(gameData != null && gameData.hasOwnProperty('balance') && gameData.balance.hasOwnProperty('money'))
                                            moneyCurrent = gameData.balance.money;
                                    }

                                    // Make sure the user has enough money
                                    if(ping.cost > moneyCurrent) {
                                        showDialog({
                                            title: 'Not enough money',
                                            message: 'You don\'t have enough money to execute this ping.<br><br>' +
                                            'Make some money to execute one later in the game!'
                                        });
                                        return;
                                    }

                                    // Send an ping packet
                                    Dworek.realtime.packetProcessor.sendPacket(PacketType.PING_BUY, {
                                        game: Dworek.utils.getGameId(),
                                        pingId: ping.id,
                                        cost: ping.cost
                                    });

                                    // Show a notification
                                    showNotification('Executing ping...');
                                }
                            },
                            {
                                text: 'Cancel'
                            }
                        ]
                    })
                });
            });
        }

        // Trigger a create on the list
        pingsButtonList.trigger('create');
    }

    if(data.hasOwnProperty('standings')) {
        const list = activePage.find('.current-standings');

        if(data.standings.length == 0) {
            list.html('<tr><td><i style="font-weight: normal; color: gray;">Unknown...</i><br>');
            return;
        }

        // Sort the list of standings
        data.standings.sort(function(a, b) {
            return b.money - a.money;
        });

        // Build the HTML
        var tableHtml = '';

        data.standings.forEach(function(entry) {
            tableHtml += '<tr>' +
                '<td><span style="color: ' + (entry.ally ? 'green' : 'red') + ';">' + entry.name + '</span></td>' +
                '<td>' + formatMoney(entry.money, false) + ' <span style="color: gray">' + __('currency.names', { game: gameId }) + '</span></td>' +
                '</tr>'
        });

        list.html(tableHtml);

        // Trigger a create on the list
        list.trigger('create');
    }

    // Check whether this is the active game
    if(Dworek.state.activeGame == gameId)
        // Update the game stage
        Dworek.state.activeGameStage = data.stage;
}

/**
 * Show an error message to the user.
 * This will show a dialog containing the specified error message.
 *
 * @param {string} message Error message.
 */
function showError(message) {
    // Show the dialog
    showDialog({
        title: 'Error',
        message: message
    });
}

/**
 * Show the buying dialog for a shop with the given token.
 *
 * @param {string} shopToken Shop token.
 */
function showShopBuyDialog(shopToken) {
    // Get the shop data
    const shopData = getShopData(undefined, shopToken);

    // Show an error message if the shop data is unavailable
    if(shopData == null) {
        showError('Shop data not available.<br><br>Please try to use this shop at a later time.');
        return;
    }

    // Determine the amount fo money the user has
    var moneyCurrent = 0;
    if(hasGameData()) {
        const gameData = getGameData();
        if(gameData != null && gameData.hasOwnProperty('balance') && gameData.balance.hasOwnProperty('money'))
            moneyCurrent = gameData.balance.money;
    }

    // Get the game ID
    const gameId = Dworek.utils.getGameId();

    // Calculate the minimum and maximum amount of in and money
    const inMin = 1;
    const inMax = Math.floor(moneyCurrent / shopData.inSellPrice);
    const moneyMin = Math.round(shopData.inSellPrice);
    const moneyMax = Math.round(inMax * shopData.inSellPrice);

    // Make sure the user has enough money, show a dialog of the user doesn't have enough money
    if(moneyMax <= 0) {
        showDialog({
            title: 'Not enough money',
            message: 'You don\'t have enough money to spend on ' + __('in.names', { game: gameId }) + '.<br><br>' +
            'Please make some money by selling ' + __('out.names', { game: gameId }) + ' first before coming back.'
        });
        return;
    }

    // Generate an unique field ID
    const inFieldId = generateUniqueId('in-field');
    const moneyFieldId = generateUniqueId('money-field');

    // Determine the default money and in value
    const inDefault = Math.round(inMax / 2);
    const moneyDefault = Math.round(inDefault * shopData.inSellPrice);

    // Show the dialog
    showDialog({
        title: 'Buy ' + __('in.names', { game: gameId }),
        message: 'Enter the amount of ' + __('in.names', { game: gameId }) + ' you\'d like to buy.<br><br>' +
        '<label for="' + inFieldId + '">Amount of ' + __('in.names', { game: gameId }) + ':</label>' +
        '<input type="range" name="' + inFieldId + '" id="' + inFieldId + '" value="' + inDefault + '" min="' + inMin + '" max="' + inMax + '" data-highlight="true">' +
        '<label for="' + moneyFieldId + '">Cost in ' + __('currency.names', { game: gameId }) + ':</label>' +
        '<input type="range" name="' + moneyFieldId + '" id="' + moneyFieldId + '" value="' + moneyDefault + '" min="' + moneyMin + '" max="' + moneyMax + '" data-highlight="true">',
        actions: [
            {
                text: 'Buy',
                state: 'primary',
                action: function() {
                    // Get the input field value
                    const moneyAmount = parseInt($('#' + moneyFieldId).val());

                    // Send a packet to the server
                    Dworek.realtime.packetProcessor.sendPacket(PacketType.SHOP_SELL_IN, {
                        shop: shopToken,
                        moneyAmount: moneyAmount,
                        all: false
                    });

                    // Show a notification
                    showNotification('Buying ' + __('in.names', { game: gameId }) + '...');
                }
            },
            {
                text: 'Buy all',
                action: function() {
                    // Send a packet to the server
                    Dworek.realtime.packetProcessor.sendPacket(PacketType.SHOP_SELL_IN, {
                        shop: shopToken,
                        moneyAmount: 0,
                        all: true
                    });

                    // Show a notification
                    showNotification('Buying all ' + __('in.names', { game: gameId }) + '...');
                }
            },
            {
                text: 'Goodbye'
            }
        ]
    });

    // Link the sliders together when the dialog is shown
    setTimeout(function() {
        // Get the range slider elements
        const rangeIn = $('#' + inFieldId);
        const rangeMoney = $('#' + moneyFieldId);

        // Define whether the user is dragging a slider
        var dragging = false;

        // Update the dragging state when interacting with a slider
        rangeIn.on('slidestart slidestop', function(event) {
            dragging = event.type == 'slidestart';
        });
        rangeMoney.on('slidestart slidestop', function(event) {
            dragging = event.type == 'slidestart';
        });

        // Remember the last amount of money and in
        var inLast = inDefault;
        var moneyLast = moneyDefault;

        // Update the range sliders on change
        rangeIn.on('change slidestop', function(event) {
            // Get the current amount of in
            var inCurrent = $(this).val();

            // Set whether to update the in slider
            var update = event.type == 'slidestop';

            // Determine whether to increase the range by one step
            if(!dragging && inLast != null && Math.abs(inCurrent - inLast) == 1 && shopData.inSellPrice < 1) {
                // Calculate the in delta
                const inDelta = parseInt(inCurrent - inLast);

                // Get the current amount of money
                const moneyCurrent = parseInt(rangeMoney.val());

                // Calculate the new amount of in based on the current money with the delta
                inCurrent = Math.round((moneyCurrent + inDelta) / shopData.inSellPrice);

                // Force a slider update
                update = true;
            }

            // Calculate the amount of money
            const moneyAmount = Math.round(inCurrent * shopData.inSellPrice);

            // Update the money slider
            rangeMoney.val(moneyAmount).slider('refresh');

            // Update the last money and in value
            inLast = inCurrent;
            moneyLast = moneyAmount;

            // Update the in slider if the event was called because we stopped dragging the slider
            if(update) {
                // Recalculate the in amount to round it
                const inAmount = Math.round(moneyAmount / shopData.inSellPrice);

                // Update the range sliders
                rangeIn.val(inAmount).slider('refresh');
            }
        });
        rangeMoney.on('change slidestop', function(event) {
            // Get the current amount of money
            var moneyCurrent = $(this).val();

            // Set whether to update the money slider
            var update = event.type == 'slidestop';

            // Determine whether to increase the range by one step
            if(!dragging && moneyLast != null && Math.abs(moneyCurrent - moneyLast) == 1 && shopData.inSellPrice > 1) {
                // Calculate the in delta
                const moneyDelta = parseInt(moneyCurrent - moneyLast);

                // Get the current amount of in
                const inCurrent = parseInt(rangeIn.val());

                // Calculate the new amount of money based on the current in with the delta
                moneyCurrent = Math.round((inCurrent + moneyDelta) * shopData.inSellPrice);

                // Force a slider update
                update = true;
            }

            // Calculate the amount of in
            const inAmount = Math.round(moneyCurrent / shopData.inSellPrice);

            // Update the in slider
            rangeIn.val(inAmount).slider('refresh');

            // Update the last money and in value
            moneyLast = moneyCurrent;
            inLast = inAmount;

            // Update the money slider if the event was called because we stopped dragging the slider
            if(update) {
                // Recalculate the money amount to round it
                const moneyAmount = Math.round(inAmount * shopData.inSellPrice);

                // Update the range sliders
                rangeMoney.val(moneyAmount).slider('refresh');
            }
        });
    }, 600);
}

/**
 * Show the sell dialog for the shop with the given token.
 *
 * @param {string} shopToken Token of the shop.
 */
function showShopSellDialog(shopToken) {
    // Get the shop data
    const shopData = getShopData(undefined, shopToken);

    // Show an error message if the shop data is unavailable
    if(shopData == null) {
        showError('Shop data not available.<br><br>Please try to use this shop at a later time.');
        return;
    }

    // Determine the amount of out the user has
    var outCurrent = 0;
    if(hasGameData()) {
        const gameData = getGameData();
        if(gameData != null && gameData.hasOwnProperty('balance') && gameData.balance.hasOwnProperty('money'))
            outCurrent = gameData.balance.out;
    }

    // Get the game ID
    const gameId = Dworek.utils.getGameId();

    // Make sure the user has any out to sell
    if(outCurrent <= 0) {
        showDialog({
            title: 'No ' + __('out.name', { game: gameId }),
            message: 'You don\'t have any ' + __('out.names', { game: gameId }) + ' to sell.<br><br>' +
            'Please make some ' + __('out.name', { game: gameId }) + ' using ' + __('factory.name', { game: gameId }) + 's before coming back.'
        });
        return;
    }

    // Calculate the minimum and maximum amount of out and money
    const outMin = 1;
    const outMax = outCurrent;
    const moneyMin = Math.round(shopData.outBuyPrice);
    const moneyMax = Math.round(outMax * shopData.outBuyPrice);

    // Generate an unique field ID
    const outFieldId = generateUniqueId('out-field');
    const moneyFieldId = generateUniqueId('money-field');

    // Determine the default in and money value
    const outDefault = Math.round(outMax / 2);
    const moneyDefault = Math.round(outDefault * shopData.outBuyPrice);

    // Show the dialog
    //noinspection JSCheckFunctionSignatures
    showDialog({
        title: 'Sell ' + __('out.names', { game: gameId }),
        message: 'Enter the amount of ' + __('out.names', { game: gameId }) + ' you\'d like to sell.<br><br>' +
        '<label for="' + outFieldId + '">Amount of ' + __('out.names', { game: gameId }) + ':</label>' +
        '<input type="range" name="' + outFieldId + '" id="' + outFieldId + '" value="' + outDefault + '" min="' + outMin + '" max="' + outMax + '" data-highlight="true">' +
        '<label for="' + moneyFieldId + '">Income in ' + __('currency.names', { game: gameId }) + ':</label>' +
        '<input type="range" name="' + moneyFieldId + '" id="' + moneyFieldId + '" value="' + moneyDefault + '" min="' + moneyMin + '" max="' + moneyMax + '" data-highlight="true">',
        actions: [
            {
                text: 'Sell',
                state: 'primary',
                action: function() {
                    // Get the input field value
                    const outAmount = parseInt($('#' + outFieldId).val());

                    // Send a packet to the server
                    Dworek.realtime.packetProcessor.sendPacket(PacketType.SHOP_BUY_OUT, {
                        shop: shopToken,
                        outAmount: outAmount,
                        all: false
                    });

                    // Show a notification
                    showNotification('Selling ' + __('out.names', { game: gameId }) + '...');
                }
            },
            {
                text: 'Sell all',
                action: function() {
                    // Send a packet to the server
                    Dworek.realtime.packetProcessor.sendPacket(PacketType.SHOP_BUY_OUT, {
                        shop: shopToken,
                        outAmount: 0,
                        all: true
                    });

                    // Show a notification
                    showNotification('Selling all ' + __('out.names', { game: gameId }) + '...');
                }
            },
            {
                text: 'Goodbye'
            }
        ]
    });

    // Link the sliders together after the dialog is shown
    setTimeout(function() {
        // Get the range slider elements
        const rangeOut = $('#' + outFieldId);
        const rangeMoney = $('#' + moneyFieldId);

        // Define whether the user is dragging a slider
        var dragging = false;

        // Update the dragging state when interacting with a slider
        rangeOut.on('slidestart slidestop', function(event) {
            dragging = event.type == 'slidestart';
        });
        rangeMoney.on('slidestart slidestop', function(event) {
            dragging = event.type == 'slidestart';
        });

        // Remember the last amount of money and out
        var outLast = outDefault;
        var moneyLast = moneyDefault;

        // Update the range sliders on change
        rangeOut.on('change slidestop', function(event) {
            // Get the current amount of out
            var outCurrent = $(this).val();

            // Set whether to update the in slider
            var update = event.type == 'slidestop';

            // Determine whether to increase the range by one step
            if(!dragging && outLast != null && Math.abs(outCurrent - outLast) == 1 && shopData.outBuyPrice < 1) {
                // Calculate the out delta
                const outDelta = parseInt(outCurrent - outLast);

                // Get the current amount of money
                const moneyCurrent = parseInt(rangeMoney.val());

                // Calculate the new amount of out based on the current money with the delta
                outCurrent = Math.round((moneyCurrent + outDelta) / shopData.outBuyPrice);

                // Force a slider update
                update = true;
            }

            // Calculate the amount of money
            const moneyAmount = Math.round(outCurrent * shopData.outBuyPrice);

            // Update the money slider
            rangeMoney.val(moneyAmount).slider('refresh');

            // Update the last out and money value
            outLast = outCurrent;
            moneyLast = moneyAmount;

            // Update the out slider if the event was called because we stopped dragging the slider
            if(update) {
                // Recalculate the out amount to round it
                // TODO: Test whether we can use the 'outCurrent' variable value instead
                const outAmount = Math.round(moneyAmount / shopData.outBuyPrice);

                // Update the out slider
                rangeOut.val(outAmount).slider('refresh');
            }
        });
        rangeMoney.on('change slidestop', function(event) {
            // Get the current amount of money
            var moneyCurrent = $(this).val();

            // Set whether to update the money slider
            var update = event.type == 'slidestop';

            // Determine whether to increase the range by one step
            if(!dragging && moneyLast != null && Math.abs(moneyCurrent - moneyLast) == 1 && shopData.outBuyPrice > 1) {
                // Calculate the money delta
                const moneyDelta = parseInt(moneyCurrent - moneyLast);

                // Get the current amount of out
                const outCurrent = parseInt(rangeOut.val());

                // Calculate the new amount of money based on the current in with the delta
                moneyCurrent = Math.round((outCurrent + moneyDelta) * shopData.outBuyPrice);

                // Force a slider update
                update = true;
            }

            // Calculate the amount of out
            const outAmount = Math.round(moneyCurrent / shopData.outBuyPrice);

            // Update the out slider
            rangeOut.val(outAmount).slider('refresh');

            // Update the last out and money value
            moneyLast = moneyCurrent;
            outLast = outAmount;

            // Update the money slider if the event was called because we stopped dragging the slider
            if(update) {
                // Recalculate the money amount to round it
                const moneyAmount = Math.round(outAmount * shopData.outBuyPrice);

                // Update the money slider
                rangeMoney.val(moneyAmount).slider('refresh');
            }
        });
    }, 600);
}

/**
 * Object containing the factory data of all loaded games.
 * @type {Object}
 */
var factoryData = {};

/**
 * Check whether we've any data for the given factory ID.
 * The ID of the viewed factory will be used if no ID is given.
 *
 * @param {string} [factory] Factory ID.
 */
function hasFactoryData(factory) {
    // Parse the factory parameter
    if(factory === undefined)
        factory = Dworek.utils.getFactoryId();

    // Make sure the factory ID is valid
    if(factory == null)
        return false;

    // Check whether we've factory data
    return factoryData.hasOwnProperty(factory);
}

/**
 * Get the factory data of the given factory.
 * The ID of the viewed factory will be used if no ID is given.
 *
 * @param {string} [factory] ID of the factory.
 */
function getFactoryData(factory) {
    // Parse the factory parameter
    if(factory == undefined)
        factory = Dworek.utils.getFactoryId();

    // Return null if we don't have any factory data
    if(!hasFactoryData(factory))
        return null;

    // Get the factory data
    return factoryData[factory];
}

/**
 * Request the factory data for the given factory.
 * The ID of the viewed factory will be used if no ID is given.
 *
 * @param {string} [factory] ID of the factory.
 */
function requestFactoryData(factory) {
    // Parse the factory parameter
    if(factory == undefined)
        factory = Dworek.utils.getFactoryId();

    // Don't request if we aren't authenticated yet
    if(!Dworek.state.loggedIn)
        return;

    // Make sure the game isn't null
    if(factory == null)
        return;

    // Show a status message
    console.log('Requesting factory data...');

    // Request the game data
    Dworek.realtime.packetProcessor.sendPacket(PacketType.FACTORY_DATA_REQUEST, {
        factory: factory
    });
}

// Update the factory info
Dworek.realtime.packetProcessor.registerHandler(PacketType.FACTORY_DATA, function(packet) {
    // Make sure the packet contains the required properties
    if(!packet.hasOwnProperty('factory') || !packet.hasOwnProperty('game') || !packet.hasOwnProperty('data'))
        return;

    // Get the packet data
    const factoryId = packet.factory;
    const data = packet.data;

    // Set the factory data
    factoryData[factoryId] = data;

    // Check whether we're on this factory page
    if(Dworek.utils.getFactoryId() == factoryId) {
        // Update the factory data visuals
        updateFactoryDataVisuals();
    }
});

// Update the factory data visuals when initializing a page
$(document).bind("pageshow", function() {
    updateFactoryDataVisuals(true);
});

/**
 * Update all visual things that depend on the game data.
 * @param {boolean} [firstShow] If this is the first time the page is shown.
 */
function updateFactoryDataVisuals(firstShow) {
    if(firstShow == undefined)
        firstShow = false;

    // Make sure we're on a factory page
    if(!Dworek.utils.isFactoryPage())
        return;

    // Get the factory ID and make sure it's valid
    const factoryId = Dworek.utils.getFactoryId();
    if(factoryId == null)
        return;

    // Make sure we've any factory data for this factory, request new data and return if we don't have anything
    if(!hasFactoryData(factoryId))
        requestFactoryData(factoryId);

    // Get the factory data
    var data = getFactoryData(factoryId);
    if(data == null)
        data = {};

    // Get the active page
    const activePage = getActivePage();

    // Determine whether the lab is visible
    var visible = !data.hasOwnProperty('visible') || data.visible;

    // Determine whether the user can modify this lab
    const canModify = visible && data.hasOwnProperty('inRange') && data.hasOwnProperty('ally') && data.inRange && data.ally;

    // Check whether this user has management permission
    const hasManagementPermission = data.hasOwnProperty('canManage') && data.canManage;

    // Determine whether the user can destroy the factory
    const canDestroy = (data.hasOwnProperty('ally') && data.ally) || hasManagementPermission;

    // Select the cards
    var attackCard = activePage.find('.card-factory-attack');
    var attackTab = activePage.find('.tabs-bar-factory li[data-tab=attack]');
    var attackTabNone = activePage.find('.tab-factory-attack-none');
    var destroyCard = activePage.find('.card-factory-destroy');
    var transferCard = activePage.find('.card-factory-transfer');
    var transferTab = activePage.find('.tabs-bar-factory li[data-tab=transfer]');
    var transferTabNone = activePage.find('.tab-factory-transfer-none');
    var defenceCard = activePage.find('.card-factory-defence');
    var defenceTab = activePage.find('.tabs-bar-factory li[data-tab=defence]');
    var defenceTabNone = activePage.find('.tab-factory-defence-none');
    var levelCard = activePage.find('.card-factory-level');
    var levelTab = activePage.find('.tabs-bar-factory li[data-tab=level]');
    var levelTabNone = activePage.find('.tab-factory-level-none');

    // Get the game ID
    const gameId = Dworek.utils.getGameId();

    // Determine whether to show the destroy card
    if(canDestroy) {
        // Slide down the card
        if(Dworek.state.animate)
            destroyCard.slideDown();
        else
            destroyCard.show();

        // Get the destroy button
        const destroyButton = destroyCard.find('.action-factory-destroy');

        // Rebind the click event
        destroyButton.unbind('click');
        destroyButton.click(function(e) {
            // Prevent the default action
            e.preventDefault();

            // Get the factory name
            const langFactory = __('factory.name', { game: gameId });

            // Define the message to show
            var message = '';

            // Show a warning for administrators not owning this factory
            if(hasManagementPermission && !canModify)
                message += '<b style="color: red;">You can destroy this ' + langFactory + ' because you have game administration rights. This ' + langFactory + ' is owned by a different team. Use this ability with care.</b><br /><hr />';

            // Define the base
            message += 'You\'re about to destroy this ' + langFactory + '.<br /><br />';

            // Add the checkbox
            if(data.inRange || hasManagementPermission)
                message += '<label for="factory-destroy-keep-contents">' + (hasManagementPermission ? 'Give ' + langFactory + ' contents to team' : 'Keep ' + langFactory + ' contents (team)')  + '</label>' +
                    '<input type="checkbox" id="factory-destroy-keep-contents" name="factory-destroy-keep-contents" checked /><br />';
            else
                message += '<b>You\'re not in range, all ' + __('in.names', { game: gameId }) + ' and ' + __('out.names', { game: gameId }) +
                        ' will be lost!</b><br /><br />';

            // Add the confirmation
            message += 'Would you like to destroy this factory?';

            // Check whether the user is in-range
            showDialog({
                title: 'Destroy ' + __('factory.name', { game: gameId }),
                message: message,
                actions: [
                    {
                        text: 'Destroy',
                        icon: 'zmdi zmdi-fire',
                        state: 'primary',
                        action: function() {
                            // Determine whether to keep contents
                            var keepContents = data.inRange;

                            // Get the checkbox value, the user may choose to keep contents
                            if(data.inRange || hasManagementPermission)
                                keepContents = $('#factory-destroy-keep-contents').is(':checked');

                            // Send the factory destroy packet
                            Dworek.realtime.packetProcessor.sendPacket(PacketType.FACTORY_DESTROY, {
                                factory: factoryId,
                                keepContents: keepContents
                            });
                        }
                    },
                    {
                        icon: 'zmdi zmdi-undo',
                        text: 'Cancel'
                    }
                ]
            });
        });

    } else {
        // Slide up the card
        if(Dworek.state.animate)
            destroyCard.slideUp();
        else
            destroyCard.hide();
    }

    // Update the upgrade buttons
    if(canModify) {
        // Slide down the cards
        if(Dworek.state.animate) {
            transferCard.slideDown();
            transferTab.fadeIn();
            defenceCard.slideDown();
            defenceTab.fadeIn();
            levelCard.slideDown();
            levelTab.fadeIn();
        } else {
            transferCard.show();
            transferTab.show();
            defenceCard.show();
            defenceTab.show();
            levelCard.show();
            levelTab.show();
        }
        transferTabNone.hide();
        defenceTabNone.hide();
        levelTabNone.hide();

        // Get the upgrade button list element, and clear it
        const upgradeButtonList = defenceCard.find('.upgrade-button-list');
        upgradeButtonList.empty();

        // Check whether there are any defence upgrades
        if(!data.hasOwnProperty('defenceUpgrades')) {
            upgradeButtonList.html('<div align="center"><i>No upgrades available...<br></i></div>');

        } else {
            // Loop through the list of upgrades
            data.defenceUpgrades.forEach(function(upgrade, i) {
                // Get an unique button ID
                var buttonId = generateUniqueId('button-upgrade-');

                // Append a button
                upgradeButtonList.append('<a id="' + buttonId + '" class="ui-btn waves-effect waves-button" href="#" data-transition="slide" data-rel="popup">' +
                    '    <i class="zmdi zmdi-plus"></i>&nbsp;' +
                    '    ' + upgrade.name + '&nbsp;&nbsp;<span style="color: gray;">(' + formatMoney(upgrade.cost, true) + ' / +' + upgrade.defence + ')</span>' +
                    '</a>');

                // Get the button
                var button = upgradeButtonList.find('#' + buttonId);

                // Bind a click action
                button.click(function() {
                    showDialog({
                        title: 'Defence upgrade',
                        message: 'Are you sure you want to buy this upgrade for <b>' + formatMoney(upgrade.cost, true) + '</b>?<br><br>' +
                        'This will improve the ' + __('factory.name', { game: gameId }) + ' with <b>' + upgrade.defence + '</b> defence.',
                        actions: [
                            {
                                text: 'Buy upgrade',
                                state: 'primary',
                                action: function() {
                                    // Send an upgrade packet
                                    Dworek.realtime.packetProcessor.sendPacket(PacketType.FACTORY_DEFENCE_BUY, {
                                        factory: factoryId,
                                        index: i,
                                        cost: upgrade.cost,
                                        defence: upgrade.defence
                                    });

                                    // Show a notification
                                    showNotification('Buying upgrade...');
                                }
                            },
                            {
                                text: 'Cancel'
                            }
                        ]
                    })
                });
            });
        }

        // Trigger a create on the list
        upgradeButtonList.trigger('create');

        if(data.hasOwnProperty('nextLevelCost')) {
            const levelUpgradeButton = levelCard.find('.action-factory-level-upgrade');
            levelUpgradeButton.unbind('click');
            levelUpgradeButton.click(function() {
                showDialog({
                    title: 'Level upgrade',
                    message: 'Are you sure you want to upgrade one level for <b>' + formatMoney(data.nextLevelCost, true) + '</b>?',
                    actions: [
                        {
                            text: 'Buy upgrade',
                            state: 'primary',
                            action: function() {
                                // Send an upgrade packet
                                Dworek.realtime.packetProcessor.sendPacket(PacketType.FACTORY_LEVEL_BUY, {
                                    factory: factoryId,
                                    cost: data.nextLevelCost
                                });

                                // Show a notification
                                showNotification('Buying upgrade...');
                            }
                        },
                        {
                            text: 'Cancel'
                        }
                    ]
                });
            });
        }

        // Find all deposit and withdraw buttons, and unbind their current click events
        const depositButton = transferCard.find('.action-factory-deposit');
        const withdrawButton = transferCard.find('.action-factory-withdraw');
        depositButton.unbind('click');
        withdrawButton.unbind('click');

        // Bind the deposit dialog to the deposit button
        depositButton.click(function() {
            // Function to show the dialog
            const depositDialog = function(goodType) {
                // Determine how many in the user currently has
                var current = 100;
                if(hasGameData()) {
                    var gameData = getGameData();
                    if(gameData != null && gameData.hasOwnProperty('balance') && gameData.balance.hasOwnProperty(goodType))
                        current = gameData.balance[goodType];
                }

                // Make sure there's anything to deposit
                if(current <= 0) {
                    // Nothing to deposit, show a message dialog
                    showDialog({
                        title: 'Nothing to deposit',
                        message: 'You currently don\'t have any ' + NameConfig[goodType].name + ' that you can deposit to this ' + __('factory.name', { game: gameId }) + '.'
                    });
                    return;
                }

                // Generate an unique field ID
                var amountFieldId = generateUniqueId('amount-field-');

                // Show the dialog
                showDialog({
                    title: 'Deposit ' + NameConfig[goodType].name,
                    message: 'Enter the amount of ' + NameConfig[goodType].name + ' you\'d like to deposit, or deposit all available to you.<br><br>' +
                    '<label for="' + amountFieldId + '">Deposit amount:</label>' +
                    '<input type="range" name="' + amountFieldId + '" id="' + amountFieldId + '" value="' + Math.round(current / 2) + '" min="1" max="' + current + '" data-highlight="true">',
                    actions: [
                        {
                            text: 'Deposit',
                            state: 'primary',
                            action: function() {
                                // Get the input field value
                                var amount = $('#' + amountFieldId).val();

                                // Send a packet to the server
                                Dworek.realtime.packetProcessor.sendPacket(PacketType.FACTORY_DEPOSIT, {
                                    factory: factoryId,
                                    goodType: goodType,
                                    amount: amount,
                                    all: false
                                });

                                // Show a notification
                                showNotification('Depositing ' + NameConfig[goodType].name + '...');
                            }
                        },
                        {
                            text: 'Deposit all',
                            action: function() {
                                // Send a packet to the server
                                Dworek.realtime.packetProcessor.sendPacket(PacketType.FACTORY_DEPOSIT, {
                                    factory: factoryId,
                                    goodType: goodType,
                                    amount: 0,
                                    all: true
                                });

                                // Show a notification
                                showNotification('Depositing all ' + NameConfig[goodType].name + '...');
                            }
                        },
                        {
                            text: 'Cancel'
                        }
                    ]
                });
            };

            // Show the dialog to choose the type of goods to deposit
            showDialog({
                title: 'Deposit goods',
                message: 'Choose the type of goods to deposit.',
                actions: [
                    {
                        text: 'Deposit ' + __('in.names', { game: gameId }),
                        state: 'primary',
                        action: function() {
                            // Show the deposit dialog
                            depositDialog('in');
                        }
                    },
                    {
                        text: 'Deposit ' + __('out.names', { game: gameId }),
                        action: function() {
                            // Show the deposit dialog
                            depositDialog('out');
                        }
                    },
                    {
                        text: 'Cancel'
                    }
                ]
            });
        });

        // Bind the withdraw dialog to the withdraw button
        withdrawButton.click(function() {
            // Function to show the dialog
            const withdrawDialog = function(goodType) {
                // Determine how many in the user currently has
                var current = 100;
                if(hasFactoryData()) {
                    var factoryData = getFactoryData();
                    if(factoryData != null && factoryData.hasOwnProperty(goodType))
                        current = factoryData[goodType];
                }

                // Make sure there's anything to deposit
                if(current <= 0) {
                    // Nothing to deposit, show a message dialog
                    showDialog({
                        title: 'Nothing to withdraw',
                        message: 'There currently isn\'t any ' + NameConfig[goodType].name + ' that you can withdraw from this ' + __('factory.name', { game: gameId }) + '.'
                    });
                    return;
                }

                // Generate an unique field ID
                var amountFieldId = generateUniqueId('amount-field-');

                // Show the good withdrawal dialog
                showDialog({
                    title: 'Withdraw ' + NameConfig[goodType].name,
                    message: 'Enter the amount of ' + NameConfig[goodType].name + ' you\'d like to withdraw, or withdraw all available.<br><br>' +
                    '<label for="' + amountFieldId + '">Withdraw amount:</label>' +
                    '<input type="range" name="' + amountFieldId + '" id="' + amountFieldId + '" value="' + Math.round(current / 2) + '" min="1" max="' + current + '" data-highlight="true">',
                    actions: [
                        {
                            text: 'Withdraw',
                            state: 'primary',
                            action: function() {
                                // Get the input field value
                                var amount = $('#' + amountFieldId).val();

                                // Send a packet to the server
                                Dworek.realtime.packetProcessor.sendPacket(PacketType.FACTORY_WITHDRAW, {
                                    factory: factoryId,
                                    goodType: goodType,
                                    amount: amount,
                                    all: false
                                });

                                // Show a notification
                                showNotification('Withdrawing ' + NameConfig[goodType].name + '...');
                            }
                        },
                        {
                            text: 'Withdraw all',
                            action: function() {
                                // Send a packet to the server
                                Dworek.realtime.packetProcessor.sendPacket(PacketType.FACTORY_WITHDRAW, {
                                    factory: factoryId,
                                    goodType: goodType,
                                    amount: 0,
                                    all: true
                                });

                                // Show a notification
                                showNotification('Withdrawing all ' + NameConfig[goodType].name + '...');
                            }
                        },
                        {
                            text: 'Cancel'
                        }
                    ]
                });
            };

            // Show the dialog to choose the type of goods to withdraw
            showDialog({
                title: 'Withdraw goods',
                message: 'Choose the type of goods to withdraw.',
                actions: [
                    {
                        text: 'Withdraw ' + __('out.names', { game: gameId }),
                        state: 'primary',
                        action: function() {
                            // Show the withdraw dialog
                            withdrawDialog('out');
                        }
                    },
                    {
                        text: 'Withdraw ' + __('in.names', { game: gameId }),
                        action: function() {
                            // Show the withdraw dialog
                            withdrawDialog('in');
                        }
                    },
                    {
                        text: 'Cancel'
                    }
                ]
            });
        });

    } else {
        // Hide the cards and tabs
        if(firstShow) {
            transferCard.hide();
            transferTab.hide();
            transferTabNone.show();
            defenceCard.hide();
            defenceTab.hide();
            defenceTabNone.show();
            levelCard.hide();
            levelTab.hide();
            levelTabNone.show();
        } else {
            if(Dworek.state.animate) {
                transferCard.slideUp();
                transferTab.fadeOut();
                defenceCard.slideUp();
                defenceTab.fadeOut();
                levelCard.slideUp();
                levelTab.fadeOut();
            } else {
                transferCard.hide();
                transferTab.hide();
                defenceCard.hide();
                defenceTab.hide();
                levelCard.hide();
                levelTab.hide();
            }
            transferTabNone.show();
            defenceTabNone.show();
            levelTabNone.show();
        }
    }

    // Determine whether the attack card should be shown
    if(data.hasOwnProperty('conquerValue') && data.conquerValue > 0 && data.hasOwnProperty('ally') && !data.ally) {
        // Show the attack card
        if(Dworek.state.animate) {
            attackCard.slideDown();
            attackTab.fadeIn();
        } else {
            attackCard.show();
            attackTab.show();
        }
        attackTabNone.hide();

        // Determine whether the factory is going to be destroyed
        const willDestroy = data.hasOwnProperty('level') && data.level <= 1;

        // Get the attack button
        var attackButton = attackCard.find('.action-factory-attack');
        attackButton.unbind('click');

        // Bind the attack button
        attackButton.click(function() {
            // Define the attack message
            var dialogMessage = 'This ' + __('factory.name', { game: gameId }) + ' will be taken over by your team when you attack it to use for your own production.<br><br>' +
                    'Part of the current ' + __('in.names', { game: gameId }) + ', ' + __('out.names', { game: gameId }) + ' and defence in this ' + __('factory.name', { game: gameId }) + ' will be lost because of this.<br><br>' +
                'Are you sure you want to attack this ' + __('factory.name', { game: gameId }) + '?';
            if(willDestroy)
                dialogMessage = 'This ' + __('factory.name', { game: gameId }) + ' will be destroyed when you attack it because it\'s level is too low.<br><br>' +
                    'The current amount of ' + __('in.names', { game: gameId }) + ' and ' + __('out.names', { game: gameId }) + ' in this ' + __('factory.name', { game: gameId }) + ' will be lost.<br><br>' +
                    'Are you sure you want to attack this ' + __('factory.name', { game: gameId }) + '?';

            // Show the dialog
            showDialog({
                title: 'Attack ' + __('factory.name', { game: gameId }),
                message: dialogMessage,
                actions: [
                    {
                        text: 'Attack & ' + (!willDestroy ? 'Take over' : 'Destroy'),
                        icon: 'zmdi zmdi-fire',
                        state: 'primary',
                        action: function() {
                            // Send a packet to the server
                            Dworek.realtime.packetProcessor.sendPacket(PacketType.FACTORY_ATTACK, {
                                game: Dworek.utils.getGameId(),
                                factory: factoryId
                            });

                            // Show a notification
                            showNotification('Attacking ' + __('in.names', { game: gameId }) + '...');
                        }
                    },
                    {
                        text: 'Cancel'
                    }
                ]
            });
        });

    } else {
        if(!firstShow) {
            attackCard.hide();
            attackTab.hide();
        } else {
            if(Dworek.state.animate) {
                attackCard.slideUp();
                attackTab.fadeOut();
            } else {
                attackCard.hide();
                attackTab.hide();
            }
        }

        attackTabNone.show();
    }

    // Get the elements
    const factoryNameLabel = activePage.find('.factory-name');
    const factoryLevelLabel = activePage.find('.factory-level');
    const factoryCreatorLabel = activePage.find('.factory-creator');
    const factoryTeamLabel = activePage.find('.factory-team');
    const factoryDefenceLabel = activePage.find('.factory-defence');
    const factoryConquerLabel = activePage.find('.factory-conquer-value');
    const factoryInRangeLabel = activePage.find('.factory-in-range');
    const factoryInLabel = activePage.find('.factory-in');
    const factoryProductionInLabel = activePage.find('.factory-production-in');
    const factoryOutLabel = activePage.find('.factory-out');
    const factoryProductionOutLabel = activePage.find('.factory-production-out');
    const factoryNextLevelCostLabel = activePage.find('.factory-next-level-cost');

    // Create some label constants
    const hiddenLabel = '<span style="color: gray;">Hidden</i>';
    const yesLabel = '<span style="color: green;">Yes</span>';
    const noLabel = '<span style="color: red;">No</span>';

    // Set the name label
    if(!visible || data.hasOwnProperty('name'))
        factoryNameLabel.html(data.name);

    // Set the level label
    if(!visible || data.hasOwnProperty('level'))
        factoryLevelLabel.html(visible ? data.level : hiddenLabel);

    // Set the creator label
    if(!visible || data.hasOwnProperty('creatorName'))
        factoryCreatorLabel.html(visible ? data.creatorName : hiddenLabel);

    // Set the team name label
    if(!visible || data.hasOwnProperty('teamName'))
        // Make the label green/red if it's known whether this factory is from allies or enemies
        if(data.hasOwnProperty('ally'))
            factoryTeamLabel.html('<span style="color: ' + (data.ally ? 'green' : 'red' ) + ';">' + (visible ? data.teamName : 'Hidden') + '</span>');
        else
            factoryTeamLabel.html((visible ? data.teamName : hiddenLabel));

    // Set the defence label
    if(!visible || data.hasOwnProperty('defence'))
        factoryDefenceLabel.html(visible ? data.defence : hiddenLabel);

    // Set the conquer value label
    if(!visible || data.hasOwnProperty('conquerValue')) {
        if(!visible)
            factoryConquerLabel.html(hiddenLabel + '<br>' + hiddenLabel);
        else {
            // Create a suffix label
            var suffix = '';
            if(data.hasOwnProperty('conquerUserCount'))
                suffix = '<br /><span style="color: gray;">' + data.conquerUserCount + ' user' + (data.conquerUserCount != 1 ? 's' : '') + ' in range</span>';

            // Set the label
            if(data.conquerValue < -5)
                factoryConquerLabel.html('<span style="color: green;">' +  data.conquerValue + '</span>' + suffix);
            else if(data.conquerValue <= 0)
                factoryConquerLabel.html('<span style="color: orangered;">' +  data.conquerValue + '</span>' + suffix);
            else {
                if(Dworek.state.animate)
                    // Animate
                    factoryConquerLabel.html('<span class="animated infinite rubberBand" style="color: red; font-weight: bold; display: inline-block;">' +  data.conquerValue + '</span>' + suffix);
                else
                    // Don't animate
                    factoryConquerLabel.html('<span style="color: red; font-weight: bold; display: inline-block;">' +  data.conquerValue + '</span>' + suffix);
            }
        }
    }

    // Set the range label
    if(!visible || data.hasOwnProperty('inRange'))
        factoryInRangeLabel.html(data.inRange ? yesLabel : noLabel);

    // Set the in label
    if(!visible || data.hasOwnProperty('in'))
        if(data.hasOwnProperty('productionIn')) {
            if(data.in >= data.productionIn)
                factoryInLabel.html(visible ? ('<span style="color: green;">' + formatGoods(data.in) + '</span>') : hiddenLabel);
            else {
                if(Dworek.state.animate)
                    // Animate
                    factoryInLabel.html(visible ? ('<span class="animated infinite rubberBand" style="color: red; display: inline-block;">' + formatGoods(data.in) + '</span>') : hiddenLabel);
                else
                    // Don't animate
                    factoryInLabel.html(visible ? ('<span style="color: red; display: inline-block;">' + formatGoods(data.in) + '</span>') : hiddenLabel);
            }
        } else
            factoryInLabel.html(visible ? formatGoods(data.in) : hiddenLabel);

    // Set the production in label
    if(visible && data.hasOwnProperty('productionIn')) {
        factoryProductionInLabel.html('− ' + formatGoods(data.productionIn) + ' / tick');
        factoryProductionInLabel.show();
    } else if(!visible)
        factoryProductionInLabel.hide();

    // Set the out label
    if(!visible || data.hasOwnProperty('out'))
        factoryOutLabel.html(visible ? formatGoods(data.out) : hiddenLabel);

    // Set the production out label
    if(visible && data.hasOwnProperty('productionOut')) {
        factoryProductionOutLabel.html('+ ' + formatGoods(data.productionOut) + ' / tick');
        factoryProductionOutLabel.show();
    } else if(!visible)
        factoryProductionOutLabel.hide();

    // Set the next level cost label
    if(!visible || data.hasOwnProperty('nextLevelCost'))
        factoryNextLevelCostLabel.html(canModify ? formatMoney(data.nextLevelCost, true) : '?');
}

/**
 * Toggle full screen mode for the app.
 */
function toggleFullScreen() {
    if(!document.fullscreenElement && !document.mozFullScreenElement && !document.webkitFullscreenElement && !document.msFullscreenElement) {  // current working methods
        if(document.documentElement.requestFullscreen)
            document.documentElement.requestFullscreen();
        else if(document.documentElement.msRequestFullscreen)
            document.documentElement.msRequestFullscreen();
        else if(document.documentElement.mozRequestFullScreen)
            document.documentElement.mozRequestFullScreen();
        else if(document.documentElement.webkitRequestFullscreen)
            document.documentElement.webkitRequestFullscreen(Element.ALLOW_KEYBOARD_INPUT);
        else
            showNotification('Full screen is not supported on this device');
    } else {
        if(document.exitFullscreen)
            document.exitFullscreen();
        else if(document.msExitFullscreen)
            document.msExitFullscreen();
        else if(document.mozCancelFullScreen)
            document.mozCancelFullScreen();
        else if(document.webkitExitFullscreen)
            document.webkitExitFullscreen();
        else
            showNotification('Full screen is not supported on this device');
    }
}

// Flush all other pages when visiting the login/register page
$(document).bind('pageshow', function() {
    // Make sure the user is on a login/register page
    if(document.location.pathname.trim().match(/^\/(login|register)/) == null)
        return;

    // Flush all pages
    Dworek.utils.flushPages(undefined, false);
});

/**
 * Format a big number to make it more readable.
 *
 * @param {Number} num Number to format.
 * @returns {string} Formatted number.
 */
function formatBigNumber(num) {
    // Return zero for undefined/null values
    if(num === undefined || num === null)
        return '0';

    // Split the number by a dot (for decimal numbers)
    const parts = num.toString().split(".");

    // Put comma's in it
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '&#8239;');

    // Join the decimal number and return
    return parts.join(".");
}


/**
 * Format the given number of bytes into a human readable string.
 *
 * @param {Number} bytes Number of bytes.
 * @param {Number} [decimals=2] Number of decimals to show.
 * @return {String} Readable string.
 */
function formatBytes(bytes, decimals) {
    // Constants
    const BASE = 1024;
    const SIZE_NOTATIONS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

    // Handle zero cases
    if(bytes === 0 || bytes === undefined || bytes === null)
        return '0 B';

    // Determine the number of decimal places to show
    const decimalPlaces = decimals || 2;

    // Determine the factor
    const factor = Math.floor(Math.log(bytes) / Math.log(BASE));

    // Create and return the readable string
    return parseFloat((bytes / Math.pow(BASE, factor)).toFixed(decimalPlaces)) + ' ' + SIZE_NOTATIONS[factor];
}

/**
 * Format the given number of nanoseconds into a human readable string.
 *
 * @param {Number} nano Number of nanoseconds.
 * @param {Number} [decimals=0] Number of decimals to show.
 * @return {String} Readable string.
 */
function formatNano(nano, decimals) {
    // Constants
    const BASE = 1000;
    const SIZE_NOTATIONS = ['ns', 'μs', 'ms', 's'];

    // Handle zero cases
    if(nano == 0)
        return '<1 ns';

    // Determine the number of decimal places to show
    const decimalPlaces = decimals || 0;

    // Determine the factor
    const factor = Math.floor(Math.log(nano) / Math.log(BASE));

    // Create and return the readable string
    var value = parseFloat((nano / Math.pow(BASE, factor)).toFixed(decimalPlaces));
    if(decimalPlaces == 0)
        value = Math.round(value);

    // Make the value readable and return it
    // return value + ' ' + SIZE_NOTATIONS[factor] + (value != 1 ? 's' : '');
    return value + ' ' + SIZE_NOTATIONS[factor];
}

/**
 * Format money.
 *
 * @param {Number} amount Amount of money.
 * @param {boolean} [prefixSign=true] True to prefix a money sign, false to not.
 * @returns {string} Formatted money string.
 */
function formatMoney(amount, prefixSign) {
    // Set the parameter defaults
    if(prefixSign == undefined)
        prefixSign = true;

    // Format the amount of money
    //noinspection JSValidateTypes
    amount = formatBigNumber(amount);

    // Return the number, prefix the money sign if specified
    // TODO: Supply the proper game ID
    return (prefixSign ? __('currency.sign') : '') + amount;
}

/**
 * Format the given amount of goods to make it better readable.
 *
 * @param {Number} amount Amount of goods.
 * @returns {string} Formatted amount of goods.
 */
function formatGoods(amount) {
    return formatBigNumber(amount);
}

// Nickname randomization
$(document).bind("pageinit", function() {
    // Get the login form element
    const loginFormElement = $('form#form-login');

    // Unbind the submit event
    loginFormElement.unbind('submit');
    loginFormElement.submit(function() {
        // Authenticate again when the next page is loaded
        $(document).one('pageshow', function() {
            // Re-authenticate, as the session might be properly authenticated now
            Dworek.realtime.startAuthentication(true, false);
        });
    });
});

// Ask for native notification permissions when the client is loaded
$(document).ready(function() {
    // Check whether we have support, this automatically asks the user for permission if native notifications are supported
    hasNativeNotificationSupport();
});

/**
 * A variable that stores the handle of the status update request timer when active.
 * @type {int|null}
 */
var statusUpdateRequestHandle = null;

/**
 * A chart to show the redis command count status.
 */
var statusChartRedisCommandCount = null;

/**
 * Send an application status update request to the main server.
 */
function sendApplicationStatusUpdateRequest() {
    Dworek.realtime.packetProcessor.sendPacket(PacketType.APP_STATUS_REQUEST, {});
}

// Update the map size when a page is shown
$(document).bind('pageshow', function() {
    // Make sure we're on the status page
    if(!Dworek.utils.isStatusPage()) {
        // Stop the status update timer if active
        if(statusUpdateRequestHandle !== null) {
            // Show a status message
            console.log('Stopping application status update request timer...');

            // Stop the request update timer
            clearInterval(statusUpdateRequestHandle);

            // Reset the status update request handle to null
            statusUpdateRequestHandle = null;
        }

        // Destroy all status charts
        for(var key in statusCharts) {
            // Make sure the key is valid
            if(!statusCharts.hasOwnProperty(key))
                continue;

            // Destroy the chart
            statusCharts[key].destroy();
        }

        // Reset the charts object
        statusCharts = {};

        // We're done, return
        return;
    }

    // Start a request update timer
    if(statusUpdateRequestHandle === null) {
        // Show a status message
        console.log('Starting application status update request timer...');

        // Create the timer and store it's handle
        statusUpdateRequestHandle = setInterval(sendApplicationStatusUpdateRequest, 1000);

        // Reset the last known application status
        appStatus = null;

        // Create the application memory chart
        createStatusChart('status-chart-server-memory-app', 'server.memory_app', {
            yAxis: {
                title: {
                    text: 'Application memory'
                },
                labels: {
                    formatter: function() {
                        return formatBytes(this.value);
                    },
                    step: 1
                },
            },
            tooltip: {
                formatter: buildChartTooltipFormatter(formatBytes)
            },
            series: [{
                name: 'Heap free'
            }, {
                name: 'Heap used'
            }, {
                name: 'Heap size'
            }, {
                name: 'Resident set'
            }, {
                name: 'External'
            }],
        });

        // Create the serer memory chart
        createStatusChart('status-chart-server-memory-system', 'server.memory_system', {
            yAxis: {
                title: {
                    text: 'System memory'
                },
                labels: {
                    formatter: function() {
                        return formatBytes(this.value);
                    }
                },
            },
            tooltip: {
                formatter: buildChartTooltipFormatter(formatBytes)
            },
            series: [{
                name: 'Free'
            }, {
                name: 'Used'
            }, {
                name: 'Total'
            }],
        });

        // Create the server load average chart
        createStatusChart('status-chart-server-load', 'server.loadavg', {
            yAxis: {
                title: {
                    text: 'System load'
                },
            },
            tooltip: {
                formatter: buildChartTooltipFormatter(function(val) {
                    return val.toFixed(3) + ' load';
                })
            },
            series: [{
                name: '1 minute load average'
            }, {
                name: '5 minutes load average'
            }, {
                name: '15 minutes load average'
            }],
        });

        // Create the server latency chart
        createStatusChart('status-chart-server-latency', 'server.latency', {
            yAxis: {
                type: 'logarithmic',
                title: {
                    text: 'Request latency'
                },
                labels: {
                    formatter: function() {
                        return formatNano(this.value);
                    }
                },
                allowDecimals: false,
            },
            tooltip: {
                formatter: buildChartTooltipFormatter(formatNano)
            },
            series: [{
                name: 'Max'
            }, {
                name: 'Min'
            }, {
                name: '50%-th'
            }, {
                name: '90%-th'
            }, {
                name: '99%-th'
            }],
        });

        // Create the realtime connections count chart
        createStatusChart('status-chart-realtime-connections', 'realtime.connections', {
            yAxis: {
                title: {
                    text: 'Connected clients'
                },
                allowDecimals: false,
            },
            tooltip: {
                formatter: buildChartTooltipFormatter(function(val) {
                    return val + ' clients';
                })
            },
            series: [{
                name: 'Connected clients'
            }],
        });

        // Create the loaded game count chart
        createStatusChart('status-chart-live-gameCount', 'live.gameCount', {
            yAxis: {
                title: {
                    text: 'Loaded games'
                },
                allowDecimals: false,
            },
            tooltip: {
                formatter: buildChartTooltipFormatter(function(val) {
                    return val + ' games';
                })
            },
            series: [{
                name: 'Loaded games'
            }],
        });

        // Create the Redis command count chart
        createStatusChart('status-chart-redis-commandCount', 'redis.commandCount', {
            yAxis: {
                title: {
                    text: 'Processed queries'
                },
                allowDecimals: false,
            },
            tooltip: {
                formatter: buildChartTooltipFormatter(function(val) {
                    return val + ' queries';
                })
            },
            series: [{
                name: 'Queries processed'
            }],
        });

        // Create the Redis key count chart
        createStatusChart('status-chart-redis-keyCount', 'redis.keyCount', {
            yAxis: {
                title: {
                    text: 'Cached fields'
                },
                allowDecimals: false,
            },
            tooltip: {
                formatter: buildChartTooltipFormatter(function(val) {
                    return val + ' fields';
                })
            },
            series: [{
                name: 'Cached fields'
            }],
        });

        // Create the Redis memory chart
        createStatusChart('status-chart-redis-memory', 'redis.memory', {
            yAxis: {
                title: {
                    text: 'Cache memory'
                },
                labels: {
                    formatter: function() {
                        return formatBytes(this.value);
                    }
                },
            },
            tooltip: {
                formatter: buildChartTooltipFormatter(formatBytes)
            },
            series: [{
                name: 'Used'
            }, {
                name: 'LUA'
            }, {
                name: 'Rss'
            }, {
                name: 'Peak'
            }],
        });

        // Create the internal cache query count chart
        createStatusChart('status-chart-cache-queryCount', 'cache.queryCount', {
            yAxis: {
                title: {
                    text: 'Processed queries'
                },
                allowDecimals: false,
            },
            tooltip: {
                formatter: buildChartTooltipFormatter(function(val) {
                    return val + ' queries';
                })
            },
            series: [{
                name: 'Queries processed'
            }],
        });

        // Create the cache object/field count chart
        createStatusChart('status-chart-cache-count', 'cache.count', {
            yAxis: {
                title: {
                    text: 'Amount'
                },
                allowDecimals: false,
            },
            tooltip: {
                formatter: buildChartTooltipFormatter()
            },
            series: [{
                name: 'Cached objects'
            }, {
                name: 'Cached fields'
            }],
        });
    }
});

/**
 * Last known application status object.
 */
var appStatus = null;

/**
 * Object of status charts.
 */
var statusCharts = {};

/**
 * Default configuration for the status charts.
 */
const statusChartsDefaults =  {
    chart: {
        type: 'spline',
        animation: Highcharts.svg,
        marginRight: 10,
    },
    title: {
        text: ''
    },
    xAxis: {
        type: 'datetime',
        tickPixelInterval: 100
    },
    yAxis: {
        plotLines: [{
            value: 0,
            width: 1,
            color: '#808080'
        }]
    },
    plotOptions: {
        spline: {
            marker: {
                enabled: false
            }
        }
    },
    tooltip: {
        formatter: buildChartTooltipFormatter()
    },
    legend: {
        enabled: false
    },
    exporting: {
        enabled: false
    },
    credits: false,
};

/**
 * Build a tooltip formatter for a chart.
 *
 * @param {function} Formatter function.
 *
 * @return Formatter function.
 */
function buildChartTooltipFormatter(formatter) {
    return function () {
        // Define a default formatter
        if(formatter === undefined)
            formatter = function(val) {
                return val;
            };

        // Build the formatted string and return it
        return '<b>' + this.series.name + '</b><br/>' +
            Highcharts.dateFormat('%H:%M:%S', this.x) + '<br/>' + formatter(this.y);
    }
}

/**
 * Create a status chart.
 *
 * @param {string} id ID of the div to render the chart in.
 * @param {string} chartNamespace Namespace of the chart.
 * @param {object} options Chart specific options.
 *
 * @return Chart object.
 */
function createStatusChart(id, chartNamespace, options) {
    // Parse the namespace
    chartNamespace = chartNamespace.replace(".", "_");

    // Merge the chart options
    var chartOptions = jQuery.extend({}, statusChartsDefaults, options);

    // Create and store the chart, also return it
    return statusCharts[chartNamespace] = Highcharts.chart(id, chartOptions);
}

/**
 * Add new points to a status chart.
 *
 * @param {string} chartNamespace Namespace of the chart.
 * @param {array|mixed} values Array of values to add, or a single value.
 */
function addStatusChartValues(chartNamespace, values) {
    // Parse the namespace
    chartNamespace = chartNamespace.replace(".", "_");

    // Make sure the chart is available
    if(statusCharts[chartNamespace] === null || statusCharts[chartNamespace] === undefined)
        return;

    // Convert the values in an array if it isn't an array right now
    if(!Array.isArray(values))
        values = [values];

    // Loop through the values, and add them to the chart
    for(var i = 0; i < values.length; i++) {
        // Get the current time
        var time = (new Date()).getTime();

        // Determine whether this is the last value
        var isLast = i == values.length - 1;

        // Add the new point
        statusCharts[chartNamespace].series[i].addPoint([time, values[i]], isLast);

        // Remove old entries
        if(statusCharts[chartNamespace].series[i].data.length > 30)
            statusCharts[chartNamespace].series[i].removePoint(0, false);
    }
}

// Register an application status update handler
Dworek.realtime.packetProcessor.registerHandler(PacketType.APP_STATUS_UPDATE, function(packet) {
	// Make sure the required fields are available
    if(!packet.hasOwnProperty('status')) {
		throw new Error('Received malformed packet, missing status data in application update packet');
		return;
	}

	// Get the status
	var status = packet.status;

	// Update the Redis status
    // TODO: Update status-user-valid
    // TODO: Update status-user-firstName
    $('table.status-cluster tr td span.status-cluster-machineCount').html(status.cluster.serverCount);
    $('table.status-cluster tr td span.status-cluster-serverCount').html(status.cluster.serverCount);
    $('table.status-cluster tr td span.status-cluster-workerCount').html(status.cluster.workerCount);
    $('table.status-worker tr td span.status-worker-id').html(status.worker.id);
    $('table.status-worker tr td span.status-worker-pid').html(status.worker.pid);
    $('table.status-worker tr td span.status-worker-uptime').html(formatBigNumber(status.worker.uptime));
    $('table.status-server tr td span.status-server-cpus').html(status.server.cpus.length);
    $('table.status-server tr td span.status-server-memory-app-heapFree').html(status.server.memory_app.heapFreeHuman);
    $('table.status-server tr td span.status-server-memory-app-heapUsed').html(status.server.memory_app.heapUsedHuman);
    $('table.status-server tr td span.status-server-memory-app-heapTotal').html(status.server.memory_app.heapTotalHuman);
    $('table.status-server tr td span.status-server-memory-app-rss').html(status.server.memory_app.rssHuman);
    $('table.status-server tr td span.status-server-memory-system-free').html(status.server.memory_system.freeHuman);
    $('table.status-server tr td span.status-server-memory-system-used').html(status.server.memory_system.usedHuman);
    $('table.status-server tr td span.status-server-memory-system-total').html(status.server.memory_system.totalHuman);
    $('table.status-server tr td span.status-server-load-1').html(status.server.loadavgHuman[0]);
    $('table.status-server tr td span.status-server-load-5').html(status.server.loadavgHuman[1]);
    $('table.status-server tr td span.status-server-load-15').html(status.server.loadavgHuman[2]);
    $('table.status-server tr td span.status-server-latency-max').html(status.server.latencyHuman[0]);
    $('table.status-server tr td span.status-server-latency-min').html(status.server.latencyHuman[1]);
    $('table.status-server tr td span.status-server-latency-50').html(status.server.latencyHuman[2]);
    $('table.status-server tr td span.status-server-latency-90').html(status.server.latencyHuman[3]);
    $('table.status-server tr td span.status-server-latency-99').html(status.server.latencyHuman[4]);
    // TODO: Update status-live-status
    $('table.status-live tr td.status-live-gameCount').html(formatBigNumber(status.live.gameCount));
    // TODO: Update status-realtime-online
    $('table.status-realtime tr td.status-realtime-connections').html(formatBigNumber(status.realtime.connections));
    // TODO: Update status-web-online
    $('table.status-web tr td.status-web-uptime').html(formatBigNumber(status.web.uptime) + ' seconds');
    // TODO: Update status-mongo-online
    // TODO: Update status-redis-online
    $('table.status-redis tr td.status-redis-uptime').html(formatBigNumber(status.redis.uptime) + ' seconds');
    $('table.status-redis tr td.status-redis-commandCount').html(formatBigNumber(status.redis.commandCount));
    $('table.status-redis tr td.status-redis-keyCount').html(formatBigNumber(status.redis.keyCount));
    $('table.status-redis tr td.status-redis-memory-used').html(status.redis.memoryHuman);
    $('table.status-redis tr td.status-redis-memory-lua').html(status.redis.memoryLuaHuman);
    $('table.status-redis tr td.status-redis-memory-rss').html(status.redis.memoryRssHuman);
    $('table.status-redis tr td.status-redis-memory-peak').html(status.redis.memoryPeakHuman);
    $('table.status-cache tr td.status-cache-queryCount').html(formatBigNumber(status.cache.queryCount));
    $('table.status-cache tr td.status-cache-objectCount').html(formatBigNumber(status.cache.objectCount));
    $('table.status-cache tr td.status-cache-fieldCount').html(formatBigNumber(status.cache.fieldCount));

    // Update the application memory chart
    addStatusChartValues('server.memory_app', [
        status.server.memory_app.heapFree,
        status.server.memory_app.heapUsed,
        status.server.memory_app.heapTotal,
        status.server.memory_app.rss,
        status.server.memory_app.external,
    ]);

    // Update the server memory chart
    addStatusChartValues('server.memory_system', [
        status.server.memory_system.free,
        status.server.memory_system.used,
        status.server.memory_system.total,
    ]);

    // Update the server load average chart (if changed)
    if(appStatus == null || appStatus.server.loadavg.toString() != status.server.loadavg.toString())
        addStatusChartValues('server.loadavg', status.server.loadavg);

    // Update the server latency chart
    addStatusChartValues('server.latency', status.server.latency);

    // Update the loaded game count chart
    addStatusChartValues('live.gameCount', status.live.gameCount);

    // Update the realtime connections chart
    addStatusChartValues('realtime.connections', status.realtime.connections);

    // Update the Redis command count chart
    if(appStatus !== null)
        addStatusChartValues('redis.commandCount', status.redis.commandCount - appStatus.redis.commandCount);

    // Update the Redis key count chart
    addStatusChartValues('redis.keyCount', status.redis.keyCount);

    // Update the Redis memory chart
    addStatusChartValues('redis.memory', [
        status.redis.memory,
        status.redis.memoryLua,
        status.redis.memoryRss,
        status.redis.memoryPeak
    ]);

    // Update the internal cache query count command count chart
    if(appStatus !== null)
        addStatusChartValues('cache.queryCount', status.cache.queryCount - appStatus.cache.queryCount);

    // Update the cached object/fields count chart
    addStatusChartValues('cache.count', [
        status.cache.objectCount,
        status.cache.fieldCount,
    ]);

    // Store the app status
    appStatus = status;
});

// Set up the toggleable collapsibles
$(document).bind("pageshow", function() {
    // Get the currently active page
    const activePage = getActivePage();

    // Find toggleable collapsibles
    activePage.find('.collapsible-toggle').each(function() {
        // Set the checkbox instance
        const checkbox = $(this);

        // Get the corresponding collapsible element
        const collapsibleElement = activePage.find(
            checkbox.data('collapsible-toggle') + ':lt(1)'
        );

        // Show or hide the collapsible accordingly
        if(checkbox.is(':checked'))
            collapsibleElement.show();
        else
            collapsibleElement.hide();

        // Update the state when the checkbox state is changed
        checkbox.change(function() {
            // Show or hide the collapsible
            if(checkbox.is(':checked')) {
                // Expand the collapsible
                collapsibleElement.collapsible('expand');

                // Slide down the collapsible to make it visible
                collapsibleElement.slideDown();

            } else
                collapsibleElement.slideUp();
        });
    });
});

// Configure logic on the custom actions page
$(document).bind("pageshow", function() {
    // Get the currently active page
    var activePage = getActivePage();

    // Make sure the execute button is available on this page
    var executeButton = activePage.find('a.action-custom-action-execute');

    // Return early if this isn't a custom action page
    if(executeButton.length <= 0)
        return;

    // Unbind all click events
    executeButton.unbind('click');

    // Execute the action when the button is pressed
    executeButton.click(function() {
        // Disable the execution button
        executeButton.addClass('ui-disabled');

        // Show the dialog box
        showDialog({
            title: 'Execute custom action',
            message: 'Are you sure you want to execute this custom action?<br><br>This operation can\'t be undone.',
            actions: [
                {
                    text: 'Yes, execute',
                    icon: 'zmdi zmdi-flare',
                    state: 'primary',
                    action: function() {
                        // Get the custom action properties
                        const properties = getCustomActionProperties(activePage);

                        // Send a packet with the properties
                        Dworek.realtime.packetProcessor.sendPacket(PacketType.SPECIAL_CUSTOM_ACTION_EXECUTE, {
                            game: Dworek.utils.getGameId(),
                            properties: properties
                        });
                    }
                },
                {
                    text: 'No, cancel',
                    icon: 'zmdi zmdi-undo',
                    state: 'warning'
                }
            ]

        }, function() {
            // Set a timeout, then enable the button again
            setTimeout(function() {
                // Enable the execution button again
                executeButton.removeClass('ui-disabled');
            }, 1500);
        });

        return false;
    });

    // Get the field amount type element
    var fieldAmountMethodElement = activePage.find('select#field-amount-method');
    var fieldAmountTypeElement = activePage.find('select#field-amount-type');
    var fieldAmountValueLabel = activePage.find('label[for=field-amount-amount]');
    var fieldAmountValueElement = activePage.find('input#field-amount-amount');

    // Update the amount label and slider
    var updateAmountValue = function() {
        var isSetTo = fieldAmountMethodElement.val() === 'set';
        var percentage = fieldAmountTypeElement.val() === 'percentage';

        // Set the minimum value
        fieldAmountValueElement.prop('min', isSetTo ? 0 : 1);

        // Update the enabled/disabled state
        if(isSetTo) {
            // Change the method to specific
            fieldAmountTypeElement.val('fixed');
            percentage = false;

            // Disable the amount type
            fieldAmountTypeElement.addClass('ui-disabled');

        } else
            // Enable the amount type
            fieldAmountTypeElement.removeClass('ui-disabled');

        // Disable the typeelement accordingly
        fieldAmountTypeElement.prop('disabled', isSetTo);

        // Update the labels and the max
        fieldAmountValueLabel.text(percentage ? 'Percentage:' : 'Specific amount:');
        fieldAmountValueElement.prop('max', percentage ? 500 : 10000000).slider('refresh');
    };

    // Update on change, and update once now
    fieldAmountMethodElement.change(updateAmountValue);
    fieldAmountTypeElement.change(updateAmountValue);
    updateAmountValue();
});

// Configure logic on the custom actions page
$(document).bind("pageshow", function() {
    // Get the currently active page
    var activePage = getActivePage();

    // Return early if this isn't a custom action page
    if(activePage.find('a.action-aura-expense-1').length <= 0)
        return;

    // A helper function to send a special action
    // Callback: err, hasSent
    var sendSpecialAction = function(properties, showConfirmation, callback) {
        // Ask for confirmation
        if(showConfirmation === undefined || showConfirmation === null || showConfirmation)
            showDialog({
                title: 'Execute special action',
                message: 'Are you sure you want to execute this special action?<br><br>This operation can\'t be undone.',
                actions: [
                    {
                        text: 'Yes, execute',
                        icon: 'zmdi zmdi-flare',
                        state: 'primary',
                        value: true,
                        action: function() {
                            // Send a packet with the properties
                            Dworek.realtime.packetProcessor.sendPacket(PacketType.SPECIAL_CUSTOM_ACTION_EXECUTE, {
                                game: Dworek.utils.getGameId(),
                                properties: properties
                            });
                        }
                    },
                    {
                        text: 'No, cancel',
                        icon: 'zmdi zmdi-undo',
                        state: 'warning'
                    }
                ]
            }, function(result) {
                // Call the callback
                if(callback !== undefined)
                    callback(null, result === true);
            });

        else {
            // Send a packet with the properties
            Dworek.realtime.packetProcessor.sendPacket(PacketType.SPECIAL_CUSTOM_ACTION_EXECUTE, {
                game: Dworek.utils.getGameId(),
                properties: properties
            });

            // Call the callback
            if(callback !== undefined)
                callback(null, true);
        }

        return false;
    };

    // Set up the aura of expense
    var actionAuraExpense = {
        filters: {
            playerRange: {
                limit: 1,
                order: 'asc',
                orderBy: 'distance'
            }
        },
        units: {
            money: true,
            in: false,
            out: false,
            strength: false
        },
        amounts: {
            method: 'subtract',
            type: 'percentage',
            amount: 30
        },
        message: {
            type: 'custom',
            customMessage: 'You\'ve been affected by an aura of expense!\n\nYou\'ve lost some money.'
        }
    };

    // Link the expense aura buttons
    activePage.find('a.action-aura-expense-1').click(function() {
        actionAuraExpense.filters.playerRange.limit = 1;
        actionAuraExpense.filters.playerRange.order = 'asc';
        sendSpecialAction(actionAuraExpense);
        return false;
    });
    activePage.find('a.action-aura-expense-2').click(function() {
        actionAuraExpense.filters.playerRange.limit = 2;
        actionAuraExpense.filters.playerRange.order = 'asc';
        sendSpecialAction(actionAuraExpense);
        return false;
    });
    activePage.find('a.action-aura-expense-3').click(function() {
        actionAuraExpense.filters.playerRange.limit = 3;
        actionAuraExpense.filters.playerRange.order = 'asc';
        sendSpecialAction(actionAuraExpense);
        return false;
    });
    activePage.find('a.action-aura-expense-4').click(function() {
        actionAuraExpense.filters.playerRange.limit = 1;
        actionAuraExpense.filters.playerRange.order = 'desc';
        sendSpecialAction(actionAuraExpense);
        return false;
    });
    activePage.find('a.action-aura-expense-5').click(function() {
        actionAuraExpense.filters.playerRange.limit = 2;
        actionAuraExpense.filters.playerRange.order = 'desc';
        sendSpecialAction(actionAuraExpense);
        return false;
    });

    // Set up the aura of luck
    var actionAuraLuck = {
        filters: {
            playerRange: {
                limit: 1,
                order: 'asc',
                orderBy: 'distance'
            }
        },
        units: {
            money: true,
            in: true,
            out: true,
            strength: false
        },
        amounts: {
            method: 'add',
            type: 'percentage',
            amount: 10
        },
        message: {
            type: 'custom',
//            customMessage: 'You\'ve been affected by an aura of luck!\n\n' +
//                'Your money, ' + __('in.names', { game: Dworek.utils.getGameId() }) +
//                ' and ' + __('out.names', { game: Dworek.utils.getGameId() }) +
//                ' have been increased by 10%.'
            customMessage: 'You\'ve been affected by an aura of luck!\n\n' +
                'You\'ve lost 10% of all your inventory items..'
        }
    };

    // Link the luck aura buttons
    activePage.find('a.action-aura-luck-1').click(function() {
        actionAuraLuck.filters.playerRange.limit = 1;
        actionAuraLuck.filters.playerRange.order = 'asc';
        sendSpecialAction(actionAuraLuck);
        return false;
    });
    activePage.find('a.action-aura-luck-2').click(function() {
        actionAuraLuck.filters.playerRange.limit = 2;
        actionAuraLuck.filters.playerRange.order = 'asc';
        sendSpecialAction(actionAuraLuck);
        return false;
    });
    activePage.find('a.action-aura-luck-3').click(function() {
        actionAuraLuck.filters.playerRange.limit = 3;
        actionAuraLuck.filters.playerRange.order = 'asc';
        sendSpecialAction(actionAuraLuck);
        return false;
    });
    activePage.find('a.action-aura-luck-4').click(function() {
        actionAuraLuck.filters.playerRange.limit = 1;
        actionAuraLuck.filters.playerRange.order = 'desc';
        sendSpecialAction(actionAuraLuck);
        return false;
    });
    activePage.find('a.action-aura-luck-5').click(function() {
        actionAuraLuck.filters.playerRange.limit = 2;
        actionAuraLuck.filters.playerRange.order = 'desc';
        sendSpecialAction(actionAuraLuck);
        return false;
    });

    // Set up the aura of golden age
    var actionAuraGoldenAge = {
        filters: {
            playerRange: {
                limit: 1,
                order: 'asc',
                orderBy: 'distance'
            }
        },
        units: {
            money: true,
            in: false,
            out: false,
            strength: false
        },
        amounts: {
            method: 'add',
            type: 'fixed',
            amount: 5000
        },
        message: {
            type: 'custom',
            customMessage: 'You\'ve been affected by an aura of Golden Age!\n\nYou received some money!'
//            customMessage: 'You\'ve been affected by an aura of Golden Age!\n\nYou received ' + __('currency.sign', { game: Dworek.utils.getGameId() }) + '5000.'
        }
    };

    // Link the golden age aura buttons
    activePage.find('a.action-aura-goldenage-1').click(function() {
        actionAuraGoldenAge.filters.playerRange = {
            limit: 1,
            order: 'asc',
            orderBy: 'distance',
        };
        actionAuraGoldenAge.filters.range = {};
        sendSpecialAction(actionAuraGoldenAge);
        return false;
    });
    activePage.find('a.action-aura-goldenage-2').click(function() {
        actionAuraGoldenAge.filters.playerRange = {
            limit: 1,
            order: 'desc',
            orderBy: 'distance',
        };
        actionAuraGoldenAge.filters.range = {};
        sendSpecialAction(actionAuraGoldenAge);
        return false;
    });
    activePage.find('a.action-aura-goldenage-3').click(function() {
        actionAuraGoldenAge.filters.playerRange = {};
        actionAuraGoldenAge.filters.range = {
            range: 100,
            side: 'inside'
        };
        sendSpecialAction(actionAuraGoldenAge);
        return false;
    });
    activePage.find('a.action-aura-goldenage-4').click(function() {
        actionAuraGoldenAge.filters.playerRange = {};
        actionAuraGoldenAge.filters.range = {
            range: 500,
            side: 'inside'
        };
        sendSpecialAction(actionAuraGoldenAge);
        return false;
    });
    activePage.find('a.action-aura-goldenage-5').click(function() {
        actionAuraGoldenAge.filters.playerRange = {};
        actionAuraGoldenAge.filters.range = {
            range: 2000,
            side: 'inside'
        };
        sendSpecialAction(actionAuraGoldenAge);
        return false;
    });

    // Set up the aura of psychopathy
    var actionAuraPsycho = {
        filters: {
            playerRange: {
                limit: 1,
                order: 'asc',
                orderBy: 'distance'
            }
        },
        units: {
            money: true,
            in: true,
            out: true,
            strength: false
        },
        amounts: {
            method: 'add',
            type: 'percentage',
            amount: 10
        },
        message: {
            type: 'custom',
            customMessage: 'You\'ve been affected by an aura of psychopathy!\n\n' +
                'Some of your inventory units seem to have been changed.'
//            customMessage: 'You\'ve been affected by an aura of psychopathy!\n\n' +
//                'Your money, ' + __('in.names', { game: Dworek.utils.getGameId() }) +
//                ' and ' + __('out.names', { game: Dworek.utils.getGameId() }) + 
//                ' have been increased by 10%.'
        }
    };

    // Link the psychopathy aura buttons
    activePage.find('a.action-aura-psycho-1').click(function() {
        actionAuraPsycho.units = {
            money: false,
            in: true,
            out: false,
            strength: false
        };
        actionAuraPsycho.amounts = {
            method: 'set',
            type: 'fixed',
            amount: 0
        };
        sendSpecialAction(actionAuraPsycho);
        return false;
    });
    activePage.find('a.action-aura-psycho-2').click(function() {
        actionAuraPsycho.units = {
            money: false,
            in: true,
            out: false,
            strength: false
        };
        actionAuraPsycho.amounts = {
            method: 'subtract',
            type: 'percentage',
            amount: 75
        };
        sendSpecialAction(actionAuraPsycho);
        return false;
    });
    activePage.find('a.action-aura-psycho-3').click(function() {
        actionAuraPsycho.units = {
            money: false,
            in: false,
            out: true,
            strength: false
        };
        actionAuraPsycho.amounts = {
            method: 'set',
            type: 'fixed',
            amount: 0
        };
        sendSpecialAction(actionAuraPsycho);
        return false;
    });
    activePage.find('a.action-aura-psycho-4').click(function() {
        actionAuraPsycho.units = {
            money: false,
            in: false,
            out: true,
            strength: false
        };
        actionAuraPsycho.amounts = {
            method: 'subtract',
            type: 'percentage',
            amount: 75
        };
        sendSpecialAction(actionAuraPsycho);
        return false;
    });
    activePage.find('a.action-aura-psycho-5').click(function() {
        actionAuraPsycho.units = {
            money: true,
            in: false,
            out: false,
            strength: false
        };
        actionAuraPsycho.amounts = {
            method: 'subtract',
            type: 'percentage',
            amount: 30
        };
        sendSpecialAction(actionAuraPsycho);
        return false;
    });
    activePage.find('a.action-aura-psycho-6').click(function() {
        actionAuraPsycho.units = {
            money: false,
            in: false,
            out: false,
            strength: true
        };
        actionAuraPsycho.amounts = {
            method: 'subtract',
            type: 'percentage',
            amount: 40
        };
        sendSpecialAction(actionAuraPsycho);
        return false;
    });
    activePage.find('a.action-aura-psycho-7').click(function() {
        actionAuraPsycho.units = {
            money: true,
            in: true,
            out: true,
            strength: true
        };
        actionAuraPsycho.amounts = {
            method: 'subtract',
            type: 'percentage',
            amount: 20
        };
        sendSpecialAction(actionAuraPsycho);
        return false;
    });

    // Set up the nerf for the richest player
    var actionNerfPlayerRichest = {
        filters: {
            playerRange: {
                limit: 1,
                order: 'desc',
                orderBy: 'money'
            }
        },
        units: {
            money: false,
            in: false,
            out: false,
            strength: false
        },
        amounts: {
            method: 'subtract',
            type: 'percentage',
            amount: 50
        },
        message: {
            type: 'custom',
            customMessage: 'You\'ve been affected by a special force!\n\n' +
                'You\'ve lost some of your items in inventory items.'
        }
    };

    // Link the nerf player richest buttons
    activePage.find('a.action-nerf-player-richest-1').click(function() {
        actionNerfPlayerRichest.units = {
            money: false,
            in: true,
            out: false,
            strength: false
        };
        sendSpecialAction(actionNerfPlayerRichest);
        return false;
    });
    activePage.find('a.action-nerf-player-richest-2').click(function() {
        actionNerfPlayerRichest.units = {
            money: false,
            in: false,
            out: true,
            strength: false
        };
        sendSpecialAction(actionNerfPlayerRichest);
        return false;
    });
    activePage.find('a.action-nerf-player-richest-3').click(function() {
        actionNerfPlayerRichest.units = {
            money: true,
            in: false,
            out: false,
            strength: false
        };
        sendSpecialAction(actionNerfPlayerRichest);
        return false;
    });

    // Set up the nerf for the poorest team
    var actionNerfTeamRichest = {
        filters: {
            playerRange: {
                limit: 1,
                order: 'desc',
                orderBy: 'money'
            }
        },
        units: {
            money: false,
            in: false,
            out: false,
            strength: false
        },
        amounts: {
            method: 'subtract',
            type: 'percentage',
            amount: 50
        },
        message: {
            type: 'custom',
            customMessage: 'You\'ve been affected by a special force!\n\n' +
                'You\'ve lost some of your items in inventory items.'
        }
    };

    // Link the nerf team richest buttons
    activePage.find('a.action-nerf-team-richest-1').click(function() {
        actionNerfTeamRichest.filters.units = {
            money: true,
            in: false,
            out: false,
            strength: false
        };
        actionNerfTeamRichest.filters.amounts = {
            method: 'subtract',
            type: 'percentage',
            amount: 35
        };
        sendSpecialAction(actionNerfTeamRichest);
        return false;
    });
    activePage.find('a.action-nerf-team-richest-2').click(function() {
        actionNerfTeamRichest.filters.units = {
            money: false,
            in: false,
            out: true,
            strength: false
        };
        actionNerfTeamRichest.filters.amounts = {
            method: 'subtract',
            type: 'percentage',
            amount: 35
        };
        sendSpecialAction(actionNerfTeamRichest);
        return false;
    });
    activePage.find('a.action-nerf-team-richest-3').click(function() {
        actionNerfTeamRichest.filters.units = {
            money: false,
            in: true,
            out: false,
            strength: false
        };
        actionNerfTeamRichest.filters.amounts = {
            method: 'set',
            type: 'fixed',
            amount: 0
        };
        sendSpecialAction(actionNerfTeamRichest);
        return false;
    });

    // Set up the boost for the poorest players
    var actionBoostPlayerPoorest = {
        filters: {
            playerRange: {
                limit: 1,
                order: 'asc',
                orderBy: 'money'
            }
        },
        units: {
            money: true,
            in: false,
            out: false,
            strength: false
        },
        amounts: {
            method: 'add',
            type: 'percentage',
            amount: 200
        },
        message: {
            type: 'custom',
            customMessage: 'You\'ve been affected by a special force!\n\n' +
                'Your money has mysteriously tripled!'
        }
    };

    // Link the boost poorest player buttons
    activePage.find('a.action-boost-player-poorest-1').click(function() {
        actionBoostPlayerPoorest.filters.playerRange.limit = 1;
        sendSpecialAction(actionBoostPlayerPoorest);
        return false;
    });
    activePage.find('a.action-boost-player-poorest-2').click(function() {
        actionBoostPlayerPoorest.filters.playerRange.limit = 2;
        sendSpecialAction(actionBoostPlayerPoorest);
        return false;
    });
    activePage.find('a.action-boost-player-poorest-3').click(function() {
        actionBoostPlayerPoorest.filters.playerRange.limit = 3;
        sendSpecialAction(actionBoostPlayerPoorest);
        return false;
    });
    activePage.find('a.action-boost-player-poorest-4').click(function() {
        actionBoostPlayerPoorest.filters.playerRange.limit = 4;
        sendSpecialAction(actionBoostPlayerPoorest);
        return false;
    });

    // Set up the boost for the poorest teams
    var actionBoostTeamPoorest = {
        filters: {
            teamRange: {
                limit: 1,
                order: 'asc',
                orderBy: 'money'
            }
        },
        units: {
            money: true,
            in: false,
            out: false,
            strength: false
        },
        amounts: {
            method: 'add',
            type: 'percentage',
            amount: 100
        },
        message: {
            type: 'custom',
            customMessage: 'You\'ve been affected by a special force!\n\n' +
                'Your money has mysteriously doubled, ' +
                'and you\'ve found some additional inventory units.'
//            customMessage: 'You\'ve been affected by a special force!\n\n' +
//                'Your money has mysteriously doubled, ' +
//                'and you\'ve found some additional ' + __('in.names', { game: Dworek.utils.getGameId() }) + '.'
        }
    };

    // Link the boost poorest team buttons
    activePage.find('a.action-boost-team-poorest-1').click(function() {
        actionBoostTeamPoorest.filters.teamRange.limit = 1;
        actionBoostTeamPoorest.units.money = true;
        actionBoostTeamPoorest.units.in = false;
        actionBoostTeamPoorest.amounts.amount = 100;
        sendSpecialAction(actionBoostTeamPoorest, function(err, hasSent) {
            if(err === null && hasSent) {
                actionBoostTeamPoorest.units.money = false;
                actionBoostTeamPoorest.units.in = true;
                actionBoostTeamPoorest.amounts.amount = 40;
                sendSpecialAction(actionBoostTeamPoorest, false);
            }
        });
        return false;
    });
    activePage.find('a.action-boost-team-poorest-2').click(function() {
        actionBoostTeamPoorest.filters.teamRange.limit = 2;
        actionBoostTeamPoorest.units.money = true;
        actionBoostTeamPoorest.units.in = false;
        actionBoostTeamPoorest.amounts.amount = 100;
        sendSpecialAction(actionBoostTeamPoorest, function(err, hasSent) {
            if(err === null && hasSent) {
                actionBoostTeamPoorest.units.money = false;
                actionBoostTeamPoorest.units.in = true;
                actionBoostTeamPoorest.amounts.amount = 40;
                sendSpecialAction(actionBoostTeamPoorest, false);
            }
        });
        return false;
    });
    activePage.find('a.action-boost-team-poorest-3').click(function() {
        actionBoostTeamPoorest.filters.teamRange.limit = 3;
        actionBoostTeamPoorest.units.money = true;
        actionBoostTeamPoorest.units.in = false;
        actionBoostTeamPoorest.amounts.amount = 100;
        sendSpecialAction(actionBoostTeamPoorest, function(err, hasSent) {
            if(err === null && hasSent) {
                actionBoostTeamPoorest.units.money = false;
                actionBoostTeamPoorest.units.in = true;
                actionBoostTeamPoorest.amounts.amount = 40;
                sendSpecialAction(actionBoostTeamPoorest, false);
            }
        });
        return false;
    });
});

/**
 * Create and get an object with all the properties of the custom action
 * configured on the current page.
 *
 * @param page Page element the properties are on.
 *
 * @return {Object} Object with all properties.
 */
function getCustomActionProperties(page) {
    // Create the base object
    var properties = {
        filters: {},
        units: {
            in: false,
            out: false,
            money: false,
            strength: false
        },
        amounts: {
            type: null,
            amount: 0
        },
        message: {
            type: 'dynamic'
        }
    };

    // Player range properties
    if(page.find('#field-selector-player-range-enable').val() === 'true') {
        properties.filters.playerRange = {
            limit: parseInt(page.find('#field-selector-player-range-limit').val()),
            order: page.find('#field-selector-player-range-order').val(),
            orderBy: page.find('#field-selector-player-range-order-by').val()
        };
    }

    // Team range properties
    if(page.find('#field-selector-team-range-enable').val() === 'true') {
        properties.filters.teamRange = {
            limit: parseInt(page.find('#field-selector-team-range-limit').val()),
            order: page.find('#field-selector-team-range-order').val(),
            orderBy: page.find('#field-selector-team-range-order-by').val()
        };
    }

    // Specific player properties
    if(page.find('#field-selector-player-enable').val() === 'true') {
        // Build the object
        properties.filters.specificPlayers = {
            players: []
        };

        // Find the checkboxes and loop through them
        page.find('input.field-selector-player-user').each(function() {
            // Return early if the checkbox isn't checked
            if(!$(this).is(':checked'))
                return;

            // Define the checkbox prefix
            const CHECKBOX_PREFIX = 'field-selector-player-user-';

            // Get the ID
            const userId = $(this).attr('id');

            // The ID must start with the known prefix, return early if it doesn't
            if(!userId.substring(0, CHECKBOX_PREFIX.length) === CHECKBOX_PREFIX)
                return;

            // Get the ID, parse it and push it into the array
            properties.filters.specificPlayers.players.push(
                userId.substring(CHECKBOX_PREFIX.length).trim().toLowerCase()
            );
        });
    }

    // Specific team properties
    if(page.find('#field-selector-team-enable').val() === 'true') {
        // Build the object
        properties.filters.specificTeams = {
            teams: []
        };

        // Find the checkboxes and loop through them
        page.find('input.field-selector-team-team').each(function() {
            // Return early if the checkbox isn't checked
            if(!$(this).is(':checked'))
                return;

            // Define the checkbox prefix
            const CHECKBOX_PREFIX = 'field-selector-team-team-';

            // Get the ID
            const teamId = $(this).attr('id');

            // The ID must start with the known prefix, return early if it doesn't
            if(!teamId.substring(0, CHECKBOX_PREFIX.length) === CHECKBOX_PREFIX)
                return;

            // Get the ID, parse it and push it into the array
            properties.filters.specificTeams.teams.push(
                teamId.substring(CHECKBOX_PREFIX.length).trim().toLowerCase()
            );
        });
    }

    // Range limit properties
    if(page.find('#field-selector-range-enable').val() === 'true') {
        properties.filters.range = {
            range: parseInt(page.find('#field-selector-range-range').val()),
            side: page.find('#field-selector-range-side').val()
        };
    }

    // Player limit properties
    if(page.find('#field-selector-player-limit-enable').val() === 'true') {
        properties.filters.playerLimit = {
            limit: parseInt(page.find('#field-selector-player-limit-limit').val())
        };
    }

    // Set the units
    properties.units.money = page.find('#field-unit-money').is(':checked');
    properties.units.in = page.find('#field-unit-in').is(':checked');
    properties.units.out = page.find('#field-unit-out').is(':checked');
    properties.units.strength = page.find('#field-unit-strength').is(':checked');

    // Set the amounts
    properties.amounts.method = page.find('#field-amount-method').val();
    properties.amounts.type = page.find('#field-amount-type').val();
    properties.amounts.amount = parseInt(page.find('#field-amount-amount').val());

    // Set the message
    properties.message.type = page.find('#field-message-type').val();
    properties.message.customMessage = page.find('#field-message-custom').val();

    // Return the properties object
    return properties;
}

/**
 * Show the permission checkup dialog, to inform the user some permissions need to be accepted.
 */
function showPermissionCheckupDialog() {
    // Do not show the location checkup dialog on the permissions page
    if(getActivePage().find('.card-permission-location').length > 0)
        return;

    // Show a dialog, and ask whether the user is sure
    showDialog({
        title: 'Permissions checkup',
        message: 'You\'re almost set!<br><br>' +
            'Dworek uses some technologies additional permissions are required for.<br><br>' +
            'Please continue to ensure your device is ready to be played with.',
        actions: [
            {
                text: 'Continue',
                state: 'primary',
                action: function() {
                    Dworek.utils.navigateToPage('/permissions', true, true, 'flip');
                }
            },
            {
                text: 'Remind me later',
                state: 'warning'
            }
        ]
    });
}

$(document).bind("pageshow", function() {
    // Get the active page
    const page = getActivePage();

    // Find the location permissions card
    var locationPermissionCard = page.find('.card-permission-location');

    // Return if this isn't the permissions page
    if(locationPermissionCard.length <= 0)
        return;

    // Find the other permission cards
    var notificationPermissionCard = page.find('.card-permission-notifications');
    var vibrationPermissionCard = page.find('.card-permission-vibrations');

    // Keep track of what permissions still need to be asked about
    var askLocationPermission = true;
    var askNotificationPermission = true;
    var askVibrationPermission = true;

    // Function to call after permission states change, this method will send the user back when done
    var goBackWhenDone = function() {
        // Return early if we're still asking about permissions
        if(askLocationPermission || askNotificationPermission || askVibrationPermission)
            return;

//        // We're done, show a dialog
//        showDialog({
//            title: 'Success',
//            message: 'You\'re all set!<br><br>' +
//                'All required permissions have been set up successfully.',
//            actions: [
//                {
//                    text: 'Go back',
//                    state: 'primary'
//                }
//            ]
//        }, function() {
//            // Go one page back, after half a second
//            setTimeout(function() {
//                window.history.back();
//            }, 500);
//        });

        // Go one page back, after half a second
        setTimeout(function() {
            window.history.back();
        }, 500);
    };

    // Update the state of the location permission
    var updateLocationPermission = function(err, permission) {
        // Show errors
        if(err !== null)
            showError(err);

        // Hide the location permission box when we have permission
        if(permission) {
            locationPermissionCard.slideUp();
            askLocationPermission = false;
        }

        // Go back when done
        goBackWhenDone();
    };

    // Update the state of the notifications permission
    var updateNotificationPermission = function(err, permission, hide) {
        // Show errors
        if(err !== null)
            showError(err);

        // Hide the notifications permission box when we have permission or when the box should be hidden
        if(permission || hide) {
            notificationPermissionCard.slideUp();
            askNotificationPermission = false;
        }

        // Go back when done
        goBackWhenDone();
    };

    // Update the state of the vibration permission
    var updateVibrationPermission = function(err, permission, hide) {
        // Show errors
        if(err !== null)
            showError(err);

        // Hide the vibration permission box when we have permission or when the box should be hidden
        if(permission || hide) {
            vibrationPermissionCard.slideUp();
            askVibrationPermission = false;
        }

        // Go back when done
        goBackWhenDone();
    };

    // Check whether the user has location permissons
    hasLocationPermission(function(err, permission) {
        // Print errors to the console
        if(err !== null)
            console.log('Location permission check error: ' + err);

        // Update the location permission state
        updateLocationPermission(null, permission);
    });

    // Link the location permission request button
    locationPermissionCard.find('.permission-location-request').click(function() {
        requestLocationPermission(updateLocationPermission);
    });

    // Check whether the user has notification permissions
    hasNotificationPermission(function(err, permission) {
        // Print errors to the console
        if(err !== null)
            console.log('Notifications permission check error: ' + err);

        // Update the location permission state
        updateNotificationPermission(null, permission, false);
    });

    // Link the notification permission request button
    notificationPermissionCard.find('.permission-notifications-request').click(function() {
        requestNotificationPermission(function(err, permission) {
            updateNotificationPermission(err, permission, false);
        });
    });

    // Link the notification permission ignore button
    notificationPermissionCard.find('.permission-notifications-ignore').click(function() {
        updateNotificationPermission(null, false, true);
    });

    // Check whether the user has vibration permissions
    hasVibrationPermission(function(err, permission) {
        // Print errors to the console
        if(err !== null)
            console.log('Vibration permission check error: ' + err);

        // Update the location permission state
        updateVibrationPermission(null, permission, false);
    });

    // Link the vibration permission request button
    vibrationPermissionCard.find('.permission-vibrations-request').click(function() {
        requestVibrationPermission(function(err, permission) {
            updateVibrationPermission(err, permission, false);
        });
    });

    // Link the vibrations permission ignore button
    vibrationPermissionCard.find('.permission-vibrations-ignore').click(function() {
        updateVibrationPermission(null, false, true);
    });
});

/**
 * Check whether all required permissions are given.
 *
 * @param {function} callback (err, permission)
 */
function hasRequiredPermissions(callback) {
    // Don't check location permissions for Firefox <57 due to it not remembering approved permissions
    // Firefox will ask for permissions when required
    if(isFirefox() && getFirefoxVersionMajor() < 57) {
        if(callback !== undefined)
            callback(null, true);
        return;
    }

    // Check for all required permissions
    hasLocationPermission(callback);
}

/**
 * Check whether the user has location permissions.
 *
 * @param {function} callback (err, permission)
 */
function hasLocationPermission(callback) {
    // Call back false if geolocation isn't available
    if(!("geolocation" in navigator)) {
        if(callback !== undefined)
            callback("Location services are not supported in this browser.", false);
        return;
    }

    // Old method
    var oldMethod = function() {
        // TODO: Maybe not use this, because this immediatly asks for permission on the page?
        // Try to figure out permissions by requesting the current location
        navigator.geolocation.getCurrentPosition(function() {
            // We have permission, call back
            if(callback !== undefined)
                callback(null, true);

        }, function(status) {
            // Check if permission was denied, call back the result
            if(callback !== undefined)
                callback(null, status.code !== status.PERMISSION_DENIED);

        }, {
            enableHighAccuracy: false,
            timeout: 500,
        });
    }

    // Use the permissions API, use the old method for Firefox mobile due to some error
    if(navigator.permissions) {
        navigator.permissions.query({
            name: 'geolocation'
        }).then(function(status) {
            switch(status.state) {
                case 'granted':
                    if(callback !== undefined)
                        callback(null, true);
                    return;

                default:
                case 'prompt':
                    // Fall back to the old method for Firefox mobile in this case
                    if((isFirefox() && getFirefoxVersionMajor() < 57) || (isFirefox() && isAndroid()) || isFennec()) {
                        console.warn('Falling back to old location permission check method, due to a Firefox related issue...');
                        oldMethod();
                        return;
                    }

                    // Call back
                    if(callback !== undefined)
                        callback(null, false);
                    return;

                case 'denied':
                    if(callback !== undefined)
                        callback('Permission for location services has been denied.<br><br>You must manually unblock or allow permission to location services for this website in your browser.', false);
                    return;
            }
        });
        return;
    }

    // Fall back on the old method
    console.warn('Falling back to old location permission check method, permission API not supported...');
    oldMethod();
}

/**
 * Request for location permissions with a nice popup.
 *
 * @param {function} callback (err, permission)
 */
function requestLocationPermission(callback) {
    // Call back false if geolocation isn't available
    if(!("geolocation" in navigator)) {
        if(callback !== undefined)
            callback("Location services are not supported in this browser.", false);
        return;
    }

    // Show a notification
    showDialog({
        title: 'Location permissions',
        message: 'Please accept the permission request when it comes up.<br><br>If no request comes up within 5 seconds, you need to manually allow location service permissions for this website in your browser.',
        actions: [
            {
                text: 'Ok'
            }
        ]
    });

    // Ask the user for geolocation permissions
    navigator.geolocation.getCurrentPosition(function() {
        // We have permission, call back
        if(callback !== undefined)
            callback(null, true);

    }, function(status) {
        // Check if permission was denied, call back the result
        if(status.code === status.PERMISSION_DENIED) {
            if(callback !== undefined)
                callback('Permission for location services have been denied.<br><br>You must manually unblock or allow permission to location services for this website in your browser.', false);
            return;
        }

        // Call back
        if(callback !== undefined)
            callback(null, true);

    }, {
        enableHighAccuracy: false,
        timeout: 500,
    });
}

/**
 * Check whether we have notification permissions.
 *
 * @param {function} callback (err, permission)
 */
function hasNotificationPermission(callback) {
    // Return false if not supported
    if(!('Notification' in window) || !('requestPermission' in Notification)) {
        if(callback !== undefined)
            callback('Notifications are not supported in this browser.', false);
        return;
    }

    // Check whether we've permission
    switch(Notification.permission) {
        case 'granted':
            if(callback !== undefined)
                callback(null, true);
            return;

        case 'denied':
            if(callback !== undefined)
                callback('Permission for notifications has been denied.<br><br>You may manually allow permission to notifications for this website in your browser.', false);
            return;

        case 'default':
        default:
            if(callback !== undefined)
                callback(null, false);
            return;
    }
}

/**
 * Request for notification permissions with a nice popup.
 *
 * @param {function} callback (err, permission)
 */
function requestNotificationPermission(callback) {
    // Return false if not supported
    if(!('Notification' in window) || !('requestPermission' in Notification)) {
        if(callback !== undefined)
            callback('Notifications are not supported in this browser.', false);
        return;
    }

    // Show a notification
    showDialog({
        title: 'Notification permissions',
        message: 'Please accept the permission request when it comes up.<br><br>If no request comes up within 5 seconds, you need to manually allow notification permissions for this website in your browser.',
        actions: [
            {
                text: 'Ok'
            }
        ]
    });

    // Request the permission
    Notification.requestPermission().then(function(permission) {
        switch(permission) {
            default:
            case 'granted':
                // Call back
                if(callback !== undefined)
                    callback(null, true);

                // Show a demo demo notification
                if(isFirefox())
                    new Notification('Dworek', {
                        body: 'Notifications are now enabled!'
                    });
                return;

            case 'default':
                if(callback !== undefined)
                    callback(null, false);
                return;

            case 'denied':
                if(callback !== undefined)
                    callback('Permission for notifications has been denied.<br><br>You may manually allow permission to notifications for this website in your browser.', false);
                return;
        }
    });
}

/**
 * Check whether we have vibration permissions.
 * If not supported, permission true is returned.
 *
 * @param {function} callback (err, permission)
 */
function hasVibrationPermission(callback) {
    // Return false if not supported
    if(!("vibrate" in navigator)) {
        if(callback !== undefined)
            callback('Vibrations are not supported in this browser.', false);
        return;
    }

    // We're not sure, just call back false for now
    if(callback !== undefined)
        callback(null, false);
}

/**
 * Request vibration permissions.
 *
 * @param {function} callback (err, permission)
 */
function requestVibrationPermission(callback) {
    // Return false if not supported
    if(!("vibrate" in navigator)) {
        if(callback !== undefined)
            callback('Vibrations are not supported in this browser.', false);
        return;
    }

    // Vibrate the device
    navigator.vibrate(500);

    // Then call back
    callback(null, true);
}
