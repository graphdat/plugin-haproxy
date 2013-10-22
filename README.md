# Haproxy Graphdat Plugin

## Tracks the following metrics for [haproxy](http://haproxy.1wt.eu)

* HAPROXY_BYTES_IN - Bytes In
* HAPROXY_BYTES_OUT - Bytes Out
* HAPROXY_DOWNTIME_SECONDS - The amount of downtime
* HAPROXY_FAILED_HEALTH_CHECKS - Failed Health Checks
* HAPROXY_ERRORS - Connection Errors + Request Errors + Response Errors
* HAPROXY_WARNINGS - Retries + Redispatches
* HAPROXY_REQUESTS_ABORTED_BY_CLIENT - Requests aborted by the Client
* HAPROXY_REQUESTS_ABORTED_BY_SERVER - Requests aborted by the Server
* HAPROXY_REQUESTS_HANDLED - HTTP Requests Received
* HAPROXY_REQUESTS_QUEUED - Current Queued Requests
* HAPROXY_REQUESTS_QUEUE_LIMIT - Current Queued Requests / Queue Limit
* HAPROXY_SESSIONS - Current number of Sessions
* HAPROXY_SESSION_LIMIT - Current Sessions / Session Limit
* HAPROXY_1XX_RESPONSES - Number of 1XX Responses
* HAPROXY_2XX_RESPONSES - Number of 2XX Responses
* HAPROXY_3XX_RESPONSES - Number of 3XX Responses
* HAPROXY_4XX_RESPONSES - Number of 4XX Responses
* HAPROXY_5XX_RESPONSES - Number of 5XX Responses
* HAPROXY_OTHER_RESPONSES - Number of all other Responses

## Pre Reqs

To get statistics from haproxy, you need to instruct Haproxy where to host the statistics.  You can use a filesocket or use the webpage option.

#### Using a File socket
The following snippet of configuration will host the statistics on a file socket.
* the `mode` parameter sets the mode of the file socket.  If the relay is running as the same user as haproxy, `mode 777` can be omitted'
* the `level` parameter limits the commands available from the file socket

	global
		stats socket /tmp/haproxy mode 777 level operator

#### Using a webpage
The following snippet of configuration will tell haproxy to host a webpage the plugin will scrape (you can view the webpage as well)
* `stats enable` tell haproxy to enable the webpage
* `stats uri /stats` tell haproxy to host the webpage at /stats, this needs to be a unique URL not being used in your application.  If your website already has a /stats page, change this values to something else
* `stats auth username:password` tell haproxy to password protect the page with the username and password combination
* `stats refresh 10` tells haproxy to refresh the webpage every 10s if your browser is viewing it

	defaults
		stats enable
		stats uri /stats
		stats auth username:password
		stats refresh 10

Once you make the update, reload your haproxy configuration
	`sudo service haproxy reload`

### Installation & Configuration

* The `source` to prefix the display in the legend for the haproxy data.  It will default to the hostname of the server.
* The Socket or URL endpoint of the haproxy statistics module is required.
  * The default socket is hosted at /tmp/haproxy
  * The default webpage is hosted at `http://127.0.0.1/stats`.
* If the webpage is password protected, what `username` and `password` should the plugin use to make the call
