import { useState, useCallback, useEffect } from "react"
import { VSCodeLink, VSCodeCheckbox } from "@vscode/webview-ui-toolkit/react"
import { DebouncedTextField } from "../common/DebouncedTextField"
import { ModelInfoView } from "../common/ModelInfoView"
import { normalizeApiConfiguration } from "../utils/providerUtils"
import { useApiConfigurationHandlers } from "../utils/useApiConfigurationHandlers"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { Mode } from "@shared/storage/types"
import { ModelsServiceClient } from "@/services/grpc-client"
import { SapAiCoreModelsRequest } from "@shared/proto/index.cline"
import SapAiCoreModelPicker from "../SapAiCoreModelPicker"

// Module-level cache that persists across component mounts within the same VSCode session
let sessionCache: {
	credentialsHash: string
	models: string[]
	orchestrationAvailable: boolean
	hasChecked: boolean
} | null = null

// Helper function to create credentials hash for cache key
const getCredentialsHash = (config: any) => {
	return `${config?.sapAiCoreClientId || ""}-${config?.sapAiCoreBaseUrl || ""}-${config?.sapAiResourceGroup || ""}`
}
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
	const { apiConfiguration } = useExtensionState()
	const { handleFieldChange, handleModeFieldChange } = useApiConfigurationHandlers()

	// Handle orchestration checkbox change
	const handleOrchestrationChange = async (checked: boolean) => {
		await handleFieldChange("sapAiCoreUseOrchestrationMode", checked)
	}

	const { selectedModelId, selectedModelInfo } = normalizeApiConfiguration(apiConfiguration, currentMode)

	// State for dynamic model fetching
	const [deployedModelsArray, setDeployedModelsArray] = useState<string[]>([])
	const [orchestrationAvailable, setOrchestrationAvailable] = useState<boolean>(false)
	const [hasCheckedOrchestration, setHasCheckedOrchestration] = useState<boolean>(false)
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
			setDeployedModelsArray([])
			setOrchestrationAvailable(false)
			setHasCheckedOrchestration(false)
			// Clear cache for invalid credentials
			sessionCache = null
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

			const models = response?.modelNames || []
			const orchestration = response?.orchestrationAvailable || false

			// Update component state
			setDeployedModelsArray(models)
			setOrchestrationAvailable(orchestration)
			setHasCheckedOrchestration(true)

			// Update module-level cache
			sessionCache = {
				credentialsHash: getCredentialsHash(apiConfiguration),
				models,
				orchestrationAvailable: orchestration,
				hasChecked: true,
			}
		} catch (error) {
			console.error("Error fetching SAP AI Core models:", error)
			setModelError("Failed to fetch models. Please check your configuration.")
			setDeployedModelsArray([])
			setOrchestrationAvailable(false)
			setHasCheckedOrchestration(true)
			// Clear cache on error
			sessionCache = null
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

	// Session-based caching with module-level persistence
	useEffect(() => {
		if (!showModelOptions || !hasRequiredCredentials) return

		const currentCredentialsHash = getCredentialsHash(apiConfiguration)

		// Check if we have valid cached data for these credentials
		if (sessionCache && sessionCache.credentialsHash === currentCredentialsHash && sessionCache.hasChecked) {
			// Use cached data - no API call needed
			setDeployedModelsArray(sessionCache.models)
			setOrchestrationAvailable(sessionCache.orchestrationAvailable)
			setHasCheckedOrchestration(true)
			return
		}

		// No cache or credentials changed - fetch fresh data
		fetchSapAiCoreModels()
	}, [showModelOptions, hasRequiredCredentials, fetchSapAiCoreModels])

	// Handle automatic disabling of orchestration mode when not available
	useEffect(() => {
		if (hasCheckedOrchestration && !orchestrationAvailable && apiConfiguration?.sapAiCoreUseOrchestrationMode) {
			handleFieldChange("sapAiCoreUseOrchestrationMode", false)
		}
	}, [hasCheckedOrchestration, orchestrationAvailable, apiConfiguration?.sapAiCoreUseOrchestrationMode, handleFieldChange])

	// Handle model selection
	const handleModelChange = useCallback(
		(modelId: string) => {
			handleModeFieldChange({ plan: "planModeApiModelId", act: "actModeApiModelId" }, modelId, currentMode)
		},
		[handleModeFieldChange, currentMode],
	)

	// Handle blur events with change detection for credential fields
	const handleCredentialBlur = useCallback(
		(field: string, value: string, hasChanged: boolean) => {
			if (hasChanged && showModelOptions) {
				// Only fetch models if the value actually changed and we're showing model options
				fetchSapAiCoreModels()
			}
		},
		[showModelOptions, fetchSapAiCoreModels],
	)

	return (
		<div className="flex flex-col gap-1.5">
			<DebouncedTextField
				initialValue={apiConfiguration?.sapAiCoreClientId || ""}
				onChange={(value) => handleFieldChange("sapAiCoreClientId", value)}
				onBlur={(value, hasChanged) => handleCredentialBlur("sapAiCoreClientId", value, hasChanged)}
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
				onBlur={(value, hasChanged) => handleCredentialBlur("sapAiCoreClientSecret", value, hasChanged)}
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
				onBlur={(value, hasChanged) => handleCredentialBlur("sapAiCoreBaseUrl", value, hasChanged)}
				style={{ width: "100%" }}
				placeholder="Enter AI Core Base URL...">
				<span className="font-medium">AI Core Base URL</span>
			</DebouncedTextField>

			<DebouncedTextField
				initialValue={apiConfiguration?.sapAiCoreTokenUrl || ""}
				onChange={(value) => handleFieldChange("sapAiCoreTokenUrl", value)}
				onBlur={(value, hasChanged) => handleCredentialBlur("sapAiCoreTokenUrl", value, hasChanged)}
				style={{ width: "100%" }}
				placeholder="Enter AI Core Auth URL...">
				<span className="font-medium">AI Core Auth URL</span>
			</DebouncedTextField>

			<DebouncedTextField
				initialValue={apiConfiguration?.sapAiResourceGroup || ""}
				onChange={(value) => handleFieldChange("sapAiResourceGroup", value)}
				onBlur={(value, hasChanged) => handleCredentialBlur("sapAiResourceGroup", value, hasChanged)}
				style={{ width: "100%" }}
				placeholder="Enter AI Core Resource Group...">
				<span className="font-medium">AI Core Resource Group</span>
			</DebouncedTextField>

			<p className="text-xs mt-[5px] text-[var(--vscode-descriptionForeground)]">
				These credentials are stored locally and only used to make API requests from this extension.
				<VSCodeLink
					href="https://help.sap.com/docs/sap-ai-core/sap-ai-core-service-guide/access-sap-ai-core-via-api"
					className="inline">
					You can find more information about SAP AI Core API access here.
				</VSCodeLink>
			</p>

			{orchestrationAvailable && (
				<div className="flex flex-col gap-2.5 mt-[15px]">
					<div className="flex items-center gap-2">
						<VSCodeCheckbox
							checked={apiConfiguration?.sapAiCoreUseOrchestrationMode ?? true}
							onChange={(e) => handleOrchestrationChange((e.target as HTMLInputElement).checked)}
							aria-label="Orchestration Mode"
						/>
						<span className="font-medium">Orchestration Mode</span>
					</div>

					<p className="text-xs text-[var(--vscode-descriptionForeground)]">
						When enabled, provides access to all available models without requiring individual deployments.
						<br />
						<br />
						When disabled, provides access only to deployed models in your AI Core service instance.
					</p>
				</div>
			)}

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
								{deployedModelsArray.length === 0 && (
									<div className="text-xs text-[var(--vscode-errorForeground)] mb-2">
										Unable to fetch models from SAP AI Core service instance. Please check your SAP AI Core
										configuration or ensure your deployments are deployed and running in the service instance
									</div>
								)}
								<SapAiCoreModelPicker
									sapAiCoreDeployedModels={deployedModelsArray}
									selectedModelId={selectedModelId || ""}
									onModelChange={handleModelChange}
									placeholder="Select a model..."
									useOrchestrationMode={apiConfiguration?.sapAiCoreUseOrchestrationMode ?? true}
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
