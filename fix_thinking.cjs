const fs = require('fs');

let server = fs.readFileSync('server.ts', 'utf8');

// Update /api/scan Attempt 1
server = server.replace(
  'model: "gemini-3.6-flash",\n        contents: { parts },\n        config: {\n          responseMimeType: "application/json",\n        }',
  'model: "gemini-3.1-pro-preview",\n        contents: { parts },\n        config: {\n          thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },\n          responseMimeType: "application/json",\n        }'
);

// Update /api/ask
server = server.replace(
  'model: "gemini-3.6-flash",\n      contents: promptText,\n    });',
  'model: "gemini-3.1-pro-preview",\n      contents: promptText,\n      config: {\n        thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },\n      },\n    });'
);

fs.writeFileSync('server.ts', server);
