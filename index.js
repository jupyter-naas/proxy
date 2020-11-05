import queryString from 'query-string';
import express from 'express';
import morgan from 'morgan';
import Base64 from 'js-base64';
import httpErrorPages from 'http-error-pages';
import Sentry from '@sentry/node';
import Tracing from '@sentry/tracing';
import proxy from 'express-http-proxy';
import bodyParser from 'body-parser';
import seq from 'sequelize';
import axios from 'axios';

const uri = process.env.PROXY_DB;
let sequelize;

if (uri) {
    sequelize = new seq.Sequelize(uri, { logging: false });
} else {
    sequelize = new seq.Sequelize({
        dialect: 'sqlite',
        storage: 'database.sqlite',
        // eslint-disable-next-line no-console
        // logging: (...msg) => console.log(msg), // Displays all log function call parameters
    });
}
const Domain = sequelize.define('Domain', {
    domain: {
        type: seq.DataTypes.STRING,
        allowNull: false,
    },
    email: {
        type: seq.DataTypes.STRING,
        allowNull: false,
    },
    endPointType: {
        type: seq.DataTypes.STRING,
        allowNull: true,
        defaultValue: null,
    },
    token: {
        type: seq.DataTypes.STRING,
        allowNull: true,
        defaultValue: null,
    },
});

const jsonParser = bodyParser.json();

const app = express();
httpErrorPages.express(app, {
    lang: 'en_US',
});
const port = (process.env.PORT || 3002);
app.disable('x-powered-by');
app.set('port', port);
app.use(morgan('tiny'));
if (process.env.SENTRY_DSN) {
    Sentry.init({
        dsn: process.env.SENTRY_DSN,
        integrations: [
            new Sentry.Integrations.Http({ tracing: true }),
            new Tracing.Integrations.Express({ app }),
        ],
        tracesSampleRate: 1.0,
    });
    app.use(Sentry.Handlers.requestHandler());
    app.use(Sentry.Handlers.tracingHandler());
}

const singleUserPath = process.env.SINGLEUSER_PATH || '.jupyter-single-user.dev.svc.cluster.local';
const singleUserBase = process.env.SINGLEUSER_BASE || 'http://jupyter-';
const singleUserPort = process.env.NAAS_PORT || 5000;
const naasProxyHost = process.env.NAAS_PROXY_HOST || 'public.naas.ai';
const hubHost = process.env.HUB_HOST || 'app.naas.ai';

const decodeUser = (userNameB64) => {
    if (userNameB64 === 'localhost') {
        return `http://${userNameB64}:${singleUserPort}`;
    }
    return Base64.decode(userNameB64);
};
const createUrlBase = (userName) => `${singleUserBase}${userName}${singleUserPath}:${singleUserPort}`;

const hostToUser = async (domain, token = null, endPointType = null) => {
    const query = { domain };
    if (token) {
        query.token = token;
    }
    if (endPointType) {
        query.endPointType = endPointType;
    }
    const result = await Domain.findOne(query);
    return result;
};

const proxyAll = (req, res, next) => {
    const { userNameB64 } = req.params;
    let { endPointType, token } = req.params;
    let userName = null;
    if (!userNameB64) {
        res.status(400).json({ error: 'missing username' });
        return Promise.resolve();
    }
    if (req.hostname !== naasProxyHost) {
        const data = hostToUser(req.hostname, userNameB64, endPointType);
        if (data) {
            userName = data.email;
            token = token || data.token;
            endPointType = endPointType || data.endPointType;
        } else {
            return res.status(400).json({ error: 'domain not found' });
        }
    } else {
        userName = decodeUser(userNameB64);
    }
    const query = queryString.stringify(req.query || {});
    let url = createUrlBase(userName);
    if (endPointType) {
        url = `${url}/${endPointType}`;
    }
    if (token) {
        url = `${url}/${token}`;
    }
    url += (query ? `?${query}` : '/');
    return proxy(url, {
        preserveHostHdr: true,
        proxyReqPathResolver: () => url,
    })(req, res, next);
};
const routerProxy = express.Router();

const authToHub = async (req, res, next) => {
    try {
        const options = {
            method: 'GET',
            headers: {
                'content-type': 'application/json',
                Authorization: req.headers.Authorization,
            },
            ur: `${hubHost}/hub/api/user`,
        };
        const result = await axios(options);
        if (!result || !result.email) {
            throw Error('User not found');
        }
        req.auth = { email: result.email };
        return next();
    } catch (err) {
        return res.status(500).send(err);
    }
};

const proxySet = async (req, res) => {
    const { email } = req.auth;
    const { domain, token, endPointType } = req.body;
    try {
        const result = await Domain.findOrCreate({
            where: {
                email,
                domain,
            },
        });
        result.token = token;
        result.endPointType = endPointType;
        result.save();
        return res.status(200).json(result);
    } catch (err) {
        return res.status(500).send(err);
    }
};

const proxyGet = async (req, res) => {
    const { email } = req.auth;
    try {
        const result = await Domain.findAll({
            email,
        });
        return res.status(200).json(result);
    } catch (err) {
        return res.status(500).send(err);
    }
};

const proxyDelete = async (req, res) => {
    const { email } = req.auth;
    const { domain, token, endPointType } = req.body;
    try {
        const result = await Domain.destroy({
            where: {
                email,
                domain,
                token,
                endPointType,
            },
        });
        return res.status(200).json(result);
    } catch (err) {
        return res.status(500).send(err);
    }
};

routerProxy.route('/proxy').post(jsonParser, authToHub, proxySet);
routerProxy.route('/proxy').get(jsonParser, authToHub, proxyGet);
routerProxy.route('/proxy').delete(jsonParser, authToHub, proxyDelete);
routerProxy.route('/:userNameB64/:endPointType/:token').post(proxyAll);
routerProxy.route('/:userNameB64/:endPointType/:token').get(proxyAll);
routerProxy.route('/:userNameB64/:endPointType').get(proxyAll);
routerProxy.route('/:userNameB64').get(proxyAll);
routerProxy.route('/').get(proxyAll);

app.use('/', routerProxy);
// app.get('/', (req, res) => res.status(200).json({ status: 'ok' }));
if (process.env.SENTRY_DSN) {
    app.use(Sentry.Handlers.errorHandler());
    // eslint-disable-next-line no-console
    console.log('Sentry enabled', process.env.SENTRY_DSN);
}
// eslint-disable-next-line no-console
console.log('Start server');
app.listen(app.get('port'), () => {
    sequelize.authenticate().then(async () => {
        await Domain.sync();
        // eslint-disable-next-line no-console
        console.log('Connection has been established successfully.');
        // eslint-disable-next-line no-console
        console.log(`Proxy PID ${process.pid}, port ${app.get('port')}, http://localhost:${app.get('port')}`);
    }).catch((error) => {
        // eslint-disable-next-line no-console
        console.error('Unable to connect to the database:', error);
    });
});
