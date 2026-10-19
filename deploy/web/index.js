const [host, port] = (
  process.env.AWS_LAMBDA_HTTP_ENDPOINT ?? "localhost:3000"
).split(":");

process.env.HOSTNAME = host;
process.env.PORT = port;

require("./web/server.js");
