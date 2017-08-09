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

var ObjectId = require('mongodb').ObjectId;
var _ = require('lodash');

var config = require('../../../config');

var Core = require('../../../Core');
var GameUserDatabase = require('./GameUserDatabase');
var GameUserModel = require('./GameUserModel');
var RedisUtils = require('../../redis/RedisUtils');
var ModelInstanceManager = require('../ModelInstanceManager');
var CallbackLatch = require('../../util/CallbackLatch');
var MergeUtils = require('../../util/MergeUtils');
var GameModel = require('../game/GameModel');
var UserModel = require('../user/UserModel');

/**
 * Redis key root for cache.
 * @type {string}
 */
const REDIS_KEY_ROOT = 'model:gameuser';

/**
 * GameUserModelManager class.
 *
 * @class
 * @constructor
 */
var GameUserModelManager = function() {
    /**
     * Model instance manager.
     *
     * @type {ModelInstanceManager}
     */
    this._instanceManager = new ModelInstanceManager(GameUserModel);
};

/**
 * Check whether the given game user ID is valid and exists.
 *
 * @param {ObjectId|string} id The game user ID.
 * @param {GameUserModelManager~isValidGameIdCallback} callback Called with the result or when an error occurred.
 */
GameUserModelManager.prototype.isValidId = function(id, callback) {
    // Validate the object ID
    if(id === null || id === undefined || !ObjectId.isValid(id)) {
        // Call back
        callback(null, false);
        return;
    }

    // Create a callback latch
    var latch = new CallbackLatch();

    // Convert the ID to an ObjectID
    if(!(id instanceof ObjectId))
        id = new ObjectId(id);

    // TODO: Check an instance for this ID is already available?

    // Determine the Redis cache key
    var redisCacheKey = REDIS_KEY_ROOT + ':' + id.toString() + ':exists';

    // Check whether the game is valid through Redis if ready
    if(RedisUtils.isReady()) {
        // TODO: Update this caching method!
        // Fetch the result from Redis
        latch.add();
        RedisUtils.getConnection().get(redisCacheKey, function(err, result) {
            // Show a warning if an error occurred
            if(err !== null && err !== undefined) {
                // Print the error to the console
                console.error('A Redis error occurred while checking game validity, falling back to MongoDB.')
                console.error(new Error(err));

                // Resolve the latch and return
                latch.resolve();
                return;
            }

            // Resolve the latch if the result is undefined, null or zero
            if(result === undefined || result === null) {
                // Resolve the latch and return
                latch.resolve();
                return;
            }

            // The game is valid, create an instance and call back
            //noinspection JSCheckFunctionSignatures
            callback(null, result === '1');
        });
    }

    // Query the database and check whether the game is valid
    GameUserDatabase.layerFetchFieldsFromDatabase({_id: id}, {_id: true}, function(err, data) {
        // Call back errors
        if(err !== null && err !== undefined) {
            // Encapsulate the error and call back
            callback(new Error(err), null);
            return;
        }

        // Determine whether a game user exists for this ID
        const hasGameUser = data.length > 0;

        // Call back with the result
        callback(null, hasGameUser);

        // Store the result in Redis if ready
        if(RedisUtils.isReady()) {
            // Store the results
            RedisUtils.getConnection().setex(redisCacheKey, config.redis.cacheExpire, hasGameUser ? 1 : 0, function(err) {
                // Show a warning on error
                if(err !== null && err !== undefined) {
                    console.error('A Redis error occurred when storing Game User ID validity, ignoring.')
                    console.error(new Error(err));
                }
            });
        }
    });
};

/**
 * Called with the result or when an error occurred.
 *
 * @callback GameUserModelManager~isValidGameIdCallback
 * @param {Error|null} Error instance if an error occurred, null otherwise.
 * @param {boolean} True if a game with this ID exists, false if not.
 */

/**
 * Get a game user by it's game user ID.
 *
 * @param {ObjectId|string} id The game user ID.
 * @param {GameUserModelManager~getUserByIdCallback} callback Called with the game user or when an error occurred.
 */
GameUserModelManager.prototype.getUserById = function(id, callback) {
    // Store the current instance
    const self = this;

    // Check whether the game user ID is valid
    this.isValidId(id, function(err, result) {
        // Call back errors
        if(err !== null) {
            callback(err, null);
            return;
        }

        // Call back the result
        callback(null, result ? self._instanceManager.create(id) : null);
    })
};

/**
 * Called with the game user or when an error occurred.
 *
 * @callback GameUserModelManager~getUserByIdCallback
 * @param {Error|null} Error instance if an error occurred, null otherwise.
 * @param {GameUserModel|null} Game user instance, or null if no game was found for the given ID.
 */

