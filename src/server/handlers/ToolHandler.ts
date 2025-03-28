import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { parseClinicianQuery } from "../../query-parser.js";
import { FhirClient } from "../connectors/fhir/FhirClient.js";
import { ClinicalTrials } from "../connectors/medical/ClinicalTrials.js";
import { FDA } from "../connectors/medical/FDA.js";
import { PubMed } from "../connectors/medical/PubMed.js";
import { TOOL_DEFINITIONS } from "../constants/tools.js";
import { Auth } from "../utils/Auth.js";
import { AuthConfig } from "../utils/AuthConfig.js";
import { CacheManager } from "../utils/Cache.js";

export class ToolHandler {
  private fhirClient: FhirClient;
  private cache: CacheManager;
  private auth!: Auth;
  private authInitialized: boolean = false;
  private authConfig: AuthConfig;
  private pubmedApi?: PubMed;
  private trialsApi?: ClinicalTrials;
  private fdaApi?: FDA;

  constructor(
    authConfig: AuthConfig,
    fhirClient: FhirClient,
    cache: CacheManager,
    pubmedApi?: PubMed,
    trialsApi?: ClinicalTrials,
    fdaApi?: FDA
  ) {
    this.authConfig = authConfig;
    this.cache = cache;
    this.fhirClient = fhirClient;
    this.pubmedApi = pubmedApi;
    this.trialsApi = trialsApi;
    this.fdaApi = fdaApi;
  }

  register(mcpServer: McpServer) {
    mcpServer.server.setRequestHandler(ListToolsRequestSchema, this.handleList);
    mcpServer.server.setRequestHandler(CallToolRequestSchema, this.handleCall);
  }

  private handleList = async () => ({
    tools: TOOL_DEFINITIONS,
  });

  private handleCall = async (request: any) => {
    if (
      request.params?.name != "find_patient" &&
      request.params?.name != "get-drug" &&
      request.params?.name != "search-trials" &&
      request.params?.name != "search-pubmed"
    ) {
      if (!request.params?.arguments?.patientId) {
        throw new McpError(ErrorCode.InvalidParams, "patientId is required");
      }
    }

    //initalize auth if not already initialized. this will set up the callback server
    if (!this.authInitialized) {
      this.auth = new Auth(this.authConfig);
      this.authInitialized = true;
    }

    return this.auth.executeWithAuth(async () => {
      const access_token = await this.auth.ensureValidToken();

      this.fhirClient.setAccessToken(access_token);

      switch (request.params.name) {
        case "clinical_query":
          return await this.handleClinicalQuery(request.params.arguments);
        case "find_patient":
          return await this.fhirClient.findPatient(request.params.arguments);
        case "get_patient_observations":
          return await this.fhirClient.getPatientObservations(
            request.params.arguments
          );
        case "get_patient_conditions":
          return await this.fhirClient.getPatientConditions(
            request.params.arguments
          );
        case "get_patient_medications":
          return await this.fhirClient.getPatientMedications(
            request.params.arguments
          );
        case "get_patient_encounters":
          return await this.fhirClient.getPatientEncounters(
            request.params.arguments
          );
        case "get_patient_allergies":
          return await this.fhirClient.getPatientAllergies(
            request.params.arguments
          );
        case "get_patient_procedures":
          return await this.fhirClient.getPatientProcedures(
            request.params.arguments
          );
        case "get_patient_careteam":
          return await this.fhirClient.getPatientCareTeam(
            request.params.arguments
          );
        case "get_patient_careplans":
          return await this.fhirClient.getPatientCarePlans(
            request.params.arguments
          );
        case "get_vital_signs":
          return await this.fhirClient.getPatientVitalSigns(
            request.params.arguments
          );
        case "get_lab_results":
          return await this.fhirClient.getPatientLabResults(
            request.params.arguments
          );
        case "get_medications_history":
          return await this.fhirClient.getMedicationHistory(
            request.params.arguments
          );
        case "get_appointments":
          return await this.fhirClient.getPatientAppointments(
            request.params.arguments
          );
        case "search-pubmed":
          if (!this.pubmedApi) {
            throw new McpError(
              ErrorCode.InternalError,
              `PubMed intergration disabled`
            );
          }
          return await this.pubmedApi.getArticles(
            request.params.arguments,
            this.cache
          );
        case "search-trials":
          if (!this.trialsApi) {
            throw new McpError(
              ErrorCode.InternalError,
              `Trials integration disabled`
            );
          }
          return await this.trialsApi.getTrials(
            request.params.arguments,
            this.cache
          );
        case "get-drug-info":
          if (!this.fdaApi) {
            throw new McpError(
              ErrorCode.InternalError,
              `FDA integration disabled`
            );
          }
          return await this.fdaApi.getDrug(
            request.params.arguments,
            this.cache
          );
        default:
          throw new McpError(
            ErrorCode.MethodNotFound,
            `Unknown tool: ${request.params.name}`
          );
      }
    });
  };

  private async handleClinicalQuery(args: any) {
    if (!args.query) {
      throw new McpError(ErrorCode.InvalidParams, "Query is required");
    }

    try {
      const queryParams = await parseClinicianQuery(args.query);
      return await this.fhirClient.executeQuery(queryParams);
    } catch (error) {
      return this.fhirClient.handleError(error);
    }
  }
}
