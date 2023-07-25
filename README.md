
ML-Datastore-Automator
======================

Naive Bayes implemented on top of a Dropbox Datastore, now maintained by [juzibut](https://github.com/juzibut/).

## Setup

### 1. Authenticate your user with Dropbox
Please check [Dropbox Datastore JavaScript Tutorial](https://www.dropbox.com/developers/datastore/tutorial/js) for detailed steps. Here is the basic code:

```javascript
var client = new Dropbox.Client({key: APP_KEY});

// Try to finish OAuth authorization.
client.authenticate({interactive: false});
```

### 2. Open a datastore and use it to create an Automator
```javascript
// Our to-be Automator object
var myClassifier;

if (client.isAuthenticated()) {
  var datastoreManager = client.getDatastoreManager();
  datastoreManager.openDefaultDatastore(function (error, datastore) {

    // Make an Automator object by passing in your datastore.
    myClassifier = new Automator(datastore);
  }
}
```

## Usage

### Train your classifier
After creating your classifier, train it with a string of spaced lowercase words and a category (classification) name.
```javascript
myClassifier.train("some lowercase space delimited text", "spam");
myClassifier.train("man I really love bagels", "not spam");
```

### Classify something
When you have enough examples, you can start to classify some text.
```javascript
myClassifier.classify("what are bagels like");
```
This will return
```javascript
{
  category: "not spam", // returns a classification or "unknown"
  reason: ["bagels"]    // returns an array of features that support this classification
  confidence: 0.5       // some number from 0 to 1
}
```

### Preserve / Restore / Merge State
You may want to start users off with some sort of default state.

You can check if the model has been trained at all by calling
```javascript
myClassifier.hasModel() // Returns a boolean
```

Destroy an existing model by calling
```javascript
myClassifier.clearModel()
```

Export your classifier's current state by calling
```javascript
var state = myClassifier.toJSON();
```

…and subsequently merge/restore state by calling
```javascript
myClassifier.fromJSON(state);
```