/**
 * Get the number of users that joined the given games.
 * The options parameter can be used to specify constraints for the query.
 *
 * @param {GameModel} game Game to get the player count for.
 * @param {Object} [options] Options object for additional configurations and constraints.
 * @param {boolean|undefined} [options.players=] True if the result must include players, false if the result may not
 * include players. Undefined if this constraint shouldn't be checked.
 * @param {boolean|undefined} [options.spectators=] True if the result must include spectators, false if the result may
 * not include spectators. Undefined if this constraint shouldn't be checked.
 * @param {boolean|undefined} [options.specials=] True if the result must include special players, false if the result
 * may not include special players. Undefined if this constraint shouldn't be checked.
 * @param {boolean|undefined} [options.requested=] True if the result must include requested players, false if the result
 * may not include requested players. This property overrides other constraints when set to true.
 * @param {UserModel|undefined} [options.user=] User model instance if only a specific user should be counted.
 * @param {GameModelManager~getGameUserCountCallback} callback Called with the result or when an error occurred.
 */
GameUserModelManager.prototype.getGameUserCount = function(game, options, callback) {
    // Create an object with the default options
    const defaultOptions = {
        players: undefined,
        spectators: undefined,
        specials: undefined,
        requested: undefined
    };

    // Set the callback parameter if the options parameter is left out
    if(_.isFunction(options)) {
        // Set the callback parameter and set the options to the default
        //noinspection JSValidateTypes
        callback = options;
        options = {};
    }

    // Set the options to an empty object if it's undefined
    if(options === undefined)
        options = {};

    // Merge the options
    options = MergeUtils.merge(defaultOptions, options);

    // Create a callback latch
    var latch = new CallbackLatch();

    // Override the options if requested is set to true
    if(options.requested !== undefined && options.requested) {
        options.players = false;
        options.spectators = false;
        options.specials = false;
    }

    // Determine the Redis cache key for this function
    const redisCacheKey = REDIS_KEY_ROOT + ':getGamePlayerCount:' + game.getIdHex() + ':' +
        (options.players !== undefined ? (options.players ? '1' : '0') : '?') + ',' +
        (options.spectators !== undefined ? (options.spectators ? '1' : '0') : '?') + ',' +
        (options.specials !== undefined ? (options.specials ? '1' : '0') : '?') + ',' +
        (options.requested !== undefined ? (options.requested ? '1' : '0') : '?') +
        (options.user !== undefined ? ':user,' + options.user.getIdHex() : '') + ':count';

    // Check whether the game is valid through Redis if ready
    if(RedisUtils.isReady()) {
        // TODO: Update this caching method!
        // Fetch the result from Redis
        latch.add();
        RedisUtils.getConnection().get(redisCacheKey, function(err, result) {
            // Show a warning if an error occurred
            if(err !== null && err !== undefined) {
                // Print the error to the console
                console.error('A Redis error occurred while listing games, falling back to MongoDB.')
                console.error(new Error(err));

                // Resolve the latch and return
                latch.resolve();
                return;
            }

            // Resolve the latch if the result is undefined, null, zero or an empty string
            if(result === undefined || result === null) {
                // Resolve the latch and return
                latch.resolve();
                return;
            }

            // Call back the number of games
            callback(null, parseInt(result, 10));
        });
    }

    // Fetch the result from MongoDB when done with Redis
    latch.then(function() {
        // Create the query object
        var queryObject = {
            game_id: game.getId()
        };

        // Apply the requested property if it's set to false
        if(options.requested !== undefined && !options.requested) {
            queryObject.$or = [
                {team_id: {$ne: null}},
                {is_spectator: true},
                {is_special: true}
            ];
        }

        // Configure the fields object
        if(options.players !== undefined)
            queryObject.team_id = options.players ? {$ne: null} : null;
        if(options.spectators !== undefined)
            queryObject.is_spectator = options.spectators;
        if(options.specials !== undefined)
            queryObject.is_special = options.specials;

        // Limit the query to a specific user if set
        if(options.user !== undefined)
            queryObject.user_id = options.user.getId();

        // Query the database and check whether the game is valid
        GameUserDatabase.layerFetchFieldsFromDatabase(queryObject, {_id: true}, function(err, data) {
            // Call back errors
            if(err !== null && err !== undefined) {
                // Encapsulate the error and call back
                callback(new Error(err));
                return;
            }

            // Get the user count
            var userCount = data.length;

            // Call back with the user count
            callback(null, userCount);

            // Store the result in Redis if ready
            if(RedisUtils.isReady()) {
                // Store the results
                RedisUtils.getConnection().setex(redisCacheKey, config.redis.cacheExpire, userCount.toString(), function(err) {
                    // Show a warning on error
                    if(err !== null && err !== undefined) {
                        console.error('A Redis error occurred while storing game user count data ignoring.');
                        console.error(new Error(err));
                    }
                });
            }
        });
    });
};

/**
 * Called with the number of users for the given game with the given constraints.
 *
 * @callback GameModelManager~getGameUserCountCallback
 * @param {Error|null} Error instance if an error occurred, null otherwise.
 * @param {Number=} Number of users.
 */

