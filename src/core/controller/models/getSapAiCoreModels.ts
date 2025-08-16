import axios from "axios"
import { Controller } from ".."
import { SapAiCoreModelsRequest } from "@/shared/proto/cline/models"
import { StringArray } from "@/shared/proto/cline/common"
import fs from "fs/promises"
import path from "path"
import crypto from "crypto"
import { fileExistsAtPath } from "@utils/fs"

// Schema version for SAP AI Core cache structure
// Increment this when adding new fields or changing cache structure
const SAP_AI_CORE_CACHE_SCHEMA_VERSION = "1.0.0"

interface Token {
	access_token: string
	expires_in: number
	scope: string
	jti: string
	token_type: string
	expires_at: number
}

/**
 * Authenticates with SAP AI Core and returns an access token
 * @param clientId SAP AI Core client ID
 * @param clientSecret SAP AI Core client secret
 * @param tokenUrl SAP AI Core token URL
 * @returns Promise<Token> Access token with metadata
 */
async function getToken(clientId: string, clientSecret: string, tokenUrl: string): Promise<Token> {
	const payload = new URLSearchParams({
		grant_type: "client_credentials",
		client_id: clientId,
		client_secret: clientSecret,
	})

	const url = tokenUrl.replace(/\/+$/, "") + "/oauth/token"
	const response = await axios.post(url, payload, {
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
	})
	const token = response.data as Token
	token.expires_at = Date.now() + token.expires_in * 1000
	return token
}

/**
 * Fetches model names from SAP AI Core deployments
 * @param accessToken Access token for authentication
 * @param baseUrl SAP AI Core base URL
 * @param resourceGroup SAP AI Core resource group
 * @returns Promise<string[]> Array of model names from running deployments
 */
async function fetchAiCoreModelNames(accessToken: string, baseUrl: string, resourceGroup: string): Promise<string[]> {
	if (!accessToken) {
		return ["ai-core-not-configured"]
	}

	const headers = {
		Authorization: `Bearer ${accessToken}`,
		"AI-Resource-Group": resourceGroup || "default",
		"Content-Type": "application/json",
		"AI-Client-Type": "Cline",
	}

	const url = `${baseUrl}/v2/lm/deployments?$top=10000&$skip=0`

	try {
		const response = await axios.get(url, { headers })
		const deployments = response.data.resources

		return deployments
			.filter((deployment: any) => deployment.targetStatus === "RUNNING")
			.map((deployment: any) => {
				const model = deployment.details?.resources?.backend_details?.model
				if (!model?.name || !model?.version) {
					return null // Skip this row
				}
				return `${model.name}:${model.version}`
			})
			.filter((modelName: string | null) => modelName !== null)
	} catch (error) {
		console.error("Error fetching deployments:", error)
		throw new Error("Failed to fetch deployments")
	}
}

interface CachedSapAiCoreData {
	modelNames: string[]
	configHash: string
	schemaVersion: string
}

/**
 * Ensures the cache directory exists and returns its path
 */
async function ensureCacheDirectoryExists(controller: Controller): Promise<string> {
	const cacheDir = path.join(controller.context.globalStorageUri.fsPath, "cache")
	try {
		await fs.mkdir(cacheDir, { recursive: true })
	} catch (error) {
		// Directory might already exist
	}
	return cacheDir
}

/**
 * Generates a hash of the configuration for cache validation
 */
function generateConfigHash(request: SapAiCoreModelsRequest): string {
	return crypto.createHash("md5").update(`${request.clientId}-${request.baseUrl}-${request.resourceGroup}`).digest("hex")
}

/**
 * Gets cached SAP AI Core data if available and valid
 */
async function getCachedData(controller: Controller, configHash: string): Promise<CachedSapAiCoreData | null> {
	const cacheFilePath = path.join(await ensureCacheDirectoryExists(controller), "sap_ai_core_models.json")

	try {
		if (await fileExistsAtPath(cacheFilePath)) {
			const cachedData = JSON.parse(await fs.readFile(cacheFilePath, "utf-8")) as CachedSapAiCoreData

			// Check BOTH config hash AND schema version
			if (cachedData.configHash === configHash && cachedData.schemaVersion === SAP_AI_CORE_CACHE_SCHEMA_VERSION) {
				return cachedData
			}

			// Log why cache was invalidated
			if (cachedData.configHash !== configHash) {
				console.log("SAP AI Core cache invalidated: configuration changed")
			} else if (cachedData.schemaVersion !== SAP_AI_CORE_CACHE_SCHEMA_VERSION) {
				console.log(
					`SAP AI Core cache invalidated: schema version changed from ${cachedData.schemaVersion} to ${SAP_AI_CORE_CACHE_SCHEMA_VERSION}`,
				)
			}
		}
	} catch (error) {
		console.error("Error reading SAP AI Core cache:", error)
	}

	return null
}

/**
 * Saves SAP AI Core data to cache
 */
async function saveCachedData(controller: Controller, modelNames: string[], configHash: string): Promise<void> {
	const cacheFilePath = path.join(await ensureCacheDirectoryExists(controller), "sap_ai_core_models.json")

	const cacheData: CachedSapAiCoreData = {
		modelNames,
		configHash,
		schemaVersion: SAP_AI_CORE_CACHE_SCHEMA_VERSION,
	}

	try {
		await fs.writeFile(cacheFilePath, JSON.stringify(cacheData, null, 2))
		console.log(`SAP AI Core models cached with schema version ${SAP_AI_CORE_CACHE_SCHEMA_VERSION}`)
	} catch (error) {
		console.error("Error saving SAP AI Core cache:", error)
	}
}

/**
 * Fetches available models from SAP AI Core deployments
 * @param controller The controller instance
 * @param request The request containing SAP AI Core configuration
 * @returns StringArray of model names
 */
export async function getSapAiCoreModels(controller: Controller, request: SapAiCoreModelsRequest): Promise<StringArray> {
	try {
		// Check if required configuration is provided
		if (!request.clientId || !request.clientSecret || !request.baseUrl) {
			// Return empty array if configuration is incomplete
			return StringArray.create({ values: [] })
		}

		const configHash = generateConfigHash(request)

		// 1. CHECK CACHE FIRST (unless forcing refresh)
		if (!request.forceModelsRefresh) {
			const cachedData = await getCachedData(controller, configHash)
			if (cachedData) {
				console.log("Using cached SAP AI Core models")
				return StringArray.create({ values: cachedData.modelNames })
			}
		}

		// 2. FETCH FROM API (cache miss OR forced refresh)
		const token = await getToken(request.clientId, request.clientSecret, request.tokenUrl)
		const modelNames = await fetchAiCoreModelNames(token.access_token, request.baseUrl, request.resourceGroup)

		// Extract base model names (without version) and sort
		const baseModelNames = modelNames.map((modelName) => modelName.split(":")[0].toLowerCase()).sort()

		// 3. SAVE TO CACHE
		await saveCachedData(controller, baseModelNames, configHash)

		return StringArray.create({ values: baseModelNames })
	} catch (error) {
		console.error("Error fetching SAP AI Core models:", error)
		return StringArray.create({ values: [] })
	}
}
