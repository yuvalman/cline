import { Controller } from ".."
import { StringArray } from "../../../shared/proto/common"
import { SapAiCoreModelsRequest } from "../../../shared/proto/models"
import { SapAiCoreHandler } from "../../../api/providers/sapaicore"

/**
 * Fetches available models from SAP AI Core deployments
 * @param controller The controller instance
 * @param request The request containing SAP AI Core configuration
 * @returns Array of deployment model names
 */
export async function getSapAiCoreModels(controller: Controller, request: SapAiCoreModelsRequest): Promise<StringArray> {
	try {
		// Check if required configuration is provided
		if (!request.clientId || !request.clientSecret || !request.baseUrl) {
			// Return empty array if configuration is incomplete
			return StringArray.create({ values: [] })
		}

		// Create SAP AI Core handler with provided configuration
		const sapAiCoreHandler = new SapAiCoreHandler({
			sapAiCoreClientId: request.clientId,
			sapAiCoreClientSecret: request.clientSecret,
			sapAiCoreTokenUrl: request.tokenUrl,
			sapAiResourceGroup: request.resourceGroup,
			sapAiCoreBaseUrl: request.baseUrl,
		})

		// Use the existing getAiCoreDeployments method through reflection
		// Since it's private, we need to access it through the handler instance
		const deployments = await (sapAiCoreHandler as any).getAiCoreDeployments()

		// Extract model names from deployments
		const modelNames = deployments.map((deployment: any) => deployment.name.split(":")[0].toLowerCase()).sort()

		return StringArray.create({ values: modelNames })
	} catch (error) {
		console.error("Error fetching SAP AI Core models:", error)
		return StringArray.create({ values: [] })
	}
}
