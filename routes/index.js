var express = require('express');
var router = express.Router();

var about = require('./about');

// Index page
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

// About page
router.use('/about', about);

module.exports = router;