/**
 * Get the number of users that joined the given game.
 *
 * @param {GameModel} game Game to count the users for.
 * @param {GameModelManager~getGameUserCountCallback} callback Called with the result or when an error occurred.
 */
GameUserModelManager.prototype.getGameUsersCount = function(game, callback) {
    // Create a callback latch
    var latch = new CallbackLatch();

    // Determine the Redis cache key for this function
    const redisCacheKey = REDIS_KEY_ROOT + ':getGameUsersCount:' + game.getIdHex();

    // Create a base object
    var gameUsersStateObject = {
        total: 0,
        totalAccepted: 0,
        players: 0,
        specials: 0,
        spectators: 0,
        requested: 0
    };

    // Check whether the game is valid through Redis if ready
    if(RedisUtils.isReady()) {
        // TODO: Update this caching method!
        // Fetch the result from Redis
        latch.add();
        RedisUtils.getConnection().get(redisCacheKey, function(err, result) {
            // Show a warning if an error occurred
            if(err !== null && err !== undefined) {
                // Print the error to the console
                console.error('A Redis error occurred while listing games, falling back to MongoDB.')
                console.error(new Error(err));

                // Resolve the latch and return
                latch.resolve();
                return;
            }

            // Resolve the latch if the result is undefined, null, zero or an empty string
            if(result === undefined || result === null) {
                // Resolve the latch and return
                latch.resolve();
                return;
            }

            // Split the result into it's parts
            var resultSplitted = result.split(';');

            // Fill the result object
            gameUsersStateObject.total = parseInt(resultSplitted[0], 10);
            gameUsersStateObject.totalAccepted = parseInt(resultSplitted[1], 10);
            gameUsersStateObject.players = parseInt(resultSplitted[2], 10);
            gameUsersStateObject.specials = parseInt(resultSplitted[3], 10);
            gameUsersStateObject.spectators = parseInt(resultSplitted[4], 10);
            gameUsersStateObject.requested = parseInt(resultSplitted[5], 10);

            // Call back with the result
            callback(null, gameUsersStateObject);
        });
    }

    // Fetch the result from MongoDB when done with Redis
    latch.then(function() {
        // Create the query object
        var queryObject = {
            game_id: game.getId()
        };

        // Create the projection object
        const projectionObject = {
            team_id: true,
            is_special: true,
            is_spectator: true
        };

        // Query the database and check whether the game is valid
        GameUserDatabase.layerFetchFieldsFromDatabase(queryObject, projectionObject, function(err, data) {
            // Call back errors
            if(err !== null && err !== undefined) {
                // Encapsulate the error and call back
                callback(new Error(err));
                return;
            }

            // Loop through the results
            data.forEach(function(gameUser) {
                // Increase the total
                gameUsersStateObject.total++;

                // Increase the player type values
                if(gameUser.team_id !== null && gameUser.team_id !== undefined)
                    gameUsersStateObject.players++;
                if(gameUser.is_special)
                    gameUsersStateObject.specials++;
                if(gameUser.is_spectator)
                    gameUsersStateObject.spectators++;

                // Increase the requested value if the player requested to join this game
                if((gameUser.team_id === null || gameUser.team_id === undefined) && !gameUser.is_special && !gameUser.is_spectator)
                    gameUsersStateObject.requested++;
                else
                    gameUsersStateObject.totalAccepted++;
            });

            // Call back the result object
            callback(null, gameUsersStateObject);

            // Store the result in Redis if ready
            if(RedisUtils.isReady()) {
                // Create a data string
                var dataString = gameUsersStateObject.total + ';' +
                    gameUsersStateObject.totalAccepted + ';' +
                    gameUsersStateObject.players + ';' +
                    gameUsersStateObject.specials + ';' +
                    gameUsersStateObject.spectators + ';' +
                    gameUsersStateObject.requested;

                // Store the results
                RedisUtils.getConnection().setex(redisCacheKey, config.redis.cacheExpire, dataString, function(err) {
                    // Show a warning on error
                    if(err !== null && err !== undefined) {
                        console.error('A Redis error occurred while storing the user count for a game, ignoring.');
                        console.error(new Error(err));
                    }
                });
            }
        });
    });
};

/**
 * @typedef {Object} GameUsersState
 * @property {Number} total Total number of users that joined this game.
 * @property {Number} totalAccepted Total number of users that were accepted for this game.
 * @property {Number} players Total number of users that joined a team.
 * @property {Number} specials Total number of users that are a special player.
 * @property {Number} spectators Total number of users that are a spectator.
 * @property {Number} requested Total number of users that requested to join the game.
 */

/**
 * Called with the number of users in the game.
 *
 * @callback GameModelManager~getGameUserCountCallback
 * @param {Error|null} Error instance if an error occurred, null otherwise.
 * @param {GameUsersState=} Number of users in the game.
 */

