import { useState, useCallback, useEffect } from "react"
import { VSCodeLink } from "@vscode/webview-ui-toolkit/react"
import { DebouncedTextField } from "../common/DebouncedTextField"
import { ModelInfoView } from "../common/ModelInfoView"
import { normalizeApiConfiguration } from "../utils/providerUtils"
import { useApiConfigurationHandlers } from "../utils/useApiConfigurationHandlers"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { Mode } from "@shared/storage/types"
import { ModelsServiceClient } from "@/services/grpc-client"
import { SapAiCoreModelsRequest, SapAiCoreModelDeployment } from "@shared/proto/index.cline"
import SapAiCoreModelPicker from "../SapAiCoreModelPicker"
/**
 * Props for the SapAiCoreProvider component
 */
interface SapAiCoreProviderProps {
	showModelOptions: boolean
	isPopup?: boolean
	currentMode: Mode
}

/**
 * The SAP AI Core provider configuration component
 */
export const SapAiCoreProvider = ({ showModelOptions, isPopup, currentMode }: SapAiCoreProviderProps) => {
	const { apiConfiguration, planActSeparateModelsSetting } = useExtensionState()
	const { handleFieldChange, handleModeFieldChange, handleModeFieldsChange } = useApiConfigurationHandlers()

	const { selectedModelId, selectedModelInfo } = normalizeApiConfiguration(apiConfiguration, currentMode)

	// State for dynamic model fetching
	const [sapAiCoreDeployedDeployments, setSapAiCoreDeployedDeployments] = useState<SapAiCoreModelDeployment[]>([])
	const [isLoadingModels, setIsLoadingModels] = useState(false)
	const [modelError, setModelError] = useState<string | null>(null)

	// Check if all required credentials are available
	const hasRequiredCredentials =
		apiConfiguration?.sapAiCoreClientId &&
		apiConfiguration?.sapAiCoreClientSecret &&
		apiConfiguration?.sapAiCoreBaseUrl &&
		apiConfiguration?.sapAiCoreTokenUrl &&
		apiConfiguration?.sapAiResourceGroup

	// Function to fetch SAP AI Core models
	const fetchSapAiCoreModels = useCallback(async () => {
		if (!hasRequiredCredentials) {
			setSapAiCoreDeployedDeployments([])
			return
		}

		setIsLoadingModels(true)
		setModelError(null)

		try {
			const response = await ModelsServiceClient.getSapAiCoreModels(
				SapAiCoreModelsRequest.create({
					clientId: apiConfiguration.sapAiCoreClientId,
					clientSecret: apiConfiguration.sapAiCoreClientSecret,
					baseUrl: apiConfiguration.sapAiCoreBaseUrl,
					tokenUrl: apiConfiguration.sapAiCoreTokenUrl,
					resourceGroup: apiConfiguration.sapAiResourceGroup,
				}),
			)

			if (response && response.deployments) {
				setSapAiCoreDeployedDeployments(response.deployments)
			} else {
				setSapAiCoreDeployedDeployments([])
			}
		} catch (error) {
			console.error("Error fetching SAP AI Core models:", error)
			setModelError("Failed to fetch models. Please check your configuration.")
			setSapAiCoreDeployedDeployments([])
		} finally {
			setIsLoadingModels(false)
		}
	}, [
		apiConfiguration?.sapAiCoreClientId,
		apiConfiguration?.sapAiCoreClientSecret,
		apiConfiguration?.sapAiCoreBaseUrl,
		apiConfiguration?.sapAiCoreTokenUrl,
		apiConfiguration?.sapAiResourceGroup,
	])

	// Fetch models when configuration changes
	useEffect(() => {
		if (showModelOptions && hasRequiredCredentials) {
			fetchSapAiCoreModels()
		}
	}, [showModelOptions, hasRequiredCredentials, fetchSapAiCoreModels])

	// Auto-update deployment IDs when deployments change
	useEffect(() => {
		if (sapAiCoreDeployedDeployments.length === 0) {
			return
		}

		// handleModeFieldsChange will handle plan/act logic based on planActSeparateModelsSetting
		const currentModelId = apiConfiguration?.[currentMode === "plan" ? "planModeApiModelId" : "actModeApiModelId"]
		const currentDeploymentId =
			apiConfiguration?.[currentMode === "plan" ? "planModeSapAiCoreDeploymentId" : "actModeSapAiCoreDeploymentId"]

		if (currentModelId && currentDeploymentId) {
			const matchingDeployment = sapAiCoreDeployedDeployments.find((d) => d.modelName === currentModelId)
			if (matchingDeployment && matchingDeployment.deploymentId !== currentDeploymentId) {
				// Let handleModeFieldsChange handle the plan/act logic
				handleModeFieldsChange(
					{
						modelId: { plan: "planModeApiModelId", act: "actModeApiModelId" },
						deploymentId: { plan: "planModeSapAiCoreDeploymentId", act: "actModeSapAiCoreDeploymentId" },
					},
					{ modelId: currentModelId, deploymentId: matchingDeployment.deploymentId },
					currentMode,
				)
			}
		}
	}, [
		sapAiCoreDeployedDeployments,
		currentMode,
		apiConfiguration?.planModeApiModelId,
		apiConfiguration?.planModeSapAiCoreDeploymentId,
		apiConfiguration?.actModeApiModelId,
		apiConfiguration?.actModeSapAiCoreDeploymentId,
		handleModeFieldsChange,
	])

	// Handle model selection
	const handleModelChange = useCallback(
		(modelId: string, deploymentId: string) => {
			// Update both model ID and deployment ID atomically
			handleModeFieldsChange(
				{
					modelId: { plan: "planModeApiModelId", act: "actModeApiModelId" },
					deploymentId: { plan: "planModeSapAiCoreDeploymentId", act: "actModeSapAiCoreDeploymentId" },
				},
				{ modelId, deploymentId },
				currentMode,
			)
		},
		[handleModeFieldsChange, currentMode],
	)

	return (
		<div className="flex flex-col gap-1.5">
			<DebouncedTextField
				initialValue={apiConfiguration?.sapAiCoreClientId || ""}
				onChange={(value) => handleFieldChange("sapAiCoreClientId", value)}
				style={{ width: "100%" }}
				type="password"
				placeholder="Enter AI Core Client Id...">
				<span className="font-medium">AI Core Client Id</span>
			</DebouncedTextField>
			{apiConfiguration?.sapAiCoreClientId && (
				<p className="text-xs text-[var(--vscode-descriptionForeground)]">
					Client Id is set. To change it, please re-enter the value.
				</p>
			)}

			<DebouncedTextField
				initialValue={apiConfiguration?.sapAiCoreClientSecret || ""}
				onChange={(value) => handleFieldChange("sapAiCoreClientSecret", value)}
				style={{ width: "100%" }}
				type="password"
				placeholder="Enter AI Core Client Secret...">
				<span className="font-medium">AI Core Client Secret</span>
			</DebouncedTextField>
			{apiConfiguration?.sapAiCoreClientSecret && (
				<p className="text-xs text-[var(--vscode-descriptionForeground)]">
					Client Secret is set. To change it, please re-enter the value.
				</p>
			)}

			<DebouncedTextField
				initialValue={apiConfiguration?.sapAiCoreBaseUrl || ""}
				onChange={(value) => handleFieldChange("sapAiCoreBaseUrl", value)}
				style={{ width: "100%" }}
				placeholder="Enter AI Core Base URL...">
				<span className="font-medium">AI Core Base URL</span>
			</DebouncedTextField>

			<DebouncedTextField
				initialValue={apiConfiguration?.sapAiCoreTokenUrl || ""}
				onChange={(value) => handleFieldChange("sapAiCoreTokenUrl", value)}
				style={{ width: "100%" }}
				placeholder="Enter AI Core Auth URL...">
				<span className="font-medium">AI Core Auth URL</span>
			</DebouncedTextField>

			<DebouncedTextField
				initialValue={apiConfiguration?.sapAiResourceGroup || ""}
				onChange={(value) => handleFieldChange("sapAiResourceGroup", value)}
				style={{ width: "100%" }}
				placeholder="Enter AI Core Resource Group...">
				<span className="font-medium">AI Core Resource Group</span>
			</DebouncedTextField>

			<p className="text-xs mt-1.5 text-[var(--vscode-descriptionForeground)]">
				These credentials are stored locally and only used to make API requests from this extension.
				<VSCodeLink
					href="https://help.sap.com/docs/sap-ai-core/sap-ai-core-service-guide/access-sap-ai-core-via-api"
					className="inline">
					You can find more information about SAP AI Core API access here.
				</VSCodeLink>
			</p>

			{showModelOptions && (
				<>
					<div className="flex flex-col gap-1.5">
						{isLoadingModels ? (
							<div className="text-xs text-[var(--vscode-descriptionForeground)]">Loading models...</div>
						) : modelError ? (
							<div className="text-xs text-[var(--vscode-errorForeground)]">
								{modelError}
								<button
									onClick={fetchSapAiCoreModels}
									className="ml-2 text-[11px] px-1.5 py-0.5 bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] border-none rounded-sm cursor-pointer">
									Retry
								</button>
							</div>
						) : hasRequiredCredentials ? (
							<>
								{sapAiCoreDeployedDeployments.length === 0 && (
									<div className="text-xs text-[var(--vscode-errorForeground)] mb-2">
										Unable to fetch models from SAP AI Core service instance. Please check your SAP AI Core
										configuration or ensure your deployments are deployed and running in the service instance
									</div>
								)}
								<SapAiCoreModelPicker
									sapAiCoreModelDeployments={sapAiCoreDeployedDeployments}
									selectedModelId={selectedModelId || ""}
									onModelChange={handleModelChange}
									placeholder="Select a model..."
								/>
							</>
						) : (
							<div className="text-xs text-[var(--vscode-errorForeground)]">
								Please configure your SAP AI Core credentials to see available models.
							</div>
						)}
					</div>

					<ModelInfoView selectedModelId={selectedModelId} modelInfo={selectedModelInfo} isPopup={isPopup} />
				</>
			)}
		</div>
	)
}
