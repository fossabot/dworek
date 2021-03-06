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

var _ = require('lodash');
var mongo = require('mongodb');
var ObjectId = mongo.ObjectId;

var Core = require('../../../Core');
var Factory = require('./Factory');
var FactoryModel = require('../../model/factory/FactoryModel');
var CallbackLatch = require('../../util/CallbackLatch');
var MutexLoader = require('../../util/MutexLoader');

/**
 * FactoryManager class.
 *
 * @param {Game} game Live game instance.
 *
 * @class
 * @constructor
 */
var FactoryManager = function(game) {
    /**
     * Live game instance.
     * @type {Game}
     */
    this.game = game;

    /**
     * List containing all loaded factories.
     *
     * @type {Array} Array of factories.
     */
    this.factories = [];

    /**
     * Mutex loader.
     * @type {MutexLoader}
     * @private
     */
    this._mutexLoader = new MutexLoader();
};

/**
 * Get the given factory.
 *
 * @param {FactoryModel|ObjectId|string} factoryId Factory instance or the factory ID to get the factory for.
 * @param {FactoryManager~getFactoryCallback} callback Called back with the factory or when an error occurred.
 */
FactoryManager.prototype.getFactory = function(factoryId, callback) {
    // Get the factory ID as an ObjectId
    if(factoryId instanceof FactoryModel)
        factoryId = factoryId.getId();
    else if(!(factoryId instanceof ObjectId) && ObjectId.isValid(factoryId))
        factoryId = new ObjectId(factoryId);
    else if(!(factoryId instanceof ObjectId)) {
        callback(new Error('Invalid factory ID'));
        return;
    }

    // Get the factory if it's already loaded
    const loadedFactory = this.getLoadedFactory(factoryId);
    if(loadedFactory !== null) {
        callback(null, loadedFactory);
        return;
    }

    // Load the factory if it's valid for this game
    this.loadFactory(factoryId, callback);
};

/**
 * Called back with the factory or when an error occurred.
 *
 * @callback FactoryController~getFactoryCallback
 * @param {Error|null} Error instance if an error occurred, null otherwise.
 * @param {Factory|null=} Factory instance, null if the factory isn't active or if the factory is invalid.
 */

/**
 * Load the factory with the given ID if this factory is valid for the current game.
 *
 * @param {FactoryModel|ObjectId|string} factoryId ID of the factory to load.
 * @param {FactoryManager~loadFactoryCallback} callback Called back with the loaded factory or when an error occurred.
 */
FactoryManager.prototype.loadFactory = function(factoryId, callback) {
    // Get the factory ID as an ObjectId
    if(factoryId instanceof FactoryModel)
        factoryId = factoryId.getId();
    else if(!(factoryId instanceof ObjectId) && ObjectId.isValid(factoryId))
        factoryId = new ObjectId(factoryId);
    else if(!(factoryId instanceof ObjectId)) {
        callback(new Error('Invalid factory ID'));
        return;
    }

    // Store this instance
    const self = this;

    // Load the game through the mutex loader
    this._mutexLoader.load(factoryId.toString(), function(callback) {
        // Make sure the factory ID is valid
        Core.model.factoryModelManager.isValidFactoryId(factoryId, function(err, valid) {
            // Call back errors
            if(err !== null) {
                callback(err);
                return;
            }

            // Make sure the factory is valid
            if(!valid) {
                callback(null, null);
                return;
            }

            // Create a factory model instance
            const factoryModel = Core.model.factoryModelManager._instanceManager.create(factoryId);

            // Make sure the factory is part of the current game
            factoryModel.getGame(function(err, result) {
                // Call back errors
                if(err !== null) {
                    callback(err);
                    return;
                }

                // Make sure the factory is part of this game
                if(!self.getGame().getId().equals(result.getId())) {
                    callback(null, null);
                    return;
                }

                // Create a factory instance for this model
                var newFactory = new Factory(factoryModel, self.game);

                // Add the factory to the list of loaded factories
                self.factories.push(newFactory);

                // Call back the factory
                callback(null, newFactory);
            });
        });

    }, callback);
};

/**
 * Called back with the factory instance or when an error occurred.
 *
 * @callback FactoryManager~loadFactoryCallback
 * @param {Error|null} Error instance if an error occurred, null on success.
 * @param {Factory|null=} The factory instance or null if the factory was invalid for this game.
 */

/**
 * Get the loaded factory instance for the given factory ID.
 * Null will be returned if no factory is loaded for the given factory ID.
 *
 * @param {FactoryModel|ObjectId|string} factoryId Factory instance or the factory ID to get the factory for.
 */
