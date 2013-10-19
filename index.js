var _os = require('os');
var _param = require('./param.json');
var _request = require('request');

if (!_param.url) {
    console.error('The plugin configuration is missing the Haproxy URL');
    process.exit(-1);
}
if (_param.url.slice(-4) !== ';csv')
    _param.url += ';csv';

// if we have a name and password, then add an auth header
var _httpOptions;
if (_param.username)
    _httpOptions = { auth: { user: _param.username, pass: _param.password, sendImmediately: true } };

// if we do not have a source, then set it
_param.source = _param.source || _os.hostname();

// save the CSV keys, we only need to parse them once
var _keys;

// remember the previous poll data so we can provide proper counts
var _previous = {};

// get the front end and backend names that we care about
var proxies = {};
var filterProxies = false;
_param.proxies.forEach(function(proxy)
{
    var values = proxy.split(',');
    if (values[0] in proxies)
    {
        console.error('The value %s is defined twice.  Each name is requried to be unique', values[0]);
        process.exit(-1);
    }
    proxies[values[0]] = { name: _param.source.trim() + '-' + (values[1] || values[0]).trim() }; // if there is an alias use it
    filterProxies = true;
});

// get the natural difference between a and b
function diff(a, b)
{
    if (a == null || b == null)
        return 0;

    return Math.max(a - b, 0);
}

function parseKeys(keys)
{
    // remove the first two chars
    if (keys.indexOf('# ') === 0)
        keys = keys.slice(2);

    // get the keys
    _keys = [];
    keys.split(',').forEach(function(key) {
        if (key && key.trim()) {
            _keys.push(key.trim());
        }
    });
}

// call haproxy and parse the stats
function getStats(cb)
{
    // call happroxy to get the stats page
    _request.get(_param.url, _httpOptions, function(err, resp, body)
    {
        if (err)
           return cb(err);
        if (resp.statusCode !== 200)
           return cb(new Error('Haproxy returned with an error - recheck the URL and credentials that you provided'));
        if (!body)
           return cb(new Error('Haproxy statistics return empty'));

        var lines = body.split('\n');
        var stats = {};

        if (!_keys) parseKeys(lines[0]);

        // parse the stats
        for(var i=1; i<lines.length; i++)
        {
            var data = lines[i].split(',');
            if (data[1] !== 'FRONTEND' && data[1] !== 'BACKEND')
                continue;
            if (filterProxies && !(data[0] in proxies))
                continue;

            var name = data[0];
            stats[name] = {};
            for(var j=0; j<_keys.length; j++)
            {
                if (data[j] == null || data[j] === '')
                {
                    stats[name][_keys[j]] = null;
                    continue;
                }

                var value = parseInt(data[j],10);
                if (value === 0 || value)
                    stats[name][_keys[j]] = value;
                else
                    stats[name][_keys[j]] = data[j].trim();
            }
        }
        return cb(null, stats);
    });
}