/**
 * Check whether the given user joined the given game.
 *
 * @param {GameModel} game The game to check in.
 * @param {UserModel} user The user to check for.
 * @param {Object} [options] Options object for additional configurations and constraints.
 * @param {boolean|undefined} [options.players=] True if the user must be in a team, false if the user may not be in a
 * team. Undefined to ignore this constraint.
 * @param {boolean|undefined} [options.spectators=] True if the user must be a spectator, false if the user may not be
 * a spectator. Undefined to ignore this constraint.
 * @param {boolean|undefined} [options.specials=] True if the user must be a special player, false if the user may not
 * be a special player. Undefined to ignore this constraint.
 * @param {boolean|undefined} [options.requested=] True if the user must be requested, false if the player must not be requested.
 * This option overrides other constraints when set to true. Undefined to ignore this constraint.
 * @param {GameModelManager~hasUserCallback} callback Called with the result or when an error occurred.
 */
GameUserModelManager.prototype.hasUser = function(game, user, options, callback) {
    // Merge the options
    options = MergeUtils.merge(options, {user});

    // Use the game user count function, determine and call back the result
    this.getGameUserCount(game, options, function(err, result) {
        // Call back errors
        if(err !== null) {
            callback(err);
            return;
        }

        // Call back the result
        callback(null, result > 0);
    })
};

/**
 * Called with the result or when an error occurred.
 *
 * @callback GameModelManager~hasUserCallback
 * @param {Error|null} Error instance if an error occurred, null otherwise.
 * @param {boolean=} True if the given user is in the given game, false if not.
 */

/**
 * Get the joined state for the given user in the given game.
 *
 * @param {GameModel} game Game.
 * @param {UserModel} user User.
 * @param {GameModelManager~getUserGameStateCallback} callback Called with the result or when an error occurred.
 */
GameUserModelManager.prototype.getUserGameState = function(game, user, callback) {
    // Create a callback latch
    var latch = new CallbackLatch();

    // Determine the Redis cache key for this function
    const redisCacheKey = REDIS_KEY_ROOT + ':getUserGameState:' + game.getIdHex() + ':' + user.getIdHex();

    // Create a UserGameState object
    var userGameState = {
        player: false,
        special: false,
        spectator: false,
        requested: false
    };

    // Check whether the game is valid through Redis if ready
    if(RedisUtils.isReady()) {
        // TODO: Update this caching method!
        // Fetch the result from Redis
        latch.add();
        RedisUtils.getConnection().get(redisCacheKey, function(err, result) {
            // Show a warning if an error occurred
            if(err !== null && err !== undefined) {
                // Print the error to the console
                console.error('A Redis error occurred while listing games, falling back to MongoDB.')
                console.error(new Error(err));

                // Resolve the latch and return
                latch.resolve();
                return;
            }

            // Resolve the latch if the result is undefined, null, zero or an empty string
            if(result === undefined || result === null) {
                // Resolve the latch and return
                latch.resolve();
                return;
            }

            // Split the result
            var dataSplitted = result.split(';');

            // Create a UserGameState object
            userGameState.player = dataSplitted[0] === '1';
            userGameState.special = dataSplitted[1] === '1';
            userGameState.spectator = dataSplitted[2] === '1';
            userGameState.requested = dataSplitted[3] === '1';

            // Call back with the result
            callback(null, userGameState);
        });
    }

    // Fetch the result from MongoDB when done with Redis
    latch.then(function() {
        // Create the query object
        const queryObject = {
            game_id: game.getId(),
            user_id: user.getId()
        };

        // Create the projection object
        const projectionObject = {
            team_id: true,
            is_special: true,
            is_spectator: true
        };

        // Query the database and check whether the game is valid
        GameUserDatabase.layerFetchFieldsFromDatabase(queryObject, projectionObject, function(err, data) {
            // Call back errors
            if(err !== null && err !== undefined) {
                // Encapsulate the error and call back
                callback(new Error(err));
                return;
            }

            // Parse the data from MongoDB if there is any
            if(data.length > 0) {
                // Loop through the result
                data.forEach(function(gameUser) {
                    userGameState.player = gameUser.team_id !== null && gameUser.team_id !== undefined;
                    userGameState.special = gameUser.is_special;
                    userGameState.spectator = gameUser.is_spectator;
                });

                // Determine the requested state
                if(!userGameState.player && !userGameState.special && !userGameState.spectator)
                    userGameState.requested = true;
            }

            // Call back the result object
            callback(null, userGameState);

            // Store the result in Redis if ready
            if(RedisUtils.isReady()) {
                // Create a data string
                var dataString = (userGameState.player ? '1' : '0') + ';' +
                    (userGameState.special ? '1' : '0') + ';' +
                    (userGameState.spectator ? '1' : '0') + ';' +
                    (userGameState.requested ? '1' : '0');

                // Store the results
                RedisUtils.getConnection().setex(redisCacheKey, config.redis.cacheExpire, dataString, function(err) {
                    // Show a warning on error
                    if(err !== null && err !== undefined) {
                        console.error('A Redis error occurred while storing user\'s game state, ignoring.');
                        console.error(new Error(err));
                    }
                });
            }
        });
    });
};

