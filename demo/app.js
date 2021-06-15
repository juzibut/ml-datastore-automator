
/* app.js */

var NewsRanker;
var APP_KEY = "d7fdibrrvaw3bbv";
var recommendedArticles;

function loggedIn(datastore){

  // Show the "logged in" UI
  $('#login').hide();

  // Set up Automator
  NewsRanker = new Automator(datastore);
  recommendedArticles = datastore.getTable("recommendedArticles");

  showStories();

}

// Dropbox OAuth Handler
$(function() {

  var client = new Dropbox.Client({key: APP_KEY});

  // Try to finish OAuth authorization.
  client.authenticate({interactive: false}, function (error) {
    if (error) {
      alert('Authentication error: ' + error);
    }
  });

  // Once the client is authenticated, open up a datastore.
  // It doesn't necessarily _need_ to be the default datastore,
  // and you should never tie more than one Automator to a particular datastore.
  if (client.isAuthenticated()) {
    var datastoreManager = client.getDatastoreManager();
    datastoreManager.openDefaultDatastore(function (error, datastore) {
      if (error) {
        alert('Error opening default datastore: ' + error);
      }else{
        loggedIn(datastore);
      }
    });
  }
});


// Given a feed URL, return the raw YQL response to a success function
function fetchRSS(feed, success){
   $.ajax({
    url : 'https://query.yahooapis.com/v1/public/yql',
    jsonp : 'callback',
    dataType : 'jsonp',
    data : {
      q : "select title, link, pubDate from rss where url='" + feed + "'",
      format : 'json'
    },
    success : function(data){ return success(data);}
  });

}

// Collect our stories in an array, and then call a success function
var stories = [];
function getHeadlines(success)
{

  // Our feed URLS
  var feeds = [
    "http://rss.news.yahoo.com/rss/topstories",
    "http://feeds.feedburner.com/fastcodesign/feed",
    "https://news.layervault.com/?format=rss"
  ];

  var count = feeds.length;

  _.map(feeds, function(feed){
    fetchRSS(feed, function(data){

      // Add all the stories from this feed to the stories array
      count -= 1;
      _.map(data.query.results.item, function(story){
        story.date = new Date(story.pubDate);
        stories.push(story);
      });

      // Once all the feeds have been loaded, sort the stories by timestamp
      if (count == 0){
        stories = _.sortBy(stories, function(o) { return o.date });
        success(stories);
      }
    });
  });
}


// Given a string of text, return a space delimited string of features
function getFeatures(title){
  var text = natural.PorterStemmer.tokenizeAndStem(title).join(" ");
  return text;
}

// Classify a piece of text, return true if it is recommended
function isRecommended(title){
  var classification = NewsRanker.classify(getFeatures(title));
  return (classification.category == "recommend");
}
