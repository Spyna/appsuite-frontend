---
title: Requesting server API
description: http class is intended as centralized server communication layer currently heavily used in our front end APIs
source: http://oxpedia.org/wiki/index.php?title=AppSuite:Http.js
---

- located at `io.ox/core/http.js`

# HTTP facades

_general example_

```javascript
http.GET({ 
        module: 'mail',
        params: { 
            action: 'all', 
            folder: 'default0/INBOX' 
        }
    });
```

**GET(options)**

```javascript
/**
 * Send a GET request
 * @param {Object}  options Request options 
 * @returns {Object} jQuery's Deferred
 */
```

**POST(options)**

```javascript
/**
 * Send a POST request
 * @param {Object} options Request options
 * @returns {Object} jQuery's Deferred
 */
```

**FORM(options)**

```javascript
/**
 * Send a POST request using a FormData object
 * @param {Object} options Request options
 * @param {string} options.module Module, e.g. folder, mail, calendar etc.
 * @param {Object} options.params URL parameters
 * @returns {Object} jQuery's Deferred
 */
```

**PUT(options)**

```javascript
/**
 * Send a PUT request
 * @param {Object} options Request options
 * @returns {Object} jQuery's Deferred
 */
```

**DELETE(options)**

```javascript
/**
 * Send a DELETE request
 * @param {Object} options Request options
 * @returns {Object} jQuery's Deferred
 */
```

**UPLOAD(options)**

```javascript
/**
 * Send a UPLOAD request
 * @param {Object} options Request options
 * @returns {Object} jQuery's Deferred
 */
```

# Column Mappings

- server requests 

  - still require use of columns ids

- server response

  - column_id keys will be replaced with column names to ease handling

**getAllColumns(module, join)**

```javascript
/**
 * get all columns of a module 
 * @param {string} module (name) 
 * @param {boolean} join (join array with comma separator ) 
 * @return {arrray|string} ids */ 
```

**getColumnMapping(module)**

```javascript
/**
 * returns the column mapping of a module
 * @param {string} module The module name.
 * @returns {object} A map from numeric column IDs to the corresponding field names.
 */
```

**makeObject(data, module, columns)**

```javascript
/**
 * transform objects with array-based columns into key-value-based columns
 * @param {Array} data Data
 * @param {string} module Module name
 * @param {Array} columns Columns
 * @returns {Object} Transformed object
 */
```

# Request Stacking

- stack ability for calls to minimize overhead of server communication
  pause() and resume()

_example_

```javascript
// pause http layer
http.pause();

// process all updates
_(list).map(function (item) {
    return http.PUT({
        module: 'calendar',
        params: {
            action: 'update',
            id: item.id,
            folder: item.folder_id,
            timestamp: item.timestamp
        },
        data: {  ...  },
    });
});

// resume & trigger refresh
http.resume()
```

**retry (request)**

- retry request

# Utils

**simplify(list)**

- simplify objects in array for list requests

- returns array of items

- possible returned item types

  - { id: '8978989' }
  - { folder: 'inbox' }
  - { recurrence_position: 'inbox' }
  - 8978989
  - 'inbox'

```javascript
/**
 * Simplify objects in array for list requests
 * @param  {array} list
 * @returns {array} list    
 */
```

**fixList(ids, deferred)**

```javascript
/**
 * Fixes order of list requests (temp. fixes backend bug)
 * @param  {array} ids
 * @param  {deferred} deferred
 * @return {deferred} resolve returns array
 */
```

# Logging

**log()**

```javascript
/**
 * returns failed calls
 * @return {backbone.collection}
 */
```
