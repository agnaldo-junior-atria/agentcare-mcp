import fs from "fs";
import path from "path";

export function logToFile(data: unknown) {
  const logFilePath = path.join("debug.log");
  const logEntry = JSON.stringify(data) + "\n";

  fs.appendFile(logFilePath, logEntry, (error: unknown) => {
    if (error) {
      console.error("Error writing to log file:", error);
    }
  });
}
