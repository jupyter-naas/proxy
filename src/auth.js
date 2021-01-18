import axios from 'axios';

const hubHost = process.env.HUB_HOST || 'app.naas.ai';

export default async (req, res, next) => {
    try {
        const options = {
            headers: {
                'content-type': 'application/json',
                authorization: req.headers.authorization,
            },
        };
        const result = await axios.get(`https://${hubHost}/hub/api/user`, options);
        if (!result || !result.data || !result.data.name) {
            throw Error('User not found');
        }
        req.auth = { email: result.data.name };
        return next();
    } catch (err) {
        return res.status(500).send(err);
    }
};