/**
 * @typedef {Object} UserGameState
 * @property {boolean} player True if the user is a player in a team, false if not.
 * @property {boolean} special True if the user is a special player in the game, false if not.
 * @property {boolean} spectator True if the user is a spectator, false if not.
 * @property {boolean} requested True if the user requested to join this game, false if not.
 */

/**
 * Called with the user's game state or when an error occurred.
 *
 * @callback GameModelManager~getUserGameStateCallback
 * @param {Error|null} Error instance if an error occurred, null otherwise.
 * @param {UserGameState=} User's game state.
 */

/**
 * Get a list of users that joined the given game.
 * The options parameter can be used to specify constraints for the query.
 *
 * @param {GameModel} game Game to get the players for.
 * @param {Object} [options] Options object for additional configurations and constraints.
 * @param {boolean|undefined} [options.players=] True if the result must include players, false if the result may not
 * include players. Undefined if this constraint shouldn't be checked.
 * @param {boolean|undefined} [options.spectators=] True if the result must include spectators, false if the result may
 * not include spectators. Undefined if this constraint shouldn't be checked.
 * @param {boolean|undefined} [options.specials=] True if the result must include special players, false if the result
 * may not include special players. Undefined if this constraint shouldn't be checked.
 * @param {boolean|undefined} [options.requested=] True if the result must include requested players, false if the result
 * may not include requested players. This property overrides other constraints when set to true.
 * @param {UserModel|undefined} [options.user=] User model instance if only a specific user should be counted.
 * @param {GameModelManager~getGameUsersCallback} callback Called with the result or when an error occurred.
 */
// TODO: Add Redis caching to this function?
GameUserModelManager.prototype.getGameUsers = function(game, options, callback) {
    // Create an object with the default options
    const defaultOptions = {
        players: undefined,
        spectators: undefined,
        specials: undefined,
        requested: undefined
    };

    // Set the callback parameter if the options parameter is left out
    if(_.isFunction(options)) {
        // Set the callback parameter and set the options to the default
        //noinspection JSValidateTypes
        callback = options;
        options = {};
    }

    // Set the options to an empty object if it's undefined
    if(options === undefined)
        options = {};

    // Merge the options
    options = MergeUtils.merge(defaultOptions, options);

    // Override the options if requested is set to true
    if(options.requested !== undefined && options.requested) {
        options.players = false;
        options.spectators = false;
        options.specials = false;
    }

    // Create the query object
    var queryObject = {
        game_id: game.getId()
    };

    // Apply the requested property if it's set to false
    if(options.requested !== undefined && !options.requested) {
        queryObject.$or = [
            {team_id: {$ne: null}},
            {is_spectator: true},
            {is_special: true}
        ];
    }

    // Configure the fields object
    if(options.players !== undefined)
        queryObject.team_id = options.players ? {$ne: null} : null;
    if(options.spectators !== undefined)
        queryObject.is_spectator = options.spectators;
    if(options.specials !== undefined)
        queryObject.is_special = options.specials;

    // Limit the query to a specific user if set
    if(options.user !== undefined)
        queryObject.user_id = options.user.getId();

    // Fetch the result from MongoDB
    GameUserDatabase.layerFetchFieldsFromDatabase(queryObject, {user_id: true}, function(err, data) {
        // Call back errors
        if(err !== null && err !== undefined) {
            // Encapsulate the error and call back
            callback(new Error(err));
            return;
        }

        // Create an array of users
        var users = [];

        // Loop through the results, create an user object for each user and add it to the array
        data.forEach(function(userData) {
            users.push(Core.model.userModelManager._instanceManager.create(userData.user_id));
        });

        // Call back with the users array
        callback(null, users);
    });
};

/**
 * Called with the array of users for the given game with the given constraints.
 *
 * @callback GameModelManager~getGameUsersCallback
 * @param {Error|null} Error instance if an error occurred, null otherwise.
 * @param {Array=} Array of UserModel users.
 */

/**
 * Get a game user by a game and user instance.
 *
 * @param {GameModel|ObjectId|string} game The game model instance, or a game ID.
 * @param {UserModel|ObjectId|string} user The user model instance, or an user ID.
 * @param {GameUserModelManager~getGameUserCallback} callback Called with the result or when an error occurred.
 */
