// Generated by CoffeeScript 1.6.3
var AUTOMATOR_HIDE_DEBUG, Automator, automator_log;

AUTOMATOR_HIDE_DEBUG = true;

automator_log = function(message) {
  if (!AUTOMATOR_HIDE_DEBUG) {
    return console.log(message);
  }
};

Automator = (function() {
  Automator.prototype.options = {
    namespace: "automator"
  };

  function Automator(datastore, options) {
    if (options == null) {
      options = {};
    }
    $.extend(this.options, options);
    this.datastore = datastore;
    this.categories = datastore.getTable("" + this.options.namespace + "-categories");
    this.words = datastore.getTable("" + this.options.namespace + "-words");
  }

  Automator.prototype.hasModel = function() {
    return this.categories.query().length > 0;
  };

  Automator.prototype.clearModel = function() {
    _.map(this.words.query(), function(record) {
      return record.deleteRecord();
    });
    return _.map(this.categories.query(), function(record) {
      return record.deleteRecord();
    });
  };

  Automator.prototype.train = function(text, category) {
    var self, words;
    category = category.toLowerCase();
    words = text.toLowerCase().split(" ");
    this._increment(this.categories, category);
    self = this;
    _.map(words, function(word) {
      var categoryCount, record;
      record = self._increment(self.words, word);
      categoryCount = (record.get(category)) || 0;
      return record.set(category, categoryCount + 1);
    });
  };

  Automator.prototype.trainForce = function(text, category) {
    this.train(text, category);
    if ((this.classify(text)).category !== category) {
      return this.trainUntil(text, category);
    } else {
      return automator_log("Trained");
    }
  };

  Automator.prototype.classify = function(text) {
    var confid