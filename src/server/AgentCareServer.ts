import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { FhirClient } from "./connectors/fhir/FhirClient.js";
import { ClinicalTrials } from "./connectors/medical/ClinicalTrials.js";
import { FDA } from "./connectors/medical/FDA.js";
import { PubMed } from "./connectors/medical/PubMed.js";
import { ToolHandler } from "./handlers/ToolHandler.js";
import { AuthConfig } from "./utils/AuthConfig.js";
import { CacheManager } from "./utils/Cache.js";

export class AgentCareServer {
  private mcpServer: McpServer;
  private toolHandler: ToolHandler;
  private fhirClient: FhirClient;
  private cache: CacheManager;
  private pubmedApi?: PubMed;
  private trialsApi?: ClinicalTrials;
  private fdaApi?: FDA;

  constructor(
    mcpServer: McpServer,
    authConfig: AuthConfig,
    fhirURL: string,
    pubmedAPIKey: string,
    trialsAPIKey: string,
    fdaAPIKey: string
  ) {
    this.mcpServer = mcpServer;
    this.fhirClient = new FhirClient(fhirURL);
    this.cache = new CacheManager();

    if (pubmedAPIKey) {
      this.pubmedApi = new PubMed(pubmedAPIKey);
    }

    if (trialsAPIKey) {
      this.trialsApi = new ClinicalTrials(trialsAPIKey);
    }

    if (fdaAPIKey) {
      this.fdaApi = new FDA(fdaAPIKey);
    }

    this.toolHandler = new ToolHandler(
      authConfig,
      this.fhirClient,
      this.cache,
      this.pubmedApi,
      this.trialsApi,
      this.fdaApi
    );

    this.setupHandlers();
    this.setupErrorHandling();
  }

  private setupHandlers() {
    this.toolHandler.register(this.mcpServer);
  }

  private setupErrorHandling() {
    this.mcpServer.server.onerror = (error) => {
      console.error("[MCP Error]", error);
    };

    process.on("SIGINT", async () => {
      await this.mcpServer.close();
      process.exit(0);
    });
  }

  async run() {
    const transport = new StdioServerTransport();

    await this.mcpServer.connect(transport);
    console.error("FHIR MCP server running on stdio");
  }
}
