# Haproxy Graphdat Plugin

#### Tracks the following metrics for [haproxy](http://haproxy.1wt.eu)

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

#### Pre Reqs

To get statistics from haproxy, you need to instruct Haproxy where to host the statistics

The following will host the statistics on a file socket:

	global
		stats socket /tmp/haproxy level operator

Or Alternatively, you can host a webpage that you can access as well

	global
		stats enable
		stats uri /stats
		stats auth username:secret-password
		stats refresh 10

Once you make the update, reload your haproxy configuration
	`sudo service haproxy reload`

### Installation & Configuration

* The `source` to prefix the display in the legend for the haproxy data.  It will default to the hostname of the server.
* The Socket or URL endpoint of the haproxy statistics module is required.
  * The default socket is hosted at /tmp/haproxy
  * The default webpage is hosted at `http://127.0.0.1/stats`.
* If the webpage is password protected, what `username` and `password` should the plugin use to make the call
