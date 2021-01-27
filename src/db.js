import sequelize from 'sequelize';

const uri = process.env.HUB_DB;
let sql;

if (uri) {
    sql = new sequelize.Sequelize(uri, { logging: false });
} else {
    sql = new sequelize.Sequelize({
        dialect: 'sqlite',
        storage: 'database.sqlite',
        // eslint-disable-next-line no-console
        // logging: (...msg) => console.log(msg), // Displays all log function call parameters
    });
}

export const Domain = sql.define('Domain', {
    domain: {
        type: sequelize.DataTypes.STRING,
        allowNull: false,
    },
    email: {
        type: sequelize.DataTypes.STRING,
        allowNull: false,
    },
    endPointType: {
        type: sequelize.DataTypes.STRING,
        allowNull: true,
        defaultValue: null,
    },
    token: {
        type: sequelize.DataTypes.STRING,
        allowNull: true,
        defaultValue: null,
    },
});

export const Ssl = sql.define('Ssl', {
    domain: {
        type: sequelize.DataTypes.STRING,
        allowNull: false,
    },
    key: {
        type: sequelize.DataTypes.STRING,
        allowNull: false,
    },
    cert: {
        type: sequelize.DataTypes.STRING,
        allowNull: false,
    },
});
export const Sequelize = sql;
