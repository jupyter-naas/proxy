# Naas Proxy api

proxy server for naas public urls
can convert url to private url in you kubernet namespace

set this env vars to make it work

`SINGLEUSER_PATH` => the path of your singleuser in your cluster

`SINGLEUSER_BASE` => the base url your singleuser in your cluster

`NAAS_PORT` => port of your naas server in single user

`PORT` => to set the proxy port

`SSL` => to set Set this if you want the proxy to create ssl for managed domain for users

`MAIN_SSL` => Set this if you want the proxy to create ssl for main domain too

`NAAS_PROXY_HOST` => hostname of this deployed proxy

`HUB_HOST` => hostname of the deployed jupyter hub instance

`HUB_DB` => 'sqlite::memory:' or postgressuri 'postgres://user:pass@example.com:5432/dbname'