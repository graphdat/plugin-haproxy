local framework = require('framework')
local Plugin = framework.Plugin
local WebRequestDataSource = framework.WebRequestDataSource
local Accumulator = framework.Accumulator
local Cache = framework.Cache
local url = require('url')
local auth = framework.util.auth
local parseCSV = framework.string.parseCSV
local table = require('table')
local indexOf = framework.table.indexOf
local pack = framework.util.pack

local params = framework.params

params.pollInterval =
    tonumber(params.pollSeconds) and tonumber(params.pollSeconds) * 1000
    or tonumber(params.pollInterval)
    or 1000

local options = url.parse(params.url .. ';csv')
options.auth = auth(params.username, params.password)
options.wait_for_end = false -- Check behaviour of HAProxy based on different versions.
local cache = Cache:new(function () return Accumulator:new() end)
local ds = WebRequestDataSource:new(options)

--[[
    'pxname',           -- proxy name (ex. http-in)
    'svname',           -- service name (FRONTEND or BACKEND_
    'qcur',             -- current queued requests (ex 0)
    'qmax',             -- max queued requests (ex 0)
    'scur',             -- current sessions (ex. 13)
    'smax',             -- max sessions (ex. 35)
    'slim',             -- session limit (ex. 2000)
    'stot',             -- total sessions (ex. 11151)
    'bin',              -- bytes in (ex. 1622452007)
    'bout',             -- bytes out (ex. 612088528)
    'dreq',             -- denied requests (ex. 0 )
    'dresp',            -- denied responses (ex. 0)
    'ereq',             -- request errors (ex. 84)
    'econ',             -- connections errors (ex. 0)
    'eresp',            -- response errors like srv_abrt (ex. 0)
    'wretr',            -- retries (warning)
    'wredis',           -- redispatched (warning)
    'status',           -- status (UP/DOWN/NOLB/MAINT/OPEN/CLOSED)
    'weight',           -- weighting of the server, or total weight of the backend (ex 1)
    'act',              -- server is active (server), number of active servers (backend) (ex. Y)
    'bck',              -- server is backup (server), number of backup servers (backend)
    'chkfail',          -- number of failed health checks (ex. 0)
    'chkdown',          -- number of Up/Down transitions (ex. 0)
    'lastchg',          -- how many seconds since the last time the status changed (ex. 523098)
    'downtime',         -- total seconds of down time (ex. 65433)
    'qlimit',           -- queue limit (ex. 0)
    'pid',              -- process Id, 0 for first instance, 1 for second (ex. 1)
    'iid',              -- unique proxy id (ex. 7)
    'sid',              -- service id (unique within a proxy) (ex. 0)
    'throttle',         -- warm up status
    'lbtot',            -- total number of times a server was selected
    'tracked',          -- id of proxy/server is tracking is enabled
    'type',             -- type (0=frontend, 1=backend, 2=server, 3=socked)
    'rate',             -- number of sessions per second over last elapsed second
    'rate_lim',         -- limit on new sesions per second
    'rate_max',         -- max number of new sessions per second
    'check_status',     -- status of last health check
    'check_code',       -- layer5-7 code if available
    'check_duration',   -- time in ms to finish the last health check
    'hrsp_1xx',         -- http responses with 1xx codes
    'hrsp_2xx',         -- http responses with 2xx codes
    'hrsp_3xx',         -- http responses with 3xx codes
    'hrsp_4xx',         -- http responses with 4xx codes
    'hrsp_5xx',         -- http responses with 5xx codes
    'hrsp_other',       -- http responses with other codes (protocol error)
    'hanafail',         -- failed health check details
    'req_rate',         -- HTTP request per second over last elapsed second
    'req_rate_max',     -- max number of HTTP requests per second observerd
    'req_tot',          -- total number of HTTP requests received
    'cli_abrt',         -- number of data transfers aborted by the client
    'srv_abrt'          -- number of data transfers aborted by the server
]]

local plugin = Plugin:new(params, ds)
function plugin:onParseValues(data)
  local result = {}
  local parsed = parseCSV(data, ',', '#', 1)
  for i, v in ipairs(parsed) do
    if v.svname == 'FRONTEND' or v.svname == 'BACKEND' then
      if not params.proxies or #params.proxies == 0 or (#params.proxies == 1 and params.proxies[1] == "") or indexOf(params.proxies, v.pxname) then
        local name = v.pxname
        local alias = self.source .. '-' .. name
        local acc = cache:get(alias)

        local queue_usage   = (v.qcur and not v.qlimit == "") and (v.qcur / v.qlimit) or 0.0 -- Percentage of queue usage.
        local sessions_usage = (v.scur and v.slim) and (v.scur / v.slim) or 0.0 -- Percentage of session usage.
        local warnings     = acc:accumulate('warnings', v.wretr + v.wredis)
        local errors       = acc:accumulate('errors', v.ereq + v.econ + v.eresp)
        local downtime     = acc:accumulate('downtime', v.downtime) * 1000 -- downtime in milliseconds

        table.insert(result, pack('HAPROXY_REQUESTS_QUEUED', v.qcur, nil, alias)) -- current queued requests
        table.insert(result, pack('HAPROXY_REQUESTS_QUEUE_LIMIT', queue_usage, nil, alias)) -- queue_usage percentage

        table.insert(result, pack('HAPROXY_REQUESTS_HANDLED', acc:accumulate('req_tot', v.req_tot or 0), nil, alias))
        table.insert(result, pack('HAPROXY_REQUESTS_ABORTED_BY_CLIENT', acc:accumulate('cli_abrt', v.cli_abrt or 0), nil, alias))
        table.insert(result, pack('HAPROXY_REQUESTS_ABORTED_BY_SERVER', acc:accumulate('srv_abrt', v.srv_abrt or 0), nil, alias))

        table.insert(result, pack('HAPROXY_SESSIONS', v.scur, nil, alias))
        table.insert(result, pack('HAPROXY_SESSION_LIMIT', sessions_usage, nil, alias))  -- session_usage is a percentage

        table.insert(result, pack('HAPROXY_BYTES_IN', acc:accumulate('bin', v.bin), nil, alias))
        table.insert(result, pack('HAPROXY_BYTES_OUT', acc:accumulate('bout', v.bout), nil, alias))

        table.insert(result, pack('HAPROXY_WARNINGS', warnings, nil, alias))
        table.insert(result, pack('HAPROXY_ERRORS', errors, nil, alias))
        table.insert(result, pack('HAPROXY_FAILED_HEALTH_CHECKS', acc:accumulate('chkfail', v.chkfail), nil, alias))
        table.insert(result, pack('HAPROXY_DOWNTIME_SECONDS', downtime, nil, alias))

        table.insert(result, pack('HAPROXY_1XX_RESPONSES', acc:accumulate('hrsp_1xx', v.hrsp_1xx or 0), nil, alias))
        table.insert(result, pack('HAPROXY_2XX_RESPONSES', acc:accumulate('hrsp_2xx', v.hrsp_2xx or 0), nil, alias))
        table.insert(result, pack('HAPROXY_3XX_RESPONSES', acc:accumulate('hrsp_3xx', v.hrsp_3xx or 0), nil, alias))
        table.insert(result, pack('HAPROXY_4XX_RESPONSES', acc:accumulate('hrsp_4xx', v.hrsp_4xx or 0), nil, alias))
        table.insert(result, pack('HAPROXY_5XX_RESPONSES', acc:accumulate('hrsp_5xx', v.hrsp_5xx or 0), nil, alias))
        table.insert(result, pack('HAPROXY_OTHER_RESPONSES', acc:accumulate('hrsp_other', v.hrsp_other or 0), nil, alias))
      end
    end
  end
  return result
end

plugin:run()
