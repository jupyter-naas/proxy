import httpErrorPages from 'http-error-pages';
import Sentry from '@sentry/node';
import Tracing from '@sentry/tracing';
import express from 'express';
import morgan from 'morgan';
import http from 'http';
import https from 'https';
import RouterProxy from './proxy_all';
import RouterProxyApi from './proxy_api';
import {
    Domain, Sequelize,
} from './db';
import {
    optionsSsl, createMainSsl, naasProxyHost,
} from './ssl';

const app = express();
httpErrorPages.express(app, {
    lang: 'en_US',
});
const { SSL } = process.env;
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

app.use('/proxy', RouterProxyApi);
app.use('/', RouterProxy);
// app.get('/', (req, res) => res.status(200).json({ status: 'ok' }));
if (process.env.SENTRY_DSN) {
    app.use(Sentry.Handlers.errorHandler());
    // eslint-disable-next-line no-console
    console.log('Sentry enabled', process.env.SENTRY_DSN);
}
// eslint-disable-next-line no-console
console.log('Start server');
const httpServer = http.createServer(app);
const httpsServer = https.createServer(optionsSsl, app);

httpServer.listen(app.get('port'), () => {
    Sequelize.authenticate().then(async () => {
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
if (SSL) {
    httpsServer.listen(443, async () => {
        await createMainSsl();
        // eslint-disable-next-line no-console
        console.log(`Proxy https on https://${naasProxyHost}}`);
    });
}