// get the stats, format the output and send to stdout
function poll(cb)
{
    // {
    //  pxname  // proxy name (ex. http-in)
    //  svname  // service name (FRONTEND or BACKEND_
    //  qcur    // current queued requests (ex 0)
    //  qmax    // max queued requests (ex 0)
    //  scur    // current sessions (ex. 13)
    //  smax    // max sessions (ex. 35)
    //  slim    // session limit (ex. 2000)
    //  stot    // total sessions (ex. 11151)
    //  bin     // bytes in (ex. 1622452007)
    //  bout    // bytes out (ex. 612088528)
    //  dreq    // denied requests (ex. 0 )
    //  dresp   // denied responses (ex. 0)
    //  ereq    // request errors (ex. 84)
    //  econ    // connections errors (ex. 0)
    //  eresp   // response errors like srv_abrt (ex. 0)
    //  wretr   // retries (warning)
    //  wredis  // redispatched (warning)
    //  status  // status (UP/DOWN/NOLB/MAINT/OPEN/CLOSED)
    //  weight  // weighting of the server, or total weight of the backend (ex 1)
    //  act     // server is active (server), number of active servers (backend) (ex. Y)
    //  bck     // server is backup (server), number of backup servers (backend)
    //  chkfail // number of failed health checks (ex. 0)
    //  chkdown // number of Up/Down transitions (ex. 0)
    //  lastchg // how many seconds since the last time the status changed (ex. 523098)
    //  downtime // total seconds of down time (ex. 65433)
    //  qlimit  // queue limit (ex. 0)
    //  pid     // process Id, 0 for first instance, 1 for second (ex. 1)
    //  iid     // unique proxy id (ex. 7)
    //  sid     // service id (unique within a proxy) (ex. 0)
    //  throttle // warm up status
    //  lbtot   // total number of times a server was selected
    //  tracked // id of proxy/server is tracking is enabled
    //  type    // type (0=frontend, 1=backend, 2=server, 3=socked)
    //  rate    // number of sessions per second over last elapsed second
    //  rate_lim // limit on new sesions per second
    //  rate_max // max number of new sessions per second
    //  check_status // status of last health check
    //  check_code // layer5-7 code if available
    //  check_duration // time in ms to finish the last health check
    //  hrsp_1xx  // http responses with 1xx codes
    //  hrsp_2xx  // http responses with 2xx codes
    //  hrsp_3xx  // http responses with 3xx codes
    //  hrsp_4xx  // http responses with 4xx codes
    //  hrsp_5xx  // http responses with 5xx codes
    //  hrsp_other // http responses with other codes (protocol error)
    //  hanafail  // failed health check details
    //  req_rate  // HTTP request per second over last elapsed second
    //  req_rate_max // max number of HTTP requests per second observerd
    //  req_tot  // total number of HTTP requests received
    //  cli_abrt  // number of data transfers aborted by the client
    //  srv_abrt // number of data transfers aborted by the server
    //}

    getStats(function(err, current)
    {
        if (err)
            return console.error(err);

        // go through each of the proxies the user cares about
        Object.keys(proxies).forEach(function(proxy)
        {
            var name = proxy;
            var alias = proxies[name].name;
            var cur = current[name];
            var prev = _previous[name] || {};
            var hasPrev = Object.keys(prev) === 0;

            var queueLimit = (cur.qcur && cur.qlimit) ? (cur.qcur/cur.qlimit) : 0.0;
            var sessionLimit = (cur.scur && cur.slim) ? (cur.scur/cur.slim) : 0.0;
            var warnings = (hasPrev) ? diff(cur.wretr + cur.wredis, prev.wretr + prev.wredis) : 0;
            var errors = (hasPrev) ? diff(cur.ereq + cur.econ + cur.eresp, prev.ereq + prev.econ + prev.eresp) : 0;

            console.log('HAPROXY_REQUESTS_QUEUED %d %s', cur.qcur, alias);
            console.log('HAPROXY_REQUESTS_QUEUE_LIMIT %d %s', queueLimit, alias); // this is a percentage

            console.log('HAPROXY_REQUESTS_HANDLED %d %s', diff(cur.req_tot, prev.req_tot), alias);
            console.log('HAPROXY_REQUESTS_ABORTED_BY_CLIENT %d %s', diff(cur.cli_abrt, prev.cli_abrt), alias);
            console.log('HAPROXY_REQUESTS_ABORTED_BY_SERVER %d %s', diff(cur.srv_abrt, prev.srv_abrt), alias);

            console.log('HAPROXY_SESSIONS %d %s', cur.scur, alias);
            console.log('HAPROXY_SESSION_LIMIT %d %s', sessionLimit, alias);  // this is a percentage

            console.log('HAPROXY_BYTES_IN %d %s', diff(cur.bin, prev.bin), alias);
            console.log('HAPROXY_BYTES_OUT %d %s', diff(cur.bout, prev.bout), alias);

            console.log('HAPROXY_WARNINGS %d %s', warnings, alias);
            console.log('HAPROXY_ERRORS %d %s', errors, alias);
            console.log('HAPROXY_FAILED_HEALTH_CHECKS %d %s', diff(cur.chkfail, prev.chkfail), alias);
            console.log('HAPROXY_DOWNTIME_SECONDS %d %s', diff(cur.downtime, prev.downtime), alias);

            console.log('HAPROXY_1XX_RESPONSES %d %s', diff(cur.hrsp_1xx, prev.hrsp_1xx), alias);
            console.log('HAPROXY_2XX_RESPONSES %d %s', diff(cur.hrsp_2xx, prev.hrsp_2xx), alias);
            console.log('HAPROXY_3XX_RESPONSES %d %s', diff(cur.hrsp_3xx, prev.hrsp_3xx), alias);
            console.log('HAPROXY_4XX_RESPONSES %d %s', diff(cur.hrsp_4xx, prev.hrsp_4xx), alias);
            console.log('HAPROXY_5XX_RESPONSES %d %s', diff(cur.hrsp_5xx, prev.hrsp_5xx), alias);
            console.log('HAPROXY_OTHER_RESPONSES %d %s', diff(cur.hrsp_other, prev.hrsp_other), alias);
        });

        _previous = current;
    });

    setTimeout(poll, _param.pollInterval);
}
poll();
