---
title: Capabilities
description: How to use capabilities so that your new AppSuite plugin can be enabled or disabled.
source: http://oxpedia.org/wiki/index.php?title=AppSuite:Capabilities
---

# What are capabilities?

**Usecase**

You write a new UI app or plugin (chat module, for example) and in addition, you want to make sure that only a specific set of users or contexts within the system are allowed to use it. 

_Example:_ 

Your chat app should only be available after a user has bought it in your online shop.
To do so, you will need to implement the capabilities logic within your UI app or plugin and restrict it to a user or context marked accordingly (called "premium" in further examples).

# Set a capability

First, disable it for everyone as default (or enable it for everyone, depending on what your aim is). 

In `/opt/open-xchange/etc/[myproduct].properties`:

```bash
# off for everyone
com.openexchange.capability.[myproduct]=false
```

Then restart the OX Application Server and afterwards use the general OX AppSuite commandline tools to enable the capability/capabilities. 

The **commandline tools** used in the following examples are located in:

```bash
/opt/open-xchange/sbin
```

In this example, only for a **specific user**:

```bash
changeuser ... --config/com.openexchange.capability.[myproduct]=true
```

...or for a **full context**:

```bash
  changecontext -c ... --config/com.openexchange.capability.[myproduct]=true
```

...or set the capability to a **context set**:

```bash
changecontext -c ... --taxonomy/types=premium
```

To get the capability/capabilities working for context sets (like above), you also need to edit the **contextSet files** in:

```bash
  /opt/open-xchange/etc/contextSets/premium.yml
```

And add the corresponding capability/capabilities:

```javascript
  premium:
     com.openexchange.capability.[myproduct]: true
     withTags: premium
```

Then restart the OX Application Server!

# Query capabilities via the HTTP API

**Query**

```
  GET /appsuite/api/capabilities?action=all&session=991fd40f635b45...
```

**Response**

```json
{"data":[
    {"id":"oauth","attributes":{}},
    {"id":"webmail","attributes":{}},
    {"id":"document_preview","attributes":{}},
    {"id":"printing","attributes":{}},
    {"id":"spreadsheet","attributes":{}},
    {"id":"gab","attributes":{}},
    {"id":"multiple_mail_accounts","attributes":{}},
    {"id":"publication","attributes":{}},
    {"id":"rss_bookmarks","attributes":{}},
    {"id":"linkedin","attributes":{}},
    {"id":"filestore","attributes":{}},
    {"id":"ical","attributes":{}},
    {"id":"rt","attributes":{}},
    {"id":"olox20","attributes":{}},
    {"id":"forum","attributes":{}},
    {"id":"active_sync","attributes":{}},
    {"id":"conflict_handling","attributes":{}},
    {"id":"rss_portal","attributes":{}},
    {"id":"oxupdater","attributes":{}},
    {"id":"infostore","attributes":{}},
    {"id":"contacts","attributes":{}},
    {"id":"collect_email_addresses","attributes":{}},
    {"id":"drive","attributes":{}},
    {"id":"rss","attributes":{}},
    {"id":"pinboard_write_access","attributes":{}},
    {"id":"mobility","attributes":{}},
    {"id":"calendar","attributes":{}},
    {"id":"participants_dialog","attributes":{}},
    {"id":"edit_public_folders","attributes":{}},
    {"id":"text","attributes":{}},
    {"id":"groupware","attributes":{}},
    {"id":"msisdn","attributes":{}},
    {"id":"carddav","attributes":{}},
    {"id":"tasks","attributes":{}},
    {"id":"portal","attributes":{}},
    {"id":"mailfilter","attributes":{}},
    {"id":"read_create_shared_folders","attributes":{}},
    {"id":"vcard","attributes":{}},
    {"id":"pim","attributes":{}},
    {"id":"caldav","attributes":{}},
    {"id":"projects","attributes":{}},
    {"id":"usm","attributes":{}},
    {"id":"webdav","attributes":{}},
    {"id":"dev","attributes":{}},
    {"id":"delegate_tasks","attributes":{}},
    {"id":"freebusy","attributes":{}},
    {"id":"subscription","attributes":{}},
    {"id":"linkedinPlus","attributes":{}},
    {"id":"autologin","attributes":{}},
    {"id":"webdav_xml","attributes":{}},
    {"id":"twitter","attributes":{}}
]}
```

Here _id_ is the name of the capability.

# Query capabilities in the UI

```javascript
  require(['io.ox/core/capabilities'], function (cap) { if cap.has('[myproduct]' { ... } );
```

# Require the capabilities in your UI manifest file

```bash
{
    namespace: ...
    requires: '[myproduct]'
}
```

Now your plugin will only be loaded if the capability `[myproduct]` is set for a specific user, context, context set.

## Testing the capabilities

- For testing purposes use an URL parameter to test capabilities. 

Add the following parameter to your AppSuite URL in the browser to activate:

```javascript
&cap=[myproduct]
```

or use 

```javascript
&cap=-[myproduct]
```

to disable a certain capability (mind the minus sign).

In general, after adding those URL parameters, you need to reload the UI to temporarly test/enable the set capability.

## debugging

This little snippet executed in chromes devtools gives you a overview about the current capabilities:

```javascript
var cap = require('io.ox/core/capabilities');

(function () {
    var capcur = _.pluck(cap.get(), 'id').sort();
    var capser = _.pluck(ox.serverConfig.capabilities, 'id').sort();
    var diff = _.difference(capcur, capser);

    _.each(capcur, function (id) {
        if (cap.has(id) && capser.indexOf(id) < 0)
            console.log('%c' + id, 'color: white; background-color: orange');
        else if (cap.has(id))
            console.log('%c' + id, 'color: white; background-color: green');
        else
            console.log('%c' + id, 'color: white; background-color: red');
    });
}())
```

## Further informations

- See the dedicated wiki page of the [ConfigCascade](http://oxpedia.org/wiki/index.php?title=ConfigCascade) mechanism for more details.
- If you want to know about existing capabilities and the way they are used for upsell, see [Capabilities and Upsell triggers](http://oxpedia.org/wiki/index.php?title=AppSuite:Upsell#Capabilities_and_Upsell_triggers).
