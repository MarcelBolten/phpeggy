
`docker compose up -d`

Don't connect as root to phpeggy_php container. Use your local uid:gid. This avoids ["Getting EACCESS when running NPM 8 as root"](https://stackoverflow.com/questions/70298238/getting-eaccess-when-running-npm-8-as-root)

`docker exec -it -u 1000:1000 phpeggy_php /bin/sh`
