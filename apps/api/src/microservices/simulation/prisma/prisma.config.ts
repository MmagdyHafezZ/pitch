import 'dotenv/config';

export default {
  schema: './schema.prisma',

  datasources: {
    db: {
      url:
        process.env.SIMULATION_DIRECT_URL ??
        process.env.SIMULATION_DATABASE_URL ??
        '',
    },
  },
};
