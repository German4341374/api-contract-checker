import { createServer } from "node:http";

const port = Number(process.env.PORT ?? "3000");

const server = createServer((request, response) => {
  response.setHeader("content-type", "application/json; charset=utf-8");

  switch (request.url) {
    case "/healthy":
      response.writeHead(200).end(
        JSON.stringify({
          id: 1,
          name: "demo-api",
          state: "ready",
          profile: { active: true },
          tags: ["contract", "demo"],
        }),
      );
      break;
    case "/wrong-status":
      response.writeHead(418).end(JSON.stringify({ message: "Unexpected status" }));
      break;
    case "/wrong-schema":
      response.writeHead(200).end(
        JSON.stringify({
          id: "not-an-integer",
          state: "unknown",
          profile: { active: "yes" },
          tags: "not-an-array",
        }),
      );
      break;
    default:
      response.writeHead(404).end(JSON.stringify({ message: "Not found" }));
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(JSON.stringify({ level: "info", message: "Mock API listening", port }));
});

function shutdown(signal: string): void {
  console.log(JSON.stringify({ level: "info", message: "Shutting down", signal }));
  server.close((error) => {
    if (error !== undefined) {
      console.error(JSON.stringify({ level: "error", message: error.message }));
      process.exitCode = 1;
    }
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