GameUserModelManager.prototype.getGameUser = function(game, user, callback) {
    // Parse the game parameter
    if(game instanceof GameModel)
        game = game.getId();
    if(game === null || game === undefined || !ObjectId.isValid(game)) {
        // Call back
        callback(null, null);
        return;
    }
    if(!(game instanceof ObjectId))
        game = new ObjectId(game);
    
    // Parse the user parameter
    if(user instanceof UserModel)
        user = user.getId();
    if(user === null || user === undefined || !ObjectId.isValid(user)) {
        // Call back
        callback(null, null);
        return;
    }
    if(!(user instanceof ObjectId))
        user = new ObjectId(user);

    // Create a callback latch
    var latch = new CallbackLatch();

    // Store the current instance
    const self = this;

    // TODO: Check an instance for this ID is already available?

    // Determine the Redis cache key
    var redisCacheKey = REDIS_KEY_ROOT + ':getGameUser' + game.toString() + ':' + user.toString();

    // Get the game user ID for this game and user through Redis
    if(RedisUtils.isReady()) {
        // TODO: Update this caching method!
        // Fetch the result from Redis
        latch.add();
        RedisUtils.getConnection().get(redisCacheKey, function(err, result) {
            // Show a warning if an error occurred
            if(err !== null && err !== undefined) {
                // Print the error to the console
                console.error('A Redis error occurred while checking game validity, falling back to MongoDB.')
                console.error(new Error(err));

                // Resolve the latch and return
                latch.resolve();
                return;
            }

            // Resolve the latch if the result is undefined, null or zero
            if(result === undefined || result === null || result === '' || result === 0) {
                // Resolve the latch and return
                latch.resolve();
                return;
            }

            // A game user ID is found, create an instance and return it
            //noinspection JSCheckFunctionSignatures
            callback(null, self._instanceManager.create(result));
        });
    }

    // Fetch the result from MongoDB when we're done with Redis
    latch.then(function() {
        // Create a query object
        const queryObject = {
            game_id: game,
            user_id: user
        };

        // Query the database and check whether the game is valid
        GameUserDatabase.layerFetchFieldsFromDatabase(queryObject, {_id: true}, function(err, data) {
            // Call back errors
            if(err !== null && err !== undefined) {
                // Encapsulate the error and call back
                callback(new Error(err), null);
                return;
            }

            // Determine whether we have a game user
            const hasGameUser = data.length > 0;

            // Call back null if no game user was found
            if(!hasGameUser)
                callback(null, null);

            // Get the game user ID
            var gameUserId = hasGameUser ? data[0]._id : '';

            // Get the game user instance to call back
            if(hasGameUser) {
                // Create a game user instance
                const gameUser = self._instanceManager.create(gameUserId);

                // Call back with the game user
                callback(null, gameUser);
            }

            // Store the result in Redis if ready
            if(RedisUtils.isReady()) {
                // Store the results
                RedisUtils.getConnection().setex(redisCacheKey, config.redis.cacheExpire, gameUserId.toString(), function(err) {
                    // Show a warning on error
                    if(err !== null && err !== undefined) {
                        console.error('A Redis error occurred when storing game user ID, ignoring.');
                        console.error(new Error(err));
                    }
                });
            }
        });
    });
};

/**
 * Called with the result or when an error occurred.
 *
 * @callback GameUserModelManager~getGameUserCallback
 * @param {Error|null} Error instance if an error occurred, null otherwise.
 * @param {GameUserModel=} GameUserModel instance or null if none was found.
 */

/**
 * Get the game users in the given team.
 *
 * @param {GameTeamModel|ObjectId|string} team The game team instance or ID.
 * @param {GameUserModelManager~getTeamUserCount} callback Called with the result or when an error occurred.
 */
