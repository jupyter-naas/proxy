import { exec } from 'child_process';
import fs from 'fs';

class Certbot {
    constructor() {
        this.ash = exec;

        this.etc = {
            path: {
                pem: '/certbot/ssl',
                well_know: '/certbot/www/.well-known',
                challenge: '/certbot/www',
                pemletsencrypt: '/etc/letsencrypt/live',
            },
            cmd: 'certbot --config-dir /certbot/etc --work-dir /certbot/var --logs-dir /certbot/log',
        };
    }

    shell(cmd) {
        this.ash(`${cmd}`, (err, stdout, stderr) => {
            if (err) {
                throw Error(err, stderr);
            } else {
                return stdout;
            }
        });
    }

    get(domain) {
        const domainname = domain.replace('.', '_');
        const keyPath = `${this.etc.path.pemletsencrypt}/${domainname}/privkey.pem`;
        const fullchainPath = `${this.etc.path.pemletsencrypt}/${domainname}/fullchain.pem`;
        const cert = `${this.etc.path.pemletsencrypt}/${domainname}/cert.pem`;

        try {
            const key = fs.accessSync(keyPath, fs.F_OK);
            const fullchain = fs.accessSync(fullchainPath, fs.F_OK);
            return {
                key: fs.readFileSync(key, 'utf8'),
                cert: fs.readFileSync(cert, 'utf8'),
                fullchain: fs.readFileSync(fullchain, 'utf8'),
            };
        } catch (err) {
            // eslint-disable-next-line no-console
            console.error(err, `file ${keyPath} or ${fullchainPath} does not exist`);
            return false;
        }
    }

    delete(domain) {
        const domainname = domain.replace('.', '_');
        const cmdRev = `revoke --cert-path ${this.etc.path.pemletsencrypt}/${domainname}/privkey.pem --non-interactive`;
        const cmdDel = `delete --cert-name "${domain}" --non-interactive`;

        try {
            this.shell(`${this.etc.cmd} ${cmdRev}`);
            this.shell(`${this.etc.cmd} ${cmdDel}`);
            return true;
        } catch (err) {
            // eslint-disable-next-line no-console
            console.error(err);
            return false;
        }
    }

    add(email, domain) {
        const domainname = domain.replace('.', '_');
        const cmd = `certonly --cert-name "${domain}" --non-interactive --agree-tos --email "${email}" --keep --webroot -w ${this.etc.path.challenge} "${domain}"`;

        try {
            this.shell(`${this.etc.cmd} --rsa-key-size 4096 ${cmd}`);
            return {
                key: fs.readFileSync(`${this.etc.path.pemletsencrypt}/${domainname}/privkey.pem`, 'utf8'),
                cert: fs.readFileSync(`${this.etc.path.pemletsencrypt}/${domainname}/cert.pem`, 'utf8'),
                fullchain: fs.readFileSync(`${this.etc.path.pemletsencrypt}/${domainname}/fullchain.pem`, 'utf8'),
            };
        } catch (err) {
            // eslint-disable-next-line no-console
            console.error(err);
            return false;
        }
    }

    getAll() {
        const cmd = `${this.etc.cmd} certificates`;
        try {
            const result = this.shell(`${cmd}`);
            return result;
        } catch (err) {
            // eslint-disable-next-line no-console
            console.error(err);
            return false;
        }
    }
}

export default new Certbot();
