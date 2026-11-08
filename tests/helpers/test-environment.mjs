// Test-process overrides only. Do not read or restore inherited secret values.
process.env.NODE_ENV='test';
process.env.COOKIE_SECURE='0';
process.env.DEMO_PASSWORDS_JSON='';
process.env.DEMO_COORDINATOR_PASSWORD='';
process.env.DEMO_VOLUNTEER_PASSWORD='';