GameUserModelManager.prototype.getTeamGameUsers = function(team, callback) {
    // Validate the object ID, or get the object ID if a game team is given
    if(team instanceof GameModel)
        team = team.getId();
    else if(team === null || team === undefined || !ObjectId.isValid(team)) {
        // Call back
        callback(null);
        return;
    }

    // Create a callback latch
    var latch = new CallbackLatch();

    // Determine the Redis cache key
    var redisCacheKey = REDIS_KEY_ROOT + ':getTeamGameUsers:' + team.toString();

    // Check whether the team is valid through Redis if ready
    if(RedisUtils.isReady() && false) {
        // TODO: Update this caching method!
        // Fetch the result from Redis
        latch.add();
        RedisUtils.getConnection().get(redisCacheKey, function(err, result) {
            // Show a warning if an error occurred
            if(err !== null && err !== undefined) {
                // Print the error to the console
                console.error('A Redis error occurred while counting team users, falling back to MongoDB.');
                console.error(new Error(err));

                // Resolve the latch and return
                latch.resolve();
                return;
            }

            // Resolve the latch if the result is undefined, null or zero
            if(result === undefined || result === null || result === 0) {
                // Resolve the latch and return
                latch.resolve();
                return;
            }

            // Call back an empty array if the string was empty
            if(result.trim().length === 0) {
                callback(null, []);
                return;
            }

            // Split the result
            var gameUserIds = result.split(",");

            // Create an array of users
            var gameUsers = [];

            // Loop through the user IDs
            gameUserIds.forEach(function(gameUserId) {
                // Skip if the ID is nothing
                if(gameUserId.trim().length === 0)
                    return;

                // Add the user
                gameUsers.push(Core.model.gameUserModelManager._instanceManager.create(gameUserId))
            });

            // Call back the list of teams
            //noinspection JSCheckFunctionSignatures
            callback(null, gameUsers);
        });
    }

    // Fetch the result from MongoDB when we're done with Redis
    latch.then(function() {
        // Create a query object
        const queryObject = {
            team_id: team
        };

        // Query the database
        GameUserDatabase.layerFetchFieldsFromDatabase(queryObject, {_id: true}, function(err, data) {
            // Call back errors
            if(err !== null && err !== undefined) {
                // Encapsulate the error and call back
                callback(new Error(err), null);
                return;
            }

            // Create a list of user IDs and users
            var gameUserIds = [];
            var gameUsers = [];

            // Loop through the result data
            data.forEach(function(userObject) {
                // Get the user ID
                const gameUserId = userObject._id;

                // Add the user ID to the list
                gameUserIds.push(gameUserId);

                // Create the new user and put it in the list of users
                gameUsers.push(Core.model.gameUserModelManager._instanceManager.create(gameUserId));
            });

            // Call back with the list of users
            callback(null, gameUsers);

            // Store the result in Redis if ready
            if(RedisUtils.isReady()) {
                // Combine all user IDs in one string to cache
                var usersString = gameUserIds.join(',');

                // Store the results
                RedisUtils.getConnection().setex(redisCacheKey, config.redis.cacheExpire, usersString, function(err) {
                    // Show a warning on error
                    if(err !== null && err !== undefined) {
                        console.error('A Redis error occurred when storing team users, ignoring.');
                        console.error(new Error(err));
                    }
                });
            }
        });
    });
};

/**
 * Get the number of users in the given team.
 *
 * @callback GameUserModelManager~getTeamUserCount
 * @param {Error|null} Error instance if an error occurred, null otherwise.
 * @param {Number=} Number of users in the given team.
 */
/**
 * Get the users in the given team.
 *
 * @param {GameTeamModel|ObjectId|string} team The game team instance or ID.
 * @param {GameUserModelManager~getTeamUserCount} callback Called with the result or when an error occurred.
 */
GameUserModelManager.prototype.getTeamUsers = function(team, callback) {
    // Validate the object ID, or get the object ID if a game team is given
    if(team instanceof GameModel)
        team = team.getId();
    else if(team === null || team === undefined || !ObjectId.isValid(team)) {
        // Call back
        callback(null);
        return;
    }

    // Create a callback latch
    var latch = new CallbackLatch();

    // Determine the Redis cache key
    var redisCacheKey = REDIS_KEY_ROOT + ':getTeamUsers:' + team.toString();

    // Check whether the team is valid through Redis if ready
    if(RedisUtils.isReady() && false) {
        // TODO: Update this caching method!
        // Fetch the result from Redis
        latch.add();
        RedisUtils.getConnection().get(redisCacheKey, function(err, result) {
            // Show a warning if an error occurred
            if(err !== null && err !== undefined) {
                // Print the error to the console
                console.error('A Redis error occurred while counting team users, falling back to MongoDB.');
                console.error(new Error(err));

                // Resolve the latch and return
                latch.resolve();
                return;
            }

            // Resolve the latch if the result is undefined, null or zero
            if(result === undefined || result === null || result === 0) {
                // Resolve the latch and return
                latch.resolve();
                return;
            }

            // Call back an empty array if the string was empty
            if(result.trim().length === 0) {
                callback(null, []);
                return;
            }

            // Split the result
            var userIds = result.split(",");

            // Create an array of users
            var users = [];

            // Loop through the user IDs
            userIds.forEach(function(userId) {
                // Skip if the ID is nothing
                if(userId.trim().length === 0)
                    return;

                // Add the user
                users.push(Core.model.userModelManager._instanceManager.create(userId))
            });

            // Call back the list of teams
            //noinspection JSCheckFunctionSignatures
            callback(null, users);
        });
    }

    // Fetch the result from MongoDB when we're done with Redis
    latch.then(function() {
        // Create a query object
        const queryObject = {
            team_id: team
        };

        // Query the database
        GameUserDatabase.layerFetchFieldsFromDatabase(queryObject, {user_id: true}, function(err, data) {
            // Call back errors
            if(err !== null && err !== undefined) {
                // Encapsulate the error and call back
                callback(new Error(err), null);
                return;
            }

            // Create a list of user IDs and users
            var userIds = [];
            var users = [];

            // Loop through the result data
            data.forEach(function(userObject) {
                // Get the user ID
                const userId = userObject.user_id;

                // Add the user ID to the list
                userIds.push(userId);

                // Create the new user and put it in the list of users
                users.push(Core.model.userModelManager._instanceManager.create(userId));
            });

            // Call back with the list of users
            callback(null, users);

            // Store the result in Redis if ready
            if(RedisUtils.isReady()) {
                // Combine all user IDs in one string to cache
                var usersString = userIds.join(',');

                // Store the results
                RedisUtils.getConnection().setex(redisCacheKey, config.redis.cacheExpire, usersString, function(err) {
                    // Show a warning on error
                    if(err !== null && err !== undefined) {
                        console.error('A Redis error occurred when storing team users, ignoring.');
                        console.error(new Error(err));
                    }
                });
            }
        });
    });
};

