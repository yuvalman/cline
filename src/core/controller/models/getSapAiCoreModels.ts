import axios from "axios"
import { Controller } from ".."
import { SapAiCoreModelsRequest, SapAiCoreModelDeployments, SapAiCoreModelDeployment } from "@/shared/proto/index.cline"

interface Token {
	access_token: string
	expires_in: number
	scope: string
	jti: string
	token_type: string
	expires_at: number
}

interface Deployment {
	id: string
	name: string
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
 * Fetches deployments from SAP AI Core
 * @param accessToken Access token for authentication
 * @param baseUrl SAP AI Core base URL
 * @param resourceGroup SAP AI Core resource group
 * @returns Promise<Deployment[]> Array of running deployments
 */
async function fetchAiCoreDeployments(accessToken: string, baseUrl: string, resourceGroup: string): Promise<Deployment[]> {
	if (!accessToken) {
		return [{ id: "notconfigured", name: "ai-core-not-configured" }]
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
				return {
					id: deployment.id,
					name: `${model.name}:${model.version}`,
				}
			})
			.filter((deployment: any) => deployment !== null)
	} catch (error) {
		console.error("Error fetching deployments:", error)
		throw new Error("Failed to fetch deployments")
	}
}

/**
 * Fetches available models from SAP AI Core deployments
 * @param controller The controller instance
 * @param request The request containing SAP AI Core configuration
 * @returns Array of model-deployment pairs
 */
export async function getSapAiCoreModels(
	controller: Controller,
	request: SapAiCoreModelsRequest,
): Promise<SapAiCoreModelDeployments> {
	try {
		// Check if required configuration is provided
		if (!request.clientId || !request.clientSecret || !request.baseUrl) {
			// Return empty array if configuration is incomplete
			return SapAiCoreModelDeployments.create({ deployments: [] })
		}

		// Direct authentication and deployment fetching
		const token = await getToken(request.clientId, request.clientSecret, request.tokenUrl)
		const deployments = await fetchAiCoreDeployments(token.access_token, request.baseUrl, request.resourceGroup)

		// Create model-deployment pairs
		const modelDeployments = deployments
			.map((deployment) => {
				const modelName = deployment.name.split(":")[0].toLowerCase()
				return SapAiCoreModelDeployment.create({
					modelName: modelName,
					deploymentId: deployment.id,
				})
			})
			.sort((a, b) => a.modelName.localeCompare(b.modelName))

		return SapAiCoreModelDeployments.create({ deployments: modelDeployments })
	} catch (error) {
		console.error("Error fetching SAP AI Core models:", error)
		return SapAiCoreModelDeployments.create({ deployments: [] })
	}
}
