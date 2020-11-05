import Greenlock from '@root/greenlock';
import GreenlockStore from '@greenlock/store-sequelize';
import tls from 'tls';
import {
    Ssl,
    Sequelize,
} from './db';

export const naasProxyHost = process.env.NAAS_PROXY_HOST || 'public.naas.ai';
const naasMainainer = process.env.NAAS_MAINTAINER || 'devops@cashstory.com';

const greenlock = Greenlock.create({
    store: GreenlockStore.create({ db: Sequelize }),
    maintainerEmail: naasMainainer,
    staging: true,
});

async function getSecureContexts(serverName) {
    const result = await Ssl.findAll({
        where: {
            domain: serverName,
        },
    });

    return tls.createSecureContext({
        key: result.key,
        cert: result.cert,
        ca: null,
    });
}
const genereateCertif = async (domain) => {
    // eslint-disable-next-line no-console
    console.log('genereateCertif', domain);
    try {
        const result = await greenlock.create({
            subject: domain,
        });
        return result;
    } catch (err) {
    // eslint-disable-next-line no-console
        console.error(err);
        return false;
    }
};
const deleteCertif = async (domain) => {
    // eslint-disable-next-line no-console
    console.log('deleteCertif', domain);
    try {
        await greenlock.remove({
            subject: domain,
        });
        return true;
    } catch (err) {
    // eslint-disable-next-line no-console
        console.error(err);
        return false;
    }
};

export const createSsl = async (domain) => {
    try {
        const { key, cert } = await genereateCertif(domain);
        await Ssl.create({
            key,
            cert,
        });
        return true;
    } catch (err) {
        // eslint-disable-next-line no-console
        console.error(err);
        return false;
    }
};

export const deleteSsl = async (domain) => {
    try {
        await deleteCertif(domain);
        await Ssl.destroy({
            where: {
                domain,
            },
        });
        return true;
    } catch (err) {
        // eslint-disable-next-line no-console
        console.error(err);
        return false;
    }
};
export const createMainSsl = async () => {
    await Ssl.sync();
    const ssl = await Ssl.findOne({
        where: {
            naasProxyHost,
        },
    });
    if (!ssl) {
        await createSsl(naasProxyHost);
    }
    return ssl;
};
export const optionsSsl = {
    // A function that will be called if the client supports SNI TLS extension.
    SNICallback: async (servername, cb) => {
        const ctx = await getSecureContexts(servername);

        if (!ctx) {
            throw new Error('No keys/certificates for domain requested');
        }

        if (cb) {
            return cb(null, ctx);
        }
        return ctx;
    },
};