/**
 * Get the number of users in the given team.
 *
 * @callback GameUserModelManager~getTeamUserCount
 * @param {Error|null} Error instance if an error occurred, null otherwise.
 * @param {Number=} Number of users in the given team.
 */

/**
 * Get the number of users in the given team.
 *
 * @param {GameTeamModel|ObjectId|string} team The game team instance or ID.
 * @param {GameUserModelManager~getTeamUserCount} callback Called with the result or when an error occurred.
 */
GameUserModelManager.prototype.getTeamUserCount = function(team, callback) {
    // Validate the object ID, or get the object ID if a game team is given
    if(team instanceof GameModel)
        team = team.getId();
    else if(team === null || team === undefined || !ObjectId.isValid(team)) {
        // Call back
        callback(null);
        return;
    }

    // Create a callback latch
    var latch = new CallbackLatch();

    // Determine the Redis cache key
    var redisCacheKey = REDIS_KEY_ROOT + ':getTeamUserCount:' + team.toString();

    // Check whether the team is valid through Redis if ready
    if(RedisUtils.isReady()) {
        // TODO: Update this caching method!
        // Fetch the result from Redis
        latch.add();
        RedisUtils.getConnection().get(redisCacheKey, function(err, result) {
            // Show a warning if an error occurred
            if(err !== null && err !== undefined) {
                // Print the error to the console
                console.error('A Redis error occurred while counting team users, falling back to MongoDB.');
                console.error(new Error(err));

                // Resolve the latch and return
                latch.resolve();
                return;
            }

            // Resolve the latch if the result is undefined, null or zero
            if(result === undefined || result === null) {
                // Resolve the latch and return
                latch.resolve();
                return;
            }

            // Convert the result to an integer and return it
            callback(null, parseInt(result, 10));
        });
    }

    // Fetch the result from MongoDB when we're done with Redis
    latch.then(function() {
        // Create a query object
        const queryObject = {
            team_id: team
        };

        // Query the database
        GameUserDatabase.layerFetchFieldsFromDatabase(queryObject, {_id: true}, function(err, data) {
            // Call back errors
            if(err !== null && err !== undefined) {
                // Encapsulate the error and call back
                callback(new Error(err), null);
                return;
            }

            // Count the number of users
            const userCount = data.length;

            // Call back with the number of users
            callback(null, userCount);

            // Store the result in Redis if ready
            if(RedisUtils.isReady()) {
                // Store the results
                RedisUtils.getConnection().setex(redisCacheKey, config.redis.cacheExpire, userCount.toString(), function(err) {
                    // Show a warning on error
                    if(err !== null && err !== undefined) {
                        console.error('A Redis error occurred when storing team user counts, ignoring.');
                        console.error(new Error(err));
                    }
                });
            }
        });
    });
};

/**
 * Get the number of users in the given team.
 *
 * @callback GameUserModelManager~getTeamUserCount
 * @param {Error|null} Error instance if an error occurred, null otherwise.
 * @param {Number=} Number of users in the given team.
 */

/**
 * Flush the cache for this model manager.
 *
 * @param {GameUserModelManager~flushCacheCallback} [callback] Called on success or when an error occurred.
 */
GameUserModelManager.prototype.flushCache = function(callback) {
    // Determine the cache key for this manager and wildcard it
    const cacheKey = REDIS_KEY_ROOT + ':*';

    // Create a latch
    var latch = new CallbackLatch();

    // Flush the cache
    latch.add();
    RedisUtils.flushKeys(cacheKey, function(err, keyCount) {
        // Call back errors
        if(err !== null) {
            callback(err);
            return;
        }

        // Resolve the latch
        latch.resolve();
    });

    // Delete the internal model cache
    this._instanceManager.clear(true);

    // Call back when we're done
    latch.then(function() {
        if(callback !== undefined)
            callback(null);
    });
};

/**
 * Called on success or when an error occurred.
 *
 * @callback GameUserModelManager~flushCacheCallback
 * @param {Error|null} Error instance if an error occurred, null on success.
 */

// Return the created class
module.exports = GameUserModelManager;
