import axios from "axios"
import { Controller } from ".."
import { SapAiCoreModelsRequest, SapAiCoreModelsResponse } from "@/shared/proto/cline/models"
import fs from "fs/promises"
import path from "path"
import crypto from "crypto"
import { fileExistsAtPath } from "@utils/fs"

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
 * Fetches model names and orchestration availability from SAP AI Core deployments
 * @param accessToken Access token for authentication
 * @param baseUrl SAP AI Core base URL
 * @param resourceGroup SAP AI Core resource group
 * @returns Promise<{modelNames: string[], orchestrationAvailable: boolean}> Model names and orchestration availability
 */
async function fetchAiCoreModelsAndOrchestration(
	accessToken: string,
	baseUrl: string,
	resourceGroup: string,
): Promise<{ modelNames: string[]; orchestrationAvailable: boolean }> {
	if (!accessToken) {
		return { modelNames: ["ai-core-not-configured"], orchestrationAvailable: false }
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

		// Filter running deployments
		const runningDeployments = deployments.filter((deployment: any) => deployment.targetStatus === "RUNNING")

		// Check for orchestration deployment
		const orchestrationAvailable = runningDeployments.some((deployment: any) => deployment.scenarioId === "orchestration")

		// Extract model names from deployments
		const modelNames = runningDeployments
			.map((deployment: any) => {
				const model = deployment.details?.resources?.backend_details?.model
				if (!model?.name || !model?.version) {
					return null // Skip this row
				}
				return `${model.name}:${model.version}`
			})
			.filter((modelName: string | null) => modelName !== null)

		return { modelNames, orchestrationAvailable }
	} catch (error) {
		console.error("Error fetching deployments:", error)
		throw new Error("Failed to fetch deployments")
	}
}

interface CachedSapAiCoreData {
	modelNames: string[]
	orchestrationAvailable: boolean
	configHash: string
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

			// Check if cache is for the same configuration
			if (cachedData.configHash === configHash) {
				return cachedData
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
async function saveCachedData(
	controller: Controller,
	modelNames: string[],
	orchestrationAvailable: boolean,
	configHash: string,
): Promise<void> {
	const cacheFilePath = path.join(await ensureCacheDirectoryExists(controller), "sap_ai_core_models.json")

	const cacheData: CachedSapAiCoreData = {
		modelNames,
		orchestrationAvailable,
		configHash,
	}

	try {
		await fs.writeFile(cacheFilePath, JSON.stringify(cacheData, null, 2))
	} catch (error) {
		console.error("Error saving SAP AI Core cache:", error)
	}
}

/**
 * Fetches available models from SAP AI Core deployments and orchestration availability
 * @param controller The controller instance
 * @param request The request containing SAP AI Core configuration
 * @returns SapAiCoreModelsResponse with model names and orchestration availability
 */
export async function getSapAiCoreModels(
	controller: Controller,
	request: SapAiCoreModelsRequest,
): Promise<SapAiCoreModelsResponse> {
	try {
		// Check if required configuration is provided
		if (!request.clientId || !request.clientSecret || !request.baseUrl) {
			// Return empty response if configuration is incomplete
			return SapAiCoreModelsResponse.create({
				modelNames: [],
				orchestrationAvailable: false,
			})
		}

		const configHash = generateConfigHash(request)

		// 1. CHECK CACHE FIRST (unless forcing refresh)
		if (!request.forceModelsRefresh) {
			const cachedData = await getCachedData(controller, configHash)
			if (cachedData) {
				console.log("Using cached SAP AI Core models")
				return SapAiCoreModelsResponse.create({
					modelNames: cachedData.modelNames,
					orchestrationAvailable: cachedData.orchestrationAvailable,
				})
			}
		}

		// 2. FETCH FROM API (cache miss OR forced refresh)
		console.log(request.forceModelsRefresh ? "Force refreshing SAP AI Core models" : "Fetching fresh SAP AI Core models")
		const token = await getToken(request.clientId, request.clientSecret, request.tokenUrl)
		const { modelNames, orchestrationAvailable } = await fetchAiCoreModelsAndOrchestration(
			token.access_token,
			request.baseUrl,
			request.resourceGroup,
		)

		// Extract base model names (without version) and sort
		const baseModelNames = modelNames.map((modelName: string) => modelName.split(":")[0].toLowerCase()).sort()

		// 3. SAVE TO CACHE
		await saveCachedData(controller, baseModelNames, orchestrationAvailable, configHash)

		return SapAiCoreModelsResponse.create({
			modelNames: baseModelNames,
			orchestrationAvailable,
		})
	} catch (error) {
		console.error("Error fetching SAP AI Core models:", error)

		// 4. FALLBACK TO CACHE ON ERROR
		const configHash = generateConfigHash(request)
		const cachedData = await getCachedData(controller, configHash)
		if (cachedData) {
			console.log("Using cached SAP AI Core models due to API error")
			return SapAiCoreModelsResponse.create({
				modelNames: cachedData.modelNames,
				orchestrationAvailable: cachedData.orchestrationAvailable,
			})
		}

		return SapAiCoreModelsResponse.create({
			modelNames: [],
			orchestrationAvailable: false,
		})
	}
}