FactoryManager.prototype.getLoadedFactory = function(factoryId) {
    // Get the factory ID as an ObjectId
    if(factoryId instanceof FactoryModel)
        factoryId = factoryId.getId();
    else if(!(factoryId instanceof ObjectId) && ObjectId.isValid(factoryId))
        factoryId = new ObjectId(factoryId);
    else if(!(factoryId instanceof ObjectId))
        throw new Error('Invalid factory ID');

    // Keep track of the found factory
    var result = null;

    // Loop through the list of factories
    this.factories.forEach(function(entry) {
        // Skip if we already found a factory
        if(result !== null)
            return;

        // Check whether the factory ID equals the factory
        if(entry.isFactory(factoryId))
            result = entry;
    });

    // Return the result
    return result;
};

/**
 * Check whether the factory for the given factory ID is loaded.
 *
 * @param {FactoryModel|ObjectId|string} factoryId Factory instance or the factory ID.
 * @return {boolean} True if the factory is currently loaded, false if not.
 */
FactoryManager.prototype.isFactoryLoaded = function(factoryId) {
    return this.getLoadedFactory(factoryId) !== null;
};

/**
 * Get the number of loaded factories.
 *
 * @returns {Number} Number of loaded factories.
 */
FactoryManager.prototype.getLoadedFactoryCount = function() {
    return this.factories.length;
};

/**
 * Load all factories for this game.
 *
 * @param {FactoryManager~loadCallback} [callback] Callback called when done loading.
 */
FactoryManager.prototype.load = function(callback) {
    // Store this instance
    const self = this;

    // Determine whether we called back
    var calledBack = false;

    // Get the game mode
    const gameModel = this.game.getGameModel();

    // Load all factories for this game
    Core.model.factoryModelManager.getFactories(gameModel, null, null, function(err, factories) {
        // Call back errors
        if(err !== null) {
            if(_.isFunction(callback))
                callback(err);
            return;
        }

        // Unload all currently loaded factories
        self.unload();

        // Create a callback latch
        var latch = new CallbackLatch();

        // Loop through the list of factories
        factories.forEach(function(factory) {
            latch.add();
            self.loadFactory(factory.getId(), function(err, liveFactory) {
                // Call back errors
                if(err !== null) {
                    if(!calledBack)
                        if(_.isFunction(callback))
                            callback(err);
                    calledBack = true;
                    return;
                }

                // Resolve the latch
                latch.resolve();
            });
        });

        // Call back when we're done loading
        latch.then(function() {
            if(_.isFunction(callback))
                callback(null);
        });
    });
};

/**
 * @callback FactoryManager~loadCallback
 * @param {Error|null} Error instance if an error occurred, null otherwise.
 */

/**
 * Unload all loaded factories.
 */
FactoryManager.prototype.unload = function() {
    // Loop through the list of factories
    this.factories.forEach(function(factory) {
        // Unload the factory
        factory.unload();
    });

    // Clear the list of factories
    this.factories = [];
};

/**
 * Unload a specific factory.
 *
 * @param {Factory} factory Factory to unload.
 * @return {boolean} True if any factory was unloaded, false if not.
 */
FactoryManager.prototype.unloadFactory = function(factory) {
    // Remove a reference to this
    const self = this;

    var unloadedAny = false;

    // Loop through the list of factories, unload each with the same ID
    this.factories.forEach(function(entry, i) {
        // Return if the entry doesn't have the same ID
        if(!entry.getId().equals(factory.getId()))
            return;

        // Set the unloaded flag
        unloadedAny = true;

        // Splice the list to remove it
        self.factories.splice(i, 1);
    });

    return unloadedAny;
};

/**
 * Get the game this factory manager is for.
 * @return {Game} Game.
 */
FactoryManager.prototype.getGame = function() {
    return this.game;
};

/**
 * Get the visible factories for the given user.
 *
 * @param {UserModel} user User to check for.
 * @param {function} callback callback(err, factories) with an array of factories.
 */
FactoryManager.prototype.getVisibleFactories = function(user, callback) {
    // Create an array of factories
    var factories = [];

    // Make sure we only call back once
    var calledBack = false;

    // Create a callback latch
    var latch = new CallbackLatch();

    // Loop through all factories
    this.factories.forEach(function(factory) {
        // Skip if we called back
        if(calledBack)
            return;

        // Get the game for this factory
        latch.add();
        factory.getGame().getUser(user, function(err, liveUser) {
            // Call back errors
            if(err !== null) {
                if(!calledBack)
                    callback(err);
                calledBack = true;
                return;
            }

            // Make sure a live user is found
            if(liveUser === null) {
                latch.resolve();
                return;
            }

            // Check whether the factory is visible
            factory.isVisibleFor(liveUser, function(err, visible) {
                // Call back errors
                if(err !== null) {
                    if(!calledBack)
                        callback(err);
                    calledBack = true;
                    return;
                }

                // Add the factory to the array if visible
                if(visible)
                    factories.push(factory);

                // Resolve the latch
                latch.resolve();
            });
        });
    });

    // Call back the list of factories
    latch.then(() => callback(null, factories));
};

// Export the class
module.exports = FactoryManager;