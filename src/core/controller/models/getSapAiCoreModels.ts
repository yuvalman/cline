import { Controller } from ".."
import { SapAiCoreModelsRequest, SapAiCoreModelDeploymentArray, SapAiCoreModelDeployment } from "../../../shared/proto/models"
import { SapAiCoreHandler } from "../../../api/providers/sapaicore"

/**
 * Fetches available models from SAP AI Core deployments
 * @param controller The controller instance
 * @param request The request containing SAP AI Core configuration
 * @returns Array of model-deployment pairs
 */
export async function getSapAiCoreModels(
	controller: Controller,
	request: SapAiCoreModelsRequest,
): Promise<SapAiCoreModelDeploymentArray> {
	try {
		// Check if required configuration is provided
		if (!request.clientId || !request.clientSecret || !request.baseUrl) {
			// Return empty array if configuration is incomplete
			return SapAiCoreModelDeploymentArray.create({ deployments: [] })
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

		// Create model-deployment pairs
		const modelDeployments = deployments
			.map((deployment: any) => {
				const modelName = deployment.name.split(":")[0].toLowerCase()
				return SapAiCoreModelDeployment.create({
					modelName: modelName,
					deploymentId: deployment.id,
				})
			})
			.sort((a: any, b: any) => a.modelName.localeCompare(b.modelName))

		return SapAiCoreModelDeploymentArray.create({ deployments: modelDeployments })
	} catch (error) {
		console.error("Error fetching SAP AI Core models:", error)
		return SapAiCoreModelDeploymentArray.create({ deployments: [] })
	}
}